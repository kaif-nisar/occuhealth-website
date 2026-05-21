

function loading() {
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
    let testIds = [];       // ✅ new array for test IDs
    let panelIds = [];      // ✅ new array for panel IDs

    const params = new URLSearchParams(window.location.search)
    const name1 = params.get('Name');

    function removeDuplicates(array) {
        return [...new Set(array)];
    }

    async function loadPackageData(name1) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/one-Package/${name1}`, { method: "POST" });
            const packageData = await response.json();

            // console.log("packageData:", packageData);
            
            // Pre-fill form fields
            document.getElementById('name').value = packageData.packageName.trim();
            document.getElementById('fee').value = packageData.packageFee;
            document.getElementById('gender').value = packageData.packageGender;
            document.getElementById('final-price').value = packageData.final_price;

            // Pre-fill tests with IDs
            packageData.testname.forEach((test, index) => {
                addTestTag(test, packageData.testSample[index], packageData.testIds[index]);
            });

            // Pre-fill panels with IDs
            packageData.pannelname.forEach((panel, index) => {
                addPanelTag(panel, packageData.pannelSample[index], packageData.pannelIds[index]);
            });

        } catch (error) {
            console.error('Failed to load package data:', error);
        }
    }

    function addTestTag(testName, sampleType, testId) {
        const selectedTestTag = document.createElement('div');
        selectedTestTag.classList.add('selected-div');
        selectedTestTag.setAttribute('sample-type', sampleType);
        selectedTestTag.setAttribute('data-id', testId); // ✅ store test id
        selectedTestTag.innerHTML = `${testName} <i class="fa-regular fa-circle-xmark delete-btn"></i>`;

        selectedTestTag.querySelector('.delete-btn').addEventListener('click', function () {
            selectedTestTag.remove();
            inputarray = inputarray.filter(name => name !== testName);
            testIds = testIds.filter(id => id !== testId); // ✅ remove test id
            removeSampleType(sample_types, sampleType, sample_types_count);

            Array.from(searchHint.children).forEach(option => {
                if (option.innerText === testName) option.style.display = "block";
            });
        });

        tagsdiv.appendChild(selectedTestTag);
        inputarray.push(testName);
        testIds.push(testId); // ✅ push id
        addSampleType(sample_types, sampleType, sample_types_count);
    }

    function addPanelTag(panelName, panelSampleType, panelId) {
        const selectedPanelTag = document.createElement('div');
        selectedPanelTag.classList.add('selected-div2');
        selectedPanelTag.setAttribute('sample-type', panelSampleType);
        selectedPanelTag.setAttribute('data-id', panelId); // ✅ store panel id
        selectedPanelTag.innerHTML = `${panelName} <i class="fa-regular fa-circle-xmark delete-btn2"></i>`;

        selectedPanelTag.querySelector('.delete-btn2').addEventListener('click', function () {
            selectedPanelTag.remove();
            inputarray2 = inputarray2.filter(name => name !== panelName);
            panelIds = panelIds.filter(id => id !== panelId); // ✅ remove panel id
            removeSampleType(sample_types2, panelSampleType, sample_types2_count);

            Array.from(searchHint2.children).forEach(option => {
                if (option.innerText === panelName) option.style.display = "block";
            });
        });

        tagsdiv2.appendChild(selectedPanelTag);
        inputarray2.push(panelName);
        panelIds.push(panelId); // ✅ push id
        addSampleType(sample_types2, panelSampleType, sample_types2_count);
    }

    async function loadTests() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database`, { method: "POST" });
            const tests = await response.json();
            searchHint.innerHTML = '';

            tests.forEach(test => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option";
                optionElement.setAttribute('sampletype', test.sampleType);
                optionElement.setAttribute('data-id', test._id); // ✅ test id
                optionElement.innerText = test.Name;

                optionElement.addEventListener("click", function (e) {
                    const testName = e.target.innerText;
                    const sampleType = e.target.getAttribute('sampletype');
                    const testId = e.target.getAttribute('data-id');

                    if (inputarray.includes(testName)) {
                        inputarray = inputarray.filter(name => name !== testName);
                        testIds = testIds.filter(id => id !== testId); // ✅ remove id
                        sample_types = sample_types.filter(type => type !== sampleType);
                        Array.from(tagsdiv.children).forEach(tag => {
                            if (tag.innerText.includes(testName)) tag.remove();
                        });
                        optionElement.style.display = "block";
                    } else {
                        addTestTag(testName, sampleType, testId);
                        optionElement.style.display = "none";
                    }
                    searchHint.style.display = "none";
                    // console.log("testId:", testIds);
                    // console.log("panelid:", panelIds);
                });

                searchHint.appendChild(optionElement);

            });

            TestSearchInput.addEventListener("click", () => searchHint.style.display = "block");
            document.addEventListener("click", (e) => {
                if (!TestSearchInput.contains(e.target) && !searchHint.contains(e.target)) searchHint.style.display = "none";
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    async function loadpannels() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels`, { method: "POST" });
            const panels = await response.json();
            searchHint2.innerHTML = '';

            panels.forEach(panel => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option2";
                optionElement.setAttribute('sample-type', JSON.stringify(panel.sample_types));
                optionElement.setAttribute('data-id', panel._id); // ✅ panel id
                optionElement.innerText = panel.name;

                optionElement.addEventListener("click", function (e) {
                    const panelName = e.target.innerText;
                    const sampleTypes = JSON.parse(e.target.getAttribute('sample-type'));
                    const panelId = e.target.getAttribute('data-id');

                    if (inputarray2.includes(panelName)) {
                        inputarray2 = inputarray2.filter(name => name !== panelName);
                        panelIds = panelIds.filter(id => id !== panelId); // ✅ remove panel id
                        sample_types2 = sample_types2.filter(type => !sampleTypes.includes(type));
                        Array.from(tagsdiv2.children).forEach(tag => {
                            if (tag.innerText.includes(panelName)) tag.remove();
                        });
                        optionElement.style.display = "block";
                    } else {
                        addPanelTag(panelName, sampleTypes, panelId);
                        optionElement.style.display = "none";
                    }
                    searchHint2.style.display = "none";
                    // console.log("testId:", testIds);
                    // console.log("panelid:", panelIds);
                });

                searchHint2.appendChild(optionElement);
            });

            pannelsInput.addEventListener("click", () => searchHint2.style.display = "block");
            document.addEventListener("click", (e) => {
                if (!pannelsInput.contains(e.target) && !searchHint2.contains(e.target)) searchHint2.style.display = "none";
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    function deepFlatten(array) {
        return array.reduce((acc, val) =>
            Array.isArray(val) ? acc.concat(deepFlatten(val)) : acc.concat(val), []
        );
    }

    document.getElementById("submitButton").addEventListener("click", async () => {
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

        const packageData = {
            packageName: namefield.value.trim(),
            final_price: document.getElementById('final-price').value,
            packageFee: document.getElementById('fee').value,
            packageGender: document.getElementById('gender').value,
            testname: removeDuplicates(inputarray),
            testSample: removeDuplicates(deepFlatten(sample_types)),
            testIds: removeDuplicates(testIds), // ✅ test IDs
            pannelname: removeDuplicates(inputarray2),
            pannelSample: removeDuplicates(deepFlatten(sample_types2)),
            pannelIds: removeDuplicates(panelIds) // ✅ panel IDs
        };

        if (!packageData.packageName || !packageData.packageFee || !packageData.final_price) {
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

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/edit-Package/${name1}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(packageData)
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

    let sample_types_count = {};
    let sample_types2_count = {};

    function addSampleType(sampleTypesArray, sampleType, countObj) {
        if (countObj[sampleType]) {
            countObj[sampleType]++;
        } else {
            countObj[sampleType] = 1;
            sampleTypesArray.push(sampleType);
        }
    }

    function removeSampleType(sampleTypesArray, sampleType, countObj) {
        if (countObj[sampleType]) {
            countObj[sampleType]--;
            if (countObj[sampleType] === 0) {
                delete countObj[sampleType];
                const index = sampleTypesArray.indexOf(sampleType);
                if (index > -1) sampleTypesArray.splice(index, 1);
            }
        }
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

    async function initialization() {
        await loadPackageData(name1);
        await loadTests();
        await loadpannels();
        searchingTest();
        searchingPannel();
    }

    initialization();
}
loading();
