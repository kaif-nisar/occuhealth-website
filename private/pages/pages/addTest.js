(function () {
    const BASE_URL = window.BASE_URL || window.location.origin;

    let categoryList = [];
    let unitList = [];
    let parameterCounter = 0;

    // Elements
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
        await Promise.all([loadCategories(), loadUnits()]);

        // Add initial parameter row
        addParameterRow(true);
    }

    function setupTabs() {
        const tabBtns = document.querySelectorAll(".at-tab-btn");
        const tabContents = document.querySelectorAll(".at-tab-content");

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
        // Unit Modal
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

        // Sample Modal
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
                // Add to dropdown immediately
                const opt = document.createElement("option");
                opt.value = sampleVal;
                opt.textContent = sampleVal;
                opt.selected = true;
                sampleTypeSelect.appendChild(opt);

                sampleModal.style.display = "none";
                showToast("Sample type added", "success");

                // Background sync
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
                    this.classList.add("at-input-error");
                } else {
                    if (nameError) nameError.style.display = "none";
                    this.classList.remove("at-input-error");
                }

                // Sync first parameter name if it was empty or matched previous value
                const firstParamInput = paramsTbody.querySelector("tr:first-child .at-param-name");
                if (firstParamInput && (!firstParamInput.value || firstParamInput.dataset.synced === "true")) {
                    firstParamInput.value = this.value;
                    firstParamInput.dataset.synced = "true";
                }
            });
        }

        if (addParamBtn) {
            addParamBtn.addEventListener("click", () => {
                addParameterRow(false);
            });
        }

        if (saveTestBtn) {
            saveTestBtn.addEventListener("click", submitTest);
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
            categorySelect.innerHTML = '<option value="" disabled selected>General</option>';
        }
    }

    async function loadUnits(selectedUnit = "") {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/get-units-tenant`);
            const data = await res.json();
            unitList = data.units || [];

            // Update all unit selects in the table
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

    function addParameterRow(isFirstRow = false) {
        parameterCounter++;
        const row = document.createElement("tr");
        row.className = "at-param-row";

        const orderVal = paramsTbody.querySelectorAll("tr").length + 1;

        row.innerHTML = `
            <td style="text-align:center;">
                <button type="button" class="at-param-del-btn" title="Delete parameter" ${isFirstRow ? 'disabled style="visibility:hidden;"' : ''}>
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
            <td>
                <input type="number" class="at-input at-param-order" value="${orderVal}" style="padding:6px; font-weight:600; text-align:center;">
            </td>
            <td>
                <input type="text" class="at-input at-param-name" placeholder="Parameter Name" value="${isFirstRow ? (testNameInput.value || '') : ''}">
                <div class="at-alias-box">
                    <div class="at-alias-header">
                        <span>Machine Short Names</span>
                        <button type="button" class="at-alias-add-btn" title="Add machine code alias">+</button>
                    </div>
                    <div class="at-alias-list"></div>
                </div>
            </td>
            <td>
                <select class="at-select at-unit-select" style="padding:6px;">
                    <option value="">-- Unit --</option>
                    ${unitList.map(u => `<option value="${escapeHtml(u.unit || u)}">${escapeHtml(u.unit || u)}</option>`).join('')}
                </select>
            </td>
            <td>
                <input type="text" class="at-input at-param-default" placeholder="Default value" style="padding:6px;">
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="font-size:0.75rem; font-weight:600; color:#64748b;">Type:</span>
                    <select class="at-select at-type-select" style="padding:4px 8px; width:auto; font-size:0.8rem;">
                        <option value="numeric" selected>Numeric</option>
                        <option value="text">Textual</option>
                    </select>
                </div>

                <!-- Numeric Range Builder -->
                <div class="at-numeric-section">
                    <div class="at-ranges-container">
                        <!-- Default normal range row -->
                        <div class="at-range-row">
                            <button type="button" class="at-range-del" title="Remove range"><i class="fa-solid fa-circle-xmark"></i></button>
                            <div class="at-range-field">
                                <span>Sex</span>
                                <select class="sex" style="padding:4px;">
                                    <option value="Any" selected>Any</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div class="at-range-field">
                                <span>Min Age</span>
                                <div style="display:flex; gap:2px;">
                                    <input type="number" class="min-age" value="0" style="width:45px;">
                                    <select name="min_age_unit">
                                        <option value="Years" selected>Y</option>
                                        <option value="Months">M</option>
                                        <option value="Days">D</option>
                                    </select>
                                </div>
                            </div>
                            <div class="at-range-field">
                                <span>Max Age</span>
                                <div style="display:flex; gap:2px;">
                                    <input type="number" class="max-age" value="100" style="width:45px;">
                                    <select name="max_age_unit">
                                        <option value="Years" selected>Y</option>
                                        <option value="Months">M</option>
                                        <option value="Days">D</option>
                                    </select>
                                </div>
                            </div>
                            <div class="at-range-field">
                                <span>Lower</span>
                                <input type="number" step="0.01" class="lower-value" placeholder="Low" style="width:60px;">
                            </div>
                            <div class="at-range-field">
                                <span>Upper</span>
                                <input type="number" step="0.01" class="upper-value" placeholder="High" style="width:60px;">
                            </div>
                        </div>
                    </div>
                    <button type="button" class="at-add-range-btn">
                        <i class="fa-solid fa-plus"></i> Add Range
                    </button>

                    <!-- Random Simulation Option -->
                    <div class="at-random-box">
                        <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                            <input type="checkbox" class="random-checkbox">
                            <span>Enable simulated normal range</span>
                        </label>
                        <div class="random-inputs" style="display:none; margin-top:6px; gap:8px;">
                            <input type="number" step="0.01" class="at-input lower-range" placeholder="Sim Lower" style="padding:3px 6px; font-size:0.75rem;">
                            <input type="number" step="0.01" class="at-input upper-range" placeholder="Sim Upper" style="padding:3px 6px; font-size:0.75rem;">
                        </div>
                    </div>
                </div>

                <!-- Textual Section -->
                <div class="at-textual-section" style="display: none;">
                    <textarea class="at-textarea at-text-normal" placeholder="Enter standard expected text or normal narrative description..." style="min-height:60px; font-size:0.8rem;"></textarea>
                </div>
            </td>
        `;

        // Del Parameter Row
        const delBtn = row.querySelector(".at-param-del-btn");
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                row.remove();
                reindexParameterOrders();
            });
        }

        // Type select toggle
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

        // Add Range button
        const addRangeBtn = row.querySelector(".at-add-range-btn");
        const rangesContainer = row.querySelector(".at-ranges-container");
        addRangeBtn.addEventListener("click", () => {
            const rangeRow = document.createElement("div");
            rangeRow.className = "at-range-row";
            rangeRow.innerHTML = `
                <button type="button" class="at-range-del" title="Remove range"><i class="fa-solid fa-circle-xmark"></i></button>
                <div class="at-range-field">
                    <span>Sex</span>
                    <select class="sex" style="padding:4px;">
                        <option value="Any" selected>Any</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </div>
                <div class="at-range-field">
                    <span>Min Age</span>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="min-age" value="0" style="width:45px;">
                        <select name="min_age_unit">
                            <option value="Years" selected>Y</option>
                            <option value="Months">M</option>
                            <option value="Days">D</option>
                        </select>
                    </div>
                </div>
                <div class="at-range-field">
                    <span>Max Age</span>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="max-age" value="100" style="width:45px;">
                        <select name="max_age_unit">
                            <option value="Years" selected>Y</option>
                            <option value="Months">M</option>
                            <option value="Days">D</option>
                        </select>
                    </div>
                </div>
                <div class="at-range-field">
                    <span>Lower</span>
                    <input type="number" step="0.01" class="lower-value" placeholder="Low" style="width:60px;">
                </div>
                <div class="at-range-field">
                    <span>Upper</span>
                    <input type="number" step="0.01" class="upper-value" placeholder="High" style="width:60px;">
                </div>
            `;
            rangeRow.querySelector(".at-range-del").addEventListener("click", () => rangeRow.remove());
            rangesContainer.appendChild(rangeRow);
        });

        // First range delete button listener
        row.querySelector(".at-range-del").addEventListener("click", function () {
            if (rangesContainer.children.length > 1) {
                this.closest(".at-range-row").remove();
            }
        });

        // Random checkbox toggle
        const randomCb = row.querySelector(".random-checkbox");
        const randomInputs = row.querySelector(".random-inputs");
        randomCb.addEventListener("change", () => {
            randomInputs.style.display = randomCb.checked ? "flex" : "none";
        });

        // Alias manager
        const aliasList = row.querySelector(".at-alias-list");
        const addAliasBtn = row.querySelector(".at-alias-add-btn");
        addAliasBtn.addEventListener("click", () => {
            const aliasRow = document.createElement("div");
            aliasRow.className = "at-alias-row";
            aliasRow.innerHTML = `
                <input type="text" class="at-alias-input" placeholder="Alias code">
                <label style="font-size:0.7rem; display:flex; align-items:center; gap:2px; cursor:pointer;">
                    <input type="radio" name="param-default-alias-${parameterCounter}" class="at-alias-default">
                    Def
                </label>
                <button type="button" class="at-alias-remove">&times;</button>
            `;
            aliasRow.querySelector(".at-alias-remove").addEventListener("click", () => aliasRow.remove());
            aliasList.appendChild(aliasRow);
            aliasRow.querySelector(".at-alias-input").focus();
        });

        paramsTbody.appendChild(row);
    }

    function reindexParameterOrders() {
        const rows = paramsTbody.querySelectorAll(".at-param-row");
        rows.forEach((r, idx) => {
            const orderInput = r.querySelector(".at-param-order");
            if (orderInput) orderInput.value = idx + 1;
        });
    }

    async function submitTest() {
        const nameVal = testNameInput.value.trim();
        const shortVal = shortNameInput.value.trim();
        const categoryVal = categorySelect.value;
        const billingVal = parseFloat(billingPriceInput.value);
        const mrpVal = parseFloat(mrpPriceInput.value);
        const sampleVal = sampleTypeSelect.value;
        const tatVal = tatInput.value.trim();
        const methodVal = methodInput.value.trim();
        const instrumentVal = instrumentInput.value.trim();

        // Validation
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
            r.querySelectorAll(".at-alias-row").forEach((aRow) => {
                const aInput = aRow.querySelector(".at-alias-input");
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

            // Range / Text
            if (type === "text") {
                paramObj.text = r.querySelector(".at-text-normal").value.trim();
                paramObj.NormalValue = [];
            } else {
                const normalRanges = [];
                r.querySelectorAll(".at-range-row").forEach((rng) => {
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

                // Random
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
        saveTestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/make-test-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast("Test created successfully!", "success");
                setTimeout(() => {
                    if (typeof window.loadPage === "function") {
                        window.loadPage("test");
                    } else {
                        window.location.href = "?page=test";
                    }
                }, 1200);
            } else {
                showToast(data.message || "Failed to create test", "error");
                saveTestBtn.disabled = false;
                saveTestBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Test';
            }
        } catch (err) {
            console.error("Submission error:", err);
            showToast("Network error: " + err.message, "error");
            saveTestBtn.disabled = false;
            saveTestBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Test';
        }
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("atToast");
        const toastMsg = document.getElementById("atToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `at-toast ${type} show`;

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
