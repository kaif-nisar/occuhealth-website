// Fetch the data from your API
async function getFranchiseeById(userId) {
    const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${userId}`);
    const data = await response.json();
    const franchiseeData = data.data;

    // Populate the form with the fetched data
    document.getElementById("currentUser").value = `${franchiseeData.fullName} (${franchiseeData.username})`;
    document.getElementById("clinicName").value = franchiseeData.fullName;  // Assuming the lab name is same as full name
    document.getElementById("address").value = franchiseeData.email;
    document.getElementById("firstName").value = franchiseeData.fullName.split(' ')[0];  // First name from fullName
    document.getElementById("lastName").value = franchiseeData.fullName.split(' ')[1];  // Last name from fullName
    document.getElementById("phoneNo").value = franchiseeData.phoneNo;
    document.getElementById("email").value = franchiseeData.email;
}

// Function to update the data after form submission
async function updateFranchiseeData() {
    const updatedData = {
        _id: document.getElementById("currentUser").value.split(' ')[1],  // Extract ID from current user value
        fullName: document.getElementById("firstName").value + ' ' + document.getElementById("lastName").value,
        address: document.getElementById("address").value,
        phoneNo: document.getElementById("phoneNo").value,
        email: document.getElementById("email").value,
        // Include any other fields that need to be updated
    };
    let _id = userId;

    const response = await fetch(`${BASE_URL}/api/v1/user/superfranchisee-update?_id=${_id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
    });

    const result = await response.json();
    if (result.success) {
        alert("Profile updated successfully!");
    } else {
        alert("Failed to update profile.");
    }
}

// Event listener for the Update button
document.getElementById("updateButton").addEventListener("click", updateFranchiseeData);

// Call getFranchiseeById with a sample user ID (replace with actual userId)
getFranchiseeById(userId);
