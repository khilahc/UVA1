// ==UserScript==
// @name         Transship Shortage Helper
// @namespace    https://grocerycentral.amazon.dev/
// @version      3.5.0
// @description  Adds a Shortage Review button to the IHM transship page, auto-fills filters on the Inventory Audit Dashboard, and links to Associate Tools Receive v3 Stow
// @match        https://grocerycentral.amazon.dev/ihm-transship-dashboards/inbound-manifest-view-v2/
// @match        https://grocerycentral.amazon.dev/ihm-transship-dashboards/inbound-manifest-view-v2/*
// @match        https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page
// @match        https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page*
// @match        https://ui.us-west-2.prod.associatetools.ihm.amazon.dev/*
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

  function getCurrentStoreId() {
    try {
      // Use getCurrentFCCode() for consistent detection, then map to store ID
      const fcCode = getCurrentFCCode();
      if (fcCode && SITE_CODE_MAP[fcCode]) return SITE_CODE_MAP[fcCode];
    } catch (e) {}
    return 'US-NC-24';
  }

  function generateReceiveStowUrl(asin) {
    const storeId = getCurrentStoreId();
    const base = 'https://ui.us-west-2.prod.associatetools.ihm.amazon.dev/remote/ihm-associate-tools-base/index.html';
    return `${base}?auth=midway&domain=prod&region=iad&storeId=${storeId}&shortage-receive-asin=${encodeURIComponent(asin)}#/home`;
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
      console.warn('[IHM Transship Shortage] Error detecting FC code:', e);
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
      console.warn('[IHM Transship] Error detecting username:', e);
    }
    return 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // PO / Transship ID extraction
  // ---------------------------------------------------------------------------

  function getPOorTransshipId() {
    try {
      // Strategy 1: Extract from URL path (transship pages use different URL patterns)
      const urlMatch = window.location.pathname.match(/\/inbound-manifest-view-v2\/([^/]+)/);
      if (urlMatch && urlMatch[1]) return urlMatch[1];
      // Strategy 2: Scrape from page header — look for transship/manifest ID patterns
      const allEls = document.querySelectorAll('h1, h2, h3, strong, [class*="title"], [class*="header"]');
      for (const el of allEls) {
        const text = el.textContent.trim();
        // Match patterns like "TS-12345" or alphanumeric IDs
        const tsMatch = text.match(/(?:TS|Transship|Manifest)[:\s]*([A-Z0-9-]+)/i);
        if (tsMatch && tsMatch[1]) return tsMatch[1];
      }
      // Strategy 3: Check URL hash or query params
      const hashMatch = window.location.hash.match(/id=([^&]+)/);
      if (hashMatch && hashMatch[1]) return decodeURIComponent(hashMatch[1]);
    } catch (e) {
      console.warn('[IHM Transship] Error extracting Transship ID:', e);
    }
    return 'Unknown';
  }

  const url = window.location.href;

  // Route to the correct logic based on which page we're on
  if (url.includes('/inbound-manifest-view-v2/')) {
    runTransshipPage();
  } else if (url.includes('/inventory-audit-main-page')) {
    runAuditPage();
  } else if (url.includes('ui.us-west-2.prod.associatetools.ihm.amazon.dev') && url.includes('shortage-receive-asin')) {
    runReceiveStowPage();
  }

  // ===========================================================================
  // TRANSSHIP PAGE — Shortage Review button + panel
  // ===========================================================================

  function runTransshipPage() {

    // -------------------------------------------------------------------------
    // Clear stale stow location data from previous transships
    // -------------------------------------------------------------------------

    (function clearStaleStowData() {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ihm_stow_')) {
          keysToRemove.push(key);
        }
      }
      if (keysToRemove.length > 0) {
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log(`[IHM Transship] Cleared ${keysToRemove.length} stale stow location entries from localStorage`);
      }
    })();

    // -------------------------------------------------------------------------
    // Scrape Activation Time from the transship page header
    // -------------------------------------------------------------------------

    function scrapeActivationTime() {
      const doc = getDoc();
      // Look for "Activation Time" label and grab the adjacent value
      const allEls = doc.querySelectorAll('span, div, p, td, dt, dd, label, strong, b');
      for (const el of allEls) {
        const text = el.textContent.trim().toLowerCase();
        if (text === 'activation time' || text === 'activation time:') {
          // The value is likely in the next sibling or a child element
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const idx = siblings.indexOf(el);
            // Check next sibling element
            if (idx >= 0 && idx < siblings.length - 1) {
              const val = siblings[idx + 1].textContent.trim();
              if (val && /\d/.test(val)) return val;
            }
            // Check parent's next sibling
            const parentNext = parent.nextElementSibling;
            if (parentNext) {
              const val = parentNext.textContent.trim();
              if (val && /\d/.test(val)) return val;
            }
          }
          // Try nextSibling text node
          let next = el.nextSibling;
          while (next) {
            const val = (next.textContent || '').trim();
            if (val && /\d/.test(val)) return val;
            next = next.nextSibling;
          }
          // Try next element sibling
          const nextEl = el.nextElementSibling;
          if (nextEl) {
            const val = nextEl.textContent.trim();
            if (val && /\d/.test(val)) return val;
          }
        }
      }

      // Fallback: look for elements containing a date pattern near "Activation"
      for (const el of allEls) {
        const text = el.textContent.trim();
        // Match patterns like "5/8/2026, 7:08:21 PM" or "05/08/2026, 19:08:21"
        if (/\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}/.test(text) && text.length < 40) {
          // Check if a nearby element says "Activation"
          const parent = el.parentElement;
          if (parent && parent.textContent.toLowerCase().includes('activation')) {
            return text;
          }
        }
      }

      console.warn('[IHM Transship] Activation Time not found on page');
      return null;
    }

    // -------------------------------------------------------------------------
    // Expand all totes, wait for DOM to settle
    // -------------------------------------------------------------------------

    function expandAllTotes() {
      return new Promise((resolve) => {
        const doc = getDoc();
        let expandBtn = null;

        for (const el of doc.querySelectorAll('button, a, span, [role="button"]')) {
          const text = el.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
          if (text === 'expand all' || text.startsWith('expand all')) {
            expandBtn = el;
            break;
          }
        }

        if (!expandBtn) {
          for (const el of doc.querySelectorAll('button, a, span')) {
            const text = el.textContent.trim().toLowerCase();
            if (text === 'expand all' || (text.includes('expand') && text.includes('collapse'))) {
              expandBtn = el;
              break;
            }
          }
        }

        if (!expandBtn) {
          console.log('[IHM Transship] Expand All button not found — proceeding without expanding');
          resolve();
          return;
        }

        console.log('[IHM Transship] Found Expand All button:', expandBtn.textContent.trim());
        expandBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        expandBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        expandBtn.click();

        let quietTimer = null;
        const obs = new MutationObserver(() => {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(() => { obs.disconnect(); resolve(); }, 600);
        });
        obs.observe(doc.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); clearTimeout(quietTimer); resolve(); }, 6000);
      });
    }

    // -------------------------------------------------------------------------
    // Scrape shortage rows from expanded DOM
    // -------------------------------------------------------------------------

    function scrapeShortages() {
      const doc = getDoc();
      const shortages = [];
      const asinPattern = /^[A-Z0-9]{10}$/i;

      doc.querySelectorAll('tr').forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 4) return;

        const asin = cells[0].textContent.trim().replace(/\s+/g, '');
        if (!asinPattern.test(asin)) return;

        const title = cells[1] ? cells[1].textContent.trim() : '';
        const expectedQty = parseInt(cells[2] ? cells[2].textContent.trim() : '0', 10);
        const unpackedQty = parseInt(cells[3] ? cells[3].textContent.trim() : '0', 10);

        // Partial shortage: some units unpacked but not all
        // unpackedQty > 0 AND unpackedQty < expectedQty
        // Full case shortage: unpackedQty === 0 (nothing received)
        if (isNaN(expectedQty) || isNaN(unpackedQty)) return;
        if (unpackedQty >= expectedQty) return; // fully received — not a shortage

        // Determine if this is a full case shortage (zero received)
        const isFullCaseShortage = (unpackedQty === 0);

        // Find nearest tote ID from ancestor elements
        let toteId = '';
        let ancestor = row.parentElement;
        while (ancestor && ancestor !== document.body) {
          const toteLink = ancestor.querySelector('a[href*="tote"], [class*="tote"] a, [id*="tote"]');
          if (toteLink) { toteId = toteLink.textContent.trim(); break; }
          const headings = ancestor.querySelectorAll('h1,h2,h3,h4,strong,b,[class*="title"],[class*="header"]');
          for (const h of headings) {
            const t = h.textContent.trim();
            if (/^[a-z0-9]{8,16}$/i.test(t) && t !== asin) { toteId = t; break; }
          }
          if (toteId) break;
          ancestor = ancestor.parentElement;
        }

        shortages.push({ asin, title, expectedQty, unpackedQty, toteId, isFullCaseShortage });
      });

      return shortages;
    }

    // -------------------------------------------------------------------------
    // Scrape ALL line items (including fully received) for CFR calculation
    // -------------------------------------------------------------------------

    function scrapeAllLineItems() {
      const doc = getDoc();
      const allItems = [];
      const asinPattern = /^[A-Z0-9]{10}$/i;

      doc.querySelectorAll('tr').forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 4) return;

        const asin = cells[0].textContent.trim().replace(/\s+/g, '');
        if (!asinPattern.test(asin)) return;

        const expectedQty = parseInt(cells[2] ? cells[2].textContent.trim() : '0', 10);
        const receivedQty = parseInt(cells[3] ? cells[3].textContent.trim() : '0', 10);

        allItems.push({
          expectedQty: isNaN(expectedQty) ? null : expectedQty,
          receivedQty: isNaN(receivedQty) ? null : receivedQty
        });
      });

      return allItems;
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
      lines.push('*Transship Reconciliation Report*');
      lines.push('*Transship:* ' + poOrTransshipId);
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
    // CSS
    // -------------------------------------------------------------------------

    GM_addStyle(`
      #ihm-shortage-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(0,0,0,0.5);
      }
      #ihm-shortage-panel {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%,-50%);
        min-width: 680px; max-width: 92vw; max-height: 82vh;
        overflow-y: auto; background: #fff; border-radius: 8px;
        padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .ihm-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;
      }
      .ihm-panel-header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #111; }
      .ihm-close-btn {
        background: none; border: none; font-size: 22px;
        cursor: pointer; color: #555; line-height: 1; padding: 0 4px;
      }
      .ihm-close-btn:hover { color: #000; }
      .ihm-panel-body { margin-top: 8px; }
      .ihm-shortage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .ihm-shortage-table th, .ihm-shortage-table td {
        padding: 8px 12px; text-align: left;
        border-bottom: 1px solid #e8e8e8; vertical-align: top;
      }
      .ihm-shortage-table th {
        background: #f5f5f5; font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.04em; color: #444;
      }
      .ihm-shortage-table tr:hover td { background: #fafafa; }
      .ihm-asin { font-family: monospace; font-size: 12px; }
      .ihm-title {
        max-width: 260px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; color: #333;
      }
      .ihm-qty-short { color: #c00; font-weight: 600; }
      .ihm-audit-link { color: #0073bb; text-decoration: none; font-size: 12px; white-space: nowrap; }
      .ihm-audit-link:hover { text-decoration: underline; }
      .ihm-empty-msg { padding: 32px 0; text-align: center; color: #555; font-size: 14px; }
      .ihm-shortage-review-btn {
        background: #fff; border: 1px solid #0073bb; color: #0073bb;
        padding: 6px 14px; border-radius: 4px; cursor: pointer;
        font-size: 13px; font-weight: 500; margin-left: 8px;
      }
      .ihm-shortage-review-btn:hover { background: #e8f4fb; }
      .ihm-summary { font-size: 12px; color: #666; margin-bottom: 12px; }
      .ihm-full-case-row { background: #ffebee !important; font-weight: 700; color: #000; }
      .ihm-full-case-row td { background: #ffebee !important; font-weight: 700; color: #000; }
      @keyframes ihm-spin {
        0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }
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
        ov.id = 'ihm-shortage-overlay';
        const panel = document.createElement('div');
        panel.id = 'ihm-shortage-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'ihm-panel-title');
        const header = document.createElement('div');
        header.className = 'ihm-panel-header';
        const title = document.createElement('h2');
        title.id = 'ihm-panel-title';
        title.textContent = 'Shortage Review';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ihm-close-btn';
        closeBtn.setAttribute('aria-label', 'Close shortage review panel');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', hide);
        header.appendChild(title);
        header.appendChild(closeBtn);
        const body = document.createElement('div');
        body.className = 'ihm-panel-body';
        panel.appendChild(header);
        panel.appendChild(body);
        ov.appendChild(panel);
        return ov;
      }

      function show() {
        if (overlay) return;
        prevFocus = document.activeElement;
        overlay = buildSkeleton();
        document.body.appendChild(overlay);
        overlay.querySelector('.ihm-close-btn').focus();
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keydown', trapFocus);
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
        const body = overlay.querySelector('.ihm-panel-body');
        body.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'text-align:center;padding:40px 0';
        const spinner = document.createElement('div');
        spinner.style.cssText = 'display:inline-block;width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#0073bb;border-radius:50%;animation:ihm-spin 0.8s linear infinite';
        spinner.setAttribute('role', 'status');
        const label = document.createElement('p');
        label.textContent = 'Expanding totes and loading shortage data…';
        label.style.cssText = 'margin-top:12px;color:#555;font-size:13px';
        wrapper.appendChild(spinner);
        wrapper.appendChild(label);
        body.appendChild(wrapper);
      }

      function render(shortages) {
        if (!overlay) return;
        const body = overlay.querySelector('.ihm-panel-body');
        body.innerHTML = '';

        if (shortages.length === 0) {
          const msg = document.createElement('p');
          msg.className = 'ihm-empty-msg';
          msg.textContent = 'No shortages found for this transship.';
          body.appendChild(msg);
        } else {

        const summary = document.createElement('p');
        summary.className = 'ihm-summary';
        summary.textContent = `${shortages.length} item${shortages.length !== 1 ? 's' : ''} with units not yet received. Click "Open Audit →" to load stow locations.`;
        body.appendChild(summary);

        const table = document.createElement('table');
        table.className = 'ihm-shortage-table';

        const thead = document.createElement('thead');
        const hRow = document.createElement('tr');
        ['ASIN', 'Title', 'Expected', 'Received', 'Not Yet Received', 'Tote', 'Stow Location', 'Audit Dashboard', 'Receive'].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          hRow.appendChild(th);
        });
        thead.appendChild(hRow);
        table.appendChild(thead);

        // Sort: partial shortages first, full case shortages underneath
        const sortedShortages = shortages.slice().sort(function (a, b) {
          if (a.isFullCaseShortage === b.isFullCaseShortage) return 0;
          return a.isFullCaseShortage ? 1 : -1;
        });
        const tbody = document.createElement('tbody');
        sortedShortages.forEach(item => {
          const tr = document.createElement('tr');

          // Apply full case shortage highlighting (zero units received)
          if (item.isFullCaseShortage) {
            tr.className = 'ihm-full-case-row';
          }

          const tdAsin = document.createElement('td');
          tdAsin.className = 'ihm-asin';
          tdAsin.textContent = item.asin;
          tr.appendChild(tdAsin);

          const tdTitle = document.createElement('td');
          tdTitle.className = 'ihm-title';
          tdTitle.textContent = item.title || '—';
          tdTitle.title = item.title;
          tr.appendChild(tdTitle);

          const tdExp = document.createElement('td');
          tdExp.style.cssText = 'color:#000;font-weight:500';
          tdExp.textContent = item.expectedQty;
          tr.appendChild(tdExp);

          const tdReceived = document.createElement('td');
          tdReceived.style.cssText = 'color:#1b5e20;font-weight:700';
          tdReceived.textContent = item.unpackedQty;
          tr.appendChild(tdReceived);

          const tdNotReceived = document.createElement('td');
          tdNotReceived.style.cssText = 'color:#b71c1c;font-weight:700;font-style:italic';
          tdNotReceived.textContent = item.expectedQty - item.unpackedQty;
          tr.appendChild(tdNotReceived);

          const tdTote = document.createElement('td');
          tdTote.textContent = item.toteId || '—';
          tdTote.style.cssText = 'font-size:12px;font-family:monospace';
          tr.appendChild(tdTote);

          // Stow Location — populated from localStorage when audit tab returns data
          const tdStow = document.createElement('td');
          tdStow.id = `ihm-stow-${item.asin}`;
          tdStow.style.cssText = 'font-size:12px;color:#555';

          function updateStowCell() {
            const stored = localStorage.getItem(`ihm_stow_${item.asin}`);
            if (stored) {
              try {
                const data = JSON.parse(stored);
                if (data.stowLocations && data.stowLocations.length > 0) {
                  tdStow.innerHTML = data.stowLocations
                    .map(s => `<div style="white-space:nowrap"><strong>${s.location}</strong> &times; ${s.quantity}</div>`)
                    .join('');
                  tdStow.style.color = '#2e7d32';
                } else {
                  tdStow.textContent = 'No stow found';
                }
              } catch (_) {
                tdStow.textContent = '—';
              }
            } else {
              tdStow.textContent = 'Open Audit to load';
              tdStow.style.color = '#999';
            }
          }

          updateStowCell();
          tr.appendChild(tdStow);

          const tdLink = document.createElement('td');
          let auditUrl = `https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page#asin=${encodeURIComponent(item.asin)}`;
          const activationTime = scrapeActivationTime();
          if (activationTime) {
            auditUrl += `&activationTime=${encodeURIComponent(activationTime)}`;
          }
          const link = document.createElement('a');
          link.href = auditUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'ihm-audit-link';
          link.textContent = 'Open Audit →';
          tdLink.appendChild(link);
          tr.appendChild(tdLink);

          // Receive column — link to Associate Tools Receive v3 Stow
          const tdReceive = document.createElement('td');
          const receiveLink = document.createElement('a');
          receiveLink.href = generateReceiveStowUrl(item.asin);
          receiveLink.target = '_blank';
          receiveLink.rel = 'noopener noreferrer';
          receiveLink.className = 'ihm-audit-link';
          receiveLink.style.color = '#0d9488';
          receiveLink.textContent = 'Receive →';
          tdReceive.appendChild(receiveLink);
          tr.appendChild(tdReceive);

          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);

        // Listen for localStorage changes from the audit tab and update stow cells live
        window.addEventListener('storage', (e) => {
          if (e.key && e.key.startsWith('ihm_stow_')) {
            const asinKey = e.key.replace('ihm_stow_', '');
            const cell = document.getElementById(`ihm-stow-${asinKey}`);
            if (cell) {
              shortages.forEach(item => {
                if (item.asin === asinKey) {
                  const stored = e.newValue;
                  if (stored) {
                    try {
                      const data = JSON.parse(stored);
                      if (data.stowLocations && data.stowLocations.length > 0) {
                        cell.innerHTML = data.stowLocations
                          .map(s => `<div style="white-space:nowrap"><strong>${s.location}</strong> &times; ${s.quantity}</div>`)
                          .join('');
                        cell.style.color = '#2e7d32';
                      }
                    } catch (_) {}
                  }
                }
              });
            }
          }
        });
        } // end else (shortages.length > 0)

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
              const shortQty = item.expectedQty - item.unpackedQty;
              totalImpact += price * shortQty;
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

        // Disable send if FC not detected or Transship ID not found
        const transshipId = getPOorTransshipId();
        if (!detectedFC) {
          sendBtn.disabled = true;
          statusArea.textContent = 'Cannot send: FC not detected from page.';
          statusArea.className = 'ihm-slack-status error';
        }
        if (transshipId === 'Unknown') {
          console.warn('[IHM Transship] Transship ID could not be determined');
        }

        // --- Send to Slack click handler ---
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
          const allRows = scrapeAllLineItems();
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

          // Map transship shortage items — only partial case shortages for Slack
          const partialShortages = shortages.filter(item => !item.isFullCaseShortage);
          const partialMapped = partialShortages.map(item => ({
            asin: item.asin,
            productName: (item.title || 'Unknown').substring(0, 25),
            expectedQty: item.expectedQty,
            receivedQty: item.unpackedQty,
            shortageQty: item.expectedQty - item.unpackedQty
          }));

          // Build shortages text — only partial case stows
          const hasAnyShortages = shortages.length > 0;
          let shortagesText = 'None';
          if (partialMapped.length > 0) {
            const maxItems = 50;
            const displayItems = partialMapped.slice(0, maxItems);
            const lines = displayItems.map(function (item) {
              return '\u25b8 ' + item.asin + ' \u2014 ' + item.productName + ' | Exp: ' + item.expectedQty + ' | Rcv: ' + item.receivedQty + ' | Short: ' + item.shortageQty;
            });
            if (partialMapped.length > maxItems) {
              lines.push('... and ' + (partialMapped.length - maxItems) + ' more items');
            }
            shortagesText = lines.join('\n');
          } else if (hasAnyShortages) {
            shortagesText = 'No partial shortages (full case only)';
          }

          // Send individual fields to match workflow variables
          const slackData = {
            report_type: 'Transship Reconciliation Report',
            shipment_id: transshipId,
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

      return { show, hide, render, renderLoading };
    }

    // -------------------------------------------------------------------------
    // Wait for Reconcile button
    // -------------------------------------------------------------------------

    // Helper: always use the top-level document — the iframe is just a Boomerang analytics script
    function getDoc() {
      return document;
    }

    function waitForReconcileButton(callback) {
      function find() {
        const doc = getDoc();

        // Search for Reconcile TS button in the active document
        for (const el of doc.querySelectorAll('button, a, [role="button"], [role="menuitem"]')) {
          const t = el.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
          if (t.includes('reconcile')) return el;
        }

        // Last resort: any element whose exact text is "Reconcile TS" or "Download CSV"
        for (const el of doc.querySelectorAll('*')) {
          const t = el.textContent.trim();
          if (t === 'Reconcile TS' || t === 'Download CSV') return el;
        }

        const allBtns = Array.from(doc.querySelectorAll('button, [role="button"], a'))
          .map(b => b.textContent.trim()).filter(t => t).slice(0, 20);
        console.log('[IHM Transship] Clickable elements found:', allBtns.length, allBtns);
        return null;
      }

      // Poll every 500ms for up to 30 seconds waiting for iframe content + button
      let attempts = 0;
      const maxAttempts = 60;
      const interval = setInterval(function () {
        attempts++;
        const btn = find();
        if (btn) {
          clearInterval(interval);
          console.log('[IHM Shortage Review] Found anchor button:', btn.textContent.trim());
          callback(btn);
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn('[IHM Shortage Review] Reconcile/anchor button not found after 30s. Doc used:', getDoc() === document ? 'top' : 'iframe');
        }
      }, 500);
    }

    // -------------------------------------------------------------------------
    // Entry point for transship page
    // -------------------------------------------------------------------------

    try {
      waitForReconcileButton((reconcileBtn) => {
        if (document.getElementById('ihm-shortage-review-btn')) return;

        const panel = createPanel();

        const btn = document.createElement('button');
        btn.id = 'ihm-shortage-review-btn';
        btn.className = 'ihm-shortage-review-btn';
        btn.textContent = 'Shortage Review';
        btn.addEventListener('click', async () => {
          panel.show();
          panel.renderLoading();
          await expandAllTotes();
          const shortages = scrapeShortages();
          panel.render(shortages);
        });

        reconcileBtn.insertAdjacentElement('afterend', btn);
      });
    } catch (err) {
      console.warn('[IHM Shortage Review] Error on transship page:', err);
    }
  }

  // ===========================================================================
  // AUDIT DASHBOARD PAGE — Auto-fill filters when opened from Shortage Review
  // ===========================================================================

  function runAuditPage() {

    // Only run if the ASIN was passed via the URL hash from our script
    function getAsinFromHash() {
      const hash = window.location.hash;
      const match = /[#&]asin=([^&]+)/.exec(hash);
      if (!match) return null;
      // Decode and strip any whitespace/control characters
      const raw = decodeURIComponent(match[1]).replace(/[\s\r\n\t]/g, '');
      // Validate it looks like an ASIN (10 alphanumeric chars)
      return /^[A-Z0-9]{10}$/i.test(raw) ? raw : null;
    }

    const asin = getAsinFromHash();
    if (!asin) return; // Not opened from shortage review — do nothing

    // -------------------------------------------------------------------------
    // Parse activation time from URL hash
    // -------------------------------------------------------------------------

    function getActivationTimeFromHash() {
      const hash = window.location.hash;
      const match = /[#&]activationTime=([^&]+)/.exec(hash);
      if (!match) return null;
      const raw = decodeURIComponent(match[1]).trim();
      // Try to parse the activation time string (e.g., "5/8/2026, 7:08:21 PM")
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return parsed;
      // Fallback: try manual parsing for "M/D/YYYY, H:MM:SS AM/PM" format
      const parts = /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(raw);
      if (parts) {
        let [, month, day, year, hours, minutes, , ampm] = parts;
        hours = parseInt(hours, 10);
        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, parseInt(minutes, 10));
      }
      console.warn('[IHM Audit] Could not parse activation time:', raw);
      return null;
    }

    // -------------------------------------------------------------------------
    // Date helpers
    // -------------------------------------------------------------------------

    function formatDate(date) {
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${mm}/${dd}/${date.getFullYear()}`;
    }

    function getDateRange() {
      const now = new Date();
      const activationDate = getActivationTimeFromHash();
      let from;
      if (activationDate) {
        // Round down to the start of the hour
        from = new Date(activationDate);
        from.setMinutes(0, 0, 0);
        console.log('[IHM Audit] Using activation time (rounded to hour):', from.toString());
      } else {
        // Fallback: t-3 days if activation time not available
        from = new Date(now);
        from.setDate(from.getDate() - 3);
        console.log('[IHM Audit] Activation time not found, falling back to t-3 days');
      }
      return { fromDate: formatDate(from), fromTime: `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}`, toDate: formatDate(now), toTime: '23:59' };
    }

    // -------------------------------------------------------------------------
    // React-compatible input setter
    // -------------------------------------------------------------------------

    function setInputValue(input, value) {
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findInputByPlaceholder(text) {
      const lower = text.toLowerCase();
      for (const el of document.querySelectorAll('input,textarea')) {
        if ((el.placeholder || '').toLowerCase().includes(lower)) return el;
      }
      return null;
    }

    function findButtonByText(text) {
      const lower = text.toLowerCase();
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim().toLowerCase().includes(lower)) return btn;
      }
      return null;
    }

    // -------------------------------------------------------------------------
    // Auto-fill dates and ASIN only (no process selection)
    // -------------------------------------------------------------------------

    function autoFillDatesAndAsin() {
      const { fromDate, fromTime, toDate, toTime } = getDateRange();
      const allInputs = Array.from(document.querySelectorAll(
        'input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])'
      ));
      const dateInputs = allInputs.filter(el =>
        /\d{2}\/\d{2}\/\d{4}/.test(el.value) || el.placeholder === 'MM/DD/YYYY' ||
        (el.getAttribute('aria-label') || '').toLowerCase().includes('date')
      );
      if (dateInputs.length >= 2) { setInputValue(dateInputs[0], fromDate); setInputValue(dateInputs[1], toDate); }
      const timeInputs = allInputs.filter(el =>
        /^\d{2}:\d{2}$/.test(el.value) || el.placeholder === 'HH:MM' ||
        (el.getAttribute('aria-label') || '').toLowerCase().includes('time')
      );
      if (timeInputs.length >= 2) { setInputValue(timeInputs[0], fromTime); setInputValue(timeInputs[1], toTime); }
      const asinInput = findInputByPlaceholder('asin number') || findInputByPlaceholder('asin') || findInputByPlaceholder('product');
      if (asinInput) setInputValue(asinInput, asin);
    }

    // -------------------------------------------------------------------------
    // Auto-fill (full — dates, ASIN, and processes)
    // -------------------------------------------------------------------------

    function autoFill() {
      console.log('[IHM Audit] autoFill running for ASIN:', asin);
      const { fromDate, fromTime, toDate, toTime } = getDateRange();
      console.log('[IHM Audit] Date range:', fromDate, fromTime, '→', toDate, toTime);

      // All text inputs on the page
      const allInputs = Array.from(document.querySelectorAll(
        'input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])'
      ));

      // Date inputs — identified by MM/DD/YYYY value pattern or placeholder
      const dateInputs = allInputs.filter(el =>
        /\d{2}\/\d{2}\/\d{4}/.test(el.value) ||
        el.placeholder === 'MM/DD/YYYY' ||
        (el.getAttribute('aria-label') || '').toLowerCase().includes('date')
      );

      if (dateInputs.length >= 2) {
        setInputValue(dateInputs[0], fromDate);
        setInputValue(dateInputs[1], toDate);
      }

      // Time inputs — identified by HH:MM value pattern or placeholder
      const timeInputs = allInputs.filter(el =>
        /^\d{2}:\d{2}$/.test(el.value) ||
        el.placeholder === 'HH:MM' ||
        (el.getAttribute('aria-label') || '').toLowerCase().includes('time')
      );

      if (timeInputs.length >= 2) {
        setInputValue(timeInputs[0], fromTime);
        setInputValue(timeInputs[1], toTime);
      }

      // ASIN field — target by exact placeholder "Enter asin number" (confirmed from page DOM)
      const asinInput = findInputByPlaceholder('asin number') ||
                        findInputByPlaceholder('asin') ||
                        findInputByPlaceholder('product') ||
                        findInputByPlaceholder('item') ||
                        document.querySelector('[data-testid*="asin" i] input, [aria-label*="asin" i] input');
      if (asinInput) {
        setInputValue(asinInput, asin);
        console.log('[IHM Audit] Set ASIN field to:', asin, '| placeholder was:', asinInput.placeholder);
      } else {
        console.warn('[IHM Audit] ASIN input not found');
      }

      // Target processes — all relevant receive/stow paths
      const TARGET_PROCESSES = [
        'AutoStow',
        'AutoStow_CulQual_Destroy',
        'AutoStow_CulQual_Donate',
        'AutoStow_Damaged_Destroyed',
        'AutoStow_Damaged_Donated',
        'AutoStow_Expired_Destroyed',
        'AutoStow_Expired_Donated',
        'AutoStow_FOUND',
        'AutoStow_Rec_Damaged_Destroyed',
        'AutoStow_Rec_Damaged_Donated',
        'AutoStow_Rec_Expired_Destroyed',
        'AutoStow_Rec_Expired_Donated',
        'AutoStow_Recalled_Destroyed',
        'AutoStow_RECEIVED',
        'ReceiveV3',
        'ReceiveV3_Stow',
        'ReceiveV3_Stow_adhoc',
        'ReceiveV3_Stow_prev_short',
        'RecV3_Andon_Destroyed',
        'RecV3_Capacity_Destroyed',
        'RecV3_Capacity_Distribute',
        'RecV3_Capacity_Donated',
        'RecV3_Culling_DMG_Disc_Destroy',
        'RecV3_Culling_DMG_Disc_Donate',
        'RecV3_Culling_DMG_Disc_Hazmat',
        'RecV3_Culling_Rotten_Destroy',
        'RecV3_Damaged_Destroyed',
        'RecV3_Damaged_Distribute',
        'RecV3_Damaged_Donated',
        'RecV3_Damaged_Hazmat_Waste',
        'RecV3_Expired_Destroyed',
        'RecV3_Expired_Distribute',
        'RecV3_Expired_Donated',
        'RecV3_Expired_Hazmat_Waste',
        'RecV3_Missing',
        'RecV3_Nop_Cleanup_Destroyed',
        'RecV3_Nop_Cleanup_Donated',
        'RecV3_Recalled_Destroyed',
        'RecV3_Reject_DMG_Disc_Destroy',
        'RecV3_Reject_DMG_Disc_Distrib',
        'RecV3_Reject_DMG_Disc_Donate',
        'RecV3_Reject_DMG_Disc_Hazmat',
        'RecV3_Reject_Exp_Destroy',
        'RecV3_Reject_Exp_Donate',
        'RecV3_Reject_Moldy_Destroy',
        'RecV3_Reject_OOT_Destroy',
        'RecV3_Reject_OOT_Distrib',
        'RecV3_Store_Out_Temp_Destroy'
      ];

      // Find and click the dropdown trigger to open it
      function findDropdownTrigger() {
        // Primary: data-testid confirmed from DOM inspection
        const byTestId = document.querySelector('[data-testid="process-select"]');
        if (byTestId) return byTestId;
        // Fallbacks
        for (const el of document.querySelectorAll('button, div[role="button"], [tabindex="0"], .mds-input-box')) {
          const text = el.textContent.trim();
          if (text.includes('Select Process') || /^\d+ selected$/.test(text)) return el;
        }
        return null;
      }

      function triggerClick(el) {
        // Try clicking a checkbox inside the item first (Ember multi-select components
        // often use hidden checkboxes as the actual selection mechanism)
        const checkbox = el.querySelector('input[type="checkbox"]') ||
                         el.closest('li, [role="option"]')?.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.click();
          return;
        }
        // Fall back to native click on the element itself
        if (typeof el.click === 'function') {
          el.click();
        } else {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }

      function triggerDropdownOpen(el) {
        // Ember dropdowns need the full mouse event sequence to open
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const child = el.querySelector('input, button, [tabindex], [role="combobox"], [role="button"]');
        if (child) {
          child.focus();
          child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          child.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }

      // Open dropdown, select target processes via React internals, then click Filter
      function selectProcessesThenFilter() {
        const trigger = findDropdownTrigger();
        if (!trigger) {
          console.warn('[IHM Audit] Process dropdown trigger not found');
          const filterBtn = findButtonByText('filter');
          if (filterBtn) { filterBtn.click(); console.log('[IHM Audit] Clicked Filter (no dropdown found)'); }
          return;
        }

        // Find the combobox input inside the process-select container
        const container = document.querySelector('[data-testid="process-select"]') || trigger.closest('[class*="select"], [class*="dropdown"]') || trigger;
        const comboInput = container.querySelector('input[role="combobox"]') || container.querySelector('input') || trigger;

        function openDropdown(callback) {
          comboInput.focus();
          comboInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          comboInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          comboInput.click();
          requestAnimationFrame(() => requestAnimationFrame(callback));
        }

        openDropdown(() => {
          console.log('[IHM Audit] Dropdown opened, looking for React fiber...');

          const listbox = document.querySelector('[role="listbox"]');
          if (!listbox) {
            console.warn('[IHM Audit] No listbox found, falling back to trigger open');
            triggerDropdownOpen(trigger);
            setTimeout(() => {
              const filterBtn = findButtonByText('filter');
              if (filterBtn) filterBtn.click();
            }, 500);
            return;
          }

          // Walk up the React fiber tree to find onChange with value prop
          const fk = Object.keys(listbox).find(k => k.startsWith('__reactFiber'));
          const fiber = fk ? listbox[fk] : null;
          let current = fiber;
          let depth = 0;
          let found = false;

          while (current && depth < 50) {
            const props = current.memoizedProps;
            if (props && props.onChange && props.value !== undefined) {
              console.log('[IHM Audit] Found onChange at fiber depth', depth);
              try {
                props.onChange(TARGET_PROCESSES);
                found = true;
                console.log('[IHM Audit] onChange called with', TARGET_PROCESSES.length, 'processes (string array)');
              } catch (e) {
                try {
                  props.onChange(TARGET_PROCESSES.map(s => ({ label: s, value: s })));
                  found = true;
                  console.log('[IHM Audit] onChange called with', TARGET_PROCESSES.length, 'processes (object array)');
                } catch (e2) {
                  console.warn('[IHM Audit] onChange failed:', e2.message);
                }
              }
              break;
            }
            current = current.return;
            depth++;
          }

          if (!found) {
            console.warn('[IHM Audit] Could not find onChange with value prop after', depth, 'levels');
          }

          // Close dropdown and click Filter
          setTimeout(() => {
            comboInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            setTimeout(() => {
              const filterBtn = findButtonByText('filter');
              if (filterBtn) { filterBtn.click(); console.log('[IHM Audit] Clicked Filter'); }
            }, 400);
          }, 500);
        });
      }

      // Guard: only run process selection once
      if (window._ihmProcessDone) {
        console.log('[IHM Audit] Process selection already done, skipping');
        return;
      }
      window._ihmProcessDone = true;

      selectProcessesThenFilter();
    }

    // -------------------------------------------------------------------------
    // Banner CSS
    // -------------------------------------------------------------------------

    GM_addStyle(`
      #ihm-autofill-banner {
        position: fixed; top: 12px; right: 12px; z-index: 999999;
        background: #0073bb; color: #fff; padding: 8px 14px;
        border-radius: 6px; font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;
      }
    `);

    const banner = document.createElement('div');
    banner.id = 'ihm-autofill-banner';
    banner.textContent = `Auto-filling filters for ASIN: ${asin}…`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);

    // -------------------------------------------------------------------------
    // Wait for form to render, then auto-fill
    // -------------------------------------------------------------------------

    function isFormReady() {
      const hasDateInput = document.querySelector('input[type="text"]');
      const hasFilterBtn = findButtonByText('filter');
      // Check processes have loaded by looking for the Select All checkbox or any process chip
      const hasProcesses = (() => {
        // Method 1: Select all checkbox present
        const allEls = document.querySelectorAll('span, div, p, label');
        for (const el of allEls) {
          if (el.children.length === 0 && el.textContent.trim().toLowerCase() === 'select all') return true;
        }
        // Method 2: process dropdown shows a count like "102 selected" or "7 selected"
        const dropdownText = document.querySelector('[class*="process"] [class*="select"], [class*="process"] select');
        if (dropdownText && dropdownText.textContent.includes('selected')) return true;
        // Method 3: any element with "Select Process" placeholder (means dropdown rendered)
        const processSelect = document.querySelector('[data-testid="select-all-check-box"]');
        if (processSelect) return true;
        return false;
      })();

      console.log('[IHM Audit] isFormReady — dateInput:', !!hasDateInput, 'filterBtn:', !!hasFilterBtn, 'processes:', hasProcesses);
      return hasDateInput && hasFilterBtn && hasProcesses;
    }

    // Strategy: fill once when form is ready, then fill again after the process
    // list API completes (which resets the form ~1-2s after page load).
    // We schedule fills at 1s, 2s, and 3s after the form first becomes ready
    // to ensure at least one fill lands after the API reset.
    let fillCount = 0;

    function scheduleFills() {
      // Fill dates/ASIN at 1s and 2s to survive the process list API reset
      [1000, 2000].forEach(delay => {
        setTimeout(() => {
          if (isFormReady()) {
            console.log(`[IHM Audit] Filling dates/ASIN at +${delay}ms`);
            autoFillDatesAndAsin();
          }
        }, delay);
      });
      // Process selection runs ONCE at 3s — hard flag prevents re-runs
      setTimeout(() => {
        if (isFormReady()) {
          console.log('[IHM Audit] Running process selection at +3000ms');
          autoFill();
        }
      }, 3000);
    }

    if (isFormReady()) {
      scheduleFills();
      return;
    }

    const tid = setTimeout(() => {
      obs.disconnect();
      console.warn('[IHM Audit Auto-Fill] Form not found after 10s.');
    }, 10000);

    const obs = new MutationObserver(() => {
      if (isFormReady()) {
        obs.disconnect();
        clearTimeout(tid);
        scheduleFills();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // -------------------------------------------------------------------------
    // Scrape ReceiveV3_Stow results and send back to reconcile page via localStorage
    // -------------------------------------------------------------------------

    /**
     * Waits for the results table to populate after Filter is clicked,
     * then scrapes rows where Process = "ReceiveV3_Stow" and stores
     * { location, quantity } in localStorage keyed by ASIN.
     */
    function scrapeStowResults() {
      const table = document.querySelector('table');
      if (!table) return null;

      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
      const asinIdx = headers.findIndex(h => h.includes('asin'));
      const locationIdx = headers.findIndex(h => h.includes('location'));
      const qtyIdx = headers.findIndex(h => h === 'quantity' || h.includes('quantity'));
      const processIdx = headers.findIndex(h => h.includes('process'));

      if (asinIdx === -1 || locationIdx === -1 || processIdx === -1) {
        console.log('[IHM Audit] Could not find required columns. Headers:', headers);
        return null;
      }

      const stowRows = [];
      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (!cells.length) return;
        const process = cells[processIdx] ? cells[processIdx].textContent.trim() : '';
        if (process !== 'ReceiveV3_Stow' && process !== 'AutoStow_RECEIVED') return;
        const location = cells[locationIdx] ? cells[locationIdx].textContent.trim() : '';
        const quantity = cells[qtyIdx] ? cells[qtyIdx].textContent.trim() : '';
        stowRows.push({ location, quantity });
      });

      return stowRows;
    }

    function waitForResultsAndScrape() {
      let attempts = 0;
      const maxAttempts = 20;

        const checkInterval = setInterval(() => {
          attempts++;
          const table = document.querySelector('table tbody tr td');
          const noData = document.querySelector('[class*="no-data"], [class*="empty"]');

          if (noData || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            if (noData) console.log('[IHM Audit] No data found for this ASIN/filter combination.');
            return;
          }

          if (table) {
            clearInterval(checkInterval);

            // Scrape all pages by clicking Next until done
            function scrapeAllPages(allStowRows, callback) {
              // Scrape current page
              const pageData = scrapeStowResults();
              if (pageData) allStowRows.push(...pageData);
              console.log('[IHM Audit] Scraped page, total rows so far:', allStowRows.length);

              // Check if there's a Next page button that's enabled
              const nextBtn = Array.from(document.querySelectorAll('button, a, [role="button"]'))
                .find(el => {
                  const text = el.textContent.trim().toLowerCase();
                  const label = (el.getAttribute('aria-label') || '').toLowerCase();
                  return (text === '>' || text === 'next' || label.includes('next')) &&
                         !el.disabled && el.getAttribute('aria-disabled') !== 'true';
                });

              if (nextBtn) {
                console.log('[IHM Audit] Clicking Next page');
                nextBtn.click();
                // Wait for next page to load
                setTimeout(() => scrapeAllPages(allStowRows, callback), 1500);
              } else {
                console.log('[IHM Audit] No more pages, total rows:', allStowRows.length);
                callback(allStowRows);
              }
            }

            scrapeAllPages([], (allStowData) => {
              if (allStowData.length > 0) {
                console.log('[IHM Audit] Found ReceiveV3_Stow rows:', allStowData);
                const storageKey = `ihm_stow_${asin}`;
                localStorage.setItem(storageKey, JSON.stringify({
                  asin,
                  stowLocations: allStowData,
                  timestamp: Date.now()
                }));
                console.log('[IHM Audit] Stored stow data in localStorage:', storageKey);
                const banner = document.getElementById('ihm-autofill-banner');
                if (banner) {
                  banner.textContent = `Found ${allStowData.length} stow location${allStowData.length !== 1 ? 's' : ''} for ${asin} — data sent to Shortage Review panel.`;
                  banner.style.background = '#2e7d32';
                  setTimeout(() => banner.remove(), 5000);
                }
              } else {
                console.log('[IHM Audit] No ReceiveV3_Stow rows found in results.');
              }
            });
          }
        }, 500);
      }

    // Schedule the results scrape after the last autoFill + filter click
    // Give it 5 seconds after the last fill attempt to let results load
    setTimeout(waitForResultsAndScrape, 5000);

  } // end runAuditPage

  // ===========================================================================
  // ASSOCIATE TOOLS — Receive v3 → Stow → Auto-fill ASIN
  // ===========================================================================

  function runReceiveStowPage() {
    // Extract ASIN from URL query param (check both own URL and parent URL)
    let search = window.location.search || '';
    // If we're in an iframe, the params might be in our own URL (passed through by parent)
    const receiveAsinMatch = search.match(/shortage-receive-asin=([^&]*)/);
    if (!receiveAsinMatch || !receiveAsinMatch[1]) return;

    const receiveAsin = decodeURIComponent(receiveAsinMatch[1]).trim();
    if (!receiveAsin) return;

    const isInIframe = (window.self !== window.top);
    console.log('[Shortage Helper] Receive Stow page: ASIN =', receiveAsin, isInIframe ? '(iframe)' : '(parent)');

    // Only run from the parent page
    if (isInIframe) return;

    // Step 1: Click "Receive" (ihm_inbound_tool) in the sidebar
    function clickReceiveV3() {
      // The actual tool row is "sideBar-ihm_inbound_tool" (contains "Receive v3" text).
      // Note: "sideBar-Receive" is just the CATEGORY HEADER that expands the section —
      // we must NOT treat clicking it as success.
      var sidebarItem = document.querySelector('tr[data-atb-id="sideBar-ihm_inbound_tool"]');

      if (sidebarItem) {
        console.log('[Shortage Helper] Found Receive tool sidebar item: sideBar-ihm_inbound_tool');
        sidebarItem.click();
        setTimeout(waitForStowAndClick, 2500);
        return true;
      }

      // If the tool row isn't visible yet, try expanding the "Receive" category first
      var categoryRow = document.querySelector('tr[data-atb-id="sideBar-Receive"]');
      if (categoryRow) {
        console.log('[Shortage Helper] Expanding Receive category to reveal ihm_inbound_tool');
        categoryRow.click();
        // Don't return true — we haven't clicked the actual tool yet
        return false;
      }

      return false;
    }

    // Poll for sidebar to appear (same pattern as hot pick script)
    let sidebarAttempts = 0;
    let clickedReceive = false;
    const sidebarInterval = setInterval(() => {
      sidebarAttempts++;
      if (sidebarAttempts % 5 === 0) {
        const allTrs = document.querySelectorAll('tr[data-atb-id]');
        const ids = Array.from(allTrs).map(tr => tr.getAttribute('data-atb-id'));
        console.log('[Shortage Helper] Sidebar poll attempt', sidebarAttempts, '- found', allTrs.length, 'items:', ids);
      }

      if (!clickedReceive) {
        clickedReceive = clickReceiveV3();
      }

      // If we already clicked but it didn't navigate, retry after a delay
      if (clickedReceive && sidebarAttempts > 10 && sidebarAttempts % 5 === 0) {
        const hasReceiveContent = document.querySelector('[data-atb-id*="stow"], [data-atb-id*="Stow"]') ||
          Array.from(document.querySelectorAll('a, button, div, span')).some(el => el.textContent.trim() === 'Stow' && el.offsetParent !== null);
        if (!hasReceiveContent) {
          console.log('[Shortage Helper] Receive page not loaded yet, retrying click...');
          clickedReceive = false; // Allow retry
        }
      }

      if (sidebarAttempts >= 40) {
        clearInterval(sidebarInterval);
        if (!clickedReceive) {
          console.warn('[Shortage Helper] Receive v3 sidebar not found after 20s');
        } else {
          console.log('[Shortage Helper] Sidebar timeout reached, attempting Stow search anyway');
          waitForStowAndClick();
        }
      }
    }, 500);

    // Step 2: Click "Stow" on the Receive v3 page
    function waitForStowAndClick() {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;

        // Log what's visible on the page periodically for debugging
        if (attempts === 5 || attempts === 15) {
          const visibleTexts = Array.from(document.querySelectorAll('a, button, div[role="button"], span[role="button"], li, td'))
            .filter(el => el.offsetParent !== null && el.textContent.trim().length < 30 && el.textContent.trim().length > 0)
            .map(el => `${el.tagName}[${el.className?.split(' ')[0] || ''}]: "${el.textContent.trim()}"`)
            .slice(0, 30);
          console.log('[Shortage Helper] Visible clickable elements (attempt ' + attempts + '):', visibleTexts);
        }
        
        // Search in parent document — match "Stow" case-insensitively and also partial matches
        let found = false;
        const allEls = document.querySelectorAll('a, button, div, span, tr, td, li, [role="tab"], [role="button"], [role="menuitem"]');
        for (const el of allEls) {
          const text = el.textContent.trim();
          // Match exact "Stow" or "STOW" or elements where the direct text (not children) is "Stow"
          if (/^stow$/i.test(text) && el.offsetParent !== null) {
            clearInterval(interval);
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            console.log('[Shortage Helper] Clicked Stow (parent):', el.tagName, el.className);
            setTimeout(waitForAsinInputAndFill, 2000);
            found = true;
            return;
          }
        }
        
        // Search inside iframes
        if (!found) {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const iDoc = iframe.contentDocument;
              if (!iDoc) continue;
              const iEls = iDoc.querySelectorAll('a, button, div, span, tr, td, li, [role="tab"], [role="button"], [role="menuitem"]');
              for (const el of iEls) {
                const text = el.textContent.trim();
                if (/^stow$/i.test(text) && el.offsetParent !== null) {
                  clearInterval(interval);
                  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
                  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
                  el.click();
                  console.log('[Shortage Helper] Clicked Stow (iframe):', el.tagName, el.className);
                  setTimeout(waitForAsinInputAndFill, 2000);
                  return;
                }
              }
            } catch (e) {
              // Cross-origin iframe — can't access
              if (attempts === 5) console.log('[Shortage Helper] Cross-origin iframe detected:', iframe.src?.substring(0, 80));
            }
          }
        }
        
        if (attempts >= 30) {
          clearInterval(interval);
          console.warn('[Shortage Helper] Stow option not found after 15s');
          // Last resort: skip Stow click and try to find the ASIN input directly
          // (maybe the page already shows the stow input without needing to click "Stow")
          console.log('[Shortage Helper] Attempting to find ASIN input directly (skipping Stow click)');
          waitForAsinInputAndFill();
        }
      }, 500);
    }

    // Step 3: Fill the ASIN in the "Scan product barcode" input
    function waitForAsinInputAndFill() {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;

        let input = null;

        // The tool content loads inside an iframe — check the ihm_inbound_tool iframe first
        // (same pattern as hot pick script checking iframe[aria-label="inventory_viewer_v2"])
        const toolIframe = document.querySelector('iframe[aria-label="ihm_inbound_tool"]') ||
                           document.querySelector('iframe[aria-label*="inbound"]') ||
                           document.querySelector('iframe[aria-label*="receive"]') ||
                           document.querySelector('iframe[aria-label*="Receive"]');

        if (toolIframe && toolIframe.contentDocument) {
          try {
            const iDoc = toolIframe.contentDocument;
            input = iDoc.querySelector('input[data-id="OmniboxId"]') ||
                    iDoc.querySelector('input[placeholder*="Scan"]') ||
                    iDoc.querySelector('input[placeholder*="scan"]') ||
                    iDoc.querySelector('input[placeholder*="product"]') ||
                    iDoc.querySelector('input[placeholder*="barcode"]') ||
                    iDoc.querySelector('input[placeholder*="ASIN"]') ||
                    iDoc.querySelector('input[type="text"]');
          } catch (e) {
            if (attempts === 5) console.log('[Shortage Helper] Cannot access ihm_inbound_tool iframe (cross-origin):', e.message);
          }
        }

        // Fallback: check all iframes
        if (!input) {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const iDoc = iframe.contentDocument;
              if (iDoc) {
                input = iDoc.querySelector('input[data-id="OmniboxId"]') ||
                        iDoc.querySelector('input[placeholder*="Scan"]') ||
                        iDoc.querySelector('input[placeholder*="scan"]') ||
                        iDoc.querySelector('input[placeholder*="product"]') ||
                        iDoc.querySelector('input[placeholder*="barcode"]');
                if (input) break;
              }
            } catch (e) {}
          }
        }

        // Last resort: check parent document (but only specific selectors, not generic input[type="text"])
        if (!input) {
          input = document.querySelector('input[data-id="OmniboxId"]') ||
                  document.querySelector('input[placeholder*="Scan product"]') ||
                  document.querySelector('input[placeholder*="product barcode"]') ||
                  document.querySelector('input[placeholder*="scan"]');
        }

        if (input) {
          clearInterval(interval);
          input.focus();
          // Use native setter for React compatibility
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, receiveAsin);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Shortage Helper] Filled ASIN in Receive Stow input:', receiveAsin, '| iframe:', toolIframe ? toolIframe.getAttribute('aria-label') : 'parent');

          // Show banner
          const banner = document.createElement('div');
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#0d9488;color:#fff;text-align:center;padding:12px 20px;font-size:16px;font-weight:bold;font-family:-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
          banner.textContent = '⌨️ Press ENTER to scan product: ' + receiveAsin;
          document.body.insertBefore(banner, document.body.firstChild);
          setTimeout(() => banner.remove(), 8000);
        } else if (attempts >= 30) {
          clearInterval(interval);
          console.warn('[Shortage Helper] ASIN input not found in Receive Stow page after 15s');
          // Log what iframes exist for debugging
          const iframeLabels = Array.from(document.querySelectorAll('iframe')).map(f => f.getAttribute('aria-label') || f.src?.substring(0, 60) || 'no-label');
          console.log('[Shortage Helper] Available iframes:', iframeLabels);
        }
      }, 500);
    }
  } // end runReceiveStowPage

})(); // end IIFE