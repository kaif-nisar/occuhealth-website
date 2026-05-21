function a() {
    document.getElementById('submitBtn').addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent default form submission
        // Dynamically set the role based on the current user's role
        let franchiseeRole = '';
        if (userRole === 'admin') {
            franchiseeRole = 'superFranchisee';
        } else if (userRole === 'superFranchisee') {
            franchiseeRole = 'franchisee';
        } else if (userRole === 'franchisee') {
            franchiseeRole = 'subFranchisee';
        } else {
            alert('You are not authorized to create a franchisee.');
            return;
        }

        // Collect form data
        const fullName = document.getElementById('firstname').value;
        const email = document.getElementById('email').value;
        const phoneNo = document.getElementById('phone').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const state = document.getElementById('state').value;
        const city = document.getElementById('city').value;
        const district = document.getElementById('district').value;
        const postOffice = document.getElementById('postOffice').value;
        const pinCode = document.getElementById('pincode').value;
        const address = document.getElementById('address').value;
    
        try {
            // Send POST request to create franchisee

            const response = await fetch(`${BASE_URL}/api/v1/user/franchisee-create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName,
                    email,
                    phoneNo,
                    username,
                    password,
                    state,
                    city,
                    district,
                    postOffice,
                    pinCode,
                    address,
                    userId, // Pass the dynamic user ID
                    role: franchiseeRole // Set dynamically based on the current user's role
                }),
            });
    
            const data = await response.json();
            if (data.success) {
                alert('Franchisee created successfully!');
                // Redirect or reset the form here if needed
            } else {
                alert(data.message); // Show error message from the backend
            }
        } catch (error) {
            console.error('Error during submission:', error);
            alert('An error occurred. Please try again.');
        }
    });
    
}
a();