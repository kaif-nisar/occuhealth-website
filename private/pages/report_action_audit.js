/**
 * report_action_audit.js
 * ---------------------------------------------------------------------------
 * Enterprise Button Click & Workflow Action Tracking Audit Trail.
 * Single source of truth for:
 *   1. Action buttons tracking (Who clicked, When clicked, How many times clicked)
 *      inside Enter Result (labreport.html) and Report Format (reportFormat.html).
 *   2. "Sign Off By" display and complete case action audit inside All Cases (allcases.html).
 *
 * Self-contained: includes automatic CSS styles, floating popovers, badges, and modals.
 */
(function (global) {
    'use strict';

    if (global.ReportActionAudit && global.ReportActionAudit.__initialized) return;

    var STYLE_ID = 'action-audit-styles';
    var POPOVER_ID = 'action-audit-popover';
    var MODAL_ID = 'action-audit-modal';
    var cacheByBooking = {}; // local in-memory cache of actionAudit by bookingId

    function resolveBaseUrl() {
        try {
            if (typeof BASE_URL === 'string' && BASE_URL) return BASE_URL;
        } catch (e) { }
        if (typeof global.BASE_URL === 'string' && global.BASE_URL) return global.BASE_URL;
        return global.location.origin;
    }

    function esc(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtDateTime(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    function fmtRelativeTime(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) return '';
        var diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return fmtDateTime(val);
    }

    /* ------------------------------------------------------------------ */
    /* Dynamic Styles                                                     */
    /* ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '/* Micro Action Audit Button Badge / Chip */',
            '.btn-audit-chip {',
            '  display: inline-flex !important; align-items: center !important; justify-content: center !important;',
            '  min-width: 17px !important; height: 17px !important;',
            '  padding: 0 4px !important; margin-left: 4px !important;',
            '  border-radius: 999px !important;',
            '  font-size: 9.5px !important; font-weight: 800 !important; line-height: 17px !important;',
            '  letter-spacing: 0.1px !important; cursor: pointer !important; vertical-align: middle !important;',
            '  transition: all 0.18s ease-in-out !important; user-select: none !important;',
            '  background: rgba(255, 255, 255, 0.18) !important; color: rgba(255, 255, 255, 0.85) !important;',
            '  border: 1px solid rgba(255, 255, 255, 0.28) !important;',
            '  backdrop-filter: blur(4px) !important;',
            '  position: relative !important; z-index: 2 !important;',
            '  box-sizing: border-box !important;',
            '}',
            '.btn-audit-chip:hover {',
            '  background: rgba(255, 255, 255, 0.35) !important; color: #ffffff !important;',
            '  transform: scale(1.12) !important;',
            '  border-color: rgba(255, 255, 255, 0.6) !important;',
            '  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;',
            '}',
            '.btn-audit-chip.has-activity {',
            '  background: #10b981 !important; border-color: #059669 !important; color: #ffffff !important;',
            '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;',
            '}',
            '.btn-audit-chip.has-activity:hover {',
            '  background: #059669 !important; border-color: #047857 !important;',
            '}',
            'button:not([style*="background"]) .btn-audit-chip,',
            '.btn-outline .btn-audit-chip {',
            '  background: #e2e8f0 !important; color: #334155 !important; border-color: #cbd5e1 !important;',
            '}',
            'button:not([style*="background"]) .btn-audit-chip.has-activity,',
            '.btn-outline .btn-audit-chip.has-activity {',
            '  background: #10b981 !important; color: #ffffff !important; border-color: #059669 !important;',
            '}',
            '.audit-chip-icon { display: none !important; }',
            '.audit-chip-count { font-size: 9.5px !important; font-weight: 800 !important; line-height: 1 !important; }',

            '/* Floating Action Audit Popover */',
            '.action-audit-popover {',
            '  position: fixed !important; z-index: 999999 !important;',
            '  width: 320px !important; max-width: calc(100vw - 24px) !important;',
            '  background: #ffffff !important; color: #0f172a !important;',
            '  border-radius: 12px !important;',
            '  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.08) !important;',
            '  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;',
            '  font-size: 12px !important; line-height: 1.45 !important;',
            '  opacity: 0; pointer-events: none; transform: translateY(-4px);',
            '  transition: opacity 0.15s ease-out, transform 0.15s ease-out;',
            '}',
            '.action-audit-popover.is-visible {',
            '  opacity: 1 !important; pointer-events: auto !important; transform: translateY(0) !important;',
            '}',
            '.aap-header {',
            '  display: flex !important; align-items: center !important; justify-content: space-between !important;',
            '  padding: 10px 14px !important; background: #f8fafc !important;',
            '  border-top-left-radius: 12px !important; border-top-right-radius: 12px !important;',
            '  border-bottom: 1px solid #e2e8f0 !important;',
            '}',
            '.aap-title { font-weight: 700 !important; color: #0f172a !important; display: flex !important; align-items: center !important; gap: 7px !important; font-size: 12.5px !important; }',
            '.aap-title i { color: #2563eb !important; font-size: 13px !important; }',
            '.aap-close { background: none !important; border: none !important; font-size: 16px !important; color: #94a3b8 !important; cursor: pointer !important; padding: 0 !important; line-height: 1 !important; }',
            '.aap-close:hover { color: #0f172a !important; }',
            '.aap-body { padding: 12px 14px !important; max-height: 280px !important; overflow-y: auto !important; }',
            '.aap-stat-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; margin-bottom: 12px !important; }',
            '.aap-stat-card { background: #f1f5f9 !important; padding: 7px 9px !important; border-radius: 8px !important; border: 1px solid #e2e8f0 !important; }',
            '.aap-stat-label { font-size: 10px !important; font-weight: 600 !important; color: #64748b !important; text-transform: uppercase !important; }',
            '.aap-stat-value { font-size: 13px !important; font-weight: 800 !important; color: #0f172a !important; margin-top: 1px !important; }',
            '.aap-latest-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; padding: 9px 11px !important; margin-bottom: 10px !important; }',
            '.aap-latest-hdr { font-size: 10.5px !important; font-weight: 700 !important; color: #475569 !important; margin-bottom: 4px !important; display: flex !important; justify-content: space-between !important; }',
            '.aap-latest-user { font-weight: 700 !important; color: #1e293b !important; }',
            '.aap-latest-role { display: inline-block !important; font-size: 9.5px !important; padding: 1px 5px !important; background: #e0e7ff !important; color: #3730a3 !important; border-radius: 4px !important; font-weight: 600 !important; margin-left: 4px !important; }',
            '.aap-latest-time { font-size: 11px !important; color: #64748b !important; margin-top: 2px !important; }',
            '.aap-history-title { font-size: 11px !important; font-weight: 700 !important; color: #475569 !important; margin-bottom: 6px !important; }',
            '.aap-history-list { list-style: none !important; padding: 0 !important; margin: 0 !important; display: flex !important; flex-direction: column !important; gap: 6px !important; }',
            '.aap-history-item { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 6px 8px !important; background: #ffffff !important; border: 1px solid #f1f5f9 !important; border-radius: 6px !important; font-size: 11px !important; }',
            '.aap-history-item:hover { background: #f8fafc !important; }',
            '.aap-empty { text-align: center !important; color: #94a3b8 !important; padding: 16px 0 !important; font-style: italic !important; }',

            '/* All Cases "Sign Off By" Pill & Audit Cell */',
            '.signoff-cell-pill {',
            '  display: inline-flex !important; align-items: center !important; gap: 7px !important;',
            '  padding: 4px 10px !important; border-radius: 999px !important;',
            '  font-size: 11px !important; font-weight: 600 !important; line-height: 1.3 !important;',
            '  white-space: nowrap !important; vertical-align: middle !important;',
            '  transition: all 0.15s ease !important;',
            '  border: 1px solid transparent !important;',
            '}',
            '.signoff-cell-pill.is-signed {',
            '  background: #ecfdf5 !important; color: #065f46 !important; border-color: #a7f3d0 !important;',
            '}',
            '.signoff-cell-pill.is-signed .signoff-icon { color: #10b981 !important; font-size: 12px !important; }',
            '.signoff-cell-pill.is-pending {',
            '  background: #f8fafc !important; color: #64748b !important; border-color: #e2e8f0 !important;',
            '}',
            '.signoff-cell-pill.is-pending .signoff-icon { color: #94a3b8 !important; font-size: 11px !important; }',
            '.signoff-info { display: flex !important; flex-direction: column !important; text-align: left !important; }',
            '.signoff-user { font-weight: 700 !important; color: #0f172a !important; font-size: 11px !important; }',
            '.signoff-time { font-size: 9.5px !important; color: #64748b !important; font-weight: 500 !important; }',
            '.signoff-audit-btn {',
            '  background: none !important; border: none !important; padding: 2px !important;',
            '  margin-left: 2px !important; cursor: pointer !important; color: #64748b !important;',
            '  border-radius: 4px !important; font-size: 11px !important; display: inline-flex !important; align-items: center !important;',
            '  transition: color 0.12s, transform 0.12s !important;',
            '}',
            '.signoff-audit-btn:hover { color: #2563eb !important; transform: scale(1.15) !important; }',

            '/* Complete Case Action Audit Modal */',
            '.action-audit-modal-backdrop {',
            '  position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;',
            '  background: rgba(15, 23, 42, 0.55) !important; backdrop-filter: blur(4px) !important;',
            '  display: flex !important; align-items: center !important; justify-content: center !important;',
            '  z-index: 9999999 !important; padding: 16px !important;',
            '}',
            '.action-audit-modal-box {',
            '  background: #ffffff !important; border-radius: 16px !important;',
            '  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;',
            '  width: 620px !important; max-width: 100% !important; max-height: 90vh !important;',
            '  display: flex !important; flex-direction: column !important;',
            '  overflow: hidden !important;',
            '  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;',
            '  animation: auditModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;',
            '}',
            '@keyframes auditModalPop {',
            '  0% { transform: scale(0.95); opacity: 0; }',
            '  100% { transform: scale(1); opacity: 1; }',
            '}',
            '.aam-header {',
            '  padding: 16px 20px !important; background: #f8fafc !important;',
            '  border-bottom: 1px solid #e2e8f0 !important;',
            '  display: flex !important; align-items: center !important; justify-content: space-between !important;',
            '}',
            '.aam-title-wrap { display: flex !important; align-items: center !important; gap: 10px !important; }',
            '.aam-icon-circle {',
            '  width: 36px !important; height: 36px !important; border-radius: 10px !important;',
            '  background: #eff6ff !important; color: #2563eb !important; border: 1px solid #bfdbfe !important;',
            '  display: flex !important; align-items: center !important; justify-content: center !important;',
            '  font-size: 16px !important;',
            '}',
            '.aam-title { font-size: 15px !important; font-weight: 800 !important; color: #0f172a !important; margin: 0 !important; }',
            '.aam-subtitle { font-size: 11.5px !important; color: #64748b !important; margin-top: 2px !important; }',
            '.aam-close {',
            '  background: none !important; border: none !important; font-size: 20px !important;',
            '  color: #94a3b8 !important; cursor: pointer !important; padding: 4px !important;',
            '  line-height: 1 !important; border-radius: 6px !important; transition: all 0.15s !important;',
            '}',
            '.aam-close:hover { background: #e2e8f0 !important; color: #0f172a !important; }',
            '.aam-body { padding: 20px !important; overflow-y: auto !important; flex: 1 !important; }',
            '.aam-section-title {',
            '  font-size: 12px !important; font-weight: 700 !important; color: #475569 !important;',
            '  text-transform: uppercase !important; letter-spacing: 0.5px !important; margin-bottom: 10px !important;',
            '  display: flex !important; align-items: center !important; gap: 6px !important;',
            '}',
            '.aam-grid {',
            '  display: grid !important; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;',
            '  gap: 10px !important; margin-bottom: 20px !important;',
            '}',
            '.aam-card {',
            '  background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important;',
            '  padding: 10px 12px !important; transition: all 0.15s !important;',
            '}',
            '.aam-card:hover { border-color: #cbd5e1 !important; background: #ffffff !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important; }',
            '.aam-card-hdr { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 6px !important; }',
            '.aam-card-label { font-size: 11.5px !important; font-weight: 700 !important; color: #1e293b !important; }',
            '.aam-card-badge { font-size: 10px !important; font-weight: 800 !important; padding: 1px 6px !important; border-radius: 999px !important; background: #e2e8f0 !important; color: #475569 !important; }',
            '.aam-card-badge.active { background: #d1fae5 !important; color: #065f46 !important; }',
            '.aam-card-sub { font-size: 10.5px !important; color: #64748b !important; line-height: 1.35 !important; }',
            '.aam-timeline { display: flex !important; flex-direction: column !important; gap: 8px !important; }',
            '.aam-timeline-item {',
            '  display: flex !important; align-items: flex-start !important; gap: 10px !important;',
            '  padding: 10px 12px !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important;',
            '  border-radius: 8px !important; font-size: 11.5px !important;',
            '}',
            '.aam-timeline-icon {',
            '  width: 26px !important; height: 26px !important; border-radius: 50% !important;',
            '  display: flex !important; align-items: center !important; justify-content: center !important;',
            '  font-size: 11px !important; flex-shrink: 0 !important; margin-top: 1px !important;',
            '}',
            '.aam-timeline-icon.blue { background: #eff6ff !important; color: #2563eb !important; }',
            '.aam-timeline-icon.green { background: #ecfdf5 !important; color: #059669 !important; }',
            '.aam-timeline-content { flex: 1 !important; }',
            '.aam-timeline-title { font-weight: 700 !important; color: #0f172a !important; display: flex !important; justify-content: space-between !important; }',
            '.aam-timeline-time { font-size: 10.5px !important; color: #94a3b8 !important; font-weight: 500 !important; }',
            '.aam-timeline-meta { font-size: 11px !important; color: #64748b !important; margin-top: 2px !important; }'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /* Floating Popover Lifecycle                                         */
    /* ------------------------------------------------------------------ */
    var activePopoverBtn = null;

    function getOrCreatePopover() {
        var el = document.getElementById(POPOVER_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = POPOVER_ID;
            el.className = 'action-audit-popover';
            el.setAttribute('role', 'tooltip');
            el.innerHTML = [
                '<div class="aap-header">',
                '  <span class="aap-title"><i class="fas fa-fingerprint"></i><span id="aapBtnLabel">Action Details</span></span>',
                '  <button type="button" class="aap-close" aria-label="Close">&times;</button>',
                '</div>',
                '<div class="aap-body" id="aapBody"></div>'
            ].join('');
            document.body.appendChild(el);

            el.querySelector('.aap-close').addEventListener('click', function (e) {
                e.stopPropagation();
                hidePopover();
            });

            // Prevent clicks inside popover from closing it or propagating to buttons
            el.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }
        return el;
    }

    function positionPopover(popover, targetEl) {
        var rect = targetEl.getBoundingClientRect();
        var popRect = popover.getBoundingClientRect();
        var top = rect.bottom + 6;
        var left = rect.left + (rect.width / 2) - (popRect.width / 2);

        // Keep within viewport boundaries
        if (left < 10) left = 10;
        if (left + popRect.width > window.innerWidth - 10) {
            left = window.innerWidth - popRect.width - 10;
        }
        if (top + popRect.height > window.innerHeight - 10) {
            // Flip above target
            top = rect.top - popRect.height - 6;
        }

        popover.style.top = Math.max(10, top) + 'px';
        popover.style.left = left + 'px';
    }

    function showPopover(chipEl, auditInfo) {
        injectStyles();
        var popover = getOrCreatePopover();
        activePopoverBtn = chipEl;

        var labelEl = popover.querySelector('#aapBtnLabel');
        var bodyEl = popover.querySelector('#aapBody');
        var btnName = chipEl.getAttribute('data-audit-label') || chipEl.getAttribute('data-audit-button') || 'Button';
        labelEl.textContent = btnName + ' Tracking';

        var count = auditInfo ? Number(auditInfo.count || 0) : 0;
        var lastUser = auditInfo?.lastUser || 'None';
        var lastRole = auditInfo?.lastRole ? ' (' + auditInfo.lastRole + ')' : '';
        var lastTime = auditInfo?.lastTimestamp ? fmtDateTime(auditInfo.lastTimestamp) : 'Never';
        var history = Array.isArray(auditInfo?.history) ? auditInfo.history : [];

        var historyHtml = '';
        if (history.length > 0) {
            var items = history.slice(-8).reverse().map(function (item) {
                var u = item.user || 'User';
                var r = item.role ? '<span class="aap-latest-role">' + esc(item.role) + '</span>' : '';
                var t = fmtRelativeTime(item.timestamp);
                return [
                    '<li class="aap-history-item">',
                    '  <div><strong>' + esc(u) + '</strong>' + r + '</div>',
                    '  <span class="aap-latest-time">' + esc(t) + '</span>',
                    '</li>'
                ].join('');
            }).join('');

            historyHtml = [
                '<div class="aap-history-title">Recent Activity Log</div>',
                '<ul class="aap-history-list">' + items + '</ul>'
            ].join('');
        } else {
            historyHtml = '<div class="aap-empty"><i class="fas fa-info-circle"></i> No activity recorded yet.</div>';
        }

        bodyEl.innerHTML = [
            '<div class="aap-stat-grid">',
            '  <div class="aap-stat-card">',
            '    <div class="aap-stat-label">Total Clicks</div>',
            '    <div class="aap-stat-value">' + count + ' ' + (count === 1 ? 'time' : 'times') + '</div>',
            '  </div>',
            '  <div class="aap-stat-card">',
            '    <div class="aap-stat-label">Status</div>',
            '    <div class="aap-stat-value" style="color: ' + (count > 0 ? '#10b981' : '#64748b') + ';">' + (count > 0 ? 'Active' : 'Unclicked') + '</div>',
            '  </div>',
            '</div>',
            count > 0 ? [
                '<div class="aap-latest-box">',
                '  <div class="aap-latest-hdr"><span>LAST CLICKED BY</span></div>',
                '  <div class="aap-latest-user">' + esc(lastUser) + esc(lastRole) + '</div>',
                '  <div class="aap-latest-time"><i class="fas fa-clock" style="font-size:10px;margin-right:4px;"></i>' + esc(lastTime) + '</div>',
                '</div>'
            ].join('') : '',
            historyHtml
        ].join('');

        popover.classList.add('is-visible');
        positionPopover(popover, chipEl);
    }

    function hidePopover() {
        var el = document.getElementById(POPOVER_ID);
        if (el) el.classList.remove('is-visible');
        activePopoverBtn = null;
    }

    // Dismiss popover on outside click or escape
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#' + POPOVER_ID) && !e.target.closest('.btn-audit-chip')) {
            hidePopover();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hidePopover();
            closeModal();
        }
    });

    /* ------------------------------------------------------------------ */
    /* API Interactions                                                   */
    /* ------------------------------------------------------------------ */
    async function recordAction(params) {
        if (!params || !params.bookingId) return null;
        var baseUrl = resolveBaseUrl();
        try {
            var headers = { 'Content-Type': 'application/json' };
            var token = localStorage.getItem('accessToken');
            if (token) headers['Authorization'] = 'Bearer ' + token;

            var response = await fetch(baseUrl + '/api/v1/user/record-action-audit', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(params)
            });
            if (!response.ok) return null;
            var data = await response.json();
            var auditData = data?.data || data;
            if (auditData) {
                cacheByBooking[params.bookingId] = auditData;
                updatePageButtonChips(params.bookingId, auditData);
            }
            return auditData;
        } catch (err) {
            console.warn('Failed to record action audit:', err);
            return null;
        }
    }

    async function fetchActionAudit(bookingId) {
        if (!bookingId) return null;
        var baseUrl = resolveBaseUrl();
        try {
            var headers = {};
            var token = localStorage.getItem('accessToken');
            if (token) headers['Authorization'] = 'Bearer ' + token;

            var response = await fetch(baseUrl + '/api/v1/user/action-audit/' + encodeURIComponent(bookingId), {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            if (!response.ok) return null;
            var data = await response.json();
            var auditData = data?.data || data;
            if (auditData) {
                cacheByBooking[bookingId] = auditData;
            }
            return auditData;
        } catch (err) {
            console.warn('Failed to fetch action audit:', err);
            return null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Button Chip / Badge Rendering & Live Updates                       */
    /* ------------------------------------------------------------------ */
    function attachButtonBadge(btnEl, config) {
        if (!btnEl) return;
        injectStyles();

        var buttonId = config.buttonId || btnEl.id || 'btn';
        var buttonLabel = config.buttonLabel || btnEl.innerText?.trim() || buttonId;
        var bookingId = config.bookingId || '';

        // Check if chip already exists
        var existingChip = btnEl.querySelector('.btn-audit-chip');
        if (existingChip) return existingChip;

        var chip = document.createElement('span');
        chip.className = 'btn-audit-chip';
        chip.setAttribute('data-audit-button', buttonId);
        chip.setAttribute('data-audit-label', buttonLabel);
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        chip.title = 'View ' + buttonLabel + ' tracking info';

        chip.innerHTML = [
            '<i class="fas fa-fingerprint audit-chip-icon"></i>',
            '<span class="audit-chip-count">0</span>'
        ].join('');

        // Crucial: Stop propagation on chip so parent button never fires!
        chip.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var bId = chip.getAttribute('data-booking-id') || config.bookingId || getCurrentBookingId();
            handleChipOpen(chip, bId, buttonId);
        });

        chip.addEventListener('mouseenter', function (e) {
            var bId = chip.getAttribute('data-booking-id') || config.bookingId || getCurrentBookingId();
            handleChipOpen(chip, bId, buttonId);
        });

        btnEl.appendChild(chip);
        return chip;
    }

    async function handleChipOpen(chip, bookingId, buttonId) {
        var audit = cacheByBooking[bookingId];
        if (!audit && bookingId) {
            audit = await fetchActionAudit(bookingId);
        }

        var btnData = audit?.buttons?.[buttonId] || null;
        showPopover(chip, btnData);
    }

    function updatePageButtonChips(bookingId, auditData) {
        if (!auditData) return;
        var chips = document.querySelectorAll('.btn-audit-chip');
        chips.forEach(function (chip) {
            var bId = chip.getAttribute('data-audit-button');
            if (!bId) return;
            var btnAudit = auditData.buttons?.[bId];
            var countEl = chip.querySelector('.audit-chip-count');
            var count = btnAudit ? Number(btnAudit.count || 0) : 0;

            if (countEl) countEl.textContent = count > 99 ? '99+' : count;

            if (count > 0) {
                chip.classList.add('has-activity');
                chip.title = (chip.getAttribute('data-audit-label') || bId) + ' clicked ' + count + ' times (Click to view log)';
            } else {
                chip.classList.remove('has-activity');
            }
        });
    }

    function getCurrentBookingId() {
        try {
            if (typeof state !== 'undefined' && state) {
                if (state.bookingId) return state.bookingId;
                if (state.report && (state.report.bookingId || state.report.booking_id || state.report.reg_id)) {
                    return state.report.bookingId || state.report.booking_id || state.report.reg_id;
                }
            }
        } catch (e) { }
        try {
            var regId = localStorage.getItem('regId');
            if (regId) return JSON.parse(regId);
        } catch (e) { }
        try {
            var booking = JSON.parse(localStorage.getItem('booking') || '{}');
            if (booking.bookingId) return booking.bookingId;
        } catch (e) { }
        var urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('value1') || urlParams.get('bookingId') || '';
    }

    /* ------------------------------------------------------------------ */
    /* All Cases "Sign Off By" Badge Renderer                             */
    /* ------------------------------------------------------------------ */
    function renderSignOffCell(booking) {
        injectStyles();
        var bId = String(booking?.bookingId || booking?.reg_id || '').trim();
        var signOffDetails = booking?.signOffDetails || {};
        var isSigned = Boolean(
            booking?.isSignedOff ||
            booking?.signedBy ||
            signOffDetails?.isSignedOff ||
            booking?.signOffAudit?.isSignedOff ||
            (booking?.signOff === true || booking?.signOff === "true")
        );

        var signedBy = booking?.signedBy || signOffDetails?.signedBy || booking?.signOffAudit?.signedBy || 'Doctor';
        var signedAt = booking?.signedAt || signOffDetails?.signedAt || booking?.signOffAudit?.signedAt || null;
        var formattedDate = signedAt ? fmtDateTime(signedAt) : '';

        if (isSigned) {
            return [
                '<div class="signoff-cell-pill is-signed" data-audit-booking-id="' + esc(bId) + '">',
                '  <i class="fas fa-file-signature signoff-icon" title="Signed off"></i>',
                '  <div class="signoff-info">',
                '    <span class="signoff-user">' + esc(signedBy) + '</span>',
                formattedDate ? '    <span class="signoff-time">' + esc(formattedDate) + '</span>' : '',
                '  </div>',
                '  <button type="button" class="signoff-audit-btn" data-action="view-audit" data-booking-id="' + esc(bId) + '" title="View complete button audit trail">',
                '    <i class="fas fa-chart-line"></i>',
                '  </button>',
                '</div>'
            ].join('');
        }

        return [
            '<div class="signoff-cell-pill is-pending" data-audit-booking-id="' + esc(bId) + '">',
            '  <i class="fas fa-clock signoff-icon"></i>',
            '  <div class="signoff-info">',
            '    <span class="signoff-user" style="color:#64748b;">Not Signed</span>',
            '  </div>',
            '  <button type="button" class="signoff-audit-btn" data-action="view-audit" data-booking-id="' + esc(bId) + '" title="View button activity audit">',
            '    <i class="fas fa-chart-line"></i>',
            '  </button>',
            '</div>'
        ].join('');
    }

    /* ------------------------------------------------------------------ */
    /* Full Case Action Audit Trail Modal                                  */
    /* ------------------------------------------------------------------ */
    function getOrCreateModal() {
        var el = document.getElementById(MODAL_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = MODAL_ID;
            el.className = 'action-audit-modal-backdrop';
            el.style.display = 'none';
            el.innerHTML = [
                '<div class="action-audit-modal-box" role="dialog" aria-modal="true">',
                '  <div class="aam-header">',
                '    <div class="aam-title-wrap">',
                '      <div class="aam-icon-circle"><i class="fas fa-fingerprint"></i></div>',
                '      <div>',
                '        <h4 class="aam-title">Case Activity Audit Trail</h4>',
                '        <div class="aam-subtitle" id="aamSubTitle">Booking Activity</div>',
                '      </div>',
                '    </div>',
                '    <button type="button" class="aam-close" aria-label="Close modal">&times;</button>',
                '  </div>',
                '  <div class="aam-body" id="aamModalBody">',
                '    <div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin" style="font-size:24px;"></i><p style="margin-top:10px;">Loading audit trail...</p></div>',
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(el);

            el.querySelector('.aam-close').addEventListener('click', closeModal);
            el.addEventListener('click', function (e) {
                if (e.target === el) closeModal();
            });
        }
        return el;
    }

    async function openModal(bookingId, patientName) {
        injectStyles();
        var modal = getOrCreateModal();
        var subTitleEl = modal.querySelector('#aamSubTitle');
        var bodyEl = modal.querySelector('#aamModalBody');

        subTitleEl.textContent = 'Booking #' + (bookingId || '') + (patientName ? ' \u2022 ' + patientName : '');
        bodyEl.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin" style="font-size:24px;"></i><p style="margin-top:10px;">Loading audit trail...</p></div>';
        modal.style.display = 'flex';

        var audit = await fetchActionAudit(bookingId);
        if (!audit) {
            bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p style="margin-top:10px;">Failed to load audit history for this booking.</p></div>';
            return;
        }

        var signOff = audit.signOff || {};
        var isSigned = Boolean(signOff.isSignedOff || signOff.signedBy);
        var buttons = audit.buttons || {};
        var history = Array.isArray(audit.history) ? audit.history : [];

        // Build Buttons Matrix
        var buttonKeys = Object.keys(buttons);
        var buttonCardsHtml = '';
        if (buttonKeys.length > 0) {
            buttonCardsHtml = buttonKeys.map(function (k) {
                var btn = buttons[k];
                var count = Number(btn.count || 0);
                var label = btn.label || k;
                var user = btn.lastUser ? esc(btn.lastUser) : 'None';
                var role = btn.lastRole ? ' (' + esc(btn.lastRole) + ')' : '';
                var time = btn.lastTimestamp ? fmtRelativeTime(btn.lastTimestamp) : '';

                return [
                    '<div class="aam-card">',
                    '  <div class="aam-card-hdr">',
                    '    <span class="aam-card-label">' + esc(label) + '</span>',
                    '    <span class="aam-card-badge ' + (count > 0 ? 'active' : '') + '">' + count + ' ' + (count === 1 ? 'click' : 'clicks') + '</span>',
                    '  </div>',
                    '  <div class="aam-card-sub">',
                    count > 0 ? 'Last: <strong>' + user + '</strong>' + role + (time ? '<br><span style="color:#94a3b8;">' + time + '</span>' : '') : 'No clicks yet',
                    '  </div>',
                    '</div>'
                ].join('');
            }).join('');
        } else {
            buttonCardsHtml = '<div style="color:#94a3b8;font-style:italic;padding:8px;">No button clicks logged yet.</div>';
        }

        // Build Chronological Timeline
        var timelineHtml = '';
        if (history.length > 0) {
            var items = history.slice().reverse().map(function (item) {
                var isSignAction = item.action === 'SIGN_OFF' || item.buttonId === 'signOff';
                var iconClass = isSignAction ? 'fas fa-signature' : 'fas fa-mouse-pointer';
                var colorClass = isSignAction ? 'green' : 'blue';
                var actionLabel = item.buttonLabel || item.action || 'Button Click';
                var user = item.user || 'User';
                var role = item.role ? ' (' + item.role + ')' : '';
                var time = fmtDateTime(item.timestamp);

                return [
                    '<div class="aam-timeline-item">',
                    '  <div class="aam-timeline-icon ' + colorClass + '"><i class="' + iconClass + '"></i></div>',
                    '  <div class="aam-timeline-content">',
                    '    <div class="aam-timeline-title">',
                    '      <span>' + esc(actionLabel) + '</span>',
                    '      <span class="aam-timeline-time">' + esc(time) + '</span>',
                    '    </div>',
                    '    <div class="aam-timeline-meta">Triggered by <strong>' + esc(user) + '</strong>' + esc(role) + '</div>',
                    '  </div>',
                    '</div>'
                ].join('');
            }).join('');

            timelineHtml = '<div class="aam-timeline">' + items + '</div>';
        } else {
            timelineHtml = '<div style="color:#94a3b8;font-style:italic;padding:8px;">No action history logged yet.</div>';
        }

        bodyEl.innerHTML = [
            '<div style="background:' + (isSigned ? '#ecfdf5' : '#f8fafc') + '; border:1px solid ' + (isSigned ? '#a7f3d0' : '#e2e8f0') + '; border-radius:10px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between;">',
            '  <div>',
            '    <div style="font-size:11px; font-weight:700; color:' + (isSigned ? '#065f46' : '#64748b') + '; text-transform:uppercase;">SIGN-OFF STATUS</div>',
            '    <div style="font-size:14px; font-weight:800; color:' + (isSigned ? '#047857' : '#334155') + '; margin-top:2px;">',
            isSigned ? '<i class="fas fa-check-circle" style="color:#10b981;margin-right:6px;"></i>Signed Off by ' + esc(signOff.signedBy || 'Doctor') : '<i class="fas fa-clock" style="color:#94a3b8;margin-right:6px;"></i>Pending Sign-Off',
            '    </div>',
            signOff.signedAt ? '<div style="font-size:11px; color:#64748b; margin-top:3px;"><i class="fas fa-calendar-alt" style="margin-right:4px;"></i>' + fmtDateTime(signOff.signedAt) + '</div>' : '',
            '  </div>',
            '  <div style="font-size:24px; color:' + (isSigned ? '#10b981' : '#cbd5e1') + ';"><i class="' + (isSigned ? 'fas fa-stamp' : 'fas fa-clock') + '"></i></div>',
            '</div>',

            '<div class="aam-section-title"><i class="fas fa-chart-pie"></i> Button Click Tracking Matrix</div>',
            '<div class="aam-grid">' + buttonCardsHtml + '</div>',

            '<div class="aam-section-title"><i class="fas fa-stream"></i> Chronological Activity Log</div>',
            timelineHtml
        ].join('');
    }

    function closeModal() {
        var modal = document.getElementById(MODAL_ID);
        if (modal) modal.style.display = 'none';
    }

    /* ------------------------------------------------------------------ */
    /* Delegated Handlers for All Cases Table                              */
    /* ------------------------------------------------------------------ */
    function attachDelegatedHandlers() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action="view-audit"]');
            if (btn) {
                e.stopPropagation();
                e.preventDefault();
                var bId = btn.getAttribute('data-booking-id') || btn.closest('[data-audit-booking-id]')?.getAttribute('data-audit-booking-id');
                var row = btn.closest('tr');
                var patient = row?.querySelector('td:nth-child(4)')?.textContent?.trim() || '';
                if (bId) {
                    openModal(bId, patient);
                }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Auto-initialization                                                */
    /* ------------------------------------------------------------------ */
    injectStyles();
    attachDelegatedHandlers();

    global.ReportActionAudit = {
        __initialized: true,
        record: recordAction,
        get: fetchActionAudit,
        attachBadge: attachButtonBadge,
        updateBadges: updatePageButtonChips,
        renderSignOffCell: renderSignOffCell,
        openModal: openModal,
        closeModal: closeModal
    };

})(typeof window !== 'undefined' ? window : this);
