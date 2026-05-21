import mongoose, { Schema } from "mongoose"

const messageSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId
  },
  bookingId: {
    type: String, // बुकिंग ID, जिससे यह बातचीत संबंधित है
  },
  messages: [
    {
      senderId: { type: mongoose.Schema.Types.ObjectId },
      message: { type: String },
      adminwatched: { type: Boolean, default: false },
      franchiseewatched: { type: Boolean, default: false },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  lastMessage: {
    message: { type: String },
    adminwatched: { type: Boolean, default: false },
    franchiseewatched: { type: Boolean, default: false },
    timestamp: { type: Date },
  },

});

// Conversation Model बनाएं
messageSchema.index({ tenantId: 1, bookingId: 1 });
messageSchema.index({ tenantId: 1, receiverId: 1, "lastMessage.franchiseewatched": 1, "lastMessage.timestamp": -1 });
messageSchema.index({ tenantId: 1, "lastMessage.adminwatched": 1, "lastMessage.timestamp": -1 });
messageSchema.index({ tenantId: 1, createdBy: 1, "lastMessage.timestamp": -1 });

const Conversation = mongoose.model("Conversation", messageSchema);

export { Conversation };
