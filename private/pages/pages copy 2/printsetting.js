const BASE_URL = window.location.origin;
function toggleAccordion(button) {
    const content = button.nextElementSibling;
    const icon = button.querySelector('.icon');
    content.classList.toggle('show');
    button.classList.toggle('active');
}
(async function () {
    const value1 = localStorage.getItem('myKey');

    const fetchDataAndSetInputs = async () => {
        try {
            // Send a POST request to the API with value1 in the request body
            const response = await fetch(`${BASE_URL}/api/v1/user/getting-pdf-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reportId: value1 }),
            });

            // Check if the response is okay
            if (!response.ok) {
                throw new Error('Failed to fetch data from API');
            }

            // Parse the response JSON
            const data = await response.json();

            const headermargin = (Number(data.headermargin) - (Number(data.headermargin) * 0.35)) + 1.8;
            const footermargin = (Number(data.footermargin) + 1.2) - (Number(data.footermargin) === 1 ? 0 : Number(data.footermargin) * 0.3);
            const middledivconatiner = document.getElementById('outermeasurebox');
            const middlescaleheight = (Number(middledivconatiner.offsetHeight) / 37.8).toFixed(2);
            console.log("middledivconatiner:", middlescaleheight);
            const middledivmeasureheightincm = `${(middlescaleheight - (headermargin + footermargin + 0.5)).toFixed(2)}cm`;
            console.log("middledivmeasureheightincm:", middledivmeasureheightincm);
            document.getElementById('header').value = data.headermargin || '';
            document.getElementById('headermeasurescale').innerText = `${Number(data.headermargin) + 3.2}cm` || '';
            document.getElementById('headermargininfospan').innerText = `${data.headermargin}cm` || '';
            document.getElementById('headermeasurescalebigbox').style.height = `${headermargin}cm`;
            document.getElementById('footermeasurescale').innerText = `${Number(data.footermargin) + 1.8}cm` || '';
            document.getElementById('footermargininfospan').innerText = `${data.footermargin}cm` || '';
            document.getElementById('footermeasurescalebigbox').style.height = `${footermargin}cm`;
            document.getElementById('middlemeasurescale').innerText = middledivmeasureheightincm || '';
            document.getElementById('middlemeasurescalebigbox').style.height = middledivmeasureheightincm;
            document.getElementById('middlemeasurescalebigbox').style.top = `${headermargin + 0.22}cm`;
            document.getElementById('footer').value = data.footermargin || '';
            document.getElementById('margin-right').value = data.marginRight || '';
            document.getElementById('margin-left').value = data.marginLeft || '';
            document.getElementById('show-lab').checked = data.labinchargesign || false;
            document.getElementById('pdf-font-size').value = data.selectedFontSize || 12;
            document.getElementById('spacing').value = data.RowSpacing || 1;
            document.getElementById('high-low-marker').checked = data.HighLow;
            document.getElementById('abnormal-results-red').checked = data.HLinred;
            document.getElementById('abnormal-results-bold').checked = data.BoldRow;
            document.getElementById('show-investigations').checked = data.showInvest;

            console.log('Input fields updated successfully');
        } catch (error) {
            console.error('Error fetching data and setting inputs:', error.message);
        }
    };

    const fetchLabSignAndSetInputs = async () => {
        try {
            // Send a POST request to the API with value1 in the request body
            const response = await fetch(`${BASE_URL}/api/v1/user/getDoctorsSign`);

            // Check if the response is okay
            if (!response.ok) {
                throw new Error('Failed to fetch data from API');
            }

            // Parse the response JSON
            const data = await response.json();
            console.log(data);
            if (data) {
                document.getElementById('lab-info').value = data.labinchargeinfo || '';
                document.getElementById('firstdoctor-info').value = data.firstdoctorsigninfo || '';
                document.getElementById('seconddoctor-info').value = data.seconddoctorsigninfo || '';
                document.getElementById('show-lab').checked = data.showlabinchargesign;
                document.getElementById('show-doctor1').checked = data.showfirstdoctorsign;
                document.getElementById('show-doctor2').checked = data.showseconddoctorsign;

                const labSignImgdiv = document.getElementById('labSignImgdiv');
                labSignImgdiv.innerHTML = '';
                if (data.labinchargesign) {
                    labSignImgdiv.setAttribute("data-id", data._id);
                    labSignImgdiv.innerHTML = `
                    <img src="${data.labinchargesign}" data-srcfeild="labinchargesign" id="labinchargesign" data-publicfeild="labinchargesignpublicid" data-asset="${data.labinchargesignpublicid}" alt="Lab Incharge Sign" height="50"; width="100";>
                    <span class="deleteIcon">✕</span>`
                }

                const firstSignImgdiv = document.getElementById('firstSignImgdiv');
                firstSignImgdiv.innerHTML = '';
                if (data.firstdoctorsign) {
                    firstSignImgdiv.setAttribute("data-id", data._id);

                    firstSignImgdiv.innerHTML = `
                    <img src="${data.firstdoctorsign}" data-srcfeild="firstdoctorsign" id="firstdoctorsign" data-publicfeild="firstdoctorsignpublicid" data-asset="${data.firstdoctorsignpublicid}" alt="Lab Incharge Sign" height="50"; width="100";>
                    <span class="deleteIcon">✕</span>`
                }

                const seconddoctorinfo = document.getElementById('secondSignImgdiv');
                seconddoctorinfo.innerHTML = '';
                if (data.seconddoctorsign) {
                    seconddoctorinfo.setAttribute("data-id", data._id);

                    seconddoctorinfo.innerHTML = `
                    <img src="${data.seconddoctorsign}" data-srcfeild="seconddoctorsign" id="seconddoctorsign" data-publicfeild="seconddoctorsignpublicid" data-asset="${data.seconddoctorsignpublicid}" alt="Lab Incharge Sign" height="50"; width="100";>
                    <span class="deleteIcon">✕</span>`;
                }
            }

            console.log('Input fields updated successfully');

        } catch (error) {
            console.error('Error fetching data and setting inputs:', error.message);
        }
    };


    async function selectionimage() {
        const images = document.querySelectorAll('.image');

        images.forEach(image => {
            // Create a container for each image with a delete icon
            const container = document.createElement('div');
            container.classList.add('image-container');

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon');
            deleteIcon.innerHTML = '&#x2715;'; // Unicode for the "X" symbol (close)

            // Wrap the image with the container and append the delete icon
            container.appendChild(image.cloneNode(true)); // Clone the image
            container.appendChild(deleteIcon);
            image.replaceWith(container); // Replace the original image with the container

            deleteIcon.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering image selection

                const imageUrl = image.src; // Use the image URL
                const public_id = image.getAttribute('data-asset');

                if (imageUrl) {
                    try {
                        // Send a request to delete the image by its URL
                        const response = await fetch(`${BASE_URL}/api/v1/user/delete-image`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ url: imageUrl, public_id }), // Send the URL in the request body
                        });
                        const result = await response.json();

                        if (response.ok) {
                            // Remove the image container from the DOM
                            container.remove();
                            alert('template deleted successfully')
                        } else {
                            alert(`Failed to delete the image: ${result.message}`);
                        }
                    } catch (error) {
                        console.error('Error deleting image:', error);
                        alert('Error deleting the image.');
                    }
                }
            });


            // Handle image selection and deselection (click event)
            container.querySelector('.image').addEventListener('click', () => {
                const selectedImage = document.querySelector('.image.selected');
                if (selectedImage) {
                    selectedImage.classList.remove('selected');
                }
                container.querySelector('.image').classList.add('selected');
            });
        });
    }

    async function imagedeletion() {

        document.querySelectorAll('.deleteIcon').forEach((icon) => {
            icon.addEventListener('click', async function (e) {
                console.log("clicked");

                const parentDiv = icon.parentElement; // icon ka direct parent (e.g. labSignImgdiv, firstSignImgdiv)
                const imgtag = parentDiv.querySelector('img');
                const urlfield = imgtag.getAttribute('data-srcfeild')
                const publicIdfield = imgtag.getAttribute('data-publicfeild')
                const publicId = imgtag.getAttribute('data-asset');

                try {
                    // Send a request to delete the image by its URL
                    const response = await fetch(`${BASE_URL}/api/v1/user/deleteLabInchargeSign`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ publicId, urlfield, publicIdfield }), // Send the URL in the request body
                    });
                    const result = await response.json();

                    if (response.ok) {
                        await fetchLabSignAndSetInputs();
                        imagedeletion();
                    } else {
                        alert(`Failed to delete the image: ${result.message}`);
                    }
                } catch (error) {
                    console.error('Error deleting image:', error);
                    alert('Error deleting the image.');
                }

            });
        });

        // if (deleteIcon) {
        //     deleteIcon.addEventListener('click', async () => {
        //         const imagecontainer = deleteIcon.closest('#labSignImgdiv');
        //         const id = imagecontainer.getAttribute('data-id');
        //         const imageTag = imagecontainer.querySelector('img');
        //         const publicId = imageTag.getAttribute('data-asset');
        //         const imageUrl = imageTag.src;

        //         if (imageUrl) {
        //             try {
        //                 // Send a request to delete the image by its URL
        //                 const response = await fetch(`${BASE_URL}/api/v1/user/deleteLabInchargeSign`, {
        //                     method: 'POST',
        //                     headers: {
        //                         'Content-Type': 'application/json',
        //                     },
        //                     body: JSON.stringify({ url: imageUrl, id, publicId }), // Send the URL in the request body
        //                 });
        //                 const result = await response.json();

        //                 if (response.ok) {
        //                     // Remove the image container from the DOM
        //                     location.reload();
        //                 } else {
        //                     alert(`Failed to delete the image: ${result.message}`);
        //                 }
        //             } catch (error) {
        //                 console.error('Error deleting image:', error);
        //                 alert('Error deleting the image.');
        //             }
        //         }
        //     });
        // }
    }

    async function fetchTemplateImages() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/templates`, { method: "POST" }); // Update URL as per your backend
            const data = await response.json();
            console.log("this is urls: ", data.urls);

            if (data.urls && Array.isArray(data.urls)) {
                const container = document.getElementById('images-div'); // Assuming you have a container with this ID
                let order = 1;

                data.urls.forEach((url) => {
                    const img = document.createElement('img');
                    img.src = url.template;
                    img.classList.add('image');
                    img.setAttribute('data-id', order++);
                    img.setAttribute('data-asset', url.public_id)
                    img.alt = 'Template Image';
                    container.appendChild(img);
                });
            } else {
                console.error('No URLs found:', data);
            }
        } catch (error) {
            console.error('Error fetching template images:', error);
        }
    };

    // end populating data=================================================================================

    async function autogeneratingpdf({ value1, checkBox = false, showlab, showdoctorfirst, showdoctorsecond,
        backgroundImageUrl = null, headermargin, footermargin, marginRight, marginLeft,
        selectedFontSize, RowSpacing, HighLow, HLinred: HLinred,
        BoldRow, showInvest, fileInputLab, fileInputDoctorleft, fileInputDoctorright, fileInputLabtext
        , fileInputDoctorlefttext, fileInputDoctorrighttext } = {}) {
        const loader = document.querySelector('.loaderDiv');
        const value2 = localStorage.getItem('myKey');
        console.log("value2 is:", value2);


        try {
            loader.style.display = 'flex';
            const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // body: JSON.stringify({ htmlContent, cssContent, header, footer, backgroundImageUrl, value1 }),
                body: JSON.stringify({
                    value1: value2, checkBox, backgroundImageUrl,
                    headermargin, footermargin, marginRight, marginLeft, selectedFontSize, RowSpacing,
                    HighLow, HLinred,
                    BoldRow, showInvest, showlab, showdoctorfirst, showdoctorsecond, fileInputLab,
                    fileInputDoctorleft, fileInputDoctorright, fileInputLabtext, fileInputDoctorlefttext,
                    fileInputDoctorrighttext
                })
            });

            if (!response.ok) throw new Error('PDF generation failed');

            // Create a Blob from the response
            const pdfBlob = await response.blob();

            // Create a URL for the Blob
            const pdfUrl = URL.createObjectURL(pdfBlob);

            // Set the URL in the iframe
            const iframe = document.getElementById('pdf-preview');
            if (iframe) {
                iframe.src = pdfUrl;
            } else {
                console.error('Iframe with ID "pdf-preview" not found!');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            loader.style.display = 'none';
        }
    }

    const checkBox = document.getElementById('check1'); // Get the checkbox element

    checkBox.addEventListener('change', function () {
        if (checkBox.checked) {
            // Without background
            autogeneratingpdf({ checkBox: checkBox.checked });
        } else {
            autogeneratingpdf({ checkBox: checkBox.checked });
        }
    })

    async function Initialization() {
        await fetchDataAndSetInputs();
        await fetchLabSignAndSetInputs();
        await fetchTemplateImages();
        await autogeneratingpdf();
        imagedeletion();
        selectionimage();
    }


    Initialization();

    document.getElementById('uploadTemplate').addEventListener('click', async function () {
        const fileInput = document.getElementById('fileInput');
        const messageElement = document.getElementById('message');
        let selectedImage = document.querySelector('.image.selected');
        let imageUrlToSend = null; // URL to send to the backend
        const headermargin = document.getElementById("header").value;
        const footermargin = document.getElementById("footer").value;
        const marginRight = document.getElementById("margin-right").value;
        const marginLeft = document.getElementById("margin-left").value;

        // Ensure the first image is selected by default if no other image is selected
        if (!selectedImage) {
            selectedImage = document.querySelector('.image');
            if (selectedImage) {
                selectedImage.classList.add('selected');
            }
        }

        if (fileInput && fileInput.files.length > 0) {
            // Case 1: File is uploaded
            const file = fileInput.files[0];

            if (!file.type.startsWith('image/')) {
                messageElement.textContent = 'Only image files are allowed.';
                return;
            }

            // Upload the file to the backend
            const formData = new FormData();
            formData.append('template', file);

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/template`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    messageElement.textContent = 'File uploaded successfully!';
                    imageUrlToSend = result.url; // Use the uploaded file's URL
                    await autogeneratingpdf({ backgroundImageUrl: imageUrlToSend, headermargin, footermargin, marginRight, marginLeft }); // Generate the PDF with the uploaded file
                    fetchDataAndSetInputs();
                    return; // Exit early since uploaded file is prioritized
                } else {
                    const errorResult = await response.json();
                    messageElement.textContent = `Error: ${errorResult.message}`;
                    return;
                }
            } catch (error) {
                messageElement.textContent = 'An error occurred while uploading the file.';
                console.error('Upload error:', error);
                return;
            }
        }

        // Case 2: Use the selected image if available
        if (selectedImage) {
            imageUrlToSend = selectedImage.src;
        }

        // Case 3: If no file is uploaded and no image is selected, use the first image
        if (!imageUrlToSend) {
            const firstImage = document.querySelector('.image');
            if (firstImage) {
                imageUrlToSend = firstImage.src;
            }
        }

        // Ensure the image URL is sent to generate the PDF
        if (imageUrlToSend) {
            await autogeneratingpdf({ backgroundImageUrl: imageUrlToSend, headermargin, footermargin, marginRight, marginLeft });
            messageElement.textContent = 'PDF generated successfully with the selected/default image!';
            fetchDataAndSetInputs();
        } else {
            messageElement.textContent = 'No image or file available to generate the PDF.';
        }
    });

    document.getElementById('updateSign').addEventListener('click', async function () {
        const showlab = document.getElementById('show-lab').checked;
        const showdoctorfirst = document.getElementById('show-doctor1').checked;
        const showdoctorsecond = document.getElementById('show-doctor2').checked;
        const fileInputLab = document.getElementById('lab-sign-file');
        const fileInputDoctorleft = document.getElementById('doctor-left-file');
        const fileInputDoctorright = document.getElementById('Doctor-Right-file');
        const fileInputLabtext = document.getElementById('lab-info').value;
        const fileInputDoctorlefttext = document.getElementById('firstdoctor-info').value;
        const fileInputDoctorrighttext = document.getElementById('seconddoctor-info').value;

        const labsigndiv = document.getElementById('labSignImgdiv');
        const imgUrl = labsigndiv.querySelector('img')?.src;
        console.log("this is the image Url", imgUrl);

        const file1 = fileInputLab?.files?.[0];
        const file2 = fileInputDoctorleft?.files?.[0];
        const file3 = fileInputDoctorright?.files?.[0];

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

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/uploadDoctorsSign`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                await fetchLabSignAndSetInputs();
                await imagedeletion();
                const showlab = document.getElementById('show-lab').checked;
                const showdoctorfirst = document.getElementById('show-doctor1').checked;
                const showdoctorsecond = document.getElementById('show-doctor2').checked;
                const fileInputLab = document.getElementById('labinchargesign').src;
                const fileInputDoctorleft = document.getElementById('firstdoctorsign').src;
                const fileInputDoctorright = document.getElementById('seconddoctorsign').src;
                const fileInputLabtext = document.getElementById('lab-info').value;
                const fileInputDoctorlefttext = document.getElementById('firstdoctor-info').value;
                const fileInputDoctorrighttext = document.getElementById('seconddoctor-info').value;
                const value1 = localStorage.getItem('myKey');

                autogeneratingpdf({
                    value1, showlab: showlab, showdoctorfirst: showdoctorfirst, showdoctorsecond: showdoctorsecond, fileInputLab: fileInputLab,
                    fileInputDoctorleft: fileInputDoctorleft, fileInputDoctorright: fileInputDoctorright,
                    fileInputLabtext: fileInputLabtext, fileInputDoctorlefttext: fileInputDoctorlefttext,
                    fileInputDoctorrighttext: fileInputDoctorrighttext
                })
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert("An error occurred during upload.");
        }
    });

    document.getElementById('updateGeneral').addEventListener('click', async function () {
        const selectedFontSize = document.getElementById('pdf-font-size').value;
        const RowSpacing = document.getElementById('spacing').value;
        const HighLow = document.getElementById('high-low-marker').checked;
        const HLinred = document.getElementById('abnormal-results-red').checked;
        const BoldRow = document.getElementById('abnormal-results-bold').checked;
        const showInvest = document.getElementById('show-investigations').checked;

        autogeneratingpdf({
            selectedFontSize: selectedFontSize, RowSpacing: RowSpacing,
            HighLow: HighLow, HLinred: HLinred, BoldRow: BoldRow, showInvest: showInvest
        }); // Generate the PDF with the uploaded file
    });

    // Function to validate input field values and update button state
    function validateField(input, min, max) {
        const value = parseFloat(input.value);
        const errorId = input.id + "-error";
        const errorElement = document.getElementById(errorId);

        if (isNaN(value) || value < min || value > max) {
            errorElement.textContent = `Value must be between ${min} and ${max} cm.`;
            errorElement.style.color = "red";
            input.style.borderColor = "red";
        } else {
            errorElement.textContent = "";
            input.style.borderColor = "green";
        }

        // Call function to update button state
        updateButtonState();
    }

    // Function to check all fields and enable/disable the button
    function updateButtonState() {
        const fields = ['header', 'footer', 'margin-right', 'margin-left'];
        let isValid = true;

        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            const errorId = fieldId + "-error";
            const errorElement = document.getElementById(errorId);

            // If any error message is present, mark form as invalid
            if (errorElement.textContent) {
                isValid = false;
            }
        });

        // Enable or disable the update button based on form validity
        const updateButton = document.getElementById('uploadTemplate');
        if (isValid) {
            updateButton.removeAttribute('disabled');
            updateButton.style.cursor = 'pointer';
        } else {
            updateButton.setAttribute('disabled', true);
            updateButton.style.cursor = 'not-allowed';
        }
    }

    // Attach validation to input fields
    document.getElementById('header').addEventListener('input', () => validateField(document.getElementById('header'), 0, 10));
    document.getElementById('footer').addEventListener('input', () => validateField(document.getElementById('footer'), 0, 6));
    document.getElementById('margin-right').addEventListener('input', () => validateField(document.getElementById('margin-right'), 0, 4));
    document.getElementById('margin-left').addEventListener('input', () => validateField(document.getElementById('margin-left'), 0, 4));

    // Initial call to disable the button on page load
    updateButtonState();

    // Add event listener to the back button
    document.getElementById('close-btn').addEventListener('click', function () {
        const bookingId = localStorage.getItem('myKey');
        const format = localStorage.getItem('pdfformat');
        window.location.href = `http://localhost:3000/admin.html?page=${format}&value1=${bookingId}`;
    });

    function verifyinputfeilds() {
        const textareainfo = document.querySelectorAll('.signDiv textarea');
        const errormessage = document.getElementById('errormessage');
        let maxlength = 75;
        textareainfo.forEach((feild) => {
            feild.addEventListener('input', () => {
                if (feild.value.length >= maxlength) {
                    errormessage.style.display = "block";
                    errormessage.textContent = "❗ Maximum 75 characters allowed";
                } else {
                    errormessage.style.display = "none";
                    errormessage.textContent = ""
                }
            })
        })
    }
    verifyinputfeilds();

})();
