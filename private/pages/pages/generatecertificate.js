
        let franchiseArray = [];

        // Image to Base64 converter with better error handling
        async function imageToBase64(url) {
            try {
                // Check if already base64
                if (url.startsWith('data:')) {
                    return url;
                }

                const response = await fetch(url, {
                    mode: 'cors',
                    cache: 'force-cache'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const blob = await response.blob();
                
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('FileReader failed'));
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Error converting image to base64:", error);
                throw error;
            }
        }

        // Set certificate credentials
        async function setCredentials() {
            const logodiv = document.querySelector('.certificatelogo');
            const authLine = document.querySelector('.authorisedline');
            
            if (authLine) {
                authLine.textContent = `Is an Authorized Collection Center of ${user.tenantId.adminDetails.username}`;
            }
            
            if (user.tenantId.logo && logodiv) {
                try {
                    const logoimg = document.createElement('img');
                    logoimg.classList.add('certificate-logo-img');
                    
                    // Convert logo to base64
                    const logoBase64 = await imageToBase64(user.tenantId.logo);
                    logoimg.src = logoBase64;
                    
                    logodiv.appendChild(logoimg);
                    console.log('Logo loaded successfully');
                } catch (error) {
                    console.log('Logo not available or failed to load');
                }
            }
            
            await getDoctorSignatures();
        }

        // Get doctor signatures
        async function getDoctorSignatures() {
            try {
                // Actual API call - uncomment when backend is ready
                const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);

                if (!response.ok) {
                    console.log("Doctor signatures not available from API");
                    return;
                }

                const doctorsdata = await response.json();

                // First signature
                const signoffdiv = document.querySelector('.signaturediv');
                if (signoffdiv && doctorsdata.firstdoctorsign) {
                    signoffdiv.innerHTML = '';
                    try {
                        const signBase64 = await imageToBase64(doctorsdata.firstdoctorsign);
                        const div = document.createElement('div');
                        div.className = 'signed-off-div2';
                        div.innerHTML = `            
                            <img src="${signBase64}" width="140" height="45" />
                            <hr class="sign-hr"/>
                            <div class="textspan">${doctorsdata.firstdoctorsigninfo || 'Authorized Signatory'}</div>`;
                        signoffdiv.appendChild(div);
                        console.log('First signature loaded');
                    } catch (imgError) {
                        console.log('First signature image failed to load:', imgError.message);
                    }
                }

                // Second signature
                const signoffdiv0 = document.querySelector('.signaturediv0');
                if (signoffdiv0 && doctorsdata.seconddoctorsign) {
                    signoffdiv0.innerHTML = '';
                    try {
                        const signBase64 = await imageToBase64(doctorsdata.seconddoctorsign);
                        const div = document.createElement('div');
                        div.className = 'signed-off-div';
                        div.innerHTML = `            
                            <img src="${signBase64}" width="140" height="45" />
                            <hr class="sign-hr"/>
                            <div class="textspan">${doctorsdata.seconddoctorsigninfo || 'Authorized Signatory'}</div>`;
                        signoffdiv0.appendChild(div);
                        console.log('Second signature loaded');
                    } catch (imgError) {
                        console.log('Second signature image failed to load:', imgError.message);
                    }
                }

            } catch (error) {
                console.log("Doctor signatures API unavailable:", error.message);
            }
        }

        // Load certificate background image
        async function loadCertificateBackground() {
            const certificateImg = document.getElementById('certificateimg');
            
            // Use your actual certificate template path
            const certificateUrl = `${BASE_URL}/images/certificatetemp.png`;
            
            try {
                console.log('Loading certificate background from:', certificateUrl);
                const base64Image = await imageToBase64(certificateUrl);
                certificateImg.src = base64Image;
                console.log('Certificate background loaded successfully');
            } catch (error) {
                console.log('Certificate background not available, using fallback');
                // Elegant fallback certificate design with CSS
                certificateImg.style.display = 'none';
                const container = document.getElementById('certificateContainer');
                container.style.background = `
                    linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%),
                    repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(102, 126, 234, 0.05) 10px, rgba(102, 126, 234, 0.05) 20px)
                `;
                container.style.border = '20px solid #667eea';
                container.style.boxShadow = 'inset 0 0 100px rgba(102, 126, 234, 0.2)';
            }
        }

        // Initialize application
        async function initialize() {
            try {
                const selecttag = document.getElementById('franchiseelist');
                const labfullname = document.getElementById('labname');
                const dateInput = document.getElementById('date');

                // Set current date
                dateInput.valueAsDate = new Date();

                // Load current user
                selecttag.innerHTML = '';
                const userOption = document.createElement('option');
                userOption.value = user.fullName;
                userOption.innerText = user.username;
                selecttag.appendChild(userOption);
                
                labfullname.value = user.fullName;
                franchiseArray.push(user);

                // Load certificate components
                await setCredentials();
                await loadCertificateBackground();

                // Try to load franchisees (optional)
                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${user._id}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data.success && data.message && data.message.length > 0) {
                            data.message.forEach(element => {
                                const option = document.createElement('option');
                                option.value = element.fullName;
                                option.innerText = element.username;
                                selecttag.appendChild(option);
                                franchiseArray.push(element);
                            });
                            console.log('Franchisees loaded successfully');
                        } else {
                            console.log('No franchisees found');
                        }
                    }
                } catch (error) {
                    console.log('Franchisees not loaded:', error.message);
                }

                // Select change event
                selecttag.addEventListener('change', function (e) {
                    labfullname.value = e.target.value;
                });

                console.log('Application initialized successfully');
            } catch (error) {
                console.error('Initialization error:', error);
                alert('Failed to initialize. Please refresh the page.');
            }
        }

        // Generate certificate
        document.getElementById('generateBtn').addEventListener('click', async function () {
            const selecttag = document.getElementById('franchiseelist');
            const dateInput = document.getElementById('date');
            const generatebtn = this;

            // Validation
            if (!selecttag.value) {
                alert('Please select a user');
                return;
            }

            if (!dateInput.valueAsDate) {
                alert('Please select a valid date');
                return;
            }

            const object = franchiseArray.find(element => element.fullName === selecttag.value);

            if (!object) {
                alert('Selected user not found');
                return;
            }

            // Update certificate data
            const nameSpan = document.querySelector(".namediv span");
            const dateDiv = document.querySelector(".datediv");

            if (nameSpan) nameSpan.innerText = object.fullName;
            
            const tempDate = new Date(dateInput.valueAsDate);
            tempDate.setFullYear(tempDate.getFullYear() + 1);
            const selectedDate = tempDate.toLocaleDateString("en-GB");
            if (dateDiv) dateDiv.innerText = `This certificate is valid till ${selectedDate}`;

            const certificateDiv = document.querySelector(".certificatedImgdiv");
            if (!certificateDiv) {
                alert('Certificate template not found');
                return;
            }

            // Show loading state
            generatebtn.disabled = true;
            const originalText = generatebtn.innerHTML;
            generatebtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

            try {
                // Show certificate for rendering
                certificateDiv.style.display = 'block';
                
                // Wait for images to render properly
                await new Promise(resolve => setTimeout(resolve, 500));

                // Prepare PDF data with cleaned HTML
                const clonedDiv = certificateDiv.cloneNode(true);
                clonedDiv.style.margin = '0';
                clonedDiv.style.padding = '0';
                
                // Wrap in a clean container for PDF
                const pdfWrapper = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { margin: 0; padding: 0; width: 297mm; height: 210mm; }
                        ${document.getElementById("style").innerHTML}
                    </style>
                </head>
                <body>
                    ${clonedDiv.outerHTML}
                </body>
                </html>
                `;
                
                console.log('PDF data prepared');

                // Send to backend for PDF generation
                const response = await fetch(`${BASE_URL}/api/v1/user/certificatepdfgenerator`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        pdfHtml: pdfWrapper,
                        userId: object._id 
                    })
                });

                if (!response.ok) {
                    throw new Error(`PDF generation failed: ${response.status}`);
                }

                const pdfblob = await response.blob();
                const pdfUrl = URL.createObjectURL(pdfblob);

                const anchor = document.createElement("a");
                anchor.href = pdfUrl;
                anchor.download = `${object.fullName}-certificate.pdf`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);

                setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);

                // Hide certificate after PDF generation
                certificateDiv.style.display = 'none';

                alert('Certificate generated successfully!');

            } catch (error) {
                console.error("Error generating certificate:", error);
                alert('Failed to generate certificate. Please try again.');
            } finally {
                generatebtn.disabled = false;
                generatebtn.innerHTML = originalText;
            }
        });

        // Initialize on load
        initialize();
