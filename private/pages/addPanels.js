
(function addpannelfun() {
    let categoryArray = [];
    let selectedTests = new Map(); // testName -> { sampleType, testId }
    let uniqueSampleTypes = new Set();
    let currentSampleType = null;

    const testInput = document.getElementById("tests");
    const tagsContainer = document.getElementById("middle-tag-div");
    const testList = document.getElementById('search-hint');
    const alertBox = document.querySelector(".alert");

    // ===========================
    // 2. Helper Functions
    // ===========================
    function showAlert(message, type = "danger") {
        alertBox.innerHTML = `${message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
        alertBox.className = `alert alert-${type} show`;
        setTimeout(() => {
            alertBox.classList.remove("show");
            alertBox.classList.add("fade");
        }, 3000);
    }

    function showWarning(message) {
        if (!document.getElementById('warning-message')) {
            const warning = document.createElement('div');
            warning.id = 'warning-message';
            Object.assign(warning.style, {
                position: 'fixed',
                top: '100px',
                left: '60%',
                transform: 'translateX(-50%)',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '10px 20px',
                borderRadius: '5px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                zIndex: 1000
            });
            warning.innerText = message;
            document.body.appendChild(warning);
            setTimeout(() => warning.remove(), 3000);
        }
    }

    function updateSampleTypes() {
        uniqueSampleTypes.clear();
        selectedTests.forEach(test => uniqueSampleTypes.add(test.sampleType));
    }

    function resetSelections() {
        selectedTests.clear();
        uniqueSampleTypes.clear();
        currentSampleType = null;
        tagsContainer.innerHTML = '';
    }

    // ===========================
    // 3. Fetch & Populate Categories
    // ===========================
    async function fetchCategories() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/category-list`, { method: "GET" });
            if (!res.ok) throw new Error("Failed to fetch categories");

            const data = await res.json();
            categoryArray = data.categories || data || [];
            const selectEl = document.getElementById("category");
            selectEl.innerHTML = "";
            categoryArray.data.forEach(cat => {
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

    // ===========================
    // 4. Load Tests
    // ===========================
    async function loadTests() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/test-database`, { method: "POST" });
            const data = await res.json();
            testList.innerHTML = '';

            data.forEach(test => {
                const testEl = document.createElement('div');
                testEl.className = "test-item";
                testEl.id = "tests-name-div";
                testEl.setAttribute('sampletype', test.sampleType);
                testEl.setAttribute('data-id', test._id);
                testEl.textContent = test.Name;

                testEl.addEventListener("click", () => toggleTestSelection(testEl));
                testList.appendChild(testEl);
            });

            testInput.addEventListener("click", () => testList.style.display = "block");
            document.addEventListener("click", e => {
                if (!testInput.contains(e.target) && !testList.contains(e.target)) {
                    testList.style.display = "none";
                }
            });
        } catch (err) {
            console.error("Error loading tests:", err);
        }
    }

    function toggleTestSelection(testEl) {
        const testName = testEl.textContent;
        const sampleType = testEl.getAttribute('sampletype');
        const testId = testEl.getAttribute('data-id');

        if (!currentSampleType) currentSampleType = sampleType;

        if (sampleType !== currentSampleType) {
            showWarning("You can only select tests with the same sample type!");
            return;
        }

        if (!selectedTests.has(testName)) {
            selectedTests.set(testName, { sampleType, testId });
            uniqueSampleTypes.add(sampleType);

            const tag = document.createElement('div');
            tag.className = 'selected-div';
            tag.setAttribute('sample-type', sampleType);
            tag.innerHTML = `<span>${testName}</span> <i class="fa-regular fa-circle-xmark delete-btn"></i>`;
            tagsContainer.appendChild(tag);

            testEl.style.display = "none";
        } else {
            deselectTest(testName);
        }
        // console.log("selectedTests:", selectedTests);
    }

    function deselectTest(testName) {
        selectedTests.delete(testName);
        updateSampleTypes();

        const testEl = [...testList.children].find(t => t.textContent === testName);
        if (testEl) testEl.style.display = "";

        [...tagsContainer.children].forEach(tag => {
            if (tag.innerText.trim() === testName) tag.remove();
        });

        if (selectedTests.size === 0) currentSampleType = null;
    }

    // Delete from tag
    tagsContainer.addEventListener("click", e => {
        if (e.target.classList.contains("delete-btn")) {
            const tag = e.target.closest(".selected-div");
            if (tag) {
                const testName = tag.innerText.trim();
                deselectTest(testName);
            }
        }
    });

    // ===========================
    // 5. Search Tests
    // ===========================
    function enableSearch() {
        testInput.addEventListener("input", function () {
            const value = this.value.toLowerCase();
            const tests = document.querySelectorAll('.test-item');
            let found = false;

            tests.forEach(test => {
                if (test.textContent.toLowerCase().includes(value)) {
                    test.style.display = 'block';
                    found = true;
                } else {
                    test.style.display = 'none';
                }
            });

            document.getElementById("noTestMessage").style.display = found ? "none" : "";
        });
    }

    // ===========================
    // 6. Save Panel
    // ===========================
    function savePanel() {
        document.querySelector('.save').addEventListener('click', async () => {
            const nameField = document.getElementById('name');
            const price = document.getElementById("price").value;
            const finalPrice = document.getElementById("final-price").value;
            const interpretation = editor.getData();
            const category = categoryArray.data.find(cat => cat.category === document.getElementById('category').value);
            const hideInterpretation = document.getElementById('hide-interpretation').checked;
            const hideMethodInstrument = document.getElementById('hide-method-instrument').checked;

            if (nameField.value.trim().includes(",")) {
                document.querySelector('.errormessage').style.display = "block";
                nameField.scrollIntoView({ behavior: "smooth" });
                nameField.focus();
                return;
            } else {
                document.querySelector('.errormessage').style.display = "none";
            }

            const testsId = Array.from(selectedTests.values()).map(test => test.testId);
            const selectedTestNames = Array.from(selectedTests.keys());

            const sampleTypes = Array.from(uniqueSampleTypes);

            if (!testsId.length || !sampleTypes.length) {
                return showAlert("Please select at least one test", "danger");
            }

            try {
                const res = await fetch(`${BASE_URL}/api/v1/user/add-panels`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pannelname: nameField.value.trim(),
                        rawPrice: price,
                        final_price: finalPrice,
                        category,
                        inputarray: selectedTestNames,
                        testsId,
                        interpretion: interpretation,
                        sample_types: sampleTypes,
                        hideInterpretation,
                        hideMethodInstrument
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    resetSelections();
                    showAlert(data.message, "success");
                    setTimeout(() => window.location.href = `/superAdmin/superAdmin.html?page=testPanels` , 3500);
                } else {
                    showAlert(data.message, "danger");
                }
            } catch (err) {
                showAlert(err.message, "danger");
            }
        });
    }

    // ===========================
    // 7. Cancel Button
    // ===========================
    document.querySelector('.cancel').addEventListener('click', () => {
        window.location.href = `${BASE_URL}/admin.html?page=testPanels`;
    });

    // ===========================
    // 8. Initialization
    // ===========================
    async function init() {
        await fetchCategories();
        await loadTests();
        enableSearch();
        savePanel();
    }

    init();
})();
