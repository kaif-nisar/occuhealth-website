(function () {
    let rawPackages = [];
    let filteredPackages = [];
    let currentPage = 1;
    let pageSize = 25;

    const BASE_URL = window.BASE_URL || window.location.origin;

    // DOM Elements
    const tbody = document.getElementById("pkgTbody");
    const stateBox = document.getElementById("pkgStateBox");
    const searchInput = document.getElementById("pkgSearchInput");
    const clearSearchBtn = document.getElementById("pkgClearSearch");
    const genderFilter = document.getElementById("pkgGenderFilter");
    const sortFilter = document.getElementById("pkgSortFilter");
    const pageSizeSelect = document.getElementById("pkgPageSize");
    const paginationInfo = document.getElementById("pkgPaginationInfo");
    const paginationControls = document.getElementById("pkgPaginationControls");

    // Stats
    const statTotalPackages = document.getElementById("statTotalPackages");
    const statAvgPackageFee = document.getElementById("statAvgPackageFee");
    const statTotalPanelsInPkg = document.getElementById("statTotalPanelsInPkg");
    const statTotalTestsInPkg = document.getElementById("statTotalTestsInPkg");

    initPackageDatabase();

    async function initPackageDatabase() {
        bindEvents();
        await fetchPackages();
    }

    function bindEvents() {
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener("input", () => {
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = searchInput.value ? "block" : "none";
                }
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    currentPage = 1;
                    applyFilters();
                }, 180);
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener("click", () => {
                searchInput.value = "";
                clearSearchBtn.style.display = "none";
                currentPage = 1;
                applyFilters();
                searchInput.focus();
            });
        }

        if (genderFilter) {
            genderFilter.addEventListener("change", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (sortFilter) {
            sortFilter.addEventListener("change", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener("change", (e) => {
                const val = e.target.value;
                pageSize = val === "all" ? 999999 : parseInt(val, 10);
                currentPage = 1;
                renderTable();
            });
        }
    }

    async function fetchPackages() {
        renderState("loading", "Loading packages...", "Retrieving bundled health checkup packages");
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-packages-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: Failed to fetch packages`);
            }

            const data = await response.json();
            rawPackages = Array.isArray(data.packages) ? data.packages : [];

            updateStats();
            applyFilters();
        } catch (error) {
            console.error("Error fetching packages:", error);
            renderState("error", "Failed to Load Packages", error.message || "Please check your network and try again.");
        }
    }

    function updateStats() {
        if (statTotalPackages) statTotalPackages.textContent = rawPackages.length;

        let totalFee = 0;
        let pricedCount = 0;
        let totalPanels = 0;
        let totalTests = 0;

        rawPackages.forEach((pkg) => {
            const fee = parseFloat(pkg.packageFee);
            if (!isNaN(fee)) {
                totalFee += fee;
                pricedCount++;
            }

            if (Array.isArray(pkg.pannelname)) totalPanels += pkg.pannelname.length;
            if (Array.isArray(pkg.testname)) totalTests += pkg.testname.length;
        });

        if (statAvgPackageFee) {
            const avg = pricedCount > 0 ? Math.round(totalFee / pricedCount) : 0;
            statAvgPackageFee.textContent = `₹${avg}`;
        }
        if (statTotalPanelsInPkg) statTotalPanelsInPkg.textContent = totalPanels;
        if (statTotalTestsInPkg) statTotalTestsInPkg.textContent = totalTests;
    }

    function applyFilters() {
        const query = (searchInput?.value || "").trim().toLowerCase();
        const selectedGender = (genderFilter?.value || "").toLowerCase();
        const sortMode = sortFilter?.value || "name-asc";

        filteredPackages = rawPackages.filter((pkg) => {
            const name = (pkg.packageName || "").toLowerCase();
            const testsText = Array.isArray(pkg.testname) ? pkg.testname.join(" ").toLowerCase() : "";
            const panelsText = Array.isArray(pkg.pannelname) ? pkg.pannelname.join(" ").toLowerCase() : "";
            const gender = (pkg.packageGender || pkg.packagegender || "both").toLowerCase();

            const matchesQuery = !query ||
                name.includes(query) ||
                testsText.includes(query) ||
                panelsText.includes(query);

            const matchesGender = !selectedGender || gender === selectedGender || gender === "both";

            return matchesQuery && matchesGender;
        });

        filteredPackages.sort((a, b) => {
            if (sortMode === "name-asc") return (a.packageName || "").localeCompare(b.packageName || "");
            if (sortMode === "name-desc") return (b.packageName || "").localeCompare(a.packageName || "");
            if (sortMode === "price-asc") return (parseFloat(a.packageFee) || 0) - (parseFloat(b.packageFee) || 0);
            if (sortMode === "price-desc") return (parseFloat(b.packageFee) || 0) - (parseFloat(a.packageFee) || 0);
            if (sortMode === "items-desc") {
                const countA = (a.testname?.length || 0) + (a.pannelname?.length || 0);
                const countB = (b.testname?.length || 0) + (b.pannelname?.length || 0);
                return countB - countA;
            }
            return 0;
        });

        renderTable();
    }

    function renderTable() {
        if (!tbody) return;

        if (filteredPackages.length === 0) {
            tbody.innerHTML = "";
            renderState(
                "empty",
                "No matching packages found",
                rawPackages.length === 0
                    ? "Your database doesn't have any packages yet. Click '+ Add Package' above to create one."
                    : "Try adjusting your search query or clear the gender filter."
            );
            if (paginationInfo) paginationInfo.textContent = "Showing 0 of 0 packages";
            if (paginationControls) paginationControls.innerHTML = "";
            return;
        }

        clearState();

        const totalItems = filteredPackages.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageItems = filteredPackages.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();

        pageItems.forEach((pkg, idx) => {
            const row = document.createElement("tr");

            const price = pkg.packageFee != null ? `₹${pkg.packageFee}` : "-";
            const mrp = pkg.final_price ? `₹${pkg.final_price}` : "";
            const gender = (pkg.packageGender || pkg.packagegender || "both").toLowerCase();
            const genderClass = gender === "female" ? "female" : (gender === "male" ? "male" : "");

            // Sample types formatting
            const allSamples = new Set();
            if (Array.isArray(pkg.testSample)) {
                pkg.testSample.flat(Infinity).forEach(s => s && allSamples.add(String(s).trim()));
            }
            if (Array.isArray(pkg.pannelSample)) {
                pkg.pannelSample.flat(Infinity).forEach(s => s && allSamples.add(String(s).trim()));
            }

            let sampleBadge = "";
            if (allSamples.size > 0) {
                sampleBadge = Array.from(allSamples)
                    .map(s => `<span class="pkg-badge pkg-badge-sample"><i class="fa-solid fa-droplet" style="font-size:0.6rem;"></i> ${escapeHtml(s)}</span>`)
                    .join(" ");
            } else {
                sampleBadge = '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';
            }

            // Items formatting
            const panelsList = Array.isArray(pkg.pannelname) ? pkg.pannelname.filter(Boolean) : [];
            const testsList = Array.isArray(pkg.testname) ? pkg.testname.filter(Boolean) : [];

            let itemsHtml = '<div class="pkg-items-chips">';
            if (panelsList.length > 0) {
                itemsHtml += `
                    <div class="pkg-items-group">
                        <span class="pkg-group-label">Panels (${panelsList.length}):</span>
                        ${panelsList.slice(0, 3).map(p => `<span class="pkg-chip panel" title="${escapeHtml(p)}">${escapeHtml(p)}</span>`).join("")}
                        ${panelsList.length > 3 ? `<span class="pkg-chip panel" title="${escapeHtml(panelsList.slice(3).join(', '))}">+${panelsList.length - 3}</span>` : ""}
                    </div>
                `;
            }
            if (testsList.length > 0) {
                itemsHtml += `
                    <div class="pkg-items-group">
                        <span class="pkg-group-label">Tests (${testsList.length}):</span>
                        ${testsList.slice(0, 3).map(t => `<span class="pkg-chip" title="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join("")}
                        ${testsList.length > 3 ? `<span class="pkg-chip" title="${escapeHtml(testsList.slice(3).join(', '))}">+${testsList.length - 3}</span>` : ""}
                    </div>
                `;
            }
            if (panelsList.length === 0 && testsList.length === 0) {
                itemsHtml += '<span style="color:#94a3b8; font-size:0.75rem;">No items attached</span>';
            }
            itemsHtml += '</div>';

            row.innerHTML = `
                <td class="center"><span class="pkg-order-num">${startIndex + idx + 1}</span></td>
                <td>
                    <div class="pkg-name-cell">
                        ${escapeHtml(pkg.packageName || "Unnamed Package")}
                    </div>
                </td>
                <td>
                    <span class="pkg-badge pkg-badge-gender ${genderClass}">
                        ${gender === "female" ? '<i class="fa-solid fa-venus"></i>' : (gender === "male" ? '<i class="fa-solid fa-mars"></i>' : '<i class="fa-solid fa-venus-mars"></i>')}
                        ${escapeHtml(gender)}
                    </span>
                </td>
                <td>${itemsHtml}</td>
                <td>${sampleBadge}</td>
                <td class="right">
                    <span class="pkg-price-val">${price}</span>
                    ${mrp ? `<span class="pkg-mrp-val" title="MRP">${mrp}</span>` : ""}
                </td>
                <td class="center">
                    <button type="button" class="pkg-action-btn" data-id="${pkg._id}">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                </td>
            `;

            const editBtn = row.querySelector(".pkg-action-btn");
            if (editBtn) {
                editBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    navigateToEdit(pkg._id);
                });
            }

            fragment.appendChild(row);
        });

        tbody.innerHTML = "";
        tbody.appendChild(fragment);

        renderPagination(startIndex + 1, endIndex, totalItems, totalPages);
    }

    function navigateToEdit(packageId) {
        if (!packageId) return;
        if (typeof window.loadPage === "function") {
            window.loadPage("editPackage", packageId);
        } else {
            window.location.href = `?page=editPackage&Name=${encodeURIComponent(packageId)}`;
        }
    }

    // Pagination
    function renderPagination(start, end, total, totalPages) {
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${start} to ${end} of ${total} packages`;
        }

        if (!paginationControls) return;
        paginationControls.innerHTML = "";

        if (totalPages <= 1) return;

        const prevBtn = document.createElement("button");
        prevBtn.className = "pkg-page-btn";
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        };
        paginationControls.appendChild(prevBtn);

        let pagesToShow = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
        } else {
            pagesToShow.push(1);
            if (currentPage > 3) pagesToShow.push("...");
            const midStart = Math.max(2, currentPage - 1);
            const midEnd = Math.min(totalPages - 1, currentPage + 1);
            for (let i = midStart; i <= midEnd; i++) {
                if (!pagesToShow.includes(i)) pagesToShow.push(i);
            }
            if (currentPage < totalPages - 2) pagesToShow.push("...");
            if (!pagesToShow.includes(totalPages)) pagesToShow.push(totalPages);
        }

        pagesToShow.forEach((p) => {
            if (p === "...") {
                const ellipsis = document.createElement("span");
                ellipsis.style.padding = "0 6px";
                ellipsis.style.color = "#94a3b8";
                ellipsis.textContent = "...";
                paginationControls.appendChild(ellipsis);
            } else {
                const pageBtn = document.createElement("button");
                pageBtn.className = `pkg-page-btn ${p === currentPage ? "active" : ""}`;
                pageBtn.textContent = p;
                pageBtn.onclick = () => {
                    currentPage = p;
                    renderTable();
                };
                paginationControls.appendChild(pageBtn);
            }
        });

        const nextBtn = document.createElement("button");
        nextBtn.className = "pkg-page-btn";
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        };
        paginationControls.appendChild(nextBtn);
    }

    function renderState(type, title, desc) {
        if (!stateBox) return;
        stateBox.style.display = "block";

        let icon = "fa-spinner fa-spin";
        if (type === "empty") icon = "fa-folder-open";
        if (type === "error") icon = "fa-triangle-exclamation";

        stateBox.innerHTML = `
            <div class="pkg-state-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="pkg-state-title">${escapeHtml(title)}</div>
            <div class="pkg-state-desc">${escapeHtml(desc)}</div>
            ${type === "error" ? '<button type="button" class="pkg-btn pkg-btn-primary" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Retry</button>' : ""}
        `;
    }

    function clearState() {
        if (stateBox) {
            stateBox.style.display = "none";
            stateBox.innerHTML = "";
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
