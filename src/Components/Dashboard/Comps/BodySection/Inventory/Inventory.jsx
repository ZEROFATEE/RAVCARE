"use client"

// EVERYHINGGGGGG
// THIS WAS HEAVILY COPIED AND PASTED CUS KULANG ORAS, SAME DIN NG CSS ITO

import { useState, useEffect } from "react"
import "./Inventory.css"

export const createInventoryManager = () => {
  let inventoryState = null

  return {
    setInventoryState: (state) => {
      inventoryState = state
    },
    reduceInventoryByRoute: (vaccineId, route, setStock, setLogs, VACCINES) => {
      const vaccine = VACCINES.find((v) => v.id === vaccineId)
      if (!vaccine) return

      const amount = route === "ID" ? 0.1 : 1 // ID: 0.1mL, IM: 1mL
      const doseType = route === "ID" ? "ID" : "IM"

      setLogs((prev) => [
        {
          id: prev.length + 1,
          timestamp: new Date().toLocaleString(),
          action: `Dose Administered (${doseType})`,
          vaccine: vaccine.name,
          amount: amount,
          user: "Rabvax Staff",
        },
        ...prev,
      ])

      // Decrease stock
      setStock((prev) => ({
        ...prev,
        [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - amount),
      }))
    },
  }
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState("stock")

  // Available vaccines
  const VACCINES = [
    { id: "vaxirab", name: "Vaxirab N", category: "Anti-Rabies" },
    { id: "pcv13", name: "PCV13", category: "Pneumonia Vaccine" },
    { id: "ppsv23", name: "PPSV23", category: "Pneumonia Vaccine" },
    { id: "tetanus", name: "Tetanus Toxoid", category: "Anti Tetanus" },
    { id: "ats", name: "ATS", category: "Anti Tetanus" },
    { id: "htig", name: "HTIG", category: "Anti Tetanus" },
    { id: "hepab", name: "Hepa B Vaccine", category: "Hepatitis B" },
    { id: "flu", name: "Flu Vaccine", category: "Influenza" },
  ]

  const [stock, setStock] = useState({
    vaxirab: 10,
    pcv13: 5,
    ppsv23: 5,
    tetanus: 8,
    ats: 3,
    htig: 3,
    hepab: 6,
    flu: 12,
  })

  const [newStock, setNewStock] = useState("")
  const [selectedVaccine, setSelectedVaccine] = useState("vaxirab")
  const [showCreateForm, setShowCreateForm] = useState(false)

  // 🔧 HIDDEN: Open vial logic (ID use) - kept for calculations but not displayed
  const [openVial, setOpenVial] = useState({
    name: "Vaxirab N",
    volume: 1.0,
    status: "Closed",
    openedAt: null,
    spoiled: false,
    completed: false,
    spoiledAmount: 0,
  })

  // 🔧 HIDDEN: Unopened vial logic (IM use) - kept for calculations but not displayed
  const [unopenedVial, setUnopenedVial] = useState({
    name: "Vaxirab N",
    status: "Closed",
    spoiled: false,
    completed: false,
  })

  // 📋 Activity Logs
  const [logs, setLogs] = useState([
    {
      id: 1,
      timestamp: new Date().toLocaleString(),
      action: "Stock Added",
      vaccine: "Vaxirab N",
      amount: 10,
      user: "Admin",
    },
  ])

  // 🕒 Timer logic for spoilage (6-hour) - HIDDEN
  useEffect(() => {
    if (!openVial.openedAt || openVial.spoiled || openVial.completed) return
    const timer = setInterval(() => {
      const elapsed = Date.now() - openVial.openedAt
      const sixHours = 6 * 60 * 60 * 1000
      if (elapsed >= sixHours) {
        setOpenVial((prev) => ({
          ...prev,
          spoiled: true,
          status: "Spoiled",
          spoiledAmount: prev.volume,
        }))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [openVial])

  // Real-time ticking countdown - HIDDEN
  const [timeLeft, setTimeLeft] = useState("Not opened")

  useEffect(() => {
    if (!openVial.openedAt || openVial.spoiled || openVial.completed) return

    const tick = () => {
      const elapsed = Date.now() - openVial.openedAt
      const sixHours = 6 * 60 * 60 * 1000
      const remaining = sixHours - elapsed

      if (remaining <= 0) {
        setOpenVial((prev) => ({
          ...prev,
          spoiled: true,
          status: "Spoiled",
          spoiledAmount: prev.volume,
        }))
        setTimeLeft("Expired")
        return
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60))
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      )
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [openVial.openedAt, openVial.spoiled, openVial.completed])

  // 💉 Give ID dose (HIDDEN) - kept for calculations
  const handleIDDose = () => {
    if (openVial.spoiled || openVial.completed) return
    setOpenVial((prev) => {
      const newVolume = Number.parseFloat((prev.volume - 0.1).toFixed(1))

      if (newVolume <= 0) {
        setOpenVial({
          ...prev,
          volume: 0.0,
          status: "Completed",
          completed: true,
        })

        setTimeout(() => {
          setOpenVial({
            ...prev,
            volume: 1.0,
            status: "Closed",
            openedAt: null,
            spoiled: false,
            completed: false,
            spoiledAmount: 0,
          })
        }, 3000)
        return { ...prev, volume: 0.0, completed: true, status: "Completed" }
      }

      return {
        ...prev,
        volume: newVolume,
        status: "Opened",
        openedAt: prev.openedAt || Date.now(),
      }
    })
  }

  // 💉 Give IM dose (HIDDEN) - kept for calculations
  const handleIMDose = () => {
    if (stock.vaxirab <= 0) return
    setStock((prev) => ({ ...prev, vaxirab: prev.vaxirab - 1 }))
    setUnopenedVial({
      ...unopenedVial,
      status: "Completed",
      completed: true,
    })

    setTimeout(() => {
      setUnopenedVial({
        name: "Vaxirab N",
        status: "Closed",
        spoiled: false,
        completed: false,
      })
    }, 30000)
  }

  // ➕ Add stock
  const handleAddStock = () => {
    const amount = Number.parseInt(newStock)
    if (!isNaN(amount) && amount > 0) {
      setStock((prev) => ({
        ...prev,
        [selectedVaccine]: (prev[selectedVaccine] || 0) + amount,
      }))

      const vaccine = VACCINES.find((v) => v.id === selectedVaccine)
      setLogs((prev) => [
        {
          id: prev.length + 1,
          timestamp: new Date().toLocaleString(),
          action: "Stock Added",
          vaccine: vaccine?.name || "Unknown",
          amount: amount,
          user: "Admin",
        },
        ...prev,
      ])

      setShowCreateForm(false)
      setNewStock("")
    }
  }

  // 📝 Log a dose administration
  const handleLogDose = (vaccineId, doseType) => {
    const vaccine = VACCINES.find((v) => v.id === vaccineId)
    if (!vaccine) return

    setLogs((prev) => [
      {
        id: prev.length + 1,
        timestamp: new Date().toLocaleString(),
        action: `Dose Administered (${doseType})`,
        vaccine: vaccine.name,
        amount: 1,
        user: "Rabvaxx Staff",
      },
      ...prev,
    ])

    // Decrease stock
    setStock((prev) => ({
      ...prev,
      [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - 1),
    }))
  }

  const reduceInventoryByRoute = (vaccineId, route) => {
    const vaccine = VACCINES.find((v) => v.id === vaccineId)
    if (!vaccine) return

    const amount = route === "ID" ? 0.1 : 1 // ID: 0.1mL, IM: 1mL
    const doseType = route === "ID" ? "ID" : "IM"

    setLogs((prev) => [
      {
        id: prev.length + 1,
        timestamp: new Date().toLocaleString(),
        action: `Dose Administered (${doseType})`,
        vaccine: vaccine.name,
        amount: amount,
        user: "Rabvaxx Staff",
      },
      ...prev,
    ])

    // Decrease stock (for ID, we reduce by 0.1 unit; for IM, by 1 unit)
    setStock((prev) => ({
      ...prev,
      [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - amount),
    }))
  }

  return (
    <div className="invDiv">
      <div className="container">
        <h2>Vaccine Inventory Management</h2>

        <div className="tabButtons">
          <button className={activeTab === "stock" ? "activeTab" : ""} onClick={() => setActiveTab("stock")}>
            Stock
          </button>
          <button className={activeTab === "logs" ? "activeTab" : ""} onClick={() => setActiveTab("logs")}>
            Logs
          </button>
        </div>

        {/* --- STOCK TAB --- */}
        {activeTab === "stock" && (
          <div className="tabContent">
            <h3>Vaccine Stock Management</h3>

            <div className="vaccineGrid">
              {VACCINES.map((vaccine) => (
                <div key={vaccine.id} className="vaccineCard">
                  <div className="vaccineHeader">
                    <h4>{vaccine.name}</h4>
                    <span className="category">{vaccine.category}</span>
                  </div>
                  <div className="vaccineInfo">
                    <p className="stockAmount">
                      <strong>{stock[vaccine.id] || 0}</strong> units
                    </p>
                  </div>
                  <div className="vaccineActions">
                    <button
                      className="doseBtn"
                      onClick={() => handleLogDose(vaccine.id, "IM")}
                      disabled={stock[vaccine.id] <= 0}
                    >
                      Administer Dose
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="actionButtons">
              <button className="createBtn" onClick={() => setShowCreateForm(true)}>
                Add Stock
              </button>
            </div>

            {showCreateForm && (
              <div className="popup">
                <div className="popupForm">
                  <h4>Add Stock</h4>
                  <div className="formGroup">
                    <label>Select Vaccine:</label>
                    <select value={selectedVaccine} onChange={(e) => setSelectedVaccine(e.target.value)}>
                      {VACCINES.map((vaccine) => (
                        <option key={vaccine.id} value={vaccine.id}>
                          {vaccine.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="formGroup">
                    <label>Amount:</label>
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                    />
                  </div>
                  <div className="popupActions">
                    <button onClick={handleAddStock} className="addBtn">
                      Add
                    </button>
                    <button onClick={() => setShowCreateForm(false)} className="cancelBtn">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- LOGS TAB --- */}
        {activeTab === "logs" && (
          <div className="tabContent">
            <h3>Activity Logs</h3>
            <div className="logsScrollContainer">
              {logs.length > 0 ? (
                <table className="logsTable">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Vaccine</th>
                      <th>Amount</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.timestamp}</td>
                        <td>{log.action}</td>
                        <td>{log.vaccine}</td>
                        <td>{log.amount}</td>
                        <td>{log.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No activity logs yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
