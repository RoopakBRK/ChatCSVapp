import pytest
from fastapi.testclient import TestClient

from api.route import chat as chat_route
from chatapp import llm, session_db, sessions
from chatapp.main import app
from schemas.llm import LLMResponse

ORDERS = "order_id,customer,total,order_date\n" + "\n".join(
    f"{i},{'ann' if i % 2 else 'bob'},{10 * i},2024-0{1 + i % 3}-05" for i in range(1, 7))


def plan(**kw):
    base = {"sql": "SELECT customer, sum(total) AS revenue FROM orders GROUP BY 1 ORDER BY 2 DESC",
            "chart": {"type": "bar", "x": "customer", "y": "revenue", "title": "Revenue"},
            "needs_clarification": False, "question": None}
    return LLMResponse.model_validate({**base, **kw})


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "DATA_DIR", tmp_path)
    monkeypatch.setattr(session_db, "_sessions", {})
    client = TestClient(app)
    sid = client.post("/files", files=[("files", ("orders.csv", ORDERS.encode(), "text/csv"))]).json()["session_id"]
    monkeypatch.setattr(llm, "explain_result", lambda *a, **k: "Ann spent the most.")
    return client, sid


def ask(client, sid, text="who spent most?", history=None):
    return client.post("/chat", json={"message": text, "session_id": sid, "history": history or []})


def test_answer_with_chart(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan())
    body = ask(client, sid).json()
    assert body["type"] == "answer" and body["explanation"] == "Ann spent the most."
    assert body["columns"] == ["customer", "revenue"] and body["rows"][0][0] == "bob"
    assert body["chart"] == {"type": "bar", "x": "customer", "y": "revenue", "title": "Revenue"}


def test_clarification(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        sql=None, chart=None, needs_clarification=True, question="Which year?"))
    assert ask(client, sid).json() == {"type": "clarification", "question": "Which year?"}


def test_failed_sql_is_repaired_once(setup, monkeypatch):
    client, sid = setup
    calls = []

    def fake(question, files, rels, history, feedback, **kw):
        calls.append(feedback)
        return plan(sql="SELECT nope FROM orders") if not feedback else plan()

    monkeypatch.setattr(llm, "generate_plan", fake)
    assert ask(client, sid).json()["type"] == "answer"
    assert len(calls) == 2 and "failed in DuckDB" in calls[1][1]["content"]


def test_cannot_answer_after_two_failures(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(sql="SELECT nope FROM orders"))
    r = ask(client, sid)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "cannot_answer"


def test_chart_dropped_when_columns_dont_match(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        chart={"type": "line", "x": "customer", "y": "missing_col", "title": "t"}))
    assert ask(client, sid).json()["chart"] is None


def test_chart_dropped_for_non_numeric_y(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        sql="SELECT customer, order_date FROM orders",
        chart={"type": "bar", "x": "customer", "y": "order_date", "title": "t"}))
    assert ask(client, sid).json()["chart"] is None


def test_explanation_failure_still_returns_data(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan())

    def boom(*a, **k):
        raise llm.LLMError("down")

    monkeypatch.setattr(llm, "explain_result", boom)
    body = ask(client, sid).json()
    assert body["type"] == "answer" and body["rows"]


def test_dangerous_sql_never_runs(setup, monkeypatch):
    client, sid = setup
    # The schema validator rejects it before it can reach DuckDB, so the model gets retried and fails.
    with pytest.raises(Exception):
        LLMResponse.model_validate({"sql": "SELECT * FROM read_csv('/etc/passwd'); DROP TABLE orders"})
    db = session_db.get_session(sid)
    with pytest.raises(Exception):
        db.run_query("SELECT * FROM read_csv('/etc/hosts')")
    with pytest.raises(Exception):
        db.run_query("COPY orders TO '/tmp/leak.csv'")


def test_row_limit(setup, monkeypatch):
    client, sid = setup
    db = session_db.get_session(sid)
    cols, rows, truncated = db.run_query("SELECT * FROM range(10) t(n)", max_rows=4)
    assert len(rows) == 4 and truncated


@pytest.mark.parametrize("sid,status,code", [("0" * 32, 404, "session_not_found"), ("bad", 400, "invalid_session")])
def test_session_errors(setup, sid, status, code):
    client, _ = setup
    r = ask(client, sid)
    assert r.status_code == status and r.json()["detail"]["code"] == code


def test_llm_errors_are_friendly(setup, monkeypatch):
    client, sid = setup

    def down(*a, **k):
        raise llm.LLMError("x")

    monkeypatch.setattr(llm, "generate_plan", down)
    assert ask(client, sid).status_code == 502

    def nokey(*a, **k):
        raise llm.LLMConfigError("no key")

    monkeypatch.setattr(llm, "generate_plan", nokey)
    assert ask(client, sid).status_code == 503


def test_empty_message_rejected(setup):
    client, sid = setup
    assert ask(client, sid, text="").status_code == 422


def test_rate_limit_message(setup, monkeypatch):
    client, sid = setup

    def limited(*a, **k):
        raise llm.LLMRateLimitError("429")

    monkeypatch.setattr(llm, "generate_plan", limited)
    r = ask(client, sid)
    assert r.status_code == 429 and r.json()["detail"]["code"] == "rate_limited"


def test_query_reruns_saved_sql(setup):
    client, sid = setup
    r = client.post("/query", json={"session_id": sid, "sql": "SELECT customer, count(*) AS n FROM orders GROUP BY 1 ORDER BY 1;"})
    assert r.status_code == 200 and r.json()["columns"] == ["customer", "n"] and r.json()["row_count"] == 2


def test_query_refuses_writes_and_bad_sessions(setup):
    client, sid = setup
    assert client.post("/query", json={"session_id": sid, "sql": "DROP TABLE orders"}).status_code == 422
    assert client.post("/query", json={"session_id": sid, "sql": "SELECT nope FROM orders"}).json()["detail"]["code"] == "query_failed"
    assert client.post("/query", json={"session_id": "0" * 32, "sql": "SELECT 1"}).status_code == 404


def test_stream_sends_steps_then_result(setup, monkeypatch):
    import json

    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan())
    r = client.post("/chat/stream", json={"message": "who spent most?", "session_id": sid, "history": []})
    events = [json.loads(line) for line in r.text.splitlines()]
    assert r.headers["content-type"].startswith("application/x-ndjson")
    assert [e["step"] for e in events if e["type"] == "step"] == ["reading", "querying", "running", "explaining"]
    assert events[-1]["type"] == "result" and events[-1]["data"]["type"] == "answer"
    assert events[-1]["data"]["rows"][0][0] == "bob"


def test_stream_reports_errors_as_events(setup, monkeypatch):
    import json

    client, sid = setup

    def late(*a, **k):
        raise llm.LLMTimeoutError("deadline")

    monkeypatch.setattr(llm, "generate_plan", late)
    events = [json.loads(l) for l in client.post("/chat/stream", json={"message": "q", "session_id": sid, "history": []}).text.splitlines()]
    assert events[-1] == {"type": "error", "status": 504, "code": "timeout", "message": events[-1]["message"]}
    assert client.post("/chat/stream", json={"message": "q", "session_id": "0" * 32, "history": []}).text.count("session_not_found") == 1


def test_timeout_message_on_plain_chat(setup, monkeypatch):
    client, sid = setup

    def late(*a, **k):
        raise llm.LLMTimeoutError("deadline")

    monkeypatch.setattr(llm, "generate_plan", late)
    r = ask(client, sid)
    assert r.status_code == 504 and r.json()["detail"]["code"] == "timeout"


def test_deadline_is_passed_to_every_llm_call(setup, monkeypatch):
    client, sid = setup
    seen = []
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: (seen.append(k["deadline"]), plan())[1])
    monkeypatch.setattr(llm, "explain_result", lambda *a, **k: (seen.append(k["deadline"]), "ok")[1])
    assert ask(client, sid).status_code == 200
    assert len(seen) == 2 and seen[0] == seen[1] and seen[0] > 0


def test_scatter_kept_for_numeric_x_and_downgraded_otherwise(setup, monkeypatch):
    client, sid = setup
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        sql="SELECT order_id, total FROM orders ORDER BY 1",
        chart={"type": "scatter", "x": "order_id", "y": "total", "title": "Orders"}))
    assert ask(client, sid).json()["chart"]["type"] == "scatter"
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        chart={"type": "scatter", "x": "customer", "y": "revenue", "title": "t"}))
    assert ask(client, sid).json()["chart"]["type"] == "bar"
