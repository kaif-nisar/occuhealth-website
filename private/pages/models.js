(async function () {
  const API_URL = "/api/v1/user/models"; // change this to your actual endpoint

  const modelContainer = document.getElementById("modelContainer");
  const modalOverlay = document.getElementById("modelModal");
  const modelForm = document.getElementById("modelForm");

  const addModelBtn = document.getElementById("addModelButton");
  const closeModalBtn = document.querySelector(".close-modal");
  const cancelBtn = document.querySelector(".btn-cancel");

  const modelNameInput = document.getElementById("modelName");
  const modelLayerInput = document.getElementById("modelLayer");
  const modelPriceInput = document.getElementById("modelPrice");
  const modelDurationInput = document.getElementById("modelDuration");
  const modelStatusInput = document.getElementById("modelStatus");

  let editingModelId = null;

  function openModal(edit = false, model = null) {
    if (edit && model) {
      editingModelId = model._id;
      modelNameInput.value = model.name || "";
      // Map modelType to layer dropdown
      if (model.modelType && model.modelType.match(/\d/)) {
        modelLayerInput.value = model.modelType.match(/\d/)[0];
      } else {
        modelLayerInput.value = "1";
      }
      modelPriceInput.value = model.price || "";
      // Duration from subscriptionPlan if available
      if (model.subscriptionPlan && model.subscriptionPlan.planType) {
        modelDurationInput.value = model.subscriptionPlan.planType;
      } else {
        modelDurationInput.value = "month";
      }
      modelStatusInput.value = model.status || "available";
    } else {
      editingModelId = null;
      modelForm.reset();
    }
    modalOverlay.classList.add("active");
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
  }

  addModelBtn.addEventListener("click", () => openModal());
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  // Create a model card
  function createModelCard(model) {
    return `
            <div class="model-card" data-id="${model._id}">
                <div class="model-header">
                    <div class="model-name">${model.name}</div>
                    <div class="model-layer">${model.modelType || "N/A"}</div>
                </div>
                <div class="model-card" data-id="${
                  model._id
                }" onclick="viewModelDetails('${model._id}')">
                <div class="model-content">
                    <div class="model-detail"><div class="detail-label">Price:</div><div class="detail-value">₹${
                      model.subscriptionPlan?.price || 0
                    }/month</div></div>
                    <div class="model-detail"><div class="detail-label">Duration:</div><div class="detail-value">${
                      model.subscriptionPlan?.planType || "N/A"
                    }</div></div>
                    <div class="model-detail"><div class="detail-label">Availability:</div><div class="detail-value">${
                      model.status || "N/A"
                    }</div></div>
                    <div class="model-detail"><div class="detail-label">Active Users:</div><div class="detail-value">${
                      model.analytics?.totalUsers || 0
                    }</div></div>
                </div>
                </div>
                <div class="model-actions">
                    <button class="model-btn btn-edit">Edit Model</button>
                    <button class="model-btn btn-delete">Delete</button>
                </div>
            </div>
        `;
  }

  // Load models from API
  async function loadModels() {
    modelContainer.innerHTML = "";
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      // console.log(data.data);
      // data.data is array of models
      if (Array.isArray(data.data)) {
        modelContainer.innerHTML = data.data.map(createModelCard).join("");
        // Add event listeners after rendering

        document.querySelectorAll(".btn-edit").forEach((btn) => {
          btn.addEventListener("click", function (e) {
            e.stopPropagation(); // Prevent card click event
            const card = btn.closest(".model-card");
            const id = card.getAttribute("data-id");
            // Find model object
            const model = data.data.find((m) => m._id === id);
            // Get adminId from model.adminDetails.userId (adjust if needed)
            const adminId =
              model.adminDetails?.userId || model.adminDetails?._id || "";
            // Redirect to editModel.html with modelId and adminId
            window.location.href = `superAdmin.html?page=editModel&modelId=${id}`;
          });
        });
        document.querySelectorAll(".btn-delete").forEach((btn) => {
          btn.addEventListener("click", function () {
            const card = btn.closest(".model-card");
            const id = card.getAttribute("data-id");
            deleteModel(id);
          });
        });
      }
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  }

  // Save model (add or update)
  modelForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const newModel = {
      name: modelNameInput.value,
      modelType: modelLayerInput.value + "layer",
      price: modelPriceInput.value,
      // Save duration as planType inside subscriptionPlan
      subscriptionPlan: { planType: modelDurationInput.value },
      status: modelStatusInput.value,
    };

    try {
      let res;
      if (editingModelId) {
        res = await fetch(`${API_URL}/${editingModelId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newModel),
        });
      } else {
        res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newModel),
        });
      }

      const result = await res.json();
      if (res.ok) {
        alert("Model saved!");
        closeModal();
        loadModels();
      } else {
        alert(result.message || "Error saving model");
      }
    } catch (err) {
      console.error("Error saving model:", err);
    }
  });

  // Delete model
  async function deleteModel(id) {
    if (!confirm("Are you sure you want to delete this model?")) return;
    try {
      const res = await fetch(`${API_URL}/delete/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (res.ok) {
        alert("Model deleted!");
        loadModels();
      } else {
        alert(result.message || "Error deleting model");
      }
    } catch (err) {
      console.error("Error deleting model:", err);
    }
  }

  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent card click event
      const card = btn.closest(".model-card");
      const id = card.getAttribute("data-id");
      // Find model object
      const model = data.data.find((m) => m._id === id);
      // Get adminId from model.adminDetails.userId (adjust if needed)
      const adminId =
        model.adminDetails?.userId || model.adminDetails?._id || "";
      // Redirect to editModel.html with modelId and adminId
      window.location.href = `superAdmin.html?page=edit?modelId=${id}&adminId=${adminId}`;
    });
  });
  // Initial load
  loadModels();
})();
async function viewModelDetails(modelId) {
  try {
    const res = await fetch(`${API_URL}/${modelId}/details`);
    const result = await res.json();
    if (res.ok) {
      const { model, totalEarnings, totalUsers, usersDetails } = result.data;

      const detailHtml = `
                <div class="model-detail-modal">
                    <h2>${model.name} (${model.modelType})</h2>
                    <p><strong>Total Users:</strong> ${totalUsers}</p>
                    <p><strong>Total Earnings:</strong> ₹${totalEarnings}</p>
                    <p><strong>Price per User:</strong> ₹${
                      model.subscriptionPlan?.price || 0
                    }</p>
                    <h4>User Subscriptions:</h4>
                    <ul>
                        ${usersDetails
                          .map(
                            (user) => `
                            <li><strong>${user.username}</strong> - Remaining Days: ${user.remainingDays}</li>
                        `
                          )
                          .join("")}
                    </ul>
                    <button onclick="closeDetailModal()">Close</button>
                </div>
            `;

      // Show as popup/modal or section
      const detailContainer = document.createElement("div");
      detailContainer.id = "modelDetailPopup";
      detailContainer.className = "popup-overlay";
      detailContainer.innerHTML = detailHtml;
      document.body.appendChild(detailContainer);
    } else {
      alert(result.message || "Failed to load model details");
    }
  } catch (err) {
    console.error("Error fetching model details:", err);
  }
}

function closeDetailModal() {
  const popup = document.getElementById("modelDetailPopup");
  if (popup) popup.remove();
}
// ...existing code...
