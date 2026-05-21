async function loadFranchisees() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`, // Include token if needed
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (data.success) {
            const franchiseesList = data.data; // Assuming data contains the franchisee array
            const tbody = document.querySelector('tbody');

            // Clear previous entries
            tbody.innerHTML = '';

            // Append new entries
            franchiseesList.forEach((franchisee, index) => {
                const row = `
                        <td>${index + 1}</td>
                        <td>${franchisee.fullName}<br><span style="color: red;">${franchisee.bookingLocked ? 'Booking Locked' : ''}</span></td>
                        <td>${franchisee.phoneNo}<br>${franchisee.email}</td>
                        <td>${franchisee.city}</td>
                        <td>${franchisee.state}</td>
                        <td>${franchisee.address}</td>
                        <td>${franchisee.username}<br>${franchisee.password}</td>
                          <td>
        <a href="#" onclick="loadPage('editFranchisee', '${franchisee._id}')">Edit</a>
        
    </td>
                    </tr>`;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error loading franchisees:', error);
    }
}

// Call this function on page load
loadFranchisees();
document.addEventListener('DOMContentLoaded', loadFranchisees);
