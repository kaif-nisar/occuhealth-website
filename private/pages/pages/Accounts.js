// Store franchisees data globally for search and export
let allFranchisees = [];

async function loadFranchiseesWithBalance() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (data.success) {
            allFranchisees = data.message; // Store globally for search
            displayFranchisees(allFranchisees);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error loading franchisees with balance:', error);
    }
}

// Display franchisees in table
function displayFranchisees(franchiseesList) {
    const tbody = document.querySelector('#tbody');
    tbody.innerHTML = ''; // Clear previous entries

    franchiseesList.forEach((franchisee, index) => {
        const balanceClass = franchisee.bookingWallet < 0 ? 'balance-negative' : 'balance-positive';
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>FR${franchisee._id}</td>
                <td>${franchisee.fullName}</td>
                <td><i class="fas fa-user"></i> ${franchisee.username}</td>
                <td class="${balanceClass}">${franchisee.bookingWallet}</td>
                <td class="status-access">${franchisee.isActive ? 'Access' : 'No Access'}</td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Search functionality - with proper error handling
function initializeSearch() {
    const searchInput = document.querySelector('input[type="search"]') || 
                       document.querySelector('#searchInput') ||
                       document.querySelector('[placeholder*="Search"]');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            
            const filteredFranchisees = allFranchisees.filter(franchisee => {
                return (
                    franchisee.fullName.toLowerCase().includes(searchTerm) ||
                    franchisee.username.toLowerCase().includes(searchTerm) ||
                    `FR${franchisee._id}`.toLowerCase().includes(searchTerm)
                );
            });
            
            displayFranchisees(filteredFranchisees);
        });
        console.log('Search initialized successfully');
    } else {
        console.warn('Search input not found in DOM');
    }
}

// Excel Export - with error handling
function initializeExcelButton() {
    const excelBtn = document.getElementById('excelBtn');
    if (excelBtn) {
        excelBtn.addEventListener('click', function() {
            if (allFranchisees.length === 0) {
                alert('No data available for Excel export');
                return;
            }

            // Prepare data for Excel
            const excelData = allFranchisees.map((franchisee, index) => ({
                '#': index + 1,
                'Franchisee ID': `FR${franchisee._id}`,
                'Franchisee Name': franchisee.fullName,
                'Username': franchisee.username,
                'Balance': franchisee.bookingWallet,
                'Status': franchisee.isActive ? 'Access' : 'No Access'
            }));

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Franchisees');
            
            // Generate Excel file
            XLSX.writeFile(wb, 'Franchisee_List.xlsx');
        });
        console.log('Excel button initialized');
    } else {
        console.warn('Excel button not found');
    }
}

// PDF Export - with error handling
function initializePDFButton() {
    const pdfBtn = document.getElementById('pdfBtnJ');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', function() {
            if (allFranchisees.length === 0) {
                alert('No data available for PDF generation');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(16);
            doc.text('Franchisee List', 14, 15);

            // Prepare table data
            const headers = ['#', 'Franchisee ID', 'Franchisee Name', 'Username', 'Balance', 'Status'];
            
            const rows = allFranchisees.map((franchisee, index) => [
                index + 1,
                `FR${franchisee._id}`,
                franchisee.fullName,
                franchisee.username,
                franchisee.bookingWallet,
                franchisee.isActive ? 'Access' : 'No Access'
            ]);

            // Create PDF table
            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 25,
                margin: { top: 10, left: 10, right: 10, bottom: 10 },
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255 }
            });

            // Save PDF
            doc.save('Franchisee_List.pdf');
        });
        console.log('PDF button initialized');
    } else {
        console.warn('PDF button not found');
    }
}

// Load data on page load
loadFranchiseesWithBalance();

// Initialize buttons and search after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    initializeExcelButton();
    initializePDFButton();
});

// Fallback: Try to initialize after a short delay if DOM is already loaded
setTimeout(() => {
    initializeSearch();
    initializeExcelButton();
    initializePDFButton();
}, 500);