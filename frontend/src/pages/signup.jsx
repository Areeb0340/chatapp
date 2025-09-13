import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import api from "../component/api";
import { GlobalContext } from "../Context/Context";
import Lottie from "lottie-react";
import chatbotAnimation from "./Robot Futuristic Ai animated.json";

const Signup = () => {
  let { state } = useContext(GlobalContext);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  

  const navigate = useNavigate();

  const registerUser = async (e) => {
    e.preventDefault();
    try {
      let res = await api.post(`/sign-up`, {
        firstName,
        lastName,
        email,
        password,
      });
      console.log(res.data);
      alert(res.data.message);
      navigate("/login");
    } catch (error) {
      console.log("Error", error);
      alert(error.response.data.message);
    }
  };
useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 10000); // ⏳ apni animation ki length k hisaab se (4s)
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
     <div className="flex flex-col justify-center items-center h-screen w-full bg-black">
  {/* 👇 Robot Animation */}
  <Lottie
    animationData={chatbotAnimation}
    loop={true}
    className="w-[500px] h-[500px]"
  />

  {/* 👇 WECHAT Logo */}
  <h1 className="text-6xl font-extrabold mt-0 bg-gradient-to-r from-purple-500 via-white to-purple-400 text-transparent bg-clip-text animate-gradient">
    WECHAT!
  </h1>
  {/* 👇 Hy! Welcome Text */}
  <h1 className="text-white text-4xl font-bold animate-bounce mt-4">
    Hy! Welcome
  </h1>

</div>
    );
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md p-8 rounded-2xl shadow-xl bg-gray-900 border border-gray-700">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Create an Account
        </h1>
        <form onSubmit={registerUser} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your first name"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your last name"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition duration-200"
          >
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{" "}
          <Link
            to={"/login"}
            className="text-indigo-400 hover:underline font-medium"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
