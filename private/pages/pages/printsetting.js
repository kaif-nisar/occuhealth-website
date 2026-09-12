const BASE_URL = window.location.origin;

function toggleAccordion(button) {
    const content = button.nextElementSibling;
    const icon = button.querySelector('.icon');
    if (content) {
        content.classList.toggle('show');
    }
    if (button) {
        button.classList.toggle('active');
    }
}

(async function () {
    const pageloader = document.querySelector(".printspinnerbox");
    const value1 = localStorage.getItem('myKey');
    const layoutFieldIds = ['header', 'footer', 'margin-right', 'margin-left'];

    const readLayoutSettings = () => {
        const values = {
            headermargin: Number(document.getElementById('header').value),
            footermargin: Number(document.getElementById('footer').value),
            marginRight: Number(document.getElementById('margin-right').value),
            marginLeft: Number(document.getElementById('margin-left').value)
        };
        const limits = { headermargin: [0, 10], footermargin: [0, 6], marginRight: [0, 4], marginLeft: [0, 4] };
        for (const [name, value] of Object.entries(values)) {
            const [min, max] = limits[name];
            if (!Number.isFinite(value) || value < min || value > max) {
                throw new Error('Please enter a ' + min + '-' + max + ' cm value for ' + name + '.');
            }
        }
        return values;
    };

    const readGeneralSettings = () => ({
        selectedFontSize: Number(document.getElementById('pdf-font-size').value),
        RowSpacing: Number(document.getElementById('spacing').value),
        HighLow: document.getElementById('high-low-marker').checked,
        HLinred: document.getElementById('abnormal-results-red').checked,
        BoldRow: document.getElementById('abnormal-results-bold').checked,
        showInvest: document.getElementById('show-investigations').checked
    });

    async function savePrintSettings(layout = readLayoutSettings()) {
        const response = await fetch(BASE_URL + '/api/v1/user/save-pdf-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...readGeneralSettings(), ...layout })
        });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || 'Could not save print settings');
        }
        return response.json();
    }

    function refreshLayoutGuide() {
        let layout;
        try {
            layout = readLayoutSettings();
        } catch (_) {
            const headerVal = Number(document.getElementById('header')?.value) || 0;
            const footerVal = Number(document.getElementById('footer')?.value) || 0;
            layout = { headermargin: headerVal, footermargin: footerVal };
        }

        const headerSpan = document.getElementById('headermargininfospan');
        const footerSpan = document.getElementById('footermargininfospan');
        const headerScale = document.getElementById('headermeasurescale');
        const footerScale = document.getElementById('footermeasurescale');
        const mainContentSpan = document.getElementById('maincontentinfospan');
        const middleScale = document.getElementById('middlemeasurescale');

        if (headerSpan) headerSpan.textContent = `${layout.headermargin} cm`;
        if (footerSpan) footerSpan.textContent = `${layout.footermargin} cm`;

        // Header margin is a shared vertical offset: it moves the header and
        // main content together, while this fixed gap remains unchanged.
        const TOTAL_A4_CM = 18.0;
        const HEADER_CONTENT_CM = 3.2;
        const FOOTER_CONTENT_CM = 1.8;
        const HEADER_TO_MAIN_GAP_CM = 1;
        const headerTotalCm = layout.headermargin + HEADER_CONTENT_CM;
        const footerTotalCm = layout.footermargin + FOOTER_CONTENT_CM;
        const mainContentCm = Math.max(0, TOTAL_A4_CM - (headerTotalCm + HEADER_TO_MAIN_GAP_CM + footerTotalCm));

        if (headerScale) headerScale.textContent = `${headerTotalCm.toFixed(1)} cm`;
        if (footerScale) footerScale.textContent = `${footerTotalCm.toFixed(1)} cm`;
        if (mainContentSpan) mainContentSpan.textContent = `${mainContentCm.toFixed(1)} cm`;
        if (middleScale) middleScale.textContent = `${mainContentCm.toFixed(1)} cm`;

        const occupiedCm = headerTotalCm + HEADER_TO_MAIN_GAP_CM + mainContentCm + footerTotalCm;
        const scaleCm = Math.max(TOTAL_A4_CM, occupiedCm);
        const headerPct = (headerTotalCm / scaleCm) * 100;
        const headerToMainGapPct = (HEADER_TO_MAIN_GAP_CM / scaleCm) * 100;
        const middlePct = (mainContentCm / scaleCm) * 100;
        const footerPct = (footerTotalCm / scaleCm) * 100;
        const mainTopPct = headerPct + headerToMainGapPct;
        const footerTopPct = mainTopPct + middlePct;

        const headBox = document.getElementById('headermeasurescalebigbox');
        const midBox = document.getElementById('middlemeasurescalebigbox');
        const footBox = document.getElementById('footermeasurescalebigbox');

        const headInfo = document.getElementById('headerinformationdiv');
        const midInfo = document.getElementById('middleinformationdiv');
        const footInfo = document.getElementById('footerinformationdiv');

        if (headBox && midBox && footBox) {
            headBox.style.top = `0%`;
            headBox.style.height = `${headerPct}%`;

            midBox.style.top = `${mainTopPct}%`;
            midBox.style.height = `${middlePct}%`;

            footBox.style.top = `${footerTopPct}%`;
            footBox.style.height = `${footerPct}%`;
        }

        if (headInfo && midInfo && footInfo) {
            headInfo.style.top = `0%`;
            headInfo.style.height = `${headerPct}%`;

            midInfo.style.top = `${mainTopPct}%`;
            midInfo.style.height = `${middlePct}%`;

            footInfo.style.top = `${footerTopPct}%`;
            footInfo.style.height = `${footerPct}%`;
        }
    }

    const fetchDataAndSetInputs = async () => {
        if (pageloader) pageloader.style.display = "flex";
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getting-pdf-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: value1 }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch data from API');
            }

            const data = await response.json();

            document.getElementById('header').value = data.headermargin ?? '';
            document.getElementById('footer').value = data.footermargin ?? '';
            document.getElementById('margin-right').value = data.marginRight ?? '';
            document.getElementById('margin-left').value = data.marginLeft ?? '';
            document.getElementById('show-lab').checked = data.labinchargesign || false;
            document.getElementById('pdf-font-size').value = data.selectedFontSize ?? 10;
            document.getElementById('spacing').value = data.RowSpacing ?? 3;
            document.getElementById('high-low-marker').checked = data.HighLow ?? true;
            document.getElementById('abnormal-results-red').checked = data.HLinred ?? false;
            document.getElementById('abnormal-results-bold').checked = data.BoldRow ?? true;
            document.getElementById('show-investigations').checked = data.showInvest ?? true;

            localStorage.setItem("printSettings", JSON.stringify({
                HighLow: data.HighLow,
                HLinred: data.HLinred,
                BoldRow: data.BoldRow,
                showInvest: data.showInvest
            }));

            refreshLayoutGuide();
        } catch (error) {
            console.error('Error fetching data and setting inputs:', error.message);
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
    };

    const fetchLabSignAndSetInputs = async () => {
        if (pageloader) pageloader.style.display = "flex";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);
            if (!response.ok) throw new Error('Failed to fetch data from API');

            const data = await response.json();
            if (data) {
                document.getElementById('lab-info').value = data.labinchargeinfo || '';
                document.getElementById('firstdoctor-info').value = data.firstdoctorsigninfo || '';
                document.getElementById('seconddoctor-info').value = data.seconddoctorsigninfo || '';
                document.getElementById('show-lab').checked = data.showlabinchargesign || false;
                document.getElementById('show-doctor1').checked = data.showfirstdoctorsign || false;
                document.getElementById('show-doctor2').checked = data.showseconddoctorsign || false;

                const labSignImgdiv = document.getElementById('labSignImgdiv');
                labSignImgdiv.innerHTML = '';
                if (data.labinchargesign) {
                    labSignImgdiv.setAttribute("data-id", data._id);
                    labSignImgdiv.innerHTML = `
                    <img src="${data.labinchargesign}" data-srcfeild="labinchargesign" id="labinchargesign" data-publicfeild="labinchargesignpublicid" data-asset="${data.labinchargesignpublicid}" alt="Lab Incharge Sign" height="40" width="80">`;
                }

                const firstSignImgdiv = document.getElementById('firstSignImgdiv');
                firstSignImgdiv.innerHTML = '';
                if (data.firstdoctorsign) {
                    firstSignImgdiv.setAttribute("data-id", data._id);
                    firstSignImgdiv.innerHTML = `
                    <img src="${data.firstdoctorsign}" data-srcfeild="firstdoctorsign" id="firstdoctorsign" data-publicfeild="firstdoctorsignpublicid" data-asset="${data.firstdoctorsignpublicid}" alt="Doctor 1 Sign" height="40" width="80">`;
                }

                const seconddoctorinfo = document.getElementById('secondSignImgdiv');
                seconddoctorinfo.innerHTML = '';
                if (data.seconddoctorsign) {
                    seconddoctorinfo.setAttribute("data-id", data._id);
                    seconddoctorinfo.innerHTML = `
                    <img src="${data.seconddoctorsign}" data-srcfeild="seconddoctorsign" id="seconddoctorsign" data-publicfeild="seconddoctorsignpublicid" data-asset="${data.seconddoctorsignpublicid}" alt="Doctor 2 Sign" height="40" width="80">`;
                }
            }
        } catch (error) {
            console.error('Error fetching sign data:', error.message);
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
    };

    async function selectionimage() {
        const images = document.querySelectorAll('.image');

        images.forEach(image => {
            if (image.parentElement.classList.contains('image-container')) return;

            const container = document.createElement('div');
            container.classList.add('image-container');

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon');
            deleteIcon.innerHTML = '&#x2715;';

            container.appendChild(image.cloneNode(true));
            container.appendChild(deleteIcon);
            image.replaceWith(container);

            deleteIcon.addEventListener('click', async (e) => {
                e.stopPropagation();

                const innerImg = container.querySelector('img');
                const imageUrl = innerImg?.src;
                const public_id = innerImg?.getAttribute('data-asset');

                if (imageUrl) {
                    if (pageloader) pageloader.style.display = "flex";

                    try {
                        const response = await fetch(`${BASE_URL}/api/v1/user/delete-image`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: imageUrl, public_id }),
                        });
                        const result = await response.json();

                        if (response.ok) {
                            container.remove();
                            alert('Template deleted successfully');
                        } else {
                            alert(`Failed to delete image: ${result.message}`);
                        }
                    } catch (error) {
                        console.error('Error deleting image:', error);
                        alert('Error deleting image.');
                    } finally {
                        if (pageloader) pageloader.style.display = "none";
                    }
                }
            });

            container.querySelector('img').addEventListener('click', (e) => {
                document.querySelectorAll('.image.selected').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });
    }

    async function imagedeletion() {
        document.querySelectorAll('.deleteIcon').forEach((icon) => {
            icon.addEventListener('click', async function () {
                const parentDiv = icon.parentElement;
                const imgtag = parentDiv.querySelector('img');
                if (!imgtag) return;
                const urlfield = imgtag.getAttribute('data-srcfeild');
                const publicIdfield = imgtag.getAttribute('data-publicfeild');
                const publicId = imgtag.getAttribute('data-asset');
                if (pageloader) pageloader.style.display = "flex";

                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/deleteLabInchargeSign`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ publicId, urlfield, publicIdfield }),
                    });
                    const result = await response.json();

                    if (response.ok) {
                        await fetchLabSignAndSetInputs();
                        imagedeletion();
                    } else {
                        alert(`Failed to delete signature: ${result.message}`);
                    }
                } catch (error) {
                    console.error('Error deleting signature image:', error);
                    alert('Error deleting signature.');
                } finally {
                    if (pageloader) pageloader.style.display = "none";
                }
            });
        });
    }

    async function fetchTemplateImages() {
        if (pageloader) pageloader.style.display = "flex";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/templates`, { method: "POST" });
            const data = await response.json();

            if (data.urls && Array.isArray(data.urls)) {
                const container = document.getElementById('images-div');
                container.innerHTML = "";
                let order = 1;

                data.urls.forEach((url) => {
                    const img = document.createElement('img');
                    img.src = url.template;
                    img.classList.add('image');
                    img.setAttribute('data-id', order++);
                    img.setAttribute('data-asset', url.public_id);
                    img.alt = 'Template Image';
                    container.appendChild(img);
                });
            }
        } catch (error) {
            console.error('Error fetching template images:', error);
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
    }

    async function autogeneratingpdf({ value1: argVal1, checkBox = false, showlab, showdoctorfirst, showdoctorsecond,
        backgroundImageUrl = null, headermargin, footermargin, marginRight, marginLeft,
        selectedFontSize, RowSpacing, HighLow, HLinred,
        BoldRow, showInvest, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
        fileInputDoctorlefttext, fileInputDoctorrighttext } = {}) {
        const loader = document.querySelector('.loaderDiv');
        const value2 = localStorage.getItem('myKey');

        try {
            if (loader) {
                loader.style.display = 'flex';
                loader.style.zIndex = '9999';
            }
            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value1: value2, checkBox, backgroundImageUrl,
                    headermargin, footermargin, marginRight, marginLeft, selectedFontSize, RowSpacing,
                    HighLow, HLinred, BoldRow, showInvest, showlab, showdoctorfirst, showdoctorsecond,
                    fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext,
                    fileInputDoctorlefttext, fileInputDoctorrighttext
                })
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const iframe = document.getElementById('pdf-preview');
            if (iframe) {
                iframe.src = pdfUrl;
            }
            // Mobile fallback: set href on the open-button so user can tap to view PDF
            const mobilePdfBtn = document.getElementById('mobile-pdf-open-btn');
            if (mobilePdfBtn) {
                mobilePdfBtn.href = pdfUrl;
                mobilePdfBtn.classList.add('pdf-ready');
                mobilePdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Open PDF Preview';
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            if (loader) {
                loader.style.display = 'none';
                loader.style.zIndex = '-1';
            }
        }
    }

    const checkBox = document.getElementById('check1');
    if (checkBox) {
        checkBox.addEventListener('change', function () {
            autogeneratingpdf({ checkBox: checkBox.checked });
        });
    }

    async function Initialization() {
        await fetchDataAndSetInputs();
        await fetchLabSignAndSetInputs();
        await fetchTemplateImages();
        await autogeneratingpdf();
        imagedeletion();
        selectionimage();
    }

    Initialization();

    document.getElementById('uploadTemplate')?.addEventListener('click', async function () {
        const fileInput = document.getElementById('fileInput');
        const messageElement = document.getElementById('message');
        let selectedImage = document.querySelector('.image.selected');
        let imageUrlToSend = null;
        let layout;
        try {
            layout = readLayoutSettings();
            if (pageloader) pageloader.style.display = "flex";
            await savePrintSettings(layout);
            refreshLayoutGuide();
        } catch (error) {
            if (messageElement) messageElement.textContent = error.message;
            return;
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
        const { headermargin, footermargin, marginRight, marginLeft } = layout;

        if (!selectedImage) {
            selectedImage = document.querySelector('.image');
            if (selectedImage) {
                selectedImage.classList.add('selected');
            }
        }

        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];

            if (!file.type.startsWith('image/')) {
                if (messageElement) messageElement.textContent = 'Only image files are allowed.';
                return;
            }

            const formData = new FormData();
            formData.append('template', file);
            if (pageloader) pageloader.style.display = "flex";

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/template`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    fileInput.value = "";
                    const result = await response.json();
                    if (messageElement) messageElement.textContent = 'File uploaded successfully!';
                    imageUrlToSend = result.url;
                    await fetchTemplateImages();
                    await selectionimage();
                    await autogeneratingpdf({ backgroundImageUrl: imageUrlToSend, headermargin, footermargin, marginRight, marginLeft });
                    fetchDataAndSetInputs();
                    return;
                } else {
                    const errorResult = await response.json();
                    if (messageElement) messageElement.textContent = `Error: ${errorResult.message}`;
                    return;
                }
            } catch (error) {
                if (messageElement) messageElement.textContent = 'An error occurred while uploading the file.';
                console.error('Upload error:', error);
                return;
            } finally {
                if (pageloader) pageloader.style.display = "none";
            }
        }

        if (selectedImage) {
            imageUrlToSend = selectedImage.src;
        }

        if (!imageUrlToSend) {
            const firstImage = document.querySelector('.image');
            if (firstImage) {
                imageUrlToSend = firstImage.src;
            }
        }

        if (imageUrlToSend) {
            await autogeneratingpdf({ backgroundImageUrl: imageUrlToSend, headermargin, footermargin, marginRight, marginLeft });
            if (messageElement) messageElement.textContent = 'PDF generated successfully with the selected image!';
            fetchDataAndSetInputs();
        } else {
            await autogeneratingpdf({ headermargin, footermargin, marginRight, marginLeft });
            if (messageElement) messageElement.textContent = 'Layout saved and preview refreshed.';
        }
    });

    document.getElementById('updateSign')?.addEventListener('click', async function () {
        const showlab = document.getElementById('show-lab').checked;
        const showdoctorfirst = document.getElementById('show-doctor1').checked;
        const showdoctorsecond = document.getElementById('show-doctor2').checked;
        const fileInputLab1 = document.getElementById('lab-sign-file');
        const fileInputDoctorleft1 = document.getElementById('doctor-left-file');
        const fileInputDoctorright1 = document.getElementById('Doctor-Right-file');
        const fileInputLabtext = document.getElementById('lab-info').value;
        const fileInputDoctorlefttext = document.getElementById('firstdoctor-info').value;
        const fileInputDoctorrighttext = document.getElementById('seconddoctor-info').value;

        const file1 = fileInputLab1?.files?.[0];
        const file2 = fileInputDoctorleft1?.files?.[0];
        const file3 = fileInputDoctorright1?.files?.[0];

        if ((file1 && !file1.type.startsWith('image/')) ||
            (file2 && !file2.type.startsWith('image/')) ||
            (file3 && !file3.type.startsWith('image/'))) {
            alert("Only image files are allowed");
            return;
        }

        const formData = new FormData();
        if (file1) formData.append('labsign', file1);
        if (file2) formData.append('firstdoctorsign', file2);
        if (file3) formData.append('seconddoctorsign', file3);

        formData.append('labinchargeinfo', fileInputLabtext);
        formData.append('leftdoctorinfo', fileInputDoctorlefttext);
        formData.append('rightdoctorinfo', fileInputDoctorrighttext);
        formData.append('showlab', showlab);
        formData.append('showdoctorfirst', showdoctorfirst);
        formData.append('showdoctorsecond', showdoctorsecond);
        if (pageloader) pageloader.style.display = "flex";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/uploadDoctorsSign`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                await fetchLabSignAndSetInputs();
                await imagedeletion();
                fileInputLab1.value = "";
                fileInputDoctorleft1.value = "";
                fileInputDoctorright1.value = "";

                const fileInputLab = document.getElementById('labinchargesign')?.src || "";
                const fileInputDoctorleft = document.getElementById('firstdoctorsign')?.src || "";
                const fileInputDoctorright = document.getElementById('seconddoctorsign')?.src || "";

                autogeneratingpdf({
                    value1: localStorage.getItem('myKey'),
                    showlab, showdoctorfirst, showdoctorsecond,
                    fileInputLab, fileInputDoctorleft, fileInputDoctorright,
                    fileInputLabtext, fileInputDoctorlefttext, fileInputDoctorrighttext
                });
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error('Upload error:', error.message);
            alert(error.message);
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
    });

    document.getElementById('updateGeneral')?.addEventListener('click', async function () {
        const general = readGeneralSettings();
        const layout = readLayoutSettings();

        if (pageloader) pageloader.style.display = "flex";
        try {
            await savePrintSettings(layout);
            localStorage.setItem("printSettings", JSON.stringify(general));
            await autogeneratingpdf({ ...general, ...layout });
        } catch (error) {
            console.error('Error saving PDF settings:', error);
            alert(error.message);
        } finally {
            if (pageloader) pageloader.style.display = "none";
        }
    });

    function validateField(input, min, max) {
        const value = parseFloat(input.value);
        const errorId = input.id + "-error";
        const errorElement = document.getElementById(errorId);

        if (isNaN(value) || value < min || value > max) {
            if (errorElement) errorElement.textContent = `Value must be between ${min} and ${max} cm.`;
            input.style.borderColor = "#dc2626";
        } else {
            if (errorElement) errorElement.textContent = "";
            input.style.borderColor = "#16a34a";
        }

        updateButtonState();
    }

    function updateButtonState() {
        const fields = ['header', 'footer', 'margin-right', 'margin-left'];
        let isValid = true;

        fields.forEach(fieldId => {
            const errorElement = document.getElementById(fieldId + "-error");
            if (errorElement && errorElement.textContent) {
                isValid = false;
            }
        });

        const updateButton = document.getElementById('uploadTemplate');
        if (updateButton) {
            if (isValid) {
                updateButton.removeAttribute('disabled');
            } else {
                updateButton.setAttribute('disabled', true);
            }
        }
    }

    const layoutValidation = { header: [0, 10], footer: [0, 6], 'margin-right': [0, 4], 'margin-left': [0, 4] };
    layoutFieldIds.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            const [min, max] = layoutValidation[id];
            input.addEventListener('input', () => {
                validateField(input, min, max);
                try { refreshLayoutGuide(); } catch (_) {}
            });
            input.addEventListener('change', () => {
                try { refreshLayoutGuide(); } catch (_) {}
            });
        }
    });

    updateButtonState();

    document.getElementById('close-btn')?.addEventListener('click', function () {
        const bookingId = localStorage.getItem('myKey');
        const format = localStorage.getItem('pdfformat');
        window.location.href = `${BASE_URL}/admin/admin.html?page=${format}&value1=${bookingId}`;
    });

    function verifyinputfeilds() {
        const textareainfo = document.querySelectorAll('.signDiv textarea');
        const errormessage = document.getElementById('errormessage');
        let maxlength = 75;
        textareainfo.forEach((feild) => {
            feild.addEventListener('input', () => {
                if (feild.value.length >= maxlength) {
                    if (errormessage) {
                        errormessage.style.display = "block";
                        errormessage.textContent = "❗ Maximum 75 characters allowed";
                    }
                } else {
                    if (errormessage) {
                        errormessage.style.display = "none";
                        errormessage.textContent = "";
                    }
                }
            });
        });
    }
    verifyinputfeilds();

})();
