function addpackage() {
    const TestSearchInput = document.getElementById("tests");
    const pannelsInput = document.getElementById("tests2");
    const tagsdiv = document.getElementById("middle-tag-div");
    const tagsdiv2 = document.getElementById("middle-tag-div2");
    const searchHint = document.getElementById('search-hint');
    const searchHint2 = document.getElementById('search-hint2');

    let sample_types2 = [];
    let sample_types = [];
    let inputarray2 = [];
    let inputarray = [];

    // ✅ New arrays for IDs
    let testIds = [];
    let panelIds = [];

    // for test selection
    async function loadTests() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database-tenant`, { method: "POST" });
            const tests = await response.json();

            searchHint.innerHTML = '';

            tests.tests.forEach(test => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option";
                optionElement.setAttribute('sampletype', test.sampleType);
                optionElement.setAttribute('data-id', test._id); // ✅ store test id
                optionElement.innerText = test.Name;

                optionElement.addEventListener("click", function (e) {
                    const selectedTestName = document.createElement('div');
                    selectedTestName.classList.add('selected-div');
                    selectedTestName.innerHTML = `${e.target.innerText} <i class="fa-regular fa-circle-xmark delete-btn"></i>`;
                    const single_sample = e.target.getAttribute('sampletype');
                    const testId = e.target.getAttribute('data-id'); // ✅ get test id
                    selectedTestName.setAttribute('sample-type', single_sample);
                    selectedTestName.setAttribute('data-id', testId); // ✅ store in selected div

                    sample_types.push(single_sample);
                    inputarray.push(e.target.innerText);
                    testIds.push(testId); // ✅ push test ID

                    optionElement.style.display = "none";
                    tagsdiv.appendChild(selectedTestName);
                    searchHint.style.display = "none";
                    console.log("testsId:", testIds);
                    console.log("panelids:", panelIds);
                });

                searchHint.appendChild(optionElement);
            });

            TestSearchInput.addEventListener("click", () => searchHint.style.display = "block");
            document.addEventListener("click", (e) => {
                if (!TestSearchInput.contains(e.target) && !searchHint.contains(e.target)) {
                    searchHint.style.display = "none";
                }
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    tagsdiv.addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-btn")) {
            const tag = e.target.closest(".selected-div");

            if (tag) {
                const testName = tag.innerText.trim();
                const testId = tag.getAttribute('data-id');
                const deletablesampleType = tag.getAttribute('sample-type');

                inputarray = inputarray.filter(items => items !== testName);
                testIds = testIds.filter(id => id !== testId); // ✅ remove test ID

                const index = sample_types.findIndex(items => items === deletablesampleType);
                if (index !== -1) sample_types.splice(index, 1);

                const testElement = Array.from(searchHint.children).find(test => test.innerText === testName);
                if (testElement) testElement.style.display = "";

                tag.remove();
            }
        }
        console.log("testsId:", testIds);
        console.log("panelids:", panelIds);
    });

    async function loadpannels() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels-tenant`, { method: "POST" });
            const tests = await response.json();

            searchHint2.innerHTML = '';

            tests.panels.forEach(test => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option2";
                optionElement.setAttribute('sample-type', JSON.stringify(test.sample_types));
                optionElement.setAttribute('data-id', test._id); // ✅ store panel id
                optionElement.innerText = test.name;

                optionElement.addEventListener("click", function (e) {
                    const selectedTestName = document.createElement('div');
                    selectedTestName.classList.add('selected-div2');
                    selectedTestName.setAttribute('sample-type', JSON.stringify(test.sample_types));
                    selectedTestName.setAttribute('data-id', test._id); // ✅ panel id
                    selectedTestName.innerHTML = `${e.target.innerText} <i class="fa-regular fa-circle-xmark delete-btn2"></i>`;

                    JSON.parse(e.target.getAttribute('sample-type')).forEach(sample => {
                        if (!sample_types2.includes(sample)) sample_types2.push(sample);
                    });

                    inputarray2.push(e.target.innerText);
                    panelIds.push(test._id); // ✅ push panel ID
                    tagsdiv2.appendChild(selectedTestName);

                    e.target.style.display = "none";
                    searchHint2.style.display = "none";
                            console.log("testsId:", testIds);
        console.log("panelids:", panelIds);
                });

                searchHint2.appendChild(optionElement);

            });

            pannelsInput.addEventListener("click", () => searchHint2.style.display = "block");
            document.addEventListener("click", (e) => {
                if (!pannelsInput.contains(e.target) && !searchHint2.contains(e.target)) {
                    searchHint2.style.display = "none";
                }
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    tagsdiv2.addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-btn2")) {
            const tag = e.target.closest(".selected-div2");

            if (tag) {
                const panelName = tag.innerText.trim();
                const deletableSampleTypes = JSON.parse(tag.getAttribute('sample-type'));
                const panelId = tag.getAttribute('data-id');

                inputarray2 = inputarray2.filter(item => item !== panelName);
                panelIds = panelIds.filter(id => id !== panelId); // ✅ remove panel ID

                deletableSampleTypes.forEach(sample => {
                    const sampleInOtherPanel = Array.from(tagsdiv2.children).some(otherTag => {
                        if (otherTag !== tag) {
                            const otherSampleTypes = JSON.parse(otherTag.getAttribute('sample-type'));
                            return otherSampleTypes.includes(sample);
                        }
                        return false;
                    });
                    if (!sampleInOtherPanel) {
                        sample_types2 = sample_types2.filter(existingSample => existingSample !== sample);
                    }
                });

                const panelElement = Array.from(searchHint2.children).find(option => option.innerText === panelName);
                if (panelElement) panelElement.style.display = "";

                tag.remove();
            }
        }
    });

    async function initialize() {
        await loadTests();
        await loadpannels();
        searchingTest();
        searchingPannel();
    }

    function searchingTest() {
        TestSearchInput.addEventListener("input", function () {
            const inputValue = this.value.toLowerCase();
            const selectedDivs = document.querySelectorAll('.hint-option');
            let found = false;

            selectedDivs.forEach(antest => {
                const testName = antest.innerText.toLowerCase();
                if (testName.includes(inputValue)) {
                    antest.style.display = 'block';
                    found = true;
                } else {
                    antest.style.display = 'none';
                }
            });

            document.getElementById("noTestMessage").style.display = found ? "none" : "";
        });
    }

    function searchingPannel() {
        pannelsInput.addEventListener("input", function () {
            const inputValue = this.value.toLowerCase();
            const selectedDivs = document.querySelectorAll('.hint-option2');
            let found = false;

            selectedDivs.forEach(antest => {
                const testName = antest.innerText.toLowerCase();
                if (testName.includes(inputValue)) {
                    antest.style.display = 'block';
                    found = true;
                } else {
                    antest.style.display = 'none';
                }
            });

            document.getElementById("noTestMessage2").style.display = found ? "none" : "";
        });
    }

    initialize();
    addPanneltodatabase();

    function addPanneltodatabase() {
        document.getElementById('submitButton').addEventListener('click', async () => {
            const namefield = document.getElementById('name');
            const errormessage = document.querySelector('.errormessage');
            const alert = document.querySelector(".alert");

            if (namefield.value.trim().includes(",")) {
                errormessage.style.display = "block";
                namefield.scrollIntoView({ behavior: "smooth" })
                namefield.focus();
                return;
            } else {
                errormessage.style.display = "none";
            }

            const packageName = namefield.value.trim();
            const packageFee = document.getElementById('fee').value;
            const packagegender = document.getElementById('gender').value;
            const final_price = document.getElementById('final-price').value;

            if (!packageName || !packageFee || !final_price) {
                alert.innerHTML = `Missing required fields<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger", "show");
                setTimeout(() => alert.classList.remove("show"), 3000);
                return;
            }

            if (inputarray.length === 0 && inputarray2.length === 0) {
                alert.innerHTML = `Please select at least one Test or Panel<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger", "show");
                setTimeout(() => alert.classList.remove("show"), 3000);
                return;
            }

            const requestBody = {
                testname: inputarray,
                testSample: sample_types,
                testIds, // ✅ added test ids
                pannelname: inputarray2,
                pannelSample: sample_types2,
                pannelIds: panelIds, // ✅ added panel ids
                packageName,
                packageFee,
                packagegender,
                final_price
            };

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/add-package-tenant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();
                if (response.ok) {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-danger");
                    alert.classList.add("alert-success", "show");
                    setTimeout(() => location.reload(), 3500);
                } else {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-success");
                    alert.classList.add("alert-danger", "show");
                }
            } catch (error) {
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger", "show");
            }

            setTimeout(() => alert.classList.remove("show"), 3000);
        });
    }
}

addpackage();
