/**
 * ============================================================================
 * NABL ACCREDITATION LOGO SETTINGS MANAGER
 * ============================================================================
 * File: private/pages/pages/nablLogoSettings.js
 * 
 * Purpose:
 * Completely modular, standalone JavaScript controller for managing NABL logo
 * position, dimensions, presets, page placement, and real-time interactive
 * visual dragging/resizing directly over the report preview iframe.
 * 
 * Key Capabilities:
 * 1. Live Interactive Dragging: Drag logo proxy directly across the A4 preview page.
 * 2. Live Corner Resizing: Adjust size using the bottom-right drag handle.
 * 3. Bidirectional Sliders: Real-time synchronization between inputs and visual proxy.
 * 4. One-Click Position Presets: Top-Right, Top-Left, Top-Center, Bottom-Right, Bottom-Left.
 * 5. Direct Cloudinary Upload: Upload/replace NABL logo directly within Print Settings.
 * 6. Permanent Persistence: Saves layout to MongoDB defaultpdfsetting collection.
 * 7. Clean Architecture: 100% self-contained, ensuring existing print features never break.
 * ============================================================================
 */

(function () {
    'use strict';

    // Base API URL
    const BASE_URL = window.location.origin;

    // Standard A4 Paper Metrics in Millimeters
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;

    // Default Configuration State
    const state = {
        nablLogoUrl: '',
        hasLogo: false,
        nablLogoWidth: 30,          // mm (default ~85pt)
        nablLogoHeight: 18,         // mm (default ~50pt)
        nablLogoX: 170,             // mm from left edge
        nablLogoY: 5,               // mm from top edge
        nablLogoPosition: 'top-right',
        nablLogoPageOption: 'all-pages',
        nablLogoVisible: true,
        lockAspectRatio: true,
        aspectRatio: 30 / 18,       // width / height
        isDragging: false,
        isResizing: false,
        dragStartX: 0,
        dragStartY: 0,
        initialX: 0,
        initialY: 0,
        initialWidth: 30,
        initialHeight: 18
    };

    /**
     * UI Element References Cache
     */
    const elements = {
        accordionHeader: null,
        accordionContent: null,
        statusBanner: null,
        statusBadge: null,
        thumbnailImg: null,
        uploadInput: null,
        statusDesc: null,

        // Preset Buttons
        presetTopRight: null,
        presetTopLeft: null,
        presetTopCenter: null,
        presetBottomRight: null,
        presetBottomLeft: null,

        // Range Sliders & Number Inputs
        sliderX: null,
        inputX: null,
        badgeX: null,
        sliderY: null,
        inputY: null,
        badgeY: null,
        sliderWidth: null,
        inputWidth: null,
        badgeWidth: null,
        sliderHeight: null,
        inputHeight: null,
        badgeHeight: null,

        // Checkboxes & Radios
        lockAspectCheckbox: null,
        visibilityCheckbox: null,
        radioAllPages: null,
        radioFirstPage: null,

        // Buttons
        saveBtn: null,
        resetBtn: null,
        toastMsg: null,

        // Interactive Overlay
        previewDiv: null,
        overlay: null,
        draggableProxy: null,
        proxyImg: null,
        proxyBadge: null,
        resizeHandle: null
    };

    /**
     * ========================================================================
     * INITIALIZATION & DOM BINDING
     * ========================================================================
     */
    function init() {
        cacheDOMElements();
        if (!elements.accordionContent) {
            console.warn('[nablLogoSettings] Accordion markup not found, deferring initialization.');
            return;
        }

        setupInteractiveOverlay();
        bindEventListeners();
        fetchInitialData();
    }

    /**
     * Cache all required DOM elements
     */
    function cacheDOMElements() {
        elements.accordionHeader = document.getElementById('nabl-accordion-btn');
        elements.accordionContent = document.getElementById('nabl-accordion-content');
        elements.statusBanner = document.getElementById('nabl-status-banner');
        elements.statusBadge = document.getElementById('nabl-status-badge');
        elements.thumbnailImg = document.getElementById('nabl-thumbnail-img');
        elements.uploadInput = document.getElementById('nabl-quick-upload-input');
        elements.statusDesc = document.getElementById('nabl-status-desc');

        elements.presetTopRight = document.getElementById('nabl-preset-top-right');
        elements.presetTopLeft = document.getElementById('nabl-preset-top-left');
        elements.presetTopCenter = document.getElementById('nabl-preset-top-center');
        elements.presetBottomRight = document.getElementById('nabl-preset-bottom-right');
        elements.presetBottomLeft = document.getElementById('nabl-preset-bottom-left');

        elements.sliderX = document.getElementById('nabl-slider-x');
        elements.inputX = document.getElementById('nabl-input-x');
        elements.badgeX = document.getElementById('nabl-badge-x');

        elements.sliderY = document.getElementById('nabl-slider-y');
        elements.inputY = document.getElementById('nabl-input-y');
        elements.badgeY = document.getElementById('nabl-badge-y');

        elements.sliderWidth = document.getElementById('nabl-slider-width');
        elements.inputWidth = document.getElementById('nabl-input-width');
        elements.badgeWidth = document.getElementById('nabl-badge-width');

        elements.sliderHeight = document.getElementById('nabl-slider-height');
        elements.inputHeight = document.getElementById('nabl-input-height');
        elements.badgeHeight = document.getElementById('nabl-badge-height');

        elements.lockAspectCheckbox = document.getElementById('nabl-lock-aspect');
        elements.visibilityCheckbox = document.getElementById('nabl-visibility');
        elements.radioAllPages = document.getElementById('nabl-page-all');
        elements.radioFirstPage = document.getElementById('nabl-page-first');

        elements.saveBtn = document.getElementById('nabl-save-btn');
        elements.resetBtn = document.getElementById('nabl-reset-btn');
        elements.toastMsg = document.getElementById('nabl-toast-msg');

        elements.previewDiv = document.getElementById('pdf-preview-div');
    }

    /**
     * ========================================================================
     * INTERACTIVE OVERLAY OVER PDF PREVIEW
     * ========================================================================
     */
    function setupInteractiveOverlay() {
        if (!elements.previewDiv) return;

        // Ensure parent div has relative positioning for overlay attachment
        elements.previewDiv.style.position = 'relative';

        // Check if overlay already exists
        let overlay = document.getElementById('nabl-interactive-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'nabl-interactive-overlay';
            overlay.innerHTML = `
                <div class="nabl-drag-hint-banner">
                    <i class="fas fa-arrows-up-down-left-right"></i> Drag logo to position &bull; Use bottom-right handle to resize
                </div>
                <div class="nabl-draggable-proxy" id="nabl-draggable-proxy" title="Click and drag to position NABL logo">
                    <img class="nabl-proxy-img" id="nabl-proxy-img" src="" alt="NABL Logo">
                    <div class="nabl-proxy-badge" id="nabl-proxy-badge">170mm, 5mm</div>
                    <div class="nabl-resize-handle" id="nabl-resize-handle" title="Drag to resize logo"></div>
                </div>
            `;
            elements.previewDiv.appendChild(overlay);
        }

        elements.overlay = overlay;
        elements.draggableProxy = document.getElementById('nabl-draggable-proxy');
        elements.proxyImg = document.getElementById('nabl-proxy-img');
        elements.proxyBadge = document.getElementById('nabl-proxy-badge');
        elements.resizeHandle = document.getElementById('nabl-resize-handle');

        // Bind Drag & Resize listeners on visual proxy
        bindProxyPointerEvents();
    }

    /**
     * Bind Mouse & Touch events to make the proxy smoothly draggable and resizable
     */
    function bindProxyPointerEvents() {
        const proxy = elements.draggableProxy;
        const resizeHandle = elements.resizeHandle;
        if (!proxy || !resizeHandle) return;

        // --- 1. Resizing Events ---
        function onResizeStart(e) {
            e.stopPropagation();
            e.preventDefault();
            state.isResizing = true;
            state.dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            state.dragStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            state.initialWidth = state.nablLogoWidth;
            state.initialHeight = state.nablLogoHeight;

            window.addEventListener('mousemove', onResizeMove, { passive: false });
            window.addEventListener('touchmove', onResizeMove, { passive: false });
            window.addEventListener('mouseup', onResizeEnd);
            window.addEventListener('touchend', onResizeEnd);
        }

        function onResizeMove(e) {
            if (!state.isResizing) return;
            e.preventDefault();

            const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

            const deltaScreenX = currentX - state.dragStartX;
            const deltaScreenY = currentY - state.dragStartY;

            // Convert screen pixel delta to millimeters
            const pxPerMm = getPixelsPerMm();
            const deltaMmX = deltaScreenX / pxPerMm.x;
            const deltaMmY = deltaScreenY / pxPerMm.y;

            let newWidth = Math.max(10, Math.min(80, state.initialWidth + deltaMmX));
            let newHeight;

            if (state.lockAspectRatio && state.aspectRatio > 0) {
                newHeight = Math.max(6, Math.min(60, newWidth / state.aspectRatio));
            } else {
                newHeight = Math.max(6, Math.min(60, state.initialHeight + deltaMmY));
            }

            state.nablLogoWidth = Math.round(newWidth * 10) / 10;
            state.nablLogoHeight = Math.round(newHeight * 10) / 10;
            state.nablLogoPosition = 'custom';

            updateFormInputsFromState();
            updateDraggableProxyPosition();
        }

        function onResizeEnd() {
            if (!state.isResizing) return;
            state.isResizing = false;
            window.removeEventListener('mousemove', onResizeMove);
            window.removeEventListener('touchmove', onResizeMove);
            window.removeEventListener('mouseup', onResizeEnd);
            window.removeEventListener('touchend', onResizeEnd);
        }

        resizeHandle.addEventListener('mousedown', onResizeStart);
        resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });

        // --- 2. Dragging Events ---
        function onDragStart(e) {
            // If clicking on resize handle, let resize handler handle it
            if (e.target === resizeHandle || state.isResizing) return;
            e.preventDefault();

            state.isDragging = true;
            proxy.classList.add('is-dragging');

            state.dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            state.dragStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            state.initialX = state.nablLogoX;
            state.initialY = state.nablLogoY;

            window.addEventListener('mousemove', onDragMove, { passive: false });
            window.addEventListener('touchmove', onDragMove, { passive: false });
            window.addEventListener('mouseup', onDragEnd);
            window.addEventListener('touchend', onDragEnd);
        }

        function onDragMove(e) {
            if (!state.isDragging) return;
            e.preventDefault();

            const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

            const deltaScreenX = currentX - state.dragStartX;
            const deltaScreenY = currentY - state.dragStartY;

            const pxPerMm = getPixelsPerMm();
            const deltaMmX = deltaScreenX / pxPerMm.x;
            const deltaMmY = deltaScreenY / pxPerMm.y;

            // Clamp within paper bounds (0 to 210 - width, 0 to 297 - height)
            const maxX = Math.max(0, A4_WIDTH_MM - state.nablLogoWidth);
            const maxY = Math.max(0, A4_HEIGHT_MM - state.nablLogoHeight);

            const newX = Math.max(0, Math.min(maxX, state.initialX + deltaMmX));
            const newY = Math.max(0, Math.min(maxY, state.initialY + deltaMmY));

            state.nablLogoX = Math.round(newX * 10) / 10;
            state.nablLogoY = Math.round(newY * 10) / 10;
            state.nablLogoPosition = 'custom';

            updateFormInputsFromState();
            updateDraggableProxyPosition();
        }

        function onDragEnd() {
            if (!state.isDragging) return;
            state.isDragging = false;
            proxy.classList.remove('is-dragging');

            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('touchmove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
            window.removeEventListener('touchend', onDragEnd);
        }

        proxy.addEventListener('mousedown', onDragStart);
        proxy.addEventListener('touchstart', onDragStart, { passive: false });
    }

    /**
     * Compute scale mapping between screen pixels of preview div and A4 paper in mm
     */
    function getPixelsPerMm() {
        const previewDiv = elements.previewDiv;
        const w = (previewDiv && previewDiv.clientWidth > 50) ? previewDiv.clientWidth : 485;
        const h = (previewDiv && previewDiv.clientHeight > 50) ? previewDiv.clientHeight : 680;
        return {
            x: w / A4_WIDTH_MM,
            y: h / A4_HEIGHT_MM
        };
    }

    /**
     * Updates the position, size, and tooltip badge of the visual proxy box
     */
    function updateDraggableProxyPosition() {
        if (!elements.draggableProxy || !elements.previewDiv) return;

        const pxPerMm = getPixelsPerMm();
        const leftPx = state.nablLogoX * pxPerMm.x;
        const topPx = state.nablLogoY * pxPerMm.y;
        const widthPx = state.nablLogoWidth * pxPerMm.x;
        const heightPx = state.nablLogoHeight * pxPerMm.y;

        elements.draggableProxy.style.left = `${leftPx}px`;
        elements.draggableProxy.style.top = `${topPx}px`;
        elements.draggableProxy.style.width = `${widthPx}px`;
        elements.draggableProxy.style.height = `${heightPx}px`;

        if (elements.proxyBadge) {
            elements.proxyBadge.textContent = `X: ${state.nablLogoX}mm, Y: ${state.nablLogoY}mm (${state.nablLogoWidth}x${state.nablLogoHeight}mm)`;
        }
    }

    /**
     * ========================================================================
     * DATA FETCHING & SYNCHRONIZATION
     * ========================================================================
     */
    async function fetchInitialData() {
        try {
            // Fetch saved settings via dedicated endpoint
            const response = await fetch(`${BASE_URL}/api/v1/user/get-nabl-settings`);
            if (!response.ok) {
                // Fallback attempt via getting-pdf-data if available
                return;
            }

            const data = await response.json();
            if (data.success && data.settings) {
                const s = data.settings;
                state.nablLogoWidth = Number(s.nablLogoWidth) || 30;
                state.nablLogoHeight = Number(s.nablLogoHeight) || 18;
                state.nablLogoX = Number(s.nablLogoX) ?? 170;
                state.nablLogoY = Number(s.nablLogoY) ?? 5;
                state.nablLogoPosition = s.nablLogoPosition || 'top-right';
                state.nablLogoPageOption = s.nablLogoPageOption || 'all-pages';
                state.nablLogoVisible = s.nablLogoVisible !== false;

                if (state.nablLogoHeight > 0) {
                    state.aspectRatio = state.nablLogoWidth / state.nablLogoHeight;
                }
            }

            if (data.nablLogoUrl) {
                setNablLogoUrl(data.nablLogoUrl);
            } else {
                setNoLogoState();
            }

            updateFormInputsFromState();
            updateDraggableProxyPosition();
        } catch (err) {
            console.warn('[nablLogoSettings] Failed to fetch initial NABL settings:', err.message);
        }
    }

    /**
     * Update UI to reflect an active NABL logo URL
     */
    function setNablLogoUrl(url) {
        state.nablLogoUrl = url;
        state.hasLogo = true;

        if (elements.statusBanner) {
            elements.statusBanner.className = 'nabl-status-banner has-logo';
        }
        if (elements.statusBadge) {
            elements.statusBadge.className = 'nabl-status-badge active';
            elements.statusBadge.textContent = 'Active';
        }
        if (elements.statusDesc) {
            elements.statusDesc.textContent = 'Accreditation badge loaded. Adjust position & size below.';
        }
        if (elements.thumbnailImg) {
            elements.thumbnailImg.src = url;
            elements.thumbnailImg.style.display = 'block';
        }
        if (elements.proxyImg) {
            elements.proxyImg.src = url;
            elements.proxyImg.style.display = 'block';
        }

        // Measure natural image aspect ratio to avoid distortion
        const probeImg = new Image();
        probeImg.onload = function () {
            if (probeImg.naturalWidth > 0 && probeImg.naturalHeight > 0) {
                state.aspectRatio = probeImg.naturalWidth / probeImg.naturalHeight;
                if (state.lockAspectRatio) {
                    state.nablLogoHeight = Math.round((state.nablLogoWidth / state.aspectRatio) * 10) / 10;
                    updateFormInputsFromState();
                    updateDraggableProxyPosition();
                }
            }
        };
        probeImg.src = url;
    }

    /**
     * Update UI when no NABL logo is found
     */
    function setNoLogoState() {
        state.nablLogoUrl = '';
        state.hasLogo = false;

        if (elements.statusBanner) {
            elements.statusBanner.className = 'nabl-status-banner no-logo';
        }
        if (elements.statusBadge) {
            elements.statusBadge.className = 'nabl-status-badge missing';
            elements.statusBadge.textContent = 'Not Uploaded';
        }
        if (elements.statusDesc) {
            elements.statusDesc.innerHTML = 'No NABL logo found. Upload below or via <a href="/admin/admin.html?page=Update_profile" style="color:#2563eb;font-weight:600;">Update Profile</a>.';
        }
        if (elements.thumbnailImg) {
            elements.thumbnailImg.style.display = 'none';
        }
        if (elements.proxyImg) {
            elements.proxyImg.style.display = 'none';
        }
    }

    /**
     * Sync values from internal `state` to HTML form inputs & sliders
     */
    function updateFormInputsFromState() {
        if (elements.sliderX) elements.sliderX.value = state.nablLogoX;
        if (elements.inputX) elements.inputX.value = state.nablLogoX;
        if (elements.badgeX) elements.badgeX.textContent = `${state.nablLogoX} mm`;

        if (elements.sliderY) elements.sliderY.value = state.nablLogoY;
        if (elements.inputY) elements.inputY.value = state.nablLogoY;
        if (elements.badgeY) elements.badgeY.textContent = `${state.nablLogoY} mm`;

        if (elements.sliderWidth) elements.sliderWidth.value = state.nablLogoWidth;
        if (elements.inputWidth) elements.inputWidth.value = state.nablLogoWidth;
        if (elements.badgeWidth) elements.badgeWidth.textContent = `${state.nablLogoWidth} mm`;

        if (elements.sliderHeight) elements.sliderHeight.value = state.nablLogoHeight;
        if (elements.inputHeight) elements.inputHeight.value = state.nablLogoHeight;
        if (elements.badgeHeight) elements.badgeHeight.textContent = `${state.nablLogoHeight} mm`;

        if (elements.visibilityCheckbox) elements.visibilityCheckbox.checked = state.nablLogoVisible;
        if (elements.lockAspectCheckbox) elements.lockAspectCheckbox.checked = state.lockAspectRatio;

        if (state.nablLogoPageOption === 'first-page') {
            if (elements.radioFirstPage) elements.radioFirstPage.checked = true;
        } else {
            if (elements.radioAllPages) elements.radioAllPages.checked = true;
        }

        // Highlight active preset button
        highlightActivePreset();
    }

    /**
     * Highlight active preset button if current position matches standard presets
     */
    function highlightActivePreset() {
        const presets = [
            elements.presetTopRight,
            elements.presetTopLeft,
            elements.presetTopCenter,
            elements.presetBottomRight,
            elements.presetBottomLeft
        ];

        presets.forEach((btn) => {
            if (btn) btn.classList.remove('active');
        });

        if (state.nablLogoPosition === 'top-right' && elements.presetTopRight) {
            elements.presetTopRight.classList.add('active');
        } else if (state.nablLogoPosition === 'top-left' && elements.presetTopLeft) {
            elements.presetTopLeft.classList.add('active');
        } else if (state.nablLogoPosition === 'top-center' && elements.presetTopCenter) {
            elements.presetTopCenter.classList.add('active');
        } else if (state.nablLogoPosition === 'bottom-right' && elements.presetBottomRight) {
            elements.presetBottomRight.classList.add('active');
        } else if (state.nablLogoPosition === 'bottom-left' && elements.presetBottomLeft) {
            elements.presetBottomLeft.classList.add('active');
        }
    }

    /**
     * Apply preset coordinates
     */
    function applyPreset(presetName) {
        const margin = 8;
        const w = state.nablLogoWidth;
        const h = state.nablLogoHeight;

        switch (presetName) {
            case 'top-left':
                state.nablLogoX = margin;
                state.nablLogoY = margin;
                break;
            case 'top-center':
                state.nablLogoX = Math.round(((A4_WIDTH_MM - w) / 2) * 10) / 10;
                state.nablLogoY = margin;
                break;
            case 'bottom-left':
                state.nablLogoX = margin;
                state.nablLogoY = Math.max(0, A4_HEIGHT_MM - h - margin);
                break;
            case 'bottom-right':
                state.nablLogoX = Math.max(0, A4_WIDTH_MM - w - margin);
                state.nablLogoY = Math.max(0, A4_HEIGHT_MM - h - margin);
                break;
            case 'top-right':
            default:
                state.nablLogoX = Math.max(0, A4_WIDTH_MM - w - margin);
                state.nablLogoY = margin;
                presetName = 'top-right';
                break;
        }

        state.nablLogoPosition = presetName;
        updateFormInputsFromState();
        updateDraggableProxyPosition();
    }

    /**
     * ========================================================================
     * EVENT LISTENERS BINDING
     * ========================================================================
     */
    function bindEventListeners() {
        // --- 1. Toggle Accordion & Activate Visual Overlay ---
        if (elements.accordionHeader) {
            elements.accordionHeader.addEventListener('click', function () {
                const isOpen = elements.accordionContent && elements.accordionContent.classList.contains('show');
                if (elements.overlay) {
                    if (isOpen) {
                        elements.overlay.classList.add('active');
                        updateDraggableProxyPosition();
                    } else {
                        elements.overlay.classList.remove('active');
                    }
                }
            });
        }

        // --- 2. Presets Click Handlers ---
        if (elements.presetTopRight) elements.presetTopRight.addEventListener('click', () => applyPreset('top-right'));
        if (elements.presetTopLeft) elements.presetTopLeft.addEventListener('click', () => applyPreset('top-left'));
        if (elements.presetTopCenter) elements.presetTopCenter.addEventListener('click', () => applyPreset('top-center'));
        if (elements.presetBottomRight) elements.presetBottomRight.addEventListener('click', () => applyPreset('bottom-right'));
        if (elements.presetBottomLeft) elements.presetBottomLeft.addEventListener('click', () => applyPreset('bottom-left'));

        // --- 3. X Coordinate Slider & Input ---
        if (elements.sliderX) {
            elements.sliderX.addEventListener('input', function () {
                state.nablLogoX = Number(this.value);
                state.nablLogoPosition = 'custom';
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }
        if (elements.inputX) {
            elements.inputX.addEventListener('change', function () {
                let val = Number(this.value);
                val = Math.max(0, Math.min(A4_WIDTH_MM - state.nablLogoWidth, Number.isFinite(val) ? val : 0));
                state.nablLogoX = val;
                state.nablLogoPosition = 'custom';
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }

        // --- 4. Y Coordinate Slider & Input ---
        if (elements.sliderY) {
            elements.sliderY.addEventListener('input', function () {
                state.nablLogoY = Number(this.value);
                state.nablLogoPosition = 'custom';
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }
        if (elements.inputY) {
            elements.inputY.addEventListener('change', function () {
                let val = Number(this.value);
                val = Math.max(0, Math.min(A4_HEIGHT_MM - state.nablLogoHeight, Number.isFinite(val) ? val : 0));
                state.nablLogoY = val;
                state.nablLogoPosition = 'custom';
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }

        // --- 5. Width Slider & Input ---
        if (elements.sliderWidth) {
            elements.sliderWidth.addEventListener('input', function () {
                state.nablLogoWidth = Number(this.value);
                if (state.lockAspectRatio && state.aspectRatio > 0) {
                    state.nablLogoHeight = Math.round((state.nablLogoWidth / state.aspectRatio) * 10) / 10;
                }
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }
        if (elements.inputWidth) {
            elements.inputWidth.addEventListener('change', function () {
                let val = Number(this.value);
                val = Math.max(10, Math.min(80, Number.isFinite(val) ? val : 30));
                state.nablLogoWidth = val;
                if (state.lockAspectRatio && state.aspectRatio > 0) {
                    state.nablLogoHeight = Math.round((state.nablLogoWidth / state.aspectRatio) * 10) / 10;
                }
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }

        // --- 6. Height Slider & Input ---
        if (elements.sliderHeight) {
            elements.sliderHeight.addEventListener('input', function () {
                state.nablLogoHeight = Number(this.value);
                if (state.lockAspectRatio && state.aspectRatio > 0) {
                    state.nablLogoWidth = Math.round((state.nablLogoHeight * state.aspectRatio) * 10) / 10;
                }
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }
        if (elements.inputHeight) {
            elements.inputHeight.addEventListener('change', function () {
                let val = Number(this.value);
                val = Math.max(6, Math.min(60, Number.isFinite(val) ? val : 18));
                state.nablLogoHeight = val;
                if (state.lockAspectRatio && state.aspectRatio > 0) {
                    state.nablLogoWidth = Math.round((state.nablLogoHeight * state.aspectRatio) * 10) / 10;
                }
                updateFormInputsFromState();
                updateDraggableProxyPosition();
            });
        }

        // --- 7. Aspect Ratio & Visibility ---
        if (elements.lockAspectCheckbox) {
            elements.lockAspectCheckbox.addEventListener('change', function () {
                state.lockAspectRatio = this.checked;
                if (state.lockAspectRatio && state.nablLogoHeight > 0) {
                    state.aspectRatio = state.nablLogoWidth / state.nablLogoHeight;
                }
            });
        }
        if (elements.visibilityCheckbox) {
            elements.visibilityCheckbox.addEventListener('change', function () {
                state.nablLogoVisible = this.checked;
                if (elements.draggableProxy) {
                    elements.draggableProxy.style.opacity = state.nablLogoVisible ? '1' : '0.35';
                }
            });
        }

        // --- 8. Page Options ---
        if (elements.radioAllPages) {
            elements.radioAllPages.addEventListener('change', function () {
                if (this.checked) state.nablLogoPageOption = 'all-pages';
            });
        }
        if (elements.radioFirstPage) {
            elements.radioFirstPage.addEventListener('change', function () {
                if (this.checked) state.nablLogoPageOption = 'first-page';
            });
        }

        // --- 9. Direct NABL Logo Upload ---
        if (elements.uploadInput) {
            elements.uploadInput.addEventListener('change', async function () {
                if (!this.files || !this.files[0]) return;
                const file = this.files[0];

                const formData = new FormData();
                formData.append('nablLogo', file);

                showToast('Uploading NABL logo...', 'info');

                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/upload-nabl-logo`, {
                        method: 'POST',
                        body: formData
                    });

                    const resData = await response.json();
                    if (!response.ok || !resData.success) {
                        throw new Error(resData.message || 'Upload failed');
                    }

                    setNablLogoUrl(resData.nablLogoUrl);
                    showToast('NABL logo uploaded successfully!', 'success');

                    // Refresh PDF preview if available
                    refreshPreviewIfPossible();
                } catch (err) {
                    console.error('[nablLogoSettings] Upload error:', err);
                    showToast(err.message || 'Error uploading NABL logo.', 'error');
                }
            });
        }

        // --- 10. Save & Reset Buttons ---
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveNablSettings);
        }
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', function () {
                state.nablLogoWidth = 30;
                state.nablLogoHeight = 18;
                state.nablLogoX = 170;
                state.nablLogoY = 5;
                state.nablLogoPosition = 'top-right';
                state.nablLogoPageOption = 'all-pages';
                state.nablLogoVisible = true;
                updateFormInputsFromState();
                updateDraggableProxyPosition();
                showToast('Reset to standard top-right position.', 'info');
            });
        }

        // Window resize event to recalculate proxy pixel scale
        window.addEventListener('resize', updateDraggableProxyPosition);
    }

    /**
     * ========================================================================
     * SAVE SETTINGS & REFRESH PREVIEW
     * ========================================================================
     */
    async function saveNablSettings() {
        if (elements.saveBtn) {
            elements.saveBtn.disabled = true;
            elements.saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const payload = {
                nablLogoWidth: state.nablLogoWidth,
                nablLogoHeight: state.nablLogoHeight,
                nablLogoX: state.nablLogoX,
                nablLogoY: state.nablLogoY,
                nablLogoPosition: state.nablLogoPosition,
                nablLogoPageOption: state.nablLogoPageOption,
                nablLogoVisible: state.nablLogoVisible
            };

            const response = await fetch(`${BASE_URL}/api/v1/user/save-nabl-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to save settings.');
            }

            showToast('NABL logo settings saved successfully!', 'success');

            // Trigger preview refresh so user sees updated PDF
            refreshPreviewIfPossible();
        } catch (err) {
            console.error('[nablLogoSettings] Save error:', err);
            showToast(err.message || 'Failed to save NABL settings.', 'error');
        } finally {
            if (elements.saveBtn) {
                elements.saveBtn.disabled = false;
                elements.saveBtn.innerHTML = '<i class="fas fa-save"></i> Save NABL Settings';
            }
        }
    }

    /**
     * Trigger autogeneratingpdf from main page if available
     */
    function refreshPreviewIfPossible() {
        // Trigger autogeneratingpdf with custom coordinates if defined
        if (typeof window.autogeneratingpdf === 'function') {
            window.autogeneratingpdf({
                nablLogoWidth: state.nablLogoWidth,
                nablLogoHeight: state.nablLogoHeight,
                nablLogoX: state.nablLogoX,
                nablLogoY: state.nablLogoY,
                nablLogoPosition: state.nablLogoPosition,
                nablLogoPageOption: state.nablLogoPageOption,
                nablLogoVisible: state.nablLogoVisible
            });
        }
    }

    /**
     * Display a clean toast message inside the NABL settings card
     */
    function showToast(msg, type = 'info') {
        const toast = elements.toastMsg;
        if (!toast) return;

        toast.className = `nabl-toast-msg ${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}`;
        toast.textContent = msg;
        toast.style.display = 'block';

        if (type !== 'info') {
            setTimeout(() => {
                toast.style.display = 'none';
            }, 4500);
        }
    }

    // Expose manager globally for seamless integration
    window.NablLogoSettingsManager = {
        init,
        getState: () => ({ ...state }),
        save: saveNablSettings,
        setNablLogoUrl,
        updateProxy: updateDraggableProxyPosition
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

