async function loadFranchisees() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/franchisee-data?userId=${userId}`, {
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

            data.franchisees.forEach(franchisee => {
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

    if (!franchiseeId || !credits) {
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
                credits: parseInt(credits, 10),
                remarks,
                userId
            }),
        });

        const data = await response.json();
        if (data.success) {
            console.log('Transaction successful! New balance:', data.wallet);
            alert(`Transaction successful! New balance: ${data.wallet}`);
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