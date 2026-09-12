/* Orchestrator: load data.json, init each module, wire hash routing.
 * Hash format:  #page=<page-id>  → opens that page in the modal.
 */
(async function () {
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
          if (!window.DecompressionStream) {
            throw new Error('DecompressionStream unavailable for ' + url);
          }
          const ds = new DecompressionStream('gzip');
          const stream = res.body.pipeThrough(ds);
          const text = await new Response(stream).text();
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
    data = await loadWikiData();
  } catch (e) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:system-ui">' +
      'Failed to load <code>data.json.gz</code> / <code>data.json</code>. Re-run ' +
      '<code>bash &lt;skill_path&gt;/scripts/viewer.sh build</code>.' +
      '</div>';
    console.error(e);
    return;
  }

  Theme.init();
  Sidebar.init(data);
  Subgraph.init(data);
  Modal.init(data);
  /* Knowledge Atlas is an opt-in for large wikis. When selected it
   * takes over the #graph pane and returns a Graph-compatible facade;
   * every other module is untouched. static/atlas.js owns eligibility,
   * persistence and the host-level viewer chooser. */
  let graphApi = Graph;
  let viewerMode = 'classic';
  if (window.AtlasViewer && AtlasViewer.enabled(data) && window.KnowledgeAtlas) {
    const atlas = AtlasViewer.init(data);
    if (atlas) {
      graphApi = atlas;
      viewerMode = 'atlas';
    }
    else Graph.init(data);
  } else {
    Graph.init(data);
  }
  document.body.dataset.viewer = viewerMode;
  if (window.AtlasViewer && AtlasViewer.initChoice) {
    AtlasViewer.initChoice(data, viewerMode);
  }
  _maybeShowScanStaleBanner(data);

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
