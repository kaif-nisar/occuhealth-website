/**
 * Enterprise Staff & Sales Force Provisioning Studio Controller
 * Powers the high-density viewport-optimized Add Staff interface
 */

function initAddStaffPage() {
    // Core Form & Inputs
    const mainForm = document.getElementById("mainStaffForm");
    const staffTypeSelect = document.getElementById("stafftype");
    const salesDesignationSelect = document.getElementById("salesDesignation");
    const roleTypeHeaderBadge = document.getElementById("roleTypeHeaderBadge");

    // Left Panel Sections
    const salesSettingsSection = document.getElementById("salesSettingsSection");
    const permissionsSection = document.getElementById("permissionsSection");
    const monthlySalesTargetInput = document.getElementById("monthlySalesTarget");
    const rolePills = document.querySelectorAll(".st-role-pill");
    const desigCards = document.querySelectorAll(".st-desig-card");
    const btnTogglePassword = document.getElementById("btnTogglePassword");
    const passwordInput = document.getElementById("password");

    // Right Panel Elements
    const salesDownlinePanel = document.getElementById("salesDownlinePanel");
    const generalGovernancePanel = document.getElementById("generalGovernancePanel");
    const downlineChooserTitle = document.getElementById("downlineChooserTitle");
    const downlineChooserSubtitle = document.getElementById("downlineChooserSubtitle");
    const downlineListContainer = document.getElementById("downlineListContainer");
    const downlineSearchInput = document.getElementById("downlineSearchInput");
    const selectedCountBadge = document.getElementById("selectedCountBadge");
    const btnSelectAll = document.getElementById("btnSelectAllDownlines");
    const btnClear = document.getElementById("btnClearDownlines");

    // Action Buttons
    const submitBtn = document.getElementById("submit");
    const btnResetForm = document.getElementById("btnResetForm");

    // State
    let currentOptions = [];
    let selectedIds = new Set();
    let currentFilteredOptions = [];

    // Configuration Map for Sales Designations
    const DESIG_CONFIG = {
        TH: {
            title: `<i class="fa-solid fa-store" style="color: #2563eb;"></i> Tag Franchisees &amp; Sub-Franchisees (Labs)`,
            subtitle: `Choose the lab accounts this Team Head (TH) will manage, book samples for, and oversee.`,
            unitName: `Labs`,
            defaultTarget: 200000
        },
        ASM: {
            title: `<i class="fa-solid fa-users" style="color: #059669;"></i> Assign Team Heads (TH)`,
            subtitle: `Select which Team Heads (THs) will report directly to this Area Sales Manager (ASM).`,
            unitName: `THs`,
            defaultTarget: 500000
        },
        RSM: {
            title: `<i class="fa-solid fa-network-wired" style="color: #7c3aed;"></i> Assign Area Sales Managers (ASM)`,
            subtitle: `Select which Area Sales Managers (ASMs) will report to this Regional Sales Manager (RSM).`,
            unitName: `ASMs`,
            defaultTarget: 1500000
        },
        ZSM: {
            title: `<i class="fa-solid fa-crown" style="color: #d97706;"></i> Assign Regional Sales Managers (RSM)`,
            subtitle: `Select which Regional Sales Managers (RSMs) will report to this Zonal Sales Manager (ZSM).`,
            unitName: `RSMs`,
            defaultTarget: 5000000
        }
    };

    // -------------------------------------------------------------
    // 1. Role Switching Logic (Segmented Pills)
    // -------------------------------------------------------------
    function setRole(roleName) {
        const normalized = (roleName || "Staff").trim();
        const lower = normalized.toLowerCase();

        // Update active class on segmented buttons
        rolePills.forEach(pill => {
            const pillType = pill.getAttribute("data-type") || "";
            if (pillType.toLowerCase() === lower) {
                pill.classList.add("active");
            } else {
                pill.classList.remove("active");
            }
        });

        // Sync hidden select
        if (staffTypeSelect) {
            staffTypeSelect.value = normalized === "Sales" ? "Sales" : (normalized === "Admin" ? "Admin" : "Staff");
        }

        // Toggle Views
        if (lower === "sales") {
            // Header badge
            if (roleTypeHeaderBadge) {
                roleTypeHeaderBadge.className = "st-badge-pill st-badge-green";
                roleTypeHeaderBadge.innerHTML = `<i class="fa-solid fa-sitemap"></i> Field Sales Force`;
            }

            // Left panel sections
            if (salesSettingsSection) salesSettingsSection.style.display = "block";
            if (permissionsSection) permissionsSection.style.display = "none";

            // Right panel sections
            if (salesDownlinePanel) salesDownlinePanel.style.display = "flex";
            if (generalGovernancePanel) generalGovernancePanel.style.display = "none";

            // Default permissions for sales
            const chkBookings = document.getElementById("canManageBookings");
            const chkReports = document.getElementById("canManageReports");
            if (chkBookings) chkBookings.checked = true;
            if (chkReports) chkReports.checked = true;

            // Load downlines for currently active designation
            const currentDesig = getSelectedDesignation();
            updateDesignationUI(currentDesig);
            loadDownlines();
        } else {
            // Non-Sales (Staff or Admin)
            if (roleTypeHeaderBadge) {
                if (lower === "admin") {
                    roleTypeHeaderBadge.className = "st-badge-pill st-badge-blue";
                    roleTypeHeaderBadge.style.background = "#f5f3ff";
                    roleTypeHeaderBadge.style.color = "#7c3aed";
                    roleTypeHeaderBadge.style.borderColor = "#ddd6fe";
                    roleTypeHeaderBadge.innerHTML = `<i class="fa-solid fa-user-shield"></i> System Admin`;
                } else {
                    roleTypeHeaderBadge.className = "st-badge-pill st-badge-blue";
                    roleTypeHeaderBadge.style.background = "";
                    roleTypeHeaderBadge.style.color = "";
                    roleTypeHeaderBadge.style.borderColor = "";
                    roleTypeHeaderBadge.innerHTML = `<i class="fa-solid fa-user"></i> General Staff`;
                }
            }

            // Left panel sections
            if (salesSettingsSection) salesSettingsSection.style.display = "none";
            if (permissionsSection) permissionsSection.style.display = "block";

            // Right panel sections
            if (salesDownlinePanel) salesDownlinePanel.style.display = "none";
            if (generalGovernancePanel) generalGovernancePanel.style.display = "flex";

            // Adjust permissions
            if (lower === "admin") {
                ["canManageBookings", "canManageReports", "canManagePayments", "canManageTest", "canManageCustomers"].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.checked = true;
                });
            } else {
                const b = document.getElementById("canManageBookings");
                const r = document.getElementById("canManageReports");
                const p = document.getElementById("canManagePayments");
                const t = document.getElementById("canManageTest");
                const c = document.getElementById("canManageCustomers");
                if (b) b.checked = true;
                if (r) r.checked = true;
                if (p) p.checked = false;
                if (t) t.checked = false;
                if (c) c.checked = false;
            }
        }
    }

    // Bind click handlers to role selector pills
    rolePills.forEach(pill => {
        pill.addEventListener("click", () => {
            const roleType = pill.getAttribute("data-type");
            setRole(roleType);
        });
    });

    // -------------------------------------------------------------
    // 2. Sales Designation Logic (Segmented Cards)
    // -------------------------------------------------------------
    function getSelectedDesignation() {
        if (salesDesignationSelect && salesDesignationSelect.value) {
            return salesDesignationSelect.value.trim().toUpperCase();
        }
        return "TH";
    }

    function updateDesignationUI(desig) {
        const cfg = DESIG_CONFIG[desig] || DESIG_CONFIG.TH;

        // Update active class on designation cards
        desigCards.forEach(card => {
            const cardDesig = card.getAttribute("data-desig");
            if (cardDesig === desig) {
                card.classList.add("active");
            } else {
                card.classList.remove("active");
            }
        });

        // Sync hidden select
        if (salesDesignationSelect) {
            salesDesignationSelect.value = desig;
        }

        // Update headers in right panel
        if (downlineChooserTitle) downlineChooserTitle.innerHTML = cfg.title;
        if (downlineChooserSubtitle) downlineChooserSubtitle.textContent = cfg.subtitle;

        // Auto update monthly target if blank or previously default
        if (monthlySalesTargetInput) {
            const curVal = Number(monthlySalesTargetInput.value || 0);
            const isStandard = Object.values(DESIG_CONFIG).some(c => c.defaultTarget === curVal) || curVal === 0;
            if (isStandard) {
                monthlySalesTargetInput.value = cfg.defaultTarget;
            }
        }

        updateSelectedBadge();
    }

    function setDesignation(desig) {
        updateDesignationUI(desig);
        selectedIds.clear();
        updateSelectedBadge();
        loadDownlines();
    }

    desigCards.forEach(card => {
        card.addEventListener("click", () => {
            const desig = card.getAttribute("data-desig");
            setDesignation(desig);
        });
    });

    // -------------------------------------------------------------
    // 3. Fetching Downlines from API
    // -------------------------------------------------------------
    async function loadDownlines() {
        if (!downlineListContainer) return;

        const desig = getSelectedDesignation();
        const cfg = DESIG_CONFIG[desig] || DESIG_CONFIG.TH;

        downlineListContainer.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #64748b; grid-column: 1 / -1;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 26px; color: #2563eb;"></i>
                <p style="margin-top: 12px; font-size: 13px; font-weight: 600;">Fetching available territory units for ${desig}...</p>
                <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">Checking unassigned franchisees and sales personnel</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/v1/sales/downline-options?designation=${desig}`);
            const json = await res.json();

            if (json.success && json.data && Array.isArray(json.data.options)) {
                currentOptions = json.data.options;
                currentFilteredOptions = [...currentOptions];

                // If input query is active, apply search
                const query = downlineSearchInput ? downlineSearchInput.value.trim().toLowerCase() : "";
                if (query) {
                    filterDownlines(query);
                } else {
                    renderDownlineCards(currentOptions);
                }
            } else {
                currentOptions = [];
                currentFilteredOptions = [];
                renderEmptyState(`No territory units found for ${desig}. You can assign downlines later.`);
            }
        } catch (err) {
            console.error("Failed to load downlines:", err);
            downlineListContainer.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #e11d48; grid-column: 1 / -1;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px;"></i>
                    <p style="margin-top: 8px; font-size: 13px; font-weight: 600;">Network communication error while loading units.</p>
                    <button type="button" class="st-mini-btn" id="btnRetryDownlines" style="margin-top: 10px; background: #fff1f2; color: #e11d48; border-color: #fecdd3;">
                        <i class="fa-solid fa-rotate-right"></i> Retry Loading
                    </button>
                </div>
            `;
            const retryBtn = document.getElementById("btnRetryDownlines");
            if (retryBtn) retryBtn.addEventListener("click", loadDownlines);
        }
    }

    function renderEmptyState(message) {
        if (!downlineListContainer) return;
        downlineListContainer.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #94a3b8; grid-column: 1 / -1;">
                <i class="fa-regular fa-folder-open" style="font-size: 32px; margin-bottom: 8px; color: #cbd5e1; display: block;"></i>
                <span style="font-size: 13px; font-weight: 500;">${message}</span>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // 4. Rendering Downline Cards (High-Density Modern Studio UI)
    // -------------------------------------------------------------
    function renderDownlineCards(items) {
        if (!downlineListContainer) return;

        if (!items || items.length === 0) {
            renderEmptyState("No matching units found.");
            return;
        }

        const desig = getSelectedDesignation();

        const html = items.map(item => {
            const isChecked = selectedIds.has(item._id);
            let name = "";
            let metaHtml = "";
            let subHtml = "";
            let assignedHtml = "";

            if (desig === "TH") {
                // Frontline Labs / Franchisees
                name = item.clinicName || item.fullName || item.name || "Lab Account";
                const bal = Number(item.walletBalance || 0);
                const isPos = bal >= 0;
                metaHtml = `<span class="st-dc-bal ${isPos ? 'st-bal-pos' : 'st-bal-neg'}"><i class="fa-solid fa-wallet"></i> ₹${bal.toFixed(0)}</span>`;

                const city = item.city ? `<span class="st-dc-city"><i class="fa-solid fa-location-dot"></i> ${item.city}</span>` : "";
                const code = item.username ? `<span>@${item.username}</span>` : "";
                const phone = item.phoneNo ? `<span><i class="fa-solid fa-phone"></i> ${item.phoneNo}</span>` : "";
                subHtml = `${city} ${code} ${phone}`;

                if (item.alreadyAssignedTo) {
                    const thName = item.alreadyAssignedTo.thName || "another TH";
                    assignedHtml = `<span class="st-dc-assigned"><i class="fa-solid fa-circle-exclamation"></i> Currently tagged to ${thName}</span>`;
                }
            } else if (desig === "ASM") {
                // Team Heads reporting to ASM
                name = item.fullName || item.name || item.username;
                const labCount = item.franchiseeCount || 0;
                metaHtml = `<span class="st-badge-pill st-badge-blue"><i class="fa-solid fa-store"></i> ${labCount} Labs</span>`;
                subHtml = `<span>@${item.username}</span> <span><i class="fa-solid fa-phone"></i> ${item.phoneNo || 'N/A'}</span>`;

                if (item.alreadyAssignedTo) {
                    const parentName = item.alreadyAssignedTo.parentName || "another ASM";
                    assignedHtml = `<span class="st-dc-assigned"><i class="fa-solid fa-circle-exclamation"></i> Reports to ${parentName}</span>`;
                }
            } else if (desig === "RSM") {
                // ASMs reporting to RSM
                name = item.fullName || item.name || item.username;
                const thCount = item.thCount || 0;
                metaHtml = `<span class="st-badge-pill st-badge-blue" style="background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe;"><i class="fa-solid fa-users"></i> ${thCount} THs</span>`;
                subHtml = `<span>@${item.username}</span> <span><i class="fa-solid fa-phone"></i> ${item.phoneNo || 'N/A'}</span>`;

                if (item.alreadyAssignedTo) {
                    const parentName = item.alreadyAssignedTo.parentName || "another RSM";
                    assignedHtml = `<span class="st-dc-assigned"><i class="fa-solid fa-circle-exclamation"></i> Reports to ${parentName}</span>`;
                }
            } else if (desig === "ZSM") {
                // RSMs reporting to ZSM
                name = item.fullName || item.name || item.username;
                const asmCount = item.asmCount || 0;
                metaHtml = `<span class="st-badge-pill st-badge-blue" style="background: #fffbeb; color: #d97706; border-color: #fde68a;"><i class="fa-solid fa-network-wired"></i> ${asmCount} ASMs</span>`;
                subHtml = `<span>@${item.username}</span> <span><i class="fa-solid fa-phone"></i> ${item.phoneNo || 'N/A'}</span>`;

                if (item.alreadyAssignedTo) {
                    const parentName = item.alreadyAssignedTo.parentName || "another ZSM";
                    assignedHtml = `<span class="st-dc-assigned"><i class="fa-solid fa-circle-exclamation"></i> Reports to ${parentName}</span>`;
                }
            }

            return `
                <div class="st-downline-card ${isChecked ? 'selected' : ''}" data-id="${item._id}">
                    <input type="checkbox" class="st-downline-chk" value="${item._id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();">
                    <div class="st-dc-content">
                        <div class="st-dc-top">
                            <span class="st-dc-name" title="${name}">${name}</span>
                            ${metaHtml}
                        </div>
                        <div class="st-dc-sub">
                            ${subHtml}
                        </div>
                        ${assignedHtml}
                    </div>
                </div>
            `;
        }).join("");

        downlineListContainer.innerHTML = html;

        // Attach Click Listeners
        downlineListContainer.querySelectorAll(".st-downline-card").forEach(card => {
            const cardId = card.getAttribute("data-id");
            const chk = card.querySelector(".st-downline-chk");

            function toggleSelection() {
                const nowChecked = !selectedIds.has(cardId);
                if (nowChecked) {
                    selectedIds.add(cardId);
                    card.classList.add("selected");
                    if (chk) chk.checked = true;
                } else {
                    selectedIds.delete(cardId);
                    card.classList.remove("selected");
                    if (chk) chk.checked = false;
                }
                updateSelectedBadge();
            }

            card.addEventListener("click", toggleSelection);

            if (chk) {
                chk.addEventListener("change", (e) => {
                    if (chk.checked) {
                        selectedIds.add(cardId);
                        card.classList.add("selected");
                    } else {
                        selectedIds.delete(cardId);
                        card.classList.remove("selected");
                    }
                    updateSelectedBadge();
                });
            }
        });
    }

    function updateSelectedBadge() {
        if (!selectedCountBadge) return;
        const desig = getSelectedDesignation();
        const cfg = DESIG_CONFIG[desig] || DESIG_CONFIG.TH;
        const count = selectedIds.size;
        selectedCountBadge.textContent = `${count} ${cfg.unitName} Selected`;

        if (count > 0) {
            selectedCountBadge.className = "st-badge-pill st-badge-green";
        } else {
            selectedCountBadge.className = "st-badge-pill st-badge-blue";
        }
    }

    // -------------------------------------------------------------
    // 5. Search Filtering & Bulk Actions
    // -------------------------------------------------------------
    function filterDownlines(query) {
        if (!query) {
            currentFilteredOptions = [...currentOptions];
        } else {
            currentFilteredOptions = currentOptions.filter(item => {
                const name = (item.name || item.fullName || "").toLowerCase();
                const clinic = (item.clinicName || "").toLowerCase();
                const user = (item.username || "").toLowerCase();
                const city = (item.city || "").toLowerCase();
                const phone = (item.phoneNo || "").toLowerCase();
                return name.includes(query) || clinic.includes(query) || user.includes(query) || city.includes(query) || phone.includes(query);
            });
        }
        renderDownlineCards(currentFilteredOptions);
    }

    if (downlineSearchInput) {
        downlineSearchInput.addEventListener("input", function () {
            const query = this.value.trim().toLowerCase();
            filterDownlines(query);
        });
    }

    // Select All (Visible / Filtered)
    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", () => {
            currentFilteredOptions.forEach(opt => selectedIds.add(opt._id));
            renderDownlineCards(currentFilteredOptions);
            updateSelectedBadge();
        });
    }

    // Clear Selection
    if (btnClear) {
        btnClear.addEventListener("click", () => {
            selectedIds.clear();
            renderDownlineCards(currentFilteredOptions);
            updateSelectedBadge();
        });
    }

    // -------------------------------------------------------------
    // 6. Security & Credentials Utilities
    // -------------------------------------------------------------
    if (btnTogglePassword && passwordInput) {
        btnTogglePassword.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            btnTogglePassword.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
    }

    // Auto set today's date in submission-date
    const subDateInput = document.getElementById("submission-date");
    if (subDateInput && !subDateInput.value) {
        subDateInput.value = new Date().toISOString().split("T")[0];
    }

    // Reset handler
    if (btnResetForm) {
        btnResetForm.addEventListener("click", () => {
            setTimeout(() => {
                setRole("Staff");
                setDesignation("TH");
                selectedIds.clear();
                updateSelectedBadge();
                if (downlineSearchInput) downlineSearchInput.value = "";
            }, 50);
        });
    }

    // -------------------------------------------------------------
    // 7. Form Submission (Provisioning API)
    // -------------------------------------------------------------
    if (submitBtn) {
        submitBtn.addEventListener("click", async function (event) {
            event.preventDefault();

            const firstname = document.getElementById("firstname")?.value.trim() || "";
            const lastname = document.getElementById("lastname")?.value.trim() || "";
            const email = document.getElementById("email")?.value.trim() || "";
            const phoneNo = document.getElementById("phone")?.value.trim() || "";
            const username = document.getElementById("username")?.value.trim() || "";
            const password = document.getElementById("password")?.value || "";

            const rawStaffType = staffTypeSelect ? staffTypeSelect.value.trim() : "Staff";
            const isSales = rawStaffType.toLowerCase() === "sales";
            const submissionDate = subDateInput?.value || new Date().toISOString().split("T")[0];

            // Validation
            if (!firstname || !lastname || !email || !phoneNo || !username || !password) {
                alert("Please fill in all required fields (First Name, Last Name, Email, Phone, Username, Password).");
                return;
            }

            if (phoneNo.length < 7) {
                alert("Please enter a valid phone number.");
                return;
            }

            // Permissions
            const permissions = {
                canManageBookings: document.getElementById("canManageBookings")?.checked || isSales,
                canManagePayments: document.getElementById("canManagePayments")?.checked || false,
                canManageTest: document.getElementById("canManageTest")?.checked || false,
                canManageUsers: document.getElementById("canManageCustomers")?.checked || false,
                canViewReports: document.getElementById("canManageReports")?.checked || isSales,
            };

            const payload = {
                fullName: `${firstname} ${lastname}`.trim(),
                lastname,
                email,
                phoneNo,
                username,
                password,
                staffType: isSales ? "sales" : rawStaffType.toLowerCase(),
                submissionDate,
                permissions,
            };

            // Sales hierarchy fields
            if (isSales) {
                const desig = getSelectedDesignation();
                payload.salesDesignation = desig;
                payload.monthlySalesTarget = Number(monthlySalesTargetInput?.value || 0);

                const chosenDownlines = Array.from(selectedIds);
                if (desig === "TH") {
                    payload.assignedFranchisees = chosenDownlines;
                } else {
                    payload.assignedStaff = chosenDownlines;
                }
            }

            // Button loading state
            submitBtn.disabled = true;
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Provisioning...`;

            try {
                const response = await fetch("/api/v1/user/add-staff", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (response.ok && (data.success !== false)) {
                    const desigLabel = isSales ? ` (${payload.salesDesignation})` : "";
                    alert(`Success! Staff member ${firstname} ${lastname}${desigLabel} provisioned successfully.`);

                    // Reset form
                    if (mainForm) mainForm.reset();
                    selectedIds.clear();
                    updateSelectedBadge();
                    setRole("Staff");

                    // Navigate to appropriate page if loadPage function is present
                    if (typeof loadPage === "function") {
                        if (isSales) {
                            loadPage("salesPortal");
                        } else {
                            loadPage("List_staff");
                        }
                    }
                } else {
                    alert(`Error: ${data.message || "Failed to provision staff member."}`);
                }
            } catch (error) {
                console.error("Staff provisioning failed:", error);
                alert("Network error: Failed to provision staff member. Please check server connection.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Default initialization: Start as General Staff
    setRole(staffTypeSelect?.value || "Staff");
}

// Auto-run if DOM already loaded, or on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAddStaffPage);
} else {
    initAddStaffPage();
}
