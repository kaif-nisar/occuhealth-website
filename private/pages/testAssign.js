//testAssign with Search Functionality
// Global variables to store data
let testsData = [];
let panelsData = [];
let packagesData = [];
let unitIds = [];
let sampleIds = [];
let categoryIds = [];

// Search filters
let testSearchQuery = '';
let panelSearchQuery = '';
let packageSearchQuery = '';

// Load initial data
async function loadInitialData() {
    const franchiseeSelect = document.getElementById("franchiseeSelect");

    try {
        // Fire all requests in parallel for better performance
        const [franchiseeRes, testRes, panelRes, packageRes] = await Promise.all([
            fetch(`/api/v1/user/get-tenants`),
            fetch(`/api/v1/user/test-database`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            }),
            fetch(`/api/v1/user/all-pannels`, {
                method: "POST",
                credentials: "include",
            }),
            fetch(`/api/v1/user/all-packages`, {
                method: "POST",
                credentials: "include",
            }),
        ]);
        
        // Check if all requests were successful
        if (!franchiseeRes.ok || !testRes.ok || !panelRes.ok || !packageRes.ok) {
            throw new Error('One or more API requests failed');
        }

        // Parse all JSONs
        const [franchisees, tests, panels, packages] = await Promise.all([
            franchiseeRes.json(),
            testRes.json(),
            panelRes.json(),
            packageRes.json(),
        ]);
        
        // Store data globally
        testsData = tests || [];
        panelsData = panels || [];
        packagesData = packages || [];
        
        // Populate franchisees dropdown
        (franchisees.data || []).forEach((franchisee) => {
            const option = document.createElement("option");
            option.value = franchisee._id;
            option.textContent = franchisee.name;
            franchiseeSelect.appendChild(option);
        });

        // Populate all model lists
        renderTests();
        renderPanels();
        renderPackages();

    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('error', 'Failed to load data from server. Please refresh the page.');

        // Show error state in loading areas
        const loadingAreas = ['testsList', 'panelsList', 'packagesList'];
        loadingAreas.forEach(id => {
            document.getElementById(id).innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="margin-bottom: 10px;"></i>
                    <div>Failed to load data</div>
                </div>
            `;
        });
    }
}

// FIXED: Properly update global variables
async function getAllAddON() {
    try {
        const response = await fetch(`/api/v1/user/get-all-addons`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });

        const result = await response.json();

        if (result.success) {
            // UPDATE GLOBAL VARIABLES
            unitIds = result.unitIds || [];
            sampleIds = result.sampleTypeIds || [];
            categoryIds = result.categoryIds || [];

            return {
                unitIds: unitIds,
                sampleIds: sampleIds,
                categoryIds: categoryIds
            };
        }

        return { unitIds: [], sampleIds: [], categoryIds: [] };

    } catch (error) {
        console.error('Error fetching addons:', error);
        return { unitIds: [], sampleIds: [], categoryIds: [] };
    }
}

// Filter function for search
function filterData(data, searchQuery, nameField) {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase().trim();
    return data.filter(item => {
        const name = item[nameField]?.toLowerCase() || '';
        return name.includes(query);
    });
}

// Render functions with search support
function renderTests(searchQuery = testSearchQuery) {
    const container = document.getElementById("testsList");
    const countElement = document.getElementById("testsCount");
    const searchResultElement = document.getElementById("testsSearchResult");

    const filteredTests = filterData(testsData, searchQuery, 'Name');
    
    container.innerHTML = "";
    countElement.textContent = testsData.length;
    
    // Show search results count
    if (searchQuery.trim()) {
        searchResultElement.textContent = `Showing ${filteredTests.length} of ${testsData.length}`;
        searchResultElement.style.display = 'block';
    } else {
        searchResultElement.style.display = 'none';
    }

    if (filteredTests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 20px;">
                <i class="fas fa-search" style="margin-bottom: 10px;"></i>
                <div>${searchQuery.trim() ? 'No tests found matching your search' : 'No tests available'}</div>
            </div>
        `;
        return;
    }

    filteredTests.forEach((test, index) => {
        // Find original index for data-id
        const originalIndex = testsData.findIndex(t => t._id === test._id);
        const item = document.createElement("div");
        item.className = "data-item";
        
        // Highlight search term in name
        const highlightedName = highlightSearchTerm(test.Name, searchQuery);
        
        item.innerHTML = `
            <input type="checkbox" class="item-checkbox test-checkbox" data-id="${test._id}" data-index="${originalIndex}">
            <span class="item-name" title="${test.Name}">${highlightedName}</span>
            <span class="item-price">₹${test.Price || test.final_price || 0}</span>
        `;
        container.appendChild(item);
    });
    
    // Update select all checkbox state
    updateSelectAllState('test-checkbox', 'selectAllTests');
}

function renderPanels(searchQuery = panelSearchQuery) {
    const container = document.getElementById("panelsList");
    const countElement = document.getElementById("panelsCount");
    const searchResultElement = document.getElementById("panelsSearchResult");

    const filteredPanels = filterData(panelsData, searchQuery, 'name');
    
    container.innerHTML = "";
    countElement.textContent = panelsData.length;
    
    // Show search results count
    if (searchQuery.trim()) {
        searchResultElement.textContent = `Showing ${filteredPanels.length} of ${panelsData.length}`;
        searchResultElement.style.display = 'block';
    } else {
        searchResultElement.style.display = 'none';
    }

    if (filteredPanels.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 20px;">
                <i class="fas fa-search" style="margin-bottom: 10px;"></i>
                <div>${searchQuery.trim() ? 'No panels found matching your search' : 'No panels available'}</div>
            </div>
        `;
        return;
    }

    filteredPanels.forEach((panel, index) => {
        const originalIndex = panelsData.findIndex(p => p._id === panel._id);
        const item = document.createElement("div");
        item.className = "data-item";
        
        const highlightedName = highlightSearchTerm(panel.name, searchQuery);
        
        item.innerHTML = `
            <input type="checkbox" class="item-checkbox panel-checkbox" data-id="${panel._id}" data-index="${originalIndex}">
            <span class="item-name" title="${panel.name}">${highlightedName}</span>
            <span class="item-price">₹${panel.price || panel.final_price || 0}</span>
        `;
        container.appendChild(item);
    });
    
    updateSelectAllState('panel-checkbox', 'selectAllPanels');
}

function renderPackages(searchQuery = packageSearchQuery) {
    const container = document.getElementById("packagesList");
    const countElement = document.getElementById("packagesCount");
    const searchResultElement = document.getElementById("packagesSearchResult");

    const filteredPackages = filterData(packagesData, searchQuery, 'packageName');
    
    container.innerHTML = "";
    countElement.textContent = packagesData.length;
    
    // Show search results count
    if (searchQuery.trim()) {
        searchResultElement.textContent = `Showing ${filteredPackages.length} of ${packagesData.length}`;
        searchResultElement.style.display = 'block';
    } else {
        searchResultElement.style.display = 'none';
    }

    if (filteredPackages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 20px;">
                <i class="fas fa-search" style="margin-bottom: 10px;"></i>
                <div>${searchQuery.trim() ? 'No packages found matching your search' : 'No packages available'}</div>
            </div>
        `;
        return;
    }

    filteredPackages.forEach((pkg, index) => {
        const originalIndex = packagesData.findIndex(p => p._id === pkg._id);
        const item = document.createElement("div");
        item.className = "data-item";
        
        const highlightedName = highlightSearchTerm(pkg.packageName, searchQuery);
        
        item.innerHTML = `
            <input type="checkbox" class="item-checkbox package-checkbox" data-id="${pkg._id}" data-index="${originalIndex}">
            <span class="item-name" title="${pkg.packageName}">${highlightedName}</span>
            <span class="item-price">₹${pkg.packageFee || pkg.final_price || 0}</span>
        `;
        container.appendChild(item);
    });
    
    updateSelectAllState('package-checkbox', 'selectAllPackages');
}

// Highlight search term in text
function highlightSearchTerm(text, searchQuery) {
    if (!searchQuery.trim() || !text) return text;
    
    const regex = new RegExp(`(${searchQuery.trim()})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #fef08a; padding: 2px 0;">$1</mark>');
}

// Update select all checkbox state based on visible items
function updateSelectAllState(checkboxClass, selectAllId) {
    const allVisibleCheckboxes = document.querySelectorAll(`.${checkboxClass}`);
    const checkedVisibleCheckboxes = document.querySelectorAll(`.${checkboxClass}:checked`);
    const selectAllCheckbox = document.getElementById(selectAllId);

    if (!selectAllCheckbox || allVisibleCheckboxes.length === 0) return;

    if (checkedVisibleCheckboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedVisibleCheckboxes.length === allVisibleCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

// Search event listeners
 (function() {
    // Tests search
    const testsSearchInput = document.getElementById("testsSearch");
    if (testsSearchInput) {
        testsSearchInput.addEventListener('input', debounce(function(e) {
            testSearchQuery = e.target.value;
            renderTests(testSearchQuery);
        }, 300));
    }

    // Panels search
    const panelsSearchInput = document.getElementById("panelsSearch");
    if (panelsSearchInput) {
        panelsSearchInput.addEventListener('input', debounce(function(e) {
            panelSearchQuery = e.target.value;
            renderPanels(panelSearchQuery);
        }, 300));
    }

    // Packages search
    const packagesSearchInput = document.getElementById("packagesSearch");
    if (packagesSearchInput) {
        packagesSearchInput.addEventListener('input', debounce(function(e) {
            packageSearchQuery = e.target.value;
            renderPackages(packageSearchQuery);
        }, 300));
    }
})();

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Select All functionality with search awareness
document.getElementById("selectAllTests").addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".test-checkbox");
    checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
    });
});

document.getElementById("selectAllPanels").addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".panel-checkbox");
    checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
    });
});

document.getElementById("selectAllPackages").addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".package-checkbox");
    checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
    });
});

// Assignment functionality
document.getElementById("assignModelsBtn").addEventListener("click", async function () {
    const franchiseeId = document.getElementById("franchiseeSelect").value;

    if (!franchiseeId) {
        showMessage('error', 'Please select a franchisee.');
        return;
    }
   
    // Get selected items
    const selectedTests = Array.from(document.querySelectorAll(".test-checkbox:checked")).map(cb => cb.dataset.id);
    const selectedPanels = Array.from(document.querySelectorAll(".panel-checkbox:checked")).map(cb => cb.dataset.id);
    const selectedPackages = Array.from(document.querySelectorAll(".package-checkbox:checked")).map(cb => cb.dataset.id);

    if (selectedTests.length === 0 && selectedPanels.length === 0 && selectedPackages.length === 0) {
        showMessage('error', 'Please select at least one model to assign.');
        return;
    }

    // Show loading state
    const originalText = this.innerHTML;
    this.innerHTML = '<div class="loading-spinner"></div> Assigning...';
    this.disabled = true;

    try {
        const assignRes = await fetch("/api/v1/user/assign-models", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                franchiseeId,
                testIds: selectedTests,
                panelIds: selectedPanels,
                packageIds: selectedPackages,
                unitIds: unitIds,
                sampleTypeIds: sampleIds,
                categoryIds: categoryIds
            }),
        });

        const result = await assignRes.json();

        if (result.success || assignRes.ok) {
            const assignedCounts = result.assignedCounts || {};
            const skippedCounts = result.skippedCounts || {};

            const totalAssigned = (assignedCounts.tests || 0) +
                (assignedCounts.panels || 0) +
                (assignedCounts.packages || 0) +
                (assignedCounts.categories || 0) +
                (assignedCounts.units || 0) +
                (assignedCounts.sampleTypes || 0);

            const totalSkipped = (skippedCounts.tests || 0) +
                (skippedCounts.panels || 0) +
                (skippedCounts.packages || 0) +
                (skippedCounts.categories || 0) +
                (skippedCounts.units || 0) +
                (skippedCounts.sampleTypes || 0);

            let successMessage = `Assignment completed successfully!\n\n`;

            if (totalAssigned > 0) {
                successMessage += `✅ Assigned (${totalAssigned} items):\n`;
                if (assignedCounts.tests) successMessage += `• ${assignedCounts.tests} tests\n`;
                if (assignedCounts.panels) successMessage += `• ${assignedCounts.panels} panels\n`;
                if (assignedCounts.packages) successMessage += `• ${assignedCounts.packages} packages\n`;
                if (assignedCounts.categories) successMessage += `• ${assignedCounts.categories} categories\n`;
                if (assignedCounts.units) successMessage += `• ${assignedCounts.units} units\n`;
                if (assignedCounts.sampleTypes) successMessage += `• ${assignedCounts.sampleTypes} sample types\n`;
            }

            if (totalSkipped > 0) {
                successMessage += `\n⚠️ Skipped (${totalSkipped} items - already assigned):\n`;
                if (skippedCounts.tests) successMessage += `• ${skippedCounts.tests} tests\n`;
                if (skippedCounts.panels) successMessage += `• ${skippedCounts.panels} panels\n`;
                if (skippedCounts.packages) successMessage += `• ${skippedCounts.packages} packages\n`;
                if (skippedCounts.categories) successMessage += `• ${skippedCounts.categories} categories\n`;
                if (skippedCounts.units) successMessage += `• ${skippedCounts.units} units\n`;
                if (skippedCounts.sampleTypes) successMessage += `• ${skippedCounts.sampleTypes} sample types\n`;
            }

            showMessage('success', successMessage);
            clearAllSelections();

        } else {
            const errorMessage = result.message || result.error || 'Unknown error occurred during assignment';
            showMessage('error', `Assignment failed: ${errorMessage}`);
        }

    } catch (err) {
        console.error('Assignment error:', err);
        showMessage('error', `Network error: ${err.message}. Please check your connection and try again.`);
    } finally {
        this.innerHTML = originalText;
        this.disabled = false;
    }
});

// Helper function to clear all selections
function clearAllSelections() {
    // Uncheck all checkboxes
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset select all checkboxes
    document.getElementById('selectAllTests').checked = false;
    document.getElementById('selectAllTests').indeterminate = false;
    document.getElementById('selectAllPanels').checked = false;
    document.getElementById('selectAllPanels').indeterminate = false;
    document.getElementById('selectAllPackages').checked = false;
    document.getElementById('selectAllPackages').indeterminate = false;
    
    // Clear search inputs
    const searchInputs = ['testsSearch', 'panelsSearch', 'packagesSearch'];
    searchInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    // Reset search queries and re-render
    testSearchQuery = '';
    panelSearchQuery = '';
    packageSearchQuery = '';
    renderTests();
    renderPanels();
    renderPackages();
}

// Enhanced utility function to show messages
function showMessage(type, message) {
    const successEl = document.getElementById("assignmentSuccess");
    const errorEl = document.getElementById("assignmentError");

    successEl.style.display = "none";
    errorEl.style.display = "none";

    const formattedMessage = message.replace(/\n/g, '<br>');

    if (type === 'success') {
        successEl.innerHTML = `<i class="fas fa-check-circle"></i> <div>${formattedMessage}</div>`;
        successEl.style.display = "flex";
        successEl.style.alignItems = "flex-start";
        setTimeout(() => successEl.style.display = "none", 12000);
    } else {
        errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> <div>${formattedMessage}</div>`;
        errorEl.style.display = "flex";
        errorEl.style.alignItems = "flex-start";
        setTimeout(() => errorEl.style.display = "none", 10000);
    }
}

// Auto-update select all checkboxes based on individual selections
document.addEventListener('change', function (e) {
    if (e.target.classList.contains('test-checkbox')) {
        updateSelectAllCheckbox('test-checkbox', 'selectAllTests');
    } else if (e.target.classList.contains('panel-checkbox')) {
        updateSelectAllCheckbox('panel-checkbox', 'selectAllPanels');
    } else if (e.target.classList.contains('package-checkbox')) {
        updateSelectAllCheckbox('package-checkbox', 'selectAllPackages');
    }
});

function updateSelectAllCheckbox(checkboxClass, selectAllId) {
    const allCheckboxes = document.querySelectorAll(`.${checkboxClass}`);
    const checkedCheckboxes = document.querySelectorAll(`.${checkboxClass}:checked`);
    const selectAllCheckbox = document.getElementById(selectAllId);

    if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

// Initialize page
async function initializePage() {
    try {
        await loadInitialData();
        await getAllAddON();
        console.log('Page initialized successfully');
    } catch (error) {
        console.error('Error initializing page:', error);
        showMessage('error', 'Failed to initialize page. Please refresh.');
    }
}

initializePage();