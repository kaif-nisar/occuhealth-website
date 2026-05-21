// Global variables for charts
window.revenueChart = window.revenueChart || null;
window.modelUsageChart = window.modelUsageChart || null;
window.currentRevenueView = window.currentRevenueView || "monthly";

// API Base URL - Change this to your backend URL
const API_BASE_URL = "/api/v1/user";

// Dashboard class to manage all functionality
class Dashboard {
  constructor() {
    this.init();
  }

  async init() {
    try {
      await this.loadDashboardData();
      this.initializeCharts();
      this.setupEventListeners();
    } catch (error) {
      console.error("Dashboard initialization failed:", error);
      this.showError("Failed to load dashboard data");
    }
  }

  async loadDashboardData() {
    await Promise.all([
      this.loadStats(),
      this.loadRecentClients(),
      this.loadTopFranchisees(),
      this.loadNotifications(),
    ]);
  }

  async apiCall(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        ...options,
      });

      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }

      // console.log(`[API] ${endpoint} -> status: ${response.status}`, body);

      if (!response.ok) {
        const message = (body && body.message) || body || `HTTP ${response.status}`;
        throw new Error(message);
      }

      return body;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async loadStats() {
    try {
      const res = await this.apiCall("/dashboard/stats");
      const stats = res && (res.data || res) ? (res.data || res) : {};
      this.renderStats(stats);
    } catch (error) {
      console.warn("loadStats failed, using mock stats", error);
      this.renderStats(this.getMockStats());
    }
  }

  renderStats(stats) {
    // console.log("renderStats ->", stats);
    const container = document.getElementById("statsContainer");
    if (!container) {
      console.warn("statsContainer not found in DOM");
      return;
    }
    const data = stats && stats.data ? stats.data : stats || {};
    const formatCurrency = (value) => `Rs.${Number(value || 0).toLocaleString("en-IN")}`;
    container.innerHTML = `
                    <div class="stat-card" onclick="dashboard.navigateToClients()">
                        <div class="stat-icon clients-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${data.totalClients || 0}</div>
                            <div class="stat-label">Total Clients</div>
                        </div>
                    </div>
                    <div class="stat-card" onclick="dashboard.navigateToBookings()">
                        <div class="stat-icon bookings-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${data.totalTest || 0}</div>
                            <div class="stat-label">Total Test</div>
                        </div>
                    </div>
                    <div class="stat-card" onclick="dashboard.navigateToModels()">
                        <div class="stat-icon models-icon">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${data.activeModels || 0}</div>
                            <div class="stat-label">Active Models</div>
                        </div>
                    </div>
                    <div class="stat-card" onclick="dashboard.navigateToRevenue()">
                        <div class="stat-icon revenue-icon">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${formatCurrency(data.totalRevenue)}</div>
                            <div class="stat-label">Total Revenue</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon revenue-icon">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${formatCurrency(data.subscriptionRevenue)}</div>
                            <div class="stat-label">Subscription Revenue</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon bookings-icon">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${formatCurrency(data.bookingWalletRevenue)}</div>
                            <div class="stat-label">Admin Booking Wallet Inflow</div>
                        </div>
                    </div>
                    <div class="stat-card" onclick="loadPage('withdrawal_requests')">
                        <div class="stat-icon clients-icon">
                            <i class="fas fa-building-columns"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">${formatCurrency(data.pendingWithdrawalAmount)}</div>
                            <div class="stat-label">Pending Withdrawals (${data.pendingWithdrawalCount || 0})</div>
                        </div>
                    </div>
                `;
  }

  async loadRecentClients() {
    try {
      const res = await this.apiCall("/dashboard/recent-clients");
      const clients = res && (res.data || res) ? (res.data || res) : [];
      this.renderClientsTable(clients);
    } catch (error) {
      console.warn("loadRecentClients failed, using mock", error);
      this.renderClientsTable(this.getMockClients());
    }
  }

  renderClientsTable(clients) {
    // console.log("renderClientsTable ->", clients);
    const container = document.getElementById("clientsTableContainer");
    if (!container) {
      console.warn("clientsTableContainer not found in DOM");
      return;
    }
    if (!Array.isArray(clients)) clients = [];
    container.innerHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Model</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clients
                              .map(
                                (client) => `
                                <tr>
                                    <td>
                                        <div class="user-cell">
                                            <div class="table-avatar">${client.name
                                              .split(" ")
                                              .map((n) => n[0])
                                              .join("")
                                              .toUpperCase()}</div>
                                            <div class="user-info">
                                                <div class="user-name">${
                                                  client.name
                                                }</div>
                                                <div class="user-email">${
                                                  client.email
                                                }</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${client.model}</td>
                                    <td>${new Date(
                                      client.date
                                    ).toLocaleDateString()}</td>
                                    <td><span class="status status-${client.status.toLowerCase()}">${
                                  client.status
                                }</span></td>
                                    <td>
                                        <button class="action-btn" onclick="dashboard.viewClient(${
                                          client.id
                                        })">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="action-btn" onclick="dashboard.editClient(${
                                          client.id
                                        })">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                `;
  }

  async loadTopFranchisees() {
    try {
      const res = await this.apiCall("/dashboard/top-franchisees");
      const franchisees = res && (res.data || res) ? (res.data || res) : [];
      this.renderFranchiseesTable(franchisees);
    } catch (error) {
      console.warn("loadTopFranchisees failed, using mock", error);
      this.renderFranchiseesTable(this.getMockFranchisees());
    }
  }

  renderFranchiseesTable(franchisees) {
    // console.log("renderFranchiseesTable ->", franchisees)
    const container = document.getElementById("franchiseesTableContainer");
    if (!container) {
      console.warn("franchiseesTableContainer not found in DOM");
      return;
    }
    if (!Array.isArray(franchisees)) franchisees = [];
    container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Franchisee</th>
          <th>Location</th>
          <th>Clients</th>
          <th>Revenue</th>
          <th>Performance</th>
        </tr>
      </thead>
      <tbody>
        ${franchisees
          .map(
            (franchisee) => `
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="table-avatar">${
                      franchisee.adminDetails?.name 
                        ? franchisee.adminDetails.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "N/A"
                    }</div>
                    <div class="user-info">
                      <div class="user-name">${
                        franchisee.adminDetails?.name || "Unknown"
                      }</div>
                      <div class="user-email">${
                        franchisee.adminDetails?.email || "No email"
                      }</div>
                    </div>
                  </div>
                </td>
                <td>${franchisee.adminDetails?.code || "N/A"}</td>
                <td>${franchisee.totalBookings || 0}</td>
                <td>$${franchisee.totalRevenue?.toLocaleString() || "0"}</td>
                <td><span class="status status-${
                  franchisee.adminDetails?.status?.toLowerCase() || "unknown"
                }">${
                  franchisee.adminDetails?.status || "Unknown"
                }</span></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

  async loadNotifications() {
    try {
      const res = await this.apiCall("/dashboard/notifications");
      const notifications = res && (res.data || res) ? (res.data || res) : [];
      this.renderNotifications(notifications);
    } catch (error) {
      console.warn("loadNotifications failed, using mock", error);
      this.renderNotifications(this.getMockNotifications());
    }
  }

  renderNotifications(notifications) {
    // console.log("renderNotifications ->", notifications)
    const container = document.getElementById("notificationsContainer");
    if (!container) {
      console.warn("notificationsContainer not found in DOM");
      return;
    }
    if (!Array.isArray(notifications)) notifications = [];
    container.innerHTML = notifications
      .map(
        (notification) => `
                    <div class="notification-item">
                        <div class="notification-icon icon-${
                          notification.type
                        }">
                            <i class="fas fa-${this.getNotificationIcon(
                              notification.type
                            )}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-message">${
                              notification.message
                            }</div>
                            <div class="notification-time">${this.formatTime(
                              notification.time
                            )}</div>
                        </div>
                    </div>
                `
      )
      .join("");
  }

  getNotificationIcon(type) {
    const icons = {
      info: "info",
      success: "check",
      warning: "exclamation",
      error: "times",
    };
    return icons[type] || "info";
  }

  formatTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }

  async initializeCharts() {
    await this.initRevenueChart();
    await this.initModelUsageChart();
  }

  
async initRevenueChart() {
  try {
    const res = await this.apiCall(
      `/dashboard/revenue-data?period=${window.currentRevenueView}`
    );
    const payload = res && (res.data || res) ? (res.data || res) : this.getMockRevenueData(window.currentRevenueView);
    // console.log("Revenue API payload:", payload);
    this.renderRevenueChart(payload);
  } catch (error) {
    console.error("Error loading revenue data:", error);
    this.renderRevenueChart(this.getMockRevenueData(window.currentRevenueView));
  }
}

renderRevenueChart(data) {
  // console.log("Revenue chart data being rendered:", data);
  
  const canvasElement = document.getElementById("revenueChart");
  if (!canvasElement) {
    console.error("Canvas element 'revenueChart' not found!");
    return;
  }
  
  const ctx = canvasElement.getContext("2d");

  if (window.revenueChart) {
    window.revenueChart.destroy();
  }

  try {
    window.revenueChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Revenue",
            data: data.values,
            borderColor: "#667eea",
            backgroundColor: "rgba(102, 126, 234, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "$" + value.toLocaleString();
              },
            },
          },
        },
      },
    });
    // console.log("Revenue chart created successfully");
  } catch (error) {
    console.error("Error creating revenue chart:", error);
  }
}

 async initModelUsageChart() {
  try {
    const res = await this.apiCall("/dashboard/model-usage");
    const payload = res && (res.data || res) ? (res.data || res) : this.getMockModelData();
    this.renderModelUsageChart(payload);
  } catch (error) {
    this.renderModelUsageChart(this.getMockModelData());
  }
}

renderModelUsageChart(data) {
  // console.log("Model chart data:", data);
  const ctx = document.getElementById("modelUsageChart").getContext("2d");

  if (window.modelUsageChart) {
    window.modelUsageChart.destroy();
  }

  window.modelUsageChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [
        {
          data: data.values,
          backgroundColor: [
            "#667eea",
            "#764ba2", 
            "#f093fb",
            "#f5576c",
            "#4facfe",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

  setupEventListeners() {
    // Auto-refresh data every 5 minutes
    setInterval(() => {
      this.refreshDashboard();
    }, 300000);
  }

  async refreshDashboard() {
    await this.loadDashboardData();
    await this.initializeCharts();
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    document.querySelector(".dashboard-container").prepend(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  // Navigation methods
  navigateToClients() {
    window.location.href = "/clients";
  }

  navigateToBookings() {
    window.location.href = "/bookings";
  }

  navigateToModels() {
    window.location.href = "/models";
  }

  navigateToRevenue() {
    window.location.href = "/revenue";
  }

  viewClient(clientId) {
    window.location.href = `/clients/${clientId}`;
  }

  editClient(clientId) {
    window.location.href = `/clients/${clientId}/edit`;
  }

  viewAllClients() {
    window.location.href = "/clients";
  }

  viewAllFranchisees() {
    window.location.href = "/franchisees";
  }

  async markAllAsRead() {
    try {
      await this.apiCall("/dashboard/notifications/mark-read", {
        method: "POST",
      });
      await this.loadNotifications();
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  }

  // Mock data methods (fallback when API is not available)
  getMockStats() {
    return {
      totalClients: 1247,
      activeBookings: 3890,
      activeModels: 42,
      totalRevenue: 219500,
    };
  }

  getMockClients() {
    return [
      {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        model: "4-Layer Enterprise",
        date: "2025-04-15",
        status: "Active",
      },
      {
        id: 2,
        name: "Alice Smith",
        email: "alice@example.com",
        model: "2-Layer Standard",
        date: "2025-04-14",
        status: "Active",
      },
      {
        id: 3,
        name: "Robert Johnson",
        email: "robert@example.com",
        model: "3-Layer Advanced",
        date: "2025-04-13",
        status: "Pending",
      },
      {
        id: 4,
        name: "Emma Wilson",
        email: "emma@example.com",
        model: "1-Layer Basic",
        date: "2025-04-12",
        status: "Inactive",
      },
    ];
  }

  getMockFranchisees() {
    return [
      {
        id: 1,
        name: "Metro Labs",
        email: "info@metrolabs.com",
        location: "New York, USA",
        clients: 245,
        revenue: 87500,
        performance: "Excellent",
      },
      {
        id: 2,
        name: "Tech Solutions",
        email: "contact@techsolutions.com",
        location: "London, UK",
        clients: 198,
        revenue: 65200,
        performance: "Good",
      },
      {
        id: 3,
        name: "Data Systems",
        email: "info@datasystems.com",
        location: "Singapore",
        clients: 162,
        revenue: 53800,
        performance: "Average",
      },
      {
        id: 4,
        name: "InfoNex",
        email: "support@infonex.com",
        location: "Sydney, AU",
        clients: 125,
        revenue: 41200,
        performance: "Average",
      },
    ];
  }

  getMockNotifications() {
    return [
      {
        id: 1,
        type: "info",
        message:
          "New client <strong>Acme Corp</strong> has registered for the 4-Layer Enterprise package.",
        time: Date.now() - 600000,
      },
      {
        id: 2,
        type: "success",
        message: "The system update has been successfully completed.",
        time: Date.now() - 7200000,
      },
      {
        id: 3,
        type: "warning",
        message:
          "Server load is reaching capacity. Consider optimizing or upgrading.",
        time: Date.now() - 18000000,
      },
    ];
  }

  getMockRevenueData(period) {
    const data = {
      weekly: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        values: [12000, 19000, 15000, 25000, 22000, 30000, 28000],
      },
      monthly: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        values: [65000, 59000, 80000, 81000, 56000, 85000],
      },
      yearly: {
        labels: ["2020", "2021", "2022", "2023", "2024", "2025"],
        values: [420000, 532000, 678000, 789000, 845000, 920000],
      },
    };
    return data[period] || data.monthly;
  }

  getMockModelData() {
    return {
      labels: [
        "4-Layer Enterprise",
        "3-Layer Advanced",
        "2-Layer Standard",
        "1-Layer Basic",
        "Custom",
      ],
      values: [35, 25, 20, 15, 5],
    };
  }
}

// Global functions for button clicks
async function updateRevenueChart(period) {
  window.currentRevenueView = period;
  await window.dashboard.initRevenueChart();
}

function exportModelData() {
  // Create CSV data
  const data = [
    ["Model", "Usage Percentage"],
    ["4-Layer Enterprise", "35%"],
    ["3-Layer Advanced", "25%"],
    ["2-Layer Standard", "20%"],
    ["1-Layer Basic", "15%"],
    ["Custom", "5%"],
  ];

  const csvContent = data.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "model-usage-data.csv";
  a.click();
  window.URL.revokeObjectURL(url);
}

function viewAllClients() {
  dashboard.viewAllClients();
}

function viewAllFranchisees() {
  dashboard.viewAllFranchisees();
}

function markAllAsRead() {
  dashboard.markAllAsRead();
}

// Initialize dashboard when page loads
window.dashboard = window.dashboard || new Dashboard();

