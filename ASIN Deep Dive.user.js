// ==UserScript==
// @name         ASIN Deep Dive
// @namespace    https://na.store-management.f3.amazon.dev/
// @version      1.0.0
// @description  ASIN search widget for Store Management pages with auto-fill on Grocery Central audit dashboard
// @match        https://na.store-management.f3.amazon.dev/*
// @match        https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page
// @match        https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page*
// @grant        GM_addStyle
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Pure utility functions
  // ---------------------------------------------------------------------------

  function validateAsin(value) {
    return /^[A-Z0-9]{10}$/i.test(value);
  }

  function formatDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  function getDateRange() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return {
      fromDate: formatDate(from),
      fromTime: '00:00',
      toDate: formatDate(today),
      toTime: '23:59',
    };
  }

  function getAsinFromHash(hash) {
    const match = hash.match(/[#&]gc-asin=([^&]+)/);
    if (!match) return null;
    const decoded = decodeURIComponent(match[1]).replace(/\s/g, '');
    if (!validateAsin(decoded)) return null;
    return decoded.toUpperCase();
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------------------------------------------------------------------------
  // Widget page code path
  // ---------------------------------------------------------------------------

  function runWidgetPage() {

    // Task 5.4 — Widget styles
    GM_addStyle(`
      #gc-asin-widget {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 999999;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        border-radius: 8px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 15px;
        cursor: grab;
        user-select: none;
      }
      #gc-asin-widget.gc-dragging {
        cursor: grabbing;
        opacity: 0.9;
      }
      #gc-asin-input {
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 7px 10px;
        font-size: 15px;
        width: 170px;
        outline: none;
      }
      #gc-asin-input:focus {
        border-color: #0073bb;
      }
      #gc-asin-btn {
        background: #0073bb;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 7px 14px;
        font-size: 15px;
        cursor: pointer;
      }
      #gc-asin-btn:hover {
        background: #005f99;
      }
      #gc-asin-error {
        color: #d13212;
        font-size: 13px;
        margin-left: 4px;
      }
    `);

    // Task 5.3 — Open audit tab
    function openAuditTab(asin) {
      const url = 'https://grocerycentral.amazon.dev/ihm-inventory-audit-dashboard/inventory-audit-main-page#gc-asin=' + asin;
      if (typeof GM_openInTab !== 'undefined') {
        GM_openInTab(url, { active: true });
      } else {
        window.open(url, '_blank');
      }
    }

    // Task 5.1 — Inject widget DOM
    function injectWidget() {
      const widget = document.createElement('div');
      widget.id = 'gc-asin-widget';
      widget.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999';

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'gc-asin-input';
      input.placeholder = 'Enter ASIN';

      const btn = document.createElement('button');
      btn.id = 'gc-asin-btn';
      btn.textContent = 'Deep Dive';

      const error = document.createElement('span');
      error.id = 'gc-asin-error';
      error.style.display = 'none';

      widget.appendChild(input);
      widget.appendChild(btn);
      widget.appendChild(error);
      document.body.appendChild(widget);
    }

    // Task 5.2 — Handle search and wire events
    function handleSearch() {
      const input = document.getElementById('gc-asin-input');
      const errorSpan = document.getElementById('gc-asin-error');
      const asin = input ? input.value.trim() : '';

      if (!validateAsin(asin)) {
        if (errorSpan) {
          errorSpan.textContent = 'Invalid ASIN. Must be 10 alphanumeric characters.';
          errorSpan.style.display = '';
        }
        return;
      }

      if (errorSpan) {
        errorSpan.textContent = '';
        errorSpan.style.display = 'none';
      }

      openAuditTab(asin.toUpperCase());
    }

    injectWidget();

    // Make widget draggable with localStorage position persistence
    (function () {
      const STORAGE_KEY = 'gc-asin-widget-pos';
      const widget = document.getElementById('gc-asin-widget');
      let isDragging = false;
      let startX, startY, startLeft, startTop;

      // Restore saved position on load
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
          // Clamp to viewport so it can't be lost off-screen
          const maxLeft = window.innerWidth - widget.offsetWidth - 8;
          const maxTop = window.innerHeight - widget.offsetHeight - 8;
          widget.style.right = 'auto';
          widget.style.left = Math.min(Math.max(0, saved.left), maxLeft) + 'px';
          widget.style.top  = Math.min(Math.max(0, saved.top),  maxTop)  + 'px';
        }
      } catch (e) { /* ignore */ }

      widget.addEventListener('mousedown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        isDragging = true;
        widget.classList.add('gc-dragging');
        const rect = widget.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop  = rect.top;
        widget.style.right = 'auto';
        widget.style.left  = startLeft + 'px';
        widget.style.top   = startTop  + 'px';
        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        widget.style.left = (startLeft + (e.clientX - startX)) + 'px';
        widget.style.top  = (startTop  + (e.clientY - startY)) + 'px';
      });

      document.addEventListener('mouseup', function () {
        if (!isDragging) return;
        isDragging = false;
        widget.classList.remove('gc-dragging');
        // Save position to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            left: parseFloat(widget.style.left),
            top:  parseFloat(widget.style.top),
          }));
        } catch (e) { /* ignore */ }
      });
    })();

    const btn = document.getElementById('gc-asin-btn');
    if (btn) {
      btn.addEventListener('click', handleSearch);
    }

    const inputEl = document.getElementById('gc-asin-input');
    if (inputEl) {
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          handleSearch();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Audit dashboard code path
  // ---------------------------------------------------------------------------

  function runAuditPage() {

    // Task 6.5 — Banner styles
    GM_addStyle(`
      #gc-autofill-banner {
        position: fixed;
        top: 60px;
        right: 12px;
        z-index: 999998;
        background: #0073bb;
        color: #fff;
        border-radius: 6px;
        padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
    `);

    // -------------------------------------------------------------------------
    // Task 6.1 — showBanner(asin)
    // -------------------------------------------------------------------------

    function showBanner(asin) {
      const banner = document.createElement('div');
      banner.id = 'gc-autofill-banner';
      banner.textContent = `Auto-filling audit filters for ASIN: ${asin}…`;
      document.body.appendChild(banner);
      setTimeout(function () {
        const el = document.getElementById('gc-autofill-banner');
        if (el) el.remove();
      }, 8000);
    }

    // -------------------------------------------------------------------------
    // Task 6.1 — isFormReady()
    // -------------------------------------------------------------------------

    function isFormReady() {
      // Must have at least one text input
      const hasTextInput = !!document.querySelector('input[type="text"], input:not([type])');
      if (!hasTextInput) return false;

      // Must have a button whose text includes "Filter" (case-insensitive)
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim().toLowerCase().includes('filter')) return true;
      }
      return false;
    }

    // -------------------------------------------------------------------------
    // Task 6.2 — waitForForm(callback)
    // -------------------------------------------------------------------------

    function waitForForm(callback) {
      // Check immediately in case the form is already ready
      if (isFormReady()) {
        callback();
        return;
      }

      var tid = setTimeout(function () {
        obs.disconnect();
        console.warn('[GC ASIN Search] Audit form not found within 15s — auto-fill aborted');
        var banner = document.getElementById('gc-autofill-banner');
        if (banner) banner.remove();
      }, 15000);

      var obs = new MutationObserver(function () {
        if (isFormReady()) {
          obs.disconnect();
          clearTimeout(tid);
          callback();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    // -------------------------------------------------------------------------
    // Helper: findButtonByText(text)
    // -------------------------------------------------------------------------

    function findButtonByText(text) {
      var lower = text.toLowerCase();
      for (var btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim().toLowerCase().includes(lower)) return btn;
      }
      return null;
    }

    // -------------------------------------------------------------------------
    // Helper: dispatchMouseEvents(el)
    // -------------------------------------------------------------------------

    function dispatchMouseEvents(el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    // -------------------------------------------------------------------------
    // Task 6.3 — autoFillDatesAndAsin(asin)
    // -------------------------------------------------------------------------

    function autoFillDatesAndAsin(asin) {
      var range = getDateRange();
      var fromDate = range.fromDate;
      var fromTime = range.fromTime;
      var toDate = range.toDate;
      var toTime = range.toTime;

      // Find date inputs — try strategies in order
      var dateInputs = Array.from(document.querySelectorAll('input[placeholder="MM/DD/YYYY"]'));
      if (dateInputs.length < 2) {
        dateInputs = Array.from(document.querySelectorAll('input[aria-label*="date" i]'));
      }
      if (dateInputs.length < 2) {
        dateInputs = Array.from(document.querySelectorAll('input[type="text"]')).filter(function (el) {
          return /^\d{2}\/\d{2}\/\d{4}$/.test(el.value) || el.value === '';
        });
      }

      if (dateInputs.length >= 1) {
        setInputValue(dateInputs[0], fromDate);
      } else {
        console.warn('[GC ASIN Search] From-date input not found');
      }
      if (dateInputs.length >= 2) {
        setInputValue(dateInputs[1], toDate);
      } else {
        console.warn('[GC ASIN Search] To-date input not found');
      }

      // Find time inputs — try strategies in order
      var timeInputs = Array.from(document.querySelectorAll('input[placeholder="HH:MM"]'));
      if (timeInputs.length < 2) {
        timeInputs = Array.from(document.querySelectorAll('input[aria-label*="time" i]'));
      }
      if (timeInputs.length < 2) {
        timeInputs = Array.from(document.querySelectorAll('input[type="text"]')).filter(function (el) {
          return /^\d{2}:\d{2}$/.test(el.value) || el.placeholder === 'HH:MM';
        });
      }

      if (timeInputs.length >= 1) {
        setInputValue(timeInputs[0], fromTime);
      } else {
        console.warn('[GC ASIN Search] From-time input not found');
      }
      if (timeInputs.length >= 2) {
        setInputValue(timeInputs[1], toTime);
      } else {
        console.warn('[GC ASIN Search] To-time input not found');
      }

      // Find ASIN input — try strategies in order
      var asinInput =
        document.querySelector('input[placeholder*="asin" i]') ||
        document.querySelector('input[aria-label*="asin" i]') ||
        document.querySelector('input[placeholder*="product" i]') ||
        document.querySelector('input[placeholder*="item" i]');

      if (asinInput) {
        setInputValue(asinInput, asin);
      } else {
        console.warn('[GC ASIN Search] ASIN input not found');
      }
    }

    // -------------------------------------------------------------------------
    // Task 6.4 — autoFillProcesses()
    // -------------------------------------------------------------------------

    function autoFillProcesses() {
      var container = document.querySelector('[data-testid="process-select"]');
      if (!container) {
        console.warn('[GC ASIN Search] Process dropdown container not found');
        return;
      }

      var comboInput = container.querySelector('input[role="combobox"]') || container.querySelector('input');
      if (!comboInput) {
        console.warn('[GC ASIN Search] Combobox input not found');
        return;
      }

      function openDropdown(callback) {
        comboInput.focus();
        comboInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        comboInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        comboInput.click();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            callback();
          });
        });
      }

      openDropdown(function () {
        var allOptions = Array.from(document.querySelectorAll('[role="option"]')).map(function(el) {
          return el.textContent.trim();
        });
        console.log('[GC ASIN Search] Options found:', allOptions.length);

        var listbox = document.querySelector('[role="listbox"]');
        if (!listbox) { console.warn('[GC ASIN Search] No listbox'); return; }

        var fk = Object.keys(listbox).find(function(k) { return k.startsWith('__reactFiber'); });
        var fiber = listbox[fk];
        var depth = 0;
        var found = false;

        while (fiber && depth < 50) {
          var props = fiber.memoizedProps;
          if (props && props.onChange && props.value !== undefined) {
            var selected = allOptions.filter(function(opt) { return opt !== 'Outbound Pick'; });
            console.log('[GC ASIN Search] Calling onChange at depth', depth, 'with', selected.length, 'values');
            try {
              props.onChange(selected);
              found = true;
              console.log('[GC ASIN Search] onChange called with string array');
            } catch(e) {
              try {
                props.onChange(selected.map(function(s) { return { label: s, value: s }; }));
                found = true;
                console.log('[GC ASIN Search] onChange called with object array');
              } catch(e2) {
                console.warn('[GC ASIN Search] onChange failed:', e2.message);
              }
            }
            break;
          }
          fiber = fiber.return;
          depth++;
        }

        if (!found) {
          console.warn('[GC ASIN Search] Could not find onChange with value prop after', depth, 'levels');
        }

        setTimeout(function () {
          comboInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          setTimeout(function () {
            var filterBtn = findButtonByText('filter');
            if (filterBtn) {
              filterBtn.click();
              console.log('[GC ASIN Search] Clicked Filter');
            }
          }, 300);
        }, 500);
      });
    }

    // -------------------------------------------------------------------------
    // Task 6.5 — scheduleFills(asin)
    // -------------------------------------------------------------------------

    function scheduleFills(asin) {
      showBanner(asin);
      setTimeout(function () { autoFillDatesAndAsin(asin); }, 1000);
      setTimeout(function () { autoFillDatesAndAsin(asin); }, 2000);
      setTimeout(function () { autoFillProcesses(); }, 3000);
    }

    // -------------------------------------------------------------------------
    // Task 6.5 — Main runAuditPage logic
    // -------------------------------------------------------------------------

    var asin = getAsinFromHash(window.location.hash);
    if (!asin) return; // No valid ASIN in hash — do nothing

    // Use a fixed delay instead of form detection — the form renders async
    // and the MutationObserver was timing out before content loaded.
    // Start fills at 3s, retry at 5s, process selection at 7s.
    showBanner(asin);
    setTimeout(function () { autoFillDatesAndAsin(asin); }, 3000);
    setTimeout(function () { autoFillDatesAndAsin(asin); }, 5000);
    setTimeout(function () { autoFillProcesses(); }, 7000);
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------

  const url = window.location.href;

  if (url.includes('na.store-management.f3.amazon.dev')) {
    try {
      runWidgetPage();
    } catch (err) {
      console.warn('[GC ASIN Search] Error on widget page:', err);
    }
  } else if (url.includes('grocerycentral.amazon.dev/ihm-inventory-audit-dashboard')) {
    try {
      runAuditPage();
    } catch (err) {
      console.warn('[GC ASIN Search] Error on audit page:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Conditional export for test compatibility
  // ---------------------------------------------------------------------------

  if (typeof module !== 'undefined') {
    module.exports = { validateAsin, formatDate, getDateRange, getAsinFromHash, setInputValue };
  }
}());
