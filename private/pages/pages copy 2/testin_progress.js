async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
    if(!franchiseeId){
        franchiseeId = userId;
    }
    const tableBody = document.querySelector('.table-container tbody');


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
                <td>${index + 1}</td>
                <td><a href="#">${booking.bookingId}</a></td>
                <td>${booking.patientName}</td>
                <td>${booking.gender} (${booking.year})</td>
                <td>${tests}</td>
                <td>${sampleId || 'N/A'}</td>
                  <td style="color: ${booking.status}; font-weight: bold;"></td>
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

document.querySelector(".table-container").addEventListener("click", async function (event) {
    const anchor = event.target.closest("a"); // Check if the clicked element or its parent is an anchor tag

    if (!anchor) return; // If not an <a> tag, do nothing

    event.preventDefault(); // Prevent default link behavior

    const bookingId = anchor.textContent.trim(); // Extract Booking ID
    if (!bookingId) return; // If Booking ID is empty, do nothing

    try {
        showLoader(); // ✅ Loader start karein
        const patientDetails = await fetchreport(bookingId);
        if (!patientDetails) {
            console.error("Patient details not found");
            hideLoader(); // ❌ Agar error aaye toh loader band karein
            return;
        }

        await autogeneratingpdf({ value1: patientDetails._id });

    } catch (error) {
        console.error("Error fetching report:", error);
    } finally {
        hideLoader(); // ✅ Loader hide karein chahe success ho ya error
    }
});

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
            throw new Error("Something went wrong");
        }

        return await response.json(); // Return parsed JSON response
    } catch (error) {
        console.error(error);
        return null; // Return null if error occurs
    }
}

async function autogeneratingpdf({
    value1,
    labinchargesign = null, checkBox = false, labinchargeinfo = "",
    backgroundImageUrl = null, headermargin, footermargin,
    marginRight, marginLeft, labinchargesignurl = null,
    selectedFontSize, RowSpacing, HighLow, HLinred,
    BoldRow, showInvest
} = {}) {
    try {
        showLoader(); // ✅ PDF request bhejne se pehle loader dikhayein

        const response = await fetch(`${BASE_URL}/api/v1/user/get-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                value1, labinchargesign, checkBox, backgroundImageUrl,
                headermargin, footermargin, marginRight, marginLeft,
                labinchargeinfo, labinchargesignurl, selectedFontSize,
                RowSpacing, HighLow, HLinred, BoldRow, showInvest
            })
        });

        if (!response.ok) throw new Error('PDF generation failed');

        // Create a Blob from the response
        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Automatically trigger the download
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = 'report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl); // Release memory for the Blob URL

    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        hideLoader(); // ✅ PDF download hone ke baad loader band karein
    }
}
function showLoader() {
    const loader = document.getElementById("loader1");
    console.log("Loader Element:", loader); // Debugging
    if (!loader) {
        console.error("Loader element not found!");
        return;
    }
    loader.style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("loader1"); // Corrected ID
    if (!loader) {
        console.error("Loader element not found!"); // Debugging message
        return;
    }
    loader.style.display = "none"; // Hide loader
}
