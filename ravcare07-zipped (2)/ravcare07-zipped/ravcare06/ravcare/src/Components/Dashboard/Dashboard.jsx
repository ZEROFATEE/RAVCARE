import './Dashboard.css';
import Sidebar from '../Dashboard/Comps/SidebarSection/sidebar';
import { Outlet } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import alertSound from "../../assets/1106.mp3";

const Dashboard = () => {
  const audioRef = useRef(null);

 useEffect(() => {
  // Create audio
  const audio = new Audio(alertSound);
  audio.volume = 1.0;
  audioRef.current = audio;

  // Try to preload the file early
  audio.load();

  // ✅ Unlock audio after first user interaction
  const unlockAudio = () => {
    audio.play()
      .then(() => {
        console.log("🔓 Audio unlocked by user click");
        audio.pause();
        audio.currentTime = 0;
        window.removeEventListener("click", unlockAudio);
      })
      .catch((err) => console.warn("⚠️ Audio unlock failed:", err));
  };
  window.addEventListener("click", unlockAudio);

  // ✅ Handle global alert
  const handleGlobalMissed = () => {
    console.log("🔊 Global missed alert triggered!");
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) =>
        console.error("❌ Sound play failed:", err)
      );
    }
  };

  window.addEventListener("globalMissedAlert", handleGlobalMissed);

  console.log("✅ Dashboard mounted and listening for alerts...");

  return () => {
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("globalMissedAlert", handleGlobalMissed);
  };
}, []);


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
