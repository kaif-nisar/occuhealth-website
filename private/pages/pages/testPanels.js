(function () {
    // Scoped state to avoid polluting global namespace
    let rawPanels = [];
    let filteredPanels = [];
    let currentPage = 1;
    let pageSize = 25;
    let isSavingOrder = false;
    let activeHighlightPanelId = null;
    let movingPanelTarget = null; // Used for the Move modal

    const BASE_URL = window.BASE_URL || window.location.origin;

    // DOM Elements
    const tbody = document.getElementById("pdbTbody");
    const stateBox = document.getElementById("pdbStateBox");
    const searchInput = document.getElementById("pdbSearchInput");
    const clearSearchBtn = document.getElementById("pdbClearSearch");
    const categoryFilter = document.getElementById("pdbCategoryFilter");
    const sortFilter = document.getElementById("pdbSortFilter");
    const pageSizeSelect = document.getElementById("pdbPageSize");
    const paginationInfo = document.getElementById("pdbPaginationInfo");
    const paginationControls = document.getElementById("pdbPaginationControls");

    // Stat Cards
    const cardTotalPanels = document.getElementById("cardTotalPanels");
    const cardPanelCategories = document.getElementById("cardPanelCategories");
    const cardPanelPrice = document.getElementById("cardPanelPrice");
    const cardTotalTestsLinked = document.getElementById("cardTotalTestsLinked");

    const statTotalPanels = document.getElementById("statTotalPanels");
    const statPanelCategories = document.getElementById("statPanelCategories");
    const statAvgPanelPrice = document.getElementById("statAvgPanelPrice");
    const statTotalTestsLinked = document.getElementById("statTotalTestsLinked");

    const statSubTotalPanels = document.getElementById("statSubTotalPanels");
    const statSubPanelCategory = document.getElementById("statSubPanelCategory");
    const statSubPanelPrice = document.getElementById("statSubPanelPrice");
    const statSubTestsLinked = document.getElementById("statSubTestsLinked");

    // Active Filter Banner
    const activeFiltersBar = document.getElementById("pdbActiveFiltersBar");
    const activeFilterDesc = document.getElementById("pdbActiveFilterDesc");
    const resetAllFiltersBtn = document.getElementById("pdbResetAllFiltersBtn");

    // Move Modal Elements
    const moveModal = document.getElementById("pdbMoveModal");
    const moveModalClose = document.getElementById("pdbMoveModalClose");
    const moveModalCancel = document.getElementById("pdbMoveModalCancel");
    const moveModalApply = document.getElementById("pdbMoveModalApply");
    const modalPanelName = document.getElementById("pdbModalPanelName");
    const modalCurrentRank = document.getElementById("pdbModalCurrentRank");
    const modalTotalPanels = document.getElementById("pdbModalTotalPanels");
    const modalTargetRank = document.getElementById("pdbModalTargetRank");
    const modalMaxRank = document.getElementById("pdbModalMaxRank");
    const presetTop = document.getElementById("pdbPresetTop");
    const presetPrev10 = document.getElementById("pdbPresetPrev10");
    const presetNext10 = document.getElementById("pdbPresetNext10");
    const presetBottom = document.getElementById("pdbPresetBottom");

    // Full Organizer Modal Elements
    const organizerModal = document.getElementById("pdbOrganizerModal");
    const openOrganizerBtn = document.getElementById("pdbOpenOrganizerBtn");
    const organizerModalClose = document.getElementById("pdbOrganizerModalClose");
    const organizerCloseBtn = document.getElementById("pdbOrganizerCloseBtn");
    const organizerSearch = document.getElementById("pdbOrganizerSearch");
    const organizerCount = document.getElementById("pdbOrganizerCount");
    const organizerList = document.getElementById("pdbOrganizerList");

    // Initialize
    initPanelDatabase();

    async function initPanelDatabase() {
        bindEvents();
        await fetchPanels();
    }

    function bindEvents() {
        // Search input with debounce
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
                }, 160);
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

        if (categoryFilter) {
            categoryFilter.addEventListener("change", () => {
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

        // Reset all filters button
        if (resetAllFiltersBtn) {
            resetAllFiltersBtn.addEventListener("click", () => {
                resetAllFilters();
            });
        }

        // Interactive Stat Cards
        if (cardTotalPanels) {
            cardTotalPanels.addEventListener("click", () => {
                resetAllFilters();
                showToast("Showing all panels in catalog sequence", "info");
            });
        }

        if (cardPanelCategories) {
            cardPanelCategories.addEventListener("click", () => {
                if (categoryFilter) {
                    categoryFilter.focus();
                    showToast("Select a category to filter panels", "info");
                }
            });
        }

        if (cardPanelPrice) {
            cardPanelPrice.addEventListener("click", () => {
                if (!sortFilter) return;
                // Cycle sort: price-asc -> price-desc -> order
                if (sortFilter.value === "price-asc") {
                    sortFilter.value = "price-desc";
                    showToast("Sorted by Price: High to Low", "info");
                } else if (sortFilter.value === "price-desc") {
                    sortFilter.value = "order";
                    showToast("Sorted by Catalog Sequence", "info");
                } else {
                    sortFilter.value = "price-asc";
                    showToast("Sorted by Price: Low to High", "info");
                }
                currentPage = 1;
                applyFilters();
            });
        }

        if (cardTotalTestsLinked) {
            cardTotalTestsLinked.addEventListener("click", () => {
                if (!sortFilter) return;
                sortFilter.value = "tests-desc";
                showToast("Sorted by Most Tests Included", "info");
                currentPage = 1;
                applyFilters();
            });
        }

        // Move Modal Events
        if (moveModalClose) moveModalClose.addEventListener("click", closeMoveModal);
        if (moveModalCancel) moveModalCancel.addEventListener("click", closeMoveModal);
        if (moveModalApply) moveModalApply.addEventListener("click", handleApplyMove);

        if (presetTop) {
            presetTop.addEventListener("click", () => {
                if (modalTargetRank) modalTargetRank.value = 1;
            });
        }
        if (presetBottom) {
            presetBottom.addEventListener("click", () => {
                if (modalTargetRank) modalTargetRank.value = rawPanels.length;
            });
        }
        if (presetPrev10) {
            presetPrev10.addEventListener("click", () => {
                if (modalTargetRank && movingPanelTarget) {
                    const curr = parseInt(modalTargetRank.value, 10) || movingPanelTarget.currentRank;
                    modalTargetRank.value = Math.max(1, curr - 10);
                }
            });
        }
        if (presetNext10) {
            presetNext10.addEventListener("click", () => {
                if (modalTargetRank && movingPanelTarget) {
                    const curr = parseInt(modalTargetRank.value, 10) || movingPanelTarget.currentRank;
                    modalTargetRank.value = Math.min(rawPanels.length, curr + 10);
                }
            });
        }

        if (modalTargetRank) {
            modalTargetRank.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyMove();
                }
            });
        }

        // Full Organizer Modal Events
        if (openOrganizerBtn) {
            openOrganizerBtn.addEventListener("click", () => {
                openOrganizer();
            });
        }
        if (organizerModalClose) organizerModalClose.addEventListener("click", closeOrganizer);
        if (organizerCloseBtn) organizerCloseBtn.addEventListener("click", closeOrganizer);

        if (organizerSearch) {
            organizerSearch.addEventListener("input", () => {
                renderOrganizerList();
            });
        }
    }

    function resetAllFilters() {
        if (searchInput) searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
        if (categoryFilter) categoryFilter.value = "";
        if (sortFilter) sortFilter.value = "order";
        currentPage = 1;
        applyFilters();
    }

    function renderSkeletonRows() {
        if (!tbody) return;
        tbody.innerHTML = `
            <tr class="pdb-skeleton-row"><td colspan="8"><div class="pdb-shimmer"></div></td></tr>
            <tr class="pdb-skeleton-row"><td colspan="8"><div class="pdb-shimmer"></div></td></tr>
            <tr class="pdb-skeleton-row"><td colspan="8"><div class="pdb-shimmer"></div></td></tr>
            <tr class="pdb-skeleton-row"><td colspan="8"><div class="pdb-shimmer"></div></td></tr>
            <tr class="pdb-skeleton-row"><td colspan="8"><div class="pdb-shimmer"></div></td></tr>
        `;
    }

    async function fetchPanels() {
        renderSkeletonRows();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: Failed to fetch panels`);
            }

            const data = await response.json();
            rawPanels = Array.isArray(data.panels) ? data.panels : [];

            // Sort and normalize orders sequentially: 1, 2, ..., N
            normalizePanelOrders();

            populateCategories();
            updateStats();
            applyFilters();
        } catch (error) {
            console.error("Error fetching panels:", error);
            renderState("error", "Failed to Load Panels", error.message || "Please check your network and try again.");
        }
    }

    // Normalizes panel order numbers sequentially: 1, 2, 3, ..., N
    function normalizePanelOrders() {
        rawPanels.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        rawPanels.forEach((p, i) => {
            p.order = i + 1;
        });
    }

    function populateCategories() {
        if (!categoryFilter) return;

        const categories = new Set();
        rawPanels.forEach((p) => {
            const catName = p.category?.category || (typeof p.category === "string" ? p.category : "");
            if (catName && typeof catName === "string" && catName.trim()) {
                categories.add(catName.trim());
            }
        });

        const currCat = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        Array.from(categories).sort().forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            if (cat === currCat) opt.selected = true;
            categoryFilter.appendChild(opt);
        });
    }

    function updateStats() {
        const total = rawPanels.length;
        if (statTotalPanels) statTotalPanels.textContent = total;

        const categoryCounts = {};
        let totalTestsLinked = 0;
        let totalPrice = 0;
        let pricedCount = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        rawPanels.forEach((p) => {
            const catName = p.category?.category || (typeof p.category === "string" ? p.category : "");
            if (catName && typeof catName === "string") {
                const c = catName.trim();
                categoryCounts[c] = (categoryCounts[c] || 0) + 1;
            }

            const testCount = Array.isArray(p.tests)
                ? p.tests.length
                : (p.testsId && Array.isArray(p.testsId) ? p.testsId.length : 0);
            totalTestsLinked += testCount;

            const price = parseFloat(p.price);
            if (!isNaN(price) && price > 0) {
                totalPrice += price;
                pricedCount++;
                if (price < minPrice) minPrice = price;
                if (price > maxPrice) maxPrice = price;
            }
        });

        const uniqueCategories = Object.keys(categoryCounts);

        if (statPanelCategories) statPanelCategories.textContent = `${uniqueCategories.length} Categories`;
        if (statTotalTestsLinked) statTotalTestsLinked.textContent = `${totalTestsLinked} Tests`;

        if (statAvgPanelPrice) {
            const avg = pricedCount > 0 ? Math.round(totalPrice / pricedCount) : 0;
            statAvgPanelPrice.textContent = `₹${avg}`;
        }

        // Subtext details
        if (statSubTotalPanels) {
            statSubTotalPanels.textContent = `${total} Profiles in Catalog`;
        }

        if (statSubPanelCategory) {
            if (uniqueCategories.length > 0) {
                const topCat = uniqueCategories.sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];
                statSubPanelCategory.textContent = `Top: ${topCat} (${categoryCounts[topCat]})`;
            } else {
                statSubPanelCategory.textContent = "No categories yet";
            }
        }

        if (statSubPanelPrice) {
            if (pricedCount > 0) {
                statSubPanelPrice.textContent = `Min ₹${minPrice} • Max ₹${maxPrice}`;
            } else {
                statSubPanelPrice.textContent = "No prices defined";
            }
        }

        if (statSubTestsLinked) {
            const avgPerPanel = total > 0 ? (totalTestsLinked / total).toFixed(1) : 0;
            statSubTestsLinked.textContent = `Avg ${avgPerPanel} tests per panel`;
        }
    }

    function applyFilters() {
        const query = (searchInput?.value || "").trim().toLowerCase();
        const selectedCat = categoryFilter?.value || "";
        const sortMode = sortFilter?.value || "order";

        filteredPanels = rawPanels.filter((p) => {
            const name = (p.name || "").toLowerCase();
            const shortName = (p.Short_name || p.short_name || "").toLowerCase();
            const cat = ((p.category?.category || p.category || "") + "").toLowerCase();

            // Match tests inside panel
            let testsMatch = false;
            if (Array.isArray(p.tests)) {
                testsMatch = p.tests.some((t) => (t + "").toLowerCase().includes(query));
            }

            const matchesQuery = !query ||
                name.includes(query) ||
                shortName.includes(query) ||
                cat.includes(query) ||
                testsMatch;

            const matchesCat = !selectedCat || (p.category?.category || p.category) === selectedCat;

            return matchesQuery && matchesCat;
        });

        // Sorting
        filteredPanels.sort((a, b) => {
            if (sortMode === "name-asc") return (a.name || "").localeCompare(b.name || "");
            if (sortMode === "name-desc") return (b.name || "").localeCompare(a.name || "");
            if (sortMode === "price-asc") return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
            if (sortMode === "price-desc") return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
            if (sortMode === "tests-desc") {
                const countA = Array.isArray(a.tests) ? a.tests.length : (a.testsId?.length || 0);
                const countB = Array.isArray(b.tests) ? b.tests.length : (b.testsId?.length || 0);
                return countB - countA;
            }
            // Default "order"
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        });

        updateActiveFilterBanner(query, selectedCat, sortMode);
        renderTable();
    }

    function updateActiveFilterBanner(query, cat, sort) {
        if (!activeFiltersBar || !activeFilterDesc) return;

        const parts = [];
        if (query) parts.push(`matching "<strong>${escapeHtml(query)}</strong>"`);
        if (cat) parts.push(`in category "<strong>${escapeHtml(cat)}</strong>"`);
        if (sort !== "order") parts.push(`sorted`);

        if (parts.length > 0) {
            activeFilterDesc.innerHTML = `Showing ${filteredPanels.length} panels ${parts.join(", ")}`;
            activeFiltersBar.classList.add("visible");
            if (cardPanelCategories) cardPanelCategories.classList.toggle("active-filter", !!cat);
            if (cardPanelPrice) cardPanelPrice.classList.toggle("active-filter", sort.startsWith("price"));
            if (cardTotalTestsLinked) cardTotalTestsLinked.classList.toggle("active-filter", sort === "tests-desc");
        } else {
            activeFiltersBar.classList.remove("visible");
            if (cardPanelCategories) cardPanelCategories.classList.remove("active-filter");
            if (cardPanelPrice) cardPanelPrice.classList.remove("active-filter");
            if (cardTotalTestsLinked) cardTotalTestsLinked.classList.remove("active-filter");
        }
    }

    function renderTable() {
        if (!tbody) return;

        if (filteredPanels.length === 0) {
            tbody.innerHTML = "";
            renderState(
                "empty",
                "No matching panels found",
                rawPanels.length === 0
                    ? "Your database doesn't have any panels yet. Click '+ Add Panel' above to create one."
                    : "Try adjusting your search query or clear the category filter."
            );
            if (paginationInfo) paginationInfo.textContent = "Showing 0 of 0 panels";
            if (paginationControls) paginationControls.innerHTML = "";
            return;
        }

        clearState();

        const totalItems = filteredPanels.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageItems = filteredPanels.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();
        const isDragAllowed = (sortFilter?.value === "order") && !(searchInput?.value || "").trim();

        pageItems.forEach((p, idx) => {
            const row = document.createElement("tr");
            row.id = `pdb-row-${p._id}`;
            row.className = isDragAllowed ? "pdb-draggable-row" : "";
            if (isDragAllowed) {
                row.setAttribute("draggable", "true");
                row.setAttribute("data-id", p._id);
                row.setAttribute("data-order", p.order || (startIndex + idx + 1));
            }

            // Highlight newly moved panel
            if (activeHighlightPanelId === p._id) {
                row.classList.add("pdb-row-highlight");
            }

            const catName = p.category?.category || (typeof p.category === "string" ? p.category : "General");
            const price = p.price != null ? `₹${p.price}` : "-";
            const mrp = p.final_price ? `₹${p.final_price}` : "";
            const shortName = (p.Short_name || p.short_name)
                ? `<span class="pdb-badge pdb-badge-code">${escapeHtml(p.Short_name || p.short_name)}</span>`
                : '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';
            const orderVal = p.order || (startIndex + idx + 1);

            // Tests Chips
            const testList = Array.isArray(p.tests) ? p.tests : [];
            let testsHtml = '<span style="color:#94a3b8; font-size:0.8rem;">No tests</span>';
            if (testList.length > 0) {
                const maxDisplay = 2;
                const visibleTests = testList.slice(0, maxDisplay);
                const remaining = testList.length - maxDisplay;

                testsHtml = `<div class="pdb-tests-chips">
                    ${visibleTests.map((t) => `<span class="pdb-test-chip" title="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join("")}
                    ${remaining > 0 ? `<span class="pdb-test-more-chip" title="${testList.slice(maxDisplay).map(escapeHtml).join(', ')}">+${remaining} more</span>` : ""}
                </div>`;
            }

            // Sample types
            const samplesList = Array.isArray(p.sample_types) ? p.sample_types : (p.sample_types ? [p.sample_types] : []);
            let samplesHtml = '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';
            if (samplesList.length > 0) {
                samplesHtml = samplesList.map((s) => `<span class="pdb-badge pdb-badge-sample"><i class="fa-solid fa-droplet" style="font-size:0.65rem;"></i> ${escapeHtml(s)}</span>`).join(" ");
            }

            row.innerHTML = `
                <td class="center">
                    <div class="pdb-order-cell">
                        ${isDragAllowed ? `<span class="pdb-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>` : ""}
                        <input type="number" 
                               class="pdb-order-input" 
                               min="1" 
                               max="${rawPanels.length}" 
                               value="${orderVal}" 
                               data-panel-id="${p._id}" 
                               data-old-val="${orderVal}" 
                               title="Type new rank # (1 - ${rawPanels.length}) and press Enter to move across all pages">
                    </div>
                </td>
                <td>
                    <div class="pdb-panel-name">
                        <span>${escapeHtml(p.name || "Unnamed Panel")}</span>
                    </div>
                </td>
                <td>${shortName}</td>
                <td><span class="pdb-badge pdb-badge-category">${escapeHtml(catName)}</span></td>
                <td>${testsHtml}</td>
                <td>${samplesHtml}</td>
                <td class="right">
                    <span class="pdb-price-val">${price}</span>
                    ${mrp ? `<span class="pdb-mrp-val" title="MRP">${mrp}</span>` : ""}
                </td>
                <td class="center">
                    <div class="pdb-actions-cell">
                        <button type="button" class="pdb-action-btn" data-action="edit" data-id="${p._id}" title="Edit Panel Details">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" class="pdb-action-btn move-btn" data-action="move" data-id="${p._id}" title="Change Rank / Move to Page">
                            <i class="fa-solid fa-arrow-down-up-across-line"></i>
                        </button>
                    </div>
                </td>
            `;

            // Action button bindings
            const editBtn = row.querySelector('[data-action="edit"]');
            if (editBtn) {
                editBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    navigateToEdit(p._id);
                });
            }

            const moveBtn = row.querySelector('[data-action="move"]');
            if (moveBtn) {
                moveBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    openMoveModal(p);
                });
            }

            // Direct numeric input binding
            const orderInput = row.querySelector(".pdb-order-input");
            if (orderInput) {
                orderInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        orderInput.blur();
                    }
                });

                orderInput.addEventListener("change", () => {
                    handleDirectOrderChange(p._id, orderInput);
                });
            }

            fragment.appendChild(row);
        });

        tbody.innerHTML = "";
        tbody.appendChild(fragment);

        if (isDragAllowed) {
            setupDragAndDrop();
        }

        renderPagination(startIndex + 1, endIndex, totalItems, totalPages);

        // If a panel was just highlighted, scroll smoothly to it
        if (activeHighlightPanelId) {
            const targetRow = document.getElementById(`pdb-row-${activeHighlightPanelId}`);
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => {
                activeHighlightPanelId = null;
            }, 3000);
        }
    }

    // Direct numeric input handler
    async function handleDirectOrderChange(panelId, inputEl) {
        const oldVal = parseInt(inputEl.getAttribute("data-old-val"), 10);
        const newVal = parseInt(inputEl.value, 10);

        if (isNaN(newVal) || newVal < 1 || newVal > rawPanels.length) {
            showToast(`Please enter a valid rank between 1 and ${rawPanels.length}`, "error");
            inputEl.value = oldVal;
            return;
        }

        if (newVal === oldVal) return;

        await movePanelToPosition(panelId, newVal);
    }

    // Master function to move a panel to any target position globally across all pages
    async function movePanelToPosition(panelId, targetRank) {
        if (isSavingOrder) return;
        isSavingOrder = true;

        const panelIndex = rawPanels.findIndex((p) => p._id === panelId);
        if (panelIndex === -1) {
            isSavingOrder = false;
            return;
        }

        const panelItem = rawPanels[panelIndex];

        // Remove from current position and insert at target
        rawPanels.splice(panelIndex, 1);
        const insertIndex = Math.max(0, Math.min(targetRank - 1, rawPanels.length));
        rawPanels.splice(insertIndex, 0, panelItem);

        // Re-index all panels sequentially
        const updatedOrder = [];
        rawPanels.forEach((p, i) => {
            p.order = i + 1;
            updatedOrder.push({ id: p._id, order: p.order });
        });

        // Find the page where the panel now resides
        const newRank = panelItem.order;
        const targetPage = Math.ceil(newRank / pageSize) || 1;
        currentPage = targetPage;
        activeHighlightPanelId = panelId;

        // Reset sort filter to catalog sequence so user sees newly positioned order accurately
        if (sortFilter && sortFilter.value !== "order") {
            sortFilter.value = "order";
        }

        // Optimistically re-render table immediately
        applyFilters();

        showToast(`Moving "${panelItem.name || 'Panel'}" to position #${newRank}...`, "info");

        // Save order to server
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/updatePannelOrder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updatedOrder })
            });

            if (!response.ok) throw new Error("Server failed to save updated panel order");

            showToast(`✓ "${panelItem.name || 'Panel'}" moved to position #${newRank} (Page ${targetPage})`, "success");
        } catch (error) {
            console.error("Failed to update panel order:", error);
            showToast("Failed to save new order to database. Please try again.", "error");
        } finally {
            isSavingOrder = false;
        }
    }

    // Move Modal Handlers
    function openMoveModal(panel) {
        if (!moveModal) return;
        movingPanelTarget = {
            id: panel._id,
            name: panel.name,
            currentRank: panel.order || 1
        };

        if (modalPanelName) modalPanelName.textContent = panel.name || "Panel";
        if (modalCurrentRank) modalCurrentRank.textContent = `#${panel.order || 1}`;
        if (modalTotalPanels) modalTotalPanels.textContent = rawPanels.length;
        if (modalMaxRank) modalMaxRank.textContent = rawPanels.length;
        if (modalTargetRank) {
            modalTargetRank.value = panel.order || 1;
            modalTargetRank.max = rawPanels.length;
        }

        moveModal.classList.add("active");
        setTimeout(() => {
            if (modalTargetRank) {
                modalTargetRank.focus();
                modalTargetRank.select();
            }
        }, 100);
    }

    function closeMoveModal() {
        if (moveModal) moveModal.classList.remove("active");
        movingPanelTarget = null;
    }

    async function handleApplyMove() {
        if (!movingPanelTarget || !modalTargetRank) return;
        const targetRank = parseInt(modalTargetRank.value, 10);

        if (isNaN(targetRank) || targetRank < 1 || targetRank > rawPanels.length) {
            showToast(`Please enter a valid rank between 1 and ${rawPanels.length}`, "error");
            return;
        }

        const panelId = movingPanelTarget.id;
        closeMoveModal();
        await movePanelToPosition(panelId, targetRank);
    }

    // Full Organizer Modal Handlers
    function openOrganizer() {
        if (!organizerModal) return;
        if (organizerSearch) organizerSearch.value = "";
        organizerModal.classList.add("active");
        renderOrganizerList();
    }

    function closeOrganizer() {
        if (organizerModal) organizerModal.classList.remove("active");
    }

    function renderOrganizerList() {
        if (!organizerList) return;
        const query = (organizerSearch?.value || "").trim().toLowerCase();

        const filtered = rawPanels.filter((p) => {
            if (!query) return true;
            const name = (p.name || "").toLowerCase();
            const code = (p.Short_name || p.short_name || "").toLowerCase();
            return name.includes(query) || code.includes(query);
        });

        if (organizerCount) {
            organizerCount.textContent = `Showing ${filtered.length} of ${rawPanels.length} panels`;
        }

        if (filtered.length === 0) {
            organizerList.innerHTML = `<div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.88rem;">No panels match "${escapeHtml(query)}"</div>`;
            return;
        }

        organizerList.innerHTML = "";
        const fragment = document.createDocumentFragment();

        filtered.forEach((p) => {
            const item = document.createElement("div");
            item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; gap: 12px; transition: background 0.15s;";
            item.onmouseenter = () => { item.style.background = "#f8fafc"; };
            item.onmouseleave = () => { item.style.background = "#ffffff"; };

            const rank = p.order;
            const code = (p.Short_name || p.short_name)
                ? `<span style="font-family: monospace; font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${escapeHtml(p.Short_name || p.short_name)}</span>`
                : "";
            const testCount = Array.isArray(p.tests) ? p.tests.length : (p.testsId?.length || 0);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                    <span style="font-weight: 700; color: #0284c7; width: 40px; font-size: 0.85rem;">#${rank}</span>
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-weight: 600; font-size: 0.88rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(p.name || "Unnamed Panel")}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                            ${code}
                            <span style="font-size: 0.75rem; color: #64748b;">${escapeHtml(p.category?.category || p.category || "General")}</span>
                            <span style="font-size: 0.75rem; color: #0284c7; font-weight: 500;">• ${testCount} tests</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" class="pdb-preset-btn" data-action="top" title="Move to Top (#1)"><i class="fa-solid fa-angles-up"></i></button>
                    <button type="button" class="pdb-preset-btn" data-action="up" title="Move Up"><i class="fa-solid fa-angle-up"></i></button>
                    <button type="button" class="pdb-preset-btn" data-action="down" title="Move Down"><i class="fa-solid fa-angle-down"></i></button>
                    <button type="button" class="pdb-preset-btn" data-action="bottom" title="Move to Bottom"><i class="fa-solid fa-angles-down"></i></button>
                    <input type="number" min="1" max="${rawPanels.length}" value="${rank}" class="pdb-order-input" style="width: 44px; padding: 3px 4px; font-size: 0.78rem;" title="Type target rank and hit Enter">
                </div>
            `;

            // Action handlers
            const btnTop = item.querySelector('[data-action="top"]');
            const btnUp = item.querySelector('[data-action="up"]');
            const btnDown = item.querySelector('[data-action="down"]');
            const btnBottom = item.querySelector('[data-action="bottom"]');
            const rankInp = item.querySelector('input.pdb-order-input');

            btnTop.onclick = async () => {
                await movePanelToPosition(p._id, 1);
                renderOrganizerList();
            };
            btnBottom.onclick = async () => {
                await movePanelToPosition(p._id, rawPanels.length);
                renderOrganizerList();
            };
            btnUp.onclick = async () => {
                if (p.order > 1) {
                    await movePanelToPosition(p._id, p.order - 1);
                    renderOrganizerList();
                }
            };
            btnDown.onclick = async () => {
                if (p.order < rawPanels.length) {
                    await movePanelToPosition(p._id, p.order + 1);
                    renderOrganizerList();
                }
            };

            rankInp.onkeydown = async (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const target = parseInt(rankInp.value, 10);
                    if (!isNaN(target) && target >= 1 && target <= rawPanels.length) {
                        await movePanelToPosition(p._id, target);
                        renderOrganizerList();
                    }
                }
            };

            fragment.appendChild(item);
        });

        organizerList.appendChild(fragment);
    }

    function navigateToEdit(panelId) {
        if (!panelId) return;
        if (typeof window.loadPage === "function") {
            window.loadPage("editPanels", panelId);
        } else {
            window.location.href = `?page=editPanels&Name=${encodeURIComponent(panelId)}`;
        }
    }

    // Drag and Drop (Works seamlessly on current page and full view)
    function setupDragAndDrop() {
        const rows = tbody.querySelectorAll("tr.pdb-draggable-row");
        let draggedRow = null;

        rows.forEach((row) => {
            row.addEventListener("dragstart", (e) => {
                draggedRow = row;
                row.classList.add("pdb-dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", row.getAttribute("data-id") || "");
            });

            row.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const targetRow = e.target.closest("tr.pdb-draggable-row");
                if (targetRow && targetRow !== draggedRow) {
                    rows.forEach((r) => r.classList.remove("pdb-drop-target"));
                    targetRow.classList.add("pdb-drop-target");
                }
            });

            row.addEventListener("dragleave", (e) => {
                const targetRow = e.target.closest("tr.pdb-draggable-row");
                if (targetRow) {
                    targetRow.classList.remove("pdb-drop-target");
                }
            });

            row.addEventListener("drop", (e) => {
                e.preventDefault();
                const targetRow = e.target.closest("tr.pdb-draggable-row");
                if (targetRow && targetRow !== draggedRow) {
                    const allRows = Array.from(tbody.querySelectorAll("tr.pdb-draggable-row"));
                    const draggedIdx = allRows.indexOf(draggedRow);
                    const targetIdx = allRows.indexOf(targetRow);

                    if (draggedIdx < targetIdx) {
                        tbody.insertBefore(draggedRow, targetRow.nextSibling);
                    } else {
                        tbody.insertBefore(draggedRow, targetRow);
                    }
                    targetRow.classList.remove("pdb-drop-target");
                }
            });

            row.addEventListener("dragend", async () => {
                if (draggedRow) {
                    draggedRow.classList.remove("pdb-dragging");
                }
                rows.forEach((r) => r.classList.remove("pdb-drop-target"));
                await savePageDragOrder();
            });
        });
    }

    async function savePageDragOrder() {
        if (isSavingOrder) return;
        isSavingOrder = true;

        const currentRows = Array.from(tbody.querySelectorAll("tr.pdb-draggable-row"));
        const baseOffset = (currentPage - 1) * pageSize;

        // Collect new orders for visible page items
        currentRows.forEach((row, index) => {
            const newOrder = baseOffset + index + 1;
            const input = row.querySelector(".pdb-order-input");
            if (input) {
                input.value = newOrder;
                input.setAttribute("data-old-val", newOrder);
            }

            const id = row.getAttribute("data-id");
            if (id) {
                const item = rawPanels.find((p) => p._id === id);
                if (item) item.order = newOrder;
            }
        });

        // Re-sort and normalize sequentially
        normalizePanelOrders();

        const updatedOrder = rawPanels.map((p) => ({ id: p._id, order: p.order }));

        showToast("Saving new panel order...", "info");

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/updatePannelOrder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updatedOrder })
            });

            if (!response.ok) throw new Error("Server failed to save updated panel order");

            showToast("Panel order updated successfully!", "success");
        } catch (error) {
            console.error("Failed to update panel order:", error);
            showToast("Could not save new order. Please try again.", "error");
        } finally {
            isSavingOrder = false;
        }
    }

    // Pagination
    function renderPagination(start, end, total, totalPages) {
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${start} to ${end} of ${total} panels`;
        }

        if (!paginationControls) return;
        paginationControls.innerHTML = "";

        if (totalPages <= 1) return;

        // Previous button
        const prevBtn = document.createElement("button");
        prevBtn.className = "pdb-page-btn";
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        };
        paginationControls.appendChild(prevBtn);

        // Page numbers calculation
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
                pageBtn.className = `pdb-page-btn ${p === currentPage ? "active" : ""}`;
                pageBtn.textContent = p;
                pageBtn.onclick = () => {
                    currentPage = p;
                    renderTable();
                };
                paginationControls.appendChild(pageBtn);
            }
        });

        // Next button
        const nextBtn = document.createElement("button");
        nextBtn.className = "pdb-page-btn";
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

    // State render helper
    function renderState(type, title, desc) {
        if (!stateBox) return;
        stateBox.style.display = "block";

        let icon = "fa-spinner fa-spin";
        if (type === "empty") icon = "fa-folder-open";
        if (type === "error") icon = "fa-triangle-exclamation";

        stateBox.innerHTML = `
            <div class="pdb-state-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="pdb-state-title">${escapeHtml(title)}</div>
            <div class="pdb-state-desc">${escapeHtml(desc)}</div>
            ${type === "error" ? '<button type="button" class="pdb-btn pdb-btn-outline" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Retry</button>' : ""}
        `;
    }

    function clearState() {
        if (stateBox) {
            stateBox.style.display = "none";
            stateBox.innerHTML = "";
        }
    }

    // Toast helper
    function showToast(message, type = "success") {
        const toast = document.getElementById("pdbToast");
        const toastMsg = document.getElementById("pdbToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `pdb-toast ${type} show`;

        const icon = toast.querySelector("i");
        if (icon) {
            icon.className = type === "success"
                ? "fa-solid fa-circle-check"
                : type === "error"
                    ? "fa-solid fa-circle-exclamation"
                    : "fa-solid fa-circle-info";
        }

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 3200);
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
