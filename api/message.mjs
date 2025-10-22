import express from "express";
import { messageModel, groupModel, groupMessageModel, userModel } from "../model.mjs";
import multer from "multer";
import { voiceStorage } from "./cloudinaryConfig.js";

export default function (io) {
  const router = express.Router();

  // Cloudinary upload middleware for voice messages
  const uploadVoice = multer({ 
    storage: voiceStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for voice messages
    },
    fileFilter: (req, file, cb) => {
      // Check if file is audio
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed!'), false);
      }
    }
  });

  // SEND MESSAGE
  router.post("/chat/:id", async (req, res) => {
    let receiverId = req.params.id;
    let senderId = req.body.token.id;
    try {
      let result = await messageModel.create({
        from: senderId,
        to: receiverId,
        text: req.body.message,
      });
      let conversation = await messageModel
        .findById(result._id)
        .populate({ path: "from", select: "firstName lastName email" })
        .populate({ path: "to", select: "firstName lastName email" })
        .exec();

      io.emit(`${senderId}-${receiverId}`, conversation);
      io.emit(`personal-channel-${receiverId}`, conversation);

      res.send({ message: "Message Sent", chat: conversation });
    } catch (error) {
      res.status(500).send({ message: "Internal Server Error" });
    }
  });

  // GET CONVERSATION
  router.get("/conversation/:id", async (req, res) => {
    let receiverId = req.params.id;
    let senderId = req.body.token.id;
    try {
      let conversation = await messageModel
        .find({
          $or: [
            { from: receiverId, to: senderId },
            { from: senderId, to: receiverId },
          ],
        })
        .populate({ path: "from", select: "firstName lastName email" })
        .populate({ path: "to", select: "firstName lastName email" })
        .exec();
      res.send({ message: "Message Found", conversation });
    } catch (error) {
      res.status(500).send({ message: "Internal Server Error" });
    }
  });

  // DELETE MESSAGE
  router.delete("/message/:id/forme", async (req, res) => {
    try {
      const messageId = req.params.id;
      const userId = req.body.token.id;

      let message = await messageModel.findById(messageId);
      if (!message) return res.status(404).json({ error: "Message not found" });

      if (!message.deletedBy.includes(userId)) {
        message.deletedBy.push(userId);
        await message.save();
      }

      res.json({ success: true, message: "Message deleted for you" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  router.delete("/message/:id/foreveryone", async (req, res) => {
    try {
      const messageId = req.params.id;
      const userId = req.body.token.id;

      let message = await messageModel.findById(messageId);
      if (!message) return res.status(404).json({ error: "Message not found" });
      
      if (message.from.toString() !== userId.toString()) {
        return res.status(403).json({ error: "Not authorized" });
      }

      message.isDeletedForEveryone = true;
      await message.save();

      res.json({ success: true, message: "Message deleted for everyone" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  router.post("/message/:id/forward", async (req, res) => {
    try {
      const messageId = req.params.id;
      const forwardTo = req.body.toUserId;
      const senderId = req.body.senderId;
      
      let original = await messageModel.findById(messageId);
      if (!original) {
        return res.status(404).json({ error: "Message not found" });
      }

      let newMessage = await messageModel.create({
        from: senderId,
        to: forwardTo,
        text: `📩 Forwarded: ${original.text}`,
      });
      
      let conversation = await messageModel
      .findById(newMessage._id)
      .populate({ path: "from", select: "firstName lastName email" })
      .populate({ path: "to", select: "firstName lastName email" });
      
      io.emit(`${senderId}-${forwardTo}`, conversation);
      io.emit(`personal-channel-${forwardTo}`, conversation);
      
      res.json({ success: true, message: "Message forwarded", chat: conversation });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ✅ UPDATED: Voice Message with Cloudinary
  router.post("/chat/:id/voice", uploadVoice.single("voice"), async (req, res) => {
    let receiverId = req.params.id;
    let senderId = req.body.token.id;

    console.log("FILE:", req.file);
    console.log("BODY:", req.body);

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No voice file uploaded" });
      }

      // Cloudinary se URL mil jayega
      const voiceUrl = req.file.path;
      const cloudinaryPublicId = req.file.filename;

      let result = await messageModel.create({
        from: senderId,
        to: receiverId,
        voiceUrl: voiceUrl,
        cloudinaryPublicId: cloudinaryPublicId, // Store for future deletion if needed
      });

      let conversation = await messageModel
        .findById(result._id)
        .populate({ path: "from", select: "firstName lastName email" })
        .populate({ path: "to", select: "firstName lastName email" })
        .exec();

      // Send via socket.io
      io.emit(`${senderId}-${receiverId}`, conversation);
      io.emit(`personal-channel-${receiverId}`, conversation);

      res.send({ 
        message: "Voice Message Sent", 
        chat: conversation 
      });
    } catch (error) {
      console.log("Voice error:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  });

  // ✅ UPDATED: Group Voice Message with Cloudinary
  router.post("/group/:groupId/voice", uploadVoice.single("voice"), async (req, res) => {
    try {
      const { groupId } = req.params;
      const senderId = req.body.token.id;

      if (!req.file) {
        return res.status(400).json({ message: "No voice file uploaded" });
      }

      // Cloudinary se URL
      const voiceUrl = req.file.path;
      const cloudinaryPublicId = req.file.filename;

      const msg = await groupMessageModel.create({
        from: senderId,
        group: groupId,
        voiceUrl: voiceUrl,
        cloudinaryPublicId: cloudinaryPublicId,
      });

      const populatedMsg = await groupMessageModel
        .findById(msg._id)
        .populate("from", "firstName lastName profilePic")
        .populate("group", "groupName members admin");

      // Emit to all group members
      const group = await groupModel.findById(groupId);
      group.members.forEach((memberId) => {
        io.emit(`group-${groupId}-${memberId}`, populatedMsg);
      });

      res.json({ message: "Voice message sent ✅", chat: populatedMsg });
    } catch (err) {
      console.log("Group voice send error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ✅ NEW: Delete voice message from Cloudinary (optional)
  router.delete("/message/:id/voice", async (req, res) => {
    try {
      const messageId = req.params.id;
      const userId = req.body.token.id;

      const message = await messageModel.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check permission
      if (message.from.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Delete from Cloudinary if public_id exists
      if (message.cloudinaryPublicId) {
        const { cloudinary } = await import('./cloudinaryConfig.js');
        await cloudinary.uploader.destroy(message.cloudinaryPublicId, {
          resource_type: 'video' // audio files are treated as video in Cloudinary
        });
      }

      // Delete from database
      await messageModel.findByIdAndDelete(messageId);

      res.json({ message: "Voice message deleted ✅" });
    } catch (err) {
      console.error("Delete voice message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ... (Rest of your group routes remain the same)

  router.post("/group/create", async (req, res) => {
    try {
      const { groupName, members, adminId } = req.body;
      if (!groupName || !members || !adminId) {
        return res.status(400).json({ message: "Missing parameters" });
      }

      const group = await groupModel.create({
        groupName,
        members,
        admin: adminId,
        isGroup: true,
      });

      res.status(201).json({ message: "Group created ✅", group });
    } catch (err) {
      console.error("Group create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------ Get Groups for a User ------------------
  router.get("/groups/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const groups = await groupModel
        .find({ members: userId })
        .populate("members", "firstName lastName profilePic")
        .populate("admin", "firstName lastName profilePic")
        .exec();
      res.json({ message: "Groups fetched ✅", groups });
    } catch (err) {
      console.error("Get groups error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------ Send Group Message ------------------
  router.post("/group/:groupId/message", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { from, text } = req.body;

      if (!groupId || !from) return res.status(400).json({ message: "Missing params" });

      const msg = await groupMessageModel.create({
        from,
        group: groupId,
        text,
      });

      const populatedMsg = await groupMessageModel
        .findById(msg._id)
        .populate("from", "firstName lastName profilePic")
        .populate("group", "groupName members admin")
        .exec();

      const group = await groupModel.findById(groupId);
      group.members.forEach((memberId) => {
        io.emit(`group-${groupId}-${memberId}`, populatedMsg);
      });

      res.json({ message: "Message sent ✅", chat: populatedMsg });
    } catch (err) {
      console.error("Send group message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------ Get Group Messages ------------------
  router.get("/group/:groupId/messages", async (req, res) => {
    try {
      const { groupId } = req.params;

      const messages = await groupMessageModel
        .find({ group: groupId })
        .populate("from", "firstName lastName profilePic")
        .populate("group", "groupName")
        .exec();

      res.json({ message: "Messages fetched ✅", messages });
    } catch (err) {
      console.error("Get group messages error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ------------------ Get Single Group Detail ------------------
  router.get("/group/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const group = await groupModel
        .findById(id)
        .populate("members", "firstName lastName profilePic")
        .populate("admin", "firstName lastName profilePic");

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json({
        message: "Group fetched ✅",
        group: {
          group_id: group._id,
          groupName: group.groupName,
          members: group.members,
          admin: group.admin,
          profilePic: group.profilePic || null,
        },
      });
    } catch (err) {
      console.error("Get group detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ... (Rest of your existing group routes)

  return router;
}