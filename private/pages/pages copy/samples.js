     // Popup functions
     function showPopup(message, title = "Booking Information", showButtons = true) {
       document.getElementById("popupTitle").textContent = title;
       document.getElementById("popupMessage").innerHTML = message;
       document.getElementById("popupOverlay").style.display = "flex";
   
       // Show or hide buttons based on the showButtons parameter
       document.getElementById("acceptBtn").style.display = showButtons ? "inline-block" : "none";
       document.getElementById("rejectBtn").style.display = showButtons ? "inline-block" : "none";
       document.getElementById("rejectBtnbarcode").style.display = showButtons ? "inline-block" : "none";
   }

   document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      searchBooking(); // Call the function only when Enter is pressed
    }
  });
     
   function closePopup() {
       document.getElementById("popupOverlay").style.display = "none";
   }
   
   // Reject booking function to update status to 'cancel'
   async function rejectBooking() {
       const barcodeId = document.getElementById("search").value;
       const status = "canceled";
       if (!barcodeId) {
           alert("Please enter a Barcode ID.");
           return;
       }
   
       try {
           const response = await fetch(`${BASE_URL}/api/v1/user/reject-booking`, {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({ barcodeId, status })
           });
   
           const data = await response.json();
           if (response.ok) {
               alert(data.message);
               closePopup();
           } else {
               alert(data.message);
           }
       } catch (error) {
           console.error("Error updating booking status:", error);
           alert("An error occurred. Please try again.");
       }
   }
   
   async function rejectBarcode() {
       const barcodeId = document.getElementById("search").value;
       if (!barcodeId) {
           alert("Please enter a Barcode ID.");
           return;
       }
   
       try {
           const response = await fetch(`${BASE_URL}/api/v1/user/reject-barcode`, {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({ barcodeId })
           });
   
           const result = await response.json();
   
           if (response.ok) {
               alert(result.message);
               closePopup();
           } else {
               alert(result.message);
           }
       } catch (error) {
           console.error("Error updating booking status:", error);
           alert("An error occurred. Please try again.");
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
   
           const response = await fetch(`${BASE_URL}/api/v1/user/get-barcode`, {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({ barcodeId })
           });
   
           const result = await response.json();
           if (response.ok && result.data) {
               // If booking found, display booking details
               const booking = result.data;
   
               let tests = booking.tableData
                   .filter(item => item.barcodeId === barcodeId) // Ensure the barcode matches
                   .map(item => item.testName) // Extract test names
                   .join(", ");
   
               let testsSampleType = booking.tableData
                   .filter(item => item.barcodeId === barcodeId) // Ensure the barcode matches
                   .map(item => item.typeOfSample) // Extract test names
                   .join(", ");
               console.log("this is sampletype", testsSampleType);
   
               let testsAndPannels;
               try {
                   const response = await fetch(`${BASE_URL}/api/v1/user/testsByBarcode`, {
                       method: "POST",
                       headers: {
                           "Content-Type": "application/json"
                       },
                       body: JSON.stringify({ barcodeId, tests, sampletype:testsSampleType, bookingId:booking.bookingId })
                   });
                   testsAndPannels = await response.json();
               } catch (error) {
                   console.log(error)
               }
   
               const bookingInfo = `
           <div class="right">
               <div class="Name text"><span><i class="fa-regular fa-user"></i> Patient Name :</span> ${booking.patientName}</div>
               <div class="date text"><span><i class="fa-solid fa-calendar-days"></i> Date :</span> ${new Date(booking.date).toLocaleDateString()}</div>
               ${booking.doctorName? `<div class="doctor text"><span><i class="fa-solid fa-user-doctor"></i> Doctor :</span> ${booking.doctorName || "N/A"}</div>` : ""}
               <div class="total text"><span><i class="fa-solid fa-money-bill"></i> Total :</span> Rs. ${booking.total || "N/A"}</div>
               <div class="status text"><span><i class="fa-solid fa-flag"></i> Status :</span> ${booking.status || "Pending"}</div>
               <div class="tests text"><span><i class="fa-solid fa-microscope"></i> Tests :</span> ${testsAndPannels.testandpannelArray || "N/A"}</div>
           </div>
           <div class="left">
                ${booking.patientPhone? `<div class="Name text"><span><i class="fa-solid fa-phone"></i> Patient Phone :</span> ${booking.patientPhone}</div>`: ""}
                ${booking.year? `<div class="date text"><span><i class="fa-solid fa-timeline"></i> Age :</span> ${booking.year}</div>`: ""}
               <div class="doctor text"><span><i class="fa-solid fa-person-half-dress"></i> Gender :</span> ${booking.gender || "N/A"}</div>
               <div class="total text"><span><i class="fa-solid fa-barcode"></i> Barcode No. :</span> ${testsAndPannels.barcode || "N/A"}</div>
               <div class="status text"><span><i class="fa-solid fa-address-book"></i> Franchisee :</span> ${booking.franchisee || "Pending"}</div>
               ${booking.file? `<div class="status text"><span><i class="fa-solid fa-file"></i> Attachment :</span> ${booking.file? `<a href="${booking.file}">open</a>`: "N/A"}</div>`: ""}
               ${booking.clinicalHistory? `<div class="status text"><span><i class="fa-solid fa-house-chimney-medical"></i> Clinical_History :</span> ${booking.clinicalHistory || "N/A"}</div>`: ""}
           </div>
       `;
   
               showPopup(bookingInfo);
   
               // Store test names for later use in acceptBooking()
               window.barcode = testsAndPannels;
               // window.sampleType = testsSampleType;
               window.bookingId = booking.bookingId;
           } else {
               showPopup("No booking found with this Barcode ID.", "No Booking Found", false);
           }
       } catch (error) {
           console.error("Error fetching booking:", error);
           showPopup("No booking found with this Barcode ID.", "No Booking Found", false);
       }
   }
   
   // Accept booking function to store in "All Cases"
   async function acceptBooking() {
       const status = "pending";
       const barcode = window.barcode; // Retrieve test names
       const bookingId = window.bookingId; // Retrieve by booking
   
       if (!barcode.barcode) {
           alert("Please enter a Barcode ID.");
           return;
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
               alert(result.message);
               closePopup();
           } else {
               alert(result.message);
           }
       } catch (error) {
           console.error("Error updating booking status:", error);
           alert("An error occurred. Please try again.");
       }
   }