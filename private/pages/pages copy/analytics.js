(function () {
    let currentUserId = userId; // Replace with the actual logged-in user ID

    // Fetch and display data for the current user
    fetchAndDisplayData(currentUserId);

    // Handle sub-franchisee selection
    document.querySelector('#subFranchiseeSelect').addEventListener('change', async (event) => {
        const selectedFranchiseeId = event.target.value.trim();
        if (selectedFranchiseeId) {
            currentUserId = selectedFranchiseeId; // Update the current user ID to the selected franchisee
            await fetchAndDisplayData(currentUserId);
        }
    });

    // Handle search button click
    document.querySelector('.search-button').addEventListener('click', async () => {
        const selectedFranchiseeId = document.querySelector('#subFranchiseeSelect').value.trim();
        if (selectedFranchiseeId) {
            currentUserId = selectedFranchiseeId;
            await fetchAndDisplayData(currentUserId);
        }
    });
})();

// Fetch and display data for the given user ID
async function fetchAndDisplayData(userId) {
    const apiUrl = `${BASE_URL}/api/v1/user/analytics?userId=${userId}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (response.ok) {
            displayMonthlyBusiness(data.userBusiness);
            displayFranchiseeBusiness(data.downlineData);
            populateSubFranchiseeDropdown(data.downlineData);
            updateAnalyticsTitle(userId, data.franchiseeName || 'My Account');
        } else {
            console.error('Error fetching analytics:', data.message);
        }
    } catch (error) {
        console.error('Error fetching analytics:', error);
    }
}

// Display the 12-month business data for the current user
function displayMonthlyBusiness(userBusiness) {
    const tableBody = document.querySelector('.container .card:nth-of-type(2) table tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    userBusiness.forEach(entry => {
        const monthName = new Date(0, entry._id.month - 1).toLocaleString('default', { month: 'long' });
        const target = 200000; // Example target value
        const percentage = ((entry.totalBusiness / target) * 100).toFixed(2);

        const row = `
            <tr>
                <td class="month">${monthName} ${entry._id.year}</td>
                <td>Rs. ${entry.totalBusiness}</td>
                <td>Rs. ${target}</td>
                <td>
                    <div class="status-text">${entry.totalBusiness} / ${target}</div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

// Display the current month's business data for all sub-franchisees
function displayFranchiseeBusiness(downlineData) {
    const tableBody = document.querySelector('.container .card:nth-of-type(3) table tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    downlineData.forEach(franchisee => {
        const target = 200000; // Example target value
        const percentage = ((franchisee.thisMonthBusiness / target) * 100).toFixed(2);

        const row = `
            <tr>
                <td class="month">${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}</td>
                <td>${franchisee.franchiseeName}</td>
                <td>Rs. ${franchisee.thisMonthBusiness}</td>
                <td>Rs. ${target}</td>
                <td>
                    <div class="status-text">${franchisee.thisMonthBusiness} / ${target}</div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

// Populate the "My Account" dropdown with sub-franchisees
function populateSubFranchiseeDropdown(downlineData) {
    const dropdown = document.querySelector('#subFranchiseeSelect');
    dropdown.innerHTML = '<option value="">My Account</option>'; // Default option

    downlineData.forEach(franchisee => {
        const option = `<option value="${franchisee.franchiseeId}">${franchisee.franchiseeName}</option>`;
        dropdown.insertAdjacentHTML('beforeend', option);
    });
}

// Update the analytics title dynamically
function updateAnalyticsTitle(userId, franchiseeName) {
    const titleElement = document.querySelector('.analytics-title');
    titleElement.textContent = `Business Analytics - ${franchiseeName}`;
}









