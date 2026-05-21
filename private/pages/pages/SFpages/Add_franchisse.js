-document.getElementById('submitBtn').addEventListener('click', async (e) => {
    console.log('klsjdfksdhfiusdhi')
    e.preventDefault(); // Prevent the default form submission

    const fullName = document.getElementById('firstname').value;
    const lastname = document.getElementById('lastname').value;
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
        const response = await fetch(`${BASE_URL}/api/v1/user/franchisee-create?userId=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fullName,
                lastname,
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
                userId,
            }),
        });

        const data = await response.json();
        if (data.success) {
            alert('Franchisee created successfully!');
            // Redirect or reset the form here if needed
        } else {
            alert(data.message); // Show error message
        }
    } catch (error) {
        console.error('Error during submission:', error);
        alert('An error occurred. Please try again.');
    }
});


// fetch franchisee with data
