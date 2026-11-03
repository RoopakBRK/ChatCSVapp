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
