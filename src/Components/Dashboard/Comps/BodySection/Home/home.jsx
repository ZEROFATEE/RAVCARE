import React, { useState, useEffect } from "react";
import "./home.css";
import { invoke } from "@tauri-apps/api/core";


const Home = () => {
  const [serving, setServing] = useState(0);
  const [next, setNext] = useState(1);

  useEffect(() => {
    invoke("get_queue").then(([srv, nxt]) => {
      setServing(srv);
      setNext(nxt);
    });
  }, []);

  const handleNext = async () => {
    const [srv, nxt] = await invoke("increment_queue");
    setServing(srv);
    setNext(nxt);
  };

  const handleClear = async () => {
    const [srv, nxt] = await invoke("clear_queue");
    setServing(srv);
    setNext(nxt);
  };

  return (
    <div className="queue-container">
      <h1 className="queue-title">Current Queue</h1>

      <div className="queue-box">
        <div className="serving">
          <h2>Serving</h2>
          <p className="queue-number">{String(serving).padStart(3, "0")}</p>
        </div>
        <div className="next">
          <h2>Next</h2>
          <p className="queue-number">{String(next).padStart(3, "0")}</p>
        </div>
      </div>

      <div className="queue-controls">
        <button className="next-btn" onClick={handleNext}>
          NEXT
        </button>
        <button className="clear-btn" onClick={handleClear}>
          CLEAR
        </button>

        {/* NEW BUTTON */}
        <button
  className="detach-btn"
  onClick={() => invoke("open_home_window")}
>
  EXTEND
</button>
      </div>
    </div>
  );
};

export default Home;
