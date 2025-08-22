import React, { useContext, useEffect, useState } from 'react'
import api from '../component/api'
import { useParams } from 'react-router';
import { GlobalContext } from '../Context/Context';
import moment from 'moment';

const Chat = () => {
  let {state, dispatch} = useContext(GlobalContext);
    const [message , setMessage] = useState("");
    const [conversations , setConversations] = useState([]);
    const [userDetail , setUserDetail] = useState({})

      const {id} = useParams();

  const getConversation= async()=>{
    try {
      let Conversation = await api.get(`/conversation/${id}`)
      console.log('converstion', Conversation)
       setConversations(Conversation.data?.conversation)
      
    } catch (error) {
      console.log('error', error)
    }
  }
  const getUserDetail = async()=>{
    try {
      let response = await api.get(`/profile?user_id=${id}`)
         console.log("conversation", response)
            setUserDetail(response.data?.user)
    } catch (error) {
            console.log('error', error)
    }
  }

  useEffect(()=>{
  getConversation();
  getUserDetail();

  },[])

    const sendMessage = async(e) => {
        e.preventDefault();
        try {
            let res = await api.post(`chat/${id}`, {message: message})
            console.log(res.data);
            setMessage("");
            setConversations(prev => [...prev, res.data.chat])
        } catch (error) {
            console.log("Error" , error)
        }
    }
    console.log("userDetail" , userDetail)
  return (
  <div>
        <div className="">
            <h1>
                {userDetail?.first_name} {userDetail?.last_name}
            </h1>
            <p>{userDetail?.email}</p>
        </div>
        <div className="messageWrapper">
            {conversations?.map((eachMessage, i) => {
              console.log('each',eachMessage)
                return(
                  <div key={i} className={`conversation ${(eachMessage?.from?._id == state.user.user_id) ? "myMessage" : ""}`}>
                        <p><b>{eachMessage?.from?.firstName} {eachMessage?.from?.lastName}</b></p>
                        <p>
                            {eachMessage?.text}
                        </p>
                        <span>
                            {moment(eachMessage?.createdOn).fromNow()}
                        </span>
                    </div>
                )
            })}
        </div>
        <form onSubmit={sendMessage} style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8}}>
            <textarea value={message} onChange={(e) => {setMessage(e.target.value)}} placeholder='Write your message...'></textarea>
            <button>Send</button>
        </form>
    </div>
  )
}
export default Chat