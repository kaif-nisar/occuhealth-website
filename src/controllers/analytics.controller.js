import { Tenant } from "../models/tenant.model.js";
import { Ledger } from "../models/ledger.model.js";
import { User } from "../models/user.model.js";
import { testSchema } from "../models/newTest.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { newBooking } from "../models/NewBooking.model.js";

const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Get total clients count
    const totalClients = await Tenant.countDocuments({
      status: { $ne: "deleted" },
    });

    // Get active bookings count
    const testCount = await testSchema.countDocuments({ tenantId: null });
    const panelCount = await addPannel.countDocuments({ tenantId: null });
    const packageCount = await Package.countDocuments({ tenantId: null });
    const totalTest = testCount + panelCount + packageCount;
    // Get active models count
    const activeModels = await User.countDocuments({
      isActive: "true",
      role: "admin",
    });
    // Calculate total revenue
    // const revenueData = await Revenue.aggregate([
    //     {
    //         $group: {
    //             _id: null,
    //             totalRevenue: { $sum: '$amount' }
    //         }
    //     }
    // ]);

     const totalRevenue =  0;
    console.log(totalClients, totalTest, activeModels);
    res.json({
      success: true,
      data: {
        totalClients,
        totalTest,
        activeModels,
         totalRevenue
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
});

const getRecentClients = asyncHandler(async (req, res) => {
  try {
    const clients = await Tenant.find({ status: { $ne: "deleted" } })
      .populate("adminDetails", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name modelType createdAt adminDetails status");

    const formattedClients = clients.map((client) => ({
      id: client._id,
      name: client.name,
      model: client.modelType || "N/A",
      date: client.createdAt,
      status: client.status,
    }));

    res.json({
      success: true,
      data: formattedClients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent clients",
      error: error.message,
    });
  }
});


const getTopFranchiseesByRevenue = asyncHandler(async (req, res) => {
  try {
    const topFranchisees = await newBooking.aggregate([
      // Step 1: Filter completed bookings only
      {
        $match: {
          status: "completed"
        }
      },
      
      // Step 2: Group by tenantId and calculate total revenue
      {
        $group: {
          _id: "$tenantId", // tenantId ObjectId ke base par group
          totalRevenue: { $sum: "$total" }, // direct total field sum karna
          totalBookings: { $sum: 1 },
          // Optional: track unique franchisees if needed
          franchisees: { $addToSet: "$franchisee" }
        }
      },
      
      // Step 3: Sort by revenue in descending order (highest revenue = rank 1)
      {
        $sort: { totalRevenue: -1 }
      },
      
      // Step 4: Lookup tenant/admin details from tenant collection
      {
        $lookup: {
          from: "tenants", // ya jo bhi aapka tenant collection name hai
          localField: "_id",
          foreignField: "_id", // tenantId match karna
          as: "tenantDetails"
        }
      },
      
      // Step 5: Unwind tenant details
      {
        $unwind: {
          path: "$tenantDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      
      // Step 6: Project final structure with proper formatting
      {
        $project: {
          _id: 0,
          tenantId: "$_id",
          totalRevenue: 1,
          totalBookings: 1,
          // Admin/Tenant details
          adminDetails: {
            name: "$tenantDetails.name",
            email: "$tenantDetails.email",
            username: "$tenantDetails.username",
            code: "$tenantDetails.code",
            status: "$tenantDetails.status",
            modelType: "$tenantDetails.modelType",
            planType: "$tenantDetails.planType",
            subscriptionStatus: "$tenantDetails.paymentStatus"
          },
          franchiseesCount: { $size: "$franchisees" },
          franchiseesList: "$franchisees"
        }
      },
      
      // Step 7: Limit results (top 10)
      {
        $limit: 5
      }
    ]);
    console.log("Top Franchisees Data:", topFranchisees);
    // Add ranking after aggregation
    // const rankedData = topFranchisees.map((item, index) => ({
    //   rank: index + 1,
    //   ...item
    // }));

    // console.log("Top Franchisees by Revenue:", rankedData);
    
    res.json({ 
      success: true, 
      message: "Top franchisees by revenue fetched successfully",
      totalCount: topFranchisees.length,
      data: topFranchisees 
    });

  } catch (error) {
    console.error("Error in getTopFranchiseesByRevenue:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// @desc    Get recent notifications
// @route   GET /api/dashboard/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    const formattedNotifications = notifications.map((notification) => ({
      id: notification._id,
      type: notification.type,
      message: notification.message,
      time: notification.createdAt,
      isRead: notification.isRead,
    }));

    res.json({
      success: true,
      data: formattedNotifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
});

// @desc    Mark all notifications as read
// @route   POST /api/dashboard/notifications/mark-read
// @access  Private
const markNotificationsAsRead = asyncHandler(async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
});

// @desc    Get revenue data for charts
// @route   GET /api/dashboard/revenue-data
// @access  Private

const getRevenueData = asyncHandler(async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    let matchStage = {};
    let groupStage = {};
    let labels = [];

    const now = new Date();

    switch (period) {
      case "weekly":
        // Last 7 days
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchStage = {
          createdAt: { $gte: lastWeek },
          type: "credit", // Only credit transactions count as revenue
        };
        groupStage = {
          _id: { $dayOfWeek: "$createdAt" },
          total: { $sum: "$amount" },
        };
        labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        break;

      case "monthly":
        // Last 12 months
        const lastYear = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        matchStage = {
          createdAt: { $gte: lastYear },
          type: "credit", // Only credit transactions count as revenue
        };
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$amount" },
        };
        labels = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        break;

      case "yearly":
        // Last 5 years
        const lastFiveYears = new Date(now.getFullYear() - 4, 0, 1);
        matchStage = {
          createdAt: { $gte: lastFiveYears },
          type: "credit", // Only credit transactions count as revenue
        };
        groupStage = {
          _id: { $year: "$createdAt" },
          total: { $sum: "$amount" },
        };
        for (let i = 4; i >= 0; i--) {
          labels.push((now.getFullYear() - i).toString());
        }
        break;
    }

    // Revenue data from Ledger collection instead of Revenue collection
    const revenueData = await Ledger.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing periods with 0
    const values = new Array(labels.length).fill(0);

    revenueData.forEach((item) => {
      let index;
      if (period === "weekly") {
        index = item._id - 1; // dayOfWeek is 1-7, array is 0-6
      } else if (period === "monthly") {
        index = item._id.month - 1; // month is 1-12, array is 0-11
      } else if (period === "yearly") {
        index = labels.indexOf(item._id.toString());
      }

      if (index >= 0 && index < values.length) {
        values[index] = item.total;
      }
    });

    res.json({
      success: true,
      data: {
        labels,
        values,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue data",
      error: error.message,
    });
  }
});

// @desc    Get model usage data for charts
// @route   GET /api/dashboard/model-usage
// @access  Private
const getModelUsageData = asyncHandler(async (req, res) => {
  try {
    // Get model usage from Tenant collection directly using modelType field
    const modelUsage = await Tenant.aggregate([
      {
        $match: {
          status: "active", // Only count active tenants
        }
      },
      {
        $group: {
          _id: "$modelType", // Group by modelType directly
          count: { $sum: 1 },
          tenants: { $push: "$name" }, // Optional: get tenant names for each model
        },
      },
      {
        $sort: { count: -1 }, // Sort by highest usage first
      },
    ]);

    // Get total active tenants for percentage calculation
    const totalActiveTenants = await Tenant.countDocuments({ status: "active" });

    // Prepare chart data
    const labels = modelUsage.map((item) => item._id || "Unknown");
    const values = modelUsage.map((item) => item.count);
    const percentages = modelUsage.map((item) =>
      Math.round((item.count / totalActiveTenants) * 100)
    );

    res.json({
      success: true,
      data: {
        labels,
        values,
        percentages,
        totalTenants: totalActiveTenants,
        breakdown: modelUsage.map(item => ({
          modelType: item._id,
          count: item.count,
          percentage: Math.round((item.count / totalActiveTenants) * 100),
          tenants: item.tenants // List of tenant names using this model
        }))
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch model usage data",
      error: error.message,
    });
  }
});
export {
  getDashboardStats,
  getRecentClients,
  getTopFranchiseesByRevenue,
  getNotifications,
  markNotificationsAsRead,
  getRevenueData,
  getModelUsageData,
};
