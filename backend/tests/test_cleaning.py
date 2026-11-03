import pytest

from chatapp.cleaning import CleaningError, clean_csv, safe_table_name, snake_case
from chatapp.session_db import SessionDB

MESSY = (
    "Order ID, Customer Name ,Zip Code,Amount,Signed Up,Active,Ship Date,Note\n"
    "1,  Ann   Lee ,02134,10.50,2024-01-05,true,03/04/2024,ok\n"
    "2,Bob,10001,N/A,2024-02-06,false,25/04/2024,\n"
    "2,Bob,10001,N/A,2024-02-06,false,25/04/2024,\n"
    ",,,,,,,\n"
    "3,Cy,94105,1000000.00,2024-03-07,true,01/05/2024,NA\n"
    "4,Di,60601,11.25,2024-04-08,true,02/05/2024,\n"
)


def steps(result, action, column=None):
    return [s for s in result.steps if s.action == action and (column is None or s.column == column)]


@pytest.fixture
def messy(tmp_path):
    p = tmp_path / "My Orders (2024).csv"
    p.write_text(MESSY)
    return p, clean_csv(p)


def test_names():
    assert snake_case("Order ID") == "order_id"
    assert snake_case("customerName") == "customer_name"
    assert snake_case("  Total ($) ") == "total"
    assert safe_table_name("My Orders (2024).csv") == "my_orders_2024"
    assert safe_table_name("2024 sales.csv") == "t_2024_sales"


def test_headers_snake_case_and_recorded(messy):
    _, r = messy
    assert [c.name for c in r.columns][:3] == ["order_id", "customer_name", "zip_code"]
    assert steps(r, "rename_column", "customer_name")


def test_trim_and_nulls_not_guessed(messy):
    _, r = messy
    assert r.df.loc[0, "customer_name"] == "Ann Lee"
    assert steps(r, "trim_whitespace", "customer_name")[0].count == 1
    # N/A -> NULL, but "NA" is kept: it could be a real value.
    assert r.df["amount"].isna().sum() == 1
    assert "NA" in set(r.df["note"].dropna())


def test_drops_are_counted(messy):
    _, r = messy
    assert r.rows_read == 6
    assert steps(r, "drop_empty_rows")[0].count == 1
    assert steps(r, "drop_duplicate_rows")[0].count == 1
    assert len(r.df) == 4


def test_type_detection(messy):
    _, r = messy
    types = {c.name: c.sql_type for c in r.columns}
    assert types["order_id"] == "BIGINT"
    assert types["zip_code"] == "VARCHAR"  # leading zero: not a number
    assert types["amount"] == "DECIMAL(18,2)"
    assert types["signed_up"] == "DATE"
    assert types["active"] == "BOOLEAN"
    assert types["ship_date"] == "DATE"  # 25/04 proves day-first
    assert types["note"] == "VARCHAR"


def test_ambiguous_dates_stay_text(tmp_path):
    p = tmp_path / "d.csv"
    p.write_text("d\n01/02/2024\n03/04/2024\n")
    r = clean_csv(p)
    assert r.columns[0].sql_type == "VARCHAR"
    assert steps(r, "kept_as_text", "d")


def test_mostly_numeric_stays_text(tmp_path):
    p = tmp_path / "m.csv"
    p.write_text("v\n" + "\n".join(str(i) for i in range(20)) + "\nabc\n")
    r = clean_csv(p)
    assert r.columns[0].sql_type == "VARCHAR"
    assert steps(r, "kept_as_text", "v")[0].count == 1


def test_duplicate_headers_made_unique(tmp_path):
    p = tmp_path / "h.csv"
    p.write_text("Name,name,NAME\na,b,c\n")
    assert [c.name for c in clean_csv(p).columns] == ["name", "name_2", "name_3"]


def test_unparseable_raises(tmp_path):
    p = tmp_path / "bad.csv"
    p.write_text("a,b\n1,2\n3,4,5\n")
    with pytest.raises(CleaningError):
        clean_csv(p)


def test_table_loads_with_nulls_and_flags_outliers(tmp_path):
    p = tmp_path / "sales.csv"
    rows = "\n".join(f"{i},{10 + i % 5}" for i in range(1, 40))
    p.write_text(f"sale_id,amount\n{rows}\n40,99999\n41,\n")
    db = SessionDB("a" * 32)
    s = db.load_csv(p)
    amount = next(c for c in s.columns if c.name == "amount")
    assert amount.missing == 1  # NULL kept, not filled
    assert s.row_count == 41
    assert [o.examples for o in s.outliers] == [[99999.0]]
    assert db.con.execute("SELECT count(*) FROM sales WHERE amount = 99999").fetchall()[0][0] == 1  # not deleted


def test_reserved_and_duplicate_table_names(tmp_path):
    db = SessionDB("b" * 32)
    for name in ["order.csv", "Order.csv", "Orders 1.csv"]:
        (tmp_path / name).write_text("x\n1\n")
    names = [db.load_csv(tmp_path / n).table_name for n in ["order.csv", "Orders 1.csv"]]
    assert names == ["order_data", "orders_1"]


def test_relationships(tmp_path):
    (tmp_path / "customers.csv").write_text("customer_id,name\n1,a\n2,b\n3,c\n")
    (tmp_path / "orders.csv").write_text("order_id,customer_id,status\n10,1,x\n11,1,x\n12,2,x\n13,9,x\n")
    (tmp_path / "shipments.csv").write_text("shipment_id,order_id,status\n1,10,x\n2,11,x\n")
    db = SessionDB("c" * 32)
    for n in ["customers", "orders", "shipments"]:
        db.load_csv(tmp_path / f"{n}.csv")
    joins = {r.join: r for r in db.relationships}
    assert set(joins) == {"orders.customer_id = customers.customer_id", "shipments.order_id = orders.order_id"}
    r = joins["orders.customer_id = customers.customer_id"]
    assert r.cardinality == "many_to_one" and r.unmatched_values == 1 and r.confidence == "low"
    # "status" matches by name but neither side is a key, so it is not a join
    assert not any("status" in j for j in joins)


def test_short_rows_padded_and_recorded(tmp_path):
    p = tmp_path / "s.csv"
    p.write_text("a,b\n1,2\n3\n")
    r = clean_csv(p)
    assert r.df["b"].isna().sum() == 1
    assert steps(r, "pad_short_rows")[0].count == 1
