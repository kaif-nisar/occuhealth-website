(function hort() {
    'use strict';

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isValidPatientName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        if (!trimmed || trimmed === '-' || trimmed.toUpperCase() === 'N/A' || trimmed.toUpperCase() === 'UNDEFINED' || trimmed.toUpperCase() === 'NULL') {
            return false;
        }
        // Reject accidental dates / timestamps (e.g. 01/10/2026, 2026-10-01, 15:30)
        if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/.test(trimmed) || /^\d{1,2}:\d{2}/.test(trimmed)) {
            return false;
        }
        return true;
    }

    function getBookingPatientName(bookingId, row) {
        if (bookingId && Array.isArray(bookings)) {
            const booking = bookings.find(item => String(item.bookingId) === String(bookingId));
            if (isValidPatientName(booking?.patientName)) {
                return String(booking.patientName).trim();
            }
        }

        if (row) {
            const attrName = row.getAttribute('data-patient-name');
            if (isValidPatientName(attrName)) return attrName.trim();

            const badge = row.querySelector('.booking-id-badge');
            const badgeAttrName = badge?.getAttribute('data-patient-name');
            if (isValidPatientName(badgeAttrName)) return badgeAttrName.trim();

            const patientCell = row.querySelector('.td-patient-name') || row.querySelector('td:nth-child(4)');
            const cellText = patientCell?.textContent?.trim();
            if (isValidPatientName(cellText)) return cellText;
        }

        return '';
    }

    function resolvePatientName({ reportData, bookingListPatientName, bookingId, row } = {}) {
        // 1. Authoritative: from report details returned by API
        const fromReport = reportData?.patientName || reportData?.PatientName || reportData?.name;
        if (isValidPatientName(fromReport)) {
            return String(fromReport).trim();
        }

        // 2. From booking list / row
        if (isValidPatientName(bookingListPatientName)) {
            return String(bookingListPatientName).trim();
        }

        // 3. From cached bookings array or DOM
        return getBookingPatientName(bookingId, row);
    }

    // Keep downloaded filenames portable across browsers and operating systems.
    function getReportFilename(patientName, bookingId) {
        let cleanName = String(patientName || '')
            .normalize('NFKC')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '');

        if (!isValidPatientName(cleanName)) {
            cleanName = bookingId ? `Report_${bookingId}` : 'Report';
        }
        return `${cleanName}.pdf`;
    }
    // ============================================================
    // STATE
    // ============================================================
    let bookings = [];
    let allRows = [];
    let isDownloading = false;
    let cancelDownload = false;
    let activeRequestController = null; // tracks in-flight booking fetch (allows retry/cancel)
    const LETTERHEAD_STORAGE_KEY = 'allReportsLetterheadPreference';

    // Pagination state
    let currentPage = 1;
    let pageSize = 20;
    let totalBookings = 0;
    let totalPages = 1;
    let lastFetchParams = { startDate: '', endDate: '', franchiseeId: '' };
    // Preserve the instant at which today's end date was selected.
    let endDateSelectedAt = null;

    // Download-eligible statuses (only these can be downloaded)
    const DOWNLOAD_ELIGIBLE_STATUSES = ['completed', 'partially completed', 'partial completed', 'partial'];

    // ============================================================
    // HELPERS: Safe globals (SPA parent sets these on window)
    // ============================================================
    const BASE_URL = window.BASE_URL || window.location.origin;
    function getCurrentUserId() {
        return (typeof userId !== 'undefined' ? userId : null) || window.userId || '';
    }

    // ============================================================
    // DOM REFS
    // ============================================================
    const tableBody = document.querySelector('#tab');
    const tableContainer = document.querySelector('.table-container');
    const loader = document.querySelector('#loader1');
    const resultsCount = document.querySelector('#results-count');
    const downloadBtn = document.querySelector('#download-selected-reports');
    const downloadBtnLabel = downloadBtn ? downloadBtn.querySelector('.btn-label') : null;
    const mergeBtn = document.querySelector('#merge-selected-reports');
    const searchInput = document.querySelector('#search-input');
    const searchButton = document.querySelector('#search-button');
    const startDateInput = document.querySelector('#start-date');
    const endDateInput = document.querySelector('#end-date');
    const franchiseeSelect = document.querySelector('#franchisee-select');
    const quickDateRange = document.querySelector('#quick-date-range');
    const selectAllCheckbox = document.querySelector('#selectAllCheckbox');
    const letterheadSeg = document.querySelector('#letterhead-seg');
    const legacyLetterheadSelect = document.querySelector('#myselect');
    const paginationContainer = document.querySelector('#pagination-container');
    const paginationInfo = document.querySelector('#pagination-info');
    const paginationControls = document.querySelector('#pagination-controls');
    const pageSizeSelect = document.querySelector('#page-size-select');

    // ============================================================
    // SELECTIVE DOWNLOAD MODAL DOM REFS & STATE
    // ============================================================
    const selectiveModal = document.querySelector('#selectiveDownloadModal');
    const closeSelectiveModalBtn = document.querySelector('#closeSelectiveModalBtn');
    const cancelSelectiveModalBtn = document.querySelector('#cancelSelectiveModalBtn');
    const modalFullDownloadBtn = document.querySelector('#modalFullDownloadBtn');
    const modalSelectAllBtn = document.querySelector('#modalSelectAllBtn');
    const modalDeselectAllBtn = document.querySelector('#modalDeselectAllBtn');
    const modalSelectionCounter = document.querySelector('#modalSelectionCounter');
    const modalLetterheadSelect = document.querySelector('#modalLetterheadSelect');
    const selectiveItemsList = document.querySelector('#selectiveItemsList');
    const downloadSelectiveBtn = document.querySelector('#downloadSelectiveBtn');
    const downloadSelectiveBtnLabel = document.querySelector('#downloadSelectiveBtnLabel');
    const modalBookingId = document.querySelector('#modalBookingId');
    const modalPatientName = document.querySelector('#modalPatientName');

    let currentModalBooking = null;

    // ============================================================
    // TOAST SYSTEM
    // ============================================================
    const toastContainer = document.querySelector('#toast-container');

    function showToast(type, title, message, duration = 4000) {
        if (!toastContainer) return;

        const icons = {
            info: 'fas fa-circle-info',
            success: 'fas fa-circle-check',
            error: 'fas fa-circle-exclamation'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <i class="toast-icon ${icons[type] || icons.info}"></i>
            <div class="min-w-0">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
            <span class="toast-progress" style="--toast-duration:${duration}ms"></span>
        `;

        // Progress bar paused while hovered is complex; keep it simple and remove on hover via JS below.
        toast.querySelector('.toast-close').addEventListener('click', () => {
            closeToast(toast);
        });

        // Pause auto-dismiss on hover
        let timer = setTimeout(() => closeToast(toast), duration);
        toast.addEventListener('mouseenter', () => clearTimeout(timer));
        toast.addEventListener('mouseleave', () => {
            timer = setTimeout(() => closeToast(toast), duration);
        });

        toastContainer.appendChild(toast);
        // Force reflow so the transition plays
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

        return toast;
    }

    function closeToast(toast) {
        if (!toast) return;
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }

    // ============================================================
    // LETTERHEAD PREFERENCE (persisted)
    // ============================================================
    function getLetterheadPreference() {
        try {
            const saved = localStorage.getItem(LETTERHEAD_STORAGE_KEY);
            if (saved === 'with' || saved === 'without') return saved;
        } catch (e) { /* storage unavailable */ }
        return 'without';
    }

    function setLetterheadPreference(value) {
        const safeValue = value === 'with' ? 'with' : 'without';
        try {
            localStorage.setItem(LETTERHEAD_STORAGE_KEY, safeValue);
        } catch (e) { /* storage unavailable */ }
        syncLetterheadUI(safeValue);
    }

    function syncLetterheadUI(value) {
        const safeValue = value === 'with' ? 'with' : 'without';
        if (letterheadSeg) {
            letterheadSeg.querySelectorAll('.seg-option').forEach(btn => {
                const active = btn.getAttribute('data-value') === safeValue;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }
        if (legacyLetterheadSelect) {
            legacyLetterheadSelect.value = safeValue;
        }
    }

    // ============================================================
    // DOWNLOAD ELIGIBILITY
    // ============================================================
    function isDownloadEligible(status) {
        const s = (status || '').toLowerCase().trim();
        return DOWNLOAD_ELIGIBLE_STATUSES.includes(s);
    }

    // ============================================================
    // REPORT PRINT / DOWNLOAD AUDIT BADGE
    // ============================================================
    // Compact audit badge rendered from `booking.printAudit` (shared UI
    // component loaded by the portal shell). Safe for legacy bookings that
    // have no audit object yet and when the component is unavailable.
    function printAuditBadge(booking) {
        try {
            if (window.ReportPrintAudit && typeof window.ReportPrintAudit.badge === 'function') {
                return window.ReportPrintAudit.badge(booking);
            }
        } catch (error) {
            console.warn('Print audit badge unavailable:', error);
        }
        return '<span class="text-gray-400" style="font-size:12px;">&mdash;</span>';
    }

    // ============================================================
    // STATUS COLOR MAPPING (soft pastel SaaS tokens)
    // ============================================================
    function getStatusColor(status) {
        const s = (status || '').toLowerCase().trim();
        const colorMap = {
            'completed':           { bg: '#dcfce7', text: '#166534', border: 'rgba(22,101,52,0.15)', label: 'Completed' },
            'partially completed': { bg: '#fef3c7', text: '#92400e', border: 'rgba(146,64,14,0.15)', label: 'Partially Completed' },
            'partial completed':   { bg: '#fef3c7', text: '#92400e', border: 'rgba(146,64,14,0.15)', label: 'Partially Completed' },
            'partial':             { bg: '#fef3c7', text: '#92400e', border: 'rgba(146,64,14,0.15)', label: 'Partially Completed' },
            'pending':             { bg: '#e0e7ff', text: '#3730a3', border: 'rgba(55,48,163,0.15)', label: 'Pending' },
            'hold':                { bg: '#fce7f3', text: '#9d174d', border: 'rgba(157,23,77,0.15)', label: 'On Hold' },
            'on hold':             { bg: '#fce7f3', text: '#9d174d', border: 'rgba(157,23,77,0.15)', label: 'On Hold' },
            'clinical':            { bg: '#dbeafe', text: '#1e40af', border: 'rgba(30,64,175,0.15)', label: 'Clinical' },
            'clinical stated':     { bg: '#dbeafe', text: '#1e40af', border: 'rgba(30,64,175,0.15)', label: 'Clinical' },
            'cancelled':           { bg: '#fee2e2', text: '#991b1b', border: 'rgba(153,27,27,0.15)', label: 'Cancelled' },
            'canceled':            { bg: '#fee2e2', text: '#991b1b', border: 'rgba(153,27,27,0.15)', label: 'Cancelled' },
        };
        return colorMap[s] || { bg: '#f3f4f6', text: '#374151', border: 'rgba(55,65,81,0.15)', label: status || 'N/A' };
    }

    // ============================================================
    // TABLE STATE RENDERING (skeleton / empty / error / no-results)
    // ============================================================
    function renderSkeletonRows(count = 6) {
        tableBody.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            tr.setAttribute('aria-hidden', 'true');
            tr.innerHTML = `
                <td class="skeleton-cell"><span class="skeleton skeleton-checkbox"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-badge"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-short"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-medium"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-short"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-short"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-long"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-badge"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-badge"></span></td>
            `;
            fragment.appendChild(tr);
        }
        tableBody.appendChild(fragment);
        allRows = [];
        if (resultsCount) resultsCount.textContent = 'Loading reports…';
    }

    function renderEmptyState() {
        if (paginationContainer) paginationContainer.style.display = 'none';
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="state-container">
                        <div class="state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
                                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                            </svg>
                        </div>
                        <div class="state-title">No Reports Available</div>
                        <p class="state-description">There are no reports matching your current filters. Try adjusting the date range or clearing the search query.</p>
                    </div>
                </td>
            </tr>
        `;
        allRows = [];
        if (resultsCount) resultsCount.textContent = 'No reports found';
    }

    function renderErrorState(message = 'Failed to load reports. Please check your connection and try again.') {
        if (paginationContainer) paginationContainer.style.display = 'none';
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="state-container">
                        <div class="state-icon state-icon-error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <div class="state-title">Something Went Wrong</div>
                        <p class="state-description">${message}</p>
                        <button type="button" class="retry-button" id="retry-button">
                            <i class="fas fa-rotate-right"></i> Retry
                        </button>
                    </div>
                </td>
            </tr>
        `;
        allRows = [];
        if (resultsCount) resultsCount.textContent = 'Load failed';

        const retryBtn = document.querySelector('#retry-button');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                const startDate = startDateInput ? startDateInput.value : '';
                const endDate = endDateInput ? endDateInput.value : '';
                const selectedOption = franchiseeSelect ? franchiseeSelect.options[franchiseeSelect.selectedIndex] : null;
                const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;
                fetchBookings(startDate, endDate, franchiseeId);
            });
        }
    }

    function renderNoResultsRow(searchTerm) {
        const existing = document.getElementById('no-results-row');
        if (existing) existing.remove();
        const tr = document.createElement('tr');
        tr.id = 'no-results-row';
        tr.innerHTML = `
            <td colspan="9">
                <div class="no-results-cell">
                    <i class="fas fa-search text-2xl opacity-40 mb-3 block"></i>
                    <div class="font-semibold text-gray-600">No results found</div>
                    <div class="text-sm text-gray-400 mt-1">Nothing matches "${searchTerm}". Try a different keyword.</div>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    }

    // ============================================================
    // RESULTS COUNT
    // ============================================================
    function updateResultsCount() {
        if (!resultsCount) return;
        const searchTerm = (searchInput ? searchInput.value : '').trim();
        let visibleCount = 0;
        if (searchTerm) {
            allRows.forEach(row => {
                if (row.style.display !== 'none') visibleCount++;
            });
        } else {
            visibleCount = allRows.length;
        }
        if (visibleCount > 0) {
            if (totalBookings > 0 && !searchTerm) {
                resultsCount.innerHTML = `Showing <strong>${visibleCount}</strong> of <strong>${totalBookings}</strong> report${totalBookings === 1 ? '' : 's'}`;
            } else {
                resultsCount.innerHTML = `Showing <strong>${visibleCount}</strong> report${visibleCount === 1 ? '' : 's'}`;
            }
        } else if (!searchTerm && allRows.length === 0) {
            resultsCount.textContent = '';
        }
    }

    // ============================================================
    // PAGINATION RENDERING
    // ============================================================
    function renderPagination() {
        if (!paginationContainer || !paginationInfo || !paginationControls) return;

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';

        // Info text
        const start = totalBookings === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, totalBookings);
        paginationInfo.innerHTML = `Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong> · Showing <strong>${start}–${end}</strong> of <strong>${totalBookings}</strong>`;

        // Build page buttons
        const controls = document.createDocumentFragment();

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.setAttribute('aria-label', 'Previous page');
        prevBtn.disabled = currentPage <= 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchBookings(lastFetchParams.startDate, lastFetchParams.endDate, lastFetchParams.franchiseeId);
            }
        });
        controls.appendChild(prevBtn);

        // Page numbers with ellipsis
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2) pages.push('...');
        }

        for (let p = startPage; p <= endPage; p++) {
            pages.push(p);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pages.push('...');
            pages.push(totalPages);
        }

        pages.forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '…';
                controls.appendChild(ellipsis);
                return;
            }

            const btn = document.createElement('button');
            btn.className = `pagination-btn${page === currentPage ? ' active' : ''}`;
            btn.textContent = page;
            btn.setAttribute('aria-label', `Go to page ${page}`);
            if (page === currentPage) btn.setAttribute('aria-current', 'page');
            btn.addEventListener('click', () => {
                if (page !== currentPage) {
                    currentPage = page;
                    fetchBookings(lastFetchParams.startDate, lastFetchParams.endDate, lastFetchParams.franchiseeId);
                }
            });
            controls.appendChild(btn);
        });

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.setAttribute('aria-label', 'Next page');
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchBookings(lastFetchParams.startDate, lastFetchParams.endDate, lastFetchParams.franchiseeId);
            }
        });
        controls.appendChild(nextBtn);

        paginationControls.innerHTML = '';
        paginationControls.appendChild(controls);
    }

    // ============================================================
    // FETCH BOOKINGS
    // ============================================================
    async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
        const currentUserId = getCurrentUserId();
        if (!franchiseeId) {
            franchiseeId = currentUserId;
        }

        // Store params for pagination re-fetch
        lastFetchParams = { startDate, endDate, franchiseeId };

        let processedEndDate = endDate;
        if (endDate) {
            const todayStr = getTodayDate();
            if (endDate === todayStr) {
                processedEndDate = (endDateSelectedAt && endDateSelectedAt.date === endDate
                    ? endDateSelectedAt.at
                    : new Date()).toISOString();
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                processedEndDate = localDateAtTime(endDate, 23, 59, 59, 999).toISOString();
            }
        }

        let processedStartDate = startDate;
        if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            processedStartDate = localDateAtTime(startDate, 0, 0, 0, 0).toISOString();
        }

        let query = `?status=completed,pending,hold,partial,clinical&startDate=${encodeURIComponent(processedStartDate)}&endDate=${encodeURIComponent(processedEndDate)}&page=${currentPage}&limit=${pageSize}`;
        if (franchiseeId) {
            query += `&franchiseeId=${encodeURIComponent(franchiseeId)}`;
        }

        // Abort any in-flight booking request
        if (activeRequestController) {
            activeRequestController.abort();
        }
        activeRequestController = new AbortController();
        const signal = activeRequestController.signal;

        // Show skeleton immediately
        renderSkeletonRows(6);
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        updateMergeButtonVisibility();

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/bookings${query}`, { signal });
            if (!response.ok) throw new Error('Failed to fetch bookings');

            const result = await response.json();

            // Handle different response structures
            if (Array.isArray(result)) {
                bookings = result;
            } else if (result.data && Array.isArray(result.data)) {
                bookings = result.data;
            } else if (result.bookings && Array.isArray(result.bookings)) {
                bookings = result.bookings;
            } else {
                bookings = [];
            }

            // Extract pagination metadata
            totalBookings = result.total || bookings.length;
            totalPages = result.totalPages || Math.ceil(totalBookings / pageSize) || 1;
            if (result.page) currentPage = parseInt(result.page, 10) || 1;

            if (bookings.length === 0) {
                renderEmptyState();
                renderPagination();
                return;
            }

            const fragment = document.createDocumentFragment();

            bookings.forEach((booking) => {
                const tests = Array.isArray(booking.tableData) && booking.tableData.length
                    ? booking.tableData.map(test => `${test.testName} (${test.typeOfSample || ''}) - ${test.barcodeId || ''}`).join('<br>')
                    : '<span class="text-gray-400 italic">No tests available</span>';

                const sampleId = Array.isArray(booking.tableData) && booking.tableData[0]?.barcodeId
                    ? booking.tableData[0].barcodeId
                    : 'N/A';

                const statusInfo = getStatusColor(booking.status);
                const eligible = isDownloadEligible(booking.status);
                const patientNameStr = String(booking.patientName || '').trim();
                const displayPatientName = patientNameStr && patientNameStr.toUpperCase() !== 'N/A' ? patientNameStr : 'N/A';
                const row = document.createElement('tr');
                row.className = 'data-row';
                row.setAttribute('data-booking-id', booking.bookingId || '');
                row.setAttribute('data-patient-name', patientNameStr);
                row.setAttribute('data-status', (booking.status || '').toLowerCase().trim());
                row.innerHTML = `
                    <td><input type="checkbox" class="report-checkbox" aria-label="Select booking ${escapeHtml(booking.bookingId || '')}" ${eligible ? '' : 'disabled'}></td>
                    <td>
                        <span class="booking-id-badge${eligible ? '' : ' is-not-ready'}" role="button" tabindex="${eligible ? '0' : '-1'}"
                              title="${eligible ? 'Click to Download Report' : 'Report not ready for download'}"
                              aria-label="${eligible ? 'Download report for booking ' + escapeHtml(booking.bookingId || '') : 'Report not ready for booking ' + escapeHtml(booking.bookingId || '')}"
                              data-booking-id="${escapeHtml(booking.bookingId || '')}"
                              data-patient-name="${escapeHtml(patientNameStr)}">
                            <i class="fas ${eligible ? 'fa-download' : 'fa-lock'} booking-id-icon" aria-hidden="true"></i>
                            ${escapeHtml(booking.bookingId || 'N/A')}
                            ${eligible ? '' : '<span class="not-ready-tooltip" title="Only Completed and Partially Completed reports can be downloaded"><i class="fas fa-circle-info"></i></span>'}
                        </span>
                    </td>
                    <td style="white-space:nowrap;">
                        <div style="font-weight:500;color:#1e293b;">${formatBookingDate(booking.date || booking.createdAt)}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px;">
                            <i class="fa-regular fa-clock" style="margin-right:3px;"></i>${formatBookingTime(booking.time, booking.createdAt)}
                        </div>
                    </td>
                    <td class="font-medium text-gray-800 td-patient-name" data-patient-name="${escapeHtml(patientNameStr)}">${escapeHtml(displayPatientName)}</td>
                    <td>${escapeHtml(sampleId)}</td>
                    <td>${escapeHtml(booking.doctorName || 'N/A')}</td>
                    <td class="td-tests">
                        ${tests}
                        ${eligible ? `
                        <div style="margin-top:6px;">
                            <button type="button" class="btn-selective-download" data-booking-id="${escapeHtml(booking.bookingId || '')}" title="Select specific tests, panels, or packages to download">
                                <i class="fas fa-list-check"></i> Select Tests
                            </button>
                        </div>` : ''}
                    </td>
                    <td>
                        <span class="status-badge${eligible ? '' : ' is-not-ready'}" style="background:${statusInfo.bg};color:${statusInfo.text};border-color:${statusInfo.border}">
                            ${statusInfo.label}
                        </span>
                    </td>
                    <td style="text-align:center;white-space:nowrap;">
                        ${printAuditBadge(booking)}
                    </td>
                `;
                fragment.appendChild(row);
            });

            tableBody.innerHTML = '';
            tableBody.appendChild(fragment);
            allRows = Array.from(tableBody.querySelectorAll('tr.data-row'));

            if (searchInput) searchInput.value = '';
            updateResultsCount();
            updateMergeButtonVisibility();
            renderPagination();

        } catch (error) {
            if (error && error.name === 'AbortError') {
                // A new request superseded this one; ignore silently
                return;
            }
            console.error('Error fetching bookings:', error);
            renderErrorState('We couldn’t load the reports list. Please check your connection and try again.');
        } finally {
            activeRequestController = null;
        }
    }

    // ============================================================
    // SUB-FRANCHISEE LOADER
    // ============================================================
    async function subfranchisee() {
        const currentUserId = getCurrentUserId();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${currentUserId}`, {
                method: 'GET'
            });

            if (!response.ok) {
                console.log('Sub-franchisees not available, skipping...');
                return;
            }

            const allsubfran = await response.json();

            let subFranchisees = [];
            if (Array.isArray(allsubfran)) {
                subFranchisees = allsubfran;
            } else if (allsubfran.message && Array.isArray(allsubfran.message)) {
                subFranchisees = allsubfran.message;
            } else if (allsubfran.data && Array.isArray(allsubfran.data)) {
                subFranchisees = allsubfran.data;
            }

            if (subFranchisees.length === 0 || !franchiseeSelect) {
                console.log('No sub-franchisees found');
                return;
            }

            subFranchisees.forEach(subfran => {
                const option = document.createElement('option');
                option.setAttribute('data-id', subfran._id);
                option.textContent = subfran.fullName || subfran.name || 'Unknown';
                franchiseeSelect.appendChild(option);
            });

        } catch (error) {
            console.log('Sub-franchisees could not be loaded, continuing...');
        }
    }

    // ============================================================
    // DATE / TIME UTILITIES
    // ============================================================
    function formatBookingDate(dateVal) {
        if (!dateVal) return 'N/A';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    }

    function formatBookingTime(timeVal, createdAtVal) {
        if (timeVal && typeof timeVal === 'string' && timeVal.trim()) {
            return timeVal.trim();
        }
        if (createdAtVal) {
            const d = new Date(createdAtVal);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        }
        return '';
    }

    function getLocalDateString(d = new Date()) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLast24HoursDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return getLocalDateString(yesterday);
    }

    function getTodayDate() {
        return getLocalDateString(new Date());
    }

    function localDateAtTime(dateString, hours, minutes, seconds, milliseconds) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
    }

    function setDefaultDates() {
        if (startDateInput) startDateInput.value = getLast24HoursDate();
        if (endDateInput) endDateInput.value = getTodayDate();
    }

    // ============================================================
    // REPORT / PDF API CALLS
    // ============================================================
    async function fetchreport(value1) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value1 })
            });
            if (!response.ok) throw new Error('Failed to fetch report data');
            return await response.json();
        } catch (error) {
            console.error('Error fetching report:', error);
            return null;
        }
    }

    async function autogeneratingpdf({ value1 = '', startDate = '', patientname, bookingId = '', hideLoader = false, labinchargesign = null,
        checkBox = false, labinchargeinfo = '', backgroundImageUrl = null, headermargin, footermargin,
        marginRight, marginLeft, labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest,
        selectedItems = null, filteredPanels = null, filteredTests = null, filteredPackages = null, customFilename = null } = {}) {

        try {
            if (!hideLoader && loader) loader.style.display = 'flex';

            const payload = {
                value1, labinchargesign, checkBox: startDate === 'with' ? false : true, labinchargeinfo,
                backgroundImageUrl, headermargin, footermargin, marginRight, marginLeft,
                labinchargesignurl, selectedFontSize, RowSpacing, HighLow, HLinred, BoldRow, showInvest,
                bookingId, auditAction: 'DOWNLOAD'
            };

            if (selectedItems && Array.isArray(selectedItems) && selectedItems.length > 0) {
                payload.selectedItems = selectedItems;
            }
            if (filteredPanels && Array.isArray(filteredPanels) && filteredPanels.length > 0) {
                payload.filteredPanels = filteredPanels;
            }
            if (filteredTests && Array.isArray(filteredTests) && filteredTests.length > 0) {
                payload.filteredTests = filteredTests;
            }
            if (filteredPackages && Array.isArray(filteredPackages) && filteredPackages.length > 0) {
                payload.filteredPackages = filteredPackages;
            }

            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                const errMsg = errData?.message || 'PDF generation failed';
                showToast('error', 'Download Restricted', errMsg);
                throw new Error(errMsg);
            }

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = customFilename || getReportFilename(patientname, bookingId);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 500);

            try {
                if (bookingId && window.ReportPrintAudit && typeof window.ReportPrintAudit.updateBadges === 'function') {
                    window.ReportPrintAudit.updateBadges(bookingId, { isPrinted: true });
                }
            } catch (e) { /* ignore */ }

            return true;
        } catch (error) {
            console.error('Error generating PDF:', error);
            return false;
        } finally {
            if (!hideLoader && loader) loader.style.display = 'none';
        }
    }

    // ============================================================
    // SINGLE BOOKING DOWNLOAD (cell-level loading state)
    // ============================================================
    async function downloadSingleReport(badgeElement) {
        if (!badgeElement || badgeElement.classList.contains('is-loading')) return;

        const row = badgeElement.closest('tr');
        const bookingId = badgeElement.getAttribute('data-booking-id') || row?.getAttribute('data-booking-id') || badgeElement.textContent.trim();
        const patientNameFromList = getBookingPatientName(bookingId, row);

        // Defense-in-depth: verify status is download-eligible
        const rowStatus = row ? row.getAttribute('data-status') : '';
        if (!isDownloadEligible(rowStatus)) {
            showToast('error', 'Download not available', 'Only Completed and Partially Completed reports can be downloaded.');
            return;
        }

        // Enter loading state (disables the badge / prevents double-clicks)
        const originalHTML = badgeElement.innerHTML;
        badgeElement.classList.add('is-loading');
        badgeElement.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>Generating PDF...</span>
        `;

        showToast('info', 'Preparing your report…', `Fetching report data for booking ${bookingId}. Please wait.`, 6000);

        try {
            const patientDetails = await fetchreport(bookingId);
            if (!patientDetails || !patientDetails._id) {
                throw new Error('No report data returned for this booking.');
            }

            const resolvedPatientName = resolvePatientName({
                reportData: patientDetails,
                bookingListPatientName: patientNameFromList,
                bookingId: bookingId,
                row: row
            });

            const letterPadOption = getLetterheadPreference();
            const success = await autogeneratingpdf({
                value1: patientDetails._id,
                bookingId: bookingId,
                startDate: letterPadOption,
                patientname: resolvedPatientName,
                labinchargesign: null,
                checkBox: false,
                labinchargeinfo: '',
                backgroundImageUrl: null,
                headermargin: null,
                footermargin: null,
                marginRight: null,
                marginLeft: null,
                labinchargesignurl: null,
                selectedFontSize: null,
                RowSpacing: null,
                HighLow: null,
                HLinred: null,
                BoldRow: null,
                showInvest: null
            });

            if (!success) throw new Error('PDF generation failed on the server.');

            showToast('success', 'Report downloaded successfully!', `Report for ${resolvedPatientName || ('booking ' + bookingId)} has been saved to your downloads.`);
        } catch (error) {
            console.error(`Error downloading report for Booking ID ${bookingId}:`, error);
            showToast('error', 'Download failed', `We couldn’t generate the report for booking ${bookingId}. Please try again.`);
        } finally {
            // Restore the badge
            badgeElement.classList.remove('is-loading');
            badgeElement.innerHTML = originalHTML;
        }
    }

    // ============================================================
    // SELECTIVE REPORT DOWNLOAD (MODAL & FILTER LOGIC)
    // ============================================================
    function extractSelectableItemsFromReport(patientDetails, bookingObj) {
        const packages = [];
        const panels = [];
        const tests = [];

        // 1. If bookedItems manifest already exists on patientDetails (from modern labreport save):
        if (patientDetails?.bookedItems && typeof patientDetails.bookedItems === 'object') {
            const bi = patientDetails.bookedItems;
            if (Array.isArray(bi.packages)) {
                bi.packages.forEach(pkg => {
                    const name = String(pkg.name || '').trim();
                    if (name && !packages.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                        packages.push({
                            id: name,
                            name: name,
                            category: 'Package',
                            subText: 'Includes all packaged profiles & tests'
                        });
                    }
                });
            }
            if (Array.isArray(bi.panels)) {
                bi.panels.forEach(pnl => {
                    const name = String(pnl.name || '').trim();
                    if (name && !panels.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                        panels.push({
                            id: name,
                            name: name,
                            category: pnl.category || 'Panel',
                            subText: `${pnl.category || 'Panel'}${pnl.testCount ? ' • ' + pnl.testCount + ' tests' : ''}`
                        });
                    }
                });
            }
            if (Array.isArray(bi.tests)) {
                bi.tests.forEach(tst => {
                    const name = String(tst.name || '').trim();
                    if (name && !tests.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                        tests.push({
                            id: name,
                            name: name,
                            category: tst.category || 'Test',
                            subText: tst.category || 'Test'
                        });
                    }
                });
            }
        }

        // 2. Discover Packages and Panels from booking.tableData or patientDetails.bookingTableData
        const sourceTableData = (Array.isArray(bookingObj?.tableData) && bookingObj.tableData.length)
            ? bookingObj.tableData
            : (Array.isArray(patientDetails?.bookingTableData) ? patientDetails.bookingTableData : []);

        sourceTableData.forEach(item => {
            const rawName = String(item?.testName || '').trim();
            if (!rawName) return;

            const ids = Array.isArray(item?.ids) ? item.ids : [];
            const isPackage = ids.some(idObj => idObj.collectionName === 'Package') ||
                /package|profile\s+pack/i.test(rawName);
            const isPanel = ids.some(idObj => idObj.collectionName === 'Panel' || idObj.collectionName === 'addPannel') ||
                /panel|profile/i.test(rawName);

            if (isPackage && !packages.some(p => p.name.toLowerCase() === rawName.toLowerCase())) {
                packages.push({
                    id: rawName,
                    name: rawName,
                    category: 'Package',
                    subText: 'Includes all packaged profiles & tests'
                });
            } else if (isPanel && !panels.some(p => p.name.toLowerCase() === rawName.toLowerCase())) {
                panels.push({
                    id: rawName,
                    name: rawName,
                    category: item.typeOfSample ? `Sample: ${item.typeOfSample}` : 'Panel',
                    subText: item.typeOfSample ? `Sample: ${item.typeOfSample}` : 'Panel'
                });
            }
        });

        // 3. Extract Panels and Tests from CategoryAndTest
        const catAndTests = Array.isArray(patientDetails?.CategoryAndTest) ? patientDetails.CategoryAndTest : [];
        catAndTests.forEach(sec => {
            const categoryName = String(sec?.category || '').trim();
            const panelTitle = String(sec?.panelName || sec?.title || '').trim();
            const isPanel = sec?.type === 'panel' ||
                (panelTitle && panelTitle !== categoryName && !panelTitle.includes('Unknown Title'));

            if (isPanel && panelTitle) {
                if (!panels.some(p => p.name.toLowerCase() === panelTitle.toLowerCase())) {
                    const rowCount = Array.isArray(sec.tableData)
                        ? sec.tableData.filter(r => r.testName && !r.isMultiHeader).length
                        : 0;
                    panels.push({
                        id: panelTitle,
                        name: panelTitle,
                        category: categoryName || 'Panel',
                        subText: `${categoryName || 'Panel'}${rowCount ? ' • ' + rowCount + ' tests' : ''}`
                    });
                }
            }

            // Extract individual tests
            const rows = Array.isArray(sec?.tableData) ? sec.tableData : [];
            rows.forEach(r => {
                const tName = String(r?.testName || '').trim();
                if (tName && !r.isMultiHeader && !r.isParameter) {
                    if (!tests.some(t => t.name.toLowerCase() === tName.toLowerCase())) {
                        tests.push({
                            id: tName,
                            name: tName,
                            category: categoryName || 'Test',
                            subText: panelTitle && panelTitle !== categoryName ? `${panelTitle} (${categoryName})` : (categoryName || 'Test')
                        });
                    }
                }
            });
        });

        // 4. Fallback if no individual tests were found
        if (tests.length === 0 && panels.length === 0 && packages.length === 0) {
            sourceTableData.forEach(item => {
                const rawName = String(item?.testName || '').trim();
                if (rawName && !tests.some(t => t.name.toLowerCase() === rawName.toLowerCase())) {
                    tests.push({
                        id: rawName,
                        name: rawName,
                        category: item.typeOfSample ? `Sample: ${item.typeOfSample}` : 'Test',
                        subText: item.typeOfSample ? `Sample: ${item.typeOfSample}` : 'Test'
                    });
                }
            });
        }

        return { packages, panels, tests };
    }

    async function openSelectiveModal(bookingId, row) {
        if (!selectiveModal) return;

        const bookingObj = (Array.isArray(bookings) ? bookings.find(b => String(b.bookingId) === String(bookingId)) : null) || null;
        const patientNameFromList = getBookingPatientName(bookingId, row);

        if (modalBookingId) modalBookingId.textContent = bookingId || 'N/A';
        if (modalPatientName) modalPatientName.textContent = patientNameFromList || 'Patient';

        if (modalSelectionCounter) modalSelectionCounter.textContent = '0 selected';
        if (downloadSelectiveBtn) {
            downloadSelectiveBtn.disabled = true;
            if (downloadSelectiveBtnLabel) downloadSelectiveBtnLabel.textContent = 'Download Selected (0 items)';
        }

        if (modalLetterheadSelect) {
            modalLetterheadSelect.value = getLetterheadPreference();
        }

        selectiveModal.style.display = 'flex';
        selectiveModal.classList.remove('hidden');
        if (selectiveItemsList) {
            selectiveItemsList.innerHTML = `
                <div class="selective-loading" style="text-align:center; padding:32px 16px; color:#64748b;">
                    <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; color:var(--color);"></i>
                    <div>Fetching tests, panels & packages for ${escapeHtml(bookingId)}...</div>
                </div>
            `;
        }

        try {
            const patientDetails = await fetchreport(bookingId);
            if (!patientDetails || !patientDetails._id) {
                throw new Error('Report details not found for this booking.');
            }

            const resolvedPatientName = resolvePatientName({
                reportData: patientDetails,
                bookingListPatientName: patientNameFromList,
                bookingId: bookingId,
                row: row
            });

            if (modalPatientName) modalPatientName.textContent = resolvedPatientName;

            const manifest = extractSelectableItemsFromReport(patientDetails, bookingObj);

            currentModalBooking = {
                bookingId,
                patientName: resolvedPatientName,
                reportData: patientDetails,
                bookingObj,
                row,
                manifest
            };

            renderSelectiveItemsList(manifest);
        } catch (error) {
            console.error('Error loading report manifest:', error);
            if (selectiveItemsList) {
                selectiveItemsList.innerHTML = `
                    <div style="text-align:center; padding:32px 16px; color:#dc2626;">
                        <i class="fas fa-circle-exclamation" style="font-size:24px; margin-bottom:8px;"></i>
                        <div style="font-weight:600;">Unable to load tests for this booking</div>
                        <div style="font-size:12px; color:#64748b; margin-top:4px;">${escapeHtml(error.message || 'Please try again.')}</div>
                    </div>
                `;
            }
        }
    }

    function closeSelectiveModal() {
        if (!selectiveModal) return;
        selectiveModal.style.display = 'none';
        selectiveModal.classList.add('hidden');
        currentModalBooking = null;
    }

    function renderSelectiveItemsList(manifest) {
        if (!selectiveItemsList) return;

        const { packages = [], panels = [], tests = [] } = manifest;
        const totalItems = packages.length + panels.length + tests.length;

        if (totalItems === 0) {
            selectiveItemsList.innerHTML = `
                <div style="text-align:center; padding:28px 16px; color:#64748b;">
                    <i class="fas fa-info-circle" style="font-size:22px; margin-bottom:8px;"></i>
                    <div style="font-weight:600;">No selectable tests found</div>
                    <div style="font-size:12px; margin-top:4px;">You can still download the complete report using the button above.</div>
                </div>
            `;
            return;
        }

        let html = '';

        if (packages.length > 0) {
            html += `
                <div class="selective-group">
                    <div class="selective-group-title">
                        <i class="fas fa-box-archive" style="color:#b45309;"></i> Packages (${packages.length})
                    </div>
                    ${packages.map(pkg => `
                        <div class="selective-item-card" data-item-type="package" data-item-name="${escapeHtml(pkg.name)}">
                            <input type="checkbox" class="selective-checkbox" data-item-type="package" data-item-name="${escapeHtml(pkg.name)}">
                            <div class="selective-item-details">
                                <div class="selective-item-header">
                                    <span class="selective-item-name">${escapeHtml(pkg.name)}</span>
                                    <span class="selective-item-badge badge-package">Package</span>
                                </div>
                                <div class="selective-item-sub">${escapeHtml(pkg.subText || 'Package Profile')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (panels.length > 0) {
            html += `
                <div class="selective-group">
                    <div class="selective-group-title">
                        <i class="fas fa-layer-group" style="color:#0369a1;"></i> Panels / Profiles (${panels.length})
                    </div>
                    ${panels.map(pnl => `
                        <div class="selective-item-card" data-item-type="panel" data-item-name="${escapeHtml(pnl.name)}">
                            <input type="checkbox" class="selective-checkbox" data-item-type="panel" data-item-name="${escapeHtml(pnl.name)}">
                            <div class="selective-item-details">
                                <div class="selective-item-header">
                                    <span class="selective-item-name">${escapeHtml(pnl.name)}</span>
                                    <span class="selective-item-badge badge-panel">Panel</span>
                                </div>
                                <div class="selective-item-sub">${escapeHtml(pnl.subText || 'Panel')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (tests.length > 0) {
            html += `
                <div class="selective-group">
                    <div class="selective-group-title">
                        <i class="fas fa-flask" style="color:#475569;"></i> Individual Tests (${tests.length})
                    </div>
                    ${tests.map(tst => `
                        <div class="selective-item-card" data-item-type="test" data-item-name="${escapeHtml(tst.name)}">
                            <input type="checkbox" class="selective-checkbox" data-item-type="test" data-item-name="${escapeHtml(tst.name)}">
                            <div class="selective-item-details">
                                <div class="selective-item-header">
                                    <span class="selective-item-name">${escapeHtml(tst.name)}</span>
                                    <span class="selective-item-badge badge-test">Test</span>
                                </div>
                                <div class="selective-item-sub">${escapeHtml(tst.subText || 'Test')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        selectiveItemsList.innerHTML = html;
        updateSelectiveModalCounters();
    }

    function updateSelectiveModalCounters() {
        if (!selectiveItemsList) return;
        const checkboxes = selectiveItemsList.querySelectorAll('.selective-checkbox');
        let selectedCount = 0;
        checkboxes.forEach(cb => {
            const card = cb.closest('.selective-item-card');
            if (cb.checked) {
                selectedCount++;
                if (card) card.classList.add('is-checked');
            } else {
                if (card) card.classList.remove('is-checked');
            }
        });

        if (modalSelectionCounter) {
            modalSelectionCounter.textContent = `${selectedCount} selected`;
        }

        if (downloadSelectiveBtn) {
            downloadSelectiveBtn.disabled = selectedCount === 0;
            if (downloadSelectiveBtnLabel) {
                downloadSelectiveBtnLabel.textContent = `Download Selected (${selectedCount} item${selectedCount === 1 ? '' : 's'})`;
            }
        }
    }

    async function handleSelectiveDownload() {
        if (!currentModalBooking || !downloadSelectiveBtn || downloadSelectiveBtn.disabled) return;

        const checkedBoxes = Array.from(selectiveItemsList.querySelectorAll('.selective-checkbox:checked'));
        if (checkedBoxes.length === 0) {
            showToast('error', 'No tests selected', 'Please select at least one test, panel, or package.');
            return;
        }

        const selectedPackages = [];
        const selectedPanels = [];
        const selectedTests = [];
        const selectedItems = [];

        checkedBoxes.forEach(cb => {
            const itemType = cb.getAttribute('data-item-type');
            const itemName = cb.getAttribute('data-item-name');
            if (!itemName) return;

            selectedItems.push(itemName);
            if (itemType === 'package') selectedPackages.push(itemName);
            else if (itemType === 'panel') selectedPanels.push(itemName);
            else if (itemType === 'test') selectedTests.push(itemName);
        });

        const letterPadOption = modalLetterheadSelect ? modalLetterheadSelect.value : getLetterheadPreference();

        const patientNameClean = String(currentModalBooking.patientName || 'Report')
            .normalize('NFKC')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
            .replace(/\s+/g, '_')
            .trim();

        let customFilename;
        if (selectedItems.length === 1) {
            const itemClean = selectedItems[0].replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_');
            customFilename = `${patientNameClean}_${itemClean}_Report.pdf`;
        } else if (selectedItems.length <= 2) {
            const itemsClean = selectedItems.map(s => s.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_')).join('_');
            customFilename = `${patientNameClean}_${itemsClean}_Report.pdf`;
        } else {
            customFilename = `${patientNameClean}_${selectedItems.length}_Selected_Tests_Report.pdf`;
        }

        const origBtnHtml = downloadSelectiveBtn.innerHTML;
        downloadSelectiveBtn.disabled = true;
        downloadSelectiveBtn.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>Generating Selective PDF...</span>
        `;

        showToast('info', 'Generating Selective Report…', `Creating report for ${selectedItems.length} selected item(s). Please wait.`, 5000);

        try {
            const success = await autogeneratingpdf({
                value1: currentModalBooking.reportData._id,
                bookingId: currentModalBooking.bookingId,
                startDate: letterPadOption,
                patientname: currentModalBooking.patientName,
                selectedItems: selectedItems,
                filteredPanels: selectedPanels,
                filteredTests: selectedTests,
                filteredPackages: selectedPackages,
                customFilename: customFilename
            });

            if (!success) {
                throw new Error('PDF generation failed on server.');
            }

            showToast('success', 'Report Downloaded!', `Selective report with ${selectedItems.length} item(s) downloaded successfully.`);
            closeSelectiveModal();
        } catch (error) {
            console.error('Error generating selective PDF:', error);
            showToast('error', 'Download Failed', `Could not generate selective report: ${error.message || 'Please try again.'}`);
        } finally {
            if (downloadSelectiveBtn) {
                downloadSelectiveBtn.disabled = false;
                downloadSelectiveBtn.innerHTML = origBtnHtml;
                updateSelectiveModalCounters();
            }
        }
    }

    async function handleModalFullDownload() {
        if (!currentModalBooking) return;
        const { bookingId, patientName, reportData } = currentModalBooking;
        const letterPadOption = modalLetterheadSelect ? modalLetterheadSelect.value : getLetterheadPreference();

        closeSelectiveModal();
        showToast('info', 'Downloading Full Report…', `Preparing complete report for booking ${bookingId}. Please wait.`, 5000);

        try {
            const success = await autogeneratingpdf({
                value1: reportData._id,
                bookingId: bookingId,
                startDate: letterPadOption,
                patientname: patientName
            });

            if (!success) throw new Error('PDF generation failed on the server.');
            showToast('success', 'Report downloaded successfully!', `Complete report for ${patientName || bookingId} downloaded.`);
        } catch (error) {
            console.error('Error downloading full report from modal:', error);
            showToast('error', 'Download failed', `We couldn’t generate the complete report for booking ${bookingId}.`);
        }
    }

    // ============================================================
    // BULK DOWNLOAD
    // ============================================================
    // Updates the download button's icon + label in place (keeps the
    // .btn-label element attached so progress text always renders).
    function setDownloadBtnState(iconClass, labelText) {
        if (!downloadBtn) return;
        const icon = downloadBtn.querySelector('i');
        if (icon) icon.className = iconClass;
        if (downloadBtnLabel) downloadBtnLabel.textContent = labelText;
    }

    async function downloadSelectedReports() {
        if (!downloadBtn) return;

        // If downloading → cancel
        if (isDownloading) {
            cancelDownload = true;
            setDownloadBtnState('fas fa-spinner fa-spin', 'Stopping...');
            return;
        }

        const checkboxes = document.querySelectorAll('#tab input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            showToast('info', 'No reports selected', 'Please select at least one booking to download.');
            return;
        }

        const bookingIds = Array.from(checkboxes).map(checkbox => {
            const row = checkbox.closest('tr');
            const badge = row ? row.querySelector('.booking-id-badge') : null;
            return {
                bookingId: badge ? (badge.getAttribute('data-booking-id') || badge.textContent.trim()) : '',
                patientName: getBookingPatientName(badge ? badge.getAttribute('data-booking-id') : '', row),
                status: row ? row.getAttribute('data-status') : ''
            };
        }).filter(item => item.bookingId && isDownloadEligible(item.status));

        // Enter downloading state
        isDownloading = true;
        cancelDownload = false;
        downloadBtn.classList.add('is-downloading');
        setDownloadBtnState('fas fa-stop', 'Stop Download');

        showToast('info', 'Preparing your reports…', `Downloading ${bookingIds.length} report${bookingIds.length === 1 ? '' : 's'}. Please wait.`, 6000);

        try {
            for (let i = 0; i < bookingIds.length; i++) {
                if (cancelDownload) {
                    showToast('info', 'Download stopped', 'The remaining reports were not downloaded.');
                    break;
                }

                setDownloadBtnState('fas fa-spinner fa-spin', `Downloading (${i + 1}/${bookingIds.length})… Click to Stop`);

                await downloadReportForBooking(bookingIds[i].bookingId, bookingIds[i].patientName, true);
            }

            if (!cancelDownload) {
                showToast('success', 'All reports downloaded successfully!', `${bookingIds.length} report${bookingIds.length === 1 ? '' : 's'} saved to your downloads.`);
            }
        } finally {
            isDownloading = false;
            cancelDownload = false;
            downloadBtn.classList.remove('is-downloading');
            setDownloadBtnState('fas fa-download', 'Download Selected Reports');
        }
    }

    async function downloadReportForBooking(bookingId, patientName, hideLoader = false) {
        try {
            const patientDetails = await fetchreport(bookingId);
            const letterPadOption = getLetterheadPreference();

            if (!patientDetails || !patientDetails._id) {
                console.error('Could not find booking details for', bookingId);
                showToast('error', 'Download failed', `We couldn’t find report data for booking ${bookingId}.`);
                return;
            }

            const resolvedPatientName = resolvePatientName({
                reportData: patientDetails,
                bookingListPatientName: patientName,
                bookingId: bookingId
            });

            await autogeneratingpdf({
                value1: patientDetails._id,
                bookingId: bookingId,
                startDate: letterPadOption,
                patientname: resolvedPatientName,
                hideLoader: hideLoader,
                labinchargesign: null,
                checkBox: false,
                labinchargeinfo: '',
                backgroundImageUrl: null,
                headermargin: null,
                footermargin: null,
                marginRight: null,
                marginLeft: null,
                labinchargesignurl: null,
                selectedFontSize: null,
                RowSpacing: null,
                HighLow: null,
                HLinred: null,
                BoldRow: null,
                showInvest: null
            });

        } catch (error) {
            console.error(`Error downloading report for Booking ID ${bookingId}:`, error);
            showToast('error', 'Download failed', `An unexpected error occurred for booking ${bookingId}.`);
        }
    }

    // ============================================================
    // MERGE REPORTS
    // ============================================================
    async function mergeSelectedReports() {
        const checkboxes = document.querySelectorAll('#tab input[type="checkbox"]:checked');

        if (checkboxes.length < 2) {
            showToast('info', 'Selection required', 'Please select at least two bookings to merge.');
            return;
        }

        if (loader) loader.style.display = 'flex';
        showToast('info', 'Merging reports…', `Combining ${checkboxes.length} reports into one PDF. Please wait.`, 8000);

        try {
            const selectedReports = Array.from(checkboxes).map(checkbox => {
                const row = checkbox.closest('tr');
                const badge = row ? row.querySelector('.booking-id-badge') : null;
                const bookingId = badge ? (badge.getAttribute('data-booking-id') || badge.textContent.trim()) : '';
                const booking = bookings.find(b => String(b.bookingId) === String(bookingId));
                return {
                    bookingId,
                    date: booking?.createdAt || new Date()
                };
            }).filter(item => item.bookingId);

            selectedReports.sort((a, b) => new Date(b.date) - new Date(a.date));

            const reportIds = [];
            for (const report of selectedReports) {
                const patientDetails = await fetchreport(report.bookingId);
                if (patientDetails && patientDetails._id) {
                    reportIds.push(patientDetails._id);
                }
            }

            if (reportIds.length < 2) {
                throw new Error('Not enough valid reports to merge.');
            }

            const letterPadOption = getLetterheadPreference();
            const response = await fetch(`${BASE_URL}/api/v1/user/merge-pdfs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportIds: reportIds,
                    checkBox: letterPadOption === 'with' ? false : true
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                const errMsg = errData?.message || 'PDF merge failed';
                showToast('error', 'Merge Restricted', errMsg);
                throw new Error(errMsg);
            }

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `Merged_Reports_${new Date().getTime()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 500);

            showToast('success', 'Reports merged successfully!', `${reportIds.length} reports combined into a single PDF.`);
        } catch (error) {
            console.error('Error merging PDFs:', error);
            showToast('error', 'Merge failed', error.message || 'We couldn’t merge the selected reports. Please try again.');
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }

    // ============================================================
    // SEARCH FUNCTIONALITY
    // ============================================================
    function handleSearch() {
        const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
        let visibleCount = 0;

        if (!searchTerm) {
            allRows.forEach(row => {
                row.style.display = '';
            });
            const noResultsRow = document.getElementById('no-results-row');
            if (noResultsRow) noResultsRow.remove();
            updateMergeButtonVisibility();
            updateResultsCount();
            return;
        }

        allRows.forEach(row => {
            const cells = Array.from(row.cells).slice(1);
            const rowText = cells.map(cell => (cell.textContent || cell.innerText || '')).join(' ').toLowerCase();
            if (rowText.includes(searchTerm)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        const noResultsRow = document.getElementById('no-results-row');
        if (visibleCount === 0 && allRows.length > 0) {
            renderNoResultsRow(searchTerm);
        } else if (noResultsRow) {
            noResultsRow.remove();
        }

        updateMergeButtonVisibility();
        updateResultsCount();
    }

    // ============================================================
    // MERGE BUTTON VISIBILITY
    // ============================================================
    function updateMergeButtonVisibility() {
        if (!mergeBtn) return;
        const visibleCheckboxes = Array.from(document.querySelectorAll('.report-checkbox:checked'))
            .filter(checkbox => {
                const row = checkbox.closest('tr');
                return row && row.style.display !== 'none';
            });
        mergeBtn.classList.toggle('hidden', visibleCheckboxes.length < 2);
    }

    // ============================================================
    // QUICK DATE RANGE
    // ============================================================
    function handleQuickDateRange(value) {
        const months = parseInt(value, 10);
        if (isNaN(months)) return;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        if (endDateInput) {
            endDateInput.value = getLocalDateString(endDate);
            endDateSelectedAt = { date: endDateInput.value, at: new Date() };
        }
        if (startDateInput) startDateInput.value = getLocalDateString(startDate);

        if (searchButton) searchButton.click();
    }

    async function checkAndDisplayWalletRestrictionBanner() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/get-wallet-balance`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.success && typeof data.balance === 'number' && data.balance < 0) {
                const bannerId = 'wallet-negative-restriction-banner';
                if (!document.getElementById(bannerId)) {
                    const banner = document.createElement('div');
                    banner.id = bannerId;
                    banner.style.cssText = 'background: #fee2e2; border: 1px solid #ef4444; color: #991b1b; padding: 12px 18px; border-radius: 8px; margin: 15px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 500; box-shadow: 0 2px 4px rgba(239,68,68,0.1);';
                    banner.innerHTML = `
                        <div style="display:flex; align-items:center; gap: 10px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 20px; color: #dc2626;"></i>
                            <span><strong>Report Download Restricted:</strong> Your wallet balance is negative (-₹${Math.abs(data.balance).toFixed(2)}). Please recharge your wallet first to download reports.</span>
                        </div>
                        <span style="background: #dc2626; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap;">Recharge Required</span>
                    `;
                    const container = document.querySelector('.main-content') || document.querySelector('.container') || document.body.firstElementChild || document.body;
                    if (container) container.insertBefore(banner, container.firstChild);
                }
            }
        } catch (e) {
            console.debug('Wallet balance check skipped:', e);
        }
    }

    // ============================================================
    // INITIALIZE
    // ============================================================
    (async function init() {
        setDefaultDates();

        // Restore persisted letterhead preference (segmented control + hidden select)
        const pref = getLetterheadPreference();
        syncLetterheadUI(pref);

        // Load sub-franchisees (quietly)
        await subfranchisee();

        // Check wallet balance and display restriction banner if balance is negative
        checkAndDisplayWalletRestrictionBanner();

        // Initial booking fetch with skeleton loading
        await fetchBookings(getLast24HoursDate(), getTodayDate());
    })();

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    // Capture the precise selection instant for today's end-date filter.
    if (endDateInput) {
        endDateInput.addEventListener('change', function () {
            endDateSelectedAt = { date: endDateInput.value, at: new Date() };
        });
    }

    // Search button
    if (searchButton) {
        searchButton.addEventListener('click', function () {
            const startDate = startDateInput ? startDateInput.value : '';
            const endDate = endDateInput ? endDateInput.value : '';
            const selectedOption = franchiseeSelect ? franchiseeSelect.options[franchiseeSelect.selectedIndex] : null;
            const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;
            currentPage = 1; // Reset to first page on new search
            fetchBookings(startDate, endDate, franchiseeId);
        });
    }

    // Inline search input (debounced)
    if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(handleSearch, 200);
        });
    }

    // Table container: single-booking download & selective download modal
    if (tableContainer) {
        tableContainer.addEventListener('click', async function (event) {
            const selectiveBtn = event.target.closest('.btn-selective-download');
            if (selectiveBtn) {
                event.preventDefault();
                event.stopPropagation();
                const bId = selectiveBtn.getAttribute('data-booking-id');
                const row = selectiveBtn.closest('tr');
                if (bId) {
                    await openSelectiveModal(bId, row);
                }
                return;
            }

            const badge = event.target.closest('.booking-id-badge');
            if (!badge) return;
            event.preventDefault();
            await downloadSingleReport(badge);
        });

        // Keyboard accessibility: Enter / Space triggers download on the badge or selective button
        tableContainer.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const selectiveBtn = event.target.closest('.btn-selective-download');
            if (selectiveBtn) {
                event.preventDefault();
                const bId = selectiveBtn.getAttribute('data-booking-id');
                const row = selectiveBtn.closest('tr');
                if (bId) openSelectiveModal(bId, row);
                return;
            }
            const badge = event.target.closest('.booking-id-badge');
            if (!badge) return;
            event.preventDefault();
            downloadSingleReport(badge);
        });
    }

    // ============================================================
    // SELECTIVE MODAL EVENT LISTENERS
    // ============================================================
    if (closeSelectiveModalBtn) {
        closeSelectiveModalBtn.addEventListener('click', closeSelectiveModal);
    }

    if (cancelSelectiveModalBtn) {
        cancelSelectiveModalBtn.addEventListener('click', closeSelectiveModal);
    }

    if (modalFullDownloadBtn) {
        modalFullDownloadBtn.addEventListener('click', handleModalFullDownload);
    }

    if (downloadSelectiveBtn) {
        downloadSelectiveBtn.addEventListener('click', handleSelectiveDownload);
    }

    if (modalSelectAllBtn) {
        modalSelectAllBtn.addEventListener('click', function () {
            if (!selectiveItemsList) return;
            selectiveItemsList.querySelectorAll('.selective-checkbox').forEach(cb => { cb.checked = true; });
            updateSelectiveModalCounters();
        });
    }

    if (modalDeselectAllBtn) {
        modalDeselectAllBtn.addEventListener('click', function () {
            if (!selectiveItemsList) return;
            selectiveItemsList.querySelectorAll('.selective-checkbox').forEach(cb => { cb.checked = false; });
            updateSelectiveModalCounters();
        });
    }

    if (selectiveItemsList) {
        selectiveItemsList.addEventListener('click', function (event) {
            const card = event.target.closest('.selective-item-card');
            if (!card) return;
            const checkbox = card.querySelector('.selective-checkbox');
            if (!checkbox) return;
            if (event.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            updateSelectiveModalCounters();
        });

        selectiveItemsList.addEventListener('change', function (event) {
            if (event.target.classList.contains('selective-checkbox')) {
                updateSelectiveModalCounters();
            }
        });
    }

    if (selectiveModal) {
        selectiveModal.addEventListener('click', function (event) {
            if (event.target === selectiveModal) {
                closeSelectiveModal();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && selectiveModal && selectiveModal.style.display !== 'none' && !selectiveModal.classList.contains('hidden')) {
            closeSelectiveModal();
        }
    });

    // Download Selected Reports button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadSelectedReports);
    }

    // Merge Reports button
    if (mergeBtn) {
        mergeBtn.addEventListener('click', mergeSelectedReports);
    }

    // Select All checkbox
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function () {
            const isChecked = selectAllCheckbox.checked;
            document.querySelectorAll('.report-checkbox').forEach(cb => {
                const row = cb.closest('tr');
                if (row && row.style.display !== 'none' && !cb.disabled) {
                    cb.checked = isChecked;
                }
            });
            updateMergeButtonVisibility();
        });
    }

    // Row checkbox change → merge visibility
    tableBody.addEventListener('change', function (event) {
        if (event.target.classList.contains('report-checkbox')) {
            updateMergeButtonVisibility();
        }
    });

    // Quick Date Range change
    if (quickDateRange) {
        quickDateRange.addEventListener('change', function () {
            handleQuickDateRange(quickDateRange.value);
        });
    }

    // Page size change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function () {
            const newSize = parseInt(pageSizeSelect.value, 10);
            if (!isNaN(newSize) && newSize > 0) {
                pageSize = newSize;
                currentPage = 1; // Reset to first page when page size changes
                fetchBookings(lastFetchParams.startDate, lastFetchParams.endDate, lastFetchParams.franchiseeId);
            }
        });
    }

    // Letterhead segmented control (persisted)
    if (letterheadSeg) {
        letterheadSeg.addEventListener('click', function (event) {
            const btn = event.target.closest('.seg-option');
            if (!btn) return;
            const value = btn.getAttribute('data-value');
            if (value) setLetterheadPreference(value);
        });
    }

    // Toast container close buttons (delegated)
    if (toastContainer) {
        toastContainer.addEventListener('click', function (event) {
            if (event.target.closest('.toast-close')) {
                closeToast(event.target.closest('.toast'));
            }
        });
    }
})();