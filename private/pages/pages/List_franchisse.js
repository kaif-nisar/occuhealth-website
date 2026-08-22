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
            const franchiseesList = data.message; // Assuming data contains the franchisee array
            const tbody = document.querySelector('#tbody');
            // Clear previous entries
            tbody.innerHTML = '';

            // Append new entries
            franchiseesList.forEach((franchisee, index) => {
                let row = document.createElement('tr');
                row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${franchisee.fullName}<br><span style="color: red;">${franchisee.bookingLocked ? 'Booking Locked' : ''}</span></td>
                        <td>${franchisee.phoneNo}<br>${franchisee.email}</td>
                        <td>${franchisee.city}</td>
                        <td>${franchisee.state}</td>
                        <td>${franchisee.address}</td>
                        <td>${franchisee.username}</td>
                        <td style="white-space: nowrap;">
                            <a href="#" onclick="loadPage('editFranchisee', '${franchisee._id}')">Edit</a><br>
                            <span class="status-link" style="color: ${franchisee.isActive ? 'green' : 'red'};">
                                ${franchisee.isActive ? 'Active' : 'Inactive'}
                            </span><br>
                            <button class="lock-btn" onclick="toggleFranchiseeLock('${franchisee._id}', ${franchisee.isActive})"
                                style="margin-top:5px; padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; color:#fff; ${franchisee.isActive ? 'background:#dc2626;' : 'background:#0f766e;'}">
                                ${franchisee.isActive ? '🔒 Lock' : '🔓 Unlock'}
                            </button>
                        </td>`;

                tbody.appendChild(row);
            });
        } else {
            alert(data.message);
            console.log(data.message)
        }
    } catch (error) {
        console.error('Error loading franchisees:', error);
    }
}

// Toggle franchisee Lock/Unlock status
async function toggleFranchiseeLock(franchiseeId, currentIsActive) {
    const newStatus = !currentIsActive; // true = unlock, false = lock
    const confirmMsg = newStatus
        ? 'क्या आप इस फ्रेंचाइजी को Unlock करना चाहते हैं?'
        : 'क्या आप इस फ्रेंचाइजी को Lock करना चाहते हैं? (लॉक होने पर फ्रेंचाइजी log in नहीं कर पाएगा)';

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/toggle-franchisee-status/${franchiseeId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isActive: newStatus }),
        });

        const data = await response.json();
        if (data.success) {
            alert(data.message);
            // Reload the list to show updated status
            loadFranchisees();
        } else {
            alert(data.message || 'Failed to update franchisee status');
        }
    } catch (error) {
        console.error('Error toggling franchisee status:', error);
        alert('Something went wrong. Please try again.');
    }
}

// Call this function on page load
loadFranchisees();