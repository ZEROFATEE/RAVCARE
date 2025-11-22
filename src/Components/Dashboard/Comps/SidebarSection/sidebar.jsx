import { Link, useNavigate } from "react-router-dom";
import './sidebar.css';
import logo from '../../../../assets/iconss/logo.png';
import { FaHome, FaClipboardList, FaCalendarAlt } from "react-icons/fa";
import { AiOutlineScan } from "react-icons/ai";
import { FiLogOut } from "react-icons/fi";
import { MdInventory } from "react-icons/md";

const Sidebar = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem("userRole"); // ✅ fetch the role

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  // ✅ Define which roles can see which links
 const menuItems = [
  { name: "Home", path: "/dashboard/home", icon: <FaHome />, roles: ["admin", "desk"] },
  { name: "Patient Records", path: "/dashboard/patient", icon: <FaClipboardList />, roles: ["admin"] },
  { name: "Patient Records", path: "/dashboard/patientrecdesk", icon: <FaClipboardList />, roles: ["desk"] },
  { name: "Patient Records", path: "/dashboard/patientrecdoctor", icon: <FaClipboardList />, roles: ["doctor"] },
  { name: "Schedule", path: "/dashboard/schedule", icon: <FaCalendarAlt />, roles: ["admin", "doctor", "desk"] },
  { name: "Scanner", path: "/dashboard/scanner", icon: <AiOutlineScan />, roles: ["admin", "doctor", "desk"] },
  { name: "Inventory", path: "/dashboard/inventory", icon: <MdInventory />, roles: ["admin"] },
  { name: "Staff", path: "/dashboard/staff", icon: <MdInventory />, roles: ["admin"] },
];

  // ✅ Only show items allowed for this user's role
  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  return (
    <div className='sideBar grid'>
      <div className="logoDiv flex">
        <img src={logo} alt="Logo" />
        <h2>RavCare</h2>        
      </div>

      <div className="menuDiv">
        <ul className="menuLists grid">
          {filteredMenu.map((item) => (
            <li key={item.name} className="listItem">
              <Link to={item.path} className="menuLink flex">
                {item.icon}
                <span className="smallText">{item.name}</span>
              </Link>
            </li>
          ))}
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

export default Sidebar;
