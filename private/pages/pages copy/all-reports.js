(function hort(){
async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
    if (!franchiseeId) {
        franchiseeId = userId;
    }
    const tableBody = document.querySelector('#tab');
    
    // Construct the query parameters for the API request
    let query = `?status=completed&startDate=${startDate}&endDate=${endDate}`;
    if (franchiseeId) {
        query += `&franchiseeId=${franchiseeId}`;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/bookings${query}`);
        if (!response.ok) throw new Error('Failed to fetch bookings');

        const bookings = await response.json();
        console.log(bookings);

        // Clear the table
        tableBody.innerHTML = '';

        // Create a document fragment to minimize reflows
        const fragment = document.createDocumentFragment();

        // Populate the table
        bookings.forEach((booking, index) => {
            // Format tests from tableData
            const tests = Array.isArray(booking.tableData)
                ? booking.tableData.map(test => `${test.testName} (${test.typeOfSample}) - ${test.barcodeId}`).join('<br>')
                : 'No tests available';

            const sampleId = Array.isArray(booking.tableData) && booking.tableData[0]?.barcodeId
                ? booking.tableData[0].barcodeId // Use the first barcodeId as the sampleId
                : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox"></td>
                <td><a href="#">${booking.bookingId}</a></td>
                <td>${booking.patientName}</td>
                <td>${sampleId || 'N/A'}</td>
                <td>${booking.doctorName}</td>
                 <td>${tests}</td>   
            `;
            fragment.appendChild(row);
        });

        // Append the document fragment to the table body
        tableBody.appendChild(fragment);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        // Display a user-friendly message if the API call fails
        alert('Failed to load bookings. Please try again later.');
    }
}
// for fetching sub-franchisees
async function subfranchisee() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { method: "GET" })
        const allsubfran = await response.json();
        const subFranchiseeSelect = document.getElementById('franchisee-select');
        allsubfran.message.forEach(subfran => {
            const testElement = document.createElement('option');
            testElement.id = "tests-name-option";
            testElement.classList.add('subFranchisee-option');
            testElement.setAttribute("data-id", subfran._id);

            testElement.innerText = `${subfran.fullName}`;
            subFranchiseeSelect.appendChild(testElement);
        });
    } catch (error) {
        console.error("Sub franchisee not created")
    }
}
(async function loadBookings() {
    await subfranchisee()
    await fetchBookings()
    })();
// Initial fetch when the page loads (default to last 24 hours)
// Handle search functionality
document.querySelector('#search-button').addEventListener('click', function() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
       // Get the selected option from the franchisee-select dropdown
       const franchiseeSelect = document.getElementById('franchisee-select');
       
       const selectedOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];  // Get the selected option
   
       // Now, get the data-id from the selected option
       const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;
   

    // Check if start and end date are selected
    // if (!startDate || !endDate) {
    //     alert('Please select both start and end dates');
    //     return;
    // }

    fetchBookings(startDate, endDate, franchiseeId);
});

//Fetch initial bookings on page load
async function downloadPdf() {
    // Add event listener to the table container (or parent element)
    document.querySelector(".table-container").addEventListener("click", async function (event) {
        const startDate = document.getElementById('myselect').value;
        const anchor = event.target.closest("a"); // Check if the clicked element or its parent is an anchor tag
        async function autogeneratingpdf({ labinchargesign = null, checkBox = false, labinchargeinfo = "",
            backgroundImageUrl = null, headermargin, footermargin, marginRight, marginLeft,
            labinchargesignurl = null, selectedFontSize, RowSpacing, HighLow, HLinred: HLinred,
            BoldRow, showInvest } = {}) {

        if (anchor) {
            event.preventDefault(); // Prevent default link behavior

            const bookingId = anchor.textContent.trim(); // Extract the Booking ID

            patientDetails = await fetchreport(bookingId);

                // const loader = document.querySelector('.loaderDiv');

                try {
                    // loader.style.display = 'flex';
                    const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        // body: JSON.stringify({ htmlContent, cssContent, header, footer, backgroundImageUrl, value1 }),
                        body: JSON.stringify({
                            value1: patientDetails._id, labinchargesign, checkBox: startDate === "with"? false : true, labinchargeinfo, backgroundImageUrl, headermargin, footermargin, marginRight
                            , footermargin, marginRight, marginLeft, labinchargeinfo,
                            labinchargesignurl, selectedFontSize, RowSpacing, HighLow, HLinred,
                            BoldRow, showInvest
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
                    link.download = 'report.pdf'; // Specify the filename for the download
                    document.body.appendChild(link); // Add the link to the DOM
                    link.click(); // Programmatically trigger a click event
                    document.body.removeChild(link); // Remove the link from the DOM
                    URL.revokeObjectURL(pdfUrl); // Release memory for the Blob URL
                } catch (error) {
                    console.error('Error generating PDF:', error);
                } finally {
                    // loader.style.display = 'none';
                }
        }}
            autogeneratingpdf();
        
    });
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

downloadPdf();

// Function to handle the click on "Download Selected Reports"
document.getElementById('download-selected-reports').addEventListener('click', async function () {
    // Get all checkboxes in the table
    const checkboxes = document.querySelectorAll('#tab input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        alert('Please select at least one booking.');
        return;
    }

    // Loop through all checked checkboxes and collect booking IDs
    const bookingIds = Array.from(checkboxes).map(checkbox => {
        const row = checkbox.closest('tr');  // Find the closest row (tr)
        return row.querySelector('td:nth-child(2) a').textContent.trim();  // Get the Booking ID from the second column
    });

    // Trigger report download for each selected booking
    for (let bookingId of bookingIds) {
        // Fetch report and download PDF for each selected booking
        await downloadReportForBooking(bookingId);
    }
});

// Function to download the report for a single booking
async function downloadReportForBooking(bookingId) {
    try {
        // Fetch the patient details using the bookingId
        const patientDetails = await fetchreport(bookingId);

        // Use the existing autogeneratingpdf function to download the PDF
        await autogeneratingpdf({
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
            showInvest: null
        });

    } catch (error) {
        console.error(`Error downloading report for Booking ID ${bookingId}:`, error);
    }
    
}})()
