import React, { useContext, useEffect, useRef, useState } from "react";
import api from "../component/api";
import { GlobalContext } from "../Context/Context";
import moment from "moment";
import { io } from "socket.io-client";
import { Send, Smile, Video, X, Mic } from "lucide-react";
import { AudioRecorder } from "react-audio-voice-recorder";
import EmojiPicker from "emoji-picker-react";
import Lottie from "lottie-react";
import robotAnimation from "./chatbot.json";
import SimplePeer from "simple-peer/simplepeer.min.js";

const Chat = ({ id, groups, selectedGroup }) => {
  const STUN_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: [
          "turn:relay1.expressturn.com:3478?transport=udp",
          "turn:relay1.expressturn.com:3478?transport=tcp",
        ],
        username: "efree",
        credential: "efree",
      },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
    iceCandidatePoolSize: 10,
  };
  
  const { state } = useContext(GlobalContext);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [userDetail, setUserDetail] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isGroup, setIsGroup] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // WebRTC / Socket refs & states
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [inCallWith, setInCallWith] = useState(null);
  const [isCalling, setIsCalling] = useState(false);

  // --- conversation / user fetchers ---
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
      getGroupDetail();
      api.get(`/group/${id}/messages`).then((res) => {
        setConversations(res.data.messages || []);
      });
    } else {
      getUserDetail();
      getConversation();
    }
  }, [id, groups]);

  // -------------------- Socket + simple-peer signaling setup --------------------
  useEffect(() => {
    if (!id) return;

    const socket = io(state.baseSocketIo, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on(`${id}-${state.user.user_id}`, (data) => {
      console.log("💬 Direct message received:", data);
      if (data.from._id !== state.user.user_id) {
        setConversations((prev) => [...prev, data]);
      }
    });

    socket.on(`group-${id}-${state.user.user_id}`, (data) => {
      console.log("👥 Group message received:", data);
      if (data.from !== state.user.user_id) {
        setConversations((prev) => [...prev, data]);
      }
    });

    socket.on("signal", ({ from, signal }) => {
      console.log("🔔 signal received from:", from, signal ? "signal present" : "no signal");
      if (peerRef.current) {
        console.log("🔁 Forwarding signal to existing peer");
        try {
          peerRef.current.signal(signal);
        } catch (err) {
          console.error("❌ Error signaling existing peer:", err);
        }
        return;
      }

      if (from && from === id) {
        setIncomingCall({ from, signal });
      } else {
        console.log("⚠️ signal from other user (not the selected chat). Ignoring or handle separately.");
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      cleanupCall();
    });

    return () => {
      console.log("🧹 Cleaning up socket on unmount");
      socket.close();
      cleanupCall();
    };
  }, [id]);

  // -------------------- simple-peer helpers --------------------
  const createPeerAsCaller = async (targetUserId, localStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream: localStream,
      config: STUN_SERVERS,
      sdpTransform: (sdp) => {
        return sdp
          .split('\n')
          .map(line => {
            if (line.startsWith('a=fmtp:')) {
              return line + ';x-google-min-bitrate=300;x-google-max-bitrate=900;x-google-start-bitrate=500';
            }
            return line;
          })
          .join('\n');
      },
    });

    peer.on("signal", (signal) => {
      console.log("📤 Caller peer signal generated");
      socketRef.current.emit("signal", {
        from: state.user.user_id,
        to: targetUserId,
        signal,
      });
    });

    peer.on("stream", (stream) => {
      console.log("📹 Caller got remote stream");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peer.on("error", (err) => console.error("peer error (caller):", err));
    peer.on("close", () => {
      console.log("peer closed (caller)");
      cleanupCall();
    });

    peerRef.current = peer;
    return peer;
  };

  const createPeerAsCallee = async (originSignal, originUserId, localStream) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStream,
      config: STUN_SERVERS,
    });

    peer.on("signal", (signal) => {
      console.log("📤 Callee peer signal generated (answer)");
      socketRef.current.emit("signal", {
        from: state.user.user_id,
        to: originUserId,
        signal,
      });
    });

    peer.on("stream", (stream) => {
      console.log("📹 Callee got remote stream");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peer.on("error", (err) => console.error("peer error (callee):", err));
    peer.on("close", () => {
      console.log("peer closed (callee)");
      cleanupCall();
    });

    peerRef.current = peer;

    try {
      peer.signal(originSignal);
    } catch (err) {
      console.error("❌ Error signaling callee peer with originSignal:", err);
    }

    return peer;
  };

  // ✅ FIXED: startVideoCall function
  const startVideoCall = async () => {
    if (!id) return;
    try {
      console.log("📞 Starting video call to:", id);

      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      localStreamRef.current = localStream;

      const videoTracks = localStream.getVideoTracks();
      console.log("🎥 Video tracks:", videoTracks.length);

      setIsCalling(true);
      setInCallWith(id);

      await createPeerAsCaller(id, localStream);

    } catch (err) {
      console.error("❌ startVideoCall error:", err);
      cleanupCall();
    }
  };

  // ✅ FIXED: acceptCall function
  const acceptCall = async () => {
    if (!incomingCall) return;
    const { from, signal } = incomingCall;

    try {
      console.log("📞 Accepting call from:", from);

      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      localStreamRef.current = localStream;

      setInCallWith(from);
      setIsCalling(true);
      setIncomingCall(null);

      await createPeerAsCallee(signal, from, localStream);

    } catch (err) {
      console.error("❌ acceptCall error:", err);
      cleanupCall();
      setIncomingCall(null);
    }
  };

  // ✅ FIXED: useEffect to attach local stream when video overlay renders
  useEffect(() => {
    if (isCalling && localStreamRef.current) {
      console.log("🎬 useEffect: Video call active, attaching local stream");
      
      const timer = setTimeout(() => {
        if (localVideoRef.current && localStreamRef.current) {
          console.log("✅ Attaching local stream to video element");
          const videoEl = localVideoRef.current;
          videoEl.srcObject = localStreamRef.current;
          videoEl.muted = true;
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          
          videoEl.play().catch(err => {
            console.warn("⚠️ Local video play failed, retrying...", err);
            setTimeout(() => videoEl.play().catch(() => {}), 300);
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isCalling]);

  const declineCall = () => {
    setIncomingCall(null);
  };

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
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {}
        peerRef.current = null;
      }
    } catch (e) {
      console.warn("Cleanup error:", e);
    }
    setIsCalling(false);
    setIncomingCall(null);
    setInCallWith(null);
  };

  // -------------------- rest of chat functions --------------------
  const deleteMessageForMe = async (msgId) => {
    try {
      const url = isGroup ? `/group/message/${msgId}/forme` : `/message/${msgId}/forme`;
      await api.delete(url, { data: { token: { id: state.user.user_id } } });
      setConversations((prev) => prev.filter((m) => m._id !== msgId));
    } catch (error) {
      console.log("Delete for me error", error);
    }
  };

  const deleteMessageForEveryone = async (msgId) => {
    try {
      const url = isGroup ? `/group/message/${msgId}/foreveryone` : `/message/${msgId}/foreveryone`;
      await api.delete(url, { data: { token: { id: state.user.user_id } } });
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

  // ✅ IMPROVED: Emoji picker handling for mobile
  useEffect(() => {
    const handleClick = () => setShowEmojiPicker(false);
    if (showEmojiPicker) {
      window.addEventListener("click", handleClick);
      // Prevent body scroll when emoji picker is open on mobile
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener("click", handleClick);
      document.body.style.overflow = 'unset';
    };
  }, [showEmojiPicker]);

  // ✅ NEW: Handle mobile viewport height
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  if (!id) {
    return (
      <div className="flex flex-col md:flex-row h-screen">
        <div className="flex-1 bg-[#36393f] flex items-center justify-center text-gray-400 text-center p-4">
          <p>Select a user to start chat 💬</p>
        </div>
        <div className="flex justify-center items-center h-full w-full bg-black">
          <Lottie animationData={robotAnimation} loop={true} className="w-[250px] h-[250px] md:w-[600px] md:h-[600px] object-cover" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white relative" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Header - Mobile Optimized */}
      <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center gap-3 min-h-[64px] safe-area-top">
        <img 
          src={isGroup ? selectedGroup?.groupPic || "/group-icon.png" : userDetail?.groupPic || "/0d64989794b1a4c9d89bff571d3d5842.jpg"} 
          alt="Profile" 
          className="w-10 h-10 rounded-full object-cover border border-gray-600 flex-shrink-0" 
        />
        <h1 className="text-lg font-semibold truncate flex-1">
          {isGroup ? selectedGroup?.groupName : `${userDetail?.firstName || ""} ${userDetail?.lastName || ""}`}
        </h1>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={startVideoCall} 
            className="p-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            disabled={isCalling}
          >
            <Video className="w-5 h-5" />
          </button>
          {isCalling && (
            <button onClick={endCall} className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ✅ FIXED: Video Call Overlay - Mobile Optimized */}
      {isCalling && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center safe-area-top safe-area-bottom">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover bg-black" 
            onLoadedMetadata={(e) => e.target.play().catch(() => {})} 
          />
          <div className="absolute top-4 right-4 w-24 h-18 md:w-48 md:h-36 rounded-lg overflow-hidden border-2 border-white z-50 bg-black">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
              onLoadedMetadata={(e) => {
                console.log("✅ Local video metadata loaded");
                e.target.play().catch(err => console.warn("Local video play warning:", err));
              }}
            />
          </div>
          <button 
            onClick={endCall} 
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 rounded-full text-white text-lg font-semibold hover:bg-red-700 transition safe-area-bottom"
          >
            End Call
          </button>
        </div>
      )}

      {/* Incoming call popup - Mobile Optimized */}
      {incomingCall && !isCalling && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-90 safe-area-top safe-area-bottom">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl text-center mx-4 max-w-sm w-full">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Incoming Call</h3>
            <p className="text-gray-300 mb-6">from {incomingCall.from}</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={acceptCall} 
                className="flex-1 px-6 py-3 bg-green-600 rounded-full hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Video className="w-5 h-5" />
                <span>Accept</span>
              </button>
              <button 
                onClick={declineCall} 
                className="flex-1 px-6 py-3 bg-red-600 rounded-full hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
              >
                <X className="w-5 h-5" />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area - Mobile Optimized */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 safe-area-top safe-area-bottom">
        {conversations?.map((eachMessage, i) => {
          const isMine = eachMessage?.from?._id === state.user.user_id;
          return (
            <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="relative max-w-[85%]">
                <div className={`p-3 rounded-2xl ${isMine ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-700 text-gray-100 rounded-bl-none"}`}>
                  <p className="font-medium text-sm">{eachMessage?.from?.firstName} {eachMessage?.from?.lastName}</p>
                  {eachMessage?.text && <p className="mt-1 text-sm break-words">{eachMessage?.text}</p>}
                  {eachMessage?.voiceUrl && (
                    <audio 
                      controls 
                      className="mt-2 w-full max-w-[250px]"
                      src={`${state.baseFileUrl}${eachMessage.voiceUrl}`} 
                    />
                  )}
                  <span className="text-xs text-gray-300 block mt-1">
                    {moment(eachMessage?.createdOn).fromNow()}
                  </span>
                </div>

                <div className="absolute top-2 right-2">
                  <button 
                    onClick={() => setMenuOpen(menuOpen === eachMessage._id ? null : eachMessage._id)}
                    className="text-gray-300 hover:text-white p-1 rounded"
                  >
                    ⋮
                  </button>
                  {menuOpen === eachMessage._id && (
                    <div className="absolute right-0 mt-1 w-36 bg-gray-800 rounded-lg shadow-xl z-10 text-sm border border-gray-600">
                      <button 
                        onClick={() => { deleteMessageForMe(eachMessage._id); setMenuOpen(null); }} 
                        className="block w-full text-left px-4 py-3 hover:bg-gray-700 rounded-t-lg border-b border-gray-600"
                      >
                        Delete for Me
                      </button>
                      {isMine && (
                        <button 
                          onClick={() => { deleteMessageForEveryone(eachMessage._id); setMenuOpen(null); }} 
                          className="block w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-600"
                        >
                          Delete for Everyone
                        </button>
                      )}
                      <button 
                        onClick={() => { forwardMessage(eachMessage._id); setMenuOpen(null); }} 
                        className="block w-full text-left px-4 py-3 hover:bg-gray-700 rounded-b-lg"
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

      {/* Input area - Mobile Optimized */}
      <form 
        onSubmit={sendMessage} 
        className="p-3 bg-gray-800 border-t border-gray-700 flex gap-2 items-center relative safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {!voiceBlob ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecording(true)}
              className="p-2 text-gray-300 hover:text-white transition-colors"
            >
              <Mic className="w-5 h-5" />
            </button>
            {isRecording && (
              <AudioRecorder 
                onRecordingComplete={(blob) => {
                  setVoiceBlob(blob);
                  setIsRecording(false);
                }}
                audioTrackConstraints={{ 
                  noiseSuppression: true, 
                  echoCancellation: true 
                }}
                downloadOnSavePress={false}
                downloadFileExtension="webm"
                showVisualizer={true}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-2">
            <audio controls src={URL.createObjectURL(voiceBlob)} className="max-w-[120px]" />
            <button 
              type="button" 
              onClick={sendVoiceMessage} 
              className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
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
          className="flex-1 resize-none rounded-lg p-3 bg-gray-700 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
        />

        <button 
          type="submit" 
          className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>

        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} 
          className="p-2 text-gray-300 hover:text-white transition-colors flex-shrink-0"
        >
          <Smile className="w-6 h-6" />
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-16 right-2 bg-gray-800 rounded-lg shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
            <EmojiPicker 
              onEmojiClick={(emojiData) => setMessage((prev) => prev + emojiData.emoji)} 
              theme="dark"
              width="100%"
              height="400px"
            />
          </div>
        )}
      </form>

      {/* Add CSS for safe areas */}
      <style jsx>{`
        .safe-area-top {
          padding-top: env(safe-area-inset-top);
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
};

export default Chat;