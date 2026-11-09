(function () {
    const BASE_URL = window.BASE_URL || window.location.origin;

    let categoryList = [];
    let sampleList = [];
    let editorInstance = null;
    let isSubmitting = false;

    // DOM Elements
    const nameInput = document.getElementById("atdName");
    const shortNameInput = document.getElementById("atdShortName");
    const categorySelect = document.getElementById("atdCategory");
    const sampleSelect = document.getElementById("atdSampleType");
    const priceInput = document.getElementById("atdPrice");
    const finalPriceInput = document.getElementById("atdFinalPrice");
    const tatInput = document.getElementById("atdTat");
    const methodInput = document.getElementById("atdMethod");
    const fallbackEditor = document.getElementById("fallbackInterpretation");

    const btnSaveTop = document.getElementById("btnSaveDocumentTest");
    const btnSaveBottom = document.getElementById("btnSaveDocumentTestBottom");
    const btnClearEditor = document.getElementById("btnClearEditor");

    // Modal elements
    const modalAddCategory = document.getElementById("modalAddCategory");
    const btnOpenAddCategory = document.getElementById("btnOpenAddCategory");
    const btnCloseCatModal = document.getElementById("btnCloseCatModal");
    const btnCancelCatModal = document.getElementById("btnCancelCatModal");
    const btnSaveNewCat = document.getElementById("btnSaveNewCat");
    const newCatInput = document.getElementById("newCatInput");

    const modalAddSample = document.getElementById("modalAddSample");
    const btnOpenAddSample = document.getElementById("btnOpenAddSample");
    const btnCloseSampleModal = document.getElementById("btnCloseSampleModal");
    const btnCancelSampleModal = document.getElementById("btnCancelSampleModal");
    const btnSaveNewSample = document.getElementById("btnSaveNewSample");
    const newSampleInput = document.getElementById("newSampleInput");

    // Preset Clinical Templates
    const CLINICAL_PRESETS = {
        cxr: `<h3>CHEST X-RAY (PA VIEW)</h3>
<p><strong>Clinical Indication:</strong> Routine pre-employment / medical evaluation.</p>
<p><strong>Technique:</strong> Digital plain radiography of the chest in postero-anterior view.</p>
<h4>FINDINGS:</h4>
<ul>
    <li>Trachea is central in position.</li>
    <li>Cardiac size, shape and contour are within normal limits (Cardiothoracic ratio &lt; 50%).</li>
    <li>Both lung fields are clear. No evidence of active consolidation, cavitation, or pleural effusion.</li>
    <li>Both costophrenic angles and cardiophrenic angles are sharp and clear.</li>
    <li>Bony thoracic cage and visualised soft tissues are unremarkable.</li>
    <li>Both hemidiaphragms are smooth in contour and normal in position.</li>
</ul>
<h4>IMPRESSION:</h4>
<p><strong>NORMAL CHEST RADIOGRAPH (NO ACTIVE CARDIOPULMONARY LESION DETECTED).</strong></p>`,

        usg: `<h3>ULTRASOUND WHOLE ABDOMEN &amp; PELVIS</h3>
<p><strong>Clinical Indication:</strong> Abdominal evaluation / Routine health screen.</p>
<h4>FINDINGS:</h4>
<ul>
    <li><strong>LIVER:</strong> Normal in size (14.2 cm), contour and echotexture. No focal lesion or intrahepatic biliary radicle dilatation.</li>
    <li><strong>GALL BLADDER:</strong> Well distended with normal wall thickness. No calculus, sludge, or mass lesion seen.</li>
    <li><strong>PANCREAS:</strong> Normal in size and echotexture. Main pancreatic duct is not dilated.</li>
    <li><strong>SPLEEN:</strong> Normal in size (9.8 cm) with homogenous echotexture. No focal lesion or splenomegaly.</li>
    <li><strong>KIDNEYS:</strong> Both kidneys are normal in size, shape, position and echogenicity. Normal corticomedullary differentiation. No calculus, hydronephrosis, or mass.</li>
    <li><strong>URINARY BLADDER:</strong> Adequately distended with normal wall thickness. No calculus or intraluminal lesion.</li>
    <li><strong>RETROPERITONEUM:</strong> No significant lymphadenopathy or free fluid / ascites detected.</li>
</ul>
<h4>IMPRESSION:</h4>
<p><strong>NORMAL ULTRASOUND STUDY OF THE ABDOMEN AND PELVIS.</strong></p>`,

        mri: `<h3>MRI BRAIN (PLAIN STUDY)</h3>
<p><strong>Technique:</strong> Multi-planar, multi-echo MRI of the brain was performed without intravenous contrast.</p>
<h4>FINDINGS:</h4>
<ul>
    <li>Cerebral hemispheres show normal signal intensity and morphology. No acute infarct, hemorrhage, or mass effect.</li>
    <li>Ventricular system, basal cisterns and sulci are normal for patient's age.</li>
    <li>Cerebellum and brainstem demonstrate normal signal characteristics.</li>
    <li>Major intracranial arterial flow voids are preserved.</li>
    <li>Calvarium and visualised paranasal sinuses are unremarkable.</li>
</ul>
<h4>IMPRESSION:</h4>
<p><strong>UNREMARKABLE MRI BRAIN STUDY (NO ACUTE INTRACRANIAL ABNORMALITY).</strong></p>`,

        culture: `<h3>AEROBIC BACTERIAL CULTURE &amp; SENSITIVITY REPORT</h3>
<p><strong>Specimen:</strong> Urine / Blood / Swab</p>
<p><strong>Incubation:</strong> 48 Hours at 37&deg;C aerobic atmosphere</p>
<h4>MICROSCOPIC EXAMINATION:</h4>
<ul>
    <li><strong>Gram Stain:</strong> No organisms seen. Occasional epithelial cells. Pus cells: &lt; 5 / HPF.</li>
</ul>
<h4>CULTURE RESULT:</h4>
<p><strong>NO SIGNIFICANT BACTERIAL GROWTH AFTER 48 HOURS OF AEROBIC INCUBATION AT 37&deg;C.</strong></p>
<p><em>(Sterile culture - Colony count &lt; 10^3 CFU/ml)</em></p>`,

        clinical: `<h3>CLINICAL INVESTIGATION REPORT</h3>
<p><strong>Clinical Indication &amp; History:</strong> </p>
<p><strong>Modality &amp; Technique:</strong> </p>
<h4>OBSERVATIONS / FINDINGS:</h4>
<ul>
    <li>Primary finding: </li>
    <li>Secondary observation: </li>
</ul>
<h4>IMPRESSION / CONCLUSION:</h4>
<p><strong>Summary: </strong></p>`
    };

    // Initialize Page
    initPage();

    async function initPage() {
        bindEvents();
        await initRichEditor();
        await Promise.all([fetchCategories(), fetchSampleTypes()]);
    }

    function bindEvents() {
        if (btnSaveTop) btnSaveTop.addEventListener("click", handleSave);
        if (btnSaveBottom) btnSaveBottom.addEventListener("click", handleSave);

        // Preset template buttons
        document.querySelectorAll("[data-preset]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const key = btn.getAttribute("data-preset");
                const html = CLINICAL_PRESETS[key];
                if (html) {
                    setEditorContent(html);
                    showToast(`Loaded ${btn.textContent.trim()} template`, "info");
                }
            });
        });

        if (btnClearEditor) {
            btnClearEditor.addEventListener("click", () => {
                setEditorContent("");
                showToast("Editor content cleared", "info");
            });
        }

        // Category modal events
        if (btnOpenAddCategory) {
            btnOpenAddCategory.addEventListener("click", () => {
                if (newCatInput) newCatInput.value = "";
                if (modalAddCategory) modalAddCategory.classList.add("active");
                setTimeout(() => newCatInput?.focus(), 100);
            });
        }
        if (btnCloseCatModal) btnCloseCatModal.addEventListener("click", closeCatModal);
        if (btnCancelCatModal) btnCancelCatModal.addEventListener("click", closeCatModal);
        if (btnSaveNewCat) btnSaveNewCat.addEventListener("click", handleCreateCategory);

        // Sample modal events
        if (btnOpenAddSample) {
            btnOpenAddSample.addEventListener("click", () => {
                if (newSampleInput) newSampleInput.value = "";
                if (modalAddSample) modalAddSample.classList.add("active");
                setTimeout(() => newSampleInput?.focus(), 100);
            });
        }
        if (btnCloseSampleModal) btnCloseSampleModal.addEventListener("click", closeSampleModal);
        if (btnCancelSampleModal) btnCancelSampleModal.addEventListener("click", closeSampleModal);
        if (btnSaveNewSample) btnSaveNewSample.addEventListener("click", handleCreateSample);

        // Auto calculate MRP if blank
        if (priceInput && finalPriceInput) {
            priceInput.addEventListener("blur", () => {
                if (priceInput.value && !finalPriceInput.value) {
                    finalPriceInput.value = priceInput.value;
                }
            });
        }
    }

    function closeCatModal() {
        if (modalAddCategory) modalAddCategory.classList.remove("active");
    }

    function closeSampleModal() {
        if (modalAddSample) modalAddSample.classList.remove("active");
    }

    // Initialize CKEditor safely
    async function initRichEditor() {
        const editorEl = document.querySelector("#editor");
        const toolbarEl = document.querySelector("#editor-toolbar");
        const wordCountEl = document.querySelector("#editor-word-count");

        if (!editorEl || !toolbarEl) return;

        // Check if CKEDITOR is loaded in the window
        if (window.CKEDITOR && window.CKEDITOR.DecoupledEditor) {
            try {
                const { DecoupledEditor } = window.CKEDITOR;
                const editor = await DecoupledEditor.create(editorEl, {
                    toolbar: {
                        items: [
                            'undo', 'redo', '|',
                            'heading', '|',
                            'fontSize', 'fontColor', 'fontBackgroundColor', '|',
                            'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', '|',
                            'alignment', '|',
                            'bulletedList', 'numberedList', 'outdent', 'indent', '|',
                            'insertTable', '|',
                            'removeFormat'
                        ],
                        shouldNotGroupWhenFull: true
                    }
                });

                toolbarEl.innerHTML = "";
                toolbarEl.appendChild(editor.ui.view.toolbar.element);

                if (wordCountEl) {
                    try {
                        const wordCount = editor.plugins.get("WordCount");
                        if (wordCount && wordCount.wordCountContainer) {
                            wordCountEl.innerHTML = "";
                            wordCountEl.appendChild(wordCount.wordCountContainer);
                        }
                    } catch (e) {}
                }

                editorInstance = editor;
                window.editor = editor;
                return;
            } catch (err) {
                console.warn("Could not init DecoupledEditor:", err);
            }
        }

        // If global editorInit exists
        if (typeof window.editorInit === "function") {
            try {
                window.editorInit();
                editorInstance = window.editor;
                return;
            } catch (e) {
                console.warn("editorInit fallback failed:", e);
            }
        }

        // Fallback: If CKEditor unavailable, gracefully show textarea
        if (fallbackEditor) {
            fallbackEditor.style.display = "block";
            editorEl.style.display = "none";
            toolbarEl.style.display = "none";
            if (wordCountEl) wordCountEl.style.display = "none";
        }
    }

    function getEditorContent() {
        if (editorInstance && typeof editorInstance.getData === "function") {
            return editorInstance.getData();
        }
        if (window.editor && typeof window.editor.getData === "function") {
            return window.editor.getData();
        }
        if (fallbackEditor && fallbackEditor.value) {
            return fallbackEditor.value;
        }
        const editorDiv = document.querySelector("#editor");
        return editorDiv ? editorDiv.innerHTML : "";
    }

    function setEditorContent(html) {
        if (editorInstance && typeof editorInstance.setData === "function") {
            editorInstance.setData(html);
        } else if (window.editor && typeof window.editor.setData === "function") {
            window.editor.setData(html);
        } else if (fallbackEditor) {
            fallbackEditor.value = html;
        } else {
            const editorDiv = document.querySelector("#editor");
            if (editorDiv) editorDiv.innerHTML = html;
        }
    }

    // Categories
    async function fetchCategories() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/category-list-tenant`);
            if (!res.ok) throw new Error("Failed to load categories");
            const json = await res.json();
            categoryList = json.categories || json.data || [];

            renderCategoryOptions();
        } catch (err) {
            console.error("Error fetching categories:", err);
            categorySelect.innerHTML = '<option value="">All Categories</option>';
        }
    }

    function renderCategoryOptions(selectedVal) {
        if (!categorySelect) return;
        categorySelect.innerHTML = '<option value="" disabled selected>Select Category</option>';

        categoryList.forEach((cat) => {
            const name = cat.category || cat;
            if (typeof name === "string" && name.trim()) {
                const opt = document.createElement("option");
                opt.value = name.trim();
                opt.textContent = name.trim();
                if (selectedVal && selectedVal.toLowerCase() === name.trim().toLowerCase()) {
                    opt.selected = true;
                }
                categorySelect.appendChild(opt);
            }
        });
    }

    async function handleCreateCategory() {
        const val = (newCatInput?.value || "").trim();
        if (!val) {
            showToast("Please enter a category name", "error");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/add-category-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: val })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create category");

            categoryList.push({ category: val });
            renderCategoryOptions(val);
            closeCatModal();
            showToast(`Category "${val}" added successfully`, "success");
        } catch (e) {
            showToast(e.message || "Could not add category", "error");
        }
    }

    // Specimen / Modality Types
    async function fetchSampleTypes() {
        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/fetchsample-tenant`);
            if (!res.ok) throw new Error("Failed to load specimen types");
            const json = await res.json();
            sampleList = json.data || json.sampleTypes || [];

            // Add standard clinical modality defaults if empty
            const defaults = ["ULTRASOUND", "X-RAY", "MRI", "CT-SCAN", "BIOPSY", "HISTOPATHOLOGY", "SERUM", "EDTA BLOOD", "URINE", "STOOL", "SWAB", "FLUID"];
            defaults.forEach((def) => {
                if (!sampleList.some(s => (s.Name || s) === def)) {
                    sampleList.push({ Name: def });
                }
            });

            renderSampleOptions();
        } catch (err) {
            console.error("Error fetching sample types:", err);
            renderSampleOptions();
        }
    }

    function renderSampleOptions(selectedVal) {
        if (!sampleSelect) return;
        sampleSelect.innerHTML = '<option value="" disabled selected>Select Modality / Specimen</option>';

        sampleList.forEach((st) => {
            const name = st.Name || st.sampleType || st;
            if (typeof name === "string" && name.trim()) {
                const opt = document.createElement("option");
                opt.value = name.trim();
                opt.textContent = name.trim();
                if (selectedVal && selectedVal.toLowerCase() === name.trim().toLowerCase()) {
                    opt.selected = true;
                }
                sampleSelect.appendChild(opt);
            }
        });
    }

    async function handleCreateSample() {
        const val = (newSampleInput?.value || "").trim().toUpperCase();
        if (!val) {
            showToast("Please enter a specimen / modality name", "error");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/add-sample-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sample: val })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create specimen");

            sampleList.push({ Name: val });
            renderSampleOptions(val);
            closeSampleModal();
            showToast(`Specimen "${val}" added successfully`, "success");
        } catch (e) {
            showToast(e.message || "Could not add specimen", "error");
        }
    }

    // Save Documented Test
    async function handleSave() {
        if (isSubmitting) return;

        // Reset errors
        document.querySelectorAll(".atd-input-error").forEach((el) => el.classList.remove("atd-input-error"));
        document.querySelectorAll(".atd-error-text").forEach((el) => el.style.display = "none");

        const nameVal = (nameInput?.value || "").trim();
        const shortVal = (shortNameInput?.value || "").trim();
        const categoryVal = categorySelect?.value || "";
        const sampleVal = sampleSelect?.value || "";
        const billingVal = parseFloat(priceInput?.value);
        const mrpVal = parseFloat(finalPriceInput?.value);
        const tatVal = (tatInput?.value || "").trim();
        const methodVal = (methodInput?.value || "").trim();
        const interpretationVal = getEditorContent();

        let hasError = false;

        if (!nameVal) {
            showFieldError(nameInput, "errName");
            hasError = true;
        }

        if (!categoryVal) {
            showFieldError(categorySelect, "errCategory");
            hasError = true;
        }

        if (!sampleVal) {
            showFieldError(sampleSelect, "errSampleType");
            hasError = true;
        }

        if (isNaN(billingVal) || billingVal < 0) {
            showFieldError(priceInput, "errPrice");
            hasError = true;
        }

        if (isNaN(mrpVal) || mrpVal < 0) {
            showFieldError(finalPriceInput, "errFinalPrice");
            hasError = true;
        }

        if (hasError) {
            showToast("Please complete all required fields highlighted in red", "error");
            return;
        }

        isSubmitting = true;
        toggleSaveButtons(true);
        showToast("Saving document test...", "info");

        const categoryObj = categoryList.find(c => (c.category || c) === categoryVal) || { category: categoryVal };

        const payload = {
            Name: nameVal,
            Short_name: shortVal,
            category: categoryObj,
            Price: billingVal,
            final_price: mrpVal,
            sampleType: sampleVal,
            tat: tatVal,
            method: methodVal,
            interpretation: interpretationVal,
            isDocumentedTest: true,
            parameters: []
        };

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/make-test-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create document test");

            showToast(`✓ Documented Test "${nameVal}" created successfully!`, "success");

            // Smooth redirect back to test database
            setTimeout(() => {
                if (typeof window.loadPage === "function") {
                    window.loadPage("test");
                } else {
                    window.location.href = "?page=test";
                }
            }, 1200);

        } catch (error) {
            console.error("Error creating document test:", error);
            showToast(error.message || "Could not save document test. Please try again.", "error");
            isSubmitting = false;
            toggleSaveButtons(false);
        }
    }

    function showFieldError(inputEl, errorId) {
        if (inputEl) inputEl.classList.add("atd-input-error");
        const errText = document.getElementById(errorId);
        if (errText) errText.style.display = "block";
    }

    function toggleSaveButtons(disabled) {
        if (btnSaveTop) {
            btnSaveTop.disabled = disabled;
            btnSaveTop.innerHTML = disabled
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'
                : '<i class="fa-solid fa-cloud-arrow-up"></i> Save Document Test';
        }
        if (btnSaveBottom) {
            btnSaveBottom.disabled = disabled;
            btnSaveBottom.innerHTML = disabled
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'
                : '<i class="fa-solid fa-cloud-arrow-up"></i> Save Document Test';
        }
    }

    // Toast helper
    function showToast(message, type = "success") {
        const toast = document.getElementById("atdToast");
        const toastMsg = document.getElementById("atdToastMsg");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.className = `atd-toast ${type} show`;

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
})();
