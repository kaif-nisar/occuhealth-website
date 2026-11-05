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
                    const isSales = staff.staffType === 'sales' || !!staff.salesDesignation;
                    const roleBadge = isSales 
                        ? `<span style="display:inline-block; padding: 2px 8px; border-radius: 12px; font-weight:600; font-size: 11px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;">Sales (${staff.salesDesignation || 'TH'})</span>`
                        : (staff.role || 'staff');

                    // Create a new row for each staff member
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${staff.fullName}</td>
                            <td>${staff.phoneNo}</td>
                            <td>${staff.username}</td>
                            <td>${staff.email}</td>
                            <td>${staff.permissions?.canManageBookings ? "Yes" : "No"}</td>
                            <td>${staff.permissions?.canManagePayments ? "Yes" : "No"}</td>
                            <td>${roleBadge}</td>
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
