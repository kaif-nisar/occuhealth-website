import { Conversation } from "../models/message.model.js";
import { newBooking } from "../models/NewBooking.model.js";

const NOTIFICATION_BOOKING_PROJECTION = [
  "bookingId",
  "patientName",
  "patientPhone",
  "doctorName",
  "status",
  "date",
  "total",
  "createdBy",
  "createdbyuser",
  "courierName",
  "courierId",
  "file",
  "clinicalHistory",
  "year",
  "gender"
].join(" ");

const saveConversation = async (req, res) => {
  try {
    const { senderId, receiverId, bookingId, message } = req.body;
    const tenantId = req.user.tenantId;
    const createdBy = req.user._id;
    const role = req.user.role;

    console.log("tenantId in saveConversation:", tenantId._id);
    console.log("createdBy in saveConversation:", createdBy);

    // Validate required fields
    if (!bookingId || !message || !tenantId || !createdBy) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    // Find if a conversation already exists
    let conversation = await Conversation.findOne({
      tenantId: tenantId._id,
      bookingId,
    });

    if (!conversation) {
      // Create a new conversation if none exists
      conversation = new Conversation({
        senderId,
        receiverId,
        bookingId,
        tenantId: tenantId?._id,
        createdBy: createdBy,
        messages: [{
          senderId,
          message,  // The message is added as a string
          adminwatched: role === "admin" ? true : false,
          franchiseewatched: role === "admin" ? false : true,
          timestamp: new Date(),
        }],
        lastMessage: {
          message,  // The lastMessage is also added as a string
          adminwatched: role === "admin" ? true : false,
          franchiseewatched: role === "admin" ? false : true,
          timestamp: new Date(),
        },
      });
    } else {
      // Add the new message to existing conversation
      const newMessage = {
        senderId,
        message,  // Ensure the message is a string
        adminwatched: role === "admin" ? true : false,
        franchiseewatched: role === "admin" ? false : true,
        timestamp: new Date(),
      };

      conversation.messages.push(newMessage);
      conversation.lastMessage = {
        message,  // Ensure lastMessage is a string
        adminwatched: role === "admin" ? true : false,
        franchiseewatched: role === "admin" ? false : true,
        timestamp: new Date(),
      };
    }

    // Save the conversation to the database
    await conversation.save();

    // Return the conversation or last message to the client
    res.status(200).json({
      send: true,
      conversation: conversation,  // Return conversation data for UI
    });
  } catch (error) {
    console.error("Error saving conversation:", error);
    res.status(500).json({ error: "An error occurred while saving the conversation." });
  }
};

const getConversationByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.body; // bookingId ko params se la rahe hain
    const tenantId = req.user.tenantId._id;

    // Validate bookingId
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required." });
    }

    // Find the conversation by bookingId
    const conversation = await Conversation.findOne({ bookingId, tenantId });

    // If conversation is not found
    if (!conversation) {
      return res.status(200).json({ message: "Conversation not found for this booking ID.", status: "empty" });
    }

    // Return the conversation data
    res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "An error occurred while fetching the conversation." });
  }
};

function isAdminNotificationViewer(role) {
  return role === "admin" || role === "staff";
}

async function enrichNotifications(conversations, { tenantId, role, userId }) {
  const adminViewer = isAdminNotificationViewer(role);
  const bookingIds = [...new Set(conversations.map((conv) => conv.bookingId).filter(Boolean))];

  const bookingQuery = adminViewer
    ? { tenantId, bookingId: { $in: bookingIds } }
    : { tenantId, createdBy: userId, bookingId: { $in: bookingIds } };

  const relatedBookings = bookingIds.length > 0
    ? await newBooking.find(bookingQuery)
      .select(NOTIFICATION_BOOKING_PROJECTION)
      .populate("createdBy", "fullName username role")
      .lean()
    : [];

  const bookingMap = new Map(
    relatedBookings.map((booking) => [booking.bookingId, booking])
  );

  return conversations.map((conv) => ({
    ...conv,
    relatedbooking: bookingMap.get(conv.bookingId) || null,
    isRead: adminViewer
      ? Boolean(conv.lastMessage?.adminwatched)
      : Boolean(conv.lastMessage?.franchiseewatched),
    readStatus: adminViewer
      ? (conv.lastMessage?.adminwatched ? "Read" : "Unread")
      : (conv.lastMessage?.franchiseewatched ? "Read" : "Unread"),
    timestamp: conv.lastMessage?.timestamp || null
  }));
}

const getnewnotificationforadmin = async (req, res) => {
  try {
    const role = req.user.role;
    const tenantId = req.user.tenantId._id;

    if (!isAdminNotificationViewer(role)) {
      console.log("role is not the admin or staff");
      return res.status(403).json({ message: "Unauthorized", status: "failed" });
    }

    const notseenconversation = await Conversation.find({
      tenantId,
      "lastMessage.adminwatched": false
    })
      .select("bookingId createdBy receiverId lastMessage updatedAt")
      .populate("createdBy", "fullName username role")
      .sort({ "lastMessage.timestamp": -1, updatedAt: -1 })
      .lean();

    if (notseenconversation.length === 0) {
      console.log("no message for admin");
      return res.status(200).json({ message: "no messages for admin", status: "empty" });
    }

    const enrichedConversations = await enrichNotifications(notseenconversation, {
      tenantId,
      role,
      userId: req.user._id
    });

    return res.status(200).json(enrichedConversations);
  } catch (error) {
    console.error("Error fetching admin notifications:", error);
    return res.status(500).json({ error: "An error occurred while fetching notifications." });
  }
};

const getnewnotificationforfranshisee = async (req, res) => {
  try {
    const role = req.user.role;
    const tenantId = req.user.tenantId._id;
    const userId = req.user._id;

    if (role === "admin") {
      console.log("role is not match any to franchisee");
      return res.status(403).json({ message: "Unauthorized for franchisee notifications" });
    }

    const notseenconversation = await Conversation.find({
      tenantId,
      receiverId: userId,
      "lastMessage.franchiseewatched": false
    })
      .select("bookingId createdBy receiverId lastMessage updatedAt")
      .sort({ "lastMessage.timestamp": -1, updatedAt: -1 })
      .lean();

    if (notseenconversation.length === 0) {
      console.log("no message for franchisee");
      return res.status(200).json({ message: "no messages for franchisee", status: "empty" });
    }

    const enrichedConversations = await enrichNotifications(notseenconversation, {
      tenantId,
      role,
      userId
    });

    return res.status(200).json(enrichedConversations);
  } catch (error) {
    console.error("Error fetching franchisee notifications:", error);
    return res.status(500).json({ error: "An error occurred while fetching notifications." });
  }
};

const getAllNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    const tenantId = req.user.tenantId._id;
    const userId = req.user._id;
    const adminViewer = isAdminNotificationViewer(role);

    const query = adminViewer
      ? { tenantId }
      : { tenantId, receiverId: userId };

    let conversationQuery = Conversation.find(query)
      .select("bookingId createdBy receiverId lastMessage updatedAt")
      .sort({ "lastMessage.timestamp": -1, updatedAt: -1 });

    if (adminViewer) {
      conversationQuery = conversationQuery.populate("createdBy", "fullName username role");
    }

    const [conversations, unreadCount] = await Promise.all([
      conversationQuery.lean(),
      Conversation.countDocuments(
        adminViewer
          ? { ...query, "lastMessage.adminwatched": false }
          : { ...query, "lastMessage.franchiseewatched": false }
      )
    ]);

    if (conversations.length === 0) {
      return res.status(200).json({ notifications: [], unreadCount: 0, total: 0 });
    }

    const notifications = await enrichNotifications(conversations, {
      tenantId,
      role,
      userId
    });

    return res.status(200).json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error("Error fetching all notifications:", error);
    return res.status(500).json({ error: "An error occurred while fetching notifications." });
  }
};

const changewatchedstatus = async (req, res) => {
  try {
    const role = req.user.role;
    const docId = req.params.docId;
    const tenantId = req.user.tenantId._id;
    const isAdminViewer = isAdminNotificationViewer(role);

    const filter = isAdminViewer
      ? { _id: docId, tenantId, "lastMessage.adminwatched": false }
      : { _id: docId, tenantId, receiverId: req.user._id, "lastMessage.franchiseewatched": false };

    const edition = isAdminViewer
      ? { $set: { "lastMessage.adminwatched": true } }
      : { $set: { "lastMessage.franchiseewatched": true } };

    const changedDoc = await Conversation.updateOne(filter, edition);

    if (!changedDoc.matchedCount) {
      return res.status(401).json({ message: "! conversation not updated" });
    }

    return res.status(200).json({ message: "conversation updated successfully" });
  } catch (error) {
    console.error("Error updating notification status:", error);
    return res.status(500).json({ error: "An error occurred while updating notification status." });
  }
}

export {
  saveConversation, getConversationByBookingId,
  getnewnotificationforadmin, getnewnotificationforfranshisee,
  changewatchedstatus,
  getAllNotifications
};
