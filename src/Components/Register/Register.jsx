import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../icons/logo.png';
import '../../App.css';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { MdMarkEmailRead } from 'react-icons/md';
import { invoke } from "@tauri-apps/api/core";

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('desk'); // default role
  const [registerMessage, setRegisterMessage] = useState('');
  const [isRegisterError, setIsRegisterError] = useState(false);

  async function registerUser(username, email, password, role) {
    try {
      const message = await invoke("register_user", { username, email, password, role });
      return { success: true, message };
    } catch (error) {
      return { success: false, message: error };
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterMessage('');

    if (!email || !username || !password) {
      setRegisterMessage('Please fill in all fields.');
      setIsRegisterError(true);
      return;
    }

    const result = await registerUser(username, email, password, role);

    if (result.success) {
      setRegisterMessage(result.message);
      setIsRegisterError(false);
      setEmail('');
      setUsername('');
      setPassword('');
      setTimeout(() => navigate('/'), 1000);
    } else {
      setRegisterMessage(result.message);
      setIsRegisterError(true);
    }
  };

  return (
    <div className='registerPage flex'>
      <div className='container flex'>
        <div className='footerDiv flex'>
          <span className='text'>Have an account? </span>
          <Link to={'/'}>
            <button className='btn'>Login</button>
          </Link>
        </div>

        <div className="formDiv flex">
          <div className="headerDiv">
            <img src={logo} alt='Logo' />
            <h3>Let Us Know You!</h3>
          </div>
        </div>

        <div className="rightSection">
          <form className='form grid' onSubmit={handleRegister}>
            {registerMessage && (
              <span className={`showMessage ${isRegisterError ? 'error' : 'success'}`}>
                {registerMessage}
              </span>
            )}

            <div className="inputDiv">
              <label htmlFor='email'>Email</label>
              <div className="inputWrapper">
                <MdMarkEmailRead className='icon' />
                <input
                  type='email'
                  id='email'
                  placeholder='Enter Email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

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

            {/* ✅ Role dropdown */}
            <div className="inputDiv">
              <label htmlFor='role'>Select Role</label>
              <select
                id='role'
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="inputWrapper"
              >
                <option value="admin">Admin</option>
                <option value="doctor">Doctor</option>
                <option value="desk">Desk</option>
              </select>
            </div>

            <button type='submit' className='btn flex'>
              <span>Register</span>
              <AiOutlineSwapRight className='icon' />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
