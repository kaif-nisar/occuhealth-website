
(async function () {
    const { jsPDF } = window.jspdf;

    const invoiceDateEl = document.querySelector(".invoice-header p");
    const invoiceIdEl = document.querySelector(".invoice-header h3");
    const billToEl = document.querySelector(".invoice-meta div:last-child");
    const tableBody = document.querySelector(".product-table tbody");
    const subtotalEl = document.querySelector(".totals .totals-row:nth-child(1) .totals-value");
    const taxEl = document.querySelector(".totals .totals-row:nth-child(2) .totals-value");
    const grandTotalEl = document.querySelector(".grand-total .totals-value");

    const now = new Date();
    const invoiceDate = now.toLocaleDateString("en-GB", { day: '2-digit', month: 'long', year: 'numeric' });
    const invoiceId = "INV-" + now.getFullYear() + 
                      ("0" + (now.getMonth() + 1)).slice(-2) + 
                      ("0" + now.getDate()).slice(-2) + "-" + 
                      ("0" + now.getHours()).slice(-2) + 
                      ("0" + now.getMinutes()).slice(-2) + 
                      ("0" + now.getSeconds()).slice(-2);
    invoiceDateEl.textContent = "Date: " + invoiceDate;
    invoiceIdEl.textContent = "Invoice #" + invoiceId;

    const address = JSON.parse(localStorage.getItem("address") || "{}");
    if (address && typeof address === "object") {
        billToEl.innerHTML = `
            <h3>Bill To:</h3>
            <p>${address.firstName} ${ address.lastName}</p>
            <p>${address.address1 || ""} ${address.address2}</p>
            <p>${address.city || ""}, ${address.state || ""} ${address.pincode || ""}</p>
            <p>Phone: ${address.phone || ""}</p>
        `;
    }

    const cartItems = JSON.parse(localStorage.getItem("cart") || "[]");
    const buyNowItem = JSON.parse(localStorage.getItem("buyNowItem") || "null");
    const products = buyNowItem ? [buyNowItem] : cartItems;

    let subtotal = 0;
    let taxTotal = 0;
    let tableData = [];

    tableBody.innerHTML = "";

    products.forEach(item => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 1;
        const taxRate = Number(item.taxrate) || 0;
        const taxAmount = price * qty * (taxRate / 100);
        const total = price * qty + taxAmount;

        subtotal += price * qty;
        taxTotal += taxAmount;

        tableData.push([
            item.title,
            `₹${price.toLocaleString()}`,
            qty,
            `₹${taxAmount.toFixed(0)}`,
            `₹${total.toFixed(0)}`
        ]);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td data-label="Item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${item.image}" class="product-image">
                    <div>
                        <div>${item.title}</div>
                        <div style="color: var(--dark-gray); font-size: 0.9rem;">Brand: ${item.brand || "N/A"}</div>
                    </div>
                </div>
            </td>
            <td data-label="Price">₹${price.toLocaleString()}</td>
            <td data-label="Qty">${qty}</td>
            <td data-label="Tax">₹${taxAmount.toFixed(0)}</td>
            <td data-label="Total">₹${total.toFixed(0)}</td>
        `;
        tableBody.appendChild(tr);
    });

    const grandTotal = subtotal + taxTotal;
    subtotalEl.textContent = `₹${subtotal.toLocaleString()}`;
    taxEl.textContent = `₹${taxTotal.toFixed(0)}`;
    grandTotalEl.textContent = `₹${grandTotal.toLocaleString()}`;

    // Download Invoice PDF
    document.getElementById('downloadInvoiceBtn').addEventListener('click', function () {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('ShopNow', 105, 20, { align: 'center' });
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('INVOICE', 105, 30, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Invoice #: ${invoiceId}`, 15, 40);
        doc.text(`Date: ${invoiceDate}`, 15, 45);

        // Address
        doc.text('Sold By:', 15, 55);
        doc.text('ShopNow E-Commerce', 15, 60);
        doc.text('123 Business Park, Andheri East', 15, 65);
        doc.text('Mumbai, Maharashtra 400069', 15, 70);
        doc.text('GSTIN: 27ABCDE1234F1Z5', 15, 75);

        doc.text('Bill To:', 105, 55);
        doc.text(`${address.name || ""}`, 105, 60);
        doc.text(`${address.street || ""}`, 105, 65);
        doc.text(`${address.city || ""}, ${address.state || ""} ${address.zip || ""}`, 105, 70);
        doc.text(`Phone: ${address.phone || ""}`, 105, 75);

        doc.autoTable({
            startY: 85,
            head: [['Item', 'Price', 'Qty', 'Tax (18%)', 'Total']],
            body: tableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 30 },
                2: { cellWidth: 20 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30 }
            },
            margin: { left: 10, right: 10 }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        const totalsX = 120;

        doc.text('Subtotal:', totalsX, finalY);
        doc.text(`₹${subtotal.toLocaleString()}`, totalsX + 50, finalY);
        doc.text('Tax (18%):', totalsX, finalY + 5);
        doc.text(`₹${taxTotal.toFixed(0)}`, totalsX + 50, finalY + 5);
        doc.line(totalsX, finalY + 10, totalsX + 60, finalY + 10);

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Grand Total:', totalsX, finalY + 20);
        doc.text(`₹${grandTotal.toLocaleString()}`, totalsX + 50, finalY + 20);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text('Thank you for shopping with us. Please visit again!', 105, 280, { align: 'center' });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`ShopNow_Invoice_${dateStr}.pdf`);
    });

    // Make Payment API call
    document.getElementById('makepaymentBtn').addEventListener('click', async function () {
        const payload = {
            invoiceId,
            date: invoiceDate,
            products,
            subtotal,
            tax: taxTotal,
            total: grandTotal,
            address
        };

        try {
            const res = await fetch(`${BASE_URL}/api/v1/user/saveInvoiceOrder`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            localStorage.setItem('invoiceData', JSON.stringify(result.data));
            if (result.success) {
                window.location.href = `${BASE_URL}/subFranchisee.html?page=orderconfirm`;
            } else {
                alert("Payment failed: " + result.message);
            }
        } catch (err) {
            alert("Something went wrong during payment.");
            console.error(err);
        }
    });
})();
