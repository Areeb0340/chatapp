import './App.css';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router';
import Signup from './pages/signup';
import Login from './pages/login';
import Home from './pages/Home';
import { useContext, useEffect, useState } from 'react';
import api from './component/api';
import Chat from './pages/chat';
import { GlobalContext } from './Context/Context';
import io from 'socket.io-client';
import moment from 'moment';

function App() {
  let {state, dispatch} = useContext(GlobalContext);

  const [notifications , setNotifications] = useState([])

  const navigate = useNavigate();

  useEffect(() => {
    const getUserData = async() => {
      try {
        let res = await api.get('/profile');
        dispatch({type: "USER_LOGIN", user: res.data?.user})
        
      } catch (error) {
        dispatch({type: "USER_LOGOUT"})
      }
    }
    getUserData();
  } , [])

  useEffect(() => {
    const socket = io(state.baseSocketIo , {withCredentials: true});

    if(state.isLogin){

  
      socket.on('connect', () => {
        console.log("Connected to server");
      });
  
      socket.on(`personal-channel-${state.user.user_id}`, (data) => {
        // personal-channel-fahad-id
        console.log("Received: App", data);
        setNotifications(prev => [...prev, data])
      });
  
      socket.on('disconnect', (reason) => {
        console.log("Disconnected. Reason:", reason);
      });
  
      socket.on('error', (error) => {
        console.log("Error:", error);
      });
    }
    
    return () => {
      console.log("Component unmount")
      socket.close();  // cleanup on unmount
    };
  }, [state.user.user_id]);

  const dismissNotification = (msg) => {
    // msg?._id
    setNotifications((prev) => prev.filter((item) => item?._id != msg?._id))

    // let arr = ["1" , "2", "3"];
    // arr.map((item) => console.log(item))
    // let newArr = arr.filter((item) => item == "2")
    // newArr = ["2"]
  }

  const pushToChat = (eachMsg) => {
    navigate(`/chat/${eachMsg?.from?._id}`)
    dismissNotification(eachMsg)
  }

  return (
    <div>
      {(state.isLogin == true)?
        <>
          <Routes>
            <Route path='/home' element={<Home />} />
            <Route path='/chat/:id' element={<Chat />} />
            <Route path='*' element={<Navigate to={"/home"} />} />
          </Routes>
        </>
        :
        (state.isLogin == false)?
        <>
          <Routes>
            <Route path='/sign-up' element={<Signup />} />
            <Route path='/login' element={<Login />} />
            <Route path='*' element={<Navigate to={"/login"} />} />
          </Routes>
        </>
        :
        <div>
          Loading...
        </div>
      }
    <div className="fixed top-5 right-5 flex flex-col gap-3 z-50">
  {notifications?.map((eachMsg, i) => (
    <div
      key={i}
      className="relative bg-white shadow-lg rounded-xl p-4 w-72 border border-gray-200 hover:shadow-xl transition-all cursor-pointer"
    >
      {/* Close button */}
      <button
        onClick={() => dismissNotification(eachMsg)}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
      >
        ✕
      </button>

      {/* Notification content */}
      <div onClick={() => pushToChat(eachMsg)}>
        <h1 className="font-semibold text-gray-800">
          {eachMsg?.from?.firstName} {eachMsg?.from?.lastName}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{eachMsg?.text}</p>
        <span className="text-xs text-gray-400 mt-2 block">
          {moment(eachMsg?.createdOn).fromNow()}
        </span>
      </div>
    </div>
  ))}
</div>
    </div>
  );
}

export default App;