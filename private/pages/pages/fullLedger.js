(function() {
'use strict';

// ---- GLOBAL STATE ----
var ALL = [];
var openingBalance = 0;
var closingBalance = 0;
var currentPage = 1;
var rowsPerPage = 50;
var debounceTimer = null;
var selectedFranchiseeName = '';
var is1Layer = false;
var currentFranchiseeId = null;
var currentStartDate = '';
var currentEndDate = '';

// ---- STORE doctor/lab DROPDOWN DATA for dependent filtering ----
var allDoctorsList = [];   // { _id, name }
var allLabsList = [];       // { _id, name }
var currentFranchiseeForDropdowns = null;  // which franchisee loaded the current dropdown data

// ---- PAGE INIT ----
init();

async function init() {
    await populateFranchisees();
    bindEvents();
    setDefaultDates();
    is1Layer = !!(user && user.tenantId && user.tenantId.modelType === '1layer');
    document.querySelectorAll('.forone').forEach(function(el) { el.style.display = is1Layer ? 'table-cell' : 'none'; });
    document.querySelectorAll('.formany').forEach(function(el) { el.style.display = is1Layer ? 'none' : 'table-cell'; });

    // On initial load, if "Self" is selected, load its doctors/labs (but don't auto-fetch ledger)
    var fid = document.getElementById('franchisee-select').value;
    if (fid) {
        loadDoctorsLabsForFranchisee(fid === 'self' ? userId : fid);
    }
}

// ---- FRANCHISEE DROPDOWN ----
async function populateFranchisees() {
    try {
        var res = await fetch(BASE_URL + '/api/v1/user/get-super-franchisee?userId=' + userId);
        var data = await res.json();
        var sel = document.getElementById('franchisee-select');
        var list = Array.isArray(data) ? data : (data.message && Array.isArray(data.message) ? data.message : []);
        list.forEach(function(item) {
            var o = document.createElement('option');
            o.value = item._id || item.id;
            o.textContent = item.fullName || item.username || item.name || 'Unnamed';
            sel.appendChild(o);
        });
    } catch(e) { console.error(e); }
}

function setDefaultDates() {
    var n = new Date();
    document.getElementById('start-date').value = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('end-date').value = new Date(n.getFullYear(), n.getMonth()+1, 0).toISOString().split('T')[0];
}

// ---- EVENT BINDING ----
function bindEvents() {
    // View button — ONLY trigger fetch on explicit View click
    document.getElementById('view-ledger-btn').addEventListener('click', fetchLedger);

    // Franchisee change -> reload doctor/lab dropdowns (NO auto-fetch of ledger)
    document.getElementById('franchisee-select').addEventListener('change', function() {
        var fid = this.value;
        var actualId = fid === 'self' ? userId : fid;
        resetDoctorLabDropdowns();
        // Clear stored lists since franchisee changed
        allDoctorsList = [];
        allLabsList = [];
        currentFranchiseeForDropdowns = null;
        loadDoctorsLabsForFranchisee(actualId);
        // Do NOT auto-fetch ledger — user must click View
    });

    // Doctor/Lab dropdown change — do NOT auto-fetch, user must click View
    document.getElementById('doctor-select').addEventListener('change', function() {
        // No auto-fetch — View button handles it
    });
    document.getElementById('lab-select').addEventListener('change', function() {
        // No auto-fetch — View button handles it
    });

    // Search = client-side filter (debounced)
    document.getElementById('search').addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilters, 300);
    });

    document.querySelector('.download-excel').addEventListener('click', exportExcel);
    document.querySelector('.download-pdf').addEventListener('click', exportPDF);

    document.getElementById('prev-page-btn').addEventListener('click', function(){ changePage(-1); });
    document.getElementById('next-page-btn').addEventListener('click', function(){ changePage(1); });
    document.getElementById('rows-per-page').addEventListener('change', function(e) {
        rowsPerPage = e.target.value === 'all' ? 999999 : parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });
}

// ---- RESET DOCTOR/LAB DROPDOWNS TO DEFAULT ----
function resetDoctorLabDropdowns() {
    var docSel = document.getElementById('doctor-select');
    var labSel = document.getElementById('lab-select');
    // Keep only first option ("All Doctors" / "All Labs")
    while (docSel.options.length > 1) docSel.remove(1);
    while (labSel.options.length > 1) labSel.remove(1);
    docSel.value = 'all';
    labSel.value = 'all';
}

// ---- LOAD DOCTORS & LABS SPECIFIC TO SELECTED FRANCHISEE ----
async function loadDoctorsLabsForFranchisee(franchiseeId) {
    if (!franchiseeId) return;
    try {
        var res = await fetch(BASE_URL + '/api/v1/user/franchisee-doctors-labs?franchiseeId=' + franchiseeId);
        var data = await res.json();
        var docSel = document.getElementById('doctor-select');
        var labSel = document.getElementById('lab-select');

        // Reset dropdowns before populating
        resetDoctorLabDropdowns();

        allDoctorsList = [];
        allLabsList = [];
        currentFranchiseeForDropdowns = franchiseeId;

        if (data.doctors && Array.isArray(data.doctors)) {
            allDoctorsList = data.doctors;
            data.doctors.forEach(function(d) {
                var o = document.createElement('option');
                o.value = d._id || d.name;
                o.textContent = d.name || 'Unnamed';
                docSel.appendChild(o);
            });
        }
        if (data.labs && Array.isArray(data.labs)) {
            allLabsList = data.labs;
            data.labs.forEach(function(l) {
                var o = document.createElement('option');
                o.value = l._id || l.name;
                o.textContent = l.name || 'Unnamed';
                labSel.appendChild(o);
            });
        }
    } catch(e) { console.error('Error loading doctors/labs for franchisee:', e); }
}

// ---- MAIN: LOAD LEDGER (sends ALL filters to backend) ----
async function fetchLedger() {
    var franchiseeSel = document.getElementById('franchisee-select');
    var fid = (franchiseeSel.value === 'self') ? userId : franchiseeSel.value;
    var sDate = document.getElementById('start-date').value;
    var eDate = document.getElementById('end-date').value;
    var docId = document.getElementById('doctor-select').value;
    var labId = document.getElementById('lab-select').value;

    selectedFranchiseeName = franchiseeSel.options[franchiseeSel.selectedIndex] ? franchiseeSel.options[franchiseeSel.selectedIndex].textContent : '';
    currentFranchiseeId = fid;
    currentStartDate = sDate;
    currentEndDate = eDate;

    if (!sDate || !eDate) { alert('Please select both start and end dates'); return; }
    if (!fid) { alert('Please select a franchisee'); return; }

    showLoading();

    try {
        // Build URLs — both summary and ledger now support doctorId/labId
        var summaryUrl = BASE_URL + '/api/v1/user/account-summary?userId=' + fid + '&startDate=' + sDate + '&endDate=' + eDate;
        var ledgerUrl = BASE_URL + '/api/v1/user/ledgerEntries?userId=' + fid + '&startDate=' + sDate + '&endDate=' + eDate;

        if (docId && docId !== 'all') {
            summaryUrl += '&doctorId=' + encodeURIComponent(docId);
            ledgerUrl += '&doctorId=' + encodeURIComponent(docId);
        }
        if (labId && labId !== 'all') {
            summaryUrl += '&labId=' + encodeURIComponent(labId);
            ledgerUrl += '&labId=' + encodeURIComponent(labId);
        }

        var results = await Promise.all([fetch(summaryUrl), fetch(ledgerUrl)]);
        var sRes = results[0], lRes = results[1];

        // Summary
        if (sRes.ok) {
            var summary = await sRes.json();
            document.querySelector('.opening-balance').textContent = 'Rs. ' + ((summary.openingBalance || 0).toLocaleString());
            document.querySelector('.closing-balance').textContent = 'Rs. ' + ((summary.closingBalance || 0).toLocaleString());
            document.querySelector('.commission-amount').textContent = 'Rs. ' + ((summary.commission || 0).toLocaleString());
            document.querySelector('.booking-amount').textContent = 'Rs. ' + ((summary.bookingAmount || 0).toLocaleString());
        }

        // Ledger entries
        var txns = [];
        if (lRes.ok) {
            var ld = await lRes.json();
            openingBalance = ld.openingBalance || 0;
            closingBalance = ld.closingBalance || 0;
            txns = Array.isArray(ld.transactions) ? ld.transactions : [];
        }

        ALL = txns;
        updateDebitCreditStats(txns);
        currentPage = 1;
        applyFilters();
        document.getElementById('pagination-controls').style.display = 'flex';
    } catch(e) {
        console.error(e);
        alert('Error loading data');
    } finally {
        hideLoading();
    }
}

function updateDebitCreditStats(txns) {
    var td = 0, tc = 0;
    txns.forEach(function(t) {
        if (t.debit) td += parseFloat(t.debit) || 0;
        if (t.credit) tc += parseFloat(t.credit) || 0;
    });
    document.querySelector('.total-debit').textContent = 'Rs. ' + td.toLocaleString();
    document.querySelector('.total-credit').textContent = 'Rs. ' + tc.toLocaleString();
}

// ---- APPLY CLIENT-SIDE FILTERS (search only, doctor/lab already filtered by backend) ----
function applyFilters() {
    var searchTerm = document.getElementById('search').value.trim().toLowerCase();

    var filtered = ALL.filter(function(txn) {
        if (searchTerm) {
            var testNames = Array.isArray(txn.testName) ? txn.testName.join(' ') : (txn.testName || '');
            var str = [
                txn.franchiseeId || '', txn.remarks || '', txn.reference || '', txn.patient || '',
                testNames, txn.barcodeId || '',
                (txn.booking && txn.booking.doctorName) || txn.doctorName || '',
                (txn.booking && txn.booking.labName) || txn.labName || ''
            ].join(' ').toLowerCase();
            if (str.indexOf(searchTerm) < 0) return false;
        }
        return true;
    });

    var totalRows = filtered.length;
    var totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    var start = (currentPage - 1) * rowsPerPage;
    var page = filtered.slice(start, start + rowsPerPage);

    renderTable(page, start);
    document.getElementById('page-info').textContent = 'Page ' + currentPage + ' of ' + totalPages;
    document.getElementById('total-rows-info').textContent = '(' + totalRows + ' rows)';
    document.getElementById('prev-page-btn').disabled = currentPage <= 1;
    document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
}

function changePage(delta) { currentPage += delta; applyFilters(); }

// ---- RENDER TABLE ----
function renderTable(txns, startIdx) {
    var tbody = document.querySelector('#tbody');
    tbody.innerHTML = '';
    if (!txns.length) {
        tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;padding:24px;color:#999;">No transactions found</td></tr>';
        return;
    }
    txns.forEach(function(txn, i) {
        var rn = startIdx + i + 1;
        var d = txn.debit ? parseFloat(txn.debit).toFixed(2) : '';
        var c = txn.credit ? parseFloat(txn.credit).toFixed(2) : '';
        var tn = Array.isArray(txn.testName) ? txn.testName.join(', ') : (txn.testName || '');
        var dn = (txn.booking && txn.booking.doctorName) || txn.doctorName || '';
        var ln = (txn.booking && txn.booking.labName) || txn.labName || '';
        var pt = txn.patient || (txn.booking && txn.booking.patientName) || '';
        var ba = (txn.booking && txn.booking.total) ? txn.booking.total : '';
        var cb = txn.closingBalance ? parseFloat(txn.closingBalance).toFixed(2) : '';
        var ob = (i > 0 && txns[i-1].closingBalance) ? parseFloat(txns[i-1].closingBalance).toFixed(2) : openingBalance.toFixed(2);

        if (is1Layer) {
            tbody.insertAdjacentHTML('beforeend',
                '<tr><td>'+rn+'</td><td>'+(txn.franchiseeId||'')+'</td><td>'+fmtDate(txn.dateOfTransaction)+'</td>'+
                '<td class="debit">'+d+'</td><td>'+(txn.remarks||'')+'</td><td>'+(txn.reference||'')+'</td>'+
                '<td>'+pt+'</td><td>'+dn+'</td><td>'+tn+'</td><td>'+(txn.barcodeId||'')+'</td>'+
                '<td>'+(txn.discountamount||'0')+'</td><td>'+(txn.discountunit||'0')+'</td><td>'+ba+'</td></tr>');
        } else {
            tbody.insertAdjacentHTML('beforeend',
                '<tr><td>'+rn+'</td><td>'+(txn.franchiseeId||'')+'</td><td>'+fmtDate(txn.dateOfTransaction)+'</td>'+
                '<td class="debit">'+d+'</td><td class="credit">'+c+'</td><td>'+(txn.remarks||'')+'</td>'+
                '<td>'+(txn.reference||'')+'</td><td>'+pt+'</td><td>'+dn+'</td><td>'+tn+'</td>'+
                '<td>'+(txn.barcodeId||'')+'</td><td>'+ln+'</td><td>'+ba+'</td><td>'+cb+'</td><td>'+ob+'</td></tr>');
        }
    });
}

function fmtDate(v) {
    if (!v) return '';
    try { var d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e){}
    return v;
}

// ---- EXPORT EXCEL (from ALL data, not DOM) ----
function exportExcel() {
    if (!ALL.length) { alert('No data to export'); return; }
    var data = [];
    var headers = is1Layer
        ? ['S.No','Franchisee','Date & Time','Debit','Remarks','Reference','Patient','Doctor','Test Name','Barcode ID','Discount','Discount (%)','Booking Amt.']
        : ['S.No','Franchisee','Date & Time','Debit','Credit','Remarks','Reference','Patient','Doctor','Test Name','Barcode ID','Lab Name','Booking Amt.','Closing Bal.','Opening Bal.'];
    data.push(headers);

    ALL.forEach(function(txn, i) {
        var d = txn.debit ? parseFloat(txn.debit).toFixed(2) : '';
        var c = txn.credit ? parseFloat(txn.credit).toFixed(2) : '';
        var tn = Array.isArray(txn.testName) ? txn.testName.join(', ') : (txn.testName||'');
        var dn = (txn.booking&&txn.booking.doctorName)||txn.doctorName||'';
        var ln = (txn.booking&&txn.booking.labName)||txn.labName||'';
        var pt = txn.patient||(txn.booking&&txn.booking.patientName)||'';
        var ba = (txn.booking&&txn.booking.total)||'';
        var cb = txn.closingBalance?parseFloat(txn.closingBalance).toFixed(2):'';
        var ob = i>0&&ALL[i-1].closingBalance?parseFloat(ALL[i-1].closingBalance).toFixed(2):openingBalance.toFixed(2);

        if (is1Layer) {
            data.push([i+1, txn.franchiseeId||'', fmtDate(txn.dateOfTransaction), d, txn.remarks||'', txn.reference||'', pt, dn, tn, txn.barcodeId||'', txn.discountamount||'0', txn.discountunit||'0', ba]);
        } else {
            data.push([i+1, txn.franchiseeId||'', fmtDate(txn.dateOfTransaction), d, c, txn.remarks||'', txn.reference||'', pt, dn, tn, txn.barcodeId||'', ln, ba, cb, ob]);
        }
    });

    var ws = XLSX.utils.aoa_to_sheet(data);
    headers.forEach(function(_, ci) {
        var ref = XLSX.utils.encode_cell({r:0,c:ci});
        if (ws[ref]) ws[ref].s = { font:{bold:true, color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"DC3545"}} };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, 'Ledger_'+(selectedFranchiseeName||'Export')+'.xlsx');
}

// ---- EXPORT PDF (from ALL data) ----
function exportPDF() {
    if (!ALL.length) { alert('No data to export'); return; }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF('l','mm','a4');
    var headers = is1Layer
        ? ['S.No','Franchisee','Date & Time','Debit','Remarks','Reference','Patient','Doctor','Test Name','Barcode ID','Discount','Discount %','Booking Amt.']
        : ['S.No','Franchisee','Date & Time','Debit','Credit','Remarks','Reference','Patient','Doctor','Test Name','Barcode ID','Lab Name','Booking Amt.','Closing Bal.','Opening Bal.'];
    var data = [];

    ALL.forEach(function(txn, i) {
        var d = txn.debit ? parseFloat(txn.debit).toFixed(2) : '';
        var c = txn.credit ? parseFloat(txn.credit).toFixed(2) : '';
        var tn = Array.isArray(txn.testName) ? txn.testName.join(', ') : (txn.testName||'');
        var dn = (txn.booking&&txn.booking.doctorName)||txn.doctorName||'';
        var ln = (txn.booking&&txn.booking.labName)||txn.labName||'';
        var pt = txn.patient||(txn.booking&&txn.booking.patientName)||'';
        var ba = (txn.booking&&txn.booking.total)||'';
        var cb = txn.closingBalance?parseFloat(txn.closingBalance).toFixed(2):'';
        var ob = i>0&&ALL[i-1].closingBalance?parseFloat(ALL[i-1].closingBalance).toFixed(2):openingBalance.toFixed(2);

        if (is1Layer) {
            data.push([i+1, txn.franchiseeId||'', fmtDate(txn.dateOfTransaction), d, txn.remarks||'', txn.reference||'', pt, dn, tn, txn.barcodeId||'', txn.discountamount||'0', txn.discountunit||'0', ba]);
        } else {
            data.push([i+1, txn.franchiseeId||'', fmtDate(txn.dateOfTransaction), d, c, txn.remarks||'', txn.reference||'', pt, dn, tn, txn.barcodeId||'', ln, ba, cb, ob]);
        }
    });

    doc.setFontSize(16); doc.text('Ledger - '+(selectedFranchiseeName||'Franchisee'), 14, 15);
    doc.setFontSize(10); doc.text('Period: '+currentStartDate+' to '+currentEndDate, 14, 22);
    doc.autoTable({
        head:[headers], body:data, startY:28,
        styles:{fontSize:7, cellPadding:2},
        headStyles:{fillColor:[220,53,69], textColor:255, fontStyle:'bold'},
        alternateRowStyles:{fillColor:[248,249,250]},
        margin:{top:28}
    });
    doc.save('Ledger_'+(selectedFranchiseeName||'Export')+'.pdf');
}

// ---- UTILITY ----
function showLoading() { document.getElementById('loading-overlay').classList.add('show'); document.getElementById('view-ledger-btn').disabled = true; }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('show'); document.getElementById('view-ledger-btn').disabled = false; }

})();