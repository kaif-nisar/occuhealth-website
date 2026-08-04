    (function () {
      let charts = {};
      let franchisePage = 1;
      let franchiseRequestId = 0;

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

      async function loadFranchisePage(page) {
        const requestId = ++franchiseRequestId;
        const result = await requestJson(`${BASE_URL}/api/v1/user/get-booking-for-dashboard?franchisePage=${page}`);
        if (requestId !== franchiseRequestId || !result.ok || !result.data) return;
        renderFranchiseRows(result.data.franchisees, result.data.franchisePagination);
      }

      async function initDashboard() {
        const contextUser = window.user || {};
        const permissions = contextUser.permissions || {};
        const isStaff     = contextUser.role === "staff";

        applyPermissionVisibility(permissions, isStaff);

        const subtitle = byId("dashSubtitle");
        if (subtitle) {
          subtitle.textContent = `Welcome ${normalizeText(contextUser.fullName, "User")}. Tenant operations and subscription health in one view.`;
        }

        const [opsResult, subResult] = await Promise.allSettled([
          requestJson(`${BASE_URL}/api/v1/user/get-booking-for-dashboard`),
          requestJson(`${BASE_URL}/api/v1/user/check-subscription`, { method: "POST" })
        ]);

        const ops     = opsResult.status     === "fulfilled" ? opsResult.value     : { ok: false, data: null };
        const sub     = subResult.status     === "fulfilled" ? subResult.value     : { ok: false, data: null };
        requestAnimationFrame(() => {
          if (ops.ok     && ops.data)     renderOperationalData(ops.data, contextUser);
          if (sub.ok     && sub.data)     renderSubscription(sub.data);

          const stamp = byId("dashLastUpdated");
          if (stamp) stamp.textContent = `Last update: ${new Date().toLocaleString("en-IN")}`;
        });
      }

      document.addEventListener("click", (event) => {
        const button = event.target.closest("#franchisePrev, #franchiseNext");
        if (!button || button.disabled) return;
        loadFranchisePage(franchisePage + (button.id === "franchiseNext" ? 1 : -1));
      });

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDashboard, { once: true });
      } else {
        initDashboard();
      }
    })();
