// Global functions (outside async IIFE)
function toggleForm(selectElement) {
    const closestContainer = selectElement.closest('.normalValue');
    const formContainer = closestContainer.querySelector('#form-container');
    const textArea = closestContainer.querySelector('.text-area');
    const admorebtn = closestContainer.querySelector('.add-more-btn');

    if (selectElement.value === 'text') {
        formContainer.style.display = 'none';
        if (admorebtn) admorebtn.style.display = 'none';
        textArea.style.display = 'block';
    } else {
        formContainer.style.display = 'block';
        if (admorebtn) admorebtn.style.display = 'flex';
        textArea.style.display = 'none';
    }
}

function addRow(admore) {
    const formContainer = admore.parentElement.querySelector('#form-container');

    let newRow;
    if (formContainer.firstElementChild) {
        newRow = formContainer.firstElementChild.cloneNode(true);
    } else {
        newRow = document.createElement('div');
        newRow.className = 'row-container';
        newRow.innerHTML = `
            <span class="delete-btn" onclick="deleteRow(this)"><i class="fa-solid fa-eraser"></i></span>
            <div class="row-item">
                <label for="sex">Sex</label>
                <select name="sex" class="sex">
                    <option value="Any">Any</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                </select>
            </div>
            <div class="row-item">
                <label for="min_age">Min. Age</label>
                <div class="minAge">
                    <input type="number" name="min_age" placeholder="Min. age" class="min-age" value="0">
                    <select name="min_age_unit">
                        <option value="Years">Years</option>
                        <option value="Months">Months</option>
                        <option value="Days">Days</option>
                    </select>
                </div>
            </div>
            <div class="row-item">
                <label for="max_age">Max. Age</label>
                <div class="maxAge">
                    <input type="number" name="max_age" placeholder="Max. age" class="max-age" value="100">
                    <select name="max_age_unit">
                        <option value="Years">Years</option>
                        <option value="Months">Months</option>
                        <option value="Days">Days</option>
                    </select>
                </div>
            </div>
            <div class="row-item">
                <label for="lower_value">Lower</label>
                <input type="number" name="lower_value" placeholder="Lower value" class="lower-value" value="2.1">
            </div>
            <div class="row-item">
                <label for="upper_value">Upper</label>
                <input type="number" name="upper_value" placeholder="Upper value" class="upper-value" value="17.7">
            </div>
        `;
    }

    newRow.querySelector('.min-age').value = "";
    newRow.querySelector('.max-age').value = "";
    newRow.querySelector('.lower-value').value = "";
    newRow.querySelector('.upper-value').value = "";

    formContainer.appendChild(newRow);
}

function deleteRow(element) {
    const formContainer = element.closest('#form-container');

    if (formContainer && formContainer.childElementCount > 1) {
        element.parentElement.remove();
    }
}

function toggleRandomInputs(checkbox) {
    const randomSection = checkbox.closest('.random-section');
    const randomInputs = randomSection.querySelector('.random-inputs');
    
    if (checkbox.checked) {
        randomInputs.classList.add('active');
    } else {
        randomInputs.classList.remove('active');
        const lowerRange = randomInputs.querySelector('.lower-range');
        const upperRange = randomInputs.querySelector('.upper-range');
        if (lowerRange) lowerRange.value = '';
        if (upperRange) upperRange.value = '';
    }
}

// Main async IIFE
(async function fetchData() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    let categoryArray = [];
    let units = [];

    async function fetchandpopulatesamples() {
        const selecttag = document.getElementById("sampleType");
        selecttag.innerHTML = "";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/fetchsample-tenant`);
            const data = await response.json();

            if (!response.ok) {
                return console.log(data.message);
            }

            data.data.forEach(obj => {
                selecttag.innerHTML += `<option value="${obj.Name}">${obj.Name}</option>`;
            });

        } catch (error) {
            alert(error);
        }
    }

    await fetchandpopulatesamples();

    document.getElementById("sampleaddbtn").addEventListener("click", async () => {
        const sampeName = document.getElementById("sample-name").value;
        const samplebyuser = JSON.parse(localStorage.getItem("superAdminData"));
        const alert = document.getElementById("alert");

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/addsample-tenant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ Name: sampeName, user: samplebyuser })
            });

            const data = await response.json();

            if (response.ok) {
                fetchandpopulatesamples();
                alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-danger", "fade");
                alert.classList.add("alert-success", "show");
            } else {
                alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success", "fade");
                alert.classList.add("alert-danger", "show");
            }
        } catch (error) {
            alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
            alert.classList.remove("alert-success", "fade");
            alert.classList.add("alert-danger", "show");
        }
        setTimeout(() => {
            alert.classList.remove("show");
            alert.classList.add("fade");
        }, 3000);
    });

    const params = new URLSearchParams(window.location.search);
    const Name = params.get('Name');
    let name = Name;
    let orderId = 1;

    function normalizeShortName(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function getUniqueShortNames(values = []) {
        return [...new Set(values.map(normalizeShortName).filter(Boolean))];
    }

    function buildShortNameRows(shortNames = [], defaultShortName = "") {
        const aliases = getUniqueShortNames(shortNames);
        const normalizedDefault = normalizeShortName(defaultShortName);

        if (normalizedDefault && !aliases.includes(normalizedDefault)) {
            aliases.unshift(normalizedDefault);
        }

        return {
            aliases: aliases.length ? aliases : [""],
            defaultShortName: normalizedDefault || aliases[0] || ""
        };
    }

    function getShortNameAliasRow(value = "", checked = false) {
        return `
            <div class="shortname-alias-row">
                <input type="text" class="shortname-alias-input" value="${value}">
                <label class="shortname-default-toggle">
                    <input type="radio" class="shortname-default-radio" ${checked ? "checked" : ""}>
                    <span>Default</span>
                </label>
                <button type="button" class="shortname-remove-btn" title="Remove short name">x</button>
            </div>
        `;
    }

    function refreshShortNameRadioGroups() {
        document.querySelectorAll('#parameters-table2 tbody tr').forEach((row, index) => {
            row.querySelectorAll('.shortname-default-radio').forEach((radio) => {
                radio.name = `parameter-shortname-default-${index}`;
            });
        });
    }

    function renderShortNameManager(row, shortNames = [], defaultShortName = "") {
        const aliasList = row.querySelector('.shortname-alias-list');
        const state = buildShortNameRows(shortNames, defaultShortName);
        aliasList.innerHTML = "";

        if (state.aliases.length === 0) {
            aliasList.innerHTML = `<div class="shortname-empty-state">No machine short names added yet.</div>`;
        } else {
            state.aliases.forEach((alias) => {
                aliasList.insertAdjacentHTML('beforeend', getShortNameAliasRow(alias, alias === state.defaultShortName));
            });
        }

        refreshShortNameRadioGroups();
    }

    function collectShortNameManagerState(row) {
        const aliases = [];
        let defaultShortName = "";

        row.querySelectorAll('.shortname-alias-row').forEach((aliasRow) => {
            const input = aliasRow.querySelector('.shortname-alias-input');
            const radio = aliasRow.querySelector('.shortname-default-radio');
            const value = normalizeShortName(input?.value);

            if (!value) return;

            if (!aliases.includes(value)) {
                aliases.push(value);
            }

            if (radio?.checked) {
                defaultShortName = value;
            }
        });

        if (!defaultShortName) {
            defaultShortName = aliases[0] || "";
        }

        return {
            shortNames: aliases,
            defaultShortName
        };
    }

    const response = await fetch(`${BASE_URL}/api/v1/user/test-found?Name=${encodeURIComponent(name)}`);
    if (!response) {
        throw new Error('Failed to fetch data from api');
    }
    let data = await response.json();
    data = data.data;

    if (data.isDocumentedTest) {
        document.querySelector('.parameters-section').style.display = "none";
        document.querySelector('#defaultresult').style.display = "block";
        document.querySelector('#interpretation').style.display = "none";
    }

    await populateForm(data);

    async function populateForm(data) {
        console.log("data:", data);
        
        document.getElementById('name').value = data.Name || '';
        document.getElementById('short-name').value = data.Short_name || '';
        document.getElementById('price').value = data.Price || '';
        document.getElementById('final-price').value = data.final_price || '';
        document.getElementById('sampleType').value = data.sampleType || '';
        document.getElementById('method').value = data.method || '';
        document.getElementById('instrument').value = data.instrument || '';
        document.getElementById('tat').value = data.tat || '';

        if (editor) {
            editor.setData(data.interpretation);
        } else {
            console.error("Editor not initialized.");
        }

        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.textContent = 'Select Category';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        categorySelect.appendChild(defaultOption);

        if (data.category) {
            const preselectedOption = document.createElement('option');
            preselectedOption.value = data.category.category;
            preselectedOption.textContent = data.category.category;
            preselectedOption.selected = true;
            categorySelect.appendChild(preselectedOption);
        }

        if (data.parameters && data.parameters.length > 0) {
            const tableBody = document.getElementById('parameters-table2').getElementsByTagName('tbody')[0];
            tableBody.innerHTML = '';

            data.parameters.forEach((param, index) => {
                orderId = param.order;
                const newRow = tableBody.insertRow();
                console.log(param)
                newRow.innerHTML = `
                    <td><span class="remove-link" id="remove-link">🗑️</span></td>
                    <td><input type="text" value="${param.order}"></td>
                    <td class="parameter-name-cell">
                        <input type="text" value="${param.Para_name}" ${index === 0 ? 'readonly style="cursor: not-allowed;"' : ''}>
                        <div class="shortname-alias-manager">
                            <div class="shortname-alias-header">
                                <span>Machine Short names</span>
                                <button type="button" class="shortname-add-btn" data-action="add-shortname">+</button>
                            </div>
                            <div class="shortname-alias-list"></div>
                        </div>
                    </td>
                    <td>
                        <select id="unit-select">
                            <option>${param.unit}</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" value="${param.defaultresult}">
                    </td>
                    <td class="normalValue">
                        <div class="selectTypeDiv">
                            <label for="select-type">Select Type</label>
                            <select id="select-type" onchange="toggleForm(this)">
                                <option value="numeric" ${param.ValueType === 'numeric' ? 'selected' : ''}>Numeric</option>
                                <option value="text" ${param.ValueType === 'text' ? 'selected' : ''}>Text</option>
                            </select>
                        </div>
                        
                        <!-- Random Number Section -->
                        <div class="random-section">
                            <div class="random-checkbox-container">
                                <input type="checkbox" class="random-checkbox" onchange="toggleRandomInputs(this)" ${param.forRandom ? 'checked' : ''}>
                                <label>Show Random Number</label>
                            </div>
                            <div class="random-inputs ${param.forRandom ? 'active' : ''}">
                                <div class="random-input-group">
                                    <label>Lower Range</label>
                                    <input type="number" class="lower-range" placeholder="e.g., 5.0" step="0.01" value="${param.lowerRange || ''}">
                                </div>
                                <div class="random-input-group">
                                    <label>Upper Range</label>
                                    <input type="number" class="upper-range" placeholder="e.g., 15.0" step="0.01" value="${param.upperRange || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <div id="form-container" style="display: ${param.ValueType === 'text' ? 'none' : 'block'}">
                            ${param.NormalValue ? param.NormalValue.map((normalValue, normalIndex) => `
                                <div class="row-container">
                                    <span class="delete-btn" onclick="deleteRow(this)"><i class="fa-solid fa-eraser"></i></span>
                                    <div class="row-item">
                                        <label for="sex">Sex</label>
                                        <select name="sex" class="sex">
                                            <option value="Any" ${normalValue.gender === 'Any' ? 'selected' : ''}>Any</option>
                                            <option value="Male" ${normalValue.gender === 'Male' ? 'selected' : ''}>Male</option>
                                            <option value="Female" ${normalValue.gender === 'Female' ? 'selected' : ''}>Female</option>
                                        </select>
                                    </div>
                                    <div class="row-item">
                                        <label for="min_age">Min. Age</label>
                                        <div class="minAge">
                                            <input type="number" name="min_age" placeholder="Min. age" class="min-age" value="${normalValue.minAge}">
                                            <select name="min_age_unit">
                                                <option value="Years" ${normalValue.minAgeUnit === 'Years' ? 'selected' : ''}>Years</option>
                                                <option value="Months" ${normalValue.minAgeUnit === 'Months' ? 'selected' : ''}>Months</option>
                                                <option value="Days" ${normalValue.minAgeUnit === 'Days' ? 'selected' : ''}>Days</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row-item">
                                        <label for="max_age">Max. Age</label>
                                        <div class="maxAge">
                                            <input type="number" name="max_age" placeholder="Max. age" class="max-age" value="${normalValue.maxAge}">
                                            <select name="max_age_unit">
                                                <option value="Years" ${normalValue.maxAgeUnit === 'Years' ? 'selected' : ''}>Years</option>
                                                <option value="Months" ${normalValue.maxAgeUnit === 'Months' ? 'selected' : ''}>Months</option>
                                                <option value="Days" ${normalValue.maxAgeUnit === 'Days' ? 'selected' : ''}>Days</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row-item">
                                        <label for="lower_value">Lower</label>
                                        <input type="number" name="lower_value" placeholder="Lower value" class="lower-value" value="${normalValue.lowerValue}">
                                    </div>
                                    <div class="row-item">
                                        <label for="upper_value">Upper</label>
                                        <input type="number" name="upper_value" placeholder="Upper value" class="upper-value" value="${normalValue.upperValue}">
                                    </div>
                                </div>
                            `).join('') : ''}
                        </div>

                        <textarea id="text-area" class="text-area" placeholder="Enter text here..." style="display: ${param.ValueType === 'text' ? 'block' : 'none'}">${param.text || ''}</textarea>

                        <div class="add-more-btn" id="add-more-btn" style="display: ${param.ValueType === 'text' ? 'none' : 'flex'}" onclick="addRow(this)">+ Add more</div>
                    </td>`;

                const unitSelect = newRow.cells[3].getElementsByTagName('select')[0];
                for (let i = 0; i < unitSelect.options.length; i++) {
                    if (unitSelect.options[i].value === param.unit) {
                        unitSelect.options[i].selected = true;
                    }
                }

                renderShortNameManager(
                    newRow,
                    param.shortNames || (data.parameters.length === 1 ? [data.Short_name || ""] : []),
                    param.defaultShortName || (data.parameters.length === 1 ? data.Short_name || "" : "")
                );
            });
        }

        await loadCategories();
        await copyfield();
        await loadUnits();
    }

    async function loadUnits() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-units-tenant`);
            const data = await response.json();

            const unitSelects = document.querySelectorAll("#unit-select");

            if (!data || !Array.isArray(data.units) || data.units.length === 0) {
                console.log("units not found");
                return;
            }

            for (const selectEl of unitSelects) {
                // Capture current selection/text so we can re-select after repopulating
                let currentVal = '';
                try {
                    currentVal = selectEl.value || (selectEl.options && selectEl.options[0] && selectEl.options[0].textContent) || '';
                } catch (e) {
                    currentVal = '';
                }

                // Clear and populate options
                selectEl.innerHTML = '';
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select Unit';
                selectEl.appendChild(placeholder);

                data.units.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.unit;
                    option.textContent = unit.unit;
                    if (unit.unit === currentVal) option.selected = true;
                    selectEl.appendChild(option);
                });
            }

            units = data.units;
        } catch (error) {
            console.error(error.message || error);
        }
    }

    async function copyfield() {
        const nameInput = document.getElementById('name');
        const parametersTable = document.getElementById('parameters-table2').getElementsByTagName('tbody')[0];

        if (parametersTable.rows.length > 0) {
            const firstRowNameInput = parametersTable.rows[0].cells[2].querySelector('input');

            nameInput.addEventListener('input', function () {
                firstRowNameInput.value = this.value;
            });
        } else {
            console.error('Parameters table has no rows.');
        }
    }

    async function loadCategories() {
        fetch(`${BASE_URL}/api/v1/user/category-list-tenant`)
            .then(response => response.json())
            .then(data => {
                categoryArray.push(...(data.data));

                const categorySelect = document.getElementById('category');

                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    data.data.forEach(category => {
                        if (![...categorySelect.options].some(option => option.value === category.category)) {
                            const option = document.createElement('option');
                            option.value = category.category;
                            option.textContent = category.category;
                            categorySelect.appendChild(option);
                        }
                    });
                } else {
                    const option = document.createElement('option');
                    option.textContent = 'No categories available';
                    option.disabled = true;
                    categorySelect.appendChild(option);
                }
            })
            .catch(error => {
                console.error('Error fetching categories:', error);
                alert('Failed to load categories. Please try again.');
            });
    }

    const addUnitIcon = document.getElementById('add-unit-icon');
    const unitModal = document.getElementById('unit-modal');
    const closeModal = document.getElementById('close-modal');
    const saveUnitBtn = document.getElementById('save-unit');
    const newUnitNameInput = document.getElementById('new-unit-name');

    addUnitIcon.addEventListener('click', function () {
        unitModal.style.display = 'block';
    });

    closeModal.addEventListener('click', function () {
        unitModal.style.display = 'none';
    });

    saveUnitBtn.addEventListener('click', function () {
        const newUnit = newUnitNameInput.value.trim();

        if (newUnit) {
            fetch(`${BASE_URL}/api/v1/user/add-unit-tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ unit: newUnit })
            })
                .then(response => response.json())
                .then(data => {
                    unitModal.style.display = 'none';
                    newUnitNameInput.value = '';
                    loadUnits();
                    alert('Unit added successfully!');
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to add unit. Please try again.');
                });
        }
    });

    window.addEventListener('click', function (event) {
        if (event.target === unitModal) {
            unitModal.style.display = 'none';
        }
    });

    function addParameter() {
        if (units.length === 0) {
            alert('Units are not loaded yet. Please wait.');
            return;
        }

        const table = document.getElementById('parameters-table2').getElementsByTagName('tbody')[0];
        const newRow = table.insertRow();
        orderId++;

        newRow.innerHTML = `
        <td><span class="remove-link" id="remove-link">🗑️</span></td>
        <td><input type="text" value="${orderId}"></td>
        <td class="parameter-name-cell">
            <input type="text">
            <div class="shortname-alias-manager">
                <div class="shortname-alias-header">
                    <span>Machine Short names</span>
                    <button type="button" class="shortname-add-btn" data-action="add-shortname">+</button>
                </div>
                <div class="shortname-alias-list"></div>
            </div>
        </td>
        <td>
            <select id="unit-select">
                <option value="">Select unit</option>
            </select>
        </td>
        <td>
            <input type="text">
        </td>
        <td class="normalValue">
            <div class="selectTypeDiv">
                <label for="select-type">Select Type</label>
                <select id="select-type" onchange="toggleForm(this)">
                    <option value="numeric" selected>Numeric</option>
                    <option value="text">Text</option>
                </select>
            </div>
            
            <!-- Random Number Section -->
            <div class="random-section">
                <div class="random-checkbox-container">
                    <input type="checkbox" class="random-checkbox" onchange="toggleRandomInputs(this)">
                    <label>Show Random Number</label>
                </div>
                <div class="random-inputs">
                    <div class="random-input-group">
                        <label>Lower Range</label>
                        <input type="number" class="lower-range" placeholder="e.g., 5.0" step="0.01">
                    </div>
                    <div class="random-input-group">
                        <label>Upper Range</label>
                        <input type="number" class="upper-range" placeholder="e.g., 15.0" step="0.01">
                    </div>
                </div>
            </div>
            
            <div id="form-container">
                <div class="row-container">
                    <span class="delete-btn" onclick="deleteRow(this)"><i class="fa-solid fa-eraser"></i></span>
                    <div class="row-item">
                        <label for="sex">Sex</label>
                        <select name="sex" class="sex">
                            <option value="Any">Any</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div class="row-item">
                        <label for="min_age">Min. Age</label>
                        <div class="minAge">
                            <input type="number" name="min_age" placeholder="Min. age" class="min-age" value="0">
                            <select name="min_age_unit">
                                <option value="Years">Years</option>
                                <option value="Months">Months</option>
                                <option value="Days">Days</option>
                            </select>
                        </div>
                    </div>
                    <div class="row-item">
                        <label for="max_age">Max. Age</label>
                        <div class="maxAge">
                            <input type="number" name="max_age" placeholder="Max. age" class="max-age" value="100">
                            <select name="max_age_unit">
                                <option value="Years">Years</option>
                                <option value="Months">Months</option>
                                <option value="Days">Days</option>
                            </select>
                        </div>
                    </div>
                    <div class="row-item">
                        <label for="lower_value">Lower</label>
                        <input type="number" name="lower_value" placeholder="Lower value" class="lower-value" value="2.1">
                    </div>
                    <div class="row-item">
                        <label for="upper_value">Upper</label>
                        <input type="number" name="upper_value" placeholder="Upper value" class="upper-value" value="17.7">
                    </div>
                </div>
            </div>

            <textarea id="text-area" class="text-area" placeholder="Enter text here..."></textarea>

            <div class="add-more-btn" id="add-more-btn" onclick="addRow(this)">+ Add more</div>
        </td>`;

        const unitSelect = newRow.cells[3].getElementsByTagName('select')[0];
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.unit;
            option.textContent = unit.unit;
            unitSelect.appendChild(option);
        });

        newRow.querySelector('.remove-link').addEventListener('click', () => {
            table.deleteRow(newRow.rowIndex - 1);
            orderId--;
        });

        renderShortNameManager(newRow);
    }

    document.getElementById("add-parameter-link").addEventListener("click", addParameter);

    function removeParameter(element) {
        const row = element.parentElement.parentElement;
        orderId--;
        row.remove();
    }

    document.querySelector("#parameters-table2 tbody").addEventListener("click", function (event) {
        if (event.target.classList.contains("remove-link")) {
            removeParameter(event.target);
            refreshShortNameRadioGroups();
        }

        if (event.target.matches('[data-action="add-shortname"]')) {
            const row = event.target.closest('tr');
            const aliasList = row.querySelector('.shortname-alias-list');
            aliasList.insertAdjacentHTML('beforeend', getShortNameAliasRow("", false));
            refreshShortNameRadioGroups();
            const lastInput = row.querySelector('.shortname-alias-row:last-child .shortname-alias-input');
            if (lastInput) {
                lastInput.focus();
            }
        }

        if (event.target.classList.contains("shortname-remove-btn")) {
            const row = event.target.closest('tr');
            event.target.closest('.shortname-alias-row')?.remove();
            const remainingAliasRows = row.querySelectorAll('.shortname-alias-row');

            if (remainingAliasRows.length === 0) {
                const aliasList = row.querySelector('.shortname-alias-list');
                aliasList.innerHTML = '';
                aliasList.insertAdjacentHTML('beforeend', getShortNameAliasRow("", false));
            }

            refreshShortNameRadioGroups();
        }
    });

    document.querySelector("#parameters-table2 tbody").addEventListener("change", function (event) {
        if (event.target.classList.contains("shortname-default-radio")) return;
    });

    document.querySelector("#parameters-table2 tbody").addEventListener("input", function (event) {
        if (event.target.classList.contains("shortname-alias-input")) return;
    });

    document.getElementById('submitbBtn').addEventListener('click', async function () {
        const namefield = document.getElementById('name');
        const errormessage = document.querySelector('.errormessage');

        if (namefield.value.trim().includes(",")) {
            errormessage.style.display = "block";
            namefield.scrollIntoView({ behavior: "smooth" });
            namefield.focus();
            return;
        } else {
            errormessage.style.display = "none";
        }

        const formData = {
            Name: document.getElementById('name').value,
            Short_name: document.getElementById('short-name').value,
            category: categoryArray.find(doc => doc.category === document.getElementById('category').value),
            Price: document.getElementById('price').value,
            final_price: document.getElementById('final-price').value,
            tat: document.getElementById('tat').value,
            sampleType: document.getElementById('sampleType').value,
            method: document.getElementById('method').value,
            instrument: document.getElementById('instrument').value,
            interpretation: editor.getData(),
            parameters: [],
        };

        const parameterRows = document.querySelectorAll('#parameters-table2 tbody tr');
        parameterRows.forEach(row => {
            const parameterData = {
                order: row.cells[1].querySelector('input').value,
                Para_name: row.cells[2].querySelector('input').value,
                unit: row.cells[3].querySelector('select').value,
                defaultresult: row.cells[4].querySelector('input').value,
            };
            const shortNameState = collectShortNameManagerState(row);
            parameterData.shortNames = shortNameState.shortNames;
            parameterData.defaultShortName = shortNameState.defaultShortName;

            // Get random number data
            const randomCheckbox = row.cells[5].querySelector('.random-checkbox');
            const lowerRange = row.cells[5].querySelector('.lower-range');
            const upperRange = row.cells[5].querySelector('.upper-range');

            parameterData.forRandom = randomCheckbox ? randomCheckbox.checked : false;

            if (parameterData.forRandom && lowerRange && upperRange) {
                parameterData.lowerRange = parseFloat(lowerRange.value) || 0;
                parameterData.upperRange = parseFloat(upperRange.value) || 0;
            }

            const selectType = row.cells[5].querySelector('#select-type').value;
            let dataObject;

            if (selectType === 'text') {
                const textAreaData = row.cells[5].querySelector('#text-area').value;
                parameterData.text = textAreaData;
            } else {
                const rows = row.cells[5].querySelectorAll('.row-container');
                dataObject = Array.from(rows).map(row => ({
                    gender: row.querySelector('.sex').value,
                    minAge: row.querySelector('.min-age').value,
                    minAgeUnit: row.querySelector('[name="min_age_unit"]').value,
                    maxAge: row.querySelector('.max-age').value,
                    maxAgeUnit: row.querySelector('[name="max_age_unit"]').value,
                    lowerValue: row.querySelector('.lower-value').value,
                    upperValue: row.querySelector('.upper-value').value,
                }));
            }
            
            parameterData.NormalValue = dataObject;
            parameterData.ValueType = selectType;
            formData.parameters.push(parameterData);
        });

        const alert = document.querySelector(".alert");
        let _id = name;
        formData._id = _id;

        await fetch(`${BASE_URL}/api/v1/user/test-edit-tenant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...formData })
        })
            .then(response => response.json())
            .then(data => {
                console.log(data.status);

                if (data.status === "success") {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-danger");
                    alert.classList.add("alert-success", "show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                    setTimeout(() => {
                        window.location.href = "/admin/admin.html?page=test";
                    }, 3500);
                } else {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-success");
                    alert.classList.add("alert-danger", "show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                }
            })
            .catch((error) => {
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger", "show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
            });
    });
    
    loader.style.display = "none";
})();
