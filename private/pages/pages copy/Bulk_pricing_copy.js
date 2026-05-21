
    async function loadFranchisees() {
        try {
            // Fetch the franchisee data
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
                const franchiseeSelect = document.getElementById('franchiseeSelect');
                franchiseeSelect.innerHTML = '<option value="">-- Select My Franchisee --</option>'; // Reset the select options
    
                // Populate the select dropdown
                franchiseesList.forEach((franchisee) => {
                    const option = document.createElement('option');
                    option.value = franchisee._id; // Pass the franchisee ID as the value
                    option.textContent = `${franchisee.fullName} (${franchisee.city}, ${franchisee.state})`; // Display name, city, and state
                    franchiseeSelect.appendChild(option);
                });
            } else {
                alert('Error fetching franchisee data');
            }
        } catch (error) {
            console.error('Error fetching franchisees:', error);
            alert('Unable to load franchisees. Please try again later.');
        }
    }
    
    //Handle search button click
    document.getElementById('searchBtn').addEventListener('click', () => {
        let selectedFranchiseeId = document.getElementById('franchiseeSelect').value;
        if (selectedFranchiseeId) {
            // Redirect to the next page and pass the franchisee ID as a query parameter
            let url = `${BASE_URL}/franchisee.html?page=rate_list_copy&value1=${selectedFranchiseeId}`;
            window.location.href = url;
                 
        } else {
            alert('Please select a franchisee');
        }
    });
    
    // Call the function to load franchisees when the page is loaded
    loadFranchisees();
    