async function loadFranchiseesWithBalance() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (data.success) {
            const franchiseesList = data.message; // Assuming data includes wallet balance
            const tbody = document.querySelector('#tbody');

            // Clear previous entries
            tbody.innerHTML = '';

            // Append new entries
            franchiseesList.forEach((franchisee, index) => {
                const balanceClass = franchisee.wallet < 0 ? 'balance-negative' : 'balance-positive';
                const row = `
                    <tr>
                        <td>${index + 1}</td>
                        <td>FR${franchisee._id}</td>
                        <td>${franchisee.fullName}</td>
                        <td><i class="fas fa-user"></i> ${franchisee.username}</td>
                        <td class="${balanceClass}">${franchisee.wallet}</td>
                        <td class="status-access">${franchisee.isActive ? 'Access' : 'No Access'}</td>
                    </tr>`;
                tbody.insertAdjacentHTML('beforeend', row);                
            });
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error loading franchisees with balance:', error);
    }
}


document.getElementById('pdfBtnJ').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Grab the HTML table content and prepare an array of rows
    const table = document.querySelector('#table');

    // Check if the table has rows
    const tableRows = table.querySelectorAll('#tbody tr');
    if (tableRows.length === 0) {
        alert('No data available for PDF generation');
        return;
    }

    // Prepare rows array for autoTable
    const rows = [];
    
    // Get the table headers
    const headers = Array.from(table.querySelectorAll('thead th')).map(header => header.innerText);
    rows.push(headers);  // Add the headers to the rows array

    // Get the table data (excluding headers)
    tableRows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText);
        rows.push(rowData);  // Add each row of data
    });

    // Log the extracted data (for debugging purposes)
    // console.log('Table headers:', headers);
    // console.log('Table rows:', rows);

    // Create the table in the PDF
    doc.autoTable({
        head: [headers],  // Table headers
        body: rows.slice(1),  // All rows excluding the header row
        startY: 20,  // Start the table below the title
        margin: { top: 10, left: 10, right: 10, bottom: 10 },
        theme: 'grid'  // Optional: Adds a grid style to the table
    });

    // Save the PDF
    doc.save('Account_Balance.pdf');
});

loadFranchiseesWithBalance();
