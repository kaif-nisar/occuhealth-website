async function allcases() {

    let BASE_URL = window.location.origin;

    async function fetchNotifications() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getnewnotificationforadmin`);
            const data = await response.json(); // ✅ FIXED

            console.log("notification data:", data);

            if (!response.ok || data.status === "empty") {
                console.log(data.message);
                return;
            }

            populatemessages(data);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }

        function populatemessages(data) {
            const alertdiv = document.querySelector('.alert-div');
            const messagescountspan = alertdiv.querySelector("#messageshint");
            const messagescontainer = alertdiv.querySelector("#notificationContainer");

            messagescountspan.textContent = data.length;
            messagescontainer.innerHTML = ""; // ✅ Clear old notifications before adding new ones

            data.forEach((elem) => {
                const div = document.createElement('div');
                div.className = 'notification'; // ✅ FIXED
                div.setAttribute("role", "alert");
                div.setAttribute("data-objId", elem._id);

                div.innerHTML = `
                <span class="deletemsg" style="cursor:pointer;">✖</span>
                <strong>Booking ID:</strong> <span>${elem.relatedbooking?.bookingId || "N/A"}</span><br>
                <strong>Last Message:</strong> <span>${elem.lastMessage?.message || "No message"}</span><br>
                <strong>Patient Name:</strong> <span>${elem.relatedbooking?.patientName || "N/A"}</span><br>
                <strong>Franchisee:</strong> <span>${elem.relatedbooking?.createdBy?.username || "N/A"}</span>
            `;

                const deletebtn = div.querySelector('.deletemsg');

                deletebtn.addEventListener('click', async function () {
                    const objId = div.getAttribute("data-objId");
                    try {
                        const response = await fetch(`${BASE_URL}/api/v1/user/changewatchedstatus/${objId}`);
                        if (response.ok) {
                            console.log("Conversation updated successfully");
                            div.remove();
                            if (messagescontainer.children.length === 0) {
                                messagescountspan.textContent = "";
                                messagescontainer.classList.remove('show');
                            } else {
                                messagescountspan.textContent = messagescontainer.children.length;
                            }
                        }
                    } catch (error) {
                        console.error("Error updating conversation:", error.message);
                    }
                });

                messagescontainer.appendChild(div);
            });
        }
    }

    fetchNotifications();

    async function fetchBookings() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-bookings`, {
                method: "POST",
            });
            const response2 = await fetch(`${BASE_URL}/api/v1/user/getallbarcodesController`);
            const result2 = await response2.json();
            const result = await response.json();
            if (!response.ok || !response2.ok) {
                console.log("Failed to fetch bookings.");
                return;
            } else {
                let Array = [...result.data];
                let Total = 0;
                for (const element of Array) {
                    for (const obj of result2) {
                        if (obj.bookingId === element.bookingId) {
                            const barcodearray = obj.barcodes.map(obj2 => obj2.barcode)
                            Total += barcodearray.length;
                            element.acceptedbarcode = barcodearray.join(" ");
                        }
                    }
                }
                document.getElementById("totalbarcodes").innerText = `Total barcodes accepted : ${Total},`;
                document.getElementById("totalbookings").innerText = `Total bookings received : ${result2.length}`;
                // Sort data by `updatedAt` attribute in descending order
                Array.sort((a, b) => {
                    const updatedAtA = new Date(a.updatedAt);
                    const updatedAtB = new Date(b.updatedAt);
                    return updatedAtB - updatedAtA; // Descending order
                });
                rowsperpagecalculator(Array);
            }
        } catch (error) {
            console.error("Error fetching bookings:", error);
        }
    }

    function rowsperpagecalculator(data) {
        const pagecounter = document.getElementById('pagecounter');
        pagecounter.innerHTML = "";
        let totalpages;
        let currentpage = 1;

        document.getElementById('search-btn').addEventListener('click', function () {
            searchBooking();
        });

        document.getElementById('clearfield').addEventListener('click', function () {
            document.getElementById("reg-no").value = "";
            document.getElementById("patient-name").value = "";
            document.getElementById("gender").value = "";
            document.getElementById("patient-phone").value = "";
            document.getElementById("doctor-name").value = "";
            document.getElementById("lab-name").value = "";
            document.getElementById("status").value = "";
            document.getElementById("franchisee").value = "";
            setpageandrows(1, data);
        });

        function searchBooking() {
            let searchTerm = {
                regNo: document.getElementById("reg-no").value.trim().toLowerCase(),
                patientName: document.getElementById("patient-name").value.trim().toLowerCase(),
                gender: document.getElementById("gender").value.trim().toLowerCase(),
                patientPhone: document.getElementById("patient-phone").value.trim().toLowerCase(),
                barcode: document.getElementById("doctor-name").value.trim().toLowerCase(),
                labName: document.getElementById("lab-name").value.trim().toLowerCase(),
                status: document.getElementById("status").value.trim().toLowerCase(),
                franchisee: document.getElementById("franchisee").value.trim().toLowerCase(),
            };

            let filteredData = data.filter(value => {
                let iscreatedBy;
                if (searchTerm.franchisee) {
                    let createdBy = value.createdbyuser || "";
                    iscreatedBy = createdBy.includes(searchTerm.franchisee)
                }
                return (
                    (searchTerm.regNo && (value.bookingId?.toLowerCase() || "").includes(searchTerm.regNo)) ||
                    (searchTerm.patientName && (value.patientName?.toLowerCase() || "").includes(searchTerm.patientName)) ||
                    (searchTerm.gender && (value.gender?.toLowerCase() || "").includes(searchTerm.gender)) ||
                    (searchTerm.patientPhone && (value.patientPhone?.toLowerCase() || "").includes(searchTerm.patientPhone)) ||
                    (searchTerm.barcode && (value.acceptedbarcode?.toLowerCase() || "").includes(searchTerm.barcode)) ||
                    (searchTerm.labName && (value.labName?.toLowerCase() || "").includes(searchTerm.labName)) ||
                    (searchTerm.status && (value.status?.toLowerCase() || "").includes(searchTerm.status)) ||
                    (iscreatedBy)
                );
            });

            setpageandrows(1, filteredData);
        }

        function setpageandrows(currentpage, filteredData) {
            let rowsperpage = 50;

            let start = (currentpage - 1) * rowsperpage;
            let end = start + rowsperpage;

            totalpages = Math.ceil((filteredData.length) / rowsperpage);
            pagecounter.innerHTML = `<span>Page ${currentpage} of ${totalpages}</span>`;

            const slicedata = filteredData.slice(start, end);
            displayBookings(slicedata);
        }

        setpageandrows(1, data);

        document.getElementById("next").addEventListener('click', function () {
            if (currentpage >= totalpages) return
            ++currentpage;
            setpageandrows(currentpage, data);
        })
        document.getElementById("previous").addEventListener('click', function () {
            if (currentpage <= 1) return;
            --currentpage;
            setpageandrows(currentpage, data);
        })
    }

    function displayBookings(bookings) {
        const tableBody = document.getElementById("tbody");

        if (bookings.length !== 0) {
            tableBody.innerHTML = ""; // Clear existing rows
        } else {
            tableBody.innerHTML = "<tr><td colspan='7' style='text-align: center; '>No report found</td></tr>";
            return;
        }

        bookings.forEach((booking) => {
            if (!(booking.status === "canceled" || booking.status === "On Hold")) {
                const row = document.createElement("tr");

                // Gather and de-duplicate test names
                const testNamesArray = [...new Set(
                    booking.tableData.flatMap((obj) => obj.testName.split(",").map((name) => name.trim()))
                )];

                // Convert test names array to a string for the attribute
                const uniqueTestNames = testNamesArray.join(", ");


                // Set custom attributes on the row
                row.setAttribute("data-test-names", uniqueTestNames);
                row.setAttribute("age", booking.year);
                row.setAttribute("gender", booking.gender);
                row.setAttribute("barcode-id", booking.bookingId);
                row.setAttribute("patientPhone", booking.patientPhone);
                row.setAttribute("labName", booking.labName);
                row.setAttribute("updatedAt", booking.updatedAt);
                row.setAttribute("createdby", booking.createdBy);

                row.style.backgroundColor = booking.status === 'completed' ? 'rgba(0, 128, 0, 0.342)' :
                    booking.status === 'pending' ? 'rgba(141, 92, 2, 0.333)' :
                        booking.status === 'Hold' ? 'rgba(120, 32, 0, 0.356)' : 'rgba(0, 143, 143, 0.333)';

                // Generate columns with appropriate data
                if (booking.isreportready) {
                    row.innerHTML = `
                        <td class="reg-no">${booking.bookingId}</td>
                        <td>${new Date(booking.date).toLocaleDateString()}<br>${booking.time}</td>
                        <td>${booking.patientName}</td>
                        <td>${booking.createdbyuser === null ? "" : booking.createdbyuser}</td>
                        <td>${booking.acceptedbarcode || ""}</td>
                        <td><button class="status-btn">${booking.status}</button></td>
                        <td class="actions">
                            <div class="enter-result">
                                <a class="edit-report"><i class="fa-solid fa-pen-to-square"></i> View report</a>
                            </div>
                            <i class="fas fa-ellipsis-h more-options" onclick="toggleDropdown(this)"></i>
                            <div class="enter-result-dropdown-menu" style="display: none;">
                                <a data-page="labreport" class="download-report" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                                <a data-page="ModifyCase" class="ModifyCase" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                                <a class="ModifyCase HoldBtn" id="HoldBtn" target="_blank"><i class="fa-solid fa-hands-holding"></i> Hold</a> 
                                <a class="ModifyCase clinical" target="_blank"><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>                               
                            </div>
                        </td>`;
                } else {
                    row.innerHTML = `
                        <td class="reg-no">${booking.bookingId}</td>
                        <td>${new Date(booking.date).toLocaleDateString()}<br>${booking.time}</td>
                        <td>${booking.patientName}</td>
                        <td>${booking.createdbyuser === null ? "" : booking.createdbyuser}</td>
                        <td>${booking.acceptedbarcode || ""}</td>
                        <td><button class="status-btn">${booking.status}</button></td>
                        <td class="actions">
                            <div class="enter-result">
                                <a data-page="labreport" class="view-bill"><i class="fa-solid fa-pen-to-square"></i> Enter result</a>
                            </div>
                            <i class="fas fa-ellipsis-h more-options" onclick="toggleDropdown(this)"></i>
                            <div class="enter-result-dropdown-menu" style="display: none;">
                                <a class="ModifyCase" target="_blank"><i class="fa-solid fa-pen-to-square"></i> Modify Case</a>
                                <a class="ModifyCase HoldBtn" id="HoldBtn" target="_blank"><i class="fa-solid fa-hands-holding"></i> Hold</a>
                                <a class="ModifyCase clinical" target="_blank"><i class="fa-solid fa-house-chimney-medical"></i> clinical</a>
                                <a class="ModifyCase" target="_blank"><i class="fa-solid fa-rectangle-xmark"></i> Cancel</a>
                            </div>
                        </td>`;
                }

                // Event listeners for actions
                addRowEventListeners(row, booking);

                tableBody.appendChild(row);
            }
        });
        // Call the function after the table is populated
        // sortTableByUpdatedAt();
        openpopup();
    }

    function openpopup() {
        // Popup Elements
        const popup = document.getElementById("messagePopup");
        const overlay = document.getElementById("popupOverlay");
        const sendMessageBtn = document.getElementById("sendMessage");
        const closePopupBtn = document.getElementById("closePopup");
        const messagesDiv = document.getElementById("messages");
        let bookingId;
        let row;
        let intervalId;

        // Event Listener for all "Hold" Buttons
        document.querySelectorAll('.HoldBtn').forEach(function (holdBtn) {
            holdBtn.addEventListener('click', function (e) {
                const confirmation = window.confirm("Are you want to update the status as 'Hold'")
                if (!confirmation) {
                    return;
                }
                messagesDiv.innerHTML = '';
                row = e.target.closest("tr"); // Get the current row
                bookingId = row.getAttribute('barcode-id');
                console.log("this is booking Id:", bookingId);

                //for updating hold status
                updatebookingStatus(bookingId, "Hold");
                // Show Popup
                popup.style.display = "block";
                overlay.style.display = "block";

                fetchMessages(bookingId);
            })
        })

        // Event Listener for all "Hold" Buttons
        document.querySelectorAll('.clinical').forEach(function (holdBtn) {
            holdBtn.addEventListener('click', function () {
                const confirmation = window.confirm("Are you want to update the status as 'clinical'")
                if (!confirmation) {
                    return;
                }
                row = this.closest("tr"); // Get the current row
                bookingId = row.getAttribute('barcode-id');
                //for updating hold status
                updatebookingStatus(bookingId, "clinical");
                // Show Popup
                popup.style.display = "block";
                overlay.style.display = "block";

                fetchMessages();
            })
        })

        async function updatebookingStatus(bookingid, status) {
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/statusBookingcontroller`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingid, status }),
                });
                if (!response.ok) {
                    console.log("status not updated");
                }

            } catch (error) {
                console.log(error)
            }
        }

        sendMessageBtn.addEventListener("click", async function () {
            let messageInput = document.getElementById("messageInput").value;
            const reciever = row.getAttribute('createdby');

            if (!messageInput) {
                return alert('message field is empty')
            }

            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/saveConversation`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ senderId: userId, receiverId: reciever, bookingId, message: messageInput }),
                });

                if (!response.ok) {
                    throw new Error("Failed to send data to API");
                }

                const responseData = await response.json();
                alert('message sent successfully');
                messageInput = "";
                // fetchMessages();
            } catch (error) {
                console.error("Error sending message:", error);
            }
        })

        async function fetchMessages() {

            messagesDiv.innerHTML = '';
            let responseData;
            let lastMessageId = null; // Track the last message ID

            try {

                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ bookingId }),
                    });

                    if (!response.ok) {
                        throw new Error("Failed to fetch conversation");
                    }

                    const responseData = await response.json();

                    if (responseData?.status && responseData.status === "empty") {
                        console.log(responseData.message);
                        return;
                    }

                    // Iterate over messages and add only new ones
                    responseData.conversation.messages.forEach(message => {
                        if (!lastMessageId || message._id > lastMessageId) { // Check if the message is new
                            // Create message elements dynamically
                            const div = document.createElement('div');
                            const textTag = document.createElement('p');

                            if (message.senderId === userId) {
                                div.className = 'receiverdivs';
                                textTag.className = 'receivertext';
                            } else {
                                div.className = 'senderdivs';
                                textTag.className = 'sendertext';
                            }

                            textTag.textContent = message.message;
                            div.appendChild(textTag);
                            messagesDiv.appendChild(div);

                            // Auto-scroll to bottom
                            messagesDiv.scrollTop = messagesDiv.scrollHeight;

                            // Update the last message ID
                            lastMessageId = message._id;
                        }
                    });
                } catch (error) {
                    console.error("Error fetching conversation:", error);
                }

                if (messagesDiv.innerHTML === '') {
                    const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ bookingId }),
                    });


                    if (!response.ok) {
                        throw new Error("Failed to fetch conversation");
                    }

                    const responseData = await response.json();

                    if (responseData?.status && responseData.status === "empty") {
                        console.log(responseData.message);
                        return;
                    }

                }
                if (!responseData) {
                    return;
                }

                responseData?.conversation?.messages?.forEach(message => {
                    if (!message.senderId === userId) {
                        const div = document.createElement('div');
                        div.className = 'senderdivs';
                        const texttag = document.createElement('p');
                        texttag.className = 'sendertext';
                        texttag.textContent = message.message;

                        div.appendChild(texttag);
                        messagesDiv.appendChild(div);
                        // Auto-scroll to bottom
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    } else {
                        const div = document.createElement('div');
                        div.className = 'receiverdivs';
                        const texttag = document.createElement('p');
                        texttag.className = 'receivertext';
                        texttag.textContent = message.message;

                        div.appendChild(texttag);
                        messagesDiv.appendChild(div);
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }
                    // Update the last message ID
                    lastMessageId = message._id;
                })
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }

        // Event Listener to Close Popup
        closePopupBtn.addEventListener("click", function () {
            clearInterval(intervalId);
            popup.style.display = "none";
            overlay.style.display = "none";
        });
    }

    function addRowEventListeners(row, booking) {

        if (row.querySelector(".view-bill")) {
            row.querySelector(".view-bill").addEventListener("click", (e) => {
                e.preventDefault();
                saveBookingToLocalStorage(booking, row);
                const url = `${BASE_URL}/admin.html?page=labreport`;
                window.location.href = url;
            });
        }

        if (row.querySelector(".edit-report")) {
            row.querySelector(".edit-report").addEventListener("click", (e) => {
                e.preventDefault();
                saveBookingToLocalStorage(booking, row);
                const url = `${BASE_URL}/admin.html?page=${user?.pdfFormat || "reportFormat1"}&value1=${booking.bookingId}`;
                window.location.href = url;
            });

            row.querySelector(".download-report").addEventListener("click", (e) => {
                e.preventDefault();
                saveBookingToLocalStorage(booking, row);
                const url = `${BASE_URL}/admin.html?page=labreport`;
                window.location.href = url;
            });
        }

        row.querySelector(".ModifyCase").addEventListener("click", (e) => {
            e.preventDefault();
            saveBookingToLocalStorage(booking, row);
            const url = `${BASE_URL}/admin.html?page=ModifyCase&value1=${booking.bookingId}`;
            window.location.href = url;
        });
    }

    function saveBookingToLocalStorage(booking, row) {
        const regId = row.cells[0].innerText;
        localStorage.setItem("booking", JSON.stringify(booking));
        localStorage.setItem("regId", JSON.stringify(regId));
    }

    // Close dropdown if clicked outside
    document.addEventListener("click", (event) => {
        const dropdowns = document.querySelectorAll(".dropdown-menu");
        dropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target) && !dropdown.previousElementSibling.contains(event.target)) {
                dropdown.style.display = "none";
            }
        });
    });

    // Load all bookings initially
    await fetchBookings();
    // function sortTableByUpdatedAt() {
    //     const tableBody = document.getElementById("tbody");
    //     const rows = Array.from(tableBody.querySelectorAll("tr"));

    //     // Sort rows by `updatedAt` attribute in descending order
    //     rows.sort((a, b) => {
    //         const updatedAtA = new Date(a.getAttribute("updatedAt"));
    //         const updatedAtB = new Date(b.getAttribute("updatedAt"));
    //         return updatedAtB - updatedAtA; // Descending order
    //     });

    //     // Clear the table body and append sorted rows
    //     tableBody.innerHTML = "";
    //     rows.forEach((row) => tableBody.appendChild(row));
    // }

}

async function initialization() {
    try {
        await allcases();
    } catch (error) {
        console.log(error);
    }
}

initialization();

function toggleDropdown(element) {
    const dropdown = element.nextElementSibling;
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

// function searchBookings() {
//     const regNo = document.getElementById("reg-no").value.trim().toLowerCase();
//     const patientName = document.getElementById("patient-name").value.trim().toLowerCase();
//     const gender = document.getElementById("gender").value.trim().toLowerCase();
//     const patientPhone = document.getElementById("patient-phone").value.trim().toLowerCase();
//     const doctorName = document.getElementById("doctor-name").value.trim().toLowerCase();
//     const labName = document.getElementById("lab-name").value.trim().toLowerCase();
//     const status = document.getElementById("status").value.trim().toLowerCase();

//     const tableBody = document.getElementById("tbody");
//     const rows = tableBody.querySelectorAll("tr");

//     rows.forEach((row) => {
//         const regNoMatch = !regNo || row.querySelector(".reg-no").innerText.toLowerCase().includes(regNo);
//         const nameMatch = !patientName || row.cells[2].innerText.toLowerCase().includes(patientName);
//         const genderMatch = !gender || row.getAttribute("gender").toLowerCase().includes(gender);
//         const phoneMatch = !patientPhone || row.getAttribute("patientPhone").toLowerCase().includes(patientPhone);
//         const doctorMatch = !doctorName || row.cells[3].innerText.toLowerCase().includes(doctorName);
//         const labNameMatch = !labName || row.getAttribute("labName").toLowerCase().includes(labName);
//         const statusMatch = !status || row.querySelector(".status-btn").innerText.toLowerCase().includes(status);

//         row.style.display = regNoMatch && nameMatch && genderMatch && phoneMatch && doctorMatch && labNameMatch && statusMatch ? "" : "none";
//     });
// }

function clearFields() {
    document.getElementById("reg-no").value = "";
    document.getElementById("patient-name").value = "";
    document.getElementById("gender").value = "";
    document.getElementById("patient-phone").value = "";
    document.getElementById("doctor-name").value = "";
    document.getElementById("lab-name").value = "";
    document.getElementById("status").value = "";

    const rows = document.getElementById("tbody").querySelectorAll("tr");
    rows.forEach((row) => (row.style.display = ""));
}

