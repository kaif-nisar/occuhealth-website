async function roll() {
    const params = new URLSearchParams(window.location.search)
    const Name = params.get('Name')
    let _id = Name;
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    const response = await fetch(`${BASE_URL}/api/v1/user/category-found?_id=${encodeURIComponent(_id)}`)
    if (!response.ok) {
        throw new Error('Failed to fetch data from API');
    }

    let data = await response.json()
    data = data.data
    console.log(data)
    // Populate the fields
    populateForm(data)
    function populateForm(data) {
        document.getElementById("name").value = data.category
    }

    // Get the form and button elements
    const categoryNameInput = document.getElementById('name');
    const submitButton = document.getElementById('submitBtn');

    submitButton.addEventListener('click', async function (event) {
        // Prevent the default button behavior (since it's outside the form, it won't submit by default)
        event.preventDefault();

        // Get the value of the input field
        const categoryName = categoryNameInput.value.trim();
        const alert = document.querySelector('.alert');

        if (categoryName) {
            // Send data to the backend using fetch (AJAX)
            await fetch(`${BASE_URL}/api/v1/user/category-edit-tenant?_id=${encodeURIComponent(_id)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    catName: categoryName,  // Send the category name in the request body
                })
            })
                .then(response => response.json())  // Parse the response as JSON
                .then(data => {
                    console.log(data);
                    if (data.type === "auth" || data.type === "error") {
                        // Handle success (e.g., show a success message or redirect)
                        alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                        alert.classList.remove("alert-success")
                        alert.classList.add("alert-danger");
                        alert.style.display = "block";
                        setTimeout(() => {
                            alert.classList.remove("alert-success", "alert-danger");
                            alert.style.display = "none";
                        }, 3000)
                    } else if (data.type === "success") {
                        // Handle failure (e.g., show an error message)
                        alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                        alert.classList.remove("alert-danger")
                        alert.classList.add("alert-success");
                        alert.style.display = "block";
                        setTimeout(() => {
                            alert.classList.remove("alert-success", "alert-danger");
                            alert.style.display = "none";
                        }, 3000)
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred while saving the category.');
                });
        } else {
            // Handle success (e.g., show a success message or redirect)
            alert.innerHTML = `!Please Enter Category Name<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
            alert.classList.remove("alert-success")
            alert.classList.add("alert-danger");
            alert.style.display = "block";
            setTimeout(() => {
                alert.classList.remove("alert-success", "alert-danger");
                alert.style.display = "none";
            }, 3000)
        }
    });
    loader.style.display = "none";
}
roll();