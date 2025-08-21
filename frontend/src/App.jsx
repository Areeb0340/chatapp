import logo from './logo.svg';
import './App.css';
import { useContext } from 'react';
import { GlobalContext } from './Context/Context';
import { Navigate, Route, Routes } from 'react-router';
import Home from './pages/Home';
import Chat from './pages/chat';
import Signup from './pages/signup';
import Login from './pages/login';

function App() {
  let {state, dispatch}=useContext(GlobalContext)
  return (
    <div className="App">
     {(state.isLogin==true)?


      <>
    <Routes>
      <Route path='/home' element={<Home/>}/>
      <Route path='/chat/:id' element={<Chat/>}/>
       <Route path='*' element={<Navigate to ={'/home'}/>}/>
     </Routes>
       </>
     :
     (state.isLogin==false)?
     <>
     
   <Routes>
     <Route path='/signup' element={<Signup/>}/>
     <Route path='/login' element={<Login/>}/>
     <Route path='*' element={<Navigate to ={'/login'}/>}/>
   </Routes>
     </>
     :
     <div>
          Loading...
        </div>
    }
 
    </div>
  );
}

export default App;
