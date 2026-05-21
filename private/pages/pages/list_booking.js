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

    function getStatusMeta(status) {
        const normalized = (status || "").trim().toLowerCase();

        if (normalized === "completed") {
            return {
                rowColor: "rgba(22, 163, 74, 0.10)",
                badgeBg: "#dcfce7",
                badgeColor: "#166534"
            };
        }

        if (normalized === "partially completed") {
            return {
                rowColor: "rgba(37, 99, 235, 0.10)",
                badgeBg: "#dbeafe",
                badgeColor: "#1d4ed8"
            };
        }

        if (normalized === "pending") {
            return {
                rowColor: "rgba(217, 119, 6, 0.10)",
                badgeBg: "#fef3c7",
                badgeColor: "#b45309"
            };
        }

        if (normalized === "hold" || normalized === "on hold") {
            return {
                rowColor: "rgba(220, 38, 38, 0.10)",
                badgeBg: "#fee2e2",
                badgeColor: "#b91c1c"
            };
        }

        if (normalized === "clinical" || normalized === "clinical stated") {
            return {
                rowColor: "rgba(13, 148, 136, 0.10)",
                badgeBg: "#ccfbf1",
                badgeColor: "#0f766e"
            };
        }

        return {
            rowColor: "rgba(71, 85, 105, 0.08)",
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
                <td colspan="8" class="lb-table-state">${message}</td>
            </tr>
        `;
    }

    function updateSummary(summary = {}) {
        selectors.summaryTotal.textContent = summary.total || 0;
        selectors.summaryPending.textContent = summary.pending || 0;
        selectors.summaryCompleted.textContent = summary.completed || 0;
        selectors.summaryAttention.textContent = (summary.partiallyCompleted || 0) + (summary.hold || 0);
    }

    function cacheBooking(booking) {
        localStorage.setItem("booking", JSON.stringify(booking));
        localStorage.setItem("regId", JSON.stringify(booking.bookingId));
    }

    function getReportPageName() {
        return user.role === "staff"
            ? user.tenantId.adminDetails.userId.pdfFormat
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
                    ${booking.patientName || "N/A"}
                    <span class="lb-subtext">${booking.gender || "N/A"}${booking.year ? `, ${booking.year}` : ""}</span>
                </td>
                <td>
                    ${booking.patientPhone || "N/A"}
                    <span class="lb-subtext">${booking.labName || booking.doctorName || "No lab / doctor"}</span>
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
                    <span class="lb-status-badge" style="background:${statusMeta.badgeBg}; color:${statusMeta.badgeColor};">${booking.status || "N/A"}</span>
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
            "Mobile Number": booking.patientPhone || "",
            "Created User": booking.createdBy?.fullName || booking.createdbyuser || "",
            "Role": booking.createdBy?.role || "",
            "Barcodes": (booking.barcodeList || []).join(", "),
            "Status": booking.status || "",
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
            booking.patientPhone || "",
            booking.createdBy?.fullName || booking.createdbyuser || "",
            (booking.barcodeList || []).join(", "),
            booking.status || ""
        ]));

        doc.setFontSize(15);
        doc.text("List Booking", 14, 16);
        doc.autoTable({
            startY: 24,
            head: [["Booking ID", "Date", "Patient", "Mobile", "User", "Barcodes", "Status"]],
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
