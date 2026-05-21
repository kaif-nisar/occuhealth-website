    // ============= Utility Functions =============
    
    // Get date 24 hours ago
    function getLast24HoursDate() {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }

    // Get today's date
    function getTodayDate() {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }

    // Set default dates (last 24 hours)
    function setDefaultDates() {
      const startDateInput = document.getElementById('start-date');
      const endDateInput = document.getElementById('end-date');
      
      startDateInput.value = getLast24HoursDate();
      endDateInput.value = getTodayDate();
    }

    // Show/Hide table Loader
    function toggleLoader(show) {
      const tableBody = document.querySelector('.table-container tbody');
      if (show) {
        tableBody.innerHTML = `
          <tr>
            <td class="p-4 border text-center" colspan="7">
              <div class="flex items-center justify-center gap-3 py-6">
                <div class="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full loader-spin"></div>
                <span class="text-gray-600 font-medium">Loading tests in progress...</span>
              </div>
            </td>
          </tr>
        `;
      }
    }

    // Show/Hide PDF Download Loader
    function showLoader() {
      const loader = document.getElementById("loader1");
      console.log("Showing PDF Loader");
      if (!loader) {
        console.error("Loader element not found!");
        return;
      }
      loader.style.display = "flex";
    }

    function hideLoader() {
      const loader = document.getElementById("loader1");
      if (!loader) {
        console.error("Loader element not found!");
        return;
      }
      console.log("Hiding PDF Loader");
      loader.style.display = "none";
    }

    // ============= API Functions =============

    // Fetch completed bookings from API
    async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
      console.log('Fetching completed bookings with franchiseeId:', franchiseeId);
      
      if (!franchiseeId) {
        franchiseeId = userId;
      }
      
      const tableBody = document.querySelector('.table-container tbody');
      
      // Show loader
      toggleLoader(true);
      
      // Construct the query parameters for the API request
      let query = `?status=completed&startDate=${startDate}&endDate=${endDate}`;
      if (franchiseeId) {
        query += `&franchiseeId=${franchiseeId}`;
      }

      try {
        const response = await fetch(`${BASE_URL}/api/v1/user/bookings${query}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch bookings');
        }

        const response_data = await response.json();
        console.log('Bookings received:', response_data);

        // ✅ Handle both old and new response formats
        const bookings = response_data.data || response_data;

        // Check if no data
        if (!bookings || bookings.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td class="p-4 border text-center" colspan="7">
                <div class="flex flex-col items-center justify-center gap-2 py-6">
                  <i class="fas fa-inbox text-4xl text-gray-400"></i>
                  <span class="text-gray-600 font-medium">No completed tests found</span>
                  <span class="text-gray-500 text-sm">Try adjusting your date filters</span>
                </div>
              </td>
            </tr>
          `;
          return;
        }

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
            ? booking.tableData[0].barcodeId
            : 'N/A';

          const row = document.createElement('tr');
          row.classList.add('hover:bg-green-50', 'transition-colors');
          
          row.innerHTML = `
            <td class="p-3 border">${index + 1}</td>
            <td class="p-3 border">
              <a href="#" class="text-blue-600 hover:underline font-medium" title="Click to download report">
                ${booking.bookingId}
              </a>
            </td>
            <td class="p-3 border">${booking.patientName}</td>
            <td class="p-3 border">${booking.gender} (${booking.year})</td>
            <td class="p-3 border text-sm">${tests}</td>
            <td class="p-3 border font-mono text-sm">${sampleId || 'N/A'}</td>
            <td class="p-3 border">
              <span class="text-green-600 font-bold px-2 py-1 bg-green-100 rounded">
                ${booking.status}
              </span>
            </td>
          `;
          
          fragment.appendChild(row);
        });

        // Append the document fragment to the table body
        tableBody.appendChild(fragment);

      } catch (error) {
        console.error('Error fetching bookings:', error);
        tableBody.innerHTML = `
          <tr>
            <td class="p-4 border text-center" colspan="7">
              <div class="flex flex-col items-center justify-center gap-2 py-6">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
                <span class="text-red-600 font-medium">Failed to load completed tests</span>
                <span class="text-gray-500 text-sm">Please try again later</span>
              </div>
            </td>
          </tr>
        `;
      }
    }

    // Fetch sub-franchisees
    // async function subfranchisee() {
    //   try {
    //     const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { 
    //       method: "GET" 
    //     });
        
    //     const allsubfran = await response.json();
    //     const subFranchiseeSelect = document.getElementById('franchisee-select');
        
    //     if (allsubfran.message && Array.isArray(allsubfran.message)) {
    //       allsubfran.message.forEach(subfran => {
    //         const option = document.createElement('option');
    //         option.id = "tests-name-option";
    //         option.classList.add('subFranchisee-option');
    //         option.setAttribute("data-id", subfran._id);
    //         option.innerText = subfran.fullName;
    //         subFranchiseeSelect.appendChild(option);
    //       });
    //     }
    //   } catch (error) {
    //     console.error("Error fetching sub-franchisees:", error);
    //   }
    // }

    // Fetch report data
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

        return await response.json();
      } catch (error) {
        console.error(error);
        return null;
      }
    }

    // Auto-generate PDF
    async function autogeneratingpdf({
      value1,
      labinchargesign = null, 
      checkBox = false, 
      labinchargeinfo = "",
      backgroundImageUrl = null, 
      headermargin, 
      footermargin,
      marginRight, 
      marginLeft, 
      labinchargesignurl = null,
      selectedFontSize, 
      RowSpacing, 
      HighLow, 
      HLinred,
      BoldRow, 
      showInvest, 
      patientname = "report"
    } = {}) {
      try {
        showLoader();

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

        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${patientname}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);

      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        hideLoader();
      }
    }

    // ============= Event Listeners =============

    // Search button click handler
    document.querySelector('#search-button').addEventListener('click', function () {
      const startDate = document.getElementById('start-date').value;
      const endDate = document.getElementById('end-date').value;
      
      const franchiseeSelect = document.getElementById('franchisee-select');
      const selectedOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];
      const franchiseeId = selectedOption ? selectedOption.getAttribute('data-id') : null;

      fetchBookings(startDate, endDate, franchiseeId);
    });

    // Table click handler for PDF download
    document.querySelector(".table-container").addEventListener("click", async function (event) {
      const anchor = event.target.closest("a");
      
      if (!anchor) return;

      event.preventDefault();

      const row = anchor.closest('tr');
      const patientname = row.cells[2].textContent.trim();
      const bookingId = anchor.textContent.trim();
      
      if (!bookingId) return;

      try {
        showLoader();
        const patientDetails = await fetchreport(bookingId);
        
        if (!patientDetails) {
          console.error("Patient details not found");
          alert("Failed to fetch patient details");
          hideLoader();
          return;
        }

        await autogeneratingpdf({ value1: patientDetails._id, patientname });

      } catch (error) {
        console.error("Error fetching report:", error);
        alert("Error generating report. Please try again.");
      } finally {
        hideLoader();
      }
    });

    // ============= Initialize on Page Load =============
    (async function loadBookings() {
      // Set default dates (last 24 hours)
      setDefaultDates();
      
      // Load sub-franchisees
    //   await subfranchisee();
      
      // Fetch bookings with default 24 hours range
      const startDate = getLast24HoursDate();
      const endDate = getTodayDate();
      await fetchBookings(startDate, endDate);
    })();
