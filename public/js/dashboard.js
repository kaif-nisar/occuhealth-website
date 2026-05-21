// dashboard.js - Main dashboard functionality

// Initialize dashboard based on user role
const initDashboard = async () => {
    try {
        // Check authentication and role permissions
        const requiredRole = 'user'; // Minimum role needed (will be checked against hierarchy)
        if (!protectRoute(requiredRole)) {
            return;
        }

        // Get user data
        const userData = getUserData();
        const userRole = userData.role;
        
        // Set user info in UI
        document.getElementById('user-name').textContent = userData.name || userData.username;
        document.getElementById('user-role').textContent = userRole;
        
        // Load role-specific sidebar
        await loadSidebar(userRole);
        
        // Load default dashboard content
        await loadDashboardContent();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showErrorMessage('Failed to load dashboard. Please try again.');
    }
};

// Load appropriate sidebar based on user role
const loadSidebar = async (role) => {
    const sidebarContainer = document.getElementById('sidebar-menu');
    
    try {
        // Get menu items from API based on role
        const menuItems = await getMenuItems(role);
        
        // Clear existing menu
        sidebarContainer.innerHTML = '';
        
        // Build menu HTML
        menuItems.forEach(item => {
            const menuItem = document.createElement('li');
            menuItem.className = 'nav-item';
            
            const link = document.createElement('a');
            link.className = 'nav-link';
            link.href = '#';
            link.dataset.page = item.page;
            
            const icon = document.createElement('i');
            icon.className = `fas ${item.icon}`;
            
            const span = document.createElement('span');
            span.textContent = item.title;
            
            link.appendChild(icon);
            link.appendChild(span);
            menuItem.appendChild(link);
            
            sidebarContainer.appendChild(menuItem);
        });
    } catch (error) {
        console.error('Error loading sidebar:', error);
        sidebarContainer.innerHTML = '<li class="nav-item"><a class="nav-link" href="#">Dashboard</a></li>';
    }
};

// Get menu items based on user role
const getMenuItems = async (role) => {
    // Define default menu items by role
    const menuItemsByRole = {
        'superAdmin': [
            { title: 'Dashboard', icon: 'fa-tachometer-alt', page: 'dashboard' },
            { title: 'Tenants', icon: 'fa-building', page: 'tenants' },
            { title: 'Users', icon: 'fa-users', page: 'users' },
            { title: 'Panels', icon: 'fa-table', page: 'panels' },
            { title: 'Packages', icon: 'fa-box', page: 'packages' },
            { title: 'Tests', icon: 'fa-vial', page: 'tests' },
            { title: 'Categories', icon: 'fa-folder', page: 'categories' },
            { title: 'Settings', icon: 'fa-cog', page: 'settings' }
        ],
        'superFranchisee': [
            { title: 'Dashboard', icon: 'fa-tachometer-alt', page: 'dashboard' },
            { title: 'Franchisees', icon: 'fa-users', page: 'franchisees' },
            { title: 'Transactions', icon: 'fa-money-bill', page: 'transactions' },
            { title: 'Reports', icon: 'fa-chart-bar', page: 'reports' },
            { title: 'Settings', icon: 'fa-cog', page: 'settings' }
        ],
        'franchisee': [
            { title: 'Dashboard', icon: 'fa-tachometer-alt', page: 'dashboard' },
            { title: 'Sub-Franchisees', icon: 'fa-users', page: 'sub-franchisees' },
            { title: 'Transactions', icon: 'fa-money-bill', page: 'transactions' },
            { title: 'Reports', icon: 'fa-chart-bar', page: 'reports' },
            { title: 'Settings', icon: 'fa-cog', page: 'settings' }
        ],
        'subFranchisee': [
            { title: 'Dashboard', icon: 'fa-tachometer-alt', page: 'dashboard' },
            { title: 'Transactions', icon: 'fa-money-bill', page: 'transactions' },
            { title: 'Reports', icon: 'fa-chart-bar', page: 'reports' },
            { title: 'Settings', icon: 'fa-cog', page: 'settings' }
        ],
        'user': [
            { title: 'Dashboard', icon: 'fa-tachometer-alt', page: 'dashboard' },
            { title: 'Profile', icon: 'fa-user', page: 'profile' },
            { title: 'Settings', icon: 'fa-cog', page: 'settings' }
        ]
    };
    
    // Try to get menu items from API if available
    try {
        const response = await fetch('/api/menu-items?role=' + role, {
            headers: getAuthHeader()
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn('Could not fetch menu items from API, using defaults:', error);
    }
    
    // Fallback to default menu items
    return menuItemsByRole[role] || menuItemsByRole.user;
};

// Load dashboard content
const loadDashboardContent = async () => {
    const contentContainer = document.getElementById('main-content');
    const user = getUserData();
    
    try {
        // Show loading state
        contentContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        // Get dashboard data from API
        const dashboardData = await apiRequest('/dashboard');
        
        // Create dashboard HTML based on role
        let dashboardHtml = '';
        
        switch(user.role) {
            case 'superAdmin':
                dashboardHtml = createSuperAdminDashboard(dashboardData);
                break;
            case 'superFranchisee':
                dashboardHtml = createSuperFranchiseeDashboard(dashboardData);
                break;
            case 'franchisee':
                dashboardHtml = createFranchiseeDashboard(dashboardData);
                break;
            case 'subFranchisee':
                dashboardHtml = createSubFranchiseeDashboard(dashboardData);
                break;
            default:
                dashboardHtml = createUserDashboard(dashboardData);
        }
        
        // Update content container
        contentContainer.innerHTML = dashboardHtml;
        
        // Initialize any dashboard-specific scripts
        initDashboardScripts(user.role);
        
    } catch (error) {
        console.error('Error loading dashboard content:', error);
        contentContainer.innerHTML = '<div class="alert alert-danger">Failed to load dashboard content. Please try again later.</div>';
    }
};

// Create dashboard HTML based on user role
const createSuperAdminDashboard = (data) => {
    return `
        <div class="row">
            <div class="col-xl-3 col-md-6">
                <div class="card bg-primary text-white mb-4">
                    <div class="card-body">Total Tenants: ${data.totalTenants || 0}</div>
                    <div class="card-footer d-flex align-items-center justify-content-between">
                        <a class="small text-white stretched-link" href="#" data-page="tenants">View Details</a>
                        <div class="small text-white"><i class="fas fa-angle-right"></i></div>
                    </div>
                </div>
            </div>
            <!-- Additional stats cards -->
        </div>
        <!-- More dashboard content -->
    `;
};

// Setup event listeners for dashboard
const setupEventListeners = () => {
    // Sidebar menu navigation
    document.querySelectorAll('#sidebar-menu .nav-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const page = e.currentTarget.dataset.page;
            await loadPage(page);
            
            // Update active menu item
            document.querySelectorAll('#sidebar-menu .nav-link').forEach(item => {
                item.classList.remove('active');
            });
            e.currentTarget.classList.add('active');
        });
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            await authAPI.logout();
            logout(); // Clear local storage and redirect
        } catch (error) {
            console.error('Logout error:', error);
            logout(); // Force logout even if API call fails
        }
    });
};

// Load specific page content
const loadPage = async (pageName) => {
    const contentContainer = document.getElementById('main-content');
    
    // Show loading state
    contentContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    try {
        // Different loading strategies based on page type
        switch(pageName) {
            case 'dashboard':
                await loadDashboardContent();
                break;
            case 'panels':
                await loadPanelsPage();
                break;
            case 'tests':
                await loadTestsPage();
                break;
            case 'packages':
                await loadPackagesPage();
                break;
            case 'users':
            case 'franchisees':
            case 'sub-franchisees':
                await loadUsersPage(pageName);
                break;
            case 'transactions':
                await loadTransactionsPage();
                break;
            default:
                await loadGenericPage(pageName);
        }
    } catch (error) {
        console.error(`Error loading ${pageName} page:`, error);
        contentContainer.innerHTML = `<div class="alert alert-danger">Failed to load ${pageName} page. Please try again later.</div>`;
    }
};

// Show error message
const showErrorMessage = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
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