let additionalImages = [];

const mainImageInput = document.getElementById('mainImage');
const mainImageDropzone = document.getElementById('mainImageDropzone');
const mainImagePreview = document.getElementById('mainImagePreview');
const mainImageContent = document.getElementById('mainImageContent');

const additionalImagesInput = document.getElementById('additionalImages');
const additionalImagesDropzone = document.getElementById('additionalImagesDropzone');
const additionalImagesPreview = document.getElementById('additionalImagesPreview');

// Drag-drop utility
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    [mainImageDropzone, additionalImagesDropzone].forEach(dropzone => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
});

['dragenter', 'dragover'].forEach(eventName => {
    mainImageDropzone.addEventListener(eventName, () => mainImageDropzone.classList.add('drag-active'));
    additionalImagesDropzone.addEventListener(eventName, () => additionalImagesDropzone.classList.add('drag-active'));
});

['dragleave', 'drop'].forEach(eventName => {
    mainImageDropzone.addEventListener(eventName, () => mainImageDropzone.classList.remove('drag-active'));
    additionalImagesDropzone.addEventListener(eventName, () => additionalImagesDropzone.classList.remove('drag-active'));
});

// File input triggers
mainImageDropzone.addEventListener('click', () => mainImageInput.click());
mainImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleMainImage(file);
});

mainImageDropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleMainImage(file);
});

function handleMainImage(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        mainImagePreview.src = e.target.result;
        mainImagePreview.classList.remove('hidden');
        mainImageContent.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

// Additional Images
additionalImagesDropzone.addEventListener('click', () => additionalImagesInput.click());
additionalImagesInput.addEventListener('change', (e) => {
    handleAdditionalImages(Array.from(e.target.files));
});

additionalImagesDropzone.addEventListener('drop', (e) => {
    e.preventDefault(); // ← ye ensure karo
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (files && files.length) {
        handleAdditionalImages(Array.from(files));
    }
});


function handleAdditionalImages(files) {
    const remaining = 5 - additionalImages.length;
    const validFiles = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);

    validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            additionalImages.push({ file, url: e.target.result });
            renderAdditionalImages();
        };
        reader.readAsDataURL(file);
    });
}

function renderAdditionalImages() {
    additionalImagesPreview.innerHTML = '';
    additionalImages.forEach((image, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-preview-item';

        const img = document.createElement('img');
        img.src = image.url;

        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => {
            additionalImages.splice(index, 1);
            renderAdditionalImages();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        additionalImagesPreview.appendChild(wrapper);
    });
}


document.getElementById('productForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const loader = document.querySelector('.loader');
    loader.style.display = 'flex';
    // Collect all input value
    const productData = {
        name: document.getElementById('productName').value.trim(),
        skuId: document.getElementById('productSKU').value.trim(),
        category: document.getElementById('productCategory').value,
        status: document.getElementById('productstatus').value,
        price: parseFloat(document.getElementById('productPrice').value),
        discountPrice: parseFloat(document.getElementById('productDiscountPrice').value || 0),
        taxrate: parseFloat(document.getElementById('taxrate').value || 0),
        stock: parseInt(document.getElementById('productStock').value),
        description: document.getElementById('productDescription').value.trim(),
        weight: parseFloat(document.getElementById('productWeight').value || 0),
        dimensionLength: parseFloat(document.getElementById('productLength').value || 0),
        dimensionWidth: parseFloat(document.getElementById('productWidth').value || 0),
        dimensionHeight: parseFloat(document.getElementById('productHeight').value || 0),
        dimensionUnit: 'cm', // Optional: or bind this to a select dropdown
        tags: document.getElementById('productTags')?.value || '' // Optional field (comma-separated string)
    };

    // Prepare images
    const mainImageFile = document.getElementById('mainImage').files[0];

    // Use FormData if you're uploading binary files
    const formData = new FormData();

    // Append basic fields
    Object.keys(productData).forEach(key => {
        formData.append(key, productData[key]);
    });

    // Append images
    if (mainImageFile) {
        formData.append('mainImage', mainImageFile);
    }

    additionalImages.forEach((imgObj, index) => {
        formData.append('additionalImages', imgObj.file); // append same key for multiple files
    });

    // Call your API (adjust URL and method as needed)
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/createProduct`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            alert('Product successfully added!');
            console.log(result); // or redirect
            location.reload();
        } else {
            alert(result.message);
            console.error(result);
        }
    } catch (err) {
        console.error('API Error:', err);
        alert('An error occurred while saving the product.');
    }finally {
            loader.style.display = 'none';
    }
});


