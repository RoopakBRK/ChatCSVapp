import threading
import time

import pytest

from chatapp import session_db, sessions
from chatapp.config import settings


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(session_db, "_sessions", {})
    monkeypatch.setattr(session_db, "_session_locks", {})
    calls = []
    real = session_db.clean_csv
    monkeypatch.setattr(session_db, "clean_csv", lambda p: (calls.append(p.name), real(p))[1])
    return calls


def new_session(files: dict[str, str]) -> str:
    sid = sessions.get_or_create_session(None)
    for name, text in files.items():
        (sessions.session_dir(sid) / name).write_text(text)
    return sid


def restart():
    session_db._sessions.clear()  # what a server restart (or idle eviction) does


def test_restore_opens_the_file_without_cleaning_again(store):
    sid = new_session({"orders.csv": "order_id,total\n1,5\n2,7\n", "cust.csv": "customer_id\n1\n"})
    first = session_db.get_session(sid)
    assert sorted(store) == ["cust.csv", "orders.csv"]  # cleaned once on first open
    summaries = [f.model_dump() for f in first.summaries()]
    assert (sessions.session_dir(sid) / "session.duckdb").exists()
    assert (sessions.session_dir(sid) / "manifest.json").exists()

    store.clear()
    restart()
    again = session_db.get_session(sid)
    assert store == []  # nothing was cleaned: the database file was simply opened
    assert [f.model_dump() for f in again.summaries()] == summaries
    assert again.run_query("SELECT sum(total) FROM orders")[1] == [[12]]


def test_changed_csv_is_cleaned_again_and_unchanged_one_is_not(store):
    sid = new_session({"a.csv": "x\n1\n", "b.csv": "y\n1\n"})
    session_db.get_session(sid)
    (sessions.session_dir(sid) / "a.csv").write_text("x\n1\n2\n3\n")
    store.clear()
    restart()
    db = session_db.get_session(sid)
    assert store == ["a.csv"]
    assert {f.table_name: f.row_count for f in db.summaries()} == {"a": 3, "b": 1}


def test_deleted_csv_disappears(store):
    sid = new_session({"a.csv": "x\n1\n", "b.csv": "y\n1\n"})
    session_db.get_session(sid)
    (sessions.session_dir(sid) / "b.csv").unlink()
    restart()
    db = session_db.get_session(sid)
    assert [f.table_name for f in db.summaries()] == ["a"]
    with pytest.raises(Exception):
        db.run_query("SELECT * FROM b")


def test_damaged_database_is_rebuilt_from_the_csvs(store):
    sid = new_session({"a.csv": "x\n1\n2\n"})
    session_db.get_session(sid).con.close()
    restart()
    (sessions.session_dir(sid) / "session.duckdb").write_bytes(b"this is not a duckdb file")
    store.clear()
    db = session_db.get_session(sid)
    assert store == ["a.csv"] and db.summaries()[0].row_count == 2


def test_unreadable_manifest_means_rebuild(store):
    sid = new_session({"a.csv": "x\n1\n"})
    session_db.get_session(sid)
    (sessions.session_dir(sid) / "manifest.json").write_text("{not json")
    restart()
    store.clear()
    assert session_db.get_session(sid).summaries()[0].row_count == 1
    assert store == ["a.csv"]


def test_a_slow_session_does_not_block_other_sessions(store, monkeypatch):
    slow, fast = new_session({"a.csv": "x\n1\n"}), new_session({"b.csv": "y\n1\n"})
    gate, started = threading.Event(), threading.Event()
    real = session_db._open_session

    def open_session(sid):
        if sid == slow:
            started.set()
            gate.wait(5)
        return real(sid)

    monkeypatch.setattr(session_db, "_open_session", open_session)
    t = threading.Thread(target=session_db.get_session, args=(slow,))
    t.start()
    assert started.wait(2)
    begun = time.monotonic()
    assert session_db.get_session(fast) is not None  # returns while the other session is still opening
    assert time.monotonic() - begun < 2
    gate.set()
    t.join(5)


def test_two_requests_for_one_session_open_it_once(store, monkeypatch):
    sid = new_session({"a.csv": "x\n1\n"})
    opened = []
    real = session_db._open_session

    def open_session(s):
        opened.append(s)
        time.sleep(0.2)
        return real(s)

    monkeypatch.setattr(session_db, "_open_session", open_session)
    results = []
    threads = [threading.Thread(target=lambda: results.append(session_db.get_session(sid))) for _ in range(4)]
    [t.start() for t in threads]
    [t.join(5) for t in threads]
    assert len(opened) == 1 and len({id(r) for r in results}) == 1
