// Main Dashboard JavaScript

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar on mobile
    const toggleBtn = document.querySelector('.toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if(toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Navigation menu functionality
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all menu items
            menuItems.forEach(menuItem => menuItem.classList.remove('active'));
            
            // Add active class to clicked menu item
            this.classList.add('active');
            
            // Hide all sections
            sections.forEach(section => section.style.display = 'none');
            
            // Show selected section
            const targetSection = this.getAttribute('data-section');
            document.querySelector('.' + targetSection).style.display = 'block';
        });
    });
    
    // Initialize Charts
    initializeCharts();
    
    // Settings tabs functionality
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsContents = document.querySelectorAll('.settings-content');
    
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            settingsTabs.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all content sections
            settingsContents.forEach(content => content.style.display = 'none');
            
            // Show selected content section
            const targetContent = this.getAttribute('data-tab');
            document.querySelector('.' + targetContent).style.display = 'block';
        });
    });
    
    // Modal functionality
    const modalTriggers = document.querySelectorAll('[data-modal]');
    const modalOverlay = document.querySelector('.modal-overlay');
    const closeModalBtns = document.querySelectorAll('.modal-close, .btn-secondary');
    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            modalOverlay.classList.add('active');
        });
    });
    
    if(closeModalBtns) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                modalOverlay.classList.remove('active');
            });
        });
    }
    
    // Close modal when clicking outside
    if(modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if(e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }
    
    // Copy API Key functionality
    const copyBtn = document.querySelector('.copy-btn');
    if(copyBtn) {
        copyBtn.addEventListener('click', function() {
            const apiKey = document.querySelector('.api-key').textContent;
            navigator.clipboard.writeText(apiKey)
                .then(() => {
                    showToast('Success', 'API key copied to clipboard', 'success');
                })
                .catch(err => {
                    showToast('Error', 'Failed to copy API key', 'error');
                });
        });
    }
});

// Initialize all charts for the dashboard
function initializeCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart');
    if(revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue',
                    data: [12500, 19200, 16800, 24100, 23400, 28600],
                    borderColor: '#4361ee',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '$' + context.raw.toLocaleString();
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Model Usage Chart
    const modelUsageCtx = document.getElementById('modelUsageChart');
    if(modelUsageCtx) {
        new Chart(modelUsageCtx, {
            type: 'bar',
            data: {
                labels: ['1-Layer', '2-Layer', '3-Layer', '4-Layer'],
                datasets: [{
                    label: 'Usage Count',
                    data: [65, 42, 28, 15],
                    backgroundColor: [
                        'rgba(76, 201, 240, 0.6)',
                        'rgba(67, 97, 238, 0.6)',
                        'rgba(63, 55, 201, 0.6)',
                        'rgba(247, 37, 133, 0.6)'
                    ],
                    borderColor: [
                        'rgba(76, 201, 240, 1)',
                        'rgba(67, 97, 238, 1)',
                        'rgba(63, 55, 201, 1)',
                        'rgba(247, 37, 133, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Franchisee Performance Chart
    const franchiseeCtx = document.getElementById('franchiseeChart');
    if(franchiseeCtx) {
        new Chart(franchiseeCtx, {
            type: 'radar',
            data: {
                labels: ['Revenue', 'Client Acquisition', 'Model Usage', 'Test Packages', 'Support Quality', 'Growth'],
                datasets: [{
                    label: 'Franchisee A',
                    data: [85, 72, 78, 65, 92, 76],
                    backgroundColor: 'rgba(76, 201, 240, 0.2)',
                    borderColor: 'rgba(76, 201, 240, 1)',
                    pointBackgroundColor: 'rgba(76, 201, 240, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(76, 201, 240, 1)'
                }, {
                    label: 'Franchisee B',
                    data: [92, 65, 81, 78, 70, 88],
                    backgroundColor: 'rgba(67, 97, 238, 0.2)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    pointBackgroundColor: 'rgba(67, 97, 238, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(67, 97, 238, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    line: {
                        tension: 0.1
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                }
            }
        });
    }
    
    // Client Growth Chart
    const clientGrowthCtx = document.getElementById('clientGrowthChart');
    if(clientGrowthCtx) {
        new Chart(clientGrowthCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'New Clients',
                    data: [8, 12, 15, 22, 18, 25],
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Recurring Clients',
                    data: [20, 24, 30, 38, 45, 50],
                    borderColor: '#4cc9f0',
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Toast notification function
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <div class="toast-close">
            <i class="fas fa-times"></i>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Activate the toast
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);
    
    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Handle form submissions
function handleFormSubmit(formId, successMessage) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Show loader
        const loaderOverlay = document.querySelector('.loader-overlay');
        if (loaderOverlay) loaderOverlay.classList.add('active');
        
        // Simulate API call delay
        setTimeout(() => {
            // Hide loader
            if (loaderOverlay) loaderOverlay.classList.remove('active');
            
            // Show success message
            showToast('Success', successMessage, 'success');
            
            // Close any open modals
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay) modalOverlay.classList.remove('active');
            
            // Reset form
            form.reset();
        }, 1000);
    });
}

// Initialize Model Management Functionality
function initModelManagement() {
    // Add Model Form Tabs
    const formTabs = document.querySelectorAll('.form-tab');
    const formContents = document.querySelectorAll('.form-tab-content');
    
    formTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            formTabs.forEach(t => t.classList.remove('active'));
            formContents.forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const targetContent = this.getAttribute('data-tab');
            document.querySelector(`#${targetContent}`).classList.add('active');
        });
    });
    
    // Handle model form submission
    handleFormSubmit('addModelForm', 'Model added successfully');
}

// Initialize Franchisee Management
function initFranchiseeManagement() {
    handleFormSubmit('addFranchiseeForm', 'Franchisee added successfully');
}

// Initialize Settings Panel
function initSettings() {
    handleFormSubmit('profileSettingsForm', 'Profile settings updated');
    handleFormSubmit('securitySettingsForm', 'Security settings updated');
    handleFormSubmit('apiSettingsForm', 'API settings updated');
}

// Call initialization functions when needed sections are active
function initActiveSections() {
    initModelManagement();
    initFranchiseeManagement();
    initSettings();
}

// Call this after DOMContentLoaded
setTimeout(initActiveSections, 100);