import React, { useContext, useEffect, useRef, useState } from "react";
import api from "../component/api";
import { GlobalContext } from "../Context/Context";
import moment from "moment";
import { io } from "socket.io-client";
import { Send, Smile, Video, X } from "lucide-react";
import { AudioRecorder } from "react-audio-voice-recorder";
import EmojiPicker from "emoji-picker-react";
import Lottie from "lottie-react";
import robotAnimation from "./chatbot.json";

const Chat = ({ id, groups, selectedGroup }) => {
  let { state } = useContext(GlobalContext);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [userDetail, setUserDetail] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isGroup, setIsGroup] = useState(false);

  // WebRTC / Socket refs & states
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer }
  const [inCallWith, setInCallWith] = useState(null); // userId of current call peer
  const [isCalling, setIsCalling] = useState(false);
  
const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // Google free STUN

    // ✅ Free TURN server (working)
    {
      urls: "turn:relay1.expressturn.com:3478",
      username: "efree",
      credential: "efree",
    },

    // ✅ Backup TURN server (TCP)
    {
      urls: "turn:turn.anyfirewall.com:443?transport=tcp",
      username: "webrtc@live.com",
      credential: "webrtcdemo",
    },
  ],}
  const getConversation = async () => {
    try {
      let Conversation = await api.get(`/conversation/${id}`);
      setConversations(Conversation.data?.conversation);
    } catch (error) {
      console.log("error", error);
    }
  };

  const getGroupDetail = async () => {
    try {
      let response = await api.get(`/group/${id}`);
      console.log("Group Detail Response:", response.data);
      setUserDetail(response.data?.group);
    } catch (error) {
      console.log("Group detail error", error);
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
    if (!id) return;

    const grp = groups?.find((g) => g._id === id);
    setIsGroup(!!grp);

    if (grp) {
      // Group case
      getGroupDetail();
      api.get(`/group/${id}/messages`).then((res) => {
        setConversations(res.data.messages);
      });
    } else {
      // Personal case
      getUserDetail();
      getConversation();
    }
  }, [id, groups]);

 // -------------------- Socket + WebRTC signaling setup --------------------
  useEffect(() => {
  if (!id) return;

  const socket = io(state.baseSocketIo, { withCredentials: true });
  socketRef.current = socket;

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  // 🔹 Direct message listener
  socket.on(`${id}-${state.user.user_id}`, (data) => {
    console.log("💬 Direct message received:", data);
    if (data.from._id !== state.user.user_id) {
      setConversations((prev) => [...prev, data]);
    }
  });

  // 🔹 Group message listener
  socket.on(`group-${id}-${state.user.user_id}`, (data) => {
    console.log("👥 Group message received:", data);
    if (data.from !== state.user.user_id) {
      setConversations((prev) => [...prev, data]);
    }
  });

  // ===== WebRTC signaling events =====
  socket.on("incoming-call", async ({ from, offer }) => {
    console.log("📞 Incoming call from:", from);
    console.log("📥 Offer received:", offer);
    setIncomingCall({ from, offer });
  });

  socket.on("call-answered", async ({ from, answer }) => {
    console.log("✅ Call answered by:", from);
    console.log("📥 Answer received:", answer);
    try {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("📲 Remote description set successfully (answer)");
        setInCallWith(from);
        setIsCalling(true);
      } else {
        console.warn("⚠️ pcRef.current missing while handling call-answered");
      }
    } catch (err) {
      console.error("❌ Error setting remote desc on answer:", err);
    }
  });

  socket.on("ice-candidate", async ({ from, candidate }) => {
    console.log("🔄 ICE candidate received from:", from, candidate);
    try {
      if (pcRef.current && candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("✅ ICE candidate added to peer connection");
      } else {
        console.warn("⚠️ ICE candidate ignored (no pcRef or candidate missing)");
      }
    } catch (err) {
      console.error("❌ Error adding received ICE candidate:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
    cleanupCall();
  });

  return () => {
    console.log("🧹 Cleaning up socket + peer connection");
    socket.close();
    cleanupCall();
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [id]);

// -------------------- Helper: create RTCPeerConnection --------------------
const createPeerConnection = (remoteUserId) => {
  console.log("⚙️ Creating RTCPeerConnection with remote user:", remoteUserId);

  if (pcRef.current) {
    try {
      pcRef.current.close();
    } catch (e) {}
    pcRef.current = null;
  }

  const pc = new RTCPeerConnection(STUN_SERVERS);
  pcRef.current = pc;

  // Send ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && socketRef.current) {
      console.log("📤 Sending ICE candidate to:", remoteUserId, event.candidate);
      socketRef.current.emit("ice-candidate", {
        from: state.user.user_id,
        to: remoteUserId,
        candidate: event.candidate,
      });
    }
  };

  // Connection state monitoring
  pc.oniceconnectionstatechange = () => {
    console.log("🌐 ICE connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      console.warn("⚠️ ICE connection failed — restarting ICE");
      pc.restartIce();
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("🔗 Peer connection state:", pc.connectionState);
  };

  // Remote track handler
  pc.ontrack = (event) => {
    console.log("📹 Remote track received:", event.streams);
    const [remoteStream] = event.streams || [];
    if (!remoteStream) return;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.autoplay = true;
      remoteVideoRef.current.playsInline = true;
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.onloadedmetadata = async () => {
        try {
          await remoteVideoRef.current.play();
          console.log("✅ Remote video playing");
        } catch (err) {
          console.warn("⚠️ Remote video autoplay blocked:", err);
        }
      };
    }
  };

  return pc;
};

// -------------------- Start Video Call (caller) --------------------
const startVideoCall = async () => {
  if (!id) return;
  try {
    console.log("📞 Starting video call to:", id);
    const socket = socketRef.current;

    // Create peer connection
    const pc = createPeerConnection(id);
    if (!pc) {
      console.error("❌ PeerConnection not created!");
      return;
    }

    // Get local media
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
      console.log("✅ Camera OK:", localStream);
    console.log("🎥 Caller local stream tracks:", localStream.getTracks());
    localStreamRef.current = localStream;

    // Attach local preview
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      await localVideoRef.current.play().catch((err) =>
        console.warn("⚠️ Local video autoplay blocked:", err)
      );
      console.log("✅ Local stream attached to localVideoRef (caller)");
    }

    // Add local tracks
    localStream.getTracks().forEach((track) => {
      console.log("➕ Adding local track (caller):", track.kind);
      pc.addTrack(track, localStream);
    });

    setIsCalling(true);
    setInCallWith(id);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("📤 Offer created & local description set");

    socket.emit("call-user", {
      from: state.user.user_id,
      to: id,
      offer,
    });
    console.log("📤 Call-user event emitted:", { from: state.user.user_id, to: id });
  } catch (err) {
    console.error("❌ startVideoCall error:", err);
    cleanupCall();
  }
};

// -------------------- Accept incoming call (callee) --------------------
const acceptCall = async () => {
  if (!incomingCall) return;
  const { from, offer } = incomingCall;

  try {
    console.log("📞 Accepting call from:", from);
    const socket = socketRef.current;
    const pc = createPeerConnection(from);

    // Set remote description (offer)
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("✅ Remote description set (offer)");

    // Get local media
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    
    
    console.log("🎥 Callee local stream tracks:", localStream.getTracks());
    localStreamRef.current = localStream;

    // Attach local preview
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.autoplay = true;
      localVideoRef.current.playsInline = true;
      await localVideoRef.current.play().catch((err) =>
        console.warn("⚠️ Local video autoplay blocked:", err)
      );
      console.log("✅ Local stream attached to localVideoRef (callee)");
    }

    // Add local tracks
    localStream.getTracks().forEach((track) => {
      console.log("➕ Adding local track (callee):", track.kind);
      pc.addTrack(track, localStream);
    });

    // Create and send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log("📤 Answer created & local description set");

    socket.emit("answer-call", {
      from: state.user.user_id,
      to: from,
      answer,
    });
    console.log("📤 Answer-call event emitted:", { from: state.user.user_id, to: from });

    setInCallWith(from);
    setIncomingCall(null);
    setIsCalling(true);
  } catch (err) {
    console.error("❌ acceptCall error:", err);
    cleanupCall();
    setIncomingCall(null);
  }
};



  // -------------------- Decline incoming call --------------------
  const declineCall = () => {
    setIncomingCall(null);
  };

  // -------------------- End call & cleanup --------------------
  const endCall = () => {
    cleanupCall();
  };

  const cleanupCall = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (pcRef.current) {
        try {
          pcRef.current.ontrack = null;
          pcRef.current.onicecandidate = null;
          pcRef.current.oniceconnectionstatechange = null;
          pcRef.current.close();
        } catch (e) {}
        pcRef.current = null;
      }
    } catch (e) {
      console.warn("Cleanup error:", e);
    }
    setIsCalling(false);
    setIncomingCall(null);
    setInCallWith(null);
  };

  // -------------------- The rest of existing chat code (send, delete, voice, etc.) --------------------
  const deleteMessageForMe = async (msgId) => {
    try {
      const url = isGroup ? `/group/message/${msgId}/forme` : `/message/${msgId}/forme`;

      await api.delete(url, {
        data: { token: { id: state.user.user_id } },
      });

      setConversations((prev) => prev.filter((m) => m._id !== msgId));
    } catch (error) {
      console.log("Delete for me error", error);
    }
  };

  const deleteMessageForEveryone = async (msgId) => {
    try {
      const url = isGroup ? `/group/message/${msgId}/foreveryone` : `/message/${msgId}/foreveryone`;

      await api.delete(url, {
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
      let res;
      if (isGroup) {
        res = await api.post(`/group/${id}/message`, {
          from: state.user.user_id,
          text: message,
        });
      } else {
        res = await api.post(`/chat/${id}`, { message });
        setConversations((prev) => [...prev, res.data.chat]);
      }
      setMessage("");
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

      let res;
      if (isGroup) {
        res = await api.post(`/group/${id}/voice`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post(`/chat/${id}/voice`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setConversations((prev) => [...prev, res.data.chat]);
      setVoiceBlob(null);
    } catch (error) {
      console.log("Voice send error", error);
    }
  };

  // emoji picker close on outside click
  useEffect(() => {
    const handleClick = () => setShowEmojiPicker(false);
    if (showEmojiPicker) {
      window.addEventListener("click", handleClick);
    }
    return () => window.removeEventListener("click", handleClick);
  }, [showEmojiPicker]);

if (!id) {
  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Left message */}
      <div className="flex-1 bg-[#36393f] flex items-center justify-center text-gray-400 text-center p-4">
        <p>Select a user to start chat 💬</p>
      </div>

      {/* Robot animation */}
      <div className="flex justify-center items-center h-full w-full bg-black">
        <Lottie
          animationData={robotAnimation}
          loop={true}
          className="w-[250px] h-[250px] md:w-[600px] md:h-[600px] object-cover"
        />
      </div>
    </div>
  );
}

return (
  <div className="flex flex-col h-screen bg-gray-900 text-white relative">
    {/* Header */}
    <div className="p-3 md:p-4 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
      <img
        src={
          isGroup
            ? selectedGroup?.groupPic || "/group-icon.png"
            : userDetail?.groupPic || "/0d64989794b1a4c9d89bff571d3d5842.jpg"
        }
        alt="Profile"
        className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-gray-600"
      />
      <h1 className="text-sm md:text-lg font-semibold truncate max-w-[150px] md:max-w-none">
        {isGroup
          ? selectedGroup?.groupName
          : `${userDetail?.firstName || ""} ${userDetail?.lastName || ""}`}
      </h1>

      {/* Call Controls */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={startVideoCall}
          className="p-2 bg-green-600 rounded-lg hover:bg-green-700"
        >
          <Video className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {isCalling && (
          <button
            onClick={endCall}
            className="p-2 bg-red-600 rounded-lg hover:bg-red-700"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </div>
    </div>

    {/* Video Call Overlay */}
    {isCalling && (
  <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
    {/* Remote video */}
    <video
      ref={remoteVideoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover bg-black"
      onLoadedMetadata={(e) => e.target.play().catch(() => {})}
    />

    {/* Local video (small preview) */}
    <div className="absolute top-4 right-4 w-32 h-24 md:w-48 md:h-36 rounded-lg overflow-hidden border-2 border-white">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover bg-black"
        onLoadedMetadata={(e) => e.target.play().catch(() => {})}
      />
    </div>

    {/* End Call button */}
    <button
      onClick={endCall}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 rounded-full text-white text-lg font-semibold hover:bg-red-700 transition"
    >
      End Call
    </button>
  </div>
)}
    {/* Incoming call popup */}
    {incomingCall && !isCalling && (
      <div className="absolute inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-4 md:p-6 rounded-md shadow-lg text-center">
          <p className="mb-3 text-sm md:text-base">
            Incoming call from {incomingCall.from}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={acceptCall}
              className="px-3 py-1 md:px-4 md:py-2 bg-green-600 rounded"
            >
              Accept
            </button>
            <button
              onClick={declineCall}
              className="px-3 py-1 md:px-4 md:py-2 bg-red-600 rounded"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Messages */}
    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
      {conversations?.map((eachMessage, i) => {
        const isMine = eachMessage?.from?._id === state.user.user_id;
        return (
          <div
            key={i}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div className="relative max-w-[80%] sm:max-w-xs md:max-w-md">
              <div
                className={`p-2 md:p-3 rounded-2xl ${
                  isMine
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-700 text-gray-100 rounded-bl-none"
                }`}
              >
                <p className="font-medium text-xs md:text-sm">
                  {eachMessage?.from?.firstName} {eachMessage?.from?.lastName}
                </p>
                {eachMessage?.text && (
                  <p className="mt-1 text-sm">{eachMessage?.text}</p>
                )}
                {eachMessage?.voiceUrl && (
                  <audio
                    controls
                    className="mt-2 w-full"
                    src={`${state.baseFileUrl}${eachMessage.voiceUrl}`}
                  />
                )}
                <span className="text-[10px] md:text-xs text-gray-300 block mt-1">
                  {moment(eachMessage?.createdOn).fromNow()}
                </span>
              </div>

              {/* Menu */}
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
                  <div className="absolute right-0 mt-1 w-32 md:w-40 bg-gray-800 rounded-md shadow-lg z-10 text-sm">
                    <button
                      onClick={() => {
                        deleteMessageForMe(eachMessage._id);
                        setMenuOpen(null);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-gray-700"
                    >
                      Delete for Me
                    </button>
                    {isMine && (
                      <button
                        onClick={() => {
                          deleteMessageForEveryone(eachMessage._id);
                          setMenuOpen(null);
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-700"
                      >
                        Delete for Everyone
                      </button>
                    )}
                    <button
                      onClick={() => {
                        forwardMessage(eachMessage._id);
                        setMenuOpen(null);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-gray-700"
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

    {/* Input Box */}
    <form
      onSubmit={sendMessage}
      className="p-2 md:p-4 bg-gray-800 border-t border-gray-700 flex gap-2 items-center relative"
      onClick={(e) => e.stopPropagation()}
    >
      {!voiceBlob ? (
        <AudioRecorder
          onRecordingComplete={(blob) => setVoiceBlob(blob)}
          audioTrackConstraints={{ noiseSuppression: true, echoCancellation: true }}
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
            <Send className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </button>
          <button
            type="button"
            onClick={() => setVoiceBlob(null)}
            className="text-red-400 text-xs md:text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write your message..."
        className="flex-1 resize-none rounded-lg p-2 bg-gray-700 text-white text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={1}
      />

      <button
        type="submit"
        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center"
      >
        <Send className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowEmojiPicker(!showEmojiPicker);
        }}
        className="p-2 text-gray-300 hover:text-white"
      >
        <Smile className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {showEmojiPicker && (
        <div
          className="absolute bottom-14 right-2 md:bottom-16 md:right-4 bg-gray-800 rounded-lg shadow-lg z-50"
          onClick={(e) => e.stopPropagation()}
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
