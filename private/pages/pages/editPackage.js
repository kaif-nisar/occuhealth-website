(function () {
    const BASE_URL = window.BASE_URL || window.location.origin;

    let availablePanels = [];
    let availableTests = [];
    let selectedPanelsMap = new Map(); // panelId -> { id, name, price, sampleTypes }
    let selectedTestsMap = new Map();  // testId -> { id, name, price, sampleType }
    let targetPackageId = null;

    // DOM Elements
    const loadingOverlay = document.getElementById("pkgLoadingOverlay");
    const headerPackageName = document.getElementById("headerPackageName");
    const headerPackageMeta = document.getElementById("headerPackageMeta");
    const packageNameInput = document.getElementById("packageName");
    const packageGenderSelect = document.getElementById("packageGender");
    const packageFeeInput = document.getElementById("packageFee");
    const finalPriceInput = document.getElementById("finalPrice");
    const nameError = document.getElementById("nameError");

    const selectedPanelsContainer = document.getElementById("selectedPanelsContainer");
    const emptyPanelsHint = document.getElementById("emptyPanelsHint");
    const panelSearchInput = document.getElementById("panelSearchInput");
    const panelSearchDropdown = document.getElementById("panelSearchDropdown");
    const panelsCountBadge = document.getElementById("panelsCountBadge");

    const selectedTestsContainer = document.getElementById("selectedTestsContainer");
    const emptyTestsHint = document.getElementById("emptyTestsHint");
    const testSearchInput = document.getElementById("testSearchInput");
    const testSearchDropdown = document.getElementById("testSearchDropdown");
    const testsCountBadge = document.getElementById("testsCountBadge");

    // Calculator Elements
    const calcStandaloneTotal = document.getElementById("calcStandaloneTotal");
    const calcPackageFee = document.getElementById("calcPackageFee");
    const calcSavings = document.getElementById("calcSavings");
    const calcSamples = document.getElementById("calcSamples");

    const savePackageBtn = document.getElementById("savePackageBtn");

    init();

    async function init() {
        bindEvents();
        extractTargetId();

        if (!targetPackageId) {
            showToast("No package ID provided in URL", "error");
            if (loadingOverlay) loadingOverlay.innerHTML = '<div style="color:#ef4444; font-weight:600;">Invalid Package ID. <a onclick="loadPage(\'testPackage\')" style="text-decoration:underline; cursor:pointer;">Return to Packages</a></div>';
            return;
        }

        await Promise.all([loadPanels(), loadTests()]);
        await fetchPackageDetails();
    }

    function extractTargetId() {
        const urlParams = new URLSearchParams(window.location.search);
        let id = urlParams.get("Name") || urlParams.get("name") || urlParams.get("id") || urlParams.get("_id") || urlParams.get("value1");

        if (id) {
            try {
                id = decodeURIComponent(id);
            } catch (e) {}
        }

        if (!id) {
            for (const [key] of urlParams.entries()) {
                if (key !== "page" && key !== "v" && key.length >= 12) {
                    id = key;
                    break;
                }
            }
        }

        targetPackageId = id;
    }

    function bindEvents() {
        if (packageNameInput) {
            packageNameInput.addEventListener("input", function () {
                if (this.value.includes(",")) {
                    if (nameError) nameError.style.display = "block";
                    this.classList.add("pkg-input-error");
                } else {
                    if (nameError) nameError.style.display = "none";
                    this.classList.remove("pkg-input-error");
                }
            });
        }

        if (packageFeeInput) {
            packageFeeInput.addEventListener("input", updateCalculations);
        }

        if (panelSearchInput) {
            panelSearchInput.addEventListener("input", filterPanelDropdown);
            panelSearchInput.addEventListener("focus", filterPanelDropdown);

            document.addEventListener("click", (e) => {
                if (!panelSearchInput.contains(e.target) && !panelSearchDropdown.contains(e.target)) {
                    panelSearchDropdown.style.display = "none";
                }
            });
        }

        if (testSearchInput) {
            testSearchInput.addEventListener("input", filterTestDropdown);
            testSearchInput.addEventListener("focus", filterTestDropdown);

            document.addEventListener("click", (e) => {
                if (!testSearchInput.contains(e.target) && !testSearchDropdown.contains(e.target)) {
                    testSearchDropdown.style.display = "none";
                }
            });
        }

        if (savePackageBtn) {
            savePackageBtn.addEventListener("click", submitPackageUpdate);
        }
    }

    async function loadPanels() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/all-pannels-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            availablePanels = Array.isArray(data.panels) ? data.panels : [];
        } catch (e) {
            console.error("Failed to load panels:", e);
        }
    }

    async function loadTests() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/test-database-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            availableTests = Array.isArray(data.tests) ? data.tests : [];
        } catch (e) {
            console.error("Failed to load tests:", e);
        }
    }

    async function fetchPackageDetails() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/one-Package/${encodeURIComponent(targetPackageId)}`, {
                method: "POST"
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: Package not found`);

            const data = await res.json();
            populateFormData(data);

            if (loadingOverlay) loadingOverlay.style.display = "none";
        } catch (err) {
            console.error("Error fetching package details:", err);
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div style="color:#ef4444; font-weight:600; font-size:1.1rem; margin-bottom:8px;">Failed to load package</div>
                    <div style="color:#64748b; font-size:0.85rem; margin-bottom:14px;">${escapeHtml(err.message)}</div>
                    <button type="button" class="pkg-btn pkg-btn-outline" onclick="loadPage(\'testPackage\')"><i class="fa-solid fa-arrow-left"></i> Back to Packages</button>
                `;
            }
        }
    }

    function populateFormData(pkg) {
        if (!pkg) return;

        if (headerPackageName) headerPackageName.textContent = `Edit: ${pkg.packageName || 'Package'}`;
        if (headerPackageMeta) headerPackageMeta.textContent = `ID: ${pkg._id}`;

        packageNameInput.value = pkg.packageName || "";
        packageFeeInput.value = pkg.packageFee != null ? pkg.packageFee : "";
        finalPriceInput.value = pkg.final_price != null ? pkg.final_price : "";

        if (pkg.packageGender || pkg.packagegender) {
            const genderVal = pkg.packageGender || pkg.packagegender;
            Array.from(packageGenderSelect.options).forEach((opt) => {
                if (opt.value.toLowerCase() === genderVal.toLowerCase()) {
                    opt.selected = true;
                }
            });
        }

        // Selected Panels
        selectedPanelsMap.clear();
        if (Array.isArray(pkg.pannelIds) && pkg.pannelIds.length > 0) {
            pkg.pannelIds.forEach((pRef) => {
                const id = typeof pRef === "object" ? pRef._id : pRef;
                const matched = availablePanels.find(p => p._id === id);
                if (matched) {
                    selectedPanelsMap.set(matched._id, {
                        id: matched._id,
                        name: matched.name,
                        price: parseFloat(matched.price) || 0,
                        sampleTypes: Array.isArray(matched.sample_types) ? matched.sample_types : (matched.sample_types ? [matched.sample_types] : [])
                    });
                } else if (typeof pRef === "object" && pRef.name) {
                    selectedPanelsMap.set(id, {
                        id,
                        name: pRef.name,
                        price: 0,
                        sampleTypes: []
                    });
                }
            });
        } else if (Array.isArray(pkg.pannelname) && pkg.pannelname.length > 0) {
            pkg.pannelname.forEach((pName, idx) => {
                const matched = availablePanels.find(p => p.name === pName);
                if (matched) {
                    selectedPanelsMap.set(matched._id, {
                        id: matched._id,
                        name: matched.name,
                        price: parseFloat(matched.price) || 0,
                        sampleTypes: Array.isArray(matched.sample_types) ? matched.sample_types : []
                    });
                } else {
                    const fallbackSample = pkg.pannelSample && pkg.pannelSample[idx] ? [pkg.pannelSample[idx]] : [];
                    selectedPanelsMap.set(pName, {
                        id: pName,
                        name: pName,
                        price: 0,
                        sampleTypes: fallbackSample
                    });
                }
            });
        }
        renderSelectedPanels();

        // Selected Tests
        selectedTestsMap.clear();
        if (Array.isArray(pkg.testIds) && pkg.testIds.length > 0) {
            pkg.testIds.forEach((tRef) => {
                const id = typeof tRef === "object" ? tRef._id : tRef;
                const matched = availableTests.find(t => t._id === id);
                if (matched) {
                    selectedTestsMap.set(matched._id, {
                        id: matched._id,
                        name: matched.Name,
                        price: parseFloat(matched.Price) || 0,
                        sampleType: matched.sampleType || "N/A"
                    });
                } else if (typeof tRef === "object" && tRef.Name) {
                    selectedTestsMap.set(id, {
                        id,
                        name: tRef.Name,
                        price: 0,
                        sampleType: "N/A"
                    });
                }
            });
        } else if (Array.isArray(pkg.testname) && pkg.testname.length > 0) {
            pkg.testname.forEach((tName, idx) => {
                const matched = availableTests.find(t => t.Name === tName);
                if (matched) {
                    selectedTestsMap.set(matched._id, {
                        id: matched._id,
                        name: matched.Name,
                        price: parseFloat(matched.Price) || 0,
                        sampleType: matched.sampleType || "N/A"
                    });
                } else {
                    const fallbackSample = pkg.testSample && pkg.testSample[idx] ? pkg.testSample[idx] : "N/A";
                    selectedTestsMap.set(tName, {
                        id: tName,
                        name: tName,
                        price: 0,
                        sampleType: fallbackSample
                    });
                }
            });
        }
        renderSelectedTests();

        updateCalculations();
    }

    // Panel Picker
    function filterPanelDropdown() {
        const query = (panelSearchInput.value || "").trim().toLowerCase();
        panelSearchDropdown.innerHTML = "";

        const matches = availablePanels.filter((p) => {
            if (selectedPanelsMap.has(p._id)) return false;
            const name = (p.name || "").toLowerCase();
            const code = (p.Short_name || "").toLowerCase();
            return !query || name.includes(query) || code.includes(query);
        });

        if (matches.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.style.padding = "10px 14px";
            emptyEl.style.color = "#94a3b8";
            emptyEl.style.fontSize = "0.85rem";
            emptyEl.textContent = query ? "No matching panels found" : "All panels selected";
            panelSearchDropdown.appendChild(emptyEl);
        } else {
            matches.slice(0, 25).forEach((p) => {
                const item = document.createElement("div");
                item.className = "pkg-dropdown-item";
                item.innerHTML = `
                    <div>
                        <span style="font-weight:600;">${escapeHtml(p.name)}</span>
                        ${p.Short_name ? `<span style="color:#64748b; font-size:0.75rem; margin-left:6px;">(${escapeHtml(p.Short_name)})</span>` : ""}
                    </div>
                    <span style="font-weight:700; color:#059669; font-size:0.8rem;">
                        ₹${p.price || 0}
                    </span>
                `;

                item.addEventListener("click", () => {
                    selectPanel(p);
                    panelSearchInput.value = "";
                    panelSearchDropdown.style.display = "none";
                    panelSearchInput.focus();
                });

                panelSearchDropdown.appendChild(item);
            });
        }

        panelSearchDropdown.style.display = "block";
    }

    function selectPanel(panel) {
        if (!panel || !panel._id) return;
        selectedPanelsMap.set(panel._id, {
            id: panel._id,
            name: panel.name,
            price: parseFloat(panel.price) || 0,
            sampleTypes: Array.isArray(panel.sample_types) ? panel.sample_types : (panel.sample_types ? [panel.sample_types] : [])
        });
        renderSelectedPanels();
        updateCalculations();
    }

    function deselectPanel(panelId) {
        selectedPanelsMap.delete(panelId);
        renderSelectedPanels();
        updateCalculations();
    }

    function renderSelectedPanels() {
        selectedPanelsContainer.innerHTML = "";

        if (selectedPanelsMap.size === 0) {
            selectedPanelsContainer.appendChild(emptyPanelsHint);
            if (panelsCountBadge) panelsCountBadge.textContent = "0 panels selected";
            return;
        }

        if (panelsCountBadge) panelsCountBadge.textContent = `${selectedPanelsMap.size} panels selected`;

        selectedPanelsMap.forEach((p, id) => {
            const tag = document.createElement("div");
            tag.className = "pkg-tag panel-tag";
            tag.innerHTML = `
                <i class="fa-solid fa-rectangle-list"></i>
                <span>${escapeHtml(p.name)}</span>
                <span style="color:#0369a1; font-weight:700; font-size:0.75rem;">₹${p.price}</span>
                <span class="del-btn" title="Remove">&times;</span>
            `;

            tag.querySelector(".del-btn").addEventListener("click", () => deselectPanel(id));
            selectedPanelsContainer.appendChild(tag);
        });
    }

    // Test Picker
    function filterTestDropdown() {
        const query = (testSearchInput.value || "").trim().toLowerCase();
        testSearchDropdown.innerHTML = "";

        const matches = availableTests.filter((t) => {
            if (selectedTestsMap.has(t._id)) return false;
            const name = (t.Name || "").toLowerCase();
            const code = (t.Short_name || "").toLowerCase();
            const sample = (t.sampleType || "").toLowerCase();
            return !query || name.includes(query) || code.includes(query) || sample.includes(query);
        });

        if (matches.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.style.padding = "10px 14px";
            emptyEl.style.color = "#94a3b8";
            emptyEl.style.fontSize = "0.85rem";
            emptyEl.textContent = query ? "No matching tests found" : "All tests selected";
            testSearchDropdown.appendChild(emptyEl);
        } else {
            matches.slice(0, 25).forEach((t) => {
                const item = document.createElement("div");
                item.className = "pkg-dropdown-item";
                item.innerHTML = `
                    <div>
                        <span style="font-weight:600;">${escapeHtml(t.Name)}</span>
                        ${t.Short_name ? `<span style="color:#64748b; font-size:0.75rem; margin-left:6px;">(${escapeHtml(t.Short_name)})</span>` : ""}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.72rem; padding:2px 6px; background:#fef2f2; color:#b91c1c; border-radius:4px; border:1px solid #fee2e2;">
                            ${escapeHtml(t.sampleType || "N/A")}
                        </span>
                        <span style="font-weight:700; color:#059669; font-size:0.8rem;">
                            ₹${t.Price || 0}
                        </span>
                    </div>
                `;

                item.addEventListener("click", () => {
                    selectTest(t);
                    testSearchInput.value = "";
                    testSearchDropdown.style.display = "none";
                    testSearchInput.focus();
                });

                testSearchDropdown.appendChild(item);
            });
        }

        testSearchDropdown.style.display = "block";
    }

    function selectTest(test) {
        if (!test || !test._id) return;
        selectedTestsMap.set(test._id, {
            id: test._id,
            name: test.Name,
            price: parseFloat(test.Price) || 0,
            sampleType: test.sampleType || "N/A"
        });
        renderSelectedTests();
        updateCalculations();
    }

    function deselectTest(testId) {
        selectedTestsMap.delete(testId);
        renderSelectedTests();
        updateCalculations();
    }

    function renderSelectedTests() {
        selectedTestsContainer.innerHTML = "";

        if (selectedTestsMap.size === 0) {
            selectedTestsContainer.appendChild(emptyTestsHint);
            if (testsCountBadge) testsCountBadge.textContent = "0 tests selected";
            return;
        }

        if (testsCountBadge) testsCountBadge.textContent = `${selectedTestsMap.size} tests selected`;

        selectedTestsMap.forEach((t, id) => {
            const tag = document.createElement("div");
            tag.className = "pkg-tag test-tag";
            tag.innerHTML = `
                <i class="fa-solid fa-vial-virus"></i>
                <span>${escapeHtml(t.name)}</span>
                <span class="sample-pill">${escapeHtml(t.sampleType)}</span>
                <span style="color:#6d28d9; font-weight:700; font-size:0.75rem;">₹${t.price}</span>
                <span class="del-btn" title="Remove">&times;</span>
            `;

            tag.querySelector(".del-btn").addEventListener("click", () => deselectTest(id));
            selectedTestsContainer.appendChild(tag);
        });
    }

    // Calculations
    function updateCalculations() {
        let standaloneSum = 0;
        const allSamples = new Set();

        selectedPanelsMap.forEach((p) => {
            standaloneSum += p.price;
            p.sampleTypes.forEach(s => s && allSamples.add(String(s).trim()));
        });

        selectedTestsMap.forEach((t) => {
            standaloneSum += t.price;
            if (t.sampleType) allSamples.add(String(t.sampleType).trim());
        });

        const packageFee = parseFloat(packageFeeInput.value) || 0;

        calcStandaloneTotal.textContent = `₹${standaloneSum}`;
        calcPackageFee.textContent = `₹${packageFee}`;

        if (standaloneSum > 0 && packageFee > 0) {
            const savingAmount = Math.max(0, standaloneSum - packageFee);
            const savingPercent = Math.round((savingAmount / standaloneSum) * 100);
            calcSavings.textContent = `${savingPercent}% (₹${savingAmount})`;
        } else {
            calcSavings.textContent = "0% (₹0)";
        }

        calcSamples.textContent = Array.from(allSamples).join(", ") || "-";
    }

    async function submitPackageUpdate() {
        const nameVal = packageNameInput.value.trim();
        const genderVal = packageGenderSelect.value;
        const feeVal = parseFloat(packageFeeInput.value);
        const mrpVal = parseFloat(finalPriceInput.value);

        if (!nameVal) {
            showToast("Package name is required", "error");
            packageNameInput.focus();
            return;
        }

        if (nameVal.includes(",")) {
            showToast("Comma (,) is not allowed in package name", "error");
            packageNameInput.focus();
            return;
        }

        if (isNaN(feeVal) || isNaN(mrpVal)) {
            showToast("Please enter Billing Price and MRP Value", "error");
            packageFeeInput.focus();
            return;
        }

        if (selectedPanelsMap.size === 0 && selectedTestsMap.size === 0) {
            showToast("Please select at least one Test or Panel to include in the package", "error");
            return;
        }

        const pannelIds = Array.from(selectedPanelsMap.keys());
        const pannelname = Array.from(selectedPanelsMap.values()).map(p => p.name);
        const pannelSample = Array.from(selectedPanelsMap.values()).flatMap(p => p.sampleTypes);

        const testIds = Array.from(selectedTestsMap.keys());
        const testname = Array.from(selectedTestsMap.values()).map(t => t.name);
        const testSample = Array.from(selectedTestsMap.values()).map(t => t.sampleType);

        const payload = {
            packageName: nameVal,
            packageFee: feeVal,
            final_price: mrpVal,
            packagegender: genderVal,
            packageGender: genderVal,
            pannelIds,
            pannelname,
            pannelSample,
            testIds,
            testname,
            testSample
        };

        savePackageBtn.disabled = true;
        savePackageBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/edit-Package-tenant/${encodeURIComponent(targetPackageId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast("Package updated successfully!", "success");
                setTimeout(() => {
                    if (typeof window.loadPage === "function") {
                        window.loadPage("testPackage");
                    } else {
                        window.location.href = "?page=testPackage";
                    }
                }, 1200);
            } else {
                showToast(data.message || "Failed to update package", "error");
                savePackageBtn.disabled = false;
                savePackageBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Package';
            }
        } catch (err) {
            console.error("Update error:", err);
            showToast("Network error: " + err.message, "error");
            savePackageBtn.disabled = false;
            savePackageBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Package';
        }
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("pkgToast");
        const toastMsg = document.getElementById("pkgToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `pkg-toast ${type} show`;

        const icon = toast.querySelector("i");
        if (icon) {
            icon.className = type === "success"
                ? "fa-solid fa-circle-check"
                : type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-info";
        }

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3200);
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
