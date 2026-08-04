// Extract value1 from the current URL
const params = new URLSearchParams(window.location.search);
const value1 = params.get('value1');
console.log("Extracted value1 from URL:", value1);
let loadedBooking = null;
let pendingSelections = new Map();
let modifyPendingRows = [];

async function sendValue1ToApi() {
    try {
        if (!value1) {
            console.error("Value1 not found in the URL.");
            return;
        }

        // Send the data to the API
        const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
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
        loadedBooking = data;
        populateFormData(data);
        displayEditHistory(data.editHistory || []);
        await databaseDoctors(data.createdBy);
        await databaseLab(data.createdBy);
        await databasesubfranchisee(data.createdBy);
        await setupModifyTestControls(data);
    } catch (error) {
        console.error("Error sending value1 to API:", error);
    }
}

function getCurrentPortalUserId() {
    return typeof userId !== 'undefined' ? userId : (window.userId || '');
}

function getItemId(item) {
    return item?.testId || item?.panelId || item?.packageId || item?._id;
}

function getItemName(item) {
    return item?.testName || item?.panelName || item?.packageName || 'Unnamed item';
}

function getItemSamples(item) {
    const rawSamples = [
        ...(Array.isArray(item?.sampleType) ? item.sampleType : String(item?.sampleType || '').split(',')),
        ...(Array.isArray(item?.sample_types) ? item.sample_types : String(item?.sample_types || '').split(','))
    ];
    return [...new Set(rawSamples.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeSample(value) {
    return String(value || '').trim().toLowerCase();
}

function selectionKey(item) {
    const collection = item?.testId ? 'testSchema' : item?.panelId ? 'addPannel' : 'Package';
    return `${collection}:${getItemId(item)}`;
}

function getItemPrice(item) {
    return Number(item?.myPrice ?? item?.franchiseePrice ?? item?.basePrice ?? 0) || 0;
}

// Keep the same data model as editbooking.js: one row per sample type, with
// multiple selected test/panel/package IDs merged into that row.
function rebuildModifyPendingRows() {
    const rows = [];
    pendingSelections.forEach((item, key) => {
        const id = String(getItemId(item));
        const collectionName = item?.testId ? 'testSchema' : item?.panelId ? 'addPannel' : 'Package';
        getItemSamples(item).forEach((sample) => {
            let row = rows.find((candidate) => normalizeSample(candidate.typeOfSample) === normalizeSample(sample));
            const existingBookingRow = (loadedBooking?.tableData || []).find((entry) => normalizeSample(entry.typeOfSample) === normalizeSample(sample));
            if (!row) {
                row = {
                    key: normalizeSample(sample),
                    typeOfSample: sample,
                    barcodeId: existingBookingRow?.barcodeId || '',
                    confirmBarcodeId: existingBookingRow?.barcodeId || '',
                    lockedBarcode: Boolean(existingBookingRow),
                    ids: [],
                    selections: []
                };
                rows.push(row);
            }
            if (!row.ids.some((entry) => String(entry.id) === id && entry.collectionName === collectionName)) {
                row.ids.push({ id, collectionName });
                row.selections.push({ key, name: getItemName(item) });
            }
        });
    });
    modifyPendingRows = rows;
}

function renderModifyPendingRows() {
    const booked = document.getElementById('modify-booked-tests');
    if (!booked) return;
    booked.querySelectorAll('.pending-row').forEach((row) => row.remove());
    rebuildModifyPendingRows();

    modifyPendingRows.forEach((row) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'pending-row';
        const chips = row.selections.map((selection) =>
            `<span class="selection-chip">${selection.name}<button type="button" data-remove-selection="${selection.key}" title="Remove selection">×</button></span>`
        ).join('');
        wrapper.innerHTML = `<span class="test-name">${chips}<span class="test-meta">${row.typeOfSample} · Same-sample tests are grouped together</span></span>
            <input type="text" placeholder="Barcode" value="${row.barcodeId}" data-pending-barcode="${row.key}" ${row.lockedBarcode ? 'readonly' : ''} required>
            <input type="text" placeholder="Confirm" value="${row.confirmBarcodeId}" data-pending-confirm="${row.key}" ${row.lockedBarcode ? 'readonly' : ''} required>`;
        wrapper.querySelectorAll('[data-remove-selection]').forEach((button) => {
            button.addEventListener('click', () => {
                const removedKey = button.dataset.removeSelection;
                pendingSelections.delete(removedKey);
                const option = document.querySelector(`[data-selection-key="${removedKey}"]`);
                if (option) option.style.display = '';
                renderModifyPendingRows();
                updateBookedTestCount();
            });
        });
        booked.appendChild(wrapper);
    });
}

async function setupModifyTestControls(data) {
    const section = document.getElementById('modify-tests-section');
    const options = document.getElementById('modify-test-options');
    const booked = document.getElementById('modify-booked-tests');
    const barcodeEditor = document.getElementById('modify-barcode-editor');
    const saveBarcodes = document.getElementById('save-modify-barcodes');
    const note = document.getElementById('modify-tests-note');
    if (!section || !options || !booked) return;

    section.style.display = 'block';
    const canEdit = data.canEditTests === true;
    note.textContent = canEdit
        ? 'Only tests assigned to this portal are available. Additions require a barcode.'
        : 'This booking belongs to another portal. Tests and packages are read-only.';
    options.innerHTML = '';
    booked.innerHTML = '';
    if (barcodeEditor) barcodeEditor.innerHTML = '';

    const bookedEntries = data.tableData || [];
    const count = document.getElementById('booked-test-count');
    if (count) count.textContent = bookedEntries.length;

    if (bookedEntries.length === 0) {
        booked.innerHTML = '<div class="booked-empty"><i class="fas fa-vial" style="font-size:24px;display:block;margin-bottom:8px;"></i>No tests booked yet.</div>';
    }

    bookedEntries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'booked-row';
        row.innerHTML = `<span class="test-name">${entry.testName || 'Booked test'}<span class="test-meta">${entry.typeOfSample || 'Sample'} · ${entry.barcodeId || 'Barcode unavailable'}</span></span><i class="fas fa-check-circle" style="color:#16a34a;"></i>`;
        booked.appendChild(row);
        if (barcodeEditor) {
            const barcodeRow = document.createElement('div');
            barcodeRow.className = 'barcode-row';
            barcodeRow.innerHTML = `<span class="sample-name">${entry.typeOfSample || 'Sample'}</span><input type="text" data-booking-barcode="${entry._id || ''}" value="${entry.barcodeId || ''}" ${data.canEditBarcodes ? '' : 'readonly'}>`;
            barcodeEditor.appendChild(barcodeRow);
        }
    });
    renderModifyPendingRows();

    if (saveBarcodes) {
        saveBarcodes.style.display = data.canEditBarcodes ? 'inline-block' : 'none';
        saveBarcodes.onclick = async () => {
            const updatedTableData = (data.tableData || []).map((entry, index) => ({
                ...entry,
                barcodeId: barcodeEditor.querySelectorAll('[data-booking-barcode]')[index]?.value?.trim()
            }));
            if (updatedTableData.some((entry) => !entry.barcodeId)) return alert('Barcode is required for every sample');
            const response = await fetch(`${BASE_URL}/api/v1/user/editBookingBarcodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: data._id, tableData: updatedTableData })
            });
            const result = await response.json();
            if (!response.ok) return alert(result.message || 'Barcodes could not be updated');
            alert(result.message || 'Barcodes updated successfully');
            loadedBooking.tableData = updatedTableData;
        };
    }

    if (!canEdit) return;

    const actorId = getCurrentPortalUserId();
    if (!actorId) {
        note.textContent = 'Current portal identity is unavailable; test editing is disabled.';
        return;
    }

    try {
        const query = encodeURIComponent(actorId);
        const responses = await Promise.all([
            fetch(`${BASE_URL}/api/v1/user/get-test?userId=${query}`, { method: 'POST' }),
            fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${query}`, { method: 'POST' }),
            fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${query}`, { method: 'POST' })
        ]);
        if (responses.some((response) => !response.ok)) throw new Error('Assigned test list unavailable');
        const [tests, panels, packages] = await Promise.all(responses.map((response) => response.json()));
        [...tests, ...panels, ...packages].forEach((item) => {
            const itemId = getItemId(item);
            if (!itemId) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${getItemName(item)} (${item.myPrice ?? item.franchiseePrice ?? item.basePrice ?? 0})`;
            button.className = 'test-option';
            button.innerHTML = `<span><i class="fas fa-plus-circle" style="color:#2563eb;margin-right:8px;"></i>${getItemName(item)}</span><small>${item.myPrice ?? item.franchiseePrice ?? item.basePrice ?? 0}</small>`;
            button.dataset.selectionKey = selectionKey(item);
            if ((data.tableData || []).some((entry) => String(entry.testName || '').toLowerCase().includes(getItemName(item).toLowerCase()))) {
                button.style.display = 'none';
            }
            button.addEventListener('click', () => addModifyTestRow(item));
            options.appendChild(button);
        });
    } catch (error) {
        console.error('Unable to load assigned tests:', error);
        note.textContent = 'Assigned tests could not be loaded.';
    }
}

function addModifyTestRow(item) {
    const key = selectionKey(item);
    if (pendingSelections.has(key)) return;
    pendingSelections.set(key, item);
    const option = document.querySelector(`[data-selection-key="${key}"]`);
    if (option) option.style.display = 'none';
    renderModifyPendingRows();
    updateBookedTestCount();
}

function updateBookedTestCount() {
    const count = document.getElementById('booked-test-count');
    if (!count || !loadedBooking) return;
    count.textContent = String((loadedBooking.tableData || []).length + modifyPendingRows.length);
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
    document.getElementById('doctor-name').value = data.doctorName || '';

    // Populate lab details
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

// Field mapping for edit history
const fieldMapping = {
    'courierName': 'courier-name',
    'courierId': 'courier-id',
    'patientName': 'patient-name',
    'date': 'dob',
    'time': 'time',
    'year': 'ageValue', // Special handling needed
    'gender': 'patient-gender',
    'patientPhone': 'patient-phone',
    'doctorName': 'doctor-name',
    'labName': 'lab-name',
    'franchisee': 'franchisee-select',
    'clinicalHistory': 'clinical-history'
};

// Display Edit History inline under each field
function displayEditHistory(editHistory) {
    if (!editHistory || editHistory.length === 0) {
        return;
    }
    
    // Group edits by field name
    const editsByField = {};
    editHistory.forEach(edit => {
        if (!editsByField[edit.fieldName]) {
            editsByField[edit.fieldName] = [];
        }
        editsByField[edit.fieldName].push(edit);
    });
    
    // Process each field
    Object.keys(editsByField).forEach(fieldName => {
        const edits = editsByField[fieldName];
        
        // Filter out edits where old and new values are the same (if only one edit exists)
        const validEdits = edits.filter(edit => {
            if (edits.length === 1 && edit.oldValue === edit.newValue) {
                return false;
            }
            return true;
        });
        
        if (validEdits.length === 0) {
            return; // Don't show anything if no valid edits
        }
        
        // Get the field element
        const fieldId = fieldMapping[fieldName];
        if (!fieldId) {
            return; // Skip if field mapping not found
        }
        
        const fieldElement = document.getElementById(fieldId);
        if (!fieldElement) {
            return; // Skip if field not found
        }
        
        // Find the parent input-group
        let parentGroup = fieldElement.closest('.input-group');
        if (!parentGroup) {
            parentGroup = fieldElement.parentElement;
        }
        
        // Create edit history display
        const historyDiv = document.createElement('div');
        historyDiv.className = 'edit-history-inline';
        
        // Sort by most recent first
        const sortedEdits = [...validEdits].sort((a, b) => 
            new Date(b.editedAt) - new Date(a.editedAt)
        );
        
        // Add each edit entry
        sortedEdits.forEach(edit => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'edit-entry';
            
            // Format date and time
            const editDate = new Date(edit.editedAt);
            const formattedDateTime = formatDateTime(editDate);
            
            // Format values
            const oldValue = formatInlineValue(edit.oldValue, fieldName);
            const newValue = formatInlineValue(edit.newValue, fieldName);
            
            entryDiv.innerHTML = `
                <div class="edit-meta">
                    ${formattedDateTime} • ${edit.editedByName || 'Unknown'}
                </div>
                <div class="edit-values">
                    <span class="old-val">${oldValue}</span>
                    <span class="arrow">→</span>
                    <span class="new-val">${newValue}</span>
                </div>
            `;
            
            historyDiv.appendChild(entryDiv);
        });
        
        // Insert after the parent group
        parentGroup.parentNode.insertBefore(historyDiv, parentGroup.nextSibling);
    });
}

// Helper function to format date and time
function formatDateTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// Helper function to format inline values
function formatInlineValue(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return 'Empty';
    }
    
    // Handle date fields
    if (fieldName === 'date') {
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            }
        } catch (e) {
            // Continue to default handling
        }
    }
    
    // Handle objects and arrays
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    
    // Handle long strings - truncate
    if (typeof value === 'string' && value.length > 30) {
        return value.substring(0, 30) + '...';
    }
    
    return value.toString();
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
        const response = await fetch(`${BASE_URL}/api/v1/user/all-doctor?userId=${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
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
        return console.error(error);
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
        });
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
        console.error("Sub franchisee not created");
    }
}

async function databaseLab(userId) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-Lab?userId=${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
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
        console.error(error);
    }
}

async function submitNewBooking() {
    submitButton = document.getElementById('submit-btn');
    if (!submitButton) {
        console.error("Submit button not found");
        return;
    }

    submitButton.addEventListener('click', async function () {
        // ✅ PREVENT DOUBLE CLICK
        if (submitButton.disabled) {
            console.log('Submit already in progress...');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.style.opacity = '0.6';
        submitButton.style.cursor = 'not-allowed';
        
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

            const file = document.querySelector('.file-input input[type="file"]').files[0];
            if (file) {
                formData.append('file', file);
            }

            const response = await fetch(`${BASE_URL}/api/v1/user/editBooking`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                if (pendingSelections.size > 0) {
                    await submitPendingModifyTests();
                }
                const existingBooking = localStorage.getItem('booking');
                if (existingBooking) {
                    const bookingData = JSON.parse(existingBooking);
                    
                    // ✅ Simple approach - preserve acceptedbarcode
                    const updateddata = {
                        ...data.data,
                        acceptedbarcode: bookingData.acceptedbarcode || []
                    }
                    
                    localStorage.setItem('booking', JSON.stringify(updateddata));
                    console.log('✅ Booking updated successfully');
                    console.log('🔒 Preserved acceptedbarcode:', updateddata.acceptedbarcode);
                }
                
                // Hide loader
                loadingScreen.classList.remove('active');
                loader.classList.remove('loadervisible');

                // Small delay then go back
                setTimeout(() => {
                    window.location.href = `${BASE_URL}/admin/admin.html?page=labreport`;
                }, 300);
                
            } else {
                // Error from server
                loadingScreen.classList.remove('active');
                loader.classList.remove('loadervisible');
                
                // ✅ Re-enable button on error
                submitButton.disabled = false;
                submitButton.style.opacity = '1';
                submitButton.style.cursor = 'pointer';
                
                alert(data.message || 'Failed to update booking');
            }

        } catch (error) {
            // Network or other error
            console.error("Error during booking:", error);
            loadingScreen.classList.remove('active');
            loader.classList.remove('loadervisible');
            
            // ✅ Re-enable button on error
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
            
            alert(error.message || 'Error updating booking. Please check your connection and try again.');
        }
    });
}

async function submitPendingModifyTests() {
    rebuildModifyPendingRows();
    const tableData = modifyPendingRows.map((row) => {
        const barcode = document.querySelector(`[data-pending-barcode="${row.key}"]`)?.value?.trim();
        const confirmBarcode = document.querySelector(`[data-pending-confirm="${row.key}"]`)?.value?.trim();
        if (!barcode || !confirmBarcode) throw new Error('Barcode and confirmation are required for every new sample');
        if (barcode !== confirmBarcode) throw new Error(`Barcode and confirmation do not match for ${row.typeOfSample}`);
        return {
            typeOfSample: row.typeOfSample,
            barcodeId: barcode,
            confirmBarcodeId: confirmBarcode,
            testName: row.selections.map((selection) => selection.name).join(', '),
            ids: row.ids
        };
    });
    const formData = new FormData();
    formData.append('barcodeId', loadedBooking.bookingId);
    formData.append('patientName', loadedBooking.patientName || '');
    formData.append('date', loadedBooking.date || '');
    formData.append('time', loadedBooking.time || '');
    formData.append('year', loadedBooking.year || '');
    formData.append('gender', loadedBooking.gender || 'Any');
    formData.append('patientPhone', loadedBooking.patientPhone || '');
    formData.append('doctorName', loadedBooking.doctorName || '');
    formData.append('labName', loadedBooking.labName || '');
    formData.append('clinicalHistory', loadedBooking.clinicalHistory || '');
    formData.append('createdbyuser', loadedBooking.createdbyuser || '');
    const total = [...pendingSelections.values()].reduce((sum, item) => sum + getItemPrice(item), 0);
    formData.append('total', String(total));
    formData.append('testIds', JSON.stringify([...pendingSelections.values()].map((item) => getItemId(item))));
    formData.append('tableData', JSON.stringify(tableData));

    const response = await fetch(`${BASE_URL}/api/v1/user/editbookingbookedtests`, { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Tests could not be updated');
}

// ✅ BONUS: Function to sync localStorage with latest server data (optional use)
async function syncLocalStorageWithServer(bookingId) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value1: bookingId })
        });

        if (response.ok) {
            const freshData = await response.json();
            localStorage.setItem('booking', JSON.stringify(freshData));
            localStorage.setItem('regId', JSON.stringify(bookingId));
            console.log('✅ localStorage synced with fresh server data');
            return freshData;
        } else {
            console.error('❌ Failed to sync localStorage with server');
            return null;
        }
    } catch (error) {
        console.error('❌ Error syncing localStorage:', error);
        return null;
    }
}

async function initialization() {
    await sendValue1ToApi();
    doctorInput();
    LabInput();
    submitNewBooking();
}

initialization();
