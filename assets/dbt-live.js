/* dbt-live.js - the break-a-model lab (builder session b7)

   Six real breakages, the project's real tests, one real DuckDB. The loop is exactly the loop
   dbt runs in CI:

     1. build the project from Bazaar's raw schema, using the SQL dbt compiled
     2. apply a breakage - an actual INSERT, UPDATE, DELETE or a rewritten mart
     3. run the test suite you have switched on (window.DBT_TESTS, compiled by dbt)
     4. report which tests returned rows, because a dbt test fails when it returns any

   Nothing is scripted. If a breakage slips past a test, this page says so - which is the
   point of the middle lever, where four of six get caught and two ship silently.

   Markup:  <div id="dbt-lab"></div>
   Requires: dbt-graph.js, bazaar-raw.js, dbt-models.js, dbt-tests.js

   Honesty rail: dbt itself cannot run in a browser - there is no Python here, so no Jinja is
   rendered live. The SQL is dbt's own compiled output, the tests are its own compiled tests,
   and DuckDB is a real analytical engine. What you lose is the compile step, which session b4
   shows you separately.
*/

(function () {
  var host = document.getElementById("dbt-lab");
  if (!host) return;

  var CDN = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0";
  var EngineReady = null;
  var Queue = Promise.resolve();

  function enqueue(job) {
    var next = Queue.then(job, job);
    Queue = next.then(function () {}, function () {});
    return next;
  }

  function loadEngine(onStatus) {
    if (EngineReady) return EngineReady;
    if (onStatus) onStatus("Loading DuckDB engine (~8 MB, one time)...");
    EngineReady = import(CDN + "/+esm").then(function (duckdb) {
      var bundles = {
        mvp: { mainModule: CDN + "/dist/duckdb-mvp.wasm",
               mainWorker: CDN + "/dist/duckdb-browser-mvp.worker.js" },
        eh:  { mainModule: CDN + "/dist/duckdb-eh.wasm",
               mainWorker: CDN + "/dist/duckdb-browser-eh.worker.js" }
      };
      return duckdb.selectBundle(bundles).then(function (bundle) {
        var url = URL.createObjectURL(new Blob(
          ['importScripts("' + bundle.mainWorker + '");'], { type: "text/javascript" }));
        var db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(url));
        return db.instantiate(bundle.mainModule, bundle.pthreadWorker)
          .then(function () { return db.connect(); })
          .then(function (conn) { return { db: db, conn: conn }; });
      });
    });
    EngineReady.catch(function () { EngineReady = null; });
    return EngineReady;
  }

  /* Split a script on ';' and drop leading comment lines from each statement. dbt's compiled
     models open with the comments you wrote in the model file, so a naive "starts with --"
     filter would throw the whole statement away. */
  function splitSql(script) {
    return script.split(";").map(function (stmt) {
      var lines = stmt.split("\n");
      while (lines.length && (lines[0].trim() === "" || lines[0].trim().indexOf("--") === 0)) {
        lines.shift();
      }
      return lines.join("\n").trim();
    }).filter(function (s) { return s.length > 0; });
  }

  function runScript(conn, script) {
    var statements = splitSql(script);
    return statements.reduce(function (chain, stmt) {
      return chain.then(function () { return conn.query(stmt); });
    }, Promise.resolve());
  }

  /* ---------------------------------------------------------------- the breakages

     Each one is something that genuinely happens: a retried load, a nullable column
     somebody widened, a key that stopped resolving, a value nobody added to the enum, a
     definition changed without renaming the metric, and a source backfill.
     `sql` runs AFTER the project is built, so the tests see the same state CI would.        */

  var BREAKAGES = [
    {
      id: "dup_line",
      label: "A retried load writes a line twice",
      story: "The loader re-ran after a timeout and one order line landed twice. Nothing errors: " +
             "revenue is simply higher than it should be, on one order, forever.",
      caughtBy: "generic",
      sql: "INSERT INTO main_marts.fct_order_items " +
           "SELECT * FROM main_marts.fct_order_items LIMIT 1;",
      probe: "SELECT round(sum(net_amount), 2) AS revenue_now FROM main_marts.fct_order_items"
    },
    {
      id: "null_measure",
      label: "A measure goes NULL",
      story: "An upstream column was widened to allow NULLs. Twelve fact rows now carry no " +
             "revenue, so every SUM quietly under-reports and no error is raised.",
      caughtBy: "generic",
      sql: "UPDATE main_marts.fct_order_items SET net_amount = NULL " +
           "WHERE order_id IN (SELECT order_id FROM main_marts.fct_order_items LIMIT 12);",
      probe: "SELECT count(*) AS rows_with_no_revenue FROM main_marts.fct_order_items WHERE net_amount IS NULL"
    },
    {
      id: "orphan_key",
      label: "A dimension key stops resolving",
      story: "A merchant surrogate key no longer matches any dimension row. Inner-join reports " +
             "silently drop those sales; left-join reports show them with a blank merchant.",
      caughtBy: "generic",
      sql: "UPDATE main_marts.fct_order_items SET merchant_sk = 'no-such-merchant-key' " +
           "WHERE order_id IN (SELECT order_id FROM main_marts.fct_order_items LIMIT 20);",
      probe: "SELECT count(*) AS orphan_fact_rows FROM main_marts.fct_order_items f " +
             "LEFT JOIN main_marts.dim_merchants m ON m.merchant_sk = f.merchant_sk " +
             "WHERE m.merchant_sk IS NULL"
    },
    {
      id: "bad_enum",
      label: "A new category value nobody declared",
      story: "Someone added a price band called 'cheap'. Every dashboard filtering on " +
             "budget / mid / premium now silently excludes those products.",
      caughtBy: "generic",
      sql: "UPDATE main_marts.dim_products SET price_tier = 'cheap' WHERE price_tier = 'budget';",
      probe: "SELECT price_tier, count(*) AS products FROM main_marts.dim_products GROUP BY 1 ORDER BY 1"
    },
    {
      id: "silent_metric",
      label: "A metric definition changes silently",
      story: "The mart's WHERE clause loses its settled-money filter. The column is still called " +
             "net_revenue, the dashboard still says revenue, and the number is now 3.5% higher. " +
             "No generic test can see this - the shape is perfect, the meaning moved.",
      caughtBy: "singular",
      sql: "CREATE OR REPLACE TABLE main_marts.mart_merchant_daily AS " +
           "SELECT d.date_day AS activity_date, m.merchant_id, m.merchant_name, " +
           "m.merchant_category, m.merchant_tier, count(DISTINCT f.order_id) AS orders, " +
           "sum(f.units) AS units, round(sum(f.gross_amount), 2) AS gross_revenue, " +
           "round(sum(f.discount_amount), 2) AS discounts, round(sum(f.net_amount), 2) AS net_revenue, " +
           "round(sum(f.commission_amount), 2) AS commission, round(sum(f.margin_amount), 2) AS margin, " +
           "round(sum(f.net_amount), 2) AS aov_numerator, count(DISTINCT f.order_id) AS aov_denominator " +
           "FROM main_marts.fct_order_items f " +
           "JOIN main_marts.dim_dates d ON d.date_key = f.date_key " +
           "JOIN main_marts.dim_merchants m ON m.merchant_sk = f.merchant_sk " +
           "GROUP BY 1, 2, 3, 4, 5;",
      probe: "SELECT round(sum(net_revenue), 2) AS mart_revenue, " +
             "(SELECT round(sum(net_amount), 2) FROM main_marts.fct_order_items WHERE is_settled) AS fact_revenue " +
             "FROM main_marts.mart_merchant_daily"
    },
    {
      id: "source_drift",
      label: "Someone edits the source after the build",
      story: "A backfill deleted 30 source lines after the warehouse was built. The warehouse " +
             "and the system of record no longer agree, and only a reconciliation test notices.",
      caughtBy: "singular",
      sql: "DELETE FROM raw.order_items WHERE order_id IN " +
           "(SELECT DISTINCT order_id FROM raw.order_items LIMIT 30);",
      probe: "SELECT (SELECT round(sum(net_amount), 2) FROM main_marts.fct_order_items) AS warehouse, " +
             "(SELECT round(sum(quantity * unit_price - discount_amt), 2) FROM raw.order_items) AS source"
    }
  ];

  var SUITES = [
    { id: "none", label: "No tests",
      hint: "the project builds, nothing is checked", filter: function () { return false; } },
    { id: "generic", label: "Generic tests only",
      hint: "unique, not_null, relationships, accepted_values - the 95 one-liners in schema.yml",
      filter: function (t) { return t.kind === "generic"; } },
    { id: "all", label: "Generic + singular tests",
      hint: "plus the 5 hand-written assertions: reconciliation, additivity, unknown members, mart agreement",
      filter: function () { return true; } }
  ];

  var state = { suite: "generic", breakage: BREAKAGES[0].id, engineLoaded: false };

  /* ---------------------------------------------------------------- run one scenario */

  function runScenario(breakage, suiteFilter, onStatus) {
    return enqueue(function () {
      return loadEngine(onStatus).then(function (engine) {
        var conn = engine.conn;
        var tests = (window.DBT_TESTS || []).filter(suiteFilter);
        var result = { tests: tests.length, failed: [], probe: null, probeCols: [] };

        onStatus("Building the project from raw (23 models, dbt's compiled SQL)...");
        // bazaar-raw.js drops and recreates every schema, so each run starts clean
        return runScript(conn, window.BAZAAR_RAW || "")
          .then(function () { return runScript(conn, (window.AE_SETUPS || {}).built || ""); })
          .then(function () {
            onStatus("Applying the breakage...");
            return runScript(conn, breakage.sql);
          })
          .then(function () {
            if (!tests.length) return null;
            onStatus("Running " + tests.length + " compiled dbt tests...");
            return tests.reduce(function (chain, test) {
              return chain.then(function () {
                return conn.query(test.sql).then(function (table) {
                  if (table.numRows > 0) {
                    result.failed.push({ name: test.name, kind: test.kind,
                                         type: test.test_type, rows: table.numRows });
                  }
                }, function (err) {
                  // a test that errors is also a failure - and in CI it stops the build
                  result.failed.push({ name: test.name, kind: test.kind,
                                       type: test.test_type, rows: 0,
                                       error: String(err.message || err).slice(0, 90) });
                });
              });
            }, Promise.resolve());
          })
          .then(function () {
            onStatus("Measuring what the breakage did to the numbers...");
            return conn.query(breakage.probe).then(function (table) {
              result.probeCols = table.schema.fields.map(function (f) { return f.name; });
              result.probe = table.toArray().map(function (r) {
                var out = {};
                result.probeCols.forEach(function (c) {
                  var v = r[c];
                  out[c] = v === null || v === undefined ? "NULL"
                    : typeof v === "bigint" ? v.toString()
                    : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
                });
                return out;
              });
              return result;
            });
          });
      });
    });
  }

  /* ---------------------------------------------------------------- UI */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var wrap = el("div", "lab");

  var bar = el("div", "lab-bar");
  bar.appendChild(el("span", "lab-dot"));
  bar.appendChild(el("span", "lab-title", "Break-a-model lab - real DuckDB, the project's own tests"));
  bar.appendChild(el("span", "lab-spacer"));
  var allBtn = el("button", "lab-btn primary", "Score all 6 breakages");
  allBtn.type = "button";
  bar.appendChild(allBtn);
  wrap.appendChild(bar);

  // suite lever
  var suiteBox = el("div", "lab-levers");
  var suiteInputs = {};
  SUITES.forEach(function (suite) {
    var label = el("label", "lab-lever");
    var input = document.createElement("input");
    input.type = "radio"; input.name = "dbt-suite"; input.value = suite.id;
    input.checked = suite.id === state.suite;
    suiteInputs[suite.id] = input;
    label.appendChild(input);
    var body = el("span", "lab-lever-body");
    body.appendChild(el("b", null, suite.label));
    body.appendChild(el("span", null, suite.hint));
    label.appendChild(body);
    input.addEventListener("change", function () { state.suite = suite.id; runOne(); });
    suiteBox.appendChild(label);
  });
  wrap.appendChild(suiteBox);

  // breakage picker
  var picker = el("div", "lab-questions");
  picker.appendChild(el("span", "lab-select-label", "Breakage"));
  var select = document.createElement("select");
  select.className = "lab-select";
  BREAKAGES.forEach(function (b) {
    var option = document.createElement("option");
    option.value = b.id; option.textContent = b.label;
    select.appendChild(option);
  });
  picker.appendChild(select);
  var runBtn = el("button", "lab-btn primary", "Break it and run the tests");
  runBtn.type = "button";
  picker.appendChild(runBtn);
  wrap.appendChild(picker);

  var status = el("p", "lab-note", "");
  var output = el("div", "lab-output");
  output.appendChild(status);
  wrap.appendChild(output);

  var scorecard = el("div", "lab-scorecard");
  wrap.appendChild(scorecard);

  wrap.appendChild(el("p", "lab-rail",
    "dbt itself cannot run in a browser - there is no Python here, so nothing renders Jinja " +
    "live. Everything else is real: the models are dbt's own compiled SQL, the tests are the " +
    "project's own 100 compiled tests, the breakages are real DML, and DuckDB is a real " +
    "analytical engine (about 8 MB, loaded once from a CDN and then cached)."));

  host.appendChild(wrap);

  function setStatus(text) { status.textContent = text; }

  function suiteFilter() {
    return SUITES.filter(function (s) { return s.id === state.suite; })[0].filter;
  }

  function renderProbe(result) {
    if (!result.probe || !result.probe.length) return "";
    var html = '<div class="sql-tablewrap"><table class="clean sql-table"><thead><tr>';
    result.probeCols.forEach(function (c) { html += "<th>" + c + "</th>"; });
    html += "</tr></thead><tbody>";
    result.probe.slice(0, 6).forEach(function (row) {
      html += "<tr>";
      result.probeCols.forEach(function (c) { html += "<td>" + row[c] + "</td>"; });
      html += "</tr>";
    });
    return html + "</tbody></table></div>";
  }

  function runOne() {
    var breakage = BREAKAGES.filter(function (b) { return b.id === select.value; })[0];
    output.innerHTML = "";
    output.appendChild(status);
    setStatus("Starting...");
    runScenario(breakage, suiteFilter(), setStatus).then(function (result) {
      output.innerHTML = "";
      output.appendChild(el("p", "lab-q", breakage.label));
      output.appendChild(el("p", "lab-note", breakage.story));

      var sqlBlock = el("div", "lab-block");
      sqlBlock.appendChild(el("span", "lab-block-label", "The breakage, as real SQL"));
      sqlBlock.appendChild(el("pre", "lab-sql", breakage.sql));
      output.appendChild(sqlBlock);

      var probeBlock = el("div", "lab-block");
      probeBlock.appendChild(el("span", "lab-block-label", "What it did to the numbers"));
      var probeHost = el("div");
      probeHost.innerHTML = renderProbe(result);
      probeBlock.appendChild(probeHost);
      output.appendChild(probeBlock);

      var caught = result.failed.length > 0;
      var verdict = el("div", "lab-verdict " + (caught ? "win" : "lose"));
      if (!result.tests) {
        verdict.textContent = "No tests are switched on, so nothing was checked. The build " +
          "succeeded, the numbers are wrong, and the first person to notice will be someone " +
          "in a meeting - which is the state most hand-written SQL estates are in.";
      } else if (caught) {
        verdict.textContent = "Caught. " + result.failed.length + " of " + result.tests +
          " tests failed, so dbt build exits non-zero and this never reaches production.";
      } else {
        verdict.textContent = "NOT caught. All " + result.tests + " tests passed and the " +
          "numbers are still wrong. This is what a missing test costs: a green build and a " +
          "quiet error. Switch on the singular tests and run it again.";
      }
      output.appendChild(verdict);

      if (result.failed.length) {
        var failBlock = el("div", "lab-block");
        failBlock.appendChild(el("span", "lab-block-label",
          "Tests that failed (a dbt test fails when its query returns rows)"));
        var list = el("div", "lab-score-list");
        result.failed.slice(0, 12).forEach(function (f) {
          var row = el("div", "lab-score-row bad");
          row.appendChild(el("span", "lab-score-id", f.kind === "generic" ? "generic" : "singular"));
          row.appendChild(el("span", "lab-score-q", f.name));
          row.appendChild(el("span", "lab-score-note",
            f.error ? "errored: " + f.error : f.rows + " offending row" + (f.rows === 1 ? "" : "s")));
          list.appendChild(row);
        });
        failBlock.appendChild(list);
        if (result.failed.length > 12) {
          failBlock.appendChild(el("p", "lab-note", result.failed.length - 12 + " more not shown."));
        }
        output.appendChild(failBlock);
      }
    }, function (err) {
      output.innerHTML = '<p class="lab-err">Engine failed: ' + (err.message || err) + "</p>";
    });
  }

  function scoreAll() {
    scorecard.innerHTML = '<p class="lab-note">Running 3 test suites x 6 breakages against a ' +
      'freshly built project each time. This takes a moment - it is 18 real builds.</p>';
    var results = {};
    var jobs = [];
    SUITES.forEach(function (suite) {
      BREAKAGES.forEach(function (breakage) {
        jobs.push({ suite: suite, breakage: breakage });
      });
    });
    jobs.reduce(function (chain, job) {
      return chain.then(function () {
        return runScenario(job.breakage, job.suite.filter, function (msg) {
          scorecard.innerHTML = '<p class="lab-note">' + job.suite.label + " · " +
            job.breakage.label + " - " + msg + "</p>";
        }).then(function (result) {
          results[job.suite.id] = results[job.suite.id] || {};
          results[job.suite.id][job.breakage.id] = result.failed.length > 0;
        });
      });
    }, Promise.resolve()).then(function () {
      scorecard.innerHTML = "";
      var head = el("div", "lab-score-head");
      SUITES.forEach(function (suite) {
        var caught = BREAKAGES.filter(function (b) { return results[suite.id][b.id]; }).length;
        var pct = Math.round(100 * caught / BREAKAGES.length);
        var card = el("div", "lab-scorebox " + (pct === 100 ? "ok" : "bad"));
        card.appendChild(el("span", "lab-scorebox-label", suite.label));
        card.appendChild(el("span", "lab-scorebox-value", caught + "/" + BREAKAGES.length));
        card.appendChild(el("span", "lab-scorebox-note", pct + "% of breakages caught before production"));
        head.appendChild(card);
      });
      scorecard.appendChild(head);

      var list = el("div", "lab-score-list");
      BREAKAGES.forEach(function (b) {
        var row = el("div", "lab-score-row " + (results.all[b.id] ? "ok" : "bad"));
        row.appendChild(el("span", "lab-score-id", b.caughtBy));
        row.appendChild(el("span", "lab-score-q", b.label));
        row.appendChild(el("span", "lab-score-note",
          (results.generic[b.id] ? "caught by a generic test"
            : results.all[b.id] ? "needs a singular test - generic tests miss it entirely"
            : "not caught by any test in this project")));
        list.appendChild(row);
      });
      scorecard.appendChild(list);
      scorecard.appendChild(el("p", "lab-note",
        "Read the middle column: generic tests are one line each in schema.yml and they catch " +
        "the shape errors. The two breakages they miss are the ones where the shape is perfect " +
        "and the MEANING moved - a definition changed without a rename, and a source edited " +
        "after the build. Those need an assertion somebody thought about, which is why the five " +
        "singular tests in tests/ exist."));
    });
  }

  select.addEventListener("change", runOne);
  runBtn.addEventListener("click", runOne);
  allBtn.addEventListener("click", scoreAll);

  setStatus("Pick a breakage and press Run. First run downloads DuckDB (~8 MB, once).");
})();
