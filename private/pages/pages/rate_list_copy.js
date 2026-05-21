(async function ppal() {

    // ─── Config ──────────────────────────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const _id       = urlParams.get('value1');

    // ─── State ───────────────────────────────────────────────────────────────
    let allData      = [];   // full combined dataset
    let filteredData = [];   // after search filter
    let currentPage  = 1;
    let rowsPerPage  = 50;

    // ─── Spinner helpers ─────────────────────────────────────────────────────
    function showSpinner(msg = 'Processing…') {
        document.getElementById('spinnerMsg').textContent = msg;
        document.getElementById('processing-spinner').style.display = 'flex';
    }
    function hideSpinner() {
        document.getElementById('processing-spinner').style.display = 'none';
    }

    // ─── Skeleton rows ───────────────────────────────────────────────────────
    function showSkeletonRows(n = 10) {
        const tbody = document.getElementById('test-list');
        tbody.innerHTML = '';
        const widths = ['30%','80%','100%','50%','50%','40%','50%','70%','50%'];
        for (let i = 0; i < n; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            widths.forEach(w => {
                const td  = document.createElement('td');
                const div = document.createElement('div');
                div.className   = 'skeleton-cell';
                div.style.width = w;
                td.appendChild(div);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
    }

    // ─── Fetch Franchisee ────────────────────────────────────────────────────
    async function fetchFranchiseeData() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                const sf = data.data;
                document.getElementById('franchisee-name').value =
                    `${sf.fullName} - ${sf.username} - (${sf.state})`;
                document.getElementById('current-franchisee-name').textContent =
                    `${sf.username} - (${sf.fullName})`;
            } else {
                alert('Error fetching franchisee data');
            }
        } catch (error) {
            console.error('Error fetching franchisee:', error);
        }
    }

    // ─── Fetch Test List ─────────────────────────────────────────────────────
    async function fetchTestList() {
        showSkeletonRows(12);
        try {
            const [testResponse, panelResponse, packageResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}&oldId=${_id}`,         { method: 'POST' }),
                fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}&oldId=${_id}`,  { method: 'POST' }),
                fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}&oldId=${_id}`, { method: 'POST' }),
            ]);

            if (!testResponse.ok || !panelResponse.ok || !packageResponse.ok) {
                throw new Error('One or more API requests failed');
            }

            const testData    = await testResponse.json();
            const panelData   = await panelResponse.json();
            const packageData = await packageResponse.json();

            // FIX: tag each item with _type AND normalize _id
            // Some API responses may not have _id at top-level — log any missing ones
            const normalize = (arr, type) => arr.map(item => {
                // API response mein _id nahi hota — testId/panelId/packageId hi MongoDB ObjectId hai
                const mongoId = item._id || item.testId || item.panelId || item.packageId;
                if (!mongoId) {
                    console.warn(`[normalize] Item missing any ID — type: ${type}`, item);
                }
                return { ...item, _id: mongoId, _type: type };
            });

            allData = [
                ...normalize(Array.isArray(testData)    ? testData    : [], 'test'),
                ...normalize(Array.isArray(panelData)   ? panelData   : [], 'panel'),
                ...normalize(Array.isArray(packageData) ? packageData : [], 'package'),
            ];

            filteredData = [...allData];
            document.getElementById('totalCount').textContent = `${allData.length} items`;

            currentPage = 1;
            renderTable();
            renderPagination();
            setupSearch();
            setupChangePriceBtn();

        } catch (error) {
            console.error(error);
            document.getElementById('test-list').innerHTML = '';
            const noRes = document.getElementById('noResults');
            noRes.style.display = 'block';
            document.getElementById('noResultsMsg').textContent = 'Failed to load data. Please refresh the page.';
        }
    }

    // ─── Render Table (paginated slice of filteredData) ───────────────────────
    function renderTable() {
        const tbody   = document.getElementById('test-list');
        const noRes   = document.getElementById('noResults');
        const pagBar  = document.getElementById('paginationBar');
        tbody.innerHTML = '';

        if (filteredData.length === 0) {
            noRes.style.display  = 'block';
            pagBar.style.display = 'none';
            const term = document.getElementById('searchTest').value.trim();
            document.getElementById('noResultsMsg').textContent =
                term ? `No results for "${term}"` : 'No data available.';
            return;
        }

        noRes.style.display  = 'none';
        pagBar.style.display = 'flex';

        const start    = (currentPage - 1) * rowsPerPage;
        const end      = Math.min(start + rowsPerPage, filteredData.length);
        const pageData = filteredData.slice(start, end);

        pageData.forEach((test, idx) => {
            // Skip items with no MongoDB _id — they cannot be saved anyway
            if (!test._id) {
                console.warn(`[renderTable] Skipping item missing _id at idx ${idx}:`, test);
                return;
            }

            const globalIdx = start + idx + 1;

            const displayId   = test.testId    || test.packageId  || test.panelId   || '';
            const displayName = test.packageName || test.testName  || test.panelName || '';

            // FIX: API uses basePrice field, not myPrice
            const myPrice = parseFloat(test.myPrice ?? test.basePrice) || 0;

            // Fallback commission — test.commissionRate OR calculate from existing assigned price
            const oldPrice      = ((test.assignedPriceToFranchisee || myPrice) - myPrice).toFixed(2);
            const oldPercentage = myPrice > 0 ? Math.round((parseFloat(oldPrice) / myPrice) * 100) : 0;
            const commission    = test.commissionRate != null ? test.commissionRate : oldPercentage;

            // Assigned price display
            const assignedPrice = test.assignedPrice != null
                ? test.assignedPrice
                : parseFloat(oldPrice);

            // FIX: finalPrice uses assignedPriceToFranchisee (this version), not assignedPriceToUser
            const finalPrice = test.finalPrice ?? test.assignedPriceToFranchisee ?? myPrice;

            const tr = document.createElement('tr');
            // Store MongoDB ObjectId & type on the row element for save handler
            tr.dataset.mongoId = test._id;    // FIX: real ObjectId for backend
            tr.dataset.type    = test._type;  // FIX: type for backend sorting

            tr.innerHTML = `
                <td>${globalIdx}</td>
                <td class="test-id">${displayId}</td>
                <td class="test-name">${displayName}</td>
                <td class="test-mrp">${test.mrpPrice ?? ''}</td>
                <td class="my-price">${myPrice}</td>
                <td class="commission-rate-cell">
                    <input type="number" class="commission-rate"
                           min="0" max="100" step="0.01"
                           value="${commission}">
                </td>
                <td class="assigned-price">${assignedPrice}</td>
                <td class="franchisee-id">${_id}</td>
                <td class="final-price1">${finalPrice}</td>
            `;
            tbody.appendChild(tr);
        });

        // Attach per-row commission listener after each render
        tbody.querySelectorAll('.commission-rate').forEach(input => {
            input.addEventListener('input', onCommissionInput);
            // Run initial validation on existing values
            const val = parseFloat(input.value);
            if (!isNaN(val)) validateCommission(input, val);
        });

        // Restore override marking for rows that were manually changed
        // (tracked in allData._overrideRate per item)
        pageData.forEach((test, idx) => {
            const tr = tbody.querySelectorAll('tr')[idx];
            if (!tr) return;
            const input      = tr.querySelector('.commission-rate');
            const globalRate = parseFloat(document.getElementById('trigger-price').value);
            const rowVal     = parseFloat(input.value);
            // If item had a manually set rate different from global, mark it
            if (test._manualRate !== undefined && test._manualRate !== globalRate) {
                input.value = test._manualRate;
                tr.classList.add('manually-overridden');
                tr.querySelector('.commission-rate-cell').classList.add('rate-override');
                // Recalculate prices with manual rate
                const myPrice = parseFloat(tr.querySelector('td:nth-child(5)').textContent) || 0;
                tr.querySelector('.assigned-price').textContent = ((test._manualRate / 100) * myPrice).toFixed(2);
                tr.querySelector('.final-price1').textContent   = (myPrice + (test._manualRate / 100) * myPrice).toFixed(2);
            }
        });

        // Update pagination info labels
        document.getElementById('pageFrom').textContent  = start + 1;
        document.getElementById('pageTo').textContent    = end;
        document.getElementById('pageTotal').textContent = filteredData.length;
    }

    // ─── Commission Input Validation ─────────────────────────────────────────
    // Business rules:
    //   • Value must be a number (not blank/NaN)
    //   • Must be between 0 and 100 (percentage can't exceed 100%)
    //   • Negative commission not allowed
    //   • Commission so high that final price > MRP is a warning (not a block)
    //   • Commission that makes final price < myPrice is blocked (can't sell below cost)
    function validateCommission(input, val) {
        const row     = input.closest('tr');
        const myPrice = parseFloat(row.querySelector('td:nth-child(5)').textContent) || 0;
        const mrpPrice= parseFloat(row.querySelector('.test-mrp').textContent) || 0;

        // Remove existing state classes
        input.classList.remove('input-error', 'input-warn', 'input-ok');
        clearRowTooltip(input);

        if (isNaN(val) || input.value.trim() === '') {
            input.classList.add('input-error');
            setRowTooltip(input, '❌ Koi value zaroor daalni hai');
            return false;
        }
        if (val < 0) {
            input.classList.add('input-error');
            setRowTooltip(input, '❌ Commission negative nahi ho sakta');
            return false;
        }
        if (val > 100) {
            input.classList.add('input-error');
            setRowTooltip(input, '❌ Commission 100% se zyada nahi ho sakta');
            return false;
        }
        // Check: final price should not go below myPrice (selling below cost)
        const finalPr = myPrice + (val / 100) * myPrice;
        if (finalPr < myPrice && myPrice > 0) {
            input.classList.add('input-error');
            setRowTooltip(input, '❌ Final price, My Price se kam nahi ho sakti');
            return false;
        }
        // Warning: final price exceeds MRP
        if (mrpPrice > 0 && finalPr > mrpPrice) {
            input.classList.add('input-warn');
            setRowTooltip(input, `⚠️ Final price (${finalPr.toFixed(2)}) MRP (${mrpPrice}) se zyada hai`);
            return true; // allow but warn
        }
        // All good
        input.classList.add('input-ok');
        return true;
    }

    function setRowTooltip(input, msg) {
        input.title = msg;
    }
    function clearRowTooltip(input) {
        input.title = '';
    }

    // ─── Commission Input Handler ─────────────────────────────────────────────
    function onCommissionInput(e) {
        const input   = e.target;
        const val     = parseFloat(input.value);
        const row     = input.closest('tr');
        const myPrice = parseFloat(row.querySelector('td:nth-child(5)').textContent) || 0;

        // Validate first
        const valid = validateCommission(input, val);

        // Always update display (even on warn), block only on hard error
        const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(val, 100));
        const commAmt = (safeVal / 100) * myPrice;
        const finalPr = myPrice + commAmt;

        row.querySelector('.assigned-price').textContent = commAmt.toFixed(2);
        row.querySelector('.final-price1').textContent   = finalPr.toFixed(2);

        // Mark this row as manually overridden (different from global rate)
        const globalRate = parseFloat(document.getElementById('trigger-price').value);
        if (!isNaN(globalRate) && val !== globalRate) {
            row.classList.add('manually-overridden');
            row.querySelector('.commission-rate-cell').classList.add('rate-override');
        } else {
            row.classList.remove('manually-overridden');
            row.querySelector('.commission-rate-cell').classList.remove('rate-override');
        }

        // Persist manual rate back into allData so it survives pagination
        const mongoId = row.dataset.mongoId;
        if (mongoId) {
            const item = allData.find(t => t._id === mongoId);
            if (item) item._manualRate = isNaN(val) ? undefined : val;
        }

        updateStatsBar();
    }

    // ─── Stats Bar ────────────────────────────────────────────────────────────
    function updateStatsBar() {
        const overrideCount = document.querySelectorAll('#test-list tr.manually-overridden').length;
        document.getElementById('statOverride').textContent = overrideCount;
    }

    // ─── Change Price (global %) ──────────────────────────────────────────────
    function setupChangePriceBtn() {
        const triggerInput = document.getElementById('trigger-price');
        const errorDiv     = document.getElementById('triggerError');
        const errorMsg     = document.getElementById('triggerErrorMsg');

        // Live validation on trigger field as user types
        triggerInput.addEventListener('input', () => {
            validateTriggerField(triggerInput, errorDiv, errorMsg);
        });

        document.getElementById('changePriceBtn').addEventListener('click', () => {
            const rawVal     = triggerInput.value.trim();
            const globalRate = parseFloat(rawVal);

            // ── Validate trigger field ──────────────────────────────────────
            if (!validateTriggerField(triggerInput, errorDiv, errorMsg, true)) return;

            // ── Apply to ALL data (not just visible page) ───────────────────
            // Update allData so pagination page changes also reflect correct value
            allData.forEach(item => {
                item._overrideRate = globalRate; // store applied global rate on data
            });

            // Apply to currently visible DOM rows
            let appliedCount = 0;
            document.querySelectorAll('#test-list tr').forEach(row => {
                const myPrice  = parseFloat(row.querySelector('td:nth-child(5)')?.textContent) || 0;
                const mrpPrice = parseFloat(row.querySelector('.test-mrp')?.textContent) || 0;
                const commAmt  = (globalRate / 100) * myPrice;
                const finalPr  = myPrice + commAmt;
                const input    = row.querySelector('.commission-rate');
                if (!input) return;

                input.value = globalRate;

                // Apply validation state
                input.classList.remove('input-error', 'input-warn', 'input-ok');
                if (mrpPrice > 0 && finalPr > mrpPrice) {
                    input.classList.add('input-warn');
                    input.title = `⚠️ Final price (${finalPr.toFixed(2)}) MRP (${mrpPrice}) se zyada hai`;
                } else {
                    input.classList.add('input-ok');
                    input.title = '';
                }

                row.querySelector('.assigned-price').textContent = commAmt.toFixed(2);
                row.querySelector('.final-price1').textContent   = finalPr.toFixed(2);

                // Clear override marking — global rate applied
                row.classList.remove('manually-overridden');
                row.querySelector('.commission-rate-cell').classList.remove('rate-override');
                appliedCount++;
            });

            // Update stats bar
            document.getElementById('statsBar').style.display  = 'flex';
            document.getElementById('statGlobalRate').textContent = globalRate;
            document.getElementById('statTotal').textContent      = allData.length;
            document.getElementById('statOverride').textContent   = '0';

            // Success feedback on button
            const btn = document.getElementById('changePriceBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Applied!';
            btn.style.background = '#27ae60';
            setTimeout(() => {
                btn.innerHTML = orig;
                btn.style.background = '';
            }, 2000);
        });
    }

    // ── Trigger field validator ───────────────────────────────────────────────
    function validateTriggerField(input, errorDiv, errorMsg, showAlert = false) {
        const rawVal     = input.value.trim();
        const globalRate = parseFloat(rawVal);

        input.classList.remove('field-error');
        errorDiv.style.display = 'none';

        const showErr = (msg) => {
            input.classList.add('field-error');
            errorMsg.textContent   = msg;
            errorDiv.style.display = 'block';
            if (showAlert) input.focus();
            return false;
        };

        if (rawVal === '') return showErr('Commission % khaali nahi chhod sakte');
        if (isNaN(globalRate)) return showErr('Sirf number daalen (e.g. 10, 15.5)');
        if (globalRate < 0)    return showErr('Commission negative nahi ho sakta (0 se 100 ke beech daalen)');
        if (globalRate > 100)  return showErr('Commission 100% se zyada nahi ho sakta');
        if (globalRate === 0) {
            // 0% is allowed — just means no commission, but warn
            errorMsg.textContent   = '⚠️ 0% commission — koi markup nahi milega';
            errorDiv.style.display = 'block';
            errorDiv.style.color   = '#e67e22';
            // still valid
        } else {
            errorDiv.style.color = '#c0392b'; // reset for next error
        }
        return true;
    }

    // ─── Search (data-level, not DOM-hide) ───────────────────────────────────
    function setupSearch() {
        document.getElementById('searchTest').addEventListener('input', function () {
            const term = this.value.toLowerCase().trim();
            filteredData = term === ''
                ? [...allData]
                : allData.filter(t => {
                    const id   = (t.testId    || t.packageId  || t.panelId   || '').toLowerCase();
                    const name = (t.packageName || t.testName || t.panelName || '').toLowerCase();
                    return id.includes(term) || name.includes(term);
                });
            currentPage = 1;
            renderTable();
            renderPagination();
        });

        document.getElementById('rowsPerPage').addEventListener('change', function () {
            rowsPerPage = parseInt(this.value);
            currentPage = 1;
            renderTable();
            renderPagination();
        });

        // FIX: searchBtn had no listener in original — now re-triggers search
        document.getElementById('searchBtn').addEventListener('click', () => {
            document.getElementById('searchTest').dispatchEvent(new Event('input'));
        });
    }

    // ─── Pagination ───────────────────────────────────────────────────────────
    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        const ctrl = document.getElementById('pageControls');
        ctrl.innerHTML = '';
        if (totalPages <= 1) return;

        const mkBtn = (html, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (active ? ' active' : '');
            btn.innerHTML = html;
            btn.disabled  = disabled;
            btn.addEventListener('click', () => {
                currentPage = page;
                renderTable();
                renderPagination();
            });
            return btn;
        };

        ctrl.appendChild(mkBtn('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage === 1));

        // Smart page range
        const delta = 2;
        let last = null;
        for (let p = 1; p <= totalPages; p++) {
            const inRange = p === 1 || p === totalPages ||
                (p >= currentPage - delta && p <= currentPage + delta);
            if (!inRange) {
                if (last !== null && last !== '…') {
                    const ell = document.createElement('span');
                    ell.className = 'page-ellipsis';
                    ell.textContent = '…';
                    ctrl.appendChild(ell);
                    last = '…';
                }
                continue;
            }
            ctrl.appendChild(mkBtn(p, p, false, p === currentPage));
            last = p;
        }

        ctrl.appendChild(mkBtn('<i class="fas fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages));
    }

    // ─── Save ─────────────────────────────────────────────────────────────────
    document.getElementById('saveBtn').addEventListener('click', async function () {
        // ── Pre-save validation: koi bhi row mein error ho to rokein ──────────
        const errorInputs = document.querySelectorAll('#test-list .commission-rate.input-error');
        if (errorInputs.length > 0) {
            // Scroll to first error
            errorInputs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            errorInputs[0].focus();
            alert(`⚠️ ${errorInputs.length} row(s) mein galat commission rate hai.\nPehle unhe theek karein (laal highlighted rows), phir save karein.`);
            return;
        }

        // Warn about overridden rows — confirm to proceed
        const overrideCount = document.querySelectorAll('#test-list tr.manually-overridden').length;
        if (overrideCount > 0) {
            const ok = confirm(
                `${overrideCount} row(s) mein aapne alag se rate set kiya hai (highlighted rows).\n` +
                `Kya aap inhe include karke save karna chahte hain?`
            );
            if (!ok) return;
        }

        const assignedBy  = userId;
        const itemsToSave = [];

        // Collect ALL data from allData array — not just visible paginated rows
        // We update values from DOM for currently visible rows, rest keep current values
        // Build a map of mongoId → { commissionRate, finalPrice } from DOM
        const domMap = {};
        document.querySelectorAll('#test-list tr').forEach(row => {
            const mongoId = row.dataset.mongoId;
            if (!mongoId) return;
            domMap[mongoId] = {
                commissionRate: parseFloat(row.querySelector('.commission-rate')?.value || '0') / 100,
                price:          parseFloat(row.querySelector('.final-price1')?.textContent || '0'),
            };
        });

        allData.forEach((test, index) => {
            const mongoId = test._id;

            // ── CRITICAL: skip items with no valid MongoDB _id ──────────────
            // These cannot be saved — backend will throw "Invalid testId format"
            if (!mongoId || mongoId === 'undefined' || mongoId === '') {
                console.warn(`[save] Skipping item at index ${index} — missing _id:`, test);
                return; // skip this item
            }

            const dom     = domMap[mongoId];
            const myPrice = parseFloat(test.myPrice ?? test.basePrice) || 0;

            // Old percentage fallback from previously assigned price
            const prevFinalPrice  = parseFloat(test.assignedPriceToFranchisee) || myPrice;
            const oldDiff         = prevFinalPrice - myPrice;
            const oldPercentage   = myPrice > 0 ? (oldDiff / myPrice) : 0;

            const type     = test._type;
            const testName = test.packageName || test.testName || test.panelName || '';

            // ── Commission Rate priority ────────────────────────────────────
            // 1. DOM (currently visible page) — most up to date
            // 2. _manualRate — user changed on another page (persisted in allData)
            // 3. _overrideRate — global "Apply to All" was used
            // 4. oldPercentage — whatever was saved before (fallback)
            let commissionRate;
            if (dom) {
                commissionRate = dom.commissionRate;
            } else if (test._manualRate !== undefined) {
                commissionRate = test._manualRate / 100;
            } else if (test._overrideRate !== undefined) {
                commissionRate = test._overrideRate / 100;
            } else {
                commissionRate = oldPercentage;
            }

            // ── Final price (what franchisee pays) ──────────────────────────
            let price;
            if (dom) {
                price = dom.price;
            } else {
                // Recalculate from rate since DOM not available for this page
                const ratePercent = test._manualRate ?? test._overrideRate ?? (oldPercentage * 100);
                price = myPrice + (ratePercent / 100) * myPrice;
            }

            // finalPrice field = MRP (max retail price — as per original intent)
            const finalPrice   = parseFloat(test.mrpPrice) || 0;
            const franchiseeId = _id;

            itemsToSave.push({
                type,
                testId: mongoId,   // ✅ guaranteed to be valid MongoDB ObjectId string
                testName,
                price:          Number(price.toFixed(2)),
                commissionRate: Number(commissionRate.toFixed(6)),
                finalPrice,
                franchiseeId,
                assignedBy,
            });
        });

        console.log(`[save] Total items to save: ${itemsToSave.length} / ${allData.length}`);
        // Log any items that were skipped
        const skipped = allData.length - itemsToSave.length;
        if (skipped > 0) {
            console.warn(`[save] ${skipped} items skipped due to missing _id`);
        }

        await sendDataToBackend(itemsToSave);
    });

    // ─── Send to Backend ──────────────────────────────────────────────────────
    async function sendDataToBackend(items) {
        // Guard: agar koi valid item nahi to save mat karo
        if (!items || items.length === 0) {
            alert('⚠️ Save karne ke liye koi valid item nahi mila.\nConsole check karein — kuch items mein _id missing ho sakti hai.');
            return;
        }

        showSpinner(`Saving ${items.length} items…`);
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/assign-prices`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ items }),
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
            } else {
                alert('Failed to save data. Please try again.\n' + (data.message || ''));
            }
        } catch (error) {
            console.error('Error sending data to backend:', error);
            alert('An error occurred. Please try again.');
        } finally {
            hideSpinner();
        }
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    showSpinner('Loading franchisee data…');
    await fetchFranchiseeData();
    hideSpinner();

    showSpinner('Loading rate list…');
    await fetchTestList();
    hideSpinner();

})();
