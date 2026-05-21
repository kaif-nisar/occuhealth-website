function y () {
    const tbody = document.querySelector("#tbody");

    // Fetch data from backend
    fetch(`${BASE_URL}/api/v1/user/list-staff?userId=${userId}`) // Replace with your backend API endpoint
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(data.data.staff)
                tbody.innerHTML = ""; // Clear existing rows
                data.data.staff.forEach((staff, index) => {
                    // Create a new row for each staff member
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${staff.fullName}</td>
                            <td>${staff.phoneNo}</td>
                            <td>${staff.username}</td>
                            <td>${staff.email}</td>
                            <td>${staff.permissions.canManageBookings ? "Yes" : "No"}</td>
                            <td>${staff.permissions.canManagePayments ? "Yes" : "No"}</td>
                            <td>${staff.role}</td>
                            <td>
                                <a href="#" class="edit-link" onclick="loadPage('editStaff', '${staff._id}')">Edit</a>
                                <a href="#" class="active-link">${staff.isActive ? "Active" : "Inactive"}</a>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="9">No staff found</td></tr>`;
            }
        })
        .catch(err => {
            console.error("Error fetching staff data:", err);
            tbody.innerHTML = `<tr><td colspan="9">Error loading staff data</td></tr>`;
        });
}
y();
