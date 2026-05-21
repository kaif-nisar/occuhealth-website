async function cancelledBookings() {
    const islayerone = user.tenantId.modelType === "1layer";

    // Safe DOM updates with null checks
    const labelForChange = document.getElementById('labelforchange');
    const tableColFour = document.getElementById('tablecolfour');
    const tableColFive = document.getElementById('tablecolfive');
    const layeredInput = document.getElementById('layeredinput');

    if (labelForChange) labelForChange.textContent = islayerone ? "Doctor" : "Franchisee";
    if (tableColFour) tableColFour.textContent = islayerone ? "Doctor" : "Franchisee";
    if (tableColFive) tableColFive.textContent = islayerone ? "Barcodes" : "Barcodes";
    if (layeredInput) layeredInput.style.display = islayerone ? "none" : "";

    let currentPage = 1;
    let totalPages = 1;
    const limit = 100;
    let intervalId;

    // Global variables for popup with null checks
    const popup = document.getElementById("messagePopup");
    const overlay = document.getElementById("popupOverlay");
    const sendMessageBtn = document.getElementById("sendMessage");
    const closePopupBtn = document.getElementById("closePopup");
    const messagesDiv = document.getElementById("messages");

    function showLoader() {
        const loader = document.querySelector(".loader");
        if (loader) loader.style.display = "flex";
    }

    function hideLoader() {
        const loader = document.querySelector(".loader");
        if (loader) loader.style.display = "none";
    }

    async function fetchCancelledBookings(page = 1) {
        currentPage = page;

        // Gather search filters
        const filters = {
            regNo: document.getElementById("reg-no").value.trim(),
            patientName: document.getElementById("patient-name").value.trim(),
            gender: document.getElementById("gender").value.trim(),
            patientPhone: document.getElementById("patient-phone").value.trim(),
            labName: document.getElementById("lab-name").value.trim(),
            franchisee: document.getElementById("franchisee").value.trim(),
            barcode: document.getElementById("barcode").value.trim(),
            status: "cancelled" // Only fetch cancelled bookings
        };

        try {
            showLoader();

            // Single API call - backend handles everything
            const response = await fetch(`${BASE_URL}/api/v1/user/get-cancelled-bookings?page=${page}&limit=${limit}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(filters)
            });

            const result = await response.json();
            const bookings = result.bookings || [];
            totalPages = Math.ceil(result.total / limit);

            // Display counts with null checks
            const totalBookingsEl = document.getElementById("totalbookings");
            const pageCounterEl = document.getElementById("pagecounter");

            if (totalBookingsEl) totalBookingsEl.innerText = `Total cancelled bookings: ${result.total}`;
            if (pageCounterEl) pageCounterEl.innerHTML = `Page ${currentPage} of ${totalPages}`;

            displayCancelledBookings(bookings);
        } catch (error) {
            console.error("Error fetching cancelled bookings:", error);
        } finally {
            hideLoader();
        }
    }

    // Display cancelled bookings in table
    function displayCancelledBookings(bookings) {
        const tableBody = document.getElementById("tbody");
        tableBody.innerHTML = "";

        if (!bookings.length) {
            tableBody.innerHTML = `<tr><td colspan="6">No cancelled bookings found.</td></tr>`;
            return;
        }

        bookings.forEach((booking) => {
            const row = document.createElement("tr");
            row.classList.add("cancelled-row");

            // Unique test names
            const testNamesArray = [...new Set(
                booking.tableData.flatMap(obj => obj.testName.split(",").map(name => name.trim()))
            )];
            const uniqueTestNames = testNamesArray.join(", ");

            // Set custom attributes
            row.setAttribute("data-test-names", uniqueTestNames);
            row.setAttribute("age", booking.year);
            row.setAttribute("gender", booking.gender);
            row.setAttribute("data-booking-id", booking.bookingId);
            row.setAttribute("data-patient-phone", booking.patientPhone);
            row.setAttribute("data-lab-name", booking.labName);
            row.setAttribute("data-updated-at", booking.updatedAt);
            row.setAttribute("data-created-by", booking.createdBy);
            row.setAttribute("data-booking", JSON.stringify(booking));

            // Create barcode HTML
            let barcodeHtml = '';
            if (booking.barcodeDetails && booking.barcodeDetails.length > 0) {
                barcodeHtml = booking.barcodeDetails.map(detail => {
                    return `<span style="display: inline-flex; align-items: center; margin: 2px 4px 2px 0; white-space: nowrap;">${detail.barcode}</span>`;
                }).join('');
            } else {
                barcodeHtml = booking.acceptedbarcode ? booking.acceptedbarcode.join(" ") : "";
            }

            // Format dates
            const bookingDate = new Date(booking.date).toLocaleDateString();
            const createdAt = booking.updatedAt ? new Date(booking.updatedAt).toLocaleString() : 'N/A';

            // HTML for row - Removed Actions column
            row.innerHTML = `
                        <td class="reg-no">${booking.bookingId}</td>
                        <td>${bookingDate}<br>${booking.time}</td>
                        <td>${booking.patientName}</td>
                        <td>${islayerone ? (booking.doctorName || "") : (booking.createdbyuser || "")}</td>
                        <td>${createdAt}</td>`;

            tableBody.appendChild(row);
        });
    }

    // Event delegation for table actions - Removed since Actions column is removed
    const tableBody = document.getElementById("tbody");
    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            e.preventDefault();
            const target = e.target.closest("a");
            if (!target) return;

            const row = target.closest("tr");
            const booking = JSON.parse(row.getAttribute("data-booking"));
            const bookingId = row.getAttribute("data-booking-id");
            const createdBy = row.getAttribute("data-created-by");

            if (target.classList.contains("view-bill")) {
                saveBookingToLocalStorage(booking, row);
                // You can implement a view details page here
                alert("View details functionality would open here");
            }
            else if (target.classList.contains("view-messages")) {
                showPopup(bookingId, createdBy);
                await fetchMessages(bookingId);
            }
        });
    }

    async function restoreBooking(bookingId) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/restore-booking`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId, status: "pending" }),
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message || "Booking restored successfully!");
                return true;
            } else {
                const error = await response.json();
                alert(error.message || "Failed to restore booking");
                return false;
            }
        } catch (error) {
            console.error("Error restoring booking:", error);
            alert("An error occurred while restoring the booking");
            return false;
        }
    }

    function showPopup(bookingId, createdBy) {
        if (messagesDiv) messagesDiv.innerHTML = '';

        const messageInput = document.getElementById("messageInput");
        if (messageInput) {
            messageInput.setAttribute("data-created-by", createdBy);
            messageInput.setAttribute("data-booking-id", bookingId);
        }

        if (popup) popup.style.display = "block";
        if (overlay) overlay.style.display = "block";
    }

    async function fetchMessages(bookingId) {
        if (messagesDiv) messagesDiv.innerHTML = '';
        let lastMessageId = null;
        let isFetching = false;

        if (intervalId) {
            clearInterval(intervalId);
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ bookingId }),
            });

            if (response.ok) {
                const responseData = await response.json();
                displayMessages(responseData.conversation.messages);
                if (responseData.conversation.messages.length > 0) {
                    lastMessageId = responseData.conversation.messages[responseData.conversation.messages.length - 1]._id;
                }
            } else {
                console.log("Failed to fetch conversation");
                return;
            }

            intervalId = setInterval(async function () {
                if (isFetching) return;

                isFetching = true;
                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/getConversationByBookingId`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ bookingId }),
                    });

                    if (!response.ok) {
                        console.log("Failed to fetch conversation");
                        return;
                    }

                    const responseData = await response.json();
                    const newMessages = responseData.conversation.messages.filter(message =>
                        !lastMessageId || message._id > lastMessageId
                    );

                    if (newMessages.length > 0) {
                        displayMessages(newMessages);
                        lastMessageId = newMessages[newMessages.length - 1]._id;
                    }
                } catch (error) {
                    console.error("Error fetching conversation:", error);
                } finally {
                    isFetching = false;
                }
            }, 2000);

        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    function displayMessages(messages) {
        if (!messagesDiv) return;

        messages.forEach(message => {
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
        });

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function closePopup() {
        if (intervalId) {
            clearInterval(intervalId);
        }
        if (popup) popup.style.display = "none";
        if (overlay) overlay.style.display = "none";
    }

    function saveBookingToLocalStorage(booking, row) {
        const regId = row.cells[0].innerText;
        localStorage.setItem("booking", JSON.stringify(booking));
        localStorage.setItem("regId", JSON.stringify(regId));
    }

    function setupEventListeners() {
        const nextBtn = document.getElementById("next");
        const prevBtn = document.getElementById("previous");
        const searchBtn = document.getElementById("search-btn");
        const clearBtn = document.getElementById("clearfield");

        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                if (currentPage < totalPages) fetchCancelledBookings(currentPage + 1);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                if (currentPage > 1) fetchCancelledBookings(currentPage - 1);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener("click", () => {
                fetchCancelledBookings(1);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                const regNoEl = document.getElementById("reg-no");
                const patientNameEl = document.getElementById("patient-name");
                const genderEl = document.getElementById("gender");
                const patientPhoneEl = document.getElementById("patient-phone");
                const barcodeEl = document.getElementById("barcode");
                const labNameEl = document.getElementById("lab-name");
                const franchiseeEl = document.getElementById("franchisee");

                if (regNoEl) regNoEl.value = "";
                if (patientNameEl) patientNameEl.value = "";
                if (genderEl) genderEl.value = "";
                if (patientPhoneEl) patientPhoneEl.value = "";
                if (barcodeEl) barcodeEl.value = "";
                if (labNameEl) labNameEl.value = "";
                if (franchiseeEl) franchiseeEl.value = "";

                fetchCancelledBookings(1);
            });
        }

        if (sendMessageBtn) {
            sendMessageBtn.addEventListener("click", async function () {
                const Input = document.getElementById("messageInput");
                if (!Input) return;

                const messageInput = Input.value.trim();
                const receiver = Input.getAttribute('data-created-by');
                const bookingId = Input.getAttribute('data-booking-id');

                if (!messageInput) {
                    return alert('Message field is empty');
                }

                try {
                    const response = await fetch(`${BASE_URL}/api/v1/user/saveConversation`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            senderId: userId,
                            receiverId: receiver,
                            bookingId,
                            message: messageInput
                        }),
                    });

                    if (!response.ok) {
                        throw new Error("Failed to send data to API");
                    }

                    const responseData = await response.json();
                    alert('Message sent successfully');
                    displayMessages([{
                        senderId: userId,
                        message: messageInput
                    }]);
                    Input.value = "";
                } catch (error) {
                    console.error("Error sending message:", error);
                }
            });
        }

        if (closePopupBtn) {
            closePopupBtn.addEventListener("click", closePopup);
        }
    }

    setupEventListeners();
    await fetchCancelledBookings(1);
}

async function initialization() {
    const loader = document.querySelector(".loader");
    if (loader) loader.style.display = "flex";
    try {
        await cancelledBookings();
    } catch (error) {
        console.log(error);
    } finally {
        if (loader) loader.style.display = "none";
    }
}

initialization();
