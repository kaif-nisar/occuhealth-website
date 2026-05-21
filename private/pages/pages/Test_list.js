(async function initializeTestList() {
    const testTableBody = document.querySelector('.table-container tbody');
    const searchInput = document.getElementById('search');
    let allTests = []; // Store all tests for filtering

    // Fetch and Render Test Data
    async function fetchAndRenderTests() {
        console.log('Fetching tests...');
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}`, { method: "POST" });
            if (!response.ok) throw new Error('Failed to fetch test data.');

            const result = await response.json();
            console.log(result);
            if (result && result.length > 0) {
                allTests = result; // Store all tests
                renderTests(allTests);
                updateTotalEntries(allTests.length);
            } else {
                testTableBody.innerHTML = '<tr><td colspan="6">No panels found.</td></tr>';
                updateTotalEntries(0);
            }
        } catch (err) {
            console.error('Error fetching test panels:', err);
            testTableBody.innerHTML = '<tr><td colspan="6">Error loading panels.</td></tr>';
            updateTotalEntries(0);
        }
    }

    // Render tests to table
    function renderTests(tests) {
        testTableBody.innerHTML = ''; // Clear existing rows
        tests.forEach((panel, index) => {
            const row = `
                <tr>
                    <td>${index + 1}</td>
                    <td>${panel.panelName || 'N/A'}</td>
                    <td>Rs. ${panel.mrpPrice || 'N/A'}</td>
                    <td>Rs. ${panel.myPrice || 'N/A'}</td>
                    <td class="sample-list">${formatSamples(panel.sampleType || [])}</td>
                    <td>${formatDate(panel.createdAt)}</td>
                </tr>
            `;
            testTableBody.insertAdjacentHTML('beforeend', row);
        });
    }

    // Search functionality
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            renderTests(allTests);
            updateTotalEntries(allTests.length);
            return;
        }

        const filteredTests = allTests.filter(panel => {
            const panelName = (panel.panelName || '').toLowerCase();
            const mrpPrice = (panel.mrpPrice || '').toString().toLowerCase();
            const myPrice = (panel.myPrice || '').toString().toLowerCase();
            const sampleTypes = (panel.sampleType || []).join(' ').toLowerCase();
            
            return panelName.includes(searchTerm) || 
                   mrpPrice.includes(searchTerm) || 
                   myPrice.includes(searchTerm) ||
                   sampleTypes.includes(searchTerm);
        });

        renderTests(filteredTests);
        updateTotalEntries(filteredTests.length);
    }

    // Update total entries count
    function updateTotalEntries(count) {
        const totalEntriesDiv = document.querySelector('.total-entries');
        if (totalEntriesDiv) {
            totalEntriesDiv.textContent = `Total Entries: ${count}`;
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
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    // Initialize Modal
    function initializeModal() {
        const modal = document.querySelector('.modal');
        if (!modal) return;
        
        const closeModalBtn = document.querySelector('.modal-footer button');
        const closeSpan = document.querySelector('.modal-header .close');

        function closeModal() {
            modal.style.display = 'none';
        }

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (closeSpan) closeSpan.addEventListener('click', closeModal);
    }

    // Add search event listener
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Initialize Page
    fetchAndRenderTests();
    initializeModal();
})();

// PDF Generation
document.getElementById('pdfBtnJ').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const table = document.querySelector('#table');
    const tableRows = table.querySelectorAll('#tbody tr');
    
    if (tableRows.length === 0) {
        alert('No data available for PDF generation');
        return;
    }

    const rows = [];
    const headers = Array.from(table.querySelectorAll('thead th')).map(header => header.innerText);

    tableRows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText);
        rows.push(rowData);
    });

    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        margin: { top: 10, left: 10, right: 10, bottom: 10 },
        theme: 'grid'
    });

    doc.save('test_profiles.pdf');
});