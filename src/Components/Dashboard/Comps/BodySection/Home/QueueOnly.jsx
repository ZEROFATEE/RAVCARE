import React, { useEffect, useState } from "react";
import "./queue.css";
import { invoke } from "@tauri-apps/api/core";

const QueueOnly = () => {
  const [serving, setServing] = useState(0);
  const [next, setNext] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      invoke("get_queue").then(([srv, nxt]) => {
        setServing(srv);
        setNext(nxt);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="divqueue">
    <div className="qcontainer">
    <div style={{ textAlign: "center", fontSize: "8rem", padding: "8rem" }}>
      <div>Now Serving: {String(serving).padStart(3, "0")}</div>
      <div>Next: {String(next).padStart(3, "0")}</div>
    </div>
    </div>
    </div>
  );
};

export default QueueOnly;