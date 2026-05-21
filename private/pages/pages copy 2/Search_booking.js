// Event listener for search button
document.getElementById('search-button').addEventListener('click', function () {
    const searchValue = document.getElementById('search-input').value.trim();

    if (!searchValue) {
        alert('Please enter a search term.');
        return;
    }

    // Fetch data from your server
    fetch(`${BASE_URL}/api/v1/user/bookings-search?search=${searchValue}&userId=${userId}`) // Replace with your actual API endpoint
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch data.');
            }
            return response.json();
        })
        .then(data => {
            // Clear previous table rows
            console.log(data)
            const tableBody = document.getElementById('table-body');
            tableBody.innerHTML = '';

            if (data.bookings && data.bookings.length > 0) {
                // Add rows dynamically
                data.bookings.forEach(booking => {
                    const barcodes = booking.tableData.map(data => data.barcodeId).join(', ') || '';
                    const testNames = booking.tableData.map(data => data.testName).join(', ') || '';
                    
                    // Determine the color for the status
                    let statusColor = '';
                    if (booking.status === 'On Hold') {
                        statusColor = 'red';
                    } else if (booking.status === 'Pending') {
                        statusColor = 'green';
                    } else if (booking.status === 'Final') {
                        statusColor = 'blue'; // Assign a color for "Final" status
                    }

                    // Generate Booking ID HTML (with or without a clickable link)
                    const bookingIdHTML = booking.status === 'Final'
                        ? `<a href="/booking/${booking.bookingId}" target="_blank">${booking.bookingId}</a>`
                        : booking.bookingId;

                    const row = `
                        <tr>
                            <td><a href="#">${bookingIdHTML || ''}</a></td>
                            <td>${booking.patientName || ''}</td>
                            <td>${barcodes || ''}</td>
                            <td>${booking.doctorName || ''}</td>
                            <td>${testNames || ''}</td>
                             <td style="color: ${statusColor}; font-weight: bold;">${booking.status || ''}</td>
                        </tr>
                    `;
                    tableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                // No data found
                const noDataRow = `
                    <tr>
                        <td colspan="6">No results found for "${searchValue}".</td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', noDataRow);
            }
        })
        .catch(error => {
            console.error(error);
            alert('An error occurred while fetching data.');
        });
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
