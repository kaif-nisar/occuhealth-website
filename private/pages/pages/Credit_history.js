async function fetchTransactions() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const timeStamp = document.getElementById('time-span').value;

    // Fetch data from the backend using the selected dates

    const response = await fetch(`${BASE_URL}/api/v1/user/transaction-history?startDate=${startDate}&endDate=${endDate}&userId=${userId}&timeStamp=${timeStamp}`);
    const data = await response.json();
    console.log(data)
    // Get the table body
    const tableBody = document.getElementById('transaction-body');
    tableBody.innerHTML = '';

    // Populate table with fetched data
    data.transactions.forEach(transaction => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${new Date(transaction.createdAt).toLocaleDateString()}</td>
            <td>${new Date(transaction.createdAt).toLocaleTimeString()}</td>
            <td>${transaction.username}</td>
            <td class="${transaction.type === 'credit' ? 'credit' : 'debit'}">
                ${transaction.type === 'credit' ? '+' : '-'}${transaction.amount}
            </td>
            <td>${transaction.remarks}</td>
            <td>${transaction.transactionId}</td>
            <td>${transaction.description}</td>
        `;

        tableBody.appendChild(row);
    });
}
fetchTransactions();
