import { Link, useNavigate } from "react-router-dom";
import './sidebar.css'
import logo from '../../../../assets/iconss/logo.png';
import { FaHome, FaClipboardList, FaCalendarAlt } from "react-icons/fa";
import { AiOutlineScan } from "react-icons/ai";
import { FiLogOut } from "react-icons/fi";
import { MdInventory } from "react-icons/md";

const Sidebar = () => {
 const navigate = useNavigate();

  const handleLogout = () => {
    // Clear session/auth info
    localStorage.removeItem("authToken");

    // Redirect to login
    navigate("/");
  };


  return (
    <div className='sideBar grid'>
      <div className="logoDiv flex">
        <img src={logo} alt="Image Name" />
        <h2>RavCare</h2>        
      </div> 

    <div className="menuDiv">
        <ul className="menuLists grid">
          <li className="listItem">
            <Link to="/dashboard/home" className="menuLink flex">
              <FaHome className="icon" />
              <span className="smallText">Home</span>
            </Link>
          </li>

          <li className="listItem">
            <Link to="/dashboard/patient" className="menuLink flex">
              <FaClipboardList className="icon" />
              <span className="smallText">Patient Records</span>
            </Link>
          </li>

          <li className="listItem">
            <Link to="/dashboard/schedule" className="menuLink flex">
              <FaCalendarAlt className="icon" />
              <span className="smallText">Schedule</span>
            </Link>
          </li>

          <li className="listItem">
            <Link to="/dashboard/scanner" className="menuLink flex">
              <AiOutlineScan className="icon" />
              <span className="smallText">Scanner</span>
            </Link>
          </li>

            <li className="listItem">
            <Link to="/dashboard/inventory" className="menuLink flex">
              <MdInventory className="icon" />
              <span className="smallText">Inventory</span>
            </Link>
          </li>
        </ul>
      </div>

      

       <div className="logoutDiv">
        <button className="logoutBtn flex" onClick={handleLogout}>
          <FiLogOut className="icon" />
          <span className="smallText">Logout</span>
        </button> 
      </div>
    </div>
  );
};

export default Sidebar