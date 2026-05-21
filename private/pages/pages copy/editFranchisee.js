function editFranchi() {
    // Assuming franchiseeId is passed in the URL as a query parameter
    const Params = new URLSearchParams(window.location.search)
    const _id = Params.get('Name');

    // Function to fetch franchisee data by ID
    async function getFranchiseeById() {
        if (_id) {
            fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${_id}`)
                .then(response => response.json())
                .then(data => {
                    data = data.data;
                    console.log(data)
                    // Pre-fill form fields with data
                    document.getElementById('firstname').value = data.fullName;
                    document.getElementById('email').value = data.email;
                    document.getElementById('phone').value = data.phoneNo;
                    document.getElementById('username').value = data.username;
                    document.getElementById('password').value = data.password; // Usually, this is not pre-filled for security reasons
                    document.getElementById('state').value = data.state;
                    document.getElementById('city').value = data.city;
                    document.getElementById('district').value = data.district;
                    document.getElementById('postOffice').value = data.postOffice;
                    document.getElementById('pincode').value = data.pinCode;
                    document.getElementById('address').value = data.address;
                    document.getElementById('submissionDate').value = data.updatedAt;

                    // Set the status dropdown based on isActive value
                    if (data.isActive) {
                        document.getElementById('status').value = 'active'; // If true, set 'active'
                    } else {
                        document.getElementById('status').value = 'inactive'; // If false, set 'inactive'
                    }
                })
                .catch(error => console.error('Error fetching franchisee data:', error));
        }
    };
    getFranchiseeById();

    // Function to update franchisee data
    async function updateFranchisee() {
        const Params = new URLSearchParams(window.location.search);
        const _id = Params.get('Name'); // Get the ID again for the update
        const status = document.getElementById('status').value === 'active'; // Convert to boolean
        const data = {
            fullName: document.getElementById('firstname').value,
            email: document.getElementById('email').value,
            phoneNo: document.getElementById('phone').value,
            username: document.getElementById('username').value,
            state: document.getElementById('state').value,
            city: document.getElementById('city').value,
            district: document.getElementById('district').value,
            postOffice: document.getElementById('postOffice').value,
            pinCode: document.getElementById('pincode').value,
            address: document.getElementById('address').value,
            updatedAt: document.getElementById('submissionDate').value,
            isActive: status // Use isActive instead of status
        };
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-update?_id= ${_id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            if (result) alert('Franchisee updated successfully!');
        } catch (error) {
            console.error('Error updating franchisee data:', error);
            alert('Failed to update franchisee. Please try again.');
        }
    }

    // Event listener for the submit button
    document.getElementById('submitBtn').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default form submission
        updateFranchisee(); // Call update function
    });
}
editFranchi();