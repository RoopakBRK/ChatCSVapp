from chatapp.session_db import SessionDB
from chatapp.suggestions import starter_questions


def build(tmp_path, tables: dict[str, str]):
    db = SessionDB("d" * 32)
    for name, text in tables.items():
        (tmp_path / f"{name}.csv").write_text(text)
        db.load_csv(tmp_path / f"{name}.csv")
    return starter_questions(db.summaries(), db.relationships)


def test_questions_come_from_links_dates_and_categories(tmp_path):
    orders = "order_id,customer_id,order_date,status,total\n" + "\n".join(
        f"{i},{1 + i % 3},2024-0{1 + i % 4}-05,{'paid' if i % 2 else 'open'},{10 + i}" for i in range(1, 25))
    customers = "customer_id,first_name,email\n1,Ann,a@x.com\n2,Bob,b@x.com\n3,Cy,c@x.com\n"
    qs = build(tmp_path, {"orders": orders, "customers": customers})
    assert "Which customers have the most orders?" in qs
    assert "How does total change by month in orders?" in qs
    assert "Compare total across each status in orders." in qs
    assert 3 <= len(qs) <= 4
    assert not any("first name" in q or "email" in q for q in qs)  # people's names aren't categories


def test_single_plain_table_still_gets_a_question(tmp_path):
    qs = build(tmp_path, {"notes": "amount\n5\n7\n"})
    assert qs[0] == "Give me an overview of notes." and "Show the top 5 notes by amount." in qs and len(qs) <= 4


def test_missing_values_are_offered(tmp_path):
    qs = build(tmp_path, {"a": "x,y\n1,\n2,5\n3,\n", "b": "z\n1\n"})
    assert "Which columns have missing values?" in qs


def test_digit_prefix_is_not_read_aloud(tmp_path):
    qs = build(tmp_path, {"2014 sales": "day,amount\n2024-01-01,5\n2024-02-01,7\n2024-03-01,9\n"})
    assert any("in 2014 sales" in q for q in qs) and not any("t 2014" in q for q in qs)
