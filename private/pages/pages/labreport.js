async function loadfunction() {
    // const urlParams = new URLSearchParams(window.location.search);
    const booking = JSON.parse(localStorage.getItem("booking"));
    // for getting individual parameter lower and upper value
    const patient = { age: booking.year, gender: booking.gender };
    //for pdf only (print tale on seperate page)
    document.getElementById('check1').checked = true;
    let isdocumented = false;
    //Array for filtering tests and pannels
    let testArray = [];
    //Array for filtering tests, pannels, package 
    let testArray2 = [];
    let testpanels;
    const loadedTemplateEditors = new Set();
    // for sample receiving time 
    let recievedOn;
    const showRandomBtn = document.getElementById('randomresult');

    function getBookingBarcodeList() {
        const acceptedbarcode = Array.isArray(booking.acceptedbarcode) ? booking.acceptedbarcode.filter(Boolean) : [];
        const tableBarcodes = Array.isArray(booking.tableData)
            ? booking.tableData.map((item) => item?.barcodeId).filter(Boolean)
            : [];

        return [...new Set([...acceptedbarcode, ...tableBarcodes])];
    }

    if (user.showRandomBtn) {
        showRandomBtn.style.display = 'block';
    } else {
        showRandomBtn.style.display = 'none';
    }

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
        console.log("my data:", data);
        testpanels = data[0];
        const barcodeEntries = data?.[0]?.barcodes?.barcodes || [];
        barcodeEntries.forEach((element) => {
            testArray.push(...(element.testandpannelArray || []));
        });

        getallpptfromrelatedbarcode(barcodeEntries);

        recievedOn = formatDateTimeLocal(data[0].barcodes.createdAt);
    } catch (error) {
        console.log("Fetch error:", error.message);
    }

    function getallpptfromrelatedbarcode(barcodes) {
        const barcodeSet = new Set(
            (barcodes || []).map((item) => item?.barcode?.trim()).filter(Boolean)
        );

        (booking.tableData || []).forEach((bookingtableData) => {
            const barcodeId = bookingtableData?.barcodeId?.trim();

            if (!barcodeId || !barcodeSet.has(barcodeId)) {
                return;
            }

            testArray2.push(...((bookingtableData.testName || "").split(',')));
        });
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

    // ✅ CKEditor initialization with proper button setup
    const editorInstances = new Map();
    const previousContentMap = new Map(); // ✅ Global map for storing previous content

    const initEditor = (uniqueTestId, interpretation) => {
        console.log("initEditor - CKEditor");

        const editorElement = document.querySelector(`#editorContent-${uniqueTestId}`);

        if (!editorElement) {
            console.error(`Editor element not found: editorContent-${uniqueTestId}`);
            return;
        }

        // अगर editor पहले से exist करता है तो destroy करें
        if (editorInstances.has(uniqueTestId)) {
            editorInstances.get(uniqueTestId).destroy()
                .then(() => {
                    createNewEditor(uniqueTestId, interpretation, editorElement);
                });
        } else {
            createNewEditor(uniqueTestId, interpretation, editorElement);
        }
    };

    function createNewEditor(uniqueTestId, interpretation, editorElement) {
        const { DecoupledEditor } = window.CKEDITOR;

        DecoupledEditor.create(editorElement, {
            plugins: [
                window.CKEDITOR.Alignment,
                window.CKEDITOR.Autoformat,
                window.CKEDITOR.BlockQuote,
                window.CKEDITOR.Bold,
                window.CKEDITOR.Code,
                window.CKEDITOR.CodeBlock,
                window.CKEDITOR.Essentials,
                window.CKEDITOR.FindAndReplace,
                window.CKEDITOR.FontBackgroundColor,
                window.CKEDITOR.FontColor,
                window.CKEDITOR.FontFamily,
                window.CKEDITOR.FontSize,
                window.CKEDITOR.Heading,
                window.CKEDITOR.Highlight,
                window.CKEDITOR.HorizontalLine,
                window.CKEDITOR.ImageBlock,
                window.CKEDITOR.ImageCaption,
                window.CKEDITOR.ImageInline,
                window.CKEDITOR.ImageInsert,
                window.CKEDITOR.ImageResize,
                window.CKEDITOR.ImageStyle,
                window.CKEDITOR.ImageTextAlternative,
                window.CKEDITOR.ImageToolbar,
                window.CKEDITOR.Indent,
                window.CKEDITOR.IndentBlock,
                window.CKEDITOR.Italic,
                window.CKEDITOR.Link,
                window.CKEDITOR.LinkImage,
                window.CKEDITOR.List,
                window.CKEDITOR.ListProperties,
                window.CKEDITOR.MediaEmbed,
                window.CKEDITOR.PageBreak,
                window.CKEDITOR.Paragraph,
                window.CKEDITOR.RemoveFormat,
                window.CKEDITOR.SpecialCharacters,
                window.CKEDITOR.SpecialCharactersEssentials,
                window.CKEDITOR.Strikethrough,
                window.CKEDITOR.Subscript,
                window.CKEDITOR.Superscript,
                window.CKEDITOR.Table,
                window.CKEDITOR.TableToolbar,
                window.CKEDITOR.TextTransformation,
                window.CKEDITOR.TodoList,
                window.CKEDITOR.Underline,
                window.CKEDITOR.WordCount
            ],
            toolbar: {
                items: [
                    'undo', 'redo',
                    '|',
                    'heading',
                    '|',
                    'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor',
                    '|',
                    'bold', 'italic', 'underline', 'strikethrough',
                    'subscript', 'superscript', 'code',
                    '|',
                    'link', 'insertImage', 'insertTable', 'mediaEmbed',
                    'blockQuote', 'codeBlock',
                    '|',
                    'alignment',
                    '|',
                    'bulletedList', 'numberedList', 'todoList',
                    'outdent', 'indent',
                    '|',
                    'specialCharacters', 'horizontalLine', 'pageBreak',
                    '|',
                    'highlight', 'removeFormat',
                    '|',
                    'findAndReplace'
                ],
                shouldNotGroupWhenFull: true
            },
            fontSize: {
                options: [10, 12, 14, 'default', 18, 20, 24, 30]
            },
            table: {
                contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
            },
            image: {
                toolbar: [
                    'imageTextAlternative', 'toggleImageCaption',
                    '|',
                    'imageStyle:inline', 'imageStyle:block', 'imageStyle:side',
                    '|',
                    'resizeImage'
                ]
            }
        })
            .then(editor => {
                editorInstances.set(uniqueTestId, editor);

                // ✅ Store original content in global map
                if (interpretation) {
                    editor.setData(interpretation);
                    previousContentMap.set(uniqueTestId, interpretation);
                }

                console.log(`✅ CKEditor initialized: ${uniqueTestId}`);

                // Toolbar ko editor ke upar manually add karo
                const toolbarContainer = document.createElement('div');
                toolbarContainer.classList.add('custom-toolbar');
                editorElement.parentNode.insertBefore(toolbarContainer, editorElement);
                toolbarContainer.appendChild(editor.ui.view.toolbar.element);

                // ✅ CRITICAL: Button event listeners ko editor ready hone ke BAAD attach karo
                setupEditorButtons(uniqueTestId);
            })
            .catch(error => console.error(error));
    }

    // ✅ Separate function for button setup (called AFTER editor is ready)
    function setupEditorButtons(uniqueTestId) {
        const test = { _id: uniqueTestId }; // Get test object reference if needed
        // Get button references
        const saveAsDefaultButton = document.querySelector(`[data-editor-id="${uniqueTestId}"][data-action="save-default"]`);
        const saveTemplateButton = document.querySelector(`[data-editor-id="${uniqueTestId}"][data-action="save-template"]`);
        const restoreDefaultButton = document.querySelector(`[data-editor-id="${uniqueTestId}"][data-action="restore-default"]`);
        const restorePreviousButton = document.querySelector(`[data-editor-id="${uniqueTestId}"][data-action="restore-previous"]`);

        // ✅ Save as Default
        if (saveAsDefaultButton) {
            saveAsDefaultButton.addEventListener("click", () => {
                const userConfirmed = confirm("Are you sure you want to save this template as default?");
                if (!userConfirmed) return;

                const editorContent = getEditorContent(uniqueTestId);

                fetch(`${BASE_URL}/api/v1/user/updateTestInterpretation`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        testId: test._id,
                        interpretation: editorContent,
                    }),
                })
                    .then(response => response.json())
                    .then(data => {
                        alert(data ? "Content saved as default successfully!" : "Failed to save interpretation.");
                    })
                    .catch(() => {
                        alert("An error occurred while saving the interpretation.");
                    });
            });
        }

        // ✅ Save Template
        if (saveTemplateButton) {
            saveTemplateButton.addEventListener("click", () => {
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
                    const editorContent = getEditorContent(uniqueTestId);

                    fetch(`${BASE_URL}/api/v1/user/saveTestTemplate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            testId: test._id,
                            templateName,
                            content: editorContent,
                        }),
                    })
                        .then(response => response.json())
                        .then(data => {
                            alert(data.message || "Template saved successfully!");
                            popup.remove();
                            addNewTemplate(templateName, editorContent, uniqueTestId);
                            fetchTemplates(uniqueTestId, test._id);
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
            });
        }

        // ✅ Restore Default
        if (restoreDefaultButton) {
            restoreDefaultButton.addEventListener("click", () => {
                const defaultContent = previousContentMap.get(uniqueTestId);
                if (defaultContent) {
                    setEditorContent(uniqueTestId, defaultContent);
                    console.log("✅ Restored default content");
                } else {
                    alert("No default content available");
                }
            });
        }

        // ✅ Restore Previous
        if (restorePreviousButton) {
            restorePreviousButton.addEventListener("click", () => {
                const previousContent = previousContentMap.get(`${uniqueTestId}_previous`);
                if (previousContent) {
                    setEditorContent(uniqueTestId, previousContent);
                    console.log("✅ Restored previous content");
                } else {
                    alert("No previous content available");
                }
            });
        }
    }

    // Helper function: Get editor content safely
    function getEditorContent(uniqueTestId) {
        const editor = editorInstances.get(uniqueTestId);

        if (!editor) {
            console.warn(`Editor not found for: ${uniqueTestId}`);
            return '';
        }

        try {
            const data = editor.getData();
            return data || '';
        } catch (error) {
            console.error(`Error getting editor data for ${uniqueTestId}:`, error);
            return '';
        }
    }

    // Helper function: Set editor content safely
    function setEditorContent(uniqueTestId, content) {
        const editor = editorInstances.get(uniqueTestId);

        if (!editor) {
            console.warn(`Editor not found for: ${uniqueTestId}`);
            return false;
        }

        try {
            editor.setData(content || '');
            return true;
        } catch (error) {
            console.error(`Error setting editor data for ${uniqueTestId}:`, error);
            return false;
        }
    }

    // ✅ Modified fetchTemplates function
    async function fetchTemplates(uniqueTestId, testId) {
        const apiDataDiv = document.querySelector(`#apiData-${uniqueTestId}`);

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getTemplatesByTestId`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testId }),
            });

            if (!response.ok) {
                console.log(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            const templates = responseData?.data?.templates || [];

            if (templates.length === 0) {
                apiDataDiv.innerHTML = "No templates available.";
            } else {
                apiDataDiv.innerHTML = "";
                templates.forEach((template) => addTemplate(template, uniqueTestId));
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
            apiDataDiv.innerHTML = "No templates available.";
        }
    }

    // ✅ Modified addTemplate function with proper event handling
    function addTemplate(template, uniqueTestId) {
        const apiDataDiv = document.querySelector(`#apiData-${uniqueTestId}`);
        const templateDiv = document.createElement("div");
        templateDiv.className = "template-item";

        const templateNameSpan = document.createElement("span");
        templateNameSpan.textContent = template.templateName;
        templateNameSpan.style.cursor = "pointer";
        templateNameSpan.setAttribute("title", "Double click to choose");

        // ✅ Template apply karne par previous content save karo
        templateNameSpan.addEventListener("click", () => {
            const currentContent = getEditorContent(uniqueTestId);

            // Store current content as previous
            previousContentMap.set(`${uniqueTestId}_previous`, currentContent);

            // Apply template content
            setEditorContent(uniqueTestId, template.content);

            console.log("✅ Template applied, previous content saved");
        });

        const deleteIcon = document.createElement("span");
        deleteIcon.textContent = "🗑️";
        deleteIcon.style.cursor = "pointer";
        deleteIcon.style.color = "red";
        deleteIcon.style.marginLeft = "10px";
        deleteIcon.setAttribute("title", "Double click to delete template");

        deleteIcon.addEventListener("click", () => deleteTemplate(template.templateName, templateDiv));

        templateDiv.appendChild(templateNameSpan);
        templateDiv.appendChild(deleteIcon);
        apiDataDiv.appendChild(templateDiv);
    }

    function addNewTemplate(templateName, content, uniqueTestId) {
        const template = { templateName, content };
        addTemplate(template, uniqueTestId);
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

    // Helper function: Destroy editor safely
    async function destroyEditor(uniqueTestId) {
        const editor = editorInstances.get(uniqueTestId);

        if (!editor) {
            console.warn(`Editor not found for destruction: ${uniqueTestId}`);
            return;
        }

        try {
            await editor.destroy();
            editorInstances.delete(uniqueTestId);
            console.log(`✅ Editor destroyed: ${uniqueTestId}`);
        } catch (error) {
            console.error(`❌ Error destroying editor ${uniqueTestId}:`, error);
            // Forcefully delete from map even if destroy fails
            editorInstances.delete(uniqueTestId);
        }
    }

    //for creating tables
    async function createTable(title, category, data, isPanel = false, hideCategory = false, panelDetails = null) {
        const section = document.createElement("div");
        section.classList.add("section");

        console.log("category:", category);

        // Table heading (only if not hidden)
        if (!hideCategory) {
            const categoryHeading = document.createElement("h2");
            categoryHeading.textContent = category.category;
            categoryHeading.setAttribute('data-order', category.orderId);
            section.appendChild(categoryHeading);

            const heading = document.createElement("h3");
            heading.textContent = title;
            heading.setAttribute('data-order', panelDetails?.order || 999)
            section.appendChild(heading);
        }

        // Table
        const table = document.createElement("table");
        table.className = "table";
        const thead = document.createElement("thead");
        thead.innerHTML = `
        <tr>
            <th>P.B.</th>
            <th>Test</th>
            <th class="valueColumn">Value</th>
            <th>Unit</th>
            <th class="reference">Reference</th>
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
                const pagebreakcell = document.createElement("td");
                pagebreakcell.innerHTML = '<input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1">';
                const detailsCell = document.createElement("td");
                detailsCell.colSpan = 4;
                detailsCell.style.width = "95%";

                const detailsDiv = document.createElement("div");
                detailsDiv.className = "editor-container";

                const editorDiv = document.createElement("div");
                editorDiv.id = `editorContent-${uniqueTestId}`;
                editorDiv.className = "editor-content";
                detailsDiv.appendChild(editorDiv);

                const apiDataDiv = document.createElement("div");
                apiDataDiv.id = `apiData-${uniqueTestId}`;
                apiDataDiv.className = "api-data";
                apiDataDiv.style.marginTop = "10px";
                apiDataDiv.textContent = "Templates load on demand.";
                detailsDiv.appendChild(apiDataDiv);

                const buttonsDiv = document.createElement("div");
                buttonsDiv.className = "buttonsDiv";

                const createButton = (text, className, clickHandler, iconHTML = null) => {
                    const button = document.createElement("button");
                    button.className = className;
                    button.style.marginRight = "10px";

                    if (iconHTML) {
                        const iconElement = document.createElement("span");
                        iconElement.innerHTML = iconHTML;
                        button.appendChild(iconElement);
                    }

                    const textNode = document.createTextNode(text);
                    button.appendChild(textNode);

                    return button;
                };

                // ✅ Create buttons with data attributes
                const saveAsDefaultButton = createButton(
                    "Save as Default",
                    "save-as-default-btn",
                    null,
                    `<i class="fa-solid fa-floppy-disk"></i>`
                );
                saveAsDefaultButton.setAttribute('data-editor-id', uniqueTestId);
                saveAsDefaultButton.setAttribute('data-action', 'save-default');

                const saveTemplateButton = createButton(
                    "Save Template",
                    "save-template-btn",
                    null,
                    `<i class="fa-solid fa-circle-plus"></i>`
                );
                saveTemplateButton.setAttribute('data-editor-id', uniqueTestId);
                saveTemplateButton.setAttribute('data-action', 'save-template');

                const restoreDefaultButton = createButton(
                    "Restore Default",
                    "restore-default-btn",
                    null,
                    `<i class="fa-solid fa-rotate-right"></i>`
                );
                restoreDefaultButton.setAttribute('data-editor-id', uniqueTestId);
                restoreDefaultButton.setAttribute('data-action', 'restore-default');

                const restorePreviousButton = createButton(
                    "Restore Previous",
                    "restore-previous-btn",
                    null,
                    `<i class="fa-solid fa-rotate-right"></i>`
                );
                restorePreviousButton.setAttribute('data-editor-id', uniqueTestId);
                restorePreviousButton.setAttribute('data-action', 'restore-previous');

                buttonsDiv.appendChild(saveTemplateButton);
                buttonsDiv.appendChild(restoreDefaultButton);
                buttonsDiv.appendChild(restorePreviousButton);
                buttonsDiv.appendChild(saveAsDefaultButton);
                detailsDiv.appendChild(buttonsDiv);

                detailsCell.appendChild(detailsDiv);
                detailsRow.appendChild(pagebreakcell);
                detailsRow.appendChild(detailsCell);
                tbody.appendChild(detailsRow);

                const ensureTemplatesLoaded = async () => {
                    if (loadedTemplateEditors.has(uniqueTestId)) {
                        return;
                    }

                    loadedTemplateEditors.add(uniqueTestId);
                    apiDataDiv.textContent = "Loading additional data...";
                    await fetchTemplates(uniqueTestId, test._id);
                };

                setTimeout(() => {
                    initEditor(uniqueTestId, test.interpretation);
                }, 0);

                detailsDiv.addEventListener("focusin", ensureTemplatesLoaded, { once: true });
                detailsDiv.addEventListener("mouseenter", ensureTemplatesLoaded, { once: true });

                continue;
            }

            const { lowerValue, upperValue } = await getLowerUpperValues(patient, test.parameters[0]?.NormalValue);

            const row = document.createElement("tr");
            row.setAttribute("data-order", test.order); // Set a data attribute for sorting

            if (test.parameters && test.parameters.length > 1) {
                // Row for tests with multiple parameters
                row.innerHTML = `
                <td><input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1"></td>
                <td class="test-name">${test.Name}</td>
                <td></td>
                <td></td>
                <td></td>
                    `;
                tbody.appendChild(row);

                // Rows for individual parameters
                for (const param of test.parameters) {
                    const { lowerValue, upperValue } = await getLowerUpperValues(patient, param?.NormalValue);
                    const paramRow = document.createElement("tr");
                    paramRow.setAttribute("data-order", test.order); // Set a data attribute for sorting
                    paramRow.innerHTML = `
        <td><input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1"></td>
        <td style="padding-left: 20px;" class="test-name" id="parameters">${param.Para_name}</td>
        <td class="unit">
            <div class="value-column">
                <div class="formulaIcon"></div>
                <span class="HighLow"></span>
                <input type="text" 
                    name="parameterName" 
                    data-Shortname="${test.Short_name}" 
                    data-id="${param.Para_name.replace(/\s+/g, '')}" 
                    data-lower="${lowerValue || ""}" 
                    data-upper="${upperValue || ""}"
                    data-for-random="${param.forRandom || false}"
                    data-lower-range="${param.lowerRange || ""}"
                    data-upper-range="${param.upperRange || ""}"
                    class="value-input" 
                    value="${param.defaultresult || ""}">
                <button class="add-remark" tabindex="-1">+</button>
            </div>
        </td>
        <td>${param.unit}</td>
        <td class="reference"><i class="fas fa-edit" onclick="openModal(this)"></i>${param?.text || (lowerValue && upperValue ? `${lowerValue} - ${upperValue}` : "")}</td>
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
                            <td></td>
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
                row.innerHTML = `
    <td><input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1"></td>
    <td class="test-name">${test.Name}</td>
    <td class="unit">
        <div class="value-column">
            <div class="formulaIcon"></div>
            <span class="HighLow"></span>
            <input type="text" 
                name="valueInput" 
                class="value-input" 
                data-Shortname="${test.Short_name}" 
                data-id="${test.Name}" 
                data-lower="${lowerValue || ""}" 
                data-upper="${upperValue || ""}"
                data-for-random="${test.parameters?.[0]?.forRandom || false}"
                data-lower-range="${test.parameters?.[0]?.lowerRange || ""}"
                data-upper-range="${test.parameters?.[0]?.upperRange || ""}"
                value="${test.parameters?.[0]?.defaultresult || ""}">
            <button class="add-remark" tabindex="-1">+</button>
        </div>
    </td>
    <td>${test.parameters?.[0]?.unit || ""}</td>
    <td class="reference"><i class="fas fa-edit" onclick="openModal(this)"></i>${test.parameters[0]?.text || (lowerValue && upperValue ? `${lowerValue} - ${upperValue}` : "")}</td>
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
                        <td></td>
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
                const hideInterpretation = panelDetails.hideInterpretation;
                const hideMethodInstrument = panelDetails.hideMethodInstrument;

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

                    const pagebreakCell = document.createElement("td");
                    pagebreakCell.innerHTML = '<input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1">';

                    detailsCell.appendChild(detailsDiv);
                    detailsRow.appendChild(pagebreakCell);
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

                const pagebreakCell = document.createElement("td");
                pagebreakCell.innerHTML = '<input type="checkbox" id="pagebreak" name="pagebreak" tabindex="-1">';
                detailsCell2.appendChild(detailsDiv2);
                detailsRow2.appendChild(pagebreakCell);
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
                    <td></td>
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
            if (panelDetails.hideInterpretation) {
                const interpretationrow = document.createElement("tr");
                const interpretationCell = document.createElement("td");
                interpretationCell.colSpan = 5;
                interpretationCell.classList.add("interpretation-row");
                const interpretationDiv = document.createElement("div");
                interpretationDiv.classList.add("interpretations");
                interpretationDiv.id = `displayArea-${panelDetails._id}`;
                interpretationDiv.innerHTML = `<h3 id="editButton-${panelDetails._id}">${panelDetails.interpretation ? 'Interpretations' : ''} <i class="fas fa-edit"></i></h3>
                <div class="pannelInterpretation" id="interpretationText-${panelDetails._id}">${panelDetails.interpretation || ""}</div>`;
                interpretationCell.appendChild(interpretationDiv);

                const editorDiv = document.createElement("div");
                editorDiv.id = `editorContainer-${panelDetails._id}`;
                editorDiv.classList.add("editorContainer");
                editorDiv.style.display = "none";  // Hide the editor initially
                editorDiv.innerHTML = `<div id="editor-${panelDetails._id}"></div>
                <button id="saveButton-${panelDetails._id}" tabindex="-1">Save</button>
                <button id="cancelButton-${panelDetails._id}" tabindex="-1">Cancel</button>`;
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
            if (panelDetails.hideInterpretation) {
                await setupInterpretationEdit(panelDetails._id);
            }
        }
        setupListeners();
    }

    function generateRandomResults() {
        const tablecontainer = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");

        // Formula wale tests ki list (jo calculate hote hain)
        const formulaBasedTests = [
            "Neutrophils-Absolute Count",
            "Lymphocytes-Absolute Count",
            "Eosinophil-Absolute Count",
            "Monocyte- Absolute Count",
            "Basophils-Absolute Count",
            "Neutrophil Lymphocyte Ratio",
            "Mean Corpuscular Volume (MCV)",
            "Mean Corpuscular Hemoglobin (MCH)",
            "Mean Corpuscular Hemoglobin Concentration (MCHC)",
            "VLDL Cholesterol",
            "LDL Cholesterol",
            "LDL / HDL Ratio",
            "Total Cholesterol / HDL",
            "TG / HDL",
            "Non-HDL cholesterol",
            "Serum Bilirubin (Indirect)",
            "Globulin",
            "A/G Ratio",
            "Sgot/Sgpt Ratio Formula",
            "BUN",
            "Urea / Creatinine Ratio",
            "BUN / Creatinine Ratio",
            "Transferrin Saturation",
            "Estimated average glucose"
        ];

        tablecontainer.forEach((row) => {
            const input = row.querySelector(".value-input");

            if (!input) return; // Agar input nahi hai to skip karo

            const testId = input.getAttribute('data-id');

            // ✅ NEW: Check forRandom attribute
            const forRandom = input.getAttribute('data-for-random');

            // ✅ If forRandom is not true, skip this field
            if (forRandom !== 'true') {
                return;
            }

            // Check karo ki ye formula-based test hai ya nahi
            const isFormulaTest = formulaBasedTests.includes(testId) ||
                row.querySelector('.formulaIcon .icon');

            // Agar formula test hai to skip karo
            if (isFormulaTest) {
                return;
            }

            // ✅ NEW: Get lowerRange and upperRange instead of lowerValue and upperValue
            const lowerRange = parseFloat(input.getAttribute('data-lower-range'));
            const upperRange = parseFloat(input.getAttribute('data-upper-range'));

            // Agar lowerRange ya upperRange valid nahi hai to skip karo
            if (isNaN(lowerRange) || isNaN(upperRange)) {
                console.log(`Skipping ${testId} - invalid range (lower: ${lowerRange}, upper: ${upperRange})`);
                return;
            }

            // Range ke andar random number generate karo
            // Decimal places maintain karne ke liye
            const decimalPlaces = Math.max(
                (lowerRange.toString().split('.')[1] || '').length,
                (upperRange.toString().split('.')[1] || '').length
            );

            const randomValue = (Math.random() * (upperRange - lowerRange) + lowerRange).toFixed(decimalPlaces);

            // Input me value set karo
            input.value = randomValue;

            // Process input to apply styling (L/H indicators)
            processInput(input);

            // Formula calculations trigger karo agar zaroorat ho
            handleInputChange(input);
        });
    }

    // Button ko event listener attach karo (no change needed)
    document.getElementById("randomresult")?.addEventListener("click", function (event) {
        event.preventDefault();
        generateRandomResults();
    });

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
            "LDL / HDL Ratio": "LDL Cholesterol / HDL Cholesterol",
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
            const textColumn = row.children[1];
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
        // Safely get all elements (null check ke saath)
        const getElement = (selector) => document.querySelector(selector);

        const TotalLeucocytesCount = getElement('input[data-id="Total Leucocytes Count"]');
        const NeutrophilsPercentage = getElement('input[data-id="Neutrophils Percentage"]');
        const NeutrophilsAbsoluteCount = getElement('input[data-id="Neutrophils-Absolute Count"]');
        const LymphocytePercentage = getElement('input[data-id="Lymphocyte Percentage"]');
        const LymphocytesAbsoluteCount = getElement('input[data-id="Lymphocytes-Absolute Count"]');
        const EosinophilAbsoluteCount = getElement('input[data-id="Eosinophil-Absolute Count"]');
        const EosinophilsPercentage = getElement('input[data-id="Eosinophils Percentage"]');
        const MonocyteAbsoluteCount = getElement('input[data-id="Monocyte- Absolute Count"]');
        const MonocytesPercentage = getElement('input[data-id="Monocytes Percentage"]');
        const BasophilsAbsoluteCount = getElement('input[data-id="Basophils-Absolute Count"]');
        const BasophilsPercentage = getElement('input[data-id="Basophils Percentage"]');
        const NeutrophilLymphocyteRatio = getElement('input[data-id="683e964500d2c15788fb633a"]');
        const MeanCorpuscularVolumeMCV = getElement('input[data-id="Mean Corpuscular Volume (MCV)"]');
        const HematocritHCT = getElement('input[data-id="Hematocrit (HCT)"]');
        const TotalRedBloodCellCount = getElement('input[data-id="Total Red Blood Cell Count"]');
        const MeanCorpuscularHemoglobinMCH = getElement('input[data-id="Mean Corpuscular Hemoglobin (MCH)"]');
        const Hemoglobin = getElement('input[data-id="Hemoglobin"]');
        const MeanCorpuscularHemoglobinConcentrationMCHC = getElement('input[data-id="Mean Corpuscular Hemoglobin Concentration (MCHC)"]');
        const VLDLCholesterol = getElement('input[data-id="VLDL Cholesterol"]');
        const Triglycerides = getElement('input[data-id="Triglycerides"]');
        const LDLCholesterol = getElement('input[data-id="LDL Cholesterol"]');
        const TotalCholesterol = getElement('input[data-id="Total Cholesterol"]');
        const HDLCholesterol = getElement('input[data-id="HDL Cholesterol"]');
        const LDLHDL = getElement('input[data-id="LDL / HDL Ratio"]');
        const TotalCholesterolHDL = getElement('input[data-id="Total Cholesterol / HDL"]');
        const TGHDL = getElement('input[data-id="TG / HDL"]');
        const NonHDLcholesterol = getElement('input[data-id="Non-HDL cholesterol"]');
        const SerumBilirubinIndirect = getElement('input[data-id="Serum Bilirubin (Indirect)"]');
        const SerumBilirubinTotal = getElement('input[data-id="Serum Bilirubin (Total)"]');
        const SerumBilirubinDirect = getElement('input[data-id="Serum Bilirubin (Direct)"]');
        const Globulin = getElement('input[data-id="Globulin"]');
        const SerumProtein = getElement('input[data-id="Serum Protein"]');
        const SerumAlbumin = getElement('input[data-id="Serum Albumin"]');
        const AGRatio = getElement('input[data-id="A/G Ratio"]');
        const SgotSgptRatioFormula = getElement('input[data-id="SGOT/SGPT RATIO"]');
        const SGPTALT = getElement('input[data-id="SGPT (ALT)"]');
        const SGOTAST = getElement('input[data-id="SGOT (AST)"]');
        const BUN = getElement('input[data-id="BUN"]');
        const SerumUrea = getElement('input[data-id="Serum Urea"]');
        const UreaCreatinineRatio = getElement('input[data-id="Urea / Creatinine Ratio"]');
        const SerumCreatinine = getElement('input[data-id="Serum Creatinine"]');
        const BUNCreatinineRatio = getElement('input[data-id="BUN / Creatinine Ratio"]');
        const TransferrinSaturation = getElement('input[data-id="Transferrin Saturation"]');
        const Iron = getElement('input[data-id="Iron"]');
        const TotalIronBindingCapacity = getElement('input[data-id="Total Iron Binding Capacity"]');
        const Estimatedaverageglucose = getElement('input[data-id="Estimatedaverageglucose"]');
        const GLYCATEDHAEMOGLOBINHbA1c = getElement('input[data-id="GLYCATED HAEMOGLOBIN(HbA1c)"]');
        const calculationRow = getElement('tr.exclude td');

        // Helper function to safely get value
        const getValue = (element) => {
            if (!element) return 0;
            return parseFloat(element.value) || 0;
        };

        // Helper function to safely set value
        const setValue = (element, value) => {
            if (!element) return;
            element.value = value.toFixed(2);
            processInput(element);
        };

        // Check if resultInputs is a formula field
        const formulaFields = [
            VLDLCholesterol, BUNCreatinineRatio, UreaCreatinineRatio, BUN, SgotSgptRatioFormula,
            AGRatio, Globulin, SerumBilirubinIndirect, NonHDLcholesterol, TGHDL, TotalCholesterolHDL,
            LDLHDL, LDLCholesterol, MeanCorpuscularHemoglobinConcentrationMCHC,
            MeanCorpuscularHemoglobinMCH, MeanCorpuscularVolumeMCV, NeutrophilLymphocyteRatio,
            NeutrophilsAbsoluteCount, LymphocytesAbsoluteCount, EosinophilAbsoluteCount,
            MonocyteAbsoluteCount, BasophilsAbsoluteCount
        ].filter(el => el !== null); // Filter out null values

        if (formulaFields.includes(resultInputs)) {
            // BUN / Creatinine Ratio
            if (SerumCreatinine && BUN && BUNCreatinineRatio) {
                const bunValue = getValue(BUN);
                const creatinineValue = getValue(SerumCreatinine);
                if (creatinineValue !== 0) {
                    setValue(BUNCreatinineRatio, bunValue / creatinineValue);
                }
            }

            // LDL Cholesterol
            if (LDLCholesterol && TotalCholesterol && VLDLCholesterol && HDLCholesterol) {
                const totalChol = getValue(TotalCholesterol);
                const hdlChol = getValue(HDLCholesterol);
                const vldlChol = getValue(VLDLCholesterol);
                setValue(LDLCholesterol, totalChol - hdlChol - vldlChol);
            }
            return;
        }

        // Estimated Average Glucose
        if (Estimatedaverageglucose && GLYCATEDHAEMOGLOBINHbA1c) {
            const hba1c = getValue(GLYCATEDHAEMOGLOBINHbA1c);
            if (hba1c !== 0) {
                setValue(Estimatedaverageglucose, (28.7 * hba1c) - 46.7);
            }
        }

        // BUN from Urea
        if (BUN && SerumUrea) {
            const urea = getValue(SerumUrea);
            setValue(BUN, urea * 0.467);
        }

        // Total Percentage Calculation
        if (NeutrophilsPercentage && LymphocytePercentage && EosinophilsPercentage &&
            MonocytesPercentage && BasophilsPercentage && calculationRow) {
            const total = getValue(NeutrophilsPercentage) + getValue(LymphocytePercentage) +
                getValue(EosinophilsPercentage) + getValue(MonocytesPercentage) +
                getValue(BasophilsPercentage);
            calculationRow.innerText = `Total: ${total.toFixed(2)}`;
        }

        // Urea / Creatinine Ratio
        if (SerumUrea && SerumCreatinine && UreaCreatinineRatio) {
            const urea = getValue(SerumUrea);
            const creatinine = getValue(SerumCreatinine);
            if (creatinine !== 0) {
                setValue(UreaCreatinineRatio, urea / creatinine);
            }
        }

        // Transferrin Saturation
        if (TransferrinSaturation && Iron && TotalIronBindingCapacity) {
            const iron = getValue(Iron);
            const tibc = getValue(TotalIronBindingCapacity);
            if (tibc !== 0) {
                setValue(TransferrinSaturation, (iron * 100) / tibc);
            }
        }

        // SGOT/SGPT Ratio
        if (SGPTALT && SGOTAST && SgotSgptRatioFormula) {
            const sgpt = getValue(SGPTALT);
            const sgot = getValue(SGOTAST);
            if (sgot !== 0) {
                setValue(SgotSgptRatioFormula, sgpt / sgot);
            }
        }

        // A/G Ratio
        if (Globulin && AGRatio && SerumAlbumin) {
            const albumin = getValue(SerumAlbumin);
            const globulin = getValue(Globulin);
            if (globulin !== 0) {
                setValue(AGRatio, albumin / globulin);
            }
        }

        // Globulin
        if (Globulin && SerumProtein && SerumAlbumin) {
            const protein = getValue(SerumProtein);
            const albumin = getValue(SerumAlbumin);
            setValue(Globulin, protein - albumin);
        }

        // Serum Bilirubin (Indirect)
        if (SerumBilirubinDirect && SerumBilirubinTotal && SerumBilirubinIndirect) {
            const total = getValue(SerumBilirubinTotal);
            const direct = getValue(SerumBilirubinDirect);
            setValue(SerumBilirubinIndirect, total - direct);
        }

        // Non-HDL Cholesterol
        if (NonHDLcholesterol && TotalCholesterol && HDLCholesterol) {
            const total = getValue(TotalCholesterol);
            const hdl = getValue(HDLCholesterol);
            setValue(NonHDLcholesterol, total - hdl);
        }

        // TG / HDL Ratio
        if (TGHDL && Triglycerides && HDLCholesterol) {
            const tg = getValue(Triglycerides);
            const hdl = getValue(HDLCholesterol);
            if (hdl !== 0) {
                setValue(TGHDL, tg / hdl);
            }
        }

        // Total Cholesterol / HDL Ratio
        if (TotalCholesterolHDL && TotalCholesterol && HDLCholesterol) {
            const total = getValue(TotalCholesterol);
            const hdl = getValue(HDLCholesterol);
            if (hdl !== 0) {
                setValue(TotalCholesterolHDL, total / hdl);
            }
        }

        // LDL / HDL Ratio
        if (LDLCholesterol && LDLHDL && HDLCholesterol) {
            const ldl = getValue(LDLCholesterol);
            const hdl = getValue(HDLCholesterol);
            if (hdl !== 0) {
                setValue(LDLHDL, ldl / hdl);
            }
        }

        // LDL Cholesterol (recalculate if needed)
        if (LDLCholesterol && TotalCholesterol && VLDLCholesterol && HDLCholesterol) {
            const total = getValue(TotalCholesterol);
            const hdl = getValue(HDLCholesterol);
            const vldl = getValue(VLDLCholesterol);
            setValue(LDLCholesterol, total - hdl - vldl);
        }

        // VLDL Cholesterol
        if (VLDLCholesterol && Triglycerides) {
            const tg = getValue(Triglycerides);
            setValue(VLDLCholesterol, tg / 5);
        }

        // MCHC
        if (MeanCorpuscularHemoglobinConcentrationMCHC && Hemoglobin && HematocritHCT) {
            const hb = getValue(Hemoglobin);
            const hct = getValue(HematocritHCT);
            if (hct !== 0) {
                setValue(MeanCorpuscularHemoglobinConcentrationMCHC, (hb * 100) / hct);
            }
        }

        // MCH
        if (MeanCorpuscularHemoglobinMCH && Hemoglobin && TotalRedBloodCellCount) {
            const hb = getValue(Hemoglobin);
            const rbc = getValue(TotalRedBloodCellCount);
            if (rbc !== 0) {
                setValue(MeanCorpuscularHemoglobinMCH, (hb * 10) / rbc);
            }
        }

        // MCV
        if (MeanCorpuscularVolumeMCV && HematocritHCT && TotalRedBloodCellCount) {
            const hct = getValue(HematocritHCT);
            const rbc = getValue(TotalRedBloodCellCount);
            if (rbc !== 0) {
                setValue(MeanCorpuscularVolumeMCV, (hct * 10) / rbc);
            }
        }

        // Neutrophil Lymphocyte Ratio
        if (NeutrophilLymphocyteRatio && NeutrophilsAbsoluteCount && LymphocytesAbsoluteCount) {
            const neutrophils = getValue(NeutrophilsAbsoluteCount);
            const lymphocytes = getValue(LymphocytesAbsoluteCount);
            if (lymphocytes !== 0) {
                setValue(NeutrophilLymphocyteRatio, neutrophils / lymphocytes);
            }
        }

        // Basophils Absolute Count
        if (BasophilsPercentage && BasophilsAbsoluteCount && TotalLeucocytesCount) {
            const percentage = getValue(BasophilsPercentage);
            const wbc = getValue(TotalLeucocytesCount);
            setValue(BasophilsAbsoluteCount, (percentage / 100) * wbc);
        }

        // Monocytes Absolute Count
        if (MonocytesPercentage && MonocyteAbsoluteCount && TotalLeucocytesCount) {
            const percentage = getValue(MonocytesPercentage);
            const wbc = getValue(TotalLeucocytesCount);
            setValue(MonocyteAbsoluteCount, (percentage / 100) * wbc);
        }

        // Eosinophils Absolute Count
        if (EosinophilsPercentage && EosinophilAbsoluteCount && TotalLeucocytesCount) {
            const percentage = getValue(EosinophilsPercentage);
            const wbc = getValue(TotalLeucocytesCount);
            setValue(EosinophilAbsoluteCount, (percentage / 100) * wbc);
        }

        // Lymphocytes Absolute Count
        if (LymphocytesAbsoluteCount && LymphocytePercentage && TotalLeucocytesCount) {
            const percentage = getValue(LymphocytePercentage);
            const wbc = getValue(TotalLeucocytesCount);
            setValue(LymphocytesAbsoluteCount, (percentage / 100) * wbc);
        }

        // Neutrophils Absolute Count
        if (NeutrophilsAbsoluteCount && NeutrophilsPercentage && TotalLeucocytesCount) {
            const percentage = getValue(NeutrophilsPercentage);
            const wbc = getValue(TotalLeucocytesCount);
            setValue(NeutrophilsAbsoluteCount, (percentage / 100) * wbc);
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

    async function renderData() {
        // const data = await sendValueToDatabase();
        if (!testpanels) return;
        console.log("data is here:", testpanels);

        const { singleTests, panels } = testpanels;

        // Create an array of {category, tests} instead of an object
        const singleTestsByCategory = [];

        singleTests.forEach((test) => {
            // Update uniqueTestArray2
            const index = uniquetestArray2.indexOf(test.Name);
            if (index > -1 && test.Short_name) {
                uniquetestArray2.splice(index, 1);
                uniquetestArray2.push(test.Short_name);
            }

            // Check if this category object is already present
            let existingCategory = singleTestsByCategory.find(
                (entry) => entry.category.category === test.category.category
            );

            if (!existingCategory) {
                existingCategory = {
                    category: test.category, // store full category object
                    tests: []
                };
                singleTestsByCategory.push(existingCategory);
            }

            existingCategory.tests.push(test);
        });

        console.log("singleTestsByCategory:", singleTestsByCategory);

        const matchedCategories = new Set();

        // Render panels and collect matched categories
        if (panels && panels.length > 0) {
            for (const panel of panels) {
                console.log("Rendering panels:", panel);
                await createTable(
                    `${panel.name}`,
                    panel.category,
                    panel.testsId,
                    true,
                    false,
                    panel
                );

                matchedCategories.add(panel.category);
            }
        }

        // Render single tests whose categories are already matched
        for (const entry of singleTestsByCategory) {
            console.log("Checking category for single tests:", entry);
            const { category, tests } = entry;
            if (matchedCategories.has(category.category)) {
                await createTable(category.category, category, tests, false, false);
            }
        }

        // Render single tests whose categories were not matched
        for (const entry of singleTestsByCategory) {
            console.log("Rendering unmatched category for single tests:", entry);
            const { category, tests } = entry;
            if (!matchedCategories.has(category.category)) {
                await createTable(category.category, category, tests);
            }
        }

        await groupTablesByCategory();

        addIconsToMatchingRows();
    }

    await renderData();
    setTimeout(() => {
        Promise.allSettled([lisresult(), fetchEnteredResult()]);
    }, 0);
    addInputListeners();
    // await fetchEnteredResult();

    // for fetching previous results
    async function fetchEnteredResult() {
        const tablecontainer = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getBookedTestById`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ BookingId: booking._id }),
            });

            const data = await response.json();
            const enteredValues = data.data?.EnteredValues || [];
            const enteredValueMap = new Map(
                Object.values(enteredValues || {})
                    .filter(Boolean)
                    .map((entry) => [`${entry.isDocumented === "true" ? "doc:" : "input:"}${entry.TestinputId}`, entry])
            );

            for (const row of tablecontainer) {
                const checkbox = row.cells[0].querySelector('input[type="checkbox"]');
                const input = row.querySelector(".value-input");
                const editorContainer = row.querySelector("[id^='editorContent']");

                if (input) {
                    const dataId = input.getAttribute('data-id');
                    const matchingData = enteredValueMap.get(`input:${dataId}`);

                    checkbox.checked = matchingData?.pagebreak || false;

                    if (matchingData) {
                        input.value = matchingData.currentvalue;
                        processInput(input);
                    }
                }

                if (editorContainer) {
                    const editorId = editorContainer.id;
                    const uniqueTestId = editorId.replace('editorContent-', ''); // ✅ Extract uniqueTestId
                    const matchingData = enteredValueMap.get(`doc:${editorId}`);
                    checkbox.checked = matchingData?.pagebreak || false;

                    if (matchingData) {
                        // ✅ CKEditor में content set karna
                        // Pehle check karo ki editor ready hai ya nahi
                        setTimeout(() => {
                            const success = setEditorContent(uniqueTestId, matchingData.currentvalue);
                            if (!success) {
                                console.warn(`Failed to set content for editor: ${uniqueTestId}`);
                            }
                        }, 1500); // Editor initialize hone ka time do
                    }
                }
            }

        } catch (error) {
            console.error("Error fetching entered results:", error);
        }
    }

    async function lisresult() {
        const getresultbutton = document.getElementById('getresult');
        const modifycase = document.getElementById('modifycase');
        const tablecontainer = document.querySelectorAll("#tables-container .section table tbody tr:not(.exclude)");
        const bootalert = document.querySelector(".alert");

        getresultbutton.style.display = "flex";

        getresultbutton.addEventListener("click", fetchlisresult);

        modifycase.addEventListener('click', function () {
            window.open(`${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`, "_blank")
        })

        async function fetchlisresult() {
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/getbarcoderesult`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ barcodeIds: getBookingBarcodeList() })
                })

                const data = await response.json();
                console.log(data);

                if (!data.data) {
                    bootalert.classList.remove("fade", "alert-success");
                    bootalert.classList.add("show", "alert-danger");
                    bootalert.textContent = data.message;
                    setTimeout(() => {
                        bootalert.classList.remove("show");
                        bootalert.classList.add("fade");
                    }, 10000)
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
        console.log("booking data in report page:", booking);
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
                    <span style = "text-align: center;"> ${new Date(booking.date).toLocaleDateString().split('T')[0]}    ${booking.time}</span>
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
    await populateHea();

    // for generating barcode
    async function barcodegenerator() {
        const barcodeList = getBookingBarcodeList();
        const barcodeNumber = barcodeList[0] || booking.bookingId;

        if (!barcodeNumber) {
            console.warn("Barcode source not available for labreport");
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: barcodeNumber }),
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

    async function setupInterpretationEdit(index) {
        const editButton = document.getElementById(`editButton-${index}`);
        const saveButton = document.getElementById(`saveButton-${index}`);
        const cancelButton = document.getElementById(`cancelButton-${index}`);
        const displayArea = document.getElementById(`displayArea-${index}`);
        const editorContainer = document.getElementById(`editorContainer-${index}`);
        const interpretationText = document.getElementById(`interpretationText-${index}`);
        const editorElementId = `editor-${index}`;
        const editorKey = `panel-${index}`;

        if (editButton) {
            editButton.addEventListener('click', async function () {
                // ✅ Pehle existing editor ko destroy karo (agar exist karta hai)
                if (editorInstances.has(editorKey)) {
                    await editorInstances.get(editorKey).destroy();
                    editorInstances.delete(editorKey);
                }

                // ✅ Purane toolbar ko remove karo
                const existingToolbar = editorContainer.querySelector('.ck-toolbar-container');
                if (existingToolbar) {
                    existingToolbar.remove();
                }

                // ✅ Editor element ko clear karo
                const editorElement = document.querySelector(`#${editorElementId}`);
                if (editorElement) {
                    editorElement.innerHTML = '';
                }

                // Display area ko hide karo aur editor ko show karo
                displayArea.style.display = 'none';
                editorContainer.style.display = 'block';

                // ✅ CKEditor initialize karo
                const { DecoupledEditor } = window.CKEDITOR;

                try {
                    const editor = await DecoupledEditor.create(editorElement, {
                        plugins: [
                            window.CKEDITOR.Alignment,
                            window.CKEDITOR.Autoformat,
                            window.CKEDITOR.BlockQuote,
                            window.CKEDITOR.Bold,
                            window.CKEDITOR.Code,
                            window.CKEDITOR.CodeBlock,
                            window.CKEDITOR.Essentials,
                            window.CKEDITOR.FindAndReplace,
                            window.CKEDITOR.FontBackgroundColor,
                            window.CKEDITOR.FontColor,
                            window.CKEDITOR.FontFamily,
                            window.CKEDITOR.FontSize,
                            window.CKEDITOR.Heading,
                            window.CKEDITOR.Highlight,
                            window.CKEDITOR.HorizontalLine,
                            window.CKEDITOR.ImageBlock,
                            window.CKEDITOR.ImageCaption,
                            window.CKEDITOR.ImageInline,
                            window.CKEDITOR.ImageInsert,
                            window.CKEDITOR.ImageResize,
                            window.CKEDITOR.ImageStyle,
                            window.CKEDITOR.ImageTextAlternative,
                            window.CKEDITOR.ImageToolbar,
                            window.CKEDITOR.Indent,
                            window.CKEDITOR.IndentBlock,
                            window.CKEDITOR.Italic,
                            window.CKEDITOR.Link,
                            window.CKEDITOR.LinkImage,
                            window.CKEDITOR.List,
                            window.CKEDITOR.ListProperties,
                            window.CKEDITOR.MediaEmbed,
                            window.CKEDITOR.PageBreak,
                            window.CKEDITOR.Paragraph,
                            window.CKEDITOR.RemoveFormat,
                            window.CKEDITOR.SpecialCharacters,
                            window.CKEDITOR.SpecialCharactersEssentials,
                            window.CKEDITOR.Strikethrough,
                            window.CKEDITOR.Subscript,
                            window.CKEDITOR.Superscript,
                            window.CKEDITOR.Table,
                            window.CKEDITOR.TableToolbar,
                            window.CKEDITOR.TextTransformation,
                            window.CKEDITOR.TodoList,
                            window.CKEDITOR.Underline,
                            window.CKEDITOR.WordCount
                        ],
                        toolbar: {
                            items: [
                                'undo', 'redo',
                                '|',
                                'heading',
                                '|',
                                'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor',
                                '|',
                                'bold', 'italic', 'underline', 'strikethrough',
                                'subscript', 'superscript', 'code',
                                '|',
                                'link', 'insertImage', 'insertTable', 'mediaEmbed',
                                'blockQuote', 'codeBlock',
                                '|',
                                'alignment',
                                '|',
                                'bulletedList', 'numberedList', 'todoList',
                                'outdent', 'indent',
                                '|',
                                'specialCharacters', 'horizontalLine', 'pageBreak',
                                '|',
                                'highlight', 'removeFormat',
                                '|',
                                'findAndReplace'
                            ],
                            shouldNotGroupWhenFull: true
                        },
                        table: {
                            contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
                        },
                        placeholder: 'Type your content here...'
                    });

                    // ✅ Toolbar ko manually attach karo
                    const toolbarContainer = document.createElement('div');
                    toolbarContainer.classList.add('ck-toolbar-container');
                    editorContainer.insertBefore(toolbarContainer, editorElement);
                    toolbarContainer.appendChild(editor.ui.view.toolbar.element);

                    // ✅ Editor instance ko store karo
                    editorInstances.set(editorKey, editor);

                    // ✅ Initial content set karo
                    if (interpretationText?.innerHTML) {
                        editor.setData(interpretationText.innerHTML);
                    }

                    console.log(`✅ CKEditor initialized for ${editorKey}`);
                } catch (error) {
                    console.error('❌ Error initializing CKEditor:', error);
                }
            });

            saveButton.addEventListener('click', async function () {
                const content = getEditorContent(editorKey);
                if (content !== null) {
                    interpretationText.innerHTML = content;
                }

                // Editor ko destroy karo
                await destroyEditor(editorKey);

                editorContainer.style.display = 'none';
                displayArea.style.display = 'block';
            });

            cancelButton.addEventListener('click', async function () {
                // Editor ko destroy karo bina content save kiye
                await destroyEditor(editorKey);

                editorContainer.style.display = 'none';
                displayArea.style.display = 'block';
            });
        }
    }

    // for getting reference lower and upper value
    async function getLowerUpperValues(patient, defaultresults) {

        if (!patient || !defaultresults || defaultresults.length === 0) {
            return "";
        }
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

    // Fixed extractTableData function - All rows ka pagebreak track
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
                // ✅ Har row ke liye pagebreak check karo
                const pagebreak = row?.cells[0]?.querySelector('input[type="checkbox"]')?.checked || false;

                const testName = row.querySelector(".test-name")?.outerHTML || null;
                const valueInput = row.querySelector(".unit input")?.value || null;
                const unit = row.querySelector(".unit + td")?.textContent?.trim() || null;
                const reference = row.querySelector(".reference")?.textContent?.trim() || null;

                // Check for CKEditor in the row
                const editorContainer = row.querySelector("[id^='editorContent']");
                let editorContent = null;
                let isDocumented = false;

                if (editorContainer) {
                    const editorId = editorContainer.id;
                    const uniqueTestId = editorId.replace('editorContent-', '');
                    editorContent = getEditorContent(uniqueTestId);
                    if (editorContent) {
                        isDocumented = true;
                    }
                }

                // ✅ Main test row
                if (testName || valueInput || unit || reference || editorContent) {
                    console.log("testname pagebreak:", pagebreak);
                    const testObject = {
                        pagebreak: pagebreak,
                        testName: editorContent || testName,
                        value: valueInput,
                        unit,
                        reference,
                        isDocumented,
                    };

                    tableData.push(testObject);
                    lastTestObject = testObject;
                } else {
                    // ✅ Detail/Remark/Notes rows - Ab yahan bhi separate objects banayenge
                    const colspanCell = row.querySelector("[colspan='3'], [colspan='4'], [colspan='5']");
                    if (colspanCell) {
                        // Individual test remark
                        if (colspanCell.querySelector("#remarkoftest")) {
                            const value = colspanCell.querySelector("#remarkoftest").value;

                            // ✅ Remark ko separate object banao with pagebreak
                            const remarkObject = {
                                pagebreak: pagebreak,
                                testName: null,
                                value: null,
                                unit: null,
                                reference: null,
                                isDocumented: false,
                                remark: value  // ✅ Remark property add
                            };

                            tableData.push(remarkObject);
                            lastTestObject = remarkObject; // Update lastTestObject
                        }
                        // Table-level remarks/advice/notes
                        else if (colspanCell.querySelector("textarea")) {
                            const value = colspanCell.querySelector("textarea").value;
                            const labelText = colspanCell.previousElementSibling?.textContent?.toLowerCase() || "";

                            if (labelText.includes("remarks")) {
                                tableRemarks = value;
                            } else if (labelText.includes("advice")) {
                                tableAdvice = value;
                            } else if (labelText.includes("notes")) {
                                tableNotes = value;
                            }
                        }
                        // Test details
                        else {
                            const innerContent = colspanCell.querySelector(".test-details")?.innerHTML;
                            if (innerContent) {
                                // ✅ Details ko separate object banao with pagebreak
                                const detailObject = {
                                    pagebreak: pagebreak,
                                    testName: null,
                                    value: null,
                                    unit: null,
                                    reference: null,
                                    isDocumented: false,
                                    details: innerContent  // ✅ Details property add
                                };

                                tableData.push(detailObject);
                                lastTestObject = detailObject; // Update lastTestObject
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

    function syncBookingStatusLocally(nextStatus) {
        if (!nextStatus) {
            return;
        }

        booking.status = nextStatus;

        const storedBooking = localStorage.getItem("booking");
        if (!storedBooking) {
            return;
        }

        try {
            const parsedBooking = JSON.parse(storedBooking);
            parsedBooking.status = nextStatus;
            localStorage.setItem("booking", JSON.stringify(parsedBooking));
        } catch (error) {
            console.error("Error syncing booking status locally:", error);
        }
    }

    // for saving data 
    async function saveTablesToDatabase(saveOnly) {
        const extractedData = extractTableData();
        const isFinalAction = saveOnly;
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
                    uniquetestArray: uniquetestArray2,
                    isdocumented,
                    saveMode: isFinalAction ? "final" : "saveOnly"
                }),
            });

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Failed to save report data");
            }

            if (result?.bookingStatus) {
                syncBookingStatusLocally(result.bookingStatus);
            }

            if (isFinalAction) {
                console.log("savedReportdata:", result);
                const barcodeId = result?._id;
                const url = `${BASE_URL}/${user.role === "staff" ? "admin" : "admin"}/admin.html?page=${user.role === "staff" ? user.tenantId.adminDetails.userId.pdfFormat : user.pdfFormat}&value1=${barcodeId}`;
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
        const AllFieldsArray = [];

        for (let field of AllFields) {
            const pb = field.cells[0].querySelector('input[type="checkbox"]')?.checked;
            const input = field.querySelector('.value-input');
            const editorContainer = field.querySelector("[id^='editorContent']");

            if (input && input.value.trim() === "" && savebtn) {
                smoothScrollTo(field);
                field.focus();
                return false; // Stop after the first empty field
            }
            else if (editorContainer) {
                const editorId = editorContainer.id;
                const uniqueTestId = editorId.replace('editorContent-', ''); // ✅ Extract uniqueTestId

                // ✅ CKEditor se data lena
                const editorContent = getEditorContent(uniqueTestId);

                console.log(`Checking editor: ${uniqueTestId}`, editorContent); // Debug

                if (editorContent) {
                    isdocumented = true;
                    const data = {
                        currentvalue: editorContent,
                        TestinputId: editorId, // Full editor ID save karein
                        isDocumented: "true",
                        pagebreak: pb
                    }
                    AllFieldsArray.push(data);
                }
            } else if (input) {
                const data_id = input.getAttribute('data-id');
                const value = input.value.trim();
                const data = {
                    currentvalue: value,
                    TestinputId: data_id,
                    isDocumented: "false",
                    pagebreak: pb
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
        console.log(error.message);
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
    const firstColumnValue = row.cells[1].innerText;
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
async function gatherFormData(tname) {
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

    await fetch(`${BASE_URL}/api/v1/user/edit-defaultresults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataObject, tname, text, selectType })
    })
        .then(response => response.json())
        .then(result => {
            alert(result.message);
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

    parameter?.NormalValue?.forEach(result => {
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
