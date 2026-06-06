(async function () {
    const urlParams = await new URLSearchParams(window.location.search);
    let value1 = await urlParams.get('value1');
    let report = await fetchreport(value1);
    const backgroundImageUrl = await fetchTemplateImages();
    value1 = report._id;
    const baseUrl = `${BASE_URL}/pages/pages/download_reports.html`;
    localStorage.setItem('myKey', value1);
    localStorage.setItem('pdfformat', user.pdfFormat);

    const urlWithParam = `${baseUrl}?value=${encodeURIComponent(value1)}&id=${encodeURIComponent(user.tenantId._id)}`;
    const { labinchargeinfo, sign } = await fetchLabSignAndSetInputs();
    async function fetchdoctorsandlabsign() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);

            if (!response.ok) {
                console.log("doctor sign is not available");
                return;
            }

            const doctorsdata = await response.json();

            const signoffdiv = document.querySelector('.signed-off-div');
            signoffdiv.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'signed-off-div2';
            div.innerHTML = `            
            <div class="left-sign signdivstyleclass" style="display: ${doctorsdata.showlabinchargesign ? 'block' : 'none'};">
                <img src="${doctorsdata.labinchargesign || ""}" width="90" height="32" /><br>
                <div class="textspan">${doctorsdata.labinchargeinfo}</div>
            </div>
            <div class="left-sign signdivstyleclass" style="display: ${doctorsdata.showfirstdoctorsign ? 'block' : 'none'};">
                <img src="${doctorsdata.firstdoctorsign || ""}" width="90" height="32" /><br>
                <div class="textspan">${doctorsdata.firstdoctorsigninfo}</div>
            </div>
            <div class="sign click qr-div format3qrdiv">
                    <img id="qrimg"
                        src="https://res.cloudinary.com/dmlfjbpb5/image/upload/v1730987604/vximbk8olbhmhmhp5ele.jpg" width="100" height="100">
            </div>
            <div class="right-sign signdivstyleclass" style="display: ${doctorsdata.showseconddoctorsign ? 'block' : 'none'};">
                <img src="${doctorsdata.seconddoctorsign || ""}" width="90" height="32" /><br>
                <div class="textspan">${doctorsdata.seconddoctorsigninfo}</div>
            </div>`;
            signoffdiv.appendChild(div);
            await qrcodegenerator();
        } catch (error) {
            console.log(error.message);
        }
    }

    await fetchdoctorsandlabsign();
    // Ye function ek hi jagah handle karega chahe single image ho ya multiple
    async function convertImagesToBase64(selector = '.signed-off-div2 img') {
        const images = document.querySelectorAll(selector); // selector ke hisaab se sabhi images nikalna

        if (images.length === 0) {
            console.warn("Koi image nahi mila is selector ke andar:", selector);
            return;
        }

        try {
            // Har image ko base64 me convert karke uska src update karna
            for (let img of images) {
                img.src = await imageToBase64(img.src);
            }
            console.log(`${images.length} image(s) Base64 me convert ho gaye!`);
        } catch (error) {
            console.error("Error converting images:", error);
        }
    }

    // Image URL ko Base64 string me convert karne wala helper function
    async function imageToBase64(url) {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }

    // Example function call
    // 1. Agar multiple images hain ek container me
    await convertImagesToBase64('.signed-off-div2 img');


    async function qrcodegenerator() {

        try {
            const response = await fetch(`/api/v1/user/generate-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: urlWithParam }),
            });

            if (!response.ok) throw new Error('Failed to generate QR code.');

            const data = await response.json();

            const qrCodeImage = document.getElementById('qrimg');
            console.log(qrCodeImage, "this is qr code image");

            qrCodeImage.src = data.qrCode;
            qrCodeImage.style.display = 'block';
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate QR code.');
        }
    }

    function countLines() {
        const span = document.querySelector(".report-details");
        const totallines = span.offsetHeight;
        return totallines;
    }

    // ==============================second sending code================================

    document.getElementById('PDFsettinganchr').addEventListener('click', async (event) => {
        event.preventDefault();
        // Collecting the required data
        const htmlContent = document.querySelector('.container2').outerHTML;
        const cssContent = document.getElementById('stying').innerHTML;
        const header = document.querySelector('.report-details').outerHTML;
        const footer = document.querySelector('.signed-off-div').outerHTML;
        const investigationmargin = countLines() + 20;

        try {
            // Sending data to the backend
            const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    labinchargesign: report.showLabIncharge,
                    htmlContent,
                    cssContent,
                    header,
                    footer,
                    reportId: value1,
                    backgroundImageUrl,
                    investigationmargin
                }),
            });

            if (!response.ok) throw new Error('Data not saved');

            console.log('Data added successfully');
            // If the response is OK, allow navigation
            window.location.href = document.getElementById('PDFsettinganchr').href;

        } catch (error) {
            console.error('Error generating PDF:', error);
        }
    });


    async function sendReport() {
        const sendReportButton = document.getElementById('sendReport');
        const popupModal = document.getElementById('popupModal');
        const closeButton = document.querySelector('.close-button');
        const inputField = document.getElementById('inputField');
        const contactInput = document.getElementById('contactInput');
        const sendButton = document.getElementById('sendButton');
        const iframe = document.getElementById('pdfFrame');

        const smsButton = document.getElementById('smsButton');
        const whatsappButton = document.getElementById('whatsappButton');
        const emailButton = document.getElementById('emailButton');
        const openPdfButton = document.getElementById('openPdfButton');

        sendReportButton.addEventListener('click', async (e) => {
            const loader = e.target.closest(".downloadDiv").querySelector("#loadingOverlay");

            if (!loader) {
                console.error("Loading overlay not found");
                return;
            }

            //saving pdf data into database
            const htmlContent = document.querySelector('.container2').outerHTML;
            const cssContent = document.getElementById('stying').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;
            investigationmargin = countLines();
            try {
                loader.style.display = 'flex';
                e.target.disable = true;
                const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl, investigationmargin }),
                });

                if (!response.ok) throw new Error('data not saved');

                console.log("data added successfully");

            } catch (error) {
                console.error('Error generating PDF:', error);
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ value1 })
                });
                if (!response.ok) throw new Error('PDF generation failed');

                if (popupModal.style.display === 'block') return;

                popupModal.style.display = 'block';

                loader.style.display = 'none';
                e.target.disable = false;
                // Create a Blob from the response
                const pdfBlob = await response.blob();

                // Create a URL for the Blob
                const pdfUrl = URL.createObjectURL(pdfBlob);

                console.log(pdfUrl);
                // Set the URL in the iframe
                const iframe = document.getElementById('pdfFrame');
                if (iframe) {
                    iframe.src = pdfUrl;
                } else {
                    console.error('Iframe with ID "pdf-preview" not found!');
                }
            } catch (error) {
                alert('Error generating PDF. Please try again.');
                popupModal.style.display = 'none';
            }
        });

        closeButton.addEventListener('click', () => {
            popupModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === popupModal) {
                popupModal.style.display = 'none';
            }
        });

        const setupInputField = (placeholderText, actionCallback) => {
            inputField.style.display = 'flex';
            contactInput.value = "";
            contactInput.placeholder = placeholderText;
            sendButton.onclick = null;
            sendButton.onclick = () => {
                const contact = contactInput.value.trim();
                if (!contact) return alert('Please enter a valid input!');
                actionCallback(contact, iframe.src);
            };
        };

        smsButton.addEventListener('click', () => setupInputField('Enter Phone Number for SMS', sendSMS));
        whatsappButton.addEventListener('click', () => setupInputField('Enter WhatsApp Number', sendWhatsApp));
        emailButton.addEventListener('click', () => setupInputField('Enter Email Address', sendEmail));

        openPdfButton.addEventListener('click', () => {
            window.open(iframe.src, '_blank');
        });
    }


    // Logic to send SMS
    async function sendSMS(phoneNumber, pdfUrl) {

        // If the input is a blob, convert it into a File
        const response = await fetch(pdfUrl);
        const blob = await response.blob(); // Convert blob URL into actual Blob data
        const pdfFile = new File([blob], "report2.pdf", { type: "application/pdf" }); // Create a File object
        console.log('Phone:', phoneNumber); // Check file details

        const formData = new FormData();
        formData.append('pdf', pdfFile); // `selectedFile` is the file object
        formData.append('phoneNumber', phoneNumber); // `selectedFile` is the file object
        formData.append('message', 'This is your test report from OccuHealth. Thank you for using our services!'); // Example number

        try {
            // Replace this URL with your backend API endpoint for sending SMS
            const response = await fetch(`${BASE_URL}/api/v1/user/send-sms`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert('SMS sent successfully!');
            } else {
                alert('Failed to send SMS. Please try again.');
            }
        } catch (error) {
            console.error('Error sending SMS:', error);
            alert('An error occurred while sending the SMS.');
        }
    }

    async function sendWhatsApp(whatsappNumber) {

        if (!whatsappNumber || !/^\d+$/.test(whatsappNumber)) {
            alert("Please enter a valid WhatsApp number without spaces or special characters.");
            return;
        }


        // Encode your custom message
        const message = encodeURIComponent(`Your Lab test report from OccuHealth Click on the link below to download the report\n ${urlWithParam}`);

        // Create WhatsApp link
        const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;

        // Redirect to WhatsApp
        window.open(whatsappLink, "_blank");
    }

    // Logic to send Email
    async function sendEmail(email) {
        try {
            // Replace this URL with your backend API endpoint for sending Emails
            const response = await fetch(`${BASE_URL}/api/v1/user/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    subject: 'Your Test Report from OccuHealth',
                    body: 'This is your test report from OccuHealth. Thank you for using our services!',
                    urlWithParam
                })
            });

            if (response.ok) {
                alert('Email sent successfully!');
            } else {
                alert('Failed to send Email. Please try again.');
            }
        } catch (error) {
            console.error('Error sending Email:', error);
            alert('An error occurred while sending the Email.');
        }
    }

    async function fetchreport(value1) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/ReportData`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ value1 })
            });

            if (!response.ok) {
                throw new Error("something went wrong")
            }

            // Wait for the response to be parsed as JSON
            return await response.json();

        } catch (error) {
            console.log(error)
        }
    }

    function getBookingBarcodeList() {
        const booking = JSON.parse(localStorage.getItem('booking')) || {};
        const acceptedbarcode = Array.isArray(booking.acceptedbarcode) ? booking.acceptedbarcode.filter(Boolean) : [];
        const tableBarcodes = Array.isArray(booking.tableData)
            ? booking.tableData.map((item) => item?.barcodeId).filter(Boolean)
            : [];

        return [...new Set([...acceptedbarcode, ...tableBarcodes])];
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function stripHtmlToText(value) {
        const temp = document.createElement("div");
        temp.innerHTML = String(value ?? "");
        return (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
    }

    function formatDateTime(timestamp) {
        const date = new Date(timestamp);

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Ensure 2-digit month
        const day = date.getDate().toString().padStart(2, '0');

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const amPm = hours >= 12 ? 'PM' : 'AM';

        hours = (hours % 12 || 12).toString().padStart(2, '0'); // Ensure 2-digit hour format

        return `${day}-${month}-${year} <span>${hours}:${minutes} ${amPm}</span>`;
    }

    async function populateHeader() {
        document.getElementById("booking-registeration-number").innerText = report.reg_id;

        const patientdetails = document.createElement("div");
        patientdetails.classList.add("report-details-innerDiv2");
        patientdetails.innerHTML = `<div class="left2">
                <div class="infor-div"><div class="tags">Patient Name:</div><div class="value">${report.patientName}</div></div>
                <div class="infor-div"><div class="tags">Age / Sex:</div> <div class="value">${report.year} / ${report.gender}</div></div>
                <div class="infor-div"><div class="tags">Referred By:</div> <div class="value">${report.doctorName}</div></div>
                <div class="infor-div"><div class="tags">Reg. no:</div> <div class="value">${report.bookingId}</div></div>
                <div class="infor-div forhide"><div class="tags">Lab Name:</div> <div class="value">${report.labName}</div></div>
                <div class="infor-div forhide" id="investDiv">
                    <div class="tags">Investigations:</div> 
                        <div class="value">${report.uniquetestArray}
                        </div>
                </div>
            </div>
            <div class="right2">
                <div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Registered on:</div>
                        <div class="time-div">${formatDateTime(new Date(report.date).toISOString().split('T')[0] + "T" + report.time)}</div>
                        </div>
                        <div class="registered-div2 forhide">
                            <div class="registeration-tag2">Collected on:</div>
                            <div class="time-div">${formatDateTime(report.collectedOn)}</div>
                        </div>
                    <div class="registered-div2 forhide">
                        <div class="registeration-tag2">Received on:</div>
                        <div class="time-div">${formatDateTime(report.receivedOn)}</div>
                    </div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Reported on:</div>
                        <div class="time-div">${formatDateTime(report.reportedOn)}</div>
                    </div>
                </div>
            </div>
            <div class="barcode-div2">
                <div class="barcode2">
                    <div id="barcodeContainer2">
                        <img id="barcodeImage" alt="Generated Barcode" />
                    </div>
                </div>
            </div>`;

        document.querySelector(".report-details").appendChild(patientdetails);
    }
    console.log(`this is report.time ${new Date(report.date).toISOString().split('T')[0]}T${report.time}`, "this is receivedOn:", report.receivedOn);

    await populateHeader();

    async function barcodegenerator() {
        const booking = JSON.parse(localStorage.getItem('booking')) || {};
        const barcodeList = getBookingBarcodeList();
        const barcodeNumber = barcodeList[0] || booking.bookingId || report.bookingId;

        if (!barcodeNumber) {
            console.warn("Barcode source not available for reportFormat");
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode?nonumber=false`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: barcodeNumber }),
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById("barcodeImage").src = data.barcode; // Display the barcode image
            } else {
                alert("Failed to generate barcode!");
            }
        } catch (error) {
            console.error("Error generating barcode:", error);
            alert("An error occurred. Please try again.");
        }
    }

    barcodegenerator();

    const storedPrintSettings = (() => {
        try {
            return JSON.parse(localStorage.getItem("printSettings") || "{}");
        } catch {
            return {};
        }
    })();
    const reportPrintSettings = report?.printSettings || {};
    const activePrintSettings = { ...storedPrintSettings, ...reportPrintSettings };
    const highlightAbnormalResults = Boolean(activePrintSettings.HLinred);
    const boldAbnormalRows = activePrintSettings.BoldRow ?? true;

    function getAbnormalResultState(test = {}) {
        const stripHtmlToText = (value) => {
            const temp = document.createElement("div");
            temp.innerHTML = String(value ?? "");
            return (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
        };

        const reference = stripHtmlToText(test?.reference ?? test?.text ?? "");
        const rawValue = stripHtmlToText(test?.value ?? test?.result ?? test?.defaultresult ?? "");

        if (!reference || !rawValue) {
            return { isAbnormal: false, suffix: "" };
        }

        const normalizedReference = reference.toLowerCase();
        const normalizedValue = rawValue.toLowerCase();
        const numericValue = parseFloat(rawValue.replace(/,/g, ""));
        const rangeMatch = reference.match(/^\s*(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)\s*$/);

        if (rangeMatch && !Number.isNaN(numericValue)) {
            const lower = parseFloat(rangeMatch[1]);
            const upper = parseFloat(rangeMatch[2]);

            if (!Number.isNaN(lower) && !Number.isNaN(upper)) {
                if (numericValue < lower) {
                    return { isAbnormal: true, suffix: "L" };
                }

                if (numericValue > upper) {
                    return { isAbnormal: true, suffix: "H" };
                }
            }
        }

        if (normalizedReference.includes("positive") && !normalizedValue.includes("positive")) {
            return { isAbnormal: true, suffix: "" };
        }

        if (normalizedReference.includes("negative") && !normalizedValue.includes("negative")) {
            return { isAbnormal: true, suffix: "" };
        }

        if (normalizedValue.includes("positive") || normalizedValue.includes("abnormal")) {
            return { isAbnormal: true, suffix: "" };
        }

        return { isAbnormal: false, suffix: "" };
    }


    function applyAbnormalStyles(cell, isAbnormal) {
        if (!cell) return;

        const row = cell.closest("tr");
        if (row) {
            const shouldBold = isAbnormal && boldAbnormalRows;
            row.style.fontWeight = shouldBold ? "700" : "";
            if (shouldBold) {
                row.classList.add("BoldRow");
            } else {
                row.classList.remove("BoldRow");
            }
        }

        const shouldColor = isAbnormal && highlightAbnormalResults;
        if (shouldColor) {
            cell.style.color = "#c62828";
        } else {
            cell.style.color = "#000";
        }
    }

    function renderData(data) {
        const container = document.getElementById("tables-container");
        container.innerHTML = "";

        data.CategoryAndTest.forEach((categoryData, index) => {
            const section = document.createElement("div");
            section.className = "section";
            if (data.categorizedPDF && index > 0) {
                section.classList.add("page-break");
            }

            const headings = document.createElement("div");
            headings.classList.add("headings");

            const deleteH2Button = document.createElement("span");
            deleteH2Button.innerHTML = `<i class="fa-sharp fa-solid fa-xmark" title="Delete Entire category section"></i>`;
            deleteH2Button.className = "delete-btn";
            deleteH2Button.classList.add('wrong');

            const categoryHeading = document.createElement("h2");
            categoryHeading.textContent = categoryData.category;
            categoryHeading.appendChild(deleteH2Button);
            headings.appendChild(categoryHeading);

            let titleHeading = null;
            if (categoryData.category !== categoryData.title) {
                const deleteH3Button = document.createElement("span");
                deleteH3Button.innerHTML = `<i class="fa-sharp fa-solid fa-xmark" title="Delete Pannel"></i>`;
                deleteH3Button.className = "delete-btn";

                if (!categoryData.title.includes('Unknown Title')) {
                    titleHeading = document.createElement("h3");
                    titleHeading.textContent = categoryData.title;
                    titleHeading.appendChild(deleteH3Button);
                    headings.appendChild(titleHeading);
                }

                deleteH3Button.addEventListener("click", () => {
                    titleHeading.remove();
                    const parentTable = section.querySelector("table");
                    parentTable?.remove();
                });
            }

            section.appendChild(headings);

            const table = document.createElement("table");
            table.className = "test-table";

            // ✅ Table header with proper class for styling
            const thead = document.createElement("thead");
            thead.innerHTML = `
            <tr>
                <th class="deletion"></th>
                <th>Test Name</th>
                <th class="valuecell">Value</th>
                <th>Unit</th>
                <th>Reference</th>
            </tr>
        `;
            table.appendChild(thead);

            const tbody = document.createElement("tbody");

            categoryData.tests.forEach((test, rowIndex) => {
                let testRow;
                
                if (test.testName) {
                    testRow = document.createElement("tr");
                    const rawTestName = String(test?.testName ?? "");
                    const isParameterRow = Boolean(test?.isParameter) || /id=(["'])parameters\1/.test(rawTestName);
                    const isMultiHeaderRow = Boolean(test?.isMultiHeader) || (!isParameterRow && !!rawTestName && !test?.value && !test?.unit && !test?.reference);

                    if (isMultiHeaderRow || isParameterRow) {
                        testRow.classList.add("multi-test-row");
                    }

                    if (test.pagebreak) {
                        testRow.classList.add('page-break');
                    }

                    const { isAbnormal, suffix: testNameSuffix } = getAbnormalResultState(test);

                    // ✅ FIXED: Documented test with proper colspan
                    if (test.isDocumented) {
                        testRow.innerHTML = `
                    <td class="wrong">
                        <span class="delete-row-icon" title="Delete Row">
                            <i class="fa-sharp fa-solid fa-xmark"></i>
                        </span>
                    </td>
                    <td colspan="4" style="padding: 0; border: none;">
                        <div class="documented-content">
                            ${isMultiHeaderRow
                                ? `<div class="test-name multi-test-name" style="font-weight: 700 !important; text-decoration: underline !important;">${escapeHtml(String(stripHtmlToText(test.testName)).toUpperCase())}</div>`
                                : (test.testName || "")}
                        </div>
                    </td>
                `;
                    } else {
                        // ✅ Regular test row
                        testRow.innerHTML = `
                    <td class="wrong">
                        <span class="delete-row-icon" title="Delete Row">
                            <i class="fa-sharp fa-solid fa-xmark"></i>
                        </span>
                    </td>
                    ${isMultiHeaderRow
                        ? `<td class="test-name" style="padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; text-indent: 0 !important;"><span class="multi-test-name" style="font-weight: 700 !important; text-decoration: underline !important;">${escapeHtml(String(stripHtmlToText(test.testName)).toUpperCase())}</span></td>`
                        : `<td class="test-name">${test.testName || ""}</td>`}
                    <td class="high-low${highlightAbnormalResults && isAbnormal ? " abnormal-result" : ""}">
                        <div class="HL"><span>${testNameSuffix}</span></div>
                        <span>${test.value || ""}</span>
                    </td>
                    <td>${test.unit || ""}</td>
                    <td>${test.reference || ""}</td>
                `;
                    }

                    const abnormalCell = testRow.querySelector(".high-low");
                    if (abnormalCell) {
                        applyAbnormalStyles(abnormalCell, isAbnormal);
                    }

                    tbody.appendChild(testRow);
                }


                // ✅ Remark row
                if (test.remark) {
                    const remarkRow = document.createElement("tr");
                    const remarkCellEmpty = document.createElement("td");
                    remarkCellEmpty.classList.add("wrong");

                    const remarkCell = document.createElement("td");
                    remarkCell.colSpan = 4;
                    remarkCell.className = "remark-row";
                    remarkCell.innerHTML = `<div>Remark:</div> <span>${test.remark}</span>`;

                    remarkRow.appendChild(remarkCellEmpty);
                    remarkRow.appendChild(remarkCell);
                    tbody.appendChild(remarkRow);
                }

                // ✅ FIXED: Details row (can contain CKEditor content)
                if (test.details) {
                    const detailsRow = document.createElement("tr");

                    const detailsCellEmpty = document.createElement("td");
                    detailsCellEmpty.classList.add("wrong");

                    const detailsCell = document.createElement("td");
                    detailsCell.colSpan = 4;
                    detailsCell.className = "details-row";

                    // ✅ Wrap details in documented-content div for proper isolation
                    detailsCell.innerHTML = `
        <div class="documented-content">
            ${test.details}
        </div>
    `;

                    detailsRow.appendChild(detailsCellEmpty);
                    detailsRow.appendChild(detailsCell);

                    // ✅ Remove any unwanted spacing/margins
                    detailsRow.style.margin = "0";
                    detailsRow.style.padding = "0";

                    tbody.appendChild(detailsRow);
                }

                // Delete functionality
                const deleteIcon = testRow?.querySelector(".delete-row-icon");
                if (deleteIcon) {
                    deleteIcon.addEventListener("click", () => {
                        const currentRow = deleteIcon.closest("tr");
                        let nextRow = currentRow.nextElementSibling;

                        if (nextRow && nextRow.querySelector(".remark-row")) {
                            nextRow.remove();
                            nextRow = currentRow.nextElementSibling;
                        }
                        if (nextRow && nextRow.querySelector(".details-row")) {
                            nextRow.remove();
                        }

                        currentRow.remove();
                    });
                }
            });

            // ✅ FIXED: Table-level advice, notes, remarks (can contain CKEditor content)
            if (categoryData.advice) {
                const adviceRow = document.createElement("tr");
                const adviceCellEmpty = document.createElement("td");
                adviceCellEmpty.classList.add("wrong");

                const adviceCell = document.createElement("td");
                adviceCell.colSpan = 4;
                adviceCell.className = "advice";
                adviceCell.innerHTML = `
                <div>Advice:</div> 
                <span class="documented-content">${categoryData.advice}</span>
            `;

                adviceRow.appendChild(adviceCellEmpty);
                adviceRow.appendChild(adviceCell);
                tbody.appendChild(adviceRow);
            }

            if (categoryData.notes) {
                const notesRow = document.createElement("tr");
                const notesCellEmpty = document.createElement("td");
                notesCellEmpty.classList.add("wrong");

                const notesCell = document.createElement("td");
                notesCell.colSpan = 4;
                notesCell.className = "notes";
                notesCell.innerHTML = `
                <div>Notes:</div> 
                <span class="documented-content">${categoryData.notes}</span>
            `;

                notesRow.appendChild(notesCellEmpty);
                notesRow.appendChild(notesCell);
                tbody.appendChild(notesRow);
            }

            if (categoryData.remarks) {
                const remarksRow = document.createElement("tr");
                const remarksCellEmpty = document.createElement("td");
                remarksCellEmpty.classList.add("wrong");

                const remarksCell = document.createElement("td");
                remarksCell.colSpan = 4;
                remarksCell.className = "remarks";
                remarksCell.innerHTML = `
                <div>Remarks:</div> 
                <span class="documented-content">${categoryData.remarks}</span>
            `;

                remarksRow.appendChild(remarksCellEmpty);
                remarksRow.appendChild(remarksCell);
                tbody.appendChild(remarksRow);
            }

            table.appendChild(tbody);

            // ✅ FIXED: Interpretation (can contain CKEditor content)
            if (categoryData.interpretation) {
                const interpretationRow = document.createElement("tr");
                const interpretationCellEmpty = document.createElement("td");
                interpretationCellEmpty.classList.add("wrong");

                const interpretationCell = document.createElement("td");
                interpretationCell.colSpan = 4;

                const interpretation = document.createElement("div");
                interpretation.className = "interpretation";
                interpretation.innerHTML = `
                <p style="font-weight: bold;">Interpretation</p> 
                <div class="documented-content">${categoryData.interpretation}</div>
            `;

                interpretationCell.appendChild(interpretation);
                interpretationRow.appendChild(interpretationCellEmpty);
                interpretationRow.appendChild(interpretationCell);
                tbody.appendChild(interpretationRow);
            }

            section.appendChild(table);

            deleteH2Button.addEventListener("click", () => {
                section.remove();
            });

            container.appendChild(section);
        });

        // Additional details
        if (data.MoreDetails) {
            const MoreDetails = document.createElement("div");
            MoreDetails.className = "moreDetails";
            MoreDetails.innerHTML = `
            <span>Additional Findings :-</span><br> 
            <div class="documented-content">${data.MoreDetails}</div>
        `;
            container.appendChild(MoreDetails);
        }
    }


    // Call the function to render the data
    renderData(report);

    async function fetchTemplateImages() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/templates`, { method: "POST" }); // Update URL as per your backend
            const data = await response.json();

            if (data.urls && Array.isArray(data.urls)) {
                const imageurl = data.urls[0].template;
                return imageurl;
            } else {
                console.error('No URLs found:', data);
            }
        } catch (error) {
            console.error('Error fetching template images:', error);
        }
    };

    // await convertAllImagesToBase64();
    await signoffdivfunction();
    downloadpdffunction();

    async function signoffdivfunction() {
        if (report.signOff) {
            // Select all buttons with the class 'click'
            const targetButtons = document.querySelectorAll(".click");

            // Remove the 'sign' class from each button
            targetButtons.forEach(button => {
                if (button.classList.contains("sign")) {
                    button.classList.remove("sign");
                }
            });
        }

        document.getElementById("signOff").addEventListener("click", async function (e) {

            const loader = e.target.closest(".downloadDiv").querySelector("#loadingOverlay");

            if (!loader) {
                console.error("Loading overlay not found");
                return;
            }

            loader.style.display = 'flex';
            e.target.disable = true;

            // Select all target buttons
            const targetButtons = document.querySelectorAll(".click");

            // Toggle class for each target button
            targetButtons.forEach(button => {
                button.classList.toggle("sign");
            });
            //saving pdf data into database
            const htmlContent = document.querySelector('.container2').outerHTML;
            const cssContent = document.getElementById('stying').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;
            investigationmargin = countLines();
            // Check if any button has the 'sign' class
            const anyButtonHasSign = Array.from(targetButtons).some(button => button.classList.contains('sign'));
            let signoff

            if (anyButtonHasSign) {
                signoff = false;
            } else {
                signoff = true;
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/editReportsignofffield`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ value1, signoff }),
                });

                if (!response.ok) throw new Error('signoff field no updated');

            } catch (error) {
                console.error('Error generating PDF:', error);
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl, investigationmargin, bookingId: report.bookingId, isdocumented: report.isDocumented }),
                });

                if (!response.ok) throw new Error('data not saved');

                await updatebookingisreportreadyfield(report.bookingId);

            } catch (error) {
                console.error('Error generating PDF:', error);
            } finally {
                loader.style.display = 'none';
                e.target.disable = false;
            }
        });
    }

    async function updatebookingisreportreadyfield(bookingid) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/CompleteBookingcontroller`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingid }),
            });
            if (!response.ok) {
                console.log("status not updated");
            }

        } catch (error) {
            console.log(error)
        }
    }

    async function fetchLabSignAndSetInputs() {
        try {
            // Send a POST request to the API with value1 in the request body
            const response = await fetch(`/api/v1/user/getDoctorsSign`);

            // Check if the response is okay
            if (!response.ok) {
                console.log('Failed to fetch data from API');
            }

            // Parse the response JSON
            const data = await response.json();

            if (data) {
                return {
                    labinchargeinfo: data.labinchargeinfo,
                    sign: data.labinchargesign
                };
            }
            return {
                labinchargeinfo: null,
                sign: null
            };

        } catch (error) {
            console.error('Error fetching data and setting inputs:', error.message);
        }
    };

    // -----------------------------------new pdf generator--------------------------------------
    async function downloadpdffunction({ labinchargesign = null, checkBox = false, labinchargeinfo = "",
        backgroundImageUrl = null, headermargin, footermargin, marginRight, marginLeft,
        labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow, HLinred: HLinred,
        BoldRow, showInvest, DownloadPdf = true } = {}) {
        document.getElementById('downloadPDF').addEventListener('click', async (e) => {
            const loader = e.target.closest(".downloadDiv").querySelector("#loadingOverlay");

            if (!loader) {
                console.error("Loading overlay not found");
                return;
            }

            loader.style.display = 'flex';
            e.target.disable = true;


            //saving pdf data into database
            const htmlContent = document.querySelector('.container2').outerHTML;
            const cssContent = document.getElementById('stying').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;
            investigationmargin = countLines();
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl, investigationmargin }),
                });

                if (!response.ok) throw new Error('data not saved');

                console.log("labinchargesign edited successfully");

            } catch (error) {
                console.error('Error generating PDF:', error);
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        value1, labinchargesign, checkBox, backgroundImageUrl,
                        headermargin, footermargin, marginRight, marginLeft, labinchargeinfo: labinchargeinfo,
                        labinchargesignurl: sign, selectedFontSize, RowSpacing, HighLow, HLinred,
                        BoldRow, showInvest, DownloadPdf
                    }),
                });

                if (!response.ok) throw new Error('PDF generation failed');

                // Creating blob from response
                const pdfBlob = await response.blob();

                // Creating a download link for the PDF
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(pdfBlob);
                link.download = `${report.patientName}.pdf`;
                link.click();
                window.open(link);

                await updatebookingisreportreadyfield(report.bookingId);

            } catch (error) {
                console.error('Error generating PDF:', error);
            } finally {
                loader.style.display = 'none';
                e.target.disable = false;
            }
        });
    }

    // Function to Print a Specific Area
    document.getElementById('BrowserPrint').addEventListener('click', function () {
        // Select the area to print
        const printArea = document.getElementById('container').innerHTML;
        const styling = document.querySelector('style').innerHTML;

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.open();
        printWindow.document.write(`
            <html>
            <head>
                <title>Print Report</title>
                <style>
                    ${styling}
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .container { width: 100%; }
                    .header { text-align: center; }
                    .barcode-div { margin-top: 20px; text-align: center; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                ${printArea}
            </body>
            </html>
        `);
        printWindow.document.close();
    });


    await sendReport();

    function hidecontent() {
        if (user.showprintsetting === false) {
            document.getElementById('printsettingbutton').style.display = "none";
        }
        if (user.tenantId.modelType === "1layer") {
            const style = document.getElementById("stying");
            style.textContent += `
            @media print {
            .barcode-div2 {
                top: 6%;
            }
            }
            `;
            const contents = document.querySelectorAll('.forhide');
            contents.forEach(elem => {
                elem.style.display = "none";
            })
        }
    }
    hidecontent();
})();
