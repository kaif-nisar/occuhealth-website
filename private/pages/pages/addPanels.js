(function () {
    const BASE_URL = window.BASE_URL || window.location.origin;

    let availableTests = [];
    let selectedTestsMap = new Map(); // testId -> { id, name, sampleType, price }
    let categoryList = [];

    // DOM Elements
    const panelNameInput = document.getElementById("panelName");
    const shortNameInput = document.getElementById("shortName");
    const categorySelect = document.getElementById("categorySelect");
    const billingPriceInput = document.getElementById("billingPrice");
    const mrpPriceInput = document.getElementById("mrpPrice");
    const selectedTestsContainer = document.getElementById("selectedTestsContainer");
    const emptyTagsHint = document.getElementById("emptyTagsHint");
    const testSearchInput = document.getElementById("testSearchInput");
    const testSearchDropdown = document.getElementById("testSearchDropdown");
    const priceHelperCard = document.getElementById("priceHelperCard");
    const standaloneTotalVal = document.getElementById("standaloneTotalVal");
    const selectedCountVal = document.getElementById("selectedCountVal");
    const sampleTypesSummary = document.getElementById("sampleTypesSummary");
    const hideInterpretationCb = document.getElementById("hideInterpretation");
    const hideMethodInstrumentCb = document.getElementById("hideMethodInstrument");
    const savePanelBtn = document.getElementById("savePanelBtn");
    const nameError = document.getElementById("nameError");

    init();

    async function init() {
        bindEvents();
        await Promise.all([loadCategories(), loadTests()]);
    }

    function bindEvents() {
        if (panelNameInput) {
            panelNameInput.addEventListener("input", function () {
                if (this.value.includes(",")) {
                    if (nameError) nameError.style.display = "block";
                    this.classList.add("ap-input-error");
                } else {
                    if (nameError) nameError.style.display = "none";
                    this.classList.remove("ap-input-error");
                }
            });
        }

        // Test search autocomplete
        if (testSearchInput) {
            testSearchInput.addEventListener("input", filterTestDropdown);
            testSearchInput.addEventListener("focus", filterTestDropdown);

            document.addEventListener("click", (e) => {
                if (!testSearchInput.contains(e.target) && !testSearchDropdown.contains(e.target)) {
                    testSearchDropdown.style.display = "none";
                }
            });
        }

        if (savePanelBtn) {
            savePanelBtn.addEventListener("click", submitPanel);
        }
    }

    async function loadCategories() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/category-list-tenant`);
            const data = await res.json();
            categoryList = data.categories || data.data || [];

            categorySelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
            categoryList.forEach((cat) => {
                const val = cat.category || cat;
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = val;
                categorySelect.appendChild(opt);
            });
        } catch (e) {
            console.error("Failed to load categories:", e);
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

    function filterTestDropdown() {
        const query = (testSearchInput.value || "").trim().toLowerCase();
        testSearchDropdown.innerHTML = "";

        const matches = availableTests.filter((t) => {
            if (selectedTestsMap.has(t._id)) return false; // already selected
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
            emptyEl.textContent = query ? "No matching tests found" : "All available tests selected";
            testSearchDropdown.appendChild(emptyEl);
        } else {
            matches.slice(0, 30).forEach((t) => {
                const item = document.createElement("div");
                item.className = "ap-dropdown-item";
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

        // Check sample type harmony
        const currentSamples = new Set(Array.from(selectedTestsMap.values()).map(t => t.sampleType).filter(Boolean));
        if (currentSamples.size > 0 && test.sampleType && !currentSamples.has(test.sampleType)) {
            showToast(`Note: Added test requires "${test.sampleType}", which differs from current selections.`, "info");
        }

        selectedTestsMap.set(test._id, {
            id: test._id,
            name: test.Name,
            sampleType: test.sampleType || "N/A",
            price: parseFloat(test.Price) || 0
        });

        renderSelectedTags();
    }

    function deselectTest(testId) {
        selectedTestsMap.delete(testId);
        renderSelectedTags();
    }

    function renderSelectedTags() {
        selectedTestsContainer.innerHTML = "";

        if (selectedTestsMap.size === 0) {
            selectedTestsContainer.appendChild(emptyTagsHint);
            if (priceHelperCard) priceHelperCard.style.display = "none";
            return;
        }

        let totalStandalonePrice = 0;
        const sampleSet = new Set();

        selectedTestsMap.forEach((test, id) => {
            totalStandalonePrice += test.price;
            if (test.sampleType) sampleSet.add(test.sampleType);

            const tag = document.createElement("div");
            tag.className = "ap-selected-tag";
            tag.innerHTML = `
                <span>${escapeHtml(test.name)}</span>
                <span class="sample-tag">${escapeHtml(test.sampleType)}</span>
                <span class="del-btn" title="Remove">&times;</span>
            `;

            tag.querySelector(".del-btn").addEventListener("click", () => deselectTest(id));
            selectedTestsContainer.appendChild(tag);
        });

        if (priceHelperCard) {
            priceHelperCard.style.display = "flex";
            standaloneTotalVal.textContent = `₹${totalStandalonePrice}`;
            selectedCountVal.textContent = selectedTestsMap.size;
            sampleTypesSummary.textContent = Array.from(sampleSet).join(", ") || "N/A";
        }
    }

    async function submitPanel() {
        const nameVal = panelNameInput.value.trim();
        const shortVal = shortNameInput.value.trim();
        const categoryVal = categorySelect.value;
        const billingVal = parseFloat(billingPriceInput.value);
        const mrpVal = parseFloat(mrpPriceInput.value);

        if (!nameVal) {
            showToast("Panel name is required", "error");
            panelNameInput.focus();
            return;
        }

        if (nameVal.includes(",")) {
            showToast("Comma (,) is not allowed in panel name", "error");
            panelNameInput.focus();
            return;
        }

        if (!categoryVal) {
            showToast("Please select a Category", "error");
            categorySelect.focus();
            return;
        }

        if (isNaN(billingVal) || isNaN(mrpVal)) {
            showToast("Please enter Billing Price and MRP Rate", "error");
            billingPriceInput.focus();
            return;
        }

        if (selectedTestsMap.size === 0) {
            showToast("Please select at least one test for this panel", "error");
            testSearchInput.focus();
            return;
        }

        const testsId = Array.from(selectedTestsMap.keys());
        const selectedTestNames = Array.from(selectedTestsMap.values()).map(t => t.name);
        const sampleTypes = [...new Set(Array.from(selectedTestsMap.values()).map(t => t.sampleType).filter(Boolean))];

        // Safe interpretation getter (no editor undefined crash!)
        let interpretationText = "";
        if (window.editor && typeof window.editor.getData === "function") {
            try { interpretationText = window.editor.getData(); } catch (e) {}
        }
        if (!interpretationText) {
            const fallback = document.getElementById("fallbackInterpretation");
            interpretationText = fallback ? fallback.value : "";
        }

        const categoryObj = categoryList.find(c => (c.category || c) === categoryVal) || { category: categoryVal };

        const payload = {
            pannelname: nameVal,
            Short_name: shortVal,
            price: billingVal,
            final_price: mrpVal,
            category: categoryObj,
            inputarray: selectedTestNames,
            testsId: testsId,
            interpretion: interpretationText,
            interpretation: interpretationText,
            sample_types: sampleTypes,
            hideInterpretation: hideInterpretationCb?.checked || false,
            hideMethodInstrument: hideMethodInstrumentCb?.checked || false
        };

        savePanelBtn.disabled = true;
        savePanelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/add-panels-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast("Panel created successfully!", "success");
                setTimeout(() => {
                    if (typeof window.loadPage === "function") {
                        window.loadPage("testPanels");
                    } else {
                        window.location.href = "?page=testPanels";
                    }
                }, 1200);
            } else {
                showToast(data.message || "Failed to create panel", "error");
                savePanelBtn.disabled = false;
                savePanelBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Panel';
            }
        } catch (err) {
            console.error("Submission error:", err);
            showToast("Network error: " + err.message, "error");
            savePanelBtn.disabled = false;
            savePanelBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Panel';
        }
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("apToast");
        const toastMsg = document.getElementById("apToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `ap-toast ${type} show`;

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
