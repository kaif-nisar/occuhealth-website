(function hort() {
    let bookings = [];
    let allRows = [];
    let isDownloading = false;
    let cancelDownload = false;
    const REPORT_STATUS_FILTER = ["completed", "Partially Completed", "partial completed", "partial"];

    // ============= FIXED: Fetch Bookings =============
    async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
        if (!franchiseeId) {
            franchiseeId = userId;
        }
        const tableBody = document.querySelector('#tab');
        const loader = document.querySelector('#loader1'); // ✅ LOADER

        let query = `?status=completed&startDate=${startDate}&endDate=${endDate}`;
        if (franchiseeId) {
            query += `&franchiseeId=${franchiseeId}`;
        }

        try {
            // ✅ Show loader while fetching
            loader.style.display = 'flex';
            
            const response = await fetch(`${BASE_URL}/api/v1/user/bookings${query}`);
            if (!response.ok) throw new Error('Failed to fetch bookings');

            const result = await response.json();
            
            // ✅ FIX: Handle different response structures
            if (Array.isArray(result)) {
                bookings = result;
            } else if (result.data && Array.isArray(result.data)) {
                bookings = result.data;
            } else if (result.bookings && Array.isArray(result.bookings)) {
                bookings = result.bookings;
            } else {
                console.log('No bookings data found');
                bookings = [];
            }

            // ✅ Clear table
            tableBody.innerHTML = '';

            // ✅ Show "No data" message if empty
            if (bookings.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 20px; text-align: center; color: #666;">
                            <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>
                            No completed bookings found
                        </td>
                    </tr>
                `;
                allRows = [];
                return;
            }

            const fragment = document.createDocumentFragment();

            bookings.forEach((booking, index) => {
                const tests = Array.isArray(booking.tableData)
                    ? booking.tableData.map(test => `${test.testName} (${test.typeOfSample}) - ${test.barcodeId}`).join('<br>')
                    : 'No tests available';

                const sampleId = Array.isArray(booking.tableData) && booking.tableData[0]?.barcodeId
                    ? booking.tableData[0].barcodeId
                    : 'N/A';

                const row = document.createElement('tr');
                row.className = 'data-row';
                row.innerHTML = `
                    <td><input type="checkbox" class="report-checkbox"></td>
                    <td><a href="#" class="download-link" title="Click to download report">${booking.bookingId}</a></td>
                    <td>${booking.patientName}</td>
                    <td>${sampleId || 'N/A'}</td>
                    <td>${booking.doctorName || 'N/A'}</td>
                    <td>${tests}</td>   
                `;
                fragment.appendChild(row);
            });

            tableBody.appendChild(fragment);
            allRows = Array.from(tableBody.querySelectorAll('tr'));
            document.getElementById('search-input').value = '';

        } catch (error) {
            console.error('Error fetching bookings:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 20px; text-align: center; color: #dc3545;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>
                        Failed to load bookings. Please check your connection.
                    </td>
                </tr>
            `;
            allRows = [];
        } finally {
            // ✅ Hide loader after fetching
            loader.style.display = 'none';
        }
    }

    // ============= FIXED: Sub-franchisee Function =============
    async function subfranchisee() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { 
                method: "GET" 
            });
            
            // ✅ Quietly skip if not available
            if (!response.ok) {
                console.log('Sub-franchisees not available, skipping...');
                return;
            }
            
            const allsubfran = await response.json();
            const subFranchiseeSelect = document.getElementById('franchisee-select');
            
            // ✅ Handle different response structures
            let subFranchisees = [];
            
            if (Array.isArray(allsubfran)) {
                subFranchisees = allsubfran;
            } else if (allsubfran.message && Array.isArray(allsubfran.message)) {
                subFranchisees = allsubfran.message;
            } else if (allsubfran.data && Array.isArray(allsubfran.data)) {
                subFranchisees = allsubfran.data;
            }
            
            // ✅ Skip if no franchisees
            if (subFranchisees.length === 0) {
                console.log('No sub-franchisees found');
                return;
            }
            
            // ✅ Populate dropdown
            subFranchisees.forEach(subfran => {
                const testElement = document.createElement('option');
                testElement.classList.add('subFranchisee-option');
                testElement.setAttribute("data-id", subfran._id);
                testElement.innerText = subfran.fullName || subfran.name || 'Unknown';
                subFranchiseeSelect.appendChild(testElement);
            });
            
        } catch (error) {
            console.log('Sub-franchisees could not be loaded, continuing...');
        }
    }

    // ============= Utility Functions =============
    
    // Get date 24 hours ago
    function getLast24HoursDate() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return yesterday.toISOString().split('T')[0];
    }

    // Get today's date
    function getTodayDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    // Set default dates (last 24 hours)
    function setDefaultDates() {
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        
        startDateInput.value = getLast24HoursDate();
        endDateInput.value = getTodayDate();
    }

    // ============= Initialize =============
    (async function loadBookings() {
        // Set default dates (last 24 hours)
        setDefaultDates();
        
        // Load sub-franchisees
        await subfranchisee();
        
        // Fetch bookings with default 24 hours range
        const startDate = getLast24HoursDate();
        const endDate = getTodayDate();
        await fetchBookings(startDate, endDate);
    })();

    // ============= Search Button =============
    document.querySelector('#search-button').addEventListener('click', function () {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const franchiseeSelect = document.getElementById('franchisee-select');
        const selectedOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];
        const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;

        fetchBookings(startDate, endDate, franchiseeId);
    });

    // ============= Download PDF =============
    document.querySelector(".table-container").addEventListener("click", async function (event) {
        const target = event.target;
        const anchor = target.closest("a.download-link");

        if (anchor) {
            event.preventDefault();
            const row = anchor.closest('tr');
            const bookingId = anchor.textContent.trim();
            const patientName = row.cells[2].textContent.trim();

            const patientDetails = await fetchreport(bookingId);
            if (patientDetails) {
                const letterPadOption = document.getElementById('myselect').value;
                await autogeneratingpdf({
                    value1: patientDetails._id,
                    startDate: letterPadOption,
                    patientname: patientName
                });
            }
        }
    });

    async function autogeneratingpdf({ value1 = "", startDate = "", patientname, hideLoader = false, labinchargesign = null,
        checkBox = false, labinchargeinfo = "", backgroundImageUrl = null, headermargin, footermargin,
        marginRight, marginLeft, labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow,
        HLinred, BoldRow, showInvest } = {}) {

        const loader = document.querySelector('#loader1');

        try {
            // ✅ Show loader while generating PDF
            if (!hideLoader) loader.style.display = 'flex';
            
            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    value1, labinchargesign, checkBox: startDate === "with" ? false : true, labinchargeinfo,
                    backgroundImageUrl, headermargin, footermargin, marginRight, marginLeft,
                    labinchargesignurl, selectedFontSize, RowSpacing, HighLow, HLinred, BoldRow, showInvest
                })
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `${patientname}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(pdfUrl);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            // ✅ Hide loader after PDF generation
            if (!hideLoader) loader.style.display = 'none';
        }
    }

    async function fetchreport(value1) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ value1 })
            });

            if (!response.ok) {
                throw new Error("Failed to fetch report data");
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching report:', error);
            return null;
        }
    }

    // ============= Search Functionality =============
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        let visibleCount = 0;

        if (!searchTerm) {
            allRows.forEach(row => {
                row.style.display = '';
            });
            updateMergeButtonVisibility();
            
            // Remove any "no results" row if exists
            const noResultsRow = document.getElementById('no-results-row');
            if (noResultsRow) noResultsRow.remove();
            
            return;
        }

        allRows.forEach(row => {
            const cells = Array.from(row.cells).slice(1);
            const rowText = cells.map(cell => {
                return cell.textContent || cell.innerText;
            }).join(' ').toLowerCase();

            if (rowText.includes(searchTerm)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        // Handle "No results found" message
        const tableBody = document.querySelector('#tab');
        let noResultsRow = document.getElementById('no-results-row');
        
        if (visibleCount === 0 && allRows.length > 0) {
            if (!noResultsRow) {
                noResultsRow = document.createElement('tr');
                noResultsRow.id = 'no-results-row';
                noResultsRow.innerHTML = `
                    <td colspan="6" style="padding: 20px; text-align: center; color: #666;">
                        <i class="fas fa-search" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                        No results found for "${searchTerm}"
                    </td>
                `;
                tableBody.appendChild(noResultsRow);
            } else {
                noResultsRow.innerHTML = `
                    <td colspan="6" style="padding: 20px; text-align: center; color: #666;">
                        <i class="fas fa-search" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                        No results found for "${searchTerm}"
                    </td>
                `;
            }
        } else if (noResultsRow) {
            noResultsRow.remove();
        }

        updateMergeButtonVisibility();
    });

    // ============= Quick Date Range and Select All via Event Delegation =============
    document.addEventListener('change', function (event) {
        // Quick Date Range
        if (event.target.id === 'quick-date-range') {
            const months = parseInt(event.target.value, 10);
            if (!isNaN(months)) {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - months);
                
                // Adjust for local timezone
                endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
                startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
                
                const endDateInput = document.getElementById('end-date');
                const startDateInput = document.getElementById('start-date');
                
                if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
                if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
                
                const searchBtn = document.getElementById('search-button');
                if (searchBtn) searchBtn.click();
            }
        }
        
        // Select All Checkbox
        if (event.target.id === 'selectAllCheckbox') {
            const isChecked = event.target.checked;
            const checkboxes = document.querySelectorAll('.report-checkbox');
            checkboxes.forEach(cb => {
                const row = cb.closest('tr');
                if (row && row.style.display !== 'none') {
                    cb.checked = isChecked;
                }
            });
            updateMergeButtonVisibility();
        }
    });

    // ============= Merge Button Visibility =============
    function updateMergeButtonVisibility() {
        const visibleCheckboxes = Array.from(document.querySelectorAll('.report-checkbox:checked'))
            .filter(checkbox => {
                const row = checkbox.closest('tr');
                return row && row.style.display !== 'none';
            });
        const mergeButton = document.getElementById('merge-selected-reports');

        if (visibleCheckboxes.length > 1) {
            mergeButton.classList.remove('hidden');
        } else {
            mergeButton.classList.add('hidden');
        }
    }

    document.addEventListener('change', function (event) {
        if (event.target.classList.contains('report-checkbox')) {
            updateMergeButtonVisibility();
        }
    });



    // ============= Download Selected Reports =============
    document.addEventListener('click', async function (event) {
        const btn = event.target.closest('#download-selected-reports');
        if (!btn) return;

        // If already downloading, trigger cancellation
        if (isDownloading) {
            cancelDownload = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
            btn.classList.replace('bg-red-500', 'bg-gray-500');
            btn.classList.replace('hover:bg-red-600', 'hover:bg-gray-600');
            return;
        }

        const checkboxes = document.querySelectorAll('#tab input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            alert('Please select at least one booking.');
            return;
        }

        const bookingIds = Array.from(checkboxes).map(checkbox => {
            const row = checkbox.closest('tr');
            return {
                bookingId: row.querySelector('td:nth-child(2) a').textContent.trim(),
                patientName: row.querySelector('td:nth-child(3)').textContent.trim()
            };
        });

        // Initialize downloading state
        isDownloading = true;
        cancelDownload = false;
        
        // Change UI to Stop button
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Download';
        btn.classList.replace('bg-blue-500', 'bg-red-500');
        btn.classList.replace('hover:bg-blue-600', 'hover:bg-red-600');

        try {
            // ✅ Download reports one by one without showing the global loader overlay
            for (let i = 0; i < bookingIds.length; i++) {
                if (cancelDownload) {
                    console.log("Download stopped by user.");
                    break;
                }
                
                // Update button text to show progress
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading (${i + 1}/${bookingIds.length})... Click to Stop`;
                
                // Pass true to hide the global loader overlay
                await downloadReportForBooking(bookingIds[i].bookingId, bookingIds[i].patientName, true);
            }
        } finally {
            // Restore UI
            isDownloading = false;
            cancelDownload = false;
            btn.innerHTML = '<i class="fas fa-download"></i> Download Selected Reports';
            
            // Revert background color back to blue
            if (btn.classList.contains('bg-red-500')) {
                btn.classList.replace('bg-red-500', 'bg-blue-500');
                btn.classList.replace('hover:bg-red-600', 'hover:bg-blue-600');
            } else if (btn.classList.contains('bg-gray-500')) {
                btn.classList.replace('bg-gray-500', 'bg-blue-500');
                btn.classList.replace('hover:bg-gray-600', 'hover:bg-blue-600');
            }
        }
    });

    // ============= Merge Selected Reports =============
    document.getElementById('merge-selected-reports').addEventListener('click', async function () {
        const checkboxes = document.querySelectorAll('#tab input[type="checkbox"]:checked');

        if (checkboxes.length < 2) {
            alert('Please select at least two bookings to merge.');
            return;
        }

        const loader = document.querySelector('#loader1');
        
        try {
            // ✅ Show loader while merging PDFs
            loader.style.display = 'flex';
            
            const selectedReports = Array.from(checkboxes).map(checkbox => {
                const row = checkbox.closest('tr');
                const bookingId = row.querySelector('td:nth-child(2) a').textContent.trim();
                const booking = bookings.find(b => b.bookingId === bookingId);
                return {
                    bookingId: bookingId,
                    date: booking?.createdAt || new Date()
                };
            });

            selectedReports.sort((a, b) => new Date(b.date) - new Date(a.date));

            const reportIds = [];
            for (let report of selectedReports) {
                const patientDetails = await fetchreport(report.bookingId);
                if (patientDetails && patientDetails._id) {
                    reportIds.push(patientDetails._id);
                }
            }

            const letterPadOption = document.getElementById('myselect').value;
            const response = await fetch(`${BASE_URL}/api/v1/user/merge-pdfs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reportIds: reportIds,
                    checkBox: letterPadOption === "with" ? false : true
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
            URL.revokeObjectURL(pdfUrl);

        } catch (error) {
            console.error('Error merging PDFs:', error);
            alert('Failed to merge PDFs. Please try again.');
        } finally {
            // ✅ Hide loader after merging
            loader.style.display = 'none';
        }
    });

    async function downloadReportForBooking(bookingId, patientName, hideLoader = false) {
        try {
            const patientDetails = await fetchreport(bookingId);
            const letterPadOption = document.getElementById('myselect').value;

            if (!patientDetails) {
                console.error('Could not find booking details');
                return;
            }

            await autogeneratingpdf({
                value1: patientDetails._id,
                startDate: letterPadOption,
                patientname: patientName,
                hideLoader: hideLoader,
                labinchargesign: null,
                checkBox: false,
                labinchargeinfo: "",
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
        }
    }
})();
