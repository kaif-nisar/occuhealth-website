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
    document.getElementById('status').value = data.adminDetails.userId.isActive ? 'true' : 'false';
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
  } catch (err) {
    alert('Failed to load user details');
  }
  document.getElementById("adminEditForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    data.pdfFormat = document.querySelector('input[name="format"]:checked').value;
    data.showprintsetting = document.getElementById('printsetting').checked;
    data.showtestdatabase = document.getElementById('testdatabase').checked;
    data.showRandomBtn = document.getElementById('randomResult').checked;


    // Optional: Attach `tenantId`, `_id`, or `refreshToken` if needed

    try {
      const response = await fetch(`/api/v1/user/update-model/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          paymentAmount: Number(document.getElementById('paymentAmount').value || 0),
          paymentMethod: document.getElementById('paymentMethod').value || 'manual',
          manualActivate: document.getElementById('manualActivate').checked,
          planType: document.getElementById('planType').value,
          price: Number(document.getElementById('price').value || 0),
          paymentStatus: document.getElementById('paymentStatus').value
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

