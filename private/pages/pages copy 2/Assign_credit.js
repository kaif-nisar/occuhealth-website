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


function handleSubmit(event, role) {
    event.preventDefault();

    let credits, transactionType, selectedFranchiseeId;

    if (role === 'franchisee') {
        credits = document.getElementById('credits').value; // Access direct IDs
        transactionType = document.getElementById('transaction-type').value;
        selectedFranchiseeId = document.getElementById('franchisee').value;
    }
    else if(role === 'super'){
     credits = document.getElementById(`${role}-credits`).value;
     transactionType = document.getElementById(`${role}-transaction-type`).value;
     selectedFranchiseeId = document.getElementById(`${role}-franchisee`).value; // Holds the selected user's ID
    }
    else if(role === 'sub'){
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
            ? `${BASE_URL}/api/v1/user/admin-send-to-super`
            : `${BASE_URL}/api/v1/user/admin-debit-from-super`; // Assuming you have a debit route
    } else if (role === 'franchisee') {
        endpoint = transactionType === 'Debit' 
            ? `${BASE_URL}/api/v1/user/admin-send-to-franchisee`
            : `${BASE_URL}/api/v1/user/admin-debit-from-franchisee`; // Assuming you have a debit route
    } else if (role === 'sub') {
        endpoint = transactionType === 'Debit' 
            ? `${BASE_URL}/api/v1/user/admin-send-to-sub-franchisee`
            : `${BASE_URL}/api/v1/user/admin-debit-from-sub-franchisee`; // Assuming you have a debit route
    }

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(result => {
        if (result.wallet !== undefined) {
            console.log('Transaction successful! New balance:', result.wallet);
            alert(`Transaction successful! New balance: ${result.wallet}`);
        } else {
            console.error('Transaction failed:', result.message);
            alert(`Transaction failed: ${result.message}`);
        }
    })
    .catch(error => console.error('Error processing transaction:', error));
}


loadCreditData();

    document.querySelectorAll('.btn-submit').forEach(button => {
        button.addEventListener('click', function(event) {
            const role = this.closest('.card').querySelector('h2').textContent.split(' ')[1].toLowerCase();
            handleSubmit(event, role);
        });
    });
    