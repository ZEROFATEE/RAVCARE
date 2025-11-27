// src/components/Toast.jsx
import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import "./Toast.css";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info"|| "warning") => {
  const id = Date.now();
  setToasts((prev) => [...prev, { id, message, type }]);

  // auto-close ONLY if not info
  if (type !== "info") {
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }
}, []);

  const close = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-text">{t.message}</span>
            {t.type === "info" && (
              <button className="toast-close" onClick={() => close(t.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);