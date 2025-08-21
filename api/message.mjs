import express from 'express';
import { messageModel } from '../model.mjs';


const router = express.Router();


app.post('/chat/:id',async(req,res)=>{
let receiverId = req.params.id;
let senderId = req.body.token.id;

try {
    let result = await messageModel.create({
        from:senderId,
        to:receiverId,
        text:req.body.message
    })
    res.send({message:"message send"})
} catch (error) {
    res.status(500).send({message:"internal server error"})
}

})

export default router