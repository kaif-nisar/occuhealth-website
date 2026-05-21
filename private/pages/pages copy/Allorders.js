// Sample data (you can replace this with actual API call)
let orders = [];

async function fetchAllOrdersFromAPI() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/fetchAllOrders`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // agar token chahiye toh yeh include karein:
                // 'Authorization': `Bearer ${yourAuthToken}`
            }
        });

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            filteredOrders = result.data;
            orders = [...filteredOrders];
            console.log("orders:", orders);

            currentPage = 1;
            renderOrders();
        } else {
            console.error("Failed to fetch orders:", result.message);
        }
    } catch (error) {
        console.error("Error while fetching orders:", error.message);
    }
}

fetchAllOrdersFromAPI();

let filteredOrders = [...orders];
let currentPage = 1;
const itemsPerPage = 5;

function renderOrders() {
    const tbody = document.getElementById('orderTableBody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(start, end);
    let counts = {
        total: orders.length,
        Pending: 0,
        Shipped: 0,
        Cancelled: 0,
        Delivered: 0
    };

    for (const order of paginatedOrders) {
        if (order.orderStatus === "pending") {
            counts.Pending += 1;
        } else if (order.orderStatus === "shipped") {
            counts.Shipped += 1;
        } else if (order.orderStatus === "delivered") {
            counts.Delivered += 1;
        } else if (order.orderStatus === "cancelled") {
            counts.Cancelled += 1;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">OR_I${order._id}</td>
      <td class="px-6 py-4 whitespace-nowrap">${order.address.firstName} ${order.address.lastName}</td>
      <td class="px-6 py-4 whitespace-nowrap">${new Date(order.createdAt).toLocaleDateString()}</td>
      <td class="px-6 py-4 whitespace-nowrap">₹${order.total}</td>
      <td class="px-6 py-4 whitespace-nowrap"><span class="status-${order.orderStatus.toLowerCase()}">${order.orderStatus}</span></td>
      <td class="px-6 py-4 whitespace-nowrap">${order.trackingId || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-right">
        <button onclick="viewDetails('${order._id}')" class="text-blue-600 hover:underline">View</button>
      </td>
    `;
        tbody.appendChild(tr);
    }
    updateStatusCounts(counts);
    updatePaginationText();
    updatePaginationButtons();
}
function updateStatusCounts(counts) {
    console.log("counts:", counts);

    document.getElementById('totalCount').innerText = counts.total;
    document.getElementById('pendingCount').innerText = counts.Pending;
    document.getElementById('shippedCount').innerText = counts.Shipped;
    document.getElementById('cancelledCount').innerText = counts.Cancelled;
    document.getElementById('deliveredCount').innerText = counts.Delivered;
}

function updatePaginationText() {
    const total = filteredOrders.length;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, total);
    const info = document.getElementById('Showingdata');
    if (info) {
        info.innerHTML = `                        <p class="text-sm text-gray-700" id="Showingdata">

    Showing <span class="font-medium">${start}</span> to <span class="font-medium">${end}</span> of <span class="font-medium">${total}</span> results
    </p>`;
    }
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;

    if (document.getElementById('prevPageMobile')) {
        document.getElementById('prevPageMobile').disabled = currentPage === 1;
    }
    if (document.getElementById('nextPageMobile')) {
        document.getElementById('nextPageMobile').disabled = currentPage >= totalPages;
    }

    const nav = document.querySelector("nav[aria-label='Pagination']");
    if (nav) {
        const pageButtons = Array.from(nav.querySelectorAll('button')).filter(btn => !btn.querySelector('i'));
        pageButtons.forEach(btn => btn.remove());

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium ${i === currentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : ''}`;
            btn.addEventListener('click', () => {
                currentPage = i;
                renderOrders();
            });
            nav.insertBefore(btn, nav.querySelector('#nextPage'));
        }
    }
}

function applyFilters() {
    const orderId = document.getElementById('searchOrderId').value.trim().toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const customer = document.getElementById('customerFilter').value.trim().toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    filteredOrders = orders.filter(order => {
        return (
            (!orderId || order._id.toLowerCase().includes(orderId)) &&
            (!status || order.orderStatus.toLowerCase() === status.toLowerCase()) &&
            (!customer || order.address.firstName?.toLowerCase().includes(customer) || order.address.lastName?.toLowerCase().includes(customer)) &&
            (!startDate || new Date(order.createdAt).setHours(0, 0, 0, 0) >= new Date(startDate).setHours(0, 0, 0, 0)) &&
            (!endDate || new Date(order.createdAt).setHours(0, 0, 0, 0) <= new Date(endDate).setHours(0, 0, 0, 0))
        );
    });

    currentPage = 1;
    renderOrders();
}

function resetFilters() {
    document.getElementById('searchOrderId').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('customerFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    filteredOrders = [...orders];
    currentPage = 1;
    renderOrders();
}

function viewDetails(orderId) {
    const order = orders.find(o => o._id === orderId);
    if (!order) return;

    document.getElementById('detailOrderId').innerText = `OR_I${order._id}`;
    document.getElementById('orderStatusSelect').value = order.orderStatus;
    document.getElementById('courierCompanySelect').value = order.courierName;
    document.getElementById('trackingNumberInput').value = order.trackingId;
    document.getElementById('updateOrderBtn').setAttribute('onclick', `updateOrderDetails('${order._id}')`);
    document.getElementById('cancelOrderBtn').setAttribute('onclick', `cancelOrder('${order._id}')`);
    document.getElementById('customerinfo').innerHTML = `                
                <div>
                    <div class="bg-gray-50 p-4 rounded-lg space-y-4">
                        <div>
                            <h3 class="font-medium mb-2">Customer Information</h3>
                            <p id="customerName">${order.address.firstName || ""} ${order.address.lastName || ""}</p>
                            <p id="customerEmail" class="text-sm text-gray-600">${order.address.email || ""}</p>
                            <p id="customerPhone" class="text-sm text-gray-600">${order.address.phone}</p>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">Shipping Address</h3>
                            <p id="shippingAddress" class="text-sm">
                                ${order.address.address1 || ""}<br>
                                ${order.address.address2 || ""}<br>
                                ${order.address.city || ""} - ${order.address.pincode || ""}<br>
                                ${order.address.state || ""}, ${order.address.country || "India"}
                            </p>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">Shipping Method</h3>
                            <p id="shippingMethod" class="text-sm">Standard Shipping (3-5 business days)</p>
                        </div>

                        <div>
                            <h3 class="font-medium mb-2">Payment Method</h3>
                            <p id="paymentMethod" class="text-sm">wallet</p>
                        </div>
                    </div>
                </div>`;

    // 👇 New layout added here (without removing old one)
    document.getElementById('orderItemsContainer').innerHTML = order.products.map(item => `
    <div class="flex items-start gap-4 border-b pb-4">
      <img src="${item.image}" alt="${item.title}" class="w-20 h-20 object-cover rounded border">
      <div class="flex-1">
        <h4 class="font-semibold text-gray-800 text-base">${item.title}</h4>
        <p class="text-sm text-gray-500">Generic product description</p>
        <div class="mt-2 flex items-center justify-between text-sm">
          <span class="text-gray-600">Qty: <strong>${item.quantity}</strong></span>
          <span class="text-gray-800 font-semibold">₹${item.price * item.quantity}</span>
        </div>
      </div>
    </div>
  `).join('');

    document.getElementById('subtotalAmount').innerText = `₹${order.total}`;
    document.getElementById('taxAmount').innerText = `₹${order.tax}`;
    document.getElementById('totalAmount').innerText = `₹${order.total}`;

    document.getElementById('orderDetailModal').classList.remove('hidden');
    document.getElementById('orderDetailModal').style.overflowY = 'auto';
    document.getElementById('orderDetailModal').style.maxHeight = '100vh';
}


document.getElementById('closeDetailModalBtn').addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.add('hidden');
});

document.getElementById('filterBtn').addEventListener('click', applyFilters);
document.getElementById('resetBtn').addEventListener('click', resetFilters);

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderOrders();
    }
});
document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < Math.ceil(filteredOrders.length / itemsPerPage)) {
        currentPage++;
        renderOrders();
    }
});

if (document.getElementById('prevPageMobile')) {
    document.getElementById('prevPageMobile').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderOrders();
        }
    });
}
if (document.getElementById('nextPageMobile')) {
    document.getElementById('nextPageMobile').addEventListener('click', () => {
        if (currentPage < Math.ceil(filteredOrders.length / itemsPerPage)) {
            currentPage++;
            renderOrders();
        }
    });
}

renderOrders();

async function updateOrderDetails(orderId) {
    const newStatus = document.getElementById('orderStatusSelect').value;
    const courier = document.getElementById('courierCompanySelect').value.trim();
    const trackingId = document.getElementById('trackingNumberInput').value.trim();

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/updateOrder/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${yourToken}` // if needed
            },
            body: JSON.stringify({
                orderStatus: newStatus,
                courierName: courier,
                trackingId: trackingId
            })
        });

        const result = await response.json();
        if (result.success) {
            alert("Order updated successfully!");
            fetchAllOrdersFromAPI(); // refresh orders
            document.getElementById('orderDetailModal').classList.add('hidden');
        } else {
            alert(`Failed to update order: ${result.message}`);
        }
    } catch (error) {
        console.error("Error updating order:", error);
        alert("Something went wrong while updating the order.");
    }
}
async function cancelOrder(orderId) {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/cancelOrder/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderStatus: "cancelled", message: "Seller canceled the order" })
        });

        const result = await response.json();
        if (result.success) {
            alert("Order cancelled successfully!");
            fetchAllOrdersFromAPI(); // refresh list
            document.getElementById('orderDetailModal').classList.add('hidden');
        } else {
            alert(`Failed to cancel order: ${result.message}`);
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        alert("Something went wrong while cancelling the order.");
    }
}


