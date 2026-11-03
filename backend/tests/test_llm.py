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


def test_rate_limit_waits_for_retry_after_then_raises_specific_error(monkeypatch):
    sleeps = []
    monkeypatch.setattr(llm.time, "sleep", sleeps.append)
    resp = httpx.Response(429, headers={"retry-after": "7"}, request=httpx.Request("POST", "x"))
    client = FakeClient([RateLimitError("slow down", response=resp, body=None) for _ in range(2)])
    with pytest.raises(llm.LLMRateLimitError):
        llm.generate_plan("q", FILES, [], client=client)
    assert client.calls == 2
    assert sleeps[0] == 7.0 and max(sleeps) <= llm.MAX_WAIT_SECONDS  # honours Retry-After, but is capped


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
    assert seen[0] <= 3 < llm.TIMEOUT_SECONDS


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
