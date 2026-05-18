
// ==UserScript==
// @name         GFC Bottom 5 & Top 5 Performers by Zone Tracker - Collapsible Zones
// @namespace    http://tampermonkey.net/
// @version      14.1
// @description  Track bottom 5 and top 5 performers with collapsible zones - Powered by Matti AI
// @author       Matti AI
// @match        https://na.store-management.f3.amazon.dev/labortracking/drilldown/search*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('=== Bottom 5 & Top 5 Performers Tracker Started (Collapsible Zones) - Powered by Matti AI ===');

    let isCollapsed = false;
    let retryCount = 0;
    const MAX_RETRIES = 15;
    let minHours = 0.25;
    let activeTab = 'bottom';
    let zoneCollapsedState = {
        ambient: false,
        bigs: false,
        chilled: false,
        freezer: false
    };

    function createTrackerPanel() {
        console.log('Step 1: Creating tracker panel');

        const panel = document.createElement('div');
        panel.id = 'bottom-performers-panel';
        panel.style.cssText = 'position: fixed; top: 20px; right: 20px; width: 450px; max-height: 90vh; overflow-y: auto; background: white; border: 2px solid #FF9900; border-radius: 8px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-family: Arial, sans-serif; transition: all 0.3s ease;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF9900;';

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const title = document.createElement('h2');
        title.id = 'panel-title';
        title.textContent = 'Bottom 5 Performers by Zone';
        title.style.cssText = 'margin: 0; font-size: 18px; color: [MAC_ADDRESS];';

        const collapseButton = document.createElement('button');
        collapseButton.id = 'collapse-button';
        collapseButton.innerHTML = '−';
        collapseButton.style.cssText = 'background: [MAC_ADDRESS]; color: white; border: none; border-radius: 4px; width: 30px; height: 30px; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;';

        collapseButton.addEventListener('mouseenter', function() {
            collapseButton.style.background = '#37475A';
        });

        collapseButton.addEventListener('mouseleave', function() {
            collapseButton.style.background = '[MAC_ADDRESS]';
        });

        collapseButton.addEventListener('click', function() {
            toggleCollapse();
        });

        titleContainer.appendChild(title);
        titleContainer.appendChild(collapseButton);

        const liveIndicator = document.createElement('div');
        liveIndicator.style.cssText = 'background: #d13212; color: white; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 6px;';
        liveIndicator.innerHTML = '<span style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: blink 1s infinite;"></span>LIVE';

        header.appendChild(titleContainer);
        header.appendChild(liveIndicator);

        const contentWrapper = document.createElement('div');
        contentWrapper.id = 'content-wrapper';
        contentWrapper.style.cssText = 'transition: all 0.3s ease;';

        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px;';

        const bottomTabButton = document.createElement('button');
        bottomTabButton.id = 'bottom-tab-button';
        bottomTabButton.textContent = 'Bottom 5';
        bottomTabButton.style.cssText = 'flex: 1; padding: 8px; border: 2px solid #FF9900; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer; background: #FF9900; color: white; transition: all 0.2s;';

        const topTabButton = document.createElement('button');
        topTabButton.id = 'top-tab-button';
        topTabButton.textContent = 'Top 5';
        topTabButton.style.cssText = 'flex: 1; padding: 8px; border: 2px solid #FF9900; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer; background: white; color: #FF9900; transition: all 0.2s;';

        bottomTabButton.addEventListener('click', function() {
            switchTab('bottom');
        });

        topTabButton.addEventListener('click', function() {
            switchTab('top');
        });

        tabContainer.appendChild(bottomTabButton);
        tabContainer.appendChild(topTabButton);

        const selectorContainer = document.createElement('div');
        selectorContainer.style.cssText = 'margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px;';

        const selectorLeftGroup = document.createElement('div');
        selectorLeftGroup.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const selectorLabel = document.createElement('label');
        selectorLabel.textContent = 'Min Time:';
        selectorLabel.style.cssText = 'font-size: 13px; font-weight: bold; color: [MAC_ADDRESS];';

        const selector = document.createElement('select');
        selector.id = 'time-interval-selector';
        selector.style.cssText = 'padding: 6px 10px; border: 1px solid #FF9900; border-radius: 4px; font-size: 13px; cursor: pointer; background: white;';

        const intervals = [
            { value: 0.25, label: '15 minutes' },
            { value: 0.5, label: '30 minutes' },
            { value: 0.75, label: '45 minutes' },
            { value: 1.0, label: '60 minutes' }
        ];

        intervals.forEach(function(interval) {
            const option = document.createElement('option');
            option.value = interval.value;
            option.textContent = interval.label;
            if (interval.value === minHours) {
                option.selected = true;
            }
            selector.appendChild(option);
        });

        selector.addEventListener('change', function() {
            minHours = parseFloat(this.value);
            console.log('Time interval changed to: ' + minHours + ' hours');
            updateDisplay();
        });

        selectorLeftGroup.appendChild(selectorLabel);
        selectorLeftGroup.appendChild(selector);

        const brandingBadge = document.createElement('div');
        brandingBadge.style.cssText = 'font-size: 11px; color: #666; font-weight: bold; padding: 4px 10px; background: #FFF3E0; border: 1px solid #FF9900; border-radius: 4px; white-space: nowrap;';
        brandingBadge.innerHTML = '<span style="color: #FF9900;">⚡</span> Powered by Matti AI';

        selectorContainer.appendChild(selectorLeftGroup);
        selectorContainer.appendChild(brandingBadge);

        const filterInfo = document.createElement('div');
        filterInfo.id = 'filter-info';
        filterInfo.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 10px; font-style: italic;';
        filterInfo.textContent = 'Showing associates with > 0.25 hours worked';

        const lastUpdate = document.createElement('div');
        lastUpdate.id = 'last-update-time';
        lastUpdate.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';

        const content = document.createElement('div');
        content.id = 'performers-content';
        content.innerHTML = '<p style="color: #FF9900; font-weight: bold;">Loading data...</p>';

        contentWrapper.appendChild(tabContainer);
        contentWrapper.appendChild(selectorContainer);
        contentWrapper.appendChild(filterInfo);
        contentWrapper.appendChild(lastUpdate);
        contentWrapper.appendChild(content);

        panel.appendChild(header);
        panel.appendChild(contentWrapper);

        const style = document.createElement('style');
        style.textContent = '@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.3; } } #bottom-performers-panel::-webkit-scrollbar { width: 8px; } #bottom-performers-panel::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; } #bottom-performers-panel::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; } #bottom-performers-panel::-webkit-scrollbar-thumb:hover { background: #555; }';
        document.head.appendChild(style);

        document.body.appendChild(panel);
        console.log('Step 2: Tracker panel created');
    }

    function switchTab(tab) {
        activeTab = tab;
        const bottomButton = document.getElementById('bottom-tab-button');
        const topButton = document.getElementById('top-tab-button');
        const panelTitle = document.getElementById('panel-title');

        if (tab === 'bottom') {
            bottomButton.style.background = '#FF9900';
            bottomButton.style.color = 'white';
            topButton.style.background = 'white';
            topButton.style.color = '#FF9900';
            panelTitle.textContent = 'Bottom 5 Performers by Zone';
        } else {
            topButton.style.background = '#FF9900';
            topButton.style.color = 'white';
            bottomButton.style.background = 'white';
            bottomButton.style.color = '#FF9900';
            panelTitle.textContent = 'Top 5 Performers by Zone';
        }

        updateDisplay();
    }

    function toggleZone(zoneName) {
        const zoneKey = zoneName.toLowerCase();
        zoneCollapsedState[zoneKey] = !zoneCollapsedState[zoneKey];

        const zoneContent = document.getElementById('zone-content-' + zoneKey);
        const zoneToggle = document.getElementById('zone-toggle-' + zoneKey);

        if (zoneContent && zoneToggle) {
            if (zoneCollapsedState[zoneKey]) {
                zoneContent.style.maxHeight = '0';
                zoneContent.style.overflow = 'hidden';
                zoneContent.style.opacity = '0';
                zoneToggle.innerHTML = '+';
            } else {
                zoneContent.style.maxHeight = '1000px';
                zoneContent.style.overflow = 'visible';
                zoneContent.style.opacity = '1';
                zoneToggle.innerHTML = '−';
            }
        }
    }

    function toggleCollapse() {
        const panel = document.getElementById('bottom-performers-panel');
        const contentWrapper = document.getElementById('content-wrapper');
        const collapseButton = document.getElementById('collapse-button');

        if (!panel || !contentWrapper || !collapseButton) return;

        isCollapsed = !isCollapsed;

        if (isCollapsed) {
            contentWrapper.style.maxHeight = '0';
            contentWrapper.style.overflow = 'hidden';
            contentWrapper.style.opacity = '0';
            panel.style.width = '300px';
            collapseButton.innerHTML = '+';
            console.log('Panel collapsed');
        } else {
            contentWrapper.style.maxHeight = '2000px';
            contentWrapper.style.overflow = 'visible';
            contentWrapper.style.opacity = '1';
            panel.style.width = '450px';
            collapseButton.innerHTML = '−';
            console.log('Panel expanded');
        }
    }

    function formatTimestamp() {
        const now = new Date();
        const options = {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        return now.toLocaleString('en-US', options) + ' CST';
    }

    function checkDataReady() {
        const associateCells = document.querySelectorAll('td.associateId');
        console.log('Check: Found ' + associateCells.length + ' associate cells');
        return associateCells.length > 0;
    }

    function extractPerformanceData() {
        console.log('Step 3: Extracting performance data (attempt ' + (retryCount + 1) + ') with min hours: ' + minHours);

        const associateCells = document.querySelectorAll('td.associateId');
        console.log('Step 3a: Found ' + associateCells.length + ' associate cells');

        if (associateCells.length === 0) {
            console.log('Step 3b: No associate cells found');
            return null;
        }

        const allRecords = [];

        associateCells.forEach(function(associateCell, index) {
            const row = associateCell.closest('tr');
            if (!row) {
                return;
            }

            const zoneCellQuery = row.querySelector('td.zone');
            const rateCellQuery = row.querySelector('td.rate');
            const unitsCellQuery = row.querySelector('td.units');
            const durationCellQuery = row.querySelector('td.duration');

            if (!zoneCellQuery || !rateCellQuery || !durationCellQuery) {
                return;
            }

            const associateId = associateCell.textContent.trim();
            const zone = zoneCellQuery.textContent.trim().toLowerCase();
            const rateText = rateCellQuery.textContent.trim();
            const rate = parseFloat(rateText.replace(/[^0-9.]/g, '')) || 0;
            const units = unitsCellQuery ? (parseFloat(unitsCellQuery.textContent.trim().replace(/[^0-9.]/g, '')) || 0) : 0;
            const duration = parseFloat(durationCellQuery.textContent.trim().replace(/[^0-9.]/g, '')) || 0;

            if (associateId && zone && rate > 0 && duration > minHours) {
                allRecords.push({
                    associateId: associateId,
                    zone: zone,
                    rate: rate,
                    units: units,
                    duration: duration
                });
            }
        });

        console.log('Step 4: Extracted ' + allRecords.length + ' records (filtered for > ' + minHours + ' hours)');

        if (allRecords.length === 0) {
            console.log('Step 4a: No valid records extracted after filtering');
            return null;
        }

        return categorizeByZone(allRecords);
    }

    function categorizeByZone(allRecords) {
        const associateZoneMap = {};

        allRecords.forEach(function(record) {
            const key = record.associateId + '_' + record.zone;

            if (!associateZoneMap[key]) {
                associateZoneMap[key] = {
                    associateId: record.associateId,
                    zone: record.zone,
                    rates: [],
                    totalUnits: 0,
                    totalDuration: 0
                };
            }

            associateZoneMap[key].rates.push(record.rate);
            associateZoneMap[key].totalUnits += record.units;
            associateZoneMap[key].totalDuration += record.duration;
        });

        const performanceData = {
            ambient: [],
            bigs: [],
            chilled: [],
            freezer: []
        };

        Object.keys(associateZoneMap).forEach(function(key) {
            const data = associateZoneMap[key];

            if (data.totalDuration <= minHours) {
                return;
            }

            const avgRate = data.rates.reduce(function(sum, r) { return sum + r; }, 0) / data.rates.length;

            const performer = {
                associateId: data.associateId,
                rate: avgRate,
                units: data.totalUnits,
                duration: data.totalDuration.toFixed(2)
            };

            if (data.zone.includes('ambient')) {
                performanceData.ambient.push(performer);
            } else if (data.zone.includes('big')) {
                performanceData.bigs.push(performer);
            } else if (data.zone.includes('chill')) {
                performanceData.chilled.push(performer);
            } else if (data.zone.includes('freez') || data.zone.includes('frozen')) {
                performanceData.freezer.push(performer);
            }
        });

        console.log('Step 5: Categorized - Ambient: ' + performanceData.ambient.length + ', Bigs: ' + performanceData.bigs.length + ', Chilled: ' + performanceData.chilled.length + ', Freezer: ' + performanceData.freezer.length);
        return performanceData;
    }

    function getBottom5(performers) {
        return performers.sort(function(a, b) { return a.rate - b.rate; }).slice(0, 5);
    }

    function getTop5(performers) {
        return performers.sort(function(a, b) { return b.rate - a.rate; }).slice(0, 5);
    }

    function createZoneSection(zoneName, performers) {
       const zoneColors = {
    'Ambient': '#FF9900',
    'Bigs': '#146EB4',
    'Chilled': '#00A8E1',
    'Freezer': '#232F3E'
};

        const zoneKey = zoneName.toLowerCase();
        const isCollapsed = zoneCollapsedState[zoneKey];

        let html = '<div style="margin-bottom: 20px;">';

        html += '<div style="display: flex; align-items: center; background: ' + zoneColors[zoneName] + '; color: white; padding: 8px 12px; margin: 0 0 10px 0; border-radius: 4px; cursor: pointer;" onclick="window.toggleZone(\'' + zoneName + '\')">';
        html += '<h3 style="margin: 0; font-size: 14px; flex: 1;">' + zoneName + '</h3>';
        html += '<button id="zone-toggle-' + zoneKey + '" style="background: transparent; color: white; border: none; font-size: 18px; font-weight: bold; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">' + (isCollapsed ? '+' : '−') + '</button>';
        html += '</div>';

        html += '<div id="zone-content-' + zoneKey + '" style="transition: all 0.3s ease; ' + (isCollapsed ? 'max-height: 0; overflow: hidden; opacity: 0;' : 'max-height: 1000px; overflow: visible; opacity: 1;') + '">';

        if (performers.length === 0) {
            html += '<p style="color: #666; font-size: 13px; margin: 10px 0;">No data available</p>';
        } else {
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #ddd;">';
            html += '<thead><tr style="background: #f5f5f5;">';
            html += '<th style="padding: 6px; text-align: left; border-bottom: 1px solid #ddd;">Associate ID</th>';
            html += '<th style="padding: 6px; text-align: right; border-bottom: 1px solid #ddd;">Rate</th>';
            html += '<th style="padding: 6px; text-align: right; border-bottom: 1px solid #ddd;">Units</th>';
            html += '<th style="padding: 6px; text-align: right; border-bottom: 1px solid #ddd;">Hours</th>';
            html += '</tr></thead><tbody>';

            performers.forEach(function(performer, index) {
                html += '<tr style="border-bottom: 1px solid #eee;">';
                html += '<td style="padding: 6px; font-weight: bold;">' + performer.associateId + '</td>';
                html += '<td style="padding: 6px; text-align: right;">' + performer.rate.toFixed(2) + '</td>';
                html += '<td style="padding: 6px; text-align: right;">' + performer.units.toFixed(0) + '</td>';
                html += '<td style="padding: 6px; text-align: right;">' + performer.duration + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        html += '</div>';
        html += '</div>';
        return html;
    }

    function updateFilterInfo() {
        const filterInfo = document.getElementById('filter-info');
        if (filterInfo) {
            const minutes = minHours * 60;
            filterInfo.textContent = 'Showing associates with > ' + minutes + ' minutes worked';
        }
    }

    function updateDisplay() {
        console.log('Step 6: Updating display');

        if (!checkDataReady()) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log('Step 6a: Data not ready, retry ' + retryCount + ' of ' + MAX_RETRIES);
                const content = document.getElementById('performers-content');
                if (content) {
                    content.innerHTML = '<p style="color: #FF9900; font-weight: bold;">Loading data... (attempt ' + retryCount + ' of ' + MAX_RETRIES + ')</p>';
                }
                setTimeout(updateDisplay, 2000);
                return;
            } else {
                console.log('Step 6b: Max retries reached');
                const content = document.getElementById('performers-content');
                if (content) {
                    content.innerHTML = '<p style="color: #d13212; font-weight: bold;">Unable to load data after ' + MAX_RETRIES + ' attempts. Please refresh the page.</p>';
                }
                return;
            }
        }

        retryCount = 0;

        const data = extractPerformanceData();

        updateFilterInfo();

        if (!data) {
            console.log('Step 6c: No data extracted');
            const content = document.getElementById('performers-content');
            if (content) {
                const minutes = minHours * 60;
                content.innerHTML = '<p style="color: #d13212; font-weight: bold;">No performance data found with > ' + minutes + ' minutes worked.</p>';
            }
            return;
        }

        const content = document.getElementById('performers-content');
        const lastUpdate = document.getElementById('last-update-time');

        if (!content || !lastUpdate) {
            console.log('Step 6d: Panel elements not found');
            return;
        }

        lastUpdate.textContent = 'Last Updated: ' + formatTimestamp();

        let html = '';

        if (activeTab === 'bottom') {
            html += createZoneSection('Ambient', getBottom5(data.ambient));
            html += createZoneSection('Bigs', getBottom5(data.bigs));
            html += createZoneSection('Chilled', getBottom5(data.chilled));
            html += createZoneSection('Freezer', getBottom5(data.freezer));
        } else {
            html += createZoneSection('Ambient', getTop5(data.ambient));
            html += createZoneSection('Bigs', getTop5(data.bigs));
            html += createZoneSection('Chilled', getTop5(data.chilled));
            html += createZoneSection('Freezer', getTop5(data.freezer));
        }

        content.innerHTML = html;
        console.log('Step 7: Display updated successfully');
    }

    window.toggleZone = toggleZone;

    function init() {
        console.log('Step 0: Initializing tracker with collapsible zones - Powered by Matti AI');

        setTimeout(function() {
            createTrackerPanel();
            updateDisplay();
            setInterval(updateDisplay, 900000);
            console.log('Step 8: Auto-refresh set to 15 minutes');
        }, 5000);
    }

    init();
})();

