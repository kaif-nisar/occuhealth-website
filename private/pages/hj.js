<div class="sidebar">
<div class="sidebar-header">
    <div class="logo">
        <i class="fas fa-cubes"></i>
        <span>ModelStack</span>
    </div>
</div>
<div class="sidebar-menu">
    <div class="menu-item active" data-section="dashboard">
        <i class="fas fa-tachometer-alt"></i>
        <span>Dashboard</span>
    </div>
    <div class="menu-item" data-section="model-management">
        <i class="fas fa-layer-group"></i>
        <span>Model Management</span>
    </div>
    <div class="menu-item" data-section="client-management">
        <i class="fas fa-users"></i>
        <span>Client Management</span>
    </div>
    <div class="menu-item" data-section="franchisee">
        <i class="fas fa-store"></i>
        <span>Franchisee Module</span>
    </div>
    <div class="menu-item" data-section="reports">
        <i class="fas fa-chart-bar"></i>
        <span>Reports & Analytics</span>
    </div>
    <div class="menu-item" data-section="settings">
        <i class="fas fa-cog"></i>
        <span>Settings</span>
    </div>
    <div class="menu-item">
        <i class="fas fa-question-circle"></i>
        <span>Help & Support</span>
    </div>
</div>
</div>

<!-- Main Content -->
<div class="main-content">
<div class="header">
    <div class="toggle-sidebar">
        <i class="fas fa-bars"></i>
    </div>
    <div class="search-bar">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Search...">
    </div>
    <div class="user-menu">
        <div class="notification">
            <i class="fas fa-bell"></i>
            <span class="badge">3</span>
        </div>
        <div class="messages">
            <i class="fas fa-envelope"></i>
            <span class="badge">5</span>
        </div>
        <div class="user-profile">
            <div class="user-avatar">AD</div>
            <span>Admin</span>
        </div>
    </div>
</div>

<!-- Dashboard Section -->
<div class="content dashboard-section">
    <h1 class="page-title">Dashboard</h1>
    
    <div class="stats-container">
        <div class="stat-card">
            <div class="stat-icon clients-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">2,845</div>
                <div class="stat-label">Total Clients</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon bookings-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">1,257</div>
                <div class="stat-label">Active Bookings</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon models-icon">
                <i class="fas fa-layer-group"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">73</div>
                <div class="stat-label">Active Models</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon revenue-icon">
                <i class="fas fa-dollar-sign"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">$247,825</div>
                <div class="stat-label">Total Revenue</div>
            </div>
        </div>
    </div>
    
    <div class="charts-container">
        <div class="chart-card">
            <div class="chart-header">
                <div class="chart-title">Revenue Overview</div>
                <div class="chart-actions">
                    <button class="chart-btn active">Monthly</button>
                    <button class="chart-btn">Quarterly</button>
                    <button class="chart-btn">Yearly</button>
                </div>
            </div>
            <div class="chart-container">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <div class="chart-title">Model Performance</div>
                <div class="chart-actions">
                    <button class="chart-btn active">All Layers</button>
                    <button class="chart-btn">By Layer</button>
                </div>
            </div>
            <div class="chart-container">
                <canvas id="modelChart"></canvas>
            </div>
        </div>
    </div>
    
    <div class="tables-container">
        <div class="table-card">
            <div class="table-header">
                <div class="table-title">Recent Clients</div>
                <div class="table-actions">
                    <a href="#">View All <i class="fas fa-arrow-right"></i></a>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Models</th>
                        <th>Status</th>
                        <th>Integration</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="table-avatar">TS</div>
                                <div class="user-info">
                                    <div class="user-name">TechSolutions Inc.</div>
                                    <div class="user-email">tech@example.com</div>
                                </div>
                            </div>
                        </td>
                        <td>4</td>
                        <td><span class="status status-active">Active</span></td>
                        <td>API</td>
                        <td>
                            <button class="action-btn"><i class="fas fa-eye"></i></button>
                            <button class="action-btn"><i class="fas fa-edit"></i></button>
                            <button class="action-btn"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="table-avatar">GL</div>
                                <div class="user-info">
                                    <div class="user-name">GlobalLogic</div>
                                    <div class="user-email">info@globallogic.com</div>
                                </div>
                            </div>
                        </td>
                        <td>2</td>
                        <td><span class="status status-active">Active</span></td>
                        <td>Embedded</td>
                        <td>
                            <button class="action-btn"><i class="fas fa-eye"></i></button>
                            <button class="action-btn"><i class="fas fa-edit"></i></button>
                            <button class="action-btn"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="table-avatar">DT</div>
                                <div class="user-info">
                                    <div class="user-name">DataTrack</div>
                                    <div class="user-email">support@datatrack.org</div>
                                </div>
                            </div>
                        </td>
                        <td>1</td>
                        <td><span class="status status-pending">Pending</span></td>
                        <td>None</td>
                        <td>
                            <button class="action-btn"><i class="fas fa-eye"></i></button>
                            <button class="action-btn"><i class="fas fa-edit"></i></button>
                            <button class="action-btn"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="table-avatar">IS</div>
                                <div class="user-info">
                                    <div class="user-name">InnoSoft</div>
                                    <div class="user-email">hello@innosoft.io</div>
                                </div>
                            </div>
                        </td>
                        <td>3</td>
                        <td><span class="status status-inactive">Inactive</span></td>
                        <td>API</td>
                        <td>
                            <button class="action-btn"><i class="fas fa-eye"></i></button>
                            <button class="action-btn"><i class="fas fa-edit"></i></button>
                            <button class="action-btn"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="table-card">
            <div class="table-header">
                <div class="table-title">Top Performing Models</div>
                <div class="table-actions">
                    <a href="#">View All <i class="fas fa-arrow-right"></i></a>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Layer</th>
                        <th>Clients</th>
                        <th>Revenue</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Predictive Analysis Pro</td>
                        <td>4-Layer</td>
                        <td>48</td>
                        <td>$58,240</td>
                        <td>98%</td>
                    </tr>
                    <tr>
                        <td>DataFlow Enterprise</td>
                        <td>3-Layer</td>
                        <td>36</td>
                        <td>$42,780</td>
                        <td>95%</td>
                    </tr>
                    <tr>
                        <td>Neural Network Plus</td>
                        <td>4-Layer</td>
                        <td>29</td>
                        <td>$38,550</td>
                        <td>93%</td>
                    </tr>
                    <tr>
                        <td>Cognitive Analytics</td>
                        <td>2-Layer</td>
                        <td>64</td>
                        <td>$32,120</td>
                        <td>91%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <div class="notifications-section">
        <div class="notification-header">
            <div class="notification-title">Recent Updates</div>
            <div class="notification-actions">
                <a href="#">View All</a>
            </div>
        </div>
        <div class="notification-item">
            <div class="notification-icon icon-info">
                <i class="fas fa-info"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">New client <strong>CloudTech Solutions</strong> has registered.</div>
                <div class="notification-time">2 hours ago</div>
            </div>
        </div>
        <div class="notification-item">
            <div class="notification-icon icon-success">
                <i class="fas fa-check"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">Model <strong>Predictive Analysis Pro</strong> has been updated to v2.3</div>
                <div class="notification-time">Yesterday</div>
            </div>
        </div>
        <div class="notification-item">
            <div class="notification-icon icon-warning">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">System maintenance scheduled for April 5, 2025, 2:00 AM - 4:00 AM</div>
                <div class="notification-time">2 days ago</div>
            </div>
        </div>
    </div>
</div>

<!-- Model Management Section -->
<div class="content model-management-section">
    <h1 class="page-title">Model Management</h1>
    
    <div class="model-cards">
        <div class="model-card">
            <div class="model-header">
                <div class="model-name">Predictive Analysis Pro</div>
                <div class="model-layer">4-Layer</div>
            </div>
            <div class="model-content">
                <div class="model-detail">
                    <div class="detail-label">Price:</div>
                    <div class="detail-value">$1,200 / month</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Active Clients:</div>
                    <div class="detail-value">48</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Accuracy:</div>
                    <div class="detail-value">98%</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">March 28, 2025</div>
                </div>
            </div>
            <div class="model-actions">
                <button class="model-btn btn-edit">Edit Model</button>
                <button class="model-btn btn-delete">Delete</button>
            </div>
        </div>
        
        <div class="model-card">
            <div class="model-header">
                <div class="model-name">DataFlow Enterprise</div>
                <div class="model-layer">3-Layer</div>
            </div>
            <div class="model-content">
                <div class="model-detail">
                    <div class="detail-label">Price:</div>
                    <div class="detail-value">$850 / month</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Active Clients:</div>
                    <div class="detail-value">36</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Accuracy:</div>
                    <div class="detail-value">95%</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">March 15, 2025</div>
                </div>
            </div>
            <div class="model-actions">
                <button class="model-btn btn-edit">Edit Model</button>
                <button class="model-btn btn-delete">Delete</button>
            </div>
        </div>
        
        <div class="model-card">
            <div class="model-header">
                <div class="model-name">Neural Network Plus</div>
                <div class="model-layer">4-Layer</div>
            </div>
            <div class="model-content">
                <div class="model-detail">
                    <div class="detail-label">Price:</div>
                    <div class="detail-value">$1,450 / month</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Active Clients:</div>
                    <div class="detail-value">29</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Accuracy:</div>
                    <div class="detail-value">93%</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">March 22, 2025</div>
                </div>
            </div>
            <div class="model-actions">
                <button class="model-btn btn-edit">Edit Model</button>
                <button class="model-btn btn-delete">Delete</button>
            </div>
        </div>
        
        <div class="model-card">
            <div class="model-header">
                <div class="model-name">Cognitive Analytics</div>
                <div class="model-layer">2-Layer</div>
            </div>
            <div class="model-content">
                <div class="model-detail">
                    <div class="detail-label">Price:</div>
                    <div class="detail-value">$650 / month</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Active Clients:</div>
                    <div class="detail-value">64</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Accuracy:</div>
                    <div class="detail-value">91%</div>
                </div>
                <div class="model-detail">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">April 1, 2025</div>
                </div>
            </div>
            <div class="model-actions">
                <button class="model-btn btn-edit">Edit Model</button>
                <button class="model-btn btn-delete">Delete</button>
            </div>
        </div>
    </div>
    
    <div class="add-model-btn">
        <i class="fas fa-plus"></i>
    </div>
</div>

<!-- Client Management Section -->
<div class="content client-management-section">
    <h1 class="page-title">Client Management</h1>
    
    <div class="client-list-header">
        <div class="client-filters">
            <button class="filter-btn active">All Clients</button>
            <button class="filter-btn">Active</button>
            <button class="filter-btn">Pending</button>
            <button class="filter-btn">Inactive</button>
        </div>
        <button class="model-btn btn-edit">Add New Client</button>
    </div>
    
    <div class="client-list">
        <table class="client-table">
            <thead>
                <tr>
                    <th>Client Name</th>
                    <th>Contact</th>
                    <th>Models</th>
                    <th>Status</th>
                    <th>Integration</th>
                    <th>Join Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="table-avatar">TS</div>
                            <div class="user-info">
                                <div class="user-name">TechSolutions Inc.</div>
                                <div class="user-email">tech@example.com</div>
                            </div>
                        </div>
                    </td>
                    <td>John Roberts</td>
                    <td>4</td>
                    <td><span class="status status-active">Active</span></td>
                    <td><span class="integration-badge badge-api">API</span></td>
                    <td>Jan 15, 2025</td>
                    <td>
                        <button class="action-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn"><i class="fas fa-edit"></i></button>
                        <button class="action-btn"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="table-avatar">GL</div>
                            <div class="user-info">
                                <div class="user-name">GlobalLogic</div>
                                <div class="user-email">info@globallogic.com</div>
                            </div>
                        </div>
                    </td>
                    <td>Sarah Chen</td>
                    <td>2</td>
                    <td><span class="status status-active">Active</span></td>
                    <td><span class="integration-badge badge-embedded">Embedded</span></td>
                    <td>Feb 3, 2025</td>
                    <td>
                        <button class="action-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn"><i class="fas fa-edit"></i></button>
                        <button class="action-btn"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="table-avatar">DT</div>
                            <div class="user-info">
                                <div class="user-name">DataTrack</div>
                                <div class="user-email">support@datatrack.org</div>
                            </div>
                        </div>
                    </td>
                    <td>Michael Lee</td>
                    <td>1</td>
                    <td><span class="status status-pending">Pending</span></td>
                    <td><span class="integration-badge badge-none">None</span></td>
                    <td>Mar 18, 2025</td>
                    <td>
                        <button class="action-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn"><i class="fas fa-edit"></i></button>
                        <button class="action-btn"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="table-avatar">IS</div>
                            <div class="user-info">
                                <div class="user-name">InnoSoft</div>
                                <div class="user-email">hello@innosoft.io</div>
                            </div>
                        </div>
                    </td>
                    <td>Emily Johnson</td>
                    <td>3</td>
                    <td><span class="status status-inactive">Inactive</span></td>
                    <td><span class="integration-badge badge-api">API</span></td>
                    <td>Dec 5, 2024</td>
                    <td>
                        <button class="action-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn"><i class="fas fa-edit"></i></button>
                        <button class="action-btn"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="table-avatar">FT</div>
                            <div class="user-info">
                                <div class="user-name">FinTech Innovations</div>
                                <div class="user-email">contact@fintech.com</div>
                            </div>
                        </div>
                    </td>
                    <td>Robert Martinez</td>
                    <td>2</td>
                    <td><span class="status status-active">Active</span></td>
                    <td><span class="integration-badge badge-embedded">Embedded</span></td>
                    <td>Mar 10, 2025</td>
                    <td>
                        <button class="action-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn"><i class="fas fa-edit"></i></button>
                        <button class="action-btn"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<!-- Franchisee Module Section -->
<div class="content franchisee-section">
    <h1 class="page-title">Franchisee Module</h1>
    
    <div class="franchisee-stats">
        <div class="franchisee-card">
            <div class="franchisee-header">
                <div class="franchisee-avatar">NY</div>
                <div class="franchisee-info">
                    <div class="franchisee-name">New York Office</div>
                    <div class="franchisee-location">New York, USA</div>
                </div>
            </div>
            <div class="franchisee-stats-row">
                <div class="franchisee-stat">
                    <div class="stat-number">145</div>
                    <div class="stat-name">Clients</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$58.5K</div>
                    <div class="stat-name">Revenue</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$11.7K</div>
                    <div class="stat-name">Commission</div>
                </div>
            </div>
        </div>
        
        <div class="franchisee-card">
            <div class="franchisee-header">
                <div class="franchisee-avatar">SF</div>
                <div class="franchisee-info">
                    <div class="franchisee-name">San Francisco Office</div>
                    <div class="franchisee-location">California, USA</div>
                </div>
            </div>
            <div class="franchisee-stats-row">
                <div class="franchisee-stat">
                    <div class="stat-number">98</div>
                    <div class="stat-name">Clients</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$42.3K</div>
                    <div class="stat-name">Revenue</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$8.4K</div>
                    <div class="stat-name">Commission</div>
                </div>
            </div>
        </div>
        
        <div class="franchisee-card">
            <div class="franchisee-header">
                <div class="franchisee-avatar">LN</div>
                <div class="franchisee-info">
                    <div class="franchisee-name">London Office</div>
                    <div class="franchisee-location">London, UK</div>
                </div>
            </div>
            <div class="franchisee-stats-row">
                <div class="franchisee-stat">
                    <div class="stat-number">84</div>
                    <div class="stat-name">Clients</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$37.8K</div>
                    <div class="stat-name">Revenue</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$7.5K</div>
                    <div class="stat-name">Commission</div>
                </div>
            </div>
        </div>
        
        <div class="franchisee-card">
            <div class="franchisee-header">
                <div class="franchisee-avatar">SG</div>
                <div class="franchisee-info">
                    <div class="franchisee-name">Singapore Office</div>
                    <div class="franchisee-location">Singapore</div>
                </div>
            </div>
            <div class="franchisee-stats-row">
                <div class="franchisee-stat">
                    <div class="stat-number">63</div>
                    <div class="stat-name">Clients</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$29.1K</div>
                    <div class="stat-name">Revenue</div>
                </div>
                <div class="franchisee-stat">
                    <div class="stat-number">$5.8K</div>