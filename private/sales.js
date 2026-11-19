/**
 * Sales Portal Client-Side Controller
 * Handles Dashboard analytics, New Bookings for tagged franchisees,
 * and Report downloads with wallet balance enforcement.
 */

(function () {
    const BASE_URL = window.location.origin;

    // State
    let currentUser = null;
    let salesHierarchy = null;
    let activePeriod = 'month';
    let activeMode = 'exact';
    let activeFilterType = 'all';
    let activeFilterId = 'all';
    let myFranchisees = [];
    let timelineChartInstance = null;
    let tubeChartInstance = null;
    let targetChartInstance = null;

    // DOM Elements
    const elements = {
        userName: document.getElementById('spUserName'),
        userDesigBadge: document.getElementById('spUserDesigBadge'),
        userRoleText: document.getElementById('spUserRoleText'),
        bannerTitle: document.getElementById('spBannerTitle'),
        bannerSub: document.getElementById('spBannerSub'),
        statZsm: document.getElementById('statZsm'),
        statRsm: document.getElementById('statRsm'),
        statAsm: document.getElementById('statAsm'),
        statTh: document.getElementById('statTh'),
        statFranchisees: document.getElementById('statFranchisees'),

        // Filters
        scopeSelect: document.getElementById('spScopeSelect'),
        monthPicker: document.getElementById('spMonthPicker'),
        periodBtns: document.querySelectorAll('.sp-period-btn'),
        modeBtns: document.querySelectorAll('.sp-mode-btn'),
        refreshBtn: document.getElementById('spRefreshBtn'),

        // Active Scope Banner
        activeScopeBanner: document.getElementById('spActiveScopeBanner'),
        scopeBannerTitle: document.getElementById('spScopeBannerTitle'),
        scopeBannerSub: document.getElementById('spScopeBannerSub'),
        clearScopeBtn: document.getElementById('spClearScopeBtn'),

        // KPIs
        kpiTargetCardLabel: document.getElementById('kpiTargetCardLabel'),
        kpiTargetSubtext: document.getElementById('kpiTargetSubtext'),
        kpiTargetAmount: document.getElementById('kpiTargetAmount'),
        kpiTargetAchieved: document.getElementById('kpiTargetAchieved'),
        kpiTargetPct: document.getElementById('kpiTargetPct'),
        kpiTargetFill: document.getElementById('kpiTargetFill'),
        kpiTargetDeficit: document.getElementById('kpiTargetDeficit'),

        kpiTotalRevenue: document.getElementById('kpiTotalRevenue'),
        kpiAvgRevenuePerDay: document.getElementById('kpiAvgRevenuePerDay'),
        kpiAvgTicket: document.getElementById('kpiAvgTicket'),

        kpiTotalBookings: document.getElementById('kpiTotalBookings'),
        kpiBookingsSubtext: document.getElementById('kpiBookingsSubtext'),

        kpiTotalSamples: document.getElementById('kpiTotalSamples'),
        kpiAvgSamplesPerDay: document.getElementById('kpiAvgSamplesPerDay'),

        kpiTotalTests: document.getElementById('kpiTotalTests'),
        kpiAvgTestsPerDay: document.getElementById('kpiAvgTestsPerDay'),

        kpiTotalTubes: document.getElementById('kpiTotalTubes'),
        kpiAvgTubesPerDay: document.getElementById('kpiAvgTubesPerDay'),

        // Charts
        targetChartTitle: document.getElementById('spTargetChartTitle'),
        targetChartSubtext: document.getElementById('spTargetChartSubtext'),

        // Tables & Lists
        tableTitle: document.getElementById('spTableTitle'),
        tableThead: document.getElementById('spTableThead'),
        tableTbody: document.getElementById('spTableTbody'),

        // Booking Tab
        bookingFranchiseeSelect: document.getElementById('spBookingFranchiseeSelect'),
        bookingForm: document.getElementById('spQuickBookingForm'),
        bookingSubmitBtn: document.getElementById('spSubmitBookingBtn'),

        // Reports Tab
        reportsSearchInput: document.getElementById('spReportsSearchInput'),
        reportsFranchiseeFilter: document.getElementById('spReportsFranchiseeFilter'),
        reportsTbody: document.getElementById('spReportsTbody'),
        reportsRefreshBtn: document.getElementById('spReportsRefreshBtn'),

        // Network Tab
        networkTreeContainer: document.getElementById('spNetworkTreeContainer'),

        // Logout
        logoutBtn: document.getElementById('spLogoutBtn')
    };

    // Format Indian Rupees
    function formatINR(val) {
        const num = Number(val || 0);
        return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    // Initialize Portal
    async function init() {
        setupTabs();
        setupEventListeners();

        // Set default month
        if (elements.monthPicker) {
            elements.monthPicker.value = new Date().toISOString().slice(0, 7);
        }

        try {
            await fetchHierarchy();
            await fetchMyFranchisees();
            await loadAnalytics();
            await loadReports();
        } catch (err) {
            console.error("Initialization error:", err);
        }
    }

    // Tab Navigation
    function setupTabs() {
        const tabBtns = document.querySelectorAll('.sp-tab-btn');
        const tabPanes = document.querySelectorAll('.sp-tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const targetPane = document.getElementById(targetTab);
                if (targetPane) targetPane.classList.add('active');

                if (targetTab === 'tab-reports') loadReports();
                if (targetTab === 'tab-network') renderNetworkTree();
            });
        });
    }

    // Event Listeners
    function setupEventListeners() {
        // Period pills
        if (elements.periodBtns) {
            elements.periodBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.periodBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activePeriod = btn.getAttribute('data-period');
                    loadAnalytics();
                });
            });
        }

        // View mode pills
        if (elements.modeBtns) {
            elements.modeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.modeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeMode = btn.getAttribute('data-mode');
                    loadAnalytics();
                });
            });
        }

        // Scope select
        if (elements.scopeSelect) {
            elements.scopeSelect.addEventListener('change', () => {
                const val = elements.scopeSelect.value;
                if (val === 'all') {
                    activeFilterType = 'all';
                    activeFilterId = 'all';
                } else {
                    const [type, id] = val.split(':');
                    activeFilterType = type;
                    activeFilterId = id;
                }
                loadAnalytics();
            });
        }

        // Clear scope drilldown button
        if (elements.clearScopeBtn) {
            elements.clearScopeBtn.addEventListener('click', () => {
                if (elements.scopeSelect) elements.scopeSelect.value = 'all';
                activeFilterType = 'all';
                activeFilterId = 'all';
                loadAnalytics();
            });
        }

        // Month picker
        if (elements.monthPicker) {
            elements.monthPicker.addEventListener('change', () => {
                loadAnalytics();
            });
        }

        // Refresh buttons
        if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', () => loadAnalytics());
        if (elements.reportsRefreshBtn) elements.reportsRefreshBtn.addEventListener('click', () => loadReports());

        // Reports search filter
        if (elements.reportsSearchInput) {
            elements.reportsSearchInput.addEventListener('input', debounce(() => loadReports(), 400));
        }
        if (elements.reportsFranchiseeFilter) {
            elements.reportsFranchiseeFilter.addEventListener('change', () => loadReports());
        }

        // Quick Booking Form Submit
        if (elements.bookingForm) {
            elements.bookingForm.addEventListener('submit', handleQuickBookingSubmit);
        }

        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }
    }

    // Fetch user hierarchy
    async function fetchHierarchy() {
        const res = await fetch(`${BASE_URL}/api/v1/sales/hierarchy`);
        const json = await res.json();
        if (!json.success || !json.data) throw new Error("Failed to load hierarchy");

        salesHierarchy = json.data;
        currentUser = salesHierarchy.user;

        renderUserHeader();
        populateScopeDropdown();
    }

    // Render User Header & Banner
    function renderUserHeader() {
        if (!currentUser) return;

        const desig = (currentUser.salesDesignation || currentUser.role || 'TH').toUpperCase();
        if (elements.userName) elements.userName.textContent = currentUser.fullName || currentUser.username;
        if (elements.userRoleText) elements.userRoleText.textContent = `${desig} Sales Executive`;

        if (elements.userDesigBadge) {
            elements.userDesigBadge.textContent = desig;
            elements.userDesigBadge.className = `sp-desig-pill sp-pill-${desig.toLowerCase()}`;
        }

        if (elements.bannerTitle) {
            elements.bannerTitle.innerHTML = `<i class="fa-solid fa-chart-line"></i> ${desig} Sales &amp; Performance Portal`;
        }

        const counts = salesHierarchy.counts || {};
        if (elements.statZsm) elements.statZsm.textContent = counts.zsmCount || 0;
        if (elements.statRsm) elements.statRsm.textContent = counts.rsmCount || 0;
        if (elements.statAsm) elements.statAsm.textContent = counts.asmCount || 0;
        if (elements.statTh) elements.statTh.textContent = counts.thCount || 0;
        if (elements.statFranchisees) elements.statFranchisees.textContent = counts.franchiseeCount || 0;
    }

    // Populate Scope Dropdown based on designation
    function populateScopeDropdown() {
        if (!elements.scopeSelect || !salesHierarchy) return;

        const desig = currentUser.salesDesignation || 'TH';
        let optionsHtml = `<option value="all">⚡ All Managed Units (Aggregated)</option>`;

        if (desig === 'ZSM' && salesHierarchy.downline?.rsms) {
            optionsHtml += `<optgroup label="Regional Sales Managers (RSM)">`;
            salesHierarchy.downline.rsms.forEach(r => {
                optionsHtml += `<option value="rsm:${r._id}">RSM: ${r.fullName} (${r.franchiseeCount || 0} Labs)</option>`;
            });
            optionsHtml += `</optgroup>`;
        } else if (desig === 'RSM' && salesHierarchy.downline?.asms) {
            optionsHtml += `<optgroup label="Area Sales Managers (ASM)">`;
            salesHierarchy.downline.asms.forEach(a => {
                optionsHtml += `<option value="asm:${a._id}">ASM: ${a.fullName} (${a.franchiseeCount || 0} Labs)</option>`;
            });
            optionsHtml += `</optgroup>`;
        } else if (desig === 'ASM' && salesHierarchy.downline?.ths) {
            optionsHtml += `<optgroup label="Team Heads (TH)">`;
            salesHierarchy.downline.ths.forEach(t => {
                optionsHtml += `<option value="th:${t._id}">TH: ${t.fullName} (${t.franchiseeCount || 0} Labs)</option>`;
            });
            optionsHtml += `</optgroup>`;
        } else if (salesHierarchy.downline?.franchisees) {
            optionsHtml += `<optgroup label="Franchisees / Sub-Franchisees">`;
            salesHierarchy.downline.franchisees.forEach(f => {
                optionsHtml += `<option value="franchisee:${f._id}">Lab: ${f.clinicName || f.fullName} (${f.city || 'Direct'})</option>`;
            });
            optionsHtml += `</optgroup>`;
        }

        elements.scopeSelect.innerHTML = optionsHtml;
    }

    // Fetch accessible franchisees for Booking dropdown & Reports filter
    async function fetchMyFranchisees() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/sales/my-franchisees`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                myFranchisees = json.data;

                // Populate Booking Dropdown
                if (elements.bookingFranchiseeSelect) {
                    elements.bookingFranchiseeSelect.innerHTML = `
                        <option value="">-- Choose Tagged Franchisee / Sub-Franchisee --</option>
                        ${myFranchisees.map(f => `
                            <option value="${f._id}">
                                ${f.clinicName || f.fullName} (${f.username}) - Wallet: ₹${Number(f.bookingWallet || 0).toFixed(0)}
                            </option>
                        `).join('')}
                    `;
                }

                // Populate Reports Filter
                if (elements.reportsFranchiseeFilter) {
                    elements.reportsFranchiseeFilter.innerHTML = `
                        <option value="">All Tagged Franchisees</option>
                        ${myFranchisees.map(f => `
                            <option value="${f._id}">${f.clinicName || f.fullName}</option>
                        `).join('')}
                    `;
                }
            }
        } catch (err) {
            console.error("Error fetching my franchisees:", err);
        }
    }

    // Load Business Analytics & KPIs
    async function loadAnalytics() {
        const monthVal = elements.monthPicker ? elements.monthPicker.value : '';
        const params = new URLSearchParams({
            period: activePeriod,
            month: monthVal,
            filterType: activeFilterType,
            filterId: activeFilterId
        });

        try {
            const res = await fetch(`${BASE_URL}/api/v1/sales/business-analytics?${params.toString()}`);
            const json = await res.json();
            if (!json.success || !json.data) return;

            const data = json.data;

            // Handle Active Scope Drilldown Banner
            if (activeFilterType !== 'all' && data.scopedUser) {
                if (elements.activeScopeBanner) elements.activeScopeBanner.style.display = 'flex';
                if (elements.scopeBannerTitle) {
                    elements.scopeBannerTitle.innerHTML = `<i class="fa-solid fa-bullseye"></i> Viewing Unit: <strong>${data.scopedUser.name}</strong> <span class="sp-desig-pill sp-pill-${(data.scopedUser.designation || 'th').toLowerCase()}" style="margin-left: 8px;">${data.scopedUser.designation}</span>`;
                }
                if (elements.scopeBannerSub) {
                    elements.scopeBannerSub.textContent = `Showing dedicated performance for ${data.scope?.totalLabsInScope || 0} assigned franchise labs • Target: ${formatINR(data.kpis?.targetAmount)}`;
                }
            } else {
                if (elements.activeScopeBanner) elements.activeScopeBanner.style.display = 'none';
            }

            renderKPIs(data.kpis, data.period);
            renderCharts(data.timeline, data.tubeTypes, data.targetComparison || [], data.targetLine || {}, data.scopedUser);
            renderBreakdownTable(data.breakdownRows || [], data.scope, data.scopedUser);
        } catch (err) {
            console.error("Error loading sales analytics:", err);
        }
    }

    // Render KPI Cards
    function renderKPIs(kpis = {}, period = 'month') {
        if (!kpis) return;

        // Label update based on period
        if (elements.kpiTargetCardLabel) {
            elements.kpiTargetCardLabel.textContent = (period === 'all') ? 'All-Time Quota / Target' : 'Monthly Quota / Target';
        }

        // Target vs Achieved
        if (elements.kpiTargetAmount) elements.kpiTargetAmount.textContent = formatINR(kpis.targetAmount);
        if (elements.kpiTargetAchieved) elements.kpiTargetAchieved.textContent = `Achieved: ${formatINR(kpis.totalRevenue)}`;
        if (elements.kpiTargetPct) elements.kpiTargetPct.textContent = `${kpis.achievementPct || 0}%`;
        if (elements.kpiTargetFill) {
            elements.kpiTargetFill.style.width = `${Math.min(100, kpis.achievementPct || 0)}%`;
            elements.kpiTargetFill.style.background = (kpis.achievementPct >= 100) ? '#10b981' : ((kpis.achievementPct >= 50) ? '#2563eb' : '#f59e0b');
        }
        if (elements.kpiTargetDeficit) elements.kpiTargetDeficit.textContent = `Remaining: ${formatINR(kpis.deficitAmount)}`;

        // Revenue
        if (elements.kpiTotalRevenue) elements.kpiTotalRevenue.textContent = formatINR(kpis.totalRevenue);
        if (elements.kpiAvgRevenuePerDay) elements.kpiAvgRevenuePerDay.textContent = `${formatINR(kpis.avgRevenuePerDay)} / day`;
        if (elements.kpiAvgTicket) elements.kpiAvgTicket.textContent = `Avg / Booking: ${formatINR(kpis.avgTicketSize)}`;

        // Total Bookings
        if (elements.kpiTotalBookings) elements.kpiTotalBookings.textContent = Number(kpis.totalBookings || kpis.totalSamples || 0).toLocaleString();

        // Samples
        if (elements.kpiTotalSamples) elements.kpiTotalSamples.textContent = Number(kpis.totalSamples || 0).toLocaleString();
        if (elements.kpiAvgSamplesPerDay) elements.kpiAvgSamplesPerDay.textContent = `${kpis.avgSamplesPerDay || 0} / day`;

        // Tests
        if (elements.kpiTotalTests) elements.kpiTotalTests.textContent = Number(kpis.totalTests || 0).toLocaleString();
        if (elements.kpiAvgTestsPerDay) elements.kpiAvgTestsPerDay.textContent = `${kpis.avgTestsPerDay || 0} / day`;

        // Tubes
        if (elements.kpiTotalTubes) elements.kpiTotalTubes.textContent = Number(kpis.totalTubes || 0).toLocaleString();
        if (elements.kpiAvgTubesPerDay) elements.kpiAvgTubesPerDay.textContent = `${kpis.avgTubesPerDay || 0} / day`;
    }

    // Render Charts (Target Comparison, Timeline with Benchmark, Tube Breakdown)
    function renderCharts(timeline = [], tubeTypes = [], targetComparison = [], targetLine = {}, scopedUser = null) {
        const targetCanvas = document.getElementById('spTargetChart');
        const timelineCanvas = document.getElementById('spTimelineChart');
        const tubeCanvas = document.getElementById('spTubeChart');

        // 1. Target vs Achievement Graphical Chart
        if (targetCanvas && window.Chart) {
            if (targetChartInstance) targetChartInstance.destroy();

            const isMultiUnit = targetComparison.length > 1;

            if (elements.targetChartTitle) {
                if (isMultiUnit) {
                    elements.targetChartTitle.innerHTML = `<i class="fa-solid fa-bullseye" style="color: #2563eb;"></i> Team Head Target vs. Achieved Comparison`;
                    if (elements.targetChartSubtext) elements.targetChartSubtext.textContent = `Comparing quota vs live booking sales for ${targetComparison.length} Team Heads`;
                } else {
                    const subjectName = scopedUser?.name || currentUser?.fullName || 'Sales Executive';
                    elements.targetChartTitle.innerHTML = `<i class="fa-solid fa-bullseye" style="color: #2563eb;"></i> Target Goal &amp; Run-Rate for ${subjectName}`;
                    if (elements.targetChartSubtext) elements.targetChartSubtext.textContent = `Target: ${formatINR(targetLine.targetAmount)} • Achieved: ${targetLine.achievementPct || 0}%`;
                }
            }

            if (isMultiUnit) {
                // Grouped Bar Chart comparing each TH side-by-side
                const labels = targetComparison.map(t => t.name || 'Executive');
                const targets = targetComparison.map(t => Number(t.target || 0));
                const achieved = targetComparison.map(t => Number(t.revenue || 0));

                targetChartInstance = new Chart(targetCanvas, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Monthly Target (₹)',
                                data: targets,
                                backgroundColor: 'rgba(59, 130, 246, 0.35)',
                                borderColor: '#2563eb',
                                borderWidth: 1.5,
                                borderRadius: 6
                            },
                            {
                                label: 'Achieved Sales (₹)',
                                data: achieved,
                                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                                borderColor: '#059669',
                                borderWidth: 1.5,
                                borderRadius: 6
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    afterBody: function(context) {
                                        const idx = context[0].dataIndex;
                                        const item = targetComparison[idx];
                                        if (item) {
                                            return `Achieved: ${item.achievementPct || 0}%\nBookings: ${item.bookings || 0}\nTagged Labs: ${item.labsCount || 0}`;
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '₹' + (value >= 100000 ? (value / 100000).toFixed(1) + 'L' : value.toLocaleString('en-IN'));
                                    }
                                },
                                grid: { color: '#f1f5f9' }
                            },
                            x: {
                                grid: { display: false }
                            }
                        }
                    }
                });
            } else {
                // Single Unit Overview: Target vs Achieved vs Remaining
                const targetAmt = Number(targetLine.targetAmount || 0);
                const achievedAmt = Number(targetLine.achievedAmount || 0);
                const remainingAmt = Number(targetLine.deficitAmount || 0);

                targetChartInstance = new Chart(targetCanvas, {
                    type: 'bar',
                    data: {
                        labels: ['Target Quota', 'Achieved Sales', 'Remaining Gap'],
                        datasets: [{
                            label: 'Amount (₹)',
                            data: [targetAmt, achievedAmt, remainingAmt],
                            backgroundColor: [
                                'rgba(37, 99, 235, 0.8)',
                                'rgba(16, 185, 129, 0.85)',
                                'rgba(245, 158, 11, 0.8)'
                            ],
                            borderColor: ['#1d4ed8', '#059669', '#d97706'],
                            borderWidth: 1.5,
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return ' ' + formatINR(context.raw);
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '₹' + (value >= 100000 ? (value / 100000).toFixed(1) + 'L' : value.toLocaleString('en-IN'));
                                    }
                                },
                                grid: { color: '#f1f5f9' }
                            },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        }

        // 2. Timeline Trend Chart with Target Benchmark Line
        if (timelineCanvas && window.Chart) {
            const labels = timeline.map(t => t.date.slice(5)); // MM-DD
            const revData = timeline.map(t => t.revenue);
            const sampleData = timeline.map(t => t.samples);
            const benchmarkData = timeline.map(t => t.targetBenchmark || 0);

            if (timelineChartInstance) timelineChartInstance.destroy();

            timelineChartInstance = new Chart(timelineCanvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Daily Sales (₹)',
                            data: revData,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Target Benchmark (Run-Rate)',
                            data: benchmarkData,
                            borderColor: '#f59e0b',
                            borderDash: [5, 5],
                            pointRadius: 0,
                            borderWidth: 2,
                            fill: false,
                            tension: 0,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Samples Logged',
                            data: sampleData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                callback: function(value) {
                                    return '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value);
                                }
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }

        // 3. Tube Types Chart
        if (tubeCanvas && window.Chart) {
            const tubeLabels = tubeTypes.map(t => t._id || 'Plain');
            const tubeCounts = tubeTypes.map(t => t.count);

            const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#f59e0b', '#10b981', '#64748b', '#ef4444', '#14b8a6'];

            if (tubeChartInstance) tubeChartInstance.destroy();

            tubeChartInstance = new Chart(tubeCanvas, {
                type: 'doughnut',
                data: {
                    labels: tubeLabels,
                    datasets: [{
                        data: tubeCounts,
                        backgroundColor: colors.slice(0, tubeLabels.length)
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }
    }

    // Render Breakdown Table
    function renderBreakdownTable(rows = [], scope = {}, scopedUser = null) {
        if (!elements.tableTbody) return;

        const desig = currentUser?.salesDesignation || 'TH';
        const isScopedToTH = scope?.filterType === 'th';
        const isScopedToASM = scope?.filterType === 'asm';

        // Dynamic Table Title & Header
        if (elements.tableTitle) {
            if (isScopedToTH) {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-store text-blue"></i> Assigned Franchise Labs under ${scopedUser?.name || 'Selected Team Head'}`;
            } else if (isScopedToASM) {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-users text-emerald"></i> Team Heads (TH) under ${scopedUser?.name || 'Selected ASM'}`;
            } else if (desig === 'ZSM') {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-crown text-amber"></i> Regional Sales Managers (RSM) Performance`;
            } else if (desig === 'RSM') {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-network-wired text-purple"></i> Area Sales Managers (ASM) Performance`;
            } else if (desig === 'ASM') {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-users text-emerald"></i> Team Heads (TH) Target vs. Achieved Performance`;
            } else {
                elements.tableTitle.innerHTML = `<i class="fa-solid fa-store text-blue"></i> My Tagged Franchise Labs Performance`;
            }
        }

        // Table Header
        if (elements.tableThead) {
            if (isScopedToTH || desig === 'TH' || (!isScopedToASM && desig !== 'ASM' && desig !== 'RSM' && desig !== 'ZSM')) {
                // Labs Table
                elements.tableThead.innerHTML = `
                    <tr>
                        <th>#</th>
                        <th>Franchise / Lab Name</th>
                        <th>Type</th>
                        <th>Contact &amp; Username</th>
                        <th>Total Sales</th>
                        <th>Bookings</th>
                        <th>Samples</th>
                        <th>Tubes</th>
                        <th>Wallet Balance</th>
                        <th>Account Health</th>
                        <th>Action</th>
                    </tr>
                `;
            } else {
                // Team Heads / Managers Table
                elements.tableThead.innerHTML = `
                    <tr>
                        <th>#</th>
                        <th>Executive / Manager</th>
                        <th>Designation</th>
                        <th>Managed Territory</th>
                        <th>Monthly Target</th>
                        <th>Achieved Sales</th>
                        <th>Bookings</th>
                        <th>Samples</th>
                        <th>Achieved %</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                `;
            }
        }

        if (!rows.length) {
            elements.tableTbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 24px; color: #94a3b8;">No records found for the selected scope.</td></tr>`;
            return;
        }

        elements.tableTbody.innerHTML = rows.map((r, i) => {
            const isFranchiseeRow = r.walletBalance !== undefined;

            if (isFranchiseeRow) {
                const walletBadge = `<span class="sp-wallet-badge ${r.isWalletPositive ? 'sp-wallet-pos' : 'sp-wallet-neg'}">
                    <i class="fa-solid ${r.isWalletPositive ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ₹${Number(r.walletBalance || 0).toFixed(0)}
                </span>`;

                return `
                    <tr>
                        <td><strong>${i + 1}</strong></td>
                        <td>
                            <strong style="color: #0f172a; font-size: 14px;">${r.name || r.clinicName}</strong>
                            <div style="font-size: 11px; color: #64748b;">${r.city ? r.city + ' • ' : ''}@${r.username}</div>
                        </td>
                        <td><span class="sp-desig-pill sp-pill-th">${r.designation || 'Lab'}</span></td>
                        <td>
                            <div><i class="fa-solid fa-phone" style="font-size: 11px; color:#64748b;"></i> ${r.phoneNo || 'N/A'}</div>
                        </td>
                        <td><strong style="color: #059669; font-size: 14px;">${formatINR(r.revenue)}</strong></td>
                        <td><span style="font-weight: 700; color: #2563eb;">${Number(r.bookings || r.samples || 0).toLocaleString()}</span></td>
                        <td>${Number(r.samples || 0).toLocaleString()}</td>
                        <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-weight:600;">${r.tubes || 0}</span></td>
                        <td>${walletBadge}</td>
                        <td>
                            <span style="font-size: 12px; font-weight: 600; color: ${r.isWalletPositive ? '#059669' : '#e11d48'};">
                                <i class="fa-solid ${r.isWalletPositive ? 'fa-check' : 'fa-triangle-exclamation'}"></i> ${r.isWalletPositive ? 'Healthy' : 'Blocked'}
                            </span>
                        </td>
                        <td>
                            <button type="button" class="sp-btn sp-btn-primary sp-btn-sm" onclick="salesOpenBookingFor('${r.id}')" title="Book test for this lab">
                                <i class="fa-solid fa-plus"></i> Book
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                // Executive / TH Row
                const pct = Number(r.achievementPct || 0);
                const pctColor = pct >= 100 ? '#059669' : (pct >= 50 ? '#2563eb' : '#d97706');

                return `
                    <tr>
                        <td><strong>${i + 1}</strong></td>
                        <td>
                            <strong style="color: #0f172a; font-size: 14px;">${r.name}</strong>
                            <div style="font-size: 11px; color: #64748b;">${r.phoneNo || ('@' + r.username)}</div>
                        </td>
                        <td><span class="sp-desig-pill sp-pill-${(r.designation || 'th').toLowerCase()}">${r.designation || 'TH'}</span></td>
                        <td><span style="font-size: 12px; color: #475569; font-weight: 600;">${r.subordinateCount || 'Assigned Labs'}</span></td>
                        <td><strong style="color: #1e293b;">${formatINR(r.target)}</strong></td>
                        <td><strong style="color: #059669; font-size: 14px;">${formatINR(r.revenue)}</strong></td>
                        <td><span style="font-weight: 700; color: #2563eb;">${Number(r.bookings || r.samples || 0).toLocaleString()}</span></td>
                        <td>${Number(r.samples || 0).toLocaleString()}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-weight: 700; color: ${pctColor};">${pct}%</span>
                                <div style="width: 48px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${Math.min(100, pct)}%; height: 100%; background: ${pctColor};"></div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span style="font-size: 12px; font-weight: 600; color: ${pct >= 100 ? '#059669' : '#64748b'};">
                                ${pct >= 100 ? '<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Achieved' : (pct > 0 ? 'In Progress' : 'No Sales')}
                            </span>
                        </td>
                        <td>
                            <button type="button" class="sp-btn sp-btn-primary sp-btn-sm" onclick="salesDrilldown('${(r.designation || 'th').toLowerCase()}', '${r.id}')" title="Drilldown into this unit's dashboard">
                                <i class="fa-solid fa-chart-simple"></i> View Labs
                            </button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    }

    // Global action: Drilldown to sub-unit
    window.salesDrilldown = function (type, id, name = '') {
        if (!elements.scopeSelect) return;
        const targetVal = `${type}:${id}`;
        const exists = Array.from(elements.scopeSelect.options).some(opt => opt.value === targetVal);
        if (!exists) {
            const newOpt = document.createElement('option');
            newOpt.value = targetVal;
            newOpt.textContent = `📍 ${name || (type.toUpperCase() + ' Unit')}`;
            elements.scopeSelect.appendChild(newOpt);
        }
        elements.scopeSelect.value = targetVal;
        activeFilterType = type;
        activeFilterId = id;
        loadAnalytics();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Global action: Open booking tab with pre-selected franchisee
    window.salesOpenBookingFor = function (franchiseeId) {
        const bookingTabBtn = document.querySelector('[data-tab="tab-booking"]');
        if (bookingTabBtn) bookingTabBtn.click();
        if (elements.bookingFranchiseeSelect) {
            elements.bookingFranchiseeSelect.value = franchiseeId;
        }
    };

    // Load Patient Reports List
    async function loadReports() {
        if (!elements.reportsTbody) return;

        const search = elements.reportsSearchInput ? elements.reportsSearchInput.value.trim() : '';
        const franchiseeId = elements.reportsFranchiseeFilter ? elements.reportsFranchiseeFilter.value : '';

        elements.reportsTbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Loading reports for tagged franchisees...
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({ search, franchiseeId });
            const res = await fetch(`${BASE_URL}/api/v1/sales/bookings?${params.toString()}`);
            const json = await res.json();

            if (!json.success || !json.data?.bookings || json.data.bookings.length === 0) {
                elements.reportsTbody.innerHTML = `
                    <tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">No bookings found.</td></tr>
                `;
                return;
            }

            elements.reportsTbody.innerHTML = json.data.bookings.map((b, i) => {
                const canDownload = Boolean(b.canDownloadReport);
                const fran = b.franchisee || {};
                const walletBal = Number(fran.walletBalance || 0);
                const isSigned = Boolean(b.isSignedOff);

                const statusHtml = isSigned
                    ? `<div style="display: flex; flex-direction: column; gap: 4px;">
                         <span class="sp-badge-signed">
                             <i class="fa-solid fa-file-signature"></i> Signed Off
                         </span>
                         ${b.signedBy ? `<span style="font-size: 10.5px; color: #059669; font-weight: 600;"><i class="fa-solid fa-user-check"></i> ${escapeHtml(b.signedBy)}</span>` : ''}
                       </div>`
                    : `<span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #f1f5f9; color: #475569; display: inline-flex; align-items: center; gap: 5px;">
                         <i class="fa-regular fa-clock" style="color: #f59e0b;"></i> ${escapeHtml(b.status || 'Pending')}
                       </span>`;

                const actionHtml = isSigned
                    ? `<button type="button" 
                         class="sp-btn ${canDownload ? 'sp-btn-primary' : 'sp-btn-locked'} sp-btn-sm" 
                         onclick="openLetterheadDownloadModal('${b._id}', '${escapeHtml(b.bookingId)}', '${escapeHtml(b.patientName)}', ${canDownload}, '${escapeHtml(fran.clinicName || fran.fullName || '')}', ${walletBal})">
                         <i class="fa-solid ${canDownload ? 'fa-file-pdf' : 'fa-lock'}"></i>
                         ${canDownload ? 'Download Report' : 'Locked (Negative)'}
                       </button>`
                    : `<span class="sp-badge-pending-signoff" title="This report is not signed off yet. Download button unlocks once signed off.">
                         <i class="fa-solid fa-hourglass-half"></i> Pending Sign-Off
                       </span>`;

                return `
                    <tr>
                        <td><strong>${b.bookingId || 'N/A'}</strong></td>
                        <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                        <td>
                            <strong>${escapeHtml(b.patientName)}</strong>
                            <div style="font-size: 11px; color: #64748b;">${b.age ? b.age + ' yrs' : ''} • ${b.gender || ''}</div>
                        </td>
                        <td>
                            <strong>${escapeHtml(fran.clinicName || fran.fullName || 'Lab')}</strong>
                            <div style="font-size: 11px; color: #64748b;">@${escapeHtml(fran.username || '')}</div>
                        </td>
                        <td>${escapeHtml(b.doctorName || 'Self')}</td>
                        <td>
                            <span class="sp-wallet-badge ${canDownload ? 'sp-wallet-pos' : 'sp-wallet-neg'}">
                                <i class="fa-solid ${canDownload ? 'fa-wallet' : 'fa-triangle-exclamation'}"></i>
                                ₹${walletBal.toFixed(0)}
                            </span>
                        </td>
                        <td>${statusHtml}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error("Error loading sales reports:", err);
            elements.reportsTbody.innerHTML = `
                <tr><td colspan="9" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load reports.</td></tr>
            `;
        }
    }

    // Global action: Open Download Report Modal with Letterhead Selection
    window.openLetterheadDownloadModal = async function (mongoId, bookingId, patientName, canDownload, franchiseeName, walletBal) {
        // Step 1: If frontend already knows wallet is negative, block immediately
        if (!canDownload || Number(walletBal || 0) < 0) {
            showRestrictedModal(franchiseeName, walletBal);
            return;
        }

        // Step 2: Real-time backend pre-flight check to ensure wallet hasn't gone negative
        try {
            const checkRes = await fetch(`${BASE_URL}/api/v1/sales/check-report-eligibility/${mongoId}`, {
                credentials: 'include'
            });
            const checkJson = await checkRes.json();

            if (!checkRes.ok || !checkJson.success || !checkJson.data?.allowed) {
                const bal = checkJson.data?.walletBalance ?? walletBal;
                showRestrictedModal(franchiseeName, bal);
                return;
            }
        } catch (err) {
            console.error("Error checking report eligibility:", err);
            // Non-blocking fallback if network check fails, proceed with initial verification
        }

        // Step 3: Remove any existing modals
        document.querySelectorAll('.sp-modal-backdrop').forEach(el => el.remove());

        // Step 4: Render the Letterhead Selection Modal
        const modal = document.createElement('div');
        modal.className = 'sp-modal-backdrop';
        modal.id = 'spLetterheadModal';
        modal.innerHTML = `
            <div class="sp-modal-box" style="max-width: 620px;">
                <div class="sp-modal-icon-blue">
                    <i class="fa-solid fa-file-lines"></i>
                </div>
                <h3 style="text-align: center; margin-bottom: 4px; color: #0f172a; font-size: 21px; font-weight: 700;">
                    Download Lab Report
                </h3>
                <p style="text-align: center; color: #64748b; font-size: 13.5px; margin-bottom: 6px;">
                    Select your preferred report format for direct in-page download
                </p>
                <div style="text-align: center; margin-bottom: 20px;">
                    <span style="display: inline-block; background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #334155;">
                        <strong style="color: #0f172a;">${escapeHtml(patientName)}</strong> &bull; Booking ID: <code style="color: #2563eb; font-weight: 700;">${escapeHtml(bookingId)}</code>
                    </span>
                </div>

                <!-- 2-Option Card Grid: With vs Without Letterhead -->
                <div class="sp-format-card-grid">
                    <!-- Option 1: With Letterhead -->
                    <div class="sp-format-card" onclick="executeSalesPdfDownload('${escapeHtml(bookingId)}', '${escapeHtml(patientName)}', 'with', this)">
                        <span class="sp-format-card-badge badge-with">Standard</span>
                        <div>
                            <div class="sp-format-icon sp-format-icon-blue">
                                <i class="fa-solid fa-file-medical"></i>
                            </div>
                            <div class="sp-format-title">
                                With Letterhead
                            </div>
                            <div style="font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 6px;">
                                (लेटरहेड व लोगो सहित)
                            </div>
                            <div class="sp-format-subtext">
                                Full digital report complete with lab logo, header, address, test results &amp; sign-off stamps. Best for direct patient delivery.
                            </div>
                        </div>
                        <button type="button" class="sp-format-action-btn sp-btn-with">
                            <i class="fa-solid fa-download"></i> Download With Letterhead
                        </button>
                    </div>

                    <!-- Option 2: Without Letterhead -->
                    <div class="sp-format-card format-without" onclick="executeSalesPdfDownload('${escapeHtml(bookingId)}', '${escapeHtml(patientName)}', 'without', this)">
                        <span class="sp-format-card-badge badge-without">Stationery</span>
                        <div>
                            <div class="sp-format-icon sp-format-icon-teal">
                                <i class="fa-solid fa-print"></i>
                            </div>
                            <div class="sp-format-title">
                                Without Letterhead
                            </div>
                            <div style="font-size: 11px; font-weight: 600; color: #0d9488; margin-bottom: 6px;">
                                (बिना लेटरहेड / सादा)
                            </div>
                            <div class="sp-format-subtext">
                                Leaves official top &amp; bottom margins blank. Formatted specifically for printing on pre-printed lab letterhead stationery.
                            </div>
                        </div>
                        <button type="button" class="sp-format-action-btn sp-btn-without">
                            <i class="fa-solid fa-print"></i> Download Without Letterhead
                        </button>
                    </div>
                </div>

                <!-- Live Loading State -->
                <div id="spDlLoadingState" style="display: none; margin-top: 18px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; text-align: center; color: #1e40af; font-size: 13px; font-weight: 600;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px; margin-right: 8px;"></i>
                    <span>Preparing report and generating official PDF... Please wait a moment.</span>
                </div>

                <!-- Footer Cancel Button -->
                <div style="display: flex; justify-content: flex-end; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                    <button type="button" class="sp-btn sp-btn-outline" onclick="this.closest('.sp-modal-backdrop').remove()">
                        <i class="fa-solid fa-xmark"></i> Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    // Global action: Execute Direct In-Page PDF Download (With or Without Letterhead)
    window.executeSalesPdfDownload = async function (bookingId, patientName, format, clickedCard) {
        const loadingBox = document.getElementById('spDlLoadingState');
        const modalBox = document.getElementById('spLetterheadModal');
        
        // Show loading state and prevent duplicate clicks
        if (loadingBox) loadingBox.style.display = 'block';
        if (modalBox) {
            const btns = modalBox.querySelectorAll('button, .sp-format-card');
            btns.forEach(b => {
                b.style.pointerEvents = 'none';
                b.style.opacity = '0.7';
            });
        }

        try {
            // 1. Fetch Report Data to resolve MongoDB report ID
            const reportDataRes = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ value1: bookingId, bookingId: bookingId })
            });

            if (!reportDataRes.ok) {
                const errJson = await reportDataRes.json().catch(() => null);
                throw new Error(errJson?.message || 'Could not fetch report details for this booking.');
            }

            const reportDoc = await reportDataRes.json();
            const reportId = reportDoc?._id || reportDoc?.data?._id;

            if (!reportId) {
                throw new Error('Report document not found. The report may still be in process.');
            }

            // 2. Request PDF Generation from get-pdf endpoint
            // checkBox: false = WITH letterhead, checkBox: true = WITHOUT letterhead
            const isWithout = (format === 'without');
            const pdfRes = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    value1: reportId,
                    bookingId: bookingId,
                    checkBox: isWithout,
                    auditAction: 'DOWNLOAD'
                })
            });

            if (!pdfRes.ok) {
                const errJson = await pdfRes.json().catch(() => null);
                if (errJson?.restricted) {
                    if (modalBox) modalBox.remove();
                    showRestrictedModal('Franchisee', errJson.walletBalance);
                    return;
                }
                throw new Error(errJson?.message || 'PDF generation failed on server.');
            }

            // 3. Receive PDF Blob and trigger browser direct download
            const blob = await pdfRes.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;

            const safePatientName = String(patientName || 'Report')
                .trim()
                .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
                .replace(/\s+/g, '_');
            const formatSuffix = isWithout ? '_WithoutLetterhead' : '_WithLetterhead';
            a.download = `${bookingId}_${safePatientName}${formatSuffix}.pdf`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            // 4. Close modal and show success toast
            if (modalBox) modalBox.remove();
            showSalesToast(`✓ ${format === 'without' ? 'Without Letterhead' : 'With Letterhead'} report downloaded for ${patientName}!`, 'success');

        } catch (err) {
            console.error("Sales report download error:", err);
            alert(`Download Failed: ${err.message || 'Unknown error occurred while generating PDF.'}`);
            // Restore modal buttons
            if (loadingBox) loadingBox.style.display = 'none';
            if (modalBox) {
                const btns = modalBox.querySelectorAll('button, .sp-format-card');
                btns.forEach(b => {
                    b.style.pointerEvents = 'auto';
                    b.style.opacity = '1';
                });
            }
        }
    };

    // Backward compatibility wrapper in case old buttons reference salesDownloadReport
    window.salesDownloadReport = function (mongoId, bookingId, canDownload, franchiseeName, walletBal) {
        window.openLetterheadDownloadModal(mongoId, bookingId, 'Patient', canDownload, franchiseeName, walletBal);
    };

    // Notification toast helper
    function showSalesToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'sp-toast-notification';
        toast.style.borderColor = (type === 'success') ? '#10b981' : '#3b82f6';
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}" style="color: ${type === 'success' ? '#34d399' : '#60a5fa'}; font-size: 18px;"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function showRestrictedModal(franchiseeName, walletBal) {
        const negativeAmount = Math.abs(Number(walletBal || 0)).toFixed(2);
        const modal = document.createElement('div');
        modal.className = 'sp-modal-backdrop';
        modal.innerHTML = `
            <div class="sp-modal-box">
                <div class="sp-modal-icon-danger">
                    <i class="fa-solid fa-ban"></i>
                </div>
                <h3 style="text-align:center; margin-bottom: 8px; color: #0f172a; font-size: 20px;">Report Download Restricted</h3>
                <p style="text-align:center; color: #64748b; font-size: 14px; margin-bottom: 16px;">
                    Franchisee <strong>${franchiseeName}</strong> account balance is currently in <strong>negative (-₹${negativeAmount})</strong>.
                </p>
                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #9f1239;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <strong>Policy Enforcement:</strong> Lab reports cannot be extracted or printed when the franchisee account is negative. Please request the lab owner to recharge the wallet to positive balance to unlock reports.
                </div>
                <div style="display: flex; justify-content: center;">
                    <button type="button" class="sp-btn sp-btn-primary" onclick="this.closest('.sp-modal-backdrop').remove()">
                        <i class="fa-solid fa-check"></i> Understood
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Quick Booking Form Submit
    async function handleQuickBookingSubmit(e) {
        e.preventDefault();
        const franchiseeId = elements.bookingFranchiseeSelect.value;
        const patientName = document.getElementById('spPatientName')?.value.trim();
        const age = document.getElementById('spPatientAge')?.value.trim();
        const gender = document.getElementById('spPatientGender')?.value;
        const phone = document.getElementById('spPatientPhone')?.value.trim();
        const doctor = document.getElementById('spDoctorName')?.value.trim();
        const testName = document.getElementById('spTestName')?.value.trim();
        const amount = Number(document.getElementById('spBookingAmount')?.value || 0);

        if (!franchiseeId) {
            alert("Please select a franchisee from the dropdown!");
            return;
        }
        if (!patientName) {
            alert("Please enter patient name!");
            return;
        }

        const selectedFran = myFranchisees.find(f => f._id === franchiseeId) || {};

        const bookingPayload = {
            patientName,
            age,
            gender,
            patientPhone: phone,
            doctorName: doctor || 'Self',
            subFranchiseeId: franchiseeId,
            franchisee: selectedFran.fullName || selectedFran.username,
            total: amount,
            tableData: [
                {
                    testName: testName || 'Routine Investigation',
                    typeOfSample: 'Serum',
                    rate: amount
                }
            ]
        };

        if (elements.bookingSubmitBtn) {
            elements.bookingSubmitBtn.disabled = true;
            elements.bookingSubmitBtn.textContent = "Placing Booking...";
        }

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/new-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingPayload)
            });
            const json = await res.json();

            if (res.ok && json.success) {
                alert(`Booking placed successfully for ${selectedFran.clinicName || selectedFran.fullName}! Booking ID: ${json.data?.bookingId || ''}`);
                elements.bookingForm.reset();
                loadAnalytics();
            } else {
                alert(`Failed to place booking: ${json.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Booking error:", err);
            alert("Error placing booking. Please try again.");
        } finally {
            if (elements.bookingSubmitBtn) {
                elements.bookingSubmitBtn.disabled = false;
                elements.bookingSubmitBtn.textContent = "Place Booking";
            }
        }
    }

    // Render Network Tree in Team Tab
    function renderNetworkTree() {
        if (!elements.networkTreeContainer || !salesHierarchy) return;

        const desig = currentUser?.salesDesignation || 'TH';
        let treeHtml = '';

        if (desig === 'TH') {
            const frans = salesHierarchy.downline?.franchisees || [];
            treeHtml = `
                <div style="background: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin-bottom: 16px; font-size: 16px; color: #1e293b;">
                        <i class="fa-solid fa-store" style="color: #2563eb;"></i> Managed Franchisees &amp; Labs (${frans.length})
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
                        ${frans.map(f => `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong>${f.clinicName || f.fullName}</strong>
                                    <span class="sp-wallet-badge ${Number(f.bookingWallet || 0) >= 0 ? 'sp-wallet-pos' : 'sp-wallet-neg'}">
                                        ₹${Number(f.bookingWallet || 0).toFixed(0)}
                                    </span>
                                </div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                    <div><i class="fa-solid fa-user"></i> @${f.username}</div>
                                    <div><i class="fa-solid fa-phone"></i> ${f.phoneNo || 'N/A'}</div>
                                    <div><i class="fa-solid fa-location-dot"></i> ${f.city || 'Direct'}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            treeHtml = `
                <div style="background: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin-bottom: 16px; font-size: 16px; color: #1e293b;">
                        <i class="fa-solid fa-sitemap" style="color: #2563eb;"></i> Sales Team Hierarchy &amp; Network
                    </h3>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                        You are logged in as <strong>${desig}</strong> overseeing <strong>${salesHierarchy.counts?.franchiseeCount || 0}</strong> lab franchises across your territory.
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; text-align: center;">
                            <span style="font-size: 28px; font-weight: 700; color: #1d4ed8;">${salesHierarchy.counts?.rsmCount || 0}</span>
                            <div style="font-size: 12px; font-weight: 600; color: #2563eb; text-transform: uppercase;">Regional Managers (RSM)</div>
                        </div>
                        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; text-align: center;">
                            <span style="font-size: 28px; font-weight: 700; color: #047857;">${salesHierarchy.counts?.asmCount || 0}</span>
                            <div style="font-size: 12px; font-weight: 600; color: #059669; text-transform: uppercase;">Area Managers (ASM)</div>
                        </div>
                        <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 16px; text-align: center;">
                            <span style="font-size: 28px; font-weight: 700; color: #6d28d9;">${salesHierarchy.counts?.thCount || 0}</span>
                            <div style="font-size: 12px; font-weight: 600; color: #7c3aed; text-transform: uppercase;">Team Heads (TH)</div>
                        </div>
                        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; text-align: center;">
                            <span style="font-size: 28px; font-weight: 700; color: #b45309;">${salesHierarchy.counts?.franchiseeCount || 0}</span>
                            <div style="font-size: 12px; font-weight: 600; color: #d97706; text-transform: uppercase;">Franchise Labs Tagged</div>
                        </div>
                    </div>
                </div>
            `;
        }

        elements.networkTreeContainer.innerHTML = treeHtml;
    }

    // Logout
    function handleLogout() {
        document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/franchiseelogin.html';
    }

    // Helper: Debounce
    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Helper: HTML escape
    function escapeHtml(str) {
        return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // Start on DOM loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

