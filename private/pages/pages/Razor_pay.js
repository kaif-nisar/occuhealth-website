(function () {
    const rowsEl = document.getElementById("razorPaymentRows");
    const searchBtn = document.getElementById("razorSearchBtn");

    function formatCurrency(value) {
        return "Rs." + Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(value) {
        if (!value) return "-";
        return new Date(value).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function authHeaders() {
        const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || sessionStorage.getItem("token") || sessionStorage.getItem("accessToken");
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    async function loadRazorpayHistory() {
        if (!rowsEl) return;

        rowsEl.innerHTML = `<tr><td colspan="8" class="muted">Loading transactions...</td></tr>`;

        const params = new URLSearchParams();
        const startDate = document.getElementById("razorStartDate")?.value;
        const endDate = document.getElementById("razorEndDate")?.value;
        const search = document.getElementById("razorSearch")?.value.trim();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (search) params.set("search", search);

        try {
            const response = await fetch(`/api/v1/user/wallet-topup-history?${params.toString()}`, {
                credentials: "include",
                headers: authHeaders()
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to load payment history");
            }

            const { transactions, balances, total } = result.data;
            document.getElementById("razorBookingWallet").textContent = formatCurrency(balances.bookingWallet);
            document.getElementById("razorCommissionWallet").textContent = formatCurrency(balances.commissionWallet);
            document.getElementById("razorTransactionCount").textContent = total || 0;

            if (!transactions.length) {
                rowsEl.innerHTML = `<tr><td colspan="8" class="muted">No Razorpay transactions found.</td></tr>`;
                return;
            }

            rowsEl.innerHTML = transactions.map((entry) => `
                <tr>
                    <td>${formatDate(entry.createdAt)}</td>
                    <td>${entry.transactionId || "-"}</td>
                    <td>${entry.razorpayPaymentId || "-"}</td>
                    <td>${formatCurrency(entry.amount)}</td>
                    <td>${entry.walletType || "-"}</td>
                    <td>${entry.receivedFrom || "-"}</td>
                    <td>${entry.remarks || entry.description || "-"}</td>
                    <td><span class="status">captured</span></td>
                </tr>
            `).join("");
        } catch (error) {
            console.error("Error loading Razorpay history:", error);
            rowsEl.innerHTML = `<tr><td colspan="8" class="muted">${error.message}</td></tr>`;
        }
    }

    if (searchBtn && !searchBtn.dataset.bound) {
        searchBtn.addEventListener("click", loadRazorpayHistory);
        searchBtn.dataset.bound = "true";
    }

    loadRazorpayHistory();
})();
