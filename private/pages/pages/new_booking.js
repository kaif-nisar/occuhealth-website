async function bookingload() {
    // Load SheetJS library for Excel/CSV parsing
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const userfallback = userId;
    // Cache DOM elements - ek baar select karo, baar baar nahi
    const DOM = {
        totalprice: document.querySelector('#header span'),
        patientamount: document.querySelector('#header2 span'),
        discountinput: document.getElementById('discount-amount'),
        testSelection: document.getElementById('test-selection'),
        discountpercentage: document.getElementById('discount-percentage'),
        tableBody: document.getElementById('tableBody'),
        selectedTests: document.getElementById('test-selected'),
        bulkFileInput: document.getElementById('bulk-booking-file-input'),
        readBulkFileBtn: document.getElementById('read-bulk-file-btn'),
        bulkPreviewContainer: document.getElementById('bulk-booking-preview-container'),
        bulkPreviewTable: document.getElementById('bulk-booking-preview-table'),
        confirmBulkBookingsBtn: document.getElementById('confirm-bulk-bookings-btn'),
        bulkProgress: document.getElementById('bulk-booking-progress'),
        loader: document.querySelector('.loader')
    };

    let total = 0;
    let testDataCache = []; // Cache test data globally

    // Early execution - jo functions DOM pe dependent nahi hain
    if (user?.role === "admin" && user?.tenantId?.modelType === "1layer") {
        singlelayerfunction();
    }

    function singlelayerfunction() {
        const discountsection = document.querySelectorAll('.discountsection');
        discountsection.forEach(element => element.style.display = "block");
    }

    async function checkrandomId(randomId) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/findbookingId?randomId=${randomId}`);
            const data = await response.json();
            return !data.exists;
        } catch (error) {
            console.error("Error checking random ID:", error.message);
            return false;
        }
    }

    // Helper function to dynamically load scripts
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    // Optimized: Generate random ID without multiple checks (probabilistic approach)
    function generateRandomId() {
        return "OH" + Math.floor(Math.random() * 10000000000);
    }

    function normalizeList(value) {
        if (Array.isArray(value)) {
            return value
                .map(item => String(item ?? "").trim())
                .filter(Boolean);
        }

        return String(value ?? "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    function getCatalogItemName(item) {
        return item?.Name
            || item?.name
            || item?.packageName
            || item?.testName
            || item?.panelName
            || item?.pannelname
            || "";
    }

    function getCatalogItemId(item) {
        return item?._id
            || item?.testId
            || item?.panelId
            || item?.packageId
            || "";
    }

    function getCatalogItemCollection(item) {
        if (item?.Name || item?.testName) return "testSchema";
        if (item?.name || item?.panelName) return "addPannel";
        if (item?.packageName) return "Package";
        return "";
    }

    function getCatalogItemPrice(item) {
        const rawPrice = item?.final_price
            ?? item?.finalPrice
            ?? item?.packageFee
            ?? item?.Price
            ?? item?.price
            ?? item?.myPrice
            ?? item?.basePrice
            ?? 0;

        return Number(rawPrice) || 0;
    }

    function getCatalogItemSampleTypes(item) {
        if (item?.Name) {
            return normalizeList(item.sampleType);
        }

        if (item?.name) {
            return normalizeList(item.sample_types);
        }

        if (item?.packageName) {
            const directSamples = [
                ...normalizeList(item.sampleType),
                ...normalizeList(item.sample_types),
                ...normalizeList(item.testSample),
                ...normalizeList(item.pannelSample),
            ];
            const nestedSamples = [];

            (Array.isArray(item.testIds) ? item.testIds : []).forEach((test) => {
                nestedSamples.push(...normalizeList(test?.sampleType));
            });

            (Array.isArray(item.pannelIds) ? item.pannelIds : []).forEach((panel) => {
                nestedSamples.push(...normalizeList(panel?.sample_types));
            });

            return [...new Set([...directSamples, ...nestedSamples])];
        }

        return normalizeList(item?.sampleType || item?.sample_types);
    }

    // Optimized: Test rendering with DocumentFragment for better performance
    function renderTests(testData, panelData, packageData) {
        if (!DOM.testSelection) return;

        const fragment = document.createDocumentFragment();

        // Render tests
        if (Array.isArray(testData)) {
            testData.forEach(test => {
                const span = createTestElement(test, 'testSchema', {
                    price: test.myPrice || test.finalPrice || test.basePrice || 0,
                    shortname: test.Short_name || ''
                });
                fragment.appendChild(span);
            });
        }

        // Render panels
        if (Array.isArray(panelData)) {
            panelData.forEach(panel => {
                const span = createTestElement(panel, 'addPannel', {
                    price: panel.myPrice || panel.finalPrice || panel.basePrice || 0,
                    name: panel.panelName
                });
                fragment.appendChild(span);
            });
        }

        // Render packages
        if (Array.isArray(packageData)) {
            packageData.forEach(pkg => {
                const uniqueSamples = getCatalogItemSampleTypes(pkg);

                const span = createTestElement(pkg, 'Package', {
                    price: pkg.myPrice || pkg.finalPrice || pkg.basePrice || 0,
                    name: pkg.packageName,
                    sampleType: uniqueSamples
                });
                fragment.appendChild(span);
            });
        }

        DOM.testSelection.innerHTML = '';
        DOM.testSelection.appendChild(fragment);
    }

    // Helper: Create test element efficiently
    function createTestElement(item, collection, options = {}) {
        const span = document.createElement('span');
        const id = getCatalogItemId(item);
        const name = options.name || getCatalogItemName(item);
        const sampleType = options.sampleType || getCatalogItemSampleTypes(item);

        span.id = id;
        span.className = 'tests-name-option';
        span.setAttribute('data-price', options.price);
        span.setAttribute('sample-Type', Array.isArray(sampleType) ? sampleType.join(',') : sampleType);
        span.setAttribute('data-id', id);
        span.setAttribute('data-collection', collection);
        if (options.shortname) span.setAttribute('shortname', options.shortname);
        span.textContent = name;

        return span;
    }

    // Optimized: Fetch all data - reduced to single responsibility
    async function fetchAllData() {
        if (typeof userId === 'undefined') {
            console.warn("userId not defined");
            return { tests: [], panels: [], packages: [] };
        }

        try {
            const [testRes, panelRes, packageRes] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}`, { method: "POST" })
            ]);

            const [tests, panels, packages] = await Promise.all([
                testRes.json(),
                panelRes.json(),
                packageRes.json()
            ]);

            console.log("Fetched data:", { tests, panels, packages });
            return { tests, panels, packages };
        } catch (error) {
            console.error("Error fetching data:", error);
            return { tests: [], panels: [], packages: [] };
        }
    }

    // Optimized: Event delegation for test selection (single listener)
    function setupTestSelection() {
        if (!DOM.testSelection || !DOM.tableBody || !DOM.selectedTests) return;
        
        DOM.testSelection.addEventListener('click', (e) => {
            // FIX: Ensure we get the actual test element, not a child
            const test = e.target.classList.contains('tests-name-option') 
                ? e.target 
                : e.target.closest('.tests-name-option');
            
            if (!test) return;

            // FIX: Check if already selected to prevent duplicates
            if (test.style.display === 'none' || test.classList.contains('selected')) {
                return;
            }

            handleTestClick(test);
        });
    }

    function handleTestClick(test) {
        const sampleType = test.getAttribute('sample-type');
        const testId = test.getAttribute('data-id');
        const collectionName = test.getAttribute('data-collection');
        const testPrice = parseFloat(test.getAttribute('data-price')) || 0;

        if (!sampleType || !testId || !collectionName) return;

        const samples = sampleType.includes(',')
            ? [...new Set(sampleType.split(','))]
            : [sampleType];

        samples.forEach(sample => {
            addTestToTable(sample, testId, collectionName, test.textContent);
        });

        // Add to selected tests
        const selectedTag = document.createElement("span");
        selectedTag.textContent = test.textContent;
        selectedTag.className = 'realSelectedTests';
        selectedTag.setAttribute('data-price', testPrice);
        selectedTag.setAttribute('data-id', testId);
        selectedTag.setAttribute('data-collection', collectionName);

        // FIX: Mark as selected and hide immediately
        test.classList.add('selected');
        test.style.display = "none";
        
        total += testPrice;
        updatePriceDisplay();

        DOM.selectedTests.appendChild(selectedTag);

        // Remove handler
        selectedTag.addEventListener('click', () => handleTestRemove(selectedTag, test));
    }

    function addTestToTable(sample, testId, collectionName, testName) {
        if (!DOM.tableBody) return;

        const rows = DOM.tableBody.querySelectorAll('tr');
        let existingRow = null;

        for (const row of rows) {
            if (row.cells[1]?.textContent === sample) {
                existingRow = row;
                break;
            }
        }

        if (existingRow) {
            let testData = JSON.parse(existingRow.getAttribute("data-test-data") || "[]");
            if (!testData.some(item => item.id === testId && item.collectionName === collectionName)) {
                testData.push({ id: testId, collectionName: collectionName });
                existingRow.setAttribute("data-test-data", JSON.stringify(testData));
                rebuildTestNamesInRow(existingRow);
            }
        } else {
            const randomNumber = (user?.tenantId?.modelType === "1layer")
                ? Math.floor(100000 + Math.random() * 900000)
                : "";

            const row = document.createElement('tr');
            row.setAttribute("data-test-data", JSON.stringify([{ id: testId, collectionName: collectionName }]));
            // FIX: Remove empty first cell, add S.No. directly with value
            row.innerHTML = `
                <td>${DOM.tableBody.querySelectorAll('tr').length + 1}</td>
                <td>${sample}</td>
                <td>
                    <input type="text" placeholder="Enter barcodeId" name="barcodeId" value="${randomNumber}">
                    <br>
                    <input type="text" placeholder="Enter SampleId" name="confirmBarcodeId" value="${randomNumber}">
                </td>
                <td>${testName}</td>`;
            DOM.tableBody.appendChild(row);
        }
        // FIX: Reindex after adding new row
        reindexRows();
    }

    function handleTestRemove(selectedTag, originalTest) {
        const testPrice = parseFloat(selectedTag.getAttribute('data-price')) || 0;
        const testId = selectedTag.getAttribute('data-id');
        const collectionName = selectedTag.getAttribute('data-collection');

        total -= testPrice;
        updatePriceDisplay();

        // FIX: Remove selected class and show the test again
        originalTest.classList.remove('selected');
        originalTest.style.display = "block";
        selectedTag.remove();

        // Remove from table
        const rows = DOM.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            let testData = JSON.parse(row.getAttribute("data-test-data") || "[]");
            testData = testData.filter(item => !(item.id === testId && item.collectionName === collectionName));

            if (testData.length > 0) {
                row.setAttribute("data-test-data", JSON.stringify(testData));
                rebuildTestNamesInRow(row);
            } else {
                row.remove();
            }
        });
        reindexRows();
    }

    function rebuildTestNamesInRow(row) {
        const testData = JSON.parse(row.getAttribute("data-test-data") || "[]");
        const names = testData.map(item => {
            const selector = `.tests-name-option[data-id="${item.id}"][data-collection="${item.collectionName}"]`;
            const option = document.querySelector(selector);
            return option ? option.textContent : "";
        }).filter(Boolean);

        if (row.cells && row.cells[3]) {
            row.cells[3].textContent = names.join(', ');
        }
    }

    function reindexRows() {
        const rows = DOM.tableBody?.querySelectorAll('tr');
        if (!rows) return;

        rows.forEach((row, index) => {
            if (row.cells && row.cells[0]) {
                row.cells[0].textContent = index + 1;
            }
        });
    }

    function updatePriceDisplay() {
        const totalStr = `${total.toFixed(2)}`;
        if (DOM.totalprice) DOM.totalprice.textContent = totalStr;
        if (DOM.patientamount) DOM.patientamount.textContent = totalStr;
        updateDiscountCalculations();
    }

    function updateDiscountCalculations() {
        if (!DOM.discountinput || !DOM.patientamount || !DOM.discountpercentage) return;

        const inputValue = parseFloat(DOM.discountinput.value) || 0;
        if (total <= 0) return;

        if (inputValue >= total) {
            DOM.patientamount.textContent = "0.00";
            DOM.discountpercentage.value = "100%";
        } else if (inputValue > 0) {
            DOM.patientamount.textContent = (total - inputValue).toFixed(2);
            DOM.discountpercentage.value = ((inputValue / total) * 100).toFixed(2) + "%";
        }
    }

    // Optimized search with debouncing
    let searchTimeout;
    function setupSearch() {
        const selectTestSearch = document.getElementById('selectTestDivforSearch');
        const selectedTestSearch = document.getElementById('selectedTestDivforSearch');

        if (selectTestSearch) {
            selectTestSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => filterTests(e.target.value.toLowerCase()), 200);
            });
        }

        if (selectedTestSearch) {
            selectedTestSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => filterSelectedTests(e.target.value.toLowerCase()), 200);
            });
        }
    }

    function filterTests(query) {
        document.querySelectorAll(".tests-name-option").forEach(option => {
            const text = option.textContent.toLowerCase();
            const shortname = (option.getAttribute('shortname') || '').toLowerCase();
            // FIX: Don't show hidden/selected tests in search
            if (option.classList.contains('selected')) return;
            option.style.display = (text.includes(query) || shortname.includes(query)) ? '' : 'none';
        });
    }

    function filterSelectedTests(query) {
        document.querySelectorAll(".realSelectedTests").forEach(option => {
            const text = option.textContent.toLowerCase(); // FIX: Use textContent
            const shortname = (option.getAttribute('shortname') || '').toLowerCase();
            option.style.display = (text.includes(query) || shortname.includes(query)) ? '' : 'none';
        });
    }

    // Simplified modal functions
    function setupModals() {
        setupLabModal();
        setupDoctorModal();
    }

    function setupLabModal() {
        const showBtn = document.getElementById('show-modal-btn');
        const modal = document.getElementById('modal-overlay');
        const closeBtn = document.getElementById('close-modal-btn');

        if (showBtn && modal) {
            showBtn.addEventListener('click', function () {
                modal.style.display = 'flex';
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', function () {
                modal.style.display = 'none';
            });
        }
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
    }

    function setupDoctorModal() {
        const modal = document.getElementById('modal');
        const openBtn = document.getElementById('openModalBtn');
        const closeBtn = document.querySelector('.close');
        const footerBtn = document.querySelector('.btn-close');

        if (openBtn && modal) {
            openBtn.addEventListener('click', function () {
                modal.classList.add('active');
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', function () {
                modal.classList.remove('active');
            });
        }
        if (footerBtn && modal) {
            footerBtn.addEventListener('click', function () {
                modal.classList.remove('active');
            });
        }
        if (modal) {
            window.addEventListener('click', function (e) {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
    }

    // Simplified form submissions
    function setupFormSubmissions() {
        const addDoctorBtn = document.querySelector('.btn-add');
        const addLabBtn = document.getElementById('add-lab');

        if (addDoctorBtn) {
            addDoctorBtn.addEventListener('click', function () {
                submitDoctor();
            });
        }
        if (addLabBtn) {
            addLabBtn.addEventListener('click', function () {
                submitLab();
            });
        }
    }

    async function submitDoctor() {
        if (typeof userId === 'undefined') {
            alert('User ID not found');
            return;
        }

        const data = {
            firstname: document.getElementById('firstname')?.value || '',
            lastname: document.getElementById('lastname')?.value || '',
            specialization: document.getElementById('specialization')?.value || '',
            dob: document.getElementById('dob')?.value || '',
            gender: document.getElementById('gender')?.value || '',
            address: document.getElementById('address')?.value || '',
            userId
        };

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/add-doctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                alert('Doctor added successfully!');
                const modal = document.getElementById('modal');
                if (modal) modal.classList.remove('active');
            } else {
                alert('Failed to add doctor.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while adding the doctor.');
        }
    }

    async function submitLab() {
        if (typeof userId === 'undefined') {
            alert('User ID not found');
            return;
        }

        const data = {
            LabName: document.getElementById('lab-name2')?.value || '',
            LabAddress: document.getElementById('lab-address')?.value || '',
            userId
        };

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/add-Lab`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                alert('Lab added successfully!');
                const modalOverlay = document.getElementById('modal-overlay');
                if (modalOverlay) modalOverlay.style.display = 'none';
            } else {
                alert('Failed to add lab.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while adding the lab.');
        }
    }

    // Simplified dropdowns population
    async function populateDropdowns() {
        if (typeof userId === 'undefined') return;

        try {
            const [subFranRes, doctorRes, labRes] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`),
                fetch(`${BASE_URL}/api/v1/user/all-doctor?userId=${userId}`),
                fetch(`${BASE_URL}/api/v1/user/all-Lab?userId=${userId}`)
            ]);

            const [subFran, doctors, labs] = await Promise.all([
                subFranRes.json(),
                doctorRes.json(),
                labRes.json()
            ]);
            
            console.log('API Responses:', { subFran, doctors, labs });
            
            // FIX: Handle different response structures
            // Check if subFran.message exists and is array, otherwise use subFran directly
            const subFranData = Array.isArray(subFran?.message) ? subFran.message : 
                               Array.isArray(subFran) ? subFran : [];
            
            const doctorData = Array.isArray(doctors?.message) ? doctors.message :
                              Array.isArray(doctors) ? doctors : [];
            
            const labData = Array.isArray(labs?.message) ? labs.message :
                           Array.isArray(labs) ? labs : [];
            
            populateSubFranchisees(subFranData);
            populateDoctors(doctorData);
            populateLabs(labData);
        } catch (error) {
            console.error("Error populating dropdowns:", error);
        }
    }

    function populateSubFranchisees(data) {
        const select = document.getElementById('franchisee-select');
        if (!select) {
            console.warn('franchisee-select not found in DOM when populateSubFranchisees called');
            return;
        }
        
        // FIX: Check if data is array, handle undefined/null cases
        if (!data) {
            console.warn('No sub-franchisee data received');
            return;
        }
        
        if (!Array.isArray(data)) {
            console.error('Sub-franchisee data is not an array:', data);
            return;
        }
        
        console.log('Populating sub-franchisees:', data);
        data.forEach(item => {
            const option = document.createElement('option');
            option.className = 'subFranchisee-option';
            option.setAttribute('data-id', item._id);
            option.textContent = item.fullName;
            select.appendChild(option);
        });
    }

    function populateDoctors(data) {
        const select = document.getElementById('doctor-selection');
        if (!select || !Array.isArray(data)) return;

        data.forEach(doctor => {
            const option = document.createElement('option');
            option.className = 'doctor-option-selection';
            option.setAttribute('doctor-id', doctor._id);
            option.textContent = `${doctor.firstName} ${doctor.lastName} (${doctor.specialization})`;
            select.appendChild(option);
        });
    }

    function populateLabs(data) {
        const select = document.getElementById('lab-selection');
        if (!select || !Array.isArray(data)) return;

        data.forEach(lab => {
            const option = document.createElement('option');
            option.className = 'Lab-option-selection';
            option.setAttribute('Lab-id', lab._id);
            option.textContent = lab.LabName;
            select.appendChild(option);
        });
    }

    // Setup input handlers
    function setupInputHandlers() {
        setupDoctorInput();
        setupLabInput();
        setupDiscountInput();
        setupFranchiseeHandler();
    }

    function setupDoctorInput() {
        const select = document.getElementById('doctor-selection');
        const input = document.getElementById('doctor-name');

        if (select && input) {
            select.addEventListener('change', function () {
                const option = select.options[select.selectedIndex];
                if (option.value === "NoDoctor" || !option.value) {
                    input.value = "";
                    input.style.backgroundColor = "white";
                    input.style.cursor = "text";
                    input.removeAttribute("readonly");
                } else {
                    input.value = option.text;
                    input.style.backgroundColor = "#3333331c";
                    input.style.cursor = "not-allowed";
                    input.setAttribute("readonly", true);
                }
            });
        }
    }

    function setupLabInput() {
        const select = document.getElementById('lab-selection');
        const input = document.getElementById('lab-name');

        if (select && input) {
            select.addEventListener('change', function () {
                const option = select.options[select.selectedIndex];
                if (option.value === "NoLab" || !option.value) {
                    input.value = "";
                    input.style.backgroundColor = "white";
                    input.style.cursor = "text";
                    input.removeAttribute("readonly");
                } else {
                    input.value = option.text;
                    input.style.backgroundColor = "#3333331c";
                    input.style.cursor = "not-allowed";
                    input.setAttribute("readonly", true);
                }
            });
        }
    }

    function setupDiscountInput() {
        if (!DOM.discountinput) return;

        DOM.discountinput.addEventListener('input', () => {
            const value = parseFloat(DOM.discountinput.value) || 0;
            if (total <= 0) return;

            if (value >= total) {
                DOM.patientamount.textContent = "0.00";
                DOM.discountpercentage.value = "100%";
            } else if (value > 0) {
                DOM.patientamount.textContent = (total - value).toFixed(2);
                DOM.discountpercentage.value = ((value / total) * 100).toFixed(2) + "%";
            } else {
                DOM.patientamount.textContent = total.toFixed(2);
                DOM.discountpercentage.value = "0%";
            }
        });
    }

    function setupFranchiseeHandler() {
        const select = document.getElementById('franchisee-select');
        if (!select) return;
        if (user.role !== "admin" && user.role !== "staff" ) {
            fetchWalletAmount(userfallback)

        }
        select.addEventListener('change', async function () {
            const option = select.selectedOptions[0];
            const franchiseeId = option.getAttribute("data-id");

            if (!franchiseeId || franchiseeId === "-- No Franchisee Selected --") return;

            window.userId = franchiseeId;
            userId = franchiseeId
            if (user.role !== "admin" && user.role !== "staff") {
                fetchWalletAmount(userId)
            }
            const dataResult = await fetchAllData();
            renderTests(dataResult.tests, dataResult.panels, dataResult.packages);
        });
    }

    // Set current date/time
    function setDateTime() {
        const dateInput = document.getElementById('dob');
        const timeInput = document.getElementById('time');

        if (dateInput) {
            dateInput.value = new Date().toLocaleDateString('en-CA');
            dateInput.setAttribute('readonly', true);
        }

        if (timeInput) {
            const now = new Date();
            timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            timeInput.setAttribute('readonly', true);
        }
    }

    // Submit booking
    function setupBookingSubmit() {
        const submitBtn = document.getElementById('submit-btn');
        if (!submitBtn) return;

        submitBtn.addEventListener('click', async function () {
            // Validate barcodes
            const rows = document.querySelectorAll(".details-section table tbody tr");
            const barcodes = [];

            for (const row of rows) {
                const input = row.querySelector("input[name='barcodeId']");
                if (input) {
                    const value = input.value.trim();
                    if (barcodes.includes(value)) {
                        const spanElement = document.querySelector('.details-section span');
                        if (spanElement) spanElement.style.setProperty('display', 'block');
                        return;
                    }
                    barcodes.push(value);
                }
            }

            const loader = document.getElementById('loader1');
            if (loader) loader.style.display = "flex";

            try {
                const formData = new FormData();

                // Add form fields
                const fields = {
                    barcodeId: document.getElementById('random-id')?.value || '',
                    date: document.querySelector('input[type="date"]')?.value || '',
                    time: document.querySelector('input[type="time"]')?.value || '',
                    createdbyuser: typeof username !== 'undefined' ? username : '',
                    courierName: document.getElementById('courier-name')?.value || '',
                    courierId: document.getElementById('courier-id')?.value || '',
                    patientName: document.getElementById('patient-name')?.value || '',
                    year: `${document.getElementById('ageValue')?.value || ''} ${document.getElementById('ageUnit')?.value || ''}`,
                    gender: document.getElementById('patient-gender')?.value || '',
                    patientPhone: document.getElementById('patient-phone')?.value || '',
                    doctorName: document.getElementById('doctor-name')?.value || '',
                    labName: document.getElementById('lab-name')?.value || '',
                    clinicalHistory: document.getElementById('clinical-history')?.value || '',
                    total: document.getElementById('total')?.textContent || '',
                    userId: typeof userId !== 'undefined' ? userId : '',
                    discountamount: DOM.discountinput?.value || '',
                    discountunit: DOM.discountpercentage?.value.replace('%', '') || ''
                };

                Object.entries(fields).forEach(([key, value]) => formData.append(key, value));

                // Add sub-franchisee
                const subFranSelect = document.getElementById('franchisee-select');
                if (subFranSelect) {
                    const option = subFranSelect.options[subFranSelect.selectedIndex];
                    formData.append('subFranchisee', option?.value || '');
                    formData.append('subFranchiseeId', option?.getAttribute('id') || '');
                }

                // Add doctor
                const doctorSelect = document.getElementById('doctor-selection');
                if (doctorSelect) {
                    const option = doctorSelect.options[doctorSelect.selectedIndex];
                    const doctorId = option?.getAttribute('doctor-id');
                    if (doctorId && doctorId !== '' && option.value !== 'NoDoctor') {
                        formData.append('savedDoctor', option.value);
                        formData.append('savedDoctorId', doctorId);
                    }
                }

                // Add lab
                const labSelect = document.getElementById('lab-selection');
                if (labSelect) {
                    const option = labSelect.options[labSelect.selectedIndex];
                    const labId = option?.getAttribute('Lab-id');
                    if (labId && labId !== '' && option.value !== 'NoLab') {
                        formData.append('savedLab', option.value);
                        formData.append('savedLabId', labId);
                    }
                }

                // Add test IDs
                const testIds = [];
                const selectedTestSpans = DOM.selectedTests?.querySelectorAll('span');
                if (selectedTestSpans) {
                    selectedTestSpans.forEach(span => {
                        const id = span.getAttribute('data-id');
                        if (id) testIds.push(id);
                    });
                }
                formData.append('testIds', JSON.stringify(testIds));

                // Add file
                const fileInput = document.querySelector('.file-input input[type="file"]');
                if (fileInput?.files[0]) {
                    formData.append('file', fileInput.files[0]);
                }

                // Add table data
                const tableData = [];
                const tableRows = DOM.tableBody?.querySelectorAll('tr');
                if (tableRows) {
                    tableRows.forEach((row) => {
                        const barcodeInput = row.cells[2]?.querySelector('input[name="barcodeId"]');
                        const confirmInput = row.cells[2]?.querySelector('input[name="confirmBarcodeId"]');

                        if (barcodeInput && confirmInput) {
                            const barcode = barcodeInput.value.trim();
                            const confirm = confirmInput.value.trim();

                            if (barcode !== confirm) {
                                alert(`${barcode} and ${confirm} do not match`);
                                throw new Error('Barcode mismatch');
                            }

                            tableData.push({
                                typeOfSample: row.cells[1]?.textContent.trim() || '',
                                confirmBarcodeId: confirm,
                                testName: row.cells[3]?.textContent.trim() || '',
                                ids: JSON.parse(row.getAttribute("data-test-data") || "[]")
                            });
                        }
                    });
                }
                formData.append('tableData', JSON.stringify(tableData));

                const response = await fetch(`${BASE_URL}/api/v1/user/new-booking`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const successMsg = document.getElementById('successMessage');
                    if (successMsg) {
                        successMsg.style.height = '4rem';
                        setTimeout(() => location.reload(), 3000);
                    }
                } else {
                    const data = await response.json();
                    alert(data.message || 'Booking failed');
                }
            } catch (error) {
                console.error("Booking error:", error);
                alert("An error occurred: " + error.message);
            } finally {
                if (loader) loader.style.display = "none";
            }
        });
    }

    // Load last booking
    async function loadLastBooking() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/last-booking`, { method: "POST" });
            const data = await response.json();

            if (data?.status !== "empty") {
                const lastBookingId = document.getElementById('last-booking-id');
                if (lastBookingId) lastBookingId.textContent = data.bookingId || "_______";

                if (data.date) {
                    const date = new Date(data.date);
                    const lastBookingDate = document.getElementById('last-booking-date');
                    if (lastBookingDate) {
                        lastBookingDate.textContent = date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                    }
                }

                const lastBookingTime = document.getElementById('last-booking-time');
                if (lastBookingTime) lastBookingTime.textContent = data.time || "______";

                const lastBookingTotal = document.getElementById('last-booking-total');
                if (lastBookingTotal) lastBookingTotal.textContent = data.total || "______";

                const lastBookingPatient = document.getElementById('last-booking-patient');
                if (lastBookingPatient) lastBookingPatient.textContent = data.patientName || "______";
            }
        } catch (error) {
            console.warn("Last booking error:", error);
        }
    }

    // --- Bulk Booking Functionality ---
    let bulkBookingsData = []; // Stores parsed and validated data from file

    // Download template
    document.getElementById('download-bulk-template-btn')?.addEventListener('click', () => {
        const headers = [
            "Patient Name", "Age Value", "Age Unit", "Gender", "Patient Phone",
            "Doctor Name", "Lab Name", "Clinical History", "Test Names",
            "Test Results",
            "Discount Amount", "Discount Percentage", "Courier Name", "Courier ID"
        ];
        const data = [headers];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bulk Bookings");
        XLSX.writeFile(wb, "bulk_booking_template.xlsx");
    });

    // Read and parse file
    DOM.readBulkFileBtn?.addEventListener('click', () => {
        const file = DOM.bulkFileInput?.files[0];
        if (!file) {
            alert("Please select a file.");
            return;
        }

        DOM.bulkProgress.style.display = 'block';
        DOM.bulkProgress.querySelector('span').textContent = 'Reading file...';
        DOM.confirmBulkBookingsBtn.style.display = 'none';
        DOM.bulkPreviewContainer.style.display = 'none';
        document.getElementById('bulk-booking-summary').style.display = 'none';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length < 2) {
                    alert("No data found in file.");
                    DOM.bulkProgress.style.display = 'none';
                    return;
                }

                const headers = json[0];
                const rows = json.slice(1);

                await processBulkBookingData(headers, rows);
            } catch (error) {
                console.error("Error reading file:", error);
                alert("Error reading file. Please ensure it is a valid Excel/CSV file.");
                DOM.bulkProgress.style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    async function processBulkBookingData(headers, rows) {
        DOM.bulkProgress.querySelector('span').textContent = 'Validating data...';
        bulkBookingsData = [];
        let hasErrors = false;

        // Fetch all tests/panels/packages for validation
        const allTestsData = await fetchAllData();
        const testNameMap = new Map(); // Name lookup for the tests/panels/packages shown in the modal

        [...allTestsData.tests, ...allTestsData.panels, ...allTestsData.packages].forEach(item => {
            const name = getCatalogItemName(item);
            const id = getCatalogItemId(item);
            const collection = getCatalogItemCollection(item);
            const price = getCatalogItemPrice(item);
            const sampleTypes = getCatalogItemSampleTypes(item);

            if (name && id && collection) {
                testNameMap.set(name.toLowerCase(), { id, collection, price, sampleTypes });
            }
        });

        const requiredHeaders = ["Patient Name", "Age Value", "Age Unit", "Gender", "Test Names", "Test Results"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            alert(`Required headers missing in file: ${missingHeaders.join(', ')}`);
            DOM.bulkProgress.style.display = 'none';
            return;
        }

        const previewHeaders = [...headers, "Status/Errors"];
        const headerRow = DOM.bulkPreviewTable.querySelector('thead tr');
        headerRow.innerHTML = previewHeaders.map(h => `<th>${h}</th>`).join('');
        const tbody = DOM.bulkPreviewTable.querySelector('tbody');
        tbody.innerHTML = '';

        for (const rowData of rows) {
            const booking = {};
            let rowErrors = [];
            const displayRow = {};

            headers.forEach((header, index) => {
                const value = rowData[index];
                displayRow[header] = value; // For preview table
                booking[header.replace(/\s/g, '')] = value; // Clean header for internal use
            });

            // Client-side validation
            if (!booking.PatientName) rowErrors.push("Patient Name is required.");
            else booking.PatientName = booking.PatientName.toUpperCase(); // Capitalize

            if (!booking.AgeValue || isNaN(Number(booking.AgeValue))) rowErrors.push("Age Value is required and must be a number.");
            if (!booking.AgeUnit || !["Years", "Months", "Days"].includes(booking.AgeUnit)) rowErrors.push("Age Unit must be 'Years', 'Months', or 'Days'.");
            if (!booking.Gender || !["Male", "Female", "Any"].includes(booking.Gender)) rowErrors.push("Gender must be 'Male', 'Female', or 'Any'.");
            
            const testNamesRaw = booking.TestNames ? String(booking.TestNames).split(',').map(t => t.trim()).filter(Boolean) : [];
            if (testNamesRaw.length === 0) rowErrors.push("At least one Test Name is required.");

            const resolvedTestEntries = [];
            const resolvedTableData = [];
            const uniqueSampleTypes = new Set();
            let totalBookingPrice = 0; // Keep the booking total aligned with the resolved tests
            const testResultsRaw = booking.TestResults ? String(booking.TestResults).split(',').map(t => t.trim()) : [];
            
            for (const testName of testNamesRaw) {
                const mappedTest = testNameMap.get(testName.toLowerCase());
                if (mappedTest) {
                    resolvedTestEntries.push({
                        id: mappedTest.id,
                        collectionName: mappedTest.collection,
                        name: testName,
                        sampleTypes: mappedTest.sampleTypes,
                    });
                    totalBookingPrice += mappedTest.price; // Sum up prices
                    mappedTest.sampleTypes.forEach(s => uniqueSampleTypes.add(s));
                } else {
                    rowErrors.push(`Test Name '${testName}' not found.`);
                }
            }

            if (testResultsRaw.length === 0 || testResultsRaw.some(result => result === "")) {
                rowErrors.push("Test Results are required.");
            } else if (testResultsRaw.length !== testNamesRaw.length) {
                rowErrors.push("Test Results count must match Test Names count.");
            }
            
            // One row per sample type, same as the manual booking flow.
            let order = 1;
            uniqueSampleTypes.forEach(sample => {
                const sampleTestEntries = resolvedTestEntries.filter(entry =>
                    Array.isArray(entry.sampleTypes) && entry.sampleTypes.includes(sample)
                );
                const generatedBarcode = generateRandomId();
                resolvedTableData.push({
                    order: order++,
                    typeOfSample: sample,
                    barcodeId: generatedBarcode,
                    confirmBarcodeId: generatedBarcode,
                    testName: sampleTestEntries.map(e => e.name).join(', '),
                    ids: sampleTestEntries.map(item => ({ id: item.id, collectionName: item.collectionName }))
                });
            });

            if (rowErrors.length > 0) {
                hasErrors = true;
            }

            bulkBookingsData.push({
                originalData: booking,
                processedData: {
                    // Align keys with standard booking payload for automation
                    barcodeId: generateRandomId(), 
                    patientName: String(booking.PatientName || '').toUpperCase(),
                    year: `${booking.AgeValue || ''} ${booking.AgeUnit || ''}`.trim(),
                    gender: String(booking.Gender || ''),
                    patientPhone: String(booking.PatientPhone || ''),
                    doctorName: String(booking.DoctorName || ''),
                    labName: String(booking.LabName || ''),
                    clinicalHistory: String(booking.ClinicalHistory || ''),
                    discountamount: Number(booking.DiscountAmount || 0),
                    discountunit: String(booking.DiscountPercentage || '').replace('%', ''),
                    courierName: String(booking.CourierName || ''),
                    courierId: String(booking.CourierId || ''),
                    testNames: testNamesRaw,
                    testResults: testResultsRaw,
                    testIds: resolvedTestEntries.map(item => item.id),
                    tableData: resolvedTableData,
                    createdbyuser: username,
                    userId: userId,
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                    total: totalBookingPrice
                },
                errors: rowErrors
            });

            // Render row in preview table
            const tr = document.createElement('tr');
            tr.innerHTML = previewHeaders.map(h => {
                if (h === "Patient Name") return `<td class="${rowErrors.length > 0 ? 'error-cell' : ''}">${displayRow[h] ? displayRow[h].toUpperCase() : ''}</td>`;
                if (h === "Status/Errors") return `<td class="${rowErrors.length > 0 ? 'error-cell' : ''}">${rowErrors.join(', ') || 'OK'}</td>`;
                return `<td class="${rowErrors.length > 0 ? 'error-cell' : ''}">${displayRow[h] || ''}</td>`;
            }).join('');
            tbody.appendChild(tr);
        }

        DOM.bulkPreviewContainer.style.display = 'block';
        DOM.bulkProgress.style.display = 'none';
        DOM.confirmBulkBookingsBtn.style.display = 'block';
        DOM.confirmBulkBookingsBtn.disabled = hasErrors;
        if (hasErrors) {
            document.getElementById('bulk-booking-summary').textContent = 'Bulk booking cannot be confirmed due to errors.';
            document.getElementById('bulk-booking-summary').style.color = 'red';
            document.getElementById('bulk-booking-summary').style.display = 'block';
        } else {
            document.getElementById('bulk-booking-summary').textContent = `${bulkBookingsData.length} bookings are ready.`;
            document.getElementById('bulk-booking-summary').style.color = 'green';
            document.getElementById('bulk-booking-summary').style.display = 'block';
        }
    }

    // Confirm bulk bookings
    DOM.confirmBulkBookingsBtn?.addEventListener('click', async () => {
        if (bulkBookingsData.length === 0 || DOM.confirmBulkBookingsBtn.disabled) {
            alert("No valid booking data or errors exist.");
            return;
        }

        DOM.bulkProgress.style.display = 'block';
        DOM.bulkProgress.querySelector('span').textContent = 'Creating bookings...';
        DOM.confirmBulkBookingsBtn.disabled = true;

        try {
            const bookingsToSend = bulkBookingsData.map(item => item.processedData);
            const response = await fetch(`${BASE_URL}/api/v1/bulk-bookings/auto-finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingsToSend)
            });

            const apiResponse = await response.json();
            const resultData = (apiResponse && typeof apiResponse === 'object' && apiResponse.data && typeof apiResponse.data === 'object')
                ? apiResponse.data
                : (apiResponse && typeof apiResponse === 'object' ? apiResponse : {});
            const successfulBookings = Array.isArray(resultData.successfulBookings) ? resultData.successfulBookings : [];
            const failedBookings = Array.isArray(resultData.failedBookings) ? resultData.failedBookings : [];

            if (response.ok) {
                const failureNotes = failedBookings
                    .slice(0, 3)
                    .map((item, index) => `${index + 1}. ${item.patient || 'Unknown'} - ${item.error || 'Unknown error'}`)
                    .join('\n');

                alert(
                    `Bulk booking completed successfully. Successful: ${successfulBookings.length}, Failed: ${failedBookings.length}` +
                    (failureNotes ? `\n\nFirst failures:\n${failureNotes}` : "")
                );
                location.reload(); // Reload page after successful bulk booking
            } else {
                alert(`Error in bulk booking: ${apiResponse?.message || 'Unknown error'}`);
                console.error("Bulk booking error:", apiResponse);
            }
        } catch (error) {
            console.error("Error in bulk booking API call:", error);
            alert("A network error occurred while performing bulk booking.");
        } finally {
            DOM.bulkProgress.style.display = 'none';
            DOM.confirmBulkBookingsBtn.disabled = false;
        }
    });

    function hideContentForSingleLayer() {
        if (user?.tenantId?.modelType === "1layer") {
            document.querySelectorAll('.forhide').forEach(elem => {
                elem.style.display = "none";
            });
        }
    }

    // Main initialization - optimized order
    async function init() {
        try {
            if (DOM.loader) DOM.loader.style.display = "flex";

            // Set random ID immediately (no API call needed initially)
            const randomIdInput = document.getElementById('random-id');
            if (randomIdInput) {
                randomIdInput.value = generateRandomId();
            }

            // Set date/time immediately (no async needed)
            setDateTime();
            hideContentForSingleLayer();

            // Setup UI elements that don't need data
            setupModals();
            setupSearch();
            setupInputHandlers();
            setupFormSubmissions();
            setupBookingSubmit();

            // Fetch all data in parallel (critical path)
            const [dataResult] = await Promise.allSettled([
                Promise.all([
                    fetchAllData(),
                    populateDropdowns(),
                    loadLastBooking()
                ])
            ]);

            // Render tests after data is loaded
            if (dataResult.status === 'fulfilled') {
                const [allData] = dataResult.value;
                renderTests(allData.tests, allData.panels, allData.packages);
                setupTestSelection();
            }

        } catch (error) {
            console.error("Initialization error:", error);
        } finally {
            if (DOM.loader) DOM.loader.style.display = "none";
        }
    }

    await init();
}

// Safe execution
(async function () {
    try {
        await bookingload();
    } catch (error) {
        console.error("Booking load error:", error);
        const loader = document.querySelector('.loader');
        if (loader) loader.style.display = "none";
    }
})();
