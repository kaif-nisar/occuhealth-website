async function loadfunction() {
    // const urlParams = new URLSearchParams(window.location.search);
    const booking = JSON.parse(localStorage.getItem("booking"));
    // for getting individual parameter lower and upper value
    const patient = { age: booking.year, gender: booking.gender };
    //for pdf only (print tale on seperate page)
    document.getElementById('check1').checked = true;
    //Array for filtering tests and pannels
    let testArray = [];
    //Array for filtering tests, pannels, package 
    let testArray2 = [];
    // for sample receiving time 
    let recievedOn;

    // for getting barcode tests
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getbarcodeTests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Specify JSON format
            },
            body: JSON.stringify({ bookingId: booking.bookingId }),
        });

        if (!response.ok) {
            // Handle non-2xx HTTP responses
            const errorData = await response.json();
            console.log("Error:", errorData.message || "Unknown error");
            return;
        }

        const data = await response.json();
        data.barcodes.forEach(element => {
            const array = element.testandpannelArray;
            testArray.push(...array);
        })

        getallpptfromrelatedbarcode(data.barcodes);

        recievedOn = formatDateTimeLocal(data.createdAt);
    } catch (error) {
        console.log("Fetch error:", error.message);
    }

    // this is for testArray2
    async function getallpptfromrelatedbarcode(barcodes) {
        for (const object of barcodes) {
            booking.tableData.forEach((bookingtableData) => {
                if (bookingtableData.barcodeId.trim() === object.barcode.trim()) {
                    testArray2.push(...(bookingtableData.testName.split(',')));
                }
            })
        }
    }

    // for removing duplicacy
    let uniquetestArray2 = [...new Set(testArray2)];
    let uniquetestArray = [...new Set(testArray)];

    // Convert to the required format
    function formatDateTimeLocal(isoDate) {
        const date = new Date(isoDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Async function to send data to the server
    async function sendValueToDatabase() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/allTestdetails`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ value1: uniquetestArray }),
            });

            if (!response.ok) throw new Error("Failed to save value to the database.");

            const data = await response.json();

            return data;
        } catch (error) {
            console.error("Error sending value to database:", error);
        }
    }

    // Function to apply logic to each abnormal input field 
    const processInput = (input) => {
        const row = input.closest("tr"); // Get the row containing the input
        const highLowSpan = row.querySelector(".HighLow"); // Get the span for L/H display
        const inputValue = input.value.trim(); // Get the input value as a string and trim whitespace
        const numericValue = parseFloat(inputValue); // Parse the numeric value from the input
        const lowerValue = parseFloat(input.getAttribute('data-lower'));
        const upperValue = parseFloat(input.getAttribute('data-upper'));

        // Reset styling and span content if input is invalid
        if (isNaN(numericValue) && inputValue.toLowerCase() !== "positive") {
            row.style.fontWeight = "normal";
            input.style.fontWeight = "normal";
            highLowSpan.textContent = "";
            return;
        }

        // Apply logic for bold styling and L/H display
        if (inputValue.toLowerCase() === "positive") {
            // If the input is "positive" (case-insensitive)
            row.style.fontWeight = "bold";
            input.style.fontWeight = "bold";
            highLowSpan.textContent = ""; // No L or H for "positive"
        } else if (numericValue < lowerValue) {
            row.style.fontWeight = "bold";
            input.style.fontWeight = "bold";
            highLowSpan.textContent = "L"; // Low
        } else if (numericValue > upperValue) {
            row.style.fontWeight = "bold";
            highLowSpan.textContent = "H"; // High
            input.style.fontWeight = "bold";
        } else {
            // Reset to normal if none of the conditions match
            row.style.fontWeight = "normal";
            input.style.fontWeight = "normal";
            highLowSpan.textContent = "";
        }
    };

    // for adding event listener to all fields
    function addInputListeners() {
        // Select all input fields within the table body
        const inputs = document.querySelectorAll(".value-input");

        // Process each input on load
        inputs.forEach((input) => {

            // Process the input on page load for default values
            processInput(input);

            // Add input event listener for real-time updates
            input.addEventListener("input", async (event) => {
                processInput(input);
            });
        });
    }

    //for tinymce
    const initEditor = (uniqueTestId, interpretation) => {
        console.log("initEditor")
        tinymce.init({
            selector: `#editorContent-${uniqueTestId}`,
            height: 300,
            menubar: false,
            plugins: 'table lists link image',  // Include the image plugin
            toolbar: 'undo redo| image | formatselect | fontsizeselect | bold italic backcolor | table | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | link', // Add image button to the toolbar
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt',
            setup: (editor) => {
                editor.on('init', () => {
                    editor.setContent(interpretation || ""); // Set content only when editor is ready
                });
            }
        });
    };

    //for creating tables
    async function createTable(title, category, data, isPanel = false, hideCategory = false, panelDetails = null) {
        const section = document.createElement("div");
        section.classList.add("section");

        // Table heading (only if not hidden)
        if (!hideCategory) {
            const categoryHeading = document.createElement("h2");
            categoryHeading.textContent = category;
            categoryHeading.setAttribute('data-order', category.orderId);
            section.appendChild(categoryHeading);

            const heading = document.createElement("h3");
            heading.textContent = title;
            heading.setAttribute('data-order', panelDetails?.panelDocument.order || 999)
            section.appendChild(heading);
        }

        // Table
        const table = document.createElement("table");
        table.className = "table";
        const thead = document.createElement("thead");
        thead.innerHTML = `
        <tr>
            <th>Test</th>
            <th class="valueColumn">Value</th>
            <th>Unit</th>
            <th>Reference</th>
        </tr>
    `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        tbody.className = "tbody";
        const previousContentMap = {};
        let previousContent = '';
        for (const test of data) {
            if (test.isDocumentedTest) {
                console.log("documented test");
                const uniqueTestId = `${test._id}`; // Combine test._id and test.order for unique ID
                const row = document.createElement("tr");
                row.setAttribute("data-order", test.order);
                row.setAttribute("data-id", test._id);

                const detailsRow = document.createElement("tr");
                detailsRow.setAttribute("data-order", test.order);
                const detailsCell = document.createElement("td");
                detailsCell.colSpan = 4;
                detailsCell.className = "test-name";

                const detailsDiv = document.createElement("div");
                detailsDiv.classList.add("test-details");

                const editorDiv = document.createElement("div");
                editorDiv.id = `editorContent-${uniqueTestId}`;
                editorDiv.className = "editor-content";
                detailsDiv.appendChild(editorDiv);

                const apiDataDiv = document.createElement("div");
                apiDataDiv.id = `apiData-${uniqueTestId}`;
                apiDataDiv.className = "api-data";
                apiDataDiv.style.marginTop = "10px";
                apiDataDiv.textContent = "Loading additional data...";
                detailsDiv.appendChild(apiDataDiv);

                const buttonsDiv = document.createElement("div");
                buttonsDiv.className = "buttonsDiv";

                const createButton = (text, className, clickHandler, iconHTML = null) => {
                    const button = document.createElement("button");
                    button.className = className;
                    button.style.marginRight = "10px";
                    button.addEventListener("click", clickHandler);

                    // Add the icon if provided
                    if (iconHTML) {
                        const iconElement = document.createElement("span");
                        iconElement.innerHTML = iconHTML; // Add the icon HTML
                        button.appendChild(iconElement);
                    }

                    // Add the button text
                    const textNode = document.createTextNode(text);
                    button.appendChild(textNode);

                    return button;
                };

                // Save as Default button with a plus icon
                const saveAsDefaultButton = createButton(
                    "Save as Default",
                    "save-as-default-btn",
                    () => {

                        // Show confirmation dialog
                        const userConfirmed = confirm("Are you sure you want to save this template as default?");
                        if (!userConfirmed) {
                            return; // Stop further execution if user cancels
                        }
                        const editorContent = tinymce.get(`editorContent-${uniqueTestId}`).getContent();

                        fetch(`${BASE_URL}/api/v1/user/updateTestInterpretation`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                testId: test._id,
                                interpretation: editorContent,
                            }),
                        })
                            .then((response) => response.json())
                            .then((data) => {
                                alert(data ? "Interpretation saved as default successfully!" : "Failed to save interpretation.");
                            })
                            .catch(() => {
                                alert("An error occurred while saving the interpretation.");
                            });
                    }, `<i class="fa-solid fa-floppy-disk"></i>`
                );

                const saveTemplateButton = createButton("Save Template", "save-template-btn", () => {
                    const popup = document.createElement("div");
                    popup.className = "popup-overlay";
                    popup.innerHTML = `
                        <div class="popup-content">
                            <h1>ADD New Template</h1>
                            <div class="popup-form">
                            <label for="templateName">* Template Name</label>
                            <input type="text" id="templateName" name="templateName" placeholder="Enter template name">
                            </div>
                            <button id="saveTemplate">Save</button>
                        </div>
                    `;

                    document.body.appendChild(popup);

                    const saveButton = popup.querySelector("#saveTemplate");
                    saveButton.addEventListener("click", () => {
                        const templateName = document.getElementById("templateName").value;
                        const editorContent = tinymce.get(`editorContent-${uniqueTestId}`).getContent();

                        fetch(`${BASE_URL}/api/v1/user/saveTestTemplate`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                testId: test._id,
                                templateName,
                                content: editorContent,
                            }),
                        })
                            .then((response) => response.json())
                            .then((data) => {
                                alert(data.message || "Template saved successfully!");
                                popup.remove();
                                addNewTemplate(templateName, editorContent);
                            })
                            .catch(() => {
                                alert("Failed to save template.");
                            });
                    });

                    popup.addEventListener("click", (event) => {
                        if (event.target === popup) {
                            popup.remove();
                        }
                    });
                },
                    `<i class="fa-solid fa-circle-plus"></i>` // Add the FontAwesome plus icon
                );

                const restoreDefaultButton = createButton("Restore Default", "restore-default-btn", () => {
                    const editor = tinymce.get(`editorContent-${uniqueTestId}`);
                    if (editor) {
                        const previousContent = previousContentMap[`editorContent-${uniqueTestId}`];
                        if (previousContent) {
                            editor.setContent(previousContent);
                        } else {
                            return;
                        }
                    } else {
                        alert("Editor not found!");
                    }
                }, `<i class="fa-solid fa-rotate-right"></i>`);

                // The "Restore Previous" button functionality
                const restorePreviousButton = createButton("Restore Previous", "restore-previous-btn", () => {
                    const editor = tinymce.get(`editorContent-${uniqueTestId}`);
                    if (editor) {
                        if (previousContent) {
                            console.log("thids sa:", previousContent);
                            editor.setContent(previousContent);
                        } else {
                            return;
                        }
                    } else {
                        alert("Editor not found!");
                    }
                }, `<i class="fa-solid fa-rotate-right"></i>`);

                buttonsDiv.appendChild(saveTemplateButton);
                buttonsDiv.appendChild(restoreDefaultButton);
                buttonsDiv.appendChild(restorePreviousButton); // Added Restore Previous button
                buttonsDiv.appendChild(saveAsDefaultButton);
                detailsDiv.appendChild(buttonsDiv);

                detailsCell.appendChild(detailsDiv);
                detailsRow.appendChild(detailsCell);
                tbody.appendChild(detailsRow);

                // Initialize the TinyMCE editor after 1 second
                setTimeout(() => {
                    initEditor(uniqueTestId, test.interpretation);
                }, 1000);  // 1000ms = 1 second
                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/getTemplatesByTestId`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ testId: test._id }),
                    });

                    if (!response.ok) {
                        console.log(`HTTP error! status: ${response.status}`);
                    }

                    const responseData = await response.json();
                    const templates = responseData?.data?.templates || []; // Default to an empty array if no templates are returned

                    if (templates.length === 0) {
                        apiDataDiv.innerHTML = "No templates available."; // Show a friendly message when no templates are found
                    } else {
                        apiDataDiv.innerHTML = ""; // Clear any previous content
                        templates.forEach((template) => addTemplate(template)); // Add templates if they exist
                    }
                } catch (error) {
                    console.error("Error fetching templates:", error); // Log the error for debugging purposes
                    apiDataDiv.innerHTML = "No templates available."; // Gracefully handle errors as well
                }

                function addTemplate(template) {
                    const templateDiv = document.createElement("div");
                    templateDiv.className = "template-item";

                    const templateNameSpan = document.createElement("span");
                    templateNameSpan.textContent = template.templateName;
                    templateNameSpan.style.cursor = "pointer";
                    templateNameSpan.setAttribute("title", "Double click to choose")
                    templateNameSpan.addEventListener("dblclick", () => {
                        const editor = tinymce.get(`editorContent-${uniqueTestId}`);
                        previousContent = editor.getContent();
                        if (editor) {
                            if (!previousContentMap[`editorContent-${uniqueTestId}`]) {
                                previousContentMap[`editorContent-${uniqueTestId}`] = editor.getContent();
                            }
                            editor.setContent(template.content);
                        }
                    });

                    const deleteIcon = document.createElement("span");
                    deleteIcon.textContent = "🗑️";
                    deleteIcon.style.cursor = "pointer";
                    deleteIcon.style.color = "red";
                    deleteIcon.style.marginLeft = "10px";
                    deleteIcon.setAttribute("title", "Double click, delete left template")
                    deleteIcon.addEventListener("dblclick", () => deleteTemplate(template.templateName, templateDiv));

                    templateDiv.appendChild(templateNameSpan);
                    templateDiv.appendChild(deleteIcon);
                    apiDataDiv.appendChild(templateDiv);
                }

                function addNewTemplate(templateName, content) {
                    const template = { templateName, content };
                    addTemplate(template);
                }

                function deleteTemplate(templateName, templateDiv) {
                    fetch(`${BASE_URL}/api/v1/user/deleteTemplateByName`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ templateName }),
                    })
                        .then((response) => response.json())
                        .then((data) => {
                            if (data.ok) {
                                alert(data.message || "Template deleted successfully!");
                                templateDiv.remove();
                            } else {
                                alert(data.message || "Failed to delete template.");
                            }
                        })
                        .catch(() => {
                            alert("An error occurred while deleting the template.");
                        });
                }
                continue;
            }

            const { lowerValue, upperValue } = await getLowerUpperValues(patient, test.parameters[0].NormalValue);

            const row = document.createElement("tr");
            row.setAttribute("data-order", test.order); // Set a data attribute for sorting

            if (test.parameters && test.parameters.length > 1) {
                // Row for tests with multiple parameters
                row.innerHTML = `
                <td class="test-name">${test.Name}</td>
                <td></td>
                <td></td>
                <td></td>
            `;
                tbody.appendChild(row);

                // Rows for individual parameters
                for (const param of test.parameters) {
                    const { lowerValue, upperValue } = await getLowerUpperValues(patient, param.NormalValue);
                    const paramRow = document.createElement("tr");
                    paramRow.setAttribute("data-order", test.order); // Set a data attribute for sorting
                    paramRow.innerHTML = `
        <td style="padding-left: 20px;" class="test-name" id="parameters">${param.Para_name}</td>
        <td class="unit">
            <div class="value-column">
                <div class="formulaIcon"></div>
                <span class="HighLow"></span>
                <input type="text" name="parameterName" data-Shortname=${test.Short_name} data-id="${param.Para_name.replace(/\s+/g, '')}" data-lower=${lowerValue || ""} data-upper=${upperValue || ""} class="value-input" value="${param.defaultresult || ""}">
                <button class="add-remark" tabindex="-1">+</button>
            </div>
        </td>
        <td>${param.unit}</td>
        <td class="reference"><i class="fas fa-edit" onclick="openModal(this)"></i>${param.text || (lowerValue && upperValue ? `${lowerValue} - ${upperValue}` : "")}</td>
    `;
                    tbody.appendChild(paramRow);
                    // Add remark functionality
                    const addRemarkButton = paramRow.querySelector(".add-remark");
                    const input = row.querySelector("input");
                    // processInput(input);

                    let paramRowCalc = null; // Pehle null se initialize karein

                    if (param.Para_name === "Basophils Percentage") {
                        paramRowCalc = document.createElement("tr");
                        paramRowCalc.setAttribute("data-order", test.order); // Set a data attribute for sorting
                        paramRowCalc.className = "exclude";

                        const paramRowDiv = document.createElement("td");
                        paramRowDiv.setAttribute("colSpan", "4");
                        paramRowCalc.appendChild(paramRowDiv);
                    }

                    // Sirf tab insert karein jab `paramRowCalc` exist kare
                    if (paramRowCalc) {
                        paramRow.parentNode.insertBefore(paramRowCalc, paramRow.nextSibling);
                    }

                    addRemarkButton.addEventListener("click", () => {
                        if (!addRemarkButton.remarkRow) {
                            const remarkRow = document.createElement("tr");
                            remarkRow.setAttribute("data-order", test.order); // Set a data attribute for sorting
                            remarkRow.innerHTML = `
                    <td>Remarks</td>
                    <td colspan="3">
                        <textarea id="remarkoftest"></textarea>
                        <i class="fa-solid fa-trash delete-row"></i>
                    </td>
                `;
                            tbody.insertBefore(remarkRow, paramRow.nextSibling);
                            addRemarkButton.style.display = "none";
                            addRemarkButton.remarkRow = remarkRow;

                            const deleteButton = remarkRow.querySelector(".delete-row");
                            deleteButton.addEventListener("click", () => {
                                remarkRow.remove();
                                addRemarkButton.style.display = "inline-block";
                                addRemarkButton.remarkRow = null;
                            });
                        }
                    });
                }

            } else {
                // Row for tests with single or no parameters
                row.innerHTML = `
                <td class="test-name">${test.Name}</td>
                <td class="unit">
                    <div class="value-column">
                    <div class="formulaIcon"></div>
                    <span class="HighLow"></span>
                    <input type="text" name="valueInput" class="value-input" data-Shortname=${test.Short_name} data-id=${test._id} data-lower=${lowerValue || ""} data-upper=${upperValue || ""} value="${test.parameters?.[0]?.defaultresult || ""}">
                    <button class="add-remark" tabindex="-1">+</button></div>
                </td>
                <td>${test.parameters?.[0]?.unit || ""}</td>
                <td class="reference"><i class="fas fa-edit" onclick="openModal(this)"></i>${test.parameters[0].text || (lowerValue && upperValue ? `${lowerValue} - ${upperValue}` : "")}</td>
            `;
                tbody.appendChild(row);

                // Add remark functionality
                const addRemarkButton = row.querySelector(".add-remark");
                const input = row.querySelector("input");
                // processInput(input);

                let paramRowCalc = null; // Pehle null se initialize karein

                if (test.Name === "Basophils Percentage") {
                    paramRowCalc = document.createElement("tr");
                    paramRowCalc.setAttribute("data-order", test.order); // Set a data attribute for sorting
                    paramRowCalc.className = "exclude";

                    const paramRowDiv = document.createElement("td");
                    paramRowDiv.setAttribute("colSpan", "4");
                    paramRowCalc.appendChild(paramRowDiv);
                }

                // Sirf tab insert karein jab `paramRowCalc` exist kare
                if (paramRowCalc) {
                    row.parentNode.insertBefore(paramRowCalc, row.nextSibling);
                }

                addRemarkButton.addEventListener("click", () => {
                    if (!addRemarkButton.remarkRow) {
                        const remarkRow = document.createElement("tr");
                        remarkRow.setAttribute("data-order", test.order); // Set a data attribute for sorting
                        remarkRow.innerHTML = `
                        <td>Remarks</td>
                        <td colspan="3">
                            <textarea id="remarkoftest"></textarea>
                            <i class="fa-solid fa-trash delete-row"></i>
                        </td>
                    `;
                        tbody.insertBefore(remarkRow, row.nextSibling);
                        addRemarkButton.style.display = "none";
                        addRemarkButton.remarkRow = remarkRow;

                        const deleteButton = remarkRow.querySelector(".delete-row");
                        deleteButton.addEventListener("click", () => {
                            remarkRow.remove();
                            addRemarkButton.style.display = "inline-block";
                            addRemarkButton.remarkRow = null;
                        });
                    }
                });

            }

            // Panel-specific details
            if (isPanel) {
                const hideInterpretation = panelDetails.panelDocument.hideInterpretation;
                const hideMethodInstrument = panelDetails.panelDocument.hideMethodInstrument;

                if (!hideMethodInstrument || !hideInterpretation) {
                    const detailsRow = document.createElement("tr");
                    detailsRow.setAttribute("data-order", test.order); // Set a data attribute for sorting
                    const detailsCell = document.createElement("td");
                    detailsCell.colSpan = 4;

                    const detailsDiv = document.createElement("div");
                    detailsDiv.classList.add("test-details");

                    if (!hideMethodInstrument) {
                        detailsDiv.innerHTML += `
                        ${test.method ? `<p class="methods">Method: ${test.method || ""}</p>` : ""}
                        ${test.instrument ? `<p class="methods">Instrument: ${test.instrument || ""}</p>` : ""}
                    `;
                    }

                    if (!hideInterpretation) {
                        detailsDiv.innerHTML += `
                        <p>${test.interpretation || ""}</p>
                    `;
                    }

                    detailsCell.appendChild(detailsDiv);
                    detailsRow.appendChild(detailsCell);
                    tbody.appendChild(detailsRow);
                }
            } else {
                const detailsRow2 = document.createElement("tr");
                detailsRow2.setAttribute("data-order", test.order); // Set a data attribute for sorting
                const detailsCell2 = document.createElement("td");
                detailsCell2.colSpan = 4;

                const detailsDiv2 = document.createElement("div");
                detailsDiv2.classList.add("test-details");

                detailsDiv2.innerHTML += `
                ${test.method ? `<p>Method: ${test.method || ""}</p>` : ""}
                ${test.instrument ? `<p>Instrument: ${test.instrument || ""}</p>` : ""}
            `;

                detailsDiv2.innerHTML += `
                <p>${test.interpretation || ""}</p>
            `;

                detailsCell2.appendChild(detailsDiv2);
                detailsRow2.appendChild(detailsCell2);
                tbody.appendChild(detailsRow2);
            }
        }

        // Add buttons for Notes, Advice, and Remarks
        const buttonsRow = document.createElement("tr");
        const buttonsCell = document.createElement("td");
        buttonsCell.colSpan = 4;
        buttonsCell.classList.add("table-buttons");

        const buttons = ["Add Notes", "Add Advice", "Add Remarks"];
        buttons.forEach((label) => {
            const button = document.createElement("button");
            button.textContent = label;
            button.classList.add("add-row-button");
            // Dynamically set tabindex="-1" to button
            button.setAttribute('tabindex', '-1');

            button.addEventListener("click", () => {
                if (!button.additionalRow) {
                    const additionalRow = document.createElement("tr");
                    additionalRow.innerHTML = `
                    <td>${label.split(" ")[1]}</td>
                    <td colspan="3">
                        <textarea></textarea>
                        <i class="fa-solid fa-trash delete-row"></i>
                    </td>
                `;
                    tbody.appendChild(additionalRow);
                    button.style.display = "none";
                    button.additionalRow = additionalRow;

                    const deleteButton = additionalRow.querySelector(".delete-row");
                    deleteButton.addEventListener("click", () => {
                        additionalRow.remove();
                        button.style.display = "inline-block";
                        button.additionalRow = null;
                    });
                }
            });

            buttonsCell.appendChild(button);
        });

        table.appendChild(tbody);
        buttonsRow.appendChild(buttonsCell);
        table.appendChild(buttonsRow);

        if (isPanel) {
            if (panelDetails.panelDocument.hideInterpretation) {
                const interpretationrow = document.createElement("tr");
                const interpretationCell = document.createElement("td");
                interpretationCell.colSpan = 4;
                interpretationCell.classList.add("interpretation-row");
                const interpretationDiv = document.createElement("div");
                interpretationDiv.classList.add("interpretations");
                interpretationDiv.id = `displayArea-${panelDetails.panelDocument._id}`;
                interpretationDiv.innerHTML = `<h3 id="editButton-${panelDetails.panelDocument._id}">${panelDetails.panelDocument.interpretation ? 'Interpretations' : ''} <i class="fas fa-edit"></i></h3>
                <div class="pannelInterpretation" id="interpretationText-${panelDetails.panelDocument._id}">${panelDetails.panelDocument.interpretation || ""}</div>`;
                interpretationCell.appendChild(interpretationDiv);

                const editorDiv = document.createElement("div");
                editorDiv.id = `editorContainer-${panelDetails.panelDocument._id}`;
                editorDiv.classList.add("editorContainer");
                editorDiv.style.display = "none";  // Hide the editor initially
                editorDiv.innerHTML = `<div id="editor-${panelDetails.panelDocument._id}"></div>
                <button id="saveButton-${panelDetails.panelDocument._id}" tabindex="-1">Save</button>
                <button id="cancelButton-${panelDetails.panelDocument._id}" tabindex="-1">Cancel</button>`;
                interpretationCell.appendChild(editorDiv);

                interpretationrow.appendChild(interpretationCell);
                table.appendChild(interpretationrow);
                // table.appendChild(tbody);
            }
        }
        // table.appendChild(buttonsRow);
        section.appendChild(table);
        document.getElementById("tables-container").appendChild(section);
        if (isPanel) {
            if (panelDetails.panelDocument.hideInterpretation) {
                await setupInterpretationEdit(panelDetails.panelDocument._id);
            }
        }
        setupListeners();
    }

    function addIconsToMatchingRows() {
        const matchingValues = {
            "Neutrophils-Absolute Count": "(Total Leucocytes Count/100)*Neutrophils Percentage",
            "Lymphocytes-Absolute Count": "(Lymphocyte Percentage/100)*Total Leucocytes Count",
            "Eosinophil-Absolute Count": "(Eosinophils Percentage/100)*Total Leucocytes Count",
            "Monocyte- Absolute Count": "(Monocytes Percentage/100)*Total Leucocytes Count",
            "Basophils-Absolute Count": "(Basophils Percentage/100)*Total Leucocytes Count",
            "Neutrophil Lymphocyte Ratio": "Neutrophils-Absolute Count/Lymphocytes-Absolute Count",
            "Mean Corpuscular Volume (MCV)": "Hematocrit (HCT)*10/Total Red Blood Cell Count",
            "Mean Corpuscular Hemoglobin (MCH)": "Hemoglobin*10/Total Red Blood Cell Count",
            "Mean Corpuscular Hemoglobin Concentration (MCHC)": "Hemoglobin*100/Hematocrit (HCT)",
            "VLDL Cholesterol": "Triglycerides/5",
            "LDL Cholesterol": "Total Cholesterol-HDL Cholesterol-VLDL Cholesterol",
            "LDL / HDL": "LDL Cholesterol / HDL Cholesterol",
            "Total Cholesterol / HDL": "Total Cholesterol/HDL Cholesterol",
            "TG / HDL": "Triglycerides/HDL Cholesterol",
            "Non-HDL cholesterol": "Total Cholesterol-HDL Cholesterol",
            "Serum Bilirubin (Indirect)": "Serum Bilirubin (Total) - Serum Bilirubin (Direct)",
            "Globulin": "Serum Protein-Serum Albumin",
            "A/G Ratio": "Serum Albumin/Globulin",
            "Sgot/Sgpt Ratio Formula": "SGPT (ALT)/SGOT (AST)",
            "BUN": "Serum Urea * 0.467",
            "Urea / Creatinine Ratio": "Serum Urea / Serum Creatinine",
            "BUN / Creatinine Ratio": "BUN / Serum Creatinine",
            "Transferrin Saturation": "Iron * 100 / Total Iron Binding Capacity",
            "Estimated average glucose": "28.7*GLYCATED HAEMOGLOBIN(HbA1c)-46.7",
            "index": "Prothrombin Time Patient Value/Prothrombin Time Control Value"
        };

        const rows = document.querySelectorAll(".table tbody tr[data-order]");

        rows.forEach((row) => {
            const textColumn = row.children[0];
            const valueColumn = row.querySelector(".formulaIcon");

            if (textColumn && valueColumn) {
                const text = textColumn.textContent.trim();

                if (matchingValues[text]) {
                    // Prevent duplicate
                    if (valueColumn.querySelector(".icon")) return;

                    // Create icon span
                    const icon = document.createElement("span");
                    icon.classList.add("icon");
                    icon.innerHTML = `<i class="fa-solid fa-calculator"></i>`;
                    icon.style.cursor = "pointer";
                    icon.style.position = "relative";

                    // Tooltip box
                    const tooltip = document.createElement("div");
                    tooltip.classList.add("tooltip-box");
                    tooltip.textContent = matchingValues[text];

                    // Hover events
                    icon.addEventListener("mouseenter", () => {
                        tooltip.style.display = "block";
                    });
                    icon.addEventListener("mouseleave", () => {
                        tooltip.style.display = "none";
                    });

                    icon.appendChild(tooltip);
                    valueColumn.appendChild(icon);
                }
            }
        });
    }



    // Set up listeners for parameter formulas 
    function setupListeners() {
        const inputs = document.querySelectorAll(".value-input");

        inputs.forEach((input) => {
            input.addEventListener("input", (event) => {
                handleInputChange(event.target);
            });
        });
    }

    // Handle input changes and update formula row
    function handleInputChange(resultInputs) {
        const TotalLeucocytesCount = document.querySelector('input[data-id="679c8a7b8132720d2373cc5a"]');
        const NeutrophilsPercentage = document.querySelector('input[data-id="682f57b2a51beb63e9216687"]');
        const NeutrophilsAbsoluteCount = document.querySelector('input[data-id="682f6c8ca51beb63e921cecb"]');
        const LymphocytePercentage = document.querySelector('input[data-id="682f590fa51beb63e9216697"]');
        const LymphocytesAbsoluteCount = document.querySelector('input[data-id="682f6ce1a51beb63e921cedb"]');
        const EosinophilAbsoluteCount = document.querySelector('input[data-id="682f6d49a51beb63e921ceeb"]');
        const EosinophilsPercentage = document.querySelector('input[data-id="682f5cafa51beb63e92166a7"]');
        const MonocyteAbsoluteCount = document.querySelector('input[data-id="682f6d8ea51beb63e921cefb"]');
        const MonocytesPercentage = document.querySelector('input[data-id="682f6be9a51beb63e921823f"]');
        const BasophilsAbsoluteCount = document.querySelector('input[data-id="682f6dc6a51beb63e921cf0b"]');
        const BasophilsPercentage = document.querySelector('input[data-id="682f6c3ca51beb63e921cebb"]');
        const NeutrophilLymphocyteRatio = document.querySelector('input[data-id="683e964500d2c15788fb633a"]');
        const MeanCorpuscularVolumeMCV = document.querySelector('input[data-id="679ca46c8132720d2373d0ce"]');
        const HematocritHCT = document.querySelector('input[data-id="679ca3d68132720d2373d0b6"]');
        const TotalRedBloodCellCount = document.querySelector('input[data-id="679ca3538132720d2373d0a6"]');
        const MeanCorpuscularHemoglobinMCH = document.querySelector('input[data-id="679ca51e8132720d2373d0e6"]');
        const Hemoglobin = document.querySelector('input[data-id="679c83388132720d2373cc1c"]');
        const MeanCorpuscularHemoglobinConcentrationMCHC = document.querySelector('input[data-id="679ca5ca8132720d2373d133"]');
        const VLDLCholesterol = document.querySelector('input[data-id="679dbc978132720d2373d464"]');
        const Triglycerides = document.querySelector('input[data-id="679dbad38132720d2373d434"]');
        const LDLCholesterol = document.querySelector('input[data-id="679dbc078132720d2373d454"]');
        const TotalCholesterol = document.querySelector('input[data-id="679dba088132720d2373d424"]');
        const HDLCholesterol = document.querySelector('input[data-id="67a32348c284501bf8c11f12"]');
        const LDLHDL = document.querySelector('input[data-id="679dbe3d8132720d2373d64d"]');
        const TotalCholesterolHDL = document.querySelector('input[data-id="679dbf178132720d2373d65d"]');
        const TGHDL = document.querySelector('input[data-id="67a32626c284501bf8c1357d"]');
        const NonHDLcholesterol = document.querySelector('input[data-id="679dcc148132720d2373deab"]');
        const SerumBilirubinIndirect = document.querySelector('input[data-id="679dcf058132720d2373deeb"]');
        const SerumBilirubinTotal = document.querySelector('input[data-id="679dccda8132720d2373debb"]');
        const SerumBilirubinDirect = document.querySelector('input[data-id="679dcd978132720d2373dedb"]');
        const Globulin = document.querySelector('input[data-id="679e2d6ae14cf8855523c886"]');
        const SerumProtein = document.querySelector('input[data-id="679e2845e14cf8855523c85b"]');
        const SerumAlbumin = document.querySelector('input[data-id="679e2c38e14cf8855523c86e"]');
        const AGRatio = document.querySelector('input[data-id="67a32c9dc284501bf8c174bf"]');
        const SgotSgptRatioFormula = document.querySelector('input[data-id="683e943e00d2c15788f9d74b"]');
        const SGPTALT = document.querySelector('input[data-id="679e09dde14cf8855523b996"]');
        const SGOTAST = document.querySelector('input[data-id="679e0bb8e14cf8855523c0b3"]');
        const BUN = document.querySelector('input[data-id="679e4664e14cf8855523d0dd"]');
        const SerumUrea = document.querySelector('input[data-id="679e30d8e14cf8855523c95a"]');
        const UreaCreatinineRatio = document.querySelector('input[data-id="679e534fe14cf8855523d6e2"]');
        const SerumCreatinine = document.querySelector('input[data-id="679e34a0e14cf8855523cb0b"]');
        const BUNCreatinineRatio = document.querySelector('input[data-id="679e54a4e14cf8855523d6f2"]');
        const TransferrinSaturation = document.querySelector('input[data-id="679e5dd3e14cf8855523d764"]');
        const Iron = document.querySelector('input[data-id="679e5b9fe14cf8855523d743"]');
        const TotalIronBindingCapacity = document.querySelector('input[data-id="679e5ccce14cf8855523d754"]');
        const Estimatedaverageglucose = document.querySelector('input[data-id="Estimatedaverageglucose"]');
        const GLYCATEDHAEMOGLOBINHbA1c = document.querySelector('input[data-id="GLYCATEDHAEMOGLOBINHbA1c"]');
        const calculationRow = document.querySelector('tr.exclude td');

        if ([VLDLCholesterol, BUNCreatinineRatio, UreaCreatinineRatio, BUN, SgotSgptRatioFormula,
            AGRatio, Globulin, SerumBilirubinIndirect, NonHDLcholesterol, TGHDL, TotalCholesterolHDL,
            LDLHDL, LDLCholesterol, MeanCorpuscularHemoglobinConcentrationMCHC,
            MeanCorpuscularHemoglobinMCH, MeanCorpuscularVolumeMCV, NeutrophilLymphocyteRatio,
            NeutrophilsAbsoluteCount, LymphocytesAbsoluteCount, EosinophilAbsoluteCount,
            MonocyteAbsoluteCount, BasophilsAbsoluteCount].includes(resultInputs)) {
            if (SerumCreatinine && BUN && BUNCreatinineRatio) {
                // Parse values; default to 0 if empty
                const row2Value = parseFloat(BUN.value) || 0;
                const row3Value = parseFloat(SerumCreatinine.value) || 0;

                // Apply the formula: (Row 1 + Row 2) / 3
                const calculatedValue = row2Value / row3Value;

                // Update the formula row's input
                BUNCreatinineRatio.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
                // Jab user manually kuch likhe to dataset flag set kar do
                processInput(BUNCreatinineRatio);
            }
            if (LDLCholesterol && TotalCholesterol && VLDLCholesterol && HDLCholesterol) {
                // Parse values; default to 0 if empty
                const row1Value = parseFloat(TotalCholesterol.value) || 0;
                const row2Value = parseFloat(HDLCholesterol.value) || 0;
                const row3Value = parseFloat(VLDLCholesterol.value) || 0;

                // Apply the formula: (Row 1 + Row 2) / 3
                const calculatedValue = row1Value - row2Value - row3Value;

                // Update the formula row's input
                LDLCholesterol.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
                // Jab user manually kuch likhe to dataset flag set kar do
                processInput(LDLCholesterol);
            }
            return;
        }

        if (Estimatedaverageglucose && GLYCATEDHAEMOGLOBINHbA1c) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(GLYCATEDHAEMOGLOBINHbA1c.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (28.7 * row2Value) - 46.7;

            // Update the formula row's input
            Estimatedaverageglucose.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(Estimatedaverageglucose);
        }
        if (BUN && SerumUrea) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SerumUrea.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row2Value * 0.467);

            // Update the formula row's input
            BUN.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(BUN);
        }
        if (NeutrophilsPercentage && LymphocytePercentage && EosinophilsPercentage && MonocytesPercentage && BasophilsPercentage) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(NeutrophilsPercentage.value) || 0;
            const row2Value = parseFloat(LymphocytePercentage.value) || 0;
            const row3Value = parseFloat(EosinophilsPercentage.value) || 0;
            const row4Value = parseFloat(MonocytesPercentage.value) || 0;
            const row5Value = parseFloat(BasophilsPercentage.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row1Value + row2Value + row3Value + row4Value + row5Value;

            // Update the formula row's input
            calculationRow.innerText = `Total: ${calculatedValue.toFixed(2)}`; // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            // processInput(UreaCreatinineRatio);
        }
        if (SerumUrea && SerumCreatinine && UreaCreatinineRatio) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SerumUrea.value) || 0;
            const row3Value = parseFloat(SerumCreatinine.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value / row3Value;

            // Update the formula row's input
            UreaCreatinineRatio.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(UreaCreatinineRatio);
        }
        if (TransferrinSaturation && Iron && TotalIronBindingCapacity) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(Iron.value) || 0;
            const row3Value = parseFloat(TotalIronBindingCapacity.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row2Value * 100) / row3Value;

            // Update the formula row's input
            TransferrinSaturation.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(TransferrinSaturation);
        }
        if (SerumCreatinine && BUN && BUNCreatinineRatio) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(BUN.value) || 0;
            const row3Value = parseFloat(SerumCreatinine.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value / row3Value;

            // Update the formula row's input
            BUNCreatinineRatio.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(BUNCreatinineRatio);
        }
        if (SGPTALT && SGOTAST && SgotSgptRatioFormula) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SGPTALT.value) || 0;
            const row3Value = parseFloat(SGOTAST.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value / row3Value;

            // Update the formula row's input
            SgotSgptRatioFormula.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(SgotSgptRatioFormula);
        }
        if (Globulin && AGRatio && SerumAlbumin) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SerumAlbumin.value) || 0;
            const row3Value = parseFloat(Globulin.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value / row3Value;

            // Update the formula row's input
            AGRatio.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(AGRatio);
        }
        if (Globulin && SerumProtein && SerumAlbumin) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SerumProtein.value) || 0;
            const row3Value = parseFloat(SerumAlbumin.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value - row3Value;

            // Update the formula row's input
            Globulin.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(Globulin);
        }
        if (SerumBilirubinDirect && SerumBilirubinTotal && SerumBilirubinIndirect) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(SerumBilirubinTotal.value) || 0;
            const row3Value = parseFloat(SerumBilirubinDirect.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value - row3Value;

            // Update the formula row's input
            SerumBilirubinIndirect.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(SerumBilirubinIndirect);
        }
        if (SerumBilirubinIndirect && SerumBilirubinTotal && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(TotalCholesterol.value) || 0;
            const row3Value = parseFloat(HDLCholesterol.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value - row3Value;

            // Update the formula row's input
            NonHDLcholesterol.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(NonHDLcholesterol);
        }
        if (NonHDLcholesterol && TotalCholesterol && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(TotalCholesterol.value) || 0;
            const row3Value = parseFloat(HDLCholesterol.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value - row3Value;

            // Update the formula row's input
            NonHDLcholesterol.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(NonHDLcholesterol);
        }
        if (TGHDL && Triglycerides && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(HDLCholesterol.value) || 0;
            const row3Value = parseFloat(Triglycerides.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row3Value / row2Value;

            // Update the formula row's input
            TGHDL.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(TGHDL);
        }
        if (TotalCholesterolHDL && TotalCholesterol && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(HDLCholesterol.value) || 0;
            const row3Value = parseFloat(TotalCholesterol.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row3Value / row2Value;

            // Update the formula row's input
            TotalCholesterolHDL.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(TotalCholesterolHDL);
        }
        if (LDLCholesterol && LDLHDL && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row2Value = parseFloat(HDLCholesterol.value) || 0;
            const row3Value = parseFloat(LDLCholesterol.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row3Value / row2Value;

            // Update the formula row's input
            LDLHDL.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(LDLHDL);
        }
        if (LDLCholesterol && TotalCholesterol && VLDLCholesterol && HDLCholesterol) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(TotalCholesterol.value) || 0;
            const row2Value = parseFloat(HDLCholesterol.value) || 0;
            const row3Value = parseFloat(VLDLCholesterol.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row1Value - row2Value - row3Value;

            // Update the formula row's input
            LDLCholesterol.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(LDLCholesterol);
        }
        if (VLDLCholesterol && Triglycerides) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(Triglycerides.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row1Value / 5;

            // Update the formula row's input
            VLDLCholesterol.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(VLDLCholesterol);
        }
        if (MeanCorpuscularHemoglobinConcentrationMCHC && Hemoglobin && HematocritHCT) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(Hemoglobin.value) || 0;
            const row2Value = parseFloat(HematocritHCT.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value * 100) / row2Value;

            // Update the formula row's input
            MeanCorpuscularHemoglobinConcentrationMCHC.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(MeanCorpuscularHemoglobinConcentrationMCHC);
        }
        if (MeanCorpuscularHemoglobinMCH && Hemoglobin && TotalRedBloodCellCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(Hemoglobin.value) || 0;
            const row2Value = parseFloat(TotalRedBloodCellCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value * 10) / row2Value;

            // Update the formula row's input
            MeanCorpuscularHemoglobinMCH.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(MeanCorpuscularHemoglobinMCH);
        }
        if (MeanCorpuscularVolumeMCV && HematocritHCT && TotalRedBloodCellCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(HematocritHCT.value) || 0;
            const row2Value = parseFloat(TotalRedBloodCellCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value * 10) / row2Value;

            // Update the formula row's input
            MeanCorpuscularVolumeMCV.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(MeanCorpuscularVolumeMCV);
        }
        if (NeutrophilLymphocyteRatio && NeutrophilsAbsoluteCount && LymphocytesAbsoluteCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(LymphocytesAbsoluteCount.value) || 0;
            const row2Value = parseFloat(NeutrophilsAbsoluteCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = row2Value / row1Value;

            // Update the formula row's input
            NeutrophilLymphocyteRatio.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(NeutrophilLymphocyteRatio);
        }
        if (BasophilsPercentage && BasophilsAbsoluteCount && TotalLeucocytesCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(BasophilsPercentage.value) || 0;
            const row2Value = parseFloat(TotalLeucocytesCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value / 100) * row2Value;

            // Update the formula row's input
            BasophilsAbsoluteCount.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(BasophilsAbsoluteCount);
        }
        if (MonocytesPercentage && MonocyteAbsoluteCount && TotalLeucocytesCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(MonocytesPercentage.value) || 0;
            const row2Value = parseFloat(TotalLeucocytesCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value / 100) * row2Value;

            // Update the formula row's input
            MonocyteAbsoluteCount.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(MonocyteAbsoluteCount);
        }
        if (EosinophilsPercentage && EosinophilAbsoluteCount && TotalLeucocytesCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(EosinophilsPercentage.value) || 0;
            const row2Value = parseFloat(TotalLeucocytesCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value / 100) * row2Value;

            // Update the formula row's input
            EosinophilAbsoluteCount.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(EosinophilAbsoluteCount);
        }
        if (LymphocytesAbsoluteCount && LymphocytePercentage && TotalLeucocytesCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(LymphocytePercentage.value) || 0;
            const row2Value = parseFloat(TotalLeucocytesCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value / 100) * row2Value;

            // Update the formula row's input
            LymphocytesAbsoluteCount.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(LymphocytesAbsoluteCount);
        }
        if (NeutrophilsAbsoluteCount && NeutrophilsPercentage && TotalLeucocytesCount) {
            // Parse values; default to 0 if empty
            const row1Value = parseFloat(NeutrophilsPercentage.value) || 0;
            const row2Value = parseFloat(TotalLeucocytesCount.value) || 0;

            // Apply the formula: (Row 1 + Row 2) / 3
            const calculatedValue = (row1Value / 100) * row2Value;

            // Update the formula row's input
            NeutrophilsAbsoluteCount.value = calculatedValue.toFixed(2); // Optional: limit to 2 decimal places
            // Jab user manually kuch likhe to dataset flag set kar do
            processInput(NeutrophilsAbsoluteCount);
        }
    }

    // for order in sequence heading, pannels, tests, tables
    async function groupTablesByCategory() {
        const container = document.getElementById("tables-container");
        const sections = Array.from(container.querySelectorAll(".section"));

        // Create a map to group sections by category
        const categoryMap = new Map();

        // 🟢 Step 1: Group sections by category
        for (const section of sections) {
            const categoryHeading = section.querySelector("h2");
            if (categoryHeading) {
                const category = categoryHeading.textContent;
                const dataOrder = categoryHeading.getAttribute("data-order");

                if (!categoryMap.has(category)) {
                    categoryMap.set(category, { sections: [], dataOrder });
                }

                // Preserve the h3 tag if it exists
                const h3Tag = section.querySelector("h3");
                const h3DataOrder = h3Tag?.getAttribute("data-order");

                // Remove the category heading (h2)
                categoryHeading.remove();

                // Move h3 tag above the first table if it exists
                const tables = section.querySelectorAll(".table");
                if (h3Tag && tables.length > 0) {
                    section.insertBefore(h3Tag, tables[0]);
                }

                // 🟢 Step 2: Sort rows inside all tables
                for (const table of tables) {
                    const tbody = table.querySelector("tbody");
                    if (tbody) {
                        const rows = Array.from(tbody.querySelectorAll(":scope > tr"));

                        // ✅ Sorting rows based on `data-order`
                        rows.sort((rowA, rowB) => {
                            const orderA = parseInt(rowA.getAttribute("data-order"), 10) || 9999;
                            const orderB = parseInt(rowB.getAttribute("data-order"), 10) || 9999;
                            return orderA - orderB;
                        });

                        // ✅ Clear existing rows and append sorted rows
                        tbody.innerHTML = "";
                        for (const row of rows) {
                            tbody.appendChild(row);
                        }
                    }
                }

                // Push section into category map
                categoryMap.get(category).sections.push({ section, h3DataOrder: h3DataOrder ? parseInt(h3DataOrder, 10) : null });
            }
        }

        // 🟢 Step 3: Clear the container and re-add grouped sections
        container.innerHTML = "";

        // Sort categories by `data-order`
        const sortedCategories = Array.from(categoryMap.entries()).sort(
            ([, { dataOrder: orderA }], [, { dataOrder: orderB }]) => (orderA || 0) - (orderB || 0)
        );

        // 🟢 Step 4: Append sorted categories and sections
        for (const [category, { sections, dataOrder }] of sortedCategories) {
            const groupedSection = document.createElement("div");
            groupedSection.classList.add("grouped-section");

            // Add category heading
            const categoryHeading = document.createElement("h2");
            categoryHeading.textContent = category;
            if (dataOrder) categoryHeading.setAttribute("data-order", dataOrder);
            groupedSection.appendChild(categoryHeading);

            // Sort sections by `h3DataOrder`
            const sortedSections = sections.sort(({ h3DataOrder: orderA }, { h3DataOrder: orderB }) => {
                if (orderA == undefined || orderA === 0) return 1;
                if (orderB == undefined || orderB === 0) return -1;
                return orderA - orderB;
            });

            // Append sorted sections
            for (const { section } of sortedSections) {
                groupedSection.appendChild(section);
            }

            container.appendChild(groupedSection);
        }
    }

    // for rendering tables and related functions
    async function renderData() {

        const data = await sendValueToDatabase();
        if (!data) return;

        const { singleTests, panels } = data;

        // Group singleTests by category
        const singleTestsByCategory = {};
        singleTests.forEach((test) => {
            const index = uniquetestArray2.indexOf(test.Name);
            if (index > -1 && test.Short_name) {
                uniquetestArray2.splice(index, 1); // Removes only the first occurrence
                uniquetestArray2.push(test.Short_name);
            }
            if (!singleTestsByCategory[test.category]) {
                singleTestsByCategory[test.category] = [];
            }
            singleTestsByCategory[test.category].push(test);
        });

        const matchedCategories = new Set();

        // Render panels and collect matched categories
        if (panels && panels.length > 0) {
            for (const panel of panels) {

                await createTable(
                    `${panel.panelDocument.name}`,
                    panel.panelDocument.category,
                    panel.tests,
                    true,
                    false,
                    panel
                );
                matchedCategories.add(panel.panelDocument.category);
            }
        }

        for (const [category, tests] of Object.entries(singleTestsByCategory)) {
            if (matchedCategories.has(category)) {
                await createTable(category, category, tests, false, false);
            }
        }

        for (const [category, tests] of Object.entries(singleTestsByCategory)) {
            if (!matchedCategories.has(category)) {
                await createTable(category, category, tests);
            }
        }

        await groupTablesByCategory();

        addIconsToMatchingRows();

    }
    await renderData();
    setTimeout(async () => {
        await lisresult();
        await fetchEnteredResult();
    }, 2000);
    addInputListeners();
    // await fetchEnteredResult();


    // for fetching previous results
    async function fetchEnteredResult() {
        const tablecontainer = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");
        // const tablecontainer = document.querySelectorAll('.value-input');
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getBookedTestById`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ BookingId: booking._id }),
            });

            const data = await response.json();
            const enteredValues = data.data?.EnteredValues || []; // Ensure it's an array

            for (const row of tablecontainer) {
                const input = row.querySelector(".value-input");
                const editorContainer = row.querySelector("[id^='editorContent']");

                if (input) {
                    const dataId = input.getAttribute('data-id');
                    // Find matching entry
                    const matchingData = enteredValues.find(entry => entry.TestinputId === dataId);

                    if (matchingData) {
                        input.value = matchingData.currentvalue;
                        processInput(input);
                    }
                }

                if (editorContainer) {
                    const editorId = editorContainer.id;
                    const editor = tinymce.get(editorId);
                    const matchingData = enteredValues.find(entry => entry.isDocumented === "true" && entry.TestinputId === editorId);
                    if (editor && matchingData) {
                        editor.setContent("");
                        editor.setContent(matchingData.currentvalue); // Agar match nahi mila to empty string set karega
                    }
                }
            }

        } catch (error) {
            console.error("Error fetching entered results:", error);
        }
    }

    async function lisresult() {
        const getresultbutton = document.getElementById('getresult');
        const tablecontainer = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");
        const bootalert = document.querySelector(".alert");

        getresultbutton.style.display = "flex";

        getresultbutton.addEventListener("click", fetchlisresult);

        async function fetchlisresult() {
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/getbarcoderesult`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ barcodeIds: booking.acceptedbarcode })
                })

                const data = await response.json();
                console.log(data);

                if (!data.data) {
                    bootalert.classList.remove("fade", "alert-success");
                    bootalert.classList.add("show", "alert-danger");
                    bootalert.textContent = "Lis data not present";
                    setTimeout(() => {
                        bootalert.classList.remove("show");
                        bootalert.classList.add("fade");
                    }, 3000)
                    return;
                }

                const hasNonEmptyArray = Object.values(data.data).some(
                    arr => Array.isArray(arr) && arr.length > 0
                );

                if (data.status === "success" && hasNonEmptyArray) {
                    populatelisresult(data);
                    bootalert.classList.remove("fade", "alert-danger");
                    bootalert.classList.add("show", "alert-success");
                    bootalert.textContent = data.message;
                } else {
                    bootalert.classList.remove("fade", "alert-success");
                    bootalert.classList.add("show", "alert-danger");
                    bootalert.textContent = data.message;
                }

            } catch (error) {
                bootalert.classList.remove("fade", "alert-success");
                bootalert.classList.add("show", "alert-danger");
                bootalert.textContent = error.message;
            }
            setTimeout(() => {
                bootalert.classList.remove("show");
                bootalert.classList.add("fade");
            }, 3000)
        }

        function populatelisresult(data) {
            const object = data.data;

            Object.entries(object).forEach(([Key, value]) => {
                value.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                value.forEach((element) => {
                    console.log(element.lisData);
                    for (const row of tablecontainer) {
                        const input = row.querySelector(".value-input");

                        if (input) {
                            const shortName = input.getAttribute('data-Shortname');

                            // Find matching entry
                            if (element.lisData.hasOwnProperty(shortName)) {
                                input.value = element.lisData[shortName];
                                processInput(input);
                                handleInputChange(input);
                            }
                        }
                    }
                })
            });
        }
    }

    // for seeting default time in input fields
    function defaultdateandtime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so we add 1
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        // Format the date and time to YYYY-MM-DDTHH:MM
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        document.getElementById('reportedOn').value = formattedDateTime;
    };

    // for populating patient information
    function populateHea() {
        document.getElementById("booking-registeration-number").innerText = booking.bookingId;
        // document.getElementById("booking-registeration-number2").innerText = reg_id;
        const patientdetails = document.createElement("div");
        patientdetails.classList.add("report-details-innerDiv2");
        patientdetails.innerHTML = `<div class="left2">
                <div class="infor-div"><div class="tags">Patient Name:</div><div class="value-header">${booking.patientName}</div></div>
                <div class="infor-div"><div class="tags">Age / Sex:</div> <div class="value-header">${booking.year} / ${booking.gender}</div></div>
                <div class="infor-div"><div class="tags">Referred By:</div> <div class="value-header">${booking.doctorName}</div></div>
                <div class="infor-div"><div class="tags">Lab Name:</div> <div class="value-header">${booking.labName}</div></div>
                <div class="infor-div"><div class="tags">Investigations:</div> <div class="value-header">${uniquetestArray2}</div></div>
            </div>
            <div class="right2">
                <div class="registered-div2">
                    <div class="registeration-tag2">Registered on:</div>
                    <span style = "text-align: center;"> ${new Date(booking.date).toISOString().split('T')[0]}    ${booking.time}</span>
                </div>
                <div class="registered-div2">
                    <div class="registeration-tag2">Collected on:</div>
                    <input name="DateTime" type="datetime-local" id="collectedOn" name="collectedOn" value="${new Date(booking.date).toISOString().split('T')[0]}T${booking.time}">
                </div>
                <div class="registered-div2">
                    <div class="registeration-tag2">Received on:</div>
                    <input name="DateTime" type="datetime-local" id="receivedOn" name="receivedOn" value="${recievedOn}">
                </div>
                <div class="registered-div2">
                    <div class="registeration-tag2">Reported on:</div>
                    <input name="DateTime" type="datetime-local" id="reportedOn" name="reportedOn">
                </div>
            </div>
            <div class="barcode-div2">
    <div class="barcode2" style="padding: 8px;">
        <div id="barcodeContainer2">
    <img id="barcodeImage"></img>
</div>
    </div>
</div>
`;

        document.querySelector(".report-details").appendChild(patientdetails);
        defaultdateandtime();
    }

    //initialization
    populateHea();

    // for generating barcode
    async function barcodegenerator() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: booking.bookingId }),
            });

            if (response.ok) {
                const data = await response.json();
                // If your API returns an image URL
                document.getElementById("barcodeImage").src = data.barcode; // Display the barcode image
            } else {
                alert("Failed to generate barcode!");
            }
        } catch (error) {
            console.error("Error generating barcode:", error);
            alert("An error occurred. Please try again.");
        }
    }

    //initialization
    barcodegenerator();

    //for tinymce edit button in interpretation
    async function setupInterpretationEdit(index) {
        const editButton = document.getElementById(`editButton-${index}`);
        const saveButton = document.getElementById(`saveButton-${index}`);
        const cancelButton = document.getElementById(`cancelButton-${index}`);
        const displayArea = document.getElementById(`displayArea-${index}`);
        const editorContainer = document.getElementById(`editorContainer-${index}`);
        const interpretationText = document.getElementById(`interpretationText-${index}`);

        // Check if elements exist before proceeding
        if (editButton) {
            editButton.addEventListener('click', function () {
                displayArea.style.display = 'none';
                editorContainer.style.display = 'block';

                tinymce.init({
                    selector: `#editor-${index}`,
                    height: 300,           // Height in pixels
                    width: 800,
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
        } else {
            console.error(`Elements not found for index: ${index}`);
        }
    }

    // for getting reference lower and upper value
    async function getLowerUpperValues(patient, defaultresults) {
        // Helper function to convert age to days based on the unit
        const convertToDays = (age, unit) => {
            if (unit === "Years" || unit === "years") return age * 365;
            if (unit === "Months" || unit === "months") return age * 30;
            if (unit === "Days" || unit === "days") return age;
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
                return { lowerValue: result.lowerValue, upperValue: result.upperValue };
            }
        }

        // If no match is found, return null or an appropriate message
        return "";
    }

    //for extracting all grouped sections data
    function extractTableData() {
        const tables = document.querySelectorAll("#tables-container .section table");
        const allTableData = [];

        tables.forEach((table) => {
            const category = table.closest(".grouped-section").querySelector("h2")?.textContent || "Unknown Category";
            const title = table.closest(".section").querySelector("h3")?.textContent || "Unknown Title";

            const rows = table.querySelectorAll("tbody tr:not(.exclude)");
            const tableData = [];
            let tableNotes = null;
            let tableRemarks = null;
            let tableAdvice = null;
            let tableInterpretation = null;

            let lastTestObject = null;

            rows.forEach((row) => {
                const testName = row.querySelector(".test-name")?.outerHTML || null;
                const valueInput = row.querySelector(".unit input")?.value || null;
                const unit = row.querySelector(".unit + td")?.textContent?.trim() || null;
                const reference = row.querySelector(".reference")?.textContent?.trim() || null;

                // Check for TinyMCE editor in the row
                const editorContainer = row.querySelector("[id^='editorContent']");
                let editorContent = null;
                let isDocumented = false;

                if (editorContainer) {
                    const editorId = editorContainer.id;
                    const editor = tinymce.get(editorId); // Get TinyMCE editor instance
                    if (editor) {
                        editorContent = editor.getContent(); // Extract editor content
                        isDocumented = true;
                    }
                }

                if (testName || valueInput || unit || reference || editorContent) {
                    const testObject = {
                        testName: editorContent || testName, // Use editor content if available
                        value: valueInput,
                        unit,
                        reference,
                        isDocumented, // True if editor content was extracted
                    };

                    tableData.push(testObject);
                    lastTestObject = testObject;
                } else {
                    const colspanCell = row.querySelector("[colspan='3'], [colspan='4']");
                    if (colspanCell) {
                        if (colspanCell.querySelector("#remarkoftest")) {
                            const value = colspanCell.querySelector("#remarkoftest").value;

                            if (lastTestObject) {
                                lastTestObject.remark = value;
                            }
                        } else if (colspanCell.querySelector("textarea")) {
                            const value = colspanCell.querySelector("textarea").value;

                            if (colspanCell.previousElementSibling?.textContent?.toLowerCase().includes("remarks")) {
                                tableRemarks = value;
                            } else if (colspanCell.previousElementSibling?.textContent?.toLowerCase().includes("advice")) {
                                tableAdvice = value;
                            } else if (colspanCell.previousElementSibling?.textContent?.toLowerCase().includes("notes")) {
                                tableNotes = value;
                            }
                        } else {
                            const innerContent = colspanCell.querySelector(".test-details")?.innerHTML;
                            if (innerContent && lastTestObject) {
                                lastTestObject.details = innerContent;
                            }
                        }
                    }
                }
            });

            // Check for Interpretation row
            const interpretationRow = Array.from(table.querySelectorAll("tr")).find(row =>
                row.querySelector(".interpretation-row")
            );

            if (interpretationRow) {
                const interpretationCell = interpretationRow.querySelector(".interpretations");
                if (interpretationCell) {
                    tableInterpretation = interpretationCell.querySelector(".pannelInterpretation")?.innerHTML?.trim() || null;
                }
            }

            if (tableData.length > 0 || tableNotes || tableRemarks || tableAdvice || tableInterpretation) {
                allTableData.push({
                    category,
                    title,
                    tests: tableData,
                    notes: tableNotes,
                    remarks: tableRemarks,
                    advice: tableAdvice,
                    interpretation: tableInterpretation,
                });
            }
        });

        return allTableData;
    }

    // for saving data 
    async function saveTablesToDatabase(saveOnly) {
        const extractedData = extractTableData();
        delete booking.__v;
        delete booking.updatedAt;
        delete booking._id;
        delete booking.createdAt;
        delete booking.tableData;

        const collectedOn = document.getElementById('collectedOn').value;
        const receivedOn = document.getElementById('receivedOn').value;
        const reportedOn = document.getElementById('reportedOn').value;
        const categorized = document.getElementById('check1').checked;
        const moredetails = document.getElementById('moredetails').value;

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/saveReportData`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    reportData: extractedData, reg_id: booking.bookingId, booking,
                    collectedOn, receivedOn, reportedOn, categorized, moredetails,
                    uniquetestArray: uniquetestArray2
                }),
            });

            if (response.ok && saveOnly) {
                const result = await response.json();
                const barcodeId = result._id;
                const url = `${BASE_URL}/admin.html?page=${user.pdfFormat}&value1=${barcodeId}`;
                window.location.href = url;
            }
        } catch (error) {
            console.error("Error saving tables to database:", error);
            alert("An error occurred while saving the tables. Please try again.");
        }
    }

    // for checking empty fields
    async function checkFields(savebtn) {
        const AllFields = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");
        // const editorContainer = document.querySelectorAll("tbody tr [id^='editorContent']");

        const AllFieldsArray = [];

        for (let field of AllFields) {
            const input = field.querySelector('.value-input');
            const editorContainer = field.querySelector("[id^='editorContent']");

            if (input && input.value.trim() === "" && savebtn) {
                smoothScrollTo(field);
                field.focus();
                return false; // Stop after the first empty field
            }
            else if (editorContainer) {
                const editorId = editorContainer.id;
                const editor = tinymce.get(editorId); // Get TinyMCE editor instance
                if (editor) {
                    const data = {
                        currentvalue: editor.getContent(),
                        TestinputId: editorId,
                        isDocumented: "true"
                    }
                    AllFieldsArray.push(data);
                }
            } else if (input) {
                const data_id = input.getAttribute('data-id');
                const value = input.value.trim();
                const data = {
                    currentvalue: value,
                    TestinputId: data_id,
                    isDocumented: "false"
                }
                AllFieldsArray.push(data);
            }
        }
        if (AllFieldsArray.length >= 0) {
            const id = JSON.parse(localStorage.getItem("booking"))._id;

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/saveOrUpdateBookedTest`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ BookingId: id, EnteredValues: AllFieldsArray }),
                });

                if (response.ok) {
                    const res = await response.json();
                    alert(res.message);
                }
            } catch (error) {
                console.error("Error saving tables to database:", error);
            }
            return true;
        }
    }

    // for scrolling animation
    function smoothScrollTo(element) {
        const elementRect = element.getBoundingClientRect();
        const targetPosition = elementRect.top + window.scrollY - (window.innerHeight / 2) + (elementRect.height / 2);
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        const duration = 600; // Adjust for smoother effect
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);

            window.scrollTo(0, startPosition + distance * easeInOutCubic(progress));

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        requestAnimationFrame(animation);
    }

    async function editdoctorsvisibility() {
        const showlab = document.getElementById('labsign').checked;
        const showfirstdoctor = document.getElementById('firstdoctor').checked;
        const showseconddoctor = document.getElementById('seconddoctor').checked;
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/editdoctorsvisibility`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Specify JSON format
                },
                body: JSON.stringify({ showlab, showfirstdoctor, showseconddoctor }),
            });

            if (response.ok) {
                console.log("signature updated successfully");
            }

        } catch (error) {
            alert(error.message)
            console.log(error.message);
        }
    }

    // Add an event listener for the submit button to trigger the API call
    document.getElementById("finalBtn").addEventListener("click", async (event) => {
        event.preventDefault(); // Prevent default form submission
        const returned = await checkFields(true);
        if (!returned) return;
        await editdoctorsvisibility();
        saveTablesToDatabase(true);
    });
    // Add an event listener for the submit button to trigger the API call
    document.getElementById("saveBtn").addEventListener("click", async (event) => {
        event.preventDefault(); // Prevent default form submission
        event.target.disabled = true;
        const returned = await checkFields(false);
        if (!returned) {
            event.target.disabled = false;
        }
        await editdoctorsvisibility();
        await saveTablesToDatabase(false);
        event.target.disabled = false;
    });

    // Ensure the buttons container starts hidden
    document.getElementById("buttons-container").style.display = "none";

    // Add event listener to the main container
    document.getElementById("reorder-container").addEventListener("click", function () {
        const buttonsContainer = document.getElementById("buttons-container");
        // Toggle the visibility of the buttons container
        if (buttonsContainer.style.display === "none" || buttonsContainer.style.display === "") {
            buttonsContainer.style.display = "flex";
        } else {
            buttonsContainer.style.display = "none";
        }
    });

    // Add event listener to the document to hide the buttons container on outside click
    document.addEventListener("click", function (event) {
        const buttonsContainer = document.getElementById("buttons-container");
        const reorderContainer = document.getElementById("reorder-container");

        // Hide the buttons container if clicked outside
        if (
            buttonsContainer.style.display === "flex" &&
            !reorderContainer.contains(event.target) &&
            !buttonsContainer.contains(event.target)
        ) {
            buttonsContainer.style.display = "none";
        }
    });

    // Add event listeners for the buttons
    document.getElementById("reorder-tables").addEventListener("click", function () {
        window.open(`${BASE_URL}/admin.html?page=test&value1=&value2=`, '_blank');
    });

    document.getElementById("reorder-categories").addEventListener("click", function () {
        window.open(`${BASE_URL}/admin.html?page=categories&value1=&value2=`, '_blank');
    });

    document.getElementById("reorder-pannels").addEventListener("click", function () {
        window.open(`${BASE_URL}/admin.html?page=testPanels&value1=&value2=`, '_blank');
    });

    async function populatedoctorvisibility() {
        try {
            // Send a POST request to the API with value1 in the request body
            const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);

            // Check if the response is okay
            if (!response.ok) {
                throw new Error('Failed to fetch data from API');
            }

            // Parse the response JSON
            const data = await response.json();

            document.getElementById('labsign').checked = data.showlabinchargesign;
            document.getElementById('firstdoctor').checked = data.showfirstdoctorsign;
            document.getElementById('seconddoctor').checked = data.showseconddoctorsign;

        } catch (error) {
            console.log(error.message);
        }
    }
    populatedoctorvisibility();
}

async function initialization() {
    const loader = document.querySelector(".loader");
    loader.style.display = "flex";
    try {
        await loadfunction();
    } catch (error) {
        console.log(error);
    } finally {
        setTimeout(() => {
            loader.style.display = "none";
        }, 2000);
    }
}

initialization();

// Function to open the modal
function openModal(button) {
    document.getElementById('modal').style.display = 'flex';
    // Get the row of the clicked button
    const row = button.closest('tr');
    // Get the first cell's value
    const firstColumnValue = row.cells[0].innerText;
    // Print the value (or use it however you need)
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

//for only add edit reference value
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

// for adding numeric row in reference 
function addRow() {
    const formContainer = document.getElementById('form-container');

    // Clone the first row if it exists, otherwise create a new row
    let newRow;
    if (formContainer.firstElementChild) {
        newRow = formContainer.firstElementChild.cloneNode(true);
    } else {
        newRow = document.createElement('div');
        newRow.className = 'row-container';
        newRow.innerHTML = `
            <span class="delete-btn" onclick="deleteRow(this)">🗑️</span>
            <div class="row-item">
                <label for="sex">Sex</label>
                <select name="sex" class="sex">
                    <option value="Any" >Any</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                </select>
            </div>
            <div class="row-item">
                <label for="min_age">Min. Age</label>
                <input type="number" name="min_age" class="min-age" value="">
            </div>
            <div class="row-item">
                <label for="min_age_unit">Min Age Unit</label>
                <select name="min_age_unit">
                    <option value="Years" >Years</option>
                    <option value="Months" >Months</option>
                    <option value="Days">Days</option>
                </select>
            </div>
            <div class="row-item">
                <label for="max_age">Max. Age</label>
                <input type="number" name="max_age" class="max-age" value="">
            </div>
            <div class="row-item">
                <label for="max_age_unit">Max Age Unit</label>
                <select name="max_age_unit">
                    <option value="Years" >Years</option>
                    <option value="Months" >Months</option>
                    <option value="Days" >Days</option>
                </select>
            </div>
            <div class="row-item">
                <label for="lower_value">Lower Value</label>
                <input type="number" name="lower_value" class="lower-value" value="" oninput="updateReportDisplay(this)">
            </div>
            <div class="row-item">
                <label for="upper_value">Upper Value</label>
                <input type="number" name="upper_value" class="upper-value" value="" oninput="updateReportDisplay(this)">
            </div>
            <div class="row-item">
                <label for="display_report">Display report</label>
                <span class="display-report"> - </span>
            </div>
        `;
    }

    // Reset the values in the new row
    newRow.querySelector('.min-age').value = "";
    newRow.querySelector('.max-age').value = "";
    newRow.querySelector('.lower-value').value = "";
    newRow.querySelector('.upper-value').value = "";

    // Append the new row to the form container
    formContainer.appendChild(newRow);
}

//for deleting row
function deleteRow(element) {
    const formContainer = document.getElementById('form-container');
    if (formContainer.childElementCount > 1) {
        element.parentElement.remove();
    }
}

// for gathering reference data 
function gatherFormData(tname) {
    // for normal value data retrieve
    const selectType = document.getElementById('select-type').value;
    let dataObject = {};
    let text;

    if (selectType === 'text') {
        // Gather data from textarea if type is "text"
        const textAreaData = document.getElementById('text-area').value;
        text = textAreaData;
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

    fetch(`${BASE_URL}/api/v1/user/edit-defaultresults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataObject, tname, text })
    })
        .then(response => response.json())
        .then(result => {
            alert("new reference added successfully");
        })
        .catch(error => {
            console.error('Error:', error);
        });

}


//-----------------------------fetching data result----------------------------------
// for fetching referene value 
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
        for (const para of data.parameters) {
            if (para.Para_name === testName) {
                populateRows(para);
            }
        }

    } catch (error) {
        console.error('Error fetching default results:', error);
    }
}

// for populating reference data
function populateRows(parameter) {
    const formContainer = document.getElementById('form-container');
    const textArea = document.getElementById('text-area');
    formContainer.innerHTML = ''; // Clear any existing rows
    textArea.value = '';

    if (parameter.text) {
        document.getElementById('select-type').value = 'text';
        textArea.style.display = 'block';
        formContainer.style.display = 'none';
        textArea.value = parameter.text;
    } else {
        textArea.style.display = 'none';
        formContainer.innerHTML = ''; // Clear any existing rows
    }

    parameter.NormalValue.forEach(result => {
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

// for updating reference result
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

// for sorting rows 
function sortTests() {
    // Get all the tables
    const tables = document.querySelectorAll(".table");

    tables.forEach((table) => {
        const tbody = table.querySelector("tbody");
        if (tbody) {
            // Sort only rows with the data-order attribute
            sortRowsByDataOrder(tbody);
        }
    });
}

// Function to Sort Rows by data-order Attribute
function sortRowsByDataOrder(tbody) {
    const rows = Array.from(tbody.querySelectorAll("tr"));

    // Separate rows with and without the data-order attribute
    const rowsWithOrder = rows.filter((row) => row.hasAttribute("data-order"));
    const rowsWithoutOrder = rows.filter((row) => !row.hasAttribute("data-order"));

    // Sort rows with the data-order attribute
    rowsWithOrder.sort((rowA, rowB) => {
        const orderA = parseInt(rowA.getAttribute("data-order"), 10) || 0;
        const orderB = parseInt(rowB.getAttribute("data-order"), 10) || 0;
        return orderA - orderB; // Ascending order
    });

    // Rebuild the tbody: maintain the original order for rows without data-order
    tbody.innerHTML = "";

    let withOrderIndex = 0;

    rows.forEach((row) => {
        if (row.hasAttribute("data-order")) {
            tbody.appendChild(rowsWithOrder[withOrderIndex]);
            withOrderIndex++;
        } else {
            tbody.appendChild(row); // Append rows without data-order in their original positions
        }
    });
}
sortTests(); // Ensure sortTests is asynchronou