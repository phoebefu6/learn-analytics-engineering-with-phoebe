# Source map - learn-analytics-engineering-with-phoebe

What this course teaches, where each idea comes from, and what it deliberately does not cover.

## The 80% bar

Each session teaches roughly 80% of the working content of its mapped sources - the part you use
on a Tuesday. Certification material, warehouse-specific tuning, and the parts of dbt Cloud that
are a product tour rather than a technique stay with the originals, and every page says so.

## Position in the deng ladder

```
learn-data-modeling  ->  learn-analytics-engineering  ->  learn-dataops
   design the model         operationalize it as code       schedule and monitor it
```

This course rebuilds the warehouse from
[learn-data-modeling-with-phoebe](https://phoebefu6.github.io/learn-data-modeling-with-phoebe/)
as a dbt project. That is the spine: the learner already knows the model, so every session is
about the craft rather than the domain, and the before-and-after is measurable rather than
asserted. Overlap with the modeling course is intentional and bounded - it owns grain, keys,
additivity and conformance; this course owns layering, `ref()`, materializations, tests,
snapshots, contracts and deployment.

Scheduling is explicitly not here. dbt does not schedule itself, and orchestration is
[learn-dataops](https://phoebefu6.github.io/learn-dataops-with-phoebe/).

## Primary sources

| Source | What we take from it | Where |
|--------|---------------------|-------|
| dbt documentation - models, materializations | models as SELECTs, view/table/ephemeral/incremental, config in `dbt_project.yml` | b1, b2, b5 |
| dbt documentation - sources and freshness | `source()`, declaring raw tables once, source tests | b3 |
| dbt documentation - `ref`, compilation, manifest, node selection | the DAG as derived metadata, selector syntax, `state:modified+` | b4, b9 |
| dbt documentation - tests | generic tests, singular tests, custom generic tests, severity | b7, a3 |
| dbt documentation - snapshots | `strategy: check`, `check_cols`, type-2 history as a first-class object | b6 |
| dbt documentation - model contracts and constraints | enforced column types, contract as an interface | b9, a5 |
| dbt documentation - docs and exposures | generated docs, derived lineage, declaring consumers outside dbt | b9, a6 |
| Community layering conventions ("how we structure a dbt project") | staging / intermediate / marts, naming, one model per source table | b1, b3, b5, a2 |
| Kimball & Ross, *The Data Warehouse Toolkit* | the dimensional model being rebuilt - grain, conformed dimensions, SCD2 | b6, b8 (as recap only) |
| Software-engineering practice applied to SQL | version control, review, environments, CI, blast radius | a2, a5, b9 |

**Re-verify before delivery:** dbt moves faster than the books. Check the current docs for
materialization options, contract syntax and the test `arguments:` property before teaching from
specifics. This project was built and verified on **dbt-core 1.12.0 with dbt-duckdb 1.10.1**, and
one deprecation was fixed during the build (generic test arguments must now sit under
`arguments:`), which is a good example of exactly this risk.

## Session coverage

Legend: ✓ taught to the 80% bar · ◐ touched, pointer given · - out of scope by design

### Leader track (6 x 45 min)

| # | Session | Models as code | Tests | Buy/build | Team | Docs |
|---|---------|----------------|-------|-----------|------|------|
| a1 | Why analytics engineering exists | ◐ | ◐ | - | ◐ | - |
| a2 | Models as code | ✓ | ◐ | - | ◐ | ◐ |
| a3 | Tests as the trust budget | ◐ | ✓ | - | ◐ | - |
| a4 | Buy vs build the transformation layer | ◐ | - | ✓ | ◐ | ◐ |
| a5 | The team shape | ◐ | ◐ | ◐ | ✓ | ◐ |
| a6 | Documentation that stays true | ◐ | - | ◐ | ◐ | ✓ |

### Builder track (10 x 45 min)

| # | Session | Config | Sources/staging | DAG | Marts | Tests | Ships |
|---|---------|--------|-----------------|-----|-------|-------|-------|
| b1 | From hand-written SQL to a project | ◐ | ◐ | ◐ | ◐ | ◐ | a real build, read line by line |
| b2 | The project config | ✓ | - | - | ◐ | - | `dbt_project.yml`, `profiles.yml` |
| b3 | Sources and staging | ◐ | ✓ | ◐ | - | ◐ | 8 staging models + sources yml |
| b4 | `ref()` and the DAG | - | ◐ | ✓ | - | - | live lineage from `manifest.json` |
| b5 | Intermediate models | ◐ | - | ◐ | ◐ | - | 3 ephemeral models |
| b6 | Dimensions, facts, snapshots | ◐ | - | ◐ | ✓ | ◐ | 12 marts + `merchants_snapshot` |
| b7 | The break-a-model lab | - | - | ◐ | - | ✓ | the 100-test suite, measured |
| b8 | Marts and the business questions | ◐ | - | ◐ | ✓ | ◐ | 3 marts + the four answers |
| b9 | Contracts, docs and deployment | ✓ | - | ✓ | - | ◐ | contracts, docs, CI selector |
| b10 | Capstone: add a subject area | ✓ | ✓ | ✓ | ✓ | ✓ | returns and refunds, green build |

## Not covered, by design

- **Orchestration and scheduling.** dbt does not schedule itself. Airflow, Dagster, dbt Cloud
  jobs and cron all belong to [learn-dataops](https://phoebefu6.github.io/learn-dataops-with-phoebe/).
- **Extraction and loading.** `python/load_raw.py` stands in for Fivetran, Airbyte or a Python
  job in one page of prose. Pipelines are
  [learn-data-engineering](https://phoebefu6.github.io/learn-data-engineering-with-phoebe/).
- **The dimensional model itself.** Grain, keys, additivity and conformance are
  [learn-data-modeling](https://phoebefu6.github.io/learn-data-modeling-with-phoebe/). This course
  reuses that model and says so on every page that touches it.
- **Incremental models at scale.** Named in b2 and b6 with the trade-off stated; done properly it
  needs a dataset far larger than 985 orders, and the interesting parts are warehouse-specific.
- **dbt packages.** `dbt_utils` and `dbt_expectations` are named in b7. This project deliberately
  has zero package dependencies so that everything on the page can be read in full - including a
  hand-written `surrogate_key` macro that shows what `generate_surrogate_key` actually does.
- **dbt Cloud as a product.** a4 compares Core and Cloud as a decision. Screenshots of a UI that
  changes quarterly would be stale before delivery.
- **The semantic layer / MetricFlow.** Mentioned in a6 as the direction of travel. Metric
  definitions as a governed artifact are taught in learn-data-modeling session b9.
- **Warehouse-specific performance tuning.** Clustering, partitioning, sort keys. The project runs
  on DuckDB precisely so nothing here depends on one vendor's optimizer.

## The verified project

Everything quoted on the pages comes from a real run. To reproduce:

```bash
python python/load_raw.py
cd dbt_project && dbt build && dbt docs generate
```

- **`dbt build`: PASS=121, WARN=0, ERROR=0, SKIP=0** in 1.22s (4 threads, DuckDB)
- 23 models: 8 staging views, 3 ephemeral intermediate, 12 mart tables
- 100 data tests: 95 generic (including two custom generic tests), 5 singular
- 1 snapshot (`merchants_snapshot`, `strategy: check`), 8 sources
- lineage: 32 nodes, 47 edges in `manifest.json`
- reconciles to the hand-built warehouse exactly: settled net revenue **111,906.48**, 957 settled
  orders, AOV **116.93**, 1,434 fact rows, 1,060 transactions, 2,229 carts, cart conversion
  **44.19%**, M07 fortnight-over-fortnight **3,063 -> 455**, peak hour 21:00 with 96 attempts
- break-a-model lab, measured in the browser: **0 of 6** breakages caught with no tests, **4 of 6**
  with generic tests only, **6 of 6** with generic plus singular

## Honesty rails used on the pages

- dbt cannot run in a browser: no Python, so no Jinja is rendered live. The labs execute the SQL
  dbt **compiled** and the tests dbt **compiled**, on real DuckDB (~8 MB, loaded once from a CDN).
- Session b4 shows the compile step explicitly - raw Jinja beside compiled SQL for every model -
  so the one thing the browser cannot do is the one thing the page makes visible.
- The lineage graph is read from `target/manifest.json`. Nobody drew it, which is the point.
