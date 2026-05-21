(async function jl() {

    let categoryArray = [];
    //Function to load categories and populate the dropdown
    function loadCategories() {
        fetch(`${BASE_URL}/api/v1/user/category-list`) // Fetch categories from your backend
            .then(response => response.json())
            .then(data => {
                categoryArray.push(...(data.data));
                const categorySelect = document.getElementById('category');
                categorySelect.innerHTML = ''; // Clear any existing options

                // Add default "select" option
                const defaultOption = document.createElement('option');
                defaultOption.textContent = 'Select Category';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                categorySelect.appendChild(defaultOption);

                // Check if the API call was successful and we have data
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    // Loop through the categories and add them to the dropdown
                    data.data.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category.category;  // Using _id as the value
                        option.textContent = category.category;  // Display the category name
                        categorySelect.appendChild(option);
                    });
                } else {
                    // If no categories are found, show a default message
                    const option = document.createElement('option');
                    option.textContent = 'No categories available';
                    option.disabled = true;
                    categorySelect.appendChild(option);
                }
            })
            .catch(error => {
                console.error('Error fetching categories:', error);
                alert('Failed to load categories. Please try again.');
            });
    }
    loadCategories();

    document.getElementById('name').addEventListener('input', function () {
        const parainput = document.getElementById('paraName');
        parainput.value = this.value;
    })

    // Get elements
    const addUnitIcon = document.getElementById('add-unit-icon');
    const unitModal = document.getElementById('unit-modal');
    const closeModal = document.getElementById('close-modal');
    const saveUnitBtn = document.getElementById('save-unit');
    const unitSelect = document.getElementById('unit-select');
    const newUnitNameInput = document.getElementById('new-unit-name');

    // Open modal when "+" icon is clicked
    addUnitIcon.addEventListener('click', function () {
        unitModal.style.display = 'block';
    });

    // Close the modal when "x" is clicked
    closeModal.addEventListener('click', function () {
        unitModal.style.display = 'none';
    });

    // Save the new unit and send it to the backend
    saveUnitBtn.addEventListener('click', function () {
        const newUnit = newUnitNameInput.value.trim();

        if (newUnit) {
            // Send the new unit to the server (use Fetch API)
            fetch(`${BASE_URL}/api/v1/user/add-unit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ unit: newUnit })
            })
                .then(response => response.json())
                .then(data => {
                    // Close the modal and reset the input field
                    unitModal.style.display = 'none';
                    newUnitNameInput.value = '';

                    // Optionally refresh the dropdown with the new unit
                    loadUnits();

                    // Display success message (optional)
                    alert('Unit added successfully!');
                })
                .catch(error => {
                    console.error('Error:', error);
                    // Optionally show an error message to the admin
                    alert('Failed to add unit. Please try again.');
                });
        }
    });

    // Close the modal if the admin clicks outside of the modal content
    window.addEventListener('click', function (event) {
        if (event.target === unitModal) {
            unitModal.style.display = 'none';
        }
    });

    // Function to load units from the database and update the dropdown
    let units = []; // To store units once loaded

    function loadUnits() {
        fetch(`${BASE_URL}/api/v1/user/get-units`)
            .then(response => response.json())
            .then(data => {
                units = data.units; // Save the units in a variable to be reused
                const unitSelect = document.getElementById("unit-select");
                unitSelect.innerHTML = ''; // Clear current options

                // Add new options from the database
                data.units.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.unit;
                    option.textContent = unit.unit;
                    unitSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading units:', error);
                alert('Failed to load units. Please try again.');
            });
    }

    // Load units when the page loads
    loadUnits();



    let orderId = 1;
    // Function to add a new parameter row dynamically
    function addParameter() {
        // Ensure that units are loaded before adding the row
        if (units.length === 0) {
            alert('Units are not loaded yet. Please wait.');
            return;
        }

        const table = document.getElementById('parameters-table2').getElementsByTagName('tbody')[0];
        const newRow = table.insertRow();
        orderId++; // Assuming orderId is declared and incremented elsewhere
        newRow.innerHTML = `
        <td><span class="remove-link" id="remove-link">🗑️</span></td>
        <td><input type="text" value="${orderId}"></td>
        <td><input type="text"></td>
        <td>
            <select>
                <!-- Units will be added here dynamically -->
            </select>
        </td>
        <td>
            <input type="text">
        </td>
        <td class="normalValue">
                            <div class="selectTypeDiv">
                                <label for="select-type">Select Type</label>
                                <select id="select-type" onchange="toggleForm(this)">
                                    <option value="numeric" selected>Numeric</option>
                                    <option value="text">Text</option>
                                </select>
                            </div>
                            <div id="form-container">
                                <div class="row-container">
                                    <span class="delete-btn" onclick="deleteRow(this)"><i class="fa-solid fa-eraser"></i></span>
                                    <div class="row-item">
                                        <label for="sex">Sex</label>
                                        <select name="sex" class="sex">
                                            <option value="Any">Any</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
                                    <div class="row-item">
                                        <label for="min_age">Min. Age</label>
                                        <div class="minAge">
                                            <input type="number" name="min_age" placeholder="Min. age" class="min-age"
                                                value="0">
                                            <select name="min_age_unit">
                                                <option value="Years">Years</option>
                                                <option value="Months">Months</option>
                                                <option value="Days">Days</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row-item">
                                        <label for="max_age">Max. Age</label>
                                        <div class="maxAge">
                                            <input type="number" name="max_age" placeholder="Max. age" class="max-age"
                                                value="100">
                                            <select name="max_age_unit">
                                                <option value="Years">Years</option>
                                                <option value="Months">Months</option>
                                                <option value="Days">Days</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row-item">
                                        <label for="lower_value">Lower</label>
                                        <input type="number" name="lower_value" placeholder="Lower value"
                                            class="lower-value" value="2.1">
                                    </div>
                                    <div class="row-item">
                                        <label for="upper_value">Upper</label>
                                        <input type="number" name="upper_value" placeholder="Upper value"
                                            class="upper-value" value="17.7">
                                    </div>
                                    <!-- <div class="row-item">
                                        <label for="upper_value">Display report</label>
                                        <span class="display-report">2.1 - 17.7</span>
                                    </div> -->
                                </div>
                            </div>

                            <textarea id="text-area" class="text-area" placeholder="Enter text here..."></textarea>

                            <div class="add-more-btn" id="add-more-btn" onclick="addRow(this)">+ Add more</div>
                        </td>    `;

        // Now populate the units dropdown in the newly created row
        const unitSelect = newRow.cells[3].getElementsByTagName('select')[0]; // Select the unit dropdown

        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.unit;
            option.textContent = unit.unit;
            unitSelect.appendChild(option);
        });

        // You can also add event listener to handle removal of rows, if necessary
        newRow.querySelector('.remove-link').addEventListener('click', () => {
            table.deleteRow(newRow.rowIndex - 1);
        });
    }

    document.getElementById("add-parameter-link").addEventListener("click", addParameter);

    function removeParameter(element) {
        const row = element.parentElement.parentElement;
        orderId--;
        row.remove();
    }
    // Attach an event listener to the table body
    document.querySelector("#parameters-table2 tbody").addEventListener("click", function (event) {
        // Check if the clicked element has the class 'remove-link'
        if (event.target.classList.contains("remove-link")) {
            removeParameter(event.target); // Call removeParameter with the clicked element
        }
    });

    async function fetchandpopulatesamples() {
        const selecttag = document.getElementById("sampleType");
        selecttag.innerHTML = "";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/fetchsample`);
            const data = await response.json();

            if (!response.ok) {
                return console.log(data.message);
            }

            data.data.forEach(obj => {
                selecttag.innerHTML += `<option value="${obj.Name}">${obj.Name}</option>`;
            });

        } catch (error) {
            alert(error)
        }
    }

    fetchandpopulatesamples();

    document.getElementById("sampleaddbtn").addEventListener("click", async () => {
        const sampeName = document.getElementById("sample-name").value;
        const samplebyuser = JSON.parse(localStorage.getItem("superAdminData"));
        const alert = document.getElementById("alert");

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/addsample`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ Name: sampeName, user: samplebyuser })
            })

            const data = await response.json();

            if (response.ok) {
                fetchandpopulatesamples();
                alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-danger", "fade");
                alert.classList.add("alert-success");
                alert.classList.add("show");
            } else {
                alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success", "fade");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
            }
        } catch (error) {
            alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
            alert.classList.remove("alert-success", "fade");
            alert.classList.add("alert-danger");
            alert.classList.add("show");
        }
        setTimeout(() => {
            alert.classList.remove("show")
            alert.classList.add("fade")
        }, 3000);
    })

    document.getElementById('submitbBtn').addEventListener('click', function () {

        const namefield = document.getElementById('name');
        const errormessage = document.querySelector('.errormessage');

        if (namefield.value.trim().includes(",")) {
            errormessage.style.display = "block";
            namefield.scrollIntoView({ behavior: "smooth" })
            namefield.focus();
            return;
        } else {
            errormessage.style.display = "none";
        }

        const userdata = JSON.parse(localStorage.getItem("superAdminData"));
        const formData = {
            Name: namefield.value.trim(),
            Short_name: document.getElementById('short-name').value.trim(),
            category: categoryArray.find(doc => doc.category === document.getElementById('category').value),
            Price: document.getElementById('price').value,
            final_price: document.getElementById('final-price').value,
            sampleType: document.getElementById('sampleType').value,
            method: document.getElementById('method').value.trim(),
            instrument: document.getElementById('instrument').value.trim(),
            interpretation: tinymce.get('editorContent').getContent(),
            user: userdata,
            parameters: [],  // Initialize an empty array for parameters
        }

        // Get all rows from the parameters table
        const parameterRows = document.querySelectorAll('#parameters-table2 tbody tr');
        parameterRows.forEach(row => {
            const parameterData = {
                order: row.cells[1].querySelector('input').value,
                Para_name: row.cells[2].querySelector('input').value,
                unit: row.cells[3].querySelector('select').value,
                defaultresult: row.cells[4].querySelector('input').value,
            }
            // for normal value data retrieve
            const selectType = row.cells[5].querySelector('#select-type').value;
            let dataObject;
            if (selectType === 'text') {
                // Gather data from textarea if type is "text"
                const textAreaData = row.cells[5].querySelector('#text-area').value;
                parameterData.text = textAreaData;
            } else {
                // Gather data from dynamic rows if type is "numeric"
                const rows = row.cells[5].querySelectorAll('.row-container');
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
            parameterData.NormalValue = dataObject;
            parameterData.ValueType = selectType;
            console.log("this is a parameterData: ", parameterData);
            formData.parameters.push(parameterData);
        });

        const alert = document.querySelector(".alert");
        // Use the previously declared cookies variable
        fetch(`${BASE_URL}/api/v1/user/make-test-tenant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // body: JSON.stringify({ ...formData, cookies }), // Use cookies variable here
            body: JSON.stringify({ ...formData })
        })
            .then(async (response) => {
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
            })
            .catch((error) => {
                  
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
            });
    });

    tinymce.init({
        selector: '#editorContent', // Your contenteditable div's ID
        height: 300,
        menubar: false,
        plugins: 'table lists link', // No need for fontsize plugin; fontsizeselect is built-in
        toolbar: 'undo redo | formatselect | fontsizeselect | bold italic backcolor | table | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | link',
        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
        fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt', // Customize font sizes
    });
})();

function copyFromLibrary() {
    // This is a placeholder function. In a real application, you would fetch data from your backend.
    const sampleInterpretation = "<p>This is a sample interpretation copied from the library.</p>";
    document.getElementById('editorContent').innerHTML = sampleInterpretation;
}

// function updateReportDisplay(element) {
//     const rowContainer = element.parentElement.parentElement;
//     const lowerValue = rowContainer.querySelector('.lower-value').value;
//     const upperValue = rowContainer.querySelector('.upper-value').value;
//     const displayReport = rowContainer.querySelector('.display-report');

//     if (lowerValue && upperValue) {
//         displayReport.textContent = `${lowerValue} - ${upperValue}`;
//     } else {
//         displayReport.textContent = "-";
//     }
// }

function addRow(admore) {
    const formContainer = admore.parentElement.querySelector('#form-container');
    // Clone the first row as a new row
    const newRow = formContainer.firstElementChild.cloneNode(true);

    // Reset the values in the new row
    newRow.querySelector('.min-age').value = "";
    newRow.querySelector('.max-age').value = "";
    newRow.querySelector('.lower-value').value = "";
    newRow.querySelector('.upper-value').value = "";
    // newRow.querySelector('.display-report').textContent = "-";

    // Append the new row
    formContainer.appendChild(newRow);
}

function deleteRow(element) {
    // Access the form-container using the closest method
    const formContainer = element.closest('#form-container');

    // Check if formContainer exists and has more than one child
    if (formContainer && formContainer.childElementCount > 1) {
        // Remove the parent element of the clicked element
        element.parentElement.remove();
    }
}


function toggleForm(selectElement) {
    const closestContainer = selectElement.closest('.normalValue'); // Closest container element
    const formContainer = closestContainer.querySelector('#form-container');
    const textArea = closestContainer.querySelector('.text-area');

    if (selectElement.value === 'text') {
        formContainer.style.display = 'none';
        textArea.style.display = 'block';
    } else {
        formContainer.style.display = 'block';
        textArea.style.display = 'none';
    }
}
