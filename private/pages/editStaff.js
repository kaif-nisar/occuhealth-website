(async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const staffId = urlParams.get('staffId');
    const apiBase = "/api/v1/user";
    // Create Active/Inactive toggle and Delete Button
    const submissionCard = document.querySelector('.card:last-child form');
    const statusGroup = document.createElement('div');
    statusGroup.className = 'form-group';

    const isActiveCheckbox = document.createElement('input');
    isActiveCheckbox.type = 'checkbox';
    isActiveCheckbox.id = 'isActive';

    const isActiveLabel = document.createElement('label');
    isActiveLabel.setAttribute('for', 'isActive');
    isActiveLabel.textContent = 'Active';

    statusGroup.appendChild(isActiveCheckbox);
    statusGroup.appendChild(isActiveLabel);
    submissionCard.insertBefore(statusGroup, document.getElementById('submit'));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Staff';
    deleteBtn.className = 'submit-btn';
    deleteBtn.style.backgroundColor = 'red';
    deleteBtn.style.marginTop = '10px';
    submissionCard.appendChild(deleteBtn);

    // Pre-fill if staffId is present
    if (staffId) {
        // console.log(staffId)
        try {
            const res = await fetch(`${apiBase}/get-staff?staffId=${staffId}`);
            const data = await res.json();
            // console.log(data)
            document.getElementById('firstname').value = data.data.fullName.split(' ')[0] || '';
            document.getElementById('lastname').value = data.data.fullName.split(' ')[1] || '';
            document.getElementById('email').value = data.data.email;
            document.getElementById('phone').value = data.data.phoneNo;
            document.getElementById('username').value = data.data.username;
            document.getElementById('password').value = ''; // never fill password
            document.getElementById('stafftype').value = data.data.role === 'superAdmin' ? 'Admin' : 'Staff';
            document.getElementById('submission-date').value = data.data.createdAt?.split('T')[0];
            isActiveCheckbox.checked = data.data.isActive;

            // Permissions
            document.getElementById('canManageBookings').checked = data.data.permissions?.canManageBookings || false;
            document.getElementById('canManageCustomers').checked = data.data.permissions?.canManageUsers || false;
            document.getElementById('canManagePayments').checked = data.data.permissions?.canManagePayments || false;
            document.getElementById('canManageTest').checked = data.data.permissions?.canManageTest || false;

        } catch (err) {
            alert('Failed to load staff details');
        }
    }

    // Handle Submit
    document.getElementById('submit').addEventListener('click', async (e) => {
        e.preventDefault();

        const payload = {
            fullName: `${document.getElementById('firstname').value} ${document.getElementById('lastname').value}`.trim(),
            email: document.getElementById('email').value,
            phoneNo: document.getElementById('phone').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            role: document.getElementById('stafftype').value.toLowerCase(),
            isActive: isActiveCheckbox.checked,
            permissions: {
                canManageBookings: document.getElementById('canManageBookings').checked,
                canManageUsers: document.getElementById('canManageCustomers').checked,
                canManagePayments: document.getElementById('canManagePayments').checked,
                canManageStaff: document.getElementById('canManageTest').checked,
            }
        };

        try {
            const res = await fetch(staffId ? `${apiBase}/update-staff/${staffId}` : `${apiBase}/create`, {
                method: staffId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                alert(staffId ? 'Staff updated successfully' : 'Staff created successfully');
                if (!staffId) window.location.reload();
            } else {
                alert(result.message || 'Failed to save staff');
            }
        } catch (err) {
            alert('Error saving staff');
        }
    });

    // Handle Delete
    deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!staffId) return alert('Staff not selected');
        if (!confirm('Are you sure you want to delete this staff?')) return;

        try {
            const res = await fetch(`${apiBase}/delete-staff/${staffId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('Staff deleted successfully');
                window.location.href = 'superAdmin.html?page=staffActivity'; // Redirect after delete
            } else {
                alert('Failed to delete staff');
            }
        } catch (err) {
            alert('Error deleting staff');
        }
    });
})();
