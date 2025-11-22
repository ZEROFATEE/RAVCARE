import { useState } from 'react';
import { Link, useNavigate, useLocation} from 'react-router-dom';
import logo from '../icons/logo.png';
import '../../App.css';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { invoke } from "@tauri-apps/api/core";
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';


function Login() {
  const navigate = useNavigate();
  const location = useLocation();    

    // pre-fill username if we came from register`
  const [username, setUsername] = useState(
  location.state?.prefillUsername ?? "");

  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoginError, setIsLoginError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  
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
                  disabled={!!location.state?.prefillUsername}   // lock if pre-filled
                />
              </div>
            </div>

<div className="inputDiv">
  <label htmlFor='password'>Password</label>
  <div className="inputWrapper" style={{ position: "relative" }}>
    <BsFillShieldLockFill className='icon' />
    <input
      type={showPassword ? "text" : "password"}
      id='password'
      placeholder='Enter Password'
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      style={{ paddingRight: "35px" }} // room for eye icon
    />
    <span 
      onClick={() => setShowPassword(!showPassword)}
      style={{
        position: "absolute",
        right: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "pointer",
        color: "#888",
        fontSize: "1.2rem"
      }}
    >
      {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
    </span>
  </div>
</div>

            <button type='submit' className='btn flex'>
              <span>Login</span>
              <AiOutlineSwapRight className='icon' />
            </button>

          
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;