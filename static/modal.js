/* Doc viewer modal.
 *
 * open(pageId) populates the title + properties + body, sets
 * body[data-modal=open] to fade graph + sidebar, and shows the modal.
 * close() hides + clears state. Clicking the backdrop or the X button
 * closes; ESC also closes.
 */
window.Modal = (function () {
  let pages = {};
  let modal, backdrop, closeBtn, titleEl, propsEl, bodyEl;
  let onClose = null;
  const shardCache = {};  // shardId -> { pageId: body_html }
  const shardInflight = {};

  async function gunzipJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    let text;
    if (isGzip) {
      if (!window.DecompressionStream) throw new Error('DecompressionStream unavailable');
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(bytes);
    }
    return JSON.parse(text);
  }

  async function ensureBody(page) {
    if (!page) return '';
    if (page.body_html) return page.body_html;
    const sid = page.body_shard;
    if (sid == null) return '';
    if (!shardCache[sid]) {
      if (!shardInflight[sid]) {
        shardInflight[sid] = gunzipJson('bodies/' + sid + '.json.gz')
          .then(map => { shardCache[sid] = map; delete shardInflight[sid]; return map; })
          .catch(err => { delete shardInflight[sid]; throw err; });
      }
      await shardInflight[sid];
    }
    const html = (shardCache[sid] && shardCache[sid][page.id]) || '';
    page.body_html = html;
    return html;
  }

  let nodeById = Object.create(null);

  function resolvePage(pageId) {
    let page = pages[pageId];
    if (page && page.title) return page;
    const n = nodeById[pageId] || {};
    const stub = page || {};
    page = {
      id: pageId,
      title: n.title || stub.title || pageId,
      type: n.type || stub.type || 'unclassified',
      path: n.path || stub.path || (pageId + '.md'),
      properties: stub.properties || {},
      body_html: stub.body_html || '',
      body_shard: stub.body_shard,
    };
    pages[pageId] = page;
    return page;
  }

  function init(data) {
    pages = data.pages || {};
    nodeById = Object.create(null);
    for (const n of (data.nodes || [])) nodeById[n.id] = n;
    modal = document.querySelector('#modal');
    backdrop = document.querySelector('#modal-backdrop');
    closeBtn = document.querySelector('#modal-close');
    titleEl = document.querySelector('#modal-title');
    propsEl = document.querySelector('#modal-properties');
    bodyEl = document.querySelector('#modal-body');

    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.body.dataset.modal === 'open') {
        close();
      }
    });

    // Body wikilink delegation — clicking a wikilink swaps the modal
    // to that page without closing.
    bodyEl.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a.wikilink');
      if (!a) return;
      ev.preventDefault();
      if (a.classList.contains('unresolved')) return;
      const target = a.dataset.page;
      if (target) {
        window.location.hash = '#page=' + encodeURIComponent(target);
      }
    });
  }

  function open(pageId) {
    const page = resolvePage(pageId);
    if (!page || (!nodeById[pageId] && !(pages[pageId] && pages[pageId].body_shard))) {
      console.warn('Modal: unknown page', pageId);
      return false;
    }
    titleEl.textContent = page.title || pageId;
    renderProperties(page);
    bodyEl.innerHTML = page.body_html
      ? page.body_html
      : '<p style="opacity:.7">Loading page body…</p>';
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.dataset.modal = 'open';
    bodyEl.parentElement.scrollTop = 0;
    if (window.Subgraph) Subgraph.render(pageId);
    if (window.Edit) Edit.updateForPage(page);
    if (!page.body_html) {
      const openedFor = pageId;
      ensureBody(page).then(html => {
        // Only fill if still viewing this page.
        if (document.body.dataset.modal === 'open' &&
            (window.location.hash === '#page=' + encodeURIComponent(openedFor) ||
             titleEl.textContent === (page.title || pageId))) {
          bodyEl.innerHTML = html || '<p style="opacity:.7">(empty)</p>';
        }
      }).catch(err => {
        console.warn('body shard load failed', err);
        if (document.body.dataset.modal === 'open') {
          bodyEl.innerHTML = '<p style="opacity:.7">Failed to load page body.</p>';
        }
      });
    }
    return true;
  }

  /* Refresh the cached `pages` dict (called after a successful edit
   * so the modal shows the rebuilt body_html on next open). */
  function refresh(data) { pages = data.pages || {}; }

  function close() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.dataset.modal = '';
    if (window.Subgraph) Subgraph.clear();
    if (typeof onClose === 'function') onClose();
    // Strip the page=… part of the hash if present, so closing leaves
    // a clean URL the user can bookmark for the graph view.
    if (window.location.hash.startsWith('#page=')) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  /* setOnClose registers a *persistent* close listener (not one-shot).
   * main.js uses this to clear the graph focus on every close. */
  function setOnClose(cb) { onClose = cb; }

  function renderProperties(page) {
    const rows = [];
    rows.push(propRow('title', page.title, 'list'));
    rows.push(propRow('type',  page.type,  'list'));
    const props = page.properties || {};
    const order = ['created', 'updated', 'sources'];
    const seen = new Set(['title', 'type']);
    for (const key of order) {
      if (key in props) {
        rows.push(propRow(key, props[key], iconForKey(key)));
        seen.add(key);
      }
    }
    for (const [k, v] of Object.entries(props)) {
      if (seen.has(k)) continue;
      rows.push(propRow(k, v, 'list'));
    }
    propsEl.innerHTML = rows.join('');
  }

  function propRow(key, value, iconKind) {
    const v = formatValue(value);
    const icon = renderIcon(iconKind);
    return `<tr>
      <td class="prop-key">${icon}<span>${escapeHtml(key)}</span></td>
      <td class="prop-val">${v}</td>
    </tr>`;
  }

  function iconForKey(k) {
    if (k === 'created' || k === 'updated') return 'calendar';
    return 'list';
  }

  function renderIcon(kind) {
    if (kind === 'calendar') {
      return `<span class="prop-icon"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><line x1="2.5" y1="6.5" x2="13.5" y2="6.5"/><line x1="5.5" y1="2.5" x2="5.5" y2="4.5"/><line x1="10.5" y1="2.5" x2="10.5" y2="4.5"/></svg></span>`;
    }
    return `<span class="prop-icon"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></span>`;
  }

  function formatValue(v) {
    if (v == null) return '<span style="color:var(--text-faint)">—</span>';
    if (Array.isArray(v)) {
      return v.map(item => `<div>${escapeHtml(String(item))}</div>`).join('');
    }
    return escapeHtml(String(v));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  return { init, open, close, setOnClose, refresh };
})();
