(function () {
    const rowsEl = document.getElementById("withdrawalRequestRows");
    const filterEl = document.getElementById("withdrawalStatusFilter");
    const loadBtn = document.getElementById("loadWithdrawalsBtn");

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

    async function loadWithdrawalRequests() {
        rowsEl.innerHTML = `<tr><td colspan="7" class="muted">Loading requests...</td></tr>`;
        const params = new URLSearchParams();
        if (filterEl?.value) params.set("status", filterEl.value);

        try {
            const response = await fetch(`/api/v1/user/all-withdrawals?${params.toString()}`, {
                credentials: "include",
                headers: authHeaders()
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to load withdrawal requests");
            }

            const requests = result.withdrawalRequests || [];
            if (!requests.length) {
                rowsEl.innerHTML = `<tr><td colspan="7" class="muted">No requests found.</td></tr>`;
                return;
            }

            rowsEl.innerHTML = requests.map((item) => {
                const req = item.withdrawalRequest;
                const bank = req.bankDetails || {};
                const canAct = req.status === "pending";
                return `
                    <tr>
                        <td>${formatDate(req.requestedAt)}</td>
                        <td>${item.fullName || "-"}<br><span class="muted">${item.email || ""}</span></td>
                        <td>${item.role || "-"}</td>
                        <td>${formatCurrency(req.amount)}</td>
                        <td>${bank.accountHolderName || "-"}<br>${bank.bankName || ""}<br>${bank.accountNumber || ""}<br>${bank.ifscCode || ""}</td>
                        <td>${req.status || "pending"}<br><span class="muted">${req.payoutStatus || ""}</span></td>
                        <td>
                            ${canAct ? `
                                <button class="btn-approve" data-action="approve" data-user="${item._id}" data-request="${req.requestId}">Approve</button>
                                <button class="btn-reject" data-action="reject" data-user="${item._id}" data-request="${req.requestId}">Reject</button>
                            ` : "-"}
                        </td>
                    </tr>
                `;
            }).join("");
        } catch (error) {
            console.error("Withdrawal requests error:", error);
            rowsEl.innerHTML = `<tr><td colspan="7" class="muted">${error.message}</td></tr>`;
        }
    }

    async function processRequest(button) {
        const action = button.dataset.action;
        const body = {
            action,
            userId: button.dataset.user,
            requestId: button.dataset.request
        };

        if (action === "reject") {
            body.rejectionReason = prompt("Rejection reason") || "Rejected by SuperAdmin";
        }

        button.disabled = true;
        try {
            const response = await fetch("/api/v1/user/process-withdrawal", {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body)
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to process request");
            }

            alert(result.message || "Request processed");
            await loadWithdrawalRequests();
        } catch (error) {
            console.error("Process withdrawal error:", error);
            alert(error.message || "Failed to process request");
        } finally {
            button.disabled = false;
        }
    }

    if (loadBtn && !loadBtn.dataset.bound) {
        loadBtn.addEventListener("click", loadWithdrawalRequests);
        loadBtn.dataset.bound = "true";
    }

    if (rowsEl && !rowsEl.dataset.bound) {
        rowsEl.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");
            if (button) processRequest(button);
        });
        rowsEl.dataset.bound = "true";
    }

    loadWithdrawalRequests();
})();
