"""Emit the browser assets from the REAL dbt artifacts - manifest, catalog, compiled SQL.

Nothing on the course site is hand-transcribed. The lineage graph is the dependency graph dbt
worked out, the model SQL is what dbt compiled, and the tests the break-a-model lab runs are
the project's own 100 tests, compiled. Re-run this after any `dbt build`.

    assets/bazaar-raw.js    window.BAZAAR_RAW    raw schema, from data/*.csv
    assets/dbt-models.js    window.DBT_MODELS    every model: layer, materialization, compiled SQL
                            window.AE_SETUPS     {built: run the whole project in order}
    assets/dbt-tests.js     window.DBT_TESTS     every test, compiled, with what it guards
    assets/dbt-graph.js     window.DBT_GRAPH     nodes and edges straight from manifest.json

Usage:
    python python/load_raw.py
    cd dbt_project && dbt build && dbt docs generate && cd ..
    python python/build_browser_assets.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ASSETS = ROOT / "assets"
TARGET = ROOT / "dbt_project" / "target"
COMPILED = TARGET / "compiled" / "bazaar"

# DuckDB column types for the eight raw tables. The loader infers these from CSV; we state
# them explicitly here so the browser copy is identical every time.
RAW_SCHEMA = {
    "users": [("user_id", "INTEGER"), ("email", "VARCHAR"), ("signup_ts", "TIMESTAMP"),
              ("country", "VARCHAR"), ("city", "VARCHAR"), ("acquisition_channel", "VARCHAR"),
              ("is_guest", "INTEGER")],
    "merchants": [("merchant_id", "VARCHAR"), ("merchant_name", "VARCHAR"), ("category", "VARCHAR"),
                  ("country", "VARCHAR"), ("tier", "VARCHAR"), ("commission_pct", "DOUBLE"),
                  ("joined_date", "DATE")],
    "products": [("product_id", "INTEGER"), ("merchant_id", "VARCHAR"), ("sku", "VARCHAR"),
                 ("product_name", "VARCHAR"), ("category", "VARCHAR"), ("list_price", "DOUBLE"),
                 ("unit_cost", "DOUBLE"), ("launched_date", "DATE"), ("status", "VARCHAR")],
    "carts": [("cart_id", "INTEGER"), ("user_id", "INTEGER"), ("created_ts", "TIMESTAMP"),
              ("status", "VARCHAR")],
    "cart_items": [("cart_id", "INTEGER"), ("product_id", "INTEGER"), ("quantity", "INTEGER"),
                   ("added_ts", "TIMESTAMP")],
    "orders": [("order_id", "INTEGER"), ("user_id", "INTEGER"), ("cart_id", "INTEGER"),
               ("order_ts", "TIMESTAMP"), ("status", "VARCHAR"), ("ship_country", "VARCHAR"),
               ("currency", "VARCHAR")],
    "order_items": [("order_id", "INTEGER"), ("line_no", "INTEGER"), ("product_id", "INTEGER"),
                    ("merchant_id", "VARCHAR"), ("quantity", "INTEGER"), ("unit_price", "DOUBLE"),
                    ("discount_amt", "DOUBLE")],
    "transactions": [("txn_id", "INTEGER"), ("order_id", "INTEGER"), ("txn_ts", "TIMESTAMP"),
                     ("amount", "DOUBLE"), ("currency", "VARCHAR"), ("payment_method", "VARCHAR"),
                     ("status", "VARCHAR"), ("decline_reason", "VARCHAR"), ("psp_ref", "VARCHAR")],
}

LAYER_OF = {"staging": "staging", "intermediate": "intermediate", "marts": "marts"}


def js_literal(text: str) -> str:
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def unqualify(sql: str) -> str:
    """Drop the database prefix dbt writes into compiled SQL.

    dbt fully qualifies every reference as "bazaar"."schema"."table" because that is what a
    real warehouse connection needs. In the browser there is one database, so the prefix is
    removed and the schema-qualified name is left intact - the SQL is otherwise byte-identical
    to what dbt produced.
    """
    return sql.replace('"bazaar".', "")


def sql_value(raw: str, dtype: str) -> str:
    if raw == "":
        return "NULL"
    if dtype in ("INTEGER", "DOUBLE"):
        return raw
    return "'" + raw.replace("'", "''") + "'"


# ---------------------------------------------------------------- raw schema

def build_raw() -> None:
    parts = [
        "-- The raw schema: what the loader landed, before dbt touches anything.",
        "-- Schemas, then the eight tables. dbt's compiled SQL is schema-qualified",
        "-- (raw.orders, main_marts.fct_order_items), so it runs here as-is.",
        "DROP SCHEMA IF EXISTS raw CASCADE;",
        "DROP SCHEMA IF EXISTS main_staging CASCADE;",
        "DROP SCHEMA IF EXISTS main_marts CASCADE;",
        "CREATE SCHEMA raw;",
    ]
    for table, cols in RAW_SCHEMA.items():
        coldef = ", ".join(f"{name} {dtype}" for name, dtype in cols)
        parts.append(f"CREATE OR REPLACE TABLE raw.{table} ({coldef});")
        rows = list(csv.DictReader((DATA / f"{table}.csv").open()))
        values = []
        for row in rows:
            values.append("(" + ",".join(sql_value(row[name], dtype) for name, dtype in cols) + ")")
        # chunk the INSERTs so no single statement gets unreasonably long
        for i in range(0, len(values), 400):
            parts.append(f"INSERT INTO raw.{table} VALUES\n" + ",\n".join(values[i:i + 400]) + ";")
    body = js_literal("\n".join(parts))
    js = ("/* bazaar-raw.js - Bazaar's raw schema in your browser, generated by\n"
          "   python/build_browser_assets.py from data/*.csv. This is the source system dbt reads;\n"
          "   every model on this site is built from it by the project's own compiled SQL. */\n\n"
          "window.BAZAAR_RAW = `\n" + body + "`;\n")
    (ASSETS / "bazaar-raw.js").write_text(js)
    print(f"  assets/bazaar-raw.js     {len(js):>9,} bytes  ({len(RAW_SCHEMA)} tables)")


# ---------------------------------------------------------------- models

def build_models(manifest: dict) -> None:
    models = []
    for uid, node in manifest["nodes"].items():
        if node["resource_type"] != "model":
            continue
        path = COMPILED / node["path"]
        compiled = path.read_text() if path.exists() else node.get("compiled_code", "")
        folder = node["path"].split("/")[0]
        models.append({
            "name": node["name"],
            "layer": LAYER_OF.get(folder, folder),
            "materialized": node["config"]["materialized"],
            "schema": node["schema"],
            "description": (node.get("description") or "").strip(),
            "raw_sql": node.get("raw_code", ""),
            "compiled_sql": unqualify(compiled),
            "refs": sorted({dep.split(".")[-1]
                            for dep in node.get("depends_on", {}).get("nodes", [])
                            if dep.startswith("model.")}),
            "sources": sorted({".".join(s) for s in node.get("sources", [])}),
        })

    # DAG order: build a model in the same order dbt would, so every ref() resolves to
    # something that already exists. Depth is computed against a NAME INDEX rather than the
    # list itself: list.sort() hides the list from its own key function while sorting.
    by_name = {m["name"]: m for m in models}
    depth: dict[str, int] = {}

    def model_depth(name: str, seen: tuple = ()) -> int:
        if name in depth:
            return depth[name]
        node = by_name.get(name)
        if node is None or name in seen:
            return 0
        d = 1 + max([model_depth(r, seen + (name,)) for r in node["refs"]] or [0])
        depth[name] = d
        return d

    for m in models:
        model_depth(m["name"])
    models.sort(key=lambda m: (depth.get(m["name"], 0), m["name"]))

    # the build script: ephemeral models are inlined by dbt, so they are never created
    build = ["-- The project, built in dbt's own dependency order. Every statement below is the",
             "-- SQL dbt compiled - the ref() calls already resolved into real table names.",
             "CREATE SCHEMA IF NOT EXISTS main_staging;",
             "CREATE SCHEMA IF NOT EXISTS main_marts;"]
    for m in models:
        if m["materialized"] == "ephemeral":
            continue
        kind = "VIEW" if m["materialized"] == "view" else "TABLE"
        build.append(f"-- {m['layer']} · {m['materialized']}\n"
                     f"CREATE OR REPLACE {kind} {m['schema']}.{m['name']} AS\n"
                     f"{unqualify(m['compiled_sql'])};")

    js = ("/* dbt-models.js - every model in the project, straight from target/manifest.json and\n"
          "   target/compiled/. raw_sql is what you write (Jinja and all); compiled_sql is what dbt\n"
          "   handed the warehouse. AE_SETUPS.built runs the whole project in dbt's own order.\n"
          "   Generated by python/build_browser_assets.py - do not hand-edit. */\n\n"
          "window.DBT_MODELS = " + json.dumps(models, indent=1) + ";\n\n"
          "window.AE_SETUPS = { built: `\n" + js_literal("\n\n".join(build)) + "` };\n")
    (ASSETS / "dbt-models.js").write_text(js)
    eph = sum(1 for m in models if m["materialized"] == "ephemeral")
    print(f"  assets/dbt-models.js     {len(js):>9,} bytes  ({len(models)} models, {eph} ephemeral)")


# ---------------------------------------------------------------- tests

def build_tests(manifest: dict) -> None:
    tests = []
    for uid, node in manifest["nodes"].items():
        if node["resource_type"] != "test":
            continue
        path = COMPILED / node["path"]
        compiled = path.read_text() if path.exists() else node.get("compiled_code", "")
        if not compiled:
            continue
        meta = node.get("test_metadata") or {}
        guards = sorted({d.split(".")[-1] for d in node.get("depends_on", {}).get("nodes", [])})
        tests.append({
            "name": node["name"],
            "kind": "generic" if meta else "singular",
            "test_type": meta.get("name", "singular"),
            "column": (node.get("column_name") or ""),
            "guards": guards,
            "sql": unqualify(compiled).strip(),
        })
    tests.sort(key=lambda t: (t["kind"], t["name"]))
    js = ("/* dbt-tests.js - the project's own tests, compiled. A dbt test is just a query that\n"
          "   must return zero rows, which is why they can run anywhere the warehouse runs - including\n"
          "   this page. The break-a-model lab executes these, not a description of them.\n"
          "   Generated by python/build_browser_assets.py. */\n\n"
          "window.DBT_TESTS = " + json.dumps(tests, indent=1) + ";\n")
    (ASSETS / "dbt-tests.js").write_text(js)
    generic = sum(1 for t in tests if t["kind"] == "generic")
    print(f"  assets/dbt-tests.js      {len(js):>9,} bytes  ({len(tests)} tests: "
          f"{generic} generic, {len(tests) - generic} singular)")


# ---------------------------------------------------------------- graph

def build_graph(manifest: dict) -> None:
    nodes, edges = [], []
    keep = {}
    for uid, node in {**manifest["nodes"], **manifest["sources"]}.items():
        rt = node["resource_type"]
        if rt not in ("model", "source", "snapshot"):
            continue
        folder = node.get("path", "").split("/")[0]
        keep[uid] = node["name"]
        nodes.append({
            "id": node["name"],
            "type": rt,
            "layer": "source" if rt == "source" else ("snapshot" if rt == "snapshot"
                                                     else LAYER_OF.get(folder, folder)),
            "materialized": node.get("config", {}).get("materialized", "source"),
            "tests": 0,
        })
    test_counts = {}
    for uid, node in manifest["nodes"].items():
        if node["resource_type"] != "test":
            continue
        for dep in node.get("depends_on", {}).get("nodes", []):
            if dep in keep:
                test_counts[keep[dep]] = test_counts.get(keep[dep], 0) + 1
    for n in nodes:
        n["tests"] = test_counts.get(n["id"], 0)
    for uid, parents in manifest["parent_map"].items():
        if uid not in keep:
            continue
        for parent in parents:
            if parent in keep:
                edges.append({"from": keep[parent], "to": keep[uid]})
    js = ("/* dbt-graph.js - the lineage graph dbt worked out from ref() and source() calls, read\n"
          "   from target/manifest.json parent_map. Nobody drew this: it is derived, which is the\n"
          "   whole argument of session b4. Generated by python/build_browser_assets.py. */\n\n"
          "window.DBT_GRAPH = " + json.dumps({"nodes": nodes, "edges": edges}, indent=1) + ";\n")
    (ASSETS / "dbt-graph.js").write_text(js)
    print(f"  assets/dbt-graph.js      {len(js):>9,} bytes  ({len(nodes)} nodes, {len(edges)} edges)")


def main() -> None:
    manifest_path = TARGET / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("no target/manifest.json - run `dbt build && dbt docs generate` first")
    manifest = json.loads(manifest_path.read_text())
    print("Building browser assets from the real dbt artifacts")
    build_raw()
    build_models(manifest)
    build_tests(manifest)
    build_graph(manifest)
    print("Remember to bump ?v= on the pages that load them.")


if __name__ == "__main__":
    main()
