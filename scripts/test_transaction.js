import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.model.js';
import { Ledger } from '../src/models/ledger.model.js';

dotenv.config();

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Let's find an admin user and a franchisee user
    const admin = await User.findOne({ role: 'admin' }).session(session);
    const franchisee = await User.findOne({ role: 'franchisee' }).session(session);

    if (!admin) {
      console.log('No admin user found!');
      return;
    }
    if (!franchisee) {
      console.log('No franchisee user found!');
      return;
    }

    console.log(`Found Admin: ${admin.username} (Wallet: ${admin.bookingWallet})`);
    console.log(`Found Franchisee: ${franchisee.username} (Wallet: ${franchisee.bookingWallet})`);

    const parsedAmount = 10;
    const adminNewBalance = admin.bookingWallet - parsedAmount;
    const franchiseeNewBalance = franchisee.bookingWallet + parsedAmount;

    console.log('Updating wallets...');
    admin.bookingWallet = adminNewBalance;
    franchisee.bookingWallet = franchiseeNewBalance;

    console.log('Saving admin...');
    await admin.save({ session });
    console.log('Saving franchisee...');
    await franchisee.save({ session });

    console.log('Saving ledger entries...');
    const transactionNumber = '#CRTEST' + Date.now();

    const adminLedgerEntry = new Ledger({
      userId: admin._id,
      username: admin.username,
      amount: parsedAmount,
      type: "debit",
      description: `Amount assigned to Franchisee: ${franchisee.fullName || franchisee.username}`,
      balanceAfterTransaction: adminNewBalance,
      transactionId: transactionNumber,
      remarks: `Amount assignment to franchisee`,
      receivedBy: franchisee.username,
      assignedTo: franchisee._id,
      transactionType: "wallet_assignment"
    });

    await adminLedgerEntry.save({ session });

    const franchiseeLedgerEntry = new Ledger({
      userId: franchisee._id,
      username: franchisee.username,
      amount: parsedAmount,
      type: "credit",
      description: `Amount received from Admin: ${admin.fullName || admin.username}`,
      balanceAfterTransaction: franchiseeNewBalance,
      transactionId: transactionNumber,
      remarks: `Amount received from admin`,
      receivedFrom: admin.username,
      assignedBy: admin._id,
      transactionType: "wallet_assignment"
    });

    await franchiseeLedgerEntry.save({ session });

    console.log('Simulating staff log push...');
    // Simulate req.user being staff
    const staff = await User.findOne({ role: 'staff' }).session(session);
    if (staff) {
      console.log(`Found staff: ${staff.username}. Testing activity log update...`);
      await User.findByIdAndUpdate(
        staff._id,
        {
          $push: {
            activities: {
              activityType: "payment",
              details: {
                staffId: staff._id,
                staffName: staff.fullName || staff.username,
                action: "Amount assigned to Franchisee",
                franchiseeName: franchisee.fullName || franchisee.username,
                franchiseeId: franchisee._id,
                amount: parsedAmount,
                transactionId: transactionNumber
              },
              reference: {
                model: "User",
                id: franchisee._id
              },
              timestamp: new Date()
            }
          }
        },
        { session }
      );
      console.log('Activity log update successful.');
    }

    console.log('Transaction succeeded in simulation!');
  } catch (error) {
    console.error('ERROR ENCOUNTERED:', error);
  } finally {
    console.log('Aborting transaction to rollback changes...');
    await session.abortTransaction();
    session.endSession();
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
