async function allcases() {

    let BASE_URL = window.location.origin;
    const islayerone = user.tenantId.modelType === "1layer";

    // Safe DOM updates with null checks
    const labelForChange = document.getElementById('labelforchange');
    const tableColFour = document.getElementById('tablecolfour');
    const tableColFive = document.getElementById('tablecolfive');
    const layeredInput = document.getElementById('layeredinput');

    if (labelForChange) labelForChange.textContent = islayerone ? "Doctor" : "Franchisee";
    if (tableColFour) tableColFour.textContent = islayerone ? "Doctor" : "Franchisee";
    if (tableColFive) tableColFive.textContent = islayerone ? "Barcodes" : "Received Barcodes";
    if (layeredInput) layeredInput.style.display = islayerone ? "none" : "";

    let currentPage = 1;
    let totalPages = 1;
    const limit = 30;
    let intervalId;
    const bookingCache = new Map();

    // Global variables for popup with null checks
    const popup = document.getElementById("messagePopup");
    const overlay = document.getElementById("popupOverlay");
    const sendMessageBtn = document.getElementById("sendMessage");
    const closePopupBtn = document.getElementById("closePopup");
    const messagesDiv = document.getElementById("messages");

    // Global variables for attachment modal
    const attachmentModal = document.getElementById("attachmentModal");
    const cancelAttachModalBtn = document.getElementById("cancelAttachModal");
    const saveAttachmentsBtn = document.getElementById("saveAttachmentsBtn");
    const attachmentFileInput = document.getElementById("attachmentFileInput");
    const attachmentListContainer = document.getElementById("attachmentListContainer");
    const targetBookingIdSpan = document.getElementById("targetBookingId");
    let currentBookingIdForAttachments = null;
    const allowedAttachmentExtensions = new Set([
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
        ".bmp",
        ".tif",
        ".tiff",
        ".avif",
        ".heic",
        ".heif",
        ".pdf",
    ]);

    function getFileExtension(fileName = "") {
        const dotIndex = String(fileName).lastIndexOf(".");
        if (dotIndex < 0) return "";
        return String(fileName).slice(dotIndex).toLowerCase();
    }

    function isSupportedAttachmentFile(file) {
        if (!file) return false;

        const mimeType = String(file.type || file.mimetype || "").toLowerCase();
        const extension = getFileExtension(file.name || file.originalname || "");

        if (mimeType === "application/pdf" || extension === ".pdf") {
            return true;
        }

        if (mimeType.startsWith("image/")) {
            return true;
        }

        return allowedAttachmentExtensions.has(extension);
    }

    function showLoader() {
        document.querySelector(".loader").style.display = "flex";
    }
    function hideLoader() {
        document.querySelector(".loader").style.display = "none";
    }

    function getStatusStyles(status) {
        const normalizedStatus = (status || "").trim().toLowerCase();

        if (normalizedStatus === "completed") {
            return {
                rowBackground: "rgba(0, 128, 0, 0.342)",
                badgeBackground: "#15803d",
                badgeColor: "#ffffff"
            };
        }

        if (normalizedStatus === "partially completed") {
            return {
                rowBackground: "rgba(37, 99, 235, 0.2)",
                badgeBackground: "#2563eb",
                badgeColor: "#ffffff"
            };
        }

        if (normalizedStatus === "pending") {
            return {
                rowBackground: "rgba(141, 92, 2, 0.333)",
                badgeBackground: "#8d5c02",
                badgeColor: "#ffffff"
            };
        }

        if (normalizedStatus === "hold" || normalizedStatus === "on hold") {
            return {
                rowBackground: "rgba(120, 32, 0, 0.356)",
                badgeBackground: "#7c2d12",
                badgeColor: "#ffffff"
            };
        }

        if (normalizedStatus === "clinical" || normalizedStatus === "clinical stated") {
            return {
                rowBackground: "rgba(0, 143, 143, 0.333)",
                badgeBackground: "#0f766e",
                badgeColor: "#ffffff"
            };
        }

        return {
            rowBackground: "rgba(107, 114, 128, 0.2)",
            badgeBackground: "#6b7280",
            badgeColor: "#ffffff"
        };
    }

    async function fetchBookings(page = 1) {
        currentPage = page;

        // Gather search filters
        const filters = {
            regNo: document.getElementById("reg-no").value.trim(),
            patientName: document.getElementById("patient-name").value.trim(),
            gender: document.getElementById("gender").value.trim(),
            patientPhone: document.getElementById("patient-phone").value.trim(),
            labName: document.getElementById("lab-name").value.trim(),
            status: document.getElementById("status").value.trim(),
            franchisee: document.getElementById("franchisee").value.trim(),
            barcode: document.getElementById("barcode").value.trim(),
        };

        try {
            showLoader();

            // Single API call - backend handles everything
            const response = await fetch(`${BASE_URL}/api/v1/user/get-bookings?page=${page}&limit=${limit}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(filters)
            });

            const result = await response.json();
            const bookings = result.bookings || [];
            totalPages = Math.ceil(result.total / limit);

            bookingCache.clear();
            bookings.forEach((booking) => {
                if (booking?.bookingId) {
                    bookingCache.set(booking.bookingId, booking);
                }
            });

            // Display counts with null checks
            const totalBookingsEl = document.getElementById("totalbookings");
            const pageCounterEl = document.getElementById("pagecounter");

            if (totalBookingsEl) totalBookingsEl.innerText = `Total bookings received : ${result.total}`;
            if (pageCounterEl) pageCounterEl.innerHTML = `Page ${currentPage} of ${totalPages}`;

            displayBookings(bookings);
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            hideLoader();
        }
    }

    // Display bookings in table with LIS indicators
    function displayBookings(bookings) {
        const tableBody = document.getElementById("tbody");
        tableBody.innerHTML = "";

        if (!bookings.length) {
            tableBody.innerHTML = `<tr><td colspan="7">No bookings found.</td></tr>`;
            return;
        }

        bookings.forEach((booking) => {
            if (booking.status === "cancelled" || booking.status === "On Hold") {
                return;
            }

            const row = document.createElement("tr");

            // Set lightweight custom attributes
            row.setAttribute("age", booking.year);
            row.setAttribute("gender", booking.gender);
            row.setAttribute("data-booking-id", booking.bookingId);
            row.setAttribute("data-patient-phone", booking.patientPhone);
            row.setAttribute("data-lab-name", booking.labName);
            row.setAttribute("data-updated-at", booking.updatedAt);
            row.setAttribute("data-created-by", booking.createdBy);
            const statusStyles = getStatusStyles(booking.status);
            const baseColor = statusStyles.rowBackground;

            // Add LIS gradient if data is present
            if (booking.isLisPresent) {
                row.style.background = `linear-gradient(to right, rgba(138, 43, 226, 0.4) 0%, rgba(138, 43, 226, 0.15) 8px, ${baseColor} 8px)`;
            } else {
                row.style.backgroundColor = baseColor;
            }

            function formatBarcodeWithSampleType(detail) {
                const barcode = detail?.barcode || "";
                const sampleType = (detail?.sampleType || detail?.sampletype || detail?.typeOfSample || "").trim();

                if (!barcode) return "";
                return sampleType ? `${barcode} (${sampleType})` : barcode;
            }

            // Create barcode HTML with LIS indicators
            let barcodeHtml = '';
            if (booking.barcodeDetails && booking.barcodeDetails.length > 0) {
                barcodeHtml = booking.barcodeDetails.map(detail => {
                    const icon = detail.isLisPresent 
                        ? '<i class="fa-solid fa-circle-check" style="color: #28a745; margin-right: 3px;"></i>' 
                        : '<i class="fa-solid fa-circle-xmark" style="color: #dc3545; margin-right: 3px;"></i>';
                    const barcodeLabel = formatBarcodeWithSampleType(detail);
                    
                    return `<div style="display: flex; align-items: center; margin: 2px 0; white-space: nowrap;" title="${detail.isLisPresent ? 'LIS data available' : 'LIS data not available'}">${icon}${barcodeLabel}</div>`;
                }).join('');
            } else {
                barcodeHtml = (booking.acceptedbarcode || []).join(" ") || "";
            }

            // Attachment column HTML
            // Assuming booking object now includes attachments from customization model
            const attachmentCount = booking.attachments ? booking.attachments.length : 0;
            const attachmentHtml = `
                <td>
                    <div class="attachment-btn" data-booking-id="${booking.bookingId}" title="${attachmentCount > 0 ? 'Manage Attachments' : 'Upload Attachments'}">
                        <i class="fas fa-paperclip"></i>
                        ${attachmentCount > 0 ? `<span class="attachment-count">${attachmentCount}</span>` : ''}
                    </div>
                </td>
            `;

            // HTML for row - ✅ REMOVED onclick from three dots icon
            if (booking.isreportready) {
                row.innerHTML = `
                <td class="reg-no">${booking.bookingId}</td>
                <td>${new Date(booking.date).toLocaleDateString()}<br>${booking.time}</td>
                <td>${booking.patientName}</td>
                <td>${islayerone ? (booking.doctorName || "") : (booking.createdbyuser || "")}</td>
                <td style="white-space: normal;">${barcodeHtml}</td>
                <td><button class="status-btn" style="background-color: ${statusStyles.badgeBackground}; color: ${statusStyles.badgeColor};">${booking.status}</button></td>
                ${attachmentHtml}
                <td class="actions">
                    <div class="enter-result">
                        <a data-page="reportFormat" class="edit-report"><i class="fa-solid fa-pen-to-square"></i> View report</a>
                    </div>
                    <i class="fas fa-ellipsis-h more-options"></i>
                    <div class="allcases-dropdown-menu" style="display: none;">
                        <a data-page="labreport" class="download-report" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                        <a data-page="ModifyCase" class="action-btn modify-case" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                        <a class="action-btn hold-btn" target="_blank"><i class="fa-solid fa-hands-holding"></i> Hold</a> 
                        <a class="action-btn clinical-btn" target="_blank"><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>                               
                    </div>
                </td>`;
            } else {
                row.innerHTML = `
                <td class="reg-no">${booking.bookingId}</td>
                <td>${new Date(booking.date).toLocaleDateString()}<br>${booking.time}</td>
                <td>${booking.patientName}</td>
                <td>${islayerone ? (booking.doctorName || "") : (booking.createdbyuser || "")}</td>
                <td style="white-space: normal;">${barcodeHtml}</td>
                <td><button class="status-btn" style="background-color: ${statusStyles.badgeBackground}; color: ${statusStyles.badgeColor};">${booking.status}</button></td>
                ${attachmentHtml}
                <td class="actions">
                    <div class="enter-result">
                        <a data-page="labreport" class="view-bill"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                    </div>
                    <i class="fas fa-ellipsis-h more-options"></i>
                    <div class="allcases-dropdown-menu" style="display: none;">
                        <a class="action-btn modify-case" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                        <a class="action-btn hold-btn" target="_blank"><i class="fa-solid fa-hands-holding"></i> Hold</a>
                        <a class="action-btn clinical-btn" target="_blank"><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>
                        <a class="action-btn cancel-btn" target="_blank"><i class="fa-solid fa-rectangle-xmark"></i> Cancel</a>
                    </div>
                </td>`;
            }

            tableBody.appendChild(row);
        });
    }

    // Event delegation for table actions
    const tableBody = document.getElementById("tbody");
    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            e.preventDefault();
            const target = e.target.closest("a, .more-options");
            if (!target) return;

            // ✅ NEW: Handle three dots dropdown toggle
            if (target.classList.contains("more-options")) {
                const dropdown = target.nextElementSibling;
                if (dropdown && dropdown.classList.contains("allcases-dropdown-menu")) {
                    // Close all other dropdowns first
                    document.querySelectorAll(".allcases-dropdown-menu").forEach(dd => {
                        if (dd !== dropdown) dd.style.display = "none";
                    });
                    // Toggle current dropdown
                    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
                }
                return;
            }

            const row = target.closest("tr");
            const bookingId = row.getAttribute("data-booking-id");
            const createdBy = row.getAttribute("data-created-by");

            if (target.classList.contains("view-bill")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.open(`${BASE_URL}/admin/admin.html?page=labreport`, "_blank");
            }
            else if (target.classList.contains("edit-report")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                const url = `${BASE_URL}/admin/admin.html?page=${user.role === "staff" ? user.tenantId.adminDetails.userId.pdfFormat : user.pdfFormat}&value1=${booking.bookingId}`;
                window.location.href = url;
            }
            else if (target.classList.contains("download-report")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.location.href = `${BASE_URL}/admin/admin.html?page=labreport`;
            }
            else if (target.classList.contains("modify-case")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.location.href = `${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`;
            }
            else if (target.classList.contains("hold-btn")) {
                const confirmation = window.confirm("Are you want to update the status as 'Hold'");
                if (!confirmation) return;

                await updatebookingStatus(bookingId, "Hold");

                if (user.tenantId.modelType !== "1layer") {
                    showPopup(bookingId, createdBy);
                    await fetchMessages(bookingId);
                }

                await fetchBookings(currentPage);
            }
            else if (target.classList.contains("clinical-btn")) {
                const confirmation = window.confirm("Are you want to update the status as 'clinical'");
                if (!confirmation) return;

                await updatebookingStatus(bookingId, "clinical");

                if (user.tenantId.modelType !== "1layer") {
                    showPopup(bookingId, createdBy);
                    await fetchMessages(bookingId);
                }

                await fetchBookings(currentPage);
            }
            else if (target.classList.contains("cancel-btn")) {
                const confirmation = window.confirm("Are you sure you want to cancel this booking?");
                if (!confirmation) return;

                const loadingMsg = document.createElement('div');
                loadingMsg.textContent = 'Processing cancellation...';
                loadingMsg.style.cssText = 'position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:10px 20px;border-radius:5px;z-index:9999';
                document.body.appendChild(loadingMsg);
                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/bookings/cancel`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ bookingId })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: 'Server error' }));
                        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                    }

                    const res = await response.json();

                    if (res.success || response.ok) {
                        if (user.tenantId.modelType !== "1layer") {
                            showPopup(bookingId, createdBy);
                            await fetchMessages(bookingId);
                        }
                        alert(res.message || 'Booking cancelled successfully');
                        await fetchBookings(currentPage);
                    } else {
                        throw new Error(res.message || 'Failed to cancel booking');
                    }

                } catch (error) {
                    console.error('Cancellation error:', error.message);

                    let errorMessage = 'Failed to cancel booking. ';

                    if (error.message.includes('Network')) {
                        errorMessage += 'Please check your internet connection.';
                    } else if (error.message.includes('timeout')) {
                        errorMessage += 'Request timed out. Please try again.';
                    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                        errorMessage += 'Session expired. Please login again.';
                    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                        errorMessage += 'You do not have permission to cancel this booking.';
                    } else if (error.message.includes('404')) {
                        errorMessage += 'Booking not found.';
                    } else {
                        errorMessage += error.message || 'Please try again later.';
                    }

                    alert(errorMessage);
                } finally {
                    if (loadingMsg && loadingMsg.parentNode) {
                        loadingMsg.parentNode.removeChild(loadingMsg);
                    }
                }
            }
        });

        // ✅ NEW: Close dropdowns when clicking outside
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".more-options") && !event.target.closest(".allcases-dropdown-menu")) {
                document.querySelectorAll(".allcases-dropdown-menu").forEach((dropdown) => {
                    dropdown.style.display = "none";
                });
            }
        });
    }

    function showPopup(bookingId, createdBy) {
        if (messagesDiv) messagesDiv.innerHTML = '';

        const messageInput = document.getElementById("messageInput");
        if (messageInput) {
            messageInput.setAttribute("data-created-by", createdBy);
            messageInput.setAttribute("data-booking-id", bookingId);
        }

        if (popup) popup.style.display = "block";
        if (overlay) overlay.style.display = "block";
    }

    async function updatebookingStatus(bookingid, status) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/statusBookingcontroller`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingid, status }),
            });
            if (!response.ok) {
                console.log("status not updated");
            }
        } catch (error) {
            console.log(error)
        }
    }

    async function rejectBooking(bookingId) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/reject-booking`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ bookingId })
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                closePopup();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error("Error updating booking status:", error);
            alert("An error occurred. Please try again.");
        }
    }

    async function fetchMessages(bookingId) {
        if (messagesDiv) messagesDiv.innerHTML = '';
        let lastMessageId = null;
        let isFetching = false;

        if (intervalId) {
            clearInterval(intervalId);
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ bookingId }),
            });

            if (response.ok) {
                const responseData = await response.json();
                console.log("response data:", responseData);
                displayMessages(responseData.conversation.messages);
                if (responseData.conversation.messages.length > 0) {
                    lastMessageId = responseData.conversation.messages[responseData.conversation.messages.length - 1]._id;
                }
            } else {
                console.log("Failed to fetch conversation");
                return;
            }

            intervalId = setInterval(async function () {
                if (isFetching) return;

                isFetching = true;
                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ bookingId }),
                    });

                    if (!response.ok) {
                        console.log("Failed to fetch conversation");
                        return;
                    }

                    const responseData = await response.json();
                    const newMessages = responseData.conversation.messages.filter(message =>
                        !lastMessageId || message._id > lastMessageId
                    );

                    if (newMessages.length > 0) {
                        displayMessages(newMessages);
                        lastMessageId = newMessages[newMessages.length - 1]._id;
                    }
                } catch (error) {
                    console.error("Error fetching conversation:", error);
                } finally {
                    isFetching = false;
                }
            }, 2000);

        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    function displayMessages(messages) {
        if (!messagesDiv) return;

        messages.forEach(message => {
            const div = document.createElement('div');
            const textTag = document.createElement('p');

            if (message.senderId === userId) {
                div.className = 'receiverdivs';
                textTag.className = 'receivertext';
            } else {
                div.className = 'senderdivs';
                textTag.className = 'sendertext';
            }

            textTag.textContent = message.message;
            div.appendChild(textTag);
            messagesDiv.appendChild(div);
        });

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function closePopup() {
        if (intervalId) {
            clearInterval(intervalId);
        }
        if (popup) popup.style.display = "none";
        if (overlay) overlay.style.display = "none";
    }

    async function getBookingDetails(bookingId) {
        if (!bookingId) return null;

        const cachedBooking = bookingCache.get(bookingId);
        if (cachedBooking && cachedBooking.__fullBooking) {
            return cachedBooking;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getbooking`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ value1: bookingId }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch booking details");
            }

            const booking = await response.json();
            if (booking?.bookingId) {
                booking.__fullBooking = true;
                bookingCache.set(booking.bookingId, booking);
            }
            return booking;
        } catch (error) {
            console.error("Error fetching booking details:", error);
            alert("Case details load nahi ho paaye. Please try again.");
            return null;
        }
    }

    function saveBookingToLocalStorage(booking, row) {
        const regId = row.cells[0].innerText;
        localStorage.setItem("booking", JSON.stringify(booking));
        localStorage.setItem("regId", JSON.stringify(regId));
    }

    // --- Attachment Modal Functions ---
    async function showAttachmentModal(bookingId) {
        currentBookingIdForAttachments = bookingId;
        targetBookingIdSpan.textContent = bookingId;
        attachmentListContainer.innerHTML = ''; 

        showLoader();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-customization-by-booking/${encodeURIComponent(bookingId)}`);
            const data = await response.json();

            if (response.ok && data.attachments && data.attachments.length > 0) {
                renderAttachmentList(data.attachments);
            } else {
                attachmentListContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No attachments yet.</p>';
            }
        } catch (error) {
            console.error('Error fetching attachments:', error);
            attachmentListContainer.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 15px;">Error loading attachments.</p>';
        } finally {
            hideLoader();
        }

        attachmentModal.style.display = 'block';
        overlay.style.display = 'block';
    }

    function renderAttachmentList(attachments) {
        attachmentListContainer.innerHTML = '';
        attachments.sort((a, b) => (a.order || 0) - (b.order || 0));

        attachments.forEach(attach => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'attach-item';
            itemDiv.setAttribute('data-attachment-id', attach.publicId);

            const fileIcon = attach.fileType === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#e74c3c"></i>' : '<i class="fas fa-image" style="color:#3498db"></i>';

            itemDiv.innerHTML = `
                <div class="attach-info">
                    ${fileIcon}
                    <span class="attach-name" title="${attach.fileName}">${attach.fileName}</span>
                </div>
                <div style="display:flex; gap: 12px; align-items:center;">
                    <i class="fas fa-trash remove-attach" style="cursor: pointer; color:#d9534f;" title="Remove Attachment"></i>
                </div>
            `;
            attachmentListContainer.appendChild(itemDiv);
        });

        attachmentListContainer.querySelectorAll('.remove-attach').forEach(btn => btn.addEventListener('click', deleteAttachment));
    }

    async function deleteAttachment(event) {
        const itemDiv = event.target.closest('.attach-item');
        const publicId = itemDiv.getAttribute('data-attachment-id');
        
        if (!confirm('Are you sure you want to delete this attachment?')) return;

        showLoader();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/delete-attachment`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: currentBookingIdForAttachments, publicId })
            });

            if (response.ok) {
                await showAttachmentModal(currentBookingIdForAttachments);
                await fetchBookings(currentPage);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(errorData.message || 'Attachment delete nahi ho paya.');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Attachment delete karte waqt error aaya.');
        } finally {
            hideLoader();
        }
    }

    async function saveAttachments() {
        if (!currentBookingIdForAttachments) return;
        const files = attachmentFileInput.files;
        if (files.length === 0) return alert('Please select files to upload.');

        const unsupportedFiles = Array.from(files).filter((file) => !isSupportedAttachmentFile(file));
        if (unsupportedFiles.length > 0) {
            const names = unsupportedFiles.map((file) => file.name).join(", ");
            alert(`Unsupported file selected: ${names}. Please use JPG, PNG, WEBP, HEIC, HEIF or PDF files.`);
            return;
        }

        const formData = new FormData();
        formData.append('bookingId', currentBookingIdForAttachments);
        for (let i = 0; i < files.length; i++) formData.append('attachments', files[i]);

        showLoader();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/upload-attachments`, { method: 'POST', body: formData });
            if (response.ok) {
                attachmentFileInput.value = '';
                await showAttachmentModal(currentBookingIdForAttachments);
                await fetchBookings(currentPage);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(errorData.message || 'Attachment upload nahi ho paya.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Attachment upload karte waqt error aaya.');
        } finally { hideLoader(); }
    }

    function setupEventListeners() {
        const nextBtn = document.getElementById("next");
        const prevBtn = document.getElementById("previous");
        const searchBtn = document.getElementById("search-btn");
        const clearBtn = document.getElementById("clearfield");
        const rejectBtn = document.getElementById('rejectBtn');

        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                if (currentPage < totalPages) fetchBookings(currentPage + 1);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                if (currentPage > 1) fetchBookings(currentPage - 1);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener("click", () => {
                fetchBookings(1);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                const regNoEl = document.getElementById("reg-no");
                const patientNameEl = document.getElementById("patient-name");
                const genderEl = document.getElementById("gender");
                const patientPhoneEl = document.getElementById("patient-phone");
                const barcodeEl = document.getElementById("barcode");
                const labNameEl = document.getElementById("lab-name");
                const statusEl = document.getElementById("status");
                const franchiseeEl = document.getElementById("franchisee");

                if (regNoEl) regNoEl.value = "";
                if (patientNameEl) patientNameEl.value = "";
                if (genderEl) genderEl.value = "";
                if (patientPhoneEl) patientPhoneEl.value = "";
                if (barcodeEl) barcodeEl.value = "";
                if (labNameEl) labNameEl.value = "";
                if (statusEl) statusEl.value = "";
                if (franchiseeEl) franchiseeEl.value = "";

                fetchBookings(1);
            });
        }

        if (sendMessageBtn) {
            sendMessageBtn.addEventListener("click", async function () {
                const Input = document.getElementById("messageInput");
                if (!Input) return;

                const messageInput = Input.value.trim();
                const receiver = Input.getAttribute('data-created-by');
                const bookingId = Input.getAttribute('data-booking-id');

                if (!messageInput) {
                    return alert('message field is empty');
                }

                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/saveConversation`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            senderId: userId,
                            receiverId: receiver,
                            bookingId,
                            message: messageInput
                        }),
                    });

                    if (!response.ok) {
                        throw new Error("Failed to send data to API");
                    }

                    const responseData = await response.json();
                    alert('message sent successfully');
                    displayMessages([{
                        senderId: userId,
                        message: messageInput
                    }]);
                    Input.value = "";
                } catch (error) {
                    console.error("Error sending message:", error);
                }
            });
        }

        if (closePopupBtn) {
            closePopupBtn.addEventListener("click", closePopup);
        }

        if (rejectBtn) {
            rejectBtn.addEventListener('click', async function () {
                const messageInput = document.getElementById("messageInput");
                if (!messageInput) return;

                const bookingId = messageInput.getAttribute('data-booking-id');
                if (bookingId) {
                    await rejectBooking(bookingId);
                }
            });
        }

        // --- Attachment Modal Event Listeners ---
        // Delegated event listener for attachment button clicks
        tableBody.addEventListener('click', async function(e) {
            const target = e.target.closest('.attachment-btn');
            if (target) {
                const bookingId = target.getAttribute('data-booking-id');
                await showAttachmentModal(bookingId);
            }
        });

        if (cancelAttachModalBtn) {
            cancelAttachModalBtn.addEventListener('click', () => {
                attachmentModal.style.display = 'none';
                overlay.style.display = 'none';
                attachmentFileInput.value = ''; // Clear file input
            });
        }

        if (saveAttachmentsBtn) saveAttachmentsBtn.addEventListener('click', saveAttachments);
    }

    setupEventListeners();
    await fetchBookings(1);
}

async function initialization() {
    const loader = document.querySelector(".loader");
    loader.style.display = "flex";
    try {
        await allcases();
    } catch (error) {
        console.log(error);
    } finally {
        loader.style.display = "none";
    }
}

initialization();

// ✅ REMOVED: toggleDropdown function - no longer needed
// Dropdown functionality now handled via event delegation

function clearFields() {
    const regNoEl = document.getElementById("reg-no");
    const patientNameEl = document.getElementById("patient-name");
    const genderEl = document.getElementById("gender");
    const patientPhoneEl = document.getElementById("patient-phone");
    const doctorNameEl = document.getElementById("doctor-name");
    const labNameEl = document.getElementById("lab-name");
    const statusEl = document.getElementById("status");

    if (regNoEl) regNoEl.value = "";
    if (patientNameEl) patientNameEl.value = "";
    if (genderEl) genderEl.value = "";
    if (patientPhoneEl) patientPhoneEl.value = "";
    if (doctorNameEl) doctorNameEl.value = "";
    if (labNameEl) labNameEl.value = "";
    if (statusEl) statusEl.value = "";

    const tbody = document.getElementById("tbody");
    if (tbody) {
        const rows = tbody.querySelectorAll("tr");
        rows.forEach((row) => (row.style.display = ""));
    }
}
