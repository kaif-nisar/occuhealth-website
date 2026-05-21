async function fetchLabs() {
    const tableBody = document.querySelector("table #tbody");

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-Lab?userId=${userId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem('token')}` // Include JWT if required
            }
        });

        const data = await response.json();
        console.log(data);

        if (response.ok) {
            // Directly iterate over the data array
            if (data.length > 0) {
                tableBody.innerHTML = ""; // Clear existing table rows

                data.forEach((lab, index) => {
                    const dateAdded = new Date(lab.createdAt).toLocaleString();

                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${lab.LabName}</td>
                            <td>${lab.LabAddress}</td>
                            <td>${dateAdded}</td>
                            <td class="table-actions">
                                <button class="btn btn-edit" onclick="loadPage('editLab', '${lab._id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-delete" onclick="deleteLab('${lab._id}')"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;

                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5">No labs found</td></tr>`;
            }
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error fetching labs:", error);
        alert("Failed to fetch labs. Please try again.");
    }
}

// Fetch and display labs on page load
fetchLabs();
async function deleteLab(labId) {
    if (!labId) return;
    const confirmed = confirm("Are you sure you want to delete this lab?");
    if (!confirmed) return;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/delete-lab`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ labId })
        });

        const result = await response.json();
        if (response.ok) {
            alert("Lab deleted successfully!");
            fetchLabs(); // Refresh the list
        } else {
            alert(result.message || "Failed to delete lab.");
        }
    } catch (error) {
        alert("Error deleting lab: " + error.message);
    }
}