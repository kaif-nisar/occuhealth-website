// Global variables
let currentUser = {
  name: "John Doe",
  email: "john.doe@email.com",
  walletBalance: 1200,
  subscriptionStatus: "active",
  referralCode: "REF123ABC",
};

// Initialize the dashboard
( function () {
  // loadUserData();
  updateDashboardStats();
  loadReferralData();
  loadWithdrawalHistory();
})();

// Navigation functions
function showSection(sectionName) {
  // Hide all sections
  const sections = document.querySelectorAll(".content-section");
  sections.forEach((section) => section.classList.remove("active"));

  // Show selected section
  document.getElementById(sectionName).classList.add("active");

  // Update nav tabs
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");
}

// Modal functions
function showModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Close modal when clicking outside
window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};

// Alert functions
function showAlert(type, message) {
  const alertId = type + "Alert";
  const alertElement = document.getElementById(alertId);
  alertElement.textContent = message;
  alertElement.style.display = "block";

  setTimeout(() => {
    alertElement.style.display = "none";
  }, 5000);
}

// Loading functions
function showLoading() {
  document.getElementById("loadingOverlay").style.display = "block";
}

function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

// User data functions
function loadUserData() {
  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("userEmail").textContent = currentUser.email;
  document.getElementById("userAvatar").textContent = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("");
  document.getElementById("currentBalance").textContent =
    "₹" + currentUser.walletBalance;
  document.getElementById("walletBalance").textContent =
    "₹" + currentUser.walletBalance;
  document.getElementById("referralCode").textContent =
    currentUser.referralCode;
}

// Update Dashboard Status
async function updateDashboardStats() {
  try {
    const res = await fetch("/api/v1/user/dashboard-stats", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    console.log(data);
    if (res.ok) {
      document.getElementById("referralCode").textContent = data.referralCode;
      document.getElementById("daysRemaining").textContent = data.daysRemaining;
      document.getElementById("totalReferrals").textContent = data.totalReferrals;
      document.getElementById("totalEarnings").textContent = `₹${data.totalEarnings}`;
      document.getElementById("walletBalance").textContent = `₹${data.walletBalance}`;
      // document.getElementById("currentBalance").textContent = `₹${data.walletBalance}`;

      // Optional update in memory too
      currentUser.walletBalance = data.walletBalance;
    } else {
      showAlert("error", data.message || "Failed to load stats");
    }
  } catch (err) {
    console.error(err);
    showAlert("error", "Error fetching dashboard stats");
  }
}


// Referral functions
function copyReferralCode() {
  const code = document.getElementById("referralCode").textContent;
  navigator.clipboard.writeText(code).then(() => {
    showAlert("success", "Referral code copied to clipboard!");
  });
}

function shareReferralCode() {
  const code = document.getElementById("referralCode").textContent;
  const shareText = `Join me on Subscription Hub using my referral code: ${code} and get exclusive benefits!`;

  if (navigator.share) {
    navigator.share({
      title: "Subscription Hub Referral",
      text: shareText,
      url: window.location.origin + "?ref=" + code,
    });
  } else {
    // Fallback for browsers that don't support Web Share API
    navigator.clipboard.writeText(shareText).then(() => {
      showAlert("success", "Referral link copied to clipboard!");
    });
  }
}

// Load Refferal Data
async function loadReferralData() {
  try {
    const [statsRes, historyRes] = await Promise.all([
      fetch("/api/v1/user/referrals/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }),
      fetch("/api/v1/user/referrals/history", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }),
    ]);

    const stats = await statsRes.json();
    const history = await historyRes.json();
    console.log(stats, history);
    if (statsRes.ok) {
      document.querySelector("#referral .stat-card:nth-child(1) h3").textContent =
        stats.totalReferrals;
      document.querySelector("#referral .stat-card:nth-child(2) h3").textContent =
        stats.successfulConversions;
      document.querySelector("#referral .stat-card:nth-child(3) h3").textContent =
        `₹${stats.totalEarned}`;
      document.querySelector("#referral .stat-card:nth-child(4) h3").textContent =
        stats.pendingApprovals;
    } else {
      showAlert("error", stats.message || "Failed to load referral stats");
    }

    if (historyRes.ok) {
      const tbody = document.querySelector(
        "#referral table tbody"
      );
      tbody.innerHTML = "";

      history.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.date}</td>
          <td>${item.email}</td>
          <td><span class="badge ${
            item.status === "Converted" ? "badge-success" : "badge-warning"
          }">${item.status}</span></td>
          <td>₹${item.earnings}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      showAlert("error", history.message || "Failed to load referral history");
    }
  } catch (err) {
    console.error(err);
    showAlert("error", "Error fetching referral data");
  }
}

// Wallet functions
async function addMoney(event) {
  event.preventDefault();

  const amount = parseInt(document.getElementById("addAmount").value);
  const method = document.getElementById("paymentMethod").value;

  if (!amount || !method) {
    showAlert("error", "Please fill all required fields");
    return;
  }

  showLoading();

  try {
    const res = await fetch("/api/v1/wallet/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ amount, method }),
    });

    const data = await res.json();
    hideLoading();

    if (res.ok) {
      currentUser.walletBalance += amount;
      loadUserData();
      closeModal("addMoneyModal");

      showAlert("success", `₹${amount} added successfully!`);
    } else {
      showAlert("error", data.message || "Failed to add money");
    }
  } catch (err) {
    hideLoading();
    showAlert("error", "Server error while adding money");
  }
}

// Withdrawal functions
async function submitWithdrawal(event) {
  event.preventDefault();

  const amount = parseInt(document.getElementById("withdrawalAmount").value);
  const accountNumber = document.getElementById("accountNumber").value;
  const ifscCode = document.getElementById("ifscCode").value;
  const accountHolder = document.getElementById("accountHolder").value;

  if (!amount || !accountNumber || !ifscCode || !accountHolder) {
    showAlert("error", "Please fill all required fields");
    return;
  }

  showLoading();

  try {
    const response = await fetch("/api/v1/user/withdrawals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("accessToken")}`
      },
      body: JSON.stringify({
        amount,
        accountNumber,
        ifscCode,
        accountHolder
      })
    });

    const data = await response.json();
    hideLoading();

    if (!response.ok) {
      showAlert("error", data.message || "Withdrawal failed");
      return;
    }

    showAlert("success", "Withdrawal submitted successfully!");
    document.getElementById("withdrawalAmount").value = "";
    document.getElementById("accountNumber").value = "";
    document.getElementById("ifscCode").value = "";
    document.getElementById("accountHolder").value = "";

  } catch (error) {
    hideLoading();
    console.error(error);
    showAlert("error", "Something went wrong");
  }
}


//Withdrawal History
async function loadWithdrawalHistory() {
  try {
    const res = await fetch("/api/v1/user/withdrawals/history", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    console.log(data)
    const { withdrawalRequests } = data; // ✅ this line fixes it
    if (res.ok) {
      document.getElementById("withdrawalBalance").textContent = `Available Balance ₹${data.commissionWallet}`;
      const tbody = document.querySelector("#withdrawal table tbody");
      tbody.innerHTML = "";

      withdrawalRequests.forEach((entry) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${entry.date}</td>
          <td>₹${entry.amount}</td>
          <td>****${entry.accountNumber.slice(-4)}</td>
          <td><span class="badge ${
            entry.status === "Completed"
              ? "badge-success"
              : "badge-warning"
          }">${entry.status}</span></td>
          <td>${entry.reference}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      showAlert("error", data.message || "Could not load withdrawal history");
    }
  } catch (error) {
    console.error(error);
    showAlert("error", "Failed to fetch withdrawal history");
  }
}


// Subscription functions
async function upgradePlan() {
    showLoading();

    try {
        const response = await fetch("/api/v1/user/upgrade", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("accessToken")}`
            },
            body: JSON.stringify({
                plan: selectedPlanData.name,
                amount: selectedPlanData.price,
                paymentMethod: "wallet" // or "upi", etc.
            })
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            showAlert("error", data.message || "Upgrade failed");
            return;
        }

        closeModal("upgradeModal");
        showAlert("success", "Subscription upgraded successfully!");
        // Optionally: reload subscription section
    } catch (error) {
        hideLoading();
        console.error(error);
        showAlert("error", "Something went wrong");
    }
}




async function cancelSubscription() {
  showLoading();

  try {
    const res = await fetch("/api/v1/subscription/cancel", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    hideLoading();

    if (res.ok) {
      currentUser.subscriptionStatus = "cancelled"; // Optional
      closeModal("cancelModal");
      showAlert("warning", "Subscription cancelled. You’ll receive a confirmation email.");
    } else {
      showAlert("error", data.message || "Cancellation failed");
    }
  } catch (err) {
    hideLoading();
    showAlert("error", "Server error during cancellation");
  }
}


// Profile functions
function updateProfile(event) {
  event.preventDefault();
  const name = document.getElementById("profileName").value;
  const email = document.getElementById("profileEmail").value;
  const phone = document.getElementById("profilePhone").value;

  showLoading();

  setTimeout(() => {
    hideLoading();
    currentUser.name = name;
    currentUser.email = email;
    loadUserData();
    showAlert("success", "Profile updated successfully!");
  }, 1500);
}

function changePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    showAlert("error", "New passwords do not match");
    return;
  }

  if (newPassword.length < 6) {
    showAlert("error", "Password must be at least 6 characters long");
    return;
  }

  showLoading();

  setTimeout(() => {
    hideLoading();
    showAlert("success", "Password changed successfully!");

    // Clear form
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  }, 1500);
}

function deleteAccount() {
  const confirmation = document.getElementById("deleteConfirmation").value;

  if (confirmation !== "DELETE") {
    showAlert("error", 'Please type "DELETE" to confirm account deletion');
    return;
  }

  showLoading();

  setTimeout(() => {
    hideLoading();
    closeModal("deleteAccountModal");
    showAlert(
      "success",
      "Account deletion request submitted. You will receive a confirmation email."
    );
  }, 2000);
}

// Logout function
// function logout() {
//   if (confirm("Are you sure you want to logout?")) {
//     showLoading();
//     setTimeout(() => {
//       // Redirect to login page
//       window.location.href = "/login";
//     }, 1000);
//   }
// }

// Toggle switches for notifications
( function () {
  const toggles = document.querySelectorAll('input[type="checkbox"]');
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", function () {
      const slider = this.nextElementSibling;
      if (this.checked) {
        slider.style.backgroundColor = "#667eea";
      } else {
        slider.style.backgroundColor = "#ccc";
      }
    });

    // Initialize toggle appearance
    const slider = toggle.nextElementSibling;
    if (toggle.checked) {
      slider.style.backgroundColor = "#667eea";
    }
  });
})();

// Add some CSS for toggle switches
const style = document.createElement("style");
style.textContent = `
            input[type="checkbox"]:checked + span:before {
                transform: translateX(26px);
            }
            
            input[type="checkbox"] + span:before {
                position: absolute;
                content: "";
                height: 26px;
                width: 26px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
        `;
document.head.appendChild(style);
let selectedPlan = null;


let selectedPlanData = {
    name: "",
    price: 0
};

function selectPlan(planName, price) {
    // Highlight selected card
    const allCards = document.querySelectorAll(".card[data-plan]");
    allCards.forEach(card => card.classList.remove("selected-plan"));

    const selectedCard = document.querySelector(`.card[data-plan="${planName}"]`);
    if (selectedCard) {
        selectedCard.classList.add("selected-plan");
    }

    // Save selected plan details globally
    selectedPlanData.name = planName;
    selectedPlanData.price = price;

    // Update modal content dynamically
    document.querySelector("#upgradeModal h3").innerText = `₹${price}/month`;
    document.querySelector("#upgradeModal p").innerText = `You'll be charged ₹${price} immediately for the ${planName} plan.`;

    // Show modal
    showModal('upgradeModal');
}
