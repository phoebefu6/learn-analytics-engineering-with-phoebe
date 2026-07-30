"""Load Bazaar's CSV exports into DuckDB as a raw schema - the source system dbt reads.

dbt does not extract data; it transforms what is already in the warehouse. So this script
plays the part of the loader (Fivetran, Airbyte, a Python job - whatever your stack uses) and
lands the eight source tables in a `raw` schema. Everything after this is dbt's job.

Usage:
    python python/load_raw.py            # builds bazaar.duckdb with a raw schema
    python python/load_raw.py --rows     # print row counts
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DB = ROOT / "bazaar.duckdb"

TABLES = ["users", "merchants", "products", "carts", "cart_items",
          "orders", "order_items", "transactions"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", action="store_true")
    args = ap.parse_args()

    con = duckdb.connect(str(DB))
    con.execute("CREATE SCHEMA IF NOT EXISTS raw")
    for table in TABLES:
        csv = DATA / f"{table}.csv"
        if not csv.exists():
            raise SystemExit(f"missing {csv}")
        con.execute(f"CREATE OR REPLACE TABLE raw.{table} AS SELECT * FROM read_csv_auto('{csv}')")
        if args.rows:
            n = con.execute(f"SELECT COUNT(*) FROM raw.{table}").fetchone()[0]
            print(f"  raw.{table:<14} {n:>6,} rows")
    con.close()
    print(f"Loaded {len(TABLES)} source tables into {DB.name} (schema: raw)")
    print("Next: cd dbt_project && dbt build")


if __name__ == "__main__":
    main()
