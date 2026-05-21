function ppal() {
    const urlParams = new URLSearchParams(window.location.search); // Get the URL search params
    const _id = urlParams.get('value1'); // Get the 'value1' 
    let franchiseeId;
    // Fetch Franchisee Data
    async function fetchFranchiseeData() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.success) {
                selectedFranchisee = data.data; // Franchisee data
                document.getElementById('franchisee-name').value = `${selectedFranchisee.fullName} - ${selectedFranchisee.username} - (${selectedFranchisee.state})`;
                document.getElementById('current-franchisee-name').textContent = `${selectedFranchisee.username} -(${selectedFranchisee.fullName})`;
                 franchiseeId  = selectedFranchisee._id;
            } else {
                alert('Error fetching franchisee data');
            }
        } catch (error) {
            console.error('Error fetching franchisee:', error);
        }
    }
    // Add the search functionality after populating the table with data
    function setupSearch() {
        const searchInput = document.getElementById('searchTest');
        const testListTableBody = document.getElementById('test-list');

        // Event listener for the search input box
        searchInput.addEventListener('input', function () {
            const searchTerm = searchInput.value.toLowerCase(); // Get search term and make it case insensitive

            // Get all rows in the table
            const rows = testListTableBody.querySelectorAll('tr');

            // Loop through all rows and hide those that do not match the search term
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                let rowText = ''; // To store concatenated text of all columns in the row

                // Loop through each cell in the row and add its text to rowText
                cells.forEach(cell => {
                    rowText += cell.textContent.toLowerCase() + ' '; // Add space to separate words
                });

                // If the row contains the search term, show it, else hide it
                if (rowText.includes(searchTerm)) {
                    row.style.display = ''; // Show the row
                } else {
                    row.style.display = 'none'; // Hide the row
                }
            });
        });
    }

    // // Fetch Test List for the Selected Franchisee
    async function fetchTestList() {
        try {
            // Make API calls for all three resources concurrently
            const [testResponse, panelResponse, packageResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}&oldId=${_id}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}&oldId=${_id}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}&oldId=${_id}`, { method: "POST" })
            ]);

            // Check if all responses are successful
            if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
                throw new Error("One or more API requests failed");
            }

            // Parse the JSON data from each API response
            const testData = await testResponse.json();
            const panelData = await panelResponse.json();
            const packageData = await packageResponse.json();

            // Combine the data into a single array
            const combinedData = [
                ...testData,
                ...panelData,
                ...packageData
            ];

            // Clear the table body before add
            const testListTableBody = document.getElementById('test-list');
            testListTableBody.innerHTML = ''; // Clear previous rows
            console.log(combinedData)
            // Populate the test list dynamically
            combinedData.forEach((test, index) => {
                let row = document.createElement('tr');
                let oldPrice = (test.assignedPriceToFranchisee - test.myPrice).toFixed(2)
                // old percentage find
                let oldPercentage = Math.round((oldPrice / test.myPrice) * 100)
                row.innerHTML = `
<td>${index + 1}</td>
<td class="test-id">${test.testId || test.packageId || test.panelId}</td> <!-- Unique class for test ID -->
<td class="test-name">${test.packageName || test.testName || test.panelName}</td> <!-- Unique class for test name -->
<td class="test-mrp">${test.mrpPrice}</td> <!-- MRP (Manufacturer's Retail Price) -->
<td class="my-price">${ test.basePrice }</td> <!-- Price -->
<td class="commission-rate-cell">
    <input type="number" class="commission-rate" data-test-id="${test._id}" value="${test.commissionRate || oldPercentage}" %>
</td> <!-- Commission rate input -->
<td class="assigned-price">${test.assignedPrice || oldPrice}</td>
<td class="franchisee-id">${_id}</td>
<td class="final-price1">${test.finalPrice || test.assignedPriceByUser}</td>`;
                testListTableBody.appendChild(row);
            });
            setupSearch();
            // Attach event listener for the "Change Price" button to apply global commission rate
            document.getElementById('changePriceBtn').addEventListener('click', () => {
                const globalCommissionRate = parseFloat(document.getElementById('trigger-price').value);

                // Loop through each input field to apply the global commission rate
                const commissionInputs = document.querySelectorAll('.commission-rate');
                commissionInputs.forEach(input => {
                    const testRow = input.closest('tr'); // Get the current row of the test

                    // Get the base price (final price) for commission calculation
                    const basePrice = parseFloat(testRow.querySelector('td:nth-child(5)').textContent);

                    // Calculate commission amount and assigned price
                    const commissionAmount = (globalCommissionRate / 100) * basePrice;
                    const assignedPrice = commissionAmount;
                    const finalPrice = basePrice + commissionAmount;
                   

                    // Update the commission rate input field, assigned price, and final price cell
                    input.value = globalCommissionRate; // Update input field with global commission rate
                    testRow.querySelector('.assigned-price').textContent = assignedPrice.toFixed(2); // Update assigned price cell
                    testRow.querySelector('.final-price1').textContent = finalPrice.toFixed(2); // Update final price
                });
            });

            // Update assigned price and final price when individual commission rate changes
            const commissionInputs = document.querySelectorAll('.commission-rate');

            commissionInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    const inputValue = parseFloat(e.target.value);
                    const testRow = e.target.closest('tr');  // Get the current row of the test

                    // Get the base price (final price) for commission calculation
                    const basePrice = parseFloat(testRow.querySelector('td:nth-child(5').textContent);


                    // Calculate the new commission amount
                    const commissionAmount = (inputValue / 100) * basePrice;
                    const assignedPrice = commissionAmount;
                    const finalPrice = basePrice + commissionAmount;

                    // Update assigned price and final price dynamically
                    testRow.querySelector('.assigned-price').textContent = assignedPrice.toFixed(2);
                    testRow.querySelector('.final-price1').textContent = finalPrice.toFixed(2);
                });
            });

        } catch (error) {
            console.error(error);
        }
    }

    document.getElementById('saveBtn').addEventListener('click', async function() {  
        const assignedBy = userId;  // The user who assigns the price (admin, superfranchisee, or franchisee)
    
        const itemsToSave = [];
        const rows = document.querySelectorAll('#test-list tr'); // Table rows
    
        rows.forEach((row, index) => {
            const testId = row.querySelector('.test-id').textContent.trim(); // Test ID
            const testName = row.querySelector('.test-name').textContent.trim(); // Test Name
            const price = parseFloat(row.querySelector('.final-price1').textContent.trim());  //
            const commissionRate = parseFloat(row.querySelector('.commission-rate').value.trim()) / 100;  // Commission Rate
            const finalPrice  = parseFloat(row.querySelector('.test-mrp').textContent.trim()); // Final Price
            console.log(franchiseeId)
            // Add the data to the array
            itemsToSave.push({
                testId,
                testName,
                price,
                commissionRate,
                finalPrice,
                franchiseeId: _id,
                assignedBy,  // Who is assigning the price
            });
        });
    
        // Send the collected data to the backend
        await sendDataToBackend(itemsToSave);
    });
    
    // Function to send collected data to the backend
    async function sendDataToBackend(items) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/assign-prices`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    items: items,
                }),
            });
    
            const data = await response.json();
            if (response.ok) {
                console.log('Data saved successfully:', data);
                alert('Data saved successfully',data);
            } else {
                console.error('Error saving data:', data);
                alert(data.message);
            }
        } catch (error) {
            console.error('Error sending data to backend:', error);
        }
    }
    










    // // Handle Change Price Button
    // document.getElementById('changePriceBtn').addEventListener('click', async () => {
    //     const newPrice = document.getElementById('trigger-price').value;
    //     if (!newPrice) {
    //         alert('Please enter a valid price.');
    //         return;
    //     }

    //     // Update the price for all tests or individual tests
    //     const tests = document.querySelectorAll('.my-price');
    //     tests.forEach(async (input) => {
    //         const testId = input.getAttribute('data-test-id');
    //         const updatedPrice = input.value;

    //         // Call an API to update prices in the backend
    //         await updateTestPrice(testId, updatedPrice);
    //     });
    // });

    // // Update Price for a specific test
    // async function updateTestPrice(testId, price) {
    //     try {
    //         const response = await fetch(`${ BASE_URL } /api/v1 / tests / update - test - price`, {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${ localStorage.getItem('token') } `,
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify({
    //                 franchiseeId: franchiseeId,
    //                 testId: testId,
    //                 newPrice: price,
    //             }),
    //         });

    //         const data = await response.json();
    //         if (data.success) {
    //             alert('Test price updated successfully');
    //         } else {
    //             alert('Failed to update test price');
    //         }
    //     } catch (error) {
    //         console.error('Error updating test price:', error);
    //         alert('Error updating price. Please try again later.');
    //     }
    // }

    // // Handle Commission Rate Change
    // document.querySelectorAll('.commission-rate').forEach((input) => {
    //     input.addEventListener('change', async (event) => {
    //         const testId = event.target.getAttribute('data-test-id');
    //         const newRate = event.target.value;

    //         // Call API to update commission rate
    //         await updateTestCommissionRate(testId, newRate);
    //     });
    // });

    // // Update Commission Rate for a specific test
    // async function updateTestCommissionRate(testId, newRate) {
    //     try {
    //         const response = await fetch(`${ BASE_URL } /api/v1 / tests / update - commission - rate`, {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${ localStorage.getItem('token') } `,
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify({
    //                 franchiseeId: franchiseeId,
    //                 testId: testId,
    //                 newCommissionRate: newRate,
    //             }),
    //         });

    //         const data = await response.json();
    //         if (data.success) {
    //             alert('Commission rate updated successfully');
    //         } else {
    //             alert('Failed to update commission rate');
    //         }
    //     } catch (error) {
    //         console.error('Error updating commission rate:', error);
    //         alert('Error updating commission rate. Please try again later.');
    //     }
    // }

    // Call the functions on page load
    fetchFranchiseeData();
    fetchTestList();
}
ppal();