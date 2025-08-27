import cookieParser from "cookie-parser";
import express from 'express'
// import {db} from "./db.js"
import cors from 'cors'
// import bcrypt from 'bcryptjs';
import jwt from'jsonwebtoken';
import 'dotenv/config';
import mongoose from 'mongoose';
import { userModel } from "./model.mjs";
import authApi from './api/auth.mjs';
import messageApi from './api/message.mjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookie from 'cookie'


const app = express();
const PORT = 5005;
app.use(express.json());
// app.use(bodyParser.json());


const server = createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000", credentials: true, methods: "*"} });
mongoose.connect(process.env.MONGODBURL)
  .then(() => console.log('Connected!')).catch((error)=>console.log('err', error));

app.use(cors({
  origin: "http://localhost:3000", // frontend origin
  credentials: true
}));
app.use(cookieParser());

app.use("/uploads", express.static("uploads"));

const SECRET = process.env.SECRET_TOKEN


app.use('/api/v1/',authApi)

app.use('/api/v1/*splat',(req, res, next)=>{
    if(!req?.cookies?.Token){
        res.status(401).send({message:"unauthorized"})
        return
      }
      
    jwt.verify(req.cookies.Token,SECRET,(err,decodedData)=>{
        if(!err){
            const nowDate = new Date().getTime() / 1000
            if(decodedData.exp < nowDate){
                res.status(401)
                res.cookie('Token', '',{
                  maxAge:1,
                    httpOnly:true,
                    secure:true
                });
                res.send({message:'token expired'})
            }
            else{
                console.log("token approved")
                req.body = {
                    ...req.body,
                    token:decodedData
                }
                next()
            }
        } else{
            res.status({message:"invalid token"})
        }
    })
})


// app.get('/api/v1/users',async(req,res)=>{
// try {
//     let result = await userModel.find({},'firstName lastName email _Id');
//     console.log("result",result)
//     res.status(200).send({message:"user found"})
// } catch (error) {
//    console.log("Error", error)
//         res.status(500).send({message: "Internal Server Error"})
// }
// })

app.get('/api/v1/profile', async(req , res) => {

    let queryUserId;

    if(req.query.user_id){

        queryUserId = req.query.user_id

    }else{

        queryUserId = req.body.token.id

    }

    try {
        let user = await userModel.findById(queryUserId, {password: 0});
        res.send({message: "User Found" , user: {
            user_id: user._id,
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email
        }})
    } catch (error) {
        console.log("Error", error)
        res.status(500).send({message: "Internal Server Error"})
    }
})

app.get('/api/v1/users', async(req, res) => {
    const userName = req.query.user
    try {
        let result
        if(userName){
           result = await userModel.find({$text: {$search: userName}}, {password: 0})
        }else{
            result = await userModel.find({}, {password: 0})
        }
        console.log("Result", result);
        res.status(200).send({message: "user found", users: result})
    } catch (error) {
        console.log("Error", error)
        res.status(500).send({message: "Internal Server Error"})
    }
})


// app.use('/api/v1/',messageApi)

app.use('/api/v1', messageApi(io))

io.on('connection', (socket) => {
    // console.log('a user connected', socket.id);
    console.log(socket?.handshake?.headers?.cookie);
    let userCookie;
    if(socket?.handshake?.headers?.cookie){
        userCookie = cookie.parse(socket?.handshake?.headers?.cookie);
        console.log(userCookie);
    
        if (!userCookie?.Token) {
            socket.disconnect();
        }
    
        jwt.verify(userCookie.Token, SECRET, (err, decodedData) => {
            if (!err) {
                const nowDate = new Date().getTime() / 1000;
    
                if (decodedData.exp < nowDate) {
                    socket.disconnect()
                } else {
    
                }
            } else {
                socket.disconnect()
            }
        });
    }

    socket.on("disconnect", (reason) => {
        console.log("Client disconnected:", socket.id, "Reason:", reason);
    });

});



server.listen(PORT, () => {
    console.log("Server is Running")
})

mongoose.connection.on('connected', function () {//connected
    console.log("Mongoose is connected");
});

mongoose.connection.on('disconnected', function () {//disconnected
    console.log("Mongoose is disconnected");
    process.exit(1);
});

mongoose.connection.on('error', function (err) {//any error
    console.log('Mongoose connection error: ', err);
    process.exit(1);
});

