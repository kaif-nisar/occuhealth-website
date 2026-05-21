        let currentBookingData = null;

        // DOM Elements
        const searchForm = document.getElementById('searchForm');
        const loadingDiv = document.getElementById('loading');
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        const bookingDetails = document.getElementById('bookingDetails');
        const cancelSection = document.getElementById('cancelSection');
        const confirmModal = document.getElementById('confirmModal');

        // Event Listeners
        searchForm.addEventListener('submit', handleSearch);

        // Show/Hide Functions
        function showElement(element) {
            element.style.display = 'block';
            element.classList.add('show');
        }

        function hideElement(element) {
            element.style.display = 'none';
            element.classList.remove('show');
        }

        function showError(message) {
            errorDiv.textContent = message;
            showElement(errorDiv);
            hideElement(successDiv);
        }

        function showSuccess(message) {
            successDiv.textContent = message;
            showElement(successDiv);
            hideElement(errorDiv);
        }

        function hideMessages() {
            hideElement(errorDiv);
            hideElement(successDiv);
        }

        // Search Booking
        async function handleSearch(e) {
            e.preventDefault();
            
            const bookingId = document.getElementById('bookingId').value.trim();
            const patientName = document.getElementById('patientName').value.trim();

            if (!bookingId) {
                showError('Please enter a booking ID');
                return;
            }

            try {
                showElement(loadingDiv);
                hideMessages();
                hideElement(bookingDetails);
                hideElement(cancelSection);

                // API call to search booking
                const response = await fetch(`${BASE_URL}/api/v1/user/bookings/search`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ bookingId, patientName })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Booking not found');
                }

                currentBookingData = data.data;
                displayBookingDetails(currentBookingData);

            } catch (error) {
                showError(error.message);
                console.error('Search error:', error);
            } finally {
                hideElement(loadingDiv);
            }
        }

        // Display Booking Details
        function displayBookingDetails(booking) {
            // Basic Info
            document.getElementById('displayBookingId').textContent = booking.bookingId;
            document.getElementById('displayPatientName').textContent = booking.patientName;
            document.getElementById('displayDateTime').textContent = `${booking.date} ${booking.time}`;
            document.getElementById('displayPhone').textContent = booking.patientPhone || 'N/A';
            document.getElementById('displayDoctor').textContent = booking.doctorName || 'N/A';
            document.getElementById('displayLab').textContent = booking.labName || 'N/A';
            document.getElementById('displayTotal').textContent = `₹${booking.total}`;
            document.getElementById('displayCourier').textContent = booking.courierName || 'N/A';
            document.getElementById('displayGenderAge').textContent = `${booking.gender}, ${booking.year} years`;

            // Status Badge
            const statusBadge = document.getElementById('statusBadge');
            const status = booking.status || 'pending';
            statusBadge.textContent = status;
            statusBadge.className = `status-badge status-${status.toLowerCase()}`;

            // Tests Table
            const tableBody = document.getElementById('testsTableBody');
            tableBody.innerHTML = '';

            if (booking.tableData && booking.tableData.length > 0) {
                booking.tableData.forEach(test => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${test.barcodeId || test.confirmBarcodeId || 'N/A'}</td>
                        <td>${test.typeOfSample || 'N/A'}</td>
                        <td>${test.testNames ? test.testNames.join(', ') : 'N/A'}</td>
                        <td>${test.collectionDate || booking.date}</td>
                    `;
                    tableBody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="4" style="text-align: center;">No test data available</td>';
                tableBody.appendChild(row);
            }

            // Show booking details
            showElement(bookingDetails);

            // Show cancel section only if booking is not already cancelled
            if (status.toLowerCase() !== 'cancelled') {
                showElement(cancelSection);
            } else {
                hideElement(cancelSection);
                showError('This booking is already cancelled');
            }
        }

        // Modal Functions
        function showConfirmModal() {
            confirmModal.style.display = 'block';
        }

        function hideConfirmModal() {
            confirmModal.style.display = 'none';
        }

        // Confirm Cancellation
        async function confirmCancellation() {
            if (!currentBookingData) {
                showError('No booking selected for cancellation');
                return;
            }

            try {
                hideConfirmModal();
                showElement(loadingDiv);
                hideMessages();

                // API call to cancel booking
                const response = await fetch(`${BASE_URL}/api/v1/user/bookings/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        bookingId: currentBookingData.bookingId 
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to cancel booking');
                }

                // Update status and hide cancel section
                const statusBadge = document.getElementById('statusBadge');
                statusBadge.textContent = 'cancelled';
                statusBadge.className = 'status-badge status-cancelled';
                
                hideElement(cancelSection);
                showSuccess('Booking cancelled successfully! All transactions have been reversed.');

                // Update current booking data
                currentBookingData.status = 'cancelled';

            } catch (error) {
                showError(error.message);
                console.error('Cancellation error:', error);
            } finally {
                hideElement(loadingDiv);
            }
        }

        // Reset Form
        function resetForm() {
            searchForm.reset();
            hideElement(bookingDetails);
            hideElement(cancelSection);
            hideMessages();
            currentBookingData = null;
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            if (event.target === confirmModal) {
                hideConfirmModal();
            }
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            // Auto-focus on booking ID input
            document.getElementById('bookingId').focus();
        });