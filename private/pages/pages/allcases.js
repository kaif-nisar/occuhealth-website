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

    function isPdfAttachment(attachment = {}) {
        const fileType = String(attachment.fileType || "").toLowerCase();
        const mimeType = String(attachment.mimeType || "").toLowerCase();
        const fileExtension = String(attachment.fileExtension || "").toLowerCase();
        const url = String(attachment.url || "").toLowerCase();

        return (
            fileType === "pdf" ||
            mimeType === "application/pdf" ||
            fileExtension === ".pdf" ||
            url.includes(".pdf")
        );
    }

    function getOpenAttachmentUrl(attachment = {}) {
        const url = String(attachment.url || "").trim();
        const publicId = String(attachment.publicId || "").trim();
        const fileExtension = String(attachment.fileExtension || ".pdf").replace(/^\./, "") || "pdf";

        if (isPdfAttachment(attachment)) {
            if (url.includes("/image/upload/")) {
                return url.replace("/image/upload/", "/raw/upload/");
            }

            if (publicId && url) {
                return url;
            }
        }

        return url;
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

    function isAttachmentImageFile(file) {
        if (!file) return false;

        const mimeType = String(file.type || file.mimetype || "").toLowerCase();
        const extension = getFileExtension(file.name || file.originalname || "");

        return mimeType.startsWith("image/") || (allowedAttachmentExtensions.has(extension) && extension !== ".pdf");
    }

    async function prepareAttachmentFileForUpload(file) {
        if (!file || !isAttachmentImageFile(file)) {
            return file;
        }

        // Leave GIFs untouched so we don't accidentally strip animation.
        const mimeType = String(file.type || "").toLowerCase();
        if (mimeType === "image/gif") {
            return file;
        }

        if (typeof window === "undefined" || typeof document === "undefined" || typeof createImageBitmap !== "function") {
            return file;
        }

        try {
            const bitmap = await createImageBitmap(file);
            const maxEdge = 1600;
            const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) {
                return file;
            }

            context.drawImage(bitmap, 0, 0, width, height);
            if (typeof bitmap.close === "function") {
                bitmap.close();
            }

            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, "image/jpeg", 0.82);
            });

            if (!blob) {
                return file;
            }

            const baseName = String(file.name || "attachment").replace(/\.[^.]+$/, "") || "attachment";
            return new File([blob], `${baseName}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
            });
        } catch (error) {
            console.warn("Attachment image normalization skipped:", error);
            return file;
        }
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

        if (normalizedStatus === "partially completed" || normalizedStatus === "partial completed" || normalizedStatus === "partial") {
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

    function getStatusFilterQueryValue(status) {
        const normalizedStatus = (status || "").trim().toLowerCase();

        if (!normalizedStatus) {
            return "";
        }

        if (normalizedStatus === "completed") {
            return "completed";
        }

        if (normalizedStatus === "partially completed" || normalizedStatus === "partial completed" || normalizedStatus === "partial" || normalizedStatus === "partially ready") {
            return "Partially Completed,partial completed,partial";
        }

        if (normalizedStatus === "hold") {
            return "Hold,hold";
        }

        if (normalizedStatus === "on hold") {
            return "On Hold,on hold";
        }

        if (normalizedStatus === "clinical" || normalizedStatus === "clinical stated") {
            return "clinical,clinical stated";
        }

        return status;
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
            status: getStatusFilterQueryValue(document.getElementById("status").value.trim()),
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
            const normalizedBookingStatus = (booking.status || "").trim().toLowerCase();
            if (normalizedBookingStatus === "cancelled" || normalizedBookingStatus === "canceled") {
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
                    <div class="actions-wrapper">
                        <a data-page="reportFormat" class="btn-action btn-primary edit-report"><i class="fa-solid fa-file-lines"></i> View report</a>
                        <a data-page="ModifyCase" class="btn-action btn-outline modify-case-direct"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
                    </div>
                    <i class="fas fa-ellipsis-h more-options"></i>
                    <div class="allcases-dropdown-menu" style="display: none;">
                        <a data-page="labreport" class="download-report"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                        <a data-page="ModifyCase" class="action-btn modify-case" ><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                        <a class="action-btn generate-bill-btn"><i class="fa-solid fa-file-invoice-dollar"></i> Generate Bill</a>
                        <a class="action-btn hold-btn"><i class="fa-solid fa-hands-holding"></i> Hold</a> 
                        <a class="action-btn clinical-btn"><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>                               
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
                    <div class="actions-wrapper">
                        <a data-page="labreport" class="btn-action btn-primary view-bill"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                        <a data-page="ModifyCase" class="btn-action btn-outline modify-case-direct"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
                    </div>
                    <i class="fas fa-ellipsis-h more-options"></i>
                    <div class="allcases-dropdown-menu" style="display: none;">
                        <a class="action-btn modify-case" ><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                        <a class="action-btn generate-bill-btn"><i class="fa-solid fa-file-invoice-dollar"></i> Generate Bill</a>
                        <a class="action-btn hold-btn"><i class="fa-solid fa-hands-holding"></i> Hold</a>
                        <a class="action-btn clinical-btn" ><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>
                        <a class="action-btn cancel-btn danger-item"><i class="fa-solid fa-rectangle-xmark"></i> Cancel</a>
                    </div>
                </td>`;
            }

            tableBody.appendChild(row);
        });
    }

    // ================================================================
    //  Invoice generation helpers (mirrors generatebill.js logic)
    // ================================================================
    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/\x22/g, "\x26quot;")
            .replace(/'/g, "&#39;");
    }

    function getUniqueTestNames(booking) {
        if (!booking || !Array.isArray(booking.tableData)) return [];
        const names = [];
        booking.tableData.forEach((entry) => {
            const raw = String((entry && entry.testName) || "");
            raw.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
                if (names.indexOf(t) === -1) names.push(t);
            });
        });
        return names;
    }

    function getBarcodes(booking) {
        if (!booking || !Array.isArray(booking.tableData)) return [];
        return booking.tableData
            .map((entry) => String((entry && entry.barcodeId) || "").trim())
            .filter(Boolean);
    }

    function formatInvoiceDate(value) {
        if (!value) return "";
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        }
        return String(value).split("T")[0] || "";
    }

    function formatInvoiceTime(value) {
        if (!value) return "";
        try {
            const parsed = new Date("1970-01-01T" + value);
            if (!isNaN(parsed.getTime())) {
                return parsed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            }
        } catch (_) { /* ignore */ }
        return "";
    }

    function getTenantLogo() {
        try {
            return String((user && user.tenantId && user.tenantId.logo) || "");
        } catch (_) {
            return "";
        }
    }

    /**
     * Build a complete invoice HTML string from a booking object.
     * This mirrors the hidden .pdf-div template used on the official
     * generatebill page, so the backend can render a proper PDF.
     */
    function buildInvoiceHtml(booking) {
        if (!booking) return "";

        const logoUrl = getTenantLogo();
        const logoHtml = logoUrl
            ? `<div class="image-div"><img id="bill-logo" src="${escapeHtml(logoUrl)}" style="width:250px;height:125px;"></div>`
            : "";

        const uniqueTestNames = getUniqueTestNames(booking);
        const testRows = uniqueTestNames.map((name, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(name)}</td></tr>`
        ).join("") || '<tr><td colspan="2">-</td></tr>';

        const bookingDate = formatInvoiceDate(booking.date || booking.createdAt);
        const bookingTime = formatInvoiceTime(booking.time || booking.createdAt);
        const patientName = escapeHtml(booking.patientName || "");
        const bookingId = escapeHtml(booking.bookingId || "");
        const gender = escapeHtml([booking.year, booking.gender].filter(Boolean).join(" | ") || "");
        const total = booking.total != null ? booking.total : "";
        const invoiceDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

        return `
        <div class="container23">
            <div class="header upper-header">
                <div>
                    <h1>INVOICE</h1>
                    <p id="invoiceid">#Bill${escapeHtml(booking._id || booking.bookingId || "")}</p>
                    <p id="invoice-date-time">Invoice Date : ${invoiceDate}</p>
                </div>
                ${logoHtml}
            </div>
            <div class="patient-details">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <p><strong>Patient Details :</strong></p>
                        <p class="blue">${patientName}</p>
                        <p class="invoice-gender">${gender}</p>
                    </div>
                    <div style="text-align: right;">
                        <p><strong id="invoice-bookingid">Booking Id : ${bookingId}</strong></p>
                        <p id="booking-date-time">Booking Time : ${bookingDate} ${bookingTime}</p>
                    </div>
                </div>
            </div>
            <div class="table-container" id="invoice-table">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Test Name</th>
                        </tr>
                    </thead>
                    <tbody>${testRows}</tbody>
                </table>
            </div>
            <div class="container8989">
                <div class="header">
                    <h1>Grand Total</h1>
                    <span>Rs ${total}</span>
                </div>
                <p class="note">
                    ** No refund is available after booking.
                </p>
                <div class="stamp">
                    <span>This Bill is Generated by www.occuhealth.in</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Generate and download an invoice for a booking using the existing
     * /invoicepdfgenerator API with the full HTML/CSS payload.
     */
    async function generateInvoiceForBooking(booking) {
        if (!booking || !booking.bookingId) {
            alert("Booking data is missing.");
            return false;
        }

        const invoiceHtml = buildInvoiceHtml(booking);
        const invoicecss = `
            * { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-sizing: border-box; }
            .container23 { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
            .header, .patient-details, .table-container { width: 100%; margin-bottom: 20px; }
            .header { position: relative; display: flex; justify-content: space-between; align-items: center; }
            .upper-header * { color: whitesmoke; }
            .upper-header { background-color: #3f4d67; padding: 16px; }
            .header h1 { font-size: 24px; font-weight: bold; margin: 0; }
            .header p { margin: 5px 0; }
            .header img { width: 250px; height: 125px; }
            .image-div { position: absolute; right: 0%; top: 50%; transform: translateY(-50%); }
            .patient-details { border-top: 1px solid #ccc; padding-top: 20px; }
            .patient-details p { margin: 5px 0; }
            .patient-details .blue { color: #1a73e8; }
            .table-container { overflow: auto; }
            .table-container table { width: 100%; border-collapse: collapse; }
            .table-container th, .table-container td { border: 1px solid #ccc; padding: 10px; text-align: center; }
            .table-container th { background-color: #f9f9f9; }
            .container8989 { width: 100%; background-color: white; border-radius: 8px; max-width: 100%; }
            .container8989 .header { width: calc(100% - 32px); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; border-top: 1px solid #e5e7eb; padding: 16px; margin-bottom: 16px; border-radius: 8px; }
            .container8989 .header h1 { font-size: 1.25rem; font-weight: bold; margin: 0; }
            .container8989 .header span { font-size: 1.25rem; font-weight: bold; }
            .note { width: 100%; text-align: center; font-size: 0.875rem; margin-bottom: 16px; }
            .stamp { display: flex; justify-content: flex-start; }
            .stamp span { color: black; opacity: 0.7; font-size: 0.75rem; }
        `;
        const billnumber = "#Bill" + (booking._id || booking.bookingId || "");
        const generatedBy = (typeof userId !== "undefined" ? userId : null) || null;

        const payload = {
            invoiceHtml: invoiceHtml,
            invoicecss: invoicecss,
            billnumber: billnumber,
            bookingId: booking.bookingId,
            billingPrice: Number(booking.total || 0),
            generatedBy: generatedBy
        };

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/invoicepdfgenerator`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const pdfBlob = await response.blob();
            if (!pdfBlob || pdfBlob.size === 0) throw new Error("Empty PDF received");

            const pdfUrl = URL.createObjectURL(pdfBlob);
            const anchor = document.createElement("a");
            anchor.href = pdfUrl;
            anchor.download = `${booking.patientName || "invoice"}-invoice.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);

            // Mark as generated
            try {
                await fetch(`${BASE_URL}/api/v1/user/updategeneratedbillvariable/${encodeURIComponent(booking.bookingId)}`, {
                    credentials: "include"
                });
            } catch (_) { /* non-blocking */ }

            return true;
        } catch (error) {
            console.error("Invoice generation failed:", error);
            alert("Failed to generate invoice. Please try again.");
            return false;
        }
    }

    // Event delegation for table actions
    const tableBody = document.getElementById("tbody");
    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            e.preventDefault();
            const target = e.target.closest("a, .more-options");
            if (!target) return;

            // ✅ NEW: Handle three dots dropdown toggle
            // The container uses overflow-x: auto which clips absolutely-
            // positioned children vertically. To render cleanly above the
            // table we re-host the open dropdown in document.body with a
            // fixed position derived from the trigger's bounding rect.
            if (target.classList.contains("more-options")) {
                const row = target.closest("tr");
                const dropdown = target.nextElementSibling;
                if (dropdown && dropdown.classList.contains("allcases-dropdown-menu")) {
                    // Close all other dropdowns first (and remove any body popover)
                    document.querySelectorAll(".allcases-dropdown-menu").forEach(dd => {
                        dd.style.display = "none";
                    });
                    const existingPopover = document.getElementById("allcases-dropdown-popover");
                    if (existingPopover) existingPopover.remove();

                    // If the dropdown is currently hidden, open it via body popover
                    const wasHidden = dropdown.style.display === "none";
                    if (wasHidden) {
                        // Show the in-place dropdown just long enough to read its size
                        dropdown.style.display = "block";
                        const triggerRect = target.getBoundingClientRect();
                        const dropdownRect = dropdown.getBoundingClientRect();

                        // Build the body popover clone with fixed positioning
                        const clone = dropdown.cloneNode(true);
                        clone.id = "allcases-dropdown-popover";
                        clone.style.display = "block";
                        clone.style.position = "fixed";
                        clone.style.top = Math.round(triggerRect.bottom + 4) + "px";
                        clone.style.left = Math.round(triggerRect.right - dropdownRect.width) + "px";
                        clone.style.zIndex = 9999;
                        clone.style.margin = "0";
                        // Store the booking id on the popover itself (the clone
                        // has no parent <tr> once moved to document.body).
                        const rowBookingId = row ? row.getAttribute("data-booking-id") : "";
                        if (rowBookingId) clone.dataset.bookingId = rowBookingId;
                        document.body.appendChild(clone);

                        // Hide the in-table placeholder (it is clipped by the
                        // container's overflow-x, so we render the real menu
                        // above everything on the body).
                        dropdown.style.display = "none";
                    }
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
            else if (target.classList.contains("modify-case-direct")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.location.href = `${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`;
            }
            else if (target.classList.contains("generate-bill-btn")) {
                // Close the dropdown once the action is picked
                const dropdown = target.closest(".allcases-dropdown-menu");
                if (dropdown) dropdown.style.display = "none";

                const booking = await getBookingDetails(bookingId);
                if (!booking) return;

                // Show inline buffering / spinner
                const originalHtml = target.innerHTML;
                target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                target.disabled = true;
                target.style.pointerEvents = "none";

                try {
                    const ok = await generateInvoiceForBooking(booking);
                    if (!ok) throw new Error("Invoice generation failed");
                } catch (error) {
                    console.error("Invoice generation failed:", error);
                    alert("Failed to generate invoice. Please try again.");
                } finally {
                    target.innerHTML = originalHtml;
                    target.disabled = false;
                    target.style.pointerEvents = "";
                    if (booking && booking.bookingId) await fetchBookings(currentPage);
                }
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
                const existingPopover = document.getElementById("allcases-dropdown-popover");
                if (existingPopover) existingPopover.remove();
            }
        });

        // ✅ NEW: Handle clicks on the body-level dropdown popover (cloned
        // from the in-table menu to avoid overflow clipping). The popover
        // lives outside #tbody, so the tableBody delegation above cannot
        // see it — we delegate on document instead.
        document.addEventListener("click", async function (e) {
            const popover = document.getElementById("allcases-dropdown-popover");
            if (!popover) return;
            const item = e.target.closest("a");
            if (!item || !popover.contains(item)) return;

            e.preventDefault();
            e.stopPropagation();

            // Remove the popover immediately
            popover.remove();

            const bookingId = popover.dataset.bookingId || null;
            if (!bookingId) return;

            if (item.classList.contains("generate-bill-btn")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;

                const originalHtml = item.innerHTML;
                item.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                item.disabled = true;
                item.style.pointerEvents = "none";

                try {
                    const ok = await generateInvoiceForBooking(booking);
                    if (!ok) throw new Error("Invoice generation failed");
                } catch (error) {
                    console.error("Invoice generation failed:", error);
                    alert("Failed to generate invoice. Please try again.");
                } finally {
                    item.innerHTML = originalHtml;
                    item.disabled = false;
                    item.style.pointerEvents = "";
                    if (booking && booking.bookingId) await fetchBookings(currentPage);
                }
                return;
            }

            // Re-dispatch other actions (modify, hold, clinical, cancel, etc.)
            // by simulating a click on the matching in-table element.
            const inTableItem = document.querySelector(`#tbody tr[data-booking-id="${CSS.escape(bookingId)}"] .allcases-dropdown-menu a.${item.className.split(" ").join(".")}`);
            if (inTableItem) {
                inTableItem.click();
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
            itemDiv.setAttribute('data-attachment-url', getOpenAttachmentUrl(attach));

            const fileIcon = attach.fileType === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#e74c3c"></i>' : '<i class="fas fa-image" style="color:#3498db"></i>';

            itemDiv.innerHTML = `
                <div class="attach-info">
                    ${fileIcon}
                    <span class="attach-name" title="${attach.fileName}">${attach.fileName}</span>
                </div>
                <div style="display:flex; gap: 12px; align-items:center;">
                    <i class="fas fa-eye open-attach" style="cursor: pointer; color:#2563eb;" title="Open Attachment"></i>
                    <i class="fas fa-trash remove-attach" style="cursor: pointer; color:#d9534f;" title="Remove Attachment"></i>
                </div>
            `;
            attachmentListContainer.appendChild(itemDiv);
        });

        attachmentListContainer.querySelectorAll('.open-attach').forEach(btn => btn.addEventListener('click', openAttachment));
        attachmentListContainer.querySelectorAll('.remove-attach').forEach(btn => btn.addEventListener('click', deleteAttachment));
    }

    function openAttachment(event) {
        const itemDiv = event.target.closest('.attach-item');
        if (!itemDiv) return;

        const attachmentUrl = itemDiv.getAttribute('data-attachment-url');
        if (!attachmentUrl) {
            alert('Attachment URL missing.');
            return;
        }

        window.open(attachmentUrl, '_blank', 'noopener,noreferrer');
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
        const files = Array.from(attachmentFileInput.files || []);
        if (files.length === 0) return alert('Please select files to upload.');

        const unsupportedFiles = Array.from(files).filter((file) => !isSupportedAttachmentFile(file));
        if (unsupportedFiles.length > 0) {
            const names = unsupportedFiles.map((file) => file.name).join(", ");
            alert(`Unsupported file selected: ${names}. Please use JPG, PNG, WEBP, HEIC, HEIF or PDF files.`);
            return;
        }

        showLoader();
        try {
            const failures = [];
            let successfulUploads = 0;

            for (const file of files) {
                const preparedFile = await prepareAttachmentFileForUpload(file);
                const formData = new FormData();
                formData.append('bookingId', currentBookingIdForAttachments);

                const uploadName = preparedFile?.name || file.name || 'attachment';
                formData.append('attachments', preparedFile, uploadName);

                const response = await fetch(`${BASE_URL}/api/v1/user/upload-attachments`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    successfulUploads += 1;
                    continue;
                }

                const errorData = await response.json().catch(() => ({}));
                failures.push(`${file.name || 'Attachment'}: ${errorData.message || 'Attachment upload nahi ho paya.'}`);
            }

            if (successfulUploads > 0) {
                attachmentFileInput.value = '';
                await showAttachmentModal(currentBookingIdForAttachments);
                await fetchBookings(currentPage);
            }

            if (failures.length > 0) {
                alert(`Kuch files upload nahi ho paayi:\n${failures.join("\n")}`);
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

        // --- Enter key triggers Search on all filter inputs & selects ---
        const filterInputs = document.querySelectorAll(
            '#reg-no, #patient-name, #franchisee, #gender, #patient-phone, #barcode, #lab-name, #status'
        );
        filterInputs.forEach(input => {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchBtn = document.getElementById('search-btn');
                    if (searchBtn) searchBtn.click();
                }
            });
        });
    }

    setupEventListeners();

    // --- Top Horizontal Scrollbar Sync ---
    function initTopScrollbarSync() {
        const container = document.querySelector(".container-allcases");
        const topScrollbar = document.getElementById("tableScrollbarTop");
        if (!container || !topScrollbar) return;

        const spacer = topScrollbar.querySelector(".scrollbar-spacer");
        let syncLock = false;

        function syncTopScrollbar() {
            if (!container || !topScrollbar) return;
            if (syncLock) return;

            syncLock = true;

            // Match spacer width to the real scrollable width
            if (spacer) {
                spacer.style.minWidth = container.scrollWidth + "px";
            }

            // Mirror the container scroll offset
            topScrollbar.scrollLeft = container.scrollLeft;

            // Hide the top scrollbar when there is nothing to scroll
            const hasOverflow = container.scrollWidth > container.clientWidth;
            topScrollbar.classList.toggle("has-no-overflow", !hasOverflow);

            syncLock = false;
        }

        function syncContainer() {
            if (syncLock) return;
            if (!container || !topScrollbar) return;

            container.scrollLeft = topScrollbar.scrollLeft;
        }

        // Sync when the table container scrolls
        container.addEventListener("scroll", syncTopScrollbar);

        // Sync the table container from the top scrollbar
        topScrollbar.addEventListener("scroll", syncContainer);

        // Re-sync on window resize
        window.addEventListener("resize", syncTopScrollbar);

        // Re-sync whenever rows are added/removed (booking data changes)
        const tbody = document.getElementById("tbody");
        if (tbody) {
            const observer = new MutationObserver(syncTopScrollbar);
            observer.observe(tbody, { childList: true, subtree: true });
        }

        // Initial sync
        syncTopScrollbar();
    }

    initTopScrollbarSync();

    await fetchBookings(1);

    // Close all dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.more-options') && !e.target.closest('.allcases-dropdown-menu')) {
            document.querySelectorAll('.allcases-dropdown-menu').forEach(dd => {
                dd.style.display = 'none';
            });
        }
    });
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
