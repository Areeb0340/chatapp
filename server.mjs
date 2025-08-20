import cookieParser from "cookie-parser";
import express from 'express'
// import {db} from "./db.js"
import cors from 'cors'
import bcrypt from 'bcryptjs';
import jwt from'jsonwebtoken';
import 'dotenv/config';
import mongoose from 'mongoose';
import { userModel } from "./model.mjs";


const app = express();
const PORT = 5005;
app.use(express.json());
// app.use(bodyParser.json());


mongoose.connect(process.env.MONGODBURL)
  .then(() => console.log('Connected!')).catch((error)=>console.log('err', error));

app.use(cors({
  origin: "http://localhost:3000", // frontend origin
  credentials: true
}));
app.use(cookieParser());

const SECRET = process.env.SECRET_TOKEN

app.post("/sign-up", async(req,res)=>{

    let reqBody=req.body;
    if(!reqBody.firstName|| !reqBody.lastName||!reqBody.email||!reqBody.password){
        res.status(400).send({message:"require parameter missing"})
        return;
    }
    reqBody.email = reqBody.email.toLowerCase();
    // let query = `SELECT * FROM users WHERE email = $1`
    // let value = [reqBody.email]
    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(reqBody.password, salt);
        const user = await userModel.findOne({email:reqBody.email})
        // console.log("user", user)
        if(!user){


     const result = await  userModel.create({
            firstName:reqBody.firstName,
          lastName:reqBody.lastName,
         email:reqBody.email,
         password:hash
                })
        res.status(201).send({message:"user created"})
        }else{
            res.status(400).send({message:"user already exist with this email"})
        }

       
    } catch (error) {
        console.log(error,"error");
        res.status(500).send({message:"internal server error"})
    }
});



app.post('/login' , async(req , res) => {
    let reqBody = req.body;
    if(!reqBody.email || !reqBody.password){
      res.status(400).send({message: "Required Parameter Missing"})
        return;
    }
    reqBody.email = reqBody.email.toLowerCase();
  
    try {
     const user = await userModel.findOne({email:reqBody.email})
      if(!user){
        res.status(400).send({message:"user not found with this email"})
        return;
      }
        // let user = result.rows[0]
        // console.log("Result" , result.rows);
        let isMatched = await bcrypt.compare(reqBody.password, user.password); // true

        if(!isMatched){
          res.status(401).send({message: "Password did not Matched"});
           return;
        }

        let token = jwt.sign({
            id:user._id,
            firstName: user.firstName,
            last_name:user.lastName,
            email: user.email,
    
            iat: Date.now() / 1000,
            exp: (Date.now() / 1000) + (60*60*24)
        }, SECRET);

        res.cookie('Token', token, {
            maxAge: 86400000, // 1 day
            httpOnly: true,
            secure: true
        });
        res.status(200)
        res.send({message: "User Logged in" , user: {
           id:user._id,
            firstName: user.firstName,
            last_name:user.lastName,
            email: user.email,
            // phone: result.rows[0].phone,
            // user_role: result.rows[0].user_role,
            // profile: result.rows[0].profile,
        }})
        // res.status(200).send({message: "Testing" , result: result.rows, isMatched})

    } catch (error) {
        console.log("Error", error)
        res.status(500).send({message: "Internal Server Error"})
    }
})

// app.use('/*splat',(req, res, next)=>{
//     if(!req?.cookies?.Token){
//         res.status(401).send({message:"unauthorized"})
//         return
//       }
      
//     jwt.verify(req.cookies.Token,SECRET,(err,decodedData)=>{
//         if(!err){
//             const nowDate = new Date().getTime() / 1000
//             if(decodedData.exp < nowDate){
//                 res.status(401)
//                 res.cookie('Token', '',{
//                   maxAge:1,
//                     httpOnly:true,
//                     secure:true
//                 });
//                 res.send({message:'token expired'})
//             }
//             else{
//                 console.log("token approved")
//                 req.body = {
//                     ...req.body,
//                     token:decodedData
//                 }
//                 next()
//             }
//         } else{
//             res.status({message:"invalid token"})
//         }
//     })
// })


app.listen(PORT, () => {
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