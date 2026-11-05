function initEmbeddedSalesPortal() {
    const BASE_URL = window.location.origin;

    const el = {
        statZsm: document.getElementById('adminStatZsm'),
        statRsm: document.getElementById('adminStatRsm'),
        statAsm: document.getElementById('adminStatAsm'),
        statTh: document.getElementById('adminStatTh'),
        statLabs: document.getElementById('adminStatLabs'),

        desigFilter: document.getElementById('spAdminDesigFilter'),
        periodBtns: document.querySelectorAll('.sp-adm-period'),
        monthPicker: document.getElementById('spAdminMonthPicker'),
        refreshBtn: document.getElementById('spAdminRefreshBtn'),
        searchStaff: document.getElementById('spAdminSearchStaff'),

        kpiTarget: document.getElementById('adminKpiTarget'),
        kpiAchieved: document.getElementById('adminKpiAchieved'),
        kpiRevenue: document.getElementById('adminKpiRevenue'),
        kpiAvgRev: document.getElementById('adminKpiAvgRev'),
        kpiSamples: document.getElementById('adminKpiSamples'),
        kpiAvgSamples: document.getElementById('adminKpiAvgSamples'),
        kpiTests: document.getElementById('adminKpiTests'),
        kpiTubes: document.getElementById('adminKpiTubes'),

        staffTbody: document.getElementById('spAdminStaffTbody')
    };

    let activePeriod = 'month';
    let allStaffList = [];

    // Format Currency
    function formatINR(val) {
        return '₹' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    // Set default month
    if (el.monthPicker) {
        el.monthPicker.value = new Date().toISOString().slice(0, 7);
    }

    // Event listeners
    if (el.periodBtns) {
        el.periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                el.periodBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                });
                btn.style.background = '#fff';
                btn.style.color = '#2563eb';
                activePeriod = btn.getAttribute('data-period');
                loadData();
            });
        });
    }

    if (el.desigFilter) el.desigFilter.addEventListener('change', () => filterStaffTable());
    if (el.monthPicker) el.monthPicker.addEventListener('change', () => loadData());
    if (el.refreshBtn) el.refreshBtn.addEventListener('click', () => loadData());
    if (el.searchStaff) el.searchStaff.addEventListener('input', () => filterStaffTable());

    async function loadData() {
        await Promise.all([
            fetchNetworkSummary(),
            fetchAnalytics(),
            fetchSalesStaff()
        ]);
    }

    // Network Summary counts
    async function fetchNetworkSummary() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/sales/hierarchy`);
            const json = await res.json();
            if (json.success && json.data) {
                const counts = json.data.counts || {};
                if (el.statZsm) el.statZsm.textContent = counts.zsmCount || 0;
                if (el.statRsm) el.statRsm.textContent = counts.rsmCount || 0;
                if (el.statAsm) el.statAsm.textContent = counts.asmCount || 0;
                if (el.statTh) el.statTh.textContent = counts.thCount || 0;
                if (el.statLabs) el.statLabs.textContent = counts.franchiseeCount || 0;
            }
        } catch (err) {
            console.error("Network summary error:", err);
        }
    }

    // Aggregated Business Analytics & KPIs
    async function fetchAnalytics() {
        const monthVal = el.monthPicker ? el.monthPicker.value : '';
        const params = new URLSearchParams({
            period: activePeriod,
            month: monthVal
        });

        try {
            const res = await fetch(`${BASE_URL}/api/v1/sales/business-analytics?${params.toString()}`);
            const json = await res.json();
            if (json.success && json.data) {
                const kpis = json.data.kpis || {};
                if (el.kpiTarget) el.kpiTarget.textContent = formatINR(kpis.targetAmount);
                if (el.kpiAchieved) el.kpiAchieved.textContent = `Achieved: ${formatINR(kpis.totalRevenue)} (${kpis.achievementPct || 0}%)`;
                if (el.kpiRevenue) el.kpiRevenue.textContent = formatINR(kpis.totalRevenue);
                if (el.kpiAvgRev) el.kpiAvgRev.textContent = `Daily Avg: ${formatINR(kpis.avgRevenuePerDay)} / day`;
                if (el.kpiSamples) el.kpiSamples.textContent = Number(kpis.totalSamples || 0).toLocaleString();
                if (el.kpiAvgSamples) el.kpiAvgSamples.textContent = `Daily Avg: ${kpis.avgSamplesPerDay || 0} / day`;
                if (el.kpiTests) el.kpiTests.textContent = Number(kpis.totalTests || 0).toLocaleString();
                if (el.kpiTubes) el.kpiTubes.textContent = Number(kpis.totalTubes || 0).toLocaleString();
            }
        } catch (err) {
            console.error("Analytics fetch error:", err);
        }
    }

    // Sales staff roster
    async function fetchSalesStaff() {
        if (!el.staffTbody) return;
        try {
            const res = await fetch(`${BASE_URL}/api/v1/sales/all-sales-staff`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                allStaffList = json.data;
                filterStaffTable();
            } else {
                el.staffTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">No sales personnel registered yet.</td></tr>`;
            }
        } catch (err) {
            console.error("Staff fetch error:", err);
            el.staffTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load sales staff.</td></tr>`;
        }
    }

    // Filter & Render Table
    function filterStaffTable() {
        if (!el.staffTbody) return;

        const desig = el.desigFilter ? el.desigFilter.value.toUpperCase() : 'ALL';
        const search = el.searchStaff ? el.searchStaff.value.trim().toLowerCase() : '';

        let filtered = allStaffList;

        if (desig !== 'ALL') {
            filtered = filtered.filter(s => (s.salesDesignation || '').toUpperCase() === desig);
        }

        if (search) {
            filtered = filtered.filter(s =>
                (s.fullName || '').toLowerCase().includes(search) ||
                (s.username || '').toLowerCase().includes(search) ||
                (s.phoneNo || '').toLowerCase().includes(search) ||
                (s.email || '').toLowerCase().includes(search)
            );
        }

        if (!filtered.length) {
            el.staffTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">No matching sales personnel found.</td></tr>`;
            return;
        }

        const pillColors = {
            ZSM: 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;',
            RSM: 'background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe;',
            ASM: 'background: #d1fae5; color: #047857; border: 1px solid #a7f3d0;',
            TH:  'background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe;'
        };

        el.staffTbody.innerHTML = filtered.map((s, idx) => {
            const d = s.salesDesignation || 'Sales';
            const badgeStyle = pillColors[d] || 'background: #f1f5f9; color: #334155;';

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 14px;"><strong>${idx + 1}</strong></td>
                    <td style="padding: 12px 14px;">
                        <strong style="color: #0f172a; font-size: 14px;">${s.fullName}</strong>
                        <div style="font-size: 11px; color: #64748b;">${s.email || ''}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                            ${d}
                        </span>
                    </td>
                    <td style="padding: 12px 14px;">
                        <div><i class="fa-solid fa-phone" style="color: #64748b; font-size: 11px;"></i> ${s.phoneNo || 'N/A'}</div>
                        <div style="font-size: 11px; color: #64748b;">@${s.username}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <span style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #334155;">
                            ${s.downlineCount || 0} ${s.downlineType || 'Units'}
                        </span>
                    </td>
                    <td style="padding: 12px 14px;">
                        <strong style="color: #059669;">${formatINR(s.monthlySalesTarget || 200000)}</strong>
                        <div style="font-size: 11px; color: #64748b;">/ month</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <span style="font-size: 12px; font-weight: 600; color: ${s.isActive ? '#10b981' : '#ef4444'};">
                            <i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${s.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td style="padding: 12px 14px;">
                        <button type="button" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: #1e293b;" onclick="loadPage('editStaff', '', '${s._id}')">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    loadData();
}

initEmbeddedSalesPortal();

