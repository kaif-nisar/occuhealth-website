async function cart() {
    const loader = document.querySelector('.loader');

    loader.style.display = "flex";
    try {
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        const cartContainer = document.getElementById('cartItems');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const subtotalEl = document.getElementById('subtotal');
        const taxEl = document.getElementById('tax');
        const totalEl = document.getElementById('total');

        function renderCart() {
            if (cartItems.length === 0) {
                cartContainer.innerHTML = `
                    <div class="empty-cart">
                        <i class="fas fa-shopping-basket"></i>
                        <h2>Your Cart is Empty</h2>
                        <p>Looks like you haven't added anything to your cart yet</p>
                        <a href="${BASE_URL}/${user.role}.html?page=Allproducts" class="continue-shopping">
                            <i class="fas fa-arrow-left"></i> Continue Shopping
                        </a>
                    </div>
                `;
                subtotalEl.textContent = "₹0.00";
                taxEl.textContent = "₹0.00";
                totalEl.textContent = "₹0.00";
                return;
            }

            let cartHTML = '';
            let subtotal = 0;

            cartItems.forEach(item => {
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;

                cartHTML += `
                    <div class="cart-item" data-id="${item.id}">
                        <div class="cart-item-img">
                            <img src="${item.image}" alt="${item.title}">
                        </div>
                        <div class="cart-item-info">
                            <h4 class="cart-item-title">${item.title}</h4>
                            <p class="cart-item-brand">${item.brand || "Generic"}</p>
                            <p class="cart-item-price">₹${item.price?.toFixed(2)}</p>
                            <p class="cart-item-tax">Tax: ${(item.taxrate)?.toFixed(1)}%</p>
                            <button class="cart-item-remove" data-id="${item.id}">
                                <i class="fas fa-trash-alt"></i> Remove
                            </button>
                        </div>
                        <div class="cart-item-quantity">
                            <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                            <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-id="${item.id}">
                            <button class="quantity-btn increase" data-id="${item.id}">+</button>
                        </div>
                        <div class="cart-item-total">
                            <p class="cart-item-total-price">₹${itemTotal?.toFixed(2)}</p>
                        </div>
                    </div>
                `;
            });

            cartContainer.innerHTML = cartHTML;
            updateSummary(subtotal);

            document.querySelectorAll('.decrease').forEach(btn => btn.addEventListener('click', decreaseQuantity));
            document.querySelectorAll('.increase').forEach(btn => btn.addEventListener('click', increaseQuantity));
            document.querySelectorAll('.quantity-input').forEach(input => input.addEventListener('change', updateQuantity));
            document.querySelectorAll('.cart-item-remove').forEach(btn => btn.addEventListener('click', removeItem));
        }

        function updateSummary(subtotal) {
            let tax = 0;

            cartItems.forEach(item => {
                const rate = Number(item.taxrate) / 100 || 0;
                tax += item.price * item.quantity * rate;
            });

            const total = subtotal + tax;

            subtotalEl.textContent = `₹${subtotal?.toFixed(2)}`;
            taxEl.textContent = `₹${tax?.toFixed(2)}`;
            totalEl.textContent = `₹${total?.toFixed(2)}`;

            const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            document.querySelector('.summary-label').textContent = `Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`;
        }

        function findItem(id) {
            return cartItems.findIndex(item => item.id == id);
        }

        function decreaseQuantity(e) {
            const id = e.target.dataset.id;
            const index = findItem(id);
            if (index !== -1 && cartItems[index].quantity > 1) {
                cartItems[index].quantity--;
                saveCart();
            }
        }

        function increaseQuantity(e) {
            const id = e.target.dataset.id;
            const index = findItem(id);
            if (index !== -1) {
                cartItems[index].quantity++;
                saveCart();
            }
        }

        function updateQuantity(e) {
            const id = e.target.dataset.id;
            const qty = parseInt(e.target.value);
            const index = findItem(id);
            if (index !== -1 && qty >= 1) {
                cartItems[index].quantity = qty;
                saveCart();
            } else {
                e.target.value = cartItems[index].quantity;
            }
        }

        function removeItem(e) {
            const id = e.target.dataset.id;
            const index = findItem(id);
            if (index !== -1) {
                if (confirm("Are you sure you want to remove this item?")) {
                    cartItems.splice(index, 1);
                    saveCart();
                }
            }
        }

        function saveCart() {
            localStorage.setItem("cart", JSON.stringify(cartItems));
            renderCart();
        }

        checkoutBtn.addEventListener('click', () => {
            if (cartItems.length === 0) {
                // Set checkout mode
                return;
            }
            localStorage.setItem("checkoutMode", "cart");
            window.location.href = `${BASE_URL}/subFranchisee.html?page=addresspage`;
        });

        // Initial render
        renderCart();

    } catch (error) {
        console.log(error.message);
    } finally {
        loader.style.display = "none";
    }
}
cart();