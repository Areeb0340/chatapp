import React, { useContext, useEffect, useState } from "react";
import { GlobalContext } from "../Context/Context";
import api from "../component/api";
import Chat from "./chat";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";

const Home = () => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [user, setUser] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupPicModal, setShowGroupPicModal] = useState(false);

  // 🔥 Add Member modal states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMember, setNewMember] = useState("");

  let { state, dispatch } = useContext(GlobalContext);
  const navigate = useNavigate();

  // ---------------- Fetch Users ----------------
  const getUsers = async (searchTerm = "") => {
    try {
      let res = await api.get(`/users?user=${searchTerm}`, {
        withCredentials: true,
      });
      setIsLoading(false);
      setUsers(res.data.users);
    } catch (error) {
      console.log("Error", error);
    }
  };

  // ---------------- Fetch Groups ----------------
  const fetchGroups = async () => {
    try {
      const userId = state.user?.user_id || state.user?._id;
      const res = await api.get(`/groups/${userId}`, { withCredentials: true });
      setGroups(res.data.groups.reverse()); // latest upar
    } catch (err) {
      console.error("Fetch groups error:", err);
    }
  };

  useEffect(() => {
    getUsers();
    fetchGroups();
  }, []);

  // ---------------- Upload Profile Picture ----------------
  const handleUpload = async () => {
    if (!profilePic) return alert("Select a file first!");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", profilePic);
    formData.append("upload_preset", "myuploads");
    formData.append("folder", "profile_pics");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dkynrkofa/image/upload",
        { method: "POST", body: formData }
      );
      const data = await res.json();

      const user_id = state.user?.user_id || state.user?._id;
      if (!user_id) return alert("User not found!");

      await api.post("/upload-profile", {
        profilePic: data.secure_url,
        user_id,
      });

      dispatch({
        type: "USER_LOGIN",
        user: { ...state.user, profilePic: data.secure_url },
      });
      alert("Profile picture uploaded ✅");
      setProfilePic(null);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Upload failed ❌");
    }
    setUploading(false);
  };

  // ---------------- Remove Profile ----------------
  const handleRemove = async () => {
    try {
      const user_id = state.user?.user_id || state.user?._id;
      if (!user_id) return alert("User not found!");
      await api.post("/remove-profile", { user_id });
      dispatch({
        type: "USER_LOGIN",
        user: { ...state.user, profilePic: null },
      });
      alert("Profile picture removed ✅");
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Remove failed ❌");
    }
  };

  // ---------------- Create Group ----------------
  const createGroup = async () => {
    if (!groupName || selectedMembers.length === 0) {
      alert("Group name and members are required!");
      return;
    }
    try {
      const userId = state.user?.user_id || state.user?._id;
      const payload = {
        groupName,
        members: [...selectedMembers, userId],
        adminId: userId,
      };
      const res = await api.post("/group/create", payload, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      alert("Group created ✅");
      setShowGroupModal(false);
      setGroupName("");
      setSelectedMembers([]);
      // ---------------- Add new group on top ----------------
      setGroups((prev) => [res.data.group, ...prev]);
    } catch (err) {
      console.error("Create group error:", err);
      alert("Failed to create group!");
    }
  };

  const handleGroupPicUpload = async (groupId) => {
    if (!profilePic) return alert("Select a file first!");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", profilePic);
    formData.append("upload_preset", "myuploads");
    formData.append("folder", "group_pics");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dkynrkofa/image/upload",
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await res.json();

    await api.post(`/group/${groupId}/upload-pic`, {
      groupPic: data.secure_url,
    });
    fetchGroups(); // refresh groups list
    setUploading(false);
  };

  const handleGroupPicRemove = async (groupId) => {
    await api.post(`/group/${groupId}/remove-pic`);
    fetchGroups();
  };

  // ---------------- Logout ----------------
  const logout = async () => {
    try {
      let res = await api.get(`/logout`, { withCredentials: true });
      alert(res.data.message);
      dispatch({ type: "USER_LOGOUT" });
      navigate("/login");
    } catch (error) {
      console.log(error);
      alert("Logout failed");
    }
  };

  return (
    <div className="flex h-screen bg-[#2f3136] text-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#202225] flex flex-col p-4">
        {/* User Info */}
        <div
          className="flex items-center justify-center mb-6 cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <img
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-600"
            src={state.user?.profilePic || "/default-avatar.png"}
            alt="Profile"
          />
          <h2 className="text-lg font-semibold text-white p-3">
            {state.user?.firstName} {state.user?.lastName}
          </h2>
        </div>

        {showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-96 text-center">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Update Profile Picture</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setProfilePic(e.target.files[0])}
        className="mb-3 block w-full text-sm text-gray-800"
      />

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full py-2 mb-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>

      <button
        onClick={handleRemove}
        className="w-full py-2 mb-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition"
      >
        Remove
      </button>

      <button
        onClick={() => setShowModal(false)}
        className="w-full py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition"
      >
        Close
      </button>
    </div>
  </div>
)}



          <input
            onChange={(e) => setUser(e.target.value)}
            type="text"
            placeholder="Search..."
            className="w-full px-3 py-2 rounded-md bg-[#40444b] text-sm text-white placeholder-gray-400 outline-none"
          />
        {/* Create Group Button */}
        <div
          className="flex items-center gap-2 p-3 rounded-lg hover:bg-[#5865f2] cursor-pointer mt-2"
          onClick={() => setShowGroupModal(true)}
        >
          <PlusCircle className="w-5 h-5 text-white" />
          <span className="text-white font-medium">Create Group</span>
        </div>

        {/* Search Users */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsLoading(true);
            getUsers(user);
          }}
          className="flex items-center mb-4"
        >
          </form>



          {/* Create Group Modal */}
{showGroupModal && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Create Group</h2>

      {/* Group Name */}
      <input
        type="text"
        placeholder="Enter group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg mb-4 text-black"
      />

      {/* Members Selection */}
      <div className="max-h-40 overflow-y-auto mb-4">
        {users.map((u) => (
          <label key={u._id} className="flex items-center gap-2 mb-2 text-black">
            <input
              type="checkbox"
              value={u._id}
              checked={selectedMembers.includes(u._id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedMembers((prev) => [...prev, u._id]);
                } else {
                  setSelectedMembers((prev) => prev.filter((id) => id !== u._id));
                }
              }}
            />
            {u.firstName} {u.lastName}
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowGroupModal(false)}
          className="px-4 py-2 bg-gray-400 text-white rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={createGroup}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Create
        </button>
      </div>
    </div>
  </div>
)}

        {/* Users + Groups List */}
        <div className="overflow-y-auto flex-1 space-y-2">
          {/* Groups */}
          {groups.map((grp) => (
            <div
              key={grp._id}
              onClick={() => setSelectedUserId(grp._id)}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[#5865f2] transition bg-[#36393f]"
            >
              <img
                src={grp.groupPic || "/group-icon.png"}
                alt="Group"
                className="w-10 h-10 rounded-full object-cover border border-gray-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGroup(grp);
                  setShowGroupPicModal(true);
                }}
              />
              <div>
                <h2 className="font-semibold text-sm">{grp.groupName}</h2>
                <p className="text-xs text-gray-300">
                  {grp.members.length} members
                </p>
              </div>
            </div>
          ))}

          {/* Users */}
          {isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : users?.length ? (
            users.map((eachUser) => (
              <div
                key={eachUser._id}
                onClick={() => setSelectedUserId(eachUser._id)}
                className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[#5865f2] transition ${
                  eachUser._id === (state.user?.user_id || state.user?._id)
                    ? "bg-[#3ba55d]"
                    : "bg-[#36393f]"
                }`}
              >
                <img
                  src={
                    eachUser?.profilePic ||
                    "/0d64989794b1a4c9d89bff571d3d5842.jpg"
                  }
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full object-cover border border-gray-500"
                />
                <div>
                  <h2 className="font-semibold text-sm">
                    {eachUser?.firstName} {eachUser?.lastName}{" "}
                    {eachUser?._id ===
                    (state.user?.user_id || state.user?._id)
                      ? "(You)"
                      : ""}
                  </h2>
                  <p className="text-xs text-gray-300">{eachUser?.email}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400">User Not Found</p>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="mt-4 w-full py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition"
        >
          Logout
        </button>
      </div>

      {/* Right Side Chat */}
      <div className="flex-1">
        <Chat
          id={selectedUserId}
          groups={groups}
          selectedGroup={groups.find((g) => g._id === selectedUserId)}
        />
      </div>

      {/* Group Pic + Info Modal */}
      {showGroupPicModal && selectedGroup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96 text-center">
            <h2 className="text-lg font-semibold text-white mb-4">
              Group Info
            </h2>
            <img
              src={selectedGroup.groupPic || "/group-icon.png"}
              alt="Group"
              className="w-24 h-24 mx-auto rounded-full object-cover border mb-4"
            />
            <h3 className="text-xl font-bold text-white mb-2">
              {selectedGroup.groupName}
            </h3>

            {/* Members List */}
            <p className="text-sm text-gray-300 mb-2">
              {selectedGroup.members.length} members
            </p>
            <div className="max-h-32 overflow-y-auto bg-gray-700 p-2 rounded mb-3 text-left">
              {selectedGroup.members.map((m) => (
                <p
                  key={m._id}
                  className={`text-white text-sm ${
                    m._id === selectedGroup.adminId
                      ? "font-bold text-yellow-400"
                      : ""
                  }`}
                >
                  {m.firstName} {m.lastName}{" "}
                  {m._id === (state.user?.user_id || state.user?._id)
                    ? "(You)"
                    : ""}
                  {m._id === selectedGroup.adminId ? " (Admin)" : ""}
                </p>
              ))}
            </div>

            {/* Upload/Remove Group Pic */}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfilePic(e.target.files[0])}
              className="mb-3 block w-full text-sm text-gray-300"
            />
            <button
              onClick={() => handleGroupPicUpload(selectedGroup._id)}
              disabled={uploading}
              className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition mb-2"
            >
              {uploading ? "Uploading..." : "Upload Picture"}
            </button>
            <button
              onClick={() => handleGroupPicRemove(selectedGroup._id)}
              className="w-full py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition mb-2"
            >
              Remove Picture
            </button>

            {/* Add Member Button */}
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="w-full py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition mb-2"
            >
              Add Member
            </button>

            {/* Leave Group */}
            <button
              onClick={async () => {
                try {
                  await api.post(`/group/${selectedGroup._id}/leave`, {
                    userId: state.user?.user_id || state.user?._id,
                  });

                  alert("You left the group ✅");

                  // groups refresh
                  fetchGroups();

                  // agar user isi group ki chat open karke baitha tha → reset chat
                  if (selectedUserId === selectedGroup._id) {
                    setSelectedUserId(null);
                  }

                  setShowGroupPicModal(false);
                } catch (err) {
                  console.error("Leave group error:", err);
                  alert("Failed to leave group ❌");
                }
              }}
              className="w-full py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition mb-2"
            >
              Leave Group
            </button>

            <button
              onClick={() => setShowGroupPicModal(false)}
              className="w-full py-2 rounded-lg bg-gray-500 text-white font-semibold hover:bg-gray-400 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Add Member
            </h2>

            <input
              type="text"
              placeholder="Enter user email"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4 text-black"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.post(`/group/${selectedGroup._id}/add`, {
                      email: newMember, 
                    });

                    alert("Member added successfully ✅");
                    fetchGroups();
                    setShowAddMemberModal(false);
                    setNewMember("");
                  } catch (err) {
                    console.error("Add member error:", err);
                    alert("Failed to add member ❌");
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
