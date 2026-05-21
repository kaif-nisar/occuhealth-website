async function bookingload() {
    let totalprice = document.querySelector('#header span');
    const testSelection = document.getElementById('test-selection');
    testSelection.innerHTML = '';
    let total = 0;

    // for fetching tests 
    async function fetchAndPopulateOptions() {

        let randomId = "HL" + Math.floor(Math.random() * 10000000000);
        document.getElementById('random-id').value = randomId;
        try {
            // Fetch data from all three APIs concurrently
            const [testResponse, panelResponse, packageResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}`, { method: "POST" })
            ]);

            // Check if all responses are successful
            if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
                throw new Error("One or more API requests failed");
            }

            // Parse JSON responses
            const testData = await testResponse.json();
            const panelData = await panelResponse.json();
            const packageData = await packageResponse.json();
            testSelection.innerHTML = '';
            // Populate test options
            testData.forEach(test => {
                const testElement = document.createElement('span');
                testElement.id = test.testId; // Set the ID based on the test's unique identifier
                testElement.classList.add('tests-name-option');
                testElement.setAttribute('data-price', test.myPrice);
                testElement.setAttribute('sample-Type', test.sampleType);
                testElement.setAttribute('data-id', test.testId)
                testElement.setAttribute('shortname', test.Short_name)
                testElement.innerText = `${test.testName}`;
                testSelection.appendChild(testElement);
            });
            // console.log(panelData)
            // Populate panel options
            panelData.forEach(panel => {
                const testElement = document.createElement('span');
                testElement.id = panel.panelId; // Set the ID based on the test's unique identifier
                testElement.classList.add('tests-name-option');
                testElement.setAttribute('data-price', panel.myPrice);
                testElement.setAttribute('sample-Type', panel.sampleType);
                testElement.setAttribute('data-value', panel.panelId)
                testElement.innerText = `${panel.panelName}`;
                testSelection.appendChild(testElement);
            });
            // console.log(packageData)
            // Populate package options
            packageData.forEach(pkg => {
                const testElement = document.createElement('span');
                testElement.id = pkg.packageId; // Set the ID based on the test's unique identifier
                testElement.classList.add('tests-name-option');
                testElement.setAttribute('data-value', pkg.packageId)
                testElement.setAttribute('data-price', pkg.myPrice);

                // Combine test samples and panel samples, remove duplicates and nulls
                const combinedSamples = [...(pkg.sampleType || []), ...(pkg.sample_types || [])];
                const uniqueCombinedSamples = [...new Set(combinedSamples)];
                const arrayWithoutNull = uniqueCombinedSamples.filter(item => item !== null);
                testElement.setAttribute('sample-Type', arrayWithoutNull);

                testElement.innerText = `${pkg.packageName}`;
                testSelection.appendChild(testElement);
            });
        } catch (error) {
            console.error("Error fetching and populating options:", error);
        }
    }

    // for fetching doctors
    async function databaseDoctors() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-doctor?userId=${userId}`, { method: "GET" })
            const tests = await response.json();
            const subFranchiseeSelect = document.getElementById('doctor-selection');

            tests.forEach(test => {
                const testElement = document.createElement('option');
                testElement.id = "doctor-option-selection";
                testElement.classList.add('doctor-option-selection');
                testElement.setAttribute('doctor-id', test._id);

                testElement.innerText = `${test.firstName} ${test.lastName} (${test.specialization})`;
                subFranchiseeSelect.appendChild(testElement);
            });
        } catch (error) {
            console.error("Doctor not Found")

        }
    }

    // for Lab select
    async function databaseLab() {
        try {

            const response = await fetch(`${BASE_URL}/api/v1/user/all-Lab?userId=${userId}`, { method: "GET" })
            const tests = await response.json();
            const LabSelect = document.getElementById('lab-selection');

            tests.forEach(test => {
                const testElement = document.createElement('option');
                testElement.id = "Lab-option-selection";
                testElement.classList.add('Lab-option-selection');
                testElement.setAttribute('Lab-id', test._id);

                testElement.innerText = `${test.LabName}`;
                LabSelect.appendChild(testElement);
            });
        } catch (error) {
            console.error("Lab not found")
        }
    }

    function addlabfunction() {
        try {
            const showModalBtn = document.getElementById('show-modal-btn');
            const modalOverlay = document.getElementById('modal-overlay');
            const closeModalBtn = document.getElementById('close-modal-btn');


            showModalBtn.addEventListener('click', () => {
                modalOverlay.style.display = 'flex';
            });

            closeModalBtn.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
            });

            window.addEventListener('click', (event) => {
                if (event.target === modalOverlay) {
                    modalOverlay.style.display = 'none';
                }
            });
        } catch (error) {
            console.error("Lab not found")
        }
    }

    async function testSelectionfunction() {
        let selectedtests = document.getElementById('test-selected');
        let allTests = document.querySelectorAll(".tests-name-option");
        let tableBody = document.getElementById("tableBody");
        tableBody.innerHTML = "";
        let order = 0;

        allTests.forEach(tests => {
            tests.addEventListener("click", function () {
                const tablebodyrow = document.querySelectorAll('#tableBody tr');
                let sampletype = tests.getAttribute('sample-type');
                let shortName = tests.getAttribute('shortname');
                let trueOrfalse = sampletype.includes(',');  // check if multiple sample types exist
                let sameSample = false;
                let rows = tableBody.querySelectorAll('tr');
                let order = tableBody.querySelectorAll('tr').length + 1; // Ensure order starts correctly
                let createRow;

                if (trueOrfalse) {
                    // This is a panel with multiple sample types
                    let samplearray = sampletype.split(',');
                    samplearray = [...new Set(samplearray)];  // remove duplicates

                    // For each sample type in the panel
                    samplearray.forEach(sample => {
                        let rowExists = false;
                        rows.forEach(row => {
                            // Check if the row already has this sample type
                            const rowSampleType = row.cells[1].innerText;
                            if (rowSampleType === sample) {
                                // Append the panel's name to the 4th column
                                row.cells[3].innerText = row.cells[3].innerText + "," + tests.innerText;
                                rowExists = true;
                            }
                        });

                        if (!rowExists) {
                            // Create a new row for this sample type
                            createRow = document.createElement('tr');
                            order++;
                            createRow.innerHTML = `<td>${order}</td>
                                 <td>${sample}</td>
                                 <td>
                                     <input type="text" placeholder="Enter barcodeId" name="barcodeId">
                                     <br>
                                     <input type="text" placeholder="Enter SampleId" name="confirmBarcodeId">
                                 </td>
                                 <td>${tests.innerText}</td>`;
                            tableBody.appendChild(createRow);
                        }
                    });
                } else {
                    // Single test with one sample type
                    let rowExists = false;
                    rows.forEach(row => {
                        // Check if this sample type already exists in a row
                        const rowSampleType = row.cells[1].innerText;
                        if (rowSampleType === sampletype) {
                            // Append the test name to the 4th column
                            row.cells[3].innerText = row.cells[3].innerText + "," + tests.innerText;
                            rowExists = true;
                        }
                    });

                    if (!rowExists) {
                        // Create a new row for the test
                        createRow = document.createElement('tr');
                        order++;
                        createRow.innerHTML = `<td>${order}</td>
                             <td>${sampletype}</td>
                             <td>
                                 <input type="text" placeholder="Enter barcodeId" name="barcodeId">
                                 <br>
                                 <input type="text" placeholder="Enter SampleId" name="confirmBarcodeId">
                             </td>
                             <td>${tests.innerText}</td>`;
                        tableBody.appendChild(createRow);
                    }
                }

                // Update selected tests dropdown
                const selectedOptions = document.createElement("span");
                selectedOptions.innerText = tests.innerText;
                selectedOptions.classList.add('realSelectedTests');
                tests.style.display = "none";  // Hide selected test
                let testPrice = tests.getAttribute('data-price');
                total += Math.floor(testPrice);
                totalprice.innerText = `${total}.00`
                // .toFixed(2);
                selectedOptions.setAttribute('data-price', testPrice);
                selectedOptions.setAttribute('data-id', tests.id)
                selectedOptions.setAttribute('shortname', shortName)
                selectedtests.appendChild(selectedOptions);
                // Delete test functionality
                selectedOptions.addEventListener('click', function () {
                    let removingTestPrice = selectedOptions.getAttribute('data-price');
                    total = total - Math.floor(removingTestPrice);  // Subtract price from total
                    totalprice.innerText = `${total}.00`

                    // Set test ID as a data attribute
                    selectedOptions.setAttribute('data-id', tests._id); // Add this line here

                    selectedOptions.setAttribute('data-price', testPrice);
                    selectedtests.appendChild(selectedOptions);
                    console.log(selectedOptions)
                    // Re-display the test in the selection dropdown
                    tests.style.display = "block"; // Show the test back in the available options
                    selectedOptions.remove();  // Remove the selected option from the dropdown

                    let rows = tableBody.querySelectorAll('tr');  // Get all the rows in the table

                    // Iterate over all rows in the table to remove the test name
                    rows.forEach(row => {
                        if (row.cells[3].innerText.includes(selectedOptions.innerText)) {
                            // Get the current test names in the 4th column
                            let cellText = row.cells[3].innerText;  // Current text inside the cell
                            let testToRemove = selectedOptions.innerText;  // The test name to remove

                            // Step 1: Split the text into an array of test names
                            let testArray = cellText.split(',').map(test => test.trim());  // Convert the cell text into an array of names

                            // Step 2: Filter out the test name we want to remove
                            let updatedTestArray = testArray.filter(test => test !== testToRemove);

                            // Step 3: Join the remaining test names back into a string and update the cell
                            if (updatedTestArray.length > 0) {
                                // If there are remaining tests, update the cell
                                row.cells[3].innerText = updatedTestArray.join(', ');
                            } else {
                                // If no tests are left, remove the row entirely
                                order--;
                                row.remove();
                                reindexRows();
                            }
                        }
                    });

                    // After removing the test, reindex the rows
                    reindexRows();
                });

                function reindexRows() {
                    const rows = document.querySelectorAll('#tableBody tr'); // Select all rows in the tbody
                    rows.forEach((row, index) => {
                        row.querySelector('td').innerText = index + 1; // Set the correct row number
                    });
                }

            });
        });
    }


    function filterTests() {
        const searchQuery = document.getElementById('selectTestDivforSearch').value.toLowerCase();
        let allOptions = document.querySelectorAll(".tests-name-option");

        allOptions.forEach(option => {
            // Check if the option text includes the search query
            if (option.innerText.toLowerCase().includes(searchQuery) || option.getAttribute('shortname')?.toLowerCase()?.includes(searchQuery)) {
                option.style.display = "";  // Show the option
            } else {
                option.style.display = "none";  // Hide the option
            }
        });
    }

    // Attach search event listener
    document.getElementById('selectTestDivforSearch').addEventListener('input', filterTests);

    function filterselectedTests() {
        const searchQuery = document.getElementById('selectedTestDivforSearch').value.toLowerCase();
        let allOptions = document.querySelectorAll(".realSelectedTests");

        allOptions.forEach(option => {
            // Check if the option text includes the search query
            if (option.innerText.toLowerCase().includes(searchQuery) || option.getAttribute('shortname')?.toLowerCase()?.includes(searchQuery)) {
                option.style.display = "";  // Show the option
            } else {
                option.style.display = "none";  // Hide the option
            }
        });
    }

    // Attach search event listener
    document.getElementById('selectedTestDivforSearch').addEventListener('input', filterselectedTests);

    // adding doctor function
    function addDoctorpage() {
        try {
            const modal = document.getElementById('modal');
            const openModalBtn = document.getElementById('openModalBtn');
            const closeModalBtn = document.querySelector('.close');
            const closeFooterBtn = document.querySelector('.btn-close');

            // Function to open modal
            openModalBtn.addEventListener('click', function () {
                modal.classList.add('active');
            });

            // Function to close modal when close button is clicked
            closeModalBtn.addEventListener('click', function () {
                modal.classList.remove('active');
            });

            // Close modal by clicking footer close button
            closeFooterBtn.addEventListener('click', function () {
                modal.classList.remove('active');
            });

            // Close modal when clicking outside the modal content
            window.addEventListener('click', function (event) {
                if (event.target === modal) {
                    modal.classList.remove('active');
                }
            });
        } catch (error) {
            console.error(error);

        }
    }

    // adding doctor to database
    function addingdoctortodatabase() {
        try {
            const addDoctorBtn = document.querySelector('.btn-add');

            // Add event listener to the Add Doctor button
            addDoctorBtn.addEventListener('click', function () {
                // Gather form data
                const doctorData = {
                    firstname: document.getElementById('firstname').value,
                    lastname: document.getElementById('lastname').value,
                    specialization: document.getElementById('specialization').value,
                    dob: document.getElementById('dob').value,
                    gender: document.getElementById('gender').value,
                    address: document.getElementById('address').value,
                    userId
                };

                // Send the data to the backend using fetch
                fetch(`${BASE_URL}/api/v1/user/add-doctor`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(doctorData)
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('Doctor added successfully!');
                            modal.classList.remove('active'); // Close modal on success
                        } else {
                            alert('Failed to add doctor.');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('An error occurred while adding the doctor.');
                    });
            });
        } catch (error) {
            console.error(error);

        }
    }

    // adding Lab to database
    function addingLabtodatabase() {
        try {
            const addDoctorBtn = document.getElementById('add-lab');

            // Add event listener to the Add Doctor button
            addDoctorBtn.addEventListener('click', function () {
                // Gather form data
                const LabData = {
                    LabName: document.getElementById('lab-name2').value,
                    LabAddress: document.getElementById('lab-address').value,
                    userId
                };


                // Send the data to the backend using fetch
                fetch(`${BASE_URL}/api/v1/user/add-Lab`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(LabData)
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('Lab added successfully!');
                            modal.classList.remove('active'); // Close modal on success
                        } else {
                            alert('Failed to add doctor.');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('An error occurred while adding the doctor.');
                    });
            });
        } catch (error) {
            console.error('Error:', error);

        }
    }

    let submitButton;

    function currentDateandTime() {
        // Get the input elements
        try {
            const dateInput = document.getElementById('dob');
            const timeInput = document.getElementById('time');

            if (dateInput && timeInput) {
                // Set current date in 'dob' input field
                const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD' format
                dateInput.value = today;

                // Set current time in 'time' input field
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                timeInput.value = `${hours}:${minutes}`;

                // Make both inputs readonly
                dateInput.setAttribute('readonly', true);
                timeInput.setAttribute('readonly', true);
            } else {
                console.error('Input elements not found');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }


    async function doctorInput() {
        const doctorSelectTag = document.getElementById('doctor-selection');
        doctorSelectTag.addEventListener('change', function () {
            const doctorSelectTag = document.getElementById('doctor-selection');
            const selectedDoctor = doctorSelectTag.options[doctorSelectTag.selectedIndex];
            const doctorNameInputField = document.getElementById('doctor-name');

            // Check if the selected option is disabled or has no value
            if (selectedDoctor.value === "NoDoctor" || !selectedDoctor.value) {
                doctorNameInputField.value = ""; // Clear the input if the option is invalid
                doctorNameInputField.style.backgroundColor = "white";
                doctorNameInputField.style.cursor = "text";
                doctorNameInputField.removeAttribute("readonly"); // Allow editing
                return;
            }

            // Update the input field with the selected option's text
            doctorNameInputField.value = selectedDoctor.text;
            doctorNameInputField.style.backgroundColor = "#3333331c";
            doctorNameInputField.style.cursor = "not-allowed";
            doctorNameInputField.setAttribute("readonly", true); // Make it readonly
        });
    }

    async function submitNewBooking() {
        submitButton = document.getElementById('submit-btn');
        if (!submitButton) {
            console.error("Submit button not found");
            return;
        }

        submitButton.addEventListener('click', async function () {
            const loadingScreen = document.getElementById('loadingScreen');
            const loader = document.getElementById('loader');
            const successMessage = document.getElementById('successMessage');
            const subfranchiseeSelect = document.getElementById('franchisee-select');
            const doctorSelecttag = document.getElementById('doctor-selection');
            const LabSelecttag = document.getElementById('lab-selection');
            const selectedTestsDropdown = document.getElementById('test-selected'); // Dropdown for selected test
            const ageValue = document.getElementById("ageValue").value;
            const ageUnit = document.getElementById("ageUnit").value;

            let patientAge = `${ageValue} ${ageUnit}`;


            try {
                loadingScreen.classList.add('active');
                loader.classList.add('loadervisible');
                // Create a FormData object
                const selectedOptions = subfranchiseeSelect.options[subfranchiseeSelect.selectedIndex];
                const selectedOptionValue = selectedOptions.value;
                const selectedOptionid = selectedOptions.getAttribute('id');

                const selectedDoctor = doctorSelecttag.options[doctorSelecttag.selectedIndex];
                const selectedDoctorValue = selectedDoctor.value;
                const selectedDoctorid = selectedDoctor.getAttribute('doctor-id');

                const selectedLab = LabSelecttag.options[LabSelecttag.selectedIndex];
                const selectedLabValue = selectedLab.value;
                const selectedLabid = selectedLab.getAttribute('Lab-id');

                let formData = new FormData();

                const bookingid = document.getElementById('random-id').value;
                const current_date = document.querySelector('input[type="date"]').value;
                const current_time = document.querySelector('input[type="time"]').value;
                const patient_name = document.getElementById('patient-name').value;
                const total = document.getElementById('total').innerText;
                // Get the selected test/package
                // let selectedTestId = [];
                //  const selectedTest = testSelection.options[testSelection.selectedIndex]; // Get selected test from the dropdown
                //  selectedTestId = selectedTest.id; // Get the test ID (which is stored in the option's id attribute)
                // formData.append('testId', selectedTestId);

                // Append all input values including the file
                formData.append('barcodeId', bookingid);
                formData.append('date', current_date);
                formData.append('time', current_time);
                formData.append('createdbyuser', username);
                formData.append('courierName', document.getElementById('courier-name').value);
                formData.append('courierId', document.getElementById('courier-id').value);
                formData.append('patientName', patient_name);
                formData.append('year', patientAge);
                formData.append('gender', document.getElementById('patient-gender').value);
                formData.append('patientPhone', document.getElementById('patient-phone').value);
                formData.append('doctorName', document.getElementById('doctor-name').value);
                formData.append('labName', document.getElementById('lab-name').value);
                formData.append('subFranchisee', selectedOptionValue);
                formData.append('subFranchiseeId', selectedOptionid || null);
                formData.append('savedDoctor', selectedDoctorValue);
                formData.append('savedDoctorId', selectedDoctorid || null);
                formData.append('savedLab', selectedLabValue);
                formData.append('savedLabId', selectedLabid || null);
                formData.append('franchisee', document.getElementById('franchisee-select').value);
                formData.append('clinicalHistory', document.getElementById('clinical-history').value);
                formData.append('total', total);
                formData.append('userId', userId);
                // Get the selected test/package IDs
                const selectedTestIds = []; // Initialize an array to store selected test IDs

                if (selectedTestsDropdown) {
                    const allselectedoptions = selectedTestsDropdown.querySelectorAll('span');
                    // console.log("Selected Tests Dropdown:", selectedTestsDropdown);
                    // console.log("All Selected Options:", allselectedoptions);

                    Array.from(allselectedoptions).forEach(option => {
                        const testId = option.getAttribute('data-id');
                        console.log("Test ID:", testId); // Log each test ID
                        if (testId) {
                            selectedTestIds.push(testId);
                        }
                    });

                } else {
                    console.error("Selected Tests Dropdown is empty or not found.");
                }

                if (!selectedTestsDropdown || selectedTestsDropdown.querySelectorAll('div').length === 0) {
                    console.error("Selected Tests Dropdown is empty or not found.");
                }
                // Append selected test IDs as a JSON string
                formData.append('testIds', JSON.stringify(selectedTestIds));
                console.log("Selected Test ID:", selectedTestIds); // Check if ID exists


                // Get the file input and append the file
                const file = document.querySelector('.file-input input[type="file"]').files[0];
                if (file) {
                    formData.append('file', file);  // Append the file to the FormData object
                }

                // Collect table data and append as a JSON string (or append each value individually)
                const tableData = [];
                const tableRows = document.querySelectorAll('#tableBody tr');
                tableRows.forEach((row, index) => {
                    if (index >= 0) {  // Ensure valid rows
                        const typeOfSample = row.cells[1].textContent.trim();
                        const barcodeId = row.cells[2].querySelector('input[name="barcodeId"]').value.trim();
                        const confirmBarcodeId = row.cells[2].querySelector('input[name="confirmBarcodeId"]').value.trim();
                        const testName = row.cells[3].textContent.trim();


                        if (barcodeId !== confirmBarcodeId) {

                            alert(`${barcodeId} and ${confirmBarcodeId} not match`);
                            throw new Error(`Row ${index + 1}: Entered Barcode ID and Confirm Barcode ID do not match.`);
                        }
                        tableData.push({ typeOfSample, confirmBarcodeId, testName });
                    }
                });

                //console.log("table ka data: ", tableData)
                // Append tableData as a JSON string
                formData.append('tableData', JSON.stringify(tableData));
                //console.log("that is the: ", formData);
                // Send the form data using fetch
                const response = await fetch(`${BASE_URL}/api/v1/user/new-booking`, {
                    method: 'POST',
                    body: formData // Pass FormData object directly
                });
                const data = await response.json();

                if (response.ok) {
                    successMessage.style.height = '4rem';
                    setTimeout(() => {
                        successMessage.style.height = '0rem';
                        location.reload();
                    }, 10000);
                    console.log("Test booked successfully")
                } else {
                    alert(data)
                    console.error("Error:", data);
                }
            } catch (error) {
                console.error("Error during booking:", error);
            } finally {
                // Hide the loading screen once content is loaded
                loadingScreen.classList.remove('active');
                loader.classList.remove('loadervisible')
            }
        });
    }

    async function lastBookingDatails() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/last-booking`, {
                method: "POST"
            })

            const data = await response.json();

            if (!response.ok || data?.status === "empty") {
                throw new Error("something went wrong")
            }

            document.getElementById('last-booking-id').innerText = data.bookingId || "_______";
            const dateFromDb = new Date(data?.date);
            const options = {
                day: 'numeric',
                month: 'long', // This will give you the full month name like "January"
                year: 'numeric'
            };
            const formattedDate = dateFromDb.toLocaleDateString('en-US', options);
            document.getElementById('last-booking-date').innerText = formattedDate || "______";
            document.getElementById('last-booking-time').innerText = data.time || "______";
            document.getElementById('last-booking-total').innerText = data.total || "______";
            document.getElementById('last-booking-patient').innerText = data.patientName || "______";

        } catch (error) {
            console.log(error.message);
        }
    }
    async function LabInput() {
        const LabSelectTag = document.getElementById('lab-selection');
        LabSelectTag.addEventListener('change', function () {
            const LabSelectTag = document.getElementById('lab-selection');
            const selectedLab = LabSelectTag.options[LabSelectTag.selectedIndex];
            const LabNameInputField = document.getElementById('lab-name');

            // Check if the selected option is disabled or has no value
            if (selectedLab.value === "NoLab" || !selectedLab.value) {
                LabNameInputField.value = ""; // Clear the input if the option is invalid
                LabNameInputField.style.backgroundColor = "white";
                LabNameInputField.style.cursor = "text";
                LabNameInputField.removeAttribute("readonly"); // Allow editing
                return;
            }

            // Update the input field with the selected option's text
            LabNameInputField.value = selectedLab.text;
            LabNameInputField.style.backgroundColor = "#3333331c";
            LabNameInputField.style.cursor = "not-allowed";
            LabNameInputField.setAttribute("readonly", true); // Make it readonly
        });
    }


    // (async function aut() {
    //     // Step 2: Event listener for franchisee selection
    //     const franchiseeSelect = document.getElementById('franchisee-select')
    //     franchiseeSelect.addEventListener("change", async function (e) {
    //         // Selected option
    //         const selectedOption = franchiseeSelect.selectedOptions[0];
    //         // Get the data-id from the selected option
    //         const selectedFranchiseeId = selectedOption.getAttribute("data-id");
    //         console.log(selectedFranchiseeId)
    //         if (selectedFranchiseeId !== "-- No Franchisee Selected --") {
    //             userId = selectedFranchiseeId
    //             try {
    //                 // Fetch data from all three APIs concurrently
    //                 const [testResponse, panelResponse, packageResponse] = await Promise.all([
    //                     fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}`, { method: "POST" }),
    //                     fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}`, { method: "POST" }),
    //                     fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}`, { method: "POST" })
    //                 ]);

    //                 // Check if all responses are successful
    //                 if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
    //                     throw new Error("One or more API requests failed");
    //                 }

    //                 // Parse JSON responses
    //                 const testData = await testResponse.json();
    //                 const panelData = await panelResponse.json();
    //                 const packageData = await packageResponse.json();
    //                 testSelection.innerHTML = '';
    //                 // Populate test options
    //                 testData.forEach(test => {
    //                     const testElement = document.createElement('option');
    //                     testElement.id = test.testId; // Set the ID based on the test's unique identifier
    //                     testElement.classList.add('tests-name-option');
    //                     testElement.setAttribute('data-price', test.finalPrice);
    //                     testElement.setAttribute('sample-Type', test.sampleType);
    //                     testElement.setAttribute('data-id', test.testId)
    //                     testElement.innerText = `${test.testName}`;
    //                     testSelection.appendChild(testElement);
    //                 });
    //                 console.log(panelData)
    //                 // Populate panel options
    //                 panelData.forEach(panel => {
    //                     const testElement = document.createElement('option');
    //                     testElement.id = panel.panelId; // Set the ID based on the test's unique identifier
    //                     testElement.classList.add('tests-name-option');
    //                     testElement.setAttribute('data-price', panel.finalPrice);
    //                     testElement.setAttribute('sample-Type', panel.sampleType);
    //                     testElement.setAttribute('data-value', panel.panelId)
    //                     testElement.innerText = `${panel.panelName}`;
    //                     testSelection.appendChild(testElement);
    //                 });
    //                 console.log(packageData)
    //                 // Populate package options
    //                 packageData.forEach(pkg => {
    //                     const testElement = document.createElement('option');
    //                     testElement.id = pkg.packageId; // Set the ID based on the test's unique identifier
    //                     testElement.classList.add('tests-name-option');
    //                     testElement.setAttribute('data-value', pkg.packageId)
    //                     testElement.setAttribute('data-price', pkg.finalPrice);

    //                     // Combine test samples and panel samples, remove duplicates and nulls
    //                     const combinedSamples = [...pkg.sampleType, ...pkg.sample_types];
    //                     const uniqueCombinedSamples = [...new Set(combinedSamples)];
    //                     const arrayWithoutNull = uniqueCombinedSamples.filter(item => item !== null);
    //                     testElement.setAttribute('sample-Type', arrayWithoutNull);

    //                     testElement.innerText = `${pkg.packageName}`;
    //                     testSelection.appendChild(testElement);
    //                 });

    //                 testSelectionfunction()
    //             } catch (error) {
    //                 console.error("Error fetching and populating options:", error);
    //             }
    //         }
    //     })
    // })();




    async function initialization() {
        const functions = [
            fetchAndPopulateOptions,
            lastBookingDatails,
            //  databasesubfranchisee,
            databaseDoctors,
            databaseLab,
            currentDateandTime,
            doctorInput,
            LabInput,
            addlabfunction,
            addingLabtodatabase,
            addingdoctortodatabase,
            addDoctorpage,
            testSelectionfunction,
            submitNewBooking,
        ];

        for (const func of functions) {
            try {
                await func(); // Execute each function
            } catch {
                // Ignore the error and continue with the next function
            }
        }
    }
    await initialization();




}
bookingload();
