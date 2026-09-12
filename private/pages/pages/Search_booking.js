// Search_booking.js - Advanced Search Page with Pagination, Filters & More
// Wrapped in IIFE to avoid global scope conflicts with parent page variables
(function () {
'use strict';

var currentPage = 1, totalPages = 1, totalResults = 0;
var currentSearch = '', currentField = '', currentStatus = '';
var currentFromDate = '', currentToDate = '', currentLimit = 10;
var sortOrder = 'desc', isLoading = false;

var searchInput    = document.getElementById('search-input');
var searchFieldSel = document.getElementById('search-field');
var searchBtn      = document.getElementById('search-button');
var clearBtnEl     = document.getElementById('clear-btn');
var fromDateInput  = document.getElementById('from-date');
var toDateInput    = document.getElementById('to-date');
var statusFilterEl = document.getElementById('status-filter');
var pageSizeSel    = document.getElementById('page-size');
var tableBody      = document.getElementById('table-body');
var resultsBar     = document.getElementById('results-bar');
var resultsInfo    = document.getElementById('results-info');
var paginationBar  = document.getElementById('pagination-bar');
var paginationInfo = document.getElementById('pagination-info');
var paginationBtns = document.getElementById('pagination-btns');
var statsRow       = document.getElementById('stats-row');
var sortToggleBtn  = document.getElementById('sort-toggle');
var sortLabelEl    = document.getElementById('sort-label');
var sortIconEl     = document.getElementById('sort-icon');
var resetFiltersBtn = document.getElementById('reset-filters');

// ===== SEARCH TRIGGER =====
function triggerSearch(page) {
  currentSearch    = searchInput.value.trim();
  currentField     = searchFieldSel.value;
  currentStatus    = statusFilterEl.value;
  currentFromDate  = fromDateInput.value;
  currentToDate    = toDateInput.value;
  currentLimit     = parseInt(pageSizeSel.value) || 10;
  currentPage      = page || 1;
  fetchBookings();
}

searchBtn.addEventListener('click', function () { triggerSearch(1); });
searchInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') triggerSearch(1);
  if (e.key === 'Escape') clearSearch();
});
searchInput.addEventListener('input', function () {
  clearBtnEl.style.display = searchInput.value ? 'block' : 'none';
});
clearBtnEl.addEventListener('click', clearSearch);

function clearSearch() {
  searchInput.value = '';
  clearBtnEl.style.display = 'none';
  searchInput.focus();
  triggerSearch(1);
}

// ===== QUICK FILTER TAGS =====
document.querySelectorAll('.qft').forEach(function (tag) {
  tag.addEventListener('click', function () {
    var action = this.dataset.action;
    var status = this.dataset.status;
    if (action) {
      document.querySelectorAll('.qft[data-action]').forEach(function (t) { t.classList.remove('active'); });
      this.classList.toggle('active');
      var today = new Date();
      if (action === 'today') {
        var d = fmtDateInput(today); fromDateInput.value = d; toDateInput.value = d;
      } else if (action === 'yesterday') {
        var y = new Date(today); y.setDate(y.getDate() - 1);
        var d = fmtDateInput(y); fromDateInput.value = d; toDateInput.value = d;
      } else if (action === 'week') {
        var w = new Date(today); w.setDate(w.getDate() - 7);
        fromDateInput.value = fmtDateInput(w); toDateInput.value = fmtDateInput(today);
      }
    }
    if (status) {
      document.querySelectorAll('.qft[data-status]').forEach(function (t) { t.classList.remove('active'); });
      if (statusFilterEl.value === status) { statusFilterEl.value = ''; this.classList.remove('active'); }
      else { statusFilterEl.value = status; this.classList.add('active'); }
    }
    triggerSearch(1);
  }.bind(tag));
});

pageSizeSel.addEventListener('change', function () { triggerSearch(1); });
statusFilterEl.addEventListener('change', function () {
  document.querySelectorAll('.qft[data-status]').forEach(function (t) {
    t.classList.toggle('active', t.dataset.status === statusFilterEl.value);
  });
});

// ===== SORT TOGGLE =====
sortToggleBtn.addEventListener('click', function () {
  sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
  sortIconEl.className = sortOrder === 'desc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up';
  sortLabelEl.textContent = sortOrder === 'desc' ? 'Latest First' : 'Oldest First';
  triggerSearch(currentPage);
});

// ===== RESET FILTERS =====
resetFiltersBtn.addEventListener('click', function () {
  searchInput.value = ''; searchFieldSel.value = ''; statusFilterEl.value = '';
  fromDateInput.value = ''; toDateInput.value = ''; pageSizeSel.value = '10';
  clearBtnEl.style.display = 'none';
  document.querySelectorAll('.qft').forEach(function (t) { t.classList.remove('active'); });
  triggerSearch(1);
});

// ===== FETCH BOOKINGS FROM BACKEND =====
function fetchBookings() {
  if (isLoading) return;
  isLoading = true;
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
  showLoadingState();

  var params = new URLSearchParams({ page: currentPage, limit: currentLimit });
  if (currentSearch)    params.set('search', currentSearch);
  if (currentField)     params.set('field', currentField);
  if (currentStatus)    params.set('status', currentStatus);
  if (currentFromDate)  params.set('fromDate', currentFromDate);
  if (currentToDate)    params.set('toDate', currentToDate);

  fetch(BASE_URL + '/api/v1/user/bookings-search?' + params.toString())
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      var bookings = data.bookings || [];
      totalResults = data.total || 0;
      totalPages   = data.totalPages || 1;
      currentPage  = data.page || 1;
      if (sortOrder === 'asc') bookings.reverse();
      renderTable(bookings);
      renderStats(bookings, data);
      renderPagination();
      updateResultsBar();
    })
    .catch(function (err) {
      console.error('Search error:', err);
      showToast('Failed to fetch bookings. Please try again.', 'error');
      renderErrorState();
    })
    .finally(function () {
      isLoading = false;
      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i class="fas fa-search"></i> <span>Search</span>';
    });
}

// ===== RENDER TABLE =====
function renderTable(bookings) {
  if (!bookings || bookings.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:50px 20px;background:#ffffff;"><div class="es"><div class="ei"><i class="fas fa-inbox"></i></div>' +
      '<div class="et" style="color:#0f172a;font-weight:800;font-size:18px;">No Bookings Found</div><div class="es2" style="color:#334155;font-weight:600;font-size:14px;margin-top:6px;">' +
      (currentSearch
        ? 'No results for &ldquo;<strong style="color:#0f172a;">' + escH(currentSearch) + '</strong>&rdquo;. Try different keywords or adjust filters.'
        : 'No bookings match the selected filters.') +
      '</div></div></td></tr>';
    return;
  }
  var offset = (currentPage - 1) * currentLimit;
  var rows = '';
  bookings.forEach(function (booking, idx) {
    var barcodes  = (booking.tableData || []).map(function (d) { return d.barcodeId; }).filter(Boolean);
    var testNames = (booking.tableData || []).map(function (d) { return d.testName; }).filter(Boolean);
    var doc = booking.doctorName || booking.savedDoctor || '&mdash;';
    var dt  = booking.date ? fmtDisplay(booking.date) : (booking.createdAt ? fmtDisplay(booking.createdAt) : '&mdash;');

    var bHtml = barcodes.length
      ? barcodes.map(function (b) { return '<span class="bch"><i class="fas fa-barcode"></i> ' + hlM(b) + '</span>'; }).join('')
      : '<span style="color:#64748b;font-weight:600;">&mdash;</span>';

    var tStr  = testNames.join(', ');
    var tHtml = testNames.length
      ? '<div class="tnc" style="font-weight:700;color:#0f172a;" title="' + escH(tStr) + '">' + hlM(tStr) + '</div>'
      : '<span style="color:#64748b;font-weight:600;">&mdash;</span>';

    var pn  = escH(booking.patientName || '');
    var bid = escH(booking.bookingId || '');

    rows += '<tr>' +
      '<td style="font-weight:800;color:#0f172a;font-size:13px;text-align:center;">' + (offset + idx + 1) + '</td>' +
      '<td><button class="bil" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\')" title="Download PDF report">' +
        '<i class="fas fa-file-pdf" style="font-size:13px;color:#2563eb;"></i> ' + hlM(booking.bookingId || '') +
      '</button></td>' +
      '<td>' +
        '<div style="font-weight:800;color:#0f172a;font-size:14.5px;">' + hlM(booking.patientName || '&mdash;') + '</div>' +
        (booking.gender
          ? '<div style="font-size:12px;color:#334155;font-weight:700;margin-top:3px;">' + escH(booking.gender) +
            (booking.patientPhone ? ' &bull; <span style="color:#0f172a;">' + escH(booking.patientPhone) + '</span>' : '') + '</div>'
          : '') +
      '</td>' +
      '<td>' + bHtml + '</td>' +
      '<td style="font-weight:700;color:#0f172a;">' + hlM(doc) + '</td>' +
      '<td>' + tHtml + '</td>' +
      '<td>' + getStatusBadge(booking.status) + '</td>' +
      '<td style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;">' + dt + '</td>' +
      '<td><div class="rax">' +
        '<button class="rbtn rbe" onclick="editBooking(\'' + bid + '\')" title="Edit Booking"><i class="fas fa-edit"></i> Edit</button>' +
        '<button class="rbtn rbp" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\')" title="Download PDF"><i class="fas fa-file-pdf"></i> PDF</button>' +
      '</div></td>' +
      '</tr>';
  });
  tableBody.innerHTML = rows;
}

// ===== STATUS BADGE =====
function getStatusBadge(status) {
  var s   = (status || '').toLowerCase();
  var cls = 'bdf';
  if (s === 'on hold')                cls = 'boh';
  else if (s === 'pending')           cls = 'bpe';
  else if (s === 'completed')         cls = 'bco';
  else if (s.indexOf('partial') >= 0) cls = 'bpa';
  return '<span class="sb ' + cls + '">' + escH(status || '&mdash;') + '</span>';
}

// ===== STATS ROW =====
function renderStats(bookings, data) {
  if (!data || data.total === 0) { statsRow.style.display = 'none'; return; }
  var onH  = bookings.filter(function (b) { return b.status === 'On Hold'; }).length;
  var pen  = bookings.filter(function (b) { return b.status === 'Pending'; }).length;
  var comp = bookings.filter(function (b) { return b.status === 'completed'; }).length;
  statsRow.style.display = 'flex';
  statsRow.innerHTML =
    '<div class="sch"><div class="sci" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;"><i class="fas fa-layer-group"></i></div><div><div class="sv">' + data.total + '</div><div class="sl">Total Found</div></div></div>' +
    '<div class="sch"><div class="sci" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;"><i class="fas fa-pause-circle"></i></div><div><div class="sv" style="color:#dc2626;">' + onH + '</div><div class="sl">On Hold</div></div></div>' +
    '<div class="sch"><div class="sci" style="background:#fefce8;color:#d97706;border:1px solid #fef08a;"><i class="fas fa-hourglass-half"></i></div><div><div class="sv" style="color:#d97706;">' + pen + '</div><div class="sl">Pending</div></div></div>' +
    '<div class="sch"><div class="sci" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;"><i class="fas fa-check-circle"></i></div><div><div class="sv" style="color:#16a34a;">' + comp + '</div><div class="sl">Completed</div></div></div>';
}

// ===== RESULTS BAR =====
function updateResultsBar() {
  resultsBar.style.display = 'flex';
  var start = (currentPage - 1) * currentLimit + 1;
  var end   = Math.min(currentPage * currentLimit, totalResults);
  var txt   = 'Showing <strong style="color:#0f172a;font-weight:800;">' + start + '&ndash;' + end + '</strong> of <strong style="color:#0f172a;font-weight:800;">' + totalResults + '</strong> bookings';
  if (currentSearch) txt += ' for &ldquo;<strong style="color:#2563eb;font-weight:800;">' + escH(currentSearch) + '</strong>&rdquo;';
  if (currentStatus) txt += ' &bull; Status: <strong style="color:#0f172a;font-weight:800;">' + escH(currentStatus) + '</strong>';
  resultsInfo.innerHTML = txt;
}

// ===== PAGINATION =====
function renderPagination() {
  if (totalPages <= 1) { paginationBar.style.display = 'none'; return; }
  paginationBar.style.display = 'flex';
  paginationInfo.innerHTML = 'Page <strong style="color:#0f172a;">' + currentPage + '</strong> of <strong style="color:#0f172a;">' + totalPages + '</strong>';
  var b = '<button class="pgb" onclick="goToPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + ' title="Previous Page"><i class="fas fa-chevron-left"></i></button>';
  getPageNums(currentPage, totalPages).forEach(function (p) {
    if (p === '...') b += '<span class="pgb" style="cursor:default;border:none;background:none;font-weight:900;color:#0f172a;">&hellip;</span>';
    else b += '<button class="pgb ' + (p === currentPage ? 'active' : '') + '" onclick="goToPage(' + p + ')">' + p + '</button>';
  });
  b += '<button class="pgb" onclick="goToPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + ' title="Next Page"><i class="fas fa-chevron-right"></i></button>';
  paginationBtns.innerHTML = b;
}

function getPageNums(cur, tot) {
  if (tot <= 7) { var a = []; for (var i = 1; i <= tot; i++) a.push(i); return a; }
  var p = [];
  if (cur <= 4) { for (var i = 1; i <= 5; i++) p.push(i); p.push('...'); p.push(tot); }
  else if (cur >= tot - 3) { p.push(1); p.push('...'); for (var i = total - 4; i <= total; i++) p.push(i); }
  else { p.push(1); p.push('...'); for (var i = cur - 1; i <= cur + 1; i++) p.push(i); p.push('...'); p.push(tot); }
  return p;
}

function goToPage(page) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  currentPage = page;
  fetchBookings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== LOADING & ERROR STATES =====
function showLoadingState() {
  tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:60px 20px;background:#ffffff;"><div class="spin"></div>' +
    '<div style="margin-top:14px;color:#0f172a;font-weight:800;font-size:15px;">Searching bookings...</div></td></tr>';
}

function renderErrorState() {
  tableBody.innerHTML = '<tr><td colspan="9"><div class="es"><div class="ei" style="background:#fef2f2;">' +
    '<i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i></div>' +
    '<div class="et">Search Failed</div>' +
    '<div class="es2">Could not connect to server. Please check your connection and try again.</div>' +
    '</div></td></tr>';
}

// ===== EDIT BOOKING =====
function editBooking(id) {
  window.open(
    BASE_URL + '/' + user.role + '/' + user.role + '.html?page=editbooking&id=' + encodeURIComponent(id),
    '_blank'
  );
}

// ===== PDF DOWNLOAD =====
function downloadPdf(bookingId, patientName) {
  showLoader();
  fetch(BASE_URL + '/api/v1/user/ReportData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value1: bookingId })
  })
  .then(function (r) { if (!r.ok) throw new Error('Report fetch failed'); return r.json(); })
  .then(function (pd) {
    if (!pd || !pd._id) { hideLoader(); showToast('Report not found for this booking.', 'error'); return Promise.reject('no-data'); }
    return fetch(BASE_URL + '/api/v1/user/get-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value1: pd._id })
    });
  })
  .then(function (r) { if (!r || !r.ok) throw new Error('PDF generation failed'); return r.blob(); })
  .then(function (blob) {
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href  = url;
    a.download = (patientName || 'report') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('PDF downloaded successfully!', 'success');
  })
  .catch(function (err) {
    if (err !== 'no-data') { console.error(err); showToast('Error generating PDF. Please try again.', 'error'); }
  })
  .finally(function () { hideLoader(); });
}

// ===== LOADER =====
function showLoader() { var l = document.getElementById('loader1'); if (l) l.style.display = 'flex'; }
function hideLoader() { var l = document.getElementById('loader1'); if (l) l.style.display = 'none'; }

// ===== TOAST NOTIFICATIONS =====
function showToast(msg, type) {
  type = type || 'info';
  var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  var c = document.getElementById('toast-container');
  if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + escH(msg) + '</span>';
  c.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4000);
}

// ===== UTILITIES =====
function escH(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hlM(text) {
  if (!currentSearch || !text) return escH(text);
  try {
    var re = new RegExp(currentSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return escH(text).replace(re, function (m) { return '<mark class="hl">' + m + '</mark>'; });
  } catch (e) { return escH(text); }
}

function fmtDisplay(ds) {
  if (!ds) return '&mdash;';
  try { return new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (e) { return ds; }
}

function fmtDateInput(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ===== AUTO LOAD ON PAGE OPEN / AJAX INSERTION =====
function initSearchPage() {
  triggerSearch(1);
  if (searchInput) {
    try { searchInput.focus(); } catch (e) {}
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initSearchPage, 50);
} else {
  window.addEventListener('load', initSearchPage);
}

// ===== EXPOSE onClick HANDLERS TO GLOBAL SCOPE =====
// Required because HTML onclick="" attributes need global functions
window.downloadPdf  = downloadPdf;
window.editBooking  = editBooking;
window.goToPage     = goToPage;

})(); // end IIFE
