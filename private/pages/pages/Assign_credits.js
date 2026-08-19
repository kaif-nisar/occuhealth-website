// Get the current logged-in user's tenant ID from the global `user` object
function getCurrentTenantId() {
    if (typeof user !== 'undefined' && user?.tenantId) {
        return user.tenantId._id || user.tenantId;
    }
    if (typeof window !== 'undefined' && window.user?.tenantId) {
        return window.user.tenantId._id || window.user.tenantId;
    }
    return null;
}

async function loadFranchisees() {
    try {
        const tenantId = getCurrentTenantId();
        const queryParams = new URLSearchParams();
        if (tenantId) {
            queryParams.set('tenantId', tenantId);
        }

        // Use the new chain API that fetches ALL franchisees in the current user's chain
        // (franchisees created by the current user, plus franchisees created by those franchisees, recursively)
        const response = await fetch(`${BASE_URL}/api/v1/user/fetchFranchiseeChain?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to load franchisees: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            const franchiseeDropdown = document.getElementById('franchisee');
            franchiseeDropdown.innerHTML = '<option value="">-- Select Franchisee --</option>';

            const allFranchisees = Array.isArray(data.data) ? data.data : [];
            // Defense-in-depth: only show users belonging to the logged-in tenant
            const franchisees = tenantId
                ? allFranchisees.filter(f => {
                    const fTenant = f.tenantId?._id || f.tenantId;
                    return fTenant && fTenant.toString() === tenantId.toString();
                })
                : allFranchisees;

            franchisees.forEach(franchisee => {
                const option = document.createElement('option');
                option.value = franchisee._id;
                option.textContent = `${franchisee.fullName} (${franchisee.email})`;
                franchiseeDropdown.appendChild(option);
            });
        } else {
            alert(data.message || 'No franchisees found');
        }
    } catch (error) {
        console.error('Error loading franchisees:', error);
        alert('Failed to load franchisees. Please try again.');
    }
}

async function submitTransaction() {
    const franchiseeId = document.getElementById('franchisee').value;
    const transactionType = document.getElementById('transaction-type').value;
    const credits = document.getElementById('credits').value;
    const remarks = document.getElementById('remarks').value;
    const amount = Number(credits);

    if (!franchiseeId || !Number.isFinite(amount) || amount <= 0) {
        return alert('Please fill in all required fields.');
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/super-send-to-franchisee`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                franchiseeId,
                transactionType,
                amount,
                remarks,
                userId
            }),
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            console.log('Transaction successful!');
            alert(`Transaction successful!`);
            loadFranchisees(); // Refresh data
        } else {
            alert(data.message || 'Failed to complete transaction.');
        }
    } catch (error) {
        console.error('Error submitting transaction:', error);
        alert('An error occurred while processing the transaction.');
    }
}

document.getElementById('btn-submit').addEventListener('click', submitTransaction);

// Load franchisees on page load
loadFranchisees();