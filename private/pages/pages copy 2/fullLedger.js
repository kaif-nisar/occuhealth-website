async function fetchLedger(franchiseeId, startDate, endDate) {
    try {
        const response = await fetch(
            `${BASE_URL}/api/v1/user/ledger?franchiseeId=${franchiseeId}&startDate=${startDate}&endDate=${endDate}`
        );
        if (!response.ok) {
            throw new Error("Failed to fetch ledger data");
        }
        const summary = await response.json();
        return summary; // Return the response data
    } catch (error) {
        console.error(error);
        alert("Error fetching ledger data: " + error.message);
    }
}

// document.querySelector('.search-bar button').addEventListener('click', async () => {
//     const franchiseeId = document.querySelector('input[placeholder="My Account"]').value.trim();
//     const startDate = document.querySelector('#startDate').value;
//     const endDate = document.querySelector('#endDate').value;

//     if (!franchiseeId || !startDate || !endDate) {
//         alert("Please fill all the fields.");
//         return;
//     }

//     const ledgerData = await fetchLedger(franchiseeId, startDate, endDate);

//     if (ledgerData) {
//         // Update Opening and Closing Balances
//         document.querySelector('.header-row td').textContent = `Opening Balance: Rs. ${ledgerData.openingBalance}`;
//         document.querySelector('.header-row + tr td').textContent = `Closing Balance: Rs. ${ledgerData.closingBalance}`;

//         // Clear existing table rows
//         let tbody = document.querySelector('table tbody');
//         if (!tbody) {
//             tbody = document.createElement('tbody');
//             document.querySelector('table').appendChild(tbody);
//         }
//         tbody.innerHTML = '';
//         // Populate new rows
//         ledgerData.ledgerEntries.forEach((entry, index) => {
//             const row = document.createElement('tr');
//             row.innerHTML = `
//                 <td>${index + 1}</td>
//                 <td>${new Date(entry.transactionDate).toLocaleDateString()}</td>
//                 <td class="${entry.debit ? 'debit' : 'credit'}">${entry.debit || entry.credit}</td>
//                 <td>${entry.remarks || ''}</td>
//             `;
//             tbody.appendChild(row);
//         });
//     }
// });





// Fetch Ledger Summary on Page Load
//fetchLedgerSummary();
// const fetchLedgerSummary = async () => {
//     const franchiseeId = userId; // Replace with dynamic value as needed
//     const startDate = '2024-12-01'; // Replace with input value
//     const endDate = '2025-01-05'; // Replace with input value

//     try {
//         const response = await fetch(`${BASE_URL}/api/v1/user/ledger-summary?franchiseeId=${franchiseeId}&startDate=${startDate}&endDate=${endDate}`);
//         if (!response.ok) throw new Error('Failed to fetch ledger summary');

//         const summary = await response.json();
//         console.log(summary)
//         // Populate the table dynamically
//         document.querySelector('.container table').innerHTML = `
//             <tr class="header-row">
//                 <td colspan="2">${franchiseeId} - Franchisee Name and Location</td>
//             </tr>
//             <tr>
//                 <th>#</th>
//                 <th>Amount</th>
//             </tr>
//             <tr>
//                 <td class="bold">Opening Balance</td>
//                 <td>Rs. ${summary.openingBalance}</td>
//             </tr>
//             <tr>
//                 <td class="bold">Closing Balance</td>
//                 <td>Rs. ${summary.closingBalance}</td>
//             </tr>
//             <tr>
//                 <td>Booking Amount</td>
//                 <td>Rs. ${summary.bookingAmount}</td>
//             </tr>
//             <tr>
//                 <td>Cancellation/Refund</td>
//                 <td>Rs. ${summary.cancellationRefund}</td>
//             </tr>
//             <tr>
//                 <td>Commission Amount</td>
//                 <td>Rs. ${summary.commissionAmount}</td>
//             </tr>
//             <tr>
//                 <td>Deposit Amount</td>
//                 <td>Rs. ${summary.depositAmount}</td>
//             </tr>
//             <tr>
//                 <td>Inventory Debit</td>
//                 <td>Rs. ${summary.inventoryDebit}</td>
//             </tr>
//             <tr>
//                 <td>Debited/Adjusted Amount</td>
//                 <td>Rs. ${summary.debitedAdjusted}</td>
//             </tr>
//         `;
//     } catch (error) {
//         console.error('Error:', error);
//         alert('Failed to fetch ledger summary');
//     }
// };

// // Trigger the function on page load or form submission
// fetchLedgerSummary();

document.querySelector('.search-bar button').addEventListener('click', async () => {
    const startDate = document.querySelector('input[type="date"]:nth-child(2)').value;
    const endDate = document.querySelector('input[type="date"]:nth-child(3)').value;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/account-summary?userId=${userId}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        // Update table with fetched data
        document.querySelector('.opening-balance').innerText = `Rs. ${data.openingBalance}`;
        document.querySelector('.closing-balance').innerText = `Rs. ${data.closingBalance}`;
        document.querySelector('.commission-amount').innerText = `Rs. ${data.commission}`;
        document.querySelector('.booking-amount').innerText = `Rs. ${data.bookingAmount}`;
        document.querySelector('.cancellation-refund').innerText = `Rs. ${data.cancellationRefund}`;
        document.querySelector('.deposit-amount').innerText = `Rs. ${data.depositAmount}`;
        document.querySelector('.debited-adjusted-amount').innerText = `Rs. ${data.debitedAdjustedAmount}`;
    } catch (error) {
        console.error(error);
        alert('Error fetching account summary');
    }

    async function loadLedgerEntries() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ledgerEntries?userId=${userId}&startDate=${startDate}&endDate=${endDate}`);
            const data = await response.json();
            console.log(data)
            if (response.ok) {
                const tableBody = document.querySelector('#tbody');
                tableBody.innerHTML = ''; // Clear existing rows


                // Initialize variables
                let openingBalance = data.openingBalance;

                // Add transaction rows
                data.transactions.forEach((txn, index) => {
                    // Calculate opening balance for the current row
                    if (index > 0) {
                        openingBalance = data.transactions[index - 1].closingBalance;
                    }

                    const debit = txn.debit ? txn.debit.toFixed(2) : '';
                    const credit = txn.credit ? txn.credit.toFixed(2) : '';
                    const closingBalance = txn.closingBalance ? txn.closingBalance.toFixed(2) : '';
                    const row = `
            <tr>
                <td>${txn.index}</td>
                <td>${txn.franchiseeId || ''}</td>
                <td>${new Date(txn.dateOfTransaction).toLocaleString()}</td>
                <td>${debit}</td>
                <td class="${txn.credit ? 'credit' : ''}">${credit}</td>
                <td>${txn.remarks || ''}</td>
                <td>${txn.reference || ''}</td>
                <td>${txn.patient || ''}</td>
                <td>${txn.testName || ''}</td>
                <td>${txn.barcodeId || ''}</td>
                <td>${closingBalance}</td>
                <td>${openingBalance ? openingBalance.toFixed(2) : ''}</td>
            </tr>
        `;
                    tableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                console.error(data.message);
            }
        } catch (error) {
            console.error('Error fetching ledger entries:', error);
        }
    }

    // Call the function to load data when the page is ready
    loadLedgerEntries();
});   


document.querySelector('.download-excel').addEventListener('click', function () {
    const table = document.querySelector('#tbody');

    if (table.rows.length === 0) {
        alert('No data available for Excel generation');
        return;
    }

    const data = [];
    
    // Header row
    const headers = [
        'S.No', 'Franchisee ID', 'Date & Time', 'Debit', 'Credit',
        'Remarks', 'Reference', 'Patient', 'Test Name', 'Barcode ID',
        'Closing Balance', 'Opening Balance'
    ];

    data.push(headers);

    // Table data
    for (let i = 0; i < table.rows.length; i++) {
        const row = [];
        const cells = table.rows[i].cells;

        for (let j = 0; j < cells.length; j++) {
            row.push(cells[j].innerText);
        }

        data.push(row);
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Styling: Bold headers
    headers.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (!worksheet[cellRef]) return;
        worksheet[cellRef].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F81BD" } }, // Blue background
        };
    });

    // Apply green color to credit column (index 4)
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: 4 });
        if (!worksheet[cellRef]) continue;
        const creditValue = worksheet[cellRef].v;
        if (creditValue && creditValue !== '0') {
            worksheet[cellRef].s = {
                font: { color: { rgb: "008000" } } // Green text
            };
        }
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Franchisee Account');

    // Write file
    XLSX.writeFile(workbook, 'franchiseeAccount.xlsx');
});

document.querySelector('.commission-excel').addEventListener('click', function () {
    const commissionData = [
        { FranchiseeID: 'UP009', Commission: 25, Remarks: 'Booking Commission' },
        // Add other commission data here
    ];

    const ws = XLSX.utils.json_to_sheet(commissionData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commission Data');

    // Download Excel file
    XLSX.writeFile(wb, 'CommissionData.xlsx');
});
