/**
 * Occuhealth - Franchise Monthly Target Management
 * Comprehensive logic for assigning, bulk updating, monitoring,
 * and analyzing franchisee targets with a default quota of ₹2,00,000 (2 Lakhs).
 */

(function () {
    // Default standard quota as requested by business logic
    const DEFAULT_TARGET_AMOUNT = 200000;

    // State
    let franchisees = [];
    let existingTargets = [];
    let mergedTargetsList = [];
    let currentSelectedMonth = '';
    let activeRoleFilter = 'all';
    let activeStatusFilter = 'all';
    let searchQuery = '';
    let currentViewMode = 'table'; // 'table' or 'grid'

    // Multi-tenant & Auth Context
    const effectiveBaseUrl = window.BASE_URL || window.location.origin;
    const effectiveRole = window.userRole ||
        (window.user && window.user.role) ||
        (localStorage.getItem('user') ? safeJsonParse(localStorage.getItem('user'))?.role : null) ||
        'admin';
    const effectiveUserId = window.userId ||
        (window.user && window.user._id) ||
        (localStorage.getItem('user') ? safeJsonParse(localStorage.getItem('user'))?._id : null) ||
        '';

    function safeJsonParse(str) {
        try { return JSON.parse(str); } catch (e) { return null; }
    }

    function getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // Currency & Number Formatting Helpers
    function formatINR(amount) {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    }

    function formatINRShort(amount) {
        const num = Number(amount) || 0;
        if (num >= 10000000) {
            return `₹${(num / 10000000).toFixed(2)} Cr`;
        }
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 2)} Lakh`;
        }
        if (num >= 1000) {
            return `₹${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
        }
        return `₹${num}`;
    }

    function numberToIndianWords(num) {
        const val = Number(num);
        if (!val || val < 0) return 'Zero Rupees';
        if (val === 200000) return '₹2,00,000 (Two Lakhs - Default)';
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore Rupees`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 2)} Lakh Rupees`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} Thousand Rupees`;
        return `₹${val} Rupees`;
    }

    function formatRoleName(role) {
        if (!role) return 'Franchisee';
        switch (role) {
            case 'superFranchisee':
                return 'Super Franchisee';
            case 'subFranchisee':
                return 'Sub Franchisee';
            case 'franchisee':
                return 'Franchisee';
            default:
                return role.charAt(0).toUpperCase() + role.slice(1);
        }
    }

    function getRoleBadgeClass(role) {
        switch (role) {
            case 'superFranchisee':
                return 'at-badge-super';
            case 'subFranchisee':
                return 'at-badge-sub';
            default:
                return 'at-badge-franchisee';
        }
    }

    function getAvatarClass(role) {
        switch (role) {
            case 'superFranchisee':
                return 'super';
            case 'subFranchisee':
                return 'sub';
            default:
                return 'franchisee';
        }
    }

    // Toast Notifications
    function showToast(message, type = 'info') {
        const container = document.getElementById('atToastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `at-toast ${type}`;

        let icon = '<i class="fa-solid fa-circle-info" style="color: #2563eb;"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: #059669;"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: #dc2626;"></i>';
        if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i>';

        toast.innerHTML = `
            ${icon}
            <div style="flex: 1;">${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3600);
    }

    // Month Selector Population
    function setupMonthSelectors() {
        const viewMonthSelect = document.getElementById('viewMonth');
        const targetMonthInput = document.getElementById('targetMonth');
        if (!viewMonthSelect || !targetMonthInput) return;

        const months = [];
        const now = new Date();

        // 3 future months + current month + past 12 months
        for (let i = -3; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
            months.push({ value, label, isCurrent: i === 0 });
        }

        viewMonthSelect.innerHTML = months.map(m =>
            `<option value="${m.value}" ${m.isCurrent ? 'selected' : ''}>${m.label}${m.isCurrent ? ' (Current)' : ''}</option>`
        ).join('');

        const currentMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        currentSelectedMonth = currentMonthVal;
        viewMonthSelect.value = currentMonthVal;
        targetMonthInput.value = currentMonthVal;

        // Sync change
        viewMonthSelect.addEventListener('change', (e) => {
            currentSelectedMonth = e.target.value;
            targetMonthInput.value = currentSelectedMonth;
            fetchTargets(currentSelectedMonth);
        });

        // Previous / Next Buttons
        const btnPrev = document.getElementById('btnPrevMonth');
        const btnNext = document.getElementById('btnNextMonth');
        const btnCurrent = document.getElementById('btnCurrentMonth');

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                const [year, month] = currentSelectedMonth.split('-').map(Number);
                const prev = new Date(year, month - 2, 1);
                const prevVal = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
                setMonth(prevVal);
            });
        }

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const [year, month] = currentSelectedMonth.split('-').map(Number);
                const next = new Date(year, month, 1);
                const nextVal = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
                setMonth(nextVal);
            });
        }

        if (btnCurrent) {
            btnCurrent.addEventListener('click', () => {
                setMonth(currentMonthVal);
            });
        }
    }

    function setMonth(monthVal) {
        const viewMonthSelect = document.getElementById('viewMonth');
        const targetMonthInput = document.getElementById('targetMonth');

        // Check if option exists, otherwise add it
        let exists = Array.from(viewMonthSelect.options).some(o => o.value === monthVal);
        if (!exists) {
            const [y, m] = monthVal.split('-').map(Number);
            const d = new Date(y, m - 1, 1);
            const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
            const opt = new Option(label, monthVal);
            viewMonthSelect.add(opt);
        }

        viewMonthSelect.value = monthVal;
        targetMonthInput.value = monthVal;
        currentSelectedMonth = monthVal;
        fetchTargets(currentSelectedMonth);
    }

    // Fetch Franchisees (Super, Sub, Franchisee)
    async function fetchFranchisees() {
        const countHint = document.getElementById('franchiseeCountHint');
        const franchiseeSelect = document.getElementById('franchisee');
        if (countHint) countHint.textContent = 'Loading franchises...';

        let list = [];

        // 1. Primary: fetchFranchisee
        try {
            const res = await fetch(`${effectiveBaseUrl}/api/v1/user/fetchFranchisee`, {
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            const data = await res.json();
            if (data && (Array.isArray(data.data) || Array.isArray(data.message))) {
                const raw = Array.isArray(data.data) ? data.data : data.message;
                list = raw.filter(u => u && u.role !== 'admin' && u.role !== 'staff');
            }
        } catch (err) {
            console.warn('fetchFranchisee request error:', err);
        }

        // 2. Fallback: fetchFranchiseeChain
        if (!list.length) {
            try {
                const res = await fetch(`${effectiveBaseUrl}/api/v1/user/fetchFranchiseeChain`, {
                    headers: getAuthHeaders(),
                    credentials: 'include'
                });
                const data = await res.json();
                if (data && (Array.isArray(data.data) || Array.isArray(data.message))) {
                    const raw = Array.isArray(data.data) ? data.data : data.message;
                    list = raw.filter(u => u && u.role !== 'admin' && u.role !== 'staff');
                }
            } catch (err) {
                console.warn('fetchFranchiseeChain fallback error:', err);
            }
        }

        // 3. Fallback: get-super-franchisee
        if (!list.length) {
            try {
                const res = await fetch(`${effectiveBaseUrl}/api/v1/user/get-super-franchisee?userId=${effectiveUserId}`, {
                    headers: getAuthHeaders(),
                    credentials: 'include'
                });
                const data = await res.json();
                if (data && (Array.isArray(data.data) || Array.isArray(data.message))) {
                    const raw = Array.isArray(data.data) ? data.data : data.message;
                    list = raw.filter(u => u && u.role !== 'admin' && u.role !== 'staff');
                }
            } catch (err) {
                console.warn('get-super-franchisee fallback error:', err);
            }
        }

        franchisees = list;

        // Populate Franchisee Select Dropdown
        if (franchiseeSelect) {
            if (!franchisees.length) {
                franchiseeSelect.innerHTML = '<option value="">No Franchisees Found</option>';
                if (countHint) countHint.textContent = '0 available';
            } else {
                if (countHint) countHint.textContent = `${franchisees.length} available`;
                const options = [
                    '<option value="">Select Franchisee</option>',
                    ...franchisees.map(f => {
                        const name = f.fullName || f.username || 'Franchisee';
                        const roleLabel = formatRoleName(f.role);
                        return `<option value="${f._id}" data-name="${name}" data-role="${f.role}" data-username="${f.username || ''}" data-phone="${f.phoneNumber || f.phoneNo || ''}">[${roleLabel}] ${name} (${f.username || 'id'})</option>`;
                    })
                ];
                franchiseeSelect.innerHTML = options.join('');
            }
        }

        // Refresh targets overview once franchises are loaded
        fetchTargets(currentSelectedMonth);
    }

    // Fetch and Process Targets for Current Month
    async function fetchTargets(month) {
        if (!month) month = currentSelectedMonth;

        try {
            const res = await fetch(`${effectiveBaseUrl}/api/v1/target/get-targets`, {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    userId: effectiveUserId,
                    role: effectiveRole,
                    month: month
                })
            });

            const result = await res.json();
            if (result.success && result.data && Array.isArray(result.data.targets)) {
                existingTargets = result.data.targets;
            } else {
                existingTargets = [];
            }
        } catch (err) {
            console.error('Error fetching targets:', err);
            existingTargets = [];
        }

        processTargetsData();
    }

    // Merge Franchisees with Existing Targets, Applying the Default ₹2,00,000 Rule
    function processTargetsData() {
        const targetsMap = new Map();

        // Index existing targets by franchisee ID
        existingTargets.forEach(t => {
            const fId = t.franchiseeId?._id ? t.franchiseeId._id.toString() : (t.franchiseeId?.toString() || '');
            if (fId) {
                targetsMap.set(fId, t);
            }
        });

        // Merge every known franchisee
        mergedTargetsList = [];

        franchisees.forEach(f => {
            const fId = f._id.toString();
            const existing = targetsMap.get(fId);

            if (existing) {
                // Franchisee has an explicitly saved target in DB
                const targetAmt = Number(existing.amount) >= 0 ? Number(existing.amount) : DEFAULT_TARGET_AMOUNT;
                const achievedAmt = Number(existing.achieved) || 0;
                const progressPct = targetAmt > 0 ? (achievedAmt / targetAmt) * 100 : 0;
                let status = 'pending';
                if (progressPct >= 100) status = 'achieved';
                else if (progressPct >= 50) status = 'ontrack';

                mergedTargetsList.push({
                    _id: existing._id,
                    franchiseeId: fId,
                    fullName: existing.fullName || f.fullName || f.username,
                    username: f.username || (existing.franchiseeId?.username || ''),
                    role: f.role || existing.franchiseeId?.role || 'franchisee',
                    phoneNumber: f.phoneNumber || f.phoneNo || '',
                    email: f.email || '',
                    month: currentSelectedMonth,
                    amount: targetAmt,
                    achieved: achievedAmt,
                    progress: progressPct,
                    status: status,
                    isDefault: false,
                    isSavedInDb: true,
                    remarks: existing.remarks || '',
                    lastUpdated: existing.lastUpdated || existing.updatedAt || existing.createdAt
                });
            } else {
                // Franchisee does NOT have a target in DB for this month
                // User Requirement: DEFAULT IS ₹2,00,000 (2 Lakhs) for all franchises
                mergedTargetsList.push({
                    _id: null,
                    franchiseeId: fId,
                    fullName: f.fullName || f.username,
                    username: f.username || '',
                    role: f.role || 'franchisee',
                    phoneNumber: f.phoneNumber || f.phoneNo || '',
                    email: f.email || '',
                    month: currentSelectedMonth,
                    amount: DEFAULT_TARGET_AMOUNT,
                    achieved: 0,
                    progress: 0,
                    status: 'default',
                    isDefault: true,
                    isSavedInDb: false,
                    remarks: 'Default quota (₹2,00,000)',
                    lastUpdated: null
                });
            }
        });

        // Also check if there are targets for franchisees not in the active local array
        existingTargets.forEach(t => {
            const fId = t.franchiseeId?._id ? t.franchiseeId._id.toString() : (t.franchiseeId?.toString() || '');
            const alreadyAdded = mergedTargetsList.some(item => item.franchiseeId === fId);
            if (!alreadyAdded && fId) {
                const targetAmt = Number(t.amount) >= 0 ? Number(t.amount) : DEFAULT_TARGET_AMOUNT;
                const achievedAmt = Number(t.achieved) || 0;
                const progressPct = targetAmt > 0 ? (achievedAmt / targetAmt) * 100 : 0;
                let status = 'pending';
                if (progressPct >= 100) status = 'achieved';
                else if (progressPct >= 50) status = 'ontrack';

                mergedTargetsList.push({
                    _id: t._id,
                    franchiseeId: fId,
                    fullName: t.fullName || (t.franchiseeId && t.franchiseeId.fullName) || 'Franchisee',
                    username: t.franchiseeId?.username || '',
                    role: t.franchiseeId?.role || 'franchisee',
                    phoneNumber: t.franchiseeId?.phoneNumber || t.franchiseeId?.phoneNo || '',
                    email: t.franchiseeId?.email || '',
                    month: currentSelectedMonth,
                    amount: targetAmt,
                    achieved: achievedAmt,
                    progress: progressPct,
                    status: status,
                    isDefault: false,
                    isSavedInDb: true,
                    remarks: t.remarks || '',
                    lastUpdated: t.lastUpdated || t.updatedAt
                });
            }
        });

        // Update KPI Summary & Render List
        updateSummaryKPIs();
        renderTargetsView();
        updateBulkModalCounts();
    }

    // Update KPI Summary Cards
    function updateSummaryKPIs() {
        const totalTarget = mergedTargetsList.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalAchieved = mergedTargetsList.reduce((sum, item) => sum + (item.achieved || 0), 0);
        const overallRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
        const shortfall = Math.max(0, totalTarget - totalAchieved);

        const achievedCount = mergedTargetsList.filter(item => item.progress >= 100).length;
        const totalCount = mergedTargetsList.length;

        // Total Target Card
        const totalTargetEl = document.getElementById('totalTarget');
        if (totalTargetEl) totalTargetEl.textContent = formatINR(totalTarget);
        const targetSubEl = document.getElementById('targetFranchiseeSub');
        if (targetSubEl) targetSubEl.textContent = `Across ${totalCount} active franchises (₹2L default)`;

        // Total Achieved Card
        const totalAchievedEl = document.getElementById('totalAchieved');
        if (totalAchievedEl) totalAchievedEl.textContent = formatINR(totalAchieved);
        const progressBarEl = document.getElementById('kpiProgressBar');
        if (progressBarEl) progressBarEl.style.width = `${Math.min(overallRate, 100)}%`;
        const shortfallEl = document.getElementById('remainingBalanceText');
        if (shortfallEl) shortfallEl.textContent = `Shortfall to goal: ${formatINR(shortfall)}`;

        // Achievement Rate Card
        const rateEl = document.getElementById('achievementRate');
        if (rateEl) {
            rateEl.textContent = `${overallRate.toFixed(1)}%`;
            if (overallRate >= 100) rateEl.style.color = '#059669';
            else if (overallRate >= 50) rateEl.style.color = '#2563eb';
            else rateEl.style.color = '#d97706';
        }
        const rateStatusEl = document.getElementById('achievementRateStatus');
        if (rateStatusEl) {
            if (overallRate >= 100) rateStatusEl.textContent = 'Target Achieved!';
            else if (overallRate >= 75) rateStatusEl.textContent = 'Excellent Progress';
            else if (overallRate >= 40) rateStatusEl.textContent = 'Moderate Performance';
            else rateStatusEl.textContent = 'Focus Required';
        }

        // Performance Ratio
        const ratioEl = document.getElementById('achievedRateRatio');
        if (ratioEl) ratioEl.textContent = `${achievedCount} / ${totalCount}`;
        const ratioSubEl = document.getElementById('achievedRateSub');
        if (ratioSubEl) ratioSubEl.textContent = `${achievedCount} Franchises Hit Quota (>=100%)`;

        // Header Brief Pills
        const headerCount = document.getElementById('headerFranchiseeCount');
        if (headerCount) headerCount.textContent = totalCount;
        const headerAchieved = document.getElementById('headerAchievedCount');
        if (headerAchieved) headerAchieved.textContent = `${achievedCount} (${overallRate.toFixed(0)}%)`;
    }

    // Filter Items Based on Active Filters & Search
    function getFilteredTargets() {
        return mergedTargetsList.filter(item => {
            // Role Filter
            if (activeRoleFilter !== 'all') {
                if (item.role !== activeRoleFilter) return false;
            }

            // Status Filter
            if (activeStatusFilter !== 'all') {
                if (activeStatusFilter === 'achieved' && item.progress < 100) return false;
                if (activeStatusFilter === 'ontrack' && (item.progress < 50 || item.progress >= 100)) return false;
                if (activeStatusFilter === 'pending' && (item.progress >= 50 || item.isDefault)) return false;
                if (activeStatusFilter === 'default' && !item.isDefault) return false;
            }

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (item.fullName || '').toLowerCase();
                const user = (item.username || '').toLowerCase();
                const phone = (item.phoneNumber || '').toLowerCase();
                const role = formatRoleName(item.role).toLowerCase();
                if (!name.includes(q) && !user.includes(q) && !phone.includes(q) && !role.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }

    // Render Table and Grid Views
    function renderTargetsView() {
        const filtered = getFilteredTargets();
        const tableBody = document.getElementById('targetsTableBody');
        const cardsGrid = document.getElementById('targetCards');
        const emptyState = document.getElementById('emptyTargetsState');
        const tableViewContainer = document.getElementById('tableViewContainer');

        if (!filtered.length) {
            if (tableBody) tableBody.innerHTML = '';
            if (cardsGrid) cardsGrid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        if (currentViewMode === 'table') {
            if (tableViewContainer) tableViewContainer.style.display = 'block';
            if (cardsGrid) cardsGrid.style.display = 'none';
            renderTableRows(filtered);
        } else {
            if (tableViewContainer) tableViewContainer.style.display = 'none';
            if (cardsGrid) cardsGrid.style.display = 'grid';
            renderGridCards(filtered);
        }
    }

    // Render Table Rows
    function renderTableRows(items) {
        const tableBody = document.getElementById('targetsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = items.map(item => {
            const roleBadgeClass = getRoleBadgeClass(item.role);
            const avatarClass = getAvatarClass(item.role);
            const initial = (item.fullName || item.username || 'F').charAt(0).toUpperCase();

            // Progress Bar Color
            let progressColor = 'amber';
            if (item.progress >= 100) progressColor = 'green';
            else if (item.progress >= 50) progressColor = 'blue';

            // Status Badge
            let statusBadge = '';
            if (item.isDefault) {
                statusBadge = `
                    <span class="at-badge at-status-default" title="Default quota applied. Click to save/customize.">
                        <i class="fa-solid fa-sparkles"></i> Default ₹2L
                    </span>
                `;
            } else if (item.progress >= 100) {
                statusBadge = `
                    <span class="at-badge at-status-achieved">
                        <i class="fa-solid fa-circle-check"></i> Achieved
                    </span>
                `;
            } else if (item.progress >= 50) {
                statusBadge = `
                    <span class="at-badge at-status-ontrack">
                        <i class="fa-solid fa-arrow-trend-up"></i> On Track
                    </span>
                `;
            } else {
                statusBadge = `
                    <span class="at-badge at-status-pending">
                        <i class="fa-solid fa-clock"></i> In Progress
                    </span>
                `;
            }

            const shortfall = Math.max(0, item.amount - item.achieved);

            return `
                <tr>
                    <td>
                        <div class="at-user-cell">
                            <div class="at-avatar ${avatarClass}">${initial}</div>
                            <div class="at-user-meta">
                                <span class="at-user-name">${escapeHtml(item.fullName)}</span>
                                <span class="at-user-handle">
                                    <span>@${escapeHtml(item.username || 'user')}</span>
                                    ${item.phoneNumber ? `<span>• <i class="fa-solid fa-phone" style="font-size: 10px;"></i> ${escapeHtml(item.phoneNumber)}</span>` : ''}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="at-badge ${roleBadgeClass}">
                            ${formatRoleName(item.role)}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 800; font-size: 14px; color: #0f172a;">
                            ${formatINR(item.amount)}
                        </div>
                        ${item.isDefault ? '<span style="font-size: 10px; color: #7c3aed; font-weight: 700;">Standard Default</span>' : '<span style="font-size: 10px; color: #059669; font-weight: 600;">Custom Target</span>'}
                    </td>
                    <td>
                        <div style="font-weight: 700; font-size: 14px; color: ${item.achieved > 0 ? '#059669' : '#64748b'};">
                            ${formatINR(item.achieved)}
                        </div>
                        <span style="font-size: 11px; color: #64748b;">
                            ${item.achieved >= item.amount ? '<strong style="color: #059669;">Target Hit!</strong>' : `Remaining: ${formatINR(shortfall)}`}
                        </span>
                    </td>
                    <td>
                        <div class="at-progress-cell">
                            <div class="at-progress-header">
                                <span>${item.progress.toFixed(0)}% Complete</span>
                            </div>
                            <div class="at-progress-track">
                                <div class="at-progress-fill ${progressColor}" style="width: ${Math.min(item.progress, 100)}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${statusBadge}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="at-btn at-btn-outline at-btn-sm btn-edit-target" 
                            data-id="${item.franchiseeId}"
                            data-name="${escapeHtml(item.fullName)}"
                            data-username="${escapeHtml(item.username)}"
                            data-role="${item.role}"
                            data-amount="${item.amount}"
                            data-remarks="${escapeHtml(item.remarks || '')}"
                            title="Edit Target">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" class="at-btn at-btn-outline at-btn-sm btn-perf-history"
                            data-id="${item.franchiseeId}"
                            data-name="${escapeHtml(item.fullName)}"
                            data-username="${escapeHtml(item.username)}"
                            title="View 6-Month Performance">
                            <i class="fa-solid fa-chart-line"></i>
                        </button>
                        ${item.isDefault ? `
                            <button type="button" class="at-btn at-btn-primary at-btn-sm btn-quick-save-default"
                                data-id="${item.franchiseeId}"
                                data-name="${escapeHtml(item.fullName)}"
                                title="Confirm & Save Default ₹2 Lakh Target in DB">
                                <i class="fa-solid fa-check"></i> Save ₹2L
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        attachActionListeners();
    }

    // Render Grid Cards
    function renderGridCards(items) {
        const cardsGrid = document.getElementById('targetCards');
        if (!cardsGrid) return;

        cardsGrid.innerHTML = items.map(item => {
            const roleBadgeClass = getRoleBadgeClass(item.role);
            const avatarClass = getAvatarClass(item.role);
            const initial = (item.fullName || item.username || 'F').charAt(0).toUpperCase();

            let progressColor = 'amber';
            if (item.progress >= 100) progressColor = 'green';
            else if (item.progress >= 50) progressColor = 'blue';

            let statusBadge = '';
            if (item.isDefault) {
                statusBadge = `
                    <span class="at-badge at-status-default">
                        <i class="fa-solid fa-sparkles"></i> Default ₹2L
                    </span>
                `;
            } else if (item.progress >= 100) {
                statusBadge = `
                    <span class="at-badge at-status-achieved">
                        <i class="fa-solid fa-circle-check"></i> Achieved
                    </span>
                `;
            } else if (item.progress >= 50) {
                statusBadge = `
                    <span class="at-badge at-status-ontrack">
                        <i class="fa-solid fa-arrow-trend-up"></i> On Track
                    </span>
                `;
            } else {
                statusBadge = `
                    <span class="at-badge at-status-pending">
                        <i class="fa-solid fa-clock"></i> In Progress
                    </span>
                `;
            }

            const shortfall = Math.max(0, item.amount - item.achieved);

            return `
                <div class="at-target-card-item">
                    <div>
                        <div class="at-card-top">
                            <div class="at-user-cell">
                                <div class="at-avatar ${avatarClass}">${initial}</div>
                                <div class="at-user-meta">
                                    <span class="at-user-name">${escapeHtml(item.fullName)}</span>
                                    <span class="at-user-handle">@${escapeHtml(item.username || 'user')}</span>
                                </div>
                            </div>
                            <span class="at-badge ${roleBadgeClass}">
                                ${formatRoleName(item.role)}
                            </span>
                        </div>

                        <div class="at-card-amounts">
                            <div class="at-amount-box">
                                <span class="lbl">Target</span>
                                <span class="val">${formatINRShort(item.amount)}</span>
                            </div>
                            <div class="at-amount-box">
                                <span class="lbl">Achieved</span>
                                <span class="val" style="color: ${item.achieved > 0 ? '#059669' : '#0f172a'};">${formatINRShort(item.achieved)}</span>
                            </div>
                        </div>

                        <div style="margin-bottom: 8px;">
                            <div class="at-progress-header">
                                <span>Progress: ${item.progress.toFixed(0)}%</span>
                                <span>${item.achieved >= item.amount ? 'Completed' : `Shortfall: ${formatINRShort(shortfall)}`}</span>
                            </div>
                            <div class="at-progress-track">
                                <div class="at-progress-fill ${progressColor}" style="width: ${Math.min(item.progress, 100)}%;"></div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
                            ${statusBadge}
                            ${item.remarks ? `<span style="font-size: 11px; color: #64748b; font-style: italic; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.remarks)}">${escapeHtml(item.remarks)}</span>` : ''}
                        </div>
                    </div>

                    <div class="at-card-actions">
                        <button type="button" class="at-btn at-btn-outline at-btn-sm btn-perf-history"
                            data-id="${item.franchiseeId}"
                            data-name="${escapeHtml(item.fullName)}"
                            data-username="${escapeHtml(item.username)}"
                            title="Performance">
                            <i class="fa-solid fa-chart-line"></i> History
                        </button>
                        <button type="button" class="at-btn at-btn-primary at-btn-sm btn-edit-target"
                            data-id="${item.franchiseeId}"
                            data-name="${escapeHtml(item.fullName)}"
                            data-username="${escapeHtml(item.username)}"
                            data-role="${item.role}"
                            data-amount="${item.amount}"
                            data-remarks="${escapeHtml(item.remarks || '')}">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Target
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        attachActionListeners();
    }

    // Attach Listeners to Dynamic Action Buttons
    function attachActionListeners() {
        // Edit Target
        document.querySelectorAll('.btn-edit-target').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const franchiseeId = btn.getAttribute('data-id');
                const fullName = btn.getAttribute('data-name');
                const username = btn.getAttribute('data-username');
                const role = btn.getAttribute('data-role');
                const amount = btn.getAttribute('data-amount') || DEFAULT_TARGET_AMOUNT;
                const remarks = btn.getAttribute('data-remarks') || '';

                openEditModal({
                    franchiseeId,
                    fullName,
                    username,
                    role,
                    amount,
                    remarks
                });
            });
        });

        // 6-Month Performance
        document.querySelectorAll('.btn-perf-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const franchiseeId = btn.getAttribute('data-id');
                const fullName = btn.getAttribute('data-name');
                const username = btn.getAttribute('data-username');
                openPerformanceModal(franchiseeId, fullName, username);
            });
        });

        // Quick Save Default
        document.querySelectorAll('.btn-quick-save-default').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const franchiseeId = btn.getAttribute('data-id');
                const fullName = btn.getAttribute('data-name');
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

                try {
                    const res = await fetch(`${effectiveBaseUrl}/api/v1/target/assign-target`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({
                            franchiseeId: franchiseeId,
                            fullName: fullName,
                            assignedBy: effectiveUserId,
                            month: currentSelectedMonth,
                            amount: DEFAULT_TARGET_AMOUNT,
                            remarks: 'Default quota (₹2,00,000)'
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Default target of ₹2 Lakh saved for ${fullName}!`, 'success');
                        fetchTargets(currentSelectedMonth);
                    } else {
                        showToast(data.message || 'Failed to save target', 'error');
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-check"></i> Save ₹2L';
                    }
                } catch (err) {
                    console.error('Quick save error:', err);
                    showToast('Network error while saving target', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Save ₹2L';
                }
            });
        });
    }

    // Main Assignment Form Handlers
    function setupFormHandlers() {
        const franchiseeSelect = document.getElementById('franchisee');
        const targetAmountInput = document.getElementById('targetAmount');
        const targetAmountPreview = document.getElementById('targetAmountPreview');
        const remarksInput = document.getElementById('remarks');
        const submitBtn = document.getElementById('submitTarget');
        const submitBtnText = document.getElementById('submitBtnText');
        const formModeBadge = document.getElementById('formModeBadge');
        const resetBtn = document.getElementById('resetTargetForm');
        const userCard = document.getElementById('selectedUserCard');
        const userRoleBadge = document.getElementById('selectedUserRoleBadge');
        const userPhone = document.getElementById('selectedUserPhone');
        const userCurrentTarget = document.getElementById('selectedUserCurrentTarget');

        // When user types in target amount
        if (targetAmountInput) {
            targetAmountInput.addEventListener('input', () => {
                const val = Number(targetAmountInput.value) || 0;
                if (targetAmountPreview) {
                    targetAmountPreview.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${numberToIndianWords(val)}`;
                }
                updateActiveChip(val);
            });
        }

        // Amount Preset Chips
        document.querySelectorAll('.at-form-card .at-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const amt = Number(chip.getAttribute('data-amount'));
                if (targetAmountInput) {
                    targetAmountInput.value = amt;
                    targetAmountInput.dispatchEvent(new Event('input'));
                }
            });
        });

        function updateActiveChip(val) {
            document.querySelectorAll('.at-form-card .at-chip').forEach(chip => {
                const amt = Number(chip.getAttribute('data-amount'));
                if (amt === val) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });
        }

        // When Franchisee is Selected
        if (franchiseeSelect) {
            franchiseeSelect.addEventListener('change', () => {
                const selectedOpt = franchiseeSelect.options[franchiseeSelect.selectedIndex];
                const fId = franchiseeSelect.value;

                if (!fId) {
                    if (userCard) userCard.classList.remove('show');
                    if (formModeBadge) formModeBadge.textContent = 'New Target';
                    if (submitBtnText) submitBtnText.textContent = 'Assign Target';
                    if (targetAmountInput) {
                        targetAmountInput.value = DEFAULT_TARGET_AMOUNT;
                        targetAmountInput.dispatchEvent(new Event('input'));
                    }
                    if (remarksInput) remarksInput.value = '';
                    return;
                }

                const role = selectedOpt.getAttribute('data-role') || 'franchisee';
                const phone = selectedOpt.getAttribute('data-phone') || '';
                const name = selectedOpt.getAttribute('data-name') || '';

                if (userCard) userCard.classList.add('show');
                if (userRoleBadge) {
                    userRoleBadge.className = `at-badge ${getRoleBadgeClass(role)}`;
                    userRoleBadge.textContent = formatRoleName(role);
                }
                if (userPhone) userPhone.textContent = phone ? `Phone: ${phone}` : '';

                // Check if target already exists for this franchisee in current month
                const existing = mergedTargetsList.find(item => item.franchiseeId === fId);
                if (existing && existing.isSavedInDb) {
                    if (targetAmountInput) {
                        targetAmountInput.value = existing.amount;
                        targetAmountInput.dispatchEvent(new Event('input'));
                    }
                    if (remarksInput) remarksInput.value = existing.remarks || '';
                    if (formModeBadge) {
                        formModeBadge.textContent = 'Update Mode';
                        formModeBadge.className = 'at-badge at-badge-super';
                    }
                    if (submitBtnText) submitBtnText.textContent = `Update Target (${formatINRShort(existing.amount)})`;
                    if (userCurrentTarget) userCurrentTarget.textContent = `Current: ${formatINR(existing.amount)}`;
                } else {
                    // Default 2 Lakhs
                    if (targetAmountInput) {
                        targetAmountInput.value = DEFAULT_TARGET_AMOUNT;
                        targetAmountInput.dispatchEvent(new Event('input'));
                    }
                    if (remarksInput) remarksInput.value = 'Default quota (₹2,00,000)';
                    if (formModeBadge) {
                        formModeBadge.textContent = 'Default Quota';
                        formModeBadge.className = 'at-badge at-status-default';
                    }
                    if (submitBtnText) submitBtnText.textContent = 'Assign Target (₹2 Lakh)';
                    if (userCurrentTarget) userCurrentTarget.textContent = 'Default: ₹2,00,000';
                }
            });
        }

        // Reset Button
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (franchiseeSelect) franchiseeSelect.value = '';
                if (userCard) userCard.classList.remove('show');
                if (targetAmountInput) {
                    targetAmountInput.value = DEFAULT_TARGET_AMOUNT;
                    targetAmountInput.dispatchEvent(new Event('input'));
                }
                if (remarksInput) remarksInput.value = '';
                if (formModeBadge) formModeBadge.textContent = 'New Target';
                if (submitBtnText) submitBtnText.textContent = 'Assign Target';
            });
        }

        // Submit Form
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const selectedOpt = franchiseeSelect.options[franchiseeSelect.selectedIndex];
                const fId = franchiseeSelect.value;
                const name = selectedOpt ? selectedOpt.getAttribute('data-name') : '';
                const month = currentSelectedMonth;
                const amount = parseFloat(targetAmountInput.value);
                const remarks = remarksInput.value.trim();

                if (!fId) {
                    showToast('Please select a franchise to assign target', 'warning');
                    franchiseeSelect.focus();
                    return;
                }

                if (!amount || amount < 0) {
                    showToast('Please enter a valid target amount (greater than 0)', 'warning');
                    targetAmountInput.focus();
                    return;
                }

                submitBtn.disabled = true;
                const origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

                try {
                    const res = await fetch(`${effectiveBaseUrl}/api/v1/target/assign-target`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({
                            franchiseeId: fId,
                            fullName: name,
                            assignedBy: effectiveUserId,
                            month: month,
                            amount: amount,
                            remarks: remarks
                        })
                    });

                    const data = await res.json();
                    if (data.success) {
                        showToast(`Target of ${formatINR(amount)} assigned to ${name} successfully!`, 'success');
                        fetchTargets(currentSelectedMonth);
                        // Reset form
                        if (resetBtn) resetBtn.click();
                    } else {
                        showToast(data.message || 'Failed to assign target', 'error');
                    }
                } catch (err) {
                    console.error('Target assign error:', err);
                    showToast('Error connecting to server. Please try again.', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = origText;
                }
            });
        }
    }

    // Quick Edit Target Modal
    function setupEditModal() {
        const modal = document.getElementById('editTargetModal');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEditModal');
        const saveBtn = document.getElementById('saveEditModal');
        const amountInput = document.getElementById('modalTargetAmount');
        const amountPreview = document.getElementById('modalAmountPreview');
        const remarksInput = document.getElementById('modalRemarks');

        function closeModal() {
            if (modal) modal.classList.remove('active');
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // Live preview
        if (amountInput) {
            amountInput.addEventListener('input', () => {
                const val = Number(amountInput.value) || 0;
                if (amountPreview) {
                    amountPreview.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${numberToIndianWords(val)}`;
                }
                document.querySelectorAll('.modal-chip').forEach(c => {
                    const amt = Number(c.getAttribute('data-amount'));
                    if (amt === val) c.classList.add('active');
                    else c.classList.remove('active');
                });
            });
        }

        // Modal chips
        document.querySelectorAll('.modal-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const amt = Number(chip.getAttribute('data-amount'));
                if (amountInput) {
                    amountInput.value = amt;
                    amountInput.dispatchEvent(new Event('input'));
                }
            });
        });

        // Save Edit
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const franchiseeId = document.getElementById('modalFranchiseeId').value;
                const fullName = document.getElementById('modalFullName').value;
                const amount = parseFloat(amountInput.value);
                const remarks = remarksInput.value.trim();

                if (!amount || amount < 0) {
                    showToast('Please enter a valid target amount', 'warning');
                    return;
                }

                saveBtn.disabled = true;
                const origText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

                try {
                    const res = await fetch(`${effectiveBaseUrl}/api/v1/target/assign-target`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({
                            franchiseeId: franchiseeId,
                            fullName: fullName,
                            assignedBy: effectiveUserId,
                            month: currentSelectedMonth,
                            amount: amount,
                            remarks: remarks
                        })
                    });

                    const data = await res.json();
                    if (data.success) {
                        showToast(`Updated target of ${formatINR(amount)} for ${fullName}!`, 'success');
                        closeModal();
                        fetchTargets(currentSelectedMonth);
                    } else {
                        showToast(data.message || 'Failed to update target', 'error');
                    }
                } catch (err) {
                    console.error('Modal save error:', err);
                    showToast('Error updating target', 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = origText;
                }
            });
        }
    }

    function openEditModal(info) {
        const modal = document.getElementById('editTargetModal');
        if (!modal) return;

        document.getElementById('modalFranchiseeId').value = info.franchiseeId;
        document.getElementById('modalFullName').value = info.fullName;
        document.getElementById('modalUserTitle').textContent = info.fullName;
        document.getElementById('modalUserSub').textContent = `Role: ${formatRoleName(info.role)} • @${info.username || 'user'}`;

        const amountInput = document.getElementById('modalTargetAmount');
        const remarksInput = document.getElementById('modalRemarks');

        if (amountInput) {
            amountInput.value = info.amount || DEFAULT_TARGET_AMOUNT;
            amountInput.dispatchEvent(new Event('input'));
        }
        if (remarksInput) {
            remarksInput.value = info.remarks || '';
        }

        modal.classList.add('active');
    }

    // Bulk Assign Default Modal
    function setupBulkModal() {
        const modal = document.getElementById('bulkAssignModal');
        const openBtn = document.getElementById('btnBulkAssignModal');
        const closeBtn = document.getElementById('closeBulkModal');
        const cancelBtn = document.getElementById('cancelBulkModal');
        const confirmBtn = document.getElementById('confirmBulkAssign');
        const bulkAmountInput = document.getElementById('bulkTargetAmount');

        function closeModal() {
            if (modal) modal.classList.remove('active');
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                const monthText = document.getElementById('bulkModalMonthText');
                if (monthText) {
                    const viewSelect = document.getElementById('viewMonth');
                    monthText.textContent = viewSelect ? viewSelect.options[viewSelect.selectedIndex]?.text : currentSelectedMonth;
                }
                updateBulkModalCounts();
                if (modal) modal.classList.add('active');
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // Bulk chips
        document.querySelectorAll('.bulk-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const amt = Number(chip.getAttribute('data-amount'));
                if (bulkAmountInput) bulkAmountInput.value = amt;
                document.querySelectorAll('.bulk-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });

        // Confirm Bulk Assign
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const targetAmt = Number(bulkAmountInput.value) || DEFAULT_TARGET_AMOUNT;
                const scope = document.querySelector('input[name="bulkScope"]:checked')?.value || 'unassigned';
                const remarks = document.getElementById('bulkRemarks')?.value || 'Default monthly quota ₹2,00,000';

                let targetFranchisees = [];
                if (scope === 'unassigned') {
                    targetFranchisees = mergedTargetsList.filter(item => item.isDefault || !item.isSavedInDb);
                } else {
                    targetFranchisees = mergedTargetsList;
                }

                if (!targetFranchisees.length) {
                    showToast('No franchises require update for the selected scope', 'info');
                    closeModal();
                    return;
                }

                confirmBtn.disabled = true;
                const origText = confirmBtn.innerHTML;
                confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying to all...';

                try {
                    // Try backend bulk-assign endpoint first
                    const bulkPayload = {
                        month: currentSelectedMonth,
                        amount: targetAmt,
                        remarks: remarks,
                        targets: targetFranchisees.map(f => ({
                            franchiseeId: f.franchiseeId,
                            fullName: f.fullName,
                            amount: targetAmt,
                            remarks: remarks
                        }))
                    };

                    const res = await fetch(`${effectiveBaseUrl}/api/v1/target/bulk-assign`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify(bulkPayload)
                    });

                    const data = await res.json();
                    if (data.success) {
                        showToast(`Successfully assigned ${formatINR(targetAmt)} default target to ${data.data?.count || targetFranchisees.length} franchises!`, 'success');
                        closeModal();
                        fetchTargets(currentSelectedMonth);
                    } else {
                        // Fallback: loop through individually
                        let successCount = 0;
                        for (const item of targetFranchisees) {
                            try {
                                await fetch(`${effectiveBaseUrl}/api/v1/target/assign-target`, {
                                    method: 'POST',
                                    headers: getAuthHeaders(),
                                    credentials: 'include',
                                    body: JSON.stringify({
                                        franchiseeId: item.franchiseeId,
                                        fullName: item.fullName,
                                        assignedBy: effectiveUserId,
                                        month: currentSelectedMonth,
                                        amount: targetAmt,
                                        remarks: remarks
                                    })
                                });
                                successCount++;
                            } catch (e) {
                                console.error('Error assigning to', item.fullName, e);
                            }
                        }
                        showToast(`Applied default target to ${successCount} franchises!`, 'success');
                        closeModal();
                        fetchTargets(currentSelectedMonth);
                    }
                } catch (err) {
                    console.error('Bulk assign error:', err);
                    showToast('Bulk update failed. Check console for details.', 'error');
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = origText;
                }
            });
        }
    }

    function updateBulkModalCounts() {
        const unassignedCountEl = document.getElementById('bulkUnassignedCount');
        if (unassignedCountEl) {
            const count = mergedTargetsList.filter(item => item.isDefault || !item.isSavedInDb).length;
            unassignedCountEl.textContent = count;
        }
    }

    // 6-Month Performance Modal
    function setupPerformanceModal() {
        const modal = document.getElementById('performanceModal');
        const closeBtn = document.getElementById('closePerfModal');
        const cancelBtn = document.getElementById('cancelPerfModal');

        function closeModal() {
            if (modal) modal.classList.remove('active');
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
    }

    async function openPerformanceModal(franchiseeId, fullName, username) {
        const modal = document.getElementById('performanceModal');
        const listEl = document.getElementById('perfHistoryList');
        const nameEl = document.getElementById('perfUserName');
        const subEl = document.getElementById('perfUserSub');
        const avgEl = document.getElementById('perfAvgRate');

        if (!modal || !listEl) return;

        if (nameEl) nameEl.textContent = fullName;
        if (subEl) subEl.textContent = `@${username || 'franchise'}`;
        if (avgEl) avgEl.textContent = '...';

        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching past performance...</div>';
        modal.classList.add('active');

        try {
            const res = await fetch(`${effectiveBaseUrl}/api/v1/target/performance/${franchiseeId}/6`, {
                headers: getAuthHeaders(),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.success && data.data && Array.isArray(data.data.performance) && data.data.performance.length > 0) {
                const history = data.data.performance;
                const metrics = data.data.metrics || {};

                if (avgEl) {
                    const avg = metrics.averageAchievement || 0;
                    avgEl.textContent = `${avg.toFixed(1)}%`;
                }

                listEl.innerHTML = history.map(item => {
                    const pct = item.amount > 0 ? (item.achieved / item.amount) * 100 : 0;
                    let barColor = 'green';
                    if (pct < 50) barColor = 'amber';
                    else if (pct < 100) barColor = 'blue';

                    return `
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.month}</span>
                                <span style="font-size: 12px; font-weight: 700; color: ${pct >= 100 ? '#059669' : '#1d4ed8'};">
                                    ${pct.toFixed(0)}% Achieved
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 6px;">
                                <span>Target: <strong>${formatINR(item.amount)}</strong></span>
                                <span>Achieved: <strong>${formatINR(item.achieved)}</strong></span>
                            </div>
                            <div class="at-progress-track">
                                <div class="at-progress-fill ${barColor}" style="width: ${Math.min(pct, 100)}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                if (avgEl) avgEl.textContent = '0%';
                listEl.innerHTML = `
                    <div style="text-align: center; padding: 24px; color: #64748b;">
                        <i class="fa-solid fa-chart-line" style="font-size: 28px; color: #cbd5e1; margin-bottom: 8px;"></i>
                        <p style="margin: 0; font-size: 13px;">No historical performance data recorded yet for this franchise.</p>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Performance fetch error:', err);
            listEl.innerHTML = '<div style="color: #dc2626; text-align: center; padding: 16px;">Failed to load performance history.</div>';
        }
    }

    // Filter, Search & View Switcher Handlers
    function setupFiltersAndSearch() {
        // Search Input
        const searchInput = document.getElementById('targetSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderTargetsView();
            });
        }

        // Role Tabs
        document.querySelectorAll('.at-filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.at-filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeRoleFilter = tab.getAttribute('data-role') || 'all';
                renderTargetsView();
            });
        });

        // Status Dropdown
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                activeStatusFilter = e.target.value;
                renderTargetsView();
            });
        }

        // View Toggles
        const btnTableView = document.getElementById('viewModeTable');
        const btnGridView = document.getElementById('viewModeGrid');

        if (btnTableView && btnGridView) {
            btnTableView.addEventListener('click', () => {
                currentViewMode = 'table';
                btnTableView.classList.add('active');
                btnGridView.classList.remove('active');
                renderTargetsView();
            });

            btnGridView.addEventListener('click', () => {
                currentViewMode = 'grid';
                btnGridView.classList.add('active');
                btnTableView.classList.remove('active');
                renderTargetsView();
            });
        }

        // Refresh Button
        const refreshBtn = document.getElementById('btnRefreshPage');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.querySelector('i')?.classList.add('fa-spin');
                fetchTargets(currentSelectedMonth).finally(() => {
                    setTimeout(() => {
                        refreshBtn.querySelector('i')?.classList.remove('fa-spin');
                    }, 500);
                });
                showToast('Refreshed target data', 'info');
            });
        }

        // Export CSV Button
        const exportBtn = document.getElementById('btnExportCSV');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportTargetsToCSV);
        }
    }

    // Export to CSV
    function exportTargetsToCSV() {
        const filtered = getFilteredTargets();
        if (!filtered.length) {
            showToast('No data to export', 'warning');
            return;
        }

        const headers = ['Franchisee Name', 'Username', 'Role', 'Target Month', 'Target Amount (INR)', 'Achieved Amount (INR)', 'Progress (%)', 'Status', 'Remarks'];
        const rows = filtered.map(item => [
            `"${(item.fullName || '').replace(/"/g, '""')}"`,
            `"${(item.username || '').replace(/"/g, '""')}"`,
            `"${formatRoleName(item.role)}"`,
            `"${item.month}"`,
            item.amount,
            item.achieved,
            item.progress.toFixed(1),
            `"${item.status.toUpperCase()}"`,
            `"${(item.remarks || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Franchise_Targets_${currentSelectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();

        showToast('Targets exported to CSV successfully!', 'success');
    }

    // Role-Based UI Guard
    function checkPermissions() {
        // Non-admin / non-superFranchisee users view targets only
        const form = document.getElementById('assignTargetForm');
        const bulkBtn = document.getElementById('btnBulkAssignModal');

        if (!['admin', 'superFranchisee', 'staff'].includes(effectiveRole)) {
            if (form) form.style.display = 'none';
            if (bulkBtn) bulkBtn.style.display = 'none';
            const layout = document.querySelector('.at-layout-grid');
            if (layout) layout.style.gridTemplateColumns = '1fr';
        }
    }

    // Utility: HTML Escape
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Main Initialization
    function init() {
        setupMonthSelectors();
        setupFormHandlers();
        setupEditModal();
        setupBulkModal();
        setupPerformanceModal();
        setupFiltersAndSearch();
        checkPermissions();
        fetchFranchisees();
    }

    // Execute when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();