
import multer from "multer";
import cloudinary from "./cloudinaryConfig.mjs";
import path from "path";
import 'dotenv/config';
import { CloudinaryStorage } from "multer-storage-cloudinary";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "profile_pics",
      public_id: req.user._id.toString(),   // logged-in user ID as filename
      format: path.extname(file.originalname).slice(1), // jpg/png
    };
  },
});

export const upload = multer({ storage });