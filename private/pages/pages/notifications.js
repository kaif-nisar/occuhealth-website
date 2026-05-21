(function () {
    const state = {
        items: [],
        filter: "all"
    };

    const elements = {
        list: document.getElementById("npList"),
        totalCount: document.getElementById("npTotalCount"),
        unreadCount: document.getElementById("npUnreadCount"),
        readCount: document.getElementById("npReadCount"),
        refreshBtn: document.getElementById("npRefreshBtn"),
        markVisibleBtn: document.getElementById("npMarkVisibleBtn"),
        filterChips: Array.from(document.querySelectorAll(".np-filter-chip"))
    };

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

    function setSummary() {
        const unread = state.items.filter((item) => !item.isRead).length;
        const read = state.items.length - unread;

        elements.totalCount.textContent = state.items.length;
        elements.unreadCount.textContent = unread;
        elements.readCount.textContent = read;
    }

    function getVisibleItems() {
        if (state.filter === "unread") {
            return state.items.filter((item) => !item.isRead);
        }

        if (state.filter === "read") {
            return state.items.filter((item) => item.isRead);
        }

        return state.items;
    }

    function renderList() {
        const visibleItems = getVisibleItems();

        if (!visibleItems.length) {
            elements.list.innerHTML = `<div class="np-empty">No notifications available for this view.</div>`;
            return;
        }

        elements.list.innerHTML = visibleItems.map((item) => `
            <article class="np-item ${item.isRead ? "read" : "unread"}" data-id="${item._id}">
                <div class="np-item-top">
                    <div>
                        <h2 class="np-item-title">${item.relatedbooking?.patientName || "Booking Notification"}</h2>
                        <div class="np-item-meta">
                            <span class="np-pill ${item.isRead ? "np-pill-read" : "np-pill-unread"}">${item.readStatus}</span>
                            <span class="np-pill np-pill-read">${formatDateTime(item.timestamp)}</span>
                        </div>
                    </div>
                    <div>
                        ${item.isRead ? "" : `<button class="np-button np-button-primary" data-mark-read="${item._id}">Mark Read</button>`}
                    </div>
                </div>
                <p class="np-item-message">${item.lastMessage?.message || "No message available."}</p>
                <div class="np-item-grid">
                    <div class="np-item-stat">
                        <div class="np-item-stat-label">Booking ID</div>
                        <div class="np-item-stat-value">${item.relatedbooking?.bookingId || item.bookingId || "N/A"}</div>
                    </div>
                    <div class="np-item-stat">
                        <div class="np-item-stat-label">Patient</div>
                        <div class="np-item-stat-value">${item.relatedbooking?.patientName || "N/A"}</div>
                    </div>
                    <div class="np-item-stat">
                        <div class="np-item-stat-label">User</div>
                        <div class="np-item-stat-value">${item.relatedbooking?.createdBy?.username || item.relatedbooking?.createdbyuser || "N/A"}</div>
                    </div>
                </div>
                <div class="np-item-footer">
                    <div style="color:#60758b; font-size:13px;">${item.isRead ? "Reviewed" : "Needs attention"}</div>
                </div>
            </article>
        `).join("");
    }

    async function refreshGlobalUnreadIndicators() {
        if (typeof fetchNotifications === "function") {
            await fetchNotifications();
        }
    }

    async function markAsRead(notificationId) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/changewatchedstatus/${notificationId}`);
            if (!response.ok) {
                throw new Error("Failed to update notification");
            }

            await loadNotifications();
            await refreshGlobalUnreadIndicators();
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }

    async function markVisibleAsRead() {
        const unreadIds = getVisibleItems()
            .filter((item) => !item.isRead)
            .map((item) => item._id);

        if (!unreadIds.length) {
            return;
        }

        for (const id of unreadIds) {
            // Sequential updates keep existing backend untouched and predictable
            await markAsRead(id);
        }
    }

    async function loadNotifications() {
        elements.list.innerHTML = `<div class="np-empty">Loading notifications...</div>`;

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-notifications`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to fetch notifications");
            }

            state.items = Array.isArray(result.notifications) ? result.notifications : [];
            setSummary();
            renderList();
        } catch (error) {
            console.error("Error loading notifications page:", error);
            elements.list.innerHTML = `<div class="np-empty">Unable to load notifications right now.</div>`;
            state.items = [];
            setSummary();
        }
    }

    elements.filterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            state.filter = chip.getAttribute("data-filter");
            elements.filterChips.forEach((item) => item.classList.remove("active"));
            chip.classList.add("active");
            renderList();
        });
    });

    elements.refreshBtn.addEventListener("click", loadNotifications);
    elements.markVisibleBtn.addEventListener("click", markVisibleAsRead);

    elements.list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-mark-read]");
        if (!button) {
            return;
        }

        markAsRead(button.getAttribute("data-mark-read"));
    });

    loadNotifications();
})();
