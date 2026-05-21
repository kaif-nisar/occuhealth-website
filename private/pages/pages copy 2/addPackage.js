function addpackage() {
    const TestSearchInput = document.getElementById("tests");
    const pannelsInput = document.getElementById("tests2");
    const tagsdiv = document.getElementById("middle-tag-div");
    const tagsdiv2 = document.getElementById("middle-tag-div2");
    const testList = document.getElementById('search-hint');
    const searchHint = document.getElementById('search-hint');
    const searchHint2 = document.getElementById('search-hint2');
    let sample_types2 = [];
    let sample_types = [];
    let inputarray2 = [];
    let inputarray = [];

    // for test selection
    async function loadTests() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database`);
            const tests = await response.json();

            const inputField = document.getElementById('tests');
            // const tagsdiv = document.getElementById('middle-tag-div');

            // Clear previous options
            searchHint.innerHTML = '';

            tests.forEach(test => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option";
                optionElement.setAttribute('sampletype', test.sampleType);
                optionElement.innerText = test.Name;

                // Add option click event
                optionElement.addEventListener("click", function (e) {
                    const selectedTestName = document.createElement('div');
                    selectedTestName.classList.add('selected-div');
                    selectedTestName.innerHTML = `${e.target.innerText} <i class="fa-regular fa-circle-xmark delete-btn"></i>`;
                    const single_sample = e.target.getAttribute('sampletype');
                    selectedTestName.setAttribute('sample-type', single_sample);

                    sample_types.push(single_sample);
                    inputarray.push(e.target.innerText);

                    // Hide selected option
                    optionElement.style.display = "none";

                    tagsdiv.appendChild(selectedTestName);
                    searchHint.style.display = "none"; // Hide options after selection
                });

                // Add option to search hint container
                searchHint.appendChild(optionElement);
            });

            // Show options on input click
            inputField.addEventListener("click", function () {
                searchHint.style.display = "block";
            });

            // Hide options if clicked outside
            document.addEventListener("click", function (e) {
                if (!inputField.contains(e.target) && !searchHint.contains(e.target)) {
                    searchHint.style.display = "none";
                }
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    // Remove selected test when delete button is clicked
    tagsdiv.addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-btn")) {
            const tag = e.target.closest(".selected-div");

            if (tag) {
                // Remove the test name from inputarray
                inputarray = inputarray.filter(items => items !== tag.innerText.trim());

                // Remove the first occurrence of the sample type in sample_types
                const deletablesampleType = tag.getAttribute('sample-type');
                let index = sample_types.findIndex(items => items === deletablesampleType);
                if (index !== -1) {
                    sample_types.splice(index, 1);
                }

                // Show the corresponding test element again in searchHint
                const testName = tag.innerText.trim();
                const testElement = Array.from(searchHint.children).find(test => test.innerText === testName);
                if (testElement) {
                    testElement.style.display = ""; // Show the test element again
                }

                tag.remove(); // Remove the selected test tag
            }
        }
    });


    // Panel loading function
    async function loadpannels() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels-tenant`, { method: "POST" });
            const tests = await response.json();

            const searchHint2 = document.getElementById('search-hint2');
            const inputField2 = document.getElementById('tests2');
            const tagsdiv2 = document.getElementById('middle-tag-div2'); // Make sure this ID matches the actual element ID

            // Clear previous options
            searchHint2.innerHTML = '';

            tests.panels.forEach(test => {
                const optionElement = document.createElement('div');
                optionElement.className = "hint-option2";
                optionElement.setAttribute('sample-type', JSON.stringify(test.sample_types)); // Store sample types as JSON
                optionElement.innerText = test.name;

                // Add option click event
                optionElement.addEventListener("click", function (e) {
                    const selectedTestName = document.createElement('div');
                    selectedTestName.classList.add('selected-div2');
                    selectedTestName.setAttribute('sample-type', JSON.stringify(test.sample_types));
                    selectedTestName.innerHTML = `${e.target.innerText} <i class="fa-regular fa-circle-xmark delete-btn2"></i>`;

                    // Add samples to sample_types2 without duplicates
                    JSON.parse(e.target.getAttribute('sample-type')).forEach(sample => {
                        if (!sample_types2.includes(sample)) {
                            sample_types2.push(sample);
                        }
                    });

                    inputarray2.push(e.target.innerText);
                    tagsdiv2.appendChild(selectedTestName);

                    e.target.style.display = "none"; // Hide option after selection
                    searchHint2.style.display = "none"; // Hide options after selection
                });

                searchHint2.appendChild(optionElement); // Add option to search hint container
            });

            // Show options on input click
            inputField2.addEventListener("click", () => searchHint2.style.display = "block");
            document.addEventListener("click", (e) => {
                if (!inputField2.contains(e.target) && !searchHint2.contains(e.target)) {
                    searchHint2.style.display = "none";
                }
            });

        } catch (error) {
            console.log("something went wrong", error);
        }
    }

    // For panel deletion
    tagsdiv2.addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-btn2")) {
            const tag = e.target.closest(".selected-div2");

            if (tag) {
                const panelName = tag.innerText.trim();
                const deletableSampleTypes = JSON.parse(tag.getAttribute('sample-type'));

                // Remove panel name
                inputarray2 = inputarray2.filter(item => item !== panelName);

                // Remove associated sample types if no other panel uses them
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

                // Show panel option again
                const panelElement = Array.from(searchHint2.children).find(option => option.innerText === panelName);
                if (panelElement) {
                    panelElement.style.display = ""; // Show panel option again
                }

                tag.remove(); // Remove selected panel tag
            }
        }
    });




    async function initialize() {
        await loadTests();
        await loadpannels(); // Wait for tests to load
        searchingTest(); // Now attach the keyup listener // now creating test pannel
        searchingPannel();
    }

    function searchingTest() {
        TestSearchInput.addEventListener("input", function () {
            const inputValue = this.value.toLowerCase(); // Get input value and convert to lowercase
            const selectedDivs = document.querySelectorAll('.hint-option'); // Get all test name divs
            let found = false;

            selectedDivs.forEach(antest => {
                const testName = antest.innerText.toLowerCase(); // Store the test name text in a separate variable

                if (testName.includes(inputValue)) {
                    antest.style.display = 'block';  // Show the element if it matches the input
                    found = true;
                } else {
                    antest.style.display = 'none';  // Hide the element if it doesn't match
                }
            });

            // Display "no test found" message if no matches
            document.getElementById("noTestMessage").style.display = found ? "none" : "";
        });
    }

    function searchingPannel() {
        pannelsInput.addEventListener("input", function () {
            const inputValue = this.value.toLowerCase(); // Get input value and convert to lowercase
            const selectedDivs = document.querySelectorAll('.hint-option2'); // Get all test name divs
            let found = false;

            selectedDivs.forEach(antest => {
                const testName = antest.innerText.toLowerCase(); // Store the test name text in a separate variable

                if (testName.includes(inputValue)) {
                    antest.style.display = 'block';  // Show the element if it matches the input
                    found = true;
                } else {
                    antest.style.display = 'none';  // Hide the element if it doesn't match
                }
            });

            // Display "no test found" message if no matches
            document.getElementById("noTestMessage2").style.display = found ? "none" : "";
        });
    }

    initialize();
    addPanneltodatabase();


    function addPanneltodatabase() {

        // Save button click handler
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
            // Combine the arrays
            const packageName = namefield.value.trim();
            const packageFee = document.getElementById('fee').value;
            const packagegender = document.getElementById('gender').value;
            const final_price = document.getElementById('final-price').value;

            if (!packageName || !packageFee || !final_price ) {
                alert.innerHTML = `Missing required feilds<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
                return;
            }
            if (inputarray.length === 0 && inputarray2.length === 0) {
                alert.innerHTML = `Please select atleast one Test or panel<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
                return;
            }

            // Create the request body
            const requestBody = {
                testname: inputarray,
                testSample: sample_types,
                pannelname: inputarray2,
                pannelSample: sample_types2,
                packageName,
                packageFee,
                packagegender,
                final_price
            };

            try {
                // Send the data to the API
                const response = await fetch(`${BASE_URL}/api/v1/user/add-package-tenant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();
                if (response.ok) {
                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-danger");
                    alert.classList.add("alert-success");
                    alert.classList.add("show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                    setTimeout(() => {
                        // Reload the page after successful creation
                        location.reload();
                    }, 3500);
                } else {

                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-success");
                    alert.classList.add("alert-danger");
                    alert.classList.add("show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                }
            } catch (error) {
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
            }
        });

    }


}

addpackage();