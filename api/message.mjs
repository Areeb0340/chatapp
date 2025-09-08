import express from "express";
import { messageModel,groupModel,groupMessageModel} from "../model.mjs";
import multer from "multer";
// import path from "path";
// import multer from "multer";
import path from "path";



export default function (io) {
  const router = express.Router();

  
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
    
    // sirf sender ko allow karo
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

// Storage config
const storage = multer.diskStorage({
destination: (req, file, cb) => {
  cb(null, "uploads/voices/"); // 👈 new folder
},
filename: (req, file, cb) => {
  const ext = path.extname(file.originalname);
  cb(null, Date.now() + ext);
},
});
const upload = multer({ storage });


router.post("/chat/:id/voice", upload.single("voice"), async (req, res) => {
  let receiverId = req.params.id;
  let senderId = req.body.token.id;

    console.log("FILE:", req.file);
    console.log("BODY:", req.body);

  try {
    const fileUrl = `/uploads/voices/${req.file.filename}`;

    let result = await messageModel.create({
      from: senderId,
      to: receiverId,
      voiceUrl: fileUrl,
    });

    let conversation = await messageModel
      .findById(result._id)
      .populate({ path: "from", select: "firstName lastName email" })
      .populate({ path: "to", select: "firstName lastName email" })
      .exec();

    // send via socket.io
    io.emit(`${senderId}-${receiverId}`, conversation);
    io.emit(`personal-channel-${receiverId}`, conversation);

    res.send({ message: "Voice Message Sent", chat: conversation });
  } catch (error) {
    console.log("Voice error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});



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

      // Socket: emit to all group members
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

  // ------------------ Delete Group Message ------------------
  router.delete("/group/message/:id/forme", async (req, res) => {
    try {
      const msgId = req.params.id;
      const userId = req.body.token.id;

      const msg = await groupMessageModel.findById(msgId);
      if (!msg) return res.status(404).json({ message: "Message not found" });

      if (!msg.deletedBy.includes(userId)) {
        msg.deletedBy.push(userId);
        await msg.save();
      }

      res.json({ message: "Deleted for you ✅" });
    } catch (err) {
      console.error("Delete group message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.delete("/group/message/:id/foreveryone", async (req, res) => {
    try {
      const msgId = req.params.id;
      const userId = req.body.token.id;

      const msg = await groupMessageModel.findById(msgId);
      if (!msg) return res.status(404).json({ message: "Message not found" });

      if (msg.from.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      msg.isDeletedForEveryone = true;
      await msg.save();

      res.json({ message: "Deleted for everyone ✅" });
    } catch (err) {
      console.error("Delete group message everyone error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  return router;

}
 
