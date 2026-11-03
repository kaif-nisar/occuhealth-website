(function () {
    const state = {
        page: 1,
        limit: 20,
        totalPages: 1,
        total: 0,
        bookings: [],
        activeRequestId: 0,
        fetchController: null
    };

    const selectors = {
        tableBody: document.getElementById("lbTableBody"),
        paginationInfo: document.getElementById("lbPaginationInfo"),
        prevBtn: document.getElementById("lbPrevBtn"),
        nextBtn: document.getElementById("lbNextBtn"),
        exportExcelBtn: document.getElementById("lbExportExcelBtn"),
        exportPdfBtn: document.getElementById("lbExportPdfBtn"),
        bookingOrBarcode: document.getElementById("lbBookingOrBarcode"),
        patientName: document.getElementById("lbPatientName"),
        mobileNumber: document.getElementById("lbMobileNumber"),
        statusFilter: document.getElementById("lbStatusFilter"),
        startDate: document.getElementById("lbStartDate"),
        endDate: document.getElementById("lbEndDate"),
        userFilter: document.getElementById("lbUserFilter"),
        sortBy: document.getElementById("lbSortBy"),
        sortOrder: document.getElementById("lbSortOrder"),
        pageLimit: document.getElementById("lbPageLimit"),
        searchBtn: document.getElementById("lbSearchBtn"),
        clearBtn: document.getElementById("lbClearBtn"),
        summaryTotal: document.getElementById("lbSummaryTotal"),
        summaryPending: document.getElementById("lbSummaryPending"),
        summaryCompleted: document.getElementById("lbSummaryCompleted"),
        summaryAttention: document.getElementById("lbSummaryAttention")
    };

    // Report print / download audit badge (shared component from the shell).
    // Safe for legacy bookings that have no printAudit object yet.
    function printAuditBadge(booking) {
        try {
            if (window.ReportPrintAudit && typeof window.ReportPrintAudit.badge === 'function') {
                return window.ReportPrintAudit.badge(booking);
            }
        } catch (error) {
            console.warn('Print audit badge unavailable:', error);
        }
        return '<span>—</span>';
    }

    function formatAge(value) {
        if (value === undefined || value === null || value === "") {
            return "—";
        }
        const str = String(value).trim();
        if (!str || str.toLowerCase() === "n/a" || str.toLowerCase() === "null") {
            return "—";
        }
        if (/^\d+$/.test(str)) {
            return `${str} Yrs`;
        }
        const yrMatch = str.match(/^(\d+)\s*(?:years?|yrs?|y)$/i);
        if (yrMatch) {
            return `${yrMatch[1]} Yrs`;
        }
        const moMatch = str.match(/^(\d+)\s*(?:months?|mos?|m)$/i);
        if (moMatch) {
            return `${moMatch[1]} Mos`;
        }
        const dMatch = str.match(/^(\d+)\s*(?:days?|d)$/i);
        if (dMatch) {
            return `${dMatch[1]} Days`;
        }
        return str;
    }

    function formatGenderBadge(value) {
        if (!value) {
            return `<span class="lb-gender-badge lb-gender-na"><i class="fas fa-genderless"></i> N/A</span>`;
        }
        const g = String(value).trim().toLowerCase();
        if (g === "male" || g === "m") {
            return `<span class="lb-gender-badge lb-gender-male"><i class="fas fa-mars"></i> Male</span>`;
        }
        if (g === "female" || g === "f") {
            return `<span class="lb-gender-badge lb-gender-female"><i class="fas fa-venus"></i> Female</span>`;
        }
        if (g === "other" || g === "o") {
            return `<span class="lb-gender-badge lb-gender-other"><i class="fas fa-genderless"></i> Other</span>`;
        }
        return `<span class="lb-gender-badge lb-gender-na">${value}</span>`;
    }

    function formatStatusLabel(status) {
        if (!status) return "N/A";
        const s = String(status).trim();
        const lower = s.toLowerCase();
        if (lower === "booked") return "Booked";
        if (lower === "pending") return "Pending";
        if (lower === "completed") return "Completed";
        if (lower === "partially completed" || lower === "partial completed" || lower === "partial" || lower === "partially ready") return "Partially Completed";
        if (lower === "hold" || lower === "on hold") return "On Hold";
        if (lower === "clinical" || lower === "clinical stated") return "Clinical";
        if (lower === "cancelled" || lower === "canceled") return "Cancelled";
        return s;
    }

    function getStatusMeta(status) {
        const normalized = (status || "").trim().toLowerCase();

        if (normalized === "completed") {
            return {
                rowColor: "rgba(22, 163, 74, 0.08)",
                badgeBg: "#dcfce7",
                badgeColor: "#166534"
            };
        }

        if (normalized.includes("partial")) {
            return {
                rowColor: "rgba(37, 99, 235, 0.08)",
                badgeBg: "#dbeafe",
                badgeColor: "#1d4ed8"
            };
        }

        if (normalized === "pending") {
            return {
                rowColor: "rgba(217, 119, 6, 0.08)",
                badgeBg: "#fef3c7",
                badgeColor: "#b45309"
            };
        }

        if (normalized === "booked") {
            return {
                rowColor: "rgba(99, 102, 241, 0.08)",
                badgeBg: "#ede9fe",
                badgeColor: "#6d28d9"
            };
        }

        if (normalized.includes("hold")) {
            return {
                rowColor: "rgba(220, 38, 38, 0.08)",
                badgeBg: "#fee2e2",
                badgeColor: "#b91c1c"
            };
        }

        if (normalized.includes("clinical")) {
            return {
                rowColor: "rgba(13, 148, 136, 0.08)",
                badgeBg: "#ccfbf1",
                badgeColor: "#0f766e"
            };
        }

        if (normalized === "cancelled" || normalized === "canceled") {
            return {
                rowColor: "rgba(239, 68, 68, 0.08)",
                badgeBg: "#fee2e2",
                badgeColor: "#991b1b"
            };
        }

        return {
            rowColor: "rgba(71, 85, 105, 0.06)",
            badgeBg: "#e2e8f0",
            badgeColor: "#334155"
        };
    }

    function formatDate(value) {
        if (!value) {
            return "N/A";
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }

        return parsed.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatDateTime(value) {
        if (!value) {
            return "N/A";
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }

        return parsed.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getFilters() {
        return {
            bookingOrBarcode: selectors.bookingOrBarcode.value.trim(),
            patientName: selectors.patientName.value.trim(),
            mobileNumber: selectors.mobileNumber.value.trim(),
            status: selectors.statusFilter.value.trim(),
            startDate: selectors.startDate.value,
            endDate: selectors.endDate.value,
            hierarchyUserId: selectors.userFilter.value,
            sortBy: selectors.sortBy.value,
            sortOrder: selectors.sortOrder.value,
            limit: selectors.pageLimit.value
        };
    }

    function setLoadingState(message) {
        selectors.tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="lb-table-state">${message}</td>
            </tr>
        `;
    }

    function updateSummary(summary = {}) {
        selectors.summaryTotal.textContent = summary.total || 0;
        selectors.summaryPending.textContent = summary.pending || 0;
        selectors.summaryCompleted.textContent = summary.completed || 0;
        selectors.summaryAttention.textContent = (summary.partiallyCompleted || 0) + (summary.hold || 0) + (summary.clinical || 0);
    }

    function cacheBooking(booking) {
        localStorage.setItem("booking", JSON.stringify(booking));
        localStorage.setItem("regId", JSON.stringify(booking.bookingId));
    }

    function getReportPageName() {
        return user.role === "staff"
            ? (user.createdBy?.pdfFormat || user.pdfFormat)
            : user.pdfFormat;
    }

    function handleAction(action, bookingId) {
        const booking = state.bookings.find((item) => item.bookingId === bookingId);
        if (!booking) {
            return;
        }

        cacheBooking(booking);


        if (action === "edit") {
            window.open(`${BASE_URL}/admin/admin.html?page=ModifyCase&value1=${booking.bookingId}`, "_blank");
            return;
        }
    }

    function renderTable() {
        if (!state.bookings.length) {
            setLoadingState("No bookings found for the selected filters.");
            return;
        }

        selectors.tableBody.innerHTML = "";

        state.bookings.forEach((booking) => {
            const statusMeta = getStatusMeta(booking.status);
            const row = document.createElement("tr");
            row.style.backgroundColor = statusMeta.rowColor;

            const barcodeMarkup = (booking.barcodeList || [])
                .slice(0, 4)
                .map((barcode) => `<span class="lb-chip">${barcode}</span>`)
                .join("");

            row.innerHTML = `
                <td>
                    <span class="lb-booking-id">${booking.bookingId}</span>
                    <span class="lb-subtext">${booking.tableData?.length || 0} test items</span>
                </td>
                <td>
                    ${formatDate(booking.date || booking.createdAt)}
                    <span class="lb-subtext">${booking.time || formatDateTime(booking.createdAt)}</span>
                </td>
                <td>
                    <span style="font-weight: 700; color: #16324f;">${booking.patientName || "N/A"}</span>
                    <span class="lb-subtext">${booking.doctorName || booking.labName || "Direct / Walk-in"}</span>
                </td>
                <td>
                    <div class="lb-demographics">
                        <span class="lb-age-badge"><i class="fas fa-user-clock"></i> ${formatAge(booking.year)}</span>
                        ${formatGenderBadge(booking.gender)}
                    </div>
                </td>
                <td>
                    ${booking.createdBy?.fullName || booking.createdbyuser || "N/A"}
                    <span class="lb-subtext">${booking.createdBy?.role || "User"}</span>
                </td>
                <td>
                    <div class="lb-barcode-group">${barcodeMarkup || '<span class="lb-subtext">No barcode available</span>'}</div>
                </td>
                <td>
                <div class="lb-subtext">
                    ${
                        Array.isArray(booking.tableData) && booking.tableData.length
                            ? [...new Set(
                                booking.tableData
                                    .map(test => test.testName || test.pannelName)
                                    .filter(name => name && name !== "N/A")
                            )].join(", ")
                            : "N/A"
                    }
                </div>
                </td>
                <td>
                    <span class="lb-status-badge" style="background:${statusMeta.badgeBg}; color:${statusMeta.badgeColor};">${formatStatusLabel(booking.status)}</span>
                </td>
                <td style="text-align:center;white-space:nowrap;">
                    ${printAuditBadge(booking)}
                </td>
                <td>
                    <div class="lb-action-stack">
                        <button class="lb-action-btn" data-action="edit" data-booking-id="${booking.bookingId}">Edit</button>
                    </div>
                </td>
            `;

            selectors.tableBody.appendChild(row);
        });
    }

    function updatePagination() {
        selectors.paginationInfo.textContent = `Page ${state.page} of ${state.totalPages} • ${state.total} total bookings`;
        selectors.prevBtn.disabled = state.page <= 1;
        selectors.nextBtn.disabled = state.page >= state.totalPages;
    }

    async function fetchHierarchyUsers() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-franchisee-all`);
            const result = await response.json();

            if (!response.ok || !Array.isArray(result.data)) {
                return;
            }

            const roleOrder = {
                admin: 1,
                superFranchisee: 2,
                franchisee: 3,
                subFranchisee: 4
            };

            const users = result.data
                .filter((item) => item.role !== "staff")
                .sort((a, b) => {
                    const roleDiff = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
                    if (roleDiff !== 0) return roleDiff;
                    return (a.fullName || "").localeCompare(b.fullName || "");
                });

            users.forEach((item) => {
                const option = document.createElement("option");
                option.value = item._id;
                option.textContent = `${item.fullName || item.username} (${item.role})`;
                selectors.userFilter.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading hierarchy users:", error);
        }
    }

    async function fetchBookings() {
        const filters = getFilters();
        state.limit = parseInt(filters.limit, 10) || 20;
        setLoadingState("Loading bookings...");
        state.activeRequestId += 1;
        const requestId = state.activeRequestId;

        if (state.fetchController) {
            state.fetchController.abort();
        }

        state.fetchController = new AbortController();

        const queryParams = new URLSearchParams({
            page: String(state.page),
            limit: String(state.limit),
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder
        });

        if (filters.bookingOrBarcode) queryParams.set("bookingOrBarcode", filters.bookingOrBarcode);
        if (filters.patientName) queryParams.set("patientName", filters.patientName);
        if (filters.mobileNumber) queryParams.set("mobileNumber", filters.mobileNumber);
        if (filters.status) queryParams.set("status", filters.status);
        if (filters.startDate) queryParams.set("startDate", filters.startDate);
        if (filters.endDate) queryParams.set("endDate", filters.endDate);
        if (filters.hierarchyUserId) queryParams.set("hierarchyUserId", filters.hierarchyUserId);

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/list-bookings-admin?${queryParams.toString()}`, {
                signal: state.fetchController.signal
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to load bookings");
            }

            if (requestId !== state.activeRequestId) {
                return;
            }

            state.bookings = Array.isArray(result.bookings) ? result.bookings : [];
            state.total = result.total || 0;
            state.page = result.page || 1;
            state.totalPages = result.totalPages || 1;

            updateSummary(result.summary || {});
            renderTable();
            updatePagination();
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error("Error loading list bookings:", error);
            setLoadingState("Unable to load bookings right now. Please try again.");
            updateSummary({});
            state.bookings = [];
            state.total = 0;
            state.totalPages = 1;
            updatePagination();
        }
    }

    let searchDebounceTimer = null;

    function scheduleFetch(delay = 250) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = window.setTimeout(() => {
            fetchBookings();
        }, delay);
    }

    function exportExcel() {
        if (!window.XLSX || !state.bookings.length) {
            return;
        }

        const exportRows = state.bookings.map((booking) => ({
            "Booking ID": booking.bookingId,
            "Booking Date": formatDate(booking.date || booking.createdAt),
            "Patient Name": booking.patientName || "",
            "Age": formatAge(booking.year),
            "Gender": booking.gender || "",
            "Created User": booking.createdBy?.fullName || booking.createdbyuser || "",
            "Role": booking.createdBy?.role || "",
            "Barcodes": (booking.barcodeList || []).join(", "),
            "Status": formatStatusLabel(booking.status),
            "Lab Name": booking.labName || "",
            "Doctor Name": booking.doctorName || ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
        XLSX.writeFile(workbook, "list-bookings.xlsx");
    }

    function exportPdf() {
        if (!window.jspdf || !window.jspdf.jsPDF || !state.bookings.length) {
            return;
        }

        const doc = new window.jspdf.jsPDF({ orientation: "landscape" });
        const tableRows = state.bookings.map((booking) => ([
            booking.bookingId,
            formatDate(booking.date || booking.createdAt),
            booking.patientName || "",
            `${formatAge(booking.year)} / ${booking.gender || "N/A"}`,
            booking.createdBy?.fullName || booking.createdbyuser || "",
            (booking.barcodeList || []).join(", "),
            formatStatusLabel(booking.status)
        ]));

        doc.setFontSize(15);
        doc.text("List Booking", 14, 16);
        doc.autoTable({
            startY: 24,
            head: [["Booking ID", "Date", "Patient", "Age / Gender", "User", "Barcodes", "Status"]],
            body: tableRows,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [15, 108, 189] }
        });
        doc.save("list-bookings.pdf");
    }

    function resetFilters() {
        selectors.bookingOrBarcode.value = "";
        selectors.patientName.value = "";
        selectors.mobileNumber.value = "";
        selectors.statusFilter.value = "";
        selectors.startDate.value = "";
        selectors.endDate.value = "";
        selectors.userFilter.value = "";
        selectors.sortBy.value = "latest";
        selectors.sortOrder.value = "desc";
        selectors.pageLimit.value = "20";
        state.page = 1;
        fetchBookings();
    }

    selectors.searchBtn.addEventListener("click", () => {
        state.page = 1;
        scheduleFetch(0);
    });

    selectors.clearBtn.addEventListener("click", resetFilters);

    selectors.pageLimit.addEventListener("change", () => {
        state.page = 1;
        scheduleFetch(0);
    });

    selectors.prevBtn.addEventListener("click", () => {
        if (state.page > 1) {
            state.page -= 1;
            scheduleFetch(0);
        }
    });

    selectors.nextBtn.addEventListener("click", () => {
        if (state.page < state.totalPages) {
            state.page += 1;
            scheduleFetch(0);
        }
    });

    selectors.exportExcelBtn.addEventListener("click", exportExcel);
    selectors.exportPdfBtn.addEventListener("click", exportPdf);

    selectors.tableBody.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        handleAction(button.getAttribute("data-action"), button.getAttribute("data-booking-id"));
    });

    fetchHierarchyUsers();
    fetchBookings();
})();
