// Extract value1 from the current URL
const params = new URLSearchParams(window.location.search);
const value1 = params.get('value1');
async function sendValue1ToApi() {
    try {

        if (!value1) {
            console.error("Value1 not found in the URL.");
            return;
        }

        // Send the data to the API
        const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, { // Replace with your API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value1 })
        });

        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        populateFormData(data);
        await databaseDoctors(data.createdBy);
        await databaseLab(data.createdBy);
        await databasesubfranchisee(data.createdBy);
    } catch (error) {
        console.error("Error sending value1 to API:", error);
    }
}

function populateFormData(data) {
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
// for fetching doctors
async function databaseDoctors(userId) {

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-doctor?userId=${userId}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            })
        const tests = await response.json();
        const subFranchiseeSelect = document.getElementById('doctor-selection');

        if (response.ok) {
            tests.forEach(test => {
                const testElement = document.createElement('option');
                testElement.id = "doctor-option-selection";
                testElement.classList.add('doctor-option-selection');
                testElement.setAttribute('doctor-id', test._id);

                testElement.innerText = `${test.firstName} ${test.lastName} (${test.specialization})`;
                subFranchiseeSelect.appendChild(testElement);
            });
        } else {
            return;
        }
    } catch (error) {
        return console.error(error)
    }
}

// for fetching sub-franchisees
async function databasesubfranchisee(userId) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        if (response.ok) {
            const subFranchiseeSelect = document.getElementById('franchisee-select');
            const allsubfran = await response.json();
            allsubfran.message.forEach(subfran => {
                const testElement = document.createElement('option');
                testElement.id = "tests-name-option";
                testElement.classList.add('subFranchisee-option');
                testElement.setAttribute("data-id", subfran._id);

                testElement.innerText = `${subfran.fullName}`;
                subFranchiseeSelect.appendChild(testElement);
            });
        } else {
            return;
        }
    } catch (error) {
        console.error("Sub franchisee not created")
    }
}

async function databaseLab() {

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-Lab?userId=${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        const tests = await response.json();
        const LabSelect = document.getElementById('lab-selection');

        if (response.ok) {

            tests.forEach(test => {
                const testElement = document.createElement('option');
                testElement.id = "Lab-option-selection";
                testElement.classList.add('Lab-option-selection');
                testElement.setAttribute('Lab-id', test._id);

                testElement.innerText = `${test.LabName}`;
                LabSelect.appendChild(testElement);
            });
        } else {
            return;
        }
    } catch (error) {
        console.error(error)
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
            const current_date = document.querySelector('input[type="date"]').value;
            const current_time = document.querySelector('input[type="time"]').value;

            let formData = new FormData();

            formData.append('courierName', document.getElementById('courier-name').value);
            formData.append('courierId', document.getElementById('courier-id').value);
            formData.append('patientName', document.getElementById('patient-name').value);
            formData.append('date', current_date);
            formData.append('time', current_time);
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
            formData.append('bookingId', value1);

            // Get the file input and append the file
            const file = document.querySelector('.file-input input[type="file"]').files[0];
            if (file) {
                formData.append('file', file);  // Append the file to the FormData object
            }

            // Send the form data using fetch
            const response = await fetch(`${BASE_URL}/api/v1/user/editBooking`, {
                method: 'POST',
                body: formData // Pass FormData object directly
            });

            const data = await response.json();

            // if (response.ok) {
            //     location.reload();
            // } else {
            //     console.error("Error:", data);
            // }
        } catch (error) {
            console.error("Error during booking:", error);
        } finally {
            // Hide the loading screen once content is loaded
            loadingScreen.classList.remove('active');
            loader.classList.remove('loadervisible');
            alert("Case edited successfully")
        }
    });
}

async function initialization() {
    await sendValue1ToApi();
    doctorInput();
    LabInput();
    submitNewBooking();
}

initialization();
