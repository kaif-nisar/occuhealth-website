async function fetchDoctors() {
    try {
        // Fetch data from the API
        const response = await fetch(`${BASE_URL}/api/v1/user/all-doctor?userId=${userId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem('token')}` // Include JWT if required
            }
        });

        // Parse the response JSON
        const doctors = await response.json(); // Directly access the array

        console.log(doctors); // Debugging: log the response to confirm structure

        if (response.ok) {
            // Clear the table body
            const tbody = document.querySelector("#tbody");
            tbody.innerHTML = "";

            // Populate the table with fetched data
            doctors.forEach((doctor, index) => {
                const dobFormatted = doctor.DOB
                    ? new Date(doctor.DOB).toLocaleDateString()
                    : "N/A";
                const dateAddedFormatted = doctor.createdAt
                    ? new Date(doctor.createdAt).toLocaleString()
                    : "N/A";

                const row = `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${doctor.firstName} ${doctor.lastName}</td>
                        <td>${doctor.gender}<br>${dobFormatted}</td>
                        <td>${doctor.specialization}</td>
                        <td>${doctor.address || "N/A"}</td>
                        <td>${doctor.remarks || "N/A"}</td>
                        <td>${dateAddedFormatted}</td>
                        <td class="table-actions">
                            <button class="btn btn-edit" onclick="editDoctor('${doctor._id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-delete" onclick="deleteDoctor('${doctor._id}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            console.error(`Error: ${response.status} - ${response.statusText}`);
            alert("Failed to fetch doctor data. Please check your API.");
        }
    } catch (error) {
        console.error("Error fetching doctors:", error);
        alert("An error occurred while fetching the data.");
    }
}
fetchDoctors();
