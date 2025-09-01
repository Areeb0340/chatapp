import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router";
import { GlobalContext } from "../Context/Context";
import api from "../component/api";

const Login = () => {
  let { state, dispatch } = useContext(GlobalContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();

  // 👇 Login function
  const loginUser = async (e) => {
    e.preventDefault();
    try {
      let res = await api.post(`/login`, { email, password });
      alert(res.data.message);

      dispatch({ type: "USER_LOGIN", user: res.data.user });

      // Redirect to Home after 1 sec
      setTimeout(() => {
        navigate("/home");
      }, 1000);
    } catch (error) {
      console.log("Error", error);
      alert(error?.response?.data?.message || "Login Failed");
    }
  };

  // 👇 Upload profile picture function
const handleUpload = async () => {
  if (!profilePic) {
    alert("Select a file first!");
    return;
  }

  try {
    setUploading(true);

    const formData = new FormData();
    formData.append("profilePic", profilePic); 
    formData.append("userId", state.user.id);// Multer expects "profilePic"

    // Axios request with credentials
    const res = await api.post("/upload-profile", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      withCredentials: true, // ← ye must hai, warna cookie server ko nahi milegi
    });

    // console.log for debugging
    console.log("Upload Response:", res.data);

    // Update user in global state
    dispatch({
      type: "USER_LOGIN",
      user: { ...state.user, profilePic: res.data.imageUrl },
    });

    alert("Profile picture uploaded ✅");

    // reset file input
    setProfilePic(null);
  } catch (err) {
    console.error("Upload Error:", err.response ? err.response.data : err);
    alert("Failed to upload profile picture ❌");
  } finally {
    setUploading(false);
  }
};


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md p-8 rounded-2xl shadow-xl bg-gray-900 border border-gray-700">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Welcome Back
        </h1>

        {/* 👇 Login Form */}
        <form onSubmit={loginUser} className="space-y-4">
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
            Log In
          </button>
        </form>

        {/* 👇 Profile Upload Section (optional after login) */}
        {state.user && (
          <div className="mt-6 border-t border-gray-600 pt-4">
            <h3 className="text-sm font-semibold mb-2 text-white">
              Upload Profile Picture
            </h3>
            <input
              type="file"
              accept="image/*"
              className="mb-2"
              onChange={(e) => setProfilePic(e.target.files[0])}
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-2 bg-green-600 rounded-md font-semibold hover:bg-green-500 transition"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        )}

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
};

export default Login;
