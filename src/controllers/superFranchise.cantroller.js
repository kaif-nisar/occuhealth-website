import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
// import { SuperFranchisee } from "../models/superFranchisee.model.js";
// import { Franchiseedb } from "../models/franchisee.model.js";
import { User } from "../models/user.model.js"
import { Ledger } from "../models/ledger.model.js"
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Tenant } from "../models/tenant.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// fetch data for retrive or update and adit

const superFranchiseeUpdate = asyncHandler(async (req, res) => {
    try {
        const { _id } = req.query;
        const sFranchisee = await User.findOne({ _id });
        // const test = await Testdb.findOne({testName: testName})

        if (!sFranchisee) {
            throw new ApiError(400, "superFranchisee not found")
        }
        res.status(200).json(
            new ApiResponse(201,
                sFranchisee, "superFranchisee found suceessfully")
        )

    } catch (error) {
        throw new ApiError(500, error, "Something went wrong superFranchisee not found")
    }

})

// franchisee update by id 
const sfUpdate = asyncHandler(async (req, res) => {
    let { _id } = req.query;

    const {
        fullName,
        email,
        username,
        password,
        state,
        city,
        district,
        postOffice,
        pinCode,
        address,
        phoneNo,
        isActive,
        clinicName
    } = req.body;

    _id = _id?.trim();

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
        throw new ApiError(400, "Invalid ObjectId format");
    }

    // Check required fields
    if (
        [fullName, email, username, password, phoneNo].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Find the superfranchisee
    const superFranchisee = await User.findById(_id);
    if (!superFranchisee) {
        throw new ApiError(404, "Superfranchisee not found");
    }

    // ✅ NEW: Check for duplicate email, username, and phone (excluding current user)
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();
    const normalizedPhone = phoneNo.toString().trim();
    const superFranchiseePhone = superFranchisee.phoneNo.toString().trim();

    // Check if email already exists (and it's not the current user's email)
    if (normalizedEmail !== superFranchisee.email.toLowerCase()) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        throw new ApiError(400, "Email already registered. Please use a different email.");
      }
    }

    // Check if username already exists (and it's not the current user's username)
    if (normalizedUsername !== superFranchisee.username.toLowerCase()) {
      const existingUsername = await User.findOne({ username: normalizedUsername });
      if (existingUsername) {
        throw new ApiError(400, "Username already taken. Please use a different username.");
      }
    }

    // Check if phone already exists (and it's not the current user's phone)
    if (normalizedPhone !== superFranchiseePhone) {
      const existingPhone = await User.findOne({ phoneNo: normalizedPhone });
      if (existingPhone) {
        throw new ApiError(400, "Phone number already registered. Please use a different phone number.");
      }
    }

    // Prepare object to update
    const updateData = {
        fullName,
        email,
        username,
        password,
        state,
        city,
        district,
        postOffice,
        pinCode,
        address,
        phoneNo,
        isActive,
        clinicName,
        canManageOverdraft: req.body.canManageOverdraft || false
    };

    // Upload files to Cloudinary if present
    if (req.files) {
        if (req.files.logo) {
            const logoResult = await uploadOnCloudinary(req.files.logo[0].path);
            console.log("logoResult:", logoResult);
            
            if (logoResult?.secure_url) {
                const updatedSuperFranchiseetenant = await Tenant.findOneAndUpdate(
                    { "adminDetails.userId": _id.toString() },
                    {
                        logo: logoResult.secure_url,
                        logopublicid: logoResult.public_id
                    },
                    { new: true }
                );
            }
        }

        if (req.files.profileImage) {
            const profileImageResult = await uploadOnCloudinary(req.files.profileImage[0].path);
            if (profileImageResult?.secure_url) {
                updateData.profileimage = profileImageResult.secure_url;
                updateData.profileimagepublicid = profileImageResult.public_id;
            }
        }

        if (req.files.nablLogo) {
            const nablLogoResult = await uploadOnCloudinary(req.files.nablLogo[0].path);
            if (nablLogoResult?.secure_url) {
                updateData.nabllogo = nablLogoResult.secure_url;
                updateData.nabllogopublicid = nablLogoResult.public_id;
            }
        }
    }

    // Update the franchisee
    const updatedSuperFranchisee = await User.findByIdAndUpdate(
        _id,
        updateData,
        { new: true }
    );

    // Update all sub-franchisees created by this superfranchisee
    await User.updateMany(
        { createdBy: _id },
        { $set: { isActive: isActive } }
    );

    if (!updatedSuperFranchisee) {
        throw new ApiError(500, "Something went wrong; franchisee not updated");
    }

    // Return response without sensitive fields
    const createdFranchisee = await User.findById(updatedSuperFranchisee._id)
        .select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, createdFranchisee, "Franchisee updated successfully")
    );
});

//superfranchsiee password update with hashed password
const updatePassword = asyncHandler(async (req, res) => {
    let { _id } = req.query;
    const { password, newPassword } = req.body;
    // Trim any extra spaces from _id
    _id = _id?.trim();
    // Check if the _id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
        throw new ApiError(400, "Invalid ObjectId format");
    }
    // Check required fields
    if (!password) {
        throw new ApiError(400, "Password is required");
    }
    // Find the superfranchisee
    const superFranchisee = await User.findById(_id);
    if (!superFranchisee) {
        throw new ApiError(404, "Superfranchisee not found");
    }
    // Check if the password is correct
    const isValidPassword = await bcrypt.compare(password, superFranchisee.password);
    if (!isValidPassword) {
        throw new ApiError(401, "Incorrect password");
    }
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update the superfranchisee's password
    const updatedSuperFranchisee = await User.findByIdAndUpdate(
        _id,
        {
            password: hashedPassword,
        },
        {
            new: true,
        }
    );
    return res.status(200).json(new ApiResponse(201, { message: "Password updated successfully" }, updatedSuperFranchisee, { success: true }));
});

// Function to send money from SuperFranchisee to Franchisee

function generateTransactionNumber() {
    const prefix = "#CR";
    const timestamp = Date.now().toString(); // Current timestamp as a unique number
    return prefix + timestamp;
}
// Send money from SuperFranchisee to Franchisee

// Send money from Admin to Franchisee
const sendMoneyToFranchisee = asyncHandler(async (req, res) => {
    const { userId, franchiseeId, credits } = req.body;
    const amount = credits;
    const admin = await User.findById(userId);
    const franchisee = await User.findById(franchiseeId);


    if (!admin || !franchisee) {
        return res.status(404).json({ message: 'Admin or Franchisee not found' });
    }

    if (admin.wallet < amount) {
        return res.status(400).json({ message: 'Insufficient admin balance' });
    }

    admin.wallet -= amount;
    franchisee.wallet += amount;

    await admin.save();
    await franchisee.save();

    const transactionNumber = generateTransactionNumber();

    // Create ledger entry for Admin
    await Ledger.create({
        userId: admin._id,
        amount: amount,
        type: 'debit',
        description: `Transferred to Franchisee ID: ${franchisee._id}`,
        balanceAfterTransaction: admin.wallet,
        transactionId: transactionNumber,
        remarks: `Online Payment`,
        username: `${admin.username}/${franchisee.username}`
    });

    // Create ledger entry for Super Franchisee
    await Ledger.create({
        userId: franchisee._id,
        amount: amount,
        type: 'credit',
        description: `Received from Admin ID: ${admin._id}`,
        balanceAfterTransaction: franchisee.wallet,
        transactionId: transactionNumber,
        remarks: `Online Payment`,
        username: `${franchisee.username}/${admin.username}`
    });

    return res.status(200).json({ success: true, wallet: franchisee.wallet });
});

const franchisee = asyncHandler(async (req, res) => {

    const userId = req.query.userId;

    try {
        const franchisees = await User.find({ createdBy: userId })
            .select("-password -refreshToken") // Exclude sensitive info
        if (franchisees.length === 0) {
            return res.status(404).json({ success: false, message: 'No franchisees found' });
        }

        res.status(200).json({ success: true, franchisees });
    } catch (error) {
        console.error('Error fetching franchisees:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export { updatePassword, franchisee, sendMoneyToFranchisee, superFranchiseeUpdate, sfUpdate }