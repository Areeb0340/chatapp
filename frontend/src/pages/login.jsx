import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router";
import { GlobalContext } from "../Context/Context";
import api from "../component/api";

const Login = () => {
  const { state, dispatch } = useContext(GlobalContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();

  // 👇 Login function
  const loginUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(
        `/login`,
        { email, password },
      
      );
      // ✅ Save user in global state
      dispatch({ type: "USER_LOGIN", user: res.data.user });
      
      alert(res.data.message);
      console.log('state',state.user_id)

      // ✅ Sidha home page pe redirect
      setTimeout(() => {
        navigate("/home");
      }, 1000);
    } catch (error) {
      console.log("Error", error);
      alert(error?.response?.data?.message || "Login Failed");
    }
  };

  // 👇 Upload Profile Picture (Cloudinary)
  const handleUpload = async () => {
    if (!profilePic) {
      alert("Select a file first!");
      return;
    }
    setUploading(true);

    const formData = new FormData();
    formData.append("file", profilePic);
    formData.append("upload_preset", "myuploads"); // 👈 Cloudinary preset
    formData.append("folder", "profile_pics");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dkynrkofa/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      console.log("Cloudinary Upload:", data);
 
      // ✅ Backend ko bhi update kar do (user ke profile me save ho jaye)
      await api.post(
        "/upload-profile",
        { profilePic: data.secure_url,
          userId: state.id,
         },
        { withCredentials: true }
      );

      // ✅ Global state update
      dispatch({
        type: "USER_LOGIN",
        user: { ...state.user, profilePic: data.secure_url },
      });
      

      alert("Profile picture uploaded ✅");
      setProfilePic(null);
    } catch (err) {
      console.error("Cloudinary Error:", err);
      alert("Upload failed ❌");
    }

    setUploading(false);
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

        {/* 👇 Profile Upload Section (only after login) */}
        {state.user && (
          <div className="mt-6 border-t border-gray-600 pt-4">
            <div className="flex justify-center mb-4">
              <img
                src={state.user?.profilePic || "/default-avatar.png"}
                alt="Profile"
                className="w-20 h-20 rounded-full border border-gray-600 object-cover"
              />
            </div>

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
