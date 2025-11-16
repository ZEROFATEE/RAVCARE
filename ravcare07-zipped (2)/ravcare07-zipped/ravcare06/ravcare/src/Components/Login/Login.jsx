import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../icons/logo.png';
import '../../App.css';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { invoke } from "@tauri-apps/api/core";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoginError, setIsLoginError] = useState(false);

  // ✅ Call your Rust backend to log in
  async function loginUser(username, password) {
    try {
      // your Rust command should return something like:
      // { success: true, role: "Doctor", message: "Login successful" }
      const response = await invoke("login_user", { username, password });
      return response;
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, message: "Invalid username or password" };
    }
  }

 const handleLogin = async (e) => {
  e.preventDefault();

  if (!username || !password) {
    setLoginMessage('Please enter both username and password.');
    setIsLoginError(true);
    return;
  }

  const result = await loginUser(username, password);
  console.log("Login result:", result);

  if (result.success) {
    setLoginMessage(result.message || "Login successful");
    setIsLoginError(false);

    // ✅ Normalize role (avoid capitalization mismatch)
    const userRole = (result.role || "admin").toLowerCase();
    localStorage.setItem("userRole", userRole);

    // ✅ Navigate user based on role
    setTimeout(() => {
      if (userRole === "doctor") {
        navigate("/dashboard/patient");
      } else if (userRole === "desk") {
        navigate("/dashboard/home");
      } else {
        navigate("/dashboard");
      }
    }, 800);
  } else {
    setLoginMessage(result.message || "Login failed");
    setIsLoginError(true);
  }
};

  return (
    <div className='loginPage flex'>
      <div className='container flex'>
        <div className='footerDiv flex'>
          <span className='text'>Don't have an account? </span>
          <Link to={'/register'}>
            <button className='btn'>Sign up</button>
          </Link>
        </div>

        <div className="formDiv flex">
          <div className="headerDiv">
            <img src={logo} alt='Logo Image' />
            <h3>Welcome Back!</h3>
          </div>
        </div>

        <div className="rightSection">
          <form className='form grid' onSubmit={handleLogin}>
            {loginMessage && (
              <span className={`showMessage ${isLoginError ? 'error' : 'success'}`}>
                {loginMessage}
              </span>
            )}

            <div className="inputDiv">
              <label htmlFor='username'>Username</label>
              <div className="inputWrapper">
                <FaUserShield className='icon' />
                <input
                  type='text'
                  id='username'
                  placeholder='Enter Username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor='password'>Password</label>
              <div className="inputWrapper">
                <BsFillShieldLockFill className='icon' />
                <input
                  type='password'
                  id='password'
                  placeholder='Enter Password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type='submit' className='btn flex'>
              <span>Login</span>
              <AiOutlineSwapRight className='icon' />
            </button>

            <span className='forgotPassword'>
              Forgot your password? <a href='#'>Click here</a>
            </span>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;