function singleTestPriceAssign() {
    const franchiseeSelect = document.getElementById('franchisee');
    let franchiseeId;
    
    // Fetch and populate the franchisee dropdown
    fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            data = data.message; // Assuming data contains the franchisee array
            data.forEach(franchisee => {
                const option = document.createElement('option');
                option.value = franchisee._id;
                option.textContent = `${franchisee.username}/${franchisee.fullName}`;
                franchiseeSelect.appendChild(option);
            });
    
            // Set the initial franchiseeId to the first option's value
            franchiseeId = franchiseeSelect.value;
    
            // Fetch the test list for the initial franchisee
            fetchTestList();
        })
        .catch(error => console.error('Error fetching franchisees:', error));
    
    // Update franchiseeId dynamically when the dropdown value changes
    franchiseeSelect.addEventListener('change', function () {
        franchiseeId = this.value;
        fetchTestList(); // Fetch the test list for the newly selected franchisee
    });
    
    async function fetchTestList() {
        console.log("Fetching test list for franchiseeId:", franchiseeId);
        if (!franchiseeId) return; // Exit if no franchisee is selected
        try {
            const [testResponse, panelResponse, packageResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}&oldId=${franchiseeId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}&oldId=${franchiseeId}`, { method: "POST" }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}&oldId=${franchiseeId}`, { method: "POST" })
            ]);
    
            if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
                throw new Error("One or more API requests failed");
            }
    
            const testData = await testResponse.json();
            const panelData = await panelResponse.json();
            const packageData = await packageResponse.json();
    
            const combinedData = [...testData, ...panelData, ...packageData];
            console.log("Combined Data:", combinedData);
            // Populate Select Dropdown
            const testDropdown = document.getElementById('test');
            testDropdown.innerHTML = '<option value="">-- Select Test/Panel/Package --</option>';
            combinedData.forEach(item => {
                const option = document.createElement('option');
                option.value = item.testId;
                option.textContent = item.packageName || item.testName || item.panelName;
                option.dataset.mrp = item.mrpPrice;
                option.dataset.price = item.assignedPriceToFranchisee;
                testDropdown.appendChild(option);
            });
    
            testDropdown.addEventListener("change", function () {
                const selectedItem = this.options[this.selectedIndex];
                document.getElementById('test-price').value = selectedItem.dataset.price;
                document.getElementById('final-price').value = selectedItem.dataset.mrp;
            });
    
        } catch (error) {
            console.error(error);
        }
    }
    
    document.getElementById('submitbtn').addEventListener('click', async function () {
        const testId = document.getElementById('test').value;
        const basePrice = parseFloat(document.getElementById('test').selectedOptions[0].dataset.price); // Original Price
        const testPrice = parseFloat(document.getElementById('test-price').value); // Assigned Price
        const finalPrice = parseFloat(document.getElementById('final-price').value); // Selling Price
        const remarks = document.getElementById('remarks').value;
    
        if (!testId || isNaN(testPrice) || isNaN(finalPrice) || isNaN(basePrice)) {
            alert("Please select a test and enter valid prices.");
            return;
        }
    
        // **Commission Calculation**
        let commissionPercent = 0;
        if (testPrice > basePrice) {
            commissionPercent = ((testPrice - basePrice) / basePrice) * 100;
        }
    
        const items = {
            franchiseeId,
            testId,
            price: testPrice,
            finalPrice: finalPrice,
            commissionRate: commissionPercent.toFixed(2), // Commission in percentage
            remarks: remarks,
            assignedBy: userId,
        };
    
        console.log("Payload being sent:", items);
    
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/assign-single-test-price`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(items),
            });
    
            const data = await response.json();
            if (response.ok) {
                alert(`Price Assigned Successfully!\nCommission: ${commissionPercent.toFixed(2)}%`);
            } else {
                alert("Error assigning price: " + data.message);
            }
        } catch (error) {
            console.error('Error saving price:', error);
        }
    });
}
singleTestPriceAssign(); // Call the function again to update the event listeners