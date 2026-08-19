/* =====================================================================
 * generatebill.js - Production-Grade Generate Bill Page
 * ---------------------------------------------------------------------
 * Fixes: TypeError at line 35 (bill-logo null). The prior code called
 *   billLogo.remove(); on a booking without a tenant logo. On the next
 *   search the getElementById('bill-logo') returned null and setting
 *   .src threw. The element is now NEVER removed - it is hidden and
 *   restored safely with full null guards.
 *
 * Features:
 *   - Default view: bookings from the last 24 hours (1 day)
 *   - Global multi-field search (Booking ID, Patient, Barcode, Doctor,
 *     Test Name) with debounce
 *   - Date range filter (From Date -> To Date)
 *   - Client-side responsive pagination (page numbers, prev/next,
 *     items-per-page selector)
 *   - Inline spinner on Download Invoice / Generate Bill actions
 *   - Full defensive null/undefined checks everywhere
 * =====================================================================
 */
/* global user, userId, BASE_URL */

(function () {
    "use strict";

    // ================================================================
    //  Constants
    // ================================================================
    var SEARCH_DEBOUNCE_MS = 400;
    var DEFAULT_PAGE_SIZE = 10;

    // ================================================================
    //  State
    // ================================================================
    var state = {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        allBookings: [],
        filteredBookings: [],
        currentBooking: null,
        isFetching: false,
        fetchedOnce: false,
        serverPaginated: true
    };

    // ================================================================
    //  DOM helpers (defensive)
    // ================================================================
    function $id(id) { return document.getElementById(id); }
    function $q(sel, root) { return (root || document).querySelector(sel); }

    /** Tiny debounce - used for the search input. */
    function debounce(fn, wait) {
        wait = wait || SEARCH_DEBOUNCE_MS;
        var timer = null;
        return function debounced() {
            var args = arguments;
            var context = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                timer = null;
                fn.apply(context, args);
            }, wait);
        };
    }

    /** Escape user data before injecting into HTML. */
    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\x22/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /** Format a date (Date / ISO string / "yyyy-mm-dd" string). */
    function formatDate(value) {
        if (!value) return "";
        var parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
        return String(value).split("T")[0] || "";
    }

    /** Format a time value ("HH:mm:ss" or ISO). */
    function formatTime(value) {
        if (!value) return "";
        try {
            var parsed = new Date("1970-01-01T" + value);
            if (!isNaN(parsed.getTime())) {
                return parsed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            }
        } catch (_) { /* ignore */ }
        try {
            return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        } catch (_) { /* ignore */ }
        return "";
    }

    /** Convert a JS Date to an <input type="date"> value (YYYY-MM-DD). */
    function toDateInputValue(date) {
        var d = new Date(date);
        if (isNaN(d.getTime())) return "";
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    /** Parse a date input value into a Date at 00:00:00 local. */
    function parseDateInput(value) {
        if (!value) return null;
        var d = new Date(value);
        if (isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** Parse a date input value into a Date at 23:59:59.999 local. */
    function parseDateInputEnd(value) {
        var d = parseDateInput(value);
        if (!d) return null;
        d.setHours(23, 59, 59, 999);
        return d;
    }

    /** Collect unique test names from a booking's tableData. */
    function getUniqueTestNames(booking) {
        if (!booking || !Array.isArray(booking.tableData)) return [];
        var names = [];
        booking.tableData.forEach(function (entry) {
            var raw = String((entry && entry.testName) || "");
            raw.split(",").map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t) {
                if (names.indexOf(t) === -1) names.push(t);
            });
        });
        return names;
    }

    /** Collect barcodes from a booking's tableData. */
    function getBarcodes(booking) {
        if (!booking || !Array.isArray(booking.tableData)) return [];
        return booking.tableData
            .map(function (entry) { return String((entry && entry.barcodeId) || "").trim(); })
            .filter(Boolean);
    }

    // ================================================================
    //  Toast notifications
    // ================================================================
    function showToast(message, type) {
        type = type || "info";
        var toast = document.createElement("div");
        toast.className = "toast-msg toast-" + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add("show"); });
        setTimeout(function () {
            toast.classList.remove("show");
            setTimeout(function () { toast.remove(); }, 350);
        }, 3200);
    }

    // ================================================================
    //  Loader overlay
    // ================================================================
    function showLoader() {
        var overlay = $id("loading-overlay");
        if (overlay) overlay.classList.add("active");
    }

    function hideLoader() {
        var overlay = $id("loading-overlay");
        if (overlay) overlay.classList.remove("active");
    }

    // ================================================================
    //  Data fetching (existing backend: GET /bookings-search)
    // ================================================================
    async function fetchBookings(silent) {
        if (state.isFetching) return;
        state.isFetching = true;
        if (!silent) showLoader();

        var searchInput = $id("search-input");
        var searchValue = (searchInput ? searchInput.value : "").trim();
        var fromDate = $id("from-date");
        var toDate = $id("to-date");
        var bookingSearchUrl = BASE_URL + "/api/v1/user/bookings-search?search=" + encodeURIComponent(searchValue) +
            "&fromDate=" + encodeURIComponent(fromDate ? fromDate.value : "") +
            "&toDate=" + encodeURIComponent(toDate ? toDate.value : "") +
            "&page=" + encodeURIComponent(state.page) +
            "&limit=" + encodeURIComponent(state.pageSize);

        try {
            var response = await fetch(bookingSearchUrl, {
                credentials: "include"
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            var data = await response.json();
            var bookings = Array.isArray(data.bookings) ? data.bookings : [];
            var invoiceData = null;
            try {
                var pageBookingIds = bookings.map(function (booking) {
                    return booking && booking.bookingId ? String(booking.bookingId) : "";
                }).filter(Boolean).join(",");
                var invoiceUrl = BASE_URL + "/api/v1/user/getAllInvoices?bookingIds=" + encodeURIComponent(pageBookingIds);
                var invoiceResponse = await fetch(invoiceUrl, {
                    credentials: "include"
                });
                invoiceData = invoiceResponse.ok ? await invoiceResponse.json() : null;
            } catch (invoiceError) {
                console.warn("Could not load saved invoice prices:", invoiceError);
            }
            var billingPrices = {};
            (invoiceData && Array.isArray(invoiceData.data) ? invoiceData.data : []).forEach(function (invoice) {
                if (invoice && invoice.bookingId && invoice.billingPrice != null) {
                    billingPrices[String(invoice.bookingId)] = Number(invoice.billingPrice);
                }
            });
            state.allBookings = bookings.map(function (booking) {
                var savedPrice = billingPrices[String(booking.bookingId)];
                return savedPrice != null && isFinite(savedPrice)
                    ? Object.assign({}, booking, { _billingPrice: savedPrice })
                    : booking;
            });
            state.total = Number.isFinite(Number(data.total)) ? Number(data.total) : bookings.length;
            state.fetchedOnce = true;
            applyFilters({ resetPage: false });
        } catch (error) {
            console.error("Error fetching bookings:", error);
            showToast("Failed to load bookings. Please try again.", "error");
            renderEmpty("Failed to load bookings");
        } finally {
            state.isFetching = false;
            hideLoader();
        }
    }

    // ================================================================
    //  Filtering, sorting & pagination
    // ================================================================
    function getSearchTerm() {
        var el = $id("search-input");
        return (el ? el.value : "").trim().toLowerCase();
    }

    function getDateRange() {
        var fromEl = $id("from-date");
        var toEl = $id("to-date");
        return {
            from: parseDateInput(fromEl ? fromEl.value : ""),
            to: parseDateInputEnd(toEl ? toEl.value : "")
        };
    }

    /** Returns true when a booking matches the current search term. */
    function bookingMatchesSearch(booking, term) {
        if (!term) return true;

        var bookingId = String(booking && booking.bookingId ? booking.bookingId : "");
        var patientName = String(booking && booking.patientName ? booking.patientName : "");
        var doctorName = String(
            (booking && booking.doctorName) ||
            (booking && booking.savedDoctor && booking.savedDoctor.doctorName) ||
            (booking && booking.savedDoctor && booking.savedDoctor.name) ||
            ""
        );
        var barcodes = getBarcodes(booking).join(" ");
        var testNames = getUniqueTestNames(booking).join(" ");

        var haystack = [bookingId, patientName, doctorName, barcodes, testNames]
            .join(" ")
            .toLowerCase();

        return haystack.indexOf(term) !== -1;
    }

    /** Returns true when a booking createdAt falls inside the date range. */
    function bookingInDateRange(booking, range) {
        if (!range.from && !range.to) return true;
        var createdAt = new Date((booking && booking.createdAt) || (booking && booking.date) || 0);
        if (isNaN(createdAt.getTime())) return false;
        if (range.from && createdAt < range.from) return false;
        if (range.to && createdAt > range.to) return false;
        return true;
    }

    /** Apply all filters, then sort + paginate, and render. */
    function applyFilters(opts) {
        opts = opts || {};
        var term = getSearchTerm();
        var range = getDateRange();

        // Filtering and sorting happen on the server so large date ranges never
        // download the complete result set into the browser.
        state.filteredBookings = state.allBookings || [];

        var totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        if (opts.resetPage || state.page > totalPages) state.page = 1;

        renderTable();
        renderPagination();
    }

    // ================================================================
    //  Rendering
    // ================================================================
    function renderEmpty(message) {
        message = message || "No bookings found.";
        var tbody = $id("table-body");
        if (!tbody) return;
        tbody.innerHTML = '' +
            '<tr>' +
            '    <td colspan="8">' +
            '        <div class="empty-state">' +
            '            <i class="fas fa-inbox"></i>' +
            '            <p>' + escapeHtml(message) + '</p>' +
            '        </div>' +
            '    </td>' +
            '</tr>';
    }

    function renderTable() {
        var tbody = $id("table-body");
        if (!tbody) return;

        if (state.filteredBookings.length === 0) {
            var term = getSearchTerm();
            renderEmpty(term ? 'No results found for "' + term + '".' : "No bookings found for the selected period.");
            return;
        }

        var startIndex = (state.page - 1) * state.pageSize;
        var pageBookings = state.serverPaginated
            ? state.filteredBookings
            : state.filteredBookings.slice(startIndex, startIndex + state.pageSize);

        var rowsHtml = pageBookings.map(function (booking) {
            var id = escapeHtml(booking && booking.bookingId ? booking.bookingId : "");
            var patient = escapeHtml(booking && booking.patientName ? booking.patientName : "-");
            var doctor = escapeHtml(
                (booking && booking.savedDoctor && booking.savedDoctor.doctorName) ||
                (booking && booking.doctorName) ||
                "-"
            );
            var barcodes = escapeHtml(getBarcodes(booking).join(", "));
            var testNames = escapeHtml(getUniqueTestNames(booking).join(", "));
            var total = typeof booking.total === "number"
                ? booking.total.toLocaleString("en-IN")
                : (booking.total || "-");
            var billGenerated = Boolean(booking && booking.billGenerated);

            var statusHtml = billGenerated
                ? '<span class="status-badge status-generated">Bill Generated</span>'
                : '<span class="status-badge status-pending">Pending</span>';

            var actionHtml;
            if (billGenerated) {
                actionHtml = '<button class="btn-download btn-invoice-action" data-booking-id="' + escapeHtml(booking.bookingId) + '" data-action="download">' +
                    '    <i class="fas fa-download"></i><span>Download Invoice</span>' +
                    '</button>';
            } else {
                actionHtml = '<button class="btn-generate btn-invoice-action" data-booking-id="' + escapeHtml(booking.bookingId) + '" data-action="generate">' +
                    '    <i class="fas fa-file-invoice"></i><span>Generate Bill</span>' +
                    '</button>';
            }

            return '' +
                '<tr data-booking-id="' + escapeHtml(booking.bookingId) + '">' +
                '    <td class="booking-id">' + id + '</td>' +
                '    <td>' + patient + '</td>' +
                '    <td style="white-space: normal;">' + (barcodes || "-") + '</td>' +
                '    <td>' + doctor + '</td>' +
                '    <td style="white-space: normal;">' + (testNames || "-") + '</td>' +
                '    <td>&#8377; ' + total + '</td>' +
                '    <td>' + statusHtml + '</td>' +
                '    <td>' + actionHtml + '</td>' +
                '</tr>';
        }).join("");

        tbody.innerHTML = rowsHtml;
    }

    // ================================================================
    //  Pagination rendering
    // ================================================================
    function renderPagination() {
        var paginationEl = $id("pagination");
        var infoEl = $id("pagination-info");
        var controlsEl = $id("pagination-controls");
        var countEl = $id("table-count");

        if (!paginationEl || !infoEl || !controlsEl) return;

        var totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));

        if (countEl) {
            countEl.textContent = state.total + " booking" + (state.total === 1 ? "" : "s");
        }

        if (state.total === 0) {
            paginationEl.style.display = "none";
            infoEl.textContent = "";
            controlsEl.innerHTML = "";
            return;
        }

        paginationEl.style.display = "flex";
        infoEl.textContent = "Showing " + ((state.page - 1) * state.pageSize + 1) + "-" +
            Math.min(state.page * state.pageSize, state.total) + " of " + state.total;

        // Build page-number buttons with ellipsis
        var pagesToShow = 5;
        var pageNumbers = [];
        if (totalPages <= pagesToShow) {
            for (var i = 1; i <= totalPages; i++) pageNumbers.push(i);
        } else {
            pageNumbers.push(1);
            var start = Math.max(2, state.page - 1);
            var end = Math.min(totalPages - 1, state.page + 1);
            if (start > 2) pageNumbers.push("...");
            for (var j = start; j <= end; j++) pageNumbers.push(j);
            if (end < totalPages - 1) pageNumbers.push("...");
            pageNumbers.push(totalPages);
        }

        var buttonsHtml = '' +
            '<button class="page-btn" data-page="' + (state.page - 1) + '"' + (state.page <= 1 ? " disabled" : "") + ' title="Previous">' +
            '    <i class="fas fa-chevron-left"></i>' +
            '</button>' +
            pageNumbers.map(function (p) {
                if (p === "...") return '<span class="page-ellipsis">...</span>';
                return '<button class="page-btn' + (p === state.page ? " active" : "") + '" data-page="' + p + '">' + p + '</button>';
            }).join("") +
            '<button class="page-btn" data-page="' + (state.page + 1) + '"' + (state.page >= totalPages ? " disabled" : "") + ' title="Next">' +
            '    <i class="fas fa-chevron-right"></i>' +
            '</button>';

        controlsEl.innerHTML = buttonsHtml;
    }

    // ================================================================
    //  Invoice template population (fixes the .src null bug)
    // ================================================================
    function getTenantLogo() {
        try {
            return String((user && user.tenantId && user.tenantId.logo) || "");
        } catch (_) {
            return "";
        }
    }

    async function getTenantLogoDataUrl() {
        var logoUrl = getTenantLogo();
        if (!logoUrl || logoUrl.indexOf("data:") === 0) return logoUrl;

        try {
            var response = await fetch(logoUrl, { mode: "cors", cache: "no-store" });
            if (!response.ok) throw new Error("Logo HTTP " + response.status);
            var blob = await response.blob();
            return await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || "")); };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn("Could not inline tenant logo for invoice:", error);
            return logoUrl;
        }
    }

    /**
     * Populate the hidden PDF invoice template with booking data.
     * bill-logo is never removed from the DOM - we simply clear / show it.
     */
    function populateInvoiceTemplate(booking, billingPrice, logoOverride) {
        if (!booking) return;

        var invoiceTotal = billingPrice != null && billingPrice !== ""
            ? Number(billingPrice)
            : Number(booking.total != null ? booking.total : 0);
        if (!isFinite(invoiceTotal)) invoiceTotal = 0;

        var billLogo = $id("bill-logo");
        var logoUrl = logoOverride || getTenantLogo();
        console.log("logourl :", logoUrl);

        // ---- Fix for the original TypeError ----
        // Never call .remove() on bill-logo. Element may be missing if the
        // page was re-rendered; always guard before touching it.
        if (billLogo) {
            if (logoUrl) {
                billLogo.src = logoUrl;
                billLogo.style.display = "";
            } else {
                billLogo.removeAttribute("src");
                billLogo.style.display = "none";
            }
        }

        var uniqueTestNames = getUniqueTestNames(booking);

        // Invoice line-items table
        var invoiceTbody = $q("#invoice-table tbody");
        if (invoiceTbody) {
            invoiceTbody.innerHTML = uniqueTestNames.map(function (name, index) {
                return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(name) + "</td></tr>";
            }).join("") || '<tr><td colspan="2">-</td></tr>';
        }

        var bookingDate = formatDate(booking.date || booking.createdAt);
        var bookingTime = formatTime(booking.time || booking.createdAt);

        // Modal info cards
        var mlAuto = $q(".ml-auto");
        if (mlAuto) mlAuto.textContent = booking.bookingId || "";
        var bookingDateEl = $q(".booking-date");
        if (bookingDateEl) bookingDateEl.textContent = bookingDate || "-";
        var bookingTimeEl = $q(".booking-time");
        if (bookingTimeEl) bookingTimeEl.textContent = bookingTime || "-";
        var patientNameEl = $q(".booking-patientName");
        if (patientNameEl) patientNameEl.textContent = booking.patientName || "-";
        var bookingTotalEl = $q(".booking-total");
        if (bookingTotalEl) bookingTotalEl.textContent = booking.total != null
            ? "Rs " + Number(booking.total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "-";

        // Invoice header
        var invoiceIdEl = $id("invoiceid");
        if (invoiceIdEl) invoiceIdEl.textContent = "#Bill" + (booking._id || booking.bookingId || "");

        var invoiceBookingIdEl = $id("invoice-bookingid");
        if (invoiceBookingIdEl) invoiceBookingIdEl.textContent = "Booking Id : " + (booking.bookingId || "");

        var bookingDateTimeEl = $id("booking-date-time");
        if (bookingDateTimeEl) {
            bookingDateTimeEl.textContent = ("Booking Time : " + bookingDate + " " + bookingTime).trim();
        }

        // Patient details block
        var blueEl = $q(".patient-details .blue");
        if (blueEl) blueEl.textContent = booking.patientName || "";

        var genderEl = $q(".invoice-gender");
        if (genderEl) {
            genderEl.textContent = [booking.year, booking.gender].filter(Boolean).join(" | ") || "";
        }

        var invoiceDateTimeEl = $id("invoice-date-time");
        if (invoiceDateTimeEl) {
            invoiceDateTimeEl.textContent = "Invoice Date : " + new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        }

        // Grand total
        var grandTotalEl = $q(".container8989 .header span");
        if (grandTotalEl) grandTotalEl.textContent = "Rs " + invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ================================================================
    //  Invoice generation & download
    // ================================================================
    function setButtonLoading(button, loading, loadingText) {
        if (!button) return;
        var span = button.querySelector("span");
        var icon = button.querySelector("i");
        button.disabled = loading;
        if (loading) {
            if (span) span.textContent = loadingText || "Please wait...";
            if (icon) icon.className = "fas fa-spinner fa-spin";
        } else {
            var action = button.dataset.action;
            if (span) span.textContent = action === "generate" ? "Generate Bill" : "Download Invoice";
            if (icon) icon.className = action === "generate" ? "fas fa-file-invoice" : "fas fa-download";
        }
    }

    /**
     * Generate the invoice PDF using the existing API and download it.
     * @param {Object} booking - full booking object
     * @param {Object} options - { billingPrice, markGenerated }
     */
    async function generateAndDownloadInvoice(booking, options) {
        options = options || {};
        if (!booking || !booking.bookingId) {
            showToast("Booking data is missing.", "error");
            return false;
        }

        var billingPrice = Number(options.billingPrice != null ? options.billingPrice : (booking.total != null ? booking.total : 0));

        // Inline the logo before rendering so the PDF does not depend on remote image timing.
        var invoiceLogo = await getTenantLogoDataUrl();
        populateInvoiceTemplate(booking, billingPrice, invoiceLogo);

        var invoiceHtmlEl = $q(".pdf-div");
        var invoicecssEl = $id("billcss");
        var invoiceIdEl = $id("invoiceid");
        var invoiceHtml = invoiceHtmlEl ? invoiceHtmlEl.innerHTML : "";
        var invoicecss = invoicecssEl ? invoicecssEl.innerHTML : "";
        var billnumber = invoiceIdEl && invoiceIdEl.innerText ? invoiceIdEl.innerText : ("#Bill" + booking.bookingId);
        var generatedBy = (typeof userId !== "undefined" ? userId : null) || null;

        var payload = {
            invoiceHtml: invoiceHtml,
            invoicecss: invoicecss,
            billnumber: billnumber,
            bookingId: booking.bookingId,
            billingPrice: billingPrice,
            generatedBy: generatedBy
        };

        try {
            var response = await fetch(BASE_URL + "/api/v1/user/invoicepdfgenerator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("HTTP " + response.status);

            var pdfBlob = await response.blob();
            if (!pdfBlob || pdfBlob.size === 0) throw new Error("Empty PDF received");

            var pdfUrl = URL.createObjectURL(pdfBlob);
            var anchor = document.createElement("a");
            anchor.href = pdfUrl;
            anchor.download = (booking.patientName || "invoice") + "-invoice.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(function () { URL.revokeObjectURL(pdfUrl); }, 5000);

            // Optionally mark the booking as bill-generated on the backend
            if (options.markGenerated) {
                try {
                    await fetch(BASE_URL + "/api/v1/user/updategeneratedbillvariable/" + encodeURIComponent(booking.bookingId), {
                        credentials: "include"
                    });
                } catch (markError) {
                    console.warn("Failed to mark bill as generated:", markError);
                }
            }

            showToast("Invoice downloaded successfully.", "success");
            return true;
        } catch (error) {
            console.error("Invoice generation failed:", error);
            showToast("Failed to generate invoice. Please try again.", "error");
            return false;
        }
    }

    // ================================================================
    //  Modal logic
    // ================================================================
    window.openModal = function openModal() {
        var modal = $id("customModal");
        if (modal) modal.classList.add("show");
    };

    window.closeModal = function closeModal() {
        var modal = $id("customModal");
        if (modal) modal.classList.remove("show");
    };

    // ================================================================
    //  Event binding
    // ================================================================
    function initDefaults() {
        // Default date range: last 24 hours (yesterday -> today)
        var now = new Date();
        var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        var fromEl = $id("from-date");
        var toEl = $id("to-date");

        if (fromEl && !fromEl.value) fromEl.value = toDateInputValue(yesterday);
        if (toEl && !toEl.value) toEl.value = toDateInputValue(now);
    }

    function bindEvents() {
        // --- Search button ---
        var searchBtn = $id("search-button");
        if (searchBtn) {
            searchBtn.addEventListener("click", function () {
                state.page = 1;
                fetchBookings(false);
            });
        }

        // --- Reset button ---
        var resetBtn = $id("reset-button");
        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                var searchInput = $id("search-input");
                if (searchInput) searchInput.value = "";
                initDefaults();
                state.page = 1;
                fetchBookings(false);
            });
        }

        // --- Debounced search input ---
        var searchInput = $id("search-input");
        if (searchInput) {
            searchInput.addEventListener("input", debounce(function () {
                state.page = 1;
                fetchBookings(false);
            }, SEARCH_DEBOUNCE_MS));
        }

        // --- Enter key triggers search ---
        document.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && document.activeElement === searchInput) {
                event.preventDefault();
                fetchBookings(false);
            }
        });

        // --- Date inputs: live filtering ---
        ["from-date", "to-date"].forEach(function (id) {
            var el = $id(id);
            if (el) el.addEventListener("change", function () {
                state.page = 1;
                fetchBookings(false);
            });
        });

        // --- Page size selector ---
        var pageSizeSelect = $id("page-size");
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener("change", function () {
                state.pageSize = parseInt(pageSizeSelect.value, 10) || DEFAULT_PAGE_SIZE;
                state.page = 1;
                fetchBookings(false);
            });
        }

        // --- Pagination controls (delegated) ---
        var controls = $id("pagination-controls");
        if (controls) {
            controls.addEventListener("click", function (event) {
                var btn = event.target.closest(".page-btn");
                if (!btn || btn.disabled) return;
                var targetPage = parseInt(btn.dataset.page, 10);
                if (!isNaN(targetPage)) {
                    state.page = targetPage;
                    fetchBookings(false);
                }
            });
        }

        // --- Table action buttons (delegated): Generate / Download ---
        var tbody = $id("table-body");
        if (tbody) {
            tbody.addEventListener("click", async function (event) {
                var button = event.target.closest(".btn-invoice-action");
                if (!button) return;

                var bookingId = button.dataset.bookingId;
                var booking = null;
                for (var i = 0; i < state.allBookings.length; i++) {
                    if (String(state.allBookings[i].bookingId) === String(bookingId)) {
                        booking = state.allBookings[i];
                        break;
                    }
                }
                if (!booking) {
                    showToast("Booking not found in current results.", "error");
                    return;
                }

                var action = button.dataset.action;

                if (action === "generate") {
                    // Open the modal to let the user set the billing price
                    state.currentBooking = booking;
                    populateInvoiceTemplate(booking);
                    var billingPriceInput = $q(".billingprice");
                    if (billingPriceInput && booking.total != null) billingPriceInput.value = booking.total;
                    window.openModal();
                    return;
                }

                if (action === "download") {
                    setButtonLoading(button, true, "Preparing...");
                    var ok = await generateAndDownloadInvoice(booking, {
                        billingPrice: booking._billingPrice,
                        markGenerated: false
                    });
                    setButtonLoading(button, false);
                    if (!ok) showToast("Could not prepare invoice.", "error");
                }
            });
        }

        // --- Modal submit button ---
        var submitBtn = $id("generateBillSubmit");
        if (submitBtn) {
            submitBtn.addEventListener("click", async function () {
                var booking = state.currentBooking;
                if (!booking) {
                    showToast("No booking selected.", "error");
                    return;
                }

                var billingPriceInput = $q(".billingprice");
                var billingPrice = billingPriceInput ? billingPriceInput.value : booking.total;
                var parsedBillingPrice = Number(billingPrice);
                if (billingPrice === "" || !isFinite(parsedBillingPrice) || parsedBillingPrice < 0) {
                    showToast("Please enter a valid billing price.", "error");
                    if (billingPriceInput) billingPriceInput.focus();
                    return;
                }

                setButtonLoading(submitBtn, true, "Generating...");

                var ok = await generateAndDownloadInvoice(booking, {
                    billingPrice: parsedBillingPrice,
                    markGenerated: true
                });

                setButtonLoading(submitBtn, false);

                if (ok) {
                    window.closeModal();
                    // Re-fetch so the table reflects updated billGenerated flags
                    fetchBookings(true);
                }
            });
        }

        // --- Close modal on outside click ---
        var modal = $id("customModal");
        if (modal) {
            document.addEventListener("click", function (event) {
                if (event.target === modal) window.closeModal();
            });
        }

        // --- Close modal on Escape ---
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") window.closeModal();
        });
    }

    // ================================================================
    //  Init
    // ================================================================
    function init() {
        initDefaults();
        bindEvents();
        fetchBookings(false);
    }

    // Backwards-compatible global hook used by older inline handlers.
    window.searchbuttonfunction = function () {
        fetchBookings(false);
    };

    // Start
    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", init);
        } else {
            init();
        }
    }
})();