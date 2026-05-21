(function () {
    const form = document.getElementById("withdrawalForm");
    const rowsEl = document.getElementById("withdrawalRows");
    const submitBtn = document.getElementById("withdrawalSubmitBtn");

    function authHeaders(extra = {}) {
        const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || sessionStorage.getItem("token") || sessionStorage.getItem("accessToken");
        return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
    }

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

    function fillBankDetails(bankDetails) {
        if (!bankDetails) return;
        document.getElementById("accountHolderName").value = bankDetails.accountHolderName || "";
        document.getElementById("accountNumber").value = bankDetails.accountNumber || "";
        document.getElementById("ifscCode").value = bankDetails.ifscCode || "";
        document.getElementById("bankName").value = bankDetails.bankName || "";
    }

    async function loadBankDetails() {
        try {
            const response = await fetch("/api/v1/user/bank-details", {
                credentials: "include",
                headers: authHeaders()
            });
            const result = await response.json();
            if (response.ok && result.success) {
                fillBankDetails(result.data || result.bankDetails);
            }
        } catch (error) {
            console.warn("Bank details not loaded:", error);
        }
    }

    async function loadWithdrawalHistory() {
        if (!rowsEl) return;
        rowsEl.innerHTML = `<tr><td colspan="6" class="muted">Loading requests...</td></tr>`;

        try {
            const response = await fetch("/api/v1/user/withdrawals/history", {
                credentials: "include",
                headers: authHeaders()
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to load withdrawal history");
            }

            document.getElementById("withdrawalBalance").textContent = formatCurrency(result.commissionWallet);
            const requests = result.withdrawalRequests || [];

            if (!requests.length) {
                rowsEl.innerHTML = `<tr><td colspan="6" class="muted">No withdrawal requests found.</td></tr>`;
                return;
            }

            rowsEl.innerHTML = requests.slice().reverse().map((request) => `
                <tr>
                    <td>${formatDate(request.requestedAt)}</td>
                    <td>${request.requestId || "-"}</td>
                    <td>${formatCurrency(request.amount)}</td>
                    <td>${request.bankDetails?.bankName || "-"}<br><span class="muted">${request.bankDetails?.accountNumber ? "****" + String(request.bankDetails.accountNumber).slice(-4) : ""}</span></td>
                    <td><span class="status ${request.status}">${request.status || "pending"}</span></td>
                    <td>${request.payoutReference || request.rejectionReason || "-"}</td>
                </tr>
            `).join("");
        } catch (error) {
            console.error("Error loading withdrawal history:", error);
            rowsEl.innerHTML = `<tr><td colspan="6" class="muted">${error.message}</td></tr>`;
        }
    }

    async function submitWithdrawal(event) {
        event.preventDefault();

        const amount = Number(document.getElementById("withdrawalAmount").value);
        if (!Number.isFinite(amount) || amount < 100) {
            alert("Minimum withdrawal amount is Rs.100");
            return;
        }

        const bankDetails = {
            accountHolderName: document.getElementById("accountHolderName").value.trim(),
            accountNumber: document.getElementById("accountNumber").value.trim(),
            ifscCode: document.getElementById("ifscCode").value.trim().toUpperCase(),
            bankName: document.getElementById("bankName").value.trim()
        };

        if (!bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
            alert("Please fill complete bank details.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            const response = await fetch("/api/v1/user/request-withdrawal", {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ amount, bankDetails })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Withdrawal request failed");
            }

            alert("Withdrawal request submitted successfully.");
            document.getElementById("withdrawalAmount").value = "";
            await loadWithdrawalHistory();
        } catch (error) {
            console.error("Withdrawal request error:", error);
            alert(error.message || "Withdrawal request failed");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Request";
        }
    }

    if (form && !form.dataset.bound) {
        form.addEventListener("submit", submitWithdrawal);
        form.dataset.bound = "true";
    }

    loadBankDetails();
    loadWithdrawalHistory();
})();
