/**
 * user_verification.js
 * Non-intrusive, modern WhatsApp & Contact Verification Widget
 * Designed for OccuHealth portals (Admin, Franchisee, Sub-Franchisee, Super-Franchisee).
 * Never blocks user interaction; offers elegant corner notification & modal verification.
 */

(function () {
  'use strict';

  const BASE_URL = window.location.origin;
  const SNOOZE_KEY = 'occu_whatsapp_verify_snoozed';
  let verificationState = {
    user: null,
    currentChannel: 'phone', // 'phone' or 'email'
    step: 'send', // 'send' or 'verify'
    isEditingContact: false,
    timerInterval: null,
    timerSeconds: 0,
    loading: false,
    errorMessage: '',
    successMessage: ''
  };

  function injectStyles() {
    if (document.getElementById('occu-verification-styles')) return;

    const style = document.createElement('style');
    style.id = 'occu-verification-styles';
    style.textContent = `
      /* Scope all styles under oh-verify */
      .oh-verify-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        box-sizing: border-box;
      }
      .oh-verify-container * {
        box-sizing: border-box;
      }

      /* Floating Toast (Bottom Right) */
      .oh-verify-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99998;
        max-width: 360px;
        width: calc(100vw - 48px);
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.06);
        border-left: 5px solid #25D366;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: oh-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }

      .oh-verify-toast-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .oh-verify-toast-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .oh-verify-toast-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #e8f5e9;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #25D366;
        flex-shrink: 0;
      }

      .oh-verify-toast-title {
        font-size: 13.5px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
        line-height: 1.2;
      }

      .oh-verify-toast-close {
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        transition: color 0.15s, background-color 0.15s;
      }
      .oh-verify-toast-close:hover {
        color: #374151;
        background-color: #f3f4f6;
      }

      .oh-verify-toast-desc {
        font-size: 12.5px;
        color: #4b5563;
        margin: 0;
        line-height: 1.4;
      }

      .oh-verify-toast-meta {
        font-size: 11.5px;
        color: #6b7280;
        background: #f9fafb;
        padding: 4px 8px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
      }

      .oh-verify-toast-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 2px;
      }

      .oh-verify-btn-primary {
        background: #25D366;
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
        color: white;
        border: none;
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s;
        box-shadow: 0 2px 6px rgba(37, 211, 102, 0.35);
      }
      .oh-verify-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(37, 211, 102, 0.45);
      }
      .oh-verify-btn-primary:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .oh-verify-btn-subtle {
        background: transparent;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.15s, color 0.15s;
      }
      .oh-verify-btn-subtle:hover {
        background-color: #f3f4f6;
        color: #374151;
      }

      /* Floating Mini Button when Minimized */
      .oh-verify-float-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99998;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
        color: white;
        border: 2px solid #ffffff;
        box-shadow: 0 8px 20px rgba(37, 211, 102, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
        animation: oh-pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .oh-verify-float-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 10px 24px rgba(37, 211, 102, 0.55);
      }

      .oh-verify-badge-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 13px;
        height: 13px;
        background: #f59e0b;
        border-radius: 50%;
        border: 2px solid #ffffff;
        animation: oh-pulse 2s infinite;
      }

      /* Modal Backdrop */
      .oh-verify-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: oh-fade-in 0.2s ease-out;
      }

      .oh-verify-modal-card {
        background: #ffffff;
        border-radius: 18px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        padding: 24px;
        position: relative;
        animation: oh-scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .oh-verify-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .oh-verify-modal-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .oh-verify-modal-icon-badge {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        color: #128C7E;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .oh-verify-modal-title {
        font-size: 17px;
        font-weight: 700;
        color: #111827;
        margin: 0;
      }

      .oh-verify-modal-subtitle {
        font-size: 12.5px;
        color: #6b7280;
        margin: 2px 0 0 0;
      }

      .oh-verify-tabs {
        display: flex;
        background: #f3f4f6;
        padding: 4px;
        border-radius: 10px;
        margin-bottom: 18px;
      }

      .oh-verify-tab-btn {
        flex: 1;
        padding: 7px 12px;
        font-size: 13px;
        font-weight: 600;
        border: none;
        background: transparent;
        color: #4b5563;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
      }

      .oh-verify-tab-btn.active {
        background: #ffffff;
        color: #111827;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .oh-verify-info-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 18px;
      }

      .oh-verify-info-label {
        font-size: 11.5px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .oh-verify-info-value {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
        word-break: break-all;
      }

      .oh-verify-otp-input {
        width: 100%;
        font-size: 24px;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.35em;
        padding: 12px;
        border: 2px solid #cbd5e1;
        border-radius: 12px;
        margin: 12px 0 16px 0;
        background: #f8fafc;
        color: #0f172a;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .oh-verify-otp-input:focus {
        border-color: #25D366;
        box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.15);
        background: #ffffff;
      }

      .oh-verify-alert {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 14px;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .oh-verify-alert-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
      }
      .oh-verify-alert-success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
      }

      .oh-verify-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: oh-spin 0.6s linear infinite;
        display: inline-block;
      }

      .oh-verify-spinner-dark {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(0, 0, 0, 0.2);
        border-top-color: #111827;
        border-radius: 50%;
        animation: oh-spin 0.6s linear infinite;
        display: inline-block;
      }

      @keyframes oh-slide-up {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes oh-pop-in {
        from { transform: scale(0.5); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes oh-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes oh-scale-up {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes oh-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
      }
      @keyframes oh-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // Icons
  const ICONS = {
    whatsapp: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.49-1.4-1.74-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.47-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.09 2.53.73 2.99.69.45-.04 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.23-.17-.48-.3"/></svg>`,
    email: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
  };

  function getIdentifier(user, channel) {
    if (!user) return '';
    if (channel === 'email') return user.email || '';
    return user.phoneNumber || user.phoneNo || '';
  }

  function isVerified(user, channel) {
    if (!user) return false;
    if (channel === 'email') return user.emailVerified === true;
    return user.phoneVerified === true;
  }

  /**
   * Main entry point
   */
  window.initVerificationWidget = function (currentUser) {
    if (!currentUser) return;
    verificationState.user = currentUser;

    injectStyles();

    // Remove legacy intrusive banner if present
    const legacy = document.getElementById('verificationBanner');
    if (legacy) legacy.remove();

    // Check if verification is needed
    const phoneIsVerified = isVerified(currentUser, 'phone');
    const emailIsVerified = isVerified(currentUser, 'email');

    // Both verified -> cleanup and exit
    if (phoneIsVerified && emailIsVerified) {
      removeWidget();
      return;
    }

    // Set default channel based on what's pending (prefer phone/whatsapp)
    if (!phoneIsVerified) {
      verificationState.currentChannel = 'phone';
    } else {
      verificationState.currentChannel = 'email';
    }

    renderCornerWidget();
    enhanceUserPopup();
  };

  /**
   * Render either the floating card or the minimized round badge
   */
  function renderCornerWidget() {
    removeWidget();

    const isSnoozed = sessionStorage.getItem(SNOOZE_KEY) === 'true';

    const container = document.createElement('div');
    container.id = 'oh-verification-root';
    container.className = 'oh-verify-container';

    if (isSnoozed) {
      // Minimized Floating Button
      container.innerHTML = `
        <button type="button" class="oh-verify-float-btn" id="ohVerifyFloatBtn" title="WhatsApp Verification Pending - Click to verify" aria-label="Verify WhatsApp">
          ${ICONS.whatsapp}
          <span class="oh-verify-badge-dot"></span>
        </button>
      `;
      document.body.appendChild(container);
      document.getElementById('ohVerifyFloatBtn')?.addEventListener('click', () => {
        openModal();
      });
    } else {
      // Non-intrusive Floating Toast Card
      const user = verificationState.user;
      const phonePending = !isVerified(user, 'phone');
      const emailPending = !isVerified(user, 'email');
      const number = getIdentifier(user, 'phone') || 'No number added';

      let pendingText = 'WhatsApp';
      if (phonePending && emailPending) pendingText = 'WhatsApp & Email';
      else if (emailPending) pendingText = 'Email';

      container.innerHTML = `
        <div class="oh-verify-toast" id="ohVerifyToast" role="status" aria-live="polite">
          <div class="oh-verify-toast-header">
            <div class="oh-verify-toast-title-wrap">
              <div class="oh-verify-toast-icon">
                ${ICONS.whatsapp}
              </div>
              <div>
                <h4 class="oh-verify-toast-title">${pendingText} Verification</h4>
              </div>
            </div>
            <button type="button" class="oh-verify-toast-close" id="ohVerifyToastDismiss" title="Remind me later" aria-label="Close">
              ${ICONS.close}
            </button>
          </div>
          <p class="oh-verify-toast-desc">
            Verify your contact to receive real-time report alerts and booking updates directly on WhatsApp.
          </p>
          ${phonePending && number ? `<div class="oh-verify-toast-meta"><span>📱 ${number}</span></div>` : ''}
          <div class="oh-verify-toast-actions">
            <button type="button" class="oh-verify-btn-primary" id="ohVerifyNowBtn">
              Verify Now →
            </button>
            <button type="button" class="oh-verify-btn-subtle" id="ohVerifyLaterBtn">
              Later
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      // Event listeners
      document.getElementById('ohVerifyNowBtn')?.addEventListener('click', () => {
        openModal();
      });

      const dismissHandler = () => {
        sessionStorage.setItem(SNOOZE_KEY, 'true');
        renderCornerWidget(); // Re-render as minimized floating badge
      };

      document.getElementById('ohVerifyToastDismiss')?.addEventListener('click', dismissHandler);
      document.getElementById('ohVerifyLaterBtn')?.addEventListener('click', dismissHandler);
    }
  }

  function removeWidget() {
    const existing = document.getElementById('oh-verification-root');
    if (existing) existing.remove();
  }

  /**
   * Modal Dialog for OTP verification
   */
  function openModal() {
    if (document.getElementById('ohVerifyModal')) return;

    verificationState.step = 'send';
    verificationState.errorMessage = '';
    verificationState.successMessage = '';
    verificationState.loading = false;
    clearInterval(verificationState.timerInterval);
    verificationState.timerSeconds = 0;

    const overlay = document.createElement('div');
    overlay.id = 'ohVerifyModal';
    overlay.className = 'oh-verify-container oh-verify-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="oh-verify-modal-card" id="ohVerifyModalCard">
        <!-- Rendered via renderModalBody -->
      </div>
    `;

    document.body.appendChild(overlay);
    renderModalBody();

    // Close when clicking overlay backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  function closeModal() {
    clearInterval(verificationState.timerInterval);
    const modal = document.getElementById('ohVerifyModal');
    if (modal) modal.remove();
  }

  function renderModalBody() {
    const card = document.getElementById('ohVerifyModalCard');
    if (!card) return;

    const user = verificationState.user;
    const channel = verificationState.currentChannel;
    const isPhone = channel === 'phone';
    const identifier = getIdentifier(user, channel) || '';
    const phonePending = !isVerified(user, 'phone');
    const emailPending = !isVerified(user, 'email');
    const bothPending = phonePending && emailPending;

    const title = isPhone ? 'WhatsApp Verification' : 'Email Verification';
    const subtitle = isPhone
      ? 'Verify your WhatsApp number to receive report PDFs and status updates.'
      : 'Verify your email address for account security and notifications.';

    let html = `
      <div class="oh-verify-modal-header">
        <div class="oh-verify-modal-title-group">
          <div class="oh-verify-modal-icon-badge">
            ${isPhone ? ICONS.whatsapp : ICONS.email}
          </div>
          <div>
            <h3 class="oh-verify-modal-title">${title}</h3>
            <p class="oh-verify-modal-subtitle">${subtitle}</p>
          </div>
        </div>
        <button type="button" class="oh-verify-toast-close" id="ohModalCloseBtn" aria-label="Close">
          ${ICONS.close}
        </button>
      </div>
    `;

    // Tab switcher if both or other are available
    if (bothPending) {
      html += `
        <div class="oh-verify-tabs">
          <button type="button" class="oh-verify-tab-btn ${isPhone ? 'active' : ''}" id="ohTabPhone">
            ${ICONS.whatsapp} WhatsApp
          </button>
          <button type="button" class="oh-verify-tab-btn ${!isPhone ? 'active' : ''}" id="ohTabEmail">
            ${ICONS.email} Email
          </button>
        </div>
      `;
    }

    // Alerts
    if (verificationState.errorMessage) {
      html += `
        <div class="oh-verify-alert oh-verify-alert-error">
          <span>⚠️</span>
          <div>${verificationState.errorMessage}</div>
        </div>
      `;
    }
    if (verificationState.successMessage) {
      html += `
        <div class="oh-verify-alert oh-verify-alert-success">
          <span>${ICONS.check}</span>
          <div>${verificationState.successMessage}</div>
        </div>
      `;
    }

    // Body content: Send Step vs Verify Step
    if (verificationState.step === 'send') {
      html += `
        <div class="oh-verify-info-box">
          <div class="oh-verify-info-label">
            <span>Registered ${isPhone ? 'WhatsApp / Mobile' : 'Email'}</span>
            <span style="color:#d97706;font-size:11px;">Verification Pending</span>
          </div>
          <div class="oh-verify-info-value" id="ohDisplayContact">
            ${identifier || '<span style="color:#ef4444;font-size:13px;">No contact details found</span>'}
          </div>
          ${isPhone ? `
            <div style="margin-top:8px;">
              <button type="button" id="ohToggleEditPhone" style="background:none;border:none;color:#0284c7;font-size:12px;font-weight:600;cursor:pointer;padding:0;">
                ${verificationState.isEditingContact ? 'Cancel edit' : '✏️ Change phone number'}
              </button>
            </div>
          ` : ''}
        </div>

        ${verificationState.isEditingContact ? `
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">
              New Phone Number (with country code, e.g. +919876543210):
            </label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="ohNewPhoneInput" value="${identifier}" style="flex:1;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;" placeholder="+919876543210" />
              <button type="button" class="oh-verify-btn-subtle" id="ohSaveNewPhoneBtn" style="white-space:nowrap;">Save</button>
            </div>
          </div>
        ` : ''}

        <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;">
          <button type="button" class="oh-verify-btn-primary" id="ohSendOtpBtn" style="justify-content:center;padding:11px;" ${verificationState.loading ? 'disabled' : ''}>
            ${verificationState.loading ? `<span class="oh-verify-spinner"></span> Sending OTP...` : `Send ${isPhone ? 'WhatsApp ' : ''}OTP →`}
          </button>
        </div>
      `;
    } else {
      // Step: Verify OTP
      html += `
        <div style="text-align:center;margin-bottom:12px;">
          <p style="font-size:13px;color:#4b5563;margin:0 0 4px 0;">
            We've sent a 6-digit OTP to:
          </p>
          <strong style="font-size:15px;color:#111827;">${identifier}</strong>
        </div>

        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:#4b5563;text-align:center;">
            ENTER 6-DIGIT CODE
          </label>
          <input type="text" id="ohOtpInput" class="oh-verify-otp-input" maxlength="6" inputmode="numeric" placeholder="••••••" autocomplete="one-time-code" autofocus />
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" class="oh-verify-btn-primary" id="ohVerifyOtpBtn" style="justify-content:center;padding:11px;" ${verificationState.loading ? 'disabled' : ''}>
            ${verificationState.loading ? `<span class="oh-verify-spinner"></span> Verifying...` : `Verify & Confirm ✓`}
          </button>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
            <button type="button" id="ohBackToSendBtn" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;padding:0;">
              ← Back / Change Number
            </button>
            <div id="ohResendWrap" style="font-size:12px;color:#6b7280;">
              ${verificationState.timerSeconds > 0
                ? `Resend in ${verificationState.timerSeconds}s`
                : `<button type="button" id="ohResendOtpBtn" style="background:none;border:none;color:#059669;font-weight:600;cursor:pointer;padding:0;">Resend OTP</button>`
              }
            </div>
          </div>
        </div>
      `;
    }

    card.innerHTML = html;
    bindModalEvents();
  }

  function bindModalEvents() {
    document.getElementById('ohModalCloseBtn')?.addEventListener('click', closeModal);

    // Tab switching
    document.getElementById('ohTabPhone')?.addEventListener('click', () => {
      verificationState.currentChannel = 'phone';
      verificationState.step = 'send';
      verificationState.errorMessage = '';
      verificationState.successMessage = '';
      renderModalBody();
    });
    document.getElementById('ohTabEmail')?.addEventListener('click', () => {
      verificationState.currentChannel = 'email';
      verificationState.step = 'send';
      verificationState.errorMessage = '';
      verificationState.successMessage = '';
      renderModalBody();
    });

    // Toggle Edit phone
    document.getElementById('ohToggleEditPhone')?.addEventListener('click', () => {
      verificationState.isEditingContact = !verificationState.isEditingContact;
      renderModalBody();
    });

    // Save edited phone
    document.getElementById('ohSaveNewPhoneBtn')?.addEventListener('click', async () => {
      const input = document.getElementById('ohNewPhoneInput');
      const newPhone = input ? input.value.trim() : '';
      if (!newPhone) {
        verificationState.errorMessage = 'Please enter a valid phone number';
        renderModalBody();
        return;
      }
      try {
        verificationState.loading = true;
        renderModalBody();
        const res = await fetch(`${BASE_URL}/api/v1/user/verification/contact`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phoneNumber: newPhone })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to update phone number');

        verificationState.user.phoneNumber = newPhone;
        verificationState.user.phoneNo = newPhone;
        verificationState.user.phoneVerified = false;
        verificationState.isEditingContact = false;
        verificationState.errorMessage = '';
        verificationState.successMessage = 'Phone number updated! You can now send OTP.';
      } catch (err) {
        verificationState.errorMessage = err.message || 'Failed to update phone';
      } finally {
        verificationState.loading = false;
        renderModalBody();
      }
    });

    // Send OTP
    document.getElementById('ohSendOtpBtn')?.addEventListener('click', handleSendOtp);

    // Verify OTP
    document.getElementById('ohVerifyOtpBtn')?.addEventListener('click', handleVerifyOtp);

    // Enter key in OTP input
    const otpInput = document.getElementById('ohOtpInput');
    if (otpInput) {
      otpInput.focus();
      otpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleVerifyOtp();
      });
      otpInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
        if (e.target.value.length === 6) {
          handleVerifyOtp();
        }
      });
    }

    // Back to send
    document.getElementById('ohBackToSendBtn')?.addEventListener('click', () => {
      clearInterval(verificationState.timerInterval);
      verificationState.step = 'send';
      verificationState.errorMessage = '';
      verificationState.successMessage = '';
      renderModalBody();
    });

    // Resend OTP
    document.getElementById('ohResendOtpBtn')?.addEventListener('click', handleSendOtp);
  }

  async function handleSendOtp() {
    const channel = verificationState.currentChannel;
    verificationState.loading = true;
    verificationState.errorMessage = '';
    verificationState.successMessage = '';
    renderModalBody();

    try {
      const response = await fetch(`${BASE_URL}/api/v1/user/verification/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to send OTP');

      verificationState.step = 'verify';
      verificationState.successMessage = `OTP sent successfully to your ${channel === 'phone' ? 'WhatsApp' : 'email'}!`;
      startResendTimer(60);
    } catch (err) {
      verificationState.errorMessage = err.message || 'Failed to send OTP';
    } finally {
      verificationState.loading = false;
      renderModalBody();
    }
  }

  async function handleVerifyOtp() {
    const otpInput = document.getElementById('ohOtpInput');
    const code = otpInput ? otpInput.value.trim() : '';
    if (!code || code.length < 4) {
      verificationState.errorMessage = 'Please enter the complete OTP';
      renderModalBody();
      return;
    }

    const channel = verificationState.currentChannel;
    verificationState.loading = true;
    verificationState.errorMessage = '';
    renderModalBody();

    try {
      const response = await fetch(`${BASE_URL}/api/v1/user/verification/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel, code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Verification failed');

      // Success! Update local user state
      if (channel === 'phone') {
        verificationState.user.phoneVerified = true;
      } else {
        verificationState.user.emailVerified = true;
      }

      verificationState.successMessage = `${channel === 'phone' ? 'WhatsApp' : 'Email'} verified successfully!`;
      verificationState.errorMessage = '';
      renderModalBody();

      // Check if both are now verified
      const phoneDone = isVerified(verificationState.user, 'phone');
      const emailDone = isVerified(verificationState.user, 'email');

      setTimeout(() => {
        if (phoneDone && emailDone) {
          closeModal();
          removeWidget();
          enhanceUserPopup();
        } else {
          // Switch to other pending channel or finish
          verificationState.step = 'send';
          verificationState.currentChannel = phoneDone ? 'email' : 'phone';
          renderModalBody();
          renderCornerWidget();
          enhanceUserPopup();
        }
      }, 1500);

    } catch (err) {
      verificationState.errorMessage = err.message || 'Invalid or expired OTP';
      verificationState.loading = false;
      renderModalBody();
    }
  }

  function startResendTimer(seconds) {
    clearInterval(verificationState.timerInterval);
    verificationState.timerSeconds = seconds;
    verificationState.timerInterval = setInterval(() => {
      verificationState.timerSeconds--;
      if (verificationState.timerSeconds <= 0) {
        clearInterval(verificationState.timerInterval);
      }
      const wrap = document.getElementById('ohResendWrap');
      if (wrap) {
        if (verificationState.timerSeconds > 0) {
          wrap.textContent = `Resend in ${verificationState.timerSeconds}s`;
        } else {
          wrap.innerHTML = `<button type="button" id="ohResendOtpBtn" style="background:none;border:none;color:#059669;font-weight:600;cursor:pointer;padding:0;">Resend OTP</button>`;
          document.getElementById('ohResendOtpBtn')?.addEventListener('click', handleSendOtp);
        }
      }
    }, 1000);
  }

  /**
   * Integrate neatly into navbar user profile popup if present
   */
  function enhanceUserPopup() {
    const userPopup = document.getElementById('userPopup');
    if (!userPopup) return;

    let badgeWrap = document.getElementById('ohUserPopupVerifyBadge');
    if (!badgeWrap) {
      badgeWrap = document.createElement('div');
      badgeWrap.id = 'ohUserPopupVerifyBadge';
      badgeWrap.style.cssText = 'padding: 8px 12px; margin: 8px 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #e5e7eb;';
      const userInfo = userPopup.querySelector('.user-info');
      if (userInfo && userInfo.nextSibling) {
        userPopup.insertBefore(badgeWrap, userInfo.nextSibling);
      } else {
        userPopup.prepend(badgeWrap);
      }
    }

    const phoneDone = isVerified(verificationState.user, 'phone');
    if (phoneDone) {
      badgeWrap.innerHTML = `
        <span style="display:flex;align-items:center;gap:6px;color:#15803d;font-weight:600;">
          ${ICONS.whatsapp} WhatsApp Verified
        </span>
        <span style="color:#15803d;">✓</span>
      `;
    } else {
      badgeWrap.innerHTML = `
        <span style="display:flex;align-items:center;gap:6px;color:#b45309;font-weight:600;">
          ${ICONS.whatsapp} WhatsApp Pending
        </span>
        <button type="button" id="ohPopupVerifyBtn" style="background:#25D366;color:white;border:none;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">
          Verify
        </button>
      `;
      document.getElementById('ohPopupVerifyBtn')?.addEventListener('click', () => {
        openModal();
      });
    }
  }

  // Fallback alias for legacy calls
  window.showVerificationBanner = window.initVerificationWidget;

})();
