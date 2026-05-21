// ✅ Elements
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const searchInput = document.getElementById("search");
const tableBody = document.querySelector("tbody");
const entriesInfo = document.querySelector(".entries-info"); // better selector
const searchButton = document.querySelector(".card button");

// ✅ Pagination
let currentPage = 1;
const limit = 5;

// ✅ Data Cache
let allInvoices = [];
let filteredInvoices = [];

// ✅ Fetch invoices from server
async function fetchInvoices() {
    const start = startInput.value;
    const end = endInput.value;

    try {
        const url = new URL(`${BASE_URL}/api/v1/user/getAllInvoices`);
        url.searchParams.append("start", start);
        url.searchParams.append("end", end);

        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            allInvoices = data.data;
            currentPage = 1;
            applyFilters();
        } else {
            alert("Failed to fetch invoices.");
        }
    } catch (error) {
        console.error("Error fetching invoices:", error);
        alert("Error fetching invoices.");
    }
}

// ✅ Apply search filter & pagination
function applyFilters() {
    const keyword = searchInput.value.trim().toLowerCase();
    if (keyword) {
        filteredInvoices = allInvoices.filter(inv =>
            (inv.bookingId && inv.bookingId.toLowerCase().includes(keyword)) ||
            (inv.billNumber && inv.billNumber.toLowerCase().includes(keyword))
        );
    } else {
        filteredInvoices = [...allInvoices];
    }
    renderTable();
}

// ✅ Render table rows
function renderTable() {
    tableBody.innerHTML = "";

    const total = filteredInvoices.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    const pageData = filteredInvoices.slice(startIndex, endIndex);

    pageData.forEach(inv => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${new Date(inv.createdAt).toISOString().split("T")[0]}</td>
            <td>${inv.bookingId || "-"}</td>
            <td>Rs. ${inv.bookingPrice || "-"}</td>
            <td>Rs. ${inv.billingPrice || "-"}</td>
            <td><button data-id="${inv._id}">Download</button></td>
        `;
        tableBody.appendChild(tr);
    });

    const totalAmount = filteredInvoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.billingPrice) || 0),
        0
    );

    const totalRow = document.createElement("tr");
    totalRow.className = "total-amount";
    totalRow.innerHTML = `
        <td colspan="4">Total Billing Amount</td>
        <td>Rs. ${totalAmount}</td>
    `;
    tableBody.appendChild(totalRow);

    entriesInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${total} entries`;

    // Download handlers
    tableBody.querySelectorAll("button[data-id]").forEach(btn => {
        btn.addEventListener("click", () => downloadInvoice(btn.dataset.id));
    });

    renderPaginationControls(totalPages);
}

// ✅ Download invoice
async function downloadInvoice(invoiceId) {
    try {
        const res = await fetch(`/api/invoices/${invoiceId}/download`);
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "invoice.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert("Error downloading invoice.");
    }
}

// ✅ Render Pagination
function renderPaginationControls(totalPages) {
    const container = document.querySelector(".pagination-controls");
    container.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "Previous";
    prev.disabled = currentPage === 1;
    prev.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    };

    const next = document.createElement("button");
    next.textContent = "Next";
    next.disabled = currentPage === totalPages;
    next.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    };

    container.appendChild(prev);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === currentPage) btn.style.background = "#007bff";
        btn.onclick = () => {
            currentPage = i;
            renderTable();
        };
        container.appendChild(btn);
    }

    container.appendChild(next);
}

// ✅ Event Listeners
searchButton.addEventListener("click", fetchInvoices);
searchInput.addEventListener("input", () => {
    currentPage = 1;
    applyFilters();
});

// ✅ Initial Load
fetchInvoices();
