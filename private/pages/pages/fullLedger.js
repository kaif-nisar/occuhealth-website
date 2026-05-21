initializePage();

async function initializePage() {
    await populateFranchiseeDropdown();
    setupEventListeners();
    setDefaultDates();

    // Show/hide columns based on user type
    if (user.tenantId.modelType === '1layer') {
        document.querySelectorAll('.forone').forEach(el => el.style.display = 'table-cell');
        document.querySelectorAll('.formany').forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll('.forone').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.formany').forEach(el => el.style.display = 'table-cell');
    }
}

// Populate franchisee dropdown (your original)
async function populateFranchiseeDropdown() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`);
        const data = await response.json();

        const select = document.getElementById('franchisee-select');
        const items = Array.isArray(data) ? data : (data.message && Array.isArray(data.message) ? data.message : []);
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id || item.id;
            option.textContent = item.fullName || item.username || item.name || 'Unnamed Franchisee';
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching franchisees:", error);
    }
}

function setDefaultDates() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
}

function setupEventListeners() {
    document.getElementById('view-ledger-btn').addEventListener('click', loadLedgerData);
    document.getElementById('apply-filter-btn').addEventListener('click', applyFiltersAndRender);
    document.getElementById('search').addEventListener('input', applyFiltersAndRender);

    document.querySelector('.download-excel').addEventListener('click', downloadExcel);
    document.querySelector('.download-pdf').addEventListener('click', downloadPDF);
}

// Main loader
async function loadLedgerData() {
    const franchiseeSelect = document.getElementById('franchisee-select');
    const selectedFranchisee = franchiseeSelect.value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const franchiseeId = selectedFranchisee === 'self' ? userId : selectedFranchisee;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    try {
        await loadAccountSummary(franchiseeId, startDate, endDate);

        // Fetch ledger entries (no doctor/lab params since backend not changing)
        const q = new URLSearchParams({ userId: franchiseeId, startDate, endDate });
        const response = await fetch(`${BASE_URL}/api/v1/user/ledgerEntries?${q.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch ledger entries');
        const data = await response.json();

        // Store transactions globally so filter can re-run easily
        window.__ledgerData = data; // keep original data

        // Render all entries
        renderLedgerEntries(data);

        // Populate doctor & lab selects from transactions
        populateDoctorLabFromTransactions(data.transactions || []);

        // Update title
        const start = new Date(startDate).toLocaleDateString();
        const end = new Date(endDate).toLocaleDateString();
        document.getElementById('accounts-summary-title').textContent = `Accounts Summary (${start} - ${end})`;

    } catch (error) {
        console.error('Error loading ledger data:', error);
        alert('Error loading ledger data');
    }
}

async function loadAccountSummary(franchiseeId, startDate, endDate) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/account-summary?userId=${franchiseeId}&startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();
        if (!response.ok) {
            alert(data.message || 'Failed to fetch account summary');
            return;
        }
        document.querySelector('.opening-balance').innerText = `Rs. ${data.openingBalance || 0}`;
        document.querySelector('.closing-balance').innerText = `Rs. ${data.closingBalance || 0}`;
        document.querySelector('.commission-amount').innerText = `Rs. ${data.commission || 0}`;
        document.querySelector('.booking-amount').innerText = `Rs. ${data.bookingAmount || 0}`;
        document.querySelector('.cancellation-refund').innerText = `Rs. ${data.cancellationRefund || 0}`;
        document.querySelector('.deposit-amount').innerText = `Rs. ${data.depositAmount || 0}`;
        document.querySelector('.debited-adjusted-amount').innerText = `Rs. ${data.debitedAdjustedAmount || 0}`;
        document.querySelector('.inventory-debit').innerText = `Rs. ${data.inventoryDebit || 0}`;
    } catch (error) {
        console.error('Error fetching account summary:', error);
        throw error;
    }
}

// Render ledger entries (unfiltered)
function renderLedgerEntries(data) {
    const tableBody = document.querySelector('#tbody');
    tableBody.innerHTML = '';

    const transactions = Array.isArray(data.transactions) ? data.transactions : [];

    if (!transactions.length) {
        tableBody.innerHTML = '<tr><td colspan="17" style="text-align: center;">No transactions found for the selected period</td></tr>';
        return;
    }

    let openingBalance = data.openingBalance || 0;

    transactions.forEach((txn, idx) => {
        if (idx > 0) openingBalance = transactions[idx - 1].closingBalance || openingBalance;

        const debit = txn.debit ? parseFloat(txn.debit).toFixed(2) : '';
        const credit = txn.credit ? parseFloat(txn.credit).toFixed(2) : '';
        const closingBalance = txn.closingBalance ? parseFloat(txn.closingBalance).toFixed(2) : '';

        if (user.tenantId.modelType === '1layer') {
            const testNames = (txn.booking?.tableData || []).map(t => t.testName).join(', ') || '';
            const doctorName = txn?.booking?.doctorName || txn.doctorName || '';
            const row = `
              <tr data-doctor="${escapeHtml(doctorName)}" data-lab="${escapeHtml('')}">
                <td>${idx + 1}</td>
                <td>${txn.franchiseeId || ''}</td>
                <td>${new Date(txn.dateOfTransaction).toLocaleString()}</td>
                <td>${debit}</td>
                <td>${txn.remarks || ''}</td>
                <td>${txn.reference || ''}</td>
                <td>${txn.patient || ''}</td>
                <td>${doctorName}</td>
                <td>${testNames}</td>
                <td>${txn.barcodeId || ''}</td>
                <td>${txn.discountamount || ''}</td>
                <td>${txn.discountunit || ''}</td>
                <td>${txn.booking?.total || ''}</td>
              </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        } else {
            const testNames = (txn.booking?.tableData || []).map(t => t.testName).join(', ') || '';
            const doctorName = txn?.booking?.doctorName || txn.doctorName || '';
            const labName = txn?.booking?.labName || txn.labName || '';
            const row = `
              <tr data-doctor="${escapeHtml(doctorName)}" data-lab="${escapeHtml(labName)}">
                <td>${idx + 1}</td>
                <td>${txn.franchiseeId || ''}</td>
                <td>${new Date(txn.dateOfTransaction).toLocaleString()}</td>
                <td>${debit}</td>
                <td class="${txn.credit ? 'credit' : ''}">${credit}</td>
                <td>${txn.remarks || ''}</td>
                <td>${txn.reference || ''}</td>
                <td>${txn.patient || ''}</td>
                <td>${doctorName}</td>
                <td>${testNames}</td>
                <td>${txn.barcodeId || ''}</td>
                <td>${labName}</td>
                <td>${txn.booking?.total || ''}</td>
                <td>${closingBalance}</td>
                <td>${openingBalance.toFixed(2)}</td>
              </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        }
    });
}

// Populate doctor & lab selects from transactions
function populateDoctorLabFromTransactions(transactions) {
    const doctorSelect = document.getElementById('doctor-select');
    const labSelect = document.getElementById('lab-select');

    const doctors = new Set();
    const labs = new Set();

    transactions.forEach(txn => {
        const d = (txn?.booking?.doctorName || txn.doctorName || '').toString().trim();
        const l = (txn?.booking?.labName || txn.labName || '').toString().trim();
        if (d) doctors.add(d);
        if (l) labs.add(l);
    });

    // clear existing (keep "all")
    while (doctorSelect.options.length > 1) doctorSelect.remove(1);
    while (labSelect.options.length > 1) labSelect.remove(1);

    doctors.forEach(name => {
        const o = document.createElement('option');
        o.value = name;
        o.textContent = name;
        doctorSelect.appendChild(o);
    });

    labs.forEach(name => {
        const o = document.createElement('option');
        o.value = name;
        o.textContent = name;
        labSelect.appendChild(o);
    });
}

// Apply filters (doctor, lab, search) and show/hide rows accordingly
function applyFiltersAndRender() {
    const doctor = document.getElementById('doctor-select').value;
    const lab = document.getElementById('lab-select').value;
    const searchTerm = document.getElementById('search').value.trim().toLowerCase();

    const rows = document.querySelectorAll('#tbody tr');

    rows.forEach(row => {
        // if this is the 'no data' row, keep its display logic
        if (row.querySelectorAll('td').length === 1) return;

        const rowDoctor = (row.dataset.doctor || '').toString().toLowerCase();
        const rowLab = (row.dataset.lab || '').toString().toLowerCase();
        const text = row.textContent.toLowerCase();

        const doctorMatch = (doctor === 'all') || (!!rowDoctor && rowDoctor === doctor.toLowerCase());
        const labMatch = (lab === 'all') || (!!rowLab && rowLab === lab.toLowerCase());
        const searchMatch = searchTerm === '' || text.includes(searchTerm);

        row.style.display = (doctorMatch && labMatch && searchMatch) ? '' : 'none';
    });
}

// Download Excel — skip hidden rows
function downloadExcel() {
    const table = document.querySelector('#tbody');
    if (!table || table.rows.length === 0 || (table.rows[0].cells[0].textContent && table.rows[0].cells[0].textContent.includes('No transactions'))) {
        alert('No data available for Excel generation');
        return;
    }

    const data = [];
    const headers = [
        'S.No', 'Franchisee ID', 'Date & Time', 'Debit',
        'Remarks', 'Reference', 'Patient', 'Test Name', 'Barcode ID'
    ];

    if (user.tenantId.modelType === '1layer') {
        headers.splice(7, 0, 'Doctor');
        headers.splice(10, 0, 'Discount', 'Discount (%)');
        headers.splice(12, 0, 'Booking-Amount');
    } else {
        headers.splice(4, 0, 'Credit');
        headers.splice(8, 0, 'Doctor');
        headers.splice(11, 0, 'Lab Name','Booking-Amount', 'Closing Balance', 'Opening Balance');
    }

    data.push(headers);

    for (let i = 0; i < table.rows.length; i++) {
        const tr = table.rows[i];
        if (tr.style.display === 'none') continue; // skip filtered out rows

        const row = [];
        const cells = tr.cells;
        for (let j = 0; j < cells.length; j++) {
            row.push(cells[j].innerText);
        }
        data.push(row);
    }

    if (data.length === 1) {
        alert('No visible rows to export');
        return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Bold header styling
    headers.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (!worksheet[cellRef]) return;
        worksheet[cellRef].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F81BD" } },
        };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Franchisee Account');
    XLSX.writeFile(workbook, 'franchiseeAccount.xlsx');
}

// Download PDF — already skipping hidden rows; keep same logic but ensure skip
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const table = document.querySelector('#tbody');

    if (!table || table.rows.length === 0 || (table.rows[0].cells[0].textContent && table.rows[0].cells[0].textContent.includes('No transactions'))) {
        alert('No data available for PDF generation');
        return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');

    const headers = [
        'S.No', 'Franchisee ID', 'Date & Time', 'Debit',
        'Remarks', 'Reference', 'Patient', 'Test Name', 'Barcode ID'
    ];

    if (user.tenantId.modelType === '1layer') {
        headers.splice(7, 0, 'Doctor');
        headers.splice(10, 0, 'Discount', 'Discount (%)');
        headers.splice(12, 0, 'Booking-Amount');
    } else {
        headers.splice(4, 0, 'Credit');
        headers.splice(8, 0, 'Doctor');
        headers.splice(11, 0, 'Lab Name','Booking-Amount', 'Closing Balance', 'Opening Balance');
    }

    const data = [];
    for (let i = 0; i < table.rows.length; i++) {
        const tr = table.rows[i];
        if (tr.style.display === 'none') continue; // skip filtered rows
        const row = [];
        const cells = tr.cells;
        for (let j = 0; j < cells.length; j++) {
            row.push(cells[j].innerText);
        }
        data.push(row);
    }

    if (data.length === 0) {
        alert('No visible rows to export as PDF');
        return;
    }

    doc.setFontSize(16);
    doc.text('Franchisee Account', 14, 15);

    doc.autoTable({
        head: [headers],
        body: data,
        startY: 20,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 129, 189], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 20 }
    });

    doc.save('franchiseeAccount.pdf');
}

// small helper to avoid broken html attributes (optional)
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
              .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
