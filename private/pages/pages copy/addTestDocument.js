(async function fetchAndPopulateCategories() {
    let categoryArray = [];

    // Function to initialize TinyMCE
    async function tinymcefunction() {
        return tinymce.init({
            selector: '#editorContent', // Your contenteditable div's ID
            height: 300,
            menubar: false,
            plugins: 'table lists link', // No need for fontsize plugin; fontsizeselect is built-in
            toolbar: 'undo redo | formatselect | fontsizeselect | bold italic backcolor | table | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | link',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt', // Customize font sizes
        });
    }

    tinymcefunction();

    async function del() {
        // Remove the old TinyMCE instance first
        tinymce.remove('#editorContent');

        // Now initialize the editor again
        await tinymcefunction();
    }
    del();
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/fetchCategories`, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Failed to fetch categories");
        }

        const data = await response.json();

        if (data.categories) {
            categoryArray.push(...(data.categories));

            populateCategories(data.categories);
        } else {
            console.error("No categories found");
        }
    } catch (error) {
        console.error("Error fetching categories:", error);
        alert("Error fetching categories. Please try again.");
    }

        async function fetchandpopulatesamples() {
        const selecttag = document.getElementById("sampleType");
        selecttag.innerHTML = "";

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/fetchsample`);
            const data = await response.json();

            if (!response.ok) {
                return console.log(data.message);
            }

            data.data.forEach(obj => {
                selecttag.innerHTML += `<option value="${obj.Name}">${obj.Name}</option>`;
            });

        } catch (error) {
            alert(error)
        }
    }

    fetchandpopulatesamples();

    function populateCategories(categories) {
        const selectElement = document.getElementById("category"); // Target the <select> element
        selectElement.innerHTML = ""; // Clear existing options

        // Populate categories as options
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.textContent = category.category; // Use category name from the fetched data
            option.value = category.category; // Set value (use id if available, otherwise name)
            selectElement.appendChild(option);
        });
    }

    document.getElementById('submitbBtn').addEventListener('click', function () {

        const alert = document.querySelector(".alert");
        const formData = {
            Name: document.getElementById('name').value,
            Short_name: document.getElementById('short-name').value,
            final_price: document.getElementById('final_price').value,
            category: categoryArray.find(doc => doc.category === document.getElementById('category').value),
            Price: document.getElementById('price').value,
            sampleType: document.getElementById('sampleType').value,
            isDocumentedTest: true,
            interpretation: tinymce.get('editorContent').getContent(),
        }

        console.log(formData);
        
        // Use the previously declared cookies variable
        fetch(`${BASE_URL}/api/v1/user/make-test-tenant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // body: JSON.stringify({ ...formData, cookies }), // Use cookies variable here
            body: JSON.stringify({ ...formData })
        })
            .then(async response => {
                const data = await response.json();
                if (response.ok) {

                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-danger");
                    alert.classList.add("alert-success");
                    alert.classList.add("show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                    setTimeout(() => {
                        location.reload();
                    }, 3500);
                } else {

                    alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                    alert.classList.remove("alert-success");
                    alert.classList.add("alert-danger");
                    alert.classList.add("show");
                    setTimeout(() => {
                        alert.classList.remove("show");
                        alert.classList.add("fade");
                    }, 3000);
                }
            })
            .catch((error) => {
                alert.innerHTML = `${error.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                alert.classList.remove("alert-success");
                alert.classList.add("alert-danger");
                alert.classList.add("show");
                setTimeout(() => {
                    alert.classList.remove("show");
                    alert.classList.add("fade");
                }, 3000);
            });
    });

})();