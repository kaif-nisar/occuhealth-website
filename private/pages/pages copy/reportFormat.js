(async function () {
    const urlParams = await new URLSearchParams(window.location.search);
    let value1 = await urlParams.get('value1');
    let report = await fetchreport();
    const backgroundImageUrl = await fetchTemplateImages();
    value1 = report._id;
    const baseUrl = `${BASE_URL}/pages/download_reports.html`;
    localStorage.clear();
    localStorage.setItem('myKey', value1);
    const urlWithParam = `${baseUrl}?value=${encodeURIComponent(value1)}`;
    const { labinchargeinfo, sign } = await fetchLabSignAndSetInputs();

    async function convertSpecificImagesToBase64() {
        const images = document.querySelectorAll('.signed-off-div2 img'); // Sabhi <img> tags select karna
        
        if (images.length >= 3) {
            const firstImage = images[0]; // Pehla <img>
            const thirdImage = images[2]; // Teesra <img>
    
            try {
                firstImage.src = await imageToBase64(firstImage.src);
                thirdImage.src = await imageToBase64(thirdImage.src);
                console.log("Pehla aur teesra image Base64 me convert ho gaya!");
            } catch (error) {
                console.error("Error converting image:", error);
            }
        } else {
            console.warn("Kam se kam 3 images hone chahiye .signed-off-div2 ke andar!");
        }
    }
    
    // Function jo image URL ko Base64 me convert karega
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
    
    // Function call karna
    convertSpecificImagesToBase64();
    
    async function qrcodegenerator() {
        const button = document.getElementById('button');

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: urlWithParam }),
            });

            if (!response.ok) throw new Error('Failed to generate QR code.');

            const data = await response.json();
            const qrCodeImage = document.getElementById('qrimg');
            qrCodeImage.src = data.qrCode;
            qrCodeImage.style.display = 'block';
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate QR code.');
        }
    }

    await qrcodegenerator();

    // ==============================second sending code================================

    document.getElementById('PDFsettinganchr').addEventListener('click', async (event) => {
        event.preventDefault();
        // Collecting the required data
        const htmlContent = document.querySelector('.container2').outerHTML;
        const cssContent = document.querySelector('style').innerHTML;
        const header = document.querySelector('.report-details').outerHTML;
        const footer = document.querySelector('.signed-off-div').outerHTML;

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
            const cssContent = document.querySelector('style').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;

            try {
                loader.style.display = 'flex';
                e.target.disable = true;
                const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl }),
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

    async function fetchreport() {
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
                <div class="infor-div"><div class="tags">Lab Name:</div> <div class="value">${report.labName}</div></div>
                <div class="infor-div" id="investDiv"><div class="tags">Investigations:</div> <div class="value">${report.uniquetestArray}</div></div>
            </div>
            <div class="right2">
                <div>
                    <div class="registered-div2">
                        <div class="registeration-tag2">Registered on:</div>
                        <div class="time-div">${formatDateTime(new Date(report.date).toISOString().split('T')[0]+"T"+report.time)}</div>
                        </div>
                        <div class="registered-div2">
                            <div class="registeration-tag2">Collected on:</div>
                            <div class="time-div">${formatDateTime(report.collectedOn)}</div>
                        </div>
                    <div class="registered-div2">
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

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/generate-barcode`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: report.reg_id }),
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


    function renderData(data) {
        const container = document.getElementById("tables-container"); // Main container
        container.innerHTML = ""; // Clear existing content

        // Iterate through each category
        data.CategoryAndTest.forEach((categoryData, index) => {
            // Create section for the category
            const section = document.createElement("div");
            section.className = "section";
            if (data.categorizedPDF && index > 0) {
                section.classList.add("page-break");
            }

            const headings = document.createElement("div");
            headings.classList.add("headings");

            // Add delete button to `h2`
            const deleteH2Button = document.createElement("span");
            deleteH2Button.innerHTML = `<i class="fa-sharp fa-solid fa-xmark" title="Delete Entire category section"></i>`;
            deleteH2Button.className = "delete-btn";
            deleteH2Button.classList.add('wrong');

            // Add category heading with delete button
            const categoryHeading = document.createElement("h2");
            categoryHeading.textContent = categoryData.category;
            categoryHeading.appendChild(deleteH2Button);
            headings.appendChild(categoryHeading);

            // Add delete button to `h3` if it exists
            let titleHeading = null;
            // Add delete functionality to `h3`
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
                    // Delete the `h3` heading
                    titleHeading.remove();

                    // Delete the associated table (if exists)
                    const parentTable = section.querySelector("table");
                    parentTable?.remove();
                });
            }


            section.appendChild(headings);

            // Create a table for tests
            const table = document.createElement("table");
            table.className = "test-table";

            // Table header
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

            // Table body
            const tbody = document.createElement("tbody");

            categoryData.tests.forEach((test, rowIndex) => {
                // Test row
                const testRow = document.createElement("tr");

                // Check if test.reference exists and is in the correct format
                let isBold = false; // To determine if the row should be bold
                let testNameSuffix = ""; // To store 'L', 'H', or nothing based on conditions

                if (test.reference) {
                    const referenceParts = test.reference.split(" - ");
                    if (referenceParts.length === 2) {
                        const lowerLimit = parseFloat(referenceParts[0]);
                        const upperLimit = parseFloat(referenceParts[1]);
                        const testValue = parseFloat(test.value);

                        if (!isNaN(lowerLimit) && !isNaN(upperLimit) && !isNaN(testValue)) {
                            if (testValue < lowerLimit) {
                                isBold = true;
                                testNameSuffix = "L"; // Low
                            } else if (testValue > upperLimit) {
                                isBold = true;
                                testNameSuffix = "H"; // High
                            }
                        }
                    }
                }

                // Check for positive keyword in the value
                if (typeof test.value === "string" && test.value.toLowerCase().includes("positive")) {
                    isBold = true;
                }

                // Set row styling and test name suffix
                if (isBold) {
                    testRow.style.fontWeight = "bold"; // Make the row bold
                    testRow.classList.add('BoldRow');
                }

                if (test.isDocumented) {
                    testRow.innerHTML = `
                    <td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td>
                    <td colspan="5">${test.testName || ""}</td>
                    <td class="high-low"><div class="HL"><span>${testNameSuffix}</span></div><span>${test.value || ""}</span></td>
                    <td>${test.unit || ""}</td>
                    <td>${test.reference || ""}</td>
                `;
                } else {
                    testRow.innerHTML = `
                    <td class="wrong"><span class="delete-row-icon" title="Delete Row"><i class="fa-sharp fa-solid fa-xmark"></i></span></td>
                    ${test.testName || ""}
                    <td class="high-low"><div class="HL"><span>${testNameSuffix}</span></div><span>${test.value || ""}</span></td>
                    <td>${test.unit || ""}</td>
                    <td>${test.reference || ""}</td>
                `;
                }
                tbody.appendChild(testRow);

                // Remark row (if available)
                if (test.remark) {
                    const remarkRow = document.createElement("tr");
                    const remarkCell = document.createElement("td");
                    remarkCell.colSpan = 5; // Span all columns
                    remarkCell.innerHTML = `<div>Remark:</div> <span>${test.remark}</span>`;
                    remarkCell.className = "remark-row";
                    remarkRow.appendChild(remarkCell);
                    tbody.appendChild(remarkRow);
                }

                // Details row (if available)
                if (test.details) {
                    const detailsRow = document.createElement("tr");
                    const detailsCellpre = document.createElement("td");
                    detailsCellpre.classList.add("wrong");
                    const detailsCell = document.createElement("td");
                    detailsCell.colSpan = 5; // Span all columns
                    detailsCell.innerHTML = `${test.details}`;
                    detailsCell.className = "details-row";
                    detailsRow.appendChild(detailsCellpre);
                    detailsRow.appendChild(detailsCell);
                    tbody.appendChild(detailsRow);
                }

                // Add delete functionality for the row
                const deleteIcon = testRow.querySelector(".delete-row-icon");
                deleteIcon.addEventListener("click", () => {
                    const currentRow = deleteIcon.closest("tr");

                    // Delete the remark and details rows (if they exist)
                    const nextRow = currentRow.nextElementSibling;
                    if (nextRow && nextRow.querySelector(".remark-row")) {
                        nextRow.remove();
                    }
                    if (nextRow && nextRow.querySelector(".details-row")) {
                        nextRow.remove();
                    }

                    currentRow.remove(); // Delete the test row
                });
            });


            // Render additional information (advice, notes, remarks, interpretation)
            if (categoryData.advice) {
                const detailsRow = document.createElement("tr");
                const detailsCellpre = document.createElement("td");
                detailsCellpre.colSpan = 4;
                detailsCellpre.className = "advice";
                detailsCellpre.innerHTML = `<div>Advice:</div> <span>${categoryData.advice}</span>`;
                detailsRow.appendChild(detailsCellpre);
                tbody.appendChild(detailsRow);
            }

            if (categoryData.notes) {
                const detailsRow = document.createElement("tr");
                const detailsCellpre = document.createElement("td");
                detailsCellpre.colSpan = 4;
                detailsCellpre.className = "notes";
                detailsCellpre.innerHTML = `<div>Notes:</div> <span>${categoryData.notes}</span>`;
                detailsRow.appendChild(detailsCellpre);
                tbody.appendChild(detailsRow);
            }

            if (categoryData.remarks) {
                const detailsRow = document.createElement("tr");
                const detailsCellpre = document.createElement("td");
                detailsCellpre.colSpan = 4;
                detailsCellpre.className = "remarks";
                detailsCellpre.innerHTML = `<div>Remarks:</div> <span>${categoryData.remarks}</span>`;
                detailsRow.appendChild(detailsCellpre);
                tbody.appendChild(detailsRow);
            }

            table.appendChild(tbody);

            if (categoryData.interpretation) {
                const detailsRow = document.createElement("tr");
                const detailsCellpre = document.createElement("td");
                detailsCellpre.colSpan = 4;
                const interpretation = document.createElement("div");
                interpretation.className = "interpretation";
                interpretation.innerHTML = `<p style="font-weight: bold;">Interpretation</p> ${categoryData.interpretation}`;
                detailsCellpre.appendChild(interpretation);
                detailsRow.appendChild(detailsCellpre);
                table.appendChild(detailsRow);
            }

            section.appendChild(table);

            // Add delete functionality for `h2`
            deleteH2Button.addEventListener("click", () => {
                section.remove(); // Delete the whole section
            });


            // Append the section to the container
            container.appendChild(section);
        });

        // Add additional details if available
        if (data.MoreDetails) {
            const MoreDetails = document.createElement("div");
            MoreDetails.className = "moreDetails";
            MoreDetails.innerHTML = `<span>Additional Findings :-</span><br> <div>${data.MoreDetails}</div>`;
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
            const cssContent = document.querySelector('style').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;

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
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl }),
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
            const response = await fetch(`${BASE_URL}/api/v1/user/getLabInchargeSign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reportId: value1 }),
            });

            // Check if the response is okay
            if (!response.ok) {
                console.log('Failed to fetch data from API');
            }

            // Parse the response JSON
            const data = await response.json();

            if (data[0]) {
                return {
                    labinchargeinfo: data[0].labinchargeinfo,
                    sign: data[0].sign
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
            const cssContent = document.querySelector('style').innerHTML;
            const header = document.querySelector('.report-details').outerHTML;
            const footer = document.querySelector('.signed-off-div').outerHTML;

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/adding-pdf-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ labinchargesign: report.showLabIncharge, htmlContent, cssContent, header, footer, reportId: value1, backgroundImageUrl }),
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

})();
