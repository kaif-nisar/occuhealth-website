let orders = []; // Will be filled after fetch

async function fetchUserOrders() {
    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/fetchUserOrders`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Authorization header agar JWT lagta hai to:
                // 'Authorization': `Bearer ${localStorage.getItem("token")}`
            }
        });

        const data = await res.json();
        
        if (data.success) {
            orders = data.data;
            console.log(orders);
            renderOrders();
        } else {
            console.error("Error fetching orders:", data.message);
            ordersContainer.style.display = 'none';
            noOrders.style.display = 'block';
        }

    } catch (error) {
        console.error("Error while fetching orders:", error.message);
        ordersContainer.style.display = 'none';
        noOrders.style.display = 'block';
    }
}

fetchUserOrders();

const ordersContainer = document.getElementById('ordersContainer');
const noOrders = document.getElementById('noOrders');

function renderOrders() {
    if (!orders.length) {
        ordersContainer.style.display = 'none';
        noOrders.style.display = 'block';
        return;
    }

    ordersContainer.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <span class="order-id">Order ${order._id}</span>
                    <span class="order-date">Placed on ${new Date(order.date).toLocaleDateString()}</span>
                </div>
                <span class="order-status status-${order.orderStatus.toLowerCase()}">${order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</span>
            </div>

            <div class="order-details">
                ${order.products.map(p => `
                    <div class="order-product">
                        <div class="product-image">
                            <img src="${p.image}" alt="${p.title}">
                        </div>
                        <div class="product-info">
                            <h4 class="product-title">${p.title}</h4>
                            <p class="product-quantity">Qty: ${p.quantity}</p>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="order-summary">
                <div class="order-total">Total: ₹${order.total.toLocaleString()}</div>
                <div class="order-actions">
                    ${order.orderStatus !== "cancelled" ? `<button class="btn btn-primary" onclick="trackOrder('${order._id}')">Track Order</button>` : ''}
                    <button class="btn btn-outline" onclick="viewDetails('${order._id}')">View Details</button>
                    <button class="btn btn-outline" onclick="buyAgain('${order._id}')">Buy Again</button>
                    ${order.orderStatus === "pending" ? `<button class="btn btn-outline" onclick="cancelOrder('${order._id}')">Cancel Order</button>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Dummy functions for actions
function trackOrder(id) {
    const order = orders.find(o => o._id === id);
    if (!order) return alert("Order not found!");

    document.getElementById('trackingIdText').textContent = order.trackingId || "N/A";
    document.getElementById('courierNameText').textContent = order.courierName || "N/A";

    document.getElementById('trackingModal').style.display = 'flex';
}

function closeTrackingModal() {
    document.getElementById('trackingModal').style.display = 'none';
}

function viewDetails(id) {
    const order = orders.find(o => o._id === id);
    if (!order) return alert("Order not found!");

    document.getElementById("detailsOrderId").textContent = order._id;
    document.getElementById("detailsStatus").textContent = order.orderStatus;
    document.getElementById("detailsDate").textContent = new Date(order.date).toLocaleDateString();

    // Products
    const productsHTML = order.products.map(p => `
    <div style="display:flex; align-items:center; gap:15px; border-bottom:1px solid #e5e7eb; padding:10px 0;">
      <img src="${p.image}" alt="${p.title}" style="width:60px; height:60px; border-radius:4px; object-fit:cover;">
      <div style="flex:1;">
        <div style="font-weight:500;">${p.title}</div>
        <div style="font-size:0.85rem;">Qty: ${p.quantity}</div>
        <div style="font-size:0.85rem;">Price: ₹${p.price}</div>
      </div>
    </div>
  `).join('');
    document.getElementById("detailsProducts").innerHTML = productsHTML;

    // Shipping Info
    const a = order.address;
    document.getElementById("detailsShipping").innerHTML = `
    <p><strong>Name:</strong> ${a.firstName || ""} ${a.lastName || ""}</p>
    <p><strong>Email:</strong> ${a.email || ""}</p>
    <p><strong>Phone:</strong> ${a.phone || ""}</p>
    <p><strong>Address:</strong> ${a.address1 || ""}, ${a.address2 || ''}, ${a.city || ""}, ${a.state || ""} - ${a.pincode}, ${a.country || 'India'}</p>
  `;

    document.getElementById("detailsSubtotal").textContent = (order.total - order.tax);
    document.getElementById("detailsTax").textContent = order.tax || 0;
    document.getElementById("detailsTotal").textContent = order.total;

    document.getElementById("orderDetailsModal").style.display = 'flex';
}

function closeOrderDetails() {
    document.getElementById("orderDetailsModal").style.display = 'none';
}

function buyAgain(id) {
    window.location.href = `${BASE_URL}/${user.role}.html?page=Allproducts`
}
async function cancelOrder(orderId) {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/cancelOrder/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderStatus: "cancelled",
                message: "User cancelled the order"
            })
        });

        const data = await res.json();
        if (data.success) {
            alert("Order cancelled successfully.");
            // Optionally refresh:
            location.reload();
        } else {
            alert("Failed to cancel order: " + data.message);
        }
    } catch (err) {
        console.error("Error cancelling order:", err);
        alert("Something went wrong.");
    }
}