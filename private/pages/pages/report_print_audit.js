/**
 * report_print_audit.js
 * ---------------------------------------------------------------------------
 * Shared UI helper for the report print / download audit trail
 * (`booking.printAudit`) that is exposed by the booking list APIs.
 *
 * Provides:
 *   ReportPrintAudit.badge(booking, options)   -> compact badge HTML string
 *   ReportPrintAudit.attach()                  -> binds delegated handlers
 *   ReportPrintAudit.open(bookingId, latest)   -> opens the audit history modal
 *   ReportPrintAudit.close()                   -> closes the modal
 *   ReportPrintAudit.updateBadges(id, audit)   -> live DOM update of badges
 *   ReportPrintAudit.record(bookingId, action) -> records an explicit PRINT/DOWNLOAD
 *
 * The component is defensive by design: legacy bookings have no printAudit
 * object at all, so every read is optional-chained and never throws.
 */
(function (global) {
    'use strict';

    if (global.ReportPrintAudit && global.ReportPrintAudit.__ready) return;

    var STYLE_ID = 'rpa-style-block';
    var MODAL_ID = 'rpa-modal-root';
    var BADGE_SELECTOR = '[data-rpa-badge]';
    var bound = false;

    /* ------------------------------------------------------------------ */
    /* Utilities                                                          */
    /* ------------------------------------------------------------------ */

    function resolveBaseUrl() {
        try {
            if (typeof BASE_URL === 'string' && BASE_URL) return BASE_URL;
        } catch (e) { /* BASE_URL not declared in this shell */ }
        if (typeof global.BASE_URL === 'string' && global.BASE_URL) return global.BASE_URL;
        return global.location.origin;
    }

    function esc(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtDateTime(value) {
        if (!value) return '';
        var parsed = new Date(value);
        if (isNaN(parsed.getTime())) return String(value);
        return parsed.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function normalizeAudit(booking) {
        var raw = null;
        if (booking && typeof booking === 'object') {
            if (booking.printAudit && typeof booking.printAudit === 'object') {
                raw = booking.printAudit;
            } else if (booking.isPrinted !== undefined || booking.history !== undefined) {
                raw = booking;
            }
        }

        var history = raw && Array.isArray(raw.history) ? raw.history.filter(Boolean) : [];
        var latest = history.length ? history[history.length - 1] : null;

        var isPrinted = Boolean(raw && (raw.isPrinted === true || raw.printedAt));
        var printedBy = (raw && raw.printedBy) || (latest && latest.user) || null;
        var printedByRole = (raw && raw.printedByRole) || (latest && latest.role) || null;
        var printedAt = (raw && raw.printedAt) || (latest && latest.timestamp) || null;
        var lastAction = (raw && raw.lastAction) || (latest && latest.action) || null;
        var printCount = Number((raw && raw.printCount) || history.length || (isPrinted ? 1 : 0));

        return {
            isPrinted: isPrinted,
            printedBy: printedBy,
            printedByRole: printedByRole,
            printedAt: printedAt,
            lastAction: lastAction,
            printCount: printCount,
            history: history
        };
    }

    function actorLabel(audit) {
        if (!audit.printedBy) return 'Unknown user';
        return audit.printedByRole
            ? audit.printedBy + ' (' + audit.printedByRole + ')'
            : audit.printedBy;
    }

    function tooltipFor(audit) {
        if (!audit.isPrinted) {
            return 'Report has not been downloaded or printed yet \u00b7 Click to view audit trail';
        }
        var actionLabel = (audit.lastAction === 'PRINT') ? 'Printed' : 'Downloaded';
        var parts = [actionLabel + ' by ' + actorLabel(audit)];
        var when = fmtDateTime(audit.printedAt);
        if (when) parts.push('on ' + when);
        if (audit.printCount > 1) parts.push('\u00b7 ' + audit.printCount + ' access logs');
        parts.push('\u00b7 Click to view full audit trail');
        return parts.join(' ');
    }

    /* ------------------------------------------------------------------ */
    /* Badge Renderer                                                     */
    /* ------------------------------------------------------------------ */

    function badge(booking, options) {
        var opts = options || {};
        var audit = normalizeAudit(booking);
        var bookingId = String(
            (booking && (booking.bookingId || booking.reg_id)) || opts.bookingId || ''
        ).trim();

        var latest = {
            isPrinted: audit.isPrinted,
            printedBy: audit.printedBy,
            printedByRole: audit.printedByRole,
            printedAt: audit.printedAt,
            lastAction: audit.lastAction,
            printCount: audit.printCount
        };

        var title = tooltipFor(audit);

        var classes = 'rpa-badge ' + (audit.isPrinted ? 'rpa-badge--done' : 'rpa-badge--idle');
        var icon = audit.isPrinted
            ? (audit.lastAction === 'PRINT' ? 'fas fa-print' : 'fas fa-file-circle-check')
            : 'fas fa-clock';
        var label = audit.isPrinted
            ? (audit.lastAction === 'PRINT' ? 'Printed' : 'Downloaded')
            : 'Not downloaded';
        var countHtml = audit.isPrinted && audit.printCount > 1
            ? '<span class="rpa-badge__count">&times;' + audit.printCount + '</span>'
            : '';

        var attrs = ' class="' + classes + '" data-rpa-badge="1" title="' + esc(title) + '"';
        attrs += ' data-rpa-latest="' + esc(JSON.stringify(latest)) + '"';

        if (bookingId) {
            attrs += ' data-booking-id="' + esc(bookingId) + '"';
            attrs += ' role="button" tabindex="0" aria-label="' + esc(title) + '"';
        } else {
            attrs += ' aria-label="' + esc(title) + '"';
        }

        return '<span' + attrs + '>' +
            '<i class="' + icon + '" aria-hidden="true"></i>' + label + countHtml +
            '</span>';
    }

    /* ------------------------------------------------------------------ */
    /* Styles                                                             */
    /* ------------------------------------------------------------------ */

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.rpa-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;',
            'font-size:11px;font-weight:700;line-height:1.45;white-space:nowrap;border:1px solid transparent;',
            'font-family:inherit;vertical-align:middle;max-width:100%;cursor:pointer;transition:all .15s ease-in-out;}',
            '.rpa-badge i{font-size:10px;}',
            '.rpa-badge--idle{background:#f1f5f9;color:#64748b;border-color:#e2e8f0;}',
            '.rpa-badge--idle:hover{background:#e2e8f0;color:#334155;}',
            '.rpa-badge--done{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}',
            '.rpa-badge--done:hover{background:#d1fae5;color:#065f46;}',
            '.rpa-badge:focus-visible{outline:2px solid #2563eb;outline-offset:2px;}',
            '.rpa-badge__count{font-weight:800;font-size:10px;background:rgba(4,120,87,.14);padding:1px 5px;',
            'border-radius:8px;margin-left:2px;}',
            '.rpa-modal{position:fixed;inset:0;z-index:999999;display:none;}',
            '.rpa-modal.is-open{display:block;}',
            '.rpa-modal__overlay{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);}',
            '.rpa-modal__card{position:relative;margin:7vh auto 0;width:min(620px,94vw);background:#fff;',
            'border-radius:14px;box-shadow:0 24px 60px rgba(15,23,42,.35);overflow:hidden;',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;}',
            '.rpa-modal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;',
            'padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
            '.rpa-modal__title{font-size:15px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:8px;}',
            '.rpa-modal__sub{font-size:12px;color:#64748b;font-weight:600;margin-top:4px;}',
            '.rpa-modal__close{border:0;background:#f1f5f9;color:#475569;width:32px;height:32px;border-radius:8px;',
            'cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;transition:all .15s;}',
            '.rpa-modal__close:hover{background:#e2e8f0;color:#0f172a;}',
            '.rpa-modal__body{padding:18px 20px;max-height:60vh;overflow-y:auto;}',
            '.rpa-modal__foot{padding:12px 20px;border-top:1px solid #e2e8f0;font-size:11.5px;color:#64748b;background:#f8fafc;',
            'display:flex;align-items:center;justify-content:space-between;}',
            '.rpa-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;}',
            '.rpa-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:11px;color:#64748b;}',
            '.rpa-chip b{display:block;font-size:13px;color:#0f172a;font-weight:700;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.rpa-table{width:100%;border-collapse:collapse;font-size:12px;text-align:left;}',
            '.rpa-table th{background:#f1f5f9;color:#475569;font-weight:700;padding:9px 12px;border-bottom:1px solid #e2e8f0;}',
            '.rpa-table td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:middle;}',
            '.rpa-table tr:hover td{background:#f8fafc;}',
            '.rpa-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;',
            'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;}',
            '.rpa-tag--print{background:#fef3c7;color:#92400e;border-color:#fde68a;}',
            '.rpa-tag--download{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}',
            '.rpa-state{padding:32px 16px;text-align:center;color:#64748b;font-size:13px;font-weight:600;}',
            '.rpa-state i{display:block;font-size:24px;margin-bottom:10px;color:#94a3b8;}',
            '.rpa-spinner{display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#2563eb;',
            'border-radius:50%;animation:rpa-spin .7s linear infinite;}',
            '@keyframes rpa-spin{to{transform:rotate(360deg);}}',
            '.rpa-retry{margin-top:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:8px;',
            'padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;}',
            '.rpa-retry:hover{background:#f1f5f9;}'
        ].join('');
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /* Modal Dialog Lifecycle                                             */
    /* ------------------------------------------------------------------ */

    function ensureModal() {
        ensureStyles();
        var root = document.getElementById(MODAL_ID);
        if (root) return root;

        root = document.createElement('div');
        root.id = MODAL_ID;
        root.className = 'rpa-modal';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'rpa-modal-title');

        root.innerHTML = [
            '<div class="rpa-modal__overlay" data-rpa-close="1"></div>',
            '<div class="rpa-modal__card" role="document">',
            '  <div class="rpa-modal__head">',
            '    <div>',
            '      <div class="rpa-modal__title" id="rpa-modal-title">',
            '        <i class="fas fa-file-shield text-blue-600" aria-hidden="true"></i>',
            '        Report Print & Download Audit Trail',
            '      </div>',
            '      <div class="rpa-modal__sub" id="rpa-modal-sub">Loading booking details...</div>',
            '    </div>',
            '    <button type="button" class="rpa-modal__close" data-rpa-close="1" title="Close audit log" aria-label="Close">&times;</button>',
            '  </div>',
            '  <div class="rpa-modal__body" id="rpa-modal-body"></div>',
            '  <div class="rpa-modal__foot">',
            '    <span><i class="fas fa-shield-alt" aria-hidden="true"></i> Industry-standard immutable access audit log</span>',
            '    <span id="rpa-modal-tz">IST (Indian Standard Time)</span>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(root);
        return root;
    }

    function renderModalContent(bookingId, patientName, audit) {
        var body = document.getElementById('rpa-modal-body');
        var sub = document.getElementById('rpa-modal-sub');
        if (!body) return;

        var subText = 'Booking #' + esc(bookingId);
        if (patientName) {
            subText += ' &bull; Patient: ' + esc(patientName);
        }
        if (sub) sub.innerHTML = subText;

        var chipsHtml = [
            '<div class="rpa-chips">',
            '  <div class="rpa-chip">Status<b>' + (audit.isPrinted ? (audit.lastAction === 'PRINT' ? 'Printed' : 'Downloaded') : 'Not downloaded') + '</b></div>',
            '  <div class="rpa-chip">Total Access<b>' + (audit.printCount || 0) + ' ' + (audit.printCount === 1 ? 'time' : 'times') + '</b></div>',
            '  <div class="rpa-chip" title="' + esc(actorLabel(audit)) + '">Last Actor<b>' + esc(audit.printedBy || '—') + '</b></div>',
            '  <div class="rpa-chip">Last Timestamp<b>' + (fmtDateTime(audit.printedAt) || '—') + '</b></div>',
            '</div>'
        ].join('');

        var history = Array.isArray(audit.history) ? audit.history : [];

        var historyHtml = '';
        if (history.length > 0) {
            var rows = '';
            for (var i = history.length - 1; i >= 0; i--) {
                var item = history[i];
                if (!item) continue;
                var action = String(item.action || 'DOWNLOAD').toUpperCase();
                var tagClass = action === 'PRINT' ? 'rpa-tag--print' : 'rpa-tag--download';
                var actionIcon = action === 'PRINT' ? 'fa-print' : 'fa-download';

                rows += [
                    '<tr>',
                    '  <td><span class="rpa-tag ' + tagClass + '"><i class="fas ' + actionIcon + '"></i> ' + esc(action) + '</span></td>',
                    '  <td style="font-weight:700;">' + esc(item.user || audit.printedBy || 'Unknown') + '</td>',
                    '  <td style="color:#64748b;">' + esc(item.role || '—') + '</td>',
                    '  <td style="white-space:nowrap;font-variant-numeric:tabular-nums;">' + fmtDateTime(item.timestamp || item.printedAt) + '</td>',
                    '</tr>'
                ].join('');
            }

            historyHtml = [
                '<div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">',
                '  <span>Access History (' + history.length + ' ' + (history.length === 1 ? 'record' : 'records') + ')</span>',
                '  <span style="font-weight:600;font-size:11px;color:#64748b;">Most recent first</span>',
                '</div>',
                '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">',
                '  <table class="rpa-table">',
                '    <thead>',
                '      <tr>',
                '        <th style="width:110px;">Action</th>',
                '        <th>Performed By</th>',
                '        <th>Role</th>',
                '        <th>Date & Time</th>',
                '      </tr>',
                '    </thead>',
                '    <tbody>' + rows + '</tbody>',
                '  </table>',
                '</div>'
            ].join('');
        } else if (audit.isPrinted) {
            historyHtml = [
                '<div class="rpa-state">',
                '  <i class="fas fa-clock-rotate-left"></i>',
                '  Report has been marked as accessed by <b>' + esc(actorLabel(audit)) + '</b> on ' + (fmtDateTime(audit.printedAt) || 'unknown date') + '.',
                '  <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Detailed access breakdown is captured for newer downloads.</div>',
                '</div>'
            ].join('');
        } else {
            historyHtml = [
                '<div class="rpa-state">',
                '  <i class="fas fa-clock"></i>',
                '  No download or print history has been recorded for this report yet.',
                '  <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">When an admin or franchisee downloads/prints this PDF, an audit log entry will be logged here.</div>',
                '</div>'
            ].join('');
        }

        body.innerHTML = chipsHtml + historyHtml;
    }

    function open(bookingId, latestData) {
        var bid = String(bookingId || '').trim();
        if (!bid) return;

        var root = ensureModal();
        var body = document.getElementById('rpa-modal-body');
        var sub = document.getElementById('rpa-modal-sub');

        if (sub) sub.innerHTML = 'Booking #' + esc(bid);

        // Immediate preview from badge attributes to prevent visual delay
        var parsedLatest = null;
        if (latestData) {
            if (typeof latestData === 'string') {
                try { parsedLatest = JSON.parse(latestData); } catch (e) { parsedLatest = null; }
            } else if (typeof latestData === 'object') {
                parsedLatest = latestData;
            }
        }

        if (parsedLatest) {
            renderModalContent(bid, null, normalizeAudit(parsedLatest));
        } else if (body) {
            body.innerHTML = [
                '<div class="rpa-state">',
                '  <div class="rpa-spinner"></div>',
                '  <div style="margin-top:12px;">Fetching audit trail for booking #' + esc(bid) + '...</div>',
                '</div>'
            ].join('');
        }

        root.classList.add('is-open');

        // Fetch fresh audit trail from backend
        var url = resolveBaseUrl() + '/api/v1/user/print-audit/' + encodeURIComponent(bid);
        fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) {
                    // Fallback to query param
                    return fetch(resolveBaseUrl() + '/api/v1/user/print-audit?bookingId=' + encodeURIComponent(bid), {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'same-origin'
                    });
                }
                return r;
            })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var auditObj = data && data.printAudit ? data.printAudit : (parsedLatest || {});
                var patientName = data && data.booking && data.booking.patientName ? data.booking.patientName : null;
                renderModalContent(bid, patientName, normalizeAudit(auditObj));

                // Also update matching badge on page if fresh data has new count/status
                updateBadges(bid, auditObj);
            })
            .catch(function (err) {
                console.warn('[print-audit] Failed to fetch full audit history:', err);
                if (parsedLatest) {
                    // Keep the preview with a subtle error notice
                    var existingBody = document.getElementById('rpa-modal-body');
                    if (existingBody && !existingBody.querySelector('.rpa-error-note')) {
                        var note = document.createElement('div');
                        note.className = 'rpa-error-note';
                        note.style.cssText = 'font-size:11px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;margin-bottom:12px;';
                        note.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Showing cached summary. Detailed history could not be refreshed.';
                        existingBody.insertBefore(note, existingBody.firstChild);
                    }
                } else if (body) {
                    body.innerHTML = [
                        '<div class="rpa-state">',
                        '  <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>',
                        '  Failed to load audit history.',
                        '  <div><button class="rpa-retry" onclick="window.ReportPrintAudit.open(\'' + esc(bid) + '\')"><i class="fas fa-rotate-right"></i> Retry</button></div>',
                        '</div>'
                    ].join('');
                }
            });
    }

    function close() {
        var root = document.getElementById(MODAL_ID);
        if (root) root.classList.remove('is-open');
    }

    /* ------------------------------------------------------------------ */
    /* Real-time DOM Updater                                              */
    /* ------------------------------------------------------------------ */

    function updateBadges(bookingId, auditData) {
        var bid = String(bookingId || '').trim();
        if (!bid) return;

        var normalized = normalizeAudit(auditData || { isPrinted: true });
        var selector = '[data-rpa-badge][data-booking-id="' + esc(bid) + '"]';
        var badges = document.querySelectorAll(selector);

        if (!badges.length) return;

        var newTitle = tooltipFor(normalized);
        var icon = normalized.isPrinted
            ? (normalized.lastAction === 'PRINT' ? 'fas fa-print' : 'fas fa-file-circle-check')
            : 'fas fa-clock';
        var label = normalized.isPrinted
            ? (normalized.lastAction === 'PRINT' ? 'Printed' : 'Downloaded')
            : 'Not downloaded';
        var countHtml = normalized.isPrinted && normalized.printCount > 1
            ? '<span class="rpa-badge__count">&times;' + normalized.printCount + '</span>'
            : '';

        for (var i = 0; i < badges.length; i++) {
            var el = badges[i];
            el.className = 'rpa-badge ' + (normalized.isPrinted ? 'rpa-badge--done' : 'rpa-badge--idle');
            el.setAttribute('title', newTitle);
            el.setAttribute('aria-label', newTitle);
            el.setAttribute('data-rpa-latest', JSON.stringify({
                isPrinted: normalized.isPrinted,
                printedBy: normalized.printedBy,
                printedByRole: normalized.printedByRole,
                printedAt: normalized.printedAt,
                lastAction: normalized.lastAction,
                printCount: normalized.printCount
            }));
            el.innerHTML = '<i class="' + icon + '" aria-hidden="true"></i>' + label + countHtml;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Explicit Audit Recording Helper                                    */
    /* ------------------------------------------------------------------ */

    function record(bookingId, action, options) {
        var bid = String(bookingId || '').trim();
        if (!bid) return Promise.resolve(null);

        var act = String(action || 'DOWNLOAD').trim().toUpperCase() === 'PRINT' ? 'PRINT' : 'DOWNLOAD';
        var opts = options || {};

        var url = resolveBaseUrl() + '/api/v1/user/print-audit';
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                bookingId: bid,
                action: act,
                reportId: opts.reportId || null
            })
        })
        .then(function (r) {
            if (!r.ok) return null;
            return r.json();
        })
        .then(function (data) {
            if (data && data.printAudit) {
                updateBadges(bid, data.printAudit);
                try {
                    window.dispatchEvent(new CustomEvent('printAuditUpdated', {
                        detail: { bookingId: bid, action: act, printAudit: data.printAudit }
                    }));
                } catch (e) { /* ignore */ }
            }
            return data;
        })
        .catch(function (err) {
            console.warn('[print-audit] Record audit call failed:', err);
            return null;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Delegated Event Listeners                                          */
    /* ------------------------------------------------------------------ */

    function attach() {
        if (bound) return;
        bound = true;

        ensureStyles();

        document.addEventListener('click', function (e) {
            // Check modal close target
            var closeTarget = e.target.closest('[data-rpa-close]');
            if (closeTarget) {
                e.preventDefault();
                close();
                return;
            }

            // Check badge click target
            var badgeTarget = e.target.closest(BADGE_SELECTOR);
            if (badgeTarget) {
                var bookingId = badgeTarget.getAttribute('data-booking-id');
                var latest = badgeTarget.getAttribute('data-rpa-latest');
                if (bookingId) {
                    e.preventDefault();
                    open(bookingId, latest);
                }
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var root = document.getElementById(MODAL_ID);
                if (root && root.classList.contains('is-open')) {
                    close();
                }
                return;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                var active = document.activeElement;
                if (active && active.matches && active.matches(BADGE_SELECTOR)) {
                    var bookingId = active.getAttribute('data-booking-id');
                    var latest = active.getAttribute('data-rpa-latest');
                    if (bookingId) {
                        e.preventDefault();
                        open(bookingId, latest);
                    }
                }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Public Interface & Initialization                                  */
    /* ------------------------------------------------------------------ */

    var api = {
        badge: badge,
        open: open,
        close: close,
        attach: attach,
        record: record,
        updateBadges: updateBadges,
        normalize: normalizeAudit,
        __ready: true
    };

    global.ReportPrintAudit = api;
    if (global.parent && global.parent !== global) {
        try {
            global.parent.ReportPrintAudit = global.parent.ReportPrintAudit || api;
        } catch (e) { /* cross-origin frame ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }

})(typeof window !== 'undefined' ? window : this);


