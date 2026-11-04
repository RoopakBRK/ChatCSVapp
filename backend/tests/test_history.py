"""Per-session history, deleting chats, the _columns table, column listings, and the fallback key."""
import json
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from groq import RateLimitError, AuthenticationError

from chatapp import history, llm, session_db
from chatapp.config import settings
from chatapp.main import app
from schemas.llm import LLMResponse

ORDERS = "Order ID,Customer Name,Total Price,Order Date,Paid\n1,ann,10.5,2024-01-05,true\n2,bob,20,2024-02-05,false\n"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(session_db, "_sessions", {})
    monkeypatch.setattr(session_db, "_session_locks", {})
    monkeypatch.setattr(llm, "explain_result", lambda *a, **k: "Ann and Bob.")
    return TestClient(app)


def upload(client, name="orders.csv", text=ORDERS, sid=None):
    data = {"session_id": sid} if sid else None
    return client.post("/files", data=data, files=[("files", (name, text.encode(), "text/csv"))]).json()["session_id"]


def plan(**kw):
    base = {"sql": "SELECT customer_name, total_price FROM orders ORDER BY 1", "chart": None, "needs_clarification": False}
    return LLMResponse.model_validate({**base, **kw})


def ask(client, sid, text="who bought what?"):
    return client.post("/chat", json={"message": text, "session_id": sid})


# ---- history lives in the session folder ----

def test_answers_are_saved_and_returned_for_that_session_only(client, monkeypatch):
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan())
    mine, other = upload(client), upload(client)
    answer = ask(client, mine).json()
    ask(client, other, "something else")

    msgs = client.get(f"/sessions/{mine}/history").json()["messages"]
    assert [m["kind"] for m in msgs] == ["notice", "question", "answer"]
    assert msgs[0]["text"] == "Uploaded: orders.csv"
    assert msgs[2]["id"] == answer["id"] and msgs[2]["answer"]["sql"].startswith("SELECT customer_name")
    assert "something else" not in json.dumps(msgs)
    assert client.get("/sessions/bad/history").status_code == 400
    assert client.get(f"/sessions/{'0' * 32}/history").status_code == 404


def test_the_model_gets_history_from_the_server(client, monkeypatch):
    seen = []
    monkeypatch.setattr(llm, "generate_plan", lambda q, f, r, turns, fb, **k: (seen.append(turns), plan())[1])
    sid = upload(client)
    ask(client, sid, "first question")
    ask(client, sid, "second question")
    assert seen[0] == []
    assert seen[1][0] == {"role": "user", "content": "first question"} and "SQL used" in seen[1][1]["content"]


def test_a_failed_question_is_not_saved_so_retry_is_not_duplicated(client, monkeypatch):
    sid = upload(client)

    def down(*a, **k):
        raise llm.LLMError("down")

    monkeypatch.setattr(llm, "generate_plan", down)
    assert ask(client, sid, "flaky question").status_code == 502
    seen = []
    monkeypatch.setattr(llm, "generate_plan", lambda q, f, r, turns, fb, **k: (seen.append(turns), plan())[1])
    assert ask(client, sid, "flaky question").status_code == 200  # the retry
    assert seen == [[]]  # the failed attempt is not in the model's history
    questions = [m for m in history.load(sid) if m["kind"] == "question"]
    assert [q["text"] for q in questions] == ["flaky question"]


def test_clarifications_and_replies_are_saved_too(client, monkeypatch):
    sid = upload(client)
    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: LLMResponse(reply="Hi there!"))
    ask(client, sid, "hi")
    kinds = [(m["kind"], m["text"]) for m in history.load(sid)][-2:]
    assert kinds == [("question", "hi"), ("reply", "Hi there!")]


def test_deleting_a_chat_removes_everything(client, monkeypatch):
    sid = upload(client)
    assert session_db.get_session(sid) is not None
    r = client.delete(f"/sessions/{sid}")
    assert r.status_code == 200
    assert not (settings.data_dir / sid).exists()
    assert client.get(f"/sessions/{sid}/history").status_code == 404
    assert client.delete(f"/sessions/{sid}").status_code == 404
    assert client.delete("/sessions/nope").status_code == 400


# ---- columns: original headers and plain types ----

def test_columns_table_has_original_headers_and_plain_types(client):
    sid = upload(client)
    db = session_db.get_session(sid)
    _, rows, _ = db.run_query("SELECT column_name, original_header, type FROM _columns ORDER BY column_name")
    assert rows == [
        ["customer_name", "Customer Name", "text"],
        ["order_date", "Order Date", "date"],
        ["order_id", "Order ID", "number"],
        ["paid", "Paid", "true/false"],
        ["total_price", "Total Price", "decimal"],
    ]
    with pytest.raises(Exception):
        db.run_query("DELETE FROM _columns")
    upload(client, "more.csv", "a\n1\n", sid=sid)
    assert db.run_query("SELECT count(DISTINCT table_name) FROM _columns")[1] == [[2]]


def test_a_file_called_columns_does_not_clash(client):
    sid = upload(client, "_columns.csv", "x\n1\n")
    assert session_db.get_session(sid).summaries()[0].table_name == "columns"


@pytest.mark.parametrize("t,plain", [
    ("BIGINT", "number"), ("DECIMAL(18,2)", "decimal"), ("DOUBLE", "decimal"), ("DATE", "date"),
    ("TIMESTAMP", "date and time"), ("VARCHAR", "text"), ("BOOLEAN", "true/false"),
])
def test_plain_type_names(t, plain):
    assert session_db.plain_type(t) == plain


def test_column_lists_are_written_in_code_with_every_row(client, monkeypatch):
    def explain(*a, **k):
        raise AssertionError("no AI call for a list of columns")

    monkeypatch.setattr(llm, "generate_plan", lambda *a, **k: plan(
        sql="SELECT table_name, column_name, original_header, type FROM _columns ORDER BY column_name"))
    monkeypatch.setattr(llm, "explain_result", explain)
    sid = upload(client)
    text = ask(client, sid, "what are the columns?").json()["explanation"]
    assert text.splitlines() == [
        "**orders** has 5 columns:",
        '- customer_name (original header: "Customer Name") - text',
        '- order_date (original header: "Order Date") - date',
        '- order_id (original header: "Order ID") - number',
        '- paid (original header: "Paid") - true/false',
        '- total_price (original header: "Total Price") - decimal',
    ]


# ---- the fallback Groq key ----

def _response(status):
    return httpx.Response(status, request=httpx.Request("POST", "https://api.groq.com"))


class Key:
    def __init__(self, error=None):
        self.error, self.calls = error, 0
        self.chat = self
        self.completions = self

    def create(self, **kw):
        self.calls += 1
        if self.error:
            raise self.error
        msg = type("M", (), {"content": json.dumps({"sql": "SELECT 1", "chart": None, "needs_clarification": False})})
        return type("C", (), {"choices": [type("Ch", (), {"message": msg})]})


@pytest.mark.parametrize("error", [
    RateLimitError("slow down", response=_response(429), body=None),
    AuthenticationError("bad key", response=_response(401), body=None),
])
def test_fallback_key_takes_over(error, monkeypatch):
    monkeypatch.setattr(settings, "llm_max_retries", 0)
    main, backup = Key(error), Key()
    result = llm.generate_plan("q", [], [], client=[main, backup])
    assert result.sql == "SELECT 1" and main.calls == 1 and backup.calls == 1


def test_keys_come_from_both_variables(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    monkeypatch.setenv("GROQ_FALLBACK_API_KEY", "gsk_b")
    assert llm.is_configured() and not llm.has_fallback()
    monkeypatch.setenv("GROQ_API_KEY", "gsk_a")
    assert llm.has_fallback() and len(llm._clients()) == 2
    monkeypatch.setenv("GROQ_FALLBACK_API_KEY", "gsk_a")  # the same key twice is one key
    assert not llm.has_fallback()


# ---- migrating the old chat.md log ----

def test_migration_moves_old_chats_into_their_folders(client, tmp_path):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import migrate_chat_md

    sid = upload(client)
    (settings.data_dir / sid / history.FILE_NAME).unlink()
    gone = "f" * 32
    md = tmp_path / "chat.md"
    md.write_text(
        "# Development conversation\nnot part of the app log\n\n## App chat log\n\n"
        f"<!-- msg role=system ts=2026-11-03T10:00:00.000Z session={sid} -->\n**System** · x\n\nUploaded: orders.csv\n\n"
        f"<!-- msg role=user ts=2026-11-03T10:01:00.000Z session={sid} -->\n**You** · x\n\nbroken question\n\n"
        f"<!-- msg role=system ts=2026-11-03T10:01:05.000Z session={sid} -->\n**System** · x\n\nThe AI service is busy\n\n"
        f"<!-- msg role=user ts=2026-11-03T10:02:00.000Z session={sid} -->\n**You** · x\n\nwho bought what?\n\n"
        f"<!-- msg role=assistant ts=2026-11-03T10:02:05.000Z session={sid} -->\n**Assistant** · x\n\nAnn and Bob.\n\n```sql\nSELECT 1\n```\n"
        '<!-- result {"question":"who bought what?","sql":"SELECT customer_name FROM orders","chart":null} -->\n\n'
        f"<!-- msg role=user ts=2026-11-03T10:03:00.000Z session={gone} -->\n**You** · x\n\nlost chat\n\n"
    )
    chats = migrate_chat_md.migrate(md)
    assert chats == [{"id": sid, "title": "who bought what?", "lastTs": "2026-11-03T10:02:05.000Z"}]
    msgs = history.load(sid)
    assert [(m["kind"], m["text"]) for m in msgs] == [
        ("notice", "Uploaded: orders.csv"), ("question", "who bought what?"), ("answer", "Ann and Bob.")]
    r = client.post("/query", json={"session_id": sid, "answer_id": msgs[2]["id"]})
    assert r.status_code == 200 and r.json()["rows"] == [["ann"], ["bob"]]
    assert migrate_chat_md.migrate(md) == []  # never overwrites an existing history
