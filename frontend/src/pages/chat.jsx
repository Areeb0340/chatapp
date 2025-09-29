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
  const [isCalling, setIsCalling] = useState(false); // whether call UI overlay should show / call ongoing

  const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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

    // create socket once per Chat component mount (will reconnect on id change)
    const socket = io(state.baseSocketIo, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected", socket.id);
    });

    // Chat message listeners (existing)
    socket.on(`${id}-${state.user.user_id}`, (data) => {
      if (data.from._id !== state.user.user_id) {
        setConversations((prev) => [...prev, data]);
      }
    });

    socket.on(`group-${id}-${state.user.user_id}`, (data) => {
      if (data.from !== state.user.user_id) {
        setConversations((prev) => [...prev, data]);
      }
    });

    // ===== WebRTC signaling events =====
    // Incoming offer: somebody is calling you
    socket.on("incoming-call", async ({ from, offer }) => {
      console.log("Incoming call from", from);
      // show UI to accept/decline
      setIncomingCall({ from, offer });
    });

    // When remote answers your offer
    socket.on("call-answered", async ({ from, answer }) => {
      console.log("Call answered by", from);
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setInCallWith(from);
          setIsCalling(true);
        }
      } catch (err) {
        console.error("Error setting remote desc on answer:", err);
      }
    });

    // ICE candidate from remote peer
    socket.on("ice-candidate", async ({ from, candidate }) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding received ICE candidate", err);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      cleanupCall();
    });

    return () => {
      // cleanup socket listeners & peer connection
      socket.close();
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // -------------------- Helper: create RTCPeerConnection --------------------
  const createPeerConnection = (remoteUserId) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    // when local ICE candidate is found, send to remote
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          from: state.user.user_id,
          to: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    // when remote track arrives, show it in remote video
    pc.ontrack = (event) => {
      // multiple streams possible; pick first
      console.log("📹 Remote track received:", event.streams);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return pc;
  };

  // -------------------- Start Video Call (caller) --------------------
  const startVideoCall = async () => {
    if (!id) return;
    try {
      const socket = socketRef.current;
      const pc = createPeerConnection(id);

      // get local media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // show call UI immediately for caller (local preview)
      setIsCalling(true);
      setInCallWith(id);

      // add local tracks to peer
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      // create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // send offer to callee
      socket.emit("call-user", {
        from: state.user.user_id,
        to: id,
        offer,
      });

      // waiting for answer -> handled by "call-answered"
    } catch (err) {
      console.error("startVideoCall error:", err);
      cleanupCall();
    }
  };

  // -------------------- Accept incoming call (callee) --------------------
  const acceptCall = async () => {
    if (!incomingCall) return;
    const { from, offer } = incomingCall;
    try {
      const socket = socketRef.current;
      const pc = createPeerConnection(from);

      // get local media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Callee stream tracks:", localStream.getTracks());
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // show call UI for callee (local preview)
      setIsCalling(true);

      // add tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
        console.log("🎤 Adding local track:", track.kind);
      });

      // set remote description (offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // send answer back
      socket.emit("answer-call", {
        from: state.user.user_id,
        to: from,
        answer,
      });

      setInCallWith(from);
      // setIsCalling(true); already set above
      setIncomingCall(null);
    } catch (err) {
      console.error("acceptCall error:", err);
      cleanupCall();
      setIncomingCall(null);
    }
  };

  // -------------------- Decline incoming call --------------------
  const declineCall = () => {
    // For now just clear incomingCall; if you need notify remote, you can add event.
    setIncomingCall(null);
  };

  // -------------------- End call & cleanup --------------------
  const endCall = () => {
    // notify remote? not implemented on server. just cleanup locally.
    cleanupCall();
  };

  const cleanupCall = () => {
    // stop local tracks
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    } catch (e) {
      console.warn("Error stopping local stream", e);
    }

    // stop remote video element
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // close RTCPeerConnection
    try {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    } catch (e) {
      console.warn("Error closing pc", e);
    }

    setInCallWith(null);
    setIsCalling(false);
    setIncomingCall(null);
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
      <>
        <div className="flex-1 bg-[#36393f] flex items-center justify-center text-gray-400">
          <p>Select a user to start chat 💬</p>
        </div>
        <div className="flex justify-center items-center h-screen w-full bg-black">
          <Lottie animationData={robotAnimation} loop={true} className="w-[800px] h-[800px] object-cover" />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white relative">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
        <img
          src={
            isGroup ? selectedGroup?.groupPic || "/group-icon.png" : userDetail?.groupPic || "/0d64989794b1a4c9d89bff571d3d5842.jpg"
          }
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover border border-gray-600"
        />
        <h1 className="text-lg font-semibold">
          {isGroup ? selectedGroup?.groupName : `${userDetail?.firstName || ""} ${userDetail?.lastName || ""}`}
        </h1>

        {/* Call Controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Video Call */}
          <button onClick={startVideoCall} className="p-2 bg-green-600 rounded-lg hover:bg-green-700">
            <Video className="w-5 h-5" />
          </button>

          {/* End Call (visible while in call) */}
          {isCalling && (
            <button onClick={endCall} className="p-2 bg-red-600 rounded-lg hover:bg-red-700">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Video Call Overlay (WhatsApp-like) */}
     {isCalling && (
  <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
    {/* Remote full screen */}
    <video
      ref={remoteVideoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />

    {/* Local small preview top-right */}
    <div className="absolute top-4 right-4 w-48 h-32 rounded-lg overflow-hidden border-2 border-white">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    </div>

    {/* End Call button */}
    <button
      onClick={endCall}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 rounded-full text-white"
    >
      End Call
    </button>
  </div>
)}

      {/* Incoming call popup (if someone calls you) */}
      {incomingCall && !isCalling && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-md shadow-lg text-center">
            <p className="mb-3">Incoming call from {incomingCall.from}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={acceptCall} className="px-4 py-2 bg-green-600 rounded">Accept</button>
              <button onClick={declineCall} className="px-4 py-2 bg-red-600 rounded">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversations?.map((eachMessage, i) => {
          const isMine = eachMessage?.from?._id === state.user.user_id;
          return (
            <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="relative">
                <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${isMine ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-700 text-gray-100 rounded-bl-none"}`}>
                  <p className="font-medium text-sm">{eachMessage?.from?.firstName} {eachMessage?.from?.lastName}</p>

                  {/* Text */}
                  {eachMessage?.text && <p className="mt-1">{eachMessage?.text}</p>}

                  {/* Audio */}
                  {eachMessage?.voiceUrl && (
                    <audio controls className="mt-2 w-100" src={`${state.baseFileUrl}${eachMessage.voiceUrl}`} />
                  )}

                  <span className="text-xs text-gray-300 block mt-1">{moment(eachMessage?.createdOn).fromNow()}</span>
                </div>

                {/* 3 dots menu */}
                <div className="absolute top-1 right-1">
                  <button
                    onClick={() => setMenuOpen(menuOpen === eachMessage._id ? null : eachMessage._id)}
                    className="text-gray-300 hover:text-white"
                  >
                    ⋮
                  </button>
                  {menuOpen === eachMessage._id && (
                    <div className="absolute right-0 mt-1 w-40 bg-gray-800 rounded-md shadow-lg z-10">
                      <button onClick={() => { deleteMessageForMe(eachMessage._id); setMenuOpen(null); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700">Delete for Me</button>

                      {isMine && (
                        <button onClick={() => { deleteMessageForEveryone(eachMessage._id); setMenuOpen(null); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700">Delete for Everyone</button>
                      )}

                      <button onClick={() => { forwardMessage(eachMessage._id); setMenuOpen(null); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700">Forward</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input box */}
      <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2 items-center relative" onClick={(e) => e.stopPropagation()}>
        {/* 🎤 Voice Recorder */}
        {!voiceBlob ? (
          <AudioRecorder onRecordingComplete={(blob) => setVoiceBlob(blob)} audioTrackConstraints={{ noiseSuppression: true, echoCancellation: true }} downloadOnSavePress={false} downloadFileExtension="webm" />
        ) : (
          <div className="flex items-center gap-2">
            <audio controls src={URL.createObjectURL(voiceBlob)} />
            <button type="button" onClick={sendVoiceMessage} className="p-2 bg-green-600 hover:bg-green-700 rounded-full">
              <Send className="w-5 h-5 text-white" />
            </button>
            <button type="button" onClick={() => setVoiceBlob(null)} className="text-red-400 text-sm">Cancel</button>
          </div>
        )}

        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message..." className="flex-1 resize-none rounded-lg p-2 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />

        <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center">
          <Send className="w-5 h-5" />
        </button>

        {/* 😀 Emoji Button */}
        <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="p-2 text-gray-300 hover:text-white">
          <Smile className="w-6 h-6" />
        </button>

        {/* Emoji Picker Box */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 right-4 bg-gray-800 rounded-lg shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
            <EmojiPicker onEmojiClick={(emojiData) => setMessage((prev) => prev + emojiData.emoji)} theme="dark" />
          </div>
        )}
      </form>
    </div>
  );
};

export default Chat;
