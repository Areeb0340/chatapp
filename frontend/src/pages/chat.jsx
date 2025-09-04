import React, { useContext, useEffect, useState } from "react";
import api from "../component/api";

import moment from "moment";
import { io } from "socket.io-client";
import { Send, Smile } from "lucide-react";
import { AudioRecorder } from "react-audio-voice-recorder";
import EmojiPicker from "emoji-picker-react";
import { GlobalContext } from "../Context/Context";

const Chat = ({ id }) => {
  let { state } = useContext(GlobalContext);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [userDetail, setUserDetail] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);

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

  // 🟢 close emoji picker jab bahar click ho
  useEffect(() => {
    const handleClick = () => setShowEmojiPicker(false);
    if (showEmojiPicker) {
      window.addEventListener("click", handleClick);
    }
    return () => window.removeEventListener("click", handleClick);
  }, [showEmojiPicker]);

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
    if (!message.trim()) return;

    try {
      let res = await api.post(`chat/${id}`, { message });
      setMessage("");
      setConversations((prev) => [...prev, res.data.chat]);
    } catch (error) {
      console.log("Error", error);
    }
  };

  const sendVoiceMessage = async () => {
    if (!voiceBlob) return;

    try {
      const formData = new FormData();
      formData.append("voice", voiceBlob, "voice-message.webm");
      formData.append("token[id]", state.user.user_id);

      let res = await api.post(`/chat/${id}/voice`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setConversations((prev) => [...prev, res.data.chat]);
      setVoiceBlob(null);
    } catch (error) {
      console.log("Voice send error", error);
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
    <div className="flex flex-col h-screen bg-gray-900 text-white relative">
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
            <div
              key={i}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
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

                  {/* Text */}
                  {eachMessage?.text && (
                    <p className="mt-1">{eachMessage?.text}</p>
                  )}

                  {/* Audio */}
                  {eachMessage?.voiceUrl && (
                    <audio
                      controls
                      className="mt-2 w-100"
                      src={`${state.baseFileUrl}${eachMessage.voiceUrl}`}
                    />
                  )}

                  <span className="text-xs text-gray-300 block mt-1">
                    {moment(eachMessage?.createdOn).fromNow()}
                  </span>
                </div>

                {/* 3 dots menu */}
                <div className="absolute top-1 right-1">
                  <button
                    onClick={() =>
                      setMenuOpen(
                        menuOpen === eachMessage._id ? null : eachMessage._id
                      )
                    }
                    className="text-gray-300 hover:text-white"
                  >
                    ⋮
                  </button>
                  {menuOpen === eachMessage._id && (
                    <div className="absolute right-0 mt-1 w-40 bg-gray-800 rounded-md shadow-lg z-10">
                      <button
                        onClick={() => {
                          deleteMessageForMe(eachMessage._id);
                          setMenuOpen(null);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                      >
                        Delete for Me
                      </button>

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
        className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2 items-center relative"
        onClick={(e) => e.stopPropagation()} // form pe click se emoji band na ho
      >
        {/* 🎤 Voice Recorder */}
        {!voiceBlob ? (
          <AudioRecorder
            onRecordingComplete={(blob) => setVoiceBlob(blob)}
            audioTrackConstraints={{
              noiseSuppression: true,
              echoCancellation: true,
            }}
            downloadOnSavePress={false}
            downloadFileExtension="webm"
          />
        ) : (
          <div className="flex items-center gap-2">
            <audio controls src={URL.createObjectURL(voiceBlob)} />
            <button
              type="button"
              onClick={sendVoiceMessage}
              className="p-2 bg-green-600 hover:bg-green-700 rounded-full"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setVoiceBlob(null)}
              className="text-red-400 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
          className="flex-1 resize-none rounded-lg p-2 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>

        {/* 😀 Emoji Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // button click pe close na ho
            setShowEmojiPicker(!showEmojiPicker);
          }}
          className="p-2 text-gray-300 hover:text-white"
        >
          <Smile className="w-6 h-6" />
        </button>

        {/* Emoji Picker Box */}
        {showEmojiPicker && (
          <div
            className="absolute bottom-16 right-4 bg-gray-800 rounded-lg shadow-lg z-50"
            onClick={(e) => e.stopPropagation()} // picker pe click se close na ho
          >
            <EmojiPicker
              onEmojiClick={(emojiData) =>
                setMessage((prev) => prev + emojiData.emoji)
              }
              theme="dark"
            />
          </div>
        )}
      </form>
    </div>
  );
};

export default Chat;
