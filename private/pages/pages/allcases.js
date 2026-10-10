function showLoader() {
    try {
        const loaders = document.querySelectorAll(".loader, #loader1, .loaderDiv1");
        loaders.forEach(l => { if (l) l.style.display = "flex"; });
    } catch (e) {
        console.warn("showLoader error:", e);
    }
}

function hideLoader() {
    try {
        const loaders = document.querySelectorAll(".loader, #loader1, .loaderDiv1");
        loaders.forEach(l => { if (l) l.style.display = "none"; });
    } catch (e) {
        console.warn("hideLoader error:", e);
    }
    try {
        if (window.parent && window.parent !== window && window.parent.document) {
            const parentLoaders = window.parent.document.querySelectorAll(".loader, #loader1, .loaderDiv1");
            parentLoaders.forEach(l => { if (l) l.style.display = "none"; });
        }
    } catch (e) {}
}

window.showLoader = showLoader;
window.hideLoader = hideLoader;

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
    let billModalBooking = null;
    let billModalSubmitting = false;

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

    function ensureAuditHelper() {
        if (window.ReportActionAudit && window.ReportActionAudit.__initialized) return;
        if (window.parent && window.parent.ReportActionAudit && window.parent.ReportActionAudit.__initialized) {
            window.ReportActionAudit = window.parent.ReportActionAudit;
            return;
        }
        var s = document.createElement('script');
        s.src = 'pages/pages/report_action_audit.js?v=' + Date.now();
        s.onerror = function() {
            var s2 = document.createElement('script');
            s2.src = 'report_action_audit.js?v=' + Date.now();
            document.head.appendChild(s2);
        };
        document.head.appendChild(s);
    }
    ensureAuditHelper();

    // Report print / download audit badge (shared component from the shell).
    // Safe for legacy bookings that have no printAudit object yet.
        function renderSignOffBadge(booking) {
        try {
            const auditHelper = window.ReportActionAudit || (window.parent && window.parent.ReportActionAudit);
            if (auditHelper && typeof auditHelper.renderSignOffCell === 'function') {
                return auditHelper.renderSignOffCell(booking);
            }
        } catch (error) {
            console.warn('Sign-off audit badge unavailable:', error);
        }
        const isSigned = Boolean(booking?.isSignedOff || booking?.signedBy);
        if (isSigned) {
            const user = booking?.signedBy || 'Signed';
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;"><i class="fas fa-file-signature"></i> ' + user + '</span>';
        }
        return '<span style="color:#64748b;font-size:11px;font-weight:600;"><i class="fas fa-clock"></i> Pending</span>';
    }

    function printAuditBadge(booking) {
        try {
            if (window.ReportPrintAudit && typeof window.ReportPrintAudit.badge === 'function') {
                return window.ReportPrintAudit.badge(booking);
            }
        } catch (error) {
            console.warn('Print audit badge unavailable:', error);
        }
        return '<span style="color:#64748b;font-weight:600;font-size:12px;">&mdash;</span>';
    }

    function showAppToast(message, type = "success") {
        const existing = document.querySelectorAll(".app-toast");
        existing.forEach(t => t.remove());
        const toast = document.createElement("div");
        toast.className = `app-toast ${type}`;
        const icon = type === "error" ? "fa-circle-exclamation" : (type === "info" ? "fa-circle-info" : "fa-circle-check");
        toast.innerHTML = `<i class="fas ${icon}" style="margin-right: 8px;"></i><span>${escapeHtml(message)}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-10px)";
            setTimeout(() => toast.remove(), 350);
        }, 3600);
    }

    // ============================================================
    // REPORT DOWNLOAD & MERGE FUNCTIONALITY (Matches all-reports.js)
    // ============================================================
    const DOWNLOAD_ELIGIBLE_STATUSES = ['completed', 'partially completed', 'partial completed', 'partial', 'partially ready'];
    const LETTERHEAD_STORAGE_KEY = 'allReportsLetterheadPreference';
    let isBulkDownloading = false;
    let cancelBulkDownload = false;

    // Premium Industry-Level Report Download Buffer
    const ReportDownloadBuffer = {
        overlay: null,
        titleEl: null,
        metaEl: null,
        bookingTag: null,
        bookingIdEl: null,
        patientTag: null,
        patientNameEl: null,
        statusTextEl: null,
        barEl: null,
        countTextEl: null,
        percentTextEl: null,
        cancelBtn: null,
        cancelHandler: null,
        autoHideTimeout: null,

        init() {
            this.overlay = document.getElementById("reportDownloadOverlay");
            if (!this.overlay) return;
            this.titleEl = document.getElementById("reportBufferTitle");
            this.metaEl = document.getElementById("reportBufferMeta");
            this.bookingTag = document.getElementById("reportBufferBookingTag");
            this.bookingIdEl = document.getElementById("reportBufferBookingId");
            this.patientTag = document.getElementById("reportBufferPatientTag");
            this.patientNameEl = document.getElementById("reportBufferPatientName");
            this.statusTextEl = document.getElementById("reportBufferStatusText");
            this.barEl = document.getElementById("reportBufferBar");
            this.countTextEl = document.getElementById("reportBufferCountText");
            this.percentTextEl = document.getElementById("reportBufferPercentText");
            this.cancelBtn = document.getElementById("reportBufferCancelBtn");

            if (this.cancelBtn) {
                this.cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    if (typeof this.cancelHandler === 'function') {
                        this.cancelHandler();
                    }
                };
            }
        },

        show({ title = 'Generating Clinical Report', bookingId = '', patientName = '', status = 'Fetching patient diagnostics...', percent = null, total = null, current = null, canCancel = false, onCancel = null } = {}) {
            if (this.autoHideTimeout) {
                clearTimeout(this.autoHideTimeout);
                this.autoHideTimeout = null;
            }
            if (!this.overlay) this.init();
            if (!this.overlay) return;

            this.cancelHandler = onCancel;
            if (this.titleEl) this.titleEl.textContent = title;

            let hasMeta = false;
            if (this.bookingTag && this.bookingIdEl) {
                if (bookingId) {
                    this.bookingIdEl.textContent = bookingId;
                    this.bookingTag.style.display = "inline-flex";
                    hasMeta = true;
                } else {
                    this.bookingTag.style.display = "none";
                }
            }
            if (this.patientTag && this.patientNameEl) {
                if (patientName) {
                    this.patientNameEl.textContent = patientName;
                    this.patientTag.style.display = "inline-flex";
                    hasMeta = true;
                } else {
                    this.patientTag.style.display = "none";
                }
            }
            if (this.metaEl) this.metaEl.style.display = hasMeta ? "inline-flex" : "none";

            this.update({ status, percent, total, current });

            if (this.cancelBtn) {
                this.cancelBtn.style.display = canCancel ? "inline-flex" : "none";
                this.cancelBtn.innerHTML = '<i class="fas fa-circle-stop"></i> Cancel Download';
                this.cancelBtn.disabled = false;
            }

            this.overlay.style.display = "flex";
            void this.overlay.offsetWidth;
            this.overlay.classList.add("is-visible");
        },

        update({ title, bookingId, patientName, status, percent = null, total = null, current = null } = {}) {
            if (!this.overlay) return;
            if (title && this.titleEl) this.titleEl.textContent = title;
            if (bookingId && this.bookingIdEl) this.bookingIdEl.textContent = bookingId;
            if (patientName && this.patientNameEl) this.patientNameEl.textContent = patientName;
            if (status && this.statusTextEl) this.statusTextEl.textContent = status;

            if (this.barEl) {
                if (typeof percent === 'number' && !isNaN(percent)) {
                    this.barEl.classList.remove('indeterminate');
                    this.barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
                    if (this.percentTextEl) this.percentTextEl.textContent = `${Math.round(percent)}%`;
                } else {
                    this.barEl.classList.add('indeterminate');
                    this.barEl.style.width = '45%';
                    if (this.percentTextEl) this.percentTextEl.textContent = '';
                }
            }

            if (this.countTextEl) {
                if (typeof current === 'number' && typeof total === 'number' && total > 0) {
                    this.countTextEl.textContent = `Processing ${current} of ${total}...`;
                } else {
                    this.countTextEl.textContent = 'Please wait...';
                }
            }
        },

        hide(delay = 300) {
            if (!this.overlay) return;
            if (this.autoHideTimeout) clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = setTimeout(() => {
                if (this.overlay) {
                    this.overlay.classList.remove("is-visible");
                    setTimeout(() => {
                        if (this.overlay && !this.overlay.classList.contains("is-visible")) {
                            this.overlay.style.display = "none";
                        }
                    }, 260);
                }
            }, delay);
        }
    };

    function isDownloadEligible(status) {
        const s = String(status || '').trim().toLowerCase();
        return DOWNLOAD_ELIGIBLE_STATUSES.includes(s);
    }

    function getLetterheadPreference() {
        try {
            const saved = localStorage.getItem(LETTERHEAD_STORAGE_KEY);
            if (saved === 'with' || saved === 'without') return saved;
        } catch (e) { }
        return 'without';
    }

    function setLetterheadPreference(value) {
        const safeValue = value === 'with' ? 'with' : 'without';
        try {
            localStorage.setItem(LETTERHEAD_STORAGE_KEY, safeValue);
        } catch (e) { }
        syncLetterheadUI(safeValue);
    }

    function syncLetterheadUI(value) {
        const seg = document.getElementById('allcases-letterhead-seg');
        if (!seg) return;
        seg.querySelectorAll('.seg-option').forEach(btn => {
            const active = btn.getAttribute('data-value') === value;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function getReportFilename(patientName, bookingId) {
        let cleanName = String(patientName || '')
            .normalize('NFKC')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '');

        if (!cleanName || cleanName === '-' || cleanName.toUpperCase() === 'N/A' || cleanName.toUpperCase() === 'UNDEFINED') {
            cleanName = bookingId ? `Report_${bookingId}` : 'Report';
        }
        return `${cleanName}.pdf`;
    }

    async function fetchReportData(value1) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ value1 })
            });
            if (!response.ok) throw new Error('Failed to fetch report data');
            return await response.json();
        } catch (error) {
            console.error('Error fetching report:', error);
            return null;
        }
    }

    async function autogeneratingpdf({ value1 = '', startDate = '', patientname, bookingId = '', skipLoader = true } = {}) {
        try {
            if (!skipLoader) showLoader();

            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    value1,
                    checkBox: startDate === 'with' ? false : true,
                    bookingId,
                    auditAction: 'DOWNLOAD'
                })
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = getReportFilename(patientname, bookingId);
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
            if (!skipLoader) hideLoader();
        }
    }

    // Single report download triggered by clicking Booking ID badge
    async function downloadSingleReport(badgeElement) {
        if (!badgeElement || badgeElement.classList.contains('is-loading')) return;

        const row = badgeElement.closest('tr');
        const bookingId = badgeElement.getAttribute('data-booking-id') || (row ? row.getAttribute('data-booking-id') : '') || badgeElement.textContent.trim();
        const rowStatus = badgeElement.getAttribute('data-status') || (row ? row.getAttribute('data-status') : '');

        // Defense-in-depth: check eligibility
        if (!isDownloadEligible(rowStatus)) {
            showAppToast('Download not available: Only Completed and Partially Completed reports can be downloaded.', 'error');
            return;
        }

        const patientName = badgeElement.getAttribute('data-patient-name') || (row ? row.getAttribute('data-patient-name') : '');
        const originalHTML = badgeElement.innerHTML;
        badgeElement.classList.add('is-loading');
        badgeElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Generating...</span>`;

        ReportDownloadBuffer.show({
            title: 'Generating Clinical Report',
            bookingId: bookingId,
            patientName: patientName,
            status: 'Fetching patient diagnostics & test data...',
            percent: 25
        });

        try {
            const patientDetails = await fetchReportData(bookingId);
            if (!patientDetails || !patientDetails._id) {
                throw new Error('No report data returned for this booking.');
            }

            const resolvedPatientName = patientDetails.patientName || patientDetails.PatientName || patientName || ('Report_' + bookingId);
            const letterPadOption = getLetterheadPreference();

            ReportDownloadBuffer.update({
                patientName: resolvedPatientName,
                status: 'Applying letterhead, digital signatures & generating PDF...',
                percent: 70
            });

            const success = await autogeneratingpdf({
                value1: patientDetails._id,
                bookingId: bookingId,
                startDate: letterPadOption,
                patientname: resolvedPatientName,
                skipLoader: true
            });

            if (!success) throw new Error('PDF generation failed on server.');

            ReportDownloadBuffer.update({
                status: 'Report ready! Saving to your downloads...',
                percent: 100
            });
            ReportDownloadBuffer.hide(500);

            showAppToast(`Report downloaded successfully for ${resolvedPatientName}!`, 'success');
        } catch (error) {
            console.error(`Error downloading report for booking ${bookingId}:`, error);
            ReportDownloadBuffer.hide(100);
            showAppToast(`Download failed for booking ${bookingId}. Please try again.`, 'error');
        } finally {
            badgeElement.classList.remove('is-loading');
            badgeElement.innerHTML = originalHTML;
        }
    }

    async function downloadReportForBooking(bookingId, patientName, skipLoader = true) {
        try {
            const patientDetails = await fetchReportData(bookingId);
            const letterPadOption = getLetterheadPreference();

            if (!patientDetails || !patientDetails._id) {
                console.error('Could not find report data for', bookingId);
                showAppToast(`Report data not found for booking ${bookingId}`, 'error');
                return false;
            }

            const resolvedPatientName = patientDetails.patientName || patientDetails.PatientName || patientName || ('Report_' + bookingId);

            return await autogeneratingpdf({
                value1: patientDetails._id,
                bookingId: bookingId,
                startDate: letterPadOption,
                patientname: resolvedPatientName,
                skipLoader: skipLoader
            });
        } catch (error) {
            console.error(`Error downloading report for booking ${bookingId}:`, error);
            return false;
        }
    }

    function setBulkDownloadBtnState(iconClass, labelText) {
        const downloadBtn = document.getElementById('downloadSelectedCases');
        if (!downloadBtn) return;
        const icon = downloadBtn.querySelector('i');
        const label = document.getElementById('downloadSelectedCasesLabel');
        if (icon) icon.className = iconClass;
        if (label) label.textContent = labelText;
    }

    async function downloadSelectedReports() {
        const downloadBtn = document.getElementById('downloadSelectedCases');
        if (!downloadBtn) return;

        // If currently downloading, toggle cancel
        if (isBulkDownloading) {
            cancelBulkDownload = true;
            setBulkDownloadBtnState('fas fa-spinner fa-spin', 'Stopping...');
            ReportDownloadBuffer.update({ status: 'Stopping download after current report...' });
            return;
        }

        const checkedBoxes = document.querySelectorAll('#tbody .case-checkbox:checked');
        if (!checkedBoxes.length) {
            showAppToast('Please select at least one booking to download.', 'error');
            return;
        }

        const itemsToDownload = Array.from(checkedBoxes).map(cb => {
            const row = cb.closest('tr');
            const badge = row ? row.querySelector('.booking-id-badge') : null;
            return {
                bookingId: cb.getAttribute('data-booking-id') || (badge ? badge.getAttribute('data-booking-id') : ''),
                patientName: badge ? badge.getAttribute('data-patient-name') : '',
                status: row ? row.getAttribute('data-status') : ''
            };
        }).filter(item => item.bookingId && isDownloadEligible(item.status));

        if (!itemsToDownload.length) {
            showAppToast('None of the selected bookings are eligible for download. Only Completed and Partially Completed reports can be downloaded.', 'error');
            return;
        }

        isBulkDownloading = true;
        cancelBulkDownload = false;
        downloadBtn.classList.add('is-downloading');
        setBulkDownloadBtnState('fas fa-stop', `Stop Download (0/${itemsToDownload.length})`);

        ReportDownloadBuffer.show({
            title: 'Downloading Selected Reports',
            total: itemsToDownload.length,
            current: 1,
            percent: 5,
            status: `Starting download of ${itemsToDownload.length} report(s)...`,
            canCancel: true,
            onCancel: () => {
                cancelBulkDownload = true;
                ReportDownloadBuffer.update({ status: 'Stopping download...' });
            }
        });

        try {
            for (let i = 0; i < itemsToDownload.length; i++) {
                if (cancelBulkDownload) {
                    showAppToast('Download stopped by user.', 'info');
                    break;
                }

                const item = itemsToDownload[i];
                const pct = Math.round(((i) / itemsToDownload.length) * 100);

                setBulkDownloadBtnState('fas fa-spinner fa-spin', `Downloading (${i + 1}/${itemsToDownload.length})… Click to Stop`);
                ReportDownloadBuffer.update({
                    bookingId: item.bookingId,
                    patientName: item.patientName,
                    current: i + 1,
                    total: itemsToDownload.length,
                    percent: Math.max(10, pct),
                    status: `Downloading (${i + 1}/${itemsToDownload.length}): ${item.patientName || item.bookingId}...`
                });

                await downloadReportForBooking(item.bookingId, item.patientName, true);
            }

            if (!cancelBulkDownload) {
                ReportDownloadBuffer.update({
                    percent: 100,
                    status: `All ${itemsToDownload.length} report(s) downloaded successfully!`
                });
                ReportDownloadBuffer.hide(600);
                showAppToast(`All ${itemsToDownload.length} report(s) downloaded successfully!`, 'success');
            } else {
                ReportDownloadBuffer.hide(300);
            }
        } finally {
            ReportDownloadBuffer.hide(300);
            isBulkDownloading = false;
            cancelBulkDownload = false;
            downloadBtn.classList.remove('is-downloading');
            setBulkDownloadBtnState('fas fa-download', 'Download Selected');
            updateCasesSelectionState();
        }
    }

    async function mergeSelectedReports() {
        const checkedBoxes = document.querySelectorAll('#tbody .case-checkbox:checked');
        const selectedItems = Array.from(checkedBoxes).map(cb => {
            const row = cb.closest('tr');
            const badge = row ? row.querySelector('.booking-id-badge') : null;
            return {
                bookingId: cb.getAttribute('data-booking-id') || (badge ? badge.getAttribute('data-booking-id') : ''),
                status: row ? row.getAttribute('data-status') : ''
            };
        }).filter(item => item.bookingId && isDownloadEligible(item.status));

        if (selectedItems.length < 2) {
            showAppToast('Please select at least two eligible bookings to merge.', 'error');
            return;
        }

        ReportDownloadBuffer.show({
            title: 'Merging Clinical Reports',
            total: selectedItems.length,
            current: 1,
            percent: 15,
            status: `Preparing to merge ${selectedItems.length} reports into unified PDF...`
        });

        try {
            const reportIds = [];
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                ReportDownloadBuffer.update({
                    current: i + 1,
                    total: selectedItems.length,
                    percent: Math.round(15 + (i / selectedItems.length) * 45),
                    status: `Fetching report ${i + 1} of ${selectedItems.length} (${item.bookingId})...`
                });
                const patientDetails = await fetchReportData(item.bookingId);
                if (patientDetails && patientDetails._id) {
                    reportIds.push(patientDetails._id);
                }
            }

            if (reportIds.length < 2) {
                throw new Error('Not enough valid reports available to merge.');
            }

            ReportDownloadBuffer.update({
                percent: 75,
                status: `Merging ${reportIds.length} reports into unified PDF...`
            });

            const letterPadOption = getLetterheadPreference();
            const response = await fetch(`${BASE_URL}/api/v1/user/merge-pdfs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    reportIds: reportIds,
                    checkBox: letterPadOption === 'with' ? false : true
                })
            });

            if (!response.ok) throw new Error('PDF merge failed on server');

            ReportDownloadBuffer.update({
                percent: 95,
                status: 'Assembling merged PDF file...'
            });

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `Merged_Reports_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 500);

            ReportDownloadBuffer.update({
                percent: 100,
                status: `Successfully merged ${reportIds.length} reports!`
            });
            ReportDownloadBuffer.hide(600);

            showAppToast(`Successfully merged ${reportIds.length} reports!`, 'success');
        } catch (error) {
            console.error('Error merging reports:', error);
            ReportDownloadBuffer.hide(200);
            showAppToast('Merge failed. Please try again.', 'error');
        }
    }

    function updateCasesSelectionState() {
        const checkedBoxes = document.querySelectorAll('#tbody .case-checkbox:checked');
        const allEnabledBoxes = document.querySelectorAll('#tbody .case-checkbox:not(:disabled)');
        const selectAllCheckbox = document.getElementById('selectAllCases');
        const selectedCount = checkedBoxes.length;

        // Update select all checkbox
        if (selectAllCheckbox) {
            if (allEnabledBoxes.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.disabled = true;
            } else {
                selectAllCheckbox.disabled = false;
                if (selectedCount === 0) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                } else if (selectedCount === allEnabledBoxes.length) {
                    selectAllCheckbox.checked = true;
                    selectAllCheckbox.indeterminate = false;
                } else {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = true;
                }
            }
        }

        // Update selection count badge
        const countBadge = document.getElementById('casesSelectedCount');
        const countNum = document.getElementById('casesSelectedNum');
        if (countBadge && countNum) {
            if (selectedCount > 0) {
                countBadge.style.display = 'inline-flex';
                countNum.textContent = selectedCount;
            } else {
                countBadge.style.display = 'none';
            }
        }

        // Update Download button label
        const downloadLabel = document.getElementById('downloadSelectedCasesLabel');
        if (downloadLabel && !isBulkDownloading) {
            downloadLabel.textContent = selectedCount > 0 ? `Download Selected (${selectedCount})` : 'Download Selected';
        }

        // Update Merge button visibility (visible when 2 or more selected)
        const mergeBtn = document.getElementById('mergeSelectedCases');
        const mergeLabel = document.getElementById('mergeSelectedCasesLabel');
        if (mergeBtn) {
            if (selectedCount >= 2) {
                mergeBtn.style.display = 'inline-flex';
                if (mergeLabel) mergeLabel.textContent = `Merge Reports (${selectedCount})`;
            } else {
                mergeBtn.style.display = 'none';
            }
        }
    }

    function formatDateInputValue(value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) return "";
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    async function fetchBookings(page = 1) {
        currentPage = page;

        // Gather search filters
        const filters = {
            regNo: document.getElementById("reg-no").value.trim(),
            search: document.getElementById("global-search").value.trim(),
            patientName: document.getElementById("patient-name").value.trim(),
            gender: document.getElementById("gender").value.trim(),
            patientPhone: document.getElementById("patient-phone").value.trim(),
            labName: document.getElementById("lab-name").value.trim(),
            status: getStatusFilterQueryValue(document.getElementById("status").value.trim()),
            franchisee: document.getElementById("franchisee").value.trim(),
            barcode: document.getElementById("barcode").value.trim(),
            fromDate: document.getElementById("from-date").value,
            toDate: document.getElementById("to-date").value,
        };

        try {
            showLoader();

            // Single API call - backend handles everything
            const response = await fetch(`${BASE_URL}/api/v1/user/get-bookings?page=${page}&limit=${limit}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(filters)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 24px; color: #6b7280;">No bookings found.</td></tr>`;
            updateCasesSelectionState();
            return;
        }

        bookings.forEach((booking) => {
            const normalizedBookingStatus = (booking.status || "").trim().toLowerCase();
            // ✅ Backend already BOOKED / CANCELLED (any casing) hata deta hai,
            // ye client-side guard safety ke liye hai taaki list me kabhi
            // booked ya cancelled booking render na ho.
            if (
                normalizedBookingStatus === "booked" ||
                normalizedBookingStatus === "cancelled" ||
                normalizedBookingStatus === "canceled"
            ) {
                return;
            }

            const row = document.createElement("tr");

            // Set lightweight custom attributes
            const eligible = isDownloadEligible(booking.status);
            const patientNameStr = String(booking.patientName || "").trim();

            row.setAttribute("age", booking.year);
            row.setAttribute("gender", booking.gender);
            row.setAttribute("data-booking-id", booking.bookingId);
            row.setAttribute("data-patient-phone", booking.patientPhone);
            row.setAttribute("data-lab-name", booking.labName);
            row.setAttribute("data-updated-at", booking.updatedAt);
            row.setAttribute("data-created-by", booking.createdBy || "");
            row.setAttribute("data-report-ready", booking.isreportready ? "true" : "false");
            row.setAttribute("data-status", normalizedBookingStatus);
            row.setAttribute("data-patient-name", patientNameStr);

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

            // Action column HTML (1st column)
            const actionsHtml = booking.isreportready
                ? `<td class="actions">
                    <div class="actions-wrapper">
                        <a data-page="reportFormat" class="btn-action btn-primary edit-report"><i class="fa-solid fa-file-lines"></i> View report</a>
                        <a data-page="ModifyCase" class="btn-action btn-outline modify-case-direct"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
                        <button type="button" class="more-options" title="More options" aria-label="More options" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    </div>
                </td>`
                : `<td class="actions">
                    <div class="actions-wrapper">
                        <a data-page="labreport" class="btn-action btn-primary view-bill"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                        <a data-page="ModifyCase" class="btn-action btn-outline modify-case-direct"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
                        <button type="button" class="more-options" title="More options" aria-label="More options" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    </div>
                </td>`;

            row.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="case-checkbox" data-booking-id="${escapeHtml(booking.bookingId || '')}" aria-label="Select booking ${escapeHtml(booking.bookingId || '')}" ${eligible ? '' : 'disabled'} title="${eligible ? 'Select booking' : 'Report not ready for download (Only Completed and Partially Completed)'}">
                </td>
                ${actionsHtml}
                <td class="reg-no">
                    <span class="booking-id-badge${eligible ? '' : ' is-not-ready'}" role="button" tabindex="${eligible ? '0' : '-1'}"
                          title="${eligible ? 'Click to Download Report' : 'Report not ready for download (Only Completed and Partially Completed)'}"
                          aria-label="${eligible ? 'Download report for booking ' + escapeHtml(booking.bookingId || '') : 'Report not ready for booking ' + escapeHtml(booking.bookingId || '')}"
                          data-booking-id="${escapeHtml(booking.bookingId || '')}"
                          data-patient-name="${escapeHtml(patientNameStr)}"
                          data-status="${escapeHtml(booking.status || '')}">
                        <i class="fas ${eligible ? 'fa-download' : 'fa-lock'} booking-id-icon" aria-hidden="true"></i>
                        ${escapeHtml(booking.bookingId || '')}
                        ${eligible ? '' : '<span class="not-ready-tooltip" title="Only Completed and Partially Completed reports can be downloaded"><i class="fas fa-circle-info"></i></span>'}
                    </span>
                </td>
                <td>${new Date(booking.date).toLocaleDateString()}<br>${booking.time}</td>
                <td>${escapeHtml(booking.patientName || '')}</td>
                <td>${islayerone ? escapeHtml(booking.doctorName || "") : escapeHtml(booking.createdbyuser || "")}</td>
                <td style="white-space: normal;">${barcodeHtml}</td>
                <td><button class="status-btn" style="background-color: ${statusStyles.badgeBackground}; color: ${statusStyles.badgeColor};">${escapeHtml(booking.status || '')}</button></td>
                <td style="text-align:center;white-space:nowrap;">${renderSignOffBadge(booking)}</td>
                <td style="text-align:center;white-space:nowrap;">${printAuditBadge(booking)}</td>
                ${attachmentHtml}
            `;

            tableBody.appendChild(row);
        });

        updateCasesSelectionState();
    }

    // ================================================================
    //  Invoice generation helpers (mirrors generatebill.js logic)
    // ================================================================
    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\x22/g, "&quot;")
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

    async function getTenantLogoDataUrl() {
        const logoUrl = getTenantLogo();
        if (!logoUrl || logoUrl.startsWith("data:")) return logoUrl;
        try {
            const response = await fetch(logoUrl, { mode: "cors", cache: "no-store" });
            if (!response.ok) throw new Error(`Logo HTTP ${response.status}`);
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ""));
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn("Could not inline tenant logo:", error);
            return logoUrl;
        }
    }

    /**
     * Build a complete invoice HTML string from a booking object.
     * This mirrors the hidden .pdf-div template used on the official
     * generatebill page, so the backend can render a proper PDF.
     */
    function buildInvoiceHtml(booking, billingPrice, logoUrl) {
        if (!booking) return "";

        const logoHtml = `<div class="image-div"${logoUrl ? "" : " style=\"display:none;\""}><img id="bill-logo" src="${escapeHtml(logoUrl || "")}"></div>`;

        const uniqueTestNames = getUniqueTestNames(booking);
        const testRows = uniqueTestNames.map((name, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(name)}</td></tr>`
        ).join("") || '<tr><td colspan="2">-</td></tr>';

        const bookingDate = formatInvoiceDate(booking.date || booking.createdAt);
        const bookingTime = formatInvoiceTime(booking.time || booking.createdAt);
        const patientName = escapeHtml(booking.patientName || "");
        const bookingId = escapeHtml(booking.bookingId || "");
        const gender = escapeHtml([booking.year, booking.gender].filter(Boolean).join(" | ") || "");
        const total = Number(billingPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    async function generateInvoiceForBooking(booking, billingPrice) {
        if (!booking || !booking.bookingId) {
            showAppToast("Booking data is missing.", "error");
            return false;
        }

        const normalizedPrice = Number(billingPrice);
        if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
            showAppToast("Please enter a valid billing price.", "error");
            return false;
        }
        const invoiceHtml = buildInvoiceHtml(booking, normalizedPrice, await getTenantLogoDataUrl());
        const invoicecss = `
            * { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-sizing: border-box; }
            .container23 { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
            .header, .patient-details, .table-container { width: 100%; margin-bottom: 20px; }
            .header { position: relative; display: flex; justify-content: space-between; align-items: center; }
            .upper-header * { color: whitesmoke; }
            .upper-header { background-color: #3f4d67; }
            .header h1 { font-size: 24px; font-weight: bold; }
            .header p { margin: 5px 0; }
            .header img { width: 250px; height: 125px; object-fit: contain; object-position: center; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; border-top: 1px solid #e5e7eb; padding: 16px; margin-bottom: 16px; border-radius: 8px; }
            .image-div { position: absolute; right: 0%; top: 50%; transform: translateY(-50%); padding: 0 20px; }
            .patient-details { border-top: 1px solid #ccc; padding-top: 20px; }
            .patient-details p { margin: 5px 0; }
            .patient-details .blue { color: #1a73e8; }
            .table-container table { width: 100%; border-collapse: collapse; }
            .table-container { overflow: auto; }
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
            billingPrice: normalizedPrice,
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

            showAppToast("Invoice Generated Successfully", "success");
            return true;
        } catch (error) {
            console.error("Invoice generation failed:", error);
            showAppToast("Failed to generate PDF, try again", "error");
            return false;
        }
    }

    function closeBillModal() {
        const modal = document.getElementById("billGenerationModal");
        if (modal) modal.classList.remove("is-open");
        billModalBooking = null;
    }

    function openBillModal(booking) {
        if (!booking || billModalSubmitting) return;
        billModalBooking = booking;
        document.getElementById("billModalBookingId").textContent = booking.bookingId || "-";
        document.getElementById("billModalPatient").textContent = booking.patientName || "-";
        document.getElementById("billModalOriginalPrice").textContent = `Rs ${Number(booking.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById("billModalPrice").value = booking.total != null ? booking.total : "";
        document.getElementById("billModalDiscount").value = "0";
        document.getElementById("billModalTax").value = "0";
        updateBillModalTotal();
        document.getElementById("billGenerationModal").classList.add("is-open");
        document.getElementById("billModalPrice").focus();
    }

    function updateBillModalTotal() {
        const price = Number(document.getElementById("billModalPrice").value || 0);
        const discount = Number(document.getElementById("billModalDiscount").value || 0);
        const taxRate = Number(document.getElementById("billModalTax").value || 0);
        const total = price - discount + ((price - discount) * taxRate / 100);
        const totalElement = document.getElementById("billModalFinalTotal");
        if (totalElement) totalElement.textContent = `Rs ${Math.max(0, total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    async function submitBillModal() {
        if (!billModalBooking || billModalSubmitting) return;
        const price = Number(document.getElementById("billModalPrice").value);
        const discount = Number(document.getElementById("billModalDiscount").value || 0);
        const taxRate = Number(document.getElementById("billModalTax").value || 0);
        const finalPrice = price - discount + ((price - discount) * taxRate / 100);
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(taxRate) || taxRate < 0 || finalPrice < 0) {
            showAppToast("Enter valid price and discount values.", "error");
            return;
        }

        billModalSubmitting = true;
        const submitButton = document.getElementById("billModalSubmit");
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        try {
            const ok = await generateInvoiceForBooking(billModalBooking, finalPrice);
            if (ok) {
                closeBillModal();
                await fetchBookings(currentPage);
            }
        } finally {
            billModalSubmitting = false;
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Generate Invoice';
        }
    }

    // Dropdown popover management (outside scroll container so it never clips)
    function closeDropdown() {
        const existing = document.getElementById("allcases-dropdown-popover");
        if (existing) {
            if (existing._trigger) {
                existing._trigger.classList.remove("is-active");
                existing._trigger.setAttribute("aria-expanded", "false");
            }
            existing.remove();
        }
    }

    function positionPopover(popover, triggerBtn, row) {
        if (!popover || !triggerBtn) return;

        const triggerRect = triggerBtn.getBoundingClientRect();
        const menuWidth = popover.offsetWidth || 190;
        const menuHeight = popover.offsetHeight || 220;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Is this one of the bottom rows of the table?
        const isLastRow = row ? !row.nextElementSibling : false;
        const isSecondLastRow = row && row.nextElementSibling ? !row.nextElementSibling.nextElementSibling : false;

        // Intelligent placement: flip upwards (dropup) for last rows or if space below is limited
        let openUpwards = false;
        if (spaceBelow < menuHeight + 10) {
            openUpwards = spaceAbove >= menuHeight || spaceAbove > spaceBelow;
        } else if ((isLastRow || isSecondLastRow) && spaceAbove >= menuHeight + 10) {
            openUpwards = true;
        }

        let top;
        let maxHeight = Math.min(380, viewportHeight - 20);

        if (openUpwards) {
            top = triggerRect.top - menuHeight - 6;
            if (top < 10) {
                top = 10;
                maxHeight = Math.max(120, triggerRect.top - 16);
            }
            popover.classList.add("dropup");
            popover.classList.remove("dropdown");
        } else {
            top = triggerRect.bottom + 6;
            if (top + menuHeight > viewportHeight - 10) {
                maxHeight = Math.max(120, viewportHeight - top - 10);
            }
            popover.classList.add("dropdown");
            popover.classList.remove("dropup");
        }

        let left = triggerRect.left;
        if (left + menuWidth > viewportWidth - 12) {
            left = triggerRect.right - menuWidth;
        }
        if (left < 10) left = 10;
        if (left + menuWidth > viewportWidth - 10) {
            left = Math.max(10, viewportWidth - menuWidth - 10);
        }

        popover.style.maxHeight = `${Math.round(maxHeight)}px`;
        popover.style.top = `${Math.round(top)}px`;
        popover.style.left = `${Math.round(left)}px`;
    }

    function openDropdownMenu(triggerBtn, row) {
        if (!triggerBtn || !row) return;

        const currentPopover = document.getElementById("allcases-dropdown-popover");
        if (currentPopover && currentPopover._trigger === triggerBtn) {
            closeDropdown();
            return;
        }

        closeDropdown();

        triggerBtn.classList.add("is-active");
        triggerBtn.setAttribute("aria-expanded", "true");

        const bookingId = row.getAttribute("data-booking-id");
        const createdBy = row.getAttribute("data-created-by") || "";
        const isReportReady = row.getAttribute("data-report-ready") === "true";

        const popover = document.createElement("div");
        popover.id = "allcases-dropdown-popover";
        popover.className = "allcases-dropdown-menu allcases-floating-popover";
        popover._trigger = triggerBtn;
        popover._row = row;
        popover.dataset.bookingId = bookingId;
        popover.dataset.createdBy = createdBy;

        if (isReportReady) {
            popover.innerHTML = `
                <a href="javascript:void(0)" class="dropdown-item" data-action="download-report"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="modify-case"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="generate-bill"><i class="fa-solid fa-file-invoice-dollar"></i> Generate Bill</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="hold"><i class="fa-solid fa-hands-holding"></i> Hold</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="clinical"><i class="fa-solid fa-house-chimney-medical"></i> Clinical</a>
            `;
        } else {
            popover.innerHTML = `
                <a href="javascript:void(0)" class="dropdown-item" data-action="modify-case"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="generate-bill"><i class="fa-solid fa-file-invoice-dollar"></i> Generate Bill</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="hold"><i class="fa-solid fa-hands-holding"></i> Hold</a>
                <a href="javascript:void(0)" class="dropdown-item" data-action="clinical"><i class="fa-solid fa-house-chimney-medical"></i> Clinical</a>
                <a href="javascript:void(0)" class="dropdown-item danger-item" data-action="cancel"><i class="fa-solid fa-rectangle-xmark"></i> Cancel</a>
            `;
        }

        document.body.appendChild(popover);

        // Position popover intelligently
        positionPopover(popover, triggerBtn, row);

        // Direct action click handler on the floating menu
        popover.addEventListener("click", async (ev) => {
            const item = ev.target.closest("[data-action]");
            if (!item) return;
            ev.preventDefault();
            ev.stopPropagation();

            const action = item.getAttribute("data-action");
            closeDropdown();
            await handleAction(action, bookingId, createdBy, row);
        });
    }

    async function handleAction(action, bookingId, createdBy, row) {
        if (!bookingId) return;

        if (action === "download-report") {
            const booking = await getBookingDetails(bookingId);
            if (!booking) return;
            saveBookingToLocalStorage(booking, row);
            window.location.href = `${BASE_URL}/admin/admin.html?page=labreport`;
        }
        else if (action === "modify-case") {
            const booking = await getBookingDetails(bookingId);
            if (!booking) return;
            saveBookingToLocalStorage(booking, row);
            window.location.href = `${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`;
        }
        else if (action === "generate-bill") {
            const booking = await getBookingDetails(bookingId);
            if (!booking) return;
            openBillModal(booking);
        }
        else if (action === "hold") {
            const reason = window.prompt("Enter the reason for putting this booking on Hold:");
            if (!reason || !reason.trim()) return alert("A Hold reason is required.");
            const confirmation = window.confirm("Are you want to update the status as 'Hold'");
            if (!confirmation) return;

            await updatebookingStatus(bookingId, "Hold", reason);

            if (user.tenantId.modelType !== "1layer") {
                showPopup(bookingId, createdBy);
                await fetchMessages(bookingId);
            }

            await fetchBookings(currentPage);
        }
        else if (action === "clinical") {
            const reason = window.prompt("Enter the reason for marking this booking Clinical:");
            if (!reason || !reason.trim()) return alert("A Clinical reason is required.");
            const confirmation = window.confirm("Are you want to update the status as 'Clinical'");
            if (!confirmation) return;

            await updatebookingStatus(bookingId, "Clinical", reason);

            if (user.tenantId.modelType !== "1layer") {
                showPopup(bookingId, createdBy);
                await fetchMessages(bookingId);
            }

            await fetchBookings(currentPage);
        }
        else if (action === "cancel") {
            const reason = window.prompt("Enter the cancellation reason:");
            if (!reason || !reason.trim()) return alert("A cancellation reason is required.");
            const confirmation = window.confirm("Are you sure you want to cancel this booking?");
            if (!confirmation) return;

            const loadingMsg = document.createElement('div');
            loadingMsg.textContent = 'Processing cancellation...';
            loadingMsg.style.cssText = 'position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:10px 20px;border-radius:5px;z-index:99999';
            document.body.appendChild(loadingMsg);
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/bookings/cancel`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ bookingId, reason: reason.trim() })
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
    }

    // Event delegation for table actions
    const tableBody = document.getElementById("tbody");
    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            // Handle clicking on Booking ID badge for report download
            const badge = e.target.closest(".booking-id-badge");
            if (badge) {
                e.preventDefault();
                e.stopPropagation();
                await downloadSingleReport(badge);
                return;
            }

            // Handle checkbox click
            if (e.target.classList.contains("case-checkbox")) {
                updateCasesSelectionState();
                return;
            }

            const target = e.target.closest("a, .more-options");
            if (!target) return;
            e.preventDefault();

            // Handle three dots dropdown toggle
            if (target.closest(".more-options")) {
                const triggerBtn = target.closest(".more-options");
                const row = triggerBtn.closest("tr");
                openDropdownMenu(triggerBtn, row);
                return;
            }

            const row = target.closest("tr");
            const bookingId = row ? row.getAttribute("data-booking-id") : null;
            if (!bookingId) return;

            if (target.classList.contains("view-bill")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.location.href = `${BASE_URL}/admin/admin.html?page=labreport`;
            }
            else if (target.classList.contains("edit-report")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                const effectiveFormat = user.role === "staff" ? (user.createdBy?.pdfFormat || user.pdfFormat) : user.pdfFormat;
                const url = `${BASE_URL}/admin/admin.html?page=${effectiveFormat}&value1=${booking.bookingId}`;
                window.location.href = url;
            }
            else if (target.classList.contains("modify-case-direct")) {
                const booking = await getBookingDetails(bookingId);
                if (!booking) return;
                saveBookingToLocalStorage(booking, row);
                window.location.href = `${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`;
            }
        });

        // Clean up previous event listeners if re-entering this page
        if (window._allcasesCleanupDropdown) {
            window._allcasesCleanupDropdown();
        }

        const handleDocClick = (event) => {
            const popover = document.getElementById("allcases-dropdown-popover");
            if (!popover) return;
            // If click inside popover or on the trigger button, keep it open
            if (popover.contains(event.target) || (popover._trigger && popover._trigger.contains(event.target))) {
                return;
            }
            closeDropdown();
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                closeDropdown();
            }
        };

        let scrollRafId = null;
        const handleScrollOrResize = (event) => {
            const popover = document.getElementById("allcases-dropdown-popover");
            if (!popover) return;

            // If scrolling inside the popover itself, keep it open
            if (event && event.target && (event.target === popover || popover.contains(event.target))) {
                return;
            }

            if (scrollRafId) cancelAnimationFrame(scrollRafId);
            scrollRafId = requestAnimationFrame(() => {
                const current = document.getElementById("allcases-dropdown-popover");
                if (!current || !current._trigger) return;

                const triggerRect = current._trigger.getBoundingClientRect();
                // If the trigger button scrolled completely offscreen, close dropdown
                if (
                    triggerRect.bottom < 0 ||
                    triggerRect.top > window.innerHeight ||
                    triggerRect.right < 0 ||
                    triggerRect.left > window.innerWidth
                ) {
                    closeDropdown();
                    return;
                }

                // Smoothly reposition as the table or window scrolls
                positionPopover(current, current._trigger, current._row);
            });
        };

        document.addEventListener("click", handleDocClick, true);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
        window.addEventListener("resize", handleScrollOrResize, { passive: true });

        window._allcasesCleanupDropdown = () => {
            document.removeEventListener("click", handleDocClick, true);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
            window.removeEventListener("resize", handleScrollOrResize);
            if (scrollRafId) cancelAnimationFrame(scrollRafId);
            closeDropdown();
        };
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

    async function updatebookingStatus(bookingid, status, reason) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/statusBookingcontroller`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingid, status, reason }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                alert(result.message || "Booking status was not updated.");
                return false;
            }
            return true;
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
        const regId = (row && row.querySelector(".reg-no")) ? row.querySelector(".reg-no").innerText.trim() : (booking ? booking.bookingId : "");
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
        const billModal = document.getElementById("billGenerationModal");

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
                const globalSearchEl = document.getElementById("global-search");
                const patientNameEl = document.getElementById("patient-name");
                const genderEl = document.getElementById("gender");
                const patientPhoneEl = document.getElementById("patient-phone");
                const barcodeEl = document.getElementById("barcode");
                const labNameEl = document.getElementById("lab-name");
                const statusEl = document.getElementById("status");
                const franchiseeEl = document.getElementById("franchisee");
                const fromDateEl = document.getElementById("from-date");
                const toDateEl = document.getElementById("to-date");

                if (regNoEl) regNoEl.value = "";
                if (globalSearchEl) globalSearchEl.value = "";
                if (patientNameEl) patientNameEl.value = "";
                if (genderEl) genderEl.value = "";
                if (patientPhoneEl) patientPhoneEl.value = "";
                if (barcodeEl) barcodeEl.value = "";
                if (labNameEl) labNameEl.value = "";
                if (statusEl) statusEl.value = "";
                if (franchiseeEl) franchiseeEl.value = "";
                if (fromDateEl) fromDateEl.value = "";
                if (toDateEl) toDateEl.value = "";

                fetchBookings(1);
            });
        }

        ["from-date", "to-date"].forEach((id) => {
            const dateInput = document.getElementById(id);
            if (dateInput) dateInput.addEventListener("change", () => fetchBookings(1));
        });

        const billModalClose = document.getElementById("billModalClose");
        const billModalCancel = document.getElementById("billModalCancel");
        const billModalSubmit = document.getElementById("billModalSubmit");
        if (billModalClose) billModalClose.addEventListener("click", closeBillModal);
        if (billModalCancel) billModalCancel.addEventListener("click", closeBillModal);
        if (billModalSubmit) billModalSubmit.addEventListener("click", submitBillModal);
        ["billModalPrice", "billModalDiscount", "billModalTax"].forEach((id) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener("input", updateBillModalTotal);
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        const submitButton = document.getElementById("billModalSubmit");
                        if (submitButton && !submitButton.disabled) submitButton.click();
                    }
                });
            }
        });
        if (billModal) billModal.addEventListener("click", (event) => {
            if (event.target === billModal) closeBillModal();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && billModal && billModal.classList.contains("is-open")) closeBillModal();
        });

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
            '#global-search, #reg-no, #patient-name, #franchisee, #gender, #patient-phone, #barcode, #lab-name, #status, #from-date, #to-date'
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

    const fromDateInput = document.getElementById("from-date");
    const toDateInput = document.getElementById("to-date");

    // Keyboard accessibility for booking-id-badge
    const tbodyEl = document.getElementById("tbody");
    if (tbodyEl) {
        tbodyEl.addEventListener("keydown", async function (e) {
            if (e.key === "Enter" || e.key === " ") {
                const badge = e.target.closest(".booking-id-badge");
                if (badge) {
                    e.preventDefault();
                    await downloadSingleReport(badge);
                }
            }
        });
    }

    // Select All Checkbox
    const selectAllCheckbox = document.getElementById("selectAllCases");
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener("change", function () {
            const checkboxes = document.querySelectorAll("#tbody .case-checkbox:not(:disabled)");
            checkboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
            });
            updateCasesSelectionState();
        });
    }

    // Download Selected Cases Button
    const downloadSelectedBtn = document.getElementById("downloadSelectedCases");
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener("click", downloadSelectedReports);
    }

    // Merge Selected Cases Button
    const mergeSelectedBtn = document.getElementById("mergeSelectedCases");
    if (mergeSelectedBtn) {
        mergeSelectedBtn.addEventListener("click", mergeSelectedReports);
    }

    // Letterhead Format Toggle
    const letterheadSeg = document.getElementById("allcases-letterhead-seg");
    if (letterheadSeg) {
        syncLetterheadUI(getLetterheadPreference());
        letterheadSeg.addEventListener("click", function (e) {
            const btn = e.target.closest(".seg-option");
            if (!btn) return;
            const value = btn.getAttribute("data-value");
            setLetterheadPreference(value);
        });
    }

    await fetchBookings(1);
}

async function initialization() {
    showLoader();
    try {
        await allcases();
    } catch (error) {
        console.log(error);
    } finally {
        hideLoader();
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


