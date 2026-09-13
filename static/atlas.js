/* atlas.js — size-gated Knowledge Atlas embedding.
 *
 * When enabled, replaces the D3 force graph in #graph with the
 * Knowledge Atlas engine (vendored at static/vendor/knowledge-atlas.js,
 * built from packages/knowledge-atlas in the repo). Everything else —
 * sidebar, modal, subgraph navigator, editing — keeps working: the
 * atlas routes item-open through the same `#page=<id>` hash contract.
 *
 * Wikis above 360 pages get a Classic / Atlas chooser in the graph
 * controls. Classic remains the default until the user opts in. The
 * preference is stored in localStorage, but is ignored for small wikis.
 *
 * Explicit per-load override (also useful for development and tests):
 *   http://localhost:8090/?viewer=atlas
 *   http://localhost:8090/?viewer=classic
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'curiosity-engine.viewer';
  var MIN_ATLAS_PAGES = 360;
  var LABEL_TYPES_KEY = 'curiosity-engine.label-types';
  var LABEL_DEFAULTS = ['concept', 'entity', 'note', 'todo'];
  var PHYSICS_DEFAULTS = { charge: -1000, link: 220, collide: 28 };

  function readLabelTypes() {
    try {
      var saved = JSON.parse(localStorage.getItem(LABEL_TYPES_KEY) || 'null');
      if (Array.isArray(saved)) return new Set(saved);
    } catch (e) {}
    return new Set(LABEL_DEFAULTS);
  }

  function initAtlasControls(handle) {
    var mode = 'auto';
    var edgeMode = 'auto';
    var types = readLabelTypes();
    var modeButton = document.getElementById('label-mode');
    var modeState = document.getElementById('label-mode-state');
    var edgeButton = document.getElementById('edge-mode');
    var edgeState = document.getElementById('edge-mode-state');
    var typeButton = document.getElementById('label-types');
    var typeState = document.getElementById('label-types-state');
    var typePanel = document.getElementById('label-types-panel');
    var settingsButton = document.getElementById('settings-trigger');
    var settingsPanel = document.getElementById('settings-panel');
    var helpButton = document.getElementById('help-trigger');
    var helpPanel = document.getElementById('help-panel');
    if (edgeButton) edgeButton.classList.remove('hidden');

    function setExpanded(btn, open) {
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function closePanel(panel, btn) {
      if (panel && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        setExpanded(btn, false);
      }
    }
    function togglePanel(panel, btn, otherPanel, otherBtn) {
      if (!panel || !btn) return;
      var willOpen = panel.classList.contains('hidden');
      closePanel(otherPanel, otherBtn);
      if (typePanel && panel !== typePanel) typePanel.classList.add('hidden');
      panel.classList.toggle('hidden', !willOpen);
      setExpanded(btn, willOpen);
    }

    function paintLabels() {
      if (modeState) modeState.textContent = mode;
      if (typeState) typeState.textContent = types.size + '/12';
      handle.setLabels(mode, Array.from(types));
    }
    function paintEdges() {
      if (edgeState) edgeState.textContent = edgeMode;
      if (handle.setEdges) handle.setEdges(edgeMode);
    }
    // setLabels / setEdges re-render the resident scene (no rebuild, no
    // layout churn) — the cheapest repaint the engine API exposes.
    function repaint() {
      paintLabels();
      paintEdges();
    }
    function setMode(next) {
      mode = next;
      document.documentElement.dataset.labels = mode;
      paintLabels();
    }
    function cycleMode() {
      var order = ['auto', 'on', 'off'];
      setMode(order[(order.indexOf(mode) + 1) % order.length]);
    }
    function setEdgeMode(next) {
      edgeMode = next;
      document.documentElement.dataset.edges = edgeMode;
      paintEdges();
    }
    function cycleEdgeMode() {
      var order = ['auto', 'on', 'off'];
      setEdgeMode(order[(order.indexOf(edgeMode) + 1) % order.length]);
    }
    if (modeButton) modeButton.addEventListener('click', cycleMode);
    if (edgeButton) edgeButton.addEventListener('click', cycleEdgeMode);

    if (typePanel && typeButton) {
      typePanel.querySelectorAll('.label-types-row').forEach(function (row) {
        var key = row.dataset.type;
        var input = row.querySelector('input[type=checkbox]');
        if (!input) return;
        input.checked = types.has(key);
        input.addEventListener('change', function () {
          if (input.checked) types.add(key); else types.delete(key);
          try { localStorage.setItem(LABEL_TYPES_KEY, JSON.stringify(Array.from(types))); } catch (e) {}
          paintLabels();
        });
      });
      typeButton.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closePanel(settingsPanel, settingsButton);
        closePanel(helpPanel, helpButton);
        typePanel.classList.toggle('hidden');
      });
      var typeReset = document.getElementById('label-types-reset');
      if (typeReset) typeReset.addEventListener('click', function () {
        types = new Set(LABEL_DEFAULTS);
        typePanel.querySelectorAll('.label-types-row').forEach(function (row) {
          var input = row.querySelector('input[type=checkbox]');
          if (input) input.checked = types.has(row.dataset.type);
        });
        try { localStorage.setItem(LABEL_TYPES_KEY, JSON.stringify(Array.from(types))); } catch (e) {}
        paintLabels();
      });
    }

    if (settingsPanel && settingsButton) {
      settingsButton.addEventListener('click', function (ev) {
        ev.stopPropagation();
        togglePanel(settingsPanel, settingsButton, helpPanel, helpButton);
      });
      function bind(inputId, valueId, key) {
        var input = document.getElementById(inputId);
        var output = document.getElementById(valueId);
        if (!input) return;
        input.addEventListener('input', function () {
          var value = parseFloat(input.value);
          if (output) output.textContent = input.value;
          var update = {}; update[key] = value;
          handle.setPhysics(update);
        });
      }
      bind('phys-charge', 'phys-charge-val', 'charge');
      bind('phys-link', 'phys-link-val', 'link');
      bind('phys-collide', 'phys-collide-val', 'collide');
      var physicsReset = document.getElementById('phys-reset');
      if (physicsReset) physicsReset.addEventListener('click', function () {
        Object.keys(PHYSICS_DEFAULTS).forEach(function (key) {
          var stem = key === 'charge' ? 'phys-charge' : key === 'link' ? 'phys-link' : 'phys-collide';
          var input = document.getElementById(stem);
          var output = document.getElementById(stem + '-val');
          if (input) input.value = PHYSICS_DEFAULTS[key];
          if (output) output.textContent = PHYSICS_DEFAULTS[key];
        });
        handle.setPhysics(PHYSICS_DEFAULTS);
      });
    }

    if (helpPanel && helpButton) {
      helpButton.addEventListener('click', function (ev) {
        ev.stopPropagation();
        togglePanel(helpPanel, helpButton, settingsPanel, settingsButton);
      });
    }

    document.addEventListener('click', function (ev) {
      if (typePanel && !typePanel.classList.contains('hidden') &&
          !typePanel.contains(ev.target) && (!typeButton || !typeButton.contains(ev.target))) {
        typePanel.classList.add('hidden');
      }
      if (settingsPanel && !settingsPanel.classList.contains('hidden') &&
          !settingsPanel.contains(ev.target) && (!settingsButton || !settingsButton.contains(ev.target))) {
        closePanel(settingsPanel, settingsButton);
      }
      if (helpPanel && !helpPanel.classList.contains('hidden') &&
          !helpPanel.contains(ev.target) && (!helpButton || !helpButton.contains(ev.target))) {
        closePanel(helpPanel, helpButton);
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      closePanel(settingsPanel, settingsButton);
      closePanel(helpPanel, helpButton);
      if (typePanel) typePanel.classList.add('hidden');
    });
    paintLabels();
    paintEdges();
    return {
      setMode: setMode,
      cycleMode: cycleMode,
      setEdgeMode: setEdgeMode,
      cycleEdgeMode: cycleEdgeMode,
      repaint: repaint,
    };
  }

  function pageCount(data) {
    if (data && data.pages && typeof data.pages === 'object') {
      return Object.keys(data.pages).length;
    }
    return data && Array.isArray(data.nodes) ? data.nodes.length : 0;
  }

  function eligible(data) {
    return pageCount(data) > MIN_ATLAS_PAGES;
  }

  function queryChoice() {
    try {
      var choice = new URLSearchParams(window.location.search).get('viewer');
      return choice === 'atlas' || choice === 'classic' ? choice : null;
    } catch (e) {
      return null;
    }
  }

  function atlasEnabled(data) {
    var explicit = queryChoice();
    if (explicit) return explicit === 'atlas';
    if (!eligible(data)) return false;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'classic') return false;
      if (stored === 'atlas') return true;
    } catch (e) {}
    /* Large wikis: default Atlas. Classic D3 force on ~40k nodes hangs. */
    return true;
  }

  /* The selector is host chrome rather than engine chrome. It appears
   * only when Atlas's bounded-scene model adds value. Changing mode is
   * deliberately a reload: it leaves the classic graph lifecycle and
   * Atlas canvas teardown independent and keeps hash routing intact. */
  function initChoice(data, activeMode) {
    var button = document.getElementById('viewer-mode');
    var state = document.getElementById('viewer-mode-state');
    if (!button || !state || !eligible(data)) return;

    state.textContent = activeMode;
    button.title = activeMode === 'atlas'
      ? 'Use the classic force graph'
      : 'Use the Knowledge Atlas';
    button.classList.remove('hidden');
    button.addEventListener('click', function () {
      var next = activeMode === 'atlas' ? 'classic' : 'atlas';
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}

      /* A query override outranks storage. Remove it when the chooser
       * is used so the click always takes effect; preserve every other
       * query parameter and the current #page route. */
      try {
        var url = new URL(window.location.href);
        url.searchParams.delete('viewer');
        window.location.assign(url.toString());
      } catch (e) {
        window.location.reload();
      }
    });
  }


  function initAtlasSearch(handle, data) {
    var wrap = document.getElementById('atlas-search-wrap');
    var input = document.getElementById('atlas-search');
    var results = document.getElementById('atlas-search-results');
    if (!wrap || !input || !results || !window.Fuse) return;
    wrap.hidden = false;

    var records = (data.nodes || []).map(function (n) {
      return { id: n.id, title: n.title || n.id, type: n.type || '' };
    });
    var fuse = new Fuse(records, {
      keys: [
        { name: 'title', weight: 0.75 },
        { name: 'type', weight: 0.1 },
        { name: 'id', weight: 0.15 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });

    var active = -1;
    var currentHits = [];

    function clearHighlights() {
      if (handle.engine && handle.engine.select) {
        handle.engine.select([], 'replace');
      }
      results.hidden = true;
      results.innerHTML = '';
      active = -1;
      currentHits = [];
    }

    function paintResults(hits) {
      currentHits = hits;
      active = hits.length ? 0 : -1;
      if (!hits.length) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      results.hidden = false;
      results.innerHTML = hits.map(function (h, i) {
        return '<button type="button" class="atlas-search-hit" role="option" data-idx="' + i + '"' +
          (i === active ? ' aria-selected="true"' : '') + '>' +
          '<span class="hit-type">' + escapeHtml(h.type || '') + '</span>' +
          '<span class="hit-title">' + escapeHtml(h.title) + '</span></button>';
      }).join('');
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    }

    function applyHits(hits) {
      var ids = hits.map(function (h) { return h.id; });
      if (handle.engine && handle.engine.select) {
        handle.engine.select(ids.slice(0, 80), 'replace');
      }
      paintResults(hits.slice(0, 12));
      if (hits[0] && handle.engine && handle.engine.focus) {
        // Soft focus first hit so the camera moves toward it without opening.
        try { handle.engine.hover(hits[0].id); } catch (e) {}
      }
    }

    function openHit(hit) {
      if (!hit) return;
      if (handle.engine && handle.engine.focus) {
        handle.engine.focus(hit.id, 'user');
      }
      window.location.hash = '#page=' + encodeURIComponent(hit.id);
      results.hidden = true;
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (!q) { clearHighlights(); return; }
      var hits = fuse.search(q, { limit: 40 }).map(function (r) { return r.item; });
      applyHits(hits);
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        input.value = '';
        clearHighlights();
        input.blur();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (!currentHits.length) return;
        active = Math.min(currentHits.length - 1, active + 1);
        paintResults(currentHits);
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!currentHits.length) return;
        active = Math.max(0, active - 1);
        paintResults(currentHits);
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        openHit(currentHits[Math.max(0, active)] || currentHits[0]);
      }
    });

    results.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.atlas-search-hit');
      if (!btn) return;
      var idx = parseInt(btn.dataset.idx, 10);
      openHit(currentHits[idx]);
    });
  }


  // Called by main.js instead of Graph.init when the flag is on.
  // Returns a Graph-compatible facade so focus()/clearFocus() callers
  // keep working. Edges are preloaded BEFORE mount so force layout
  // clusters correctly; edge *strokes* are gated by camera scale so
  // zoomed-out views stay readable (~1k nodes on screen ⇒ edges on).
  function gunzipJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
      return res.arrayBuffer();
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      if (isGzip) {
        if (!window.DecompressionStream) {
          return Promise.reject(new Error('DecompressionStream unavailable'));
        }
        var stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).text();
      }
      return new TextDecoder().decode(bytes);
    }).then(function (text) { return JSON.parse(text); });
  }

  function init(data) {
    var container = document.getElementById('graph');
    if (!container || !window.KnowledgeAtlas) return null;
    container.innerHTML =
      '<div style="padding:28px;color:#bdbdc8;font:14px/1.45 system-ui">' +
      'Loading WikiLinks + building force layout…</div>';

    var corpusSize = pageCount(data);
    /* Edge strokes: controlled by edgeMode (auto/on/off) — drawing only;
     * edges stay in the force graph and link counts. Default auto is a
     * sparse subset on large corpora (full draw when small). */

    var pages = {};
    var nodes = data.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var stub = (data.pages && data.pages[n.id]) || {};
      pages[n.id] = {
        id: n.id,
        title: n.title || n.id,
        type: n.type,
        path: n.path || (n.id + '.md'),
        properties: {},
        body_html: '',
        body_shard: stub.body_shard,
      };
    }

    var handle = null;
    var controls = null;
    var facade = {
      focus: function (pageId) {
        if (handle && handle.engine) handle.engine.focus(pageId, 'system');
      },
      select: function (ids) {
        if (handle && handle.engine && handle.engine.select) {
          handle.engine.select(ids || [], 'replace');
        }
      },
      clearFocus: function () {
        if (handle && handle.engine && handle.engine.select) {
          handle.engine.select([], 'replace');
        }
      },
      setLabelMode: function (mode) {
        if (controls && controls.setMode) controls.setMode(mode);
      },
      cycleLabelMode: function () {
        if (controls && controls.cycleMode) controls.cycleMode();
      },
      setEdgeMode: function (mode) {
        if (controls && controls.setEdgeMode) controls.setEdgeMode(mode);
      },
      cycleEdgeMode: function () {
        if (controls && controls.cycleEdgeMode) controls.cycleEdgeMode();
      },
      destroy: function () {
        if (handle) handle.destroy();
      },
      subscribe: function (cb) {
        return handle && handle.engine ? handle.engine.on(cb) : function () {};
      },
      getSnapshot: function () {
        return handle && handle.engine ? handle.engine.snapshot() : null;
      },
      get controller() {
        return handle ? handle.engine : null;
      },
    };

    var edgeUrl = (data && data.edges_url) || 'edges.json.gz';
    var edgePromise = (data.edges && data.edges.length)
      ? Promise.resolve(data.edges)
      : gunzipJson(edgeUrl);

    edgePromise.then(function (edges) {
      var atlasData = {
        workspace: data.workspace,
        generated_at: data.generated_at,
        palette: data.palette,
        nodes: nodes,
        edges: edges,
        pages: pages,
      };
      container.innerHTML = '';
      handle = window.KnowledgeAtlas.mount(container, {
        data: atlasData,
        edgeMode: 'auto',
        config: {
          layout: 'hybrid',
          corpusSize: corpusSize,
          coreCapacity: Math.max(1, corpusSize),
          maxVisibleNodes: Math.max(1, corpusSize),
          /* Roomier than CE defaults: sliders were unresponsive at ~40k nodes,
             so physics is fixed here and the gear UI is hidden. */
          physics: {
            charge: PHYSICS_DEFAULTS.charge,
            link: PHYSICS_DEFAULTS.link,
            collide: PHYSICS_DEFAULTS.collide,
          },
          budget: {
            maxNodes: Math.max(1, corpusSize),
            maxAggregates: 0,
            maxEdges: Math.max(edges.length, 900),
            maxBundles: 0,
            maxLabels: 60,
          },
        },
        onOpenItem: function (id) {
          window.location.hash = '#page=' + encodeURIComponent(id);
        },
      });
      controls = initAtlasControls(handle);
      initAtlasSearch(handle, atlasData);
      /* Subgraph/minigraph + any other consumer still hold the slim
       * data object from main.js (edges: []). Point them at the full set. */
      data.edges = edges;
      if (window.Subgraph && typeof Subgraph.init === 'function') {
        Subgraph.init(data);
      }
      if (window.Sidebar && typeof Sidebar.updateCounts === 'function') {
        Sidebar.updateCounts(data);
      }
      console.info('Atlas mounted with', edges.length, 'edges; edgeMode auto');
    }).catch(function (err) {
      console.error('Atlas edge preload / mount failed', err);
      container.innerHTML =
        '<div style="padding:24px;color:#ccc;font:14px system-ui">' +
        'Atlas failed to start (edge load). See console.</div>';
    });

    return facade;
  }

  window.AtlasViewer = {
    minPages: MIN_ATLAS_PAGES,
    pageCount: pageCount,
    eligible: eligible,
    enabled: atlasEnabled,
    initChoice: initChoice,
    init: init,
  };
})();
