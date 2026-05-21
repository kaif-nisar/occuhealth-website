function lik (){
    const submitButton = document.querySelector(".submit-btn");

    submitButton.addEventListener("click", async (e) => {
        e.preventDefault(); // Prevent default form submission behavior

        // Get form input values
        const LabName = document.getElementById("lab-name").value.trim();
        const  LabAddress = document.getElementById("address").value.trim();

        // Validate input
        if (!LabName|| !LabAddress) {
            alert("Please fill out all fields.");
            return;
        }

        // Prepare the payload
        const payload = {
           LabName,
           LabAddress,
           userId
        };

        try {
            // Send the POST request to add the lab
            const response = await fetch(`${BASE_URL}/api/v1/user/add-Lab`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem('token')}` // Include JWT if required
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                alert("Lab added successfully!");
                // Optionally clear the form
                document.getElementById("lab-name").value = "";
                document.getElementById("address").value = "";
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error("Error adding lab:", error);
            alert("Failed to add the lab. Please try again.");
        }
    });
};
lik();
