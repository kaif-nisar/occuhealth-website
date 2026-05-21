// Navigation Functions
function showSection(sectionId) {
  // Hide all sections
  const sections = document.querySelectorAll(".content-section");
  sections.forEach((section) => section.classList.remove("active"));

  // Show selected section
  document.getElementById(sectionId).classList.add("active");

  // Update active tab
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");
}

// Modal Functions
function showModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Close modal when clicking outside
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
  }
};

// Notification Functions
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// User Management Functions
function searchUsers(query) {
  const table = document.getElementById("usersTable");
  const rows = table.getElementsByTagName("tr");

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const text = row.textContent.toLowerCase();

    if (text.includes(query.toLowerCase())) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
}

function editUser(userId) {
  showNotification(`Editing user ${userId}`, "info");
}

function suspendUser(userId) {
  if (confirm("Are you sure you want to suspend this user?")) {
    showNotification(`User ${userId} suspended`, "warning");
  }
}

function activateUser(userId) {
  showNotification(`User ${userId} activated`, "success");
}

function exportUsers() {
  showNotification("Users data exported successfully", "success");
}

// Subscription Management Functions
function editPlan(planType) {
  showNotification(`Editing ${planType} plan`, "info");
}

function disablePlan(planType) {
  if (confirm(`Are you sure you want to disable the ${planType} plan?`)) {
    showNotification(`${planType} plan disabled`, "warning");
  }
}
async function loadSubscriptionAnalytics() {
  try {
    const res = await fetch('/api/v1/user/subscription/analytics');
    const { data } = await res.json();
    console.log(data)
    document.getElementById('activeSubscription').innerText = data.activeSubscriptions;
    document.getElementById('expireSoon').innerText = data.expiringSoon;
    document.getElementById('cancelToday').innerText = data.cancelledToday;
    document.getElementById('newUser').innerText = data.newThisMonth;

    const tableBody = document.querySelector('#subscriptions table tbody');
    tableBody.innerHTML = '';

    data.planStats.forEach(plan => {
      const row = `
        <tr>
          <td>${plan._id} Plan</td>
          <td>₹--/--</td> <!-- Optional to match with real price -->
          <td>${plan.activeUsers}</td>
          <td>₹${plan.totalRevenue}</td>
          <td><span class="badge badge-success">Active</span></td>
          <td>
            <button class="btn btn-warning" onclick="editPlan('${plan._id}')">Edit</button>
            <button class="btn btn-danger" onclick="disablePlan('${plan._id}')">Disable</button>
          </td>
        </tr>
      `;
      tableBody.insertAdjacentHTML('beforeend', row);
    });

  } catch (err) {
    console.error("Failed to load analytics:", err);
  }
}

// Call this on page load

loadSubscriptionAnalytics();


// Referral Functions
function viewReferrals(user) {
  showNotification(`Viewing referrals for ${user}`, "info");
}

function adjustCommission(user) {
  showNotification(`Adjusting commission for ${user}`, "info");
}

// Withdrawal Functions
function approveWithdrawal(withdrawalId) {
  if (confirm("Are you sure you want to approve this withdrawal?")) {
    showNotification(`Withdrawal ${withdrawalId} approved`, "success");
  }
}

function rejectWithdrawal(withdrawalId) {
  if (confirm("Are you sure you want to reject this withdrawal?")) {
    showNotification(`Withdrawal ${withdrawalId} rejected`, "error");
  }
}

function viewWithdrawal(withdrawalId) {
  showNotification(`Viewing details for ${withdrawalId}`, "info");
}

function processAllWithdrawals() {
  if (confirm("Are you sure you want to process all pending withdrawals?")) {
    showNotification("All withdrawals processed successfully", "success");
  }
}

function exportWithdrawals() {
  showNotification("Withdrawal data exported successfully", "success");
}

// System Functions
function backupDatabase() {
  showNotification("Database backup initiated", "info");
}

function clearCache() {
  showNotification("Cache cleared successfully", "success");
}

function viewLogs() {
  showNotification("Opening system logs", "info");
}

function restartServices() {
  if (
    confirm(
      "Are you sure you want to restart services? This will cause temporary downtime."
    )
  ) {
    showNotification("Services restarted successfully", "success");
  }
}

// General Functions
function exportData() {
  showNotification("Data export initiated", "info");
}

function generateReport() {
  showNotification("Report generated successfully", "success");
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    showNotification("Logging out...", "info");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  }
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", function () {
  showNotification("Welcome to Super Admin Dashboard!", "success");
});
