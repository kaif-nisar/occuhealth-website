async function addpannelfun() {
    const panelNameInput = document.getElementById("name");
    const tagsDiv = document.getElementById("middle-tag-div");
    const testList = document.getElementById('search-hint');
    const testsInput = document.getElementById("tests");
    let selectedTests = new Set(); // Using Set to track unique test names
    let selectedSampleTypes = new Set(); // Using Set to track unique sample types

    const params = new URLSearchParams(window.location.search);
    const name = params.get('Name');
    // // Function to initialize TinyMCE
    async function tinymcefunction() {
        return tinymce.init({
            selector: '#editorContent',
            height: 300,
            menubar: false,
            plugins: 'image table lists link',
            toolbar: 'undo redo | formatselect | fontsizeselect | bold italic backcolor | image | table | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | link',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt',

            // ✅ Custom Image Upload Handler
            images_upload_handler: function (blobInfo, success, failure) {
                var formData = new FormData();
                formData.append('image', blobInfo.blob(), blobInfo.filename());  // ✅ Fix: Correct field name

                fetch('http://localhost:8000/api/v1/user/imageUploaderfunction', {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.location) {
                            success(data.location);
                        } else {
                            failure("❌ Image upload failed");
                        }
                    })
                    .catch(error => {
                        console.error("❌ Upload failed:", error);
                        failure("❌ Upload error: " + error.message);
                    });
            }
        });
    }

    tinymcefunction();

    async function del() {
        // Remove the old TinyMCE instance first
        tinymce.remove('#editorContent');

        // Now initialize the editor again
        await tinymcefunction();
    }
    del();


    //isko dekhna hai

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
        // Populate selected tests
        populateSelectedTests(panelData);
        // Populate Category
        // populateCategory(panelData.category);

        // Populate other fields
        panelNameInput.value = panelData.name;
        document.getElementById("price").value = panelData.price;
        document.getElementById("final-price").value = panelData.final_price;
        document.getElementById('hide-interpretation').checked = panelData.hideInterpretation;
        document.getElementById('hide-method-instrument').checked = panelData.hideMethodInstrument;
        document.getElementById('category').value = panelData.category.category;
        // Set the content in the TinyMCE editor
        if (tinymce.get("editorContent")) {
            tinymce.get("editorContent").setContent(panelData.interpretation);
        } else {
            console.error("TinyMCE editor not initialized.");
        }
    }

    // async function setSelectedOption(selectId, value) {
    //     const selectElement = document.getElementById(selectId);
    //     if (selectElement) {
    //         const options = selectElement.options;
    //         for (let i = 0; i < options.length; i++) {
    //             if (options[i].value === value) {
    //                 options[i].selected = true; // Set the matching option as selected
    //                 break;
    //             }
    //         }
    //     }
    // }


    // function populateCategory(existingCategory) {
    //     const categorySelect = document.getElementById('category');
    //     categorySelect.innerHTML = '';  // Clear any existing options

    //     const defaultOption = document.createElement('option');
    //     defaultOption.textContent = 'Select Category';
    //     defaultOption.disabled = true;
    //     defaultOption.selected = true;
    //     categorySelect.appendChild(defaultOption);

    //     // Fetch and populate categories
    // }

    async function loadCategories() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/category-list`);
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

                // Set the existing category
                // if (existingCategory) {
                //     const existingOption = [...categorySelect.options].find(option => option.value === existingCategory);
                //     if (existingOption) {
                //         existingOption.selected = true;
                //     }
                // }
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    }
    // Fix: Populate all selected tests from the panel data
    function populateSelectedTests(panelData) {
        // Ensure tests and sample_types arrays are aligned and that sample_types is not empty
        if (panelData.tests && panelData.sample_types && panelData.sample_types.length > 0) {
            const sampleType = panelData.sample_types[0]; // Use the first sampleType for all tests

            panelData.tests.forEach((testName) => {
                if (sampleType) {
                    addSelectedTest(testName, sampleType, true); // Pass 'true' to mark as pre-selected
                } else {
                    console.error("Missing sample type for tests");
                }
            });
        } else {
            console.error("Invalid panel data: Missing tests or sample_types arrays.");
        }
    }




    async function loadTests() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database`, { method: "POST" });
            const tests = await response.json();
            displayTests(tests);
        } catch (error) {
            console.error("Error loading tests:", error);
        }
    }

    function displayTests(tests) {
        testList.innerHTML = '';
        tests.forEach(test => {
            const testElement = createTestElement(test);
            testList.appendChild(testElement);
        });
    }

    function createTestElement(test) {
        const testElement = document.createElement('div');
        testElement.id = "tests-name-div";
        testElement.setAttribute('sampletype', test.sampleType);
        testElement.innerHTML = test.Name;

        testElement.addEventListener("click", function () {
            const testName = test.Name;
            const sampleType = test.sampleType;

            if (selectedTests.has(testName)) {
                unselectTest(testName, sampleType);
            } else if (canSelectTest(sampleType)) {
                addSelectedTest(testName, sampleType);
            } else {
                showAlert(`Cannot select test with sample type "${sampleType}"`);
            }
        });

        return testElement;
    }

    function addSelectedTest(testName, sampleType, isPreSelected = false) {
        // Prevent duplicate additions
        if (selectedTests.has(testName)) return;

        // Allow selection if:
        // - The sample type matches the selected ones
        // - There are no conflicting sample types
        // - Or it's a pre-selected test
        if (selectedSampleTypes.has(sampleType) || selectedTests.size === 0 || isPreSelected) {
            const selectedTestDiv = document.createElement('div');
            selectedTestDiv.classList.add('selected-div');
            selectedTestDiv.innerHTML = `<span>${testName}</span> <i class="fa-regular fa-circle-xmark delete-btn"></i>`;
            selectedTestDiv.setAttribute('sample-type', sampleType);

            // Add to sets
            selectedTests.add(testName);
            selectedSampleTypes.add(sampleType);
            tagsDiv.appendChild(selectedTestDiv);

            // Hide the selected test from the available list
            hideTestFromList(testName);

            // Attach delete button listener
            addDeleteButtonListener(selectedTestDiv, testName, sampleType);
        } else {
            showAlert(`Cannot select test with sample type "${sampleType}" as another sample type is already selected`);
        }
    }



    function hideTestFromList(testName) {
        const testElement = Array.from(testList.children).find(test => test.innerText === testName);
        if (testElement) testElement.style.display = 'none';
    }

    function addDeleteButtonListener(selectedTestDiv, testName, sampleType) {
        selectedTestDiv.querySelector('.delete-btn').addEventListener('click', function () {
            unselectTest(testName, sampleType);
        });
    }

    function unselectTest(testName) {
        // Find the selected test div
        const selectedTestDiv = Array.from(tagsDiv.children).find(div => div.innerText.includes(testName));
        if (selectedTestDiv) {
            // Retrieve the sample type directly from the attribute
            const sampleType = selectedTestDiv.getAttribute('sample-type');

            // Remove the div from the tags container
            selectedTestDiv.remove();

            // Remove the test from the selectedTests set
            selectedTests.delete(testName);

            // Check if there are any remaining tests with the same sample type
            const remainingTestsWithSampleType = Array.from(tagsDiv.children).some(div => div.getAttribute('sample-type') === sampleType);

            if (!remainingTestsWithSampleType) {
                // If no other tests with the same sample type remain, remove the sample type
                selectedSampleTypes.delete(sampleType);
            }

            // If no tests remain at all, clear the sample types set
            if (selectedTests.size === 0) {
                selectedSampleTypes.clear(); // Allow any sample type if no tests are selected
            }

            // Make the unselected test visible again in the available test list
            showTestInList(testName);
        }
    }

    function showTestInList(testName) {
        const testElement = Array.from(testList.children).find(test => test.innerText === testName);
        if (testElement) {
            testElement.style.display = 'block'; // Make the test visible for re-selection
        }
    }



    function canSelectTest(sampleType) {
        // Allow selecting tests with the same sample type as already selected tests
        return selectedSampleTypes.size === 0 || selectedSampleTypes.has(sampleType);
    }

    function showAlert(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert';
        alertDiv.innerText = message;
        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }

    async function initialize() {
        const panelName = name;
        if (panelName) {
            await fetchPanelData(panelName);
        }
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

    function addPanelToDatabase() {
        document.querySelector('.save').addEventListener('click', async function () {
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
            try {
                const pannelname = namefield.value.trim();
                const price = document.getElementById("price").value;
                const final_price = document.getElementById("final-price").value;
                const interpretation = tinymce.get('editorContent').getContent();
                const category = document.getElementById("category").value;
                // Capture checkbox states
                const hideInterpretation = document.getElementById('hide-interpretation').checked;
                const hideMethodInstrument = document.getElementById('hide-method-instrument').checked;

                // Convert Set to Array and remove duplicates (already handled by Set)
                const uniqueSampleTypes = Array.from(selectedSampleTypes);
                const uniqueInputArray = Array.from(selectedTests);

                console.log(uniqueSampleTypes, uniqueInputArray);
                
                if (!uniqueSampleTypes.length || !uniqueInputArray.length) {
                    alert.innerHTML = `Please select atleast one Test<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-success");
                    alert.classList.add("alert-danger");
                    alert.classList.add("show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                    return;
                }

                const response = await fetch(`${BASE_URL}/api/v1/user/edit-Pannel/${name}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        pannelname,
                        category,
                        price,
                        inputarray: uniqueInputArray,
                        interpretation,
                        sample_types: uniqueSampleTypes,
                        hideInterpretation,
                        hideMethodInstrument,
                        final_price
                    })
                });

                const data = await response.json();

                if (data.status === "success") {

                    // Clear selections after successful save
                    selectedTests.clear();
                    selectedSampleTypes.clear();
                    tagsDiv.innerHTML = ''; // Clear selected tags
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

    initialize();
    addPanelToDatabase();
    document.querySelector('.cancel').addEventListener('click', function () {
        // Navigate back to the previous page
        window.location.href = `${BASE_URL}/admin.html?page=testPanels`;
    });
}

addpannelfun();





