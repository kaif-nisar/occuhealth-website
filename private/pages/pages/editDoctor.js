// Utility: Get doctorId from URL params
function getDoctorIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("Name");
}

// Prefill doctor data
async function prefillDoctorForm(Id) {
    try {
        const res = await fetch(`/api/v1/user/doctors/${Id}`);
        if (!res.ok) throw new Error("Failed to fetch doctor data");
        let data  = await res.json();
        data = data.data || data; // Adjust based on API response structure
        document.getElementById("firstname").value = data.firstName || "";
        document.getElementById("lastname").value = data.lastName || "";
        document.getElementById("dob").value = data.DOB ? data.DOB.split("T")[0] : "";
        document.getElementById("gender").value = data.gender || "";
        document.getElementById("specialization").value = data.specialization || "";
        document.getElementById("remarks").value = data.remarks || "";
        document.getElementById("address").value = data.address || "";
    } catch (err) {
        alert("Doctor data load failed: " + err.message);
    }
}

// Submit edited doctor data
async function submitDoctorEdit(e) {
    e.preventDefault();
    const doctorId = getDoctorIdFromUrl();
    const payload = {
        doctorId,
        firstname: document.getElementById("firstname").value,
        lastname: document.getElementById("lastname").value,
        dob: document.getElementById("dob").value,
        gender: document.getElementById("gender").value,
        specialization: document.getElementById("specialization").value,
        remarks: document.getElementById("remarks").value,
        address: document.getElementById("address").value,
    };

    try {
        const res = await fetch("/api/v1/user/doctors/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
            alert("Doctor updated successfully!");
            // Optionally redirect or update UI
        } else {
            alert(result.message || "Update failed");
        }
    } catch (err) {
        alert("Error updating doctor: " + err.message);
    }
}

// Attach events on DOM ready
// getDoctorIdFromUrl();
// const doctorId = 
// if (doctorId) {
    prefillDoctorForm(getDoctorIdFromUrl());
// }
    document.querySelector(".submit-btn button").addEventListener("click", submitDoctorEdit);