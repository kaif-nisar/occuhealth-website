async function verifyPin() {
    const enteredPin = document.getElementById("security-pin").value;

    const response = await fetch(`${BASE_URL}/api/v1/user/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin })
    });

    const result = await response.json();
    if (result.success) {
        document.getElementById("pin-modal").style.display = "none";
    } else {
        alert("Incorrect PIN! Access Denied.");
    }
}

function openAmountModal() {
    document.getElementById('amount-modal').classList.add('show');
}

function closeAmountModal() {
    document.getElementById('amount-modal').classList.remove('show');
}

async function submitAmount() {
    const amount = document.getElementById('add-amount').value;

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }

    try {
        // Show loading state
        const submitBtn = event.target;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitBtn.disabled = true;

        // Get current user ID (you'll need to pass this from your application)

        const response = await fetch(`${BASE_URL}/api/v1/user/add-booking-wallet-amount`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: parseFloat(amount)
            })
        });

        const result = await response.json();

        if (result.success) {
            // Update the current amount display
            const currentAmountDisplay = document.querySelector('.current-amount');
            if (currentAmountDisplay) {
                currentAmountDisplay.innerHTML =
                    `<i class="fas fa-coins"></i> Current Amount: ₹${result.data.currentBalance.toLocaleString('en-IN')}`;
            }

            // Show success message
            alert(`Success! ₹${result.data.amountAdded} added successfully!\nNew Balance: ₹${result.data.currentBalance}`);

            // Close modal and reset form
            closeAmountModal();
            document.getElementById('add-amount').value = '';
        } else {
            alert(`Error: ${result.message}`);
        }

    } catch (error) {
        console.error('Error adding amount:', error);
        alert('Network error occurred. Please try again.');
    } finally {
        // Reset button state
        const submitBtn = document.querySelector('#amount-modal button');
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Amount';
        submitBtn.disabled = false;
    }
}

function loadCreditData() {
    fetch(`${BASE_URL}/api/v1/user/fetchFranchisee`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                populateDropdowns(result.data);
            } else {
                console.error('Error fetching data:', result.message);
            }
        })
        .catch(error => console.error('Error fetching data:', error));
}

function populateDropdowns(data) {
    const superFranchiseeSelect = document.getElementById('super-franchisee');
    const franchiseeSelect = document.getElementById('franchisee');
    const subFranchiseeSelect = document.getElementById('sub-franchisee');
    superFranchiseeSelect.innerHTML = '<option value="" disabled>-- Select Franchisee --</option>';
    franchiseeSelect.innerHTML = '<option value="" disabled>-- Select Franchisee --</option>';
    subFranchiseeSelect.innerHTML = '<option value="" disabled>-- Select Franchisee --</option>';
    
    document.querySelector('.current-amount').innerHTML = `<i class="fas fa-coins"></i> Current Amount: ${user.bookingWallet}`;

    data.forEach(user => {
        const option = document.createElement('option');
        option.value = user._id;
        option.textContent = user.fullName; // or username

        if (user.role === 'superFranchisee') {
            superFranchiseeSelect.appendChild(option);
        } else if (user.role === 'franchisee') {
            franchiseeSelect.appendChild(option);
        } else if (user.role === 'subFranchisee') {
            subFranchiseeSelect.appendChild(option);
        }
    });
}


async function handleSubmit(event, role) {
    event.preventDefault();

    let credits, transactionType, selectedFranchiseeId;

    if (role === 'franchisee') {
        credits = document.getElementById('credits').value; // Access direct IDs
        transactionType = document.getElementById('transaction-type').value;
        selectedFranchiseeId = document.getElementById('franchisee').value;
    }
    else if (role === 'super') {
        credits = document.getElementById(`${role}-credits`).value;
        transactionType = document.getElementById(`${role}-transaction-type`).value;
        selectedFranchiseeId = document.getElementById(`${role}-franchisee`).value; // Holds the selected user's ID
    }
    else if (role === 'sub') {
        credits = document.getElementById(`${role}-credits`).value;
        transactionType = document.getElementById(`${role}-transaction-type`).value;
        selectedFranchiseeId = document.getElementById(`${role}-franchisee`).value; // Holds the selected user's ID
    }
    if (!selectedFranchiseeId) {
        alert('Please select a franchisee before submitting.');
        return;
    }


    const payload = {
        adminId: userId, // Ensure you have the admin ID
        [`${role}Id`]: selectedFranchiseeId,
        amount: parseInt(credits, 10),
    };
    let endpoint;
    if (role === 'super') {
        endpoint = transactionType === 'Debit'
            ? `${BASE_URL}/api/v1/user/admin-debit-from-super`
            : `${BASE_URL}/api/v1/user/admin-send-to-super` ; // Assuming you have a debit route
    } else if (role === 'franchisee') {
        endpoint = transactionType === 'Debit'
            ? `${BASE_URL}/api/v1/user/admin-send-to-franchisee`
            : `${BASE_URL}/api/v1/user/admin-debit-from-franchisee`; // Assuming you have a debit route
    } else if (role === 'sub') {
        endpoint = transactionType === 'Debit'
            ? `${BASE_URL}/api/v1/user/admin-send-to-sub-franchisee`
            : `${BASE_URL}/api/v1/user/admin-debit-from-sub-franchisee`; // Assuming you have a debit route
    }

    await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                console.log('Transaction successful! New balance:', result.data.adminWallet);
                alert(`Transaction successful! New balance: ${result.data.adminWallet}`);
            } else {
                console.error('Transaction failed:', result.message);
                alert(`Transaction failed: ${result.message}`);
            }
        })
        .catch(error => console.error('Error processing transaction:', error));
}


loadCreditData();

document.querySelectorAll('.btn-submit').forEach(button => {
    button.addEventListener('click', function (event) {
        const role = this.closest('.card').querySelector('h2').textContent.split(' ')[1].toLowerCase();
        handleSubmit(event, role);
    });
});
