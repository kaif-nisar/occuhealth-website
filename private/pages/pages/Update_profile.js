let currentProfileUser = null;

function getAuthToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
        ""
    );
}

function getAuthHeaders(extraHeaders = {}) {
    const token = getAuthToken();
    return token ? { ...extraHeaders, Authorization: `Bearer ${token}` } : extraHeaders;
}

function splitFullName(fullName = "") {
    const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean);
    return {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
    };
}

function getLoader() {
    return document.querySelector(".loader");
}

function setLoading(isLoading) {
    const loader = getLoader();
    if (loader) {
        loader.style.display = isLoading ? "flex" : "none";
    }
}

async function getCurrentUser() {
    const response = await fetch(`${BASE_URL}/api/v1/user/get-current-user`, {
        method: "GET",
        headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (!response.ok || !result?.data?._id) {
        throw new Error(result?.message || "Unable to load current user");
    }

    return result.data;
}

async function getFranchiseeById(profileUserId) {
    const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${encodeURIComponent(profileUserId)}`, {
        method: "GET",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
        }),
    });

    const result = await response.json();

    if (!response.ok || !result?.data) {
        throw new Error(result?.message || "Unable to fetch profile");
    }

    return result.data;
}

function populateForm(franchiseeData) {
    const { firstName, lastName } = splitFullName(franchiseeData.fullName);

    document.getElementById("currentUser").value = `${franchiseeData.fullName || ""} (${franchiseeData.username || ""})`;
    document.getElementById("referralCode").value = franchiseeData.referral?.referralCode || "";
    document.getElementById("clinicName").value = franchiseeData.clinicName || franchiseeData.fullName || "";
    document.getElementById("address").value = franchiseeData.address || "";
    document.getElementById("firstName").value = firstName;
    document.getElementById("lastName").value = lastName;
    document.getElementById("phoneNo").value = franchiseeData.phoneNo || "";
    document.getElementById("email").value = franchiseeData.email || "";
}

async function initializeProfilePage() {
    setLoading(true);

    try {
        const sessionUser = await getCurrentUser();
        const profileUserId = sessionUser?._id || window.userId;

        if (!profileUserId) {
            throw new Error("Current user id not found");
        }

        currentProfileUser = await getFranchiseeById(profileUserId);
        populateForm(currentProfileUser);
    } catch (error) {
        console.error("Error loading profile:", error);
        alert(error.message || "Profile load karne mein error aaya.");
    } finally {
        setLoading(false);
    }
}

async function updateFranchiseeData() {
    if (!currentProfileUser?._id) {
        alert("Profile data abhi load nahi hui. Please page refresh karke dobara try karein.");
        return;
    }

    setLoading(true);

    try {
        const logoInput = document.getElementById("weblogo");
        const profileImageInput = document.getElementById("profileImage");
        const nablLogoInput = document.getElementById("nablLogo");
        const formData = new FormData();
        const fullName = `${document.getElementById("firstName").value} ${document.getElementById("lastName").value}`.trim();

        formData.append("fullName", fullName);
        formData.append("address", document.getElementById("address").value.trim());
        formData.append("phoneNo", document.getElementById("phoneNo").value.trim());
        formData.append("email", document.getElementById("email").value.trim());
        formData.append("clinicName", document.getElementById("clinicName").value.trim());

        // Backend currently validates these required fields as well.
        formData.append("username", currentProfileUser.username || "");
        formData.append("password", currentProfileUser.password || "");
        formData.append("isActive", String(Boolean(currentProfileUser.isActive)));

        if (logoInput?.files?.[0]) {
            formData.append("logo", logoInput.files[0]);
        }
        if (profileImageInput?.files?.[0]) {
            formData.append("profileImage", profileImageInput.files[0]);
        }
        if (nablLogoInput?.files?.[0]) {
            formData.append("nablLogo", nablLogoInput.files[0]);
        }

        const response = await fetch(`${BASE_URL}/api/v1/user/superFranchisee-update?_id=${encodeURIComponent(currentProfileUser._id)}`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result?.message || "Failed to update profile");
        }

        currentProfileUser = {
            ...currentProfileUser,
            ...result?.data,
        };

        populateForm(currentProfileUser);
        alert(result?.message || "Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        alert(error.message || "Profile update karte waqt error aaya.");
    } finally {
        setLoading(false);
    }
}

document.getElementById("updateButton")?.addEventListener("click", updateFranchiseeData);

initializeProfilePage();
