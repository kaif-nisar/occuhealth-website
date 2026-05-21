async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
    if(!franchiseeId){
        franchiseeId = userId;
    }
    const tableBody = document.querySelector('.table-container tbody');

    // If no start date or end date is provided, default to today
    // Construct the query parameters for the API request
    let query = `?status=pending&startDate=${startDate}&endDate=${endDate}`;
    if (franchiseeId) {
        query += `&franchiseeId=${franchiseeId}`;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/bookings${query}`);
        if (!response.ok) throw new Error('Failed to fetch bookings');

        const bookings = await response.json();
        console.log(bookings);

        // Clear the table
        tableBody.innerHTML = '';

        // Create a document fragment to minimize reflows
        const fragment = document.createDocumentFragment();

        // Populate the table
        bookings.forEach((booking, index) => {
            // Format tests from tableData
            const tests = Array.isArray(booking.tableData)
                ? booking.tableData.map(test => `${test.testName} (${test.typeOfSample}) - ${test.barcodeId}`).join('<br>')
                : 'No tests available';

            const sampleId = Array.isArray(booking.tableData) && booking.tableData[0]?.barcodeId
                ? booking.tableData[0].barcodeId // Use the first barcodeId as the sampleId
                : 'N/A';

                  // Determine the status color
            let statusColor = '';
            switch (booking.status.toLowerCase()) {
                case 'On Hold':
                    statusColor = 'red';
                    break;
                case 'pending':
                    statusColor = 'orange';
                    break;
                case 'completed':
                    statusColor = 'green';
                    break;
                default:
                    statusColor = 'black'; // Default color
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><a href="#">${booking.bookingId}</a></td>
                <td>${booking.patientName}</td>
                <td>${booking.gender} (${booking.year})</td>
                <td>${tests}</td>
                <td>${sampleId || 'N/A'}</td>
                 <td style="color: ${statusColor}; font-weight: bold;">${booking.status}</td>
            `;
            fragment.appendChild(row);
        });

        // Append the document fragment to the table body
        tableBody.appendChild(fragment);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        // Display a user-friendly message if the API call fails
        alert('Failed to load bookings. Please try again later.');
    }
}
 // for fetching sub-franchisees
 async function subfranchisee() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { method: "GET" })
        const allsubfran = await response.json();
        const subFranchiseeSelect = document.getElementById('franchisee-select');
        allsubfran.message.forEach(subfran => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('subFranchisee-option');
            testElement.setAttribute("data-id", subfran._id);

            testElement.innerText = `${subfran.fullName}`;
            subFranchiseeSelect.appendChild(testElement);
        });
    } catch (error) {
        console.error("Sub franchisee not created")
    }
}
(async function loadBookings() {
    await subfranchisee()

    await fetchBookings()
    })();
// Initial fetch when the page loads (default to last 24 hours)
// Handle search functionality
document.querySelector('#search-button').addEventListener('click', function() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
       // Get the selected option from the franchisee-select dropdown
       const franchiseeSelect = document.getElementById('franchisee-select');
       const selectedOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];  // Get the selected option
   
       // Now, get the data-id from the selected option
       const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;
   

    // Check if start and end date are selected
    // if (!startDate || !endDate) {
    //     alert('Please select both start and end dates');
    //     return;
    // }

    fetchBookings(startDate, endDate, franchiseeId);
});