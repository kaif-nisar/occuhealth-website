(async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const staffId = urlParams.get('staffId') || urlParams.get('Name') || urlParams.get('_id');
    const apiBase = "/api/v1/user";

    const isActiveCheckbox = document.getElementById('isActive');
    const statusText = document.getElementById('statusText');
    const staffTypeSelect = document.getElementById('stafftype');
    const salesConfigCard = document.getElementById('salesConfigCard');
    const salesDesignationSelect = document.getElementById('salesDesignation');
    const monthlySalesTargetInput = document.getElementById('monthlySalesTarget');
    const downlineChooserTitle = document.getElementById('downlineChooserTitle');
    const downlineChooserSubtitle = document.getElementById('downlineChooserSubtitle');
    const desigHelpText = document.getElementById('desigHelpText');
    const downlineListContainer = document.getElementById('downlineListContainer');
    const downlineSearchInput = document.getElementById('downlineSearchInput');
    const selectedCountBadge = document.getElementById('selectedCountBadge');
    const btnSelectAll = document.getElementById('btnSelectAllDownlines');
    const btnClear = document.getElementById('btnClearDownlines');

    let currentOptions = [];
    let selectedIds = new Set();
    let initialAssignedIds = [];

    const DESIG_CONFIG = {
        TH: {
            title: `<i class="fa-solid fa-store" style="color: #2563eb;"></i> Tag Sub-Franchisees / Franchisees (Labs)`,
            subtitle: `Choose the labs that this Team Head (TH) will manage, place bookings for, and track revenue`,
            help: `<i class="fa-solid fa-circle-info"></i> TH directly visits and manages frontline labs/sub-franchisees in the field.`,
            defaultTarget: 200000
        },
        ASM: {
            title: `<i class="fa-solid fa-users" style="color: #059669;"></i> Assign Team Heads (TH)`,
            subtitle: `Select which Team Heads (THs) will report to this Area Sales Manager (ASM)`,
            help: `<i class="fa-solid fa-circle-info"></i> ASM oversees a city/territory with multiple THs reporting to him.`,
            defaultTarget: 500000
        },
        RSM: {
            title: `<i class="fa-solid fa-network-wired" style="color: #7c3aed;"></i> Assign Area Sales Managers (ASM)`,
            subtitle: `Select which Area Sales Managers (ASMs) will report to this Regional Sales Manager (RSM)`,
            help: `<i class="fa-solid fa-circle-info"></i> RSM manages a region/state across multiple ASMs.`,
            defaultTarget: 1500000
        },
        ZSM: {
            title: `<i class="fa-solid fa-crown" style="color: #d97706;"></i> Assign Regional Sales Managers (RSM)`,
            subtitle: `Select which Regional Sales Managers (RSMs) will report to this Zonal Sales Manager (ZSM)`,
            help: `<i class="fa-solid fa-circle-info"></i> ZSM oversees the entire zone (e.g. North Zone, West Zone) with all downlines.`,
            defaultTarget: 5000000
        }
    };

    function handleStaffTypeChange() {
        const val = staffTypeSelect.value.trim().toLowerCase();
        if (val === 'sales') {
            salesConfigCard.style.display = 'block';
            loadDownlines();
        } else {
            salesConfigCard.style.display = 'none';
        }
    }

    if (staffTypeSelect) {
        staffTypeSelect.addEventListener('change', handleStaffTypeChange);
    }

    function handleDesignationChange() {
        const desig = salesDesignationSelect.value.trim().toUpperCase();
        const cfg = DESIG_CONFIG[desig] || DESIG_CONFIG.TH;

        if (downlineChooserTitle) downlineChooserTitle.innerHTML = cfg.title;
        if (downlineChooserSubtitle) downlineChooserSubtitle.textContent = cfg.subtitle;
        if (desigHelpText) desigHelpText.innerHTML = cfg.help;

        selectedIds.clear();
        updateSelectedBadge();
        loadDownlines();
    }

    if (salesDesignationSelect) {
        salesDesignationSelect.addEventListener('change', handleDesignationChange);
    }

    async function loadDownlines() {
        if (!downlineListContainer) return;
        const desig = salesDesignationSelect ? salesDesignationSelect.value.trim().toUpperCase() : 'TH';

        downlineListContainer.innerHTML = `
            <div style="padding: 24px; text-align: center; color: #64748b; grid-column: 1 / -1;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 20px;"></i>
                <p style="margin-top: 8px; font-size: 13px;">Loading available units for ${desig}...</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/v1/sales/downline-options?designation=${desig}`);
            const json = await res.json();

            if (json.success && json.data?.options) {
                currentOptions = json.data.options;
                // If editing and initial IDs exist, select them
                if (initialAssignedIds && initialAssignedIds.length > 0) {
                    initialAssignedIds.forEach(id => selectedIds.add(id.toString()));
                }
                renderDownlineOptions(currentOptions);
                updateSelectedBadge();
            } else {
                downlineListContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #94a3b8; grid-column: 1 / -1;">
                        No available units found for ${desig}.
                    </div>
                `;
            }
        } catch (err) {
            console.error("Error loading downline options:", err);
            downlineListContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ef4444; grid-column: 1 / -1;">
                    Failed to load units.
                </div>
            `;
        }
    }

    function renderDownlineOptions(items) {
        if (!items || items.length === 0) {
            downlineListContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #94a3b8; grid-column: 1 / -1;">
                    No matching units found.
                </div>
            `;
            return;
        }

        const desig = salesDesignationSelect.value.trim().toUpperCase();

        downlineListContainer.innerHTML = items.map(item => {
            const isChecked = selectedIds.has(item._id.toString());
            let detailLine = '';
            let metaBadge = '';

            if (desig === 'TH') {
                const bal = Number(item.walletBalance || 0);
                const balColor = bal >= 0 ? '#10b981' : '#ef4444';
                detailLine = `<span>${item.clinicName || 'Lab'} • ${item.city || 'Direct'}</span>`;
                metaBadge = `<span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ${bal >= 0 ? '#ecfdf5' : '#fef2f2'}; color: ${balColor}; font-weight: 600;">₹${bal.toFixed(0)}</span>`;
                if (item.alreadyAssignedTo && item.alreadyAssignedTo.thId !== staffId) {
                    detailLine += `<span style="color: #f59e0b; display: block; font-size: 11px;">⚠️ Assigned to ${item.alreadyAssignedTo.thName || 'another TH'}</span>`;
                }
            } else if (desig === 'ASM') {
                detailLine = `<span>${item.phoneNo || 'No Phone'} • @${item.username}</span>`;
                metaBadge = `<span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #eff6ff; color: #2563eb; font-weight: 600;">${item.franchiseeCount || 0} Labs</span>`;
            } else if (desig === 'RSM') {
                detailLine = `<span>${item.phoneNo || 'No Phone'} • @${item.username}</span>`;
                metaBadge = `<span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #f5f3ff; color: #7c3aed; font-weight: 600;">${item.thCount || 0} THs</span>`;
            } else if (desig === 'ZSM') {
                detailLine = `<span>${item.phoneNo || 'No Phone'} • @${item.username}</span>`;
                metaBadge = `<span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #fffbeb; color: #d97706; font-weight: 600;">${item.asmCount || 0} ASMs</span>`;
            }

            return `
                <label class="downline-card-label" style="display: flex; align-items: flex-start; gap: 10px; background: ${isChecked ? '#f0f7ff' : '#ffffff'}; border: 1.5px solid ${isChecked ? '#2563eb' : '#e2e8f0'}; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.2s ease;">
                    <input type="checkbox" class="downline-chk" value="${item._id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px; accent-color: #2563eb; width: 16px; height: 16px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                            <strong style="font-size: 13px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || item.fullName || item.username}</strong>
                            ${metaBadge}
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                            ${detailLine}
                        </div>
                    </div>
                </label>
            `;
        }).join('');

        downlineListContainer.querySelectorAll('.downline-chk').forEach(chk => {
            chk.addEventListener('change', function () {
                if (this.checked) {
                    selectedIds.add(this.value);
                } else {
                    selectedIds.delete(this.value);
                }
                const card = this.closest('.downline-card-label');
                if (card) {
                    card.style.background = this.checked ? '#f0f7ff' : '#ffffff';
                    card.style.borderColor = this.checked ? '#2563eb' : '#e2e8f0';
                }
                updateSelectedBadge();
            });
        });
    }

    function updateSelectedBadge() {
        if (selectedCountBadge) {
            selectedCountBadge.textContent = `${selectedIds.size} Selected`;
        }
    }

    if (downlineSearchInput) {
        downlineSearchInput.addEventListener("input", function () {
            const query = this.value.trim().toLowerCase();
            if (!query) {
                renderDownlineOptions(currentOptions);
                return;
            }
            const filtered = currentOptions.filter(item => {
                const name = (item.name || item.fullName || '').toLowerCase();
                const user = (item.username || '').toLowerCase();
                const clinic = (item.clinicName || '').toLowerCase();
                const city = (item.city || '').toLowerCase();
                const phone = (item.phoneNo || '').toLowerCase();
                return name.includes(query) || user.includes(query) || clinic.includes(query) || city.includes(query) || phone.includes(query);
            });
            renderDownlineOptions(filtered);
        });
    }

    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", function () {
            currentOptions.forEach(opt => selectedIds.add(opt._id.toString()));
            renderDownlineOptions(currentOptions);
            updateSelectedBadge();
        });
    }

    if (btnClear) {
        btnClear.addEventListener("click", function () {
            selectedIds.clear();
            renderDownlineOptions(currentOptions);
            updateSelectedBadge();
        });
    }

    // Update status text when toggle changes
    isActiveCheckbox.addEventListener('change', function () {
        statusText.textContent = this.checked ? 'Active' : 'Inactive';
        statusText.style.color = this.checked ? '#28a745' : '#6c757d';
    });

    // Pre-fill if staffId is present
    if (staffId) {
        try {
            const res = await fetch(`${apiBase}/get-staff-tenant?staffId=${staffId}`);
            const data = await res.json();
            const staff = data.data;

            const nameParts = (staff.fullName || '').split(' ');
            document.getElementById('firstname').value = nameParts[0] || '';
            document.getElementById('lastname').value = nameParts.slice(1).join(' ') || '';
            document.getElementById('email').value = staff.email || '';
            document.getElementById('phone').value = staff.phoneNo || '';
            document.getElementById('username').value = staff.username || '';
            document.getElementById('password').value = ''; // never fill password
            document.getElementById('submission-date').value = staff.createdAt?.split('T')[0] || '';

            const isSales = staff.staffType === 'sales' || Boolean(staff.salesDesignation);
            if (isSales) {
                staffTypeSelect.value = 'Sales';
                salesConfigCard.style.display = 'block';
                if (staff.salesDesignation) {
                    salesDesignationSelect.value = staff.salesDesignation;
                }
                if (staff.monthlySalesTarget !== undefined) {
                    monthlySalesTargetInput.value = staff.monthlySalesTarget;
                }
                if (staff.salesDesignation === 'TH') {
                    initialAssignedIds = staff.assignedFranchisees || [];
                } else {
                    initialAssignedIds = staff.assignedStaff || [];
                }
                loadDownlines();
            } else {
                staffTypeSelect.value = staff.role === 'superAdmin' ? 'Admin' : 'Staff';
                salesConfigCard.style.display = 'none';
            }

            // Set active status
            isActiveCheckbox.checked = staff.isActive;
            statusText.textContent = staff.isActive ? 'Active' : 'Inactive';
            statusText.style.color = staff.isActive ? '#28a745' : '#6c757d';

            // Permissions
            document.getElementById('canManageBookings').checked = staff.permissions?.canManageBookings || false;
            document.getElementById('canManageCustomers').checked = staff.permissions?.canManageUsers || false;
            document.getElementById('canManagePayments').checked = staff.permissions?.canManagePayments || false;
            document.getElementById('canManageTest').checked = staff.permissions?.canManageTest || false;
            document.getElementById('canManageReports').checked = staff.permissions?.canViewReports || false;

        } catch (err) {
            console.error(err);
            alert('Failed to load staff details');
        }
    } else {
        isActiveCheckbox.checked = true;
        statusText.textContent = 'Active';
        statusText.style.color = '#28a745';
    }

    // Handle Submit/Update
    document.getElementById('submit').addEventListener('click', async (e) => {
        e.preventDefault();

        const firstname = document.getElementById('firstname').value.trim();
        const lastname = document.getElementById('lastname').value.trim();
        const fullName = `${firstname} ${lastname}`.trim();
        const email = document.getElementById('email').value.trim();
        const phoneNo = document.getElementById('phone').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const staffTypeRaw = staffTypeSelect.value.trim();
        const isSales = staffTypeRaw.toLowerCase() === 'sales';

        if (!firstname || !email || !username) {
            alert("Please fill all the required fields!");
            return;
        }

        const payload = {
            fullName: fullName,
            email: email,
            phoneNo: phoneNo,
            username: username,
            role: 'staff',
            staffType: isSales ? 'sales' : staffTypeRaw.toLowerCase(),
            isActive: isActiveCheckbox.checked,
            permissions: {
                canManageBookings: document.getElementById('canManageBookings').checked || isSales,
                canManageUsers: document.getElementById('canManageCustomers').checked,
                canManagePayments: document.getElementById('canManagePayments').checked,
                canManageTest: document.getElementById('canManageTest').checked,
                canViewReports: document.getElementById('canManageReports').checked || isSales,
            }
        };

        if (isSales) {
            const desig = salesDesignationSelect.value.trim().toUpperCase();
            payload.salesDesignation = desig;
            payload.monthlySalesTarget = Number(monthlySalesTargetInput?.value || 0);

            const chosenArray = Array.from(selectedIds);
            if (desig === 'TH') {
                payload.assignedFranchisees = chosenArray;
            } else {
                payload.assignedStaff = chosenArray;
            }
        } else {
            payload.salesDesignation = null;
        }

        if (password) {
            payload.password = password;
        }

        try {
            const res = await fetch(`${apiBase}/update-staff-tenant/${staffId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert('Staff updated successfully!');
                if (typeof loadPage === 'function') {
                    loadPage('salesPortal');
                }
            } else {
                alert(data.message || 'Failed to update staff');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong while updating staff.');
        }
    });

    // Delete handler
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn && staffId) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm('Are you sure you want to delete this staff member?')) return;

            try {
                const res = await fetch(`${apiBase}/delete-staff-tenant/${staffId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Staff deleted successfully');
                    if (typeof loadPage === 'function') {
                        loadPage('salesPortal');
                    }
                } else {
                    alert(data.message || 'Failed to delete staff');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to delete staff');
            }
        });
    }
})();
