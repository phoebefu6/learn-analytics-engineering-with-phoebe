<!-- phoebe header -->

[![Open the live course](https://img.shields.io/badge/%E2%96%B6%20open%20the%20live%20course-1f6feb?style=for-the-badge)](https://phoebefu6.github.io/learn-analytics-engineering-with-phoebe/)
[![Star this repo](https://img.shields.io/github/stars/phoebefu6/learn-analytics-engineering-with-phoebe?style=for-the-badge&label=star%20this%20repo&color=444444)](https://github.com/phoebefu6/learn-analytics-engineering-with-phoebe/stargazers)
[![Free courses](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fphoebefu6.github.io%2Flearn-with-phoebe%2Fstats.json&query=%24.courses_live&label=free%20courses&style=for-the-badge&color=111111)](https://phoebefu6.github.io/learn-with-phoebe/)

### ▶︎ [Open the live course →](https://phoebefu6.github.io/learn-analytics-engineering-with-phoebe/)

Free, runs in your browser. No install, no login.

> 📚 Part of **[Learn with Phoebe](https://phoebefu6.github.io/learn-with-phoebe/)** - free, hands-on courses on AI, data, and the craft around them. **[Browse every course ↗](https://phoebefu6.github.io/learn-with-phoebe/)**

<!-- /phoebe header -->
# learn analytics engineering with phoebe

The same warehouse, as a dbt project. A two-track, 16-session course that takes a marketplace
warehouse built by hand and rebuilds it as a real dbt project - sources, staging, intermediate,
dimensions, facts, a type-2 snapshot, marts, 100 tests, contracts and CI - and gets the same
numbers to the cent.

**Live course:** https://phoebefu6.github.io/learn-analytics-engineering-with-phoebe/

- **Leader track** (6 x 45 min, no code): why the role exists, what models-as-code changes, tests
  as a trust budget, buy versus build, team shape, and documentation that stays true.
- **Builder track** (10 x 45 min, real DuckDB in your browser): the project config, sources and
  staging, `ref()` and the DAG, intermediate models, dimensions/facts/snapshots, the break-a-model
  lab, marts, contracts and deployment, and a capstone that adds a subject area end to end.

## The project runs

```
$ cd dbt_project && dbt build
Found 23 models, 100 data tests, 1 snapshot, 8 sources, 489 macros
Finished running 1 snapshot, 12 table models, 100 data tests, 8 view models in 1.22s
Completed successfully
Done. PASS=121 WARN=0 ERROR=0 SKIP=0 NO-OP=0 TOTAL=121
```

And it reconciles to the hand-built version exactly: settled net revenue **111,906.48**, 957
settled orders, AOV **116.93**, 1,434 fact rows, cart conversion 44.19%. Same numbers, different
method - which is the honest argument for the tooling, and the spine of the course.

Verified on **dbt-core 1.12.0** with **dbt-duckdb 1.10.1**.

## Two labs that run the real thing

- **The break-a-model lab** (b7) - six real breakages applied as real DML against a freshly built
  project, then the project's own 100 compiled tests run against the damage. Measured, in your
  browser: **0 of 6** caught with no tests, **4 of 6** with generic tests, **6 of 6** with the five
  singular assertions as well. The two that generic tests miss are the two where the shape stayed
  perfect and the meaning moved.
- **The lineage explorer** (b4) - the project's dependency graph read from `target/manifest.json`:
  32 nodes, 47 edges, nobody drew it. Click a node for its real impact set, plus the raw Jinja and
  the compiled SQL side by side.

Both run **real DuckDB** compiled to WebAssembly and execute the SQL **dbt itself compiled**.
dbt cannot run in a browser (no Python, so no Jinja rendering) - that limit is stated on every
page that matters, and session b4 shows the compile step explicitly to close the gap.

## Run it yourself

```bash
pip install dbt-core dbt-duckdb          # or use a virtualenv
python python/load_raw.py --rows         # land the 8 raw tables in DuckDB
cd dbt_project && dbt build              # 23 models, 100 tests
dbt docs generate                        # manifest + catalog
cd .. && python python/build_browser_assets.py   # regenerate the site's assets from those artifacts
```

`python/load_raw.py` stands in for the loader (Fivetran, Airbyte, a Python job) - dbt does not
extract data. `build_browser_assets.py` is what keeps the site honest: the models, tests and
lineage on every page are generated from the dbt artifacts, so a page cannot drift from the
project.

## Repository layout

```
dbt_project/
  dbt_project.yml            layering, materialization per layer, vars for the analysis windows
  profiles.yml               kept in-project so the course runs with one command
  models/staging/            8 models, one per source table: rename, recast, no joins
  models/intermediate/       3 ephemeral models, including the fan-out guard
  models/marts/              6 dimensions, 3 facts, 3 marts, plus schema.yml with tests
  snapshots/                 merchants_snapshot - type-2 history via strategy: check
  tests/                     5 singular tests: reconciliation, additivity, unknown members,
                             mart agreement, fan-out
  target/                    build output, not committed - regenerate with dbt build
  macros/                    surrogate_key + 2 custom generic tests
python/
  load_raw.py                CSV -> DuckDB raw schema
  build_browser_assets.py    dbt artifacts -> the site's browser assets
data/                        the 8 source CSVs (deterministic, seed 42)
courses/                     16 session pages
assets/                      style.css, app.js, mindmap.js, the DuckDB engine, the two labs
materials/official-course-map.md   source map, coverage, honest out-of-scope list
```

## Where this sits

```
learn-data-modeling  ->  learn-analytics-engineering  ->  learn-dataops
   design the model         operationalize it as code       schedule and monitor it
```

Take [learn-data-modeling-with-phoebe](https://phoebefu6.github.io/learn-data-modeling-with-phoebe/)
first if you can: this course rebuilds that course's warehouse, and the whole argument depends on
knowing what was built by hand. Scheduling belongs to
[learn-dataops-with-phoebe](https://phoebefu6.github.io/learn-dataops-with-phoebe/) - dbt does not
schedule itself.

## Sources

Built from the dbt documentation (models, materializations, sources, tests, snapshots, contracts,
exposures, docs, node selection), the community layering conventions, software-engineering
practice applied to SQL, and Kimball & Ross for the dimensional model being rebuilt. Full mapping
and the deliberate out-of-scope list in
[materials/official-course-map.md](materials/official-course-map.md).

by Phoebe Fu · part of [Learn with Phoebe](https://phoebefu6.github.io/learn-with-phoebe/)
