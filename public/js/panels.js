// panels.js - Panel management functionality

// Load panels page
const loadPanelsPage = async () => {
    const contentContainer = document.getElementById('main-content');
    
    try {
        // Get all panels
        const panels = await panelAPI.getAllPanels();
        
        // Create page HTML
        const pageHtml = `
            <div class="container-fluid px-4">
                <h1 class="mt-4">Panel Management</h1>
                <ol class="breadcrumb mb-4">
                    <li class="breadcrumb-item"><a href="#" data-page="dashboard">Dashboard</a></li>
                    <li class="breadcrumb-item active">Panels</li>
                </ol>
                
                <div class="card mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-table me-1"></i>
                            All Panels
                        </div>
                        <button type="button" class="btn btn-primary" id="add-panel-btn">
                            <i class="fas fa-plus"></i> Add New Panel
                        </button>
                    </div>
                    <div class="card-body">
                        <table id="panels-table" class="table table-striped table-bordered">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="panels-table-body">
                                ${renderPanelsTableRows(panels)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Add Panel Modal -->
            <div class="modal fade" id="panel-modal" tabindex="-1" aria-labelledby="panel-modal-label" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="panel-modal-label">Add New Panel</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="panel-form">
                                <input type="hidden" id="panel-id">
                                <div class="mb-3">
                                    <label for="panel-name" class="form-label">Panel Name</label>
                                    <input type="text" class="form-control" id="panel-name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="panel-description" class="form-label">Description</label>
                                    <textarea class="form-control" id="panel-description" rows="3"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label for="panel-status" class="form-label">Status</label>
                                    <select class="form-select" id="panel-status">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="panel-order" class="form-label">Display Order</label>
                                    <input type="number" class="form-control" id="panel-order" min="1">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-panel-btn">Save Panel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Update content container
        contentContainer.innerHTML = pageHtml;
        
        // Initialize panel page scripts
        initPanelPageScripts();
        
    } catch (error) {
        console.error('Error loading panels page:', error);
        contentContainer.innerHTML = '<div class="alert alert-danger">Failed to load panels. Please try again later.</div>';
    }
};

// Render table rows for panels
const renderPanelsTableRows = (panels) => {
    if (!panels || panels.length === 0) {
        return '<tr><td colspan="5" class="text-center">No panels found</td></tr>';
    }
    
    return panels.map(panel => `
        <tr data-id="${panel._id}">
            <td>${panel.order || '-'}</td>
            <td>${panel.name}</td>
            <td>${panel.description || '-'}</td>
            <td>
                <span class="badge bg-${panel.status === 'active' ? 'success' : 'danger'}">
                    ${panel.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary edit-panel-btn" data-id="${panel._id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-panel-btn" data-id="${panel._id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
};

// Initialize panel page scripts
const initPanelPageScripts = () => {
    // Add panel button
    document.getElementById('add-panel-btn').addEventListener('click', () => {
        // Reset form
        document.getElementById('panel-form').reset();
        document.getElementById('panel-id').value = '';
        document.getElementById('panel-modal-label').textContent = 'Add New Panel';
        
        // Get highest order number and increment by 1
        const rows = document.querySelectorAll('#panels-table-body tr');
        let maxOrder = 0;
        rows.forEach(row => {
            const orderCell = row.cells[0].textContent;
            if (orderCell !== '-') {
                maxOrder = Math.max(maxOrder, parseInt(orderCell));
            }
        });
        
        document.getElementById('panel-order').value = maxOrder + 1;
        
        // Show modal
        const panelModal = new bootstrap.Modal(document.getElementById('panel-modal'));
        panelModal.show();
    });
    
    // Edit panel buttons
    document.querySelectorAll('.edit-panel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const panelId = btn.dataset.id;
            
            try {
                const panel = await panelAPI.getPanelById(panelId);
                
                // Populate form
                document.getElementById('panel-id').value = panel._id;
                document.getElementById('panel-name').value = panel.name;
                document.getElementById('panel-description').value = panel.description || '';
                document.getElementById('panel-status').value = panel.status;
                document.getElementById('panel-order').value = panel.order || '';
                
                // Update modal title
                document.getElementById('panel-modal-label').textContent = 'Edit Panel';
                
                // Show modal
                const panelModal = new bootstrap.Modal(document.getElementById('panel-modal'));
                panelModal.show();
                
            } catch (error) {
                console.error('Error fetching panel details:', error);
                showErrorMessage('Failed to load panel details. Please try again.');
            }
        });
    });
    
    // Delete panel buttons
    document.querySelectorAll('.delete-panel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const panelId = btn.dataset.id;
            
            if (confirm('Are you sure you want to delete this panel? This action cannot be undone.')) {
                try {
                    await apiRequest(`/panels/${panelId}`, 'DELETE');
                    
                    // Remove row from table
                    const row = document.querySelector(`tr[data-id="${panelId}"]`);
                    if (row) {
                        row.remove();
                    }
                    
                    showSuccessMessage('Panel deleted successfully.');
                    
                } catch (error) {
                    console.error('Error deleting panel:', error);
                    showErrorMessage('Failed to delete panel. Please try again.');
                }
            }
        });
    });
    
    // Save panel button
    document.getElementById('save-panel-btn').addEventListener('click', async () => {
        // Validate form
        const form = document.getElementById('panel-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const panelId = document.getElementById('panel-id').value;
        const panelData = {
            name: document.getElementById('panel-name').value,
            description: document.getElementById('panel-description').value,
            status: document.getElementById('panel-status').value,
            order: parseInt(document.getElementById('panel-order').value) || 0
        };
        
        try {
            let panel;
            
            if (panelId) {
                // Update existing panel
                panel = await panelAPI.updatePanel(panelId, panelData);
                showSuccessMessage('Panel updated successfully.');
            } else {
                // Create new panel
                panel = await panelAPI.createPanel(panelData);
                showSuccessMessage('Panel created successfully.');
            }
            
            // Close modal
            const panelModal = bootstrap.Modal.getInstance(document.getElementById('panel-modal'));
            panelModal.hide();
            
            // Refresh panels page
            await loadPanelsPage();
            
        } catch (error) {
            console.error('Error saving panel:', error);
            showErrorMessage('Failed to save panel. Please try again.');
        }
    });
    
    // Make panels table sortable
    if (typeof Sortable !== 'undefined') {
        const tbody = document.getElementById('panels-table-body');
        Sortable.create(tbody, {
            animation: 150,
            onEnd: async function(evt) {
                const items = document.querySelectorAll('#panels-table-body tr');
                const orderData = Array.from(items).map((item, index) => {
                    return {
                        id: item.dataset.id,
                        order: index + 1
                    };
                });
                
                try {
                    await panelAPI.updatePanelOrder({ panels: orderData });
                    
                    // Update order numbers in the table
                    items.forEach((item, index) => {
                        item.cells[0].textContent = index + 1;
                    });
                    
                    showSuccessMessage('Panel order updated successfully.');
                } catch (error) {
                    console.error('Error updating panel order:', error);
                    showErrorMessage('Failed to update panel order. Please try again.');
                    
                    // Refresh to restore original order
                    await loadPanelsPage();
                }
            }
        });
    }
};

// Show success message
const showSuccessMessage = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.getElementById('alerts-container').appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
};