function hg() {
        const submitButton = document.getElementById('submitBtn');
    
        submitButton.addEventListener('click', function(event) {
            event.preventDefault();
            const categoryNameInput = document.getElementById('name');
            const alert = document.querySelector('.alert');
            alert.innerHTML = "";

            const categoryName = categoryNameInput.value.trim();
        
            if (categoryName) {
                fetch(`${BASE_URL}/api/v1/user/category-add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        catName: categoryName
                    })
                })
                .then(response => response.json())  // Parse the response as JSON
                .then(data => {
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
                    } else if(data.type === "success") {
                        // Handle failure (e.g., show an error message)
                        alert.innerHTML = `${data.message}<button data-dismiss="alert" class="alert-dismissible close">✖</button>`;
                        alert.classList.remove("alert-danger")
                        alert.classList.add("alert-success");
                        alert.style.display = "block";
                        categoryNameInput.value = ''; 
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
                // Handle empty input
                alert('Please enter a category name');
            }
        });
}
hg();