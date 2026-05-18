// ==UserScript==
// @name         Vendor Shortage Helper
// @namespace    https://grocerycentral.amazon.dev/
// @version      1.0.0
// @description  Adds a Shortage Review button to the Vendor PO detail page, showing all quantity discrepancies with full case shortages highlighted
// @match        https://grocerycentral.amazon.dev/ihm-vendor-po-dashboard/vendor-pos-detail/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Site code mapping (shared across all pages)
  // ---------------------------------------------------------------------------

  const SITE_CODE_MAP = {
    'UAZ1': 'US-AZ-19', 'UCA4': 'US-CA-175', 'UCA5': 'US-CA-173',
    'UCO1': 'US-CO-33', 'UFL4': 'US-FL-51', 'UFL5': 'US-FL-52',
    'UFL6': 'US-FL-53', 'UGA2': 'US-GA-21', 'UGA4': 'US-GA-22',
    'UIL1': 'US-IL-72', 'UIL2': 'US-IL-71', 'UIN1': 'US-IN-7',
    'ULA6': 'US-CA-142', 'UMA4': 'US-MA-45', 'UMD1': 'US-MD-17',
    'UMN1': 'US-MN-11', 'UNC2': 'US-NC-24', 'UNC3': 'US-NC-23',
    'UNJ1': 'US-NJ-40', 'UNJ2': 'US-NJ-48', 'UNV3': 'US-NV-10',
    'UNY2': 'US-NY-72', 'UNY4': 'US-NY-61', 'UNY5': 'US-NY-73',
    'UOH4': 'US-OH-15', 'UOH5': 'US-OH-14', 'UOR2': 'US-OR-11',
    'UPA1': 'US-PA-23', 'USC1': 'US-CA-172', 'USD1': 'US-CA-169',
    'USF1': 'US-CA-170', 'USF2': 'US-CA-171', 'USF4': 'US-CA-178',
    'UTN1': 'US-TN-12', 'UTX3': 'US-TX-58', 'UTX4': 'US-TX-60',
    'UTX7': 'US-TX-61', 'UTX8': 'US-TX-57', 'UTX9': 'US-TX-59',
    'UVA1': 'US-VA-26', 'UVA4': 'US-VA-25', 'UVA5': 'US-VA-24',
    'UWA1': 'US-WA-29', 'UWA2': 'US-WA-931', 'UWA6': 'US-WA-932',
    'UWI2': 'US-WI-6', 'JFK2': 'US-NY-63'
  };

  // ---------------------------------------------------------------------------
  // Site code detection
  // ---------------------------------------------------------------------------

  function getCurrentStoreId() {
    try {
      // Use getCurrentFCCode() for consistent detection, then map to store ID
      const fcCode = getCurrentFCCode();
      if (fcCode && SITE_CODE_MAP[fcCode]) return SITE_CODE_MAP[fcCode];
    } catch (e) {}
    return 'US-NC-24';
  }

  // ---------------------------------------------------------------------------
  // Hardcoded Slack webhook URLs per FC (fallback to GM_getValue if not listed)
  // ---------------------------------------------------------------------------

  const SLACK_WEBHOOK_MAP = {
    'UNC2': 'https://hooks.slack.com/triggers/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',
    'UNY4': 'https://hooks.slack.com/triggers/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',
    'UGA2': 'https://hooks.slack.com/triggers/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',
    'UNC3': 'https://hooks.slack.com/triggers/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',
    'UGA4': 'https://hooks.slack.com/triggers/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',
    'UVA1': 'https://hooks.slack.com/triggers/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'
  };

  // ---------------------------------------------------------------------------
  // FC code detection (raw key, e.g., "UNC2")
  // Uses targeted detection to avoid false matches from unrelated page text.
  // Priority: 1) "Houdini FC: XXXX" element, 2) localStorage ACTIVE_SITE,
  //           3) Transship ID pattern, 4) Broad page scan (last resort)
  // ---------------------------------------------------------------------------

  function getCurrentFCCode() {
    try {
      const siteKeys = Object.keys(SITE_CODE_MAP);

      // Strategy 1: Look for "Houdini FC: XXXX" text in a targeted element (top-right corner)
      // This is the most reliable source — it's the explicit FC indicator on the page
      const allElements = document.querySelectorAll('span, div, a, button, label, p');
      for (const el of allElements) {
        const text = el.textContent.trim();
        const houdiniMatch = text.match(/Houdini\s+FC[:\s]+([A-Z0-9]{3,6})/i);
        if (houdiniMatch && houdiniMatch[1]) {
          const candidate = houdiniMatch[1].toUpperCase();
          if (SITE_CODE_MAP[candidate]) return candidate;
        }
      }

      // Strategy 2: Check localStorage ACTIVE_SITE (set by user's session/store selection)
      const activeSiteData = localStorage.getItem('ACTIVE_SITE');
      if (activeSiteData) {
        const parsed = JSON.parse(activeSiteData);
        const fcId = parsed.fcId || parsed.storeAcronym || '';
        if (fcId && SITE_CODE_MAP[fcId]) return fcId;
      }

      // Strategy 3: Extract FC from Transship ID pattern (e.g., "HSE1_UNY4_141d...")
      const transshipHeader = document.querySelector('h1, h2, h3, [class*="title"], [class*="header"]');
      if (transshipHeader) {
        const headerText = transshipHeader.textContent.trim();
        const transshipMatch = headerText.match(/[A-Z]+\d*_([A-Z]{2,4}\d{1,2})_/i);
        if (transshipMatch && transshipMatch[1]) {
          const candidate = transshipMatch[1].toUpperCase();
          if (SITE_CODE_MAP[candidate]) return candidate;
        }
      }

      // Strategy 4 (last resort): Scan page text but require the FC code to appear
      // in a meaningful context (near "FC", "Site", or "Store" keywords) to avoid
      // false positives from random text matches
      const pageText = document.body ? document.body.innerText : '';
      for (const key of siteKeys) {
        // Look for the FC code near contextual keywords to reduce false matches
        const contextPattern = new RegExp('(?:FC|Site|Store|Warehouse)[:\\s]*' + key + '\\b', 'i');
        if (contextPattern.test(pageText)) return key;
      }

      // Strategy 5: Absolute fallback — plain text match (original behavior)
      // Only used if none of the above strategies found anything
      for (const key of siteKeys) {
        if (pageText.includes(key)) return key;
      }
    } catch (e) {
      console.warn('[IHM Vendor Shortage] Error detecting FC code:', e);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Reconciler username detection
  // ---------------------------------------------------------------------------

  function getReconcilerUsername() {
    try {
      // Strategy 1: Look for common user identity selectors
      const selectors = [
        '[data-testid*="user"]', '[class*="user-name"]', '[class*="username"]',
        '[class*="user-info"]', '[class*="profile"]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length <= 64 && /^[a-z0-9._-]+$/i.test(text)) {
            return text.substring(0, 64);
          }
        }
      }
      // Strategy 2: Look for short alphanumeric text in the header/nav area (top-right)
      const headerEls = document.querySelectorAll('header, nav, [class*="header"], [class*="nav"], [class*="top-bar"]');
      for (const header of headerEls) {
        const spans = header.querySelectorAll('span, div, a, button');
        for (const span of spans) {
          const text = span.textContent.trim();
          if (/^[a-z]{3,8}$/i.test(text) && span.children.length === 0) {
            return text.substring(0, 64);
          }
        }
      }
      // Strategy 3: Look for any element with text matching Amazon login pattern near top of page
      const allEls = document.querySelectorAll('span, div, a');
      for (const el of allEls) {
        if (el.getBoundingClientRect().top > 100) continue; // only check top area
        const text = el.textContent.trim();
        if (/^[a-z]{3,8}$/i.test(text) && el.children.length === 0) {
          return text.substring(0, 64);
        }
      }
    } catch (e) {
      console.warn('[IHM Vendor Shortage] Error detecting username:', e);
    }
    return 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // PO / Transship ID extraction
  // ---------------------------------------------------------------------------

  function getPOorTransshipId() {
    try {
      // Strategy 1: Extract from URL path
      const urlMatch = window.location.pathname.match(/\/vendor-pos-detail\/([^/]+)/);
      if (urlMatch && urlMatch[1]) return urlMatch[1];
      // Strategy 2: Scrape from page header (e.g., "PO: 1CGE2P8T")
      const allEls = document.querySelectorAll('h1, h2, h3, strong, [class*="title"], [class*="header"]');
      for (const el of allEls) {
        const text = el.textContent.trim();
        const poMatch = text.match(/PO:\s*([A-Z0-9]+)/i);
        if (poMatch && poMatch[1]) return poMatch[1];
      }
    } catch (e) {
      console.warn('[IHM Vendor Shortage] Error extracting PO ID:', e);
    }
    return 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // Generate Receive v3 Stow URL for a given ASIN
  // ---------------------------------------------------------------------------

  function generateReceiveStowUrl(asin) {
    const storeId = getCurrentStoreId();
    const base = 'https://ui.us-west-2.prod.associatetools.ihm.amazon.dev/remote/ihm-associate-tools-base/index.html';
    return `${base}?auth=midway&domain=prod&region=iad&storeId=${storeId}&shortage-receive-asin=${encodeURIComponent(asin)}#/home`;
  }

  // ---------------------------------------------------------------------------
  // URL routing
  // ---------------------------------------------------------------------------

  const url = window.location.href;

  if (url.includes('/ihm-vendor-po-dashboard/vendor-pos-detail/')) {
    runVendorPOPage();
  }

  // ---------------------------------------------------------------------------
  // Button injection — poll for Reconcile PO button
  // ---------------------------------------------------------------------------

  /**
   * Polls the DOM for the Reconcile PO button, then calls the callback with it.
   * @param {Function} callback - Called with the found Reconcile PO button element
   */
  function waitForReconcilePOButton(callback) {
    // Duplicate prevention: if our button already exists, stop immediately
    if (document.getElementById('ihm-vendor-shortage-review-btn')) return;

    function find() {
      // Search buttons, anchors, and role="button" elements for "Reconcile PO" text
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        const t = el.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
        if (t.includes('reconcile po')) return el;
      }
      return null;
    }

    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(function () {
      attempts++;

      // Re-check duplicate prevention each poll cycle
      if (document.getElementById('ihm-vendor-shortage-review-btn')) {
        clearInterval(interval);
        return;
      }

      const btn = find();
      if (btn) {
        clearInterval(interval);
        console.log('[IHM Vendor Shortage] Found Reconcile PO button:', btn.textContent.trim());
        callback(btn);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[IHM Vendor Shortage] Reconcile PO button not found after 30 seconds. Stopping.');
      }
    }, 500);
  }

  // ===========================================================================
  // VENDOR PO PAGE — Shortage Review button + panel
  // ===========================================================================

  function runVendorPOPage() {
    console.log('[IHM Vendor Shortage] Vendor PO page detected, initializing...');

    // -------------------------------------------------------------------------
    // CSS
    // -------------------------------------------------------------------------

    GM_addStyle(`
      #ihm-vendor-shortage-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(0,0,0,0.5);
      }
      #ihm-vendor-shortage-panel {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%,-50%);
        min-width: 680px; max-width: 92vw; max-height: 82vh;
        overflow-y: auto; background: #fff; border-radius: 8px;
        padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .ihm-vendor-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;
      }
      .ihm-vendor-panel-header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #111; }
      .ihm-vendor-close-btn {
        background: none; border: none; font-size: 22px;
        cursor: pointer; color: #555; line-height: 1; padding: 0 4px;
      }
      .ihm-vendor-close-btn:hover { color: #000; }
      .ihm-vendor-panel-body { margin-top: 8px; }
      .ihm-vendor-shortage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .ihm-vendor-shortage-table th, .ihm-vendor-shortage-table td {
        padding: 8px 12px; text-align: left;
        border-bottom: 1px solid #e8e8e8; vertical-align: top;
      }
      .ihm-vendor-shortage-table th {
        background: #f5f5f5; font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.04em; color: #444;
      }
      .ihm-vendor-shortage-table tr:hover td { background: #fafafa; }
      .ihm-vendor-asin { font-family: monospace; font-size: 12px; }
      .ihm-vendor-title {
        max-width: 260px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; color: #333;
      }
      .ihm-vendor-qty-short { color: #c00; font-weight: 600; }
      .ihm-vendor-empty-msg { padding: 32px 0; text-align: center; color: #555; font-size: 14px; }
      .ihm-vendor-summary { font-size: 12px; color: #666; margin-bottom: 12px; }
      .ihm-vendor-full-case-row { background: #ffebee !important; font-weight: 700; color: #000; }
      .ihm-vendor-full-case-row td { background: #ffebee !important; font-weight: 700; color: #000; }
      .ihm-vendor-audit-link { color: #0073bb; text-decoration: none; font-size: 12px; white-space: nowrap; }
      .ihm-vendor-audit-link:hover { text-decoration: underline; }
      .ihm-shortage-review-btn {
        background: #fff; border: 1px solid #0073bb; color: #0073bb;
        padding: 6px 14px; border-radius: 4px; cursor: pointer;
        font-size: 13px; font-weight: 500; margin-left: 8px;
      }
      .ihm-shortage-review-btn:hover { background: #e8f4fb; }
      .ihm-vendor-audit-link { color: #0073bb; text-decoration: none; font-size: 12px; white-space: nowrap; }
      .ihm-vendor-audit-link:hover { text-decoration: underline; }
      @keyframes ihm-spin {
        0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }
      }
      .ihm-vendor-spinner {
        display: inline-block; width: 20px; height: 20px;
        border: 3px solid #e0e0e0; border-top-color: #0073bb;
        border-radius: 50%; animation: ihm-spin 0.8s linear infinite;
        margin-right: 10px; vertical-align: middle;
      }
      .ihm-vendor-loading {
        display: flex; align-items: center; justify-content: center;
        padding: 40px 0; font-size: 14px; color: #555;
      }
      .ihm-slack-section {
        margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0e0e0;
      }
      .ihm-slack-field { margin-bottom: 10px; font-size: 13px; }
      .ihm-slack-field label { font-weight: 600; color: #444; display: block; margin-bottom: 4px; }
      .ihm-slack-field .ihm-slack-value { color: #111; font-family: monospace; font-size: 12px; }
      .ihm-slack-notes {
        width: 100%; min-height: 60px; max-height: 120px; resize: vertical;
        border: 1px solid #ccc; border-radius: 4px; padding: 8px;
        font-size: 13px; font-family: inherit;
      }
      .ihm-slack-notes:focus { border-color: #0073bb; outline: none; }
      .ihm-slack-char-count { font-size: 11px; color: #888; text-align: right; margin-top: 2px; }
      .ihm-slack-send-btn {
        background: #1264a3; color: #fff; border: none; padding: 8px 18px;
        border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;
        margin-top: 12px;
      }
      .ihm-slack-send-btn:hover { background: #0d4f82; }
      .ihm-slack-send-btn:disabled { background: #999; cursor: not-allowed; }
      .ihm-slack-status { margin-top: 8px; font-size: 12px; }
      .ihm-slack-status.success { color: #2e7d32; }
      .ihm-slack-status.error { color: #c00; }
      .ihm-slack-webhook-section { margin-top: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; border: 1px solid #e0e0e0; }
      .ihm-slack-webhook-input {
        width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px;
        font-size: 12px; font-family: monospace; margin-top: 4px;
      }
      .ihm-slack-webhook-save {
        background: #0073bb; color: #fff; border: none; padding: 6px 12px;
        border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px;
      }
      .ihm-slack-webhook-save:hover { background: #005a8c; }
    `);

    // -------------------------------------------------------------------------
    // Panel
    // -------------------------------------------------------------------------

    function createPanel() {
      let overlay = null, prevFocus = null;

      function onKeyDown(e) { if (e.key === 'Escape') hide(); }

      function trapFocus(e) {
        if (!overlay || e.key !== 'Tab') return;
        const focusable = Array.from(overlay.querySelectorAll('button,a[href],[tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }

      function buildSkeleton() {
        const ov = document.createElement('div');
        ov.id = 'ihm-vendor-shortage-overlay';
        const panel = document.createElement('div');
        panel.id = 'ihm-vendor-shortage-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'ihm-vendor-panel-title');
        const header = document.createElement('div');
        header.className = 'ihm-vendor-panel-header';
        const title = document.createElement('h2');
        title.id = 'ihm-vendor-panel-title';
        title.textContent = 'Vendor PO Shortage Review';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ihm-vendor-close-btn';
        closeBtn.setAttribute('aria-label', 'Close shortage review panel');
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', hide);
        header.appendChild(title);
        header.appendChild(closeBtn);
        const body = document.createElement('div');
        body.className = 'ihm-vendor-panel-body';
        panel.appendChild(header);
        panel.appendChild(body);
        ov.appendChild(panel);
        // Overlay click-to-dismiss: only if clicking the overlay itself, not the panel
        ov.addEventListener('click', function (e) {
          if (e.target === ov) hide();
        });
        return ov;
      }

      function show() {
        if (overlay) return;
        prevFocus = document.activeElement;
        overlay = buildSkeleton();
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keydown', trapFocus);
        // Move focus to close button within 100ms
        setTimeout(function () {
          if (overlay) {
            const closeBtn = overlay.querySelector('.ihm-vendor-close-btn');
            if (closeBtn) closeBtn.focus();
          }
        }, 0);
      }

      function hide() {
        if (!overlay) return;
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keydown', trapFocus);
        overlay.remove();
        overlay = null;
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        prevFocus = null;
      }

      function renderLoading() {
        if (!overlay) return;
        const body = overlay.querySelector('.ihm-vendor-panel-body');
        body.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'ihm-vendor-loading';
        const spinner = document.createElement('div');
        spinner.className = 'ihm-vendor-spinner';
        spinner.setAttribute('role', 'status');
        const label = document.createElement('span');
        label.textContent = 'Scanning PO table for discrepancies\u2026';
        wrapper.appendChild(spinner);
        wrapper.appendChild(label);
        body.appendChild(wrapper);
      }

      function renderError(message) {
        if (!overlay) return;
        const body = overlay.querySelector('.ihm-vendor-panel-body');
        body.innerHTML = '';
        const msg = document.createElement('p');
        msg.style.cssText = 'color:#c00;font-size:14px;padding:24px 0;text-align:center;';
        msg.textContent = message || 'An error occurred while loading shortage data.';
        body.appendChild(msg);
      }

      function render(shortages) {
        if (!overlay) return;
        const body = overlay.querySelector('.ihm-vendor-panel-body');
        body.innerHTML = '';

        // Empty state
        if (shortages.length === 0) {
          const msg = document.createElement('p');
          msg.className = 'ihm-vendor-empty-msg';
          msg.textContent = 'No discrepancies found for this PO.';
          body.appendChild(msg);
        } else {
          // Summary line
          const summary = document.createElement('p');
          summary.className = 'ihm-vendor-summary';
          summary.textContent = `${shortages.length} item(s) with quantity discrepancies. Click "Open Audit \u2192" to load stow locations.`;
          body.appendChild(summary);

          // Table
          const table = document.createElement('table');
          table.className = 'ihm-vendor-shortage-table';

          // Table header
          const thead = document.createElement('thead');
          const hRow = document.createElement('tr');
          ['ASIN', 'Product Name', 'Expected PO Qty', 'Total Received Qty', 'Shortage Qty', 'Stow Location', 'Audit Dashboard', 'Receive'].forEach(function (text) {
            const th = document.createElement('th');
            th.textContent = text;
            hRow.appendChild(th);
          });
          thead.appendChild(hRow);
          table.appendChild(thead);

          // Table body — sort: partial shortages first, full case shortages underneath
          const sortedShortages = shortages.slice().sort(function (a, b) {
            if (a.isFullCaseShortage === b.isFullCaseShortage) return 0;
            return a.isFullCaseShortage ? 1 : -1;
          });
          const tbody = document.createElement('tbody');
          sortedShortages.forEach(function (item) {
            const tr = document.createElement('tr');

            // Apply full case shortage highlighting
            if (item.isFullCaseShortage === true) {
              tr.className = 'ihm-vendor-full-case-row';
            }

            // ASIN cell
            const tdAsin = document.createElement('td');
            tdAsin.className = 'ihm-vendor-asin';
            tdAsin.textContent = item.asin;
            tr.appendChild(tdAsin);

            // Product Name cell
            const tdName = document.createElement('td');
            tdName.className = 'ihm-vendor-title';
            tdName.textContent = item.productName || '\u2014';
            tdName.title = item.productName || '';
            tr.appendChild(tdName);

            // Expected PO Qty cell
            const tdExpected = document.createElement('td');
            tdExpected.style.cssText = 'color:#000;font-weight:500';
            tdExpected.textContent = item.expectedQty;
            tr.appendChild(tdExpected);

            // Total Received Qty cell
            const tdReceived = document.createElement('td');
            if (item.receivedQty === 0) {
              tdReceived.style.cssText = 'color:#b71c1c;font-weight:700';
            } else {
              tdReceived.style.cssText = 'color:#1b5e20;font-weight:700';
            }
            tdReceived.textContent = item.receivedQty;
            tr.appendChild(tdReceived);

            // Shortage Qty cell
            const tdShortage = document.createElement('td');
            tdShortage.className = 'ihm-vendor-qty-short';
            tdShortage.textContent = item.shortageQty;
            tr.appendChild(tdShortage);

            // Stow Location — populated from localStorage when audit tab returns data
            const tdStow = document.createElement('td');
            tdStow.id = 'ihm-vendor-stow-' + item.asin;
            tdStow.style.cssText = 'font-size:12px;color:#555';

            var storedData = localStorage.getItem('ihm_stow_' + item.asin);
            if (storedData) {
              try {
                var data = JSON.parse(storedData);
                if (data.stowLocations && data.stowLocations.length > 0) {
                  tdStow.innerHTML = data.stowLocations
                    .map(function (s) { return '<div style="white-space:nowrap"><strong>' + s.location + '</strong> &times; ' + s.quantity + '</div>'; })
                    .join('');
                  tdStow.style.color = '#2e7d32';
                } else {
                  tdStow.textContent = 'No stow found';
                }
              } catch (_) {
                tdStow.textContent = '\u2014';
              }
            } else {
              tdStow.textContent = 'Open Audit to load';
              tdStow.style.color = '#999';
            }
            tr.appendChild(tdStow);

            // Audit Dashboard link
            const tdLink = document.createElement('td');
            var auditUrl = 'https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page#asin=' + encodeURIComponent(item.asin);
            const link = document.createElement('a');
            link.href = auditUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'ihm-vendor-audit-link';
            link.textContent = 'Open Audit \u2192';
            tdLink.appendChild(link);
            tr.appendChild(tdLink);

            // Receive column — link to Associate Tools Receive v3 Stow
            const tdReceiveCol = document.createElement('td');
            const receiveLink = document.createElement('a');
            receiveLink.href = generateReceiveStowUrl(item.asin);
            receiveLink.target = '_blank';
            receiveLink.rel = 'noopener noreferrer';
            receiveLink.className = 'ihm-vendor-audit-link';
            receiveLink.style.color = '#0d9488';
            receiveLink.textContent = 'Receive \u2192';
            tdReceiveCol.appendChild(receiveLink);
            tr.appendChild(tdReceiveCol);

            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          body.appendChild(table);

          // Listen for localStorage changes from the audit tab and update stow cells live
          window.addEventListener('storage', function (e) {
            if (e.key && e.key.startsWith('ihm_stow_')) {
              var asinKey = e.key.replace('ihm_stow_', '');
              var cell = document.getElementById('ihm-vendor-stow-' + asinKey);
              if (cell && e.newValue) {
                try {
                  var stowData = JSON.parse(e.newValue);
                  if (stowData.stowLocations && stowData.stowLocations.length > 0) {
                    cell.innerHTML = stowData.stowLocations
                      .map(function (s) { return '<div style="white-space:nowrap"><strong>' + s.location + '</strong> &times; ' + s.quantity + '</div>'; })
                      .join('');
                    cell.style.color = '#2e7d32';
                  }
                } catch (_) {}
              }
            }
          });
        }

        // --- Price Impact Section ---
        const priceSection = document.createElement('div');
        priceSection.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0';

        const priceBtn = document.createElement('button');
        priceBtn.style.cssText = 'background:#f57c00;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600';
        priceBtn.textContent = 'Fetch Prices & Calculate $ Impact';
        const priceStatus = document.createElement('div');
        priceStatus.style.cssText = 'margin-top:8px;font-size:12px;color:#555';

        priceBtn.addEventListener('click', async function () {
          priceBtn.disabled = true;
          priceBtn.style.background = '#999';
          priceBtn.textContent = 'Fetching prices...';
          priceStatus.textContent = 'Fetching prices from Amazon (1 per second)...';

          const uniqueAsins = [...new Set(shortages.map(function (s) { return s.asin; }))];
          const prices = await fetchPricesThrottled(uniqueAsins, 1200);

          let totalImpact = 0;
          let foundCount = 0;
          shortages.forEach(function (item) {
            const price = prices[item.asin];
            if (price) {
              foundCount++;
              totalImpact += price * item.shortageQty;
            }
          });

          priceBtn.style.display = 'none';
          if (foundCount > 0) {
            priceStatus.innerHTML = '<strong style="color:#b71c1c;font-size:14px">Total $ Impact: $' + totalImpact.toFixed(2) + '</strong><br><span style="font-size:11px;color:#666">(' + foundCount + '/' + uniqueAsins.length + ' ASINs priced at retail)</span>';
          } else {
            priceStatus.textContent = 'Could not fetch prices. Amazon may be blocking requests.';
            priceStatus.style.color = '#c00';
          }

          // Store for Slack message
          priceSection.dataset.totalImpact = totalImpact.toFixed(2);
          priceSection.dataset.foundCount = foundCount;
          priceSection.dataset.totalAsins = uniqueAsins.length;
        });

        priceSection.appendChild(priceBtn);
        priceSection.appendChild(priceStatus);
        if (shortages.length > 0) {
          body.appendChild(priceSection);
        }

        // --- Slack Reporter Section ---
        const slackSection = document.createElement('div');
        slackSection.className = 'ihm-slack-section';

        // FC Code display
        const fcField = document.createElement('div');
        fcField.className = 'ihm-slack-field';
        const fcLabel = document.createElement('label');
        fcLabel.textContent = 'FC:';
        const fcValue = document.createElement('span');
        fcValue.className = 'ihm-slack-value';
        const detectedFC = getCurrentFCCode();
        fcValue.textContent = detectedFC || 'Not detected';
        fcField.appendChild(fcLabel);
        fcField.appendChild(fcValue);
        slackSection.appendChild(fcField);

        // Reconciler Username display
        const userField = document.createElement('div');
        userField.className = 'ihm-slack-field';
        const userLabel = document.createElement('label');
        userLabel.textContent = 'Reconciler:';
        const userValue = document.createElement('span');
        userValue.className = 'ihm-slack-value';
        userValue.textContent = getReconcilerUsername();
        userField.appendChild(userLabel);
        userField.appendChild(userValue);
        slackSection.appendChild(userField);

        // Notes textarea
        const notesField = document.createElement('div');
        notesField.className = 'ihm-slack-field';
        const notesLabel = document.createElement('label');
        notesLabel.textContent = 'Notes:';
        const notesInput = document.createElement('textarea');
        notesInput.className = 'ihm-slack-notes';
        notesInput.maxLength = 1000;
        notesInput.placeholder = 'Add any notes about this reconciliation...';
        const charCount = document.createElement('div');
        charCount.className = 'ihm-slack-char-count';
        charCount.textContent = '0 / 1000';
        notesInput.addEventListener('input', function () {
          charCount.textContent = notesInput.value.length + ' / 1000';
        });
        notesField.appendChild(notesLabel);
        notesField.appendChild(notesInput);
        notesField.appendChild(charCount);
        slackSection.appendChild(notesField);

        // Send to Slack button
        const sendBtn = document.createElement('button');
        sendBtn.className = 'ihm-slack-send-btn';
        sendBtn.textContent = 'Send to Slack';
        sendBtn.setAttribute('aria-label', 'Send to Slack');
        slackSection.appendChild(sendBtn);

        // Webhook configuration
        const webhookKey = detectedFC ? 'slack_webhook_' + detectedFC : null;
        const existingWebhook = (detectedFC && SLACK_WEBHOOK_MAP[detectedFC]) || (webhookKey ? GM_getValue(webhookKey, '') : '');

        const webhookSection = document.createElement('div');
        webhookSection.className = 'ihm-slack-webhook-section';
        const webhookLabel = document.createElement('label');
        webhookLabel.style.cssText = 'font-size:12px;font-weight:600;color:#444;display:block';
        webhookLabel.textContent = existingWebhook ? 'Update Webhook URL for ' + detectedFC + ':' : 'Configure Webhook URL for ' + (detectedFC || 'this FC') + ':';
        const webhookInput = document.createElement('input');
        webhookInput.className = 'ihm-slack-webhook-input';
        webhookInput.type = 'text';
        webhookInput.placeholder = 'https://hooks.slack.com/services/... or /triggers/...';
        webhookInput.value = existingWebhook;
        const webhookSaveBtn = document.createElement('button');
        webhookSaveBtn.className = 'ihm-slack-webhook-save';
        webhookSaveBtn.textContent = existingWebhook ? 'Update Webhook' : 'Save Webhook';
        const webhookStatus = document.createElement('div');
        webhookStatus.style.cssText = 'font-size:11px;margin-top:4px';

        webhookSaveBtn.addEventListener('click', function () {
          const url = webhookInput.value.trim();
          if (!validateWebhookUrl(url)) {
            webhookStatus.style.color = '#c00';
            webhookStatus.textContent = 'Invalid URL. Must match: https://hooks.slack.com/services/... or /triggers/...';
            return;
          }
          if (webhookKey) {
            GM_setValue(webhookKey, url);
            webhookStatus.style.color = '#2e7d32';
            webhookStatus.textContent = 'Webhook saved for ' + detectedFC + '!';
            webhookSaveBtn.textContent = 'Update Webhook';
            webhookLabel.textContent = 'Update Webhook URL for ' + detectedFC + ':';
          }
        });

        webhookSection.appendChild(webhookLabel);
        webhookSection.appendChild(webhookInput);
        webhookSection.appendChild(webhookSaveBtn);
        webhookSection.appendChild(webhookStatus);

        // Status area
        const statusArea = document.createElement('div');
        statusArea.className = 'ihm-slack-status';
        slackSection.appendChild(statusArea);

        // Only show webhook config if FC is detected
        if (detectedFC) {
          slackSection.insertBefore(webhookSection, statusArea);
        }

        body.appendChild(slackSection);

        // Disable send if FC not detected or PO ID not found
        const poId = getPOorTransshipId();
        if (!detectedFC) {
          sendBtn.disabled = true;
          statusArea.textContent = 'Cannot send: FC not detected from page.';
          statusArea.className = 'ihm-slack-status error';
        }
        if (poId === 'Unknown') {
          // Still allow sending but note it
          console.warn('[IHM Vendor Shortage] PO ID could not be determined');
        }

        sendBtn.addEventListener('click', async function () {
          // Clear previous status
          statusArea.textContent = '';
          statusArea.className = 'ihm-slack-status';

          // Get webhook URL — check user override first, then hardcoded map
          const webhookUrl = GM_getValue('slack_webhook_' + detectedFC, '') || SLACK_WEBHOOK_MAP[detectedFC] || '';
          if (!webhookUrl || !validateWebhookUrl(webhookUrl)) {
            statusArea.textContent = 'No webhook configured for ' + detectedFC + '. Please configure one below.';
            statusArea.className = 'ihm-slack-status error';
            return;
          }

          // Disable button and show loading
          sendBtn.disabled = true;
          sendBtn.textContent = 'Sending...';

          // Calculate CFR from ALL line items (not just shortages)
          const allRows = scrapeVendorPOTable();
          const cfr = calculateCFR(allRows);
          const motivationalMessage = getMotivationalMessage(cfr);

          // Calculate raw CFR numbers
          let totalExpected = 0;
          let totalReceived = 0;
          for (const row of allRows) {
            if (row.expectedQty !== null && row.expectedQty !== undefined &&
                row.receivedQty !== null && row.receivedQty !== undefined) {
              totalExpected += row.expectedQty;
              totalReceived += row.receivedQty;
            }
          }

          // Build shortages text — only partial case shortages (received > 0 but < expected)
          const partialShortages = shortages.filter(function (item) { return !item.isFullCaseShortage; });
          const hasAnyShortages = shortages.length > 0;
          let shortagesText = 'None';
          if (partialShortages.length > 0) {
            const maxItems = 50;
            const displayItems = partialShortages.slice(0, maxItems);
            const lines = displayItems.map(function (item) {
              const desc = (item.productName || 'Unknown').substring(0, 25);
              return '\u25b8 ' + item.asin + ' \u2014 ' + desc + ' | Exp: ' + item.expectedQty + ' | Rcv: ' + item.receivedQty + ' | Short: ' + item.shortageQty;
            });
            if (partialShortages.length > maxItems) {
              lines.push('... and ' + (partialShortages.length - maxItems) + ' more items');
            }
            shortagesText = lines.join('\n');
          } else if (hasAnyShortages) {
            shortagesText = 'No partial shortages (full case only)';
          }

          // Send individual fields to match workflow variables
          const slackData = {
            report_type: 'PO Reconciliation Report',
            shipment_id: poId,
            fc_code: detectedFC,
            reconciler: getReconcilerUsername(),
            cfr: cfr === 'N/A' ? 'N/A' : totalReceived + ' received / ' + totalExpected + ' expected (' + cfr + '%)',
            cfr_message: motivationalMessage || '',
            shortages: shortagesText,
            notes: (function () {
              let n = '';
              if (priceSection.dataset.totalImpact && parseFloat(priceSection.dataset.totalImpact) > 0) {
                n += '\uD83D\uDEA8 *$' + priceSection.dataset.totalImpact + ' estimated impact*\n';
              }
              n += notesInput.value.trim() || 'None';
              return n;
            })()
          };

          const result = await sendToSlack(webhookUrl, slackData);

          if (result.success) {
            sendBtn.style.display = 'none';
            statusArea.textContent = '\u2713 Sent to Slack successfully!';
            statusArea.className = 'ihm-slack-status success';
          } else {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to Slack';
            statusArea.textContent = 'Error: ' + (result.error || 'Unknown error');
            statusArea.className = 'ihm-slack-status error';
          }
        });
      }

      return { show, hide, render, renderLoading, renderError };
    }

    // -------------------------------------------------------------------------
    // Scrape Vendor PO table for row data
    // -------------------------------------------------------------------------

    /**
     * Scrapes the Vendor PO table and returns raw row data.
     * Dynamically identifies columns by header text matching.
     * @returns {Array<{asin: string, productName: string, expectedQty: number|null, receivedQty: number|null}>}
     */
    function scrapeVendorPOTable() {
      const asinPattern = /^[A-Z0-9]{10}$/i;
      const rows = [];

      // Find column indices by scanning header cells
      let asinColIdx = -1;
      let productNameColIdx = -1;
      let expectedQtyColIdx = -1;
      let receivedQtyColIdx = -1;
      let targetTable = null;

      // Strategy 1: Look for <table> elements with recognizable headers
      const allTables = document.querySelectorAll('table');
      for (const table of allTables) {
        const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
        if (headerCells.length === 0) continue;

        for (let i = 0; i < headerCells.length; i++) {
          const text = headerCells[i].textContent.replace(/\s+/g, ' ').trim().toLowerCase();
          if (text === 'asin') {
            asinColIdx = i;
          } else if (text.includes('product name') || text === 'product') {
            productNameColIdx = i;
          } else if (text.includes('expected')) {
            expectedQtyColIdx = i;
          } else if (text.includes('total received')) {
            receivedQtyColIdx = i;
          }
        }

        if (asinColIdx >= 0 && expectedQtyColIdx >= 0 && receivedQtyColIdx >= 0) {
          targetTable = table;
          break;
        }

        // Reset if this table didn't have the right headers
        asinColIdx = -1;
        productNameColIdx = -1;
        expectedQtyColIdx = -1;
        receivedQtyColIdx = -1;
      }

      // Strategy 2: Fallback — scan all <tr> elements for a header row
      if (!targetTable) {
        const allRows = document.querySelectorAll('tr');
        for (const row of allRows) {
          const cells = row.querySelectorAll('th, td');
          if (cells.length < 3) continue;

          for (let i = 0; i < cells.length; i++) {
            const text = cells[i].textContent.replace(/\s+/g, ' ').trim().toLowerCase();
            if (text === 'asin') {
              asinColIdx = i;
            } else if (text.includes('product name') || text === 'product') {
              productNameColIdx = i;
            } else if (text.includes('expected')) {
              expectedQtyColIdx = i;
            } else if (text.includes('total received')) {
              receivedQtyColIdx = i;
            }
          }

          if (asinColIdx >= 0 && expectedQtyColIdx >= 0 && receivedQtyColIdx >= 0) {
            targetTable = row.closest('table') || document;
            break;
          }

          // Reset for next row
          asinColIdx = -1;
          productNameColIdx = -1;
          expectedQtyColIdx = -1;
          receivedQtyColIdx = -1;
        }
      }

      if (asinColIdx < 0 || expectedQtyColIdx < 0 || receivedQtyColIdx < 0) {
        console.warn('[IHM Vendor Shortage] Could not identify required columns in PO table');
        return rows;
      }

      console.log(`[IHM Vendor Shortage] Column indices — ASIN: ${asinColIdx}, Product Name: ${productNameColIdx}, Expected Qty: ${expectedQtyColIdx}, Total Received Qty: ${receivedQtyColIdx}`);

      // Scrape data rows
      const dataRows = targetTable.querySelectorAll('tr');
      for (const row of dataRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue; // skip header rows (th only)

        // Validate ASIN cell
        if (asinColIdx >= cells.length) continue;
        const asinText = cells[asinColIdx].textContent.trim().replace(/\s+/g, '');
        if (!asinPattern.test(asinText)) continue;

        // Get product name
        const productName = (productNameColIdx >= 0 && productNameColIdx < cells.length)
          ? cells[productNameColIdx].textContent.trim()
          : '';

        // Parse expected quantity
        let expectedQty = null;
        if (expectedQtyColIdx < cells.length) {
          const rawExpected = cells[expectedQtyColIdx].textContent.trim().replace(/,/g, '');
          const parsed = parseInt(rawExpected, 10);
          if (isNaN(parsed)) {
            console.warn(`[IHM Vendor Shortage] Unparseable Expected PO Qty for ASIN ${asinText}: "${cells[expectedQtyColIdx].textContent.trim()}"`);
          } else {
            expectedQty = parsed;
          }
        }

        // Parse total received quantity
        let receivedQty = null;
        if (receivedQtyColIdx < cells.length) {
          const rawReceived = cells[receivedQtyColIdx].textContent.trim().replace(/,/g, '');
          const parsed = parseInt(rawReceived, 10);
          if (isNaN(parsed)) {
            console.warn(`[IHM Vendor Shortage] Unparseable Total Received Qty for ASIN ${asinText}: "${cells[receivedQtyColIdx].textContent.trim()}"`);
          } else {
            receivedQty = parsed;
          }
        }

        rows.push({
          asin: asinText,
          productName: productName,
          expectedQty: expectedQty,
          receivedQty: receivedQty
        });
      }

      console.log(`[IHM Vendor Shortage] Scraped ${rows.length} rows from PO table`);
      return rows;
    }

    // -------------------------------------------------------------------------
    // Calculate shortages from raw row data
    // -------------------------------------------------------------------------

    /**
     * @typedef {Object} ShortageItem
     * @property {string} asin
     * @property {string} productName
     * @property {number} expectedQty
     * @property {number} receivedQty
     * @property {number} shortageQty - expectedQty - receivedQty
     * @property {boolean} isFullCaseShortage - true if receivedQty === 0 or null/undefined
     */

    /**
     * Filters rows to those with discrepancies and calculates shortage quantities.
     * @param {Array<{asin: string, productName: string, expectedQty: number|null, receivedQty: number|null}>} rows - Raw scraped row data
     * @returns {Array<ShortageItem>} Items with quantity discrepancies
     */
    function calculateShortages(rows) {
      const shortages = [];

      for (const row of rows) {
        // Skip rows where expectedQty is null (can't calculate shortage without expected)
        if (row.expectedQty === null || row.expectedQty === undefined) {
          console.warn(`[IHM Vendor Shortage] Skipping row for ASIN ${row.asin}: expectedQty is null/undefined`);
          continue;
        }

        // Determine effective receivedQty — treat null/undefined as 0 (full case shortage)
        const isReceivedNullish = (row.receivedQty === null || row.receivedQty === undefined);
        const effectiveReceivedQty = isReceivedNullish ? 0 : row.receivedQty;

        // Exclude rows where expectedQty === receivedQty (no shortage)
        if (row.expectedQty === effectiveReceivedQty) {
          continue;
        }

        // Calculate shortage
        const shortageQty = row.expectedQty - effectiveReceivedQty;

        // Full case shortage: receivedQty is 0 or null/undefined
        const isFullCaseShortage = (effectiveReceivedQty === 0);

        shortages.push({
          asin: row.asin,
          productName: row.productName,
          expectedQty: row.expectedQty,
          receivedQty: effectiveReceivedQty,
          shortageQty: shortageQty,
          isFullCaseShortage: isFullCaseShortage
        });
      }

      console.log(`[IHM Vendor Shortage] Found ${shortages.length} shortage(s) from ${rows.length} rows`);
      return shortages;
    }

    // -------------------------------------------------------------------------
    // Price Fetching — Scrape retail price from amazon.com product pages
    // -------------------------------------------------------------------------

    function fetchPrice(asin) {
      return new Promise(function (resolve) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: 'https://www.amazon.com/dp/' + asin,
          headers: {
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 10000,
          onload: function (response) {
            if (response.status === 200) {
              const html = response.responseText;
              // Try multiple price patterns Amazon uses
              const patterns = [
                /class="a-price-whole">(\d+)<.*?class="a-price-fraction">(\d+)</,
                /id="priceblock_ourprice"[^>]*>\s*\$?([\d,.]+)/,
                /id="priceblock_dealprice"[^>]*>\s*\$?([\d,.]+)/,
                /class="a-offscreen">\s*\$?([\d,.]+)/,
                /"price":\s*"?([\d.]+)"?/,
                /data-a-color="price"[^>]*>.*?\$?([\d,.]+)/s
              ];
              for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                  let price;
                  if (match[2]) {
                    // Whole + fraction pattern
                    price = parseFloat(match[1] + '.' + match[2]);
                  } else {
                    price = parseFloat(match[1].replace(/,/g, ''));
                  }
                  if (!isNaN(price) && price > 0 && price < 10000) {
                    resolve({ asin: asin, price: price, found: true });
                    return;
                  }
                }
              }
              resolve({ asin: asin, price: null, found: false });
            } else {
              resolve({ asin: asin, price: null, found: false });
            }
          },
          onerror: function () {
            resolve({ asin: asin, price: null, found: false });
          },
          ontimeout: function () {
            resolve({ asin: asin, price: null, found: false });
          }
        });
      });
    }

    function fetchPricesThrottled(asins, delayMs) {
      delayMs = delayMs || 1000;
      return new Promise(function (resolve) {
        const results = {};
        let index = 0;

        function fetchNext() {
          if (index >= asins.length) {
            resolve(results);
            return;
          }
          const asin = asins[index];
          index++;
          fetchPrice(asin).then(function (result) {
            results[asin] = result.price;
            setTimeout(fetchNext, delayMs);
          });
        }

        fetchNext();
      });
    }

    // -------------------------------------------------------------------------
    // Slack Reporter — Pure Functions
    // -------------------------------------------------------------------------

    function calculateCFR(lineItems) {
      let totalExpected = 0;
      let totalReceived = 0;
      for (const item of lineItems) {
        if (item.expectedQty === null || item.expectedQty === undefined ||
            item.receivedQty === null || item.receivedQty === undefined) {
          continue; // exclude items with unparseable quantities
        }
        totalExpected += item.expectedQty;
        totalReceived += item.receivedQty;
      }
      if (totalExpected === 0) return 'N/A';
      return Math.round((totalReceived / totalExpected) * 1000) / 10;
    }

    function getMotivationalMessage(cfr) {
      if (cfr === 'N/A') return null;
      if (cfr >= 100.0) return 'Outstanding work! Thank you';
      if (cfr >= 98.0) return 'Good job';
      if (cfr >= 96.0) return 'Follow up recommended';
      return 'Escalate to Site Lead';
    }

    function validateWebhookUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      return (trimmed.startsWith('https://hooks.slack.com/services/') && trimmed.length > 'https://hooks.slack.com/services/'.length) ||
             (trimmed.startsWith('https://hooks.slack.com/triggers/') && trimmed.length > 'https://hooks.slack.com/triggers/'.length);
    }

    function composeSlackMessage(params) {
      const { poOrTransshipId, fcCode, reconcilerUsername, cfr, motivationalMessage, shortages, notes } = params;
      const lines = [];
      lines.push('*PO Reconciliation Report*');
      lines.push('*PO:* ' + poOrTransshipId);
      lines.push('*FC:* ' + fcCode);
      lines.push('*Reconciler:* ' + reconcilerUsername);

      if (cfr === 'N/A') {
        lines.push('*CFR:* N/A');
      } else {
        const cfrLine = '*CFR:* ' + cfr + '%' + (motivationalMessage ? ' — ' + motivationalMessage : '');
        lines.push(cfrLine);
      }

      if (shortages && shortages.length > 0) {
        lines.push('');
        lines.push('*Shortages (' + shortages.length + ' item' + (shortages.length !== 1 ? 's' : '') + '):*');
        const maxItems = 50;
        const displayItems = shortages.slice(0, maxItems);
        for (const item of displayItems) {
          lines.push('• `' + item.asin + '` — ' + (item.productName || 'Unknown') + ' | Expected: ' + item.expectedQty + ' | Received: ' + item.receivedQty + ' | Short: ' + item.shortageQty);
        }
        if (shortages.length > maxItems) {
          lines.push('... and ' + (shortages.length - maxItems) + ' more items');
        }
      }

      if (notes && notes.trim()) {
        lines.push('');
        lines.push('*Notes:* ' + notes.trim());
      }

      let message = lines.join('\n');

      // Truncate if exceeds 3000 characters
      if (message.length > 3000) {
        // Rebuild with fewer shortage items until it fits
        const headerEnd = message.indexOf('*Shortages');
        if (headerEnd > 0 && shortages && shortages.length > 0) {
          const header = message.substring(0, headerEnd);
          const footer = (notes && notes.trim()) ? '\n\n*Notes:* ' + notes.trim() : '';
          const available = 3000 - header.length - footer.length - 50; // 50 chars buffer for truncation indicator
          const shortageLines = [];
          let charCount = 0;
          let itemCount = 0;
          for (const item of shortages) {
            const line = '• `' + item.asin + '` — ' + (item.productName || 'Unknown') + ' | Expected: ' + item.expectedQty + ' | Received: ' + item.receivedQty + ' | Short: ' + item.shortageQty;
            if (charCount + line.length + 1 > available) break;
            shortageLines.push(line);
            charCount += line.length + 1;
            itemCount++;
          }
          const remaining = shortages.length - itemCount;
          const shortageSection = '*Shortages (' + shortages.length + ' item' + (shortages.length !== 1 ? 's' : '') + '):*\n' + shortageLines.join('\n') + (remaining > 0 ? '\n... and ' + remaining + ' more items' : '');
          message = header + shortageSection + footer;
        }
        // Final safety truncation
        if (message.length > 3000) {
          message = message.substring(0, 2997) + '...';
        }
      }

      return message;
    }

    function sendToSlack(webhookUrl, data) {
      return new Promise(function (resolve) {
        GM_xmlhttpRequest({
          method: 'POST',
          url: webhookUrl,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(data),
          timeout: 30000,
          onload: function (response) {
            if (response.status === 200 || response.status === 202) {
              resolve({ success: true });
            } else {
              resolve({ success: false, statusCode: response.status, error: 'HTTP ' + response.status });
            }
          },
          onerror: function () {
            resolve({ success: false, error: 'Network error — check your connection.' });
          },
          ontimeout: function () {
            resolve({ success: false, error: 'Request timed out after 30 seconds.' });
          }
        });
      });
    }

    // -------------------------------------------------------------------------
    // Wire everything together: button injection → panel → scrape → render
    // -------------------------------------------------------------------------

    try {
      waitForReconcilePOButton(function (reconcileBtn) {
        if (document.getElementById('ihm-vendor-shortage-review-btn')) return;

        const panel = createPanel();

        const btn = document.createElement('button');
        btn.id = 'ihm-vendor-shortage-review-btn';
        btn.className = 'ihm-shortage-review-btn';
        btn.textContent = 'Shortage Review';
        btn.addEventListener('click', function () {
          panel.show();
          panel.renderLoading();

          // 30-second timeout safety net for scraping
          let completed = false;
          const timeoutId = setTimeout(function () {
            if (!completed) {
              completed = true;
              console.error('[IHM Vendor Shortage] Scraping timed out after 30 seconds');
              panel.renderError('Data retrieval timed out after 30 seconds. Please try again.');
            }
          }, 30000);

          // Use setTimeout to allow the loading UI to render before scraping
          setTimeout(function () {
            if (completed) return; // timeout already fired
            try {
              const rows = scrapeVendorPOTable();
              const shortages = calculateShortages(rows);
              completed = true;
              clearTimeout(timeoutId);
              panel.render(shortages);
            } catch (err) {
              completed = true;
              clearTimeout(timeoutId);
              console.error('[IHM Vendor Shortage] Error during scraping:', err);
              panel.renderError('Failed to scrape PO table. Please try again.');
            }
          }, 100);
        });

        reconcileBtn.insertAdjacentElement('afterend', btn);
        console.log('[IHM Vendor Shortage] Shortage Review button injected');
      });
    } catch (err) {
      console.error('[IHM Vendor Shortage] Error on vendor PO page:', err);
    }
  }

})();
