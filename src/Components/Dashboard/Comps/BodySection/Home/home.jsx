import React, { useState } from "react";
import "./home.css";
import { invoke } from "@tauri-apps/api/core";
import { queueNum } from "../../../../../QueueSignals";
import { emit, emitTo } from "@tauri-apps/api/event";

const Home = () => {
    const [serving, setServing] = useState(0);
  const [next, setNext] = useState(1);

  const handleNext =async () => {
    setServing(next);
    setNext(next + 1);

    await emitTo("queueWindow", "queue-update", {number: serving})
    console.log("lsjdflkds")
  };

  const handleClear = () => {
    setServing(0);
    setNext(1);
    queueNum.value = 0
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
        <button type="button" onClick={() => invoke("create_window")} className="next-btn">
          Open Queue Window
        </button>
        <button className="next-btn" onClick={handleNext}>
          NEXT
        </button>
        <button className="clear-btn" onClick={handleClear}>
          CLEAR
        </button>
      </div>
    </div>
  );
};


export default Home;
