(async function () {
  // Get modelId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('modelId'); // yahi aapke user ki id hai
  if (!tenantId) return;

  // Preview thumbnails for each report format box.
  const formatPreviewMap = {
    format1: `${BASE_URL}/images/format1.png`,
    format2: `${BASE_URL}/images/format2.png`,
    format3: `${BASE_URL}/images/format3.png`,
    format4: `${BASE_URL}/images/format4.svg`,
  };

  Object.entries(formatPreviewMap).forEach(([className, imageUrl]) => {
    const el = document.querySelector(`.${className}`);
    if (el) {
      el.style.backgroundImage = `url("${imageUrl}")`;
    }
  });

  // Fetch user/admin details and pre-fill form
  try {
    const res = await fetch(`/api/v1/user/tenants-model/${tenantId}`);
    const { data } = await res.json();
    document.getElementById('fullName').value = data.adminDetails.userId.fullName || '';
    document.getElementById('username').value = data.adminDetails.userId.username || '';
    document.getElementById('email').value = data.adminDetails.userId.email || '';
    document.getElementById('role').value = data.adminDetails.userId.role || 'admin';
    document.getElementById('phoneNo').value = data.adminDetails.userId.phoneNo || '';
    document.getElementById('state').value = data.adminDetails.userId.state || '';
    document.getElementById('district').value = data.adminDetails.userId.district || '';
    document.getElementById('pinCode').value = data.adminDetails.userId.pinCode || '';
    document.getElementById('address').value = data.adminDetails.userId.address || '';
    document.getElementById('wallet').value = data.adminDetails.userId.wallet || 0;
    document.getElementById('status').value = data.adminDetails.userId.isActive ? 'active' : 'inactive';
    document.getElementById('printsetting').checked = data.adminDetails.userId.showprintsetting;
    document.getElementById('testdatabase').checked = data.adminDetails.userId.showtestdatabase;
    document.getElementById('randomResult').checked = data.adminDetails.userId.showRandomBtn;

    const formatIdMap = {
      reportFormat1: 'format1',
      reportFormat3: 'format2',
      reportFormat: 'format3',
      reportFormat4: 'format4',
    };
    const selectedFormatId = formatIdMap[data.adminDetails.userId.pdfFormat] || 'format1';
    const selectedFormatInput = document.getElementById(selectedFormatId);
    if (selectedFormatInput) {
      selectedFormatInput.checked = true;
    }

    // Subscription Info
    document.getElementById('planType').value = data.subscriptionPlan?.planType || 'monthly';
    document.getElementById('price').value = data.subscriptionPlan?.price || 0;
    document.getElementById('paymentStatus').value = data.subscriptionPlan?.paymentStatus || 'paid';

    // Dates & Status
    const startDate = data.subscriptionPlan?.startDate ? new Date(data.subscriptionPlan.startDate) : null;
    const endDate = data.subscriptionPlan?.endDate ? new Date(data.subscriptionPlan.endDate) : null;
    
    if (startDate) {
      document.getElementById('customStartDate').value = startDate.toISOString().split('T')[0];
    }
    if (endDate) {
      document.getElementById('customEndDate').value = endDate.toISOString().split('T')[0];
    }

    if (startDate && endDate) {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      document.getElementById('customDays').value = diffDays;
    }

    const badge = document.getElementById('subStatusBadge');
    if (badge) {
      if (endDate && endDate > new Date()) {
        badge.textContent = 'Active';
        badge.className = 'sub-status status-active';
      } else {
        badge.textContent = 'Expired';
        badge.className = 'sub-status status-expired';
      }
    }
  } catch (err) {
    alert('Failed to load user details');
  }

  // Password Toggle & Generate
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const generatePasswordBtn = document.getElementById('generatePasswordBtn');
  
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      this.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  if (generatePasswordBtn && passwordInput) {
    generatePasswordBtn.addEventListener('click', function () {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let pass = "";
      for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
      passwordInput.value = pass;
      passwordInput.setAttribute('type', 'text');
      if (togglePassword) togglePassword.textContent = '🙈';
    });
  }

  // Auto calculate dates
  const customStartDate = document.getElementById('customStartDate');
  const customDays = document.getElementById('customDays');
  const customEndDate = document.getElementById('customEndDate');
  const quickDuration = document.getElementById('quickDuration');

  function getLocalDateString() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  }

  if (quickDuration) {
    quickDuration.addEventListener('change', function () {
      const days = parseInt(this.value, 10);
      if (days && customStartDate && customDays) {
        customStartDate.value = getLocalDateString();
        customDays.value = days;
        calculateEndDate();
      }
    });
  }

  function calculateEndDate() {
    if (customStartDate && customDays && customStartDate.value && customDays.value) {
      const start = new Date(customStartDate.value);
      const days = parseInt(customDays.value, 10);
      const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
      if (customEndDate) customEndDate.value = end.toISOString().split('T')[0];
    }
  }

  function calculateDays() {
    if (customEndDate && customEndDate.value) {
      if (customStartDate && !customStartDate.value) {
        customStartDate.value = getLocalDateString();
      }
      const start = new Date(customStartDate.value);
      const end = new Date(customEndDate.value);
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (customDays) customDays.value = diffDays >= 0 ? diffDays : 0;
    }
  }

  if (customStartDate) customStartDate.addEventListener('change', calculateEndDate);
  
  if (customDays) {
    customDays.addEventListener('input', function() {
      // Force start date to today when days are manually entered, per client request
      if (customStartDate) {
        customStartDate.value = getLocalDateString();
      }
      calculateEndDate();
    });
  }
  
  if (customEndDate) customEndDate.addEventListener('change', calculateDays);

  document.getElementById("adminEditForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    const formatChecked = document.querySelector('input[name="format"]:checked');
    if (formatChecked) {
      data.pdfFormat = formatChecked.value;
    }
    
    data.showprintsetting = document.getElementById('printsetting')?.checked || false;
    data.showtestdatabase = document.getElementById('testdatabase')?.checked || false;
    data.showRandomBtn = document.getElementById('randomResult')?.checked || false;

    // Optional: Attach `tenantId`, `_id`, or `refreshToken` if needed

    try {
      const response = await fetch(`/api/v1/user/update-model/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          isActive: document.getElementById('status')?.value === 'active',
          paymentAmount: Number(document.getElementById('paymentAmount')?.value || 0),
          paymentMethod: document.getElementById('paymentMethod')?.value || 'manual',
          manualActivate: document.getElementById('manualActivate')?.checked || false,
          planType: document.getElementById('planType')?.value || 'monthly',
          price: Number(document.getElementById('price')?.value || 0),
          paymentStatus: document.getElementById('paymentStatus')?.value || 'paid',
          password: document.getElementById('password')?.value || undefined,
          customStartDate: document.getElementById('customStartDate')?.value || undefined,
          customEndDate: document.getElementById('customEndDate')?.value || undefined
        }),
      });

      const result = await response.json();
      alert(result.message || "Updated successfully!");
    } catch (err) {
      console.error("Update failed", err);
      alert("Update failed. Check console.");
    }
  });
})();
