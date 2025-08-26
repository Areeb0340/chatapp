// Chat.jsx
import React, { useContext, useEffect, useState } from "react";
import api from "../component/api";
import { GlobalContext } from "../Context/Context";
import moment from "moment";
import { io } from "socket.io-client";

const Chat = ({ id }) => {
  let { state } = useContext(GlobalContext);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [userDetail, setUserDetail] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);

  const getConversation = async () => {
    try {
      let Conversation = await api.get(`/conversation/${id}`);
      setConversations(Conversation.data?.conversation);
    } catch (error) {
      console.log("error", error);
    }
  };

  const getUserDetail = async () => {
    try {
      let response = await api.get(`/profile?user_id=${id}`);
      setUserDetail(response.data?.user);
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    if (id) {
      getConversation();
      getUserDetail();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = io(state.baseSocketIo, { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on(`${id}-${state.user.user_id}`, (data) => {
      setConversations((prev) => [...prev, data]);
    });

    return () => {
      socket.close();
    };
  }, [id]);

  // 🟢 Delete for Me
  const deleteMessageForMe = async (msgId) => {
    try {
      await api.delete(`/message/${msgId}/forme`, {
        data: { token: { id: state.user.user_id } },
      });
      setConversations((prev) => prev.filter((m) => m._id !== msgId));
    } catch (error) {
      console.log("Delete for me error", error);
    }
  };

  // 🟢 Delete for Everyone
  const deleteMessageForEveryone = async (msgId) => {
    try {
      await api.delete(`/message/${msgId}/foreveryone`, {
        data: { token: { id: state.user.user_id } },
      });
      setConversations((prev) => prev.filter((m) => m._id !== msgId));
    } catch (error) {
      console.log("Delete for everyone error", error);
    }
  };

  const forwardMessage = async (msgId) => {
    try {
      await api.post(`/chat/forward`, { msgId, toUserId: id });
      alert("Message forwarded!");
    } catch (error) {
      console.log("Forward error", error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      let res = await api.post(`chat/${id}`, { message });
      setMessage("");
      setConversations((prev) => [...prev, res.data.chat]);
    } catch (error) {
      console.log("Error", error);
    }
  };

  if (!id) {
    return (
      <div className="flex-1 bg-[#36393f] flex items-center justify-center text-gray-400">
        <p>Select a user to start chat 💬</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center">
        <div>
          <h1 className="text-lg font-semibold">
            {userDetail?.first_name} {userDetail?.last_name}
          </h1>
          <p className="text-sm text-gray-400">{userDetail?.email}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversations?.map((eachMessage, i) => {
          const isMine = eachMessage?.from?._id === state.user.user_id;
          return (
            <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="relative">
                <div
                  className={`max-w-xs md:max-w-md p-3 rounded-2xl ${
                    isMine
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-700 text-gray-100 rounded-bl-none"
                  }`}
                >
                  <p className="font-medium text-sm">
                    {eachMessage?.from?.firstName} {eachMessage?.from?.lastName}
                  </p>
                  <p className="mt-1">{eachMessage?.text}</p>
                  <span className="text-xs text-gray-300 block mt-1">
                    {moment(eachMessage?.createdOn).fromNow()}
                  </span>
                </div>

                {/* 3 dots menu */}
                <div className="absolute top-1 right-1">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === eachMessage._id ? null : eachMessage._id)
                    }
                    className="text-gray-300 hover:text-white"
                  >
                    ⋮
                  </button>
                  {menuOpen === eachMessage._id && (
                    <div className="absolute right-0 mt-1 w-40 bg-gray-800 rounded-md shadow-lg z-10">
                      {/* Delete for Me */}
                      <button
                        onClick={() => {
                          deleteMessageForMe(eachMessage._id);
                          setMenuOpen(null);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                      >
                        Delete for Me
                      </button>

                      {/* Delete for Everyone (only sender can see) */}
                      {isMine && (
                        <button
                          onClick={() => {
                            deleteMessageForEveryone(eachMessage._id);
                            setMenuOpen(null);
                          }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                        >
                          Delete for Everyone
                        </button>
                      )}

                      {/* Forward */}
                      <button
                        onClick={() => {
                          forwardMessage(eachMessage._id);
                          setMenuOpen(null);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                      >
                        Forward
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input box */}
      <form
        onSubmit={sendMessage}
        className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
          className="flex-1 resize-none rounded-lg p-2 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
