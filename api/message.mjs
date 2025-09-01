import express from "express";
import { messageModel } from "../model.mjs";
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
  return router;

}
 
