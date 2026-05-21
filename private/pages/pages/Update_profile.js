// // Fetch the data from your API
// console.log('can you see me')
// async function getFranchiseeById(userId) {
//     const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${userId}`);
//     const data = await response.json();
//     const franchiseeData = data.data;
//     const referalCode = franchiseeData.referral?.referralCode;
//     console.log(referalCode)

//     console.log("hallo how are you")
//     // Populate the form with the fetched data
//     document.getElementById("currentUser").value = `${franchiseeData.fullName || ""} (${franchiseeData.username || ""})`;
//     document.getElementById("referralCode").value = franchiseeData.referral.referralCode || "";
//     document.getElementById("clinicName").value = franchiseeData.fullName || "";  // Assuming the lab name is same as full name
//     document.getElementById("address").value = franchiseeData.email || "";
//     document.getElementById("firstName").value = (franchiseeData.fullName || "").split(' ')[0] || "";  // First name from fullName
//     document.getElementById("lastName").value = (franchiseeData.fullName || "").split(' ')[1] || "";  // Last name from fullName
//     document.getElementById("phoneNo").value = franchiseeData.phoneNo || "";
//     document.getElementById("email").value = franchiseeData.email || "";
// }

// // Function to update the data after form submission
// async function updateFranchiseeData() {
//     const loader = document.querySelector('.loader');
//     loader.style.display = "flex";
//     // Wait for all elements to exist
//     const logoInput = document.getElementById("weblogo");
//     const profileImageInput = document.getElementById("profileImage");
//     const nablLogoInput = document.getElementById("nablLogo");

//     console.log("logoinput:", logoInput?.files);
//     console.log("profileImageInput:", profileImageInput?.files);
    
//     // Safely check each file input
//     const logoFile = logoInput?.files?.length > 0 ? logoInput.files[0] : null;
//     const profileImageFile = profileImageInput?.files?.length > 0 ? profileImageInput.files[0] : null;
//     const nablLogoFile = nablLogoInput?.files?.length > 0 ? nablLogoInput.files[0] : null;

//     const formData = new FormData();

//     formData.append("_id", userId); // userId must be in scope globally
//     formData.append("fullName", document.getElementById("firstName").value + " " + document.getElementById("lastName").value);
//     formData.append("address", document.getElementById("address").value);
//     formData.append("phoneNo", document.getElementById("phoneNo").value);
//     formData.append("email", document.getElementById("email").value);
//     formData.append("clinicName", document.getElementById("clinicName").value);

//     // Append files only if they exist
//     if (logoFile) {
//         formData.append("logo", logoFile);
//     }
//     if (profileImageFile) {
//         formData.append("profileImage", profileImageFile);
//     }
//     if (nablLogoFile) {
//         formData.append("nablLogo", nablLogoFile);
//     }

//     try {
//         const response = await fetch(`${BASE_URL}/api/v1/user/superfranchisee-update?_id=${userId}`, {
//             method: 'POST',
//             body: formData
//         });

//         const result = await response.json();

//         if (result.success) {
//             alert("Profile updated successfully!");
//             location.reload();
//         } else {
//             console.error(result);
//             alert("Failed to update profile.");
//         }
//     } catch (error) {
//         console.error("Error updating profile:", error);
//         alert("An error occurred while updating the profile.");
//     } finally {
//             loader.style.display = "none";
//     }
// }

// // Event listener for the Update button
// document.getElementById("updateButton").addEventListener("click", updateFranchiseeData);

// // Call getFranchiseeById with a sample user ID (replace with actual userId)
// getFranchiseeById(userId);
