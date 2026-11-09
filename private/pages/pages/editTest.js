(function () {
    const BASE_URL = window.BASE_URL || window.location.origin;

    let categoryList = [];
    let unitList = [];
    let parameterCounter = 0;
    let targetTestId = null;

    // Elements
    const loadingOverlay = document.getElementById("etLoadingOverlay");
    const headerTestName = document.getElementById("headerTestName");
    const headerTestMeta = document.getElementById("headerTestMeta");
    const testNameInput = document.getElementById("testName");
    const shortNameInput = document.getElementById("shortName");
    const categorySelect = document.getElementById("categorySelect");
    const tatInput = document.getElementById("tatInput");
    const billingPriceInput = document.getElementById("billingPrice");
    const mrpPriceInput = document.getElementById("mrpPrice");
    const sampleTypeSelect = document.getElementById("sampleTypeSelect");
    const methodInput = document.getElementById("methodInput");
    const instrumentInput = document.getElementById("instrumentInput");
    const paramsTbody = document.getElementById("paramsTbody");
    const addParamBtn = document.getElementById("addParamBtn");
    const saveTestBtn = document.getElementById("saveTestBtn");
    const nameError = document.getElementById("nameError");

    // Unit Modal Elements
    const unitModal = document.getElementById("unitModal");
    const openAddUnitModalBtn = document.getElementById("openAddUnitModal");
    const closeUnitModalBtn = document.getElementById("closeUnitModal");
    const cancelUnitBtn = document.getElementById("cancelUnitBtn");
    const saveUnitBtn = document.getElementById("saveUnitBtn");
    const newUnitNameInput = document.getElementById("newUnitName");

    // Sample Modal Elements
    const sampleModal = document.getElementById("sampleModal");
    const openAddSampleModalBtn = document.getElementById("openAddSampleModal");
    const closeSampleModalBtn = document.getElementById("closeSampleModal");
    const cancelSampleBtn = document.getElementById("cancelSampleBtn");
    const saveSampleBtn = document.getElementById("saveSampleBtn");
    const newSampleNameInput = document.getElementById("newSampleName");

    init();

    async function init() {
        setupTabs();
        setupModals();
        bindEvents();
        extractTargetId();

        if (!targetTestId) {
            showToast("No test ID provided in URL", "error");
            if (loadingOverlay) loadingOverlay.innerHTML = '<div style="color:#ef4444; font-weight:600;">Invalid Test ID. <a onclick="loadPage(\'test\')" style="text-decoration:underline; cursor:pointer;">Return to Catalog</a></div>';
            return;
        }

        await Promise.all([loadCategories(), loadUnits()]);
        await fetchTestDetails();
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

        targetTestId = id;
    }

    function setupTabs() {
        const tabBtns = document.querySelectorAll(".et-tab-btn");
        const tabContents = document.querySelectorAll(".et-tab-content");

        tabBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetTabId = btn.getAttribute("data-tab");
                tabBtns.forEach((b) => b.classList.remove("active"));
                tabContents.forEach((c) => c.classList.remove("active"));

                btn.classList.add("active");
                const targetContent = document.getElementById(targetTabId);
                if (targetContent) targetContent.classList.add("active");
            });
        });
    }

    function setupModals() {
        if (openAddUnitModalBtn) {
            openAddUnitModalBtn.addEventListener("click", () => {
                newUnitNameInput.value = "";
                unitModal.style.display = "flex";
                newUnitNameInput.focus();
            });
        }
        if (closeUnitModalBtn) closeUnitModalBtn.addEventListener("click", () => unitModal.style.display = "none");
        if (cancelUnitBtn) cancelUnitBtn.addEventListener("click", () => unitModal.style.display = "none");

        if (saveUnitBtn) {
            saveUnitBtn.addEventListener("click", async () => {
                const unitVal = newUnitNameInput.value.trim();
                if (!unitVal) return;
                try {
                    const res = await fetch(`${BASE_URL}/api/v1/user/add-unit-tenant`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ unit: unitVal })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        unitModal.style.display = "none";
                        showToast("Unit added successfully", "success");
                        await loadUnits(unitVal);
                    } else {
                        showToast(data.message || "Failed to add unit", "error");
                    }
                } catch (e) {
                    showToast("Error adding unit: " + e.message, "error");
                }
            });
        }

        if (openAddSampleModalBtn) {
            openAddSampleModalBtn.addEventListener("click", () => {
                newSampleNameInput.value = "";
                sampleModal.style.display = "flex";
                newSampleNameInput.focus();
            });
        }
        if (closeSampleModalBtn) closeSampleModalBtn.addEventListener("click", () => sampleModal.style.display = "none");
        if (cancelSampleBtn) cancelSampleBtn.addEventListener("click", () => sampleModal.style.display = "none");

        if (saveSampleBtn) {
            saveSampleBtn.addEventListener("click", async () => {
                const sampleVal = newSampleNameInput.value.trim();
                if (!sampleVal) return;
                const opt = document.createElement("option");
                opt.value = sampleVal;
                opt.textContent = sampleVal;
                opt.selected = true;
                sampleTypeSelect.appendChild(opt);

                sampleModal.style.display = "none";
                showToast("Sample type added", "success");

                fetch(`${BASE_URL}/api/v1/user/add-sample-tenant`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sample: sampleVal })
                }).catch(() => {});
            });
        }
    }

    function bindEvents() {
        if (testNameInput) {
            testNameInput.addEventListener("input", function () {
                if (this.value.includes(",")) {
                    if (nameError) nameError.style.display = "block";
                    this.classList.add("et-input-error");
                } else {
                    if (nameError) nameError.style.display = "none";
                    this.classList.remove("et-input-error");
                }
            });
        }

        if (addParamBtn) {
            addParamBtn.addEventListener("click", () => {
                addParameterRow(null, false);
            });
        }

        if (saveTestBtn) {
            saveTestBtn.addEventListener("click", submitTestUpdate);
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

    async function loadUnits(selectedUnit = "") {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/get-units-tenant`);
            const data = await res.json();
            unitList = data.units || [];

            const unitSelects = paramsTbody.querySelectorAll(".at-unit-select");
            unitSelects.forEach((sel) => {
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">-- Unit --</option>';
                unitList.forEach((u) => {
                    const uName = u.unit || u;
                    const opt = document.createElement("option");
                    opt.value = uName;
                    opt.textContent = uName;
                    sel.appendChild(opt);
                });
                if (selectedUnit) sel.value = selectedUnit;
                else if (currentVal) sel.value = currentVal;
            });
        } catch (e) {
            console.error("Failed to load units:", e);
        }
    }

    async function fetchTestDetails() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/test-found?Name=${encodeURIComponent(targetTestId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: Test not found`);

            const json = await res.json();
            const data = json.data || json;

            populateFormData(data);

            if (loadingOverlay) loadingOverlay.style.display = "none";
        } catch (err) {
            console.error("Error fetching test details:", err);
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div style="color:#ef4444; font-weight:600; font-size:1.1rem; margin-bottom:8px;">Failed to load test</div>
                    <div style="color:#64748b; font-size:0.85rem; margin-bottom:14px;">${escapeHtml(err.message)}</div>
                    <button type="button" class="et-btn et-btn-outline" onclick="loadPage('test')"><i class="fa-solid fa-arrow-left"></i> Back to Catalog</button>
                `;
            }
        }
    }

    function populateFormData(test) {
        if (!test) return;

        if (headerTestName) headerTestName.textContent = `Edit: ${test.Name || 'Test'}`;
        if (headerTestMeta) headerTestMeta.textContent = `Short Code: ${test.Short_name || 'N/A'} • ID: ${test._id}`;

        testNameInput.value = test.Name || "";
        shortNameInput.value = test.Short_name || "";
        tatInput.value = test.tat || "";
        billingPriceInput.value = test.Price != null ? test.Price : "";
        mrpPriceInput.value = test.final_price != null ? test.final_price : "";
        methodInput.value = test.method || "";
        instrumentInput.value = test.instrument || "";

        // Category
        const catName = test.category?.category || (typeof test.category === "string" ? test.category : "");
        if (catName) {
            let exists = Array.from(categorySelect.options).some(o => o.value === catName);
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = catName;
                opt.textContent = catName;
                categorySelect.appendChild(opt);
            }
            categorySelect.value = catName;
        }

        // Sample Type
        if (test.sampleType) {
            let exists = Array.from(sampleTypeSelect.options).some(o => o.value === test.sampleType);
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = test.sampleType;
                opt.textContent = test.sampleType;
                sampleTypeSelect.appendChild(opt);
            }
            sampleTypeSelect.value = test.sampleType;
        }

        // Parameters
        paramsTbody.innerHTML = "";
        if (Array.isArray(test.parameters) && test.parameters.length > 0) {
            test.parameters.forEach((param, index) => {
                addParameterRow(param, index === 0);
            });
        } else {
            addParameterRow({ Para_name: test.Name, order: 1 }, true);
        }

        // Interpretation
        const interp = test.interpretation || "";
        const fallbackTextarea = document.getElementById("fallbackInterpretation");
        if (fallbackTextarea) fallbackTextarea.value = interp;

        // Try setting to CKEditor if ready, else poll briefly
        if (window.editor && typeof window.editor.setData === "function") {
            try { window.editor.setData(interp); } catch (e) {}
        } else {
            let attempts = 0;
            const editorCheck = setInterval(() => {
                attempts++;
                if (window.editor && typeof window.editor.setData === "function") {
                    try { window.editor.setData(interp); } catch (e) {}
                    clearInterval(editorCheck);
                } else if (attempts > 20) {
                    clearInterval(editorCheck);
                }
            }, 250);
        }
    }

    function addParameterRow(param = null, isFirstRow = false) {
        parameterCounter++;
        const row = document.createElement("tr");
        row.className = "at-param-row";

        const orderVal = param?.order || (paramsTbody.querySelectorAll("tr").length + 1);
        const nameVal = param?.Para_name || (isFirstRow ? testNameInput.value : "");
        const unitVal = param?.unit || "";
        const defaultVal = param?.defaultresult || "";
        const typeVal = param?.ValueType === "text" ? "text" : "numeric";

        row.innerHTML = `
            <td style="text-align:center;">
                <button type="button" class="at-param-del-btn" title="Delete parameter" ${isFirstRow ? 'disabled style="visibility:hidden;"' : ''}>
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
            <td>
                <input type="number" class="et-input at-param-order" value="${orderVal}" style="padding:6px; font-weight:600; text-align:center;">
            </td>
            <td>
                <input type="text" class="et-input at-param-name" placeholder="Parameter Name" value="${escapeHtml(nameVal)}">
                <div class="et-alias-box">
                    <div class="et-alias-header">
                        <span>Machine Short Names</span>
                        <button type="button" class="et-alias-add-btn" title="Add machine code alias">+</button>
                    </div>
                    <div class="et-alias-list"></div>
                </div>
            </td>
            <td>
                <select class="et-select at-unit-select" style="padding:6px;">
                    <option value="">-- Unit --</option>
                    ${unitList.map(u => {
                        const val = u.unit || u;
                        return `<option value="${escapeHtml(val)}" ${val === unitVal ? 'selected' : ''}>${escapeHtml(val)}</option>`;
                    }).join('')}
                </select>
            </td>
            <td>
                <input type="text" class="et-input at-param-default" placeholder="Default value" value="${escapeHtml(defaultVal)}" style="padding:6px;">
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="font-size:0.75rem; font-weight:600; color:#64748b;">Type:</span>
                    <select class="et-select at-type-select" style="padding:4px 8px; width:auto; font-size:0.8rem;">
                        <option value="numeric" ${typeVal === 'numeric' ? 'selected' : ''}>Numeric</option>
                        <option value="text" ${typeVal === 'text' ? 'selected' : ''}>Textual</option>
                    </select>
                </div>

                <!-- Numeric Range Builder -->
                <div class="at-numeric-section" style="display:${typeVal === 'numeric' ? 'block' : 'none'};">
                    <div class="at-ranges-container"></div>
                    <button type="button" class="et-add-range-btn">
                        <i class="fa-solid fa-plus"></i> Add Range
                    </button>

                    <!-- Random Simulation Option -->
                    <div class="et-random-box">
                        <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                            <input type="checkbox" class="random-checkbox" ${param?.forRandom ? 'checked' : ''}>
                            <span>Enable simulated normal range</span>
                        </label>
                        <div class="random-inputs" style="display:${param?.forRandom ? 'flex' : 'none'}; margin-top:6px; gap:8px;">
                            <input type="number" step="0.01" class="et-input lower-range" placeholder="Sim Lower" value="${param?.lowerRange ?? ''}" style="padding:3px 6px; font-size:0.75rem;">
                            <input type="number" step="0.01" class="et-input upper-range" placeholder="Sim Upper" value="${param?.upperRange ?? ''}" style="padding:3px 6px; font-size:0.75rem;">
                        </div>
                    </div>
                </div>

                <!-- Textual Section -->
                <div class="at-textual-section" style="display:${typeVal === 'text' ? 'block' : 'none'};">
                    <textarea class="et-textarea at-text-normal" placeholder="Enter standard expected text or normal narrative description..." style="min-height:60px; font-size:0.8rem;">${escapeHtml(param?.text || '')}</textarea>
                </div>
            </td>
        `;

        // Prepopulate aliases
        const aliasList = row.querySelector(".et-alias-list");
        const addAliasBtn = row.querySelector(".et-alias-add-btn");
        const aliases = Array.isArray(param?.shortNames) ? param.shortNames : [];
        const defaultAlias = param?.defaultShortName || aliases[0] || "";

        function renderAliasItem(val = "", isDefault = false) {
            const aliasRow = document.createElement("div");
            aliasRow.className = "et-alias-row";
            aliasRow.innerHTML = `
                <input type="text" class="et-alias-input" placeholder="Alias code" value="${escapeHtml(val)}">
                <label style="font-size:0.7rem; display:flex; align-items:center; gap:2px; cursor:pointer;">
                    <input type="radio" name="param-default-alias-${parameterCounter}" class="at-alias-default" ${isDefault ? 'checked' : ''}>
                    Def
                </label>
                <button type="button" class="et-alias-remove">&times;</button>
            `;
            aliasRow.querySelector(".et-alias-remove").addEventListener("click", () => aliasRow.remove());
            aliasList.appendChild(aliasRow);
        }

        aliases.forEach((a) => renderAliasItem(a, a === defaultAlias));

        addAliasBtn.addEventListener("click", () => {
            renderAliasItem("", aliasList.children.length === 0);
            const lastInput = aliasList.querySelector(".et-alias-row:last-child .et-alias-input");
            if (lastInput) lastInput.focus();
        });

        // Prepopulate normal ranges
        const rangesContainer = row.querySelector(".at-ranges-container");
        const addRangeBtn = row.querySelector(".et-add-range-btn");

        function renderRangeRow(rng = null) {
            const rangeRow = document.createElement("div");
            rangeRow.className = "et-range-row";
            rangeRow.innerHTML = `
                <button type="button" class="et-range-del" title="Remove range"><i class="fa-solid fa-circle-xmark"></i></button>
                <div class="et-range-field">
                    <span>Sex</span>
                    <select class="sex" style="padding:4px;">
                        <option value="Any" ${(!rng || rng.gender === 'Any') ? 'selected' : ''}>Any</option>
                        <option value="Male" ${(rng && rng.gender === 'Male') ? 'selected' : ''}>Male</option>
                        <option value="Female" ${(rng && rng.gender === 'Female') ? 'selected' : ''}>Female</option>
                    </select>
                </div>
                <div class="et-range-field">
                    <span>Min Age</span>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="min-age" value="${rng?.minAge ?? 0}" style="width:45px;">
                        <select name="min_age_unit">
                            <option value="Years" ${(!rng || rng.minAgeUnit === 'Years') ? 'selected' : ''}>Y</option>
                            <option value="Months" ${(rng && rng.minAgeUnit === 'Months') ? 'selected' : ''}>M</option>
                            <option value="Days" ${(rng && rng.minAgeUnit === 'Days') ? 'selected' : ''}>D</option>
                        </select>
                    </div>
                </div>
                <div class="et-range-field">
                    <span>Max Age</span>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="max-age" value="${rng?.maxAge ?? 100}" style="width:45px;">
                        <select name="max_age_unit">
                            <option value="Years" ${(!rng || rng.maxAgeUnit === 'Years') ? 'selected' : ''}>Y</option>
                            <option value="Months" ${(rng && rng.maxAgeUnit === 'Months') ? 'selected' : ''}>M</option>
                            <option value="Days" ${(rng && rng.maxAgeUnit === 'Days') ? 'selected' : ''}>D</option>
                        </select>
                    </div>
                </div>
                <div class="et-range-field">
                    <span>Lower</span>
                    <input type="number" step="0.01" class="lower-value" placeholder="Low" value="${rng?.lowerValue ?? ''}" style="width:60px;">
                </div>
                <div class="et-range-field">
                    <span>Upper</span>
                    <input type="number" step="0.01" class="upper-value" placeholder="High" value="${rng?.upperValue ?? ''}" style="width:60px;">
                </div>
            `;
            rangeRow.querySelector(".et-range-del").addEventListener("click", () => {
                if (rangesContainer.children.length > 1) {
                    rangeRow.remove();
                }
            });
            rangesContainer.appendChild(rangeRow);
        }

        if (Array.isArray(param?.NormalValue) && param.NormalValue.length > 0) {
            param.NormalValue.forEach(r => renderRangeRow(r));
        } else {
            renderRangeRow();
        }

        addRangeBtn.addEventListener("click", () => renderRangeRow());

        // Type toggle
        const typeSelect = row.querySelector(".at-type-select");
        const numericSec = row.querySelector(".at-numeric-section");
        const textSec = row.querySelector(".at-textual-section");
        typeSelect.addEventListener("change", (e) => {
            if (e.target.value === "text") {
                numericSec.style.display = "none";
                textSec.style.display = "block";
            } else {
                numericSec.style.display = "block";
                textSec.style.display = "none";
            }
        });

        // Random toggle
        const randomCb = row.querySelector(".random-checkbox");
        const randomInputs = row.querySelector(".random-inputs");
        randomCb.addEventListener("change", () => {
            randomInputs.style.display = randomCb.checked ? "flex" : "none";
        });

        // Del parameter
        const delBtn = row.querySelector(".at-param-del-btn");
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                row.remove();
                reindexParameterOrders();
            });
        }

        paramsTbody.appendChild(row);
    }

    function reindexParameterOrders() {
        const rows = paramsTbody.querySelectorAll(".at-param-row");
        rows.forEach((r, idx) => {
            const orderInput = r.querySelector(".at-param-order");
            if (orderInput) orderInput.value = idx + 1;
        });
    }

    async function submitTestUpdate() {
        const nameVal = testNameInput.value.trim();
        const shortVal = shortNameInput.value.trim();
        const categoryVal = categorySelect.value;
        const billingVal = parseFloat(billingPriceInput.value);
        const mrpVal = parseFloat(mrpPriceInput.value);
        const sampleVal = sampleTypeSelect.value;
        const tatVal = tatInput.value.trim();
        const methodVal = methodInput.value.trim();
        const instrumentVal = instrumentInput.value.trim();

        if (!nameVal) {
            showToast("Test name is required", "error");
            document.querySelector('[data-tab="tab-general"]').click();
            testNameInput.focus();
            return;
        }

        if (nameVal.includes(",")) {
            showToast("Comma (,) is not allowed in test name", "error");
            document.querySelector('[data-tab="tab-general"]').click();
            testNameInput.focus();
            return;
        }

        if (!categoryVal) {
            showToast("Please select a Category", "error");
            document.querySelector('[data-tab="tab-general"]').click();
            categorySelect.focus();
            return;
        }

        if (isNaN(billingVal) || isNaN(mrpVal)) {
            showToast("Please specify Billing and MRP Price", "error");
            document.querySelector('[data-tab="tab-general"]').click();
            billingPriceInput.focus();
            return;
        }

        // Collect Parameters
        const paramRows = paramsTbody.querySelectorAll(".at-param-row");
        const parameters = [];

        paramRows.forEach((r, idx) => {
            const order = parseInt(r.querySelector(".at-param-order").value, 10) || (idx + 1);
            const paraName = r.querySelector(".at-param-name").value.trim() || nameVal;
            const unit = r.querySelector(".at-unit-select").value.trim();
            const defaultresult = r.querySelector(".at-param-default").value.trim();
            const type = r.querySelector(".at-type-select").value;

            // Collect Aliases
            const aliases = [];
            let defaultAlias = "";
            r.querySelectorAll(".et-alias-row").forEach((aRow) => {
                const aInput = aRow.querySelector(".et-alias-input");
                const aRadio = aRow.querySelector(".at-alias-default");
                const val = (aInput?.value || "").trim();
                if (val && !aliases.includes(val)) {
                    aliases.push(val);
                    if (aRadio?.checked) defaultAlias = val;
                }
            });
            if (!defaultAlias && aliases.length > 0) defaultAlias = aliases[0];

            const paramObj = {
                order,
                Para_name: paraName,
                unit,
                defaultresult,
                ValueType: type,
                shortNames: aliases,
                defaultShortName: defaultAlias
            };

            if (type === "text") {
                paramObj.text = r.querySelector(".at-text-normal").value.trim();
                paramObj.NormalValue = [];
            } else {
                const normalRanges = [];
                r.querySelectorAll(".et-range-row").forEach((rng) => {
                    normalRanges.push({
                        gender: rng.querySelector(".sex").value,
                        minAge: rng.querySelector(".min-age").value,
                        minAgeUnit: rng.querySelector('[name="min_age_unit"]').value,
                        maxAge: rng.querySelector(".max-age").value,
                        maxAgeUnit: rng.querySelector('[name="max_age_unit"]').value,
                        lowerValue: rng.querySelector(".lower-value").value,
                        upperValue: rng.querySelector(".upper-value").value
                    });
                });
                paramObj.NormalValue = normalRanges;

                const randomCb = r.querySelector(".random-checkbox");
                if (randomCb && randomCb.checked) {
                    paramObj.forRandom = true;
                    paramObj.lowerRange = parseFloat(r.querySelector(".lower-range").value) || 0;
                    paramObj.upperRange = parseFloat(r.querySelector(".upper-range").value) || 0;
                }
            }

            parameters.push(paramObj);
        });

        // Interpretation
        let interpretationText = "";
        if (window.editor && typeof window.editor.getData === "function") {
            interpretationText = window.editor.getData();
        } else {
            const fallback = document.getElementById("fallbackInterpretation");
            interpretationText = fallback ? fallback.value : "";
        }

        const categoryObj = categoryList.find(c => (c.category || c) === categoryVal) || { category: categoryVal };

        const payload = {
            _id: targetTestId,
            Name: nameVal,
            Short_name: shortVal,
            category: categoryObj,
            Price: billingVal,
            final_price: mrpVal,
            sampleType: sampleVal,
            tat: tatVal,
            method: methodVal,
            instrument: instrumentVal,
            interpretation: interpretationText,
            parameters
        };

        saveTestBtn.disabled = true;
        saveTestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/test-edit-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && (data.status === "success" || data.success || !data.message?.includes("wrong"))) {
                showToast("Test updated successfully!", "success");
                setTimeout(() => {
                    if (typeof window.loadPage === "function") {
                        window.loadPage("test");
                    } else {
                        window.location.href = "?page=test";
                    }
                }, 1200);
            } else {
                showToast(data.message || "Failed to update test", "error");
                saveTestBtn.disabled = false;
                saveTestBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Test';
            }
        } catch (err) {
            console.error("Update error:", err);
            showToast("Network error: " + err.message, "error");
            saveTestBtn.disabled = false;
            saveTestBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Test';
        }
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("etToast");
        const toastMsg = document.getElementById("etToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `et-toast ${type} show`;

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
