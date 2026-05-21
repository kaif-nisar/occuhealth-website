  const data = JSON.parse(localStorage.getItem("invoiceData")) || {};

  console.log("data:", data);
  
  // Order ID
  document.querySelector('.order-id').textContent = data.invoiceId || "#ORD-XXXX";

  // Order Date
  document.querySelector('.detail-row:nth-child(2) .detail-value').textContent = data.date || new Date().toLocaleDateString('en-IN');

  // Total
  document.querySelector('.detail-row:nth-child(3) .detail-value').textContent = data.total ? `₹${data.total}` : "₹0";

  // Delivery Date
  const estDeliveryDate = new Date();
  estDeliveryDate.setDate(estDeliveryDate.getDate() + 3);
  document.querySelector('.delivery-text p strong').textContent = estDeliveryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });


  // Continue shopping button
  document.querySelector('.continue-shopping').addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = `${BASE_URL}/${user.role}/${user.role}.html?page=Allproducts`;
  });
