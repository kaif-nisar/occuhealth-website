function bookingload() {
    let totalprice = document.querySelector('#header span');
    const testSelection = document.getElementById('test-selection');
    testSelection.innerHTML = '';
    let total = 0;
    
    
    // for fetching tests 
    async function databaseTests() {
    
        let randomId = "HL" + Math.floor(Math.random() * 10000000000);
        document.getElementById('random-id').value = randomId;
        console.log(randomId);
    
        const response = await fetch(`${BASE_URL}/api/v1/user/test`, { method: "POST" })
        const tests = await response.json();
    
        tests.forEach(test => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('tests-name-option');
            testElement.setAttribute('data-price', test.Price);
            testElement.setAttribute('sample-Type', test.sampleType);
    
            testElement.innerText = `${test.Name}`;
            testSelection.appendChild(testElement);
        });
    }
    
    // for fetching pannels
    async function databasepannels() {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels`, { method: "POST" })
        const tests = await response.json();
    
        tests.forEach(test => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('tests-name-option');
            testElement.setAttribute('data-price', test.price);
            testElement.setAttribute('sample-Type', test.sample_types);
    
            testElement.innerText = `${test.name}`;
            testSelection.appendChild(testElement);
        });
    }
    
    // for fetching packages
    async function databasepackages() {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-packages`, { method: "POST" })
        const tests = await response.json();
    
        tests.forEach(test => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('tests-name-option');
            testElement.setAttribute('data-price', test.packageFee);
    
            const combinedSamples = [...test.testSample, ...test.pannelSample];
            const uniqueCombinedSamples = [...new Set(combinedSamples)];
            const arrayWithoutNull = uniqueCombinedSamples.filter(item => item !== null);
            testElement.setAttribute('sample-Type', arrayWithoutNull);
    
            testElement.innerText = `${test.packageName}`;
            testSelection.appendChild(testElement);
        });
    }
    
    // for fetching sub-franchisees
    async function databasesubfranchisee() {
        const response = await fetch('http://localhost:8000/api/v1/users/all-subfranchisee', { method: "POST" })
        const allsubfran = await response.json();
        const subFranchiseeSelect = document.getElementById('franchisee-select');
    
        allsubfran.forEach(subfran => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('subFranchisee-option');
            testElement.setAttribute("id", subfran._id);
            console.log(subfran._id);
    
            testElement.innerText = `${subfran.fullname}`;
            subFranchiseeSelect.appendChild(testElement);
        });
    }
    
    // for fetching doctors
    async function databaseDoctors() {
    
        const response = await fetch('http://localhost:8000/api/v1/users/all-doctor', { method: "POST" })
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
    }
    
    // for Lab select
    async function databaseLab() {
    
        const response = await fetch('http://localhost:8000/api/v1/users/all-Lab', { method: "POST" })
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
    }
    
    function addlabfunction() {
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
                let trueOrfalse = sampletype.includes(',');  // check if multiple sample types exist
                let sameSample = false;
                let rows = tableBody.querySelectorAll('tr');
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
    
                // Add the selected test to the selected list
                const selectedOptions = document.createElement("option");
                selectedOptions.innerText = tests.innerText;
                selectedOptions.classList.add('realSelectedTests');
                tests.style.display = "none";  // hide the selected test in the dropdown
                let testPrice = tests.getAttribute('data-price');
                total = total + parseFloat(testPrice);
                totalprice.innerText = total;
                selectedOptions.setAttribute('data-price', testPrice);
                selectedtests.appendChild(selectedOptions);
    
                // Delete test functionality
                selectedOptions.addEventListener('click', function () {
                    let removingTestPrice = selectedOptions.getAttribute('data-price');
                    total = total - parseFloat(removingTestPrice);  // Subtract price from total
                    totalprice.innerText = total;
    
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
            if (option.innerText.toLowerCase().includes(searchQuery)) {
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
            if (option.innerText.toLowerCase().includes(searchQuery)) {
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
    }
    
    // adding doctor to database
    function addingdoctortodatabase() {
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
                address: document.getElementById('address').value
            };
    
            // Send the data to the backend using fetch
            fetch('http://localhost:8000/api/v1/users/add-doctor', {
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
    }
    
    // adding Lab to database
    function addingLabtodatabase() {
        const addDoctorBtn = document.getElementById('add-lab');
    
        // Add event listener to the Add Doctor button
        addDoctorBtn.addEventListener('click', function () {
            // Gather form data
            const LabData = {
                LabName: document.getElementById('lab-name2').value,
                LabAddress: document.getElementById('lab-address').value,
            };
    
            console.log(LabData);
    
            // Send the data to the backend using fetch
            fetch('http://localhost:8000/api/v1/users/add-Lab', {
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
    }
    
    let submitButton;
    
    function currentDateandTime() {
        // Get the input elements
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
    
            const ageValue = document.getElementById("ageValue").value;
            const ageUnit = document.getElementById("ageUnit").value;
    
            let patientAge = `${ageValue} ${ageUnit}`;
    
            console.log(`Age: ${ageValue} ${ageUnit}`); // e.g., "Age: 25 Year"
    
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
    
                // Append all input values including the file
                formData.append('barcodeId', bookingid);
                formData.append('date', current_date);
                formData.append('time', current_time);
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
                            throw new Error(`Row ${index + 1}: Entered Barcode ID and Confirm Barcode ID do not match.`);
                        }
    
                        tableData.push({ typeOfSample, barcodeId, testName });
                    }
                });
    
                console.log("table ka data: ", tableData)
                // Append tableData as a JSON string
                formData.append('tableData', JSON.stringify(tableData));
                console.log("that is the: ", formData);
                // Send the form data using fetch
                const response = await fetch('http://localhost:8000/api/v1/users/new-booking', {
                    method: 'POST',
                    body: formData // Pass FormData object directly
                });
    
                const data = await response.json();
                if (response.ok) {
                    successMessage.style.height = '4rem';
                    setTimeout(() => {
                        successMessage.style.height = '0rem';
                    }, 10000);
                    console.log("Test booked successfully")
                } else {
                    alert(data)
                }
            } catch (error) {
                //alert("Error during booking:", error);
            } finally {
                // Hide the loading screen once content is loaded
                loadingScreen.classList.remove('active');
                loader.classList.remove('loadervisible')
            }
        });
    }
    
    async function lastBookingDatails() {
        try {
            const response = await fetch('http://localhost:8000/api/v1/users/last-booking', {
                method: "POST"
            })
            if (!response.ok) {
                throw new Error("something went wrong")
            }
    
            const data = await response.json();
    
            document.getElementById('last-booking-id').innerText = data.bookingId;
            const dateFromDb = new Date(data.date);
            const options = {
                day: 'numeric',
                month: 'long', // This will give you the full month name like "January"
                year: 'numeric'
            };
            const formattedDate = dateFromDb.toLocaleDateString('en-US', options);
            document.getElementById('last-booking-date').innerText = formattedDate;
            document.getElementById('last-booking-time').innerText = data.time;
            document.getElementById('last-booking-total').innerText = data.total;
            document.getElementById('last-booking-patient').innerText = data.patientName;
    
        } catch (error) {
            alert(error)
        }
    }
    
    async function initialization() {
        await databaseTests();
        await databasepannels();
        await databasepackages();
        await lastBookingDatails();
        await databasesubfranchisee();
        await databaseDoctors();
        await databaseLab();
        currentDateandTime();
        addlabfunction();
        addingLabtodatabase();
        addingdoctortodatabase();
        addDoctorpage();
        testSelectionfunction();
        submitNewBooking();
    }
    
    initialization();
}
bookingload();