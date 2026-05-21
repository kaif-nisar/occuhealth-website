// Staff Activity Monitor JavaScript - Fixed Version
(function () {
  "use strict";

  // Configuration
  const API_CONFIG = {
    baseURL: "/api/v1/user",
    endpoints: {
      staff: "/staff",
      activities: "/staff/activities",
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
      // console.log("Fetched staff data:", data);
      return data;
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
      return [];
    }
  }

  // Enhanced activity icon function
  function getActivityIcon(details, activityType, reference) {
    const iconMap = {
      'test_create': {
        'Test': 'fas fa-flask',
        'unit': 'fas fa-cube',
        'panel': 'fas fa-clipboard-list',
        'package': 'fas fa-box'
      },
      'booking': 'fas fa-calendar-plus',
      'payment': 'fas fa-credit-card',
      'user_management': 'fas fa-users-cog',
      'login': 'fas fa-sign-in-alt',
      'other': 'fas fa-activity'
    };

    if (activityType === 'test_create' && reference?.model) {
      return iconMap[activityType][reference.model] || 'fas fa-plus-circle';
    }

    return iconMap[activityType] || 'fas fa-info-circle';
  }

  // Enhanced activity type display name
  function getActivityTypeDisplayName(activityType, reference) {
    const typeMap = {
      'test_create': {
        'Test': 'Test Created',
        'unit': 'Unit Created',
        'panel': 'Panel Created',
        'package': 'Package Created'
      },
      'booking': 'Booking Management',
      'payment': 'Payment Processing',
      'user_management': 'User Management',
      'login': 'System Login'
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
  function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
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
    const staffListContainer = document.getElementById("staffList");

    if (!staffListContainer) return;

    staffListContainer.innerHTML =
      '<div class="activity-loading">Loading staff...</div>';

    try {
      const staffData = await fetchStaffData();

      if (!staffData || staffData.length === 0) {
        staffListContainer.innerHTML =
          '<div class="activity-empty">No staff members found.</div>';
        return;
      }

      staffListContainer.innerHTML = staffData.data
        .map(
          (staff) => `
    <div class="staff-member-item" data-id="${staff._id}" style="cursor:pointer;">
        <div class="staff-member-name">${staff.fullName}</div>
        <div class="staff-member-info">
            <i class="fas fa-user"></i>
            ${staff.username}
        </div>
        <div class="staff-member-info">
            <i class="fas fa-envelope"></i>
            ${staff.email}
        </div>
        <div class="staff-member-info">
            <i class="fas fa-phone"></i>
            ${staff.phoneNo}
        </div>
        <div class="staff-member-info">
            <i class="fas fa-clock"></i>
            Last: ${staff.lastLogin ? formatDateTime(staff.lastLogin) : "Never"}
        </div>
        <div class="staff-member-status ${staff.isActive ? "status-active" : "status-inactive"
            }">
            ${staff.isActive ? "Active" : "Inactive"}
        </div>
    </div>
`
        )
        .join("");

      // Add click event listener
      const staffListContainer2 = document.getElementById("staffList");
      staffListContainer2.addEventListener("click", function (e) {
        const item = e.target.closest(".staff-member-item");
        if (item && item.dataset.id) {
          const staffId = item.dataset.id;
          window.location.href = `superAdmin.html?page=editStaff&staffId=${staffId}`;
        }
      });

    } catch (error) {
      console.error("Error loading staff list:", error);
      staffListContainer.innerHTML =
        '<div class="activity-empty">Error loading staff members. Please try again.</div>';
    }
  }

  // Enhanced loadStaffActivities function
  async function loadStaffActivities() {
    const activitiesContainer = document.getElementById("activitiesList");

    if (!activitiesContainer) return;

    activitiesContainer.innerHTML =
      '<div class="activity-loading">Loading activities...</div>';

    try {
      const staffData = await fetchStaffData();

      if (!staffData || staffData.length === 0) {
        activitiesContainer.innerHTML =
          '<div class="activity-empty">No staff data available.</div>';
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
      allActivities.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      if (allActivities.length === 0) {
        activitiesContainer.innerHTML =
          '<div class="activity-empty">No activities found.</div>';
        return;
      }

      activitiesContainer.innerHTML = allActivities
        .map(
          (activity) => `
                <div class="activity-item">
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
            `
        )
        .join("");
    } catch (error) {
      console.error("Error loading activities:", error);
      activitiesContainer.innerHTML =
        '<div class="activity-empty">Error loading activities. Please try again.</div>';
    }
  }

  // Rest of the functions remain the same
  async function updateStaffStats() {
    try {
      const staffData = await fetchStaffData();

      if (!staffData) {
        console.error("No staff data available for stats");
        return;
      }

      const totalStaff = staffData.data.length;
      const activeStaff = staffData.data.filter(
        (staff) => staff.isActive
      ).length;

      let totalActivities = 0;
      let todayActivities = 0;
      const today = new Date().toDateString();
      staffData.data.forEach((staff) => {
        if (staff.activities) {
          totalActivities += staff.activities.length;
          staff.activities.forEach((activity) => {
            if (new Date(activity.timestamp).toDateString() === today) {
              todayActivities++;
            }
          });
        }
      });

      animateCounter("totalStaff", totalStaff);
      animateCounter("activeStaff", activeStaff);
      animateCounter("totalActivities", totalActivities);
      animateCounter("todayActivities", todayActivities);
    } catch (error) {
      console.error("Error updating staff stats:", error);
    }
  }

  function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(
        startValue + (targetValue - startValue) * progress
      );

      element.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }

    requestAnimationFrame(updateCounter);
  }

  // Make functions globally available
  window.loadStaffActivities = loadStaffActivities;
  window.refreshStaffData = async function () {
    await initializeStaffActivityMonitor();
  };

  // Initialize
  async function initializeStaffActivityMonitor() {
    try {
      await Promise.all([
        updateStaffStats(),
        loadStaffList(),
        loadStaffActivities(),
      ]);
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeStaffActivityMonitor
    );
  } else {
    initializeStaffActivityMonitor();
  }

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    try {
      await Promise.all([loadStaffActivities(), updateStaffStats()]);
    } catch (error) {
      console.error("Auto-refresh failed:", error);
    }
  }, 30000);

})();





// model test empty space enhance data

// <div class="detail-item">
//     <span class="detail-label">Category:</span>
//     <span class="detail-value">${details.category || 'N/A'}</span>
// </div>
// <div class="detail-item">
//     <span class="detail-label">Price:</span>
//     <span class="detail-value">₹${details.price || details.final_price || 'N/A'}</span>
// </div>
// ${details.sampleType ? `
// <div class="detail-item">
//     <span class="detail-label">Sample Type:</span>
//     <span class="detail-value">${details.sampleType}</span>
// </div>` : ''}
// ${details.tat ? `
// <div class="detail-item">
//     <span class="detail-label">TAT:</span>
//     <span class="detail-value">${details.tat}</span>
// </div>` : ''}



// model test panel empty enhance data
//  <div class="detail-item">
//                         <span class="detail-label">Tests Count:</span>
//                         <span class="detail-value">${details.testsCount || 'N/A'}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Price:</span>
//                         <span class="detail-value">₹${details.price || 'N/A'}</span>
//                     </div>



// model test package empty space enhance data

//  <div class="detail-item">
//                         <span class="detail-label">Items Count:</span>
//                         <span class="detail-value">${details.itemsCount || 'N/A'}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Total Price:</span>
//                         <span class="detail-value">₹${details.totalPrice || 'N/A'}</span>
//                     </div>


// get booking description empty space Enhance data
//  <div class="detail-item">
//               <span class="detail-label">Status:</span>
//               <span class="detail-value status-${(details.status || '').toLowerCase()}">${details.status || 'N/A'}</span>
//           </div>
//           ${details.amount ? `
//           <div class="detail-item">
//               <span class="detail-label">Amount:</span>
//               <span class="detail-value">₹${details.amount}</span>
//           </div>` : ''}