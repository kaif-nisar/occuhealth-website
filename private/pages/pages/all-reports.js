(function hort() {
    'use strict';

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
                <td class="skeleton-cell"><span class="skeleton skeleton-medium"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-short"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-short"></span></td>
                <td class="skeleton-cell"><span class="skeleton skeleton-long"></span></td>
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
                <td colspan="7">
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
                <td colspan="7">
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
            <td colspan="7">
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

        let query = `?status=completed,pending,hold,partial,clinical&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${currentPage}&limit=${pageSize}`;
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
                const row = document.createElement('tr');
                row.className = 'data-row';
                row.setAttribute('data-booking-id', booking.bookingId || '');
                row.setAttribute('data-status', (booking.status || '').toLowerCase().trim());
                row.innerHTML = `
                    <td><input type="checkbox" class="report-checkbox" aria-label="Select booking ${booking.bookingId || ''}" ${eligible ? '' : 'disabled'}></td>
                    <td>
                        <span class="booking-id-badge${eligible ? '' : ' is-not-ready'}" role="button" tabindex="${eligible ? '0' : '-1'}"
                              title="${eligible ? 'Click to Download Report' : 'Report not ready for download'}"
                              aria-label="${eligible ? 'Download report for booking ' + (booking.bookingId || '') : 'Report not ready for booking ' + (booking.bookingId || '')}"
                              data-booking-id="${booking.bookingId || ''}">
                            <i class="fas ${eligible ? 'fa-download' : 'fa-lock'} booking-id-icon" aria-hidden="true"></i>
                            ${booking.bookingId || 'N/A'}
                            ${eligible ? '' : '<span class="not-ready-tooltip" title="Only Completed and Partially Completed reports can be downloaded"><i class="fas fa-circle-info"></i></span>'}
                        </span>
                    </td>
                    <td class="font-medium text-gray-800">${booking.patientName || 'N/A'}</td>
                    <td>${sampleId}</td>
                    <td>${booking.doctorName || 'N/A'}</td>
                    <td class="td-tests">${tests}</td>
                    <td>
                        <span class="status-badge${eligible ? '' : ' is-not-ready'}" style="background:${statusInfo.bg};color:${statusInfo.text};border-color:${statusInfo.border}">
                            ${statusInfo.label}
                        </span>
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
    // DATE UTILITIES
    // ============================================================
    function getLast24HoursDate() {
        const now = new Date();
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    function getTodayDate() {
        return new Date().toISOString().split('T')[0];
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

    async function autogeneratingpdf({ value1 = '', startDate = '', patientname, hideLoader = false, labinchargesign = null,
        checkBox = false, labinchargeinfo = '', backgroundImageUrl = null, headermargin, footermargin,
        marginRight, marginLeft, labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest } = {}) {

        try {
            if (!hideLoader && loader) loader.style.display = 'flex';

            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value1, labinchargesign, checkBox: startDate === 'with' ? false : true, labinchargeinfo,
                    backgroundImageUrl, headermargin, footermargin, marginRight, marginLeft,
                    labinchargesignurl, selectedFontSize, RowSpacing, HighLow, HLinred, BoldRow, showInvest
                })
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `${patientname || 'Report'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 500);

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
        const bookingId = badgeElement.getAttribute('data-booking-id') || badgeElement.textContent.trim();
        const patientName = row ? (row.querySelector('td:nth-child(3)') || {}).textContent?.trim() : '';

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

            const letterPadOption = getLetterheadPreference();
            const success = await autogeneratingpdf({
                value1: patientDetails._id,
                startDate: letterPadOption,
                patientname: patientName,
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

            showToast('success', 'Report downloaded successfully!', `Report for booking ${bookingId} has been saved to your downloads.`);
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
                patientName: row ? (row.querySelector('td:nth-child(3)') || {}).textContent?.trim() : '',
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

            await autogeneratingpdf({
                value1: patientDetails._id,
                startDate: letterPadOption,
                patientname: patientName,
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

            if (!response.ok) throw new Error('PDF merge failed');

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
            showToast('error', 'Merge failed', 'We couldn’t merge the selected reports. Please try again.');
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

        // Adjust for local timezone
        endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
        startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());

        if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
        if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];

        if (searchButton) searchButton.click();
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

        // Initial booking fetch with skeleton loading
        await fetchBookings(getLast24HoursDate(), getTodayDate());
    })();

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

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

    // Table container: single-booking download (event delegation, prevents double-clicks)
    if (tableContainer) {
        tableContainer.addEventListener('click', async function (event) {
            const badge = event.target.closest('.booking-id-badge');
            if (!badge) return;
            event.preventDefault();
            await downloadSingleReport(badge);
        });

        // Keyboard accessibility: Enter / Space triggers download on the badge
        tableContainer.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const badge = event.target.closest('.booking-id-badge');
            if (!badge) return;
            event.preventDefault();
            downloadSingleReport(badge);
        });
    }

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