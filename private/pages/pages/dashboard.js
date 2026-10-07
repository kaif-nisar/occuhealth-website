(function () {
  let charts = {};
  let franchisePage = 1;
  let franchiseRequestId = 0;
  let opsRequestId = 0;
  let currentPeriod = "1month";
  let currentScope = "all";
  let activeRange = null;
  let listenersBound = false;

  function byId(id) { return document.getElementById(id); }

  function asCurrency(value) {
    const num = Number(value || 0);
    return `INR ${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }

  function asDate(value) {
    if (!value) return "--";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function daysRemaining(endDateLike) {
    if (!endDateLike) return "--";
    const end = new Date(endDateLike);
    if (Number.isNaN(end.getTime())) return "--";
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }

  function normalizeText(value, fallback = "--") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
  }

  function hasPermission(permission, perms, isStaff) {
    if (!isStaff) return true;
    return Boolean(perms && perms[permission]);
  }

  function hasAnyPermission(rule, perms, isStaff) {
    if (!isStaff) return true;
    const tokens = String(rule || "").split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    return tokens.some((token) => hasPermission(token, perms, isStaff));
  }

  function applyPermissionVisibility(perms, isStaff) {
    document.querySelectorAll("[data-permission]").forEach((node) => {
      const rule = node.getAttribute("data-permission");
      node.style.display = hasAnyPermission(rule, perms, isStaff) ? "" : "none";
    });
  }

  async function requestJson(path, options) {
    const res = await fetch(path, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      }
    });
    let body = null;
    try { body = await res.json(); } catch (_) { body = null; }
    return { ok: res.ok, status: res.status, data: body };
  }

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  }

  function drawChart(key, canvasId, type, labels, data, label, color, customOptions) {
    const canvas = byId(canvasId);
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart(key);

    const defaultDataset = {
      label, data,
      borderColor: color,
      backgroundColor: type === "line" ? "rgba(15,98,254,0.14)" : color,
      fill: type === "line",
      borderWidth: 2,
      tension: 0.34,
      pointRadius: type === "line" ? 2 : 0
    };

    if (type === "doughnut") {
      defaultDataset.backgroundColor = Array.isArray(color) ? color : ["#0f62fe","#14a57b","#c87c1a","#bf3d47"];
      defaultDataset.borderWidth = 1;
      defaultDataset.borderColor = "#ffffff";
      defaultDataset.hoverOffset = 4;
    }

    charts[key] = new Chart(canvas.getContext("2d"), {
      type,
      data: { labels, datasets: [defaultDataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: true, position: type === "doughnut" ? "bottom" : "top" }
        },
        scales: type === "doughnut" ? {} : {
          x: { grid: { display: false } },
          y: { grid: { color: "rgba(0,0,0,0.06)" }, beginAtZero: true }
        },
        ...(customOptions || {})
      }
    });
  }

  function setMetric(id, value) { const el = byId(id); if (el) el.textContent = value; }
  function setTrend(id, text)   { const el = byId(id); if (el) el.textContent = text; }

  function setPill(id, text, statusClass) {
    const el = byId(id);
    if (!el) return;
    el.textContent = text;
    el.className = "state-pill " + (statusClass || "na");
  }

  function statusClass(value) {
    const v = String(value || "").toLowerCase();
    if (["active","paid","captured"].includes(v)) return "active";
    if (["grace","pending","created","authorized"].includes(v)) return "grace";
    if (["expired","failed","inactive","unpaid"].includes(v)) return "expired";
    return "na";
  }

  function renderFranchiseRows(list, pagination = {}) {
    const tbody = byId("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!Array.isArray(list) || !list.length) {
      tbody.innerHTML = '<tr><td colspan="4">No franchise data available.</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${normalizeText(item.fullName)}</td>
        <td>${normalizeText(item.address)}</td>
        <td>${normalizeText(item.phoneNo)}<br>${normalizeText(item.email)}</td>
        <td>${item.isActive ? "Active" : "Inactive"}</td>`;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    const paginationEl = byId("franchisePagination");
    const pageInfo = byId("franchisePageInfo");
    const previous = byId("franchisePrev");
    const next = byId("franchiseNext");
    const totalPages = Math.max(1, Number(pagination.totalPages || 1));
    franchisePage = Math.min(Math.max(1, Number(pagination.page || 1)), totalPages);
    if (paginationEl) paginationEl.hidden = totalPages <= 1;
    if (pageInfo) pageInfo.textContent = `Page ${franchisePage} of ${totalPages}`;
    if (previous) previous.disabled = franchisePage <= 1;
    if (next) next.disabled = franchisePage >= totalPages;
  }

  function renderSubscription(subscriptionPayload) {
    const sub = subscriptionPayload && subscriptionPayload.subscription ? subscriptionPayload.subscription : {};
    const status  = normalizeText(subscriptionPayload && subscriptionPayload.status, "na").toLowerCase();
    const payment = normalizeText(sub.paymentStatus, "na").toLowerCase();

    setPill("subStatusPill",  `STATUS: ${status.toUpperCase()}`,   statusClass(status));
    setPill("payStatusPill",  `PAYMENT: ${payment.toUpperCase()}`, statusClass(payment));

    setMetric("subPlanType",  normalizeText(sub.planType || sub.planDuration));
    setMetric("subPlanLayer", normalizeText(sub.planLayer));
    setMetric("subDuration",  normalizeText(sub.durationDays));
    setMetric("subPrice",     asCurrency(sub.price));
    setMetric("subStart",     asDate(sub.startDate));

    const effectiveEnd = sub.effectiveEndDate || sub.endDate;
    const remDays = daysRemaining(effectiveEnd);

    setMetric("subEnd",            asDate(sub.endDate));
    setMetric("subEffectiveEnd",   asDate(sub.effectiveEndDate));
    setMetric("subDays",           String(remDays));
    setMetric("remainingDaysTop",  remDays === "--" ? "--" : `${remDays} days`);
    setMetric("subscriptionEndTop",asDate(effectiveEnd));
    setMetric("planTypeTop",       normalizeText(sub.planType || sub.planDuration || sub.planLayer, "NA").toUpperCase());

    setTrend("trend-remainingDays", remDays === "--" ? "--" : `${remDays}d`);
    setTrend("trend-endDate",  normalizeText(subscriptionPayload && subscriptionPayload.status, "NA").toUpperCase());
    setTrend("trend-planType", normalizeText(sub.paymentStatus, "NA").toUpperCase());

    const grace = sub.gracePeriod;
    setMetric("subGrace", grace
      ? `Enabled: ${grace.isEnabled ? "Yes" : "No"}, Until: ${asDate(grace.graceUntil)}`
      : "Not configured");

    setMetric("tenantStatus", normalizeText(subscriptionPayload && subscriptionPayload.tenantStatus));
    setMetric("tenantName",   normalizeText(subscriptionPayload && subscriptionPayload.tenantName));
    setMetric("tenantCode",   normalizeText(subscriptionPayload && subscriptionPayload.tenantCode));

    const msg = byId("subMessage");
    if (msg) msg.textContent = normalizeText(subscriptionPayload && subscriptionPayload.message, "--");
  }

  function mapToSparklinePoints(values) {
    const safe = Array.isArray(values) && values.length ? values : [4,6,5,7,6,8,7];
    const min = Math.min(...safe);
    const max = Math.max(...safe);
    const range = Math.max(max - min, 1);
    const n = safe.length;
    return safe.map((v, i) => {
      const x = n === 1 ? 0 : (i * 120) / (n - 1);
      const y = 24 - ((v - min) / range) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function setSparkline(svgId, values) {
    const svg = byId(svgId);
    if (!svg) return;
    const poly = svg.querySelector("polyline");
    if (!poly) return;
    poly.setAttribute("points", mapToSparklinePoints(values));
  }

  function renderOperationalData(dashboardPayload, contextUser) {
    const stats  = (dashboardPayload && dashboardPayload.stats)  || {};
    const chartsData = (dashboardPayload && dashboardPayload.charts) || {};

    setMetric("totalBookings",    normalizeText(stats.totalBookings, "0"));
    setMetric("totalRevenue",     asCurrency(stats.totalRevenue || 0));
    setMetric("pendingTests",     normalizeText(stats.pendingTests, "0"));
    setMetric("activeFranchises", normalizeText(stats.activeFranchises, "0"));

    const monthly  = chartsData.monthlyRevenue || { labels: [], data: [] };
    const daily    = chartsData.dailyRevenue   || { labels: [], data: [] };
    const tests    = chartsData.topTests       || { labels: [], data: [] };
    const monthlyData = Array.isArray(monthly.data) ? monthly.data : [];
    const dailyData   = Array.isArray(daily.data)   ? daily.data   : [];

    const lastMonthly     = monthlyData.length ? monthlyData[monthlyData.length - 1] : 0;
    const previousMonthly = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : lastMonthly;
    const delta = previousMonthly ? Math.round(((lastMonthly - previousMonthly) / previousMonthly) * 100) : 0;

    setTrend("trend-totalBookings", `${normalizeText(stats.pendingTests, 0)} pending`);
    setTrend("trend-totalRevenue",  `${delta >= 0 ? "+" : ""}${delta}%`);
    setTrend("trend-pendingTests",  `${normalizeText(stats.pendingTests, 0)} open`);

    setSparkline("spark-totalBookings", dailyData.slice(-8));
    setSparkline("spark-totalRevenue",  monthlyData.slice(-8));
    setSparkline("spark-remainingDays", tests.data || []);
    setSparkline("spark-pendingTests",  dailyData.slice(-8).map((v) => Math.max(1, Math.round(v / 1000))));
    setSparkline("spark-endDate",       monthlyData.slice(-8).map((v) => Math.max(1, Math.round(v / 1000))));
    setSparkline("spark-planType",      monthlyData.slice(-8).map((v, i) => Math.max(1, Math.round((v / 2000) + i))));

    drawChart("monthlyRevenue", "revenueChart", "line",
      Array.isArray(monthly.labels) ? monthly.labels : [], monthlyData, "Monthly Revenue", "#0f62fe");

    drawChart("dailyRevenue", "samplesChart", "line",
      Array.isArray(daily.labels) ? daily.labels : [], dailyData, "Daily Revenue", "#14a57b");

    drawChart("topTests", "testCategoriesChart", "doughnut",
      Array.isArray(tests.labels) ? tests.labels : [],
      Array.isArray(tests.data)   ? tests.data   : [],
      "Top Tests",
      ["#5a66f3","#13ad7f","#f0a43d","#e65b74"],
      {
        cutout: "52%",
        layout: { padding: 6 },
        plugins: {
          legend: { display: true, position: "bottom",
            labels: { boxWidth: 10, usePointStyle: true } }
        }
      }
    );

    renderFranchiseRows(
      dashboardPayload && dashboardPayload.franchisees,
      dashboardPayload && dashboardPayload.franchisePagination
    );
  }

  // ════════════════════════════════════════════════════════════
  // DATE & TIME FILTER LOGIC (EXACT MILLISECOND PRECISION)
  // ════════════════════════════════════════════════════════════

  function getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function formatDateToInput(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateInput(str) {
    if (!str || typeof str !== "string") return null;
    const trimmed = str.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatTime12h(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "--:--:--";
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, "0");
    return `${strHours}:${minutes}:${seconds} ${ampm}`;
  }

  function computePeriodRange(periodKey) {
    const now = new Date(); // Instant user clicked/selected, exact ms
    let start = null;
    let end = now;
    let label = "One Month";
    let inputStart = "";
    let inputEnd = formatDateToInput(now);

    switch (periodKey) {
      case "today": {
        start = getStartOfDay(now);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "Today";
        inputStart = formatDateToInput(now);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "yesterday": {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        start = getStartOfDay(yest);
        end = getEndOfDay(yest);
        label = "Yesterday";
        inputStart = formatDateToInput(yest);
        inputEnd = formatDateToInput(yest);
        break;
      }
      case "last7days": {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 6);
        start = getStartOfDay(d7);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "Last 7 days";
        inputStart = formatDateToInput(d7);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "1month": {
        const d1m = new Date(now);
        d1m.setMonth(d1m.getMonth() - 1);
        start = getStartOfDay(d1m);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "One Month";
        inputStart = formatDateToInput(d1m);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "6months": {
        const d6m = new Date(now);
        d6m.setMonth(d6m.getMonth() - 6);
        start = getStartOfDay(d6m);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "6 Months";
        inputStart = formatDateToInput(d6m);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "1year": {
        const d1y = new Date(now);
        d1y.setFullYear(d1y.getFullYear() - 1);
        start = getStartOfDay(d1y);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "1 Year";
        inputStart = formatDateToInput(d1y);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "5years": {
        const d5y = new Date(now);
        d5y.setFullYear(d5y.getFullYear() - 5);
        start = getStartOfDay(d5y);
        end = new Date(); // Exactly current instant down to milliseconds
        label = "5 Years";
        inputStart = formatDateToInput(d5y);
        inputEnd = formatDateToInput(now);
        break;
      }
      case "alltime": {
        start = null;
        end = new Date();
        label = "All Time";
        inputStart = "";
        inputEnd = formatDateToInput(now);
        break;
      }
      case "custom": {
        const startInputEl = byId("filterStartDate");
        const endInputEl = byId("filterEndDate");
        const startVal = startInputEl ? startInputEl.value : "";
        const endVal = endInputEl ? endInputEl.value : "";
        const parsedStart = parseDateInput(startVal);
        const parsedEnd = parseDateInput(endVal);

        if (parsedStart) {
          start = getStartOfDay(parsedStart);
        }
        if (parsedEnd) {
          const todayStr = formatDateToInput(now);
          if (endVal === todayStr) {
            // User chose today as end date -> exact current millisecond!
            end = new Date();
          } else {
            end = getEndOfDay(parsedEnd);
          }
        } else {
          end = new Date();
        }
        label = "Custom Range";
        inputStart = startVal;
        inputEnd = endVal || formatDateToInput(now);
        break;
      }
      default: {
        const d1m = new Date(now);
        d1m.setMonth(d1m.getMonth() - 1);
        start = getStartOfDay(d1m);
        end = new Date();
        label = "One Month";
        inputStart = formatDateToInput(d1m);
        inputEnd = formatDateToInput(now);
        break;
      }
    }

    return { periodKey, start, end, label, inputStart, inputEnd };
  }

  function syncFilterInputs(range) {
    const periodSelect = byId("filterPeriod");
    const startInput = byId("filterStartDate");
    const endInput = byId("filterEndDate");

    if (periodSelect && periodSelect.value !== range.periodKey) {
      periodSelect.value = range.periodKey;
    }
    if (startInput && range.periodKey !== "custom") {
      startInput.value = range.inputStart;
    }
    if (endInput && range.periodKey !== "custom") {
      endInput.value = range.inputEnd;
    }
  }

    function updateScopeUI(scope) {
    const btnAll = byId("btnScopeAll");
    const btnSelf = byId("btnScopeSelf");
    if (btnAll) btnAll.classList.toggle("active", scope === "all");
    if (btnSelf) btnSelf.classList.toggle("active", scope === "self");

    const dashSubtitle = byId("dashSubtitle");
    if (dashSubtitle) {
      dashSubtitle.textContent = scope === "self"
        ? "Showing your self-created bookings & users under this tenant (Self)."
        : "Welcome lab flow lis. Tenant operations and subscription health in one view (All Data).";
    }

    const tenantChip = document.querySelector(".tenant-isolated-chip span");
    if (tenantChip) {
      tenantChip.textContent = scope === "self" ? "Self Data (Created By You)" : "Tenant Isolated Data";
    }
  }

  function setScope(scope) {
    if (currentScope === scope) return;
    currentScope = scope;
    updateScopeUI(scope);
    fetchDashboardOpsData(activeRange, true);
  }

  function updateSyncUI(syncDate, rangeLabel) {
    const timeStr = formatTime12h(syncDate);
    const lastSyncEl = byId("dashLastSync");
    if (lastSyncEl) lastSyncEl.textContent = `Last sync: ${timeStr}`;

    const activeTextEl = byId("activePeriodText");
    const scopeLabel = currentScope === "self" ? "Self" : "All Data";
    if (activeTextEl) activeTextEl.textContent = `${rangeLabel} • ${scopeLabel} (${timeStr})`;

    const lastUpdatedEl = byId("dashLastUpdated");
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Last update: ${syncDate.toLocaleString("en-IN")}`;
  }

  async function fetchDashboardOpsData(range, resetPage = true) {
    if (resetPage) franchisePage = 1;
    const requestId = ++opsRequestId;
    const refreshBtn = byId("btnRefreshFilter");
    if (refreshBtn) refreshBtn.classList.add("is-spinning");

    const contextUser = window.user || {};
    const baseUrl = typeof BASE_URL !== "undefined" ? BASE_URL : window.location.origin;

    const params = [];
    params.push(`scope=${encodeURIComponent(currentScope)}`);
    if (range && range.start) {
      params.push(`startDate=${encodeURIComponent(range.start.toISOString())}`);
    }
    if (range && range.end) {
      params.push(`endDate=${encodeURIComponent(range.end.toISOString())}`);
    }
    if (franchisePage > 1) {
      params.push(`franchisePage=${franchisePage}`);
    }

    const queryString = params.length ? `?${params.join("&")}` : "";
    const endpoint = `${baseUrl}/api/v1/user/get-booking-for-dashboard${queryString}`;

    try {
      const opsResult = await requestJson(endpoint);
      if (requestId !== opsRequestId) return; // Ignore if superseded by a newer request

      if (opsResult.ok && opsResult.data) {
        renderOperationalData(opsResult.data, contextUser);
        const syncTime = new Date();
        updateSyncUI(syncTime, range ? range.label : "One Month");
      }
    } catch (err) {
      console.error("Failed to load dashboard operational data:", err);
    } finally {
      if (requestId === opsRequestId && refreshBtn) {
        refreshBtn.classList.remove("is-spinning");
      }
    }
  }

  async function loadFranchisePage(page) {
    const requestId = ++franchiseRequestId;
    const baseUrl = typeof BASE_URL !== "undefined" ? BASE_URL : window.location.origin;
    let url = `${baseUrl}/api/v1/user/get-booking-for-dashboard?franchisePage=${page}&scope=${encodeURIComponent(currentScope)}`;
    if (activeRange) {
      if (activeRange.start) url += `&startDate=${encodeURIComponent(activeRange.start.toISOString())}`;
      if (activeRange.end) url += `&endDate=${encodeURIComponent(activeRange.end.toISOString())}`;
    }
    const result = await requestJson(url);
    if (requestId !== franchiseRequestId || !result.ok || !result.data) return;
    renderFranchiseRows(result.data.franchisees, result.data.franchisePagination);
  }

  function applyFilter(periodKey) {
    currentPeriod = periodKey;
    activeRange = computePeriodRange(periodKey);
    syncFilterInputs(activeRange);
    fetchDashboardOpsData(activeRange, true);
  }

  function setupFilterListeners() {
    if (listenersBound) return;
    listenersBound = true;

    const periodSelect = byId("filterPeriod");
    const startInput = byId("filterStartDate");
    const endInput = byId("filterEndDate");
    const btnApply = byId("btnApplyFilter");
    const btnToday = byId("btnTodayFilter");
    const btnRefresh = byId("btnRefreshFilter");

    const btnScopeAll = byId("btnScopeAll");
    const btnScopeSelf = byId("btnScopeSelf");
    if (btnScopeAll) {
      btnScopeAll.addEventListener("click", () => setScope("all"));
    }
    if (btnScopeSelf) {
      btnScopeSelf.addEventListener("click", () => setScope("self"));
    }


    if (periodSelect) {
      periodSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "custom") {
          currentPeriod = "custom";
          activeRange = computePeriodRange("custom");
        } else {
          applyFilter(val);
        }
      });
    }

    if (startInput) {
      startInput.addEventListener("change", () => {
        if (periodSelect) periodSelect.value = "custom";
        currentPeriod = "custom";
      });
    }

    if (endInput) {
      endInput.addEventListener("change", () => {
        if (periodSelect) periodSelect.value = "custom";
        currentPeriod = "custom";
      });
    }

    if (btnApply) {
      btnApply.addEventListener("click", () => {
        const selectedVal = periodSelect ? periodSelect.value : currentPeriod;
        applyFilter(selectedVal);
      });
    }

    if (btnToday) {
      btnToday.addEventListener("click", () => {
        applyFilter("today");
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        const selectedVal = periodSelect ? periodSelect.value : currentPeriod;
        applyFilter(selectedVal);
      });
    }
  }

  async function initDashboard() {
    const contextUser = window.user || {};
    const permissions = contextUser.permissions || {};
    const isStaff     = contextUser.role === "staff";
    const baseUrl     = typeof BASE_URL !== "undefined" ? BASE_URL : window.location.origin;

    applyPermissionVisibility(permissions, isStaff);

    const subtitle = byId("dashSubtitle");
    if (subtitle) {
      const displayName = normalizeText(contextUser.fullName || contextUser.username, "lab flow lis");
      subtitle.textContent = `Welcome ${displayName}. Tenant operations and subscription health in one view.`;
    }

    // Default period: One Month
    currentPeriod = "1month";
    activeRange = computePeriodRange("1month");
    syncFilterInputs(activeRange);
    setupFilterListeners();

    // Fetch operational data with One Month default filter and subscription data
    const opsPromise = fetchDashboardOpsData(activeRange, true);
    const subPromise = requestJson(`${baseUrl}/api/v1/user/check-subscription`, { method: "POST" });

    const [opsSettled, subResult] = await Promise.allSettled([opsPromise, subPromise]);

    if (subResult.status === "fulfilled" && subResult.value.ok && subResult.value.data) {
      requestAnimationFrame(() => {
        renderSubscription(subResult.value.data);
      });
    }
  }

  window.__dashboardInit = initDashboard;
  window.__dashboardLoadFranchisePage = function (delta) {
    loadFranchisePage(franchisePage + delta);
  };

  if (!window.__dashboardClickListenerBound) {
    window.__dashboardClickListenerBound = true;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#franchisePrev, #franchiseNext");
      if (!button || button.disabled) return;
      if (typeof window.__dashboardLoadFranchisePage === "function") {
        window.__dashboardLoadFranchisePage(button.id === "franchiseNext" ? 1 : -1);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard, { once: true });
  } else {
    initDashboard();
  }
})();
