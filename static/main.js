/* Orchestrator: load data.json, init each module, wire hash routing.
 * Hash format:  #page=<page-id>  → opens that page in the modal.
 */
(async function () {
  const loading = document.createElement('div');
  loading.id = 'ce-loading';
  loading.setAttribute('role', 'status');
  loading.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,10,12,.92);color:#e8e8ea;font:500 15px/1.45 system-ui,sans-serif;padding:24px;text-align:center';
  loading.innerHTML = '<div><div style="font-size:16px;margin-bottom:8px">Loading Biocure wiki…</div><div style="opacity:.7;font-size:13px">Downloading atlas index (~0.8&nbsp;MB compressed / ~8&nbsp;MB in memory). Page bodies load on demand.</div></div>';
  document.body.appendChild(loading);
  function setLoading(msg) {
    const el = loading.querySelector('div div:last-child');
    if (el) el.innerHTML = msg;
  }
  function clearLoading() {
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
  }

  async function loadWikiData() {
    /* Prefer gzipped bundle on static hosts (GitHub Pages soft/hard
     * file limits); fall back to plain data.json for local viewer. */
    const tryUrls = ['data.json.gz', 'data.json'];
    let lastErr = null;
    for (const url of tryUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
        if (url.endsWith('.gz')) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          // Gzip magic 1f 8b — otherwise CDN/browser already decoded.
          const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
          let text;
          if (isGzip) {
            if (!window.DecompressionStream) {
              throw new Error('DecompressionStream unavailable for ' + url);
            }
            const ds = new DecompressionStream('gzip');
            const stream = new Blob([buf]).stream().pipeThrough(ds);
            text = await new Response(stream).text();
          } else {
            text = new TextDecoder().decode(bytes);
          }
          return JSON.parse(text);
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('no data bundle');
  }
  let data = null;
  try {
    setLoading('Fetching <code>data.json.gz</code>…');
    data = await loadWikiData();
    setLoading('Parsed ' + ((data.nodes && data.nodes.length) || 0).toLocaleString() +
      ' pages. Building sidebar + atlas…');
  } catch (e) {
    clearLoading();
    document.body.innerHTML =
      '<div style="padding:40px;font-family:system-ui;color:#eee;background:#111;min-height:100vh">' +
      '<h1 style="font-size:18px">Failed to load wiki data</h1>' +
      '<p>Could not load <code>data.json.gz</code> / <code>data.json</code>.</p>' +
      '<pre style="white-space:pre-wrap;opacity:.85">' + String(e && e.message || e) + '</pre>' +
      '</div>';
    console.error(e);
    return;
  }

  Theme.init();
  Sidebar.init(data);
  Subgraph.init(data);
  Modal.init(data);
  clearLoading();
  _maybeShowScanStaleBanner(data);

  /* Resolve viewer + paint view: chooser BEFORE any Graph/Atlas mount.
   * Policy (AtlasViewer): >1000 nodes → Atlas only (no Classic, no
   * chooser). ≤1000 → Classic available. Never call Graph.init on a
   * large corpus — it hangs the main thread. */
  let graphApi = Graph;
  const wantAtlas = !!(window.AtlasViewer && AtlasViewer.enabled(data) && window.KnowledgeAtlas);
  const classicOk = !(window.AtlasViewer && typeof AtlasViewer.classicSafe === 'function')
    || AtlasViewer.classicSafe(data);
  let viewerMode = wantAtlas ? 'atlas' : 'classic';
  /* Safety net: if AtlasViewer says Atlas-only, never stay on classic. */
  if (!classicOk && window.KnowledgeAtlas && window.AtlasViewer) {
    viewerMode = 'atlas';
  }
  document.body.dataset.viewer = viewerMode;
  if (window.AtlasViewer && AtlasViewer.initChoice) {
    AtlasViewer.initChoice(data, viewerMode);
  }

  const startGraph = () => {
    try {
      if (viewerMode === 'atlas' && window.AtlasViewer && window.KnowledgeAtlas) {
        const atlas = AtlasViewer.init(data);
        if (atlas) {
          graphApi = atlas;
          return;
        }
        /* Atlas mount failed: only fall back to Classic when safe. */
        if (classicOk) {
          Graph.init(data);
          viewerMode = 'classic';
          document.body.dataset.viewer = viewerMode;
        } else {
          const el = document.getElementById('graph');
          if (el) {
            el.innerHTML =
              '<div style="padding:28px;color:#ccc;font:14px system-ui">' +
              'Atlas failed to start. Classic is disabled for wikis over 1000 pages.</div>';
          }
        }
        return;
      }
      if (classicOk) {
        Graph.init(data);
      } else {
        /* Should be unreachable (atlasEnabled forces Atlas), but never hang. */
        const el = document.getElementById('graph');
        if (el) {
          el.innerHTML =
            '<div style="padding:28px;color:#ccc;font:14px system-ui">' +
            'Classic is disabled for wikis over 1000 pages. Reload with Atlas.</div>';
        }
      }
    } catch (err) {
      console.error('graph start failed', err);
      if (classicOk) {
        try { Graph.init(data); } catch (e2) { console.error(e2); }
      }
    }
  };
  requestAnimationFrame(() => setTimeout(startGraph, 0));

  /* refetchData — called after the Edit module saves a page. Pulls a
   * fresh data.json (the server rebuilds the bundle on every write)
   * and re-paints the modules that hold page state. The graph layout
   * is left alone so an in-flight save doesn't yank the camera. */
  async function refetchData(currentPageId) {
    try {
      data = await loadWikiData();
    } catch (e) {
      console.warn('refetchData failed:', e);
      return;
    }
    if (Modal.refresh)    Modal.refresh(data);
    if (Subgraph.init)    Subgraph.init(data);   // re-binds neighbour map
    if (currentPageId && Modal.open) {
      Modal.open(currentPageId);
      if (Sidebar.setActive) Sidebar.setActive(currentPageId);
    }
  }
  if (window.Edit) Edit.init(data, refetchData);

  /* Project-dir scan-staleness banner. If wiki_render.py picked up a
   * .curator/scan-staleness.json sidecar showing unscanned files in
   * registered project-dirs, surface a non-blocking banner so the
   * user knows to run `curate` or `/scan`. Silent when the workspace
   * has no project-dirs registered (sidecar absent or zero stale).
   */
  function _maybeShowScanStaleBanner(d) {
    const s = d && d.scan_staleness;
    if (!s) return;
    const total = (s.total_stale_files || 0) +
                  ((s.per_project || []).reduce(
                    (a, p) => a + (p.orphans || 0), 0));
    if (total <= 0) return;
    const projects = (s.per_project || [])
      .filter(p => (p.stale_files || p.to_ingest || 0) > 0
                   || (p.orphans || 0) > 0);
    if (projects.length === 0) return;
    const banner = document.createElement('div');
    banner.id = 'scan-stale-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'padding:8px 12px', 'background:var(--bg-elev)',
      'color:var(--text)', 'font-size:12px',
      'border-bottom:1px solid var(--line-strong)',
      'z-index:1000', 'display:flex',
      'justify-content:space-between', 'align-items:center',
      'font-family:var(--font-sans)',
    ].join(';');
    const detail = projects
      .map(p => `${p.project}: ${p.stale_files || p.to_ingest || 0}` +
                ((p.orphans || 0) > 0 ? `+${p.orphans} orphan` : ''))
      .join(' · ');
    banner.innerHTML =
      `<span><strong>${total} unscanned change(s)</strong> ` +
      `in project-dirs: ${detail}. ` +
      `Run <code>curate</code> or <code>/scan</code> to ingest.</span>` +
      `<button id="scan-stale-dismiss" style="background:none;` +
      `border:1px solid var(--line);color:var(--text);` +
      `padding:2px 8px;border-radius:3px;cursor:pointer;` +
      `font-size:11px">dismiss</button>`;
    document.body.appendChild(banner);
    const dismiss = document.querySelector('#scan-stale-dismiss');
    if (dismiss) dismiss.addEventListener('click',
      () => banner.remove());
  }

  function applyHash() {
    const m = window.location.hash.match(/^#page=([^&]+)$/);
    if (m) {
      const pageId = decodeURIComponent(m[1]);
      const ok = Modal.open(pageId);
      if (ok) {
        Sidebar.setActive(pageId);
        graphApi.focus(pageId);
      }
    } else {
      Modal.close();
      if (graphApi.clearFocus) graphApi.clearFocus();
    }
  }
  // Modal's close paths (X button, backdrop click, ESC) replaceState
  // and don't fire hashchange — let the modal tell us so we can
  // un-focus the graph.
  Modal.setOnClose(() => { if (graphApi.clearFocus) graphApi.clearFocus(); });
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
