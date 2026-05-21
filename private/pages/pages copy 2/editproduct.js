        // Sample: Fetch and prefill existing product data (replace with actual API)
        const sampleProduct = {
            id: "12345",
            name: "Wireless Headphones",
            sku: "WH-2023",
            category: "electronics",
            price: 1499.99,
            discountPrice: 1299.99,
            stock: 50,
            description: "High-quality wireless headphones with noise cancellation.",
            status: "active",
            dimensions: { length: 10, width: 5, height: 3 },
            weight: 0.5
        };

        window.onload = () => {
            // Prefill form
            document.getElementById('name').value = sampleProduct.name;
            document.getElementById('sku').value = sampleProduct.sku;
            document.getElementById('category').value = sampleProduct.category;
            document.getElementById('price').value = sampleProduct.price;
            document.getElementById('discountPrice').value = sampleProduct.discountPrice || '';
            document.getElementById('stock').value = sampleProduct.stock;
            document.getElementById('description').value = sampleProduct.description;
            document.getElementById('status').value = sampleProduct.status;
            document.getElementById('length').value = sampleProduct.dimensions.length || '';
            document.getElementById('width').value = sampleProduct.dimensions.width || '';
            document.getElementById('height').value = sampleProduct.dimensions.height || '';
            document.getElementById('weight').value = sampleProduct.weight || '';
        };

        // Handle form submission
        document.getElementById('editProductForm').addEventListener('submit', async function (e) {
            e.preventDefault();

            const productData = {
                id: document.getElementById('productId').value,
                name: document.getElementById('name').value,
                sku: document.getElementById('sku').value,
                category: document.getElementById('category').value,
                price: parseFloat(document.getElementById('price').value),
                discountPrice: parseFloat(document.getElementById('discountPrice').value) || null,
                stock: parseInt(document.getElementById('stock').value),
                description: document.getElementById('description').value,
                status: document.getElementById('status').value,
                weight: parseFloat(document.getElementById('weight').value) || null,
                dimensions: {
                    length: parseFloat(document.getElementById('length').value) || null,
                    width: parseFloat(document.getElementById('width').value) || null,
                    height: parseFloat(document.getElementById('height').value) || null
                }
            };

            try {
                const response = await fetch('https://your-api.com/products/' + productData.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData)
                });

                if (!response.ok) throw new Error("Failed to save product");

                alert("Product updated successfully!");
                window.location.href = "/inventory.html"; // redirect if needed

            } catch (err) {
                console.error(err);
                alert("Error: " + err.message);
            }
        });
