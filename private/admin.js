// Global variables
let userId;
let role;
let username;
let userRole;
let user;
let BASE_URL = window.location.origin;
window.BASE_URL = BASE_URL;
const SUBSCRIPTION_POPUP_WARNING_DAYS = 5;

// ==========================================
// 🌓 THEME SYSTEM (Light / Dark Mode Persistence)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}
window.toggleTheme = toggleTheme;

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('themeIcon');
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeIcon) {
    if (theme === 'dark') {
      themeIcon.className = 'fa-solid fa-sun';
      if (themeBtn) themeBtn.title = 'Switch to Light Mode';
    } else {
      themeIcon.className = 'fa-solid fa-moon';
      if (themeBtn) themeBtn.title = 'Switch to Dark Mode';
    }
  }
}

// Initialize theme as soon as script runs
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// Help Dropdown Toggle (Directly attached under Help button, zero background dimming)
const helpDiv = document.querySelector(".help-div");
const helpPopup = document.getElementById("helpPopup");
const closeHelpBtn = document.getElementById("closeHelpBtn");

if (helpDiv && helpPopup) {
  helpDiv.addEventListener("click", (e) => {
    e.stopPropagation();
    const userPopup = document.getElementById("userPopup");
    const notificationContainer = document.getElementById("notificationContainer");
    if (userPopup) userPopup.style.display = "none";
    if (notificationContainer) notificationContainer.classList.remove("show");

    helpPopup.style.display = helpPopup.style.display === "block" ? "none" : "block";
  });

  if (closeHelpBtn) {
    closeHelpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      helpPopup.style.display = "none";
    });
  }

  document.addEventListener("click", (e) => {
    if (helpPopup.style.display === "block" && !helpDiv.contains(e.target) && !helpPopup.contains(e.target)) {
      helpPopup.style.display = "none";
    }
  });
}


function notifications() {
  const toggleBtn = document.querySelector('#toggleNotifications');
  if (!toggleBtn) return;

  toggleBtn.style.cursor = 'pointer';
  toggleBtn.addEventListener('click', (event) => {
    event.preventDefault();
    loadPage('notifications');
  });
}
notifications();

// Toggle sidebar functionality
function toggleSidebar() {
  const sidebar = document.getElementById("left-navbar");
  const mainContent = document.getElementById("content-box");
  const topNavbar = document.getElementById("top-navbar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar) return;

  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    const isOpen = sidebar.classList.toggle("mobile-open");
    if (backdrop) {
      if (isOpen) {
        backdrop.classList.add("show");
      } else {
        backdrop.classList.remove("show");
      }
    }
  } else {
    sidebar.classList.toggle("hidden");
    if (mainContent) mainContent.classList.toggle("collapsed");
    if (topNavbar) topNavbar.classList.toggle("collapsed");
  }
}

// Toggle submenu items
function toggleSubItems(id) {
  var subItems = document.getElementById(id);
  if (!subItems) return;
  var toggleItem = subItems.previousElementSibling;

  // Toggle the visibility of the sub-items
  if (subItems.style.display === "block") {
    subItems.style.display = "none";
    if (toggleItem) toggleItem.classList.remove("expanded");
  } else {
    subItems.style.display = "block";
    if (toggleItem) toggleItem.classList.add("expanded");
  }
}

// Logout functionality
function logout() {
  fetch(`${BASE_URL}/api/v1/user/logout`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) => {
      if (response.ok) {
        localStorage.clear();
        sessionStorage.clear();
        console.log("Logout successful");
        window.location.href = `${BASE_URL}/franchiseelogin.html`;
      } else {
        throw new Error("Logout failed");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

// Menu configuration based on user roles and tenant layers
const menuConfig = {
  // First layer admin - hide franchisee sections
  admin1layer: {
    hidden: [
      "Add_franchisse", "List_franchisse", "Accounts",
      "Assign_price", "Bulk_pricing", "Transfer_pricing",
      "Assign_credit", "Credit_history"
    ],
  },
  // Second layer admin - show all franchisee sections
  admin2layer: {
    hidden: [],
  },
  // Third layer admin - show all franchisee sections
  admin3layer: {
    hidden: [],
  },
  // Fourth layer admin - show all franchisee sections
  admin4layer: {
    hidden: [],
  },
  franchisee: {
    // All sections visible for franchisee
    hidden: [],
  },
  staff: {
    // Hide management sections for staff
    hidden: [
      "Add_staff", "List_staff", "Add_lab",
      "List_lab", "Add_doctor", "List_doctor",
    ],
  },
};

/**
 * Apply staff permissions to hide/show menu items and pages
 * @param {Object} user - User object with permissions
 */
function applyStaffPermissions(user) {
  // Only apply for staff role
  if (user.role !== 'staff') {
    console.log('Not a staff user, skipping permission checks');
    return;
  }

  console.log('Applying staff permissions:', user.permissions);

  const permissions = user.permissions || {};

  // Helper function to hide elements by data-page attribute
  function hidePageElements(pageName) {
    const elements = document.querySelectorAll(`[data-page="${pageName}"]`);
    elements.forEach(elem => {
      const parentLi = elem.closest('li');
      if (parentLi) {
        parentLi.style.display = 'none';
      }
    });
  }

  // Helper function to hide sections by ID
  function hideSectionById(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
      // Also hide the parent toggle button
      const parentItem = section.previousElementSibling;
      if (parentItem && parentItem.tagName === 'LI') {
        parentItem.style.display = 'none';
      }
    }
  }

  // Helper function to hide booking section headings
  function hideBookingSection(sectionName) {
    const headings = document.querySelectorAll('.booking-inner span.book_po');
    headings.forEach(heading => {
      if (heading.textContent.includes(sectionName)) {
        const bookingSection = heading.closest('.booking');
        if (bookingSection) {
          bookingSection.style.display = 'none';
        }
      }
    });
  }

  // ==========================================
  // 1. canManageBookings Permission
  // ==========================================
  if (!permissions.canManageBookings) {
    console.log('Hiding booking-related elements');
    
    // Hide new booking page
    hidePageElements('new_booking');
    hidePageElements('list_booking');
    
    // Hide cancel booking page
    hidePageElements('cancel_booking');
    
    // Hide cancelled bookings page
    hidePageElements('cancelled');
    
    // Hide manage booking section
    hideSectionById('manageBooking');
    
    // Hide generate bill section
    hideSectionById('subItems2');
    hidePageElements('generatebill');
    
    // Hide samples dropdown section (subItem001)
    hideSectionById('subItem001');
    
    // Hide top navbar booking button
    const topNavBookingBtns = document.querySelectorAll('.top-navbar [data-page="new_booking"]');
    topNavBookingBtns.forEach(btn => {
      const parentLi = btn.closest('li');
      if (parentLi) parentLi.style.display = 'none';
    });
  }

  // ==========================================
  // 2. canViewReports Permission
  // ==========================================
  if (!permissions.canViewReports) {
    console.log('Hiding reports-related elements');
    
    // Hide cases page
    hidePageElements('allcases');
    hidePageElements('list_booking');
    
    // Hide samples page
    hidePageElements('samples');
    
    // Hide top navbar cases button
    const topNavCasesBtns = document.querySelectorAll('.top-navbar [data-page="allcases"]');
    topNavCasesBtns.forEach(btn => {
      const parentLi = btn.closest('li');
      if (parentLi) parentLi.style.display = 'none';
    });
    
    // Hide top navbar samples button
    const topNavSamplesBtns = document.querySelectorAll('.top-navbar [data-page="samples"]');
    topNavSamplesBtns.forEach(btn => {
      const parentLi = btn.closest('li');
      if (parentLi) parentLi.style.display = 'none';
    });
  }

  // ==========================================
  // 3. canManageUsers Permission
  // ==========================================
  if (!permissions.canManageUsers) {
    console.log('Hiding user management elements');
    
    // Hide My Franchisee section and all sub-options
    hideSectionById('subItems-b');
    hidePageElements('Add_franchisse');
    hidePageElements('List_franchisse');
    hidePageElements('Accounts');
    
    // Hide Franchisee Price section
    hideSectionById('subItems-c');
    hidePageElements('Assign_price');
    hidePageElements('Bulk_pricing');
    
    // Hide Franchisee Credits section
    hideSectionById('subItems-d');
    hidePageElements('Assign_credit');
    hidePageElements('assignTarget');
    hidePageElements('franchiseeBusiness');
    hidePageElements('Credit_history');
    
    // Hide MY FRANCHISEE heading
    hideBookingSection('MY FRANCHISEE');
    
    // Hide orders page
    hidePageElements('Allorders');
    const topNavOrdersBtns = document.querySelectorAll('.top-navbar [data-page="Allorders"]');
    topNavOrdersBtns.forEach(btn => {
      const parentLi = btn.closest('li');
      if (parentLi) parentLi.style.display = 'none';
    });
    
    // Hide My Staff section and all sub-options
    hideSectionById('subItems-e');
    hidePageElements('Add_staff');
    hidePageElements('List_staff');
    hidePageElements('staffActivity');
    
    // Hide STAFF heading
    hideBookingSection('STAFF');
    
    // Hide Manage Doctors section
    hideSectionById('subItems5');
    hidePageElements('Add_doctor');
    hidePageElements('List_doctor');
    
    // Hide Manage Lab section
    hideSectionById('subItems6');
    hidePageElements('Add_lab');
    hidePageElements('List_lab');
    
    // Hide Manage Inventory section and all sub-options
    hideSectionById('subItems7');
    hidePageElements('inventory');
    hidePageElements('Addproduct');
  }

  // ==========================================
  // 4. canManagePayments Permission
  // ==========================================
  if (!permissions.canManagePayments) {
    console.log('Hiding payment-related elements');
    
    // Hide track ledger page
    hidePageElements('fullLedger');
    
    // Hide expense section
    hideSectionById('subItems8');
    hidePageElements('addexpense');
    hidePageElements('expense');
    
    // Hide budget category page
    hidePageElements('budgetCategory');
    
    // Hide remaining days page
    hidePageElements('refferDashboard');
    
    // Hide Franchisee Credits section
    hideSectionById('subItems-d');
    hidePageElements('Assign_credit');
    hidePageElements('assignTarget');
    hidePageElements('franchiseeBusiness');
    hidePageElements('Credit_history');
    
    // Hide Expense heading
    hideBookingSection('Expense');
  }

  // ==========================================
  // 5. canManageTest Permission
  // ==========================================
  if (!permissions.canManageTest) {
    console.log('Hiding test management elements');
    
    // Hide Test Database section and all sub-options
    const testDatabaseSection = document.getElementById('testdatabase');
    if (testDatabaseSection) {
      testDatabaseSection.style.display = 'none';
    }
    
    hideSectionById('subItem');
    hidePageElements('test');
    hidePageElements('addTestDocument');
    hidePageElements('testPackage');
    hidePageElements('testPanels');
    hidePageElements('category');
  }

  console.log('Staff permissions applied successfully');
}

// Function to check and hide print setting button on page load
// Call this function after loading any page
function checkAndHidePrintSettingButton(user) {
  if (user.role === 'staff' && user.permissions && !user.permissions.canManageTest) {
    const observer = new MutationObserver((mutations) => {
      const printSettingBtn = document.getElementById('printsettingbutton');
      if (printSettingBtn) {
        printSettingBtn.style.display = 'none';
        console.log('Print setting button hidden by observer');
      }
    });

    // Observe the content box for changes
    const contentBox = document.getElementById('content-box');
    if (contentBox) {
      observer.observe(contentBox, {
        childList: true,
        subtree: true
      });
    }
  }
}

function getSubscriptionSource(currentUser) {
  return currentUser?.tenantId?.subscriptionPlan || currentUser?.subscription || null;
}

function showVerificationBanner(currentUser) {
  if (window.initVerificationWidget) {
    window.initVerificationWidget(currentUser);
  }
}

function formatSubscriptionDate(dateValue) {
  if (!dateValue) return "";

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getSubscriptionMonthlyAmount(currentUser = user) {
  const source = getSubscriptionSource(currentUser);
  const rawAmount = Number(source?.price ?? source?.amount ?? currentUser?.subscription?.amount ?? 2000);
  return Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 2000;
}

function formatCurrencyINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function updateSubscriptionPlanSummary() {
  const durationSelect = document.getElementById('subscriptionDurationSelect');
  const summaryEl = document.getElementById('subscriptionPlanSummary');
  const payBtn = document.getElementById('razorpayPayBtn');

  const months = Math.max(1, Number(durationSelect?.value || 1));
  const monthlyAmount = getSubscriptionMonthlyAmount();
  const totalAmount = monthlyAmount * months;

  if (summaryEl) {
    summaryEl.textContent = `${formatCurrencyINR(monthlyAmount)} per month x ${months} = ${formatCurrencyINR(totalAmount)}`;
  }

  if (payBtn) {
    payBtn.textContent = `Pay ${formatCurrencyINR(totalAmount)} with Razorpay`;
  }

  return { months, monthlyAmount, totalAmount };
}

function getSubscriptionPopupState(subscription) {
  if (!subscription) {
    return {
      shouldShow: false,
      blocking: false,
      daysLeft: null,
      endDate: null,
      status: "unknown"
    };
  }

  const now = new Date();
  const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
  const hasValidEndDate = Boolean(endDate) && !Number.isNaN(endDate.getTime());
  const daysLeft = hasValidEndDate
    ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isInactive = subscription.isActive === false;
  const isExpiredByDate = hasValidEndDate ? endDate.getTime() < now.getTime() : false;
  const isExpired = isInactive || isExpiredByDate;
  const isExpiringSoon = !isExpired && typeof daysLeft === "number" && daysLeft <= SUBSCRIPTION_POPUP_WARNING_DAYS;

  return {
    shouldShow: isExpired || isExpiringSoon,
    blocking: isExpired,
    daysLeft: typeof daysLeft === "number" ? Math.max(0, daysLeft) : null,
    endDate: hasValidEndDate ? endDate : null,
    status: isExpired ? "expired" : (isExpiringSoon ? "expiring" : "active")
  };
}

// Verify token and extract user role with admin layer
async function verifyAccessToken() {
  try {
    const response = await fetch(`${BASE_URL}/api/verify-token`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Authentication failed");
      localStorage.clear();
      sessionStorage.clear();
      return false;
    }

    const data = await response.json();
    if (data.user.role === "staff") {
      userId = data.user.parentUser;
      username = data.user.username;
      role = data.user.createdBy?.role || data.user.role;
      userRole = data.user.role;
      user = data.user;
      // ✅ Staff should inherit parent user's PDF format
      if (data.user.createdBy?.pdfFormat) {
        user.pdfFormat = data.user.createdBy.pdfFormat;
      }
      showVerificationBanner(user);
      const activeLogoSrc = (user && user.tenantId && user.tenantId.logo) ? user.tenantId.logo : '/logoPng.png';
      const logoEl = document.getElementById('logo');
      if (logoEl) logoEl.src = activeLogoSrc;
      console.log("Staff user role:");
      usericon(user);
    } else {
      console.log("User role:");
      userId = data.user._id;
      username = data.user.username;
      role = data.user.role;
      userRole = data.user.role;
      user = data.user;
      showVerificationBanner(user);
      const activeLogoSrc = (user && user.tenantId && user.tenantId.logo) ? user.tenantId.logo : '/logoPng.png';
      const logoEl = document.getElementById('logo');
      if (logoEl) logoEl.src = activeLogoSrc;
      usericon(user);
    }
    // console.log("userdetails:", user);

    // Check if the user is an admin and extract the layer if available
    // If adminLayer is not provided in the API response, we can check localStorage
    // Or you can modify your backend to include this information
    if (role === "admin") {
      // Try to get adminLayer from localStorage or API response
      const adminLayer = data.user.tenantId.modelType;
      console.log("Admin layer:", adminLayer);
      role = `admin${adminLayer}`;
    }

    // console.log("User role with layer:", role);

    // Initialize menu based on the role
    initializeMenu(role);
    console.log("Menu initialized for role:", data);
    
    // Apply staff permissions if user is staff
    if (userRole === 'staff') {
      applyStaffPermissions(user);
      // Start observer for print setting button
      checkAndHidePrintSettingButton(user);
    }
    
    const subscriptionState = getSubscriptionPopupState(getSubscriptionSource(data.user));

    try {
      if (subscriptionState.shouldShow) {
        showSubscriptionModal(subscriptionState);
      }
    } catch (e) {
      console.warn('Subscription check failed', e);
    }

    return data.isAuthorized;
  } catch (error) {
    console.error("Error verifying token:", error);
    return false;
  }
}

// Logo Upload Modal & Handler
function openLogoUploadModal() {
  const modal = document.getElementById('logoUploadModal');
  const statusEl = document.getElementById('logoUploadStatus');
  const fileInput = document.getElementById('labLogoFileInput');
  const preview = document.getElementById('logoUploadPreview');
  const activeLogo = (user && user.tenantId && user.tenantId.logo) ? user.tenantId.logo : '/logoPng.png';

  if (fileInput) fileInput.value = '';
  if (preview) preview.src = activeLogo;
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }
  if (modal) modal.style.display = 'flex';
}

function closeLogoUploadModal() {
  const modal = document.getElementById('logoUploadModal');
  if (modal) modal.style.display = 'none';
}

async function submitLogoUpload() {
  const fileInput = document.getElementById('labLogoFileInput');
  const statusEl = document.getElementById('logoUploadStatus');
  const saveBtn = document.getElementById('saveLogoUploadBtn');

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Please choose a logo file first.';
    }
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 5 * 1024 * 1024) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'File is too large. Max size is 5MB.';
    }
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
  }
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#2563eb';
    statusEl.textContent = 'Uploading lab logo to server...';
  }

  try {
    const formData = new FormData();
    formData.append('logo', file);

    if (user) {
      formData.append('fullName', user.fullName || user.username || 'Admin');
      formData.append('clinicName', user.clinicName || user.fullName || 'Occuhealth Lab');
      formData.append('address', user.address || '');
      formData.append('phoneNo', user.phoneNo || '');
      formData.append('email', user.email || '');
      formData.append('username', user.username || '');
      formData.append('password', user.password || '');
      formData.append('isActive', String(Boolean(user.isActive !== false)));
    }

    const targetUserId = user?._id || userId;
    const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-update?_id=${encodeURIComponent(targetUserId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || localStorage.getItem('accessToken') || '')
      },
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to update logo');
    }

    const newLogo = result.data?.tenantId?.logo || result.data?.logo;
    if (newLogo) {
      if (user && user.tenantId) user.tenantId.logo = newLogo;
      const logoEl = document.getElementById('logo');
      const previewEl = document.getElementById('logoUploadPreview');
      if (logoEl) logoEl.src = newLogo;
      if (previewEl) previewEl.src = newLogo;
    }

    if (statusEl) {
      statusEl.style.color = '#10b981';
      statusEl.textContent = 'Logo updated successfully!';
    }

    setTimeout(() => {
      closeLogoUploadModal();
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Upload & Apply';
      }
    }, 1200);
  } catch (err) {
    console.error('Logo upload error:', err);
    if (statusEl) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = err.message || 'Upload failed. Please try again.';
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Upload & Apply';
    }
  }
}

// Live file selection preview
window.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('labLogoFileInput');
  const preview = document.getElementById('logoUploadPreview');
  if (fileInput && preview) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

async function usericon(user) {
  const userAvatar = document.getElementById("userAvatar");
  const userPopup = document.getElementById("userPopup");

  if (user.showtestdatabase === false) {
    const testDbEl = document.getElementById('testdatabase');
    if (testDbEl) testDbEl.style.display = "none";
  }

  if (user.tenantId && user.tenantId.modelType === "1layer") {
    const divs = document.querySelectorAll('.forhide');
    divs.forEach(elem => {
      elem.style.display = "none";
    });
  }

  // Update logo: Use client lab logo or default Occuhealth logo
  const logoImg = document.getElementById('logo');
  const previewImg = document.getElementById('logoUploadPreview');
  const activeLogo = (user && user.tenantId && user.tenantId.logo) ? user.tenantId.logo : '/logoPng.png';
  if (logoImg) logoImg.src = activeLogo;
  if (previewImg) previewImg.src = activeLogo;

  // Toggle popup on avatar click
  if (userAvatar && userPopup) {
    userAvatar.addEventListener("click", (e) => {
      e.stopPropagation();
      userPopup.style.display = userPopup.style.display === "block" ? "none" : "block";
    });

    // Close popup if click happens outside
    document.addEventListener("click", (e) => {
      if (!userAvatar.contains(e.target) && !userPopup.contains(e.target)) {
        userPopup.style.display = "none";
      }
    });
  }

  // Wire up popup logout button to real logout
  const popupLogoutBtn = document.getElementById("logoutBtn");
  if (popupLogoutBtn) {
    popupLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  if (user.fullName && document.getElementById("userName")) {
    document.getElementById("userName").textContent = user.fullName;
  }
  if (user.email && document.getElementById("userEmail")) {
    document.getElementById("userEmail").textContent = user.email;
  }
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Cdefs%3E%3ClinearGradient id='avatarGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%231d4ed8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='64' cy='64' r='64' fill='url(%23avatarGrad)'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23ffffff' opacity='0.95'/%3E%3Cpath d='M24 108c0-22.1 17.9-40 40-40s40 17.9 40 40z' fill='%23ffffff' opacity='0.95'/%3E%3C/svg%3E";
  const avatarSmall = document.getElementById("userAvatarImg");
  const avatarLarge = document.getElementById("popupAvatar");
  const avatarSrc = user.profileimage || defaultAvatar;
  if (avatarSmall) avatarSmall.src = avatarSrc;
  if (avatarLarge) avatarLarge.src = avatarSrc;
}

// Function to initialize menu based on user role and tenant layer
function initializeMenu(userRole) {
  console.log("Initializing menu for role:", userRole);

  // Parse the role to determine if it's admin with layer
  let role = userRole; // Default to admin1 if undefined

  // Check if role is in the menuConfig, otherwise default to admin1
  if (!menuConfig[role]) {
    role = "admin1layer";
  }

  // Extract the layer number from the role (if it's an admin role)
  let layerNumber = 1;
  if (role.startsWith("admin") && role.length > 5) {
    layerNumber = parseInt(role.substring(5)) || 1;
  }

  // Get the hidden items for this role
  const hiddenItems = menuConfig[role]?.hidden || [];
  console.log("Items to hide:", hiddenItems);

  // Hide menu items based on role
  hiddenItems.forEach((itemId) => {
    const menuItems = document.querySelectorAll(`[data-page="${itemId}"]`);
    console.log(`Looking for items with data-page="${itemId}"`, menuItems.length);

    menuItems.forEach((item) => {
      // Find the parent li element
      const parentLi = item.closest("li");
      if (parentLi) {
        parentLi.style.display = "none";
        console.log(`Hidden: ${itemId}`);
      }
    });
  });

  // Only hide franchisee sections for admin1
  if (role === "admin1layer") {
    // Franchisee sections to hide
    const franchiseeSections = [
      "subItems-b", "subItems-c", "subItems-d"
    ];

    // Hide the sections and their headers
    franchiseeSections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "none";
        // Also hide the parent menu item that toggles this section
        const parentItem = section.previousElementSibling;
        if (parentItem && parentItem.tagName === "LI") {
          parentItem.style.display = "none";
        }
      }
    });

    // Also hide the FRANCHISEE heading
    const franchiseeHeadings = document.querySelectorAll('.booking-inner span.book_po');
    franchiseeHeadings.forEach(heading => {
      if (heading.textContent.includes("FRANCHISEE")) {
        const bookingSection = heading.closest('.booking');
        if (bookingSection) {
          bookingSection.style.display = "none";
        }
      }
    });
  } else {
    // For admin2, admin3, admin4, ensure franchisee sections are visible
    const franchiseeSections = [
      "subItems-b", "subItems-c", "subItems-d"
    ];

    franchiseeSections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "none"; // Initially hide, will be toggled when needed
        // Make sure the parent menu item is visible
        const parentItem = section.previousElementSibling;
        if (parentItem && parentItem.tagName === "LI") {
          parentItem.style.display = "block";
          parentItem.style.display = "flex"
        }
      }
    });

    // Make sure the FRANCHISEE heading is visible
    const franchiseeHeadings = document.querySelectorAll('.booking-inner span.book_po');
    franchiseeHeadings.forEach(heading => {
      if (heading.textContent.includes("MY FRANCHISEE")) {
        const bookingSection = heading.closest('.booking');
        if (bookingSection) {
          bookingSection.style.display = "block";
          bookingSection.style.display = "flex";
        }
      }
    });
  }

  // Display username and role with layer information
  const nameElement = document.querySelector(".name_text");
  const roleElement = document.querySelector(".nt1");

  if (nameElement) {
    nameElement.textContent = username || "User";
  }

  if (roleElement) {
    // For admin roles, include the layer number in the display
    if (userRole.startsWith("staff")) {
      roleElement.textContent = `(STAFF - LAYER ${layerNumber})`;
    }
    // For franchisee roles, include the layer number in the display
    else if (userRole.startsWith("admin")) {
      roleElement.textContent = `(ADMIN - LAYER ${layerNumber})`;
    } else {
      // For other roles, just display the role in uppercase
      roleElement.textContent = `(${userRole.toUpperCase()})`;
    }
  }
}

// --- Subscription modal helpers ---
let __subscriptionHandlers = { keydown: null, click: null, overlay: null };

// Razorpay Payment Function
async function initiateRazorpayPayment(amount = 2000, planDuration = 30, durationMonths = 1, monthlyAmount = amount) {
  try {
    // Get current user data
    if (!user || !user._id) {
      alert('User data not available. Please login again.');
      return;
    }

    // Fetch Razorpay key from backend
    let razorpayKeyId = 'rzp_live_BLJaEhSZ2BjJH5'; // Fallback key
    try {
      const keyResponse = await fetch(`${BASE_URL}/api/config/razorpay-key`, {
        credentials: 'include'
      });
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        razorpayKeyId = keyData.key_id || razorpayKeyId;
      }
    } catch (err) {
      console.warn('Could not fetch Razorpay key from backend, using fallback:', err);
    }

    // 1. Create order from backend
    const response = await fetch(`${BASE_URL}/api/v1/user/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        durationMonths,
        monthlyAmount
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to create order');
    }

    // 2. Initialize Razorpay Checkout
    const options = {
      key: razorpayKeyId,
      amount: data.order.amount, // Amount in paisa
      currency: 'INR',
      name: 'Lab Management System',
      description: `Subscription Renewal (${planDuration} days)`,
      order_id: data.order.id,
      prefill: {
        name: user.fullName || 'User',
        email: user.email || '',
        contact: user.phoneNo || ''
      },
      theme: {
        color: '#4361ee'
      },
      handler: async function (response) {
        // 3. Verify payment on backend
        const verifyResponse = await fetch(`${BASE_URL}/api/v1/user/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            durationMonths,
            monthlyAmount,
            amount
          })
        });

        const verifyData = await verifyResponse.json();
        if (verifyData.success) {
          showPaymentSuccess('✅ Subscription renewed successfully!');
          // Wait 2 seconds then reload user data
          setTimeout(async () => {
            await verifyAccessToken();
            hideSubscriptionModal();
          }, 2000);
        } else {
          showPaymentError('❌ Payment verification failed: ' + verifyData.message);
        }
      },
      modal: {
        ondismiss: function() {
          showPaymentError('❌ Payment cancelled by user');
        }
      }
    };

    // Open Razorpay checkout
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Payment initiation error:', error);
    showPaymentError('Payment failed: ' + error.message);
  }
}

function showPaymentSuccess(message) {
  const statusDiv = document.getElementById('paymentStatus');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.color = 'green';
    statusDiv.style.fontWeight = '500';
  }
}

function showPaymentError(message) {
  const statusDiv = document.getElementById('paymentStatus');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.color = 'red';
    statusDiv.style.fontWeight = '500';
  }
}

function showSubscriptionModal(subscriptionState) {
  const modal = document.getElementById('subscriptionModal');
  if (!modal) return;

  const titleEl = document.getElementById('subscriptionModalTitle');
  const messageEl = document.getElementById('subscriptionModalMessage');
  const countdownBox = document.getElementById('subscriptionCountdownBox');
  const daysCountEl = document.getElementById('subscriptionDaysCount');
  const daysLabelEl = document.getElementById('subscriptionDaysLabel');
  const renewActions = document.getElementById('subscriptionRenewActions');
  const renewBtn = document.getElementById('subscriptionRenewBtn');
  const paymentSection = document.getElementById('subscriptionPaymentSection');
  const paymentMessage = document.getElementById('subscriptionPaymentMessage');
  const supportNote = document.getElementById('subscriptionSupportNote');
  const closeBtn = document.getElementById('subscriptionModalClose');
  const durationSelect = document.getElementById('subscriptionDurationSelect');

  hideSubscriptionModal();

  modal.style.display = 'flex';
  document.body.style.overflow = subscriptionState.blocking ? 'hidden' : '';

  if (closeBtn) {
    closeBtn.style.display = subscriptionState.blocking ? 'none' : 'block';
    closeBtn.onclick = subscriptionState.blocking ? null : () => hideSubscriptionModal();
  }

  if (renewBtn) {
    renewBtn.onclick = () => {
      hideSubscriptionModal();
      loadPage('refferDashboard');
    };
  }

  // Add Razorpay payment button handler
  const payBtn = document.getElementById('razorpayPayBtn');
  if (durationSelect) {
    durationSelect.onchange = updateSubscriptionPlanSummary;
  }
  updateSubscriptionPlanSummary();
  
  if (payBtn) {
    payBtn.onclick = () => {
      const plan = updateSubscriptionPlanSummary();
      initiateRazorpayPayment(plan.totalAmount, plan.months * 30, plan.months, plan.monthlyAmount);
    };
    
    // Check if Razorpay is globally enabled
    fetch('/api/v1/settings', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('accessToken') }
    }).then(res => res.json()).then(result => {
      if (result && result.data && result.data.isPaymentGatewayEnabled === false) {
        payBtn.style.display = 'none';
        const paymentMessage = document.getElementById('subscriptionPaymentMessage');
        if (paymentMessage) paymentMessage.textContent = 'Online payments are temporarily disabled. Please contact SuperAdmin for manual activation.';
      } else {
        payBtn.style.display = 'block';
      }
    }).catch(e => console.error(e));
  }

  if (subscriptionState.blocking) {
    if (titleEl) titleEl.textContent = 'Subscription Expired';
    if (messageEl) {
      const expiredOn = formatSubscriptionDate(subscriptionState.endDate);
      messageEl.textContent = expiredOn
        ? `Your subscription expired on ${expiredOn}. Please renew to continue using the platform.`
        : 'Your subscription has expired. Please renew to continue using the platform.';
    }
    if (countdownBox) countdownBox.style.display = 'none';
    if (renewActions) renewActions.style.display = 'none';
    if (paymentSection) paymentSection.style.display = 'block';
    if (paymentMessage) paymentMessage.textContent = 'Scan the UPI barcode above to pay, then upload your payment screenshot below.';
    if (supportNote) supportNote.textContent = 'Or contact SuperAdmin for manual activation if you paid by cash.';
  } else {
    if (titleEl) titleEl.textContent = 'Subscription Reminder';
    if (messageEl) {
      const expiryDate = formatSubscriptionDate(subscriptionState.endDate);
      messageEl.textContent = expiryDate
        ? `Your subscription will expire on ${expiryDate}. Renew before expiry to avoid interruption.`
        : 'Your subscription is close to expiry. Renew soon to avoid interruption.';
    }
    if (countdownBox) countdownBox.style.display = 'block';
    if (daysCountEl) daysCountEl.textContent = subscriptionState.daysLeft ?? 0;
    if (daysLabelEl) {
      daysLabelEl.textContent = subscriptionState.daysLeft === 1
        ? 'day remaining'
        : 'days remaining';
    }
    if (renewActions) renewActions.style.display = 'block';
    if (paymentSection) paymentSection.style.display = 'none';
    if (supportNote) supportNote.textContent = 'Open Remaining Days to review plan details and renew before expiry.';

    __subscriptionHandlers.overlay = function (e) {
      if (e.target === modal) {
        hideSubscriptionModal();
      }
    };
    modal.addEventListener('click', __subscriptionHandlers.overlay);
  }

  if (subscriptionState.blocking) {
    // Prevent closing via outside click or ESC
    __subscriptionHandlers.keydown = function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Block clicks that are outside modal-content
    __subscriptionHandlers.click = function (e) {
      const content = modal.querySelector('.modal-content');
      if (content && !content.contains(e.target)) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', __subscriptionHandlers.keydown, true);
    window.addEventListener('click', __subscriptionHandlers.click, true);

    // Start polling subscription status every 10 seconds
    if (window._subscriptionPollInterval) clearInterval(window._subscriptionPollInterval);
    window._subscriptionPollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/verify-token`, { method: 'GET', credentials: 'include' });
        if (!res.ok) return;

        const data = await res.json();
        const latestState = getSubscriptionPopupState(getSubscriptionSource(data.user));

        if (!latestState.shouldShow || !latestState.blocking) {
          hideSubscriptionModal();
          user = data.user;
          usericon(user);
          clearInterval(window._subscriptionPollInterval);
          window._subscriptionPollInterval = null;
        }
      } catch (err) {
        console.warn('Subscription poll error', err);
      }
    }, 10000);
  }
}

function hideSubscriptionModal() {
  const modal = document.getElementById('subscriptionModal');
  if (!modal) return;

  modal.style.display = 'none';
  document.body.style.overflow = '';

  if (__subscriptionHandlers.keydown) {
    window.removeEventListener('keydown', __subscriptionHandlers.keydown, true);
    __subscriptionHandlers.keydown = null;
  }
  if (__subscriptionHandlers.click) {
    window.removeEventListener('click', __subscriptionHandlers.click, true);
    __subscriptionHandlers.click = null;
  }
  if (__subscriptionHandlers.overlay) {
    modal.removeEventListener('click', __subscriptionHandlers.overlay);
    __subscriptionHandlers.overlay = null;
  }
  if (window._subscriptionPollInterval) {
    clearInterval(window._subscriptionPollInterval);
    window._subscriptionPollInterval = null;
  }
}


// Function to check authorization
async function checkAuthorization() {
  const isAuthorized = await verifyAccessToken();

  if (!isAuthorized) {
    window.location.href = `${BASE_URL}/index.html`;
    return false;
  }
  return true;
}

async function fetchNotificationsLegacy() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/user/getnewnotificationforadmin`);
    const data = await response.json();

    console.log("notification data:", data);

    if (!response.ok || data.status === "empty") {
      console.log(data.message);
      updateNotificationWidgets(0);
      return;
    }

    populatemessages(data);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    updateNotificationWidgets(0);
  }

  function populatemessages(data) {
    const alertdiv = document.querySelector('.alert-div');
    const messagescountspan = alertdiv.querySelector("#messageshint");
    const messagescontainer = alertdiv.querySelector("#notificationContainer");

    messagescountspan.textContent = data.length;
    messagescontainer.innerHTML = ""; // ✅ Clear old notifications before adding new ones

    data.forEach((elem) => {
      const div = document.createElement('div');
      div.className = 'notification'; // ✅ FIXED
      div.setAttribute("role", "alert");
      div.setAttribute("data-objId", elem._id);

      div.innerHTML = `
                <span class="deletemsg" style="cursor:pointer;">✖</span>
                <strong>Booking ID:</strong> <span>${elem.relatedbooking?.bookingId || "N/A"}</span><br>
                <strong>Last Message:</strong> <span>${elem.lastMessage?.message || "No message"}</span><br>
                <strong>Patient Name:</strong> <span>${elem.relatedbooking?.patientName || "N/A"}</span><br>
                <strong>Franchisee:</strong> <span>${elem.relatedbooking?.createdBy?.username || "N/A"}</span>
            `;

      const deletebtn = div.querySelector('.deletemsg');

      deletebtn.addEventListener('click', async function () {
        const objId = div.getAttribute("data-objId");
        try {
          const response = await fetch(`${BASE_URL}/api/v1/user/changewatchedstatus/${objId}`);
          if (response.ok) {
            console.log("Conversation updated successfully");
            div.remove();
            if (messagescontainer.children.length === 0) {
              messagescountspan.textContent = "";
              messagescontainer.classList.remove('show');
            } else {
              messagescountspan.textContent = messagescontainer.children.length;
            }
          }
        } catch (error) {
          console.error("Error updating conversation:", error.message);
        }
      });

      messagescontainer.appendChild(div);
    });
  }
}

function updateNotificationWidgets(count) {
  const headerBadge = document.getElementById("messageshint");
  const sidebarBadge = document.getElementById("sidebarNotificationsBadge");
  const container = document.getElementById("notificationContainer");
  const badgeText = count > 0 ? String(count) : "";

  if (headerBadge) headerBadge.textContent = badgeText;

  if (sidebarBadge) {
    sidebarBadge.textContent = badgeText;
    sidebarBadge.style.display = count > 0 ? "inline-block" : "none";
  }

  if (container && count === 0) {
    container.innerHTML = `<div class="notification" role="alert"><strong>No messages yet</strong></div>`;
    container.classList.remove("show");
  }
}

async function fetchNotifications() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/user/getnewnotificationforadmin`);
    const data = await response.json();

    if (!response.ok || data.status === "empty") {
      updateNotificationWidgets(0);
      return;
    }

    const alertdiv = document.querySelector('.alert-div');
    if (!alertdiv) return;

    const messagescontainer = alertdiv.querySelector("#notificationContainer");
    if (!messagescontainer) return;

    updateNotificationWidgets(data.length);
    messagescontainer.innerHTML = "";

    data.forEach((elem) => {
      const div = document.createElement('div');
      div.className = 'notification';
      div.setAttribute("role", "alert");
      div.setAttribute("data-objId", elem._id);

      div.innerHTML = `
                <span class="deletemsg" style="cursor:pointer;">âœ–</span>
                <strong>Booking ID:</strong> <span>${elem.relatedbooking?.bookingId || "N/A"}</span><br>
                <strong>Last Message:</strong> <span>${elem.lastMessage?.message || "No message"}</span><br>
                <strong>Patient Name:</strong> <span>${elem.relatedbooking?.patientName || "N/A"}</span><br>
                <strong>Franchisee:</strong> <span>${elem.relatedbooking?.createdBy?.username || "N/A"}</span>
            `;

      const deletebtn = div.querySelector('.deletemsg');

      deletebtn.addEventListener('click', async function () {
        const objId = div.getAttribute("data-objId");
        try {
          const response = await fetch(`${BASE_URL}/api/v1/user/changewatchedstatus/${objId}`);
          if (response.ok) {
            await fetchNotifications();
          }
        } catch (error) {
          console.error("Error updating conversation:", error.message);
        }
      });

      messagescontainer.appendChild(div);
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    updateNotificationWidgets(0);
  }
}

// Load page function
async function loadPage(page, Name, _id, BASE_URL, name) {
  console.log("user:", user);
  fetchNotifications();

  clearOldPage();

  // Prevent stale page assets from stacking up across navigation.
  document.querySelectorAll('script[data-dynamic-page-script="true"]').forEach((script) => script.remove());

  const assetVersion = String(Date.now());
  const container = document.querySelector(".content-box");
  if (container) container.classList.add("loading");

  fetch(`pages/pages/${page}.html?v=${assetVersion}`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.text();
    })
    .then((html) => {
      if (container) container.innerHTML = html;

      // Load associated scripts
      loadScript(`./editor.js?v=${assetVersion}`)
        .then(() => {
          // Script loaded successfully
        })
        .catch((error) => console.error(error));

      loadScript(`pages/pages/${page}.js?v=${assetVersion}`)
        .then(() => {
          // Script loaded successfully
          // Check for print setting button after page script loads
          if (user && user.role === 'staff') {
            checkAndHidePrintSettingButton(user);
          }
        })
        .catch((error) => console.error(error));

      // Handle query parameters
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set("page", page);
      if (Name) urlParams.set("Name", encodeURIComponent(Name));
      if (_id) urlParams.set("_id", encodeURIComponent(_id));
      if (name) urlParams.set("name", encodeURIComponent(name));
      window.history.pushState({ page }, "", `?${urlParams.toString()}`);

      // Highlight active menu item
      highlightActiveMenuItem(page);
    })
    .catch((error) => {
      console.error(error);
      if (container) {
        container.innerHTML = `<div class="error-message" style="text-align:center; padding:40px; color:#ef4444; font-weight:600;">
          <i class="fa-solid fa-triangle-exclamation text-3xl mb-3 block"></i>
          Failed to load page "${page}". Please check network or try again.
        </div>`;
      }
    })
    .finally(() => {
      if (container) container.classList.remove("loading");
    });
}

// Helper functions
function clearOldPage() {
  const container = document.querySelector(".content-box");
  if (!container) return;
  container.innerHTML = "";
  const oldScripts = container.querySelectorAll("script");
  oldScripts.forEach((script) => script.remove());
}

function highlightActiveMenuItem(page) {
  // Remove active class from all menu items
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    const mDash = item.closest(".m_dash");
    if (mDash) mDash.classList.remove("active");
  });

  // Add active class to current menu item
  const activeItems = document.querySelectorAll(
    `.nav-item[data-page="${page}"]`
  );
  activeItems.forEach((item) => {
    item.classList.add("active");
    const mDash = item.closest(".m_dash");
    if (mDash) mDash.classList.add("active");

    // Automatically expand parent subItem if this item is nested inside a sub-menu
    const parentSub = item.closest(".subItem");
    if (parentSub) {
      parentSub.style.display = "block";
      const trigger = parentSub.previousElementSibling;
      if (trigger) {
        trigger.classList.add("expanded");
      }
    }
  });
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.dynamicPageScript = "true";
    script.onload = () => resolve(script);
    script.onerror = (err) =>
      reject(new Error(`Failed to load script: ${url}`));
    document.body.appendChild(script);
  });
}

// Function to attach event listeners to menu items
function attachMenuEventListeners() {
  const navItems = document.querySelectorAll(".nav-item");
  let debounceTimeout;

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();

      // Close mobile drawer on item tap
      if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById("left-navbar");
        const backdrop = document.getElementById("sidebarBackdrop");
        if (sidebar) sidebar.classList.remove("mobile-open");
        if (backdrop) backdrop.classList.remove("show");
      }

      // Debounce clicks for smooth instantaneous response
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        const page = item.getAttribute("data-page");
        if (page) {
          loadPage(page);
        }
      }, 120);
    });
  });
}

// Debug function to help troubleshoot admin layers
function debugAdminLayer() {
  // Only run in development or when specifically enabled
  const isDebugMode = localStorage.getItem("debugMode") === "true" ||
    window.location.search.includes("debug=true");

  if (!isDebugMode) return;

  console.log("🔍 DEBUG MODE ACTIVE");

  // Create a debug panel
  const debugPanel = document.createElement("div");
  debugPanel.style.position = "fixed";
  debugPanel.style.bottom = "10px";
  debugPanel.style.right = "10px";
  debugPanel.style.backgroundColor = "rgba(0,0,0,0.8)";
  debugPanel.style.color = "white";
  debugPanel.style.padding = "10px";
  debugPanel.style.borderRadius = "5px";
  debugPanel.style.zIndex = "9999";
  debugPanel.style.fontSize = "12px";
  debugPanel.style.maxWidth = "300px";

  // Add layer selector
  const layerSelector = document.createElement("select");
  layerSelector.innerHTML = `
    <option value="1">Layer 1</option>
    <option value="2">Layer 2</option>
    <option value="3">Layer 3</option>
    <option value="4">Layer 4</option>
  `;

  // Set the current layer
  const currentLayer = localStorage.getItem("superFranchisee") || "2layer";
  layerSelector.value = currentLayer;

  // Add event listener to change layer
  layerSelector.addEventListener("change", (e) => {
    const newLayer = e.target.value;
    localStorage.setItem("superFranchisee", newLayer);

    // Update the UI immediately
    const roleWithLayer = `superFranchisee${newLayer}`;
    initializeMenu(roleWithLayer);

    // Update the debug info
    document.getElementById("current-role").textContent = roleWithLayer;
  });

  // Add debug info and controls
  debugPanel.innerHTML = `
    <div style="margin-bottom:10px;"><strong>Admin Layer Debug</strong></div>
    <div style="margin-bottom:5px;">Current Role: <span id="current-role">${userRole || "unknown"}</span></div>
    <div style="margin-bottom:5px;">Override Layer: </div>
  `;

  // Append the layer selector
  debugPanel.appendChild(layerSelector);

  // Add a button to reload the page
  const reloadButton = document.createElement("button");
  reloadButton.textContent = "Apply & Reload";
  reloadButton.style.marginTop = "10px";
  reloadButton.style.padding = "5px";
  reloadButton.style.width = "100%";
  reloadButton.addEventListener("click", () => {
    window.location.reload();
  });

  debugPanel.appendChild(reloadButton);

  // Add to page
  document.body.appendChild(debugPanel);
}

// Initialize when DOM is fully loaded
document.addEventListener("DOMContentLoaded", async function () {
  // Verify token and initialize user data
  await verifyAccessToken();

  // Add event listener to the logout button
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  // Set up event listeners for navbar items
  attachMenuEventListeners();

  // Load page from URL or default to dashboard
  const urlParams = new URLSearchParams(window.location.search);
  const currentPage = urlParams.get("page") || "dashboard";
  loadPage(currentPage);

  // Handle browser back/forward navigation
  window.addEventListener("popstate", (event) => {
    if (event.state) {
      loadPage(event.state.page);
    }
  });

  // Initialize debug tools if needed
  debugAdminLayer();
});

function loaderfunction() {
  const doc = document,
    types = ['circle', 'semi-circle', 'square', 'triangle', 'triangle-2', 'rectangle'],
    colors = ['#836ee5', '#fe94b4', '#49d2f5', '#ff5354', '#00b1b4', '#ffe465', '#0071ff', '#03274b'];

  let shapes = doc.querySelectorAll('.shape');

  shapes.forEach((shape, index) => {
    setInterval(() => {
      let cl = shape.classList;
      shape.className = 'shape'; // Reset all classes, keep base

      // assign styles
      cl.add(types[~~(Math.random() * types.length)]);
      let offset = ((Math.random() * 4)) - 2;
      let opp = offset >= 0 ? '+ ' : '- ';
      let styles = [
        ['left', 'calc(50% ' + opp + offset + 'vw)'],
        ['--bounce-variance', ((Math.random() * 20)) - 10 + 'vh'],
        ['--base_scale', ((Math.random() * 6)) + 4 + 'vh'],
        ['--rotation', ((Math.random() * 180)) - 90 + 'deg'],
        ['--color', colors[~~(Math.random() * colors.length)]]
      ];
      styles.forEach(style => shape.style.setProperty(style[0], style[1]));

      // animate
      if (!cl.contains('bounce-up')) cl.add('bounce-up');
      cl.replace('bounce-down', 'bounce-up');
      setTimeout(() => cl.replace('bounce-up', 'bounce-down'), 400);
    }, 740);
  });

}

loaderfunction();
