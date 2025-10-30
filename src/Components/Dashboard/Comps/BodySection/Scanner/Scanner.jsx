import React, { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom"; 
import { QrReader } from "react-qr-reader";

const QRCodeScanner = () => {
  const [scannedData, setScannedData] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
const handleScan = async (results) => {
  if (!results || results.length === 0) return;

  const raw = results[0].rawValue;
  console.log("Scanned QR:", raw);

  try {
    const data = JSON.parse(raw);
    const numericId = data.id; // ✅ declare here

    if (!numericId) {
      alert("Invalid QR code data");
      return;
    }

    // Navigate to patient route
    navigate(`/dashboard/patient/${numericId}`);
  } catch (err) {
    console.error("Invalid QR or fetch error:", err);
    alert("Invalid QR code or patient not found.");
  }
};

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h2>QR Code Scanner</h2>
      <div style={{ width: "300px", height: "300px" }}>
        <Scanner onScan={handleScan} onError={(err) => setError(err.message)} />
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};


export default QRCodeScanner;
