document.querySelector(".submit-btn button").addEventListener("click", async (e) => {
    e.preventDefault(); // Prevent default form submission

    const firstname = document.getElementById("firstname").value.trim();
    const lastname = document.getElementById("lastname").value.trim();
    if (!firstname || !lastname) {
        alert("First name and last name are required.");
        return;
    }

    // Collect form data
    const doctorData = {
        firstname,
        lastname,
        dob: document.getElementById("dob").value,
        gender: document.getElementById("gender").value,
        specialization: document.getElementById("specialization").value,
        remarks: document.getElementById("remarks").value,
        address: document.getElementById("address").value,
        userId
    };

    // Send data to the backend
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/add-doctor`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`, // Include JWT if needed
            },
            body: JSON.stringify(doctorData), // Convert object to JSON
        });

        const data = await response.json();
        if (response.ok) {
            alert("Doctor added successfully!");
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error adding doctor:", error);
        alert("An error occurred. Please try again.");
    }
});
