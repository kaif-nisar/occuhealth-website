async function bookingload() {
    let totalprice = document.querySelector('#header span');
    let patientamount = document.querySelector('#header2 span');
    let discountinput = document.getElementById('discount-amount');
    const testSelection = document.getElementById('test-selection');
    const discountpercentage = document.getElementById('discount-percentage');
    testSelection.innerHTML = '';
    let total = 0;
    let booking;

    document.getElementById("closeNote").addEventListener("click", () => {
        document.getElementById("noteContainer").style.display = "none";
    });

    async function getBookingAndPopulate() {
        // 1️⃣ Get the `id` param from URL
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("id");

        if (!id) {
            alert("Booking ID not found in URL");
            return;
        }

        try {
            // 2️⃣ Call the /getbooking endpoint
            const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ value1: id }),
            });

            const data = await response.json();
            booking = data;

            if (!data || !data._id) {
                alert(data.message || "Booking not found");
                return;
            }

            if (data.status !== "On Hold") {
                document.querySelector('.container-new-booking').style.display = "none";
                document.querySelector('.editbarcodebutton').style.display = "none";
                document.getElementById("noteContainer").style.display = "flex";
            }
            // 3️⃣ TableData से फील्ड बनाओ
            const form = document.getElementById("editForm");
            form.innerHTML = ""; // पुराना क्लियर कर दो

            if (Array.isArray(data.tableData)) {
                data.tableData.forEach((entry, index) => {
                    const div = document.createElement("div");
                    div.classList.add(
                        "flex",
                        "flex-col",
                        "sm:flex-row",
                        "sm:items-center",
                        "gap-2",
                        "mb-3"
                    );

                    div.innerHTML = `
      <span class="text-sm text-gray-600 w-32">${entry.typeOfSample || "Sample Type"}</span>
      <input
        type="text"
        id="${entry._id}"
        name="barcodeId-${index}"
        value="${entry.barcodeId || ""}"
        class="mt-1 block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
      />
    `;

                    form.appendChild(div);
                });
            }
            barcodeupdate(data);

            // Populate random ID
            document.getElementById('random-id').value = data.bookingId || '';

            // Populate date and time
            if (data.date) {
                document.getElementById('dob').value = new Date(data.date).toISOString().split('T')[0];
            }
            if (data.time) {
                document.getElementById('time').value = data.time;
            }

            // Populate courier details
            document.getElementById('courier-name').value = data.courierName || '';
            document.getElementById('courier-id').value = data.courierId || '';

            // Populate patient details
            document.getElementById('patient-name').value = data.patientName || '';
            const [ageValue, ageUnit] = data.year.split(' ');
            document.getElementById('ageValue').value = parseInt(ageValue, 10) || '';
            document.getElementById('ageUnit').value = ageUnit.toLowerCase() || 'years';
            document.getElementById('patient-gender').value = data.gender || 'Any';
            document.getElementById('patient-phone').value = data.patientPhone || '';

            // Populate doctor details
            // document.getElementById('doctor-selection').innerHTML = `
            //     <option selected>${data.savedDoctor || '-- No Doctors Selected --'}</option>
            // `;
            document.getElementById('doctor-name').value = data.doctorName || '';

            // Populate lab details
            // document.getElementById('lab-selection').innerHTML = `
            //     <option selected>${data.savedLab || '-- No Lab Selected --'}</option>
            // `;
            document.getElementById('lab-name').value = data.labName || '';

            // Populate franchisee
            document.getElementById('franchisee-select').innerHTML = `
        <option selected>${data.franchisee || '-- No Franchisee Selected --'}</option>
        `;

            // Populate clinical history
            document.getElementById('clinical-history').value = data.clinicalHistory || '';

            // Handle file input (if needed)
            if (data.file) {
                console.log("File upload functionality is pending integration.");
            }

            const allTests = document.querySelectorAll("#test-selection span");

            for (const span of allTests) {
                const testString = span.textContent.trim();

                // Check if any testName includes this text
                let shouldHide = false;

                for (const obj of data.tableData) {
                    if (obj.testName && obj.testName.includes(testString)) {
                        shouldHide = true;
                        break;
                    }
                }

                if (shouldHide) {
                    span.style.display = "none";
                }
            }


        } catch (error) {
            console.error("Error fetching booking:", error);
            alert("Something went wrong while fetching booking.");
        }
    }

    if (user.role === "admin" && user.tenantId.modelType === "1layer") {
        singlelayerfunction();
    }

    function singlelayerfunction() {
        const discountsection = document.querySelectorAll('.discountsection');
        discountsection.forEach((element) => {
            element.style.display = "block";
        })
    }

    // for fetching tests 
    async function fetchAndPopulateOptions() {
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
                testElement.setAttribute('data-price', test.basePrice);
                testElement.setAttribute('sample-Type', test.sampleType);
                testElement.setAttribute('data-id', test.testId)
                testElement.setAttribute('data-collection', "testSchema")

                testElement.setAttribute('shortname', test.Short_name)
                testElement.innerText = `${test.testName}`;
                testSelection.appendChild(testElement);
            });
            // Populate panel options
            panelData.forEach(panel => {
                const testElement = document.createElement('span');
                testElement.id = panel.panelId; // Set the ID based on the test's unique identifier
                testElement.classList.add('tests-name-option');
                testElement.setAttribute('data-price', panel.basePrice);
                testElement.setAttribute('sample-Type', panel.sampleType);
                testElement.setAttribute('data-collection', "addPannel")
                testElement.setAttribute('data-id', panel.panelId);

                testElement.setAttribute('data-value', panel.panelId)
                testElement.innerText = `${panel.panelName}`;
                testSelection.appendChild(testElement);
            });
            // Populate package options
            packageData.forEach(pkg => {
                const testElement = document.createElement('span');
                testElement.id = pkg.packageId; // Set the ID based on the test's unique identifier
                testElement.classList.add('tests-name-option');
                testElement.setAttribute('data-value', pkg.packageId)
                testElement.setAttribute('data-id', pkg.packageId)

                testElement.setAttribute('data-price', pkg.basePrice);
                testElement.setAttribute('data-collection', "Package")


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

    // for fetching sub-franchisees
    async function databasesubfranchisee() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { method: "GET" })
            const allsubfran = await response.json();
            const subFranchiseeSelect = document.getElementById('franchisee-select');
            allsubfran.message.forEach(subfran => {
                const testElement = document.createElement('option');
                testElement.id = "tests-name-option";
                testElement.classList.add('subFranchisee-option');
                testElement.setAttribute("data-id", subfran._id);

                testElement.innerText = `${subfran.fullName}`;
                subFranchiseeSelect.appendChild(testElement);
            });
        } catch (error) {
            console.error("Sub franchisee not created")
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

    // Helper function to find test name by ID and collection
    function findTestNameByIdAndCollection(testId, collectionName) {
        const selector = `.tests-name-option[data-id="${testId}"][data-collection="${collectionName}"]`;
        const option = document.querySelector(selector);
        return option ? option.innerText : "";
    }

    // Helper function to rebuild test names in table row
    function rebuildTestNamesInRow(row) {
        const testData = JSON.parse(row.getAttribute("data-test-data") || "[]");
        const names = testData.map(item =>
            findTestNameByIdAndCollection(item.id, item.collectionName)
        ).filter(Boolean);

        if (row.cells && row.cells[3]) {
            row.cells[3].innerText = names.join(', ');
        }
    }

    function reindexRows() {
        const rows = document.querySelectorAll('#tableBody tr');
        rows.forEach((row, index) => {
            const firstCell = row.querySelector('td');
            if (firstCell) {
                firstCell.innerText = index + 1;
            }
        });
    }

    async function testSelectionfunction() {
        let selectedtests = document.getElementById('test-selected');
        let allTests = document.querySelectorAll(".tests-name-option");
        let tableBody = document.getElementById("tableBody");

        if (!tableBody) {
            console.warn("tableBody not found");
            return;
        }

        allTests.forEach(tests => {
            tests.addEventListener("click", function () {
                const sampletype = tests.getAttribute('sample-Type');
                const shortName = tests.getAttribute('shortname');
                const testId = tests.getAttribute('data-id');
                const collectionName = tests.getAttribute('data-collection');

                if (!sampletype || !testId || !collectionName) {
                    console.warn("Missing test attributes");
                    return;
                }

                const trueOrfalse = sampletype.includes(',');
                const rows = tableBody.querySelectorAll('tr');

                if (trueOrfalse) {
                    // Multiple sample types
                    let samplearray = [...new Set(sampletype.split(','))];

                    samplearray.forEach(sample => {
                        let rowExists = false;

                        rows.forEach(row => {
                            if (row.cells && row.cells[1]) {
                                const rowSampleType = row.cells[1].innerText;
                                const rowBarcodeId = row.cells[2].querySelector('input[name="barcodeId"]')?.value;

                                // Check if same sample type exists
                                if (rowSampleType === sample) {
                                    // Add test object to row's data-test-data
                                    let testData = JSON.parse(row.getAttribute("data-test-data") || "[]");

                                    // Check if test already exists
                                    if (!testData.some(item => item.id === testId && item.collectionName === collectionName)) {
                                        testData.push({ id: testId, collectionName: collectionName });
                                    }

                                    row.setAttribute("data-test-data", JSON.stringify(testData));

                                    // Rebuild test names
                                    rebuildTestNamesInRow(row);
                                    rowExists = true;
                                }
                            }
                        });

                        if (!rowExists) {
                            // Find matching sample from existing booking
                            const match = booking.tableData.find(
                                (el) => el.typeOfSample.trim().toLowerCase() === sample.trim().toLowerCase()
                            );
                            const number = match ? match.barcodeId : "";

                            let createRow = document.createElement('tr');
                            createRow.setAttribute("data-test-data", JSON.stringify([{ id: testId, collectionName: collectionName }]));

                            const order = tableBody.querySelectorAll('tr').length + 1;

                            const barcodeInput = document.createElement("input");
                            barcodeInput.type = "text";
                            barcodeInput.placeholder = "Enter barcodeId";
                            barcodeInput.name = "barcodeId";
                            barcodeInput.value = number;

                            if (match) {
                                barcodeInput.setAttribute('readonly', true);
                                barcodeInput.style.backgroundColor = "#3333331c";
                                barcodeInput.style.cursor = "not-allowed";
                            }

                            const confirmInput = document.createElement("input");
                            confirmInput.type = "text";
                            confirmInput.placeholder = "Enter SampleId";
                            confirmInput.name = "confirmBarcodeId";
                            confirmInput.value = number;

                            if (match) {
                                confirmInput.setAttribute('readonly', true);
                                confirmInput.style.backgroundColor = "#3333331c";
                                confirmInput.style.cursor = "not-allowed";
                            }

                            createRow.innerHTML = `
                            <td>${order}</td>
                            <td>${sample}</td>
                            <td></td>
                            <td>${tests.innerText}</td>
                        `;

                            createRow.cells[2].appendChild(barcodeInput);
                            createRow.cells[2].appendChild(document.createElement("br"));
                            createRow.cells[2].appendChild(confirmInput);

                            tableBody.appendChild(createRow);
                        }
                    });
                } else {
                    // Single sample type
                    let rowExists = false;

                    rows.forEach(row => {
                        if (row.cells && row.cells[1]) {
                            const rowSampleType = row.cells[1].innerText;

                            if (rowSampleType === sampletype) {
                                // Add test object to row's data-test-data
                                let testData = JSON.parse(row.getAttribute("data-test-data") || "[]");

                                // Check if test already exists
                                if (!testData.some(item => item.id === testId && item.collectionName === collectionName)) {
                                    testData.push({ id: testId, collectionName: collectionName });
                                }

                                row.setAttribute("data-test-data", JSON.stringify(testData));

                                // Rebuild test names
                                rebuildTestNamesInRow(row);
                                rowExists = true;
                            }
                        }
                    });

                    if (!rowExists) {
                        // Find matching sample from existing booking
                        const match = booking.tableData.find(
                            (el) => el.typeOfSample.trim().toLowerCase() === sampletype.trim().toLowerCase()
                        );
                        const number = match ? match.barcodeId : "";

                        let createRow = document.createElement('tr');
                        createRow.setAttribute("data-test-data", JSON.stringify([{ id: testId, collectionName: collectionName }]));

                        const order = tableBody.querySelectorAll('tr').length + 1;

                        const barcodeInput = document.createElement("input");
                        barcodeInput.type = "text";
                        barcodeInput.placeholder = "Enter barcodeId";
                        barcodeInput.name = "barcodeId";
                        barcodeInput.value = number;

                        if (match) {
                            barcodeInput.setAttribute('readonly', true);
                            barcodeInput.style.backgroundColor = "#3333331c";
                            barcodeInput.style.cursor = "not-allowed";
                        }

                        const confirmInput = document.createElement("input");
                        confirmInput.type = "text";
                        confirmInput.placeholder = "Enter SampleId";
                        confirmInput.name = "confirmBarcodeId";
                        confirmInput.value = number;

                        if (match) {
                            confirmInput.setAttribute('readonly', true);
                            confirmInput.style.backgroundColor = "#3333331c";
                            confirmInput.style.cursor = "not-allowed";
                        }

                        createRow.innerHTML = `
                        <td>${order}</td>
                        <td>${sampletype}</td>
                        <td></td>
                        <td>${tests.innerText}</td>
                    `;

                        createRow.cells[2].appendChild(barcodeInput);
                        createRow.cells[2].appendChild(document.createElement("br"));
                        createRow.cells[2].appendChild(confirmInput);

                        tableBody.appendChild(createRow);
                    }
                }

                reindexRows();

                // Add selected test tag
                const selectedOptions = document.createElement("span");
                selectedOptions.innerText = tests.innerText;
                selectedOptions.classList.add('realSelectedTests');
                tests.style.display = "none";

                let testPrice = tests.getAttribute('data-price');
                total += Math.floor(testPrice || 0);

                if (totalprice) totalprice.innerText = `${total}.00`;
                if (patientamount) patientamount.innerText = `${total}.00`;

                // Update discount calculations
                const rawValue = discountinput.value.trim();
                const inputvalue = parseFloat(rawValue);
                if (inputvalue > total && !isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                    patientamount.innerText = 0;
                    discountpercentage.value = "100%";
                } else if (!isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                    patientamount.innerText = total - inputvalue;
                    const percentage = ((parseFloat(inputvalue) / parseFloat(total)) * 100).toFixed(2);
                    discountpercentage.value = percentage + "%";
                } else {
                    discountpercentage.value = "0%";
                    if (patientamount) {
                        patientamount.innerText = total.toFixed(2);
                    }
                }

                selectedOptions.setAttribute('data-price', testPrice);
                selectedOptions.setAttribute('data-id', testId);
                selectedOptions.setAttribute('shortname', shortName || '');
                selectedOptions.setAttribute('data-collection', collectionName);
                selectedtests.appendChild(selectedOptions);

                // Remove selected test functionality
                selectedOptions.addEventListener('click', function () {
                    let removingTestPrice = selectedOptions.getAttribute('data-price');
                    let removingTestId = selectedOptions.getAttribute('data-id');
                    let removingCollection = selectedOptions.getAttribute('data-collection');

                    total -= Math.floor(removingTestPrice || 0);
                    if (totalprice) totalprice.innerText = `${total}.00`;
                    if (patientamount) patientamount.innerText = `${total}.00`;

                    // Update discount calculations
                    const rawValue = discountinput.value.trim();
                    const inputvalue = parseFloat(rawValue);
                    if (inputvalue > total && !isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                        patientamount.innerText = 0;
                        discountpercentage.value = "100%";
                    } else if (!isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                        patientamount.innerText = total - inputvalue;
                        const percentage = ((parseFloat(inputvalue) / parseFloat(total)) * 100).toFixed(2);
                        discountpercentage.value = percentage + "%";
                    } else {
                        discountpercentage.value = "0%";
                        if (patientamount) {
                            patientamount.innerText = total.toFixed(2);
                        }
                    }

                    tests.style.display = "block";
                    selectedOptions.remove();

                    // Remove from table and rebuild names
                    let rows = tableBody.querySelectorAll('tr');
                    rows.forEach(row => {
                        let testData = JSON.parse(row.getAttribute("data-test-data") || "[]");

                        // Remove test object using id and collection
                        testData = testData.filter(item => !(item.id === removingTestId && item.collectionName === removingCollection));
                        row.setAttribute("data-test-data", JSON.stringify(testData));

                        if (testData.length > 0) {
                            // Rebuild the test names properly
                            rebuildTestNamesInRow(row);
                        } else {
                            row.remove();
                            reindexRows();
                        }
                    });
                });
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

    // Updated submitNewBooking to include ids in tableData
    async function submitNewBooking() {
        submitButton = document.getElementById('submit-btn');
        if (!submitButton) {
            console.error("Submit button not found");
            return;
        }

        submitButton.addEventListener('click', async function () {
            const tablerows = document.querySelectorAll(".details-section table tbody tr");
            const array = [];

            if (tablerows) {
                for (const row of tablerows) {
                    const inputvalue = row.querySelector("input[name='barcodeId']").value.trim();

                    if (array.includes(inputvalue)) {
                        document.querySelector('.details-section span').style.display = "block";
                        return;
                    } else {
                        array.push(inputvalue);
                    }
                }
            }

            const successMessage = document.getElementById('successMessage');
            const subfranchiseeSelect = document.getElementById('franchisee-select');
            const doctorSelecttag = document.getElementById('doctor-selection');
            const LabSelecttag = document.getElementById('lab-selection');
            const selectedTestsDropdown = document.getElementById('test-selected');

            const ageValue = document.getElementById("ageValue").value;
            const ageUnit = document.getElementById("ageUnit").value;
            let patientAge = `${ageValue} ${ageUnit}`;

            try {
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
                formData.append('discountamount', document.getElementById('discount-amount').value);
                formData.append('discountunit', document.getElementById('discount-percentage').value.replace('%', ''));

                // Get selected test IDs
                const selectedTestIds = [];
                if (selectedTestsDropdown) {
                    const allselectedoptions = selectedTestsDropdown.querySelectorAll('span');
                    Array.from(allselectedoptions).forEach(option => {
                        const testId = option.getAttribute('data-id');
                        if (testId) {
                            selectedTestIds.push(testId);
                        }
                    });
                }
                formData.append('testIds', JSON.stringify(selectedTestIds));

                // Get file
                const file = document.querySelector('.file-input input[type="file"]').files[0];
                if (file) {
                    formData.append('file', file);
                }

                // Collect table data WITH ids array
                const tableData = [];
                const tableRows = document.querySelectorAll('#tableBody tr');
                tableRows.forEach((row, index) => {
                    if (row.cells && row.cells.length >= 4) {
                        const typeOfSample = row.cells[1].textContent.trim();
                        const barcodeId = row.cells[2].querySelector('input[name="barcodeId"]').value.trim();
                        const confirmBarcodeId = row.cells[2].querySelector('input[name="confirmBarcodeId"]').value.trim();
                        const testName = row.cells[3].textContent.trim();

                        // GET IDS FROM data-test-data attribute
                        const ids = JSON.parse(row.getAttribute("data-test-data") || "[]");

                        if (barcodeId !== confirmBarcodeId) {
                            alert(`${barcodeId} and ${confirmBarcodeId} not match`);
                            throw new Error(`Row ${index + 1}: Entered Barcode ID and Confirm Barcode ID do not match.`);
                        }

                        tableData.push({ typeOfSample, confirmBarcodeId, testName, ids });
                    }
                });

                formData.append('tableData', JSON.stringify(tableData));

                const response = await fetch(`${BASE_URL}/api/v1/user/editbookingbookedtests`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                userId = userRole;

                if (response.ok) {
                    handleSuccess(data);
                } else {
                    handleError(response.status, data);
                }
            } catch (error) {
                console.error("Error during booking:", error);
            }
        });
    }

    function handleSuccess(data) {
        showNotification({
            type: 'success',
            title: 'Success!',
            message: data.message || "Edited successfully!",
            duration: 2000,
            onClose: () => location.reload()
        });
    }

    function handleError(statusCode, data) {
        let title = 'Error';
        let message = data.message || "Something went wrong!";

        // Handle specific error cases
        switch (statusCode) {
            case 400:
                title = 'Validation Error';
                if (data.duplicateTests?.length > 0) {
                    message += '\n\nAlready exists: ' + data.duplicateTests.join(', ');
                }
                break;
            case 404:
                title = 'Not Found';
                message = data.message || "Booking not found!";
                break;
            case 402:
                title = 'Payment Required';
                message = data.message || "Insufficient balance!";
                break;
            case 500:
                title = 'Server Error';
                message = "Server error occurred. Please try again later.";
                break;
            default:
                title = `Error ${statusCode}`;
        }

        showNotification({
            type: 'error',
            title: title,
            message: message,
            duration: 10000,
            onClose: null // Don't reload on error
        });
    }

    function handleNetworkError(error) {
        showNotification({
            type: 'error',
            title: 'Network Error',
            message: 'Unable to connect. Please check your internet connection.',
            duration: 5000
        });
        console.error('Network error:', error);
    }

    function showNotification({ type, title, message, duration, onClose }) {
        const notification = document.getElementById('successMessage');

        notification.className = `notification ${type}`; // Add CSS classes
        notification.innerHTML = `
        <strong>${title}</strong>
        <p>${message}</p>
    `;

        notification.style.height = 'auto';
        notification.style.opacity = '1';

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.height = '0';
                notification.innerHTML = '';
                if (onClose) onClose();
            }, 300); // Fade out animation
        }, duration);
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


    (async function aut() {
        // Step 2: Event listener for franchisee selection
        const franchiseeSelect = document.getElementById('franchisee-select')
        franchiseeSelect.addEventListener("change", async function (e) {
            // Selected option
            const selectedOption = franchiseeSelect.selectedOptions[0];
            // Get the data-id from the selected option
            const selectedFranchiseeId = selectedOption.getAttribute("data-id");
            if (selectedFranchiseeId !== "-- No Franchisee Selected --") {
                userId = selectedFranchiseeId
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
                        const testElement = document.createElement('option');
                        testElement.id = test.testId; // Set the ID based on the test's unique identifier
                        testElement.classList.add('tests-name-option');
                        testElement.setAttribute('data-price', test.finalPrice);
                        testElement.setAttribute('sample-Type', test.sampleType);
                        testElement.setAttribute('data-id', test.testId)
                        testElement.setAttribute('data-id', panel.panelId);

                        testElement.setAttribute('data-collection', "testSchema")
                        testElement.innerText = `${test.testName}`;
                        testSelection.appendChild(testElement);
                    });
                    // Populate panel options
                    panelData.forEach(panel => {
                        const testElement = document.createElement('option');
                        testElement.id = panel.panelId; // Set the ID based on the test's unique identifier
                        testElement.classList.add('tests-name-option');
                        testElement.setAttribute('data-price', panel.finalPrice);
                        testElement.setAttribute('sample-Type', panel.sampleType);
                        testElement.setAttribute('data-value', panel.panelId)
                        testElement.setAttribute('data-collection', "addPannel")

                        testElement.innerText = `${panel.panelName}`;
                        testSelection.appendChild(testElement);
                    });
                    // Populate package options
                    packageData.forEach(pkg => {
                        const testElement = document.createElement('option');
                        testElement.id = pkg.packageId; // Set the ID based on the test's unique identifier
                        testElement.classList.add('tests-name-option');
                        testElement.setAttribute('data-value', pkg.packageId)
                        testElement.setAttribute('data-id', pkg.packageId)

                        testElement.setAttribute('data-price', pkg.finalPrice);
                        testElement.setAttribute('data-collection', "Package")

                        // Combine test samples and panel samples, remove duplicates and nulls
                        const combinedSamples = [...pkg.sampleType, ...pkg.sample_types];
                        const uniqueCombinedSamples = [...new Set(combinedSamples)];
                        const arrayWithoutNull = uniqueCombinedSamples.filter(item => item !== null);
                        testElement.setAttribute('sample-Type', arrayWithoutNull);

                        testElement.innerText = `${pkg.packageName}`;
                        testSelection.appendChild(testElement);
                    });

                    testSelectionfunction()
                } catch (error) {
                    console.error("Error fetching and populating options:", error);
                }
            }
        })

        discountinput.addEventListener('input', function () {
            const rawValue = this.value.trim();
            const inputvalue = parseFloat(rawValue);
            if (inputvalue > total && !isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                patientamount.innerText = 0;
                discountpercentage.value = "100%";
            } else if (!isNaN(inputvalue) && inputvalue >= 0 && total > 0) {
                patientamount.innerText = total - inputvalue;
                const percentage = ((parseFloat(inputvalue) / parseFloat(total)) * 100).toFixed(2);
                discountpercentage.value = percentage + "%";
            } else {
                discountpercentage.value = "0%";
                if (patientamount) {
                    patientamount.innerText = total.toFixed(2);
                }
            }
        })
    })();




    async function initialization() {
        const functions = [
            getBookingAndPopulate,

            fetchAndPopulateOptions,
            lastBookingDatails,
            databasesubfranchisee,
            databaseDoctors,
            databaseLab,
            doctorInput,
            LabInput,
            addlabfunction,
            addingLabtodatabase,
            addingdoctortodatabase,
            addDoctorpage,
            testSelectionfunction,
            submitNewBooking,
            barcodeupdate
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
    function barcodeupdate(data) {
        const array = data.tableData;

        document.getElementById("cancelbooking").addEventListener("click", async () => {
            const confirmCancel = confirm("Are you sure you want to cancel this booking? This action cannot be undone.");
            if (!confirmCancel) {
                return; // User clicked 'Cancel'
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/bookings/cancel`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ bookingId: data.bookingId })
                });

                const datafromresponse = await response.json();
                if (response.ok) {
                    alert(datafromresponse.message);
                    location.reload();
                } else {
                    alert(datafromresponse.message);
                }
            } catch (error) {
                console.error("Error updating booking status:", error);
                alert("An error occurred. Please try again.");
            }
        });

        document.getElementById("openEditPopup").addEventListener("click", () => {
            document.getElementById("editPopup").classList.remove("hidden");
        });

        document.getElementById("closeEditPopup").addEventListener("click", () => {
            document.getElementById("editPopup").classList.add("hidden");
        });

        document.getElementById("saveEditForm").addEventListener("click", async () => {
            const inputs = document.querySelectorAll("#editForm input");

            // Update array barcodeIds
            inputs.forEach((element) => {
                const objid = element.id;
                array.forEach((obj) => {
                    if (obj._id.toString() === objid.toString()) {
                        obj.barcodeId = element.value.trim();
                    }
                });
            });

            console.log("array:", array);

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/editBookingBarcodes`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: data._id, tableData: array }),
                });

                const responsedata = await response.json();
                if (response.ok) {
                    alert(responsedata.message || "Barcodes updated successfully.");
                    document.getElementById("editPopup").classList.add("hidden");
                } else {
                    alert(responsedata.message || "Failed to update barcodes.");
                }
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred while updating barcodes.");
            }
        });
    }
}
bookingload();