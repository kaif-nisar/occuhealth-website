  async function fetchCommissionData() {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/user/total-commission?userId=${userId}`);
      const result = await response.json();

      if (result.success) {
        const { today, month, total } = result.data;
        // Populate the cards
        document.querySelector(".card.red p").innerText = `Rs. ${today}`;
        document.querySelector(".card.green p").innerText = `Rs. ${month}`;
        document.querySelector(".card.blue p").innerText = `Rs. ${total}`;
      } else {
        console.error("Failed to fetch commission data", result.error);
      }
    } catch (error) {
      console.error("Error fetching commission data:", error);
    }
  }

  // Call the function on page load
fetchCommissionData();
