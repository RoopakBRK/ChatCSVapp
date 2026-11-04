import json
from types import SimpleNamespace

import httpx
import pytest
from groq import APIConnectionError, BadRequestError, RateLimitError
from pydantic import ValidationError

from chatapp import llm
from schemas.files import ColumnInfo, FileSummary
from schemas.llm import LLMResponse


def make_file():
    cols = [
        ColumnInfo(name="order_id", original_name="order_id", type="BIGINT", missing=0, missing_pct=0),
        ColumnInfo(name="status", original_name="Status", type="VARCHAR", missing=2, missing_pct=1,
                   distinct_values=["Completed", "Pending"]),
        ColumnInfo(name="order_date", original_name="order_date", type="DATE", missing=0, missing_pct=0,
                   min="2023-01-01", max="2024-12-31"),
    ]
    return FileSummary(file_name="orders.csv", table_name="orders", size=1, rows_read=10, row_count=10,
                       column_count=3, columns=cols, missing_total=2, sample_rows=[], cleaning_steps=[],
                       outliers=[])


FILES = [make_file()]
TABLES = FILES  # kept for the call sites below
GOOD = {
    "sql": "SELECT order_date, sum(total_price) AS revenue FROM orders GROUP BY 1",
    "chart": {"type": "line", "x": "order_date", "y": "revenue", "title": "Revenue"},
    "needs_clarification": False,
    "question": None,
}


class FakeClient:
    """Each item in `script` is returned as message content, or raised if it's an exception."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls += 1
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=item))])


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)


def conn_error():
    return APIConnectionError(request=httpx.Request("POST", "https://api.groq.com"))


def test_valid_response():
    client = FakeClient([json.dumps(GOOD)])
    result = llm.generate_plan("revenue by day", FILES, [], client=client)
    assert result.chart.type == "line" and client.calls == 1


def test_clarification():
    payload = {"sql": None, "chart": None, "needs_clarification": True, "question": "Which year?"}
    result = llm.generate_plan("revenue", FILES, [], client=FakeClient([json.dumps(payload)]))
    assert result.needs_clarification and result.question == "Which year?"


def test_retries_transient_errors_then_succeeds():
    client = FakeClient([conn_error(), json.dumps(GOOD)])
    assert llm.generate_plan("q", FILES, [], client=client).sql
    assert client.calls == 2


def test_retries_invalid_json_then_gives_up_after_one_retry():
    client = FakeClient(["not json"] * 2)
    with pytest.raises(llm.LLMError):
        llm.generate_plan("q", FILES, [], client=client)
    assert client.calls == 2  # 1 attempt + 1 retry


def test_non_retryable_error_fails_immediately():
    err = BadRequestError("bad", response=httpx.Response(400, request=httpx.Request("POST", "x")), body=None)
    client = FakeClient([err])
    with pytest.raises(llm.LLMError):
        llm.generate_plan("q", FILES, [], client=client)
    assert client.calls == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"needs_clarification": True},  # no question
        {"needs_clarification": False},  # no sql
        {"sql": "DROP TABLE orders"},
        {"sql": "SELECT 1; DELETE FROM orders"},
        {"sql": "SELECT 1", "chart": {"type": "donut", "x": "a", "y": "b", "title": "t"}},
        {"sql": "SELECT 1", "chart": {"type": "bar", "x": "a"}},  # bar needs y and title
    ],
)
def test_schema_rejects_bad_output(payload):
    with pytest.raises(ValidationError):
        LLMResponse.model_validate(payload)


def test_trailing_semicolon_is_stripped():
    assert LLMResponse.model_validate({"sql": "SELECT 1;"}).sql == "SELECT 1"


def test_chart_none_needs_no_columns():
    r = LLMResponse.model_validate({"sql": "SELECT count(*) AS n FROM orders", "chart": {"type": "none"}})
    assert r.chart.type == "none"


def test_schema_description_has_types_values_and_ranges():
    text = llm.describe_schema(FILES, [])
    assert "status VARCHAR {Completed | Pending} (2 missing)" in text
    assert "order_date DATE [2023-01-01 .. 2024-12-31]" in text


def test_explain_result_returns_text():
    client = FakeClient(["  Revenue was highest in March.  "])
    assert llm.explain_result("q", ["m", "r"], [["Mar", 5]], 1, False, client=client) == "Revenue was highest in March."


def limit(headers):
    resp = httpx.Response(429, headers=headers, request=httpx.Request("POST", "x"))
    return RateLimitError("slow down", response=resp, body=None)


def test_rate_limit_waits_as_long_as_groq_asks_then_succeeds(monkeypatch):
    sleeps = []
    monkeypatch.setattr(llm.time, "sleep", sleeps.append)
    client = FakeClient([limit({"retry-after": "17"}), limit({"retry-after": "4"}), json.dumps(GOOD)])
    assert llm.generate_plan("q", FILES, [], client=client, deadline=llm.time.monotonic() + 60).sql
    assert client.calls == 3 and [round(s) for s in sleeps] == [17, 4]  # no 10 s cap, no retry budget used


def test_rate_limit_longer_than_the_time_left_fails_at_once(monkeypatch):
    sleeps = []
    monkeypatch.setattr(llm.time, "sleep", sleeps.append)
    client = FakeClient([limit({"retry-after": "30"}), json.dumps(GOOD)])
    with pytest.raises(llm.LLMRateLimitError) as err:
        llm.generate_plan("q", FILES, [], client=client, deadline=llm.time.monotonic() + 20)
    assert client.calls == 1 and sleeps == [] and round(err.value.wait) == 30


def test_rate_limit_uses_the_key_that_is_free_soonest(monkeypatch):
    sleeps = []
    monkeypatch.setattr(llm.time, "sleep", sleeps.append)
    main = FakeClient([limit({"retry-after": "9"}), json.dumps(GOOD)])
    backup = FakeClient([limit({"retry-after": "2"}), json.dumps(GOOD)])
    assert llm.generate_plan("q", FILES, [], client=[main, backup], deadline=llm.time.monotonic() + 60).sql
    assert (main.calls, backup.calls) == (1, 2) and [round(s) for s in sleeps] == [2]


def test_rate_limit_gives_up_after_many_429s():
    client = FakeClient([limit({"retry-after": "1"})] * llm.MAX_RATE_LIMITS)
    with pytest.raises(llm.LLMRateLimitError):
        llm.generate_plan("q", FILES, [], client=client)
    assert client.calls == llm.MAX_RATE_LIMITS


@pytest.mark.parametrize("headers,wait", [
    ({"retry-after": "3"}, 3.0),
    ({"x-ratelimit-reset-tokens": "7.66s", "x-ratelimit-remaining-tokens": "0",
      "x-ratelimit-reset-requests": "2m59.56s", "x-ratelimit-remaining-requests": "12"}, 7.66),
    ({"x-ratelimit-reset-requests": "1m2s", "x-ratelimit-remaining-requests": "0"}, 62.0),
    ({"x-ratelimit-reset-tokens": "120ms"}, 0.12),
    ({}, None),
])
def test_rate_limit_wait_comes_from_groqs_headers(headers, wait):
    got = llm.rate_limit_wait(limit(headers))
    assert got == wait if wait is None else abs(got - wait) < 1e-6


def test_effort_is_sent_as_reasoning_effort():
    seen = []
    client = FakeClient([json.dumps(GOOD)] * 2)
    original = client._create
    client.chat.completions.create = lambda **kw: (seen.append(kw.get("reasoning_effort")), original(**kw))[1]
    llm.generate_plan("q", FILES, [], client=client)
    llm.generate_plan("q", FILES, [], client=client, effort="high")
    assert seen == ["medium", "high"]


def test_deadline_in_the_past_means_no_call():
    client = FakeClient([json.dumps(GOOD)])
    with pytest.raises(llm.LLMTimeoutError):
        llm.generate_plan("q", FILES, [], client=client, deadline=llm.time.monotonic() - 1)
    assert client.calls == 0


def test_call_timeout_is_capped_by_the_deadline(monkeypatch):
    seen = []
    client = FakeClient([json.dumps(GOOD)])
    original = client._create
    client.chat.completions.create = lambda **kw: (seen.append(kw["timeout"]), original(**kw))[1]
    llm.generate_plan("q", FILES, [], client=client, deadline=llm.time.monotonic() + 3)
    assert seen[0] <= 3 < llm.settings.llm_timeout_seconds


def test_no_retry_when_the_wait_would_pass_the_deadline():
    client = FakeClient([conn_error(), json.dumps(GOOD)])
    with pytest.raises(llm.LLMTimeoutError):
        llm.generate_plan("q", FILES, [], client=client, deadline=llm.time.monotonic() + 0.5)  # backoff is 1s
    assert client.calls == 1


def test_invalid_reply_is_corrected_with_feedback_not_repeated():
    seen = []
    client = FakeClient([json.dumps({"sql": None, "needs_clarification": False}), json.dumps(GOOD)])
    original = client._create
    client.chat.completions.create = lambda **kw: (seen.append(kw["messages"]), original(**kw))[1]
    assert llm.generate_plan("what columns are there?", FILES, [], client=client).sql
    assert len(seen) == 2 and len(seen[1]) == len(seen[0]) + 2
    assert "not valid" in seen[1][-1]["content"] and "sql is required" in seen[1][-1]["content"]
    assert seen[1][-2]["role"] == "assistant"


def test_json_validate_failed_is_retried_and_high_effort_gets_more_tokens():
    """Groq answers 400 json_validate_failed when the JSON reply was cut off (e.g. long thinking)."""
    err = BadRequestError("Error code: 400 - {'error': {'code': 'json_validate_failed'}}",
                          response=httpx.Response(400, request=httpx.Request("POST", "x")), body=None)
    seen = []
    client = FakeClient([err, json.dumps(GOOD)])
    original = client._create
    client.chat.completions.create = lambda **kw: (seen.append(kw["max_completion_tokens"]), original(**kw))[1]
    assert llm.generate_plan("q", FILES, [], client=client, effort="high").sql
    assert client.calls == 2 and seen[0] == llm.PLAN_TOKENS["high"] > llm.PLAN_TOKENS["medium"]
