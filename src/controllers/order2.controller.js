import { orders } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Conversation } from "../models/message.model.js";
import { Product } from "../models/product.model.js";
import mongoose from "mongoose";

const updateOrder = async (req, res) => {
    try {
        console.log("🚀 UPDATE ORDER FUNCTION STARTED");
        console.log("📝 Request params:", req.params);
        console.log("📝 Request body:", req.body);
        console.log("👤 Request user:", req.user?._id);
        
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log("❌ Invalid Order ID");
            return res.status(400).json({ success: false, message: "Invalid Order ID" });
        }

        const { orderStatus, courierName, trackingId } = req.body;

        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;

        console.log("🏢 TENANT ID:", tenantId);
        console.log("🔍 Searching for order:", orderId, "with tenantId:", tenantId);

        const order = await orders.findOne({ _id: orderId, tenantId });

        if (!order) {
            console.log("❌ Order not found");
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("✅ Order found:", order._id);

        // Update fields
        if (orderStatus) {
            console.log("📦 Updating status:", orderStatus);
            order.orderStatus = orderStatus;
        }
        if (courierName !== undefined) {
            console.log("🚚 Updating courier:", courierName);
            order.courierName = courierName;
        }
        if (trackingId !== undefined) {
            console.log("🔢 Updating tracking:", trackingId);
            order.trackingId = trackingId;
        }

        // Handle cancelled orders
        if (orderStatus === "cancelled") {
            console.log("💰 Processing refund...");
            const user = await User.findById(order.createdBy);
            if (user) {
                user.wallet = (user.wallet || 0) + Number(order.total || 0);
                await user.save();
                console.log("✅ Wallet updated:", user.wallet);
            }
        }

        await order.save();
        console.log("✅ Order saved successfully");

        res.status(200).json({ 
            success: true, 
            message: "Order updated successfully", 
            data: order 
        });

    } catch (error) {
        console.error("🔥 UPDATE ORDER ERROR:", error);
        console.error("🔥 Error Stack:", error.stack);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

export { updateOrder };