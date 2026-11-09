(function () {
    // Scoped state to avoid polluting global namespace
    let rawTests = [];
    let filteredTests = [];
    let currentPage = 1;
    let pageSize = 25;
    let isSavingOrder = false;
    let activeHighlightTestId = null;
    let movingTestTarget = null; // Used for the Move modal

    const BASE_URL = window.BASE_URL || window.location.origin;

    // DOM Elements
    const tbody = document.getElementById("tdbTbody");
    const stateBox = document.getElementById("tdbStateBox");
    const searchInput = document.getElementById("tdbSearchInput");
    const clearSearchBtn = document.getElementById("tdbClearSearch");
    const categoryFilter = document.getElementById("tdbCategoryFilter");
    const sampleFilter = document.getElementById("tdbSampleFilter");
    const sortFilter = document.getElementById("tdbSortFilter");
    const pageSizeSelect = document.getElementById("tdbPageSize");
    const paginationInfo = document.getElementById("tdbPaginationInfo");
    const paginationControls = document.getElementById("tdbPaginationControls");

    // Stat Elements
    const cardTotalTests = document.getElementById("cardTotalTests");
    const cardCategories = document.getElementById("cardCategories");
    const cardPrice = document.getElementById("cardPrice");
    const cardSampleTypes = document.getElementById("cardSampleTypes");

    const statTotalTests = document.getElementById("statTotalTests");
    const statCategories = document.getElementById("statCategories");
    const statAvgPrice = document.getElementById("statAvgPrice");
    const statSampleTypes = document.getElementById("statSampleTypes");

    const statSubTotal = document.getElementById("statSubTotal");
    const statSubCategory = document.getElementById("statSubCategory");
    const statSubPrice = document.getElementById("statSubPrice");
    const statSubSample = document.getElementById("statSubSample");

    // Active Filter Banner
    const activeFiltersBar = document.getElementById("tdbActiveFiltersBar");
    const activeFilterDesc = document.getElementById("tdbActiveFilterDesc");
    const resetAllFiltersBtn = document.getElementById("tdbResetAllFiltersBtn");

    // Move Modal Elements
    const moveModal = document.getElementById("tdbMoveModal");
    const moveModalClose = document.getElementById("tdbMoveModalClose");
    const moveModalCancel = document.getElementById("tdbMoveModalCancel");
    const moveModalApply = document.getElementById("tdbMoveModalApply");
    const modalTestName = document.getElementById("tdbModalTestName");
    const modalCurrentRank = document.getElementById("tdbModalCurrentRank");
    const modalTotalTests = document.getElementById("tdbModalTotalTests");
    const modalTargetRank = document.getElementById("tdbModalTargetRank");
    const modalMaxRank = document.getElementById("tdbModalMaxRank");
    const presetTop = document.getElementById("tdbPresetTop");
    const presetPrev10 = document.getElementById("tdbPresetPrev10");
    const presetNext10 = document.getElementById("tdbPresetNext10");
    const presetBottom = document.getElementById("tdbPresetBottom");

    // Full Organizer Modal Elements
    const organizerModal = document.getElementById("tdbOrganizerModal");
    const openOrganizerBtn = document.getElementById("tdbOpenOrganizerBtn");
    const organizerModalClose = document.getElementById("tdbOrganizerModalClose");
    const organizerCloseBtn = document.getElementById("tdbOrganizerCloseBtn");
    const organizerSearch = document.getElementById("tdbOrganizerSearch");
    const organizerCount = document.getElementById("tdbOrganizerCount");
    const organizerList = document.getElementById("tdbOrganizerList");

    // Initialize
    initTestDatabase();

    async function initTestDatabase() {
        bindEvents();
        await fetchTests();
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

        if (sampleFilter) {
            sampleFilter.addEventListener("change", () => {
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
        if (cardTotalTests) {
            cardTotalTests.addEventListener("click", () => {
                resetAllFilters();
                showToast("Showing all tests in catalog sequence", "info");
            });
        }

        if (cardCategories) {
            cardCategories.addEventListener("click", () => {
                if (categoryFilter) {
                    categoryFilter.focus();
                    showToast("Select a category to filter tests", "info");
                }
            });
        }

        if (cardPrice) {
            cardPrice.addEventListener("click", () => {
                if (!sortFilter) return;
                // Cycle sort: price-asc -> price-desc -> order
                if (sortFilter.value === "price-asc") {
                    sortFilter.value = "price-desc";
                    showToast("Sorted by Price: High to Low", "info");
                } else if (sortFilter.value === "price-desc") {
                    sortFilter.value = "order";
                    showToast("Sorted by Catalog Order", "info");
                } else {
                    sortFilter.value = "price-asc";
                    showToast("Sorted by Price: Low to High", "info");
                }
                currentPage = 1;
                applyFilters();
            });
        }

        if (cardSampleTypes) {
            cardSampleTypes.addEventListener("click", () => {
                if (sampleFilter) {
                    sampleFilter.focus();
                    showToast("Select a sample type to filter tests", "info");
                }
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
                if (modalTargetRank) modalTargetRank.value = rawTests.length;
            });
        }
        if (presetPrev10) {
            presetPrev10.addEventListener("click", () => {
                if (modalTargetRank && movingTestTarget) {
                    const curr = parseInt(modalTargetRank.value, 10) || movingTestTarget.currentRank;
                    modalTargetRank.value = Math.max(1, curr - 10);
                }
            });
        }
        if (presetNext10) {
            presetNext10.addEventListener("click", () => {
                if (modalTargetRank && movingTestTarget) {
                    const curr = parseInt(modalTargetRank.value, 10) || movingTestTarget.currentRank;
                    modalTargetRank.value = Math.min(rawTests.length, curr + 10);
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
        if (sampleFilter) sampleFilter.value = "";
        if (sortFilter) sortFilter.value = "order";
        currentPage = 1;
        applyFilters();
    }

    function renderSkeletonRows() {
        if (!tbody) return;
        tbody.innerHTML = `
            <tr class="tdb-skeleton-row"><td colspan="8"><div class="tdb-shimmer"></div></td></tr>
            <tr class="tdb-skeleton-row"><td colspan="8"><div class="tdb-shimmer"></div></td></tr>
            <tr class="tdb-skeleton-row"><td colspan="8"><div class="tdb-shimmer"></div></td></tr>
            <tr class="tdb-skeleton-row"><td colspan="8"><div class="tdb-shimmer"></div></td></tr>
            <tr class="tdb-skeleton-row"><td colspan="8"><div class="tdb-shimmer"></div></td></tr>
        `;
    }

    async function fetchTests() {
        renderSkeletonRows();
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/test-database-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: Failed to load tests`);
            }

            const data = await response.json();
            rawTests = Array.isArray(data.tests) ? data.tests : [];

            // Sort initial tests by order, ensuring clean continuous indexing
            normalizeTestOrders();

            // Populate filter options and stats
            populateFilterOptions();
            updateStats();

            // Initial render
            applyFilters();
        } catch (error) {
            console.error("Error loading tests:", error);
            renderState("error", "Failed to Load Tests", error.message || "Please check your network and try again.");
        }
    }

    // Normalizes test order numbers sequentially: 1, 2, 3, ..., N
    function normalizeTestOrders() {
        rawTests.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        rawTests.forEach((t, i) => {
            t.order = i + 1;
        });
    }

    function populateFilterOptions() {
        if (!categoryFilter || !sampleFilter) return;

        const categories = new Set();
        const sampleTypes = new Set();

        rawTests.forEach((t) => {
            const catName = t.category?.category || t.category;
            if (catName && typeof catName === "string" && catName.trim()) {
                categories.add(catName.trim());
            }
            if (t.sampleType && typeof t.sampleType === "string" && t.sampleType.trim()) {
                sampleTypes.add(t.sampleType.trim());
            }
        });

        // Current selections
        const currCat = categoryFilter.value;
        const currSample = sampleFilter.value;

        // Category dropdown
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        Array.from(categories).sort().forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            if (cat === currCat) opt.selected = true;
            categoryFilter.appendChild(opt);
        });

        // Sample dropdown
        sampleFilter.innerHTML = '<option value="">All Sample Types</option>';
        Array.from(sampleTypes).sort().forEach((st) => {
            const opt = document.createElement("option");
            opt.value = st;
            opt.textContent = st;
            if (st === currSample) opt.selected = true;
            sampleFilter.appendChild(opt);
        });
    }

    function updateStats() {
        const total = rawTests.length;
        if (statTotalTests) statTotalTests.textContent = total;

        const categoryCounts = {};
        const sampleCounts = {};
        let totalPrice = 0;
        let pricedCount = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        let docCount = 0;

        rawTests.forEach((t) => {
            if (t.isDocumentedTest) docCount++;

            const catName = t.category?.category || t.category;
            if (catName && typeof catName === "string") {
                const c = catName.trim();
                categoryCounts[c] = (categoryCounts[c] || 0) + 1;
            }

            if (t.sampleType && typeof t.sampleType === "string") {
                const s = t.sampleType.trim();
                sampleCounts[s] = (sampleCounts[s] || 0) + 1;
            }

            const p = parseFloat(t.Price);
            if (!isNaN(p) && p > 0) {
                totalPrice += p;
                pricedCount++;
                if (p < minPrice) minPrice = p;
                if (p > maxPrice) maxPrice = p;
            }
        });

        const uniqueCategories = Object.keys(categoryCounts);
        const uniqueSamples = Object.keys(sampleCounts);

        if (statCategories) statCategories.textContent = `${uniqueCategories.length} Categories`;
        if (statSampleTypes) statSampleTypes.textContent = `${uniqueSamples.length} Types`;

        if (statAvgPrice) {
            const avg = pricedCount > 0 ? Math.round(totalPrice / pricedCount) : 0;
            statAvgPrice.textContent = `₹${avg}`;
        }

        // Subtext details
        if (statSubTotal) {
            const stdCount = total - docCount;
            statSubTotal.textContent = `${stdCount} Regular • ${docCount} Documented`;
        }

        if (statSubCategory) {
            if (uniqueCategories.length > 0) {
                const topCat = uniqueCategories.sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];
                statSubCategory.textContent = `Top: ${topCat} (${categoryCounts[topCat]})`;
            } else {
                statSubCategory.textContent = "No categories yet";
            }
        }

        if (statSubPrice) {
            if (pricedCount > 0) {
                statSubPrice.textContent = `Min ₹${minPrice} • Max ₹${maxPrice}`;
            } else {
                statSubPrice.textContent = "No prices defined";
            }
        }

        if (statSubSample) {
            if (uniqueSamples.length > 0) {
                const topSample = uniqueSamples.sort((a, b) => sampleCounts[b] - sampleCounts[a])[0];
                statSubSample.textContent = `Top: ${topSample} (${sampleCounts[topSample]})`;
            } else {
                statSubSample.textContent = "No sample types";
            }
        }
    }

    function applyFilters() {
        const query = (searchInput?.value || "").trim().toLowerCase();
        const selectedCat = categoryFilter?.value || "";
        const selectedSample = sampleFilter?.value || "";
        const sortMode = sortFilter?.value || "order";

        filteredTests = rawTests.filter((t) => {
            const name = (t.Name || "").toLowerCase();
            const shortName = (t.Short_name || "").toLowerCase();
            const cat = ((t.category?.category || t.category || "") + "").toLowerCase();
            const sample = (t.sampleType || "").toLowerCase();

            // Search query match
            const matchesQuery = !query ||
                name.includes(query) ||
                shortName.includes(query) ||
                cat.includes(query) ||
                sample.includes(query);

            // Category match
            const matchesCat = !selectedCat || (t.category?.category || t.category) === selectedCat;

            // Sample match
            const matchesSample = !selectedSample || t.sampleType === selectedSample;

            return matchesQuery && matchesCat && matchesSample;
        });

        // Sorting
        filteredTests.sort((a, b) => {
            if (sortMode === "name-asc") return (a.Name || "").localeCompare(b.Name || "");
            if (sortMode === "name-desc") return (b.Name || "").localeCompare(a.Name || "");
            if (sortMode === "price-asc") return (parseFloat(a.Price) || 0) - (parseFloat(b.Price) || 0);
            if (sortMode === "price-desc") return (parseFloat(b.Price) || 0) - (parseFloat(a.Price) || 0);
            // Default "order"
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        });

        // Update Active Filter Banner
        updateActiveFilterBanner(query, selectedCat, selectedSample, sortMode);

        renderTable();
    }

    function updateActiveFilterBanner(query, cat, sample, sort) {
        if (!activeFiltersBar || !activeFilterDesc) return;

        const parts = [];
        if (query) parts.push(`matching "<strong>${escapeHtml(query)}</strong>"`);
        if (cat) parts.push(`in category "<strong>${escapeHtml(cat)}</strong>"`);
        if (sample) parts.push(`sample "<strong>${escapeHtml(sample)}</strong>"`);
        if (sort !== "order") parts.push(`sorted`);

        if (parts.length > 0) {
            activeFilterDesc.innerHTML = `Showing ${filteredTests.length} tests ${parts.join(", ")}`;
            activeFiltersBar.classList.add("visible");
            if (cardCategories) cardCategories.classList.toggle("active-filter", !!cat);
            if (cardSampleTypes) cardSampleTypes.classList.toggle("active-filter", !!sample);
            if (cardPrice) cardPrice.classList.toggle("active-filter", sort.startsWith("price"));
        } else {
            activeFiltersBar.classList.remove("visible");
            if (cardCategories) cardCategories.classList.remove("active-filter");
            if (cardSampleTypes) cardSampleTypes.classList.remove("active-filter");
            if (cardPrice) cardPrice.classList.remove("active-filter");
        }
    }

    function renderTable() {
        if (!tbody) return;

        if (filteredTests.length === 0) {
            tbody.innerHTML = "";
            renderState(
                "empty",
                "No matching tests found",
                rawTests.length === 0
                    ? "Your database doesn't have any tests yet. Click '+ Add Test' above to create one."
                    : "Try adjusting your search query or clear the category and sample filters."
            );
            if (paginationInfo) paginationInfo.textContent = "Showing 0 of 0 tests";
            if (paginationControls) paginationControls.innerHTML = "";
            return;
        }

        clearState();

        const totalItems = filteredTests.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageItems = filteredTests.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();
        const isDragAllowed = (sortFilter?.value === "order") && !(searchInput?.value || "").trim();

        pageItems.forEach((t, idx) => {
            const row = document.createElement("tr");
            row.id = `tdb-row-${t._id}`;
            row.className = isDragAllowed ? "tdb-draggable-row" : "";
            if (isDragAllowed) {
                row.setAttribute("draggable", "true");
                row.setAttribute("data-id", t._id);
                row.setAttribute("data-order", t.order || (startIndex + idx + 1));
            }

            // Highlight newly moved test
            if (activeHighlightTestId === t._id) {
                row.classList.add("tdb-row-highlight");
            }

            const catName = t.category?.category || t.category || "General";
            const paramCount = Array.isArray(t.parameters) ? t.parameters.length : 0;
            const price = t.Price != null ? `₹${t.Price}` : "-";
            const mrp = t.final_price ? `₹${t.final_price}` : "";
            const sampleType = t.sampleType || "N/A";
            const shortName = t.Short_name ? `<span class="tdb-badge tdb-badge-code">${escapeHtml(t.Short_name)}</span>` : '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';
            const orderVal = t.order || (startIndex + idx + 1);

            row.innerHTML = `
                <td class="center">
                    <div class="tdb-order-cell">
                        ${isDragAllowed ? `<span class="tdb-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>` : ""}
                        <input type="number" 
                               class="tdb-order-input" 
                               min="1" 
                               max="${rawTests.length}" 
                               value="${orderVal}" 
                               data-test-id="${t._id}" 
                               data-old-val="${orderVal}" 
                               title="Type new rank # (1 - ${rawTests.length}) and press Enter to move across all pages">
                    </div>
                </td>
                <td>
                    <div class="tdb-test-name">
                        <span>${escapeHtml(t.Name || "Unnamed Test")}</span>
                        ${t.isDocumentedTest ? '<span class="tdb-badge" style="background:#fef3c7; color:#b45309;" title="Document format test"><i class="fa-solid fa-file-lines"></i> Doc</span>' : ''}
                    </div>
                </td>
                <td>${shortName}</td>
                <td><span class="tdb-badge tdb-badge-category">${escapeHtml(catName)}</span></td>
                <td><span class="tdb-badge tdb-badge-sample"><i class="fa-solid fa-droplet" style="font-size:0.65rem;"></i> ${escapeHtml(sampleType)}</span></td>
                <td class="right">
                    <span class="tdb-price-val">${price}</span>
                    ${mrp ? `<span class="tdb-mrp-val" title="MRP">${mrp}</span>` : ""}
                </td>
                <td class="center">
                    <span class="tdb-param-count" title="${paramCount} parameters defined">
                        <i class="fa-solid fa-list-check"></i> ${paramCount}
                    </span>
                </td>
                <td class="center">
                    <div class="tdb-actions-cell">
                        <button type="button" class="tdb-action-btn" data-action="edit" data-id="${t._id}" title="Edit Test Details">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" class="tdb-action-btn move-btn" data-action="move" data-id="${t._id}" title="Change Rank / Move to Page">
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
                    navigateToEdit(t._id);
                });
            }

            const moveBtn = row.querySelector('[data-action="move"]');
            if (moveBtn) {
                moveBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    openMoveModal(t);
                });
            }

            // Direct numeric input binding
            const orderInput = row.querySelector(".tdb-order-input");
            if (orderInput) {
                orderInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        orderInput.blur();
                    }
                });

                orderInput.addEventListener("change", () => {
                    handleDirectOrderChange(t._id, orderInput);
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

        // If an item was just highlighted, scroll smoothly to it
        if (activeHighlightTestId) {
            const targetRow = document.getElementById(`tdb-row-${activeHighlightTestId}`);
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => {
                activeHighlightTestId = null;
            }, 3000);
        }
    }

    // Direct numeric input handler
    async function handleDirectOrderChange(testId, inputEl) {
        const oldVal = parseInt(inputEl.getAttribute("data-old-val"), 10);
        const newVal = parseInt(inputEl.value, 10);

        if (isNaN(newVal) || newVal < 1 || newVal > rawTests.length) {
            showToast(`Please enter a valid rank between 1 and ${rawTests.length}`, "error");
            inputEl.value = oldVal;
            return;
        }

        if (newVal === oldVal) return;

        await moveTestToPosition(testId, newVal);
    }

    // Master function to move a test to any target position globally across all pages
    async function moveTestToPosition(testId, targetRank) {
        if (isSavingOrder) return;
        isSavingOrder = true;

        const testIndex = rawTests.findIndex((t) => t._id === testId);
        if (testIndex === -1) {
            isSavingOrder = false;
            return;
        }

        const testItem = rawTests[testIndex];
        const oldRank = testItem.order || (testIndex + 1);

        // Remove from current position and insert at target
        rawTests.splice(testIndex, 1);
        const insertIndex = Math.max(0, Math.min(targetRank - 1, rawTests.length));
        rawTests.splice(insertIndex, 0, testItem);

        // Re-index all tests sequentially
        const updatedOrder = [];
        rawTests.forEach((t, i) => {
            t.order = i + 1;
            updatedOrder.push({ id: t._id, order: t.order });
        });

        // Find the page where the test now resides
        const newRank = testItem.order;
        const targetPage = Math.ceil(newRank / pageSize) || 1;
        currentPage = targetPage;
        activeHighlightTestId = testId;

        // Reset sort filter to catalog order so user sees the newly positioned order accurately
        if (sortFilter && sortFilter.value !== "order") {
            sortFilter.value = "order";
        }

        // Optimistically re-render table immediately
        applyFilters();

        showToast(`Moving "${testItem.Name || 'Test'}" to position #${newRank}...`, "info");

        // Save order to server
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/editTestOrder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updatedOrder })
            });

            if (!response.ok) throw new Error("Server failed to save updated test order");

            showToast(`✓ "${testItem.Name || 'Test'}" moved to position #${newRank} (Page ${targetPage})`, "success");
        } catch (error) {
            console.error("Failed to update test order:", error);
            showToast("Failed to save new order to database. Please try again.", "error");
        } finally {
            isSavingOrder = false;
        }
    }

    // Move Modal Handlers
    function openMoveModal(test) {
        if (!moveModal) return;
        movingTestTarget = {
            id: test._id,
            name: test.Name,
            currentRank: test.order || 1
        };

        if (modalTestName) modalTestName.textContent = test.Name || "Test";
        if (modalCurrentRank) modalCurrentRank.textContent = `#${test.order || 1}`;
        if (modalTotalTests) modalTotalTests.textContent = rawTests.length;
        if (modalMaxRank) modalMaxRank.textContent = rawTests.length;
        if (modalTargetRank) {
            modalTargetRank.value = test.order || 1;
            modalTargetRank.max = rawTests.length;
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
        movingTestTarget = null;
    }

    async function handleApplyMove() {
        if (!movingTestTarget || !modalTargetRank) return;
        const targetRank = parseInt(modalTargetRank.value, 10);

        if (isNaN(targetRank) || targetRank < 1 || targetRank > rawTests.length) {
            showToast(`Please enter a valid rank between 1 and ${rawTests.length}`, "error");
            return;
        }

        const testId = movingTestTarget.id;
        closeMoveModal();
        await moveTestToPosition(testId, targetRank);
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

        const filtered = rawTests.filter((t) => {
            if (!query) return true;
            const name = (t.Name || "").toLowerCase();
            const code = (t.Short_name || "").toLowerCase();
            return name.includes(query) || code.includes(query);
        });

        if (organizerCount) {
            organizerCount.textContent = `Showing ${filtered.length} of ${rawTests.length} tests`;
        }

        if (filtered.length === 0) {
            organizerList.innerHTML = `<div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.88rem;">No tests match "${escapeHtml(query)}"</div>`;
            return;
        }

        organizerList.innerHTML = "";
        const fragment = document.createDocumentFragment();

        filtered.forEach((t) => {
            const item = document.createElement("div");
            item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; gap: 12px; transition: background 0.15s;";
            item.onmouseenter = () => { item.style.background = "#f8fafc"; };
            item.onmouseleave = () => { item.style.background = "#ffffff"; };

            const rank = t.order;
            const code = t.Short_name ? `<span style="font-family: monospace; font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${escapeHtml(t.Short_name)}</span>` : "";

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                    <span style="font-weight: 700; color: #2563eb; width: 40px; font-size: 0.85rem;">#${rank}</span>
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-weight: 600; font-size: 0.88rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(t.Name || "Unnamed Test")}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                            ${code}
                            <span style="font-size: 0.75rem; color: #64748b;">${escapeHtml(t.category?.category || t.category || "General")}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" class="tdb-preset-btn" data-action="top" title="Move to Top (#1)"><i class="fa-solid fa-angles-up"></i></button>
                    <button type="button" class="tdb-preset-btn" data-action="up" title="Move Up"><i class="fa-solid fa-angle-up"></i></button>
                    <button type="button" class="tdb-preset-btn" data-action="down" title="Move Down"><i class="fa-solid fa-angle-down"></i></button>
                    <button type="button" class="tdb-preset-btn" data-action="bottom" title="Move to Bottom"><i class="fa-solid fa-angles-down"></i></button>
                    <input type="number" min="1" max="${rawTests.length}" value="${rank}" class="tdb-order-input" style="width: 44px; padding: 3px 4px; font-size: 0.78rem;" title="Type target rank and hit Enter">
                </div>
            `;

            // Action handlers
            const btnTop = item.querySelector('[data-action="top"]');
            const btnUp = item.querySelector('[data-action="up"]');
            const btnDown = item.querySelector('[data-action="down"]');
            const btnBottom = item.querySelector('[data-action="bottom"]');
            const rankInp = item.querySelector('input.tdb-order-input');

            btnTop.onclick = async () => {
                await moveTestToPosition(t._id, 1);
                renderOrganizerList();
            };
            btnBottom.onclick = async () => {
                await moveTestToPosition(t._id, rawTests.length);
                renderOrganizerList();
            };
            btnUp.onclick = async () => {
                if (t.order > 1) {
                    await moveTestToPosition(t._id, t.order - 1);
                    renderOrganizerList();
                }
            };
            btnDown.onclick = async () => {
                if (t.order < rawTests.length) {
                    await moveTestToPosition(t._id, t.order + 1);
                    renderOrganizerList();
                }
            };

            rankInp.onkeydown = async (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const target = parseInt(rankInp.value, 10);
                    if (!isNaN(target) && target >= 1 && target <= rawTests.length) {
                        await moveTestToPosition(t._id, target);
                        renderOrganizerList();
                    }
                }
            };

            fragment.appendChild(item);
        });

        organizerList.appendChild(fragment);
    }

    function navigateToEdit(testId) {
        if (!testId) return;
        if (typeof window.loadPage === "function") {
            window.loadPage("editTest", testId);
        } else {
            window.location.href = `?page=editTest&Name=${encodeURIComponent(testId)}`;
        }
    }

    // Drag and Drop (Works seamlessly on current page and full view)
    function setupDragAndDrop() {
        const rows = tbody.querySelectorAll("tr.tdb-draggable-row");
        let draggedRow = null;

        rows.forEach((row) => {
            row.addEventListener("dragstart", (e) => {
                draggedRow = row;
                row.classList.add("tdb-dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", row.getAttribute("data-id") || "");
            });

            row.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const targetRow = e.target.closest("tr.tdb-draggable-row");
                if (targetRow && targetRow !== draggedRow) {
                    rows.forEach((r) => r.classList.remove("tdb-drop-target"));
                    targetRow.classList.add("tdb-drop-target");
                }
            });

            row.addEventListener("dragleave", (e) => {
                const targetRow = e.target.closest("tr.tdb-draggable-row");
                if (targetRow) {
                    targetRow.classList.remove("tdb-drop-target");
                }
            });

            row.addEventListener("drop", (e) => {
                e.preventDefault();
                const targetRow = e.target.closest("tr.tdb-draggable-row");
                if (targetRow && targetRow !== draggedRow) {
                    const allRows = Array.from(tbody.querySelectorAll("tr.tdb-draggable-row"));
                    const draggedIdx = allRows.indexOf(draggedRow);
                    const targetIdx = allRows.indexOf(targetRow);

                    if (draggedIdx < targetIdx) {
                        tbody.insertBefore(draggedRow, targetRow.nextSibling);
                    } else {
                        tbody.insertBefore(draggedRow, targetRow);
                    }
                    targetRow.classList.remove("tdb-drop-target");
                }
            });

            row.addEventListener("dragend", async () => {
                if (draggedRow) {
                    draggedRow.classList.remove("tdb-dragging");
                }
                rows.forEach((r) => r.classList.remove("tdb-drop-target"));
                await savePageDragOrder();
            });
        });
    }

    async function savePageDragOrder() {
        if (isSavingOrder) return;
        isSavingOrder = true;

        const currentRows = Array.from(tbody.querySelectorAll("tr.tdb-draggable-row"));
        const baseOffset = (currentPage - 1) * pageSize;

        // Collect new orders for the visible page
        currentRows.forEach((row, index) => {
            const newOrder = baseOffset + index + 1;
            const input = row.querySelector(".tdb-order-input");
            if (input) {
                input.value = newOrder;
                input.setAttribute("data-old-val", newOrder);
            }

            const id = row.getAttribute("data-id");
            if (id) {
                const item = rawTests.find((t) => t._id === id);
                if (item) item.order = newOrder;
            }
        });

        // Re-sort rawTests by order and rebuild bulk update payload
        normalizeTestOrders();

        const updatedOrder = rawTests.map((t) => ({ id: t._id, order: t.order }));

        showToast("Saving new order sequence...", "info");

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/editTestOrder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updatedOrder })
            });

            if (!response.ok) throw new Error("Server failed to save updated test order");

            showToast("Test order updated successfully!", "success");
        } catch (error) {
            console.error("Failed to update test order:", error);
            showToast("Could not save new order. Please try again.", "error");
        } finally {
            isSavingOrder = false;
        }
    }

    // Pagination
    function renderPagination(start, end, total, totalPages) {
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${start} to ${end} of ${total} tests`;
        }

        if (!paginationControls) return;
        paginationControls.innerHTML = "";

        if (totalPages <= 1) return;

        // Previous button
        const prevBtn = document.createElement("button");
        prevBtn.className = "tdb-page-btn";
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
                pageBtn.className = `tdb-page-btn ${p === currentPage ? "active" : ""}`;
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
        nextBtn.className = "tdb-page-btn";
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
            <div class="tdb-state-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="tdb-state-title">${escapeHtml(title)}</div>
            <div class="tdb-state-desc">${escapeHtml(desc)}</div>
            ${type === "error" ? '<button type="button" class="tdb-btn tdb-btn-outline" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Retry</button>' : ""}
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
        const toast = document.getElementById("tdbToast");
        const toastMsg = document.getElementById("tdbToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `tdb-toast ${type} show`;

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
