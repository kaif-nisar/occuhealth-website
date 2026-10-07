// Search_booking.js - Advanced Search Page with Pagination, Filters & More
// Wrapped in IIFE to avoid global scope conflicts with parent page variables
(function () {
'use strict';

var BASE_URL = window.BASE_URL || window.location.origin;
var LETTERHEAD_STORAGE_KEY = 'allReportsLetterheadPreference';

var currentPage = 1, totalPages = 1, totalResults = 0;
var currentSearch = '', currentField = '', currentStatus = '';
var currentFromDate = '', currentToDate = '', currentLimit = 10;
var sortOrder = 'desc', isLoading = false;
var isDownloading = false, cancelDownload = false;

var searchInput         = document.getElementById('search-input');
var searchFieldSel      = document.getElementById('search-field');
var searchBtn           = document.getElementById('search-button');
var clearBtnEl          = document.getElementById('clear-btn');
var fromDateInput       = document.getElementById('from-date');
var toDateInput         = document.getElementById('to-date');
var statusFilterEl      = document.getElementById('status-filter');
var pageSizeSel         = document.getElementById('page-size');
var tableBody           = document.getElementById('table-body');
var resultsBar          = document.getElementById('results-bar');
var resultsInfo         = document.getElementById('results-info');
var paginationBar       = document.getElementById('pagination-bar');
var paginationInfo      = document.getElementById('pagination-info');
var paginationBtns      = document.getElementById('pagination-btns');
var statsRow            = document.getElementById('stats-row');
var sortToggleBtn       = document.getElementById('sort-toggle');
var sortLabelEl         = document.getElementById('sort-label');
var sortIconEl          = document.getElementById('sort-icon');
var resetFiltersBtn     = document.getElementById('reset-filters');
var selectAllCheckbox   = document.getElementById('selectAllCheckbox');
var downloadSelectedBtn = document.getElementById('download-selected-reports');
var mergeSelectedBtn    = document.getElementById('merge-selected-reports');
var letterheadSeg       = document.getElementById('letterhead-seg');
var selectedCountEl     = document.getElementById('selected-count');
var selectionSummary    = document.getElementById('selection-summary');

// ===== LETTERHEAD PREFERENCE (persisted across sessions and pages) =====
function getLetterheadPreference() {
  try {
    var saved = localStorage.getItem(LETTERHEAD_STORAGE_KEY);
    if (saved === 'with' || saved === 'without') return saved;
  } catch (e) {}
  return 'without';
}

function setLetterheadPreference(value) {
  var safeValue = value === 'with' ? 'with' : 'without';
  try {
    localStorage.setItem(LETTERHEAD_STORAGE_KEY, safeValue);
  } catch (e) {}
  syncLetterheadUI(safeValue);
}

function syncLetterheadUI(value) {
  var safeValue = value === 'with' ? 'with' : 'without';
  if (letterheadSeg) {
    letterheadSeg.querySelectorAll('.seg-option').forEach(function (btn) {
      var active = btn.getAttribute('data-value') === safeValue;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
}

function initLetterhead() {
  if (!letterheadSeg) return;
  letterheadSeg.querySelectorAll('.seg-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var val = this.getAttribute('data-value');
      setLetterheadPreference(val);
    });
  });
  syncLetterheadUI(getLetterheadPreference());
}

// ===== PATIENT NAME & FILE HELPERS =====
function isValidPatientName(name) {
  if (!name || typeof name !== 'string') return false;
  var trimmed = name.trim();
  if (!trimmed || trimmed === '-' || trimmed.toUpperCase() === 'N/A' || trimmed.toUpperCase() === 'UNDEFINED' || trimmed.toUpperCase() === 'NULL') {
    return false;
  }
  if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/.test(trimmed) || /^\d{1,2}:\d{2}/.test(trimmed)) {
    return false;
  }
  return true;
}

function getReportFilename(patientName, bookingId) {
  var cleanName = String(patientName || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!isValidPatientName(cleanName)) {
    cleanName = bookingId ? ('Report_' + bookingId) : 'Report';
  }
  return cleanName + '.pdf';
}

// ===== MULTIPLE SELECTION MANAGEMENT =====
function updateSelectedState() {
  if (!tableBody) return;
  var allCheckboxes = tableBody.querySelectorAll('.report-checkbox');
  var checkedCheckboxes = tableBody.querySelectorAll('.report-checkbox:checked');
  var total = allCheckboxes.length;
  var count = checkedCheckboxes.length;

  if (selectAllCheckbox) {
    if (total === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (count === total) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  if (selectedCountEl) selectedCountEl.textContent = count;
  if (selectionSummary) {
    selectionSummary.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (downloadSelectedBtn) {
    downloadSelectedBtn.disabled = count === 0;
    var label = downloadSelectedBtn.querySelector('.btn-label');
    if (label && !isDownloading) {
      label.textContent = count > 0 ? ('Download Selected (' + count + ')') : 'Download Selected';
    }
  }
  if (mergeSelectedBtn) {
    mergeSelectedBtn.style.display = count >= 2 ? 'inline-flex' : 'none';
  }
}

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', function () {
    var checked = this.checked;
    var checkboxes = tableBody.querySelectorAll('.report-checkbox');
    checkboxes.forEach(function (cb) {
      cb.checked = checked;
      var tr = cb.closest('tr');
      if (tr) tr.classList.toggle('row-selected', checked);
    });
    updateSelectedState();
  });
}

if (tableBody) {
  tableBody.addEventListener('change', function (e) {
    if (e.target && e.target.classList.contains('report-checkbox')) {
      var tr = e.target.closest('tr');
      if (tr) tr.classList.toggle('row-selected', e.target.checked);
      updateSelectedState();
    }
  });
}

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

// Download-eligible statuses (only completed or partially completed bookings have report documents)
var DOWNLOAD_ELIGIBLE_STATUSES = ['completed', 'partially completed', 'partial completed', 'partial'];

function isDownloadEligible(status) {
  var s = (status || '').toLowerCase().trim();
  return DOWNLOAD_ELIGIBLE_STATUSES.indexOf(s) >= 0;
}

// ===== RENDER TABLE =====
function renderTable(bookings) {
  if (!bookings || bookings.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:50px 20px;background:#ffffff;"><div class="es"><div class="ei"><i class="fas fa-inbox"></i></div>' +
      '<div class="et" style="color:#0f172a;font-weight:800;font-size:18px;">No Bookings Found</div><div class="es2" style="color:#334155;font-weight:600;font-size:14px;margin-top:6px;">' +
      (currentSearch
        ? 'No results for &ldquo;<strong style="color:#0f172a;">' + escH(currentSearch) + '</strong>&rdquo;. Try different keywords or adjust filters.'
        : 'No bookings match the selected filters.') +
      '</div></div></td></tr>';
    updateSelectedState();
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
    var bStatus = (booking.status || '').trim();
    var eligible = isDownloadEligible(bStatus);

    var bookingIdBtn = eligible
      ? '<button class="bil" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',null,\'' + escH(bStatus) + '\')" title="Download PDF report">' +
          '<i class="fas fa-file-pdf" style="font-size:13px;color:#2563eb;"></i> ' + hlM(booking.bookingId || '') +
        '</button>'
      : '<button class="bil is-not-ready" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',null,\'' + escH(bStatus) + '\')" title="Report not ready: booking status is ' + escH(bStatus || 'Pending') + '" style="opacity:0.65;background:#f1f5f9;border-color:#cbd5e1;color:#64748b;">' +
          '<i class="fas fa-lock" style="font-size:11px;color:#94a3b8;"></i> ' + hlM(booking.bookingId || '') +
        '</button>';

    var actionPdfBtn = eligible
      ? '<div class="pdf-dropdown-wrap">' +
          '<button class="rbtn rbp" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',null,\'' + escH(bStatus) + '\')" title="Download PDF"><i class="fas fa-file-pdf"></i> PDF</button>' +
          '<button class="rbtn rbp rbp-drop" onclick="togglePdfDropdown(event,\'' + bid + '\')" title="Format options"><i class="fas fa-caret-down"></i></button>' +
          '<div class="pdf-dropdown-menu" id="pdf-menu-' + bid + '">' +
            '<button type="button" class="pdf-dropdown-item" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',\'without\',\'' + escH(bStatus) + '\')"><i class="fas fa-file" style="color:#2563eb;"></i> Without Letterhead</button>' +
            '<button type="button" class="pdf-dropdown-item" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',\'with\',\'' + escH(bStatus) + '\')"><i class="fas fa-file-signature" style="color:#9333ea;"></i> With Letterhead</button>' +
          '</div>' +
        '</div>'
      : '<button class="rbtn rbp" onclick="downloadPdf(\'' + bid + '\',\'' + pn + '\',null,\'' + escH(bStatus) + '\')" title="Report not ready: booking status is ' + escH(bStatus || 'Pending') + '" style="opacity:0.6;cursor:pointer;"><i class="fas fa-lock"></i> PDF</button>';

    rows += '<tr>' +
      '<td style="text-align:center;">' +
        '<input type="checkbox" class="report-checkbox" data-booking-id="' + bid + '" data-patient-name="' + pn + '" data-status="' + escH(bStatus) + '" aria-label="Select booking ' + bid + '" ' + (eligible ? '' : 'disabled title="Only completed reports can be selected"') + '>' +
      '</td>' +
      '<td style="font-weight:800;color:#0f172a;font-size:13px;text-align:center;">' + (offset + idx + 1) + '</td>' +
      '<td>' + bookingIdBtn + '</td>' +
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
      '<td style="text-align:center;white-space:nowrap;">' + printAuditBadge(booking) + '</td>' +
      '<td style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;">' + dt + '</td>' +
      '<td><div class="rax">' +
        '<button class="rbtn rbe" onclick="editBooking(\'' + bid + '\')" title="Edit Booking"><i class="fas fa-edit"></i> Edit</button>' +
        actionPdfBtn +
      '</div></td>' +
      '</tr>';
  });
  tableBody.innerHTML = rows;
  updateSelectedState();
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
  else if (cur >= tot - 3) { p.push(1); p.push('...'); for (var i = tot - 4; i <= tot; i++) p.push(i); }
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
  tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:60px 20px;background:#ffffff;"><div class="spin"></div>' +
    '<div style="margin-top:14px;color:#0f172a;font-weight:800;font-size:15px;">Searching bookings...</div></td></tr>';
}

function renderErrorState() {
  tableBody.innerHTML = '<tr><td colspan="11"><div class="es"><div class="ei" style="background:#fef2f2;">' +
    '<i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i></div>' +
    '<div class="et">Search Failed</div>' +
    '<div class="es2">Could not connect to server. Please check your connection and try again.</div>' +
    '</div></td></tr>';
}

// ===== EDIT BOOKING =====
function editBooking(id) {
  var role = (window.user && window.user.role) || window.currentRole || 'admin';
  window.open(
    BASE_URL + '/' + role + '/' + role + '.html?page=editbooking&id=' + encodeURIComponent(id),
    '_blank'
  );
}

// ===== PDF DROPDOWN MENU FOR INDIVIDUAL ROWS =====
function togglePdfDropdown(event, bookingId) {
  if (event) event.stopPropagation();
  var targetMenu = document.getElementById('pdf-menu-' + bookingId);
  var wasOpen = targetMenu && targetMenu.classList.contains('show');
  document.querySelectorAll('.pdf-dropdown-menu.show').forEach(function (m) {
    m.classList.remove('show');
  });
  if (targetMenu && !wasOpen) {
    targetMenu.classList.add('show');
  }
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.pdf-dropdown-wrap')) {
    document.querySelectorAll('.pdf-dropdown-menu.show').forEach(function (m) {
      m.classList.remove('show');
    });
  }
});

// ===== PDF DOWNLOAD (SINGLE BOOKING) =====
function downloadPdf(bookingId, patientName, formatOverride, bookingStatus) {
  if (bookingStatus && !isDownloadEligible(bookingStatus)) {
    showToast('Report not ready: Current status is "' + bookingStatus + '". Reports are only available once tests are Completed or Partially Completed.', 'warning');
    return;
  }

  var format = formatOverride || getLetterheadPreference();
  var isWith = (format === 'with');
  var formatLabel = isWith ? 'With Letterhead' : 'Without Letterhead';

  showLoader();
  showToast('Preparing PDF (' + formatLabel + ')...', 'info');

  fetch(BASE_URL + '/api/v1/user/ReportData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value1: bookingId, bookingId: bookingId })
  })
  .then(function (r) {
    if (!r.ok) {
      return r.json().then(function (errData) {
        var msg = (errData && errData.message) || 'Report not found for this booking.';
        throw new Error(msg);
      }).catch(function (e) {
        throw new Error(e.message || 'Report not found for this booking.');
      });
    }
    return r.json();
  })
  .then(function (pd) {
    if (!pd || !pd._id) {
      hideLoader();
      showToast('Report not found for this booking. Please ensure test report is saved.', 'error');
      return Promise.reject('no-data');
    }
    return fetch(BASE_URL + '/api/v1/user/get-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value1: pd._id,
        bookingId: bookingId,
        checkBox: isWith ? false : true,
        auditAction: 'DOWNLOAD'
      })
    });
  })
  .then(function (r) { if (!r || !r.ok) throw new Error('PDF generation failed'); return r.blob(); })
  .then(function (blob) {
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href  = url;
    a.download = getReportFilename(patientName, bookingId);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    showToast('PDF downloaded successfully! (' + formatLabel + ')', 'success');
    try {
      if (window.ReportPrintAudit && typeof window.ReportPrintAudit.updateBadges === 'function') {
        window.ReportPrintAudit.updateBadges(bookingId, { isPrinted: true });
      }
    } catch (e) { /* ignore */ }
  })
  .catch(function (err) {
    if (err !== 'no-data') {
      console.warn('PDF download info:', err);
      var msg = (err && err.message) || 'Report not found for this booking. Please ensure tests have been saved.';
      showToast(msg, 'warning');
    }
  })
  .finally(function () { hideLoader(); });
}

// ===== BULK DOWNLOAD (MULTIPLE SELECTED REPORTS) =====
function setDownloadBtnState(iconClass, labelText) {
  if (!downloadSelectedBtn) return;
  var icon = downloadSelectedBtn.querySelector('i');
  if (icon) icon.className = iconClass;
  var label = downloadSelectedBtn.querySelector('.btn-label');
  if (label) label.textContent = labelText;
}

async function downloadSelectedReports() {
  if (!downloadSelectedBtn) return;

  if (isDownloading) {
    cancelDownload = true;
    setDownloadBtnState('fas fa-spinner fa-spin', 'Stopping...');
    return;
  }

  var checkboxes = tableBody.querySelectorAll('.report-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('Please select at least one booking to download.', 'warning');
    return;
  }

  var items = Array.from(checkboxes).map(function (cb) {
    return {
      bookingId: cb.getAttribute('data-booking-id') || '',
      patientName: cb.getAttribute('data-patient-name') || '',
      status: cb.getAttribute('data-status') || ''
    };
  }).filter(function (it) { return it.bookingId && isDownloadEligible(it.status); });

  if (items.length === 0) {
    showToast('No eligible completed reports selected.', 'warning');
    return;
  }

  isDownloading = true;
  cancelDownload = false;
  downloadSelectedBtn.classList.add('is-downloading');
  setDownloadBtnState('fas fa-stop', 'Stop Download');

  var format = getLetterheadPreference();
  var formatLabel = format === 'with' ? 'With Letterhead' : 'Without Letterhead';
  showToast('Downloading ' + items.length + ' report' + (items.length === 1 ? '' : 's') + ' (' + formatLabel + ')...', 'info');

  try {
    for (var i = 0; i < items.length; i++) {
      if (cancelDownload) {
        showToast('Download stopped by user.', 'info');
        break;
      }

      setDownloadBtnState('fas fa-spinner fa-spin', 'Downloading (' + (i + 1) + '/' + items.length + ')... Stop');

      await downloadSingleReportAsync(items[i].bookingId, items[i].patientName, format);

      if (i < items.length - 1) {
        await new Promise(function (resolve) { setTimeout(resolve, 350); });
      }
    }

    if (!cancelDownload) {
      showToast('All ' + items.length + ' reports downloaded successfully! (' + formatLabel + ')', 'success');
    }
  } catch (err) {
    console.error('Bulk download error:', err);
    showToast('Some reports failed to download.', 'error');
  } finally {
    isDownloading = false;
    cancelDownload = false;
    downloadSelectedBtn.classList.remove('is-downloading');
    setDownloadBtnState('fas fa-download', 'Download Selected (' + items.length + ')');
    updateSelectedState();
  }
}

async function downloadSingleReportAsync(bookingId, patientName, format) {
  try {
    var isWith = (format === 'with');
    var r = await fetch(BASE_URL + '/api/v1/user/ReportData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value1: bookingId, bookingId: bookingId })
    });
    if (!r.ok) return false;
    var pd = await r.json();
    if (!pd || !pd._id) return false;

    var pdfRes = await fetch(BASE_URL + '/api/v1/user/get-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value1: pd._id,
        bookingId: bookingId,
        checkBox: isWith ? false : true,
        auditAction: 'DOWNLOAD'
      })
    });
    if (!pdfRes.ok) throw new Error('PDF generation failed');

    var blob = await pdfRes.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = getReportFilename(patientName, bookingId);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);

    try {
      if (window.ReportPrintAudit && typeof window.ReportPrintAudit.updateBadges === 'function') {
        window.ReportPrintAudit.updateBadges(bookingId, { isPrinted: true });
      }
    } catch (e) { /* ignore */ }

    return true;
  } catch (err) {
    console.error('Error downloading booking ' + bookingId + ':', err);
    return false;
  }
}

// ===== MERGE REPORTS (2+ SELECTED BOOKINGS) =====
async function mergeSelectedReports() {
  var checkboxes = tableBody.querySelectorAll('.report-checkbox:checked');
  if (checkboxes.length < 2) {
    showToast('Please select at least 2 bookings to merge.', 'warning');
    return;
  }

  var items = Array.from(checkboxes).map(function (cb) {
    return {
      bookingId: cb.getAttribute('data-booking-id') || '',
      patientName: cb.getAttribute('data-patient-name') || ''
    };
  }).filter(function (it) { return it.bookingId; });

  showLoader();
  var format = getLetterheadPreference();
  var formatLabel = format === 'with' ? 'With Letterhead' : 'Without Letterhead';
  showToast('Merging ' + items.length + ' reports (' + formatLabel + ')... Please wait.', 'info');

  try {
    var reportIds = [];
    for (var i = 0; i < items.length; i++) {
      var res = await fetch(BASE_URL + '/api/v1/user/ReportData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value1: items[i].bookingId, bookingId: items[i].bookingId })
      });
      if (res.ok) {
        var pd = await res.json();
        if (pd && pd._id) reportIds.push(pd._id);
      }
    }

    if (reportIds.length < 2) {
      hideLoader();
      showToast('Could not find enough valid report data to merge.', 'error');
      return;
    }

    var isWith = (format === 'with');
    var mergeRes = await fetch(BASE_URL + '/api/v1/user/merge-pdfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportIds: reportIds,
        checkBox: isWith ? false : true
      })
    });

    if (!mergeRes.ok) throw new Error('PDF merge failed');

    var blob = await mergeRes.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Merged_Reports_' + new Date().toISOString().slice(0, 10) + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);

    showToast('Merged PDF downloaded successfully!', 'success');
  } catch (err) {
    console.error('Merge error:', err);
    showToast('Failed to merge reports. Please try again.', 'error');
  } finally {
    hideLoader();
  }
}

// Action button event listeners
if (downloadSelectedBtn) {
  downloadSelectedBtn.addEventListener('click', downloadSelectedReports);
}
if (mergeSelectedBtn) {
  mergeSelectedBtn.addEventListener('click', mergeSelectedReports);
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

// ===== REPORT PRINT / DOWNLOAD AUDIT BADGE =====
function printAuditBadge(booking) {
  try {
    if (window.ReportPrintAudit && typeof window.ReportPrintAudit.badge === 'function') {
      return window.ReportPrintAudit.badge(booking);
    }
  } catch (e) {
    console.warn('Print audit badge unavailable:', e);
  }
  return '<span style="color:#64748b;font-weight:600;font-size:12px;">&mdash;</span>';
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
  initLetterhead();
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

// ===== EXPOSE HANDLERS TO GLOBAL SCOPE =====
window.downloadPdf            = downloadPdf;
window.editBooking            = editBooking;
window.goToPage               = goToPage;
window.togglePdfDropdown      = togglePdfDropdown;
window.downloadSelectedReports = downloadSelectedReports;
window.mergeSelectedReports   = mergeSelectedReports;

})(); // end IIFE
