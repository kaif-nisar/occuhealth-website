function j() {
    document.getElementById("submit").addEventListener("click", function (event) {
        event.preventDefault();

        const fullName = document.getElementById("firstname").value;
        const lastname = document.getElementById("lastname").value;
        const email = document.getElementById("email").value;
        const phoneNo = document.getElementById("phone").value;
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const staffType = document.getElementById("stafftype").value;
        const submissionDate = document.getElementById("submission-date").value;

        const manageBooking = document.getElementById("canManageBookings").checked;
        const managePayments = document.getElementById("canManagePayments").checked;
        const manageTest = document.getElementById("canManageTest").checked;
        const manageCustomers = document.getElementById("canManageCustomers").checked;

        const permissions = {
            canManageBookings: manageBooking,
            canManagePayments: managePayments,
            canManageTest: manageTest,
            canManageUsers: manageCustomers
        };
        console.log(permissions);
        if (!fullName || !lastname || !email || !username || !password) {
            alert("Please fill all the required fields!");
            return;
        }

        const staffData = {
            fullName,
            lastname,
            email,
            phoneNo,
            username,
            password,
            staffType,
            submissionDate,
            permissions,
        };

        fetch(`${BASE_URL}/api/v1/user/add-super-staff`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(staffData),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert("Staff added successfully!");
                document.querySelectorAll("form").forEach(form => form.reset());
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert("Failed to add staff. Please try again.");
        });
    });
}
j();
