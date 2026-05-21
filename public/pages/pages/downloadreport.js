async function loadInfoandDownloadreport() {
    const downloadbtn = document.getElementById('download-btn');
    // Get the query string from the current URL
    const urlParams = new URLSearchParams(window.location.search);

    // Extract the value of the 'value' parameter
    const value1 = urlParams.get('value');
    const tenantId = urlParams.get('id');
    //console.log("this is a value1:",value1)

    let patientDetails;

    patientDetails = await fetchreport();
    if (patientDetails) {
        details();
    }


    async function fetchreport() {
        try {
            const response = await fetch(`/api/v1/user/ReportData-user`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ value1, tenantId })
            });

            if (!response.ok) {
                throw new Error("something went wrong")
            }

            // Wait for the response to be parsed as JSON
            return await response.json();

        } catch (error) {
            //alert("reportdata not fetch");
            console.log(error)
        }
    }

    async function generatingpdf({ value1, labinchargesign = null, checkBox = false, labinchargeinfo = "",
        backgroundImageUrl = null, headermargin, footermargin, marginRight, marginLeft,
        labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow, HLinred,
        BoldRow, showInvest, DownloadPdf = false } = {}) {
        // Disable the button and show the loader (optional)
        const buttonLoader = document.getElementById('button-loader');

        buttonLoader.style.display = 'flex';
        downloadbtn.disabled = true;

        try {
            // loader.style.display = 'flex';
            const response = await fetch(`/api/v1/user/get-pdf-user`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/pdf',
                    'Content-Type': 'application/json',
                },
                // body: JSON.stringify({ htmlContent, cssContent, header, footer, backgroundImageUrl, value1 }),
                body: JSON.stringify({
                    value1, labinchargesign, checkBox, labinchargeinfo, backgroundImageUrl,
                    headermargin, footermargin, marginRight, marginLeft,
                    labinchargesignurl, selectedFontSize, RowSpacing, HighLow, HLinred,
                    BoldRow, showInvest, DownloadPdf, pdfFormat: patientDetails.pdfFormat,
                    layerOne: patientDetails.layerOne
                })

            });

            if (!response.ok) throw new Error('PDF generation failed');

            // Create a Blob from the response
            const pdfBlob = await response.blob();

            // Create a URL for the Blob
            const pdfUrl = URL.createObjectURL(pdfBlob);

            // Automatically trigger the download
            const link = document.createElement('a'); // Create a hidden <a> element
            link.href = pdfUrl; // Set the Blob URL
            link.download = `${patientDetails.patientName}.pdf`; // Specify the filename for the download
            document.body.appendChild(link); // Add the link to the DOM
            link.click(); // Programmatically trigger a click event
            document.body.removeChild(link); // Remove the link from the DOM
            URL.revokeObjectURL(pdfUrl); // Release memory for the Blob URL
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            // buttonText.style.display = 'flex';
            buttonLoader.style.display = 'none';
            downloadbtn.disabled = false;
        }
    }

    // Attach the function to the button click event
    downloadbtn.addEventListener('click', async function (e) {
        //alert("download button clicked");
        const button = e.target;
        button.disabled = true;

        if (!patientDetails || !patientDetails._id) {
            alert("Patient data missing.");
            return;
        }

        try {
            // Use the existing autogeneratingpdf function to download the PDF
            await generatingpdf({
                value1: patientDetails._id, // Pass necessary params for PDF generation
                labinchargesign: null,
                checkBox: false,
                labinchargeinfo: "",
                backgroundImageUrl: null,
                headermargin: null,
                footermargin: null,
                marginRight: null,
                marginLeft: null,
                labinchargesignurl: null,
                selectedFontSize: null,
                RowSpacing: null,
                HighLow: null,
                HLinred: null,
                BoldRow: null,
                showInvest: null,
                DownloadPdf: false,
            });
        } catch (error) {
            console.error(error);
        } finally {
            button.disabled = false;
        }
    });


    function details() {
        const name = document.querySelector('.self h2');
        const AgeDate = document.querySelector('.self p');

        // Create a Date object from the string
        const dateObj = new Date(patientDetails.date);

        // Extract the date in the desired format (YYYY-MM-DD)
        const dateOnly = dateObj.toISOString().split('T')[0];

        name.innerHTML = `${patientDetails.patientName}`;

        AgeDate.innerHTML = `${patientDetails.year} / ${patientDetails.gender} <br> ${dateOnly}`;

    }
}

loadInfoandDownloadreport();
