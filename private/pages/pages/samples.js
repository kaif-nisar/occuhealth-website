window.__samplesState = window.__samplesState || {
    isAcceptSubmitting: false,
    isLoseSubmitting: false,
    isRejectSubmitting: false
};
window.__samplesState.isAcceptSubmitting = false;
window.__samplesState.isLoseSubmitting = false;
window.__samplesState.isRejectSubmitting = false;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setPopupNotice(type, title, description) {
    const noticeEl = document.getElementById("popupNotice");
    if (!noticeEl) return;

    if (!description) {
        noticeEl.style.display = "none";
        noticeEl.className = "popup-notice";
        noticeEl.innerHTML = "";
        return;
    }

    const variant = type === "error" ? "error" : "warning";
    noticeEl.className = `popup-notice ${variant}`;
    noticeEl.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
            ${title ? `<span class="popup-notice-title">${escapeHtml(title)}</span>` : ""}
            <span>${escapeHtml(description)}</span>
        </div>
    `;
    noticeEl.style.display = "flex";
}

function formatAcceptedAtText(acceptedAt) {
    if (!acceptedAt) return "";
    const parsed = new Date(acceptedAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return ` (Accepted on ${parsed.toLocaleString()})`;
}

function syncPopupActionButtons(showButtons = true) {
    const acceptBtn = document.getElementById("acceptBtn");
    const rejectBtn = document.getElementById("rejectBtn");
    const loseBtn = document.getElementById("rejectBtnbarcode");
    const state = window.currentSampleState || {};

    if (!showButtons) {
        if (acceptBtn) acceptBtn.style.display = "none";
        if (rejectBtn) rejectBtn.style.display = "none";
        if (loseBtn) loseBtn.style.display = "none";
        return;
    }

    if (acceptBtn) {
        acceptBtn.style.display = "inline-block";
        acceptBtn.disabled = false;
        if (state.isAccepted) {
            acceptBtn.classList.add("is-already-accepted");
            acceptBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i>Already Accepted';
        } else {
            acceptBtn.classList.remove("is-already-accepted");
            acceptBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i>Accept';
        }
    }

    if (rejectBtn) {
        rejectBtn.style.display = "inline-block";
        rejectBtn.disabled = false;
    }

    if (loseBtn) {
        const canLose = Boolean(state.isAccepted && !state.acceptedInOtherBooking);
        loseBtn.style.display = canLose ? "inline-block" : "none";
        loseBtn.disabled = false;
        loseBtn.classList.toggle("is-highlighted", canLose);
    }
}

function applyAlreadyAcceptedUI(message, acceptedAt = null, inAnotherBooking = false) {
    const state = window.currentSampleState || {};
    state.isAccepted = true;
    state.acceptedInOtherBooking = Boolean(inAnotherBooking);
    if (acceptedAt) state.acceptedAt = acceptedAt;
    window.currentSampleState = state;

    const statusBadge = document.getElementById("sampleAcceptanceStatusText");
    if (statusBadge) {
        statusBadge.textContent = inAnotherBooking ? "Already Accepted (Another Booking)" : "Already Accepted";
        statusBadge.style.color = "#b45309";
        statusBadge.style.fontWeight = "700";
    }

    const defaultMsg = inAnotherBooking
        ? "This barcode has already been accepted in another booking and cannot be accepted again."
        : `This sample has already been accepted${formatAcceptedAtText(state.acceptedAt)} and was not accepted again. If you want to lose it, click the Lose button below.`;

    setPopupNotice(
        inAnotherBooking ? "error" : "warning",
        "Sample Already Accepted",
        message || defaultMsg
    );
    syncPopupActionButtons(true);
}

// Popup functions
function showPopup(message, title = "Booking Information", showButtons = true) {
    document.getElementById("popupTitle").textContent = title;
    document.getElementById("popupMessage").innerHTML = message;
    document.getElementById("popupOverlay").style.display = "flex";

    if (!showButtons) {
        setPopupNotice(null, "", "");
    }
    syncPopupActionButtons(showButtons);
}

if (window.__samplesKeydownHandler) {
    document.removeEventListener("keydown", window.__samplesKeydownHandler);
}
window.__samplesKeydownHandler = function (event) {
    const searchInput = document.getElementById("search");
    const popupOverlay = document.getElementById("popupOverlay");
    if (!searchInput || !popupOverlay) return;

    const isPopupOpen = popupOverlay.style.display === "flex";
    if (event.key === "Escape" && isPopupOpen) {
        closePopup();
        return;
    }

    if (event.key === "Enter") {
        const tag = event.target?.tagName;
        if (isPopupOpen && tag === "BUTTON") {
            return;
        }
        if (event.target === searchInput || !isPopupOpen) {
            event.preventDefault();
            searchBooking();
        }
    }
};
document.addEventListener("keydown", window.__samplesKeydownHandler);

function closePopup() {
    const popupOverlay = document.getElementById("popupOverlay");
    if (popupOverlay) popupOverlay.style.display = "none";
    setPopupNotice(null, "", "");
}

// Reject booking function to update status to 'cancelled'
async function rejectBooking() {
    if (window.__samplesState.isRejectSubmitting) return;
    const bookingId = window.bookingId;
    if (!bookingId) {
        alert("No booking selected.");
        return;
    }

    const rejectBtn = document.getElementById("rejectBtn");
    window.__samplesState.isRejectSubmitting = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/reject-booking`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ bookingId })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            closePopup();
        } else {
            alert(data.message || "Failed to reject booking.");
        }
    } catch (error) {
        console.error("Error updating booking status:", error);
        alert("An error occurred. Please try again.");
    } finally {
        window.__samplesState.isRejectSubmitting = false;
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

async function rejectBarcode() {
    if (window.__samplesState.isLoseSubmitting) return;
    const barcodeId = String(window.barcode?.barcode || document.getElementById("search")?.value || "").trim();
    const bookingId = window.bookingId;
    if (!barcodeId) {
        alert("Please enter a Barcode ID.");
        return;
    }

    const loseBtn = document.getElementById("rejectBtnbarcode");
    window.__samplesState.isLoseSubmitting = true;
    if (loseBtn) {
        loseBtn.disabled = true;
        loseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Losing...';
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/reject-barcode`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ barcodeId, bookingId })
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message || "Sample lost successfully.");
            closePopup();
        } else {
            alert(result.message || result.error || "Could not lose sample.");
        }
    } catch (error) {
        console.error("Error updating booking status:", error);
        alert("An error occurred. Please try again.");
    } finally {
        window.__samplesState.isLoseSubmitting = false;
        if (loseBtn) {
            loseBtn.disabled = false;
            loseBtn.innerHTML = '<i class="fa-solid fa-barcode"></i>Lose';
        }
    }
}

// Fetch and display booking information
async function searchBooking() {
    const barcodeId = document.getElementById("search").value.trim(); // Trim whitespace
    if (!barcodeId) {
        alert("Please enter a Barcode ID.");
        return;
    }

    try {
        // Reset popup content and close any open popup
        document.getElementById("popupMessage").textContent = "Loading...";
        closePopup(); // Close any open popup before fetching new data
        window.currentSampleState = null;
        window.barcode = null;
        window.bookingId = null;

        const response = await fetch(`${BASE_URL}/api/v1/user/get-barcode`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ barcodeId })
        });

        const booking = await response.json();

        console.log("result:", booking);

        if (response.ok && booking?.booking) {
            const isAccepted = Boolean(booking.isAccepted);
            const acceptedInOtherBooking = Boolean(booking.acceptedInOtherBooking);
            const acceptedAt = booking.acceptedAt || null;

            window.barcode = {
                barcode: barcodeId,
                testandpannelArray: booking.testandpannels,
                sampleType: booking.sampletype,
                testIds: booking.testIds
            };
            window.bookingId = booking.booking.bookingId;
            window.currentSampleState = {
                barcodeId,
                bookingId: booking.booking.bookingId,
                isAccepted,
                acceptedInOtherBooking,
                acceptedAt
            };

            const testsText = Array.isArray(booking.testandpannels)
                ? booking.testandpannels.join(", ")
                : (booking.testandpannels || "N/A");
            const sampleStatusLabel = isAccepted
                ? (acceptedInOtherBooking ? "Already Accepted (Another Booking)" : "Already Accepted")
                : "Pending Acceptance";
            const sampleStatusColor = isAccepted ? "#b45309" : "#15803d";

            const bookingInfo = `
           <div class="right">
               <div class="Name text"><span><i class="fa-regular fa-user"></i> Patient Name :</span> ${escapeHtml(booking.booking.patientName)}</div>
               <div class="date text"><span><i class="fa-solid fa-calendar-days"></i> Date :</span> ${new Date(booking.booking.date).toLocaleDateString()}</div>
               ${booking.booking.doctorName ? `<div class="doctor text"><span><i class="fa-solid fa-user-doctor"></i> Doctor :</span> ${escapeHtml(booking.booking.doctorName || "N/A")}</div>` : ""}
               <div class="total text"><span><i class="fa-solid fa-money-bill"></i> Total :</span> Rs. ${escapeHtml(booking.booking.total || "N/A")}</div>
               <div class="status text"><span><i class="fa-solid fa-flag"></i> Status :</span> ${escapeHtml(booking.booking.status || "Pending")}</div>
               <div class="status text"><span><i class="fa-solid fa-circle-check"></i> Sample Status :</span> <strong id="sampleAcceptanceStatusText" style="color: ${sampleStatusColor};">${escapeHtml(sampleStatusLabel)}</strong></div>
               <div class="tests text"><span><i class="fa-solid fa-microscope"></i> Tests :</span> ${escapeHtml(testsText || "N/A")}</div>
               <div class="tests text"><span><i class="fa-solid fa-vial"></i> Sample Type :</span> ${escapeHtml(booking.sampletype || "N/A")}</div>
           </div>
           <div class="left">
                ${booking.booking.patientPhone ? `<div class="Name text"><span><i class="fa-solid fa-phone"></i> Patient Phone :</span> ${escapeHtml(booking.booking.patientPhone)}</div>` : ""}
                ${booking.booking.year ? `<div class="date text"><span><i class="fa-solid fa-timeline"></i> Age :</span> ${escapeHtml(booking.booking.year)}</div>` : ""}
               <div class="doctor text"><span><i class="fa-solid fa-person-half-dress"></i> Gender :</span> ${escapeHtml(booking.booking.gender || "N/A")}</div>
               <div class="total text"><span><i class="fa-solid fa-barcode"></i> Barcode No. :</span> ${escapeHtml(barcodeId || "N/A")}</div>
               <div class="status text"><span><i class="fa-solid fa-address-book"></i> Franchisee :</span> ${escapeHtml(booking.booking.createdbyuser || "")}</div>
               ${booking.booking.courierName ? `<div class="status text"><span><i class="fa-solid fa-file"></i> Aadhar Name :</span> ${escapeHtml(booking.booking.courierName || "N/A")}</div>` : ""}
               ${booking.booking.courierId ? `<div class="status text"><span><i class="fa-solid fa-file"></i> Aadhar ID :</span> ${escapeHtml(booking.booking.courierId || "N/A")}</div>` : ""}
               ${booking.booking.file ? `<div class="status text"><span><i class="fa-solid fa-file"></i> Attachment :</span> ${booking.booking.file ? `<a href="${escapeHtml(booking.booking.file)}" target="_blank" rel="noopener noreferrer">open</a>` : "N/A"}</div>` : ""}
               ${booking.booking.clinicalHistory ? `<div class="status text"><span><i class="fa-solid fa-house-chimney-medical"></i> Clinical_History :</span> ${escapeHtml(booking.booking.clinicalHistory || "N/A")}</div>` : ""}
           </div>
       `;

            showPopup(bookingInfo);

            if (isAccepted) {
                const noticeText = acceptedInOtherBooking
                    ? "This barcode has already been accepted in another booking and cannot be accepted again."
                    : `This sample has already been accepted${formatAcceptedAtText(acceptedAt)}. It cannot be accepted again. If you want to lose this sample, click the Lose button below.`;
                applyAlreadyAcceptedUI(noticeText, acceptedAt, acceptedInOtherBooking);
            } else {
                setPopupNotice(null, "", "");
            }
        } else {
            showPopup("No booking found with this Barcode ID.", "No Booking Found", false);
        }
    } catch (error) {
        console.error("Error fetching booking:", error.message);
        showPopup("No booking found with this Barcode ID.", "No Booking Found", false);
    }
}

// Accept booking function to store in "All Cases"
async function acceptBooking() {
    if (window.__samplesState.isAcceptSubmitting) return;

    const status = "pending";
    const barcode = window.barcode; // Retrieve test names
    const bookingId = window.bookingId; // Retrieve by booking
    const state = window.currentSampleState || {};

    if (!barcode?.barcode) {
        alert("Please enter a Barcode ID.");
        return;
    }

    if (state.isAccepted) {
        const msg = state.acceptedInOtherBooking
            ? "Not accepted: This barcode has already been accepted in another booking."
            : "Not accepted: This sample has already been accepted. If you want to lose it, click the Lose button.";
        applyAlreadyAcceptedUI(msg, state.acceptedAt, state.acceptedInOtherBooking);
        alert(msg);
        if (!state.acceptedInOtherBooking) {
            document.getElementById("rejectBtnbarcode")?.focus();
        }
        return;
    }

    const acceptBtn = document.getElementById("acceptBtn");
    window.__samplesState.isAcceptSubmitting = true;
    if (acceptBtn) {
        acceptBtn.disabled = true;
        acceptBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Accepting...';
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/update-booking-status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ barcode, status, bookingId })
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message || "Sample accepted successfully.");
            closePopup();
        } else if (result.alreadyAccepted) {
            applyAlreadyAcceptedUI(
                result.message,
                result.acceptedAt,
                Boolean(result.inAnotherBooking)
            );
            alert(result.message || "This sample has already been accepted. If you want to lose it, click the Lose button.");
            if (!result.inAnotherBooking) {
                document.getElementById("rejectBtnbarcode")?.focus();
            }
        } else {
            alert(result.message || "Sample could not be accepted. Please try again.");
            syncPopupActionButtons(true);
        }
    } catch (error) {
        console.error("Error updating booking status:", error);
        alert("An error occurred. Please try again.");
        syncPopupActionButtons(true);
    } finally {
        window.__samplesState.isAcceptSubmitting = false;
    }
}