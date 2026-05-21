function allproducts() {
    const productsGrid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const loader = document.querySelector('.loader');

    let allProducts = [];

    // Fetch data from API
    async function fetchProducts() {
        loader.style.display = 'flex';
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/getAllProducts`);
            const data = await response.json();

            if (Array.isArray(data.data)) {
                allProducts = data.data.map((p, index) => ({
                    id: p._id,
                    title: p.name,
                    brand: 'Generic',
                    price: p.price - p.discountPrice,
                    image: p.mainImage.url,
                    originalPrice: p.price,
                    badge: index === 0 ? "New" : "",
                    taxrate: p.taxrate || 0.12,
                    stock: p.stock || 0 // ✅ include stock
                }));
                renderProducts(allProducts);
            } else {
                productsGrid.innerHTML = `<p>Error loading products.</p>`;
            }
        } catch (err) {
            console.error("Failed to fetch products", err);
            productsGrid.innerHTML = `<p>Failed to load products. Please try again later.</p>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    // Render products
    function renderProducts(productsToRender = allProducts) {
        if (productsToRender.length === 0) {
            productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <h2>No products found</h2>
                <p>Try different search terms</p>
            </div>
        `;
            return;
        }

        productsGrid.innerHTML = productsToRender.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image">
                <img src="${product.image}" alt="${product.title}">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                ${product.stock === 0 ? `<span class="product-badge out-of-stock">Out of Stock</span>` : ''}
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-brand">${product.brand}</p>
                <div class="product-price">
                    <span class="current-price">₹${product.price.toLocaleString('en-IN')}</span>
                    <span class="original-price">₹${product.originalPrice.toLocaleString('en-IN')}</span>
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary add-to-cart" data-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    <button class="btn btn-icon quick-view" data-id="${product.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

        addProductEventListeners();
    }

    // Add event listeners
    function addProductEventListeners() {
        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const productId = this.dataset.id;
                const product = allProducts.find(p => p.id === productId);
                if (product && product.stock > 0) {
                    addToCart(product);
                    alert(`${product.title} added to cart!`);
                }
            });
        });

        document.querySelectorAll('.quick-view').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const productId = this.dataset.id;
                window.location.href = `${BASE_URL}/${user.role}.html?page=Productview&id=${productId}`;
            });
        });

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function (e) {
                if (!e.target.closest('.btn')) {
                    const productId = this.dataset.id;
                    window.location.href = `${BASE_URL}/${user.role}/${user.role}.html?page=Productview&id=${productId}`;
                }
            });
        });
    }

    // Add to cart
    function addToCart(product) {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const index = cart.findIndex(item => item.id === product.id);
        if (index > -1) {
            cart[index].quantity += 1;
        } else {
            cart.push({
                id: product.id,
                image: product.image,
                title: product.title,
                brand: product.brand,
                price: product.price,
                taxrate: product.taxrate,
                quantity: 1
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    // Search functionality
    function searchProducts(searchTerm) {
        searchTerm = searchTerm.toLowerCase().trim();
        const filteredProducts = allProducts.filter(product =>
            product.title.toLowerCase().includes(searchTerm) ||
            product.brand.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    }

    // Event listeners
    searchInput.addEventListener('input', () => searchProducts(searchInput.value));
    searchBtn.addEventListener('click', () => searchProducts(searchInput.value));
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            searchProducts(searchInput.value);
        }
    });

    // Initial fetch
    fetchProducts();

}
allproducts();