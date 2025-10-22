// cloudinaryConfig.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage for voice messages
const voiceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat-app/voices',
    resource_type: 'auto',
    allowed_formats: ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'mp4'],
    public_id: (req, file) => {
      return `voice_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    },
  },
});

export { cloudinary, voiceStorage };