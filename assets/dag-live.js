/* dag-live.js - the lineage explorer (builder session b4)

   The graph on this page is not a diagram anybody drew. It is read from
   target/manifest.json: dbt worked it out from the ref() and source() calls in the models,
   which is the whole argument of session b4 - you write dependencies once, in the SQL, and
   the DAG is derived.

   Click a node to see what it depends on, what depends on it, and what breaks if you change
   it. That impact set is computed by walking the real edges, so it is the same set dbt uses
   to decide what to rebuild.

   Markup:  <div id="dag-explorer"></div>
   Requires: dbt-graph.js (window.DBT_GRAPH), dbt-models.js (window.DBT_MODELS, optional -
   used to show the compiled SQL of the selected node)
*/

(function () {
  var host = document.getElementById("dag-explorer");
  if (!host || !window.DBT_GRAPH) return;

  var G = window.DBT_GRAPH;
  var MODELS = {};
  (window.DBT_MODELS || []).forEach(function (m) { MODELS[m.name] = m; });

  var LAYERS = [
    { id: "source", label: "sources", color: "#6B6B78" },
    { id: "staging", label: "staging", color: "#F1855F" },
    { id: "intermediate", label: "intermediate", color: "#D94E24" },
    { id: "marts", label: "marts", color: "#2B2B33" },
    { id: "snapshot", label: "snapshots", color: "#3F7F72" }
  ];

  var parents = {}, children = {};
  G.nodes.forEach(function (n) { parents[n.id] = []; children[n.id] = []; });
  G.edges.forEach(function (e) {
    if (children[e.from]) children[e.from].push(e.to);
    if (parents[e.to]) parents[e.to].push(e.from);
  });

  function walk(start, map) {
    var seen = {}, queue = (map[start] || []).slice();
    while (queue.length) {
      var id = queue.shift();
      if (seen[id]) continue;
      seen[id] = true;
      (map[id] || []).forEach(function (next) { if (!seen[next]) queue.push(next); });
    }
    return Object.keys(seen);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var wrap = el("div", "lab");
  var bar = el("div", "lab-bar");
  bar.appendChild(el("span", "lab-dot"));
  bar.appendChild(el("span", "lab-title",
    "Lineage explorer - " + G.nodes.length + " nodes, " + G.edges.length + " edges, read from manifest.json"));
  wrap.appendChild(bar);

  var columns = el("div", "dag-columns");
  var nodeEls = {};
  LAYERS.forEach(function (layer) {
    var nodes = G.nodes.filter(function (n) { return n.layer === layer.id; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (!nodes.length) return;
    var col = el("div", "dag-col");
    var head = el("span", "dag-col-head", layer.label + " · " + nodes.length);
    head.style.color = layer.color;
    col.appendChild(head);
    nodes.forEach(function (n) {
      var node = el("button", "dag-node");
      node.type = "button";
      node.style.borderLeftColor = layer.color;
      node.appendChild(el("span", "dag-node-name", n.id));
      var meta = n.materialized + (n.tests ? " · " + n.tests + " tests" : " · no tests");
      node.appendChild(el("span", "dag-node-meta", meta));
      node.addEventListener("click", function () { select(n.id); });
      nodeEls[n.id] = node;
      col.appendChild(node);
    });
    columns.appendChild(col);
  });
  wrap.appendChild(columns);

  var detail = el("div", "lab-output");
  wrap.appendChild(detail);

  wrap.appendChild(el("p", "lab-rail",
    "Every edge here came from a ref() or source() call in a model file. Nobody maintains this " +
    "graph, which is why it cannot drift out of date - the argument of this session in one " +
    "sentence. Node metadata (materialization, test count) is read from the same manifest."));

  host.appendChild(wrap);

  function select(id) {
    Object.keys(nodeEls).forEach(function (key) {
      nodeEls[key].classList.remove("selected", "upstream", "downstream");
    });
    var up = walk(id, parents), down = walk(id, children);
    nodeEls[id].classList.add("selected");
    up.forEach(function (k) { if (nodeEls[k]) nodeEls[k].classList.add("upstream"); });
    down.forEach(function (k) { if (nodeEls[k]) nodeEls[k].classList.add("downstream"); });

    var node = G.nodes.filter(function (n) { return n.id === id; })[0];
    var model = MODELS[id];
    detail.innerHTML = "";
    detail.appendChild(el("p", "lab-q", id));

    var facts = el("p", "lab-note",
      node.layer + " · " + node.materialized +
      " · " + (node.tests || 0) + " test" + (node.tests === 1 ? "" : "s") +
      " · depends on " + up.length + " upstream node" + (up.length === 1 ? "" : "s") +
      " · " + down.length + " node" + (down.length === 1 ? "" : "s") + " depend on it");
    detail.appendChild(facts);

    if (model && model.description) detail.appendChild(el("p", "lab-note", model.description));

    var impact = el("div", "lab-verdict " + (down.length ? "lose" : "win"));
    if (!down.length) {
      impact.textContent = "Nothing depends on this node, so changing it breaks nothing " +
        "downstream. It is a leaf - which for a mart is exactly right, and for a staging " +
        "model would mean nobody is using it.";
    } else {
      impact.textContent = "Change this and " + down.length + " node" +
        (down.length === 1 ? "" : "s") + " must be rebuilt and re-tested: " +
        down.slice(0, 8).join(", ") + (down.length > 8 ? ", and " + (down.length - 8) + " more" : "") +
        ". This is the set `dbt build --select " + id + "+` rebuilds, and the reason a rename " +
        "is a conversation rather than a commit.";
    }
    detail.appendChild(impact);

    if (model && model.raw_sql) {
      var rawBlock = el("div", "lab-block");
      rawBlock.appendChild(el("span", "lab-block-label", "What you write (Jinja and all)"));
      rawBlock.appendChild(el("pre", "lab-sql", model.raw_sql.trim()));
      detail.appendChild(rawBlock);
      var compiledBlock = el("div", "lab-block");
      compiledBlock.appendChild(el("span", "lab-block-label",
        "What dbt compiled - every ref() resolved into a real schema-qualified name"));
      compiledBlock.appendChild(el("pre", "lab-sql", model.compiled_sql.trim()));
      detail.appendChild(compiledBlock);
    }
  }

  // open on the fact everybody cares about, so the impact set is visible immediately
  select(MODELS.fct_order_items ? "fct_order_items" : G.nodes[0].id);
})();
