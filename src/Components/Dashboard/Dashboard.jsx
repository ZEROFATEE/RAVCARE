
import './Dashboard.css';
import Sidebar from '../Dashboard/Comps/SidebarSection/sidebar';
import { Outlet } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div className="dashboard">
       <div className="sideBar">
      <Sidebar />
      </div>
      <div className="mainContent">
        <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;
