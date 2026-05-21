import { orders } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Conversation } from "../models/message.model.js";
import { Product } from "../models/product.model.js";

const saveInvoiceOrder = async (req, res) => {
    try {
        const {
            invoiceId,
            date,
            products,
            tax,
            total,
            address,
            orderStatus,
            trackingId,
            courierName,
            message
        } = req.body;

        let amount = Number(total);
        // 🧾 ObjectId ensure
        const tenantId = req.user?.tenantId._id;
        let userId;
        if (req.user.role === 'staff') {
            userId = req.user.parentUser
        } else {
            userId = req.user._id
        }

        const conversationmessage = `New Order from 'franchisee: ${req.user.username}'`;

        const userdoc = await User.findById({
            _id: userId
        })

        if (!userdoc) {
            return res.status(503).json({ message: "something went wrong while fetching user", success: false })
        }

        if (amount > userdoc.wallet) {
            return res.status(403).json({ message: "Insufficiant wallet amount", success: false })
        }

        userdoc.bookingWallet = userdoc.bookingWallet - amount;

        await userdoc.save();

        // 🧾 Deduct stock from each product
        for (const item of products) {
            const productDoc = await Product.findById(item.id);

            if (!productDoc) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item.title}`
                });
            }

            if (productDoc.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for: ${item.title}`
                });
            }

            productDoc.stock -= item.quantity;
            await productDoc.save();
        }

        // Create new order
        const newOrder = new orders({
            invoiceId,
            date,
            products,
            tax,
            total,
            address,
            tenantId,
            createdBy: userId,
            orderStatus,
            trackingId,
            courierName,
            message
        });

        const savedOrder = await newOrder.save();

        // Find if a conversation already exists
        let conversation = await Conversation.findOne({
            tenantId: tenantId,
            createdBy: userId,
            relatedto: "order"
        });

        if (!conversation) {
            // Create a new conversation if none exists
            conversation = new Conversation({
                senderId: userId,
                receiverId: req.user.createdBy._id,
                bookingId: savedOrder._id.toString(),
                tenantId: tenantId,
                createdBy: userId,
                relatedto: "order",
                messages: [{
                    senderId: userId,
                    message: conversationmessage,  // The message is added as a string
                    adminwatched: false,
                    franchiseewatched: true,
                    timestamp: new Date(),
                }],
                lastMessage: {
                    message: conversationmessage,  // The lastMessage is also added as a string
                    adminwatched: false,
                    franchiseewatched: true,
                    timestamp: new Date(),
                },
            });
        } else {
            // Add the new message to existing conversation
            const newMessage = {
                senderId: userId,
                message: conversationmessage,  // Ensure the message is a string
                adminwatched: false,
                franchiseewatched: true,
                timestamp: new Date(),
            };

            conversation.messages.push(newMessage);

            conversation.lastMessage = {
                message: conversationmessage,  // Ensure lastMessage is a string
                adminwatched: false,
                franchiseewatched: true,
                timestamp: new Date(),
            };
        }

        // Save the conversation to the database
        await conversation.save();

        if (!savedOrder) {
            return res.status(400).json({
                success: false,
                message: "Order could not be saved"
            });
        }

        // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "other",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: "staff created a new order",
                            orderId: savedOrder._id,
                            order: `Staff ${req.user.fullName} created a new order with amount ${total}`
                        },
                        reference: {
                            model: "Order",
                            id: savedOrder._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        res.status(201).json({
            success: true,
            message: "Order Created successfully",
            data: savedOrder
        });
    } catch (error) {
        console.error("Error saving order:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to save order",
            error: error.message
        });
    }
};

const fetchAllOrders = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId?._id;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "Tenant ID not found in user object",
            });
        }

        const allOrders = await orders.find({ tenantId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Orders fetched successfully",
            data: allOrders,
        });
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message,
        });
    }
};

const updateOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { orderStatus, courierName, trackingId } = req.body;
        const tenantId = req.user?.tenantId._id;

        if (req.user.role !== "admin") {
            return res.status(503).json({ success: false, message: "Unauthorized request" });
        }
        const order = await orders.findOne({ _id: orderId, tenantId: tenantId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Update fields if they are provided
        if (orderStatus) order.orderStatus = orderStatus;
        if (courierName !== undefined) order.courierName = courierName;
        if (trackingId !== undefined) order.trackingId = trackingId;

        // Refund logic if order is cancelled
        if (orderStatus === "cancelled") {
            const user = await User.findById({
                _id: order.createdBy
            });
            if (user) {
                user.wallet += Number(order.total);
                await user.save();
            }
        }

        await order.save();


         // अगर staff का parentUser है तो उसे भी notify करें
                if (req.user.role === 'staff') {
                    await User.findByIdAndUpdate(req.user._id, {
                        $push: {
                            activities: {
                                activityType: "other",
                                details: {
                                    staffId: req.user._id,
                                    staffName: req.user.fullName,
                                    action: "staff updated an order",
                                    orderId: order._id,
                                    order: `Staff ${req.user.fullName} updated an order with amount ${order.total}`
                                },
                                reference: {
                                    model: "Order",
                                    id: order._id
                                },
                                timestamp: new Date()
                            }
                        }
                    });
                }

        return res.status(200).json({
            success: true,
            message: "Order updated successfully",
            data: order
        });
    } catch (error) {
        console.error("Error updating order:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to update order",
            error: error.message
        });
    }
};


const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const tenantId = req.user?.tenantId?._id;
        const { message } = req.body;

        // 🔍 Find the order belonging to the same tenant and user
        const order = await orders.findOne({
            _id: orderId,
            tenantId: tenantId,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found or access denied",
            });
        }

        if (order.orderStatus === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Order is already cancelled",
            });
        }

        // ✅ Refund wallet amount
        const user = await User.findById({
            _id: order.createdBy
        });

        if (user) {
            user.wallet += Number(order.total);
            await user.save();
        }

        // ✅ Update the order status
        order.orderStatus = "cancelled";
        order.message = message || "";
        await order.save();

         // अगर staff का parentUser है तो उसे भी notify करें
                if (req.user.role === 'staff') {
                    await User.findByIdAndUpdate(req.user._id, {
                        $push: {
                            activities: {
                                activityType: "other",
                                details: {
                                    staffId: req.user._id,
                                    staffName: req.user.fullName,
                                    action: "staff cancelled an order",
                                    orderId: order._id,
                                    order: `Staff ${req.user.fullName} cancelled an order with amount ${order.total}`
                                },
                                reference: {
                                    model: "Order",
                                    id: order._id
                                },
                                timestamp: new Date()
                            }
                        }
                    });
                }

        return res.status(200).json({
            success: true,
            message: "Order cancelled and amount refunded",
            data: order
        });
    } catch (error) {
        console.error("Cancel Order Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel order",
            error: error.message
        });
    }
};

// controllers/order.controller.js

const fetchUserOrders = async (req, res) => {
    try {
        let userId;
        if (req.user.role === 'staff') {
            userId = req.user.parentUser
        } else {
            userId = req.user._id
        }
        const tenantId = req.user.tenantId._id; // JWT middleware se milta hai

        const ordersdoc = await orders.find({
            createdBy: userId,
            tenantId: tenantId
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "User orders fetched successfully",
            data: ordersdoc
        });

    } catch (error) {
        console.error("Error fetching user orders:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
};

export {
    saveInvoiceOrder,
    fetchAllOrders,
    updateOrder,
    cancelOrder,
    fetchUserOrders
}