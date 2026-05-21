( async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const value1 = urlParams.get('value1');
    const patientAge = urlParams.get('value2');
    const patientGender = urlParams.get('value3');
    const patient = { age: patientAge, gender: patientGender };
    const decodedValue1 = decodeURIComponent(value1);
    const booking = JSON.parse(localStorage.getItem("booking"));
    const reg_id = JSON.parse(localStorage.getItem("regId"));

    let report = await fetchreport();

    async function fetchreport() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ bookingId: value1 })
            });

            if (!response.ok) {
                throw new Error("something went wrong")
            }

            // Wait for the response to be parsed as JSON
            return await response.json();

        } catch (error) {
            console.log(error)
        }
    }
    

    function defaultdateandtime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so we add 1
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        // Format the date and time to YYYY-MM-DDTHH:MM
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        // Set default value to the current date and time for each field
        document.getElementById('collectedOn').value = report.collectedOn;
        document.getElementById('receivedOn').value = report.receivedOn;
        document.getElementById('reportedOn').value = report.reportedOn;
    };


    function populateHeader() {
        document.getElementById("booking-registeration-number").innerText = reg_id;
        document.getElementById("booking-registeration-number2").innerText = reg_id;
        const patientdetails = document.createElement("div");
        patientdetails.classList.add("report-details-innerDiv");
        patientdetails.innerHTML = `<div class="left">
                <p><strong>Patient Name:</strong>  ${booking.patientName}</p>
                <p><strong>Age / Sex:</strong> ${booking.year} / ${booking.gender}</p>
                <p><strong>Referred By:</strong> ${booking.savedDoctor}</p>
                <p><strong>Reg. no:</strong> ${booking.bookingId}</p>
                <p><strong>Investigations:</strong> ${booking.savedLab}</p>
            </div>
            <div class="right">
                <div>
                    <strong>Registered on:</strong>
                    <span style = "text-align: center;"> ${new Date(booking.date).toISOString().split('T')[0]}    ${booking.time}</span>
                </div>
                <div>
                     <strong for="collectedOn">Collected On:</strong>
                     <input type="datetime-local" id="collectedOn" name="collectedOn">
                </div>
                <div>
                     <strong for="receivedOn">Received On:</strong>
                    <input type="datetime-local" id="receivedOn" name="receivedOn">
                </div>
                <div>
                    <strong for="reportedOn">Reported On:</strong>
                    <input type="datetime-local" id="reportedOn" name="reportedOn">
                </div>
            </div>`

        document.querySelector(".report-details").appendChild(patientdetails);
        defaultdateandtime();
    }

    populateHeader();

    async function barcodegenerator() {

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: reg_id }),
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById("barcodeImage").src = data.barcode; // Display the barcode image
            } else {
                alert("Failed to generate barcode!");
            }
        } catch (error) {
            console.error("Error generating barcode:", error);
            alert("An error occurred. Please try again.");
        }
        // Select the SVG element
        const barcodeElement = document.getElementById("barcode");

        // The number to convert to a barcode
        const number = "1000000034";

        // Generate the barcode
        JsBarcode(barcodeElement, number, {
            format: "CODE128", // Choose barcode format (e.g., CODE128, EAN, etc.)
            width: 2,          // Width of each bar
            height: 100,       // Height of the barcode
            displayValue: true // Show the number below the barcode
        });

    }

    barcodegenerator();

    function createTablefunction() {
        const container = document.getElementById('tables-container');
        container.innerHTML = "";
        const categorizedtables = report.CategoryAndTest;

        categorizedtables.forEach((cat, index) => {
            const table = document.createElement('table');
            table.classList.add("test-table");

            const header = document.createElement('h1');
            header.classList.add("category-heading");
            header.textContent = cat.category;

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th>TEST</th><th>VALUE</th><th>UNIT</th><th>REFERENCE</th>`;
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            // Check if reportstableData exists and is an array
            const tables = cat.reportstableData;
            tables.forEach(val => {
                const row = document.createElement('tr');
                row.innerHTML = `
                        <td class="test-name">${val.testName}</td>
                        <td><input type="text" value="${val.value}" style="width: 75%;"></td>
                        <td class="unit">${val.unit} <i class="fas fa-plus-circle add-row-icon"></i></td>
                        <td class="reference">${val.reference}</td>
                    `;
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            container.appendChild(header);
            container.appendChild(table);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("add-buttons");
            buttonsDiv.innerHTML = `
                <button class="add-notes"><i class="fas fa-plus-circle"></i> Add notes</button>
                <button class="add-remark"><i class="fas fa-plus-circle"></i> Add remarks</button>
                <button class="add-advice"><i class="fas fa-plus-circle"></i> Add advice</button>
            `;
            container.appendChild(buttonsDiv);

            const interpretationDiv = document.createElement("div");
            interpretationDiv.classList.add("interpretations");
            interpretationDiv.id = `displayArea-${index}`;
            interpretationDiv.innerHTML = `<h3 id="editButton-${index}">Interpretations <i class="fas fa-edit"></i></h3>
                <p><strong>Clinical significance :</strong></p>
                <p id="interpretationText-${index}">${cat.interpretation}</p> <br> <hr>`;
            container.appendChild(interpretationDiv);

            const editorDiv = document.createElement("div");
            editorDiv.id = `editorContainer-${index}`;
            editorDiv.style.display = "none";
            editorDiv.innerHTML = `<div id="editor-${index}"></div>
                <button id="saveButton-${index}">Save</button>
                <button id="cancelButton-${index}">Cancel</button>`;
            container.appendChild(editorDiv);

            // Add event listeners for this category's interpretation edit buttons
            setupInterpretationEdit(index);

        });
        addEventListeners();
    }

    createTablefunction();

    function addEventListeners() {
        const container = document.getElementById('tables-container');

        container.addEventListener('click', function (event) {
            if (event.target.classList.contains('add-row-icon')) {
                const row = event.target.closest('tr');
                event.target.style.display = "none";
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td class="test-name">Remarks (optional):</td>
                    <td colspan='3'><input type="text" class="ran-inputs" style="width: 90%;" placeholder="Enter value"><button class="delete-row" style="background: none; border: none; color: red; cursor: pointer;"><i class="fas fa-trash-alt"></i></button></td>
                `;
                row.insertAdjacentElement('afterend', newRow);
            } else if (event.target.closest('.delete-row')) {
                const rowToDelete = event.target.closest('tr');
                const prevRow = rowToDelete.previousElementSibling;
                const addIcon = prevRow.querySelector('.add-row-icon');

                if (addIcon) {
                    addIcon.style.display = "";
                }
                rowToDelete.remove();
            }

            if (event.target.classList.contains('add-remark') || event.target.classList.contains('add-advice') || event.target.classList.contains('add-notes')) {
                const button = event.target;
                const type = button.classList.contains('add-remark') ? "Remarks" : button.classList.contains('add-advice') ? "Advice" : "Notes";

                const relatedTable = button.closest(".add-buttons").previousElementSibling;
                const tbody = relatedTable.querySelector("tbody");

                button.style.display = "none";

                const newRow = document.createElement('tr');
                newRow.classList.add("dynamicRow");
                newRow.innerHTML = `
                    <td class="test-name">${type} (optional):</td>
                    <td colspan='3'><input type="text" class="ran-inputs" style="width: 90%;" placeholder="Enter ${type}"><button class="delete-row" style="background: none; border: none; color: red; cursor: pointer;"><i class="fas fa-trash-alt"></i></button></td>
                `;
                tbody.appendChild(newRow);

                newRow.querySelector('.delete-row').addEventListener('click', () => {
                    button.style.display = "";
                    newRow.remove();
                });
            }
        });
    }

    function setupInterpretationEdit(index) {
        const editButton = document.getElementById(`editButton-${index}`);
        const saveButton = document.getElementById(`saveButton-${index}`);
        const cancelButton = document.getElementById(`cancelButton-${index}`);
        const displayArea = document.getElementById(`displayArea-${index}`);
        const editorContainer = document.getElementById(`editorContainer-${index}`);
        const interpretationText = document.getElementById(`interpretationText-${index}`);

        editButton.addEventListener('click', function () {
            displayArea.style.display = 'none';
            editorContainer.style.display = 'block';

            tinymce.init({
                selector: `#editor-${index}`,
                menubar: false,
                plugins: 'table lists link',
                toolbar: 'undo redo | bold italic underline | bullist numlist | table | link',
                setup: function (editor) {
                    editor.on('init', function () {
                        editor.setContent(interpretationText.innerHTML);
                    });
                }
            });
        });

        saveButton.addEventListener('click', function () {
            interpretationText.innerHTML = tinymce.get(`editor-${index}`).getContent();
            tinymce.remove();
            editorContainer.style.display = 'none';
            displayArea.style.display = 'block';
        });

        cancelButton.addEventListener('click', function () {
            tinymce.remove();
            editorContainer.style.display = 'none';
            displayArea.style.display = 'block';
        });
    }

    function getLowerUpperValues(patient, defaultresults) {
        // Helper function to convert age to days based on the unit
        const convertToDays = (age, unit) => {
            if (unit === "Years") return age * 365;
            if (unit === "Months") return age * 30;
            if (unit === "Days") return age;
            return 0; // Unknown unit
        };

        // Extract patient age and unit, then convert to days
        const [patientAge, patientAgeUnit] = patient.age.split(" ");
        const patientAgeInDays = convertToDays(parseInt(patientAge), patientAgeUnit);

        for (const result of defaultresults) {
            // Convert minAge and maxAge in result to days
            const minAgeInDays = convertToDays(parseInt(result.minAge), result.minAgeUnit);
            const maxAgeInDays = convertToDays(parseInt(result.maxAge), result.maxAgeUnit);

            // Check if gender and age (in days) fall within the criteria
            if (
                (result.gender === "Any" || result.gender === patient.gender) &&
                patientAgeInDays >= minAgeInDays &&
                patientAgeInDays <= maxAgeInDays
            ) {
                console.log(`Lower Value: ${result.lowerValue}, Upper Value: ${result.upperValue}`);
                return { lowerValue: result.lowerValue, upperValue: result.upperValue };
            }
        }

        // If no match is found, return null or an appropriate message
        return "";
    }

    // Function to gather data from generated tables and interpretations
    function gatherDataForApi() {
        const container = document.getElementById('tables-container');
        const data = [];

        // Get all tables and related interpretation sections
        container.querySelectorAll(".test-table").forEach((table, index) => {
            const categoryHeading = container.querySelectorAll(".category-heading")[index].textContent;
            const rows = Array.from(table.querySelectorAll("tbody tr"));

            const reportstableData = rows.map(row => {
                const testName = row.querySelector(".test-name") ? row.querySelector(".test-name").textContent : "";
                const value = row.querySelector("input[type='text']") ? row.querySelector("input[type='text']").value : "";
                const unit = row.querySelector(".unit") ? row.querySelector(".unit").textContent.trim() : "";
                const reference = row.querySelector(".reference") ? row.querySelector(".reference").textContent.trim() : "";

                return {
                    testName,
                    value,
                    unit,
                    reference
                };
            });

            const interpretationText = document.getElementById(`interpretationText-${index}`).innerHTML;

            data.push({
                category: categoryHeading,
                reportstableData,
                interpretation: interpretationText
            });
        });

        return data;
    }

    // Function to send the gathered data to the API
    async function sendDataToApi() {
        const gatheredData = gatherDataForApi();
        const signedBy = document.getElementById("signedBy").value;
        console.log("gathered-data:", gatheredData);
        delete booking.__v;
        delete booking.updatedAt;
        delete booking._id;
        delete booking.createdAt;
        delete booking.tableData;

        console.log("booking:", booking);

        const collectedOn = document.getElementById('collectedOn').value;
        const receivedOn = document.getElementById('receivedOn').value;
        const reportedOn = document.getElementById('reportedOn').value;

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/editReportData`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ reportData: gatheredData, reg_id, booking, signedBy, collectedOn, receivedOn, reportedOn })
            });

            if (!response.ok) throw new Error("Failed to send data to the server.");

            const result = await response.json();
            console.log("this is reportData: ", result);
            const barcodeId = result._id;
            const url = `${BASE_URL}/admin.html?page=reportFormat&value1=${barcodeId}`;
            window.location.href = url;
            localStorage.clear();

            console.log("Data sent successfully:", result);
        } catch (error) {
            console.error("Error sending data to the server:", error);
        }
    }

    // Add an event listener for the submit button to trigger the API call
    document.getElementById("finalBtn").addEventListener("click", (event) => {
        event.preventDefault(); // Prevent default form submission
        sendDataToApi(); // Call function to gather data and send it
    });


})();

// Function to open the modal
function openModal(button) {
    document.getElementById('modal').style.display = 'flex';
    // Get the row of the clicked button
    const row = button.closest('tr');
    // Get the first cell's value
    const firstColumnValue = row.cells[0].innerText;
    // Print the value (or use it however you need)
    console.log(firstColumnValue);
    fetchDefaultResults(firstColumnValue);
    // Trigger data collection and send when needed
    document.getElementById('submit-button').addEventListener('click', function () {
        gatherFormData(firstColumnValue)
    });
}

// Function to close the modal
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Close the modal if clicked outside the form-section
window.onclick = function (event) {
    const modal = document.getElementById('modal');
    const formSection = document.querySelector('.form-section');
    if (event.target === modal && !formSection.contains(event.target)) {
        closeModal();
    }
}

// edit range code ---------------------------------------------------------------------------

function toggleForm(selectElement) {
    const formContainer = document.getElementById('form-container');
    const textArea = document.getElementById('text-area');
    const addMoreBtn = document.getElementById('add-more-btn');

    if (selectElement.value === 'text') {
        formContainer.style.display = 'none';
        textArea.style.display = 'block';
        addMoreBtn.style.display = 'none'; // Hide Add more button
    } else {
        formContainer.style.display = 'block';
        textArea.style.display = 'none';
        addMoreBtn.style.display = 'flex'; // Show Add more button
    }
}

function addRow() {
    const formContainer = document.getElementById('form-container');

    // Clone the first row as a new row
    const newRow = formContainer.firstElementChild.cloneNode(true);

    // Reset the values in the new row
    newRow.querySelector('.min-age').value = "";
    newRow.querySelector('.max-age').value = "";
    newRow.querySelector('.lower-value').value = "";
    newRow.querySelector('.upper-value').value = "";
    newRow.querySelector('.display-report').textContent = "-";

    // Append the new row
    formContainer.appendChild(newRow);
}

function deleteRow(element) {
    const formContainer = document.getElementById('form-container');
    if (formContainer.childElementCount > 1) {
        element.parentElement.remove();
    }
}

function updateReportDisplay(element) {
    const rowContainer = element.parentElement.parentElement;
    const lowerValue = rowContainer.querySelector('.lower-value').value;
    const upperValue = rowContainer.querySelector('.upper-value').value;
    const displayReport = rowContainer.querySelector('.display-report');

    if (lowerValue && upperValue) {
        displayReport.textContent = `${lowerValue} - ${upperValue}`;
    } else {
        displayReport.textContent = "-";
    }
}

function gatherFormData(tname) {
    // for normal value data retrieve
    const selectType = document.getElementById('select-type').value;
    let dataObject = {};

    if (selectType === 'text') {
        // Gather data from textarea if type is "text"
        const textAreaData = document.getElementById('text-area').value;
        dataObject.text = textAreaData;
    } else {
        // Gather data from dynamic rows if type is "numeric"
        const rows = document.querySelectorAll('.row-container');
        dataObject = Array.from(rows).map(row => ({
            gender: row.querySelector('.sex').value,
            minAge: row.querySelector('.min-age').value,
            minAgeUnit: row.querySelector('[name="min_age_unit"]').value,
            maxAge: row.querySelector('.max-age').value,
            maxAgeUnit: row.querySelector('[name="max_age_unit"]').value,
            lowerValue: row.querySelector('.lower-value').value,
            upperValue: row.querySelector('.upper-value').value,
        }));
    }

    console.log("this is dataobject: ", dataObject);

    fetch(`${BASE_URL}/api/v1/user/edit-defaultresults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataObject, tname })
    })
        .then(response => response.json())
        .then(result => {
            console.log('Success:', result);
        })
        .catch(error => {
            console.error('Error:', error);
        });

}


//-----------------------------fetching data result----------------------------------
async function fetchDefaultResults(testName) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/edit-add-defaultresults`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ testName })
        }); // Replace with your API endpoint
        const data = await response.json();
        populateRows(data.defaultresult);
    } catch (error) {
        console.error('Error fetching default results:', error);
    }
}

function populateRows(defaultresults) {
    const formContainer = document.getElementById('form-container');
    formContainer.innerHTML = ''; // Clear any existing rows

    defaultresults.forEach(result => {
        const rowContainer = document.createElement('div');
        rowContainer.classList.add('row-container');

        rowContainer.innerHTML = `
            <span class="delete-btn" onclick="deleteRow(this)">🗑️</span>
            <div class="row-item">
                <label for="sex">Sex</label>
                <select name="sex" class="sex">
                    <option value="Any" ${result.gender === 'Any' ? 'selected' : ''}>Any</option>
                    <option value="Male" ${result.gender === 'Male' ? 'selected' : ''}>Male</option>
                    <option value="Female" ${result.gender === 'Female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="row-item">
                <label for="min_age">Min. Age</label>
                <input type="number" name="min_age" class="min-age" value="${result.minAge}">
            </div>
            <div class="row-item">
                <label for="min_age_unit">Min Age Unit</label>
                <select name="min_age_unit">
                    <option value="Years" ${result.minAgeUnit === 'Years' ? 'selected' : ''}>Years</option>
                    <option value="Months" ${result.minAgeUnit === 'Months' ? 'selected' : ''}>Months</option>
                    <option value="Days" ${result.minAgeUnit === 'Days' ? 'selected' : ''}>Days</option>
                </select>
            </div>
            <div class="row-item">
                <label for="max_age">Max. Age</label>
                <input type="number" name="max_age" class="max-age" value="${result.maxAge}">
            </div>
            <div class="row-item">
                <label for="max_age_unit">Max Age Unit</label>
                <select name="max_age_unit">
                    <option value="Years" ${result.maxAgeUnit === 'Years' ? 'selected' : ''}>Years</option>
                    <option value="Months" ${result.maxAgeUnit === 'Months' ? 'selected' : ''}>Months</option>
                    <option value="Days" ${result.maxAgeUnit === 'Days' ? 'selected' : ''}>Days</option>
                </select>
            </div>
            <div class="row-item">
                <label for="lower_value">Lower Value</label>
                <input type="number" name="lower_value" class="lower-value" value="${result.lowerValue}" oninput="updateReportDisplay(this)">
            </div>
            <div class="row-item">
                <label for="upper_value">Upper Value</label>
                <input type="number" name="upper_value" class="upper-value" value="${result.upperValue}" oninput="updateReportDisplay(this)">
            </div>
            <div class="row-item">
                <label for="display_report">Display report</label>
                <span class="display-report">${result.lowerValue} - ${result.upperValue}</span>
            </div>
        `;

        formContainer.appendChild(rowContainer);
    });
}

function addRow() {
    const formContainer = document.getElementById('form-container');
    const newRow = formContainer.firstElementChild.cloneNode(true);

    // Clear values for the new row
    newRow.querySelector('.min-age').value = "";
    newRow.querySelector('.max-age').value = "";
    newRow.querySelector('.lower-value').value = "";
    newRow.querySelector('.upper-value').value = "";
    newRow.querySelector('.display-report').textContent = "-";

    formContainer.appendChild(newRow);
}

function deleteRow(element) {
    const formContainer = document.getElementById('form-container');
    if (formContainer.childElementCount > 1) {
        element.parentElement.remove();
    }
}

function updateReportDisplay(element) {
    const rowContainer = element.parentElement.parentElement;
    const lowerValue = rowContainer.querySelector('.lower-value').value;
    const upperValue = rowContainer.querySelector('.upper-value').value;
    const displayReport = rowContainer.querySelector('.display-report');

    if (lowerValue && upperValue) {
        displayReport.textContent = `${lowerValue} - ${upperValue}`;
    } else {
        displayReport.textContent = "-";
    }
}

