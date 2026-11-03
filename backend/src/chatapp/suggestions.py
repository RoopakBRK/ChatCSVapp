"""Starter questions built from the tables themselves (no AI call, so they are instant and free)."""
import re

from schemas.files import ColumnInfo, FileSummary, Relationship

MAX_STARTERS = 4
_ID_SUFFIXES = ("_id", "_key", "_code", "_number")
_PERSONAL = ("name", "email", "address", "phone")  # people, not categories worth comparing


def _words(name: str) -> str:
    # "t_2014_sales" was only prefixed so the table name doesn't start with a digit; read it as "2014 sales".
    return re.sub(r"^t_(?=\d)", "", name).replace("_", " ")


def _singular(table: str) -> str:
    if table.endswith("ies"):
        return table[:-3] + "y"
    return table[:-1] if table.endswith("s") else table


def _measures(f: FileSummary) -> list[ColumnInfo]:
    """Numeric columns worth summing or averaging (not ids, not constants)."""
    return [
        c for c in f.columns
        if (c.type in ("BIGINT", "DOUBLE") or c.type.startswith("DECIMAL"))
        and c.name != "id" and not c.name.endswith(_ID_SUFFIXES) and c.min != c.max
    ]


def _categories(f: FileSummary) -> list[ColumnInfo]:
    return [
        c for c in f.columns
        if c.type == "VARCHAR" and c.distinct_values and len(c.distinct_values) >= 2
        and not any(word in c.name for word in _PERSONAL)
    ]


def _dates(f: FileSummary) -> list[ColumnInfo]:
    return [c for c in f.columns if c.type in ("DATE", "TIMESTAMP") and c.min != c.max]


def starter_questions(files: list[FileSummary], relationships: list[Relationship]) -> list[str]:
    """Up to four varied questions that the uploaded tables can actually answer."""
    by_name = {f.table_name: f for f in files}
    candidates: list[list[str]] = []  # one list per kind of question, best first

    # 1. Who has the most of something: from a link between two tables.
    links = []
    for r in relationships:
        child, parent = by_name.get(r.from_table), by_name.get(r.to_table)
        if r.cardinality == "many_to_one" and r.confidence != "low" and child and parent:
            # Prefer a link into the table that owns the key (orders.order_id), not one that merely shares it.
            owns_key = r.to_column in ("id", f"{_singular(r.to_table)}_id")
            links.append((owns_key, child.row_count, f"Which {_words(r.to_table)} have the most {_words(r.from_table)}?"))
    candidates.append([q for *_, q in sorted(links, reverse=True)])

    # 2. A trend over time.
    trends = []
    for f in files:
        dates, measures = _dates(f), _measures(f)
        if dates and measures:
            trends.append((f.row_count, f"How does {_words(measures[0].name)} change by month in {_words(f.table_name)}?"))
    candidates.append([q for _, q in sorted(trends, reverse=True)])

    # 3. A comparison across categories.
    compares = []
    for f in files:
        cats, measures = _categories(f), _measures(f)
        if cats and measures:
            compares.append((f.row_count, f"Compare {_words(measures[0].name)} across each {_words(cats[0].name)} in {_words(f.table_name)}."))
        elif cats:
            compares.append((f.row_count, f"How many {_words(f.table_name)} are there for each {_words(cats[0].name)}?"))
    candidates.append([q for _, q in sorted(compares, reverse=True)])

    # 4. Data quality: missing values, then unusual values.
    quality = []
    if any(f.missing_total for f in files):
        quality.append("Which columns have missing values?")
    for f in files:
        if f.outliers:
            quality.append(f"Which {_words(f.table_name)} have unusually high or low {_words(f.outliers[0].column)}?")
    candidates.append(quality)

    # 5. A plain overview.
    candidates.append(
        ["How many rows does each table have?"] if len(files) > 1
        else [f"Give me an overview of {_words(files[0].table_name)}."] if files else []
    )

    # 6. Fill-ups built straight from the columns, so there are always enough to choose from.
    fill = []
    for f in sorted(files, key=lambda f: -f.row_count):
        measures, cats = _measures(f), _categories(f)
        if measures:
            fill.append(f"Show the top 5 {_words(f.table_name)} by {_words(measures[0].name)}.")
            fill.append(f"What is the average {_words(measures[0].name)} in {_words(f.table_name)}?")
            if len(measures) > 1:
                fill.append(f"What is the total {_words(measures[1].name)} in {_words(f.table_name)}?")
        if cats and measures:
            fill.append(f"What is the average {_words(measures[0].name)} per {_words(cats[0].name)}?")
    candidates.append(fill)

    # Take one from each kind first, then fill up with second choices.
    picked: list[str] = []
    for depth in range(6):
        for group in candidates:
            if depth < len(group) and group[depth] not in picked and len(picked) < MAX_STARTERS:
                picked.append(group[depth])
    return picked
