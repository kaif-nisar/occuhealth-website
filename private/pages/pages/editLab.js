// Utility: Get labId from URL params
function getLabIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("Name");
}

// Prefill lab data
async function prefillLabForm(labId) {
console.log("Prefilling lab form for ID:", labId);
  try {
    const res = await fetch(`/api/v1/user/labs/${labId}`);
    if (!res.ok) throw new Error("Failed to fetch lab data");
    let data = await res.json();
    console.log("Lab data fetched:", data);
    data = data.data || data; // Adjust based on API response structure
    document.getElementById("lab-name").value = data.LabName || "";
    document.getElementById("address").value = data.LabAddress || "";
  } catch (err) {
    alert("Lab data load failed: " + err.message);
  }
}

// Submit edited lab data
async function submitLabEdit(e) {
  e.preventDefault();
  const labId = getLabIdFromUrl();
  const payload = {
    labId,
    LabName: document.getElementById("lab-name").value,
    LabAddress: document.getElementById("address").value,
  };

  try {
    const res = await fetch("/api/v1/user/labs/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.ok) {
      alert("Lab updated successfully!");
      // Optionally redirect or update UI
    } else {
      alert(result.message || "Update failed");
    }
  } catch (err) {
    alert("Error updating lab: " + err.message);
  }
}

// Attach events on DOM ready
prefillLabForm(getLabIdFromUrl());

document.querySelector(".submit-btn").addEventListener("click", submitLabEdit);
