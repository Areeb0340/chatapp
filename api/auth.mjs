// auth.mjs
import express from 'express';
import { userModel } from '../model.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import multer from "multer";
import path from "path";
import fs from "fs";

const SECRET = process.env.SECRET_TOKEN;
const router = express.Router();




// ---------------- SIGN-UP ----------------
router.post("/sign-up", async (req,res) => {
  const { firstName, lastName, email, password } = req.body;
  if(!firstName || !lastName || !email || !password){
    return res.status(400).send({message:"Required parameter missing"});
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if(user) return res.status(400).send({message:"User already exists"});
    
    await userModel.create({
      firstName, lastName,
      email: email.toLowerCase(),
      password: hash
    });
    res.status(201).send({message:"User created"});
  } catch (err) {
    console.log(err);
    res.status(500).send({message:"Internal server error"});
  }
});

// ---------------- LOGIN ----------------
router.post('/login', async(req,res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).send({message:"Required parameter missing"});
  
  try {
    const user = await userModel.findOne({email: email.toLowerCase()});
    if(!user) return res.status(400).send({message:"User not found"});
    const isMatched = await bcrypt.compare(password, user.password);
    if(!isMatched) return res.status(401).send({message:"Password incorrect"});
    
    const token = jwt.sign({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePic: user.profilePic, 
      iat: Math.floor(Date.now()/1000),
      exp: Math.floor(Date.now()/1000) + (60*60*24)
    }, SECRET);

    res.cookie('Token', token, {
      maxAge: 86400000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });
    
    res.status(200).send({
      message:"User Logged in",
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, profilePic: user.profilePic}
    });
  } catch(err) {
    console.log(err);
    res.status(500).send({message:"Internal server error"});
  }
});

router.get('/logout', (req, res) => {
  res.cookie('Token', '', {
      maxAge: 1,
      httpOnly: true,
      secure: true
    });
  res.status(200).send({message: "User Logout"})
})


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile");
  },
  filename: (req, file, cb) => {
    // Use userId from request body if available, else timestamp
    const userId =  Date.now() + path.extname(file.originalname);
    const filename = `${userId}${ext}`;
    cb(null, userId);
  }
});
export const upload = multer({ storage });
// ---------------- UPLOAD PROFILE ----------------
router.post("/upload-profile", upload.single("profilePic"), async (req, res) => {
  try {
    console.log("Upload request body:", req.body);
    console.log("Upload request file:", req.file);
    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }

    const userId = req.body.id; // 👈 userId ki jagah email use karenge
    if (!userId) {
      return res.status(400).send({ message: "Email missing" });
    }

    const imageUrl = `/uploads/profile/${req.file.filename}`;

    // email ke basis pe user update karo
    const user = await userModel.findOneAndUpdate(
      { email: email.toLowerCase() },
      { profilePic: imageUrl },
      { new: true } // 👈 updated user return karega
    );

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send({
      message: "Profile picture uploaded",
      imageUrl:`/uploads/profile/${req.file.filename}`,
      profilePic: user.profilePic, // 👈 frontend update ke liye
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Internal server error" });
  }
});


// ---------------- REMOVE PROFILE ----------------
router.delete("/remove-profile", async (req,res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: "Email missing" });

    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user || !user.profilePic) 
      return res.status(400).send({ message:"No profile picture to remove" });

    const filePath = path.join(process.cwd(), user.profilePic);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    user.profilePic = null;
    await user.save();

    res.status(200).send({ message:"Profile picture removed" });
  } catch(err) {
    console.error(err);
    res.status(500).send({message:"Internal server error"});
  }
});

export default router;
