import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../icons/logo.png';
import '../../App.css';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill } from 'react-icons/bs';  
import { MdMarkEmailRead } from 'react-icons/md';
import { invoke } from "@tauri-apps/api/core";
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';

const Register = () => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    firstname: '',
    middlename: '',
    lastname: '',
    password: '',
    contactNum: '',
    role: 'desk'
  });
  
  const [passwordStrength, setPasswordStrength] = useState({ label: '', percent: 0 });
  const [registerMessage, setRegisterMessage] = useState('');
  const [isRegisterError, setIsRegisterError] = useState(false);
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [showUsername, setShowUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  
  // Password strength checker
  function checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    let label = '';
    let percent = (strength / 5) * 100;

    if (strength <= 2) label = 'Weak';
    else if (strength === 3 || strength === 4) label = 'Medium';
    else if (strength === 5) label = 'Strong';

    setPasswordStrength({ label, percent });
  }

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'password') {
      checkPasswordStrength(value);
    }
  };

  // Handle contact number formatting
  const handleContactChange = (e) => {
    let input = e.target.value;

    if (!input.startsWith("+63")) {
      if (input.startsWith("+6") || input.startsWith("+") || input === "") {
        input = "+63";
      } else {
        input = "+63" + input.replace(/^\+?63?/, "");
      }
    }

    input = "+63" + input.slice(3).replace(/\D/g, "");
    if (input.length > 13) input = input.slice(0, 13);
    
    handleInputChange('contactNum', input);
  };

  // Generate username
  const generateUsername = (firstname, lastname, role) => {
    return `${firstname.toLowerCase()}${lastname.toLowerCase()}${role.toLowerCase()}`;
  };

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Register button clicked");
    console.log("Form data:", formData);
    
    setRegisterMessage("");
    setIsLoading(true);

    // Validation
    if (!formData.firstname || !formData.lastname || !formData.password || !formData.contactNum) {
      setRegisterMessage("Please fill in all required fields.");
      setIsRegisterError(true);
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setRegisterMessage("Password must be at least 6 characters long.");
      setIsRegisterError(true);
      setIsLoading(false);
      return;
    }

    const generatedUsername = generateUsername(formData.firstname, formData.lastname, formData.role);
    setGeneratedUsername(generatedUsername);

    try {
      console.log("Attempting to register user...");
      
      const returnedUsername = await invoke("register_user", {
        payload: {
          firstname: formData.firstname,
          middlename: formData.middlename || null,
          lastname: formData.lastname,
          contact_num: formData.contactNum,
          password: formData.password,
          role: formData.role,
        },
      });

      console.log("Registration successful:", returnedUsername);
      
      setRegisterMessage(`Registration successful! Username: ${returnedUsername}`);
      setIsRegisterError(false);
      setShowUsername(true);

      // Clear form
      setFormData({
        firstname: '',
        middlename: '',
        lastname: '',
        password: '',
        contactNum: '',
        role: 'desk'
      });
      setPasswordStrength({ label: '', percent: 0 });

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/", { state: { prefillUsername: returnedUsername } });
      }, 10_000);

    } catch (err) {
      console.error("Registration failed:", err);
      setRegisterMessage("Registration failed: " + String(err));
      setIsRegisterError(true);
    } finally {
      setIsLoading(false);
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

            {showUsername && generatedUsername && (
              <div className="username-display">
                <div className="username-box">
                  <h4>Your Generated Username:</h4>
                  <div className="username-highlight">{generatedUsername}</div>
                  <p className="username-note">This is your username</p>
                </div>
              </div>
            )}

            <div className="inputDiv">
              <label htmlFor='firstname'>First Name *</label>
              <div className="inputWrapper">
                <FaUserShield className='icon' />
                <input
                  type='text'
                  id='firstname'
                  placeholder='Enter your First name'
                  value={formData.firstname}
                  onChange={(e) => handleInputChange('firstname', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="inputDiv">
              <label htmlFor='middlename'>Middle Name</label>
              <div className='inputWrapper'>
                <FaUserShield className='icon'/>
                <input
                  type='text'
                  id='middlename'
                  placeholder='Enter your Middle Name'
                  value={formData.middlename}
                  onChange={(e) => handleInputChange('middlename', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor='lastname'>Last Name *</label>
              <div className='inputWrapper'>
                <FaUserShield className='icon'/>
                <input
                  type='text'
                  id='lastname'
                  placeholder='Enter your Last Name'
                  value={formData.lastname}
                  onChange={(e) => handleInputChange('lastname', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="inputDiv">
              <label htmlFor='ContactNum'>Contact Number *</label>
              <div className='inputWrapper'>
                <FaUserShield className='icon'/>
                <input
                  type='text'
                  id='ContactNum'
                  placeholder='+63'
                  value={formData.contactNum}
                  onChange={handleContactChange}
                  onFocus={() => {
                    if (formData.contactNum === "") handleInputChange('contactNum', "+63")
                  }}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

<div className="inputDiv">
  <label htmlFor='password'>Password *</label>
  <div className="inputWrapper" style={{ position: "relative" }}>
    <BsFillShieldLockFill className='icon' />
    <input
      type={showPassword ? "text" : "password"} 
      id='password'
      placeholder='Enter Password'
      value={formData.password}
      onChange={(e) => handleInputChange('password', e.target.value)}
      required
      disabled={isLoading}
      style={{ paddingRight: "35px" }} // ensure room for icon
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

  {formData.password && (
    <div className={`password-strength ${passwordStrength.label.toLowerCase()}`}>
      <span>{passwordStrength.label}</span>
      <div className="strength-bar">
        <div className="strength-fill" style={{ width: `${passwordStrength.percent}%` }}></div>
      </div>
    </div>
  )}
</div>

            <div className="inputDiv">
              <label htmlFor='role'>Select Role *</label>
              <select
                id='role'
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className="inputWrapper"
                disabled={isLoading}
                required
              >
                <option value="admin">Admin</option>
                <option value="doctor">Doctor</option>
                <option value="desk">Desk</option>
              </select>
            </div>

            <button 
              type='submit' 
              className='btn flex'
              disabled={isLoading}
            >
              <span>{isLoading ? 'Registering...' : 'Register'}</span>
              <AiOutlineSwapRight className='icon' />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;