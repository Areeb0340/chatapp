import React, { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../Context/Context';
import api from '../component/api';
import Chat from './chat'; // 👈 Chat ko import karo

const Home = () => {
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null); // 👈 selected user
  let { state } = useContext(GlobalContext);

  const getUsers = async (searchTerm = "") => {
    try {
      let res = await api.get(`/users?user=${searchTerm}`, {
        withCredentials: true
      });
      setIsLoading(false);
      setUsers(res.data.users);
    } catch (error) {
      console.log("Error", error);
    }
  };

  useEffect(() => {
    getUsers();
  }, []);

  const searchUser = (e) => {
    e.preventDefault();
    setIsLoading(true);
    getUsers(user);
  };

  return (
    <div className="flex h-screen bg-[#2f3136] text-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#202225] flex flex-col p-4">
        <h1 className="text-lg font-bold mb-4 text-gray-200">Users</h1>
        <form onSubmit={searchUser} className="flex items-center mb-4">
          <input
            onChange={(e) => setUser(e.target.value)}
            type="text"
            placeholder="Search..."
            className="w-full px-3 py-2 rounded-md bg-[#40444b] text-sm text-white placeholder-gray-400 outline-none"
          />
        </form>
        <div className="overflow-y-auto flex-1 space-y-2">
          {isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : users?.length ? (
            users.map((eachUser, i) => (
              <div
                key={i}
                onClick={() => setSelectedUserId(eachUser?._id)} // 👈 set user
                className={`cursor-pointer block p-3 rounded-lg hover:bg-[#5865f2] transition ${
                  eachUser?._id === state.user.user_id
                    ? "bg-[#3ba55d] text-white"
                    : "bg-[#36393f]"
                }`}
              >
                <h2 className="font-semibold text-sm">
                  {eachUser?.firstName} {eachUser?.lastName}{" "}
                  {eachUser?._id === state.user.user_id ? "(You)" : ""}
                </h2>
                <p className="text-xs text-gray-300">{eachUser?.email}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-400">User Not Found</p>
          )}
        </div>
      </div>

      {/* Right Side Chat */}
      <div className="flex-1">
        <Chat id={selectedUserId} /> {/* 👈 selected user ki chat yaha show hogi */}
      </div>
    </div>
  );
};
export default Home;
