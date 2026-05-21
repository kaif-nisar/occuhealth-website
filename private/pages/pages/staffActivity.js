// Enhanced Admin Activity Monitor JavaScript with Booking Cancellation Support
(function () {
    "use strict";

    // Configuration
    const API_CONFIG = {
        baseURL: "/api/v1/user",
        endpoints: {
            staff: "/tenant-staff",
            activities: "/tenant-staff/activities",
        },
        headers: {
            "Content-Type": "application/json",
        },
    };

    // API Helper Functions
    async function apiRequest(endpoint, options = {}) {
        try {
            const url = `${API_CONFIG.baseURL}${endpoint}`;
            const response = await fetch(url, {
                headers: API_CONFIG.headers,
                ...options,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("API Request failed:", error);
            throw error;
        }
    }

    async function fetchStaffData() {
        try {
            const data = await apiRequest(API_CONFIG.endpoints.staff);
            console.log("Fetched staff data:", data);
            return data;
        } catch (error) {
            console.error("Failed to fetch staff data:", error);
            return { data: [], success: false };
        }
    }

    // Enhanced activity icon function with booking cancellation
    function getActivityIcon(details, activityType, reference) {
        const iconMap = {
            'test_create': {
                'Test': 'fas fa-flask',
                'unit': 'fas fa-cube',
                'panel': 'fas fa-clipboard-list',
                'package': 'fas fa-box',
                'sample': 'fas fa-vial',
                'category': 'fas fa-tags'
            },
            'panel_create': 'fas fa-clipboard-list',
            'package_create': 'fas fa-box',
            'user_create': 'fas fa-user-plus',
            'booking': 'fas fa-calendar-plus',
            'booking_cancellation': 'fas fa-calendar-times', // New icon for booking cancellation
            'booking_updated': 'fas fa-calendar-check',
            'payment': 'fas fa-credit-card',
            'user_management': 'fas fa-users-cog',
            'login': 'fas fa-sign-in-alt',
            'logout': 'fas fa-sign-out-alt',
            'report_generate': 'fas fa-chart-bar',
            'data_export': 'fas fa-download',
            'subscription_renewal': 'fas fa-redo-alt',
            'subscription_expiry': 'fas fa-exclamation-triangle',
            'referral_commission': 'fas fa-handshake',
            'withdrawal_request': 'fas fa-money-bill-wave',
            'update': 'fas fa-edit',
            'delete': 'fas fa-trash',
            'other': 'fas fa-activity',
            'expiry_warning_sent': 'fas fa-exclamation-circle'
        };

        if (activityType === 'test_create' && reference?.model) {
            return iconMap[activityType][reference.model] || 'fas fa-plus-circle';
        }

        return iconMap[activityType] || 'fas fa-info-circle';
    }

    // Enhanced activity type display name with booking cancellation
    function getActivityTypeDisplayName(activityType, reference) {
        const typeMap = {
            'test_create': {
                'Test': 'Test Created',
                'unit': 'Unit Created',
                'panel': 'Panel Created',
                'package': 'Package Created',
                'sample': 'Sample Created',
                'category': 'Category Created'
            },
            'panel_create': 'Panel Created',
            'package_create': 'Package Created',
            'user_create': 'User Created',
            'booking': 'Booking Created',
            'booking_cancellation': 'Booking Cancelled', // New display name
            'booking_updated': 'Booking Updated',
            'payment': 'Payment Processing',
            'user_management': 'User Management',
            'login': 'System Login',
            'logout': 'System Logout',
            'report_generate': 'Report Generated',
            'data_export': 'Data Exported',
            'subscription_renewal': 'Subscription Renewed',
            'subscription_expiry': 'Subscription Expired',
            'referral_commission': 'Referral Commission',
            'withdrawal_request': 'Withdrawal Request',
            'update': 'Data Updated',
            'delete': 'Data Deleted',
            'other': 'Other Activity',
            'expiry_warning_sent': 'Expiry Warning Sent'
        };

        if (activityType === 'test_create' && reference?.model) {
            return typeMap[activityType][reference.model] || 'Item Created';
        }

        return typeMap[activityType] || activityType.replace('_', ' ').toUpperCase();
    }

    // MAIN ENHANCED ACTIVITY DESCRIPTION FUNCTION
    function getActivityDescription(activity) {
        const { details, reference } = activity;
        let html = '<div class="activity-detail-grid">';

        // Function to format value
        function formatValue(value) {
            if (value === null || value === undefined) return 'N/A';
            if (typeof value === 'object') {
                if (value.$date) {
                    return new Date(value.$date).toLocaleDateString();
                } else if (value.$oid) {
                    return value.$oid;
                } else {
                    return JSON.stringify(value);
                }
            }
            return value;
        }

        // Loop through details
        for (const [key, value] of Object.entries(details)) {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            html += `
                <div class="detail-item">
                    <span class="detail-label">${label}:</span>
                    <span class="detail-value">${formatValue(value)}</span>
                </div>`;
        }

        // Add reference if exists
        if (reference) {
            if (reference.model) {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">Reference Model:</span>
                        <span class="detail-value">${reference.model}</span>
                    </div>`;
            }
            if (reference.id) {
                const id = typeof reference.id === 'object' && reference.id.$oid ? reference.id.$oid : reference.id;
                html += `
                    <div class="detail-item">
                        <span class="detail-label">Reference ID:</span>
                        <span class="detail-value">${id}</span>
                    </div>`;
            }
        }

        html += '</div>';
        return html;
    }

    // Utility Functions
    function formatDateTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffTime / (1000 * 60));

        if (diffMinutes < 60) {
            return `${diffMinutes} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    function getRelativeTime(timestamp) {
        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }

    // Main Functions
    async function loadStaffList() {
        const staffListContainer = document.getElementById('staffList');

        if (!staffListContainer) return;

        staffListContainer.innerHTML = '<div class="loading">Loading staff...</div>';

        try {
            const staffData = await fetchStaffData();

            if (!staffData.success || !staffData.data || staffData.data.length === 0) {
                staffListContainer.innerHTML = '<div class="activity-empty">No staff members found.</div>';
                return;
            }

            staffListContainer.innerHTML = staffData.data
                .map(staff => `
                    <div class="staff-member" data-id="${staff._id}">
                        <div class="staff-name">${staff.fullName}</div>
                        <div class="staff-info">
                            <i class="fas fa-user"></i>
                            ${staff.username}
                        </div>
                        <div class="staff-info">
                            <i class="fas fa-envelope"></i>
                            ${staff.email}
                        </div>
                        <div class="staff-info">
                            <i class="fas fa-phone"></i>
                            ${staff.phoneNo}
                        </div>
                        <div class="staff-info">
                            <i class="fas fa-clock"></i>
                            Last Login: ${staff.lastLogin ? formatDateTime(staff.lastLogin) : 'Never'}
                        </div>
                        <div class="staff-info">
                            <i class="fas fa-chart-bar"></i>
                            Activities: ${staff.activities ? staff.activities.length : 0}
                        </div>
                        <div class="staff-status ${staff.isActive ? 'status-active' : 'status-inactive'}">
                            ${staff.isActive ? '🟢 Active' : '🔴 Inactive'}
                        </div>
                    </div>
                `).join('');

            // Add click event listener
            staffListContainer.addEventListener("click", function (e) {
                const item = e.target.closest(".staff-member");
                if (item && item.dataset.id) {
                    const staffId = item.dataset.id;
                    window.location.href = `admin.html?page=editStaff&staffId=${staffId}`;
                }
            });

        } catch (error) {
            console.error("Error loading staff list:", error);
            staffListContainer.innerHTML = '<div class="activity-empty">Error loading staff members. Please try again.</div>';
        }
    }

    // Enhanced loadActivities function
    async function loadActivities() {
        const activitiesContainer = document.getElementById("activitiesList");

        if (!activitiesContainer) return;

        activitiesContainer.innerHTML = '<div class="loading">Loading activities...</div>';

        try {
            const staffData = await fetchStaffData();

            if (!staffData.success || !staffData.data || staffData.data.length === 0) {
                activitiesContainer.innerHTML = '<div class="activity-empty">No staff data available.</div>';
                return;
            }

            const allActivities = [];
            staffData.data.forEach((staff) => {
                if (staff.activities && staff.activities.length > 0) {
                    staff.activities.forEach((activity) => {
                        allActivities.push({
                            ...activity,
                            staffName: staff.fullName,
                            staffUsername: staff.username,
                            staffRole: staff.role,
                            staffPermissions: staff.permissions
                        });
                    });
                }
            });

            // Sort activities by timestamp (newest first)
            allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (allActivities.length === 0) {
                activitiesContainer.innerHTML = '<div class="activity-empty">No activities found.</div>';
                return;
            }

            activitiesContainer.innerHTML = allActivities
                .map(activity => `
                    <div class="activity-item ${activity.activityType === 'booking_cancellation' ? 'activity-cancelled' : ''}">
                        <div class="activity-item-header">
                            <div class="activity-item-type">
                                <i class="${getActivityIcon(activity.details, activity.activityType, activity.reference)}"></i>
                                <span class="activity-type-text">${getActivityTypeDisplayName(activity.activityType, activity.reference)}</span>
                            </div>
                            <div class="activity-item-time">
                                <span class="time-primary">${formatDateTime(activity.timestamp)}</span>
                                <span class="time-secondary">${getRelativeTime(activity.timestamp)}</span>
                            </div>
                        </div>
                        <div class="activity-item-user">
                            <div class="user-info">
                                <span class="user-name">${activity.staffName}</span>
                                <span class="user-username">@${activity.staffUsername}</span>
                                <span class="user-role">${activity.staffRole}</span>
                            </div>
                        </div>
                        <div class="activity-item-details">
                            ${getActivityDescription(activity)}
                        </div>
                    </div>
                `).join('');
        } catch (error) {
            console.error("Error loading activities:", error);
            activitiesContainer.innerHTML = '<div class="activity-empty">Error loading activities. Please try again.</div>';
        }
    }

    async function updateStats() {
        try {
            const staffData = await fetchStaffData();

            if (!staffData.success || !staffData.data) {
                console.error("No staff data available for stats");
                return;
            }

            const totalStaff = staffData.data.length;
            const activeStaff = staffData.data.filter(staff => staff.isActive).length;

            let totalActivities = 0;
            let todayActivities = 0;
            const today = new Date().toDateString();

            staffData.data.forEach(staff => {
                if (staff.activities) {
                    totalActivities += staff.activities.length;
                    staff.activities.forEach(activity => {
                        if (new Date(activity.timestamp).toDateString() === today) {
                            todayActivities++;
                        }
                    });
                }
            });

            // Animate counters
            animateCounter('totalStaff', totalStaff);
            animateCounter('activeStaff', activeStaff);
            animateCounter('totalActivities', totalActivities);
            animateCounter('todayActivities', todayActivities);
        } catch (error) {
            console.error("Error updating stats:", error);
        }
    }

    function animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = 0;
        const duration = 1500;
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);

            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    // Global functions
    window.refreshAllData = async function () {
        await Promise.all([
            updateStats(),
            loadStaffList(),
            loadActivities()
        ]);
    };

    // Initialize dashboard
    async function initializeDashboard() {
        try {
            await Promise.all([
                updateStats(),
                loadStaffList(),
                loadActivities()
            ]);
        } catch (error) {
            console.error("Dashboard initialization failed:", error);
        }
    }

    // Initialize when ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeDashboard);
    } else {
        initializeDashboard();
    }

    // Auto-refresh every 30 seconds
    setInterval(async () => {
        try {
            await Promise.all([loadActivities(), updateStats()]);
        } catch (error) {
            console.error("Auto-refresh failed:", error);
        }
    }, 30000);

})();


// Additional CSS styles for booking cancellation
const additionalStyles = `
<style>
.activity-cancelled {
    border-left: 4px solid #e53e3e !important;
    background: linear-gradient(135deg, #fff5f5, #ffffff);
}

.booking-cancellation {
    background: #fff5f5;
    border-radius: 8px;
    padding: 10px;
}

.detail-cancelled {
    color: #e53e3e !important;
    font-weight: 600;
}

.status-cancelled {
    color: #e53e3e;
    font-weight: 600;
}

.text-danger {
    color: #e53e3e;
}

.text-success {
    color: #38a169;
}

.activity-item-type i.fas.fa-calendar-times {
    color: #e53e3e;
}

.activity-item-type i.fas.fa-credit-card {
    color: #3182ce;
}

.activity-item-type i.fas.fa-flask {
    color: #805ad5;
}

.activity-item-type i.fas.fa-cube,
.activity-item-type i.fas.fa-tags {
    color: #d69e2e;
}

.activity-item-type i.fas.fa-clipboard-list {
    color: #38a169;
}

.activity-item-type i.fas.fa-box {
    color: #dd6b20;
}

.activity-item-type i.fas.fa-vial {
    color: #9f7aea;
}

.activity-item-type i.fas.fa-calendar-plus {
    color: #319795;
}

.staff-member {
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 10px;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    cursor: pointer;
}

.staff-member:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.staff-name {
    font-size: 1.1em;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 8px;
}

.staff-info {
    margin: 4px 0;
    font-size: 0.9em;
    color: #4a5568;
}

.staff-info i {
    width: 16px;
    margin-right: 8px;
    color: #718096;
}

.staff-status {
    margin-top: 8px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8em;
    font-weight: 600;
    display: inline-block;
}

.status-active {
    background: #c6f6d5;
    color: #22543d;
}

.status-inactive {
    background: #fed7d7;
    color: #742a2a;
}

@media (max-width: 768px) {
    .activity-item-header {
        flex-direction: column;
        gap: 10px;
    }
    
    .activity-item-time {
        align-self: flex-start;
    }
    
    .detail-item {
        grid-column: span 2;
    }
}
</style>
`;

// Inject additional styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.innerHTML = additionalStyles.replace(/<\/?style>/g, '');
    document.head.appendChild(styleSheet);
}