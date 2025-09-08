import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    createdOn: { type: Date, default: Date.now },
      profilePic: { type: String} ,
      
});




userSchema.index({ firstName: 'text', lastName: 'text' });

export const userModel = mongoose.model('Users', userSchema);

const messageSchema = new mongoose.Schema({
    from: { type: mongoose.ObjectId, ref: 'Users', required: true },
    to: { type: mongoose.ObjectId, ref: 'Users', required: true },

    // ab text optional kar diya
    text: { type: String, required: false },

    imageUrl: { type: String },
    voiceUrl: { type: String }, // voice message k liye

    createdOn: { type: Date, default: Date.now },
    deletedBy: [{ type: mongoose.ObjectId, ref: 'Users' }], // jinhone apne liye delete kiya
    isDeletedForEveryone: { type: Boolean, default: false } // sab ke liye delete
});

export const messageModel = mongoose.model('Messages', messageSchema);

// Group Schema
const groupSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  isGroup: { type: Boolean, default: true },
  createdOn: { type: Date, default: Date.now },
});

// Group Messages
const groupMessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Groups', required: true },
  text: { type: String, required: false },
  imageUrl: { type: String },
  voiceUrl: { type: String },
  createdOn: { type: Date, default: Date.now },
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }],
  isDeletedForEveryone: { type: Boolean, default: false },
});

export const groupModel = mongoose.model('Groups', groupSchema);
export const groupMessageModel = mongoose.model('GroupMessages', groupMessageSchema);
