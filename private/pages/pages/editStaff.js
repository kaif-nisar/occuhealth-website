(async function () {
            const urlParams = new URLSearchParams(window.location.search);
            const staffId = urlParams.get('staffId');
            const apiBase = "/api/v1/user";

            const isActiveCheckbox = document.getElementById('isActive');
            const statusText = document.getElementById('statusText');

            // Update status text when toggle changes
            isActiveCheckbox.addEventListener('change', function () {
                statusText.textContent = this.checked ? 'Active' : 'Inactive';
                statusText.style.color = this.checked ? '#28a745' : '#6c757d';
            });

            // Pre-fill if staffId is present
            if (staffId) {
                try {
                    const res = await fetch(`${apiBase}/get-staff-tenant?staffId=${staffId}`);
                    const data = await res.json();

                    const nameParts = data.data.fullName.split(' ');
                    document.getElementById('firstname').value = nameParts[0] || '';
                    document.getElementById('lastname').value = nameParts.slice(1).join(' ') || '';
                    document.getElementById('email').value = data.data.email;
                    document.getElementById('phone').value = data.data.phoneNo;
                    document.getElementById('username').value = data.data.username;
                    document.getElementById('password').value = ''; // never fill password
                    document.getElementById('stafftype').value = data.data.role === 'superAdmin' ? 'Admin' : 'Staff';
                    document.getElementById('submission-date').value = data.data.createdAt?.split('T')[0];

                    // Set active status
                    isActiveCheckbox.checked = data.data.isActive;
                    statusText.textContent = data.data.isActive ? 'Active' : 'Inactive';
                    statusText.style.color = data.data.isActive ? '#28a745' : '#6c757d';

                    // Permissions
                    document.getElementById('canManageBookings').checked = data.data.permissions?.canManageBookings || false;
                    document.getElementById('canManageCustomers').checked = data.data.permissions?.canManageUsers || false;
                    document.getElementById('canManagePayments').checked = data.data.permissions?.canManagePayments || false;
                    document.getElementById('canManageTest').checked = data.data.permissions?.canManageTest || false;
                    document.getElementById('canManageReports').checked = data.data.permissions?.canViewReports || false;

                } catch (err) {
                    alert('Failed to load staff details');
                }
            } else {
                // Set default status for new staff
                isActiveCheckbox.checked = true;
                statusText.textContent = 'Active';
                statusText.style.color = '#28a745';
            }

            // Handle Submit/Update
            document.getElementById('submit').addEventListener('click', async (e) => {
                e.preventDefault();

                const firstname = document.getElementById('firstname').value;
                const lastname = document.getElementById('lastname').value;
                const fullName = `${firstname} ${lastname}`.trim();
                const email = document.getElementById('email').value;
                const phoneNo = document.getElementById('phone').value;
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const staffType = document.getElementById('stafftype').value;

                if (!firstname || !lastname || !email || !username) {
                    alert("Please fill all the required fields!");
                    return;
                }

                const payload = {
                    fullName: fullName,
                    email: email,
                    phoneNo: phoneNo,
                    username: username,
                    role: staffType.toLowerCase(),
                    isActive: isActiveCheckbox.checked,
                    permissions: {
                        canManageBookings: document.getElementById('canManageBookings').checked,
                        canManageUsers: document.getElementById('canManageCustomers').checked,
                        canManagePayments: document.getElementById('canManagePayments').checked,
                        canManageTest: document.getElementById('canManageTest').checked,
                        canViewReports: document.getElementById('canManageReports').checked,
                    }
                };
                console.log("permission:", payload.permissions);
                // Only add password if it's filled
                if (password) {
                    payload.password = password;
                }

                try {
                    const res = await fetch(staffId ? `${apiBase}/update-staff-tenant/${staffId}` : `${apiBase}/create`, {
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
            document.getElementById('deleteBtn').addEventListener('click', async (e) => {
                e.preventDefault();
                if (!staffId) return alert('Staff not selected');
                if (!confirm('Are you sure you want to delete this staff?')) return;

                try {
                    const res = await fetch(`${apiBase}/delete-staff-tenant/${staffId}`, {
                        method: 'DELETE'
                    });

                    if (res.ok) {
                        alert('Staff deleted successfully');
                        window.location.href = 'admin.html?page=staffActivity'; // Redirect after delete
                    } else {
                        alert('Failed to delete staff');
                    }
                } catch (err) {
                    alert('Error deleting staff');
                }
            });
        })();