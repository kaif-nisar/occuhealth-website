(async function initializeTestList() {
    const testTableBody = document.querySelector('.table-container tbody');

    // Fetch and Render Test Data
    async function fetchAndRenderTests() {
        console.log('Fetching tests...');
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}`, { method: "POST" });
            if (!response.ok) throw new Error('Failed to fetch test data.');

            const result = await response.json();
            console.log(result);
            if (result) {
                testTableBody.innerHTML = ''; // Clear existing rows
                result.forEach((panel, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${panel.panelName || 'N/A'}</td>
                            <td>Rs. ${panel.mrpPrice || 'N/A'}</td>
                            <td>Rs. ${panel.myPrice || 'N/A'}</td>
                            <td>${formatSamples(panel.sampleType || [])}</td>
                            <td>${formatDate(panel.assignedAt)}</td>
                        </tr>
                    `;
                    testTableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                testTableBody.innerHTML = '<tr><td colspan="7">No panels found.</td></tr>';
            }
        } catch (err) {
            console.error('Error fetching test panels:', err);
            testTableBody.innerHTML = '<tr><td colspan="7">Error loading panels.</td></tr>';
        }
    }

    // Helper to format samples
    function formatSamples(samples) {
        return samples.length > 0 
            ? samples.map((sample, i) => `<div>${i + 1}. ${sample}</div>`).join('') 
            : 'N/A';
    }

    // Helper to format dates
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    // Initialize Modal
    function initializeModal() {
        const modal = document.querySelector('.modal');
        const closeModalBtn = document.querySelector('.modal-footer button');
        const closeSpan = document.querySelector('.modal-header .close');

        function closeModal() {
            modal.style.display = 'none';
        }

        closeModalBtn.addEventListener('click', closeModal);
        closeSpan.addEventListener('click', closeModal);
    }

    // Initialize Page
    fetchAndRenderTests();
    initializeModal();
})();



document.getElementById('pdfBtnJ').addEventListener('click', function () {
    alert('pdf')
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Grab the HTML table content and prepare an array of rows
    const table = document.querySelector('#table');
    console.log(table)
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
    doc.save('test_profiles.pdf');
});
