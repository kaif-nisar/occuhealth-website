/**
 * Franchise Business & Performance Analytics
 * Occuhealth Diagnostic Portal
 * Handles Revenue, Tests, Tubes, Samples, Targets, Daily Averages & Visualizations.
 */

(function () {
    'use strict';

    // Default target quota as specified by management
    const DEFAULT_TARGET_AMOUNT = 200000;

    // State Variables
    let currentPeriod = 'month'; // 'today', 'week', 'month', 'custom'
    let currentMonth = new Date().toISOString().slice(0, 7);
    let currentFranchiseeId = 'all';
    let currentDataMode = 'exact'; // 'exact' (Default), 'average', 'both'
    let customStartDate = '';
    let customEndDate = '';
    let statusFilter = 'all';
    let searchQuery = '';
    let sortBy = 'revenue-desc';

    let dashboardData = null;
    let charts = {
        timeline: null,
        tubeTypes: null,
        topTests: null,
        targetComparison: null
    };

    const effectiveBaseUrl = window.BASE_URL || window.location.origin;

    // Helper: Safely parse JSON
    function safeJsonParse(str) {
        try { return JSON.parse(str); } catch (_) { return null; }
    }

    // Helper: Get Auth Headers
    function getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // Helper: Format Currency in INR
    function formatINR(val) {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    }

    // Helper: Short Currency
    function formatINRShort(val) {
        const num = Number(val) || 0;
        if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `₹${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 2)} L`;
        if (num >= 1000) return `₹${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
        return `₹${num}`;
    }

    // Helper: Number to Words (Indian Format)
    function numberToIndianWords(num) {
        const val = Number(num);
        if (!val || val <= 0) return 'Zero Rupees';
        if (val === 200000) return 'Two Lakh Rupees (Standard Default)';
        if (val === 100000) return 'One Lakh Rupees';
        if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Crore Rupees`;
        if (val >= 100000) return `${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 2)} Lakh Rupees`;
        if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} Thousand Rupees`;
        return `${val} Rupees`;
    }

    // ==========================================
    // 🛡️ STRICT LAYER VERIFICATION
    // ==========================================
    function isSingleLayerAccount() {
        const userObj = window.user || safeJsonParse(localStorage.getItem('user'));
        const userRole = window.role || window.userRole || userObj?.role || '';
        
        // Check modelType in tenantId
        if (userObj?.tenantId?.modelType === '1layer') return true;
        if (userObj?.tenantId && typeof userObj.tenantId === 'object' && userObj.tenantId.modelType === '1layer') return true;
        if (typeof userRole === 'string' && userRole.toLowerCase().includes('1layer')) return true;

        return false;
    }

    function enforceLayerAccess() {
        if (isSingleLayerAccount()) {
            console.warn('[FranchiseeBusiness] Access blocked: Account operates under 1layer model');
            const restrictedOverlay = document.getElementById('fbSingleLayerRestricted');
            const mainContent = document.getElementById('fbMainContent');
            if (restrictedOverlay) restrictedOverlay.style.display = 'flex';
            if (mainContent) mainContent.style.display = 'none';
            return false;
        }
        return true;
    }

    // ==========================================
    // 📊 DATA FETCHING & API INTERACTION
    // ==========================================
    async function fetchFranchiseeAnalytics() {
        if (!enforceLayerAccess()) return;

        const refreshBtn = document.getElementById('fbRefreshBtn');
        if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';

        const tbody = document.getElementById('fbTableBody');
        if (tbody && !dashboardData) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="fb-loading-row">
                        <div class="fb-spinner-wrap">
                            <i class="fa-solid fa-spinner fa-spin"></i> Fetching real-time franchisee business intelligence...
                        </div>
                    </td>
                </tr>`;
        }

        const params = new URLSearchParams();
        params.append('period', currentPeriod);
        if (currentMonth) params.append('month', currentMonth);
        if (currentFranchiseeId && currentFranchiseeId !== 'all') {
            params.append('franchiseeId', currentFranchiseeId);
        }
        if (currentPeriod === 'custom') {
            if (customStartDate) params.append('startDate', customStartDate);
            if (customEndDate) params.append('endDate', customEndDate);
        }

        try {
            const url = `${effectiveBaseUrl}/api/v1/target/business-analytics?${params.toString()}`;
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: getAuthHeaders()
            });

            if (response.status === 403) {
                // Backend rejected single layer
                const restrictedOverlay = document.getElementById('fbSingleLayerRestricted');
                const mainContent = document.getElementById('fbMainContent');
                if (restrictedOverlay) restrictedOverlay.style.display = 'flex';
                if (mainContent) mainContent.style.display = 'none';
                return;
            }

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to fetch analytics');
            }

            dashboardData = result.data;
            populateDropdownFranchisees(dashboardData.dropdownFranchisees || []);
            renderKPISummary(dashboardData.summary || {});
            renderCharts(dashboardData.charts || {});
            renderTable(dashboardData.franchisees || []);
        } catch (error) {
            console.error('[FranchiseeBusiness] Error loading data:', error);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="14" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 block"></i>
                            <strong>Error loading analytics data:</strong> ${error.message}
                        </td>
                    </tr>`;
            }
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh';
            }
        }
    }

    // Populate Franchisee Select Dropdown
    function populateDropdownFranchisees(list) {
        const select = document.getElementById('fbFranchiseeSelect');
        if (!select || select.dataset.populated === 'true') return;

        const currentVal = select.value;
        select.innerHTML = '<option value="all">⚡ All Franchisees (Aggregated)</option>';

        list.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f._id;
            const roleBadge = f.role === 'superFranchisee' ? '[Super]' : (f.role === 'subFranchisee' ? '[Sub]' : '[Franchisee]');
            opt.textContent = `${roleBadge} ${f.fullName} (${f.username})`;
            select.appendChild(opt);
        });

        select.value = currentVal || 'all';
        select.dataset.populated = 'true';
    }

    // ==========================================
    // 🎛️ DATA VIEW MODE SWITCHER (EXACT vs AVERAGE vs BOTH)
    // ==========================================
    function setDataViewMode(mode) {
        if (mode !== 'exact' && mode !== 'average' && mode !== 'both') return;
        currentDataMode = mode;

        // Sync top toolbar buttons
        document.querySelectorAll('.fb-mode-btn').forEach(btn => {
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sync table toolbar buttons
        document.querySelectorAll('.fb-table-mode-btn').forEach(btn => {
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update KPI Strip and re-render Table
        if (dashboardData) {
            renderKPISummary(dashboardData.summary || {});
            renderTable(dashboardData.franchisees || []);
        }
    }

    // ==========================================
    // 📈 KPI SUMMARY RENDERING
    // ==========================================
    function renderKPISummary(summary) {
        const totalTarget = summary.totalTarget || 0;
        const totalAchieved = summary.totalAchieved || 0;
        const totalSamples = summary.totalSamples || 0;
        const totalTests = summary.totalTests || 0;
        const totalTubes = summary.totalTubes || 0;
        const daysCount = summary.daysCount || 1;

        // Daily Averages
        const avgRevenuePerDay = summary.avgRevenuePerDay || Math.round(totalAchieved / daysCount);
        const avgSamplesPerDay = summary.avgSamplesPerDay || (totalSamples / daysCount).toFixed(1);
        const avgTestsPerDay = summary.avgTestsPerDay || (totalTests / daysCount).toFixed(1);
        const avgTubesPerDay = summary.avgTubesPerDay || (totalTubes / daysCount).toFixed(1);
        const avgTicketSize = summary.avgTicketSize || (totalSamples > 0 ? Math.round(totalAchieved / totalSamples) : 0);

        const pct = summary.achievementRate || (totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : 0);

        // Update Active Mode Strip
        const modeTitleEl = document.getElementById('fbActiveModeTitle');
        const modeDescEl = document.getElementById('fbActiveModeDesc');
        const periodBadgeEl = document.getElementById('fbPeriodBadgeText');

        if (periodBadgeEl) {
            periodBadgeEl.textContent = `${daysCount} Day${daysCount > 1 ? 's' : ''} Period`;
        }

        if (modeTitleEl && modeDescEl) {
            if (currentDataMode === 'exact') {
                modeTitleEl.innerHTML = 'Active View: <strong>Exact Data (Period Totals)</strong>';
                modeDescEl.textContent = `Displaying exact total sales, samples, tests and tubes for the selected ${daysCount}-day period. Click 'Daily Averages' to see normalized daily rates.`;
            } else if (currentDataMode === 'average') {
                modeTitleEl.innerHTML = 'Active View: <strong>Daily Averages (Normalized Rates)</strong>';
                modeDescEl.textContent = `Displaying normalized daily average rates across the ${daysCount}-day period. Click 'Exact Data' to see actual cumulative totals.`;
            } else {
                modeTitleEl.innerHTML = 'Active View: <strong>Complete View (Exact Totals + Daily Averages)</strong>';
                modeDescEl.textContent = `Displaying both actual cumulative totals and daily average rates side-by-side.`;
            }
        }

        // Update Badges on KPI Cards
        document.querySelectorAll('.fb-kpi-card .fb-metric-badge').forEach(badge => {
            if (currentDataMode === 'exact') {
                badge.className = 'fb-metric-badge badge-exact';
                badge.textContent = 'Exact Total';
            } else if (currentDataMode === 'average') {
                badge.className = 'fb-metric-badge badge-avg';
                badge.textContent = 'Daily Avg';
            } else {
                badge.className = 'fb-metric-badge badge-exact';
                badge.textContent = 'Exact + Avg';
            }
        });

        // 1. Target Card
        const kpiTargetAmount = document.getElementById('kpiTargetAmount');
        const kpiTargetAchievedLabel = document.getElementById('kpiTargetAchievedLabel');
        const kpiTargetPct = document.getElementById('kpiTargetPct');
        const kpiTargetProgressFill = document.getElementById('kpiTargetProgressFill');
        const kpiTargetDeficit = document.getElementById('kpiTargetDeficit');
        const kpiTargetCount = document.getElementById('kpiTargetCount');

        if (kpiTargetAmount) kpiTargetAmount.textContent = formatINR(totalTarget);
        if (kpiTargetAchievedLabel) kpiTargetAchievedLabel.textContent = `Achieved: ${formatINR(totalAchieved)}`;
        if (kpiTargetPct) kpiTargetPct.textContent = `${pct}%`;
        if (kpiTargetProgressFill) {
            const fillWidth = Math.min(100, Math.max(0, Number(pct)));
            kpiTargetProgressFill.style.width = `${fillWidth}%`;
            if (pct >= 100) {
                kpiTargetProgressFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
            } else if (pct >= 70) {
                kpiTargetProgressFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)';
            } else {
                kpiTargetProgressFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
            }
        }

        if (kpiTargetDeficit) {
            if (totalAchieved >= totalTarget && totalTarget > 0) {
                const surplus = totalAchieved - totalTarget;
                kpiTargetDeficit.className = 'fb-deficit-pill status-achieved';
                kpiTargetDeficit.textContent = `Surplus: +${formatINR(surplus)}`;
            } else {
                const deficit = Math.max(0, totalTarget - totalAchieved);
                kpiTargetDeficit.className = 'fb-deficit-pill';
                kpiTargetDeficit.textContent = `Deficit: ${formatINR(deficit)}`;
            }
        }
        if (kpiTargetCount) {
            kpiTargetCount.textContent = `${summary.franchiseeCount || 0} Franchisees`;
        }

        // 2. Revenue Card
        const kpiTotalRevenue = document.getElementById('kpiTotalRevenue');
        const kpiAvgRevenuePerDay = document.getElementById('kpiAvgRevenuePerDay');
        const kpiAvgTicketSize = document.getElementById('kpiAvgTicketSize');
        const kpiDaysLabel = document.getElementById('kpiDaysLabel');

        if (kpiTotalRevenue) {
            if (currentDataMode === 'average') {
                kpiTotalRevenue.textContent = `${formatINR(avgRevenuePerDay)} / day`;
            } else {
                kpiTotalRevenue.textContent = formatINR(totalAchieved);
            }
        }
        if (kpiAvgRevenuePerDay) {
            if (currentDataMode === 'average') {
                kpiAvgRevenuePerDay.innerHTML = `Cumulative Total: <strong>${formatINR(totalAchieved)}</strong>`;
            } else {
                kpiAvgRevenuePerDay.textContent = `${formatINR(avgRevenuePerDay)} / day`;
            }
        }
        if (kpiAvgTicketSize) kpiAvgTicketSize.textContent = `Avg / Sample: ${formatINR(avgTicketSize)}`;
        if (kpiDaysLabel) kpiDaysLabel.textContent = `Period: ${daysCount} day${daysCount > 1 ? 's' : ''}`;

        // 3. Samples Card
        const kpiTotalSamples = document.getElementById('kpiTotalSamples');
        const kpiAvgSamplesPerDay = document.getElementById('kpiAvgSamplesPerDay');
        const kpiAchievedCount = document.getElementById('kpiAchievedCount');

        if (kpiTotalSamples) {
            if (currentDataMode === 'average') {
                kpiTotalSamples.textContent = `${avgSamplesPerDay} / day`;
            } else {
                kpiTotalSamples.textContent = Number(totalSamples).toLocaleString('en-IN');
            }
        }
        if (kpiAvgSamplesPerDay) {
            if (currentDataMode === 'average') {
                kpiAvgSamplesPerDay.innerHTML = `Cumulative Total: <strong>${Number(totalSamples).toLocaleString('en-IN')}</strong>`;
            } else {
                kpiAvgSamplesPerDay.textContent = `${avgSamplesPerDay} / day`;
            }
        }
        if (kpiAchievedCount) kpiAchievedCount.textContent = `${summary.achievedCount || 0} Met Target`;

        // 4. Tests Card
        const kpiTotalTests = document.getElementById('kpiTotalTests');
        const kpiAvgTestsPerDay = document.getElementById('kpiAvgTestsPerDay');
        const kpiTestsPerSample = document.getElementById('kpiTestsPerSample');

        if (kpiTotalTests) {
            if (currentDataMode === 'average') {
                kpiTotalTests.textContent = `${avgTestsPerDay} / day`;
            } else {
                kpiTotalTests.textContent = Number(totalTests).toLocaleString('en-IN');
            }
        }
        if (kpiAvgTestsPerDay) {
            if (currentDataMode === 'average') {
                kpiAvgTestsPerDay.innerHTML = `Cumulative Total: <strong>${Number(totalTests).toLocaleString('en-IN')}</strong>`;
            } else {
                kpiAvgTestsPerDay.textContent = `${avgTestsPerDay} / day`;
            }
        }
        if (kpiTestsPerSample) {
            const ratio = totalSamples > 0 ? (totalTests / totalSamples).toFixed(1) : '0';
            kpiTestsPerSample.textContent = `${ratio} Tests / Sample`;
        }

        // 5. Tubes Card
        const kpiTotalTubes = document.getElementById('kpiTotalTubes');
        const kpiAvgTubesPerDay = document.getElementById('kpiAvgTubesPerDay');
        const kpiTubesPerSample = document.getElementById('kpiTubesPerSample');

        if (kpiTotalTubes) {
            if (currentDataMode === 'average') {
                kpiTotalTubes.textContent = `${avgTubesPerDay} / day`;
            } else {
                kpiTotalTubes.textContent = Number(totalTubes).toLocaleString('en-IN');
            }
        }
        if (kpiAvgTubesPerDay) {
            if (currentDataMode === 'average') {
                kpiAvgTubesPerDay.innerHTML = `Cumulative Total: <strong>${Number(totalTubes).toLocaleString('en-IN')}</strong>`;
            } else {
                kpiAvgTubesPerDay.textContent = `${avgTubesPerDay} / day`;
            }
        }
        if (kpiTubesPerSample) {
            const ratio = totalSamples > 0 ? (totalTubes / totalSamples).toFixed(1) : '0';
            kpiTubesPerSample.textContent = `${ratio} Tubes / Sample`;
        }

        // Scope Pill on Header
        const scopePill = document.getElementById('fbActiveScopePill');
        if (scopePill) {
            if (currentFranchiseeId === 'all') {
                scopePill.textContent = 'All Franchisees';
            } else {
                const select = document.getElementById('fbFranchiseeSelect');
                const selectedText = select?.options[select.selectedIndex]?.text || 'Single Franchisee';
                scopePill.textContent = selectedText.replace(/\[.*?\]\s*/, '');
            }
        }
    }

    // ==========================================
    // 📊 CHART.JS VISUALIZATIONS
    // ==========================================
    function destroyChart(name) {
        if (charts[name]) {
            charts[name].destroy();
            charts[name] = null;
        }
    }

    function renderCharts(chartsPayload) {
        if (typeof Chart === 'undefined') {
            console.warn('[FranchiseeBusiness] Chart.js is not loaded.');
            return;
        }

        // 1. Timeline Chart (Revenue, Samples, Tubes)
        const timelineCanvas = document.getElementById('fbTimelineChart');
        if (timelineCanvas) {
            destroyChart('timeline');
            const tl = chartsPayload.timeline || { labels: [], revenue: [], samples: [], tubes: [] };

            const ctx = timelineCanvas.getContext('2d');
            const revGrad = ctx.createLinearGradient(0, 0, 0, 260);
            revGrad.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
            revGrad.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

            charts.timeline = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: tl.labels,
                    datasets: [
                        {
                            label: 'Revenue (₹)',
                            data: tl.revenue,
                            borderColor: '#2563eb',
                            backgroundColor: revGrad,
                            borderWidth: 2.5,
                            fill: true,
                            tension: 0.35,
                            yAxisID: 'yRevenue',
                            pointRadius: tl.labels.length > 20 ? 1 : 3,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Samples',
                            data: tl.samples,
                            borderColor: '#059669',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            tension: 0.35,
                            yAxisID: 'yCount',
                            pointRadius: tl.labels.length > 20 ? 1 : 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Tubes',
                            data: tl.tubes,
                            borderColor: '#d97706',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            tension: 0.35,
                            yAxisID: 'yCount',
                            pointRadius: tl.labels.length > 20 ? 1 : 3,
                            pointHoverRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    if (context.dataset.yAxisID === 'yRevenue') {
                                        return `Revenue: ${formatINR(context.raw)}`;
                                    }
                                    return `${context.dataset.label}: ${context.raw}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } }
                        },
                        yRevenue: {
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            grid: { color: 'rgba(226, 232, 240, 0.7)' },
                            ticks: {
                                callback: val => formatINRShort(val),
                                font: { size: 11 }
                            }
                        },
                        yCount: {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            grid: { display: false },
                            ticks: { font: { size: 11 }, precision: 0 }
                        }
                    }
                }
            });
        }

        // 2. Tube Types Doughnut Chart
        const tubeCanvas = document.getElementById('fbTubeTypesChart');
        if (tubeCanvas) {
            destroyChart('tubeTypes');
            const tt = chartsPayload.tubeTypes || { labels: [], data: [] };

            const colorPalette = [
                '#7c3aed', // EDTA (Purple)
                '#e11d48', // Plain/Red (Rose)
                '#f59e0b', // Serum/Gel (Gold/Amber)
                '#64748b', // Fluoride (Grey/Slate)
                '#0284c7', // Citrate (Sky Blue)
                '#059669', // Heparin (Green)
                '#d97706', // Yellow
                '#0f172a'  // Other
            ];

            charts.tubeTypes = new Chart(tubeCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: tt.labels.length ? tt.labels : ['No tubes recorded'],
                    datasets: [{
                        data: tt.data.length ? tt.data : [1],
                        backgroundColor: tt.data.length ? colorPalette.slice(0, tt.labels.length) : ['#e2e8f0'],
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { boxWidth: 12, font: { size: 11 }, padding: 12 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const val = context.raw || 0;
                                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${val} tubes (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // 3. Top Tests Horizontal Bar Chart
        const topTestsCanvas = document.getElementById('fbTopTestsChart');
        if (topTestsCanvas) {
            destroyChart('topTests');
            const tests = chartsPayload.topTests || { labels: [], data: [] };

            charts.topTests = new Chart(topTestsCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: tests.labels,
                    datasets: [{
                        label: 'Investigations',
                        data: tests.data,
                        backgroundColor: '#8b5cf6',
                        borderRadius: 6,
                        barThickness: 14
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` Booked: ${ctx.raw} times`
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(226, 232, 240, 0.7)' },
                            ticks: { precision: 0, font: { size: 11 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { font: { size: 11 } }
                        }
                    }
                }
            });
        }

        // 4. Target Comparison Chart (Top Performers)
        const targetCanvas = document.getElementById('fbTargetComparisonChart');
        if (targetCanvas) {
            destroyChart('targetComparison');
            const topList = chartsPayload.topPerformers || [];
            const labels = topList.map(t => t.name);
            const targetData = topList.map(t => t.target);
            const achievedData = topList.map(t => t.achieved);

            charts.targetComparison = new Chart(targetCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Target Quota (₹)',
                            data: targetData,
                            backgroundColor: '#e2e8f0',
                            borderRadius: 6,
                            barThickness: 14
                        },
                        {
                            label: 'Achieved Sale (₹)',
                            data: achievedData,
                            backgroundColor: '#059669',
                            borderRadius: 6,
                            barThickness: 14
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(226, 232, 240, 0.7)' },
                            ticks: {
                                callback: val => formatINRShort(val),
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    }

    // ==========================================
    // 📋 TABLE RENDERING & FILTERING (EXACT vs AVERAGE vs BOTH)
    // ==========================================
    function renderTable(franchisees) {
        const thead = document.getElementById('fbTableHeader');
        const tbody = document.getElementById('fbTableBody');
        const recordCountEl = document.getElementById('fbTableRecordCount');
        if (!tbody) return;

        // 1. Render Table Header dynamically based on currentDataMode
        if (thead) {
            if (currentDataMode === 'exact') {
                thead.innerHTML = `
                    <tr>
                        <th class="th-center" style="width: 50px;">#</th>
                        <th>Franchisee Information</th>
                        <th class="th-right">Assigned Target</th>
                        <th class="th-right fb-th-highlight">Achieved Sale (Exact ₹)</th>
                        <th style="min-width: 170px;">Target Progress</th>
                        <th class="th-center fb-th-highlight">Total Samples (Exact)</th>
                        <th class="th-center fb-th-highlight">Total Tests (Exact)</th>
                        <th class="th-center fb-th-highlight">Total Tubes (Exact)</th>
                        <th class="th-center">Status</th>
                        <th class="th-center">Actions</th>
                    </tr>
                `;
            } else if (currentDataMode === 'average') {
                thead.innerHTML = `
                    <tr>
                        <th class="th-center" style="width: 50px;">#</th>
                        <th>Franchisee Information</th>
                        <th class="th-right">Assigned Target</th>
                        <th class="th-right fb-th-highlight">Daily Avg Revenue</th>
                        <th style="min-width: 170px;">Target Progress</th>
                        <th class="th-center fb-th-highlight">Avg Samples / Day</th>
                        <th class="th-center fb-th-highlight">Avg Tests / Day</th>
                        <th class="th-center fb-th-highlight">Avg Tubes / Day</th>
                        <th class="th-center">Status</th>
                        <th class="th-center">Actions</th>
                    </tr>
                `;
            } else { // 'both'
                thead.innerHTML = `
                    <tr>
                        <th class="th-center" style="width: 50px;">#</th>
                        <th>Franchisee Information</th>
                        <th class="th-right">Assigned Target</th>
                        <th class="th-right">Achieved Sale (Exact ₹)</th>
                        <th class="th-right fb-th-highlight">Daily Avg Revenue</th>
                        <th style="min-width: 160px;">Target Progress</th>
                        <th class="th-center">Total Samples</th>
                        <th class="th-center fb-th-highlight">Avg Samples / Day</th>
                        <th class="th-center">Total Tests</th>
                        <th class="th-center fb-th-highlight">Avg Tests / Day</th>
                        <th class="th-center">Total Tubes</th>
                        <th class="th-center fb-th-highlight">Avg Tubes / Day</th>
                        <th class="th-center">Status</th>
                        <th class="th-center">Actions</th>
                    </tr>
                `;
            }
        }

        const colSpan = currentDataMode === 'both' ? 14 : 10;

        // 2. Update tab counts
        const countAll = franchisees.length;
        const countAchieved = franchisees.filter(f => f.status === 'achieved').length;
        const countOnTrack = franchisees.filter(f => f.status === 'on_track').length;
        const countPending = franchisees.filter(f => f.status === 'pending').length;

        const elAll = document.getElementById('tabCountAll');
        const elAchieved = document.getElementById('tabCountAchieved');
        const elOnTrack = document.getElementById('tabCountOnTrack');
        const elPending = document.getElementById('tabCountPending');

        if (elAll) elAll.textContent = countAll;
        if (elAchieved) elAchieved.textContent = countAchieved;
        if (elOnTrack) elOnTrack.textContent = countOnTrack;
        if (elPending) elPending.textContent = countPending;

        // 3. Filter by status tab
        let filtered = franchisees;
        if (statusFilter !== 'all') {
            filtered = filtered.filter(f => f.status === statusFilter);
        }

        // 4. Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(f => {
                const name = String(f.fullName || '').toLowerCase();
                const uname = String(f.username || '').toLowerCase();
                const clinic = String(f.clinicName || '').toLowerCase();
                const phone = String(f.phoneNo || f.phoneNumber || '');
                const email = String(f.email || '').toLowerCase();
                return name.includes(q) || uname.includes(q) || clinic.includes(q) || phone.includes(q) || email.includes(q);
            });
        }

        // 5. Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'revenue-desc': return b.achievedRevenue - a.achievedRevenue;
                case 'revenue-asc': return a.achievedRevenue - b.achievedRevenue;
                case 'avg-revenue-desc': return b.avgRevenuePerDay - a.avgRevenuePerDay;
                case 'pct-desc': return b.percentage - a.percentage;
                case 'pct-asc': return a.percentage - b.percentage;
                case 'samples-desc': return b.totalSamples - a.totalSamples;
                case 'avg-samples-desc': return b.avgSamplesPerDay - a.avgSamplesPerDay;
                case 'tests-desc': return b.totalTests - a.totalTests;
                case 'tubes-desc': return b.totalTubes - a.totalTubes;
                case 'name-asc': return (a.fullName || '').localeCompare(b.fullName || '');
                default: return b.achievedRevenue - a.achievedRevenue;
            }
        });

        if (recordCountEl) {
            const modeText = currentDataMode === 'exact' ? 'Exact Data View' : (currentDataMode === 'average' ? 'Daily Averages View' : 'Complete View');
            recordCountEl.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${franchisees.length}</strong> partners • <span style="color:#2563eb; font-weight:700;">${modeText}</span>`;
        }

        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fa-solid fa-store-slash text-3xl mb-2 block text-slate-300"></i>
                        No franchisees found matching your filters.
                    </td>
                </tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        filtered.forEach((f, idx) => {
            const tr = document.createElement('tr');

            // Role styling
            let roleClass = 'role-franchisee';
            let roleTitle = 'Franchisee';
            if (f.role === 'superFranchisee') {
                roleClass = 'role-super';
                roleTitle = 'Super Franchisee';
            } else if (f.role === 'subFranchisee') {
                roleClass = 'role-sub';
                roleTitle = 'Sub Franchisee';
            }

            // Status styling
            let statusBadge = '<span class="fb-status-pill status-pending"><i class="fa-solid fa-clock"></i> Pending</span>';
            if (f.status === 'achieved') {
                statusBadge = '<span class="fb-status-pill status-achieved"><i class="fa-solid fa-circle-check"></i> Achieved</span>';
            } else if (f.status === 'on_track') {
                statusBadge = '<span class="fb-status-pill status-on-track"><i class="fa-solid fa-arrow-trend-up"></i> On Track</span>';
            }

            // Progress bar
            const pct = f.percentage || 0;
            const progressWidth = Math.min(100, Math.max(0, pct));
            let fillGrad = 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)';
            if (f.status === 'achieved') fillGrad = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
            else if (pct < 50) fillGrad = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';

            const remainingDeficit = f.deficit > 0 ? `Deficit: ${formatINRShort(f.deficit)}` : `Surplus: +${formatINRShort(f.surplus)}`;

            let metricCells = '';

            if (currentDataMode === 'exact') {
                // Exact Data Only (Total Revenue, Total Samples, Total Tests, Total Tubes)
                metricCells = `
                    <td class="th-right font-bold text-emerald">
                        ${formatINR(f.achievedRevenue)}
                    </td>
                    <td>
                        <div style="min-width: 140px;">
                            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                                <span>${pct}%</span>
                                <span class="text-slate-500">${remainingDeficit}</span>
                            </div>
                            <div style="height: 6px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                                <div style="height:100%; width:${progressWidth}%; background:${fillGrad}; border-radius:999px;"></div>
                            </div>
                        </div>
                    </td>
                    <td class="th-center font-bold text-blue">
                        ${Number(f.totalSamples).toLocaleString('en-IN')}
                    </td>
                    <td class="th-center font-bold text-purple">
                        ${Number(f.totalTests).toLocaleString('en-IN')}
                    </td>
                    <td class="th-center font-bold text-amber">
                        ${Number(f.totalTubes).toLocaleString('en-IN')}
                    </td>
                `;
            } else if (currentDataMode === 'average') {
                // Daily Average Only (Avg Revenue/Day, Avg Samples/Day, Avg Tests/Day, Avg Tubes/Day)
                metricCells = `
                    <td class="th-right fb-td-avg">
                        <span class="fb-avg-revenue-pill">${formatINRShort(f.avgRevenuePerDay)} / day</span>
                    </td>
                    <td>
                        <div style="min-width: 140px;">
                            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                                <span>${pct}%</span>
                                <span class="text-slate-500">${remainingDeficit}</span>
                            </div>
                            <div style="height: 6px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                                <div style="height:100%; width:${progressWidth}%; background:${fillGrad}; border-radius:999px;"></div>
                            </div>
                        </div>
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill">${f.avgSamplesPerDay} / day</span>
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill" style="background:#f5f3ff; color:#7c3aed; border-color:#ddd6fe;">
                            ${f.avgTestsPerDay} / day
                        </span>
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill" style="background:#fffbeb; color:#b45309; border-color:#fde68a;">
                            ${f.avgTubesPerDay} / day
                        </span>
                    </td>
                `;
            } else {
                // Both Views (Side-by-side)
                metricCells = `
                    <td class="th-right font-bold text-emerald">
                        ${formatINR(f.achievedRevenue)}
                    </td>
                    <td class="th-right fb-td-avg">
                        <span class="fb-avg-revenue-pill">${formatINRShort(f.avgRevenuePerDay)} / day</span>
                    </td>
                    <td>
                        <div style="min-width: 140px;">
                            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                                <span>${pct}%</span>
                                <span class="text-slate-500">${remainingDeficit}</span>
                            </div>
                            <div style="height: 6px; background:#f1f5f9; border-radius:999px; overflow:hidden;">
                                <div style="height:100%; width:${progressWidth}%; background:${fillGrad}; border-radius:999px;"></div>
                            </div>
                        </div>
                    </td>
                    <td class="th-center font-bold text-blue">
                        ${Number(f.totalSamples).toLocaleString('en-IN')}
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill">${f.avgSamplesPerDay} / day</span>
                    </td>
                    <td class="th-center font-bold text-purple">
                        ${Number(f.totalTests).toLocaleString('en-IN')}
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill" style="background:#f5f3ff; color:#7c3aed; border-color:#ddd6fe;">
                            ${f.avgTestsPerDay} / day
                        </span>
                    </td>
                    <td class="th-center font-bold text-amber">
                        ${Number(f.totalTubes).toLocaleString('en-IN')}
                    </td>
                    <td class="th-center fb-td-avg">
                        <span class="fb-avg-pill" style="background:#fffbeb; color:#b45309; border-color:#fde68a;">
                            ${f.avgTubesPerDay} / day
                        </span>
                    </td>
                `;
            }

            tr.innerHTML = `
                <td class="th-center font-bold text-slate-400">${idx + 1}</td>
                <td>
                    <div class="fb-user-cell">
                        <div class="fb-user-avatar">
                            ${String(f.fullName || f.username || 'F').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="fb-user-name">${f.fullName}</div>
                            <div class="fb-user-meta">
                                <span class="fb-role-badge ${roleClass}">${roleTitle}</span>
                                <span>@${f.username}</span>
                                ${f.clinicName ? `<span>• ${f.clinicName}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="th-right font-bold text-slate-800">
                    ${formatINR(f.target)}
                    ${f.isCustomTarget ? '<span title="Custom set target" style="color:#2563eb; font-size:10px; margin-left:3px;">●</span>' : ''}
                </td>
                ${metricCells}
                <td class="th-center">
                    ${statusBadge}
                </td>
                <td class="th-center">
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                        <button type="button" class="fb-action-btn fb-edit-target-btn" title="Adjust Target" data-fid="${f._id}">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="fb-action-btn fb-drilldown-btn" title="Detailed Analytics" data-fid="${f._id}">
                            <i class="fa-solid fa-chart-column"></i>
                        </button>
                    </div>
                </td>
            `;

            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // Bind table action buttons
        tbody.querySelectorAll('.fb-edit-target-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fid = btn.getAttribute('data-fid');
                const targetFranchisee = franchisees.find(item => item._id === fid);
                if (targetFranchisee) openTargetEditModal(targetFranchisee);
            });
        });

        tbody.querySelectorAll('.fb-drilldown-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fid = btn.getAttribute('data-fid');
                const targetFranchisee = franchisees.find(item => item._id === fid);
                if (targetFranchisee) openFranchiseeDrilldownModal(targetFranchisee);
            });
        });
    }

    // ==========================================
    // 🎯 TARGET EDIT MODAL & MANAGEMENT
    // ==========================================
    function openTargetEditModal(franchisee) {
        const modal = document.getElementById('fbTargetEditModal');
        const userAvatar = document.getElementById('fbModalUserAvatar');
        const userName = document.getElementById('fbModalUserName');
        const userRole = document.getElementById('fbModalUserRole');
        const fidInput = document.getElementById('fbModalFranchiseeId');
        const monthInput = document.getElementById('fbModalMonthInput');
        const amountInput = document.getElementById('fbModalAmountInput');
        const remarksInput = document.getElementById('fbModalRemarksInput');
        const amountWords = document.getElementById('fbModalAmountWords');
        const statusMsg = document.getElementById('fbModalStatusMsg');

        if (!modal) return;

        if (statusMsg) statusMsg.style.display = 'none';

        if (userAvatar) userAvatar.textContent = String(franchisee.fullName || 'F').charAt(0).toUpperCase();
        if (userName) userName.textContent = `${franchisee.fullName} (@${franchisee.username})`;
        if (userRole) userRole.textContent = `${franchisee.role} • ${franchisee.clinicName || 'Center'}`;
        if (fidInput) fidInput.value = franchisee._id;
        if (monthInput) monthInput.value = currentMonth;
        if (amountInput) amountInput.value = franchisee.target || DEFAULT_TARGET_AMOUNT;
        if (remarksInput) remarksInput.value = franchisee.targetRemarks || '';

        if (amountWords) {
            amountWords.textContent = numberToIndianWords(franchisee.target || DEFAULT_TARGET_AMOUNT);
        }

        // Active preset chip highlight
        document.querySelectorAll('.fb-chip').forEach(chip => {
            const amt = Number(chip.getAttribute('data-amount'));
            chip.classList.toggle('active', amt === (franchisee.target || DEFAULT_TARGET_AMOUNT));
        });

        modal.style.display = 'flex';
    }

    function closeTargetEditModal() {
        const modal = document.getElementById('fbTargetEditModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleTargetEditSubmit(e) {
        e.preventDefault();
        const fid = document.getElementById('fbModalFranchiseeId')?.value;
        const month = document.getElementById('fbModalMonthInput')?.value;
        const amount = document.getElementById('fbModalAmountInput')?.value;
        const remarks = document.getElementById('fbModalRemarksInput')?.value;
        const statusMsg = document.getElementById('fbModalStatusMsg');
        const saveBtn = document.getElementById('fbSaveTargetBtn');

        if (!fid || !month || amount === '') return;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const response = await fetch(`${effectiveBaseUrl}/api/v1/target/assign-target`, {
                method: 'POST',
                credentials: 'include',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    franchiseeId: fid,
                    month,
                    amount: Number(amount),
                    remarks
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update target');
            }

            if (statusMsg) {
                statusMsg.className = 'fb-alert fb-alert-success';
                statusMsg.textContent = 'Target assigned successfully!';
                statusMsg.style.display = 'block';
            }

            setTimeout(() => {
                closeTargetEditModal();
                fetchFranchiseeAnalytics();
            }, 800);
        } catch (err) {
            if (statusMsg) {
                statusMsg.className = 'fb-alert fb-alert-error';
                statusMsg.textContent = err.message || 'Error updating target';
                statusMsg.style.display = 'block';
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save & Apply Target';
            }
        }
    }

    // ==========================================
    // ⚡ BULK TARGET MODAL
    // ==========================================
    function openBulkTargetModal() {
        const modal = document.getElementById('fbBulkTargetModal');
        const monthInput = document.getElementById('fbBulkMonthInput');
        const amountInput = document.getElementById('fbBulkAmountInput');
        const amountWords = document.getElementById('fbBulkAmountWords');
        const statusMsg = document.getElementById('fbBulkModalStatusMsg');

        if (!modal) return;
        if (statusMsg) statusMsg.style.display = 'none';

        if (monthInput) monthInput.value = currentMonth;
        if (amountInput) amountInput.value = DEFAULT_TARGET_AMOUNT;
        if (amountWords) amountWords.textContent = numberToIndianWords(DEFAULT_TARGET_AMOUNT);

        modal.style.display = 'flex';
    }

    function closeBulkTargetModal() {
        const modal = document.getElementById('fbBulkTargetModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleBulkTargetSubmit(e) {
        e.preventDefault();
        const month = document.getElementById('fbBulkMonthInput')?.value;
        const amount = document.getElementById('fbBulkAmountInput')?.value;
        const remarks = document.getElementById('fbBulkRemarksInput')?.value;
        const statusMsg = document.getElementById('fbBulkModalStatusMsg');
        const saveBtn = document.getElementById('fbSaveBulkBtn');

        if (!month || amount === '') return;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying to All...';
        }

        try {
            const response = await fetch(`${effectiveBaseUrl}/api/v1/target/bulk-assign`, {
                method: 'POST',
                credentials: 'include',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    month,
                    amount: Number(amount),
                    remarks: remarks || 'Standard monthly franchise target quota'
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to bulk assign targets');
            }

            if (statusMsg) {
                statusMsg.className = 'fb-alert fb-alert-success';
                statusMsg.textContent = `Successfully updated targets for ${result.data?.count || 'all'} franchisees!`;
                statusMsg.style.display = 'block';
            }

            setTimeout(() => {
                closeBulkTargetModal();
                fetchFranchiseeAnalytics();
            }, 1000);
        } catch (err) {
            if (statusMsg) {
                statusMsg.className = 'fb-alert fb-alert-error';
                statusMsg.textContent = err.message || 'Error updating targets';
                statusMsg.style.display = 'block';
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Apply to All Franchisees';
            }
        }
    }

    // ==========================================
    // 🔍 FRANCHISEE DRILL-DOWN MODAL (EXACT + AVERAGE)
    // ==========================================
    function openFranchiseeDrilldownModal(franchisee) {
        const modal = document.getElementById('fbDetailModal');
        const title = document.getElementById('fbDetailModalTitle');
        const content = document.getElementById('fbDetailModalContent');
        if (!modal || !content) return;

        if (title) title.textContent = `${franchisee.fullName} — Franchise Performance Intelligence`;

        const days = dashboardData?.summary?.daysCount || 30;
        const remainingDeficit = franchisee.deficit > 0 ? `Deficit: ${formatINR(franchisee.deficit)}` : `Surplus: +${formatINR(franchisee.surplus)}`;

        content.innerHTML = `
            <!-- Top Target Achievement Banner -->
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color:#fff; border-radius:12px; padding:18px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
                <div>
                    <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; opacity:0.85; font-weight:700;">Quota Achievement Status (${currentMonth})</span>
                    <h2 style="margin:4px 0 0 0; font-size:24px; font-weight:800; color:#ffffff;">${formatINR(franchisee.achievedRevenue)} <span style="font-size:15px; font-weight:600; opacity:0.9;">/ ${formatINR(franchisee.target)}</span></h2>
                    <span style="font-size:12px; opacity:0.9;">${remainingDeficit}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:28px; font-weight:900; line-height:1;">${franchisee.percentage}%</div>
                    <span style="font-size:11.5px; opacity:0.9;">${franchisee.status === 'achieved' ? 'Target Met' : (franchisee.status === 'on_track' ? 'On Track' : 'In Progress')}</span>
                </div>
            </div>

            <!-- Section 1: Exact Cumulative Totals -->
            <div style="margin-bottom:20px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <h4 style="margin:0; font-size:13.5px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em;">
                        <i class="fa-solid fa-list-check text-blue-600"></i> Exact Data (Total Period Actuals)
                    </h4>
                    <span style="font-size:11.5px; color:#64748b; font-weight:600;">Period: ${days} days</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#047857; text-transform:uppercase;">Exact Revenue</span>
                        <h3 style="margin:4px 0 0 0; font-size:19px; font-weight:800; color:#065f46;">${formatINR(franchisee.achievedRevenue)}</h3>
                        <span style="font-size:11px; color:#047857;">Total Cash Generated</span>
                    </div>
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#1e40af; text-transform:uppercase;">Exact Samples</span>
                        <h3 style="margin:4px 0 0 0; font-size:19px; font-weight:800; color:#1e3a8a;">${Number(franchisee.totalSamples).toLocaleString('en-IN')}</h3>
                        <span style="font-size:11px; color:#1e40af;">Patient Bookings</span>
                    </div>
                    <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#6d28d9; text-transform:uppercase;">Exact Tests</span>
                        <h3 style="margin:4px 0 0 0; font-size:19px; font-weight:800; color:#5b21b6;">${Number(franchisee.totalTests).toLocaleString('en-IN')}</h3>
                        <span style="font-size:11px; color:#6d28d9;">Investigations</span>
                    </div>
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#b45309; text-transform:uppercase;">Exact Tubes</span>
                        <h3 style="margin:4px 0 0 0; font-size:19px; font-weight:800; color:#92400e;">${Number(franchisee.totalTubes).toLocaleString('en-IN')}</h3>
                        <span style="font-size:11px; color:#b45309;">Vials Collected</span>
                    </div>
                </div>
            </div>

            <!-- Section 2: Daily Average Metrics -->
            <div style="margin-bottom:20px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <h4 style="margin:0; font-size:13.5px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em;">
                        <i class="fa-solid fa-calculator text-emerald-600"></i> Daily Average Metrics (Normalized / Day)
                    </h4>
                    <span style="font-size:11.5px; color:#64748b; font-weight:600;">Daily Pace</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Daily Avg Revenue</span>
                        <h3 style="margin:4px 0 0 0; font-size:18px; font-weight:800; color:#0f172a;">${formatINR(franchisee.avgRevenuePerDay)} / day</h3>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Daily Avg Samples</span>
                        <h3 style="margin:4px 0 0 0; font-size:18px; font-weight:800; color:#0f172a;">${franchisee.avgSamplesPerDay} / day</h3>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Daily Avg Tests</span>
                        <h3 style="margin:4px 0 0 0; font-size:18px; font-weight:800; color:#0f172a;">${franchisee.avgTestsPerDay} / day</h3>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Daily Avg Tubes</span>
                        <h3 style="margin:4px 0 0 0; font-size:18px; font-weight:800; color:#0f172a;">${franchisee.avgTubesPerDay} / day</h3>
                    </div>
                </div>
            </div>

            <!-- Profile Info -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:18px;">
                <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:#0f172a;">Contact & Profile Information</h4>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:12.5px;">
                    <div><strong>Username:</strong> @${franchisee.username}</div>
                    <div><strong>Role:</strong> ${franchisee.role}</div>
                    <div><strong>Phone:</strong> ${franchisee.phoneNo || 'N/A'}</div>
                    <div><strong>Email:</strong> ${franchisee.email || 'N/A'}</div>
                    <div><strong>Clinic/Lab:</strong> ${franchisee.clinicName || 'N/A'}</div>
                    <div><strong>Last Activity:</strong> ${franchisee.lastBooking ? new Date(franchisee.lastBooking).toLocaleDateString('en-IN') : 'No recent booking'}</div>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="fb-btn fb-btn-plain" id="fbDrilldownCloseBtn">Close</button>
                <button type="button" class="fb-btn fb-btn-primary" id="fbDrilldownFilterBtn">
                    <i class="fa-solid fa-filter"></i> Filter Dashboard to this Franchisee
                </button>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('fbDrilldownCloseBtn')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('fbDrilldownFilterBtn')?.addEventListener('click', () => {
            modal.style.display = 'none';
            const select = document.getElementById('fbFranchiseeSelect');
            if (select) {
                select.value = franchisee._id;
                currentFranchiseeId = franchisee._id;
                fetchFranchiseeAnalytics();
            }
        });
    }

    // ==========================================
    // 📤 EXCEL & PRINT EXPORT
    // ==========================================
    function exportToExcel() {
        if (!dashboardData || !dashboardData.franchisees || !dashboardData.franchisees.length) {
            alert('No franchisee data available to export.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('Excel export library is loading. Please try again in a moment.');
            return;
        }

        const days = dashboardData.summary?.daysCount || 30;

        const rows = dashboardData.franchisees.map((f, i) => ({
            'S.No': i + 1,
            'Franchisee Name': f.fullName,
            'Username': f.username,
            'Role': f.role,
            'Phone': f.phoneNo || '',
            'Clinic Name': f.clinicName || '',
            'Monthly Target (INR)': f.target,
            'Achieved Sale (Exact INR)': f.achievedRevenue,
            'Daily Avg Revenue (INR/day)': f.avgRevenuePerDay,
            'Achievement %': f.percentage,
            'Deficit / Surplus (INR)': f.deficit > 0 ? -f.deficit : f.surplus,
            'Total Samples (Exact)': f.totalSamples,
            'Daily Avg Samples (/day)': f.avgSamplesPerDay,
            'Total Tests (Exact)': f.totalTests,
            'Daily Avg Tests (/day)': f.avgTestsPerDay,
            'Total Tubes (Exact)': f.totalTubes,
            'Daily Avg Tubes (/day)': f.avgTubesPerDay,
            'Status': f.status.toUpperCase(),
            'Period Days': days
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Franchisee Business');
        const fileName = `Franchisee_Business_Report_${currentMonth}_${Date.now()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }

    function printReport() {
        window.print();
    }

    // ==========================================
    // 🎛️ EVENT LISTENERS & INITIALIZATION
    // ==========================================
    function setupEventListeners() {
        // 1. Franchisee Select Dropdown
        const franchiseeSelect = document.getElementById('fbFranchiseeSelect');
        if (franchiseeSelect) {
            franchiseeSelect.addEventListener('change', (e) => {
                currentFranchiseeId = e.target.value;
                fetchFranchiseeAnalytics();
            });
        }

        // 2. Quick Period Buttons (Scoped specifically to .fb-period-group)
        document.querySelectorAll('.fb-period-group .fb-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.fb-period-group .fb-pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const period = btn.getAttribute('data-period');
                currentPeriod = period;

                const customDateRow = document.getElementById('fbCustomDateRow');
                if (period === 'custom') {
                    if (customDateRow) customDateRow.style.display = 'flex';
                } else {
                    if (customDateRow) customDateRow.style.display = 'none';
                    fetchFranchiseeAnalytics();
                }
            });
        });

        // 3. Data View Mode Buttons (Exact vs Average vs Both)
        document.querySelectorAll('.fb-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                setDataViewMode(mode);
            });
        });

        document.querySelectorAll('.fb-table-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                setDataViewMode(mode);
            });
        });

        // 4. Month Picker
        const monthPicker = document.getElementById('fbMonthPicker');
        if (monthPicker) {
            monthPicker.value = currentMonth;
            monthPicker.addEventListener('change', (e) => {
                if (e.target.value) {
                    currentMonth = e.target.value;
                    fetchFranchiseeAnalytics();
                }
            });
        }

        // 5. Custom Date Range Apply Button
        const applyCustomDateBtn = document.getElementById('fbApplyCustomDateBtn');
        if (applyCustomDateBtn) {
            applyCustomDateBtn.addEventListener('click', () => {
                const sDate = document.getElementById('fbStartDateInput')?.value;
                const eDate = document.getElementById('fbEndDateInput')?.value;
                if (!sDate || !eDate) {
                    alert('Please select both Start Date and End Date.');
                    return;
                }
                customStartDate = sDate;
                customEndDate = eDate;

                const dateSummary = document.getElementById('fbDateSummaryText');
                if (dateSummary) {
                    dateSummary.textContent = `Range: ${sDate} to ${eDate}`;
                }

                fetchFranchiseeAnalytics();
            });
        }

        // 6. Refresh Button
        const refreshBtn = document.getElementById('fbRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => fetchFranchiseeAnalytics());
        }

        // 7. Export & Print Buttons
        document.getElementById('fbExportExcelBtn')?.addEventListener('click', exportToExcel);
        document.getElementById('fbPrintTableBtn')?.addEventListener('click', printReport);

        // 8. Table Search Input
        const searchInput = document.getElementById('fbTableSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                if (dashboardData) renderTable(dashboardData.franchisees || []);
            });
        }

        // 9. Window Resize debouncer to keep charts perfectly fitted
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                Object.values(charts).forEach(c => {
                    if (c && typeof c.resize === 'function') {
                        c.resize();
                    }
                });
            }, 150);
        });

        // 8. Status Filter Tabs
        document.querySelectorAll('.fb-tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.fb-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                statusFilter = tab.getAttribute('data-status');
                if (dashboardData) renderTable(dashboardData.franchisees || []);
            });
        });

        // 9. Table Sort Select
        const sortSelect = document.getElementById('fbSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                sortBy = e.target.value;
                if (dashboardData) renderTable(dashboardData.franchisees || []);
            });
        }

        // 10. Target Edit Modal Actions
        document.getElementById('fbCloseTargetModalBtn')?.addEventListener('click', closeTargetEditModal);
        document.getElementById('fbCancelTargetModalBtn')?.addEventListener('click', closeTargetEditModal);
        document.getElementById('fbTargetEditForm')?.addEventListener('submit', handleTargetEditSubmit);

        // Target Amount Input words updater
        const modalAmountInput = document.getElementById('fbModalAmountInput');
        if (modalAmountInput) {
            modalAmountInput.addEventListener('input', (e) => {
                const wordsEl = document.getElementById('fbModalAmountWords');
                if (wordsEl) wordsEl.textContent = numberToIndianWords(e.target.value);
            });
        }

        // Target Modal Preset Chips
        document.querySelectorAll('.fb-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.fb-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const amt = chip.getAttribute('data-amount');
                if (modalAmountInput) {
                    modalAmountInput.value = amt;
                    const wordsEl = document.getElementById('fbModalAmountWords');
                    if (wordsEl) wordsEl.textContent = numberToIndianWords(amt);
                }
            });
        });

        // 11. Bulk Target Modal Actions
        document.getElementById('fbOpenBulkTargetModalBtn')?.addEventListener('click', openBulkTargetModal);
        document.getElementById('fbCloseBulkModalBtn')?.addEventListener('click', closeBulkTargetModal);
        document.getElementById('fbCancelBulkModalBtn')?.addEventListener('click', closeBulkTargetModal);
        document.getElementById('fbBulkTargetForm')?.addEventListener('submit', handleBulkTargetSubmit);

        const bulkAmountInput = document.getElementById('fbBulkAmountInput');
        if (bulkAmountInput) {
            bulkAmountInput.addEventListener('input', (e) => {
                const wordsEl = document.getElementById('fbBulkAmountWords');
                if (wordsEl) wordsEl.textContent = numberToIndianWords(e.target.value);
            });
        }

        document.querySelectorAll('.fb-bulk-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.fb-bulk-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const amt = chip.getAttribute('data-amount');
                if (bulkAmountInput) {
                    bulkAmountInput.value = amt;
                    const wordsEl = document.getElementById('fbBulkAmountWords');
                    if (wordsEl) wordsEl.textContent = numberToIndianWords(amt);
                }
            });
        });

        // 12. Drilldown Modal Close
        document.getElementById('fbCloseDetailModalBtn')?.addEventListener('click', () => {
            const modal = document.getElementById('fbDetailModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // ==========================================
    // 🚀 INITIALIZE PAGE
    // ==========================================
    function init() {
        if (!enforceLayerAccess()) return;
        setupEventListeners();
        fetchFranchiseeAnalytics();
    }

    // Run when script executes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
