// ==UserScript==
// @name         Engage Coaching Tracker
// @namespace    http://tampermonkey.net/
// @version      6.3
// @description  Multi-type coaching alerts on Engage
// @author       Orcha + Eitan Wiernik
// @match        https://atoz.amazon.work/engage/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      gist.githubusercontent.com
// @updateURL    https://gist.githubusercontent.com/ewiernik/YOUR_SCRIPT_GIST_ID/raw/engage-coaching-tracker.user.js
// @downloadURL  https://gist.githubusercontent.com/ewiernik/YOUR_SCRIPT_GIST_ID/raw/engage-coaching-tracker.user.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    var DATA_URL = 'https://gist.githubusercontent.com/ewiernik/4ce4806cd3dc221220f7f9295460305a/raw/missed_meals_ids.txt';
    var GRAPHQL_ENDPOINT = 'https://atoz.amazon.work/apis/AtoZEngageNA/graphql/access';

    var TYPE_CONFIG = {
        MEAL:  { bg: '#DC3545', label: 'Missed Meal' },
        PUNCH: { bg: '#E67E22', label: 'Punchin >15m' },
        TOT:   { bg: '#8E44AD', label: 'TOT' },
        QUAL:  { bg: '#2980B9', label: 'Quality' },
        SAFE:  { bg: '#27AE60', label: 'Safety' }
    };
    var DEFAULT_TYPE = { bg: '#6c757d', label: 'Coach' };

    var trackedByEmpId = {};
    var trackedByLogin = {};
    var dataLoaded = false;
    var engageEmployees = [];
    var currentMatches = [];
    var managerLogins = [];
    var pageCount = 0;

    function extractManagerLogins() {
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var filters = urlParams.get('filters');
            if (filters) {
                var decoded = JSON.parse(filters);
                for (var i = 0; i < decoded.length; i++) {
                    if (decoded[i][0] === 'manager') {
                        managerLogins = decoded[i][1].split(',');
                        return;
                    }
                }
            }
        } catch(e) {}
    }

    function fetchEngageData(skip, allHits) {
        skip = skip || 0;
        allHits = allHits || [];
        if (managerLogins.length === 0) return;
        var managerList = managerLogins.map(function(m) { return '\\"' + m + '\\"'; }).join(',');
        var query = {
            operationName: "fetchTeamTableData",
            variables: { withBehindTheSmile: false },
            query: 'query fetchTeamTableData($withBehindTheSmile: Boolean) { employeesWithRecommendationsBySubject( input: {take: 100, skip: ' + skip + ', filters: [{type: EMPLOYEE, key: "managerLogin", operator: IN, value: "[' + managerList + ']"}, {type: EMPLOYEE, key: "isManager", operator: EQ, value: "false"}, {type: METRIC, key: "onPremise", operator: NON_NULLISH}], sorts: [{type: METRIC, key: "lastEngaged", dataKey: "engagementTime", direction: DESC_NULLISH_LAST}], withBehindTheSmile: $withBehindTheSmile} ) { total hits { employeeId login firstName lastName fullName managerLogin shiftPattern employeeSite metrics { metricId data __typename } __typename } __typename } }'
        };
        fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(query)
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var result = data && data.data && data.data.employeesWithRecommendationsBySubject;
            if (!result) return;
            var hits = result.hits || [];
            var total = result.total || 0;
            allHits = allHits.concat(hits);
            pageCount++;
            if (allHits.length < total) {
                fetchEngageData(allHits.length, allHits);
            } else {
                engageEmployees = allHits;
                console.log('[CoachTracker] ' + engageEmployees.length + ' on-premise employees loaded');
                if (dataLoaded) matchAndAlert();
            }
        })
        .catch(function(err) { console.error('[CoachTracker] API error:', err); });
    }

    function fetchData() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: DATA_URL + '?t=' + Date.now(),
            onload: function(response) {
                if (response.status === 200) {
                    parseData(response.responseText);
                    dataLoaded = true;
                    GM_setValue('ctCache', response.responseText);
                    var total = Object.keys(trackedByEmpId).length + Object.keys(trackedByLogin).length;
                    console.log('[CoachTracker] ' + total + ' entries loaded');
                    updateButton();
                    if (engageEmployees.length > 0) matchAndAlert();
                } else { loadCache(); }
            },
            onerror: function() { loadCache(); }
        });
    }

    function parseData(text) {
        var lines = text.trim().split('\n');
        trackedByEmpId = {};
        trackedByLogin = {};
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/\r/g, '');
            var parts = line.split(',');
            var key = (parts[0] || '').trim();
            if (!key) continue;
            var entry = {
                count: parseInt(parts[1]) || 0,
                date: (parts[2] || '').trim(),
                type: (parts[3] || 'MEAL').trim().toUpperCase()
            };
            if (key.indexOf('login:') === 0) {
                var login = key.substring(6).toLowerCase().trim();
                if (!trackedByLogin[login]) trackedByLogin[login] = [];
                trackedByLogin[login].push(entry);
            } else if (key.length >= 6) {
                if (!trackedByEmpId[key]) trackedByEmpId[key] = [];
                trackedByEmpId[key].push(entry);
            }
        }
    }

    function loadCache() {
        var cached = GM_getValue('ctCache', null);
        if (cached) {
            parseData(cached);
            dataLoaded = true;
            updateButton();
            if (engageEmployees.length > 0) matchAndAlert();
        }
    }

    function getTypeConfig(type) {
        return TYPE_CONFIG[type] || DEFAULT_TYPE;
    }

    function matchAndAlert() {
        currentMatches = [];
        for (var i = 0; i < engageEmployees.length; i++) {
            var emp = engageEmployees[i];
            var empId = String(emp.employeeId);
            var login = (emp.login || '').toLowerCase();
            var onPremMetric = emp.metrics ? emp.metrics.find(function(m) { return m.metricId === 'onPremise'; }) : null;
            var isOnPremise = onPremMetric && onPremMetric.data && onPremMetric.data.value;
            if (!isOnPremise) continue;

            var alerts = [];
            if (trackedByEmpId[empId]) alerts = alerts.concat(trackedByEmpId[empId]);
            if (trackedByLogin[login]) alerts = alerts.concat(trackedByLogin[login]);

            if (alerts.length > 0) {
                currentMatches.push({
                    empId: empId,
                    login: login,
                    name: emp.fullName || ((emp.firstName || '') + ' ' + (emp.lastName || '')).trim(),
                    manager: emp.managerLogin || '',
                    site: emp.employeeSite || '',
                    shift: emp.shiftPattern || '',
                    alerts: alerts
                });
            }
        }
        currentMatches.sort(function(a, b) {
            var aTotal = a.alerts.reduce(function(s, x) { return s + x.count; }, 0);
            var bTotal = b.alerts.reduce(function(s, x) { return s + x.count; }, 0);
            return bTotal - aTotal;
        });
        console.log('[CoachTracker] ' + currentMatches.length + ' matches found');
        // Debug: log first 3 matches with their alerts
        for (var d = 0; d < Math.min(3, currentMatches.length); d++) {
            var dm = currentMatches[d];
            console.log('[CoachTracker] Match ' + d + ': ' + dm.name + ' (' + dm.login + ') empId=' + dm.empId + ' alerts=' + JSON.stringify(dm.alerts));
        }
        highlightRows();
        updatePanel();
        updateButton();
    }

    // STYLES
    var styles = document.createElement('style');
    styles.textContent = [
        '#mm-btn { position: fixed; bottom: 20px; right: 20px; z-index: 99999; background: #DC3545; color: white; border: none; border-radius: 50px; padding: 12px 20px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(220,53,69,0.4); transition: all 0.3s ease; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }',
        '#mm-btn:hover { transform: scale(1.05); }',
        '#mm-btn.ok { background: #28a745; box-shadow: 0 4px 15px rgba(40,167,69,0.4); }',
        '#mm-btn.loading { background: #6c757d; }',
        '.mm-badge { display: inline-block; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; margin-right: 4px; margin-top: 2px; white-space: nowrap; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }',
        '.mm-row { background: #FFF0F0 !important; border-left: 4px solid #FF4444 !important; }',
        '#mm-panel { position: fixed; bottom: 80px; right: 20px; z-index: 99999; background: white; border: 1px solid #ddd; border-radius: 12px; padding: 20px; width: 400px; max-height: 500px; overflow-y: auto; box-shadow: 0 8px 30px rgba(0,0,0,0.15); display: none; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }',
        '#mm-panel.visible { display: block; }',
        '#mm-panel h3 { margin: 0 0 12px 0; font-size: 16px; color: #333; }',
        '#mm-panel .mm-close { position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }',
        '#mm-panel .mm-list { max-height: 350px; overflow-y: auto; }',
        '#mm-panel .mm-item { padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }',
        '#mm-panel .mm-item:last-child { border-bottom: none; }',
        '#mm-panel .mm-item-name { font-weight: 700; color: #333; }',
        '#mm-panel .mm-item-detail { font-size: 11px; color: #888; margin-top: 3px; }',
        '#mm-panel .mm-item-alerts { margin-top: 4px; }',
        '#mm-panel .mm-summary { background: #f8d7da; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 13px; color: #721c24; font-weight: 600; }',
        '#mm-panel .mm-allclear { background: #d4edda; border-radius: 8px; padding: 10px; font-size: 13px; color: #155724; }',
        '#mm-panel .mm-type-summary { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }',
        '#mm-panel .mm-type-pill { padding: 2px 10px; border-radius: 10px; color: white; font-size: 11px; font-weight: 700; display: inline-block; }'
    ].join(' ');
    document.head.appendChild(styles);

    // ROW HIGHLIGHTING
    function highlightRows() {
        document.querySelectorAll('.mm-badge').forEach(function(el) { if (!el.closest('#mm-panel')) el.remove(); });
        document.querySelectorAll('.mm-row').forEach(function(el) { el.classList.remove('mm-row'); });
        if (currentMatches.length === 0) return;

        var byLogin = {};
        currentMatches.forEach(function(m) { byLogin[m.login] = m; });
        var tagged = {};

        var allSpans = document.querySelectorAll('span, a, div, p');
        for (var i = 0; i < allSpans.length; i++) {
            var el = allSpans[i];
            if (el.children.length > 2) continue;
            var text = el.textContent ? el.textContent.trim().toLowerCase() : '';
            if (!text || text.length > 50) continue;

            for (var login in byLogin) {
                if (text.indexOf(login) !== -1 && !tagged[login]) {
                    var match = byLogin[login];
                    tagged[login] = true;

                    var row = el.closest('tr, [class*="row"], [class*="card"], [class*="list-item"], [role="row"]');
                    if (row) row.classList.add('mm-row');

                    var nameArea = (row ? row.querySelector('a') : null) || el;
                    if (nameArea && !nameArea.parentNode.querySelector('.mm-badge')) {
                        for (var j = 0; j < match.alerts.length; j++) {
                            var badge = document.createElement('span');
                            badge.className = 'mm-badge';
                            var cfg = getTypeConfig(match.alerts[j].type);
                            badge.style.cssText = 'background:' + cfg.bg + ';';
                            badge.textContent = match.alerts[j].count + 'x ' + cfg.label + ' \u2022 ' + match.alerts[j].date;
                            nameArea.parentNode.appendChild(badge);
                        }
                    }
                    break;
                }
            }
        }
    }

    var observer = new MutationObserver(function() {
        if (currentMatches.length > 0) {
            clearTimeout(window._mmTimer);
            window._mmTimer = setTimeout(highlightRows, 600);
        }
    });

    // BUTTON
    function createButton() {
        var btn = document.createElement('button');
        btn.id = 'mm-btn';
        btn.className = 'loading';
        btn.innerHTML = '\u23F3 Coaching Tracker';
        btn.onclick = togglePanel;
        var isDragging = false, offsetX, offsetY;
        btn.addEventListener('mousedown', function(e) {
            isDragging = false;
            offsetX = e.clientX - btn.getBoundingClientRect().left;
            offsetY = e.clientY - btn.getBoundingClientRect().top;
            function onMove(e) {
                isDragging = true;
                btn.style.right = 'auto';
                btn.style.bottom = 'auto';
                btn.style.left = (e.clientX - offsetX) + 'px';
                btn.style.top = (e.clientY - offsetY) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (isDragging) {
                    GM_setValue('btnPos', JSON.stringify({left: btn.style.left, top: btn.style.top}));
                }
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        btn.addEventListener('click', function(e) {
            if (isDragging) { e.stopImmediatePropagation(); isDragging = false; }
        }, true);
        document.body.appendChild(btn);
        var saved = GM_getValue('btnPos', null);
        if (saved) {
            var pos = JSON.parse(saved);
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
            btn.style.left = pos.left;
            btn.style.top = pos.top;
        }
        return btn;
    }

    function updateButton() {
        var btn = document.getElementById('mm-btn');
        if (!btn) return;
        if (currentMatches.length > 0) {
            btn.className = '';
            btn.innerHTML = '\u{1F6A8} Coaching Tracker (' + currentMatches.length + ')';
        } else if (dataLoaded && engageEmployees.length > 0) {
            btn.className = 'ok';
            btn.innerHTML = '\u2705 Coaching Tracker';
        } else if (dataLoaded) {
            btn.className = 'ok';
            btn.innerHTML = '\u2705 Coaching Tracker';
        } else {
            btn.className = 'loading';
            btn.innerHTML = '\u23F3 Coaching Tracker';
        }
    }

    // PANEL
    function createPanel() {
        var p = document.createElement('div');
        p.id = 'mm-panel';
        p.innerHTML = '<button class="mm-close" id="mm-close">&times;</button><h3>\u{1F6A8} Coaching Tracker \u2014 On Site Now</h3><div id="mm-content"></div>';
        document.body.appendChild(p);
        document.getElementById('mm-close').onclick = function() { p.classList.remove('visible'); };
        return p;
    }

    function togglePanel() {
        var p = document.getElementById('mm-panel');
        if (!p) p = createPanel();
        p.classList.toggle('visible');
        updatePanel();
    }

    function updatePanel() {
        var content = document.getElementById('mm-content');
        if (!content) return;

        if (currentMatches.length === 0) {
            if (engageEmployees.length > 0) {
                content.innerHTML = '<div class="mm-allclear">\u2705 No tracked employees currently on site. All clear!</div>';
            } else {
                content.innerHTML = '<p style="color:#666;font-size:13px;">Loading employee data...</p>';
            }
            return;
        }

        // Count by type
        var typeCounts = {};
        for (var i = 0; i < currentMatches.length; i++) {
            for (var j = 0; j < currentMatches[i].alerts.length; j++) {
                var t = currentMatches[i].alerts[j].type;
                typeCounts[t] = (typeCounts[t] || 0) + 1;
            }
        }

        var html = '<div class="mm-summary">\u{1F6A8} ' + currentMatches.length + ' employee(s) on site need coaching';
        html += '<div class="mm-type-summary">';
        for (var type in typeCounts) {
            var cfg = getTypeConfig(type);
            html += '<span class="mm-type-pill" style="background:' + cfg.bg + ';">' + typeCounts[type] + ' ' + cfg.label + '</span>';
        }
        html += '</div></div><div class="mm-list">';

        for (var k = 0; k < currentMatches.length; k++) {
            var m = currentMatches[k];
            html += '<div class="mm-item">';
            html += '<span class="mm-item-name">' + m.name + '</span>';
            html += '<div class="mm-item-alerts">';
            for (var a = 0; a < m.alerts.length; a++) {
                var acfg = getTypeConfig(m.alerts[a].type);
                html += '<span class="mm-badge" style="background:' + acfg.bg + ';">' + m.alerts[a].count + 'x ' + acfg.label + ' \u2022 ' + m.alerts[a].date + '</span>';
            }
            html += '</div>';
            html += '<div class="mm-item-detail">' + m.login + ' \u2022 Mgr: ' + m.manager + ' \u2022 ' + m.shift + '</div>';
            html += '</div>';
        }
        html += '</div>';
        content.innerHTML = html;
    }

    // INIT
    console.log('[CoachTracker] v6.1 loaded');
    createButton();
    extractManagerLogins();
    fetchData();
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function() { if (managerLogins.length > 0) fetchEngageData(); }, 2000);
    setInterval(function() { if (managerLogins.length > 0) { pageCount = 0; engageEmployees = []; fetchEngageData(); } }, 5 * 60 * 1000);
    setInterval(fetchData, 10 * 60 * 1000);
})();
