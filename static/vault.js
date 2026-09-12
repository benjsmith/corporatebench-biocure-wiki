/* On-demand vault source open.
 *
 * CE source pages are stubs; full extracted text lives in vault/*.extracted.md.
 * Those files are packed into vault/shard-NN.zip (see vault/manifest.json.gz).
 * Clicking a .cite / .cite-vault control fetches only the needed shard, extracts
 * that one file with JSZip, and opens it in a new tab.
 */
window.VaultSources = (function () {
  const MANIFEST_URL = 'vault/manifest.json.gz';
  const shardCache = Object.create(null); // id -> Promise<JSZip>
  const shardBufCache = Object.create(null); // id -> ArrayBuffer
  let manifestPromise = null;

  function gunzipMaybe(buf) {
    const bytes = new Uint8Array(buf);
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzip) return Promise.resolve(new TextDecoder().decode(bytes));
    if (!window.DecompressionStream) {
      return Promise.reject(new Error('DecompressionStream unavailable'));
    }
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(MANIFEST_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('vault manifest HTTP ' + res.status);
          return res.arrayBuffer();
        })
        .then(gunzipMaybe)
        .then(function (text) { return JSON.parse(text); })
        .catch(function (err) {
          manifestPromise = null;
          throw err;
        });
    }
    return manifestPromise;
  }

  function normalizeName(name) {
    if (!name) return null;
    var s = String(name).trim();
    s = s.replace(/^\[/, '').replace(/\]$/, '');
    s = s.replace(/^\(vault:/, '').replace(/\)$/, '');
    s = s.replace(/^vault:/, '');
    // basename only
    s = s.split('/').pop();
    if (!/^[A-Za-z0-9._-]+\.extracted\.md$/.test(s)) return null;
    return s;
  }

  function shardUrl(id) {
    var n = Number(id);
    var pad = (n < 10 ? '0' : '') + n;
    return 'vault/shard-' + pad + '.zip';
  }

  function loadShardZip(id) {
    if (shardCache[id]) return shardCache[id];
    if (typeof JSZip === 'undefined') {
      return Promise.reject(new Error('JSZip not loaded'));
    }
    shardCache[id] = fetch(shardUrl(id))
      .then(function (res) {
        if (!res.ok) throw new Error('vault shard HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buf) {
        shardBufCache[id] = buf;
        return JSZip.loadAsync(buf);
      })
      .catch(function (err) {
        delete shardCache[id];
        throw err;
      });
    return shardCache[id];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function viewerHtml(filename, text) {
    // Split optional YAML frontmatter for a light chrome + body
    var body = text;
    var meta = '';
    if (text.indexOf('---\n') === 0) {
      var end = text.indexOf('\n---\n', 4);
      if (end !== -1) {
        meta = text.slice(4, end);
        body = text.slice(end + 5);
      }
    }
    // Strip the "BEGIN FETCHED CONTENT" wrapper comment if present
    body = body.replace(/^\s*<!-- BEGIN FETCHED CONTENT[\s\S]*?-->\s*/i, '');
    body = body.replace(/\s*<!-- END FETCHED CONTENT[\s\S]*?-->\s*$/i, '');

    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(filename) + '</title>' +
      '<style>' +
      'html,body{margin:0;background:#101014;color:#e8e8ee;font:14px/1.55 system-ui,sans-serif}' +
      'header{position:sticky;top:0;padding:12px 20px;background:#16161d;border-bottom:1px solid #3a3a46;' +
      'display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}' +
      'header h1{margin:0;font-size:14px;font-weight:600;word-break:break-all}' +
      'header .tag{font-size:11px;color:#9a9aa8;text-transform:uppercase;letter-spacing:.04em}' +
      'main{max-width:52rem;margin:0 auto;padding:20px 20px 48px}' +
      'pre.meta{white-space:pre-wrap;word-break:break-word;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      'color:#9a9aa8;background:#16161d;border:1px solid #3a3a46;border-radius:8px;padding:10px 12px;margin:0 0 16px}' +
      'pre.body{white-space:pre-wrap;word-break:break-word;font:13.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      'margin:0;background:#121218;border:1px solid #3a3a46;border-radius:8px;padding:16px 18px}' +
      '</style></head><body>' +
      '<header><span class="tag">Vault source</span><h1>' + escapeHtml(filename) + '</h1></header>' +
      '<main>' +
      (meta ? '<pre class="meta">' + escapeHtml(meta.trim()) + '</pre>' : '') +
      '<pre class="body">' + escapeHtml(body.replace(/^\n+/, '')) + '</pre>' +
      '</main></body></html>';
  }

  function openInTab(filename, text) {
    var html = viewerHtml(filename, text);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      // Popup blocked — fall back to same-tab navigation
      window.location.assign(url);
      return;
    }
    // Revoke later so the tab can finish loading
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function setBusy(el, busy, label) {
    if (!el) return;
    if (busy) {
      el.dataset.vaultBusy = '1';
      el.setAttribute('aria-busy', 'true');
      if (label) el.dataset.vaultLabel = el.textContent;
      el.textContent = label || 'Loading…';
    } else {
      delete el.dataset.vaultBusy;
      el.removeAttribute('aria-busy');
      if (el.dataset.vaultLabel) {
        el.textContent = el.dataset.vaultLabel;
        delete el.dataset.vaultLabel;
      }
    }
  }

  function open(name, triggerEl) {
    var filename = normalizeName(name);
    if (!filename) {
      console.warn('VaultSources: bad name', name);
      return Promise.resolve(false);
    }
    if (!window.JSZip) {
      alert('Vault viewer failed to load (JSZip missing).');
      return Promise.resolve(false);
    }
    setBusy(triggerEl, true, 'Loading…');
    return loadManifest()
      .then(function (man) {
        var sid = man.files && man.files[filename];
        if (sid == null) throw new Error('Not in vault manifest: ' + filename);
        return loadShardZip(sid).then(function (zip) {
          var entry = zip.file(filename);
          if (!entry) throw new Error('Missing from shard: ' + filename);
          return entry.async('string');
        });
      })
      .then(function (text) {
        setBusy(triggerEl, false);
        openInTab(filename, text);
        return true;
      })
      .catch(function (err) {
        console.warn('VaultSources.open failed', err);
        setBusy(triggerEl, false);
        alert('Could not open vault source:\n' + (err && err.message ? err.message : err));
        return false;
      });
  }

  function enhance(root) {
    if (!root) return;
    root.querySelectorAll('.cite').forEach(function (el) {
      if (el.dataset.vaultBound) return;
      var name = normalizeName(el.textContent);
      if (!name) return;
      el.dataset.vaultBound = '1';
      el.dataset.vault = name;
      el.classList.add('cite-vault');
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.title = 'Open full vault source in a new tab';
      el.setAttribute('aria-label', 'Open full vault source ' + name);
    });
  }

  function bind(root) {
    if (!root || root.dataset.vaultListen) return;
    root.dataset.vaultListen = '1';
    root.addEventListener('click', function (ev) {
      var el = ev.target.closest && ev.target.closest('.cite-vault, [data-vault]');
      if (!el || !root.contains(el)) return;
      if (el.dataset.vaultBusy) return;
      var name = el.dataset.vault || el.textContent;
      if (!normalizeName(name)) return;
      ev.preventDefault();
      ev.stopPropagation();
      open(name, el);
    });
    root.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var el = ev.target.closest && ev.target.closest('.cite-vault, [data-vault]');
      if (!el || !root.contains(el)) return;
      ev.preventDefault();
      open(el.dataset.vault || el.textContent, el);
    });
  }

  return { open: open, enhance: enhance, bind: bind, normalizeName: normalizeName };
})();
