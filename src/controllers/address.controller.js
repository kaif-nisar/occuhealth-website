// controllers/addressController.js
import { Address } from '../models/address.model.js';

 const saveAddress = async (req, res) => {
    try {
        // Auth middleware se user data
        const { _id, tenantId } = req.user;

        const {
            firstName,
            lastName,
            address1,
            address2,
            city,
            state,
            pincode,
            country,
            phone,
            email,
            isDefault
        } = req.body;

        // Validate required fields
        if (!firstName || !phone || !pincode) {
            return res.status(400).json({ success: false, message: "First name, phone, and pincode are required." });
        }

        const address = new Address({
            tenantId: tenantId._id,
            createdBy: _id,
            firstName,
            lastName,
            address1,
            address2,
            city,
            state,
            pincode,
            country,
            phone,
            email,
            isDefault
        });

        await address.save();

        return res.status(201).json({
            success: true,
            message: "Address saved successfully.",
            data: address
        });

    } catch (error) {
        console.error("Error saving address:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to save address.",
            error: error.message
        });
    }
};

// controllers/addressController.js

const getAllAddresses = async (req, res) => {
  try {
    const { _id, tenantId } = req.user;

    const addresses = await Address.find({
      createdBy: _id,
      tenantId: tenantId._id
    }).sort({ createdAt: -1 }); // latest address first

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      data: addresses
    });

  } catch (error) {
    console.error("Error fetching addresses:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message
    });
  }
};


export {saveAddress,
    getAllAddresses
}
