async function addpannelfun() {
    let categoryArray = [];
    const panelNameInput = document.getElementById("name");
    const tagsDiv = document.getElementById("middle-tag-div");
    const testList = document.getElementById('search-hint');
    const testsInput = document.getElementById("tests");

    let selectedTests = new Map(); // testName -> { sampleType, testId }
    let selectedSampleTypes = new Set();

    const params = new URLSearchParams(window.location.search);
    const name = params.get('Name');

            async function fetchCategories() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/category-list-tenant`, { method: "GET" });
            if (!res.ok) throw new Error("Failed to fetch categories");

            const data = await res.json();
            
            categoryArray = data.categories || data.data || data || [];

            const selectEl = document.getElementById("category");
            selectEl.innerHTML = "";
            categoryArray.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat.category;
                opt.textContent = cat.category;
                selectEl.appendChild(opt);
            });
        } catch (err) {
            console.error(err);
            alert("Error fetching categories. Please try again.");
        }
    }

    fetchCategories();
    // ===========================
    // Fetch Panel Data
    // ===========================
    async function fetchPanelData(name) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/one-Pannel/${name}`, { method: "POST" });
            const panelData = await response.json();

            if (panelData) {
                await loadCategories();
                populateFields(panelData);
            }
        } catch (error) {
            console.error("Error fetching panel data:", error);
        }
    }

    function populateFields(panelData) {
        populateSelectedTests(panelData);
        panelNameInput.value = panelData.name;
        document.getElementById("price").value = panelData.price;
        document.getElementById("final-price").value = panelData.final_price;
        document.getElementById('hide-interpretation').checked = panelData.hideInterpretation;
        document.getElementById('hide-method-instrument').checked = panelData.hideMethodInstrument;
        document.getElementById('category').value = panelData.category.category;

        if (editor) {
            editor.setData(panelData.interpretation || "");
        }
    }

    async function loadCategories() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/category-list-tenant`);
            const categories = await response.json();

            if (categories && Array.isArray(categories.data)) {
                const categorySelect = document.getElementById('category');
                categorySelect.innerHTML = "";

                categories.data.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.category;
                    option.textContent = category.category;
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    }

    // ===========================
    // Populate Tests
    // ===========================
    function populateSelectedTests(panelData) {
        if (panelData.tests && panelData.sample_types && panelData.testsId) {
            const sampleType = panelData.sample_types[0];

            console.log("tests:", panelData.tests)
            panelData.tests.forEach((testName, index) => {
                const testId = panelData.testsId[index];
                if (testId && sampleType) addSelectedTest(testName, sampleType, testId, true);
            });
        }
    }

    async function loadTests() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database-tenant`, { method: "POST" });
            const tests = await response.json();
            displayTests(tests);
        } catch (error) {
            console.error("Error loading tests:", error);
        }
    }

    function displayTests(tests) {
        testList.innerHTML = '';
        tests.tests.forEach(test => {
            const testElement = createTestElement(test);
            testList.appendChild(testElement);
        });
    }

    function createTestElement(test) {
        const testElement = document.createElement('div');
        testElement.className = "test-item";
        testElement.id = "tests-name-div";
        testElement.setAttribute('sampletype', test.sampleType);
        testElement.setAttribute('data-id', test._id);
        testElement.innerText = test.Name;

        testElement.addEventListener("click", function () {
            const testName = test.Name;
            const sampleType = test.sampleType;
            const testId = test._id;

            if (selectedTests.has(testName)) {
                unselectTest(testName);
            } else if (canSelectTest(sampleType)) {
                addSelectedTest(testName, sampleType, testId);
            } else {
                showAlert(`Cannot select test with sample type "${sampleType}"`);
            }
            console.log("selectedTests:", selectedTests);

        });

        return testElement;
    }

    function addSelectedTest(testName, sampleType, testId, isPreSelected = false) {
        if (selectedTests.has(testName)) return;

        if (selectedSampleTypes.has(sampleType) || selectedTests.size === 0 || isPreSelected) {
            const selectedTestDiv = document.createElement('div');
            selectedTestDiv.classList.add('selected-div');
            selectedTestDiv.innerHTML = `<span>${testName}</span> <i class="fa-regular fa-circle-xmark delete-btn"></i>`;
            selectedTestDiv.setAttribute('sample-type', sampleType);

            selectedTests.set(testName, { sampleType, testId });
            selectedSampleTypes.add(sampleType);
            tagsDiv.appendChild(selectedTestDiv);

            hideTestFromList(testName);
            addDeleteButtonListener(selectedTestDiv, testName);
        } else {
            showAlert(`Cannot select test with sample type "${sampleType}" as another sample type is already selected`);
        }
        console.log("selectedTests:", selectedTests);
    }

    function hideTestFromList(testName) {
        const testElement = Array.from(testList.children).find(test => test.innerText === testName);
        if (testElement) testElement.style.display = 'none';
    }

    function addDeleteButtonListener(selectedTestDiv, testName) {
        selectedTestDiv.querySelector('.delete-btn').addEventListener('click', function () {
            unselectTest(testName);
        });
    }

    function unselectTest(testName) {
        const selectedTestDiv = Array.from(tagsDiv.children).find(div => div.innerText.includes(testName));
        if (selectedTestDiv) {
            const sampleType = selectedTestDiv.getAttribute('sample-type');
            selectedTestDiv.remove();

            selectedTests.delete(testName);
            const remainingTests = Array.from(selectedTests.values()).some(test => test.sampleType === sampleType);
            if (!remainingTests) selectedSampleTypes.delete(sampleType);
            if (selectedTests.size === 0) selectedSampleTypes.clear();
            showTestInList(testName);
        }
    }

    function showTestInList(testName) {
        const testElement = Array.from(testList.children).find(test => test.innerText === testName);
        if (testElement) testElement.style.display = 'block';
    }

    function canSelectTest(sampleType) {
        return selectedSampleTypes.size === 0 || selectedSampleTypes.has(sampleType);
    }

    function showAlert(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert';
        alertDiv.innerText = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }

    async function initialize() {
        if (name) await fetchPanelData(name);
        await loadTests();
        setupSearch();
    }

    function setupSearch() {
        testsInput.addEventListener("keyup", function () {
            const inputValue = this.value.toLowerCase();
            const testDivs = Array.from(testList.children);
            let found = false;

            testDivs.forEach(testDiv => {
                const testName = testDiv.innerText.toLowerCase();
                testDiv.style.display = testName.includes(inputValue) ? 'block' : 'none';
                if (testName.includes(inputValue)) found = true;
            });

            document.getElementById("noTestMessage").style.display = found ? "none" : "block";
        });
    }

    // ===========================
    // Save Panel
    // ===========================
    function addPanelToDatabase() {
        document.querySelector('.save').addEventListener('click', async function () {
            const namefield = document.getElementById('name');
            const errormessage = document.querySelector('.errormessage');
            const alert = document.querySelector(".alert");

            if (namefield.value.trim().includes(",")) {
                errormessage.style.display = "block";
                namefield.scrollIntoView({ behavior: "smooth" });
                namefield.focus();
                return;
            } else {
                errormessage.style.display = "none";
            }

            try {
                const pannelname = namefield.value.trim();
                const price = document.getElementById("price").value;
                const final_price = document.getElementById("final-price").value;
                const interpretation = editor.getData();
                const category = categoryArray.find(cat => cat.category === document.getElementById('category').value);
                const hideInterpretation = document.getElementById('hide-interpretation').checked;
                const hideMethodInstrument = document.getElementById('hide-method-instrument').checked;

                const testsId = Array.from(selectedTests.values()).map(test => test.testId);
                const uniqueSampleTypes = Array.from(selectedSampleTypes);
                const uniqueInputArray = Array.from(selectedTests.keys());

                if (!testsId.length || !uniqueSampleTypes.length) {
                    alert.innerHTML = `Please select at least one Test<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.add("alert-danger", "show");
                    setTimeout(() => alert.classList.remove("show"), 3000);
                    return;
                }

                const response = await fetch(`${BASE_URL}/api/v1/user/edit-Pannel-tenant/${name}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pannelname,
                        category,
                        price,
                        inputarray: uniqueInputArray,
                        testsId,
                        interpretation,
                        sample_types: uniqueSampleTypes,
                        hideInterpretation,
                        hideMethodInstrument,
                        final_price
                    })
                });

                const data = await response.json();
                if (data.status === "success") {
                    selectedTests.clear();
                    selectedSampleTypes.clear();
                    tagsDiv.innerHTML = '';
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.add("alert-success", "show");
                    setTimeout(() => window.location.href = "/admin/admin.html?page=testPanels", 3500);
                } else {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.add("alert-danger", "show");
                    setTimeout(() => alert.classList.remove("show"), 3000);
                }
            } catch (error) {
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.add("alert-danger", "show");
                setTimeout(() => alert.classList.remove("show"), 3000);
            }
        });
    }

    initialize();
    addPanelToDatabase();

    document.querySelector('.cancel').addEventListener('click', function () {
        window.location.href = `${BASE_URL}/admin.html?page=testPanels`;
    });
}

addpannelfun();
