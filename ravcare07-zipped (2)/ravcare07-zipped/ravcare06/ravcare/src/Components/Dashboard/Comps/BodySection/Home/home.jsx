import React, { useState } from "react";
import "./home.css";

const Home = () => {
    const [serving, setServing] = useState(0);
  const [next, setNext] = useState(1);

  const handleNext = () => {
    setServing(next);
    setNext(next + 1);
  };

  const handleClear = () => {
    setServing(0);
    setNext(1);
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
      </div>
    </div>
  );
};


export default Home;
