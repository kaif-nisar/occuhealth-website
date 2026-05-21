async function productview() {
    const productImages = [];

    const slider = document.getElementById('slider');
    const thumbnails = document.getElementById('thumbnails');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const buyNowBtn = document.getElementById('buyNowBtn');
    const quantityInput = document.getElementById('quantity');
    const decreaseQty = document.getElementById('decreaseQty');
    const increaseQty = document.getElementById('increaseQty');

    let currentSlide = 0;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        alert("Product ID is missing in URL.");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getProductById/${productId}`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Failed to fetch product");
            return;
        }

        const product = result.data;

        productImages.length = 0;

        if (product.mainImage && product.mainImage.url) {
            productImages.push({
                main: product.mainImage.url,
                thumb: product.mainImage.url
            });
        }

        if (Array.isArray(product.additionalImages)) {
            product.additionalImages.forEach(img => {
                if (img.url) {
                    productImages.push({
                        main: img.url,
                        thumb: img.url
                    });
                }
            });
        }

        const discount = (((product.discountPrice) / product.price) * 100).toFixed(2);

        document.querySelector('.product-title').innerText = product.name || 'No Title';
        document.querySelector('.product-brand').innerText = product.brand || 'Generic';
        document.querySelector('.current-price').innerText = `₹${(product.price - product.discountPrice).toFixed(2)}`;
        document.querySelector('.original-price').innerText = `₹${product.price}`;
        document.querySelector('.discount-badge').innerText = `${discount}% OFF`;
        document.querySelector('.product-description').innerText = product.description || 'No description available.';

        const metaValues = document.querySelectorAll('.product-meta .meta-value');
        metaValues[0].innerText = product.brand || '-';
        metaValues[1].innerText = product.model || '-';
        metaValues[2].innerText = product.connectivity || '-';
        metaValues[3].innerText = product.batteryLife || '-';
        metaValues[4].innerText = product.weight || '-';
        metaValues[5].innerText = product.warranty || '-';

        // === Handle stock status ===
        const availabilityEl = document.querySelector('.availability');
        const inStock = product.stock > 0;

        availabilityEl.innerText = inStock ? `In Stock (${product.stock} available)` : 'Out of Stock';
        availabilityEl.style.backgroundColor = inStock ? '#DCFCE7' : '#FEE2E2'; // green or red bg
        availabilityEl.style.color = inStock ? '#065F46' : '#991B1B'; // green or red text
        availabilityEl.style.padding = '6px 10px';
        availabilityEl.style.borderRadius = '6px';
        availabilityEl.style.fontWeight = '600';
        availabilityEl.style.display = 'inline-block';

        addToCartBtn.disabled = !inStock;
        buyNowBtn.disabled = !inStock;
        addToCartBtn.classList.toggle('disabled', !inStock);
        buyNowBtn.classList.toggle('disabled', !inStock);

        // === Setup image gallery ===
        initGallery();
        goToSlide(0);

        // === Quantity controls ===
        increaseQty.addEventListener('click', () => {
            let qty = parseInt(quantityInput.value);
            if (qty < parseInt(quantityInput.max)) {
                quantityInput.value = qty + 1;
            }
        });

        decreaseQty.addEventListener('click', () => {
            let qty = parseInt(quantityInput.value);
            if (qty > parseInt(quantityInput.min)) {
                quantityInput.value = qty - 1;
            }
        });

        // === Button events ===
        nextBtn.addEventListener('click', nextSlide);
        prevBtn.addEventListener('click', prevSlide);

        buyNowBtn.addEventListener('click', () => {
            const quantity = parseInt(quantityInput.value);

            const buyNowItem = {
                id: product._id,
                title: product.name,
                brand: product.brand,
                image: product.mainImage?.url,
                price: product.price - product.discountPrice,
                taxrate: product.taxrate,
                quantity: quantity
            };
            
            // Save in localStorage
            localStorage.setItem("buyNowItem", JSON.stringify(buyNowItem));
            localStorage.setItem("checkoutMode", "buyNow");
            
            // Redirect to address page
            window.location.href = `${BASE_URL}/${user.role}/${user.role}.html?page=addresspage`;
        });


        addToCartBtn.addEventListener('click', () => {
            const cart = JSON.parse(localStorage.getItem("cart")) || [];

            const existingItemIndex = cart.findIndex(item => item.id === product._id);
            const quantity = parseInt(quantityInput.value);

            if (existingItemIndex !== -1) {
                // If item already exists, just update quantity
                cart[existingItemIndex].quantity += quantity;
            } else {
                // Add new item
                cart.push({
                    id: product._id,
                    title: product.name,
                    brand: product.brand,
                    image: product.mainImage?.url,
                    price: product.price - product.discountPrice,
                    taxrate: product.taxrate,
                    quantity: quantity
                });
            }

            localStorage.setItem("cart", JSON.stringify(cart));
            alert(`${quantity} item(s) added to cart.`);
        });


    } catch (error) {
        console.error("Error fetching product:", error);
        alert("Something went wrong while loading the product.");
    }

    // === Image gallery functions ===
    function initGallery() {
        slider.innerHTML = '';
        thumbnails.innerHTML = '';

        productImages.forEach((image, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.innerHTML = `<img src="${image.main}" alt="Product Image ${index + 1}">`;
            slider.appendChild(slide);

            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.dataset.index = index;
            thumbnail.innerHTML = `<img src="${image.thumb}" alt="Thumbnail ${index + 1}">`;
            thumbnails.appendChild(thumbnail);

            thumbnail.addEventListener('click', () => {
                goToSlide(index);
            });
        });

        updateThumbnails();
    }

    function updateThumbnails() {
        const thumbs = document.querySelectorAll('.thumbnail');
        thumbs.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === currentSlide);
        });
    }

    function goToSlide(index) {
        currentSlide = index;
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        updateThumbnails();
    }

    function nextSlide() {
        if (currentSlide < productImages.length - 1) {
            goToSlide(currentSlide + 1);
        }
    }

    function prevSlide() {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    }
}

productview();
