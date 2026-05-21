(async function initializeTestProfiles() {
    const profileTableBody = document.querySelector('.table-container tbody');

    // Fetch and Render Test Profiles
    async function fetchAndRenderProfiles() {
        console.log('Fetching test profiles...');
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}`, { method: "POST" });
            if (!response.ok) throw new Error('Failed to fetch test profiles.');

            const result = await response.json();
            console.log(result)
            if (result) {
                profileTableBody.innerHTML = ''; // Clear existing rows
                result.forEach((profile, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${profile.packageName || 'N/A'}</td>
                            <td>${(profile.testNames.length + profile.panelNames.length) || 0}</td>
                             <td>${formatTestAndPanel(profile.testNames, profile.panelNames)}</td>
                        </tr>
                    `;
                    profileTableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                profileTableBody.innerHTML = '<tr><td colspan="4">No test profiles found.</td></tr>';
            }
        } catch (err) {
            console.error('Error fetching test profiles:', err);
            profileTableBody.innerHTML = '<tr><td colspan="4">Error loading test profiles.</td></tr>';
        }
    }

    // Helper to format test names and panel names together
    function formatTestAndPanel(testNames, panelNames) {
        const formattedTestNames = testNames.length > 0 ? testNames.map((test) => `${test}`).join(',<br>') : 'N/A';
        const formattedPanelNames = panelNames.length > 0 ? panelNames.map((panel) => `${panel}`).join(',<br>') : 'N/A';

        return `${formattedTestNames},${formattedPanelNames}`;
    }


    // Initialize the page
    fetchAndRenderProfiles();
})();

document.getElementById('excelBtn').addEventListener('click', function () {
    const table = document.querySelector('table');
    
    // Check if the table has rows
    if (table.rows.length === 0) {
        alert('No data available for Excel generation');
        return;
    }

    // Create Excel file from the table
    const workbook = XLSX.utils.table_to_book(table, { sheet: 'Test Profiles' });

    // Log the workbook content (for debugging purposes)
    console.log(workbook);

    // Write the Excel file
    XLSX.writeFile(workbook, 'test_profiles.xlsx');
});

document.getElementById('pdfBtn').addEventListener('click', function () {
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
    doc.save('test_profiles.pdf');
});
