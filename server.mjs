import cookieParser from "cookie-parser";
import express from 'express'

import cors from 'cors'

import jwt from'jsonwebtoken';
import 'dotenv/config';
import mongoose from 'mongoose';
import { userModel } from "./model.mjs";
import authApi from './api/auth.mjs';
import messageApi from './api/message.mjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookie from 'cookie'
import path from "path";


const app = express();
const PORT = 5005;
// app.use(bodyParser.json());


const server = createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000", credentials: true, methods: "*"} });
mongoose.connect(process.env.MONGODBURL)
  .then(() => console.log('Connected!')).catch((error)=>console.log('err', error));

  const SECRET = process.env.SECRET_TOKEN
app.use(cors({
  origin: ['http://localhost:3000'], // frontend origin
  credentials: true,
      methods: "*" 
}));
app.use(express.json());
app.use(cookieParser());


app.use('/api/v1/',authApi)
app.use("/uploads", express.static("uploads"));



app.use('/api/v1/*splat',async(req, res, next)=>{
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
                    secure:false,
                     
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

app.get('/api/v1/profile', async (req, res) => {
  let queryUserId;

  if (req.query.user_id) {
    queryUserId = req.query.user_id;
  } else {
    queryUserId = req.body.token.id;  // yaha fix kiya
  }

  try {
    let user = await userModel.findById(queryUserId, { password: 0 });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({
      message: "User Found",
      user: {
        user_id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePic: user.profilePic || null,
      }
    });
  } catch (error) {
    console.log("Error", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


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

const onlineUsers = new Map();

io.on('connection', (socket) => {
    // console.log('a user connected', socket.id);
     console.log("✅ New socket connected:", socket.id);
 
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
                    onlineUsers.set(decodedData.id, socket.id);
          console.log("User registered in socket:", decodedData.id, socket.id);
                }
            } else {
                socket.disconnect()
            }
        });
    }


      // -------------------- 🔥 Calling Events --------------------
  // 📞 Call start
  socket.on("call-user", ({ from, to, offer }) => {
    const targetSocket = onlineUsers.get(to);
      console.log("📞 call-user event:", { from, to, hasTarget: !!targetSocket });
    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", { from, offer });
      console.log(`📞 Call offer from ${from} -> ${to}`);
    }
  });

  socket.on("answer-call", ({ from, to, answer }) => {
    const targetSocket = onlineUsers.get(to);
      console.log("📞 call-user event:", { from, to, hasTarget: !!targetSocket });
    if (targetSocket) {
      io.to(targetSocket).emit("call-answered", { from, answer });
      console.log(`✅ Call answered by ${from} -> ${to}`);
    }
  });

socket.on("ice-candidate", ({ from, to, candidate }) => {
  const targetSocket = onlineUsers.get(to);
  try {
    console.log("📡 ICE candidate event:", { from, to, hasTarget: !!targetSocket });
    if (targetSocket && candidate) {
      io.to(targetSocket).emit("ice-candidate", { from, candidate });
      console.log(`🔄 ICE candidate sent from ${from} to ${to}`);
    }
  } catch (err) {
    console.error("❌ ICE candidate error:", err);
  }
});


  socket.on("disconnect", (reason) => {
    for (let [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    console.log("Client disconnected:", socket.id, "Reason:", reason);
  });
  socket.on("signal", ({ from, to, signal }) => {
      try {
        const targetSocket = onlineUsers.get(to);
        console.log("🔁 signal event:", { from, to, hasTarget: !!targetSocket });
        if (targetSocket) {
          io.to(targetSocket).emit("signal", { from, signal });
          console.log(`🔁 Signal forwarded ${from} -> ${to}`);
        } else {
          console.warn("⚠️ Signal: target not online:", to);
        }
      } catch (err) {
        console.error("❌ Signal forward error:", err);
      }
    });
});

 
const __dirname = path.resolve();
app.use('/', express.static(path.join(__dirname, './frontend/build')))
app.use("/*splat" , express.static(path.join(__dirname, './frontend/build')))



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

