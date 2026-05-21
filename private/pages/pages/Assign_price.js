
function stri(){
let currentBasePrice = 0;

// Function to update test details on left panel
function updateTestDetails(testName, franchiseeName, testPrice, assignedPrice) {
    const detailsContent = document.getElementById('test-details-content');
    detailsContent.innerHTML = `
        <div class="test-detail">
            <div class="test-name">${testName}</div>
            <div class="price-label">Franchisee Price: Rs. <span>${testPrice}</span></div>
        </div>
        <div class="test-detail">
            <div class="franchisee-badge">${franchiseeName}</div>
            <div class="altered-badge">Assigned Price: Rs. <span>${assignedPrice || 'Not Set'}</span></div>
        </div>
    `;
}

// Function to calculate price from percentage
function calculatePriceFromPercentage() {
    const basePrice = parseFloat(document.getElementById('test-price').value) || 0;
    const percentage = parseFloat(document.getElementById('percentage').value) || 0;
    const assignedPriceInput = document.getElementById('base-price');

    if (basePrice > 0) {
        const calculatedPrice = basePrice + (basePrice * percentage / 100);
        assignedPriceInput.value = calculatedPrice.toFixed(2);
        validateAssignedPrice();
    }
}

// Function to validate assigned price
function validateAssignedPrice() {
    const assignedPrice = parseFloat(document.getElementById('base-price').value) || 0;
    const testPrice = parseFloat(document.getElementById('final-price').value) || 0;
    const errorMessage = document.getElementById('base-price-error');
    const assignedPriceInput = document.getElementById('base-price');

    if (assignedPrice > testPrice) {
        errorMessage.classList.add('show');
        assignedPriceInput.style.borderColor = '#e74c3c';
        return false;
    } else {
        errorMessage.classList.remove('show');
        assignedPriceInput.style.borderColor = '#e0e6ed';
        return true;
    }
}

async function assignedPrice() {
    const franchiseeSelect = document.getElementById('franchisee');
    const testSelect = document.getElementById('test');
    const testSearch = document.getElementById('testSearch');
    const testPrice = document.getElementById('test-price');
    const assignedPrice = document.getElementById('base-price');
    const percentage = document.getElementById('percentage');
    const finalPrice = document.getElementById('final-price');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    let allTests = [];
    let filteredTests = [];

    // Fetch franchisees
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`);
        const data = await response.json();
        
        if (data.message && Array.isArray(data.message)) {
            data.message.forEach(franchisee => {
                const option = document.createElement('option');
                option.value = franchisee._id;
                option.textContent = `${franchisee.username}/${franchisee.fullName}`;
                franchiseeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching franchisees:', error);
        alert('Failed to load franchisees. Please refresh the page.');
    }

    // Function to populate tests dropdown
    const populateTests = (tests) => {
        testSelect.innerHTML = '<option value="">Select Test</option>';
        filteredTests = tests;
        
        tests.forEach(test => {
            const option = document.createElement('option');
            option.value = test.testId || test.packageId || test.panelId;
            
            // Create display name
            const displayName = test.testName || test.panelName || test.packageName || 'Unnamed Test';
            option.textContent = displayName;
            
            // Store data in option element
            option.dataset.price = test.assignedPriceToUser || test.myPrice || '';
            option.dataset.assignedPrice = test.franchiseePrice || test.assignedPriceToFranchisee || test.basePrice || '';
            option.dataset.commission = test.commissionToFranchisee || '';
            option.dataset.finalPrice = test.mrpPrice || '';
            option.dataset.testName = displayName;
            
            testSelect.appendChild(option);
        });

        // Update results count
        const resultsCount = document.getElementById('search-results-count');
        if (resultsCount) {
            if (tests.length > 0) {
                resultsCount.textContent = `${tests.length} test(s) found`;
            } else {
                resultsCount.textContent = 'No tests found';
            }
        }
    };

    // Search functionality
    if (testSearch) {
        testSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (searchTerm === '') {
                populateTests(allTests);
                return;
            }

            // Filter tests
            const filtered = allTests.filter(test => {
                const testName = (test.testName || test.panelName || test.packageName || '').toLowerCase();
                return testName.includes(searchTerm);
            });

            // Sort results: exact match > starts with > contains
            filtered.sort((a, b) => {
                const aName = (a.testName || a.panelName || a.packageName || '').toLowerCase();
                const bName = (b.testName || b.panelName || b.packageName || '').toLowerCase();
                
                // Exact match first
                if (aName === searchTerm && bName !== searchTerm) return -1;
                if (bName === searchTerm && aName !== searchTerm) return 1;
                
                // Starts with second
                if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
                if (bName.startsWith(searchTerm) && !aName.startsWith(searchTerm)) return 1;
                
                // Alphabetical order
                return aName.localeCompare(bName);
            });

            populateTests(filtered);

            // Auto-select if only one result
            if (filtered.length === 1) {
                testSelect.value = filtered[0].testId || filtered[0].packageId || filtered[0].panelId;
                testSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (testSearch) {
                testSearch.value = '';
                populateTests(allTests);
                testSelect.value = '';
                document.getElementById('test-details-content').innerHTML = 
                    '<div class="no-data">Select a test to view details</div>';
            }
        });
    }

    // Franchisee selection change
    franchiseeSelect.addEventListener('change', async () => {
        const selectedFranchiseeId = franchiseeSelect.value;
        
        // Reset form
        testSelect.innerHTML = '<option value="">Select Test</option>';
        if (testSearch) testSearch.value = '';
        testPrice.value = '';
        assignedPrice.value = '';
        percentage.value = '';
        finalPrice.value = '';
        document.getElementById('test-details-content').innerHTML = 
            '<div class="no-data">Select a test to view details</div>';

        if (!selectedFranchiseeId) return;

        // Show loading
        testSelect.innerHTML = '<option value="">Loading tests...</option>';
        
        try {
            // Fetch all test types
            const [testResponse, panelResponse, packageResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}&oldId=${selectedFranchiseeId}`, 
                    { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}&oldId=${selectedFranchiseeId}`, 
                    { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}&oldId=${selectedFranchiseeId}`, 
                    { method: "POST" })
            ]);

            if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
                throw new Error("Failed to load tests");
            }

            const testData = await testResponse.json();
            const panelData = await panelResponse.json();
            const packageData = await packageResponse.json();

            // Combine all data
            allTests = [...testData, ...panelData, ...packageData];
            console.log('Fetched tests:', allTests);
            // Sort alphabetically
            allTests.sort((a, b) => {
                const aName = (a.testName || a.panelName || a.packageName || '').toLowerCase();
                const bName = (b.testName || b.panelName || b.packageName || '').toLowerCase();
                return aName.localeCompare(bName);
            });

            console.log(`Loaded ${allTests.length} tests`);
            populateTests(allTests);
            
            if (testSearch) testSearch.focus();
        } catch (error) {
            console.error('Error fetching tests:', error);
            alert('Failed to load tests. Please try again.');
            testSelect.innerHTML = '<option value="">Error loading tests</option>';
        }
    });

    // Test selection change
    testSelect.addEventListener('change', () => {
        const selectedOption = testSelect.options[testSelect.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) {
            testPrice.value = '';
            assignedPrice.value = '';
            percentage.value = '';
            finalPrice.value = '';
            document.getElementById('test-details-content').innerHTML = 
                '<div class="no-data">Select a test to view details</div>';
            return;
        }

        // Get data from option
        const price = selectedOption.dataset.price;
        const assigned = selectedOption.dataset.assignedPrice;
        const commission = selectedOption.dataset.commission;
        const base = selectedOption.dataset.finalPrice;
        const name = selectedOption.dataset.testName;

        // Update form fields
        testPrice.value = price || '';
        assignedPrice.value = assigned || '';
        finalPrice.value = base || '';
        currentBasePrice = parseFloat(price) || 0;

        // Calculate percentage if commission exists
        if (commission) {
            percentage.value = commission;
        } else if (price && assigned && base) {
            const calculatedPercentage = (((parseFloat(price) - parseFloat(assigned)) / parseFloat(base)) * 100).toFixed(2);
            percentage.value = calculatedPercentage;
        } else {
            percentage.value = '';
        }

        // Update left panel
        const franchiseeOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];
        updateTestDetails(
            name,
            franchiseeOption ? franchiseeOption.textContent : 'N/A',
            price,
            assigned
        );
    });

    // Assigned price input
    assignedPrice.addEventListener('input', () => {
        validateAssignedPrice();
    });

    // Percentage input
    percentage.addEventListener('input', () => {
        calculatePriceFromPercentage();
    });

    // Submit button
    const submitButton = document.getElementById('submitbtn');
    submitButton.addEventListener('click', () => {
        const franchiseeId = franchiseeSelect.value;
        const testId = testSelect.value;
        const assignedPriceValue = assignedPrice.value;
        const finalPriceValue = finalPrice.value;
        const tat = document.getElementById('TAT').value;
        const remarks = document.getElementById('remarks').value;

        // Validation
        if (!franchiseeId || !testId || !assignedPriceValue || !finalPriceValue) {
            alert('Please fill all required fields!');
            return;
        }

        if (!validateAssignedPrice()) {
            alert('Assigned price cannot exceed franchisee price!');
            return;
        }

        // Prepare payload
        const payload = {
            testId,
            franchiseeId,
            assignedBy: userId,
            testType: 'test',
            price: parseFloat(assignedPriceValue),
            finalPrice: parseFloat(finalPriceValue),
            commissionRate: parseFloat(percentage.value) || 0,
            tat,
            remarks
        };

        console.log('Submitting payload:', payload);

        // Submit
        fetch(`${BASE_URL}/api/v1/user/assignPrice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert(data.message);
                // Reset form
                document.getElementById('test-pricing-form').reset();
                if (testSearch) testSearch.value = '';
                allTests = [];
                filteredTests = [];
                testSelect.innerHTML = '<option value="">First select franchisee</option>';
                document.getElementById('test-details-content').innerHTML = 
                    '<div class="no-data">Select a test to view details</div>';
            }
        })
        .catch(error => {
            console.error('Error assigning price:', error);
            alert('Failed to assign price. Please try again.');
        });
    });
}

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', assignedPrice);
} else {
    assignedPrice();
}
}
stri();