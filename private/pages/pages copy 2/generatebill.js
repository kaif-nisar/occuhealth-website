// Event listener for search button
document.addEventListener('keydown', function (event) {
    if (!(event.key === "Enter")) return;
    searchbuttonfunction();
});

// Event listener for search button
document.getElementById("search-button").addEventListener('click', function (event) {
    searchbuttonfunction();
});

async function searchbuttonfunction() {
    const searchValue = document.getElementById('search-input').value.trim();
    const Array = [];

    // Fetch data from your server
    await fetch(`${BASE_URL}/api/v1/user/bookings-search?search=${searchValue}`) // Replace with your actual API endpoint
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch data.');
            }
            return response.json();
        })
        .then(data => {
            // Clear previous table rows
            const tableBody = document.getElementById('table-body');
            tableBody.innerHTML = '';

            if (data.bookings && data.bookings.length > 0) {
                const dataset = data.bookings[0];
                dataset.tableData.forEach(elem => {
                    const testnames = elem.testName.split(',');
                    Array.push(...testnames);
                })
                const uiqueArray = [...new Set(Array)];
                const invoicetablebody = document.querySelector('#invoice-table tbody');
                invoicetablebody.innerHTML = '';
                uiqueArray.forEach((elem, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${index + 1}</td>
                                    <td>${elem}</td>`;
                    invoicetablebody.appendChild(row);
                });
                document.querySelector('.ml-auto').textContent = dataset.bookingId;
                document.getElementById('invoiceid').innerText =`#Bill${dataset._id}`;
                document.querySelector('.booking-date').textContent = dataset.date.split('T')[0];
                document.querySelector('.booking-time').textContent = new Date("1970-01-01T" + dataset.time)
                    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                document.querySelector('.booking-patientName').textContent = dataset.patientName;
                document.querySelector('.booking-total').value = dataset.total;
                document.getElementById('invoice-bookingid').textContent = `Booking Id : ${dataset.bookingId}`;
                document.getElementById('invoice-date-time').textContent = `Booking Time : ${dataset.date.split('T')[0]} ${new Date("1970-01-01T" + dataset.time)
                    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                document.querySelector('.blue').textContent = dataset.patientName;
                document.querySelector('.invoice-gender').textContent = `${dataset.year} | ${dataset.gender}`;
                document.getElementById('invoice-date-time').textContent = new Date().toLocaleString().split(",")[0];
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
                            <td>${bookingIdHTML || ''}</td>
                            <td>${booking.patientName || ''}</td>
                            <td>${barcodes || ''}</td>
                            <td>${booking.doctorName || ''}</td>
                            <td>${uiqueArray || ''}</td>
                             <td>${booking.billGenerated ? `<a href="#" id="downloadbtnanchor"><button id="downloadBtn"><i class="fa-solid fa-download"></i>Download</button></a>` : `<button id="openModalBtn" onclick="openModal()">Generate Bill</button>`}</td>
                        </tr>
                    `;
                    tableBody.insertAdjacentHTML('beforeend', row);
                });
                data.bookings[0].billGenerated ? tableBody.style.display = "none" : tableBody.style.display = "";
                submitbillingprice(dataset);
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
}
function openModal() {
    console.log('clicked');
    let modal = document.getElementById("customModal");
    modal.classList.add("show");
}

function closeModal() {
    let modal = document.getElementById("customModal");
    modal.classList.remove("show");
}

// Close modal when clicking outside
window.onclick = function (event) {
    let modal = document.getElementById("customModal");
    if (event.target === modal) {
        closeModal();
    }
}
async function submitbillingprice(booking) {
    const submitbtn = document.querySelector('.open-modal-btn');
    const downloadbtn = document.getElementById('downloadbtnanchor');
    if (downloadbtn) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/invoicepdfgenerator`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    bookingId: booking.bookingId,
                })
            });
            const pdfblob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfblob);
            if (response.ok) {
                downloadbtn.href = pdfUrl;
                downloadbtn.download = `${booking.patientName}-invoice.pdf`;
                document.querySelector('#main-table tbody').style.display = "";
            }
        } catch (error) {
            console.log(error);
        }
    }
    submitbtn.addEventListener('click', async function () {
        const generatebillbtn = document.getElementById('openModalBtn');
        generatebillbtn.innerText = "please wait..";
        generatebillbtn.disabled = true;
        const billingprice = document.querySelector(".billingprice").value
        document.querySelector(".header span").textContent = `Rs ${billingprice}`;
        const invoiceHtml = document.querySelector(".pdf-div").innerHTML;
        const invoicecss = document.getElementById("billcss").innerHTML;
        const billnumber = document.getElementById('invoiceid').innerText;
        console.log("invoicecss:",invoicecss);
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/invoicepdfgenerator`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    invoiceHtml,
                    billnumber,
                    bookingId: booking.bookingId,
                    invoicecss,
                    billingPrice: Number(billingprice),
                    generatedBy: userId
                })
            });
            const response2 = await fetch(`${BASE_URL}/api/v1/user/updategeneratedbillvariable/${booking.bookingId}`);
            const pdfblob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfblob);
            if (response.ok && response2.ok) {
                const anchor = document.createElement("a");
                anchor.href = pdfUrl;
                anchor.download = `${booking.patientName}-invoice.pdf`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
            }

        } catch (error) {
            console.log(error);
        } finally {
            generatebillbtn.innerText = "Generate Bill";
            generatebillbtn.disabled = false;
        }
    })
}

