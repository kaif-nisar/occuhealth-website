// Function to handle the password change

async function changePassword() {
    let _id = userId
    // Get the values from the form fields
    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    
    // Validation for empty fields
    if (!oldPassword || !newPassword || !confirmPassword) {
        alert("Please fill all the fields.");
        return;
    }

    // Check if the new password and confirm password match
    if (newPassword !== confirmPassword) {
        alert("New password and confirm password do not match.");
        return;
    }

    // Prepare the data to be sent to the backend
    const data = {
        password: oldPassword,
        newPassword: newPassword,
        // You can also pass user ID or any other relevant data, for example:
    };
    // Send a request to the backend API
    const response = await fetch(`${BASE_URL}/api/v1/user/change-password?_id=${_id}`, {
        method: 'PUT', // or 'POST' depending on your API design
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    // Parse the response
    const result = await response.json();
    console.log(result)
    // Handle success or failure
    if (result.success) {
        alert("Password changed successfully!");
    } else {
        alert("Failed to change password: " + result.message);
    }
}

// Event listener for the submit button
document.getElementById("btn-submit").addEventListener("click", changePassword);
