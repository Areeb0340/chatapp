import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { GlobalContext } from "../Context/Context";
import api from "../component/api";
import Lottie from "lottie-react";
import chatbotAnimation from "./Robot Futuristic Ai animated.json";

const Login = () => {
  const { state, dispatch } = useContext(GlobalContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);
    const [showSplash, setShowSplash] = useState(true);


  const navigate = useNavigate();

  // 👇 Login function
  const loginUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(
        `/login`,
        { email, password },
      
      );
    
      dispatch({ type: "USER_LOGIN", user: res.data.user });
      
      alert(res.data.message);
      setTimeout(() => {
        navigate("/home");
      }, 1000);
    } catch (error) {
      console.log("Error", error);
      alert(error?.response?.data?.message || "Login Failed");
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

  // 🚀 Login Screen
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md p-8 rounded-2xl shadow-xl bg-gray-900 border border-gray-700">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Welcome Back
        </h1>

        <form onSubmit={loginUser} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your email"
              required
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
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition duration-200"
          >
            Log In
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Don’t have an account?{" "}
          <Link
            to={"/sign-up"}
            className="text-indigo-400 hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
