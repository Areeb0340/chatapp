import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    createdOn: { type: Date, default: Date.now }
});

userSchema.index({firstName: 'text', lastName: 'text'});

export const userModel = mongoose.model('Users', userSchema);

const messageSchema = new mongoose.Schema({
    from: { type: mongoose.ObjectId, ref: 'Users', required: true },
    to: { type: mongoose.ObjectId, ref: 'Users', required: true },
    text: {type: String, required: true},
    imageUrl: {type: String},
    createdOn: { type: Date, default: Date.now },
     deletedBy: [{ type: mongoose.ObjectId, ref: 'Users' }], // jinhone apne liye delete kiya
    isDeletedForEveryone: { type: Boolean, default: false } // sen
});

export const messageModel = mongoose.model('Messages', messageSchema);

