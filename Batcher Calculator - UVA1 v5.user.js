
// ==UserScript==
// @name         Batcher Calculator - UVA1 v5
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Blue floating box - auto-reads packages and In Progress from Como
// @match        *://como-operations-dashboard-iad.iad.proxy.amazon.com/*
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    // ============================================================
    //  UPDATE YOUR AVG BATCH RATE HERE
    // ============================================================
    var AVG_BATCH_RATE = 2.5;

    // ============================================================
    //  SCRAPE HELPER — grabs number from inside parentheses
    // ============================================================
    function getNumFromParens(str) {
        var a = str.indexOf("(");
        var b = str.indexOf(")", a);
        if (a < 0 || b < 0 || b <= a) return null;
        var s = str.substring(a + 1, b).replace(/,/g, "");
        var n = parseInt(s, 10);
        return isNaN(n) ? null : n;
    }

    // ============================================================
    //  SCRAPE COMO TOOLBAR
    // ============================================================
    function scrape() {
        var pkg = null;
        var ip = null;
        var els = document.querySelectorAll("*");
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.children.length > 3) continue;
            var t = (el.textContent || "").trim();
            if (t.length < 3 || t.length > 200) continue;
            if (pkg === null && t.indexOf("Packages") > -1 && t.indexOf("(") > -1) {
                var n1 = getNumFromParens(t);
                if (n1 !== null && n1 > 50) pkg = n1;
            }
            if (ip === null && t.indexOf("In Progress") > -1 && t.indexOf("(") > -1) {
                var n2 = getNumFromParens(t);
                if (n2 !== null && n2 >= 0) ip = n2;
            }
        }
        console.log("[Batcher Calc] Packages: " + pkg + " | In Progress: " + ip);
        return { packages: pkg, inProgress: ip };
    }

    // ============================================================
    //  STYLES — blue theme, right:220px to avoid BIGS overlap
    // ============================================================
    var css = document.createElement("style");
    css.textContent = [
        "#bc-float-box{position:fixed;bottom:20px;right:220px;z-index:99999;",
        "background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2);",
        "color:#fff;border-radius:16px;padding:16px 22px;min-width:240px;",
        "box-shadow:0 8px 30px rgba(13,71,161,0.5);",
        "font-family:Amazon Ember,Arial,sans-serif;user-select:none}",
        "#bc-float-box:hover{box-shadow:0 10px 40px rgba(13,71,161,0.65)}",
        "#bc-float-box .bc-title-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}",
        "#bc-float-box .bc-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:.8}",
        "#bc-float-box .bc-site{background:rgba(255,255,255,.2);padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700}",
        "#bc-float-box .bc-number{font-size:42px;font-weight:800;line-height:1;text-align:center;margin:4px 0}",
        "#bc-float-box .bc-label{font-size:13px;font-weight:600;text-align:center;opacity:.9;margin-bottom:8px}",
        "#bc-float-box .bc-details{font-size:10px;opacity:.7;text-align:center;line-height:1.5;border-top:1px solid rgba(255,255,255,.2);padding-top:8px}",
        "#bc-float-box .bc-delta-section{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.2)}",
        "#bc-float-box .bc-delta-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px}",
        "#bc-float-box .bc-delta-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.7}",
        "#bc-float-box .bc-delta-input{width:60px;padding:5px 8px;border:2px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font-size:14px;font-weight:700;text-align:center;font-family:Amazon Ember,Arial,sans-serif;outline:none}",
        "#bc-float-box .bc-delta-input::placeholder{color:rgba(255,255,255,.4);font-weight:400}",
        "#bc-float-box .bc-delta-input:focus{border-color:rgba(255,255,255,.7);background:rgba(255,255,255,.2)}",
        "#bc-float-box .bc-delta-result{display:none;margin-top:8px;padding:8px 12px;border-radius:10px;font-size:14px;font-weight:700;text-align:center}",
        "#bc-float-box .bc-delta-result.need-more{background:rgba(255,255,255,.2);color:#BBDEFB}",
        "#bc-float-box .bc-delta-result.can-release{background:rgba(76,175,80,.3);color:#A5D6A7}",
        "#bc-float-box .bc-delta-result.perfect{background:rgba(255,255,255,.15);color:#FFF}",
        "#bc-float-box .bc-status{display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;margin-top:8px}",
        "#bc-float-box .bc-dot{width:6px;height:6px;border-radius:50%;display:inline-block}",
        "#bc-float-box .bc-dot.green{background:#69F0AE;box-shadow:0 0 6px #69F0AE}",
        "#bc-float-box .bc-dot.gray{background:rgba(255,255,255,.4)}",
        "#bc-float-box .bc-refresh-btn{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 10px;border-radius:6px;font-size:9px;cursor:pointer;margin-left:6px}",
        "#bc-float-box .bc-refresh-btn:hover{background:rgba(255,255,255,.3)}"
    ].join("");
    document.head.appendChild(css);

    // ============================================================
    //  BUILD THE BOX — v3 structure with editable input
    // ============================================================
    var box = document.createElement("div");
    box.id = "bc-float-box";
    box.innerHTML = [
        '<div class="bc-title-row">',
        '<span class="bc-title">Batchers Needed</span>',
        '<span class="bc-site">UVA1</span>',
        '</div>',
        '<div class="bc-number" id="bc-number">--</div>',
        '<div class="bc-label">batchers needed</div>',
        '<div class="bc-details" id="bc-details">Scanning Como...</div>',
        '<div class="bc-delta-section">',
        '<div class="bc-delta-row">',
        '<span class="bc-delta-label">Current Batchers:</span>',
        '<input type="number" class="bc-delta-input" id="bc-current" placeholder="0">',
        '</div>',
        '<div class="bc-delta-result" id="bc-delta-result"></div>',
        '</div>',
        '<div class="bc-status">',
        '<span class="bc-dot gray" id="bc-dot"></span>',
        '<span id="bc-status-text">Scanning...</span>',
        '<button class="bc-refresh-btn" id="bc-refresh">Refresh</button>',
        '</div>'
    ].join("");
    document.body.appendChild(box);

    // ============================================================
    //  STATE + CALCULATION
    // ============================================================
    var currentNeeded = null;

    function calculate(packages) {
        if (!packages || packages <= 0) return null;
        return packages / AVG_BATCH_RATE / 60;
    }

    // ============================================================
    //  DELTA LOGIC
    // ============================================================
    function updateDelta() {
        var input = document.getElementById("bc-current");
        var dd = document.getElementById("bc-delta-result");
        var cur = parseInt(input.value, 10);
        if (isNaN(cur) || currentNeeded === null) {
            dd.style.display = "none";
            return;
        }
        var diff = currentNeeded - cur;
        dd.style.display = "block";
        if (diff > 0) {
            dd.className = "bc-delta-result need-more";
            dd.innerHTML = "Need <strong>" + diff + "</strong> more batcher" + (diff !== 1 ? "s" : "");
        } else if (diff < 0) {
            var rel = Math.abs(diff);
            dd.className = "bc-delta-result can-release";
            dd.innerHTML = "Can release <strong>" + rel + "</strong> batcher" + (rel !== 1 ? "s" : "");
        } else {
            dd.className = "bc-delta-result perfect";
            dd.innerHTML = "Staffed perfectly";
        }
    }

    // ============================================================
    //  RENDER — updates box + auto-fills In Progress
    // ============================================================
    function render(packages, inProgress) {
        var raw = calculate(packages);
        if (raw === null) return;
        currentNeeded = Math.ceil(raw);
        document.getElementById("bc-number").textContent = currentNeeded;
        document.getElementById("bc-details").textContent = packages.toLocaleString() + " pkg / " + AVG_BATCH_RATE + " rate / 60 = " + raw.toFixed(2);
        var dot = document.getElementById("bc-dot");
        var st = document.getElementById("bc-status-text");
        dot.className = "bc-dot green";
        var d = new Date();
        var hh = d.getHours();
        var mm = d.getMinutes();
        var ampm = hh >= 12 ? "PM" : "AM";
        hh = hh % 12;
        if (hh === 0) hh = 12;
        if (mm < 10) mm = "0" + mm;
        st.textContent = "Live - " + hh + ":" + mm + " " + ampm;
        if (inProgress !== null) {
            document.getElementById("bc-current").value = inProgress;
        }
        updateDelta();
    }

    // ============================================================
    //  REFRESH
    // ============================================================
    function doRefresh() {
        var data = scrape();
        if (data.packages) {
            render(data.packages, data.inProgress);
            return true;
        }
        return false;
    }

    // ============================================================
    //  EVENT LISTENERS
    // ============================================================
    document.getElementById("bc-current").addEventListener("input", updateDelta);

    document.getElementById("bc-refresh").addEventListener("click", function() {
        if (!doRefresh()) {
            alert("Could not read Como toolbar. Make sure Packages and Tasks bars are visible.");
        }
    });

    // ============================================================
    //  BOOT — retry scrape while Como loads
    // ============================================================
    var tries = 10;
    function boot() {
        if (!doRefresh() && tries > 0) {
            tries--;
            setTimeout(boot, 2000);
        }
    }
    setTimeout(boot, 2000);

    // Auto-refresh every 30 seconds
    setInterval(doRefresh, 30000);

})();

