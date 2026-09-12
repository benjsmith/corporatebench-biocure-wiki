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
  var PHYSICS_DEFAULTS = { charge: -420, link: 110, collide: 10 };

  function readLabelTypes() {
    try {
      var saved = JSON.parse(localStorage.getItem(LABEL_TYPES_KEY) || 'null');
      if (Array.isArray(saved)) return new Set(saved);
    } catch (e) {}
    return new Set(LABEL_DEFAULTS);
  }

  function initAtlasControls(handle) {
    var mode = 'auto';
    var types = readLabelTypes();
    var modeButton = document.getElementById('label-mode');
    var modeState = document.getElementById('label-mode-state');
    var typeButton = document.getElementById('label-types');
    var typeState = document.getElementById('label-types-state');
    var typePanel = document.getElementById('label-types-panel');
    var settingsButton = document.getElementById('settings-trigger');
    var settingsPanel = document.getElementById('settings-panel');

    function paintLabels() {
      if (modeState) modeState.textContent = mode;
      if (typeState) typeState.textContent = types.size + '/12';
      handle.setLabels(mode, Array.from(types));
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
    if (modeButton) modeButton.addEventListener('click', cycleMode);

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
        settingsPanel.classList.toggle('hidden');
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

    document.addEventListener('click', function (ev) {
      if (typePanel && !typePanel.classList.contains('hidden') &&
          !typePanel.contains(ev.target) && (!typeButton || !typeButton.contains(ev.target))) {
        typePanel.classList.add('hidden');
      }
      if (settingsPanel && !settingsPanel.classList.contains('hidden') &&
          !settingsPanel.contains(ev.target) && (!settingsButton || !settingsButton.contains(ev.target))) {
        settingsPanel.classList.add('hidden');
      }
    });
    paintLabels();
    return { setMode: setMode, cycleMode: cycleMode };
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
  // keep working.
  function init(data) {
    var container = document.getElementById('graph');
    if (!container || !window.KnowledgeAtlas) return null;
    container.innerHTML = '';

    var corpusSize = pageCount(data);
    /* Pages ships pages as {body_shard} only. KnowledgeAtlas requires
     * id/title/type on each page — build those from nodes here. */
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
    var atlasData = {
      workspace: data.workspace,
      generated_at: data.generated_at,
      palette: data.palette,
      nodes: nodes,
      edges: data.edges || [],
      pages: pages,
    };

    /* Pages policy (user 2026-09-12): always individual nodes (grouped=0).
     * Draw load is controlled by a raised min camera zoom so the main
     * window keeps ~1k nodes in view; the minimap still shows everyone. */
    var handle;
    try {
      handle = window.KnowledgeAtlas.mount(container, {
        data: atlasData,
        config: {
          layout: 'hybrid',
          corpusSize: corpusSize,
          coreCapacity: Math.max(1, corpusSize),
          maxVisibleNodes: Math.max(1, corpusSize),
          budget: {
            maxNodes: Math.max(1, corpusSize),
            maxAggregates: 0,
            maxEdges: 200000,  /* full WikiLink set; drawn only when zoomed in */
            maxBundles: 0,
            maxLabels: 60,
          },
        },
        onOpenItem: function (id) {
          window.location.hash = '#page=' + encodeURIComponent(id);
        },
      });
    } catch (err) {
      console.error('Atlas mount failed', err);
      container.innerHTML =
        '<div style="padding:24px;color:#ccc;font:14px system-ui">Atlas failed to start. See console.</div>';
      return null;
    }
    var controls = initAtlasControls(handle);
    initAtlasSearch(handle, typeof atlasData !== "undefined" ? atlasData : data);

    /* Zoom-triggered full edge load (Pages). data.json.gz ships nodes only;
     * edges.json.gz (~1.2MB) is fetched the first time camera scale passes
     * __ceAtlasEdgeMinScale, then injected into the live graph. Drawing is
     * also gated on that scale in knowledge-atlas.js so zoomed-out stays clean. */
    (function setupZoomEdges() {
      var EDGE_URL = (data && data.edges_url) || 'edges.json.gz';
      var minScale = window.__ceAtlasEdgeMinScale = window.__ceAtlasEdgeMinScale || 0.5;
      var state = { inflight: false, injected: false };
      var engine = handle.engine;

      async function gunzipJson(url) {
        var res = await fetch(url);
        if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
        var buf = await res.arrayBuffer();
        var bytes = new Uint8Array(buf);
        var isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
        var text;
        if (isGzip) {
          if (!window.DecompressionStream) throw new Error('DecompressionStream unavailable');
          var stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
          text = await new Response(stream).text();
        } else {
          text = new TextDecoder().decode(bytes);
        }
        return JSON.parse(text);
      }

      async function injectEdges() {
        if (state.injected || state.inflight) return;
        state.inflight = true;
        try {
          var edges = await gunzipJson(EDGE_URL);
          var graph = engine && engine.source && engine.source.graph;
          if (!graph || !graph.addEdge) throw new Error('atlas graph unavailable');
          for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            graph.addEdge(e.source, e.target, e.type || 'wikilink', e.confidence == null ? 1 : e.confidence);
          }
          state.injected = true;
          if (typeof engine.requestScene === 'function') engine.requestScene();
          console.info('Atlas edges loaded:', edges.length);
        } catch (err) {
          console.warn('Atlas edge load failed', err);
        } finally {
          state.inflight = false;
        }
      }

      window.__ceAtlasOnScale = function (scale) {
        if (typeof controls.setScaleHint === 'function') controls.setScaleHint(scale);
        if (scale >= minScale) injectEdges();
      };
    })();

    return {
      focus: function (pageId) {
        handle.engine.focus(pageId, 'system');
      },
      select: function (ids) {
        if (handle.engine && handle.engine.select) {
          handle.engine.select(ids || [], 'replace');
        }
      },
      clearFocus: function () {
        if (handle.engine && handle.engine.select) {
          handle.engine.select([], 'replace');
        }
      },
      setLabelMode: controls.setMode,
      cycleLabelMode: controls.cycleMode,
      destroy: function () {
        handle.destroy();
      },
      /* Chrome-free info surface: the engine renders no panels — host
       * chrome (the future telemetry bar, discovery shelf UI, Switch
       * Bay's rail/tab) subscribes here. subscribe(cb) receives every
       * AtlasEvent (scene-ready stats, discovery-engaged, trail-changed,
       * telemetry…); getSnapshot() returns {scene, layout, state, stats}
       * for pull-style rendering. */
      subscribe: function (cb) {
        return handle.engine.on(cb);
      },
      getSnapshot: function () {
        return handle.engine.snapshot();
      },
      controller: handle.engine,
    };
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
