// superAdminRoutes.js
import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { verifySuperAdmin } from "../../middlewares/superAdminMiddleware.js";
import { checkSubscriptionStatus } from "../../middlewares/cheakSubsription.middleware.js";
import { setTenantContext } from "../../middlewares/tenantContextMiddleware.js";
import { upload } from "../../middlewares/multer_middlewares.js";
import { authorizeRoles, checkStaffPermission, adminOnly } from "../../middlewares/role.middleware.js";
import { User } from "../models/user.model.js";

import {
  registerSuperAdmin,
  loginSuperAdmin,
  logOutSuperAdmin,
  createTenant,
  addSuperStaff,
  getAllTenants,
  updateAdminById,
  getTenantById,
  createVirtualAccount,
  getAllVirtualAccounts,
  getVirtualAccount,
  closeVirtualAccount,
  // updateTenantStatus,
  // deleteTenant,
  // createAdminForTenant,
  // getTenantStatistics,
  // getDashboardStats
} from "../controllers/superAdmin.controller.js";
import {
  addpannelcontroller,
  allPannelcontroller,
  onePannelcontroller,
  editPannelController,
  updatePannelOrder,
  updatePannelOrdersuper,
  tenantAllPanel,
  addpannelcontrollerforadmin,
  adminEditPannelController
} from "../controllers/addpannel.controller.js";
import {
  addPackagecontroller,
  allPackagecontroller,
  onePackagecontroller,
  editPackageController,
  tenantAllPackage,
  addPackagecontrollerforadmin,
  adminEditPackageController
} from "../controllers/Package.controller.js";
import {
  getOneTest,
  addingTest,
  editTest,
  allTest,
  testCate,
  editTestCate,
  editdefaultresult,
  getAllTestCate,
  getOneTestCate,
  updateTestCate,
  findTestcontroller,
  updateTestcontroller,
  updateTestOrder,
  updateTestInterpretation,
  addUnit,
  getUnits,
  tenantTest,
  addsample,
  fetchsample,
  getAllModels,
  assignModelsToFranchisee,
  updateTestCateadmin,
  getAllTestCateadmin,
  fetchsampleadmin,
  addUnitadmin,
  addsampleadmin,
  addingTesttenant,
  editTesttenant,
  updateTestOrdersuper,
  adminAssign,
  getAllAddOns
} from "../controllers/addtest.controller.js";
import {
  addCategory,
  fetchCategories,
  updatecategoryOrder,
  categoryById,
  fetchCategoriesadmin,
  addCategoryadmin,
  updatecategoryOrdersuper
} from "../controllers/categoryController.js";
import {
  registerUser,
  loginUser,
  logOutUser,
  getCurrentUser,
  refreshAccessToken,
  superFranchiseeCreate,
  moneySendToFranchisee,
  moneySendToSubFranchisee,
  moneySendToSuperFranchisee,
  amountUpdate,
  getMyFranchisees,
  fetchAllFranchisee,
  setOverdraft,
  moneyDebitFromSuperFranchisee,
  moneyDebitFromFranchisee,
  moneyDebitFromSubFranchisee,
  getFilteredTransactionHistory,
  verifyPin,
  superFranchiseeUpdate,
  deleteAdminAndTenant,
  addBookingWalletAmount,
  franchisee,
  updateBankDetails,
  getBankDetails,
  setupRazorpayAccount,
  getRazorpayAccount,
  payToAdmin,
  verifyAdminPayment,
  createWalletTopup,
  verifyWalletTopup,
  getWalletTopupHistory,
  getPlatformFinanceSummary,
} from "../controllers/user.controller.js";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";
import {
  createStaff,
  loginStaff,
  logoutStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  getStaffActivities,
  changeStaffPassword,
  staffActivity,
  oneStaffActivity,
  staffDashboard,
  allStaff,
  getAllStaffWithActivities,
  getTenantStaffActivities,
  getStaffByIdTenant,
  updateStaffTenant,
  deleteStaffTenant,
} from "../controllers/staff.controller.js";

import {
  assignTestPrice,
  getAssignedTests,
  getAssignedPanels,
  getAssignedPackages,
  listCommission,
  getLedger,
  getLedgerSummary,
  totalCommission,
  accountSummary,
  getLedgerEntries,
  assignSingleTestPrice,
  getBusinessAnalytics,
} from "../controllers/commission.controller.js";
import { barcodegeneratecontroller } from "../controllers/barcode.controller.js";
import {
  addLabController,
  allLabController,
  updateLabController,
  deleteLabController,
  getLabById,
} from "../controllers/bookingAddLab.controller.js";
import { getDashboardData } from "../controllers/user.controller.js";
import {
  getDashboardStats,
  getRecentClients,
  getTopFranchiseesByRevenue,
  getRevenueData,
  getModelUsageData
} from "../controllers/analytics.controller.js";
// Notification controller import for dashboard notifications
import { getNotifications } from "../controllers/notification.controller.js";
import {
  loadAllBooking,
  loadBooking,
  NewBookingcontroller,
  allBookingsController,
  getAllBookingsController,
  getAdminListBookingsController,
  getAllCancelledBookingsController,
  updatebookingstatus,
  getbarcodebooking,
  bookingreportgenOrnot,
  getthirtydayspreviousBookingsController,
  getbarcodetestsandpannels,
  rejectBookingcontroller,
  deleteBarcode,
  getTestNameController,
  getBookingcontroller,
  editBookingController,
  CompleteBookingcontroller,
  statusBookingcontroller,
  searchit,
  findbookingId,
  getallbarcodesController,
  updategeneratedbillvariable,
  countBookingsForAllTenants,
  HoldBookings, canceledBookings,
  editbookingbookedtests, editBookingBarcodes,
  getDashboardDataController,
  DeleteBookingByParamsController,
  SearchBookingController,
  cancelBookingController
} from "../controllers/NewBooking.controller.js";
import {
  addDoctorsController, allDoctorsController,
  updateDoctorController, deleteDoctorController,
  getDoctorById
} from "../controllers/doctors.controllers.js";
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  renewWithCommission,
  getSubscriptionStatus,
  requestWithdrawal,
  getWithdrawalHistory,
  getReferralDashboard,
  registerWithReferral,
  processWithdrawalRequest,
  getAllWithdrawalRequests,
  getRefferalDashboardStats,
  getReferralStats,
  getReferralHistory,
  getSubscriptionAnalytics,
  checkTenantSubscription,
  getTenantDetails,
  handleRazorpayWebhook
} from "../controllers/subscription.controller.js";
import { updatePassword, sfUpdate } from "../controllers/superFranchise.cantroller.js";
// kaif new routes 













import { forgotPassword, resetPassword } from "../controllers/forgotpassword.controller.js";
import {
  getConversationByBookingId, saveConversation, getnewnotificationforadmin
  , getnewnotificationforfranshisee, changewatchedstatus, getAllNotifications
} from "../controllers/messages.controller.js";
import {
  getDoctorsSign, uploadDoctorsSign,
  deleteLabInchargeSign, editdoctorsvisibility
} from "../controllers/labinchargesign.controller.js"
import {
  createProduct, getAllProducts
  , updateProduct, getLatestProduct
  , getProductById
} from "../controllers/product.controller.js";
import { saveAddress, getAllAddresses } from "../controllers/address.controller.js";
import {
  saveInvoiceOrder, fetchAllOrders, cancelOrder, fetchUserOrders
} from "../controllers/order.controller.js";
import {
  addNewCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  searchCategories,
  getCategoryStats,
  getCategoryById
} from '../controllers/budgetCategory.controller.js';
import {
  addNewExpense, fetchUserExpenses,
  editExpense
} from "../controllers/expense.controller.js";
import {
  savingPdfDatacontroller, getpdfcontroller,
  getCustomizationByReportId, invoicepdfgenerator,
  getAllInvoices, getpdfcontrolleruser, mergePdfsController, certificatepdfgenerator
} from "../controllers/pdfgenerator.controller.js";
import {
  SaveReportController, getReportController,
  editReportsignofffieldController, getReportControlleruser
} from "../controllers/reportData.controller.js"
import { getAllTemplates, uploadImage, deleteImage } from "../controllers/template.controller.js"
import { qrcodecontroller } from "../controllers/qrcode.controller.js"
import { sendSMS, sendEmail, handleRequest } from "../controllers/sendingReport.controller.js";
import {
  getBookedTestById, saveOrUpdateBookedTest
} from "../controllers/testsValuesEntered.controller.js"
import { allTestdetails, defaultResultsGet } from "../controllers/fetchtests.controller.js"
import { getresult, getbarcoderesult } from "../controllers/lisresult.controller.js"
import { addvideo, getAllVideos, deletevideo } from "../controllers/videos.controller.js";
import { subscribe } from "../controllers/sunscribe.controller.js";
import { saveTestTemplate, getTemplatesByTestId, deleteTemplateByName } from "../controllers/testTemplate.controller.js"
import { verify } from "crypto";
import { updateOrder } from "../controllers/order2.controller.js";

const router = Router();

// Auth routes
router.post("/register", registerSuperAdmin);
router.post("/login", loginSuperAdmin);
router.post("/logOut/superAdmin", verifySuperAdmin, logOutSuperAdmin);
router.get("/get-current-user", verifyJWT, getCurrentUser);
// OTP for public signup/verification
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Tenant management
router.post("/tenants", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), createTenant);
router.get("/get-tenants", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), getAllTenants);
router.get("/models", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), getAllTenants);
router.get("/tenants-model/:tenantId", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), getTenantById);
// router.patch("/tenants/:tenantId/status", verifySuperAdmin, setTenantContext, updateTenantStatus);
// router.delete("/tenants/:tenantId", verifySuperAdmin, setTenantContext, deleteTenant);
router.put("/update-model/:tenantId", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), updateAdminById);

// // Tenant admin creation
// router.post("/tenants/:tenantId/admin", verifySuperAdmin, setTenantContext, createAdminForTenant);

// // Statistics
// router.get("/tenants/:tenantId/stats", verifySuperAdmin, setTenantContext, getTenantStatistics);
// router.get("/dashboard", verifySuperAdmin, getDashboardStats);
router.get("/get-all-models", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), getAllModels);
router.post("/assign-models", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), assignModelsToFranchisee);
router.get("/staff", verifySuperAdmin, allStaff);
router.get("/staff/activities", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), staffActivity);

router.get("/tenant-staff", verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee"]), checkStaffPermission("canManageUsers"), getAllStaffWithActivities);
router.get("/tenant-staff/activities", verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee"]), checkStaffPermission("canManageUsers"), getAllStaffWithActivities);
router.get("/dashboard/stats", verifySuperAdmin, getDashboardStats);
router.get("/dashboard/recent-clients", verifySuperAdmin, getRecentClients);
router.get("/dashboard/top-franchisees", verifySuperAdmin, getTopFranchiseesByRevenue);
router.get("/dashboard/notifications", verifySuperAdmin, getNotifications);
router.get("/dashboard/revenue-data", verifySuperAdmin, getRevenueData);
router.get("/dashboard/model-usage", verifySuperAdmin, getModelUsageData)

// subscription routes
router.post("/create-order", verifyJWT, authorizeRoles(["superAdmin", "admin"]), createSubscriptionOrder);
router.post("/verify-payment", verifyJWT, authorizeRoles(["superAdmin", "admin"]), verifySubscriptionPayment);
router.post("/renew-with-commission", verifyJWT, authorizeRoles(["superAdmin", "admin"]), renewWithCommission);
router.get("/status", verifyJWT, authorizeRoles(["superAdmin", "admin"]), getSubscriptionStatus);
// Razorpay Webhook (No auth - Razorpay will call this directly)
router.post("/razorpay-webhook", handleRazorpayWebhook);

// Referral routes
router.get("/referral-dashboard", verifyJWT, getReferralDashboard);
router.post("/register-with-referral", registerWithReferral);

// Withdrawal routes
router.post("/request-withdrawal", verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee"]), requestWithdrawal);
router.get("/withdrawals/history", verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee"]), getWithdrawalHistory);

// Super Admin routes
router.post("/process-withdrawal", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManagePayments"), processWithdrawalRequest);
router.get("/all-withdrawals", verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManagePayments"), getAllWithdrawalRequests);
router.get("/dashboard-stats", verifyJWT, checkStaffPermission("canManagePayments"), getRefferalDashboardStats);
router.get("/referrals/stats", verifyJWT, checkStaffPermission("canManagePayments"), getReferralStats);
router.get("/referrals/history", verifyJWT, checkStaffPermission("canManagePayments"), getReferralHistory);
router.get("/subscription/analytics", verifySuperAdmin, getSubscriptionAnalytics);
router.get("/platform-finance-summary", verifySuperAdmin, getPlatformFinanceSummary);
// router.get("/get",verifySuperAdmin,getStaffById)

// import routes from other database files

// router.route("/register").post(
//     upload.fields([
//         {
//             name: "avtar",
//             maxCount: 1
//         }, {
//             name: "coverImage",
//             maxCount: 1
//         }
//     ]), registerUser)

router.route("/login-admin").post(loginUser);

router.route("/franchisee-create").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), superFranchiseeCreate);

router.route("/get-super-franchisee").get(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), getMyFranchisees);
// // single franchisee data
router.route('/franchisee-data').get(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), franchisee)
// // secured routes
// router.route("/logout-user").post(verifyJWT, logOutUser);
router.route("/logout").post(verifyJWT, logOutUser);
// router.route("/refresh-token").post(refreshAccessToken)

// //superFranchisee fetch and update
router.route("/superFranchisee-fetch").get(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), superFranchiseeUpdate);

// // superFranchisee update
router.route("/superFranchisee-update").post(
  verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
    { name: "nablLogo", maxCount: 1 }
  ]),
  sfUpdate
);

// // superFranchisee log out
// router.route("/superFranchiseeLogout").post(  superFranchiseeLogout)

//fetchFranchisee
router.route("/fetchFranchisee").get(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), fetchAllFranchisee)

// Set overdraft permission & limit for a franchisee/user
router.post("/set-overdraft", verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), setOverdraft);

// // franchisee logout
// router.route("/franchisee-logOut").post(
//      franchiseeLogOut)
// // subFranchisee created
// router.route("/subFranchise-create").post( franchiseOnly, subFranchiseeCreate)

// //superfranchisee update
// router.route("/superFranchisee-update").put(sfUpdate)

// // update password
router.route("/change-password").put(updatePassword)
//subFranchisee log in
// router.route("/subFranchisee-logIn").post( subFranchiseeLogIn)
//subFranchisee log out

// router.route("/subFranchisee-logOut").post(subFranchiseeLogOut)

// wallet system routes
// admin can send
router.route("/admin-send-to-super").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneySendToSuperFranchisee)
router.route("/admin-send-to-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneySendToFranchisee)
router.route("/admin-send-to-sub-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneySendToSubFranchisee)

// admin can credit
router.route("/admin-debit-from-super").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneyDebitFromSuperFranchisee)
router.route("/admin-debit-from-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneyDebitFromFranchisee)
router.route("/admin-debit-from-sub-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneyDebitFromSubFranchisee)

// one to one conection
router.route("/super-send-to-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneySendToFranchisee)
router.route("/franchisee-send-to-sub-franchisee").post(verifyJWT, authorizeRoles(["admin", "franchisee", "superFranchisee", "staff"]), checkStaffPermission("canManagePayments"), moneySendToSubFranchisee)
//franchisee send money to subFranchisee

// // get assigned pannels
router.route("/get-all-pannels").post(verifyJWT, getAssignedPanels);

// get test
router.route("/get-test").post(verifyJWT, getAssignedTests);

// get assigned package
router.route("/get-all-packages").post(verifyJWT, getAssignedPackages);

// //assing test price
router.route("/assign-prices").put(verifyJWT, checkStaffPermission("canManageUsers"), assignTestPrice);

// router.route('/franchisee-send-to-sub').post(sendMoneyToSubFranchisee)
router.route("/get-model").get(verifySuperAdmin);
// fetch wallet amount
router.route("/wallet-amount/:userId").get(verifyJWT, amountUpdate);
// fetch transaction History
router.route("/transaction-history").get(verifyJWT, checkStaffPermission("canManagePayments"), getFilteredTransactionHistory);
// All get request here for fetch  data from database

// admin amount assign to super franchisee
router.route('/assignPrice').post(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), assignSingleTestPrice)

// // add staff and list staff

// // add staff and list staff
router.route("/add-staff").post(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), createStaff);
router.route("/list-staff").get(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), getAllStaff);
router.route("/get-staff").get(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), getStaffById);
router.route("/update-staff/:staffId").put(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), updateStaff);
router.route("/update-staff-tenant/:staffId").put(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), updateStaffTenant);
router.route("/delete-staff/:staffId").delete(verifySuperAdmin, deleteStaffTenant);
router.route("/delete-staff-tenant/:staffId").delete(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee", "staff"]), checkStaffPermission("canManageUsers"), deleteStaff);
router.route("/staff-activities/:id").get(verifyJWT, getStaffActivities);
router.route('/get-staff-tenant').get(verifyJWT, getStaffByIdTenant)
router.route("/add-super-staff").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageUsers"), addSuperStaff);


router.route('/add-unit').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), addUnit);
router.route('/add-unit-tenant').post(verifyJWT, checkStaffPermission('canManageTest'), addUnitadmin);
router.route('/get-units').get(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), getUnits)
router.route('/get-units-tenant').get(verifyJWT, getUnits)
router.route('/category-add').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), addCategory)
router.route('/category-add-tenant').post(verifyJWT, checkStaffPermission("canManageTest"), addCategoryadmin)
router.route('/category-list').get(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), getAllTestCate);
router.route('/category-list-tenant').get(verifyJWT, getAllTestCateadmin);
router.route('/category-found').get(getOneTestCate)
router.route('/category-edit').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), updateTestCate)
router.route('/category-edit-tenant').post(verifyJWT, checkStaffPermission('canManageTest'), updateTestCateadmin)

router.route('/bookings').get(verifyJWT, loadBooking)
router.route('/all-bookings').get(verifyJWT, loadAllBooking)
// // commission ledger
// router.route('/commission-ledger').get(listCommission)
router.route("/test").post(checkStaffPermission("canManageTest"), allTest);
router.route("/make-test").post(
  verifySuperAdmin,
  authorizeRoles(["superAdmin", "staff"]),
  checkStaffPermission("canManageTest"), // staff के लिए permission check
  addingTest
);
router.route("/make-test-tenant").post(verifyJWT, checkStaffPermission('canManageTest'), addingTesttenant);
router.route("/test-found").get(getOneTest);
router.route("/test-edit").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), editTest);
router.route("/test-edit-tenant").post(verifyJWT, checkStaffPermission('canManageTest'), editTesttenant);
router.route("/ledger").post(verifyJWT, getLedger)
router.route("/ledger-summary").get(verifyJWT, getLedgerSummary)
router.route("/total-commission").get(verifyJWT, totalCommission)
router.route("/account-summary").get(verifyJWT, checkStaffPermission('canManagePayments'), accountSummary)
router.route("/ledgerEntries").get(verifyJWT, checkStaffPermission('canManagePayments'), getLedgerEntries);
router.route("/bookings-search").get(verifyJWT, searchit)
router.route("/assign-single-test-price").post(verifyJWT, checkStaffPermission('canManageTest'), assignSingleTestPrice)
router.route("/verify-pin").post(verifyJWT, checkStaffPermission('canManagePayments'), verifyPin)
router.route("/get-booking-all").get(verifyJWT, getAllBookingsController);
router.route("/get-booking-for-dashboard").get(verifyJWT, getDashboardDataController);
router.route("/get-franchisee-all").get(verifyJWT, checkStaffPermission('canManageUsers'), fetchAllFranchisee)
router.route('/analytics').get(verifyJWT, getBusinessAnalytics)
router.route('/bookings/search').post(verifyJWT, SearchBookingController)
router.route('/bookings/cancel').post(verifyJWT, cancelBookingController)
// Upload UPI Screenshot
export const uploadUpiScreenshot = async (req, res) => {
  try {
    // Handle multer upload
    upload(req, res, async function (err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error'
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const userId = req.body.userId || req.user?._id;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      try {
        // Upload to Cloudinary using buffer
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'upi-screenshots',
              public_id: `upi_${userId}_${Date.now()}`,
              resource_type: 'image',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          // Write buffer to stream
          uploadStream.end(req.file.buffer);
        });

        // Find user and update
        const User = require('../models/User'); // Adjust path as needed
        const user = await User.findById(userId);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        // Save screenshot info in user document
        if (!user.upiScreenshots) {
          user.upiScreenshots = [];
        }

        user.upiScreenshots.push({
          url: result.secure_url,
          publicId: result.public_id,
          uploadedAt: new Date(),
          status: 'pending' // pending, approved, rejected
        });

        // Optional: Mark subscription as pending verification
        if (user.subscription) {
          user.subscription.paymentStatus = 'pending_verification';
        }

        await user.save();

        // Get SuperAdmin details
        const superAdmin = await User.findOne({ role: 'superadmin' });

        // Send notification to SuperAdmin (optional)
        // You can implement email/WhatsApp notification here
        if (superAdmin) {
          // Example: Create a notification document
          const Notification = require('../models/Notification'); // If you have notification model
          await Notification.create({
            userId: superAdmin._id,
            title: 'New UPI Screenshot Uploaded',
            message: `User ${user.username} (${user.email}) has uploaded a UPI screenshot for verification.`,
            type: 'upi_verification',
            data: {
              userId: user._id,
              screenshotUrl: result.secure_url,
              username: user.username,
              email: user.email
            },
            read: false
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Screenshot uploaded successfully. Waiting for SuperAdmin verification.',
          data: {
            url: result.secure_url,
            publicId: result.public_id,
            uploadedAt: new Date()
          }
        });

      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload to cloud storage'
        });
      }
    });

  } catch (error) {
    console.error('Upload screenshot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all pending UPI screenshots (for SuperAdmin)
export const getPendingScreenshots = async (req, res) => {
  try {
    const User = require('../models/User');

    // Find all users with pending screenshots
    const users = await User.find({
      'upiScreenshots': { $exists: true, $ne: [] }
    }).select('username email fullName upiScreenshots subscription');

    // Filter users with pending screenshots
    const pendingUsers = users
      .map(user => {
        const pendingScreenshots = user.upiScreenshots.filter(
          screenshot => screenshot.status === 'pending'
        );

        if (pendingScreenshots.length > 0) {
          return {
            userId: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            screenshots: pendingScreenshots,
            subscriptionStatus: user.subscription?.isActive
          };
        }
        return null;
      })
      .filter(user => user !== null);

    return res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });

  } catch (error) {
    console.error('Get pending screenshots error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending screenshots'
    });
  }
};

// Approve/Reject screenshot (for SuperAdmin)
export const verifyScreenshot = async (req, res) => {
  try {
    const { userId, screenshotId, action, remarks } = req.body;

    // action can be 'approve' or 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find the screenshot
    const screenshot = user.upiScreenshots.id(screenshotId);
    if (!screenshot) {
      return res.status(404).json({
        success: false,
        message: 'Screenshot not found'
      });
    }

    // Update screenshot status
    screenshot.status = action === 'approve' ? 'approved' : 'rejected';
    screenshot.verifiedAt = new Date();
    screenshot.verifiedBy = req.user._id; // SuperAdmin ID
    if (remarks) screenshot.remarks = remarks;

    // If approved, activate subscription
    if (action === 'approve') {
      if (user.subscription) {
        user.subscription.isActive = true;
        user.subscription.paymentStatus = 'paid';
        user.subscription.activatedAt = new Date();
      } else {
        // Create new subscription
        user.subscription = {
          isActive: true,
          paymentStatus: 'paid',
          activatedAt: new Date()
        };
      }
    }

    await user.save();

    // Send notification to user (optional)
    const Notification = require('../models/Notification');
    await Notification.create({
      userId: user._id,
      title: action === 'approve' ? 'Payment Verified!' : 'Payment Verification Failed',
      message: action === 'approve'
        ? 'Your payment has been verified. Your account is now active!'
        : `Your payment verification was rejected. ${remarks || 'Please contact support.'}`,
      type: 'payment_verification',
      read: false
    });

    return res.status(200).json({
      success: true,
      message: `Screenshot ${action}d successfully`,
      data: {
        userId: user._id,
        username: user.username,
        action: action,
        subscriptionActive: user.subscription?.isActive
      }
    });

  } catch (error) {
    console.error('Verify screenshot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify screenshot'
    });
  }
};























//kaif routes

// all pannels route
router.route('/all-packages').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), allPackagecontroller);
router.route('/all-packages-tenant').post(verifyJWT, tenantAllPackage);
// add package route
router.route('/add-package').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), addPackagecontroller);
router.route('/add-package-tenant').post(verifyJWT, checkStaffPermission("canManageTest"), addPackagecontrollerforadmin);

// fething editone pannel
router.route("/one-Pannel/:value1").post(onePannelcontroller);

// fething editone package
router.route("/one-Package/:value1").post(onePackagecontroller);

// edit pannels route
router.route("/edit-Pannel/:value1").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), editPannelController);
router.route("/edit-Pannel-tenant/:value1").post(verifyJWT, checkStaffPermission("canManageTest"), adminEditPannelController);
// edit pannels route
router
  .route("/edit-Package/:value1")
  .post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), editPackageController);
router.route("/edit-Package-tenant/:value1").post(verifyJWT, checkStaffPermission("canManageTest"), adminEditPackageController);

// // add Test Package
router.route('/add-panels').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), addpannelcontroller)
router.route('/add-panels-tenant').post(verifyJWT, addpannelcontrollerforadmin)
router.route('/all-pannels').post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), allPannelcontroller)
router.route('/all-pannels-tenant').post(verifyJWT, tenantAllPanel)
router.route("/models/tenant").get(verifySuperAdmin, countBookingsForAllTenants)

// booking related routes












// find test controller
router.route("/findTest/:name/:shortName").post(findTestcontroller);

// update test
router.route("/editTest/:name/:shortName").post(updateTestcontroller);

// // for fetching all test data
router.route("/categoryById").post(verifySuperAdmin, categoryById);

router.route("/categoryById-tenant").post(verifyJWT, checkStaffPermission("canManageTest"), categoryById);

// for fetching all test data
router.route("/editTestOrdersuper").post(verifySuperAdmin, updateTestOrdersuper);
// for fetching all test data
router.route("/editTestOrder").post(verifyJWT, updateTestOrder);

// // new booking controller
router.route("/new-booking").post(upload.fields([
  {
    name: "file",
    maxCount: 1
  }
]),
  verifyJWT, checkStaffPermission("canManageBookings"), NewBookingcontroller);

// // new booking controller
router.route("/editbookingbookedtests").post(upload.fields([
  {
    name: "file",
    maxCount: 1
  }
]),
  verifyJWT, editbookingbookedtests);

// // fetching all-bookings from database
router.route("/last-booking").post(verifyJWT, allBookingsController)

// //addDoctorsController
router.route("/add-doctor").post(verifyJWT, checkStaffPermission("canManageBookings"), addDoctorsController)

// //all doctors fetching
router.route("/all-doctor").get(verifyJWT, allDoctorsController)
// get doctor by id
router.route("/doctors/:doctorId").get(verifyJWT, getDoctorById);
//  update doctor
router.route("/doctors/update").put(verifyJWT, updateDoctorController);
// delete doctor
router.route("/delete-doctor").delete(verifyJWT, deleteDoctorController);

// //addLabController
router.route("/add-Lab").post(verifyJWT, checkStaffPermission("canManageBookings"), addLabController)

router.route("/all-Lab").get(verifyJWT, allLabController)
// get lab by id
router.route("/labs/:labId").get(verifyJWT, getLabById);
// update lab
router.route("/labs/update").put(verifyJWT, updateLabController);
// delete lab
router.route("/delete-lab").delete(verifyJWT, deleteLabController);
// // get all bookings controller
router.route("/get-bookings").post(verifyJWT, checkStaffPermission("canViewReports"), getAllBookingsController)
router.route("/list-bookings-admin").get(verifyJWT, checkStaffPermission("canViewReports"), getAdminListBookingsController)

// // get all cancelled bookings controller
router.route("/get-cancelled-bookings").post(verifyJWT, getAllCancelledBookingsController)

// // update booking status
router.route("/update-booking-status").post(verifyJWT, checkStaffPermission("canViewReports"), updatebookingstatus)

// // reject booking status
router.route("/reject-booking").put(verifyJWT, rejectBookingcontroller)

// // get booking by barcodeId
router.route("/get-barcode").post(verifyJWT, checkStaffPermission("canViewReports"), getbarcodebooking)

// // get booking by barcodeId
router.route("/testsByBarcode").post(verifyJWT, getbarcodetestsandpannels)

// // fetching all tests
router.route("/allTestdetails").post(verifyJWT, allTestdetails)

// // fetching selected test defaultresult
router.route("/edit-add-defaultresults").post(verifyJWT, defaultResultsGet);

// //editing selected tests defaultresult
router.route("/edit-defaultresults").post(verifySuperAdmin, editdefaultresult);


// // recieving report-data
router.route("/saveReportData").post(verifyJWT, SaveReportController);

// // edit report-data
// router.route("/editReportData").post(editReportController);

// // // recieving report
router.route("/ReportData").post(verifyJWT, checkStaffPermission("canViewReports"), getReportController);

// // // recieving report
router.route("/ReportData-user").post(getReportControlleruser);

// // recieving pdf
// router.route("/generate-pdf").post(pdfgeneratorcontroller);

// // // report by bookingId
// router.route("/report/:bookingId").post(getReportByBookingId);

// // report by bookingId
router.route("/isreportready").post(bookingreportgenOrnot);

// for fetching all test data
router.route("/test-database").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), allTest);

router.route("/test-database-tenant").post(verifyJWT, tenantTest);
// // report by bookingId
// router.route("/thirty-days-bookings").post(getthirtydayspreviousBookingsController);

// // recieving pdf
// router.route("/generate-pdf2").post(pdfgeneratorcontroller2);

// // uploading template
router.route("/template").post(upload.fields([
  {
    name: "template",
    maxCount: 1
  }
]), verifyJWT, uploadImage);

// // getting template
router.route("/templates").post(verifyJWT, checkStaffPermission("canManageTest"), getAllTemplates);

// // getting template
router.route("/get-pdf").post(verifyJWT, getpdfcontroller)

// // getting template
router.route("/merge-pdfs").post(verifyJWT, mergePdfsController)

// getting user pdf
router.route("/get-pdf-user").post(getpdfcontrolleruser)

// // getting template
router.route("/delete-image").post(verifyJWT, checkStaffPermission("canManageTest"), deleteImage)

// // getting template
router.route("/adding-pdf-data").post(verifyJWT, savingPdfDatacontroller)

// // getting template
router.route("/generate-barcode").post(verifyJWT, barcodegeneratecontroller)

// // getting template
router.route("/getting-pdf-data").post(verifyJWT, checkStaffPermission("canManageTest"), getCustomizationByReportId)

// // getting template
router.route("/generate-qr").post(verifyJWT, qrcodecontroller);

// // getting template
router.route("/reject-barcode").post(verifyJWT, deleteBarcode);

// // getting template
router.route("/getbarcodeTests").post(verifyJWT, checkStaffPermission("canViewReports"), getTestNameController);

// // adding category
router.route("/addCategory").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), addCategory);
// router.route("/addCategory-tenant").post(verifyJWT, addCategoryadmin);

// // adding category
router.route("/updatecategoryOrder").post(verifyJWT, checkStaffPermission("canManageTest"), updatecategoryOrder);

// // adding category
router.route("/updatecategoryOrdersuper").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), updatecategoryOrdersuper);

// adding category
router.route("/updatePannelOrder").post(verifyJWT, updatePannelOrder);
router.route("/updatePannelOrdersuper").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), updatePannelOrdersuper);

// send sms
router.route("/send-sms").post(upload.fields([
  {
    name: "pdf",
    maxCount: 1
  }
]), sendSMS)

// send email
router.route("/send-email").post(upload.fields([
  {
    name: "pdf",
    maxCount: 1
  }
]), sendEmail)

// fetching all Categories
router.route("/getbooking").post(verifyJWT, getBookingcontroller);

// edit booking
router.route("/editBooking").post(upload.fields([
  {
    name: "file",
    maxCount: 1
  }
]), verifyJWT, editBookingController);

router.route("/editReportsignofffield").post(verifyJWT, editReportsignofffieldController);

router.route("/deleteLabInchargeSign").post(verifyJWT, checkStaffPermission("canManageTest"), deleteLabInchargeSign);

router.route("/saveTestTemplate").post(verifyJWT, saveTestTemplate);

router.route("/getTemplatesByTestId").post(verifyJWT, getTemplatesByTestId);

router.route("/deleteTemplateByName").post(verifyJWT, deleteTemplateByName);

router.route("/updateTestInterpretation").post(verifyJWT, updateTestInterpretation);

router.route("/CompleteBookingcontroller").post(verifyJWT, CompleteBookingcontroller);

router.route("/saveConversation").post(verifyJWT, saveConversation);

router.route("/getConversationByBookingId").post(verifyJWT, getConversationByBookingId);

router.route("/statusBookingcontroller").post(verifyJWT, statusBookingcontroller);
//for saving current entered results
router.route("/saveOrUpdateBookedTest").post(verifyJWT, saveOrUpdateBookedTest);

// //for fetching entered results
router.route("/getBookedTestById").post(getBookedTestById);
router.route("/addsample").post(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), addsample);
router.route("/addsample-tenant").post(verifyJWT, addsampleadmin);
router.route("/fetchsample").get(verifySuperAdmin, authorizeRoles(["superAdmin", "staff"]), checkStaffPermission("canManageTest"), fetchsample);
router.route("/fetchsample-tenant").get(verifyJWT, fetchsampleadmin);
// Check tenant subscription status (protected - requires auth)
router.route(
  "/check-subscription").post(
    verifyJWT,
    checkTenantSubscription
  );
// Get full tenant details (protected - requires auth)
router.route(
  "/details").get(
    verifyJWT,
    getTenantDetails
  );
















// kaif routes 
router.route("/HoldBookings").get(verifyJWT, HoldBookings);
router.route("/getnewnotificationforfranshisee").get(verifyJWT, getnewnotificationforfranshisee);
router.route("/getnewnotificationforadmin").get(verifyJWT, getnewnotificationforadmin);
router.route("/all-notifications").get(verifyJWT, getAllNotifications);
router.route("/changewatchedstatus/:docId").get(verifyJWT, changewatchedstatus);
router.route("/editdoctorsvisibility").post(verifyJWT, editdoctorsvisibility);
router.route("/createProduct").post(verifyJWT, upload.fields([
  {
    name: "mainImage",
    maxCount: 1
  },
  {
    name: "additionalImages",
    maxCount: 5
  }
]), checkStaffPermission("canManageUsers"), createProduct);
router.route("/getAllProducts").get(verifyJWT, checkStaffPermission("canManageUsers"), getAllProducts);
router.route("/getLatestProduct").get(verifyJWT, getLatestProduct);
router.route("/getProductById/:id").get(verifyJWT, getProductById);
router.route("/saveAddress").post(verifyJWT, saveAddress);
router.route("/getAllAddresses").get(verifyJWT, getAllAddresses);
router.route("/saveInvoiceOrder").post(verifyJWT, saveInvoiceOrder);
router.route("/fetchAllOrders").get(verifyJWT, checkStaffPermission("canManageUsers"), fetchAllOrders);
router.route("/updateProduct/:id").put(verifyJWT, checkStaffPermission("canManageUsers"), updateProduct);
router.route("/cancelOrder/:id").patch(verifyJWT, checkStaffPermission("canManageUsers"), cancelOrder);
router.route("/addNewExpense").post(verifySuperAdmin, addNewExpense);
router.route("/fetchUserOrders").get(verifyJWT, fetchUserOrders);
//adding budget category superadmin
router.route("/addNewCategory").post(verifySuperAdmin, addNewCategory);
router.route("/getAllCategories").get(verifySuperAdmin, getAllCategories);
router.route("/getCategoryStats").get(verifySuperAdmin, getCategoryStats);
router.route("/searchCategories").get(verifySuperAdmin, searchCategories);
router.route("/getCategoryById/:id").get(verifySuperAdmin, getCategoryById);
router.route("/updateCategory/:id").put(verifySuperAdmin, updateCategory);
router.route("/deleteCategory/:id").delete(verifySuperAdmin, deleteCategory);

//adding budget category admin
router.route("/addNewCategory-tenant").post(verifyJWT, addNewCategory);
router.route("/getAllCategories-tenant").get(verifyJWT, checkStaffPermission("canManagePayments"), getAllCategories);
router.route("/getCategoryStats-tenant").get(verifyJWT, checkStaffPermission("canManagePayments"), getCategoryStats);
router.route("/searchCategories-tenant").get(verifyJWT, checkStaffPermission("canManagePayments"), searchCategories);
router.route("/getCategoryById-tenant/:id").get(verifyJWT, checkStaffPermission("canManagePayments"), getCategoryById);
router.route("/updateCategory-tenant/:id").put(verifyJWT, checkStaffPermission("canManagePayments"), updateCategory);
router.route("/deleteCategory-tenant/:id").delete(verifyJWT, checkStaffPermission("canManagePayments"), deleteCategory);

router.route("/fetchUserExpenses").get(verifySuperAdmin, fetchUserExpenses);
router.route("/editExpense/:id").put(verifySuperAdmin, editExpense);

router.route("/getAllCategoriesuser").get(verifyJWT, getAllCategories);
router.route("/addNewExpenseuser").post(verifyJWT, addNewExpense);
router.route("/addNewCategoryuser").post(verifyJWT, checkStaffPermission("canManagePayments"), addNewCategory);
router.route("/fetchUserExpensesuser").get(verifyJWT, checkStaffPermission("canManagePayments"), fetchUserExpenses);
router.route("/editExpenseuser/:id").put(verifyJWT, checkStaffPermission("canManagePayments"), editExpense);
router.route("/canceledBookings").get(verifyJWT, canceledBookings);
//for getting invoice pdf
router.route("/invoicepdfgenerator").post(verifyJWT, checkStaffPermission("canManageBookings"), invoicepdfgenerator);
//for updating field
router.route("/updategeneratedbillvariable/:bookingid").get(verifyJWT, updategeneratedbillvariable);
router.route("/forgotPassword").post(forgotPassword);
router.route("/resetPassword").post(resetPassword);
router.route("/getallbarcodesController").get(verifyJWT, getallbarcodesController);
router.route("/uploadDoctorsSign").post(upload.fields([
  {
    name: "labsign",
    maxCount: 1
  },
  {
    name: "firstdoctorsign",
    maxCount: 1
  },
  {
    name: "seconddoctorsign",
    maxCount: 1
  },
]), verifyJWT, checkStaffPermission("canManageTest"), uploadDoctorsSign);
router.route("/getDoctorsSign").get(verifyJWT, getDoctorsSign);
router.route("/findbookingId").get(verifyJWT, findbookingId);
router.route("/editBookingBarcodes").post(verifyJWT, editBookingBarcodes);
router.route("/get-result").post(getresult);
router.route("/getbarcoderesult").post(getbarcoderesult);
router.route("/getAllInvoices").get(verifyJWT, getAllInvoices);
router.route("/handleRequest").post(handleRequest);
router.route("/addvideo").post(verifySuperAdmin, addvideo);
router.route("/getAllVideos").get(getAllVideos);
router.route("/deleteVideo/:id").delete(verifySuperAdmin, deletevideo);
router.route("/subscribe").post(subscribe);
router.route("/get-admin-assigned-models").post(verifySuperAdmin, adminAssign);
router.route("/get-all-addons").get(verifySuperAdmin, getAllAddOns);
router.route("/models/delete/:Id").delete(verifySuperAdmin, deleteAdminAndTenant);
router.route("/DeleteBookingByParamsController/:bookingId").delete(verifyJWT, DeleteBookingByParamsController);
router.route("/add-booking-wallet-amount").post(verifyJWT, checkStaffPermission("canManagePayments"), addBookingWalletAmount);
// Bank Details routes
router.route("/bank-details").get(verifyJWT, getBankDetails);
router.route("/bank-details").put(verifyJWT, updateBankDetails);
// Razorpay Account routes (Admin only)
router.route("/razorpay-account").get(verifyJWT, authorizeRoles(["admin"]), getRazorpayAccount);
router.route("/razorpay-account").post(verifyJWT, authorizeRoles(["admin"]), setupRazorpayAccount);
// Franchisee to Admin Payment routes
router.route("/pay-to-admin").post(verifyJWT, authorizeRoles(["franchisee", "subFranchisee"]), payToAdmin);
router.route("/verify-admin-payment").post(verifyJWT, authorizeRoles(["franchisee", "subFranchisee"]), verifyAdminPayment);
// Wallet Top-up routes
router.route("/create-wallet-topup").post(verifyJWT, authorizeRoles(["superFranchisee", "franchisee", "subFranchisee"]), createWalletTopup);
router.route("/verify-wallet-topup").post(verifyJWT, authorizeRoles(["superFranchisee", "franchisee", "subFranchisee"]), verifyWalletTopup);
router.route("/wallet-topup-history").get(verifyJWT, authorizeRoles(["admin", "superFranchisee", "franchisee", "subFranchisee"]), getWalletTopupHistory);

// Virtual Account Routes (SuperAdmin only)
router.post("/virtual-accounts", verifySuperAdmin, authorizeRoles(["superAdmin"]), createVirtualAccount);
router.get("/virtual-accounts", verifySuperAdmin, authorizeRoles(["superAdmin"]), getAllVirtualAccounts);
router.get("/virtual-accounts/:userId", verifySuperAdmin, authorizeRoles(["superAdmin"]), getVirtualAccount);
router.delete("/virtual-accounts/:userId", verifySuperAdmin, authorizeRoles(["superAdmin"]), closeVirtualAccount);

//for updating field
router.route("/certificatepdfgenerator").post(verifyJWT, certificatepdfgenerator);

router.route("/updateOrder/:id").put(verifyJWT, updateOrder);

export default router;
