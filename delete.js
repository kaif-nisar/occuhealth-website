// Environment variables load kar rahe hain (.env file se MONGO_URI etc.)
import dotenv from 'dotenv';
dotenv.config();

// Mongoose database library import kar rahe hain
import mongoose from 'mongoose';

// Project ke pre-defined Mongoose Models import kar rahe hain
import { User } from './src/models/user.model.js';
import { newBooking } from './src/models/NewBooking.model.js';
import { reports } from './src/models/reportData.model.js';
import { acceptedBarcode } from './src/models/samples.model.js';
import { Ledger } from './src/models/ledger.model.js';
import { customization } from './src/models/printsetting.model.js';
import { bookedTestsresult } from './src/models/Testvalues.model.js';

// Target Username aur Email setup kar rahe hain (Command line se le sakte hain ya default value use hogi)
const targetUsername = (process.argv[2] || 'hrd/healthbond').trim();
const targetEmail = (process.argv[3] || 'healthbond@gmail.com').trim();

// Secure Cleanup Function
async function secureDeleteTodayUserBookings() {
  try {
    // 1. LIVE CONSOLE ACTIVITY: MongoDB Database se connect ho rahe hain
    console.log('\n======================================================');
    console.log('🚀 LIVE ACTIVITY: MONGO DB CONNECTION STARTING...');
    console.log('======================================================');

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/labflow';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Database Connection Successful!');

    // 2. LIVE CONSOLE ACTIVITY: User Collection mein User details dhoondh rahe hain
    console.log('\n🔍 LIVE ACTIVITY: SEARCHING USER IN DATABASE...');
    console.log(`- Searching Username: "${targetUsername}"`);
    console.log(`- Searching Email: "${targetEmail}"`);

    // User model se target user ki exact document details nikal rahe hain
    const targetUser = await User.findOne({
      $or: [
        { username: targetUsername.toLowerCase() },
        { email: targetEmail.toLowerCase() }
      ]
    }).select('_id username email name role tenantId');

    // Agar user database me nahi mila toh script safe exit karegi
    if (!targetUser) {
      console.error('\n❌ ERROR: Database me yeh user NAHI mila!');
      console.error('👉 Kripya sahi username ya email enter karein.');
      await mongoose.disconnect();
      return;
    }

    // User milne par uski saari zaroori details print karo
    console.log('\n✅ USER DETAILS FOUND IN DATABASE:');
    console.log(`   - User ID (_id) : ${targetUser._id}`);
    console.log(`   - Tenant ID     : ${targetUser.tenantId || 'N/A'}`);
    console.log(`   - Username      : ${targetUser.username}`);
    console.log(`   - Email         : ${targetUser.email || 'N/A'}`);
    console.log(`   - Role          : ${targetUser.role || 'User'}`);

    // 3. Aaj ki Date ka Starting Time (00:00:00.000) aur Current Execution Time calculate kar rahe hain
    const currentTime = new Date();
    const startOfToday = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0);

    console.log('\n⏰ LIVE ACTIVITY: TIME RANGE FOR TODAY\'S DELETION:');
    console.log(`   - Start Time (Raat 12:00 AM) : ${startOfToday.toLocaleString()}`);
    console.log(`   - Current Time (Abhi tak)     : ${currentTime.toLocaleString()}`);

    // 4. LIVE CONSOLE ACTIVITY: Is User dwara aaj ki startOfDay se abhi tak lagayi gayi bookings dhoondho
    console.log('\n🔍 LIVE ACTIVITY: SEARCHING TODAY\'S BOOKINGS FOR THIS USER...');

    const userBookings = await newBooking.find({
      $or: [
        { createdBy: targetUser._id },
        { createdbyuser: String(targetUser._id) },
        { tenantId: targetUser.tenantId, createdBy: targetUser._id }
      ],
      createdAt: { $gte: startOfToday, $lte: currentTime }
    }).select('_id bookingId patientName total createdAt');

    // Agar aaj ki koi booking nahi mili toh live message dikhao aur terminate karo
    if (userBookings.length === 0) {
      console.log('⚠️  INFO: Is user ki aaj (Start of day se abhi tak) koi booking nahi mili.');
      console.log('🎉 Cleanup Completed cleanly with 0 deletions.');
      await mongoose.disconnect();
      return;
    }

    // Bookings ki IDs nikal rahe hain (ObjectIds for MongoDB references & String IDs for booking code)
    const bookingObjectIds = userBookings.map(b => b._id);
    const bookingStringIds = userBookings.map(b => b.bookingId).filter(Boolean);

    console.log(`\n🚨 FOUND ${userBookings.length} BOOKING(S) CREATED TODAY TO BE DELETED:`);
    userBookings.forEach((b, index) => {
      console.log(`   ${index + 1}. Booking ID: ${b.bookingId} | Patient: ${b.patientName} | Total: ₹${b.total} | Time: ${new Date(b.createdAt).toLocaleTimeString()}`);
    });

    // 5. LIVE CONSOLE ACTIVITY: STEP-BY-STEP DATA DELETION ACROSS ALL SCHEMAS/COLLECTIONS

    console.log('\n======================================================');
    console.log('🗑️  LIVE ACTIVITY: STARTING SECURE DATA DELETION');
    console.log('======================================================');

    // Step A: Main Test Bookings Delete karein (newBooking Model)
    const deletedBookings = await newBooking.deleteMany({ _id: { $in: bookingObjectIds } });
    console.log(`✅ [1/6] newBooking (Test Bookings)    : ${deletedBookings.deletedCount} record(s) deleted.`);

    // Step B: Associated Reports Delete karein (reports Model)
    const deletedReports = await reports.deleteMany({
      $or: [
        { bookingId: { $in: bookingStringIds } },
        { createdBy: targetUser._id, createdAt: { $gte: startOfToday, $lte: currentTime } }
      ]
    });
    console.log(`✅ [2/6] reports (Patient Test Reports): ${deletedReports.deletedCount} record(s) deleted.`);

    // Step C: Sample Barcodes Delete karein (acceptedBarcode Model)
    const deletedBarcodes = await acceptedBarcode.deleteMany({
      bookingId: { $in: bookingStringIds }
    });
    console.log(`✅ [3/6] acceptedBarcode (Sample Codes) : ${deletedBarcodes.deletedCount} record(s) deleted.`);

    // Step D: Wallet/Ledger Transactions Delete karein (Ledger Model)
    const deletedLedgers = await Ledger.deleteMany({
      $or: [
        { caseId: { $in: bookingObjectIds } },
        { userId: targetUser._id, createdAt: { $gte: startOfToday, $lte: currentTime } }
      ]
    });
    console.log(`✅ [4/6] Ledger (Wallet Transactions)  : ${deletedLedgers.deletedCount} record(s) deleted.`);

    // Step E: Customization & PDF Print Settings Delete karein (customization Model)
    const deletedCustomizations = await customization.deleteMany({
      $or: [
        { bookingId: { $in: bookingStringIds } },
        { createdBy: targetUser._id, createdAt: { $gte: startOfToday, $lte: currentTime } }
      ]
    });
    console.log(`✅ [5/6] customization (Print Settings): ${deletedCustomizations.deletedCount} record(s) deleted.`);

    // Step F: Test Input Results Values Delete karein (bookedTestsresult Model)
    const deletedTestValues = await bookedTestsresult.deleteMany({
      BookingId: { $in: bookingObjectIds }
    });
    console.log(`✅ [6/6] bookedTestsresult (Test Values): ${deletedTestValues.deletedCount} record(s) deleted.`);

    console.log('\n======================================================');
    console.log('🎉 SUCCESS: Aaj ki saari bookings aur related data live delete ho gaya!');
    console.log('======================================================\n');

  } catch (error) {
    // Agar runtime par koi bhi error aata hain toh use full log karein
    console.error('\n❌ FATAL ERROR DURING DELETION:', error);
  } finally {
    // Database Connection ko disconnect kar rahe hain
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed gracefully.');
  }
}

// Script run kar rahe hain
secureDeleteTodayUserBookings();
