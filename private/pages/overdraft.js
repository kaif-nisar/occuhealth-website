(function () {
  const BASE = (typeof BASE_URL !== 'undefined' && BASE_URL) ? BASE_URL : '';
  const token = localStorage.getItem('token') || '';

  let portalsData = [];

  const tableBody = document.getElementById('odTableBody');
  const searchInput = document.getElementById('odSearch');
  const roleFilter = document.getElementById('odRoleFilter');
  const statusFilter = document.getElementById('odStatusFilter');
  const refreshBtn = document.getElementById('odRefreshBtn');
  const toastEl = document.getElementById('odToast');

  const metricTotal = document.getElementById('metricTotal');
  const metricEnabled = document.getElementById('metricEnabled');
  const metricTotalLimit = document.getElementById('metricTotalLimit');
  const metricUtilized = document.getElementById('metricUtilized');

  function showToast(message, type = 'success') {
    if (!toastEl) return;
    toastEl.className = `od-toast ${type}`;
    toastEl.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i> ${message}`;
    toastEl.style.display = 'flex';
    setTimeout(() => {
      toastEl.style.display = 'none';
    }, 3500);
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function loadData() {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="od-empty">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <p>Loading eligible portals...</p>
        </td>
      </tr>
    `;

    try {
      let res = await fetch(`${BASE}/api/v1/user/get-overdraft-eligible-users`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        // Fallback to fetchFranchiseeChain if user is franchisee / superFranchisee
        res = await fetch(`${BASE}/api/v1/user/fetchFranchiseeChain`, {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
      }

      if (!res.ok) {
        throw new Error(`Failed to load data (${res.status})`);
      }

      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);

      portalsData = rawList.map(item => {
        const wallet = Number(item.bookingWallet ?? item.wallet ?? 0);
        const limit = Number(item.overdraftLimit ?? 0);
        const allowed = Boolean(item.overdraftAllowed);
        const available = allowed ? (wallet + limit) : Math.max(0, wallet);

        return {
          _id: item._id,
          fullName: item.fullName || item.name || 'Unnamed Portal',
          username: item.username || item.email || item._id,
          email: item.email || '',
          role: item.role || 'franchisee',
          bookingWallet: wallet,
          overdraftAllowed: allowed,
          overdraftLimit: limit,
          availableBalance: available,
          overdraftSetBy: item.overdraftSetBy?.fullName || item.overdraftSetBy?.username || '',
          overdraftUpdatedAt: item.overdraftUpdatedAt ? new Date(item.overdraftUpdatedAt).toLocaleDateString() : ''
        };
      });

      updateMetrics();
      renderTable();
    } catch (err) {
      console.error('Error loading overdraft portals:', err);
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="od-empty" style="color: #dc2626;">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>Failed to load portals: ${err.message}</p>
          </td>
        </tr>
      `;
    }
  }

  function updateMetrics() {
    if (!metricTotal) return;
    const total = portalsData.length;
    const enabled = portalsData.filter(p => p.overdraftAllowed).length;
    const totalLimit = portalsData
      .filter(p => p.overdraftAllowed)
      .reduce((sum, p) => sum + (p.overdraftLimit || 0), 0);
    const utilized = portalsData
      .filter(p => p.bookingWallet < 0)
      .reduce((sum, p) => sum + Math.abs(p.bookingWallet), 0);

    metricTotal.textContent = total;
    metricEnabled.textContent = enabled;
    metricTotalLimit.textContent = `₹${totalLimit.toLocaleString('en-IN')}`;
    metricUtilized.textContent = `₹${utilized.toLocaleString('en-IN')}`;
  }

  function formatRole(role) {
    if (role === 'superFranchisee') return 'Super Franchisee';
    if (role === 'franchisee') return 'Franchisee';
    if (role === 'subFranchisee') return 'Sub Franchisee';
    return role;
  }

  function renderTable() {
    if (!tableBody) return;

    const query = (searchInput?.value || '').toLowerCase().trim();
    const roleVal = roleFilter?.value || 'all';
    const statusVal = statusFilter?.value || 'all';

    const filtered = portalsData.filter(item => {
      // Search
      const matchSearch =
        item.fullName.toLowerCase().includes(query) ||
        item.username.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query);

      // Role
      const matchRole = roleVal === 'all' || item.role === roleVal;

      // Status
      let matchStatus = true;
      if (statusVal === 'enabled') matchStatus = item.overdraftAllowed === true;
      if (statusVal === 'disabled') matchStatus = item.overdraftAllowed === false;
      if (statusVal === 'in_negative') matchStatus = item.bookingWallet < 0;

      return matchSearch && matchRole && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="od-empty">
            <i class="fa-solid fa-folder-open"></i>
            <p>No portals match the selected filter criteria.</p>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(portal => {
      const isNegative = portal.bookingWallet < 0;
      const isZero = portal.bookingWallet === 0;
      const walletClass = isNegative ? 'negative' : (isZero ? 'zero' : 'positive');
      const walletSign = isNegative ? '-₹' + Math.abs(portal.bookingWallet).toFixed(2) : '₹' + portal.bookingWallet.toFixed(2);

      const power = portal.overdraftAllowed
        ? (portal.bookingWallet + portal.overdraftLimit)
        : Math.max(0, portal.bookingWallet);

      return `
        <tr data-id="${portal._id}">
          <td>
            <div class="od-user-cell">
              <span class="od-user-name">${portal.fullName}</span>
              <span class="od-user-sub">@${portal.username} ${portal.email ? '&bull; ' + portal.email : ''}</span>
            </div>
          </td>
          <td>
            <span class="od-badge ${portal.role}">${formatRole(portal.role)}</span>
          </td>
          <td>
            <span class="od-wallet-val ${walletClass}">${walletSign}</span>
            ${isNegative ? '<div style="font-size: 11px; color: #dc2626; font-weight: 600;">(Overdraft Active)</div>' : ''}
          </td>
          <td>
            <div class="od-toggle-cell">
              <label class="od-switch">
                <input type="checkbox" class="od-toggle-input" ${portal.overdraftAllowed ? 'checked' : ''} />
                <span class="od-slider"></span>
              </label>
              <span class="od-toggle-status-text ${portal.overdraftAllowed ? 'enabled' : 'disabled'}">
                ${portal.overdraftAllowed ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </td>
          <td>
            <div class="od-limit-box">
              <div class="od-input-wrap">
                <span>₹</span>
                <input type="number" class="od-limit-input" min="0" step="500" value="${portal.overdraftLimit}" placeholder="0" />
              </div>
              <div class="od-presets">
                <button type="button" class="od-preset-btn" data-add="1000">+1K</button>
                <button type="button" class="od-preset-btn" data-add="5000">+5K</button>
                <button type="button" class="od-preset-btn" data-add="10000">+10K</button>
                <button type="button" class="od-preset-btn" data-set="0">Reset</button>
              </div>
            </div>
          </td>
          <td>
            <div class="od-power-cell">
              <span class="od-power-val">₹${power.toFixed(2)}</span>
              <span class="od-power-sub">${portal.overdraftAllowed ? 'Wallet + Overdraft' : 'Wallet only'}</span>
            </div>
          </td>
          <td>
            <div style="font-size: 11.5px; color: #64748b;">
              ${portal.overdraftSetBy ? `<div>By: <strong>${portal.overdraftSetBy}</strong></div>` : ''}
              ${portal.overdraftUpdatedAt ? `<div>Date: ${portal.overdraftUpdatedAt}</div>` : '<span style="color: #94a3b8;">Default</span>'}
            </div>
          </td>
          <td>
            <button class="od-row-save-btn">
              <i class="fa-solid fa-floppy-disk"></i> Save
            </button>
          </td>
        </tr>
      `;
    }).join('');

    attachRowEvents();
  }

  function attachRowEvents() {
    const rows = tableBody.querySelectorAll('tr[data-id]');
    rows.forEach(row => {
      const id = row.getAttribute('data-id');
      const portal = portalsData.find(p => p._id === id);
      if (!portal) return;

      const toggle = row.querySelector('.od-toggle-input');
      const toggleLabel = row.querySelector('.od-toggle-status-text');
      const limitInput = row.querySelector('.od-limit-input');
      const powerVal = row.querySelector('.od-power-val');
      const powerSub = row.querySelector('.od-power-sub');
      const saveBtn = row.querySelector('.od-row-save-btn');
      const presetBtns = row.querySelectorAll('.od-preset-btn');

      function recalculatePower() {
        const allowed = toggle.checked;
        const limit = Number(limitInput.value) || 0;
        const power = allowed ? (portal.bookingWallet + limit) : Math.max(0, portal.bookingWallet);
        powerVal.textContent = `₹${power.toFixed(2)}`;
        powerSub.textContent = allowed ? 'Wallet + Overdraft' : 'Wallet only';

        if (allowed) {
          toggleLabel.textContent = 'Enabled';
          toggleLabel.className = 'od-toggle-status-text enabled';
        } else {
          toggleLabel.textContent = 'Disabled';
          toggleLabel.className = 'od-toggle-status-text disabled';
        }
      }

      toggle.addEventListener('change', recalculatePower);
      limitInput.addEventListener('input', recalculatePower);

      presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const add = btn.getAttribute('data-add');
          const set = btn.getAttribute('data-set');
          if (add) {
            limitInput.value = (Number(limitInput.value) || 0) + Number(add);
          } else if (set !== null) {
            limitInput.value = Number(set);
          }
          recalculatePower();
        });
      });

      saveBtn.addEventListener('click', async () => {
        const newAllowed = Boolean(toggle.checked);
        const newLimit = Number(limitInput.value) || 0;

        if (newLimit < 0) {
          showToast('Overdraft limit cannot be negative', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
          const res = await fetch(`${BASE}/api/v1/user/set-overdraft`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              userId: id,
              overdraftAllowed: newAllowed,
              overdraftLimit: newLimit
            })
          });

          const json = await res.json();
          if (!res.ok) {
            throw new Error(json.message || 'Failed to update overdraft');
          }

          portal.overdraftAllowed = newAllowed;
          portal.overdraftLimit = newLimit;
          portal.availableBalance = newAllowed ? (portal.bookingWallet + newLimit) : Math.max(0, portal.bookingWallet);
          if (json.user?.overdraftSetBy?.fullName) {
            portal.overdraftSetBy = json.user.overdraftSetBy.fullName;
          }
          portal.overdraftUpdatedAt = new Date().toLocaleDateString();

          saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
          saveBtn.classList.add('saved');
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
            saveBtn.classList.remove('saved');
          }, 2000);

          updateMetrics();
          showToast(`Overdraft settings saved for ${portal.fullName}!`, 'success');
        } catch (err) {
          console.error('Error saving overdraft:', err);
          showToast(err.message || 'Error saving overdraft', 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
        }
      });
    });
  }

  // Event listeners
  if (searchInput) searchInput.addEventListener('input', renderTable);
  if (roleFilter) roleFilter.addEventListener('change', renderTable);
  if (statusFilter) statusFilter.addEventListener('change', renderTable);
  if (refreshBtn) refreshBtn.addEventListener('click', loadData);

  // Initial load
  loadData();
})();