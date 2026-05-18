// ==UserScript==
// @name         COMO Batcher Timer
// @namespace    https://github.com/uny2-ops
// @version      3.1.2
// @description  Floating panel showing all active batcher timers, scan rates, and daily history leaderboard
// @author       Eitan Wiernik
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/
// @match        https://como-operations-dashboard-iad.iad.proxy.amazon.com/store/*/tasks*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const POLL_MS = 4000;
  const TICK_MS = 1000;
  const WARN_ELAPSED_MIN = 15;
  const ALERT_ELAPSED_MIN = 25;
  const WARN_RATE = 2.1;
  const ALERT_RATE = 1.5;

  const COMO_BASE = 'https://como-operations-dashboard-iad.iad.proxy.amazon.com';
  const STORAGE_KEY = 'cbt_history';
  const DATE_KEY = 'cbt_history_date';

  // ─── STATE ────────────────────────────────────────────────────────────────
  const taskCache = new Map();
  let activeTab = 'live';

  // ─── HISTORY STORAGE ──────────────────────────────────────────────────────

  function todayStr() {
    return new Date().toLocaleDateString('en-US');
  }

  function loadHistory() {
    try {
      const savedDate = localStorage.getItem(DATE_KEY);
      if (savedDate !== todayStr()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(DATE_KEY, todayStr());
        return {};
      }
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      localStorage.setItem(DATE_KEY, todayStr());
    } catch {}
  }

  function recordCompletedBatch(data, elapsedSec) {
    if (!data.associateId && !data.associate) return;
    const pkgs = data.packagesBatched || 0;
    if (pkgs === 0 || !elapsedSec) return;

    if (elapsedSec < 30) {
      console.warn(`[CBT] Skipped short batch for ${data.associateId || data.associate}: ${elapsedSec.toFixed(0)}s, ${pkgs} pkgs`);
      return;
    }

    const assoc = data.associateId || data.associate;
    const rate = pkgs / (elapsedSec / 60);
    const history = loadHistory();

    if (history[assoc]) {
      const e = history[assoc];
      const totalPkgs = e.totalPkgs + pkgs;
      const totalSec = e.totalSec + elapsedSec;
      const runs = e.runs + 1;
      history[assoc] = {
        assoc,
        totalPkgs,
        totalSec,
        runs,
        avgRate: totalPkgs / (totalSec / 60),
        lastRate: rate,
      };
    } else {
      history[assoc] = {
        assoc,
        totalPkgs: pkgs,
        totalSec:  elapsedSec,
        runs:      1,
        avgRate:   rate,
        lastRate:  rate,
      };
    }

    saveHistory(history);
    if (activeTab === 'history') renderHistory();
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  function fmt(sec) {
    if (sec == null || isNaN(sec) || sec < 0) return '--:--';
    return `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(Math.floor(sec % 60)).padStart(2,'0')}`;
  }

  function getStoreId() {
    const m = window.location.pathname.match(/\/store\/([^/]+)/);
    return m ? m[1] : null;
  }

  // ─── INGEST ───────────────────────────────────────────────────────────────

  function ingestItem(item) {
    if (!item || typeof item !== 'object') return false;
    const ref = item.shortClientRef;
    if (!ref) return false;

    const existing = taskCache.get(ref);

    if (existing && existing.state === 'BATCHING' &&
        item.state !== 'BATCHING' && item.state !== undefined) {

      existing._recording = true;
      taskCache.set(ref, existing);

      const merged = { ...existing, ...item };
      const { elapsedSec } = computeRow(merged);
      recordCompletedBatch(merged, elapsedSec);
      taskCache.delete(ref);
      return true;
    }

    if (item.state !== 'BATCHING' && item.operationState !== 'IN_PROGRESS') return false;

    taskCache.set(ref, item);
    return true;
  }

  function ingestData(d) {
    if (!d) return;
    let changed = false;

    if (Array.isArray(d)) {
      d.forEach(item => { if (ingestItem(item)) changed = true; });
    } else if (d.shortClientRef) {
      if (ingestItem(d)) changed = true;
    } else {
      for (const key of ['summaries', 'tasks', 'results', 'items', 'jobs', 'data']) {
        if (Array.isArray(d[key])) {
          d[key].forEach(item => { if (ingestItem(item)) changed = true; });
          if (changed) break;
        }
      }
    }

    if (changed) renderPanel();
  }

  async function pruneCache(storeId) {
    for (const [ref, data] of taskCache.entries()) {
      if (data.state !== 'BATCHING' && !data._recording) {
        let finalData = data;

        if (data.jobId && storeId) {
          try {
            const res = await _origFetch(
              `${COMO_BASE}/store/${storeId}/task/${encodeURIComponent(data.jobId)}`,
              { credentials: 'include', headers: { Accept: 'application/json' } }
            );
            if (res.ok) {
              const fresh = await res.json();
              const freshItem = fresh?.shortClientRef
                ? fresh
                : (fresh?.tasks || fresh?.items || fresh?.data || [fresh])
                    .find(t => t && t.shortClientRef === ref);
              if (freshItem) {
                finalData = { ...data, ...freshItem };
                console.log(`[CBT] Final fetch for ${ref}: ${freshItem.packagesBatched ?? 'n/a'} pkgs`);
              }
            }
          } catch (e) {
            console.warn(`[CBT] Final fetch failed for ${ref}:`, e);
          }
        }

        const { elapsedSec } = computeRow(finalData);
        recordCompletedBatch(finalData, elapsedSec);
        taskCache.delete(ref);
      }
    }
  }

  // ─── TIMING ───────────────────────────────────────────────────────────────

  function computeRow(data) {
    const op = (data.operationDetails || []).find(o => o.name === 'BATCHING');

    const startMs = op?.start
      ? op.start * 1000
      : data.created
        ? data.created * 1000
        : null;

    const inProgress = op?.state === 'IN_PROGRESS' || data.state === 'BATCHING';
    const batchedN = data.packagesBatched || 0;
    const elapsedSec = startMs ? (Date.now() - startMs) / 1000 : null;

    const scanRate = (batchedN > 0 && elapsedSec > 30)
      ? (batchedN / (elapsedSec / 60))
      : null;

    return { startMs, elapsedSec, scanRate, inProgress };
  }

  // ─── XHR INTERCEPT ────────────────────────────────────────────────────────

  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (m, url, ...r) {
    this._cbtUrl = url;
    return _xhrOpen.call(this, m, url, ...r);
  };

  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', function () {
      try {
        if (!(this.getResponseHeader('content-type') || '').includes('json')) return;
        ingestData(JSON.parse(this.responseText));
      } catch {}
    });
    return _xhrSend.call(this, ...a);
  };

  // ─── FETCH INTERCEPT ──────────────────────────────────────────────────────

  const _origFetch = window.fetch;
  window.fetch = async function (...a) {
    let resp;
    try { resp = await _origFetch.apply(this, a); }
    catch (e) { throw e; }
    try {
      if ((resp.headers.get('content-type') || '').includes('json')) {
        resp.clone().json().then(d => ingestData(d)).catch(() => {});
      }
    } catch {}
    return resp;
  };

  // ─── ACTIVE POLL ──────────────────────────────────────────────────────────

  async function pollActiveTasks() {
    const storeId = getStoreId();
    if (!storeId) return;

    try {
      const res = await _origFetch(
        `${COMO_BASE}/store/${storeId}/activeJobsWithSiteSummary`,
        { credentials: 'include', headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) ingestData(await res.json());
    } catch {}

    for (const [ref, data] of taskCache.entries()) {
      if (!data.jobId) continue;
      try {
        const res = await _origFetch(
          `${COMO_BASE}/store/${storeId}/task/${encodeURIComponent(data.jobId)}`,
          { credentials: 'include', headers: { 'Accept': 'application/json' } }
        );
        if (res.ok) ingestData(await res.json());
      } catch {}
    }

    await pruneCache(storeId);
    renderPanel();
  }

  // ─── FLOATING PANEL ───────────────────────────────────────────────────────

  const panel = document.createElement('div');
  panel.id = 'cbt-panel';
  panel.innerHTML = `
    <div id="cbt-header">
      <span id="cbt-title">⏱ Batcher Timers</span>
      <div id="cbt-controls">
        <span id="cbt-minimize" title="Minimize">─</span>
        <span id="cbt-close" title="Hide">✕</span>
      </div>
    </div>
    <div id="cbt-tabs">
      <span class="cbt-tab active" data-tab="live">Live</span>
      <span class="cbt-tab" data-tab="history">History</span>
    </div>
    <div id="cbt-body">
      <div id="cbt-live-view">
        <table id="cbt-table">
          <thead>
            <tr>
              <th>Associate</th>
              <th>Elapsed</th>
              <th>Bags/min</th>
            </tr>
          </thead>
          <tbody id="cbt-tbody"></tbody>
        </table>
        <div id="cbt-empty">No active batching tasks</div>
        <div id="cbt-updated"></div>
      </div>
      <div id="cbt-history-view" style="display:none;">
        <table id="cbt-hist-table">
          <thead>
            <tr>
              <th>Associate</th>
              <th>Runs</th>
              <th>Pkgs</th>
              <th>Avg Rate</th>
            </tr>
          </thead>
          <tbody id="cbt-hist-tbody"></tbody>
        </table>
        <div id="cbt-hist-empty">No history yet today</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ─── STYLES ───────────────────────────────────────────────────────────────

  const css = document.createElement('style');
  css.textContent = `
    #cbt-panel {
      position: fixed;
      bottom: auto;
      right: auto;
      width: 380px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      z-index: 99999;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #e6edf3;
      user-select: none;
      min-width: 280px;
      resize: horizontal;
      overflow: hidden;
    }
    #cbt-panel.minimized #cbt-body  { display: none; }
    #cbt-panel.minimized #cbt-tabs  { display: none; }

    #cbt-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 12px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      border-radius: 10px 10px 0 0;
      cursor: move;
    }
    #cbt-title {
      font-weight: 700;
      font-size: 15px;
      color: #58a6ff;
      letter-spacing: 0.05em;
    }
    #cbt-controls { display: flex; gap: 10px; }
    #cbt-controls span {
      color: #8b949e;
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
    }
    #cbt-controls span:hover { color: #e6edf3; }

    /* TABS */
    #cbt-tabs {
      display: flex;
      justify-content: center;
      border-bottom: 1px solid #30363d;
      background: #161b22;
      padding: 0 10px;
    }
    .cbt-tab {
      flex: 1;
      text-align: center;
      padding: 8px 0;
      font-size: 15px;
      font-weight: 600;
      color: #8b949e;
      cursor: pointer;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .cbt-tab:hover { color: #e6edf3; }
    .cbt-tab.active {
      color: #58a6ff;
      border-bottom: 2px solid #58a6ff;
    }

    #cbt-body {
      padding: 8px 10px 10px;
      max-height: 600px;
      overflow-y: auto;
    }

    #cbt-table, #cbt-hist-table {
      width: 100%;
      border-collapse: collapse;
    }
    #cbt-table thead tr,
    #cbt-hist-table thead tr {
      border-bottom: 1px solid #21262d;
    }
#cbt-table th, #cbt-hist-table th {
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      padding: 4px 8px 7px;
      text-align: left;
      background: #0d1117;
    }
    #cbt-table th:not(:first-child),
    #cbt-hist-table th:not(:first-child) { text-align: center; }

    #cbt-table td, #cbt-hist-table td {
      padding: 8px 8px;
      border-bottom: 1px solid #161b22;
      vertical-align: middle;
      text-align: center;
    }
    #cbt-table td:first-child,
    #cbt-hist-table td:first-child {
      text-align: left;
    }
    #cbt-table tbody tr:last-child td,
    #cbt-hist-table tbody tr:last-child td { border-bottom: none; }
    #cbt-table tbody tr:hover td,
    #cbt-hist-table tbody tr:hover td { background: #161b22; }

    /* Associate */
    .cbt-assoc {
      font-size: 18px;
      font-weight: 700;
      color: #e6edf3;
    }
    .cbt-ref {
      display: block;
      font-size: 10px;
      color: #484f58;
      font-family: monospace;
      margin-top: 1px;
    }

    /* Elapsed */
    .cbt-elapsed {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #3fb950;
      text-align: center;
      display: inline;
    }
    .cbt-elapsed.warn  { color: #e3b341; }
    .cbt-elapsed.alert { color: #f85149; }

    /* Rate - live */
    .cbt-rate {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #3fb950;
      text-align: center;
      display: inline;
    }
    .cbt-rate.warn    { color: #e3b341; }
    .cbt-rate.alert   { color: #f85149; }
    .cbt-rate.pending { color: #484f58; font-style: italic; font-size: 13px; }

    /* History cells */
    .cbt-hist-rate {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      display: inline;
    }
    .cbt-hist-rate.good    { color: #3fb950; }
    .cbt-hist-rate.warn    { color: #e3b341; }
    .cbt-hist-rate.alert   { color: #f85149; }

    .cbt-hist-meta {
      font-size: 18px;
      color: #8b949e;
      text-align: center;
      display: inline;
    }

    /* Rank badge */
    .cbt-rank {
      display: inline-block;
      width: 20px;
      height: 20px;
      line-height: 20px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      margin-right: 6px;
      background: #21262d;
      color: #8b949e;
    }
    .cbt-rank.gold   { background: #b8860b; color: #fff; }
    .cbt-rank.silver { background: #555e6a; color: #fff; }
    .cbt-rank.bronze { background: #7d4a1e; color: #fff; }

    #cbt-empty, #cbt-hist-empty {
      display: none;
      text-align: center;
      color: #484f58;
      padding: 14px 0 6px;
      font-style: italic;
      font-size: 13px;
    }
    #cbt-updated {
      text-align: right;
      color: #30363d;
      font-size: 10px;
      margin-top: 6px;
    }
  `;
  document.head.appendChild(css);

  // ─── DRAG ─────────────────────────────────────────────────────────────────

  let dragging = false, dragOffX = 0, dragOffY = 0;
  panel.querySelector('#cbt-header').addEventListener('mousedown', e => {
    if (e.target.closest('#cbt-controls')) return;
    dragging = true;
    dragOffX = e.clientX - panel.getBoundingClientRect().left;
    dragOffY = e.clientY - panel.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dragOffX));
    let y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - dragOffY));
    panel.style.right = panel.style.bottom = 'auto';
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  panel.querySelector('#cbt-minimize').addEventListener('click', () => {
    panel.classList.toggle('minimized');
    panel.querySelector('#cbt-minimize').textContent =
      panel.classList.contains('minimized') ? '□' : '─';
  });
  panel.querySelector('#cbt-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // ─── TAB SWITCHING ────────────────────────────────────────────────────────

  panel.querySelectorAll('.cbt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.cbt-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;

      document.getElementById('cbt-live-view').style.display = activeTab === 'live' ? '' : 'none';
      document.getElementById('cbt-history-view').style.display = activeTab === 'history' ? '' : 'none';

      if (activeTab === 'history') renderHistory();
    });
  });

  // ─── RENDER LIVE ──────────────────────────────────────────────────────────

  function renderPanel() {
    if (activeTab !== 'live') return;

    const tbody = document.querySelector('#cbt-tbody');
    const empty = document.querySelector('#cbt-empty');
    if (!tbody || !empty) return;

    const rows = [...taskCache.values()].filter(d => d.state === 'BATCHING');
    rows.sort((a, b) => (computeRow(b).elapsedSec || 0) - (computeRow(a).elapsedSec || 0));

    if (rows.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    let html = '';
    for (const data of rows) {
      const assoc = data.associateId || data.associate || data.shortClientRef;
      const shortRef = data.shortClientRef;
      const { elapsedSec, scanRate, inProgress, startMs } = computeRow(data);

      const elMin = elapsedSec != null ? elapsedSec / 60 : 0;
      const elCls = elapsedSec != null
        ? (elMin >= ALERT_ELAPSED_MIN ? 'alert' : elMin >= WARN_ELAPSED_MIN ? 'warn' : '') : '';
      const elTxt = elapsedSec != null ? fmt(elapsedSec) : '--:--';

      const rateCls = scanRate != null
        ? (scanRate < ALERT_RATE ? 'alert' : scanRate < WARN_RATE ? 'warn' : '') : 'pending';
      const rateTxt = scanRate != null ? `${scanRate.toFixed(1)}` : '—';

      html += `
        <tr data-ref="${shortRef}">
          <td>
            <span class="cbt-assoc">${assoc}</span>
            <span class="cbt-ref">${shortRef}</span>
          </td>
          <td>
            <span class="cbt-elapsed ${elCls}"
              data-start="${startMs || ''}"
              data-live="${inProgress ? '1' : '0'}">${elTxt}</span>
          </td>
          <td>
            <span class="cbt-rate ${rateCls}">${rateTxt}</span>
          </td>
        </tr>`;
    }

    tbody.innerHTML = html;
    document.querySelector('#cbt-updated').textContent =
      `updated ${new Date().toLocaleTimeString('en-US',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }

  // ─── RENDER HISTORY ───────────────────────────────────────────────────────

  function renderHistory() {
    const tbody = document.querySelector('#cbt-hist-tbody');
    const empty = document.querySelector('#cbt-hist-empty');
    if (!tbody || !empty) return;

    const history = loadHistory();
    const entries = Object.values(history)
      .sort((a, b) => b.avgRate - a.avgRate);

    if (entries.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    let html = '';
    entries.forEach((e, i) => {
      const rateCls = e.avgRate >= WARN_RATE ? 'good'
        : e.avgRate >= ALERT_RATE ? 'warn' : 'alert';

      const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

      html += `
        <tr>
          <td>
            <span class="cbt-assoc">
              <span class="cbt-rank ${rankCls}">${i + 1}</span>${e.assoc}
            </span>
          </td>
          <td style="text-align:center; vertical-align:middle;"><span class="cbt-hist-meta">${e.runs}</span></td>
          <td style="text-align:center; vertical-align:middle;"><span class="cbt-hist-meta">${e.totalPkgs}</span></td>
          <td style="text-align:center; vertical-align:middle;"><span class="cbt-hist-rate ${rateCls}">${e.avgRate.toFixed(1)}</span></td>
        </tr>`;
    });

    tbody.innerHTML = html;
  }

  // ─── LIVE CLOCK ───────────────────────────────────────────────────────────

  function tick() {
    document.querySelectorAll('.cbt-elapsed[data-live="1"]').forEach(el => {
      const startMs = parseFloat(el.dataset.start);
      if (!startMs) return;
      const sec = (Date.now() - startMs) / 1000;
      const min = sec / 60;
      el.className = `cbt-elapsed ${min >= ALERT_ELAPSED_MIN ? 'alert' : min >= WARN_ELAPSED_MIN ? 'warn' : ''}`;
      el.textContent = fmt(sec);
    });
  }

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────

  let scanTimer = null;
  function debouncedPoll() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(pollActiveTasks, 500);
  }

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (panel.contains(m.target) || m.target === panel) return;
    }
    debouncedPoll();
  });
  observer.observe(document.body, { childList: true, subtree: true });

// Restore saved position, or default to top-right under the nav
  const savedPos = JSON.parse(localStorage.getItem('cbt_pos') || 'null');
  if (savedPos) {
    panel.style.left = savedPos.left;
    panel.style.top = savedPos.top;
  } else {
    panel.style.top = '100px';
    panel.style.right = '18px';
  }

  // Save position whenever dragging stops
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    localStorage.setItem('cbt_pos', JSON.stringify({
      left: panel.style.left,
      top:  panel.style.top,
    }));
  });

  setInterval(pollActiveTasks, POLL_MS);
  setInterval(tick, TICK_MS);
  setTimeout(pollActiveTasks, 1500);

  console.log('[COMO Batcher Timer] v3.1.2 loaded ✓');
})();
