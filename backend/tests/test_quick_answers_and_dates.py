"""Answers written in code for short results, and columns with mixed date formats."""
import datetime as dt
from decimal import Decimal

import pandas as pd
import pytest

from chatapp.cleaning import _detect_type, clean_csv
from chatapp.explain import quick_explanation, value_text

SQL = "SELECT ..."


@pytest.mark.parametrize("columns,rows,expected", [
    (["n"], [], "No rows matched that question."),
    (["total_revenue"], [[Decimal("3737818.3200")]], "Total revenue: **3,737,818.32**"),
    (["order_count"], [[1204]], "Order count: **1,204**"),
    (["first_order"], [[dt.date(2024, 1, 5)]], "First order: **2024-01-05**"),
    (["avg_price"], [[None]], "Avg price: **missing**"),
    (["orders", "revenue"], [[12, 510.987]], "- Orders: **12**\n- Revenue: **510.99**"),
    (["region", "revenue"], [["North", 1200], ["South", 900.5]], "Revenue by region:\n- North: **1,200**\n- South: **900.50**"),
    (["city"], [["Pune"], ["Delhi"]], "City:\n- Pune\n- Delhi"),
])
def test_short_results_are_written_in_code(columns, rows, expected):
    assert quick_explanation(SQL, columns, rows, False) == expected


@pytest.mark.parametrize("columns,rows,truncated", [
    (["region", "revenue"], [[f"r{i}", i] for i in range(6)], False),  # too many rows
    (["a", "b", "c", "d", "e"], [[1, 2, 3, 4, 5]], False),  # too many values in one row
    (["region", "name"], [["N", "x"], ["S", "y"]], False),  # two text columns: needs words
    (["n"], [[1]], True),  # only part of the result
])
def test_longer_results_still_go_to_the_ai(columns, rows, truncated):
    assert quick_explanation(SQL, columns, rows, truncated) is None


def test_column_lists_group_by_table_and_show_every_row():
    rows = [["orders", f"c{i}", f"C {i}", "text"] for i in range(40)] + [["items", "sku", "sku", "text"]]
    text = quick_explanation("SELECT * FROM _columns", ["table_name", "column_name", "original_header", "type"], rows, False)
    assert text.count("\n- ") == 41 and "**orders** (40 columns):" in text and "**items** (1 column):" in text
    assert '- c39 (original header: "C 39") - text' in text and "- sku - text" in text  # same header: not repeated


def test_value_text_rounds_and_separates():
    assert value_text(1234567.891) == "1,234,567.89" and value_text(True) == "true" and value_text(2.0) == "2"


# ---- mixed date formats ----

def detect(values):
    steps = []
    result = _detect_type("d", pd.Series(values), steps)
    rewritten = result[2] if len(result) > 2 else None
    return result[0], None if rewritten is None else list(rewritten), [s.detail for s in steps], steps


def test_mixed_formats_with_a_clear_order_become_dates():
    kind, values, notes, _ = detect(["2024-01-05", "05/04/2024", "25/04/2024", "2024/03/02"])
    assert kind == "DATE" and values == ["2024-01-05", "2024-04-05", "2024-04-25", "2024-03-02"]
    assert "mixed date formats" in notes[0] and "25/04/2024 only work day first" in notes[0]


def test_month_first_evidence_is_used_too():
    kind, values, _, _ = detect(["2024-01-05", "05/04/2024", "04/25/2024"])
    assert kind == "DATE" and values == ["2024-01-05", "2024-05-04", "2024-04-25"]


def test_unclear_values_keep_the_column_as_text_with_a_reason():
    kind, values, notes, steps = detect(["05/04/2024", "2024/01/05", "07/07/2024"])
    assert kind == "VARCHAR"
    assert values == ["05/04/2024", "2024-01-05", "2024-07-07"]  # the clear ones are written the same way
    assert "1 value like 05/04/2024 could be day/month or month/day" in notes[0]
    assert "clear dates were written as YYYY-MM-DD" in notes[0] and steps[0].action == "kept_as_text"


def test_impossible_dates_and_stray_text_get_a_note():
    _, _, notes, _ = detect(["2024-01-05", "2024-02-30"])
    assert "1 is not a real date (e.g. '2024-02-30')" in notes[0]
    _, _, notes, _ = detect(["2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08", "TBD"])
    assert "80% of values look like dates but 1 does not (e.g. 'TBD')" in notes[0]


def test_plain_text_and_uniform_dates_are_unchanged():
    assert detect(["apple", "pear"])[0] == "VARCHAR" and detect(["apple", "pear"])[2] == []
    assert detect(["2024-01-05", "2024-02-06"])[:2] == ("DATE", None)


def test_rewritten_dates_reach_the_table(tmp_path):
    path = tmp_path / "d.csv"
    path.write_text("day,n\n2024-01-05,1\n25/04/2024,2\n05/04/2024,3\n")
    result = clean_csv(path)
    assert result.columns[0].sql_type == "DATE"
    assert list(result.df["day"]) == ["2024-01-05", "2024-04-25", "2024-04-05"]
