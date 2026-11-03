import pytest
from fastapi.testclient import TestClient

from chatapp import session_db, sessions
from chatapp.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "DATA_DIR", tmp_path)
    monkeypatch.setattr(session_db, "_sessions", {})
    return TestClient(app)


def csv(name, text):
    return ("files", (name, text.encode(), "text/csv"))


def test_upload_several_then_get(client):
    r = client.post("/files", files=[
        csv("Customers.csv", "Customer ID,Name\n1,a\n2,b\n"),
        csv("orders.csv", "order_id,customer_id\n1,1\n2,1\n3,2\n3,2\n"),
        ("files", ("notes.txt", b"hi", "text/plain")),
    ])
    assert r.status_code == 200
    body = r.json()
    assert body["uploaded"] == ["Customers.csv", "orders.csv"]
    assert body["rejected"][0]["name"] == "notes.txt"
    orders = next(f for f in body["files"] if f["table_name"] == "orders")
    assert (orders["rows_read"], orders["row_count"]) == (4, 3)
    assert [s["action"] for s in orders["cleaning_steps"] if s["action"] == "drop_duplicate_rows"]
    assert body["relationships"][0]["join"] == "orders.customer_id = customers.customer_id"

    sid = body["session_id"]
    # A second upload joins the same session; GET returns everything.
    client.post("/files", data={"session_id": sid}, files=[csv("payments.csv", "p_id,order_id\n1,1\n")])
    got = client.get("/files", params={"session_id": sid}).json()
    assert [f["table_name"] for f in got["files"]] == ["customers", "orders", "payments"]


def test_get_rebuilds_after_memory_loss(client):
    sid = client.post("/files", files=[csv("a.csv", "x\n1\n")]).json()["session_id"]
    session_db._sessions.clear()  # simulate a restart
    assert client.get("/files", params={"session_id": sid}).json()["files"][0]["row_count"] == 1


def test_errors(client):
    assert client.get("/files", params={"session_id": "../x"}).status_code == 400
    assert client.get("/files", params={"session_id": "0" * 32}).status_code == 404
    bad = client.post("/files", files=[csv("bad.csv", "a,b\n1,2,3\n")])
    assert bad.status_code == 400
    assert "row 1 has 3 fields" in bad.json()["detail"]["rejected"][0]["reason"]


def test_bad_reupload_keeps_good_file(client):
    sid = client.post("/files", files=[csv("a.csv", "x\n1\n2\n")]).json()["session_id"]
    client.post("/files", data={"session_id": sid}, files=[csv("a.csv", "x,y\n1,2,3\n")])
    assert client.get("/files", params={"session_id": sid}).json()["files"][0]["row_count"] == 2


def test_upload_and_get_include_starter_questions(client):
    body = client.post("/files", files=[csv("notes.csv", "amount\n5\n7\n")]).json()
    assert body["starter_questions"] == ["Give me an overview of notes."]
    assert client.get("/files", params={"session_id": body["session_id"]}).json()["starter_questions"] == body["starter_questions"]


def test_delete_file_removes_table_links_and_csv(client):
    from chatapp import sessions as s
    body = client.post("/files", files=[
        csv("customers.csv", "customer_id,name\n1,a\n2,b\n"),
        csv("orders.csv", "order_id,customer_id\n1,1\n2,1\n3,2\n"),
    ]).json()
    sid = body["session_id"]
    assert body["relationships"]

    r = client.delete("/files/customers.csv", params={"session_id": sid})
    assert r.status_code == 200
    assert [f["table_name"] for f in r.json()["files"]] == ["orders"]
    assert r.json()["relationships"] == []
    assert not (s.session_dir(sid) / "customers.csv").exists()
    # gone from queries too, and it stays gone after a restart
    assert client.post("/query", json={"session_id": sid, "sql": "SELECT * FROM customers"}).status_code == 422
    from chatapp import session_db
    session_db._sessions.clear()
    assert [f["table_name"] for f in client.get("/files", params={"session_id": sid}).json()["files"]] == ["orders"]


def test_delete_errors(client):
    sid = client.post("/files", files=[csv("a.csv", "x\n1\n")]).json()["session_id"]
    assert client.delete("/files/nope.csv", params={"session_id": sid}).status_code == 404
    assert client.delete("/files/a.csv", params={"session_id": "0" * 32}).status_code == 404
    assert client.delete("/files/a.csv", params={"session_id": "bad"}).status_code == 400
    assert client.delete("/files/..%5Ca.csv", params={"session_id": sid}).status_code in (400, 404)


def test_upload_from_url(client, monkeypatch):
    from api.route import files as files_route
    from chatapp.remote import RemoteFileError

    monkeypatch.setattr(files_route, "fetch_csv", lambda url: ("sheet.csv", b"region,sales\nnorth,5\nsouth,7\n"))
    body = client.post("/files/url", json={"url": "https://docs.google.com/spreadsheets/d/abc/edit"}).json()
    assert body["uploaded"] == ["sheet.csv"] and body["files"][0]["row_count"] == 2

    def refuse(url):
        raise RemoteFileError("Links to private or local network addresses are not allowed.")

    monkeypatch.setattr(files_route, "fetch_csv", refuse)
    r = client.post("/files/url", json={"url": "http://10.0.0.1/x.csv"})
    assert r.status_code == 400 and "private" in r.json()["detail"]["rejected"][0]["reason"]


def test_health_reports_the_key_without_revealing_it(client, monkeypatch):
    from chatapp import llm
    monkeypatch.setattr(llm, "load_dotenv", lambda *a, **k: None)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_secret_value")
    body = client.get("/health").json()
    assert body["groq_key_configured"] is True and "gsk_secret_value" not in str(body)
    monkeypatch.setenv("GROQ_API_KEY", "")
    assert client.get("/health").json()["groq_key_configured"] is False
