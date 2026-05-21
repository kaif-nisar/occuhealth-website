        // Sample data - Replace with actual API calls
        const sampleStaffData = [
            {
                _id: "6829fd40be09c931e9f414a5",
                username: "ahad.staff",
                email: "ahad.staff@gmail.com",
                fullName: "ahad.staff",
                phoneNo: "1232432543543",
                isActive: true,
                role: "staff",
                parentRole: "superAdmin",
                lastLogin: "2025-05-23T06:59:31.522Z",
                activities: [
                    {
                        activityType: "panel_create",
                        details: { name: "Admin Panel Setup" },
                        timestamp: "2025-05-23T07:01:19.031Z",
                        _id: "68301d3f3fe32c6da644840f"
                    },
                    {
                        activityType: "package_create",
                        details: { packageName: "Premium Package" },
                        timestamp: "2025-05-23T07:02:21.893Z",
                        _id: "68301d7d3fe32c6da6448461"
                    },
                    {
                        activityType: "package_create",
                        details: { packageName: "Basic Package" },
                        timestamp: "2025-05-23T07:02:58.837Z",
                        _id: "68301da23fe32c6da64484b3"
                    },
                    {
                        activityType: "package_create",
                        details: { packageName: "Enterprise Package" },
                        timestamp: "2025-05-23T07:03:36.313Z",
                        _id: "68301dc83fe32c6da64484e1"
                    }
                ]
            },
            {
                _id: "6829fd40be09c931e9f414a6",
                username: "sara.staff",
                email: "sara.staff@gmail.com",
                fullName: "Sara Ahmed",
                phoneNo: "9876543210",
                isActive: true,
                role: "staff",
                parentRole: "superAdmin",
                lastLogin: "2025-05-23T08:30:15.123Z",
                activities: [
                    {
                        activityType: "user_create",
                        details: { userName: "new_user_001" },
                        timestamp: "2025-05-23T08:15:30.456Z",
                        _id: "68301d3f3fe32c6da644840g"
                    },
                    {
                        activityType: "report_generate",
                        details: { reportType: "Monthly Sales" },
                        timestamp: "2025-05-23T08:25:45.789Z",
                        _id: "68301d3f3fe32c6da644840h"
                    }
                ]
            },
            {
                _id: "6829fd40be09c931e9f414a7",
                username: "ali.staff",
                email: "ali.staff@gmail.com",
                fullName: "Ali Khan",
                phoneNo: "5555666777",
                isActive: false,
                role: "staff",
                parentRole: "superAdmin",
                lastLogin: "2025-05-22T14:20:10.333Z",
                activities: [
                    {
                        activityType: "data_export",
                        details: { exportType: "Customer List" },
                        timestamp: "2025-05-22T14:15:20.111Z",
                        _id: "68301d3f3fe32c6da644840i"
                    }
                ]
            }
        ];

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

        function getActivityIcon(activityType) {
            const icons = {
                'panel_create': '🎛️',
                'package_create': '📦',
                'user_create': '👤',
                'report_generate': '📊',
                'data_export': '📤',
                'login': '🔐',
                'logout': '🚪',
                'update': '✏️',
                'delete': '🗑️',
                'default': '⚡'
            };
            return icons[activityType] || icons['default'];
        }

        function getActivityDescription(activity) {
            const descriptions = {
                'panel_create': `Created a new admin panel: ${activity.details?.name || 'Unknown'}`,
                'package_create': `Created package: ${activity.details?.packageName || 'Unknown'}`,
                'user_create': `Created new user: ${activity.details?.userName || 'Unknown'}`,
                'report_generate': `Generated report: ${activity.details?.reportType || 'Unknown'}`,
                'data_export': `Exported data: ${activity.details?.exportType || 'Unknown'}`,
                'login': `Logged into the system`,
                'logout': `Logged out from the system`,
                'update': `Updated system data`,
                'delete': `Deleted system data`
            };
            return descriptions[activity.activityType] || `Performed ${activity.activityType} action`;
        }

        function loadStaffList() {
            const staffListContainer = document.getElementById('staffList');
            
            // In real implementation, replace with actual API call
            // fetch('/api/staff').then(response => response.json()).then(data => {
            
            const staffData = sampleStaffData;
            
            if (staffData.length === 0) {
                staffListContainer.innerHTML = '<div class="loading">No staff members found.</div>';
                return;
            }

            staffListContainer.innerHTML = staffData.map(staff => `
                <div class="staff-member">
                    <div class="staff-name">${staff.fullName}</div>
                    <div class="staff-info">👤 ${staff.username}</div>
                    <div class="staff-info">📧 ${staff.email}</div>
                    <div class="staff-info">📱 ${staff.phoneNo}</div>
                    <div class="staff-info">🎯 ${staff.role}</div>
                    <div class="staff-info">🕐 Last Login: ${formatDateTime(staff.lastLogin)}</div>
                    <div class="staff-status ${staff.isActive ? 'status-active' : 'status-inactive'}">
                        ${staff.isActive ? '🟢 Active' : '🔴 Inactive'}
                    </div>
                </div>
            `).join('');
        }

        function loadActivities() {
            const activitiesContainer = document.getElementById('activitiesList');
            activitiesContainer.innerHTML = '<div class="loading">Loading activities...</div>';
            
            // In real implementation, replace with actual API call
            // fetch('/api/activities').then(response => response.json()).then(data => {
            
            setTimeout(() => {
                const allActivities = [];
                
                sampleStaffData.forEach(staff => {
                    staff.activities.forEach(activity => {
                        allActivities.push({
                            ...activity,
                            staffName: staff.fullName,
                            staffUsername: staff.username
                        });
                    });
                });

                // Sort by timestamp (newest first)
                allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                if (allActivities.length === 0) {
                    activitiesContainer.innerHTML = '<div class="loading">No activities found.</div>';
                    return;
                }

                activitiesContainer.innerHTML = allActivities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-header">
                            <div class="activity-type">
                                ${getActivityIcon(activity.activityType)} ${activity.activityType.replace('_', ' ').toUpperCase()}
                            </div>
                            <div class="activity-time">${formatDateTime(activity.timestamp)}</div>
                        </div>
                        <div class="activity-user">👤 ${activity.staffName} (@${activity.staffUsername})</div>
                        <div class="activity-details">${getActivityDescription(activity)}</div>
                    </div>
                `).join('');
            }, 1000);
        }

        function updateStats() {
            const totalStaff = sampleStaffData.length;
            const activeStaff = sampleStaffData.filter(staff => staff.isActive).length;
            
            let totalActivities = 0;
            let todayActivities = 0;
            const today = new Date().toDateString();
            
            sampleStaffData.forEach(staff => {
                totalActivities += staff.activities.length;
                staff.activities.forEach(activity => {
                    if (new Date(activity.timestamp).toDateString() === today) {
                        todayActivities++;
                    }
                });
            });

            // Animate counters
            animateCounter('totalStaff', totalStaff);
            animateCounter('activeStaff', activeStaff);
            animateCounter('totalActivities', totalActivities);
            animateCounter('todayActivities', todayActivities);
        }

        function animateCounter(elementId, targetValue) {
            const element = document.getElementById(elementId);
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

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            updateStats();
            loadStaffList();
            loadActivities();
            
            // Auto-refresh every 30 seconds
            setInterval(() => {
                loadActivities();
                updateStats();
            }, 30000);
        });

        // For real implementation, use these API functions:
        /*
        async function fetchStaffData() {
            try {
                const response = await fetch('/api/staff');
                return await response.json();
            } catch (error) {
                console.error('Error fetching staff data:', error);
                return [];
            }
        }

        async function fetchActivities() {
            try {
                const response = await fetch('/api/activities');
                return await response.json();
            } catch (error) {
                console.error('Error fetching activities:', error);
                return [];
            }
        }
        */
