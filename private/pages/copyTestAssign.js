//copyTestAssign
// Global variables
let allAdmins = [];
let sourceAdminModels = { tests: [], panels: [], packages: [], units: [], samples: [], categories: [] };
let targetAdminModels = { tests: [], panels: [], packages: [], units: [], samples: [], categories: [] };
let unitIds = [];
let sampleIds = [];
let categoryIds = [];

// Load initial data
async function loadAdmins() {
    try {
        const response = await fetch(`/api/v1/user/get-tenants`);
        const result = await response.json();

        allAdmins = result.data || [];

        const sourceSelect = document.getElementById("sourceAdminSelect");
        const targetSelect = document.getElementById("targetAdminSelect");

        // Clear existing options
        sourceSelect.innerHTML = '<option value="">Select source admin...</option>';
        targetSelect.innerHTML = '<option value="">Select target admin...</option>';

        // Populate both dropdowns
        allAdmins.forEach((admin) => {
            const sourceOption = document.createElement("option");
            sourceOption.value = admin._id;
            sourceOption.textContent = admin.name;

            const targetOption = document.createElement("option");
            targetOption.value = admin._id;
            targetOption.textContent = admin.name;

            sourceSelect.appendChild(sourceOption);
            targetSelect.appendChild(targetOption);
        });

    } catch (error) {
        console.error('Error loading admins:', error);
        showMessage('error', 'Failed to load admin list');
    }
}

// Get assigned models for specific admin
async function getAdminModels(adminId) {
    try {
        const response = await fetch(`/api/v1/user/get-admin-assigned-models`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ adminId })
        });

        const result = await response.json();
        if (result.success) {
            return {
                tests: result.data.tests || [],
                panels: result.data.panels || [],
                packages: result.data.packages || []
            };
        }
        return { tests: [], panels: [], packages: [] };

    } catch (error) {
        console.error('Error fetching admin models:', error);
        return { tests: [], panels: [], packages: [] };
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
        // console.log('AddOns received:', result);

        if (result.success) {
            // UPDATE GLOBAL VARIABLES - This was missing!
            unitIds = result.unitIds || [];
            sampleIds = result.sampleTypeIds || [];
            categoryIds = result.categoryIds || [];

            // console.log('Global variables updated:', {
            //     unitIds: unitIds.length,
            //     sampleIds: sampleIds.length,
            //     categoryIds: categoryIds.length
            // });

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

// Update preview for admin models
function updateModelsPreview(models, previewId, testCountId, panelCountId, packageCountId, listId) {
    const preview = document.getElementById(previewId);
    const testCount = document.getElementById(testCountId);
    const panelCount = document.getElementById(panelCountId);
    const packageCount = document.getElementById(packageCountId);
    const list = document.getElementById(listId);

    // Compute breakdowns: prefer explicit createdByRole when present.
    const totalTests = Array.isArray(models.tests) ? models.tests.length : 0;
    const adminTests = Array.isArray(models.tests) ? models.tests.filter(t => String(t.createdByRole).toLowerCase() === 'admin').length : 0;
    const superAdminTests = totalTests - adminTests;

    const totalPanels = Array.isArray(models.panels) ? models.panels.length : 0;
    const adminPanels = Array.isArray(models.panels) ? models.panels.filter(p => String(p.createdByRole).toLowerCase() === 'admin').length : 0;
    const superAdminPanels = totalPanels - adminPanels;

    const totalPackages = Array.isArray(models.packages) ? models.packages.length : 0;
    const adminPackages = Array.isArray(models.packages) ? models.packages.filter(pk => String(pk.createdByRole).toLowerCase() === 'admin').length : 0;
    const superAdminPackages = totalPackages - adminPackages;

    // Show primary count as superAdmin (base) items, and show a small +N admin badge when applicable.
    const smallBadge = (n, label) => n > 0 ? `<span style="font-size:0.65rem;color:#6b7280;margin-left:6px">+${n} ${label}</span>` : '';

    testCount.innerHTML = `${superAdminTests}${smallBadge(adminTests, 'admin')}`;
    panelCount.innerHTML = `${superAdminPanels}${smallBadge(adminPanels, 'admin')}`;
    packageCount.innerHTML = `${superAdminPackages}${smallBadge(adminPackages, 'admin')}`;

    let listHTML = '';

    // Add tests
    models.tests.slice(0, 5).forEach(test => {
        listHTML += `<div class="preview-item">
            <span><i class="fas fa-vial"></i> ${test.Name}</span>
            <span>₹${test.Price || 0}</span>
        </div>`;
    });

    // Add panels
    models.panels.slice(0, 5).forEach(panel => {
        listHTML += `<div class="preview-item">
            <span><i class="fas fa-layer-group"></i> ${panel.name}</span>
            <span>₹${panel.price || 0}</span>
        </div>`;
    });

    // Add packages
    models.packages.slice(0, 5).forEach(pkg => {
        listHTML += `<div class="preview-item">
            <span><i class="fas fa-box"></i> ${pkg.packageName}</span>
            <span>₹${pkg.packageFee || 0}</span>
        </div>`;
    });

    const totalItems = models.tests.length + models.panels.length + models.packages.length;
    if (totalItems > 15) {
        listHTML += `<div class="preview-item" style="font-style: italic; color: #6b7280;">
            <span>... and ${totalItems - 15} more items</span>
        </div>`;
    }

    list.innerHTML = listHTML;
    preview.style.display = totalItems > 0 ? 'block' : 'none';
}

// Source admin change handler
document.getElementById("sourceAdminSelect").addEventListener("change", async function () {
    const adminId = this.value;

    if (!adminId) {
        document.getElementById("sourceModelsPreview").style.display = 'none';
        sourceAdminModels = { tests: [], panels: [], packages: [] };
        return;
    }

    // Show loading state
    document.getElementById("sourceModelsPreview").style.display = 'block';
    document.getElementById("sourceModelsList").innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    sourceAdminModels = await getAdminModels(adminId);
    updateModelsPreview(sourceAdminModels, 'sourceModelsPreview', 'sourceTestsCount', 'sourcePanelsCount', 'sourcePackagesCount', 'sourceModelsList');
});

// Target admin change handler
document.getElementById("targetAdminSelect").addEventListener("change", async function () {
    const adminId = this.value;

    if (!adminId) {
        document.getElementById("targetModelsPreview").style.display = 'none';
        targetAdminModels = { tests: [], panels: [], packages: [] };
        return;
    }

    // Show loading state
    document.getElementById("targetModelsPreview").style.display = 'block';
    document.getElementById("targetModelsList").innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    targetAdminModels = await getAdminModels(adminId);
    updateModelsPreview(targetAdminModels, 'targetModelsPreview', 'targetTestsCount', 'targetPanelsCount', 'targetPackagesCount', 'targetModelsList');
});

// Copy models functionality
document.getElementById("copyModelsBtn").addEventListener("click", async function () {
    const sourceAdminId = document.getElementById("sourceAdminSelect").value;
    const targetAdminId = document.getElementById("targetAdminSelect").value;

    if (!sourceAdminId) {
        showMessage('error', 'Please select a source admin.');
        return;
    }

    if (!targetAdminId) {
        showMessage('error', 'Please select a target admin.');
        return;
    }

    if (sourceAdminId === targetAdminId) {
        showMessage('error', 'Source and target admin cannot be the same.');
        return;
    }

    const totalModels = sourceAdminModels.tests.length + sourceAdminModels.panels.length + sourceAdminModels.packages.length;

    if (totalModels === 0) {
        showMessage('error', 'Source admin has no models to copy.');
        return;
    }

    // Show loading state
    const originalText = this.innerHTML;
    this.innerHTML = '<div class="loading-spinner"></div> Copying Models...';
    this.disabled = true;

    try {
        // Extract IDs from source models
        const testIds = sourceAdminModels.tests.map(test => test._id);
        const panelIds = sourceAdminModels.panels.map(panel => panel._id);
        const packageIds = sourceAdminModels.packages.map(pkg => pkg._id);

        // Log what we're sending
        // console.log('Sending to backend:', {
        //     franchiseeId: targetAdminId,
        //     testIds: testIds,
        //     panelIds: panelIds,
        //     packageIds: packageIds,
        //     unitIds: unitIds,
        //     sampleTypeIds: sampleIds,
        //     categoryIds: categoryIds
        // });

        const response = await fetch("/api/v1/user/assign-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                franchiseeId: targetAdminId,
                testIds: testIds,
                panelIds: panelIds,
                packageIds: packageIds,
                unitIds: unitIds,
                sampleTypeIds: sampleIds,
                categoryIds: categoryIds
            }),
        });

        const result = await response.json();
        // console.log('Backend response:', result);

        if (result.success || response.ok) {
            const totalAssigned = (result.assignedCounts?.tests || 0) +
                (result.assignedCounts?.panels || 0) +
                (result.assignedCounts?.packages || 0) +
                (result.assignedCounts?.categories || 0) +
                (result.assignedCounts?.units || 0) +
                (result.assignedCounts?.sampleTypes || 0);

            showMessage('success', `Successfully assigned ${totalAssigned} items:
                ${result.assignedCounts?.tests || 0} tests, 
                ${result.assignedCounts?.panels || 0} panels, 
                ${result.assignedCounts?.packages || 0} packages,
                ${result.assignedCounts?.categories || 0} categories,
                ${result.assignedCounts?.units || 0} units,
                ${result.assignedCounts?.sampleTypes || 0} samples`);

            // Refresh target admin preview
            targetAdminModels = await getAdminModels(targetAdminId);
            updateModelsPreview(targetAdminModels, 'targetModelsPreview', 'targetTestsCount', 'targetPanelsCount', 'targetPackagesCount', 'targetModelsList');

        } else {
            showMessage('error', 'Copy failed: ' + (result.message || 'Unknown error occurred'));
        }

    } catch (error) {
        console.error('Copy error:', error);
        showMessage('error', 'Network error: ' + error.message);
    }

    // Reset button
    this.innerHTML = originalText;
    this.disabled = false;
});

// Utility function to show messages
function showMessage(type, message) {
    const successEl = document.getElementById("copySuccess");
    const errorEl = document.getElementById("copyError");

    successEl.style.display = "none";
    errorEl.style.display = "none";

    if (type === 'success') {
        successEl.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        successEl.style.display = "flex";
        setTimeout(() => successEl.style.display = "none", 8000);
    } else {
        errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorEl.style.display = "flex";
        setTimeout(() => errorEl.style.display = "none", 10000);
    }
}

// FIXED: Properly initialize with await
async function initializePage() {
    try {
        await loadAdmins();
        await getAllAddON(); // This will now properly set global variables
        console.log('Page initialized successfully');
    } catch (error) {
        console.error('Error initializing page:', error);
        showMessage('error', 'Failed to initialize page. Please refresh.');
    }
}

// Initialize page properly
initializePage();