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

// Show/Hide Loader
function toggleLoader(show) {
  const tableBody = document.querySelector('.table-container tbody');
  if (show) {
    tableBody.innerHTML = `
          <tr>
            <td class="p-4 border text-center" colspan="8">
              <div class="flex items-center justify-center gap-3 py-6">
                <div class="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full loader-spin"></div>
                <span class="text-gray-600 font-medium">Loading bookings...</span>
              </div>
            </td>
          </tr>
        `;
  }
}

// ============= API Functions =============

// Fetch bookings from API
async function fetchBookings(startDate = '', endDate = '', franchiseeId = '') {
  console.log('Fetching bookings with franchiseeId:', franchiseeId);

  if (!franchiseeId) {
    franchiseeId = userId;
  }

  const tableBody = document.querySelector('.table-container tbody');

  // Show loader
  toggleLoader(true);

  // Construct the query parameters
  let query = `?startDate=${startDate}&endDate=${endDate}`;
  if (franchiseeId) {
    query += `&franchiseeId=${franchiseeId}`;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/v1/user/all-bookings${query}`);

    if (!response.ok) {
      throw new Error('Failed to fetch bookings');
    }

    const bookings = await response.json();

    // Check if no data
    if (!bookings.data || bookings.data.length === 0) {
      tableBody.innerHTML = `
            <tr>
              <td class="p-4 border text-center" colspan="8">
                <div class="flex flex-col items-center justify-center gap-2 py-6">
                  <i class="fas fa-inbox text-4xl text-gray-400"></i>
                  <span class="text-gray-600 font-medium">No bookings found</span>
                  <span class="text-gray-500 text-sm">Try adjusting your filters</span>
                </div>
              </td>
            </tr>
          `;
      return;
    }

    // Clear the table
    tableBody.innerHTML = '';

    // Create a document fragment
    const fragment = document.createDocumentFragment();

    // Populate the table
    bookings.data.forEach((booking, index) => {
      // Format tests from tableData
      const tests = Array.isArray(booking.tableData)
        ? booking.tableData.map(test => `${test.testName} (${test.typeOfSample}) - ${test.barcodeId}`).join('<br>')
        : 'No tests available';

      const sampleId = Array.isArray(booking.tableData) && booking.tableData[0]?.barcodeId
        ? booking.tableData[0].barcodeId
        : 'N/A';

      const row = document.createElement('tr');

      // Determine row background color based on status
      let rowColor;
      switch (booking.status) {
        case 'On Hold':
          rowColor = 'rgba(255, 0, 0, 0.1)';
          break;
        case 'pending':
          rowColor = 'rgba(255, 165, 0, 0.1)';
          break;
        case 'completed':
          rowColor = 'rgba(0, 255, 0, 0.1)';
          break;
        default:
          rowColor = 'transparent';
      }

      row.style.backgroundColor = rowColor;
      row.classList.add('hover:bg-opacity-80', 'transition-colors');

      row.innerHTML = `
            <td class="p-3 border">${index + 1}</td>
            <td class="p-3 border"><a href="#" class="text-blue-600 hover:underline font-medium">${booking.bookingId}</a></td>
            <td class="p-3 border">${booking.patientName}</td>
            <td class="p-3 border">${booking.gender} (${booking.year})</td>
            <td class="p-3 border text-sm">${tests}</td>
            <td class="p-3 border font-mono text-sm">${sampleId || 'N/A'}</td>
            <td class="p-3 border font-bold">${booking.status}</td>
            <td class="p-3 border">
              <button onclick='editpage("${booking.bookingId}")' 
                      class="edit-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer border-0">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
                Edit
              </button>
            </td>
          `;

      fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);

  } catch (error) {
    console.error('Error fetching bookings:', error);
    tableBody.innerHTML = `
          <tr>
            <td class="p-4 border text-center" colspan="8">
              <div class="flex flex-col items-center justify-center gap-2 py-6">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
                <span class="text-red-600 font-medium">Failed to load bookings</span>
                <span class="text-gray-500 text-sm">Please try again later</span>
              </div>
            </td>
          </tr>
        `;
  }
}

// Fetch sub-franchisees
async function subfranchisee() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, { 
      method: "GET" 
    });
    
    // Agar response OK nahi hai, to quietly skip kar do
    if (!response.ok) {
      console.log('Sub-franchisees not available, skipping...');
      return;
    }
    
    const allsubfran = await response.json();
    const subFranchiseeSelect = document.getElementById('franchisee-select');
    
    // Handle different possible response structures
    let subFranchisees = [];
    
    if (Array.isArray(allsubfran)) {
      subFranchisees = allsubfran;
    } else if (allsubfran.message && Array.isArray(allsubfran.message)) {
      subFranchisees = allsubfran.message;
    } else if (allsubfran.data && Array.isArray(allsubfran.data)) {
      subFranchisees = allsubfran.data;
    }
    
    // Agar koi franchisees nahi hain, to skip kar do
    if (subFranchisees.length === 0) {
      console.log('No sub-franchisees found, skipping...');
      return;
    }
    
    // Populate the dropdown
    subFranchisees.forEach(subfran => {
      const option = document.createElement('option');
      option.classList.add('subFranchisee-option');
      option.setAttribute("data-id", subfran._id);
      option.innerText = subfran.fullName || subfran.name || 'Unknown';
      subFranchiseeSelect.appendChild(option);
    });
    
  } catch (error) {
    // Error ko console mein log karo but user ko disturb mat karo
    console.log('Sub-franchisees could not be loaded, continuing without them...');
  }
}

// ============= Edit Booking Function =============

// Open edit booking page in new tab
function editpage(id) {
  window.open(
    `${BASE_URL}/${user.role}/${user.role}.html?page=editbooking&id=${encodeURIComponent(id)}`,
    "_blank"
  );
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

// ============= Initialize on Page Load =============
(async function loadBookings() {
  // Set default dates (last 24 hours)
  setDefaultDates();

  // Load sub-franchisees
  await subfranchisee();

  // Fetch bookings with default 24 hours range
  const startDate = getLast24HoursDate();
  const endDate = getTodayDate();
  await fetchBookings(startDate, endDate);
})();
