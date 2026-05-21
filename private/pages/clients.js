(function (){
// Global variables
let allClients = [];
let currentFilter = "all";
let currentClient = null;

// Initialize the application
(async function () {
 await loadClients();
 await setupEventListeners();
})();

// Setup event listeners
function setupEventListeners() {
  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      currentFilter = this.dataset.filter;
      updateFilterButtons();
      filterClients();
    });
  });

  // Close modals when clicking outside
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", function (e) {
      if (e.target === this) {
        closeModal(this.id);
      }
    });
  });
}

// Load clients from backend
async function loadClients() {
  try {
    showLoading(true);
    const response = await fetch(`/api/v1/user/models/tenant`);

    if (!response.ok) {
      throw new Error("Failed to fetch clients");
    }

    const tenants = await response.json();
    // console.log("Fetched tenants:", tenants);
    // Process each tenant to get booking count
    allClients = await Promise.all(
      tenants.map(async (tenant) => {
        // const bookingCount = await getBookingCount(tenant._id);
        return {
          ...tenant,
          // bookingCount: bookingCount,
        };
      })
    );

    renderClients();
    showLoading(false);
  } catch (error) {
    console.error("Error loading clients:", error);
    showError("Failed to load clients. Please try again.");
    showLoading(false);
  }
}

// Get booking count for a tenant
async function getBookingCount(tenantId) {
  try {
    const response = await fetch(`/api/v1/user/bookings/count/${tenantId}`);
    if (!response.ok) {
      console.warn(`Failed to fetch booking count for tenant ${tenantId}`);
      return 0;
    }
    const data = await response.json();
    // console.log(`Booking count for tenant ${tenantId}:`, data.count);
    return data.count || 0;
  } catch (error) {
    console.warn("Error fetching booking count:", error);
    return 0;
  }
}

// Render clients in the table
function renderClients() {
  const tbody = document.getElementById("clientTableBody");
  const filteredClients = getFilteredClients();

  if (filteredClients.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 50px; color: #7f8c8d;">
                            No clients found
                        </td>
                    </tr>
                `;
  } else {
    console.log("Rendering clients:", filteredClients.map(c => getStatusClass(c.tenantDetails.status)));
    tbody.innerHTML = filteredClients
      .map(
        (client) => `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="table-avatar">${getInitials(
                                  client.tenantDetails.name
                                )}</div>
                                <div class="user-info">
                                    <div class="user-name">${client.tenantDetails.adminDetails.username}</div>
                                    <div class="user-email">${
                                      client.tenantDetails.adminDetails.email ||
                                      client.tenantDetails.email ||
                                      "N/A"
                                    }</div>
                                </div>
                            </div>
                        </td>
                        <td><span class="status ${getStatusClass(
                          client.tenantDetails.status
                        )}">${getStatusText(client.tenantDetails.status)}</span></td>
                        <td><span class="integration-badge badge-api">${
                          client.tenantDetails.modelType || "N/A"
                        }</span></td>
                        <td>${client.count|| 0} bookings</td>
                        <td>${formatDate(client.tenantDetails.updatedAt)}</td>
                        <td>
                            <button class="action-btn view-btn" onclick="viewClientDashboard('${
                              client.tenantDetails.userId
                            }')" title="View Dashboard">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `
      )
      .join("");
  }

  document.getElementById("clientTable").style.display = "table";
}

// Get filtered clients based on current filter
function getFilteredClients() {
  if (currentFilter === "all") {
    return allClients;
  }

  return allClients.filter((client) => {
    const status = client.status === "true" || client.status === true;

    if (currentFilter === "active") {
      return status;
    } else if (currentFilter === "inactive") {
      return !status;
    }
    return true;
  });
}

// Update filter button states
function updateFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.filter === currentFilter) {
      btn.classList.add("active");
    }
  });
}

// Filter clients and re-render
function filterClients() {
  renderClients();
}

// View client dashboard
function viewClientDashboard(userId) {
  if (userId) {
    // Redirect to dashboard with userId parameter
    window.location.href = `/dashboard?userId=${userId}`;
  } else {
    alert("User ID not available");
  }
}

// Open add client modal
function openAddClientModal() {
  document.getElementById("addClientModal").style.display = "flex";
}

// Close modal
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Save new client
async function saveClient() {
  const form = document.getElementById("addClientForm");
  const formData = new FormData(form);
  const clientData = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`${API_BASE_URL}/tenants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientData),
    });

    if (!response.ok) {
      throw new Error("Failed to create client");
    }

    const newClient = await response.json();

    // Add to local array
    allClients.unshift({ ...newClient, bookingCount: 0 });

    // Re-render table
    renderClients();

    // Close modal and reset form
    closeModal("addClientModal");
    form.reset();

    alert("Client created successfully!");
  } catch (error) {
    console.error("Error creating client:", error);
    alert("Failed to create client. Please try again.");
  }
}

// Utility functions
function getInitials(name) {
  if (!name) return "N/A";
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getStatusClass(status) {
  const isActive = status === "active" || status === "true" || status === true;
  return isActive ? "status-active" : "status-inactive";
}

function getStatusText(status) {
  const isActive = status === "active" || status === "true" || status === true;
  return isActive ? "Active" : "Inactive";
}

function formatDate(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return "Today";
  } else if (diffDays === 2) {
    return "Yesterday";
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
}

function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

// Edit client function (placeholder)
function editClient() {
  alert("Edit functionality will be implemented based on your requirements");
}
})();