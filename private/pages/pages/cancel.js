async function cancel() {
    async function findbookings() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/canceledBookings`)

            const data = await response.json();
            console.log("user:", user);

            console.log(data.data);

            populatebookings(data.data);

        } catch (error) {

        }
    }
    await findbookings();

    function populatebookings(data) {
        const tableBody = document.getElementById("holdbookingsBody");

        console.log("data:", data);
        
        if (data !== "empty") {
            tableBody.innerHTML = "";
        } else {
            return;
        }

        data.forEach((element, index) => {
            const row = document.createElement("tr");
            row.setAttribute("data-bookingid", element.bookingId);

            // Map messages to HTML
            let messagesHTML = element?.messages?.map((elem) => {
                if (elem.senderId === user._id) {
                    return `<div class="byfranchiseediv"><div class='byfranchisee'>${elem.message}</div></div>`;
                } else {
                    return `<div class="byadmindiv"><div class='byadmin'>${elem.message}</div></div>`;
                }
            }).join(""); // join converts array to string

            row.innerHTML = `
            <td>${index + 1}</td>
            <td>${new Date(element.date).toLocaleDateString()}</td>
            <td>${element.bookingId}</td>
            <td>${element.patientName}</td>
            <td>${messagesHTML || ""}</td>
            <td>${element.total}</td>
            <td>
                <div style="padding: 2px 4px; border-radius: 2px; background-color: rgb(255, 90, 90); text-align: center;">
                    ${element.status}
                </div>
            </td>`;

            tableBody.appendChild(row);
        });
    }

    async function sendmessage() {
        const sendbtn = document.getElementById('sendbtn');

        async function saveandsendmessages(e) {
            const messageinput = document.getElementById('messageinput').value.trim();
            const bookingId = e?.target?.closest('tr')?.getAttribute("data-bookingid");
            try {

                if (!messageinput) {
                    return alert('message field is empty')
                }
                const response = await fetch(`${BASE_URL}/api/v1/user/saveConversation`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ senderId: userId, bookingId, message: messageinput }),
                });

                if (!response.ok) {
                    throw new Error("Failed to send data to API");
                }

                const responseData = await response.json();
                alert('message sent successfully');
                messageinput = "";
                // fetchMessages();
            } catch (error) {
                console.log(error.message);
            }
        }
        sendbtn?.addEventListener('click', (e) => {
            saveandsendmessages(e)
        })
    }
    sendmessage();
}

cancel();