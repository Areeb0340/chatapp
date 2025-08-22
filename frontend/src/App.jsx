import logo from './logo.svg';
import './App.css';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from './Context/Context';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import Home from './pages/Home';
import Chat from './pages/chat';
import Signup from './pages/signup';
import Login from './pages/login';
import api from './component/api';
import moment from 'moment';

function App() {
  let {state, dispatch}=useContext(GlobalContext)
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
      <div className="notificationWrapper">
        {notifications?.map((eachMsg, i) => {


          return(

          <div key={i} className="">
            <div className="" onClick={() => {dismissNotification(eachMsg)}}>X</div>
            <div className="notification" onClick={() => {pushToChat(eachMsg)}}>
              <h1>{eachMsg?.from?.firstName} {eachMsg?.from?.lastName}</h1>
              <p>{eachMsg?.text}</p>
              <span>
                {moment(eachMsg?.createdOn).fromNow()}
              </span>
            </div>
          </div>

          )
        }
        )}
      </div>
 
    </div>
  );
}

export default App;
