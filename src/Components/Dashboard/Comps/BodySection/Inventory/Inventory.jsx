import React, { useState, useEffect } from "react";
import "./Inventory.css";
import { VACCINES } from "../../../../../utils/vaccines";
import { useToast } from "../../../../../utils/Toast";
import { invoke } from "@tauri-apps/api/core";
import { inventoryManager } from "../../../../../utils/inventoryManager";



export default function Inventory() {
  const [activeTab, setActiveTab] = useState("stock");
  const toast = useToast();
  // stock object keyed by vaccine id
  const [stock, setStock] = useState(() => {
    const initial = {};
    (VACCINES || []).forEach((v) => (initial[v.id] = 0));
    return initial;
  });

  // logs from inventory_logs table
  const [logs, setLogs] = useState([]);
  const [newStock, setNewStock] = useState("");
  const [selectedVaccine, setSelectedVaccine] = useState((VACCINES && VACCINES[0] && VACCINES[0].id) || "vaxirab");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal state for editing absolute stock
  const [editingVaccine, setEditingVaccine] = useState(null);
  const [editAmountInput, setEditAmountInput] = useState("");

  // load inventory rows from SQLite via Tauri
  const loadInventory = async () => {
    try {
      setLoading(true);
      const rows = await invoke("get_inventory"); // [{id, name, amount, last_edited}, ...]
      const newStock = {};
      (rows || []).forEach((r) => {
        newStock[r.id] = Number(r.amount ?? 0);
      });
      setStock((prev) => ({ ...prev, ...newStock }));
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // load inventory logs
  const loadLogs = async () => {
    try {
      const rows = await invoke("get_inventory_logs"); // expects [{id, timestamp, action, vaccine, amount, user}, ...]
      setLogs(rows || []);
    } catch (err) {
      console.error("Failed to load inventory logs:", err);
    }
  };

  // on mount, load DB and wire inventoryManager
  useEffect(() => {
    const refresh = async () => {
      await Promise.all([loadInventory(), loadLogs()]);
    };
    refresh();
    inventoryManager.setInventoryState({ refresh });
  }, []);

  // Add stock (UI)
  const handleAddStock = async () => {
  const amount = Number.parseFloat(newStock);
  if (Number.isNaN(amount) || amount <= 0) return toast.show("Enter a positive amount","warning");

  try {
    // persist change
    await invoke("change_inventory_amount", { id: selectedVaccine, delta: amount });

    // add a log row in sqlite
    await invoke("add_inventory_log", {
      action: "Stock Added",
      vaccine: selectedVaccine,
      amount: amount,
      user: "Rabvaxx Staff",
    });

    // optimistic UI update
    setStock((prev) => ({
      ...prev,
      [selectedVaccine]: (prev[selectedVaccine] || 0) + amount,
    }));

    setLogs((prev) => [
      {
        id: Date.now(), // temporary ID
        timestamp: new Date().toLocaleString(),
        action: "Stock Added",
        vaccine: selectedVaccine,
        amount,
        user: "Rabvaxx Staff",
      },
      ...prev,
    ]);

    setNewStock("");
    setShowCreateForm(false);

  } catch (err) {
    console.error("Failed to add stock:", err);
    toast.show("Failed to add stock: " + err,"error");
  }
};


  // Log a dose (IM / ID) from UI table
  const handleLogDose = async (vaccineId, doseType = "IM") => {
    const amount = doseType === "ID" ? 0.1 : 1;
    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta: -amount });

      await invoke("add_inventory_log", {
        action: `Dose Administered (${doseType})`,
        vaccine: vaccineId,
        amount: -amount,
        user: "Rabvaxx Staff",
      });

      setStock((prev) => ({ ...prev, [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - amount) }));
      setLogs((prev) => [
        {
          id: (prev && prev.length ? prev[0].id + 1 : prev.length + 1),
          timestamp: new Date().toLocaleString(),
          action: `Dose Administered (${doseType})`,
          vaccine: vaccineId,
          amount: -amount,
          user: "Doctor",
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("Failed to log dose:", err);
      toast.show("Failed to update inventory: " + err,"error");
    }
  };

  // Open edit modal (set absolute amount)
  const openEdit = (v) => {
    setEditingVaccine(v.id);
    setEditAmountInput(String(stock[v.id] ?? 0));
  };

  // Apply absolute edit: compute delta and call change_inventory_amount
  const applyEdit = async () => {
    const id = editingVaccine;
    const newAmount = Number.parseFloat(editAmountInput);
    if (Number.isNaN(newAmount) || newAmount < 0) return toast.show("Enter a valid non-negative number","warning");
    const current = Number(stock[id] ?? 0);
    const delta = newAmount - current;

    try {
      if (delta !== 0) {
        await invoke("change_inventory_amount", { id, delta });
        await invoke("add_inventory_log", {
          action: "Stock Edited",
          vaccine: id,
          amount: delta,
          user: "Rabvaxx Staff",
        });
      }

      // refresh local state (optimistic update then ensure from DB next)
      setStock((prev) => ({ ...prev, [id]: newAmount }));
      setLogs((prev) => [
        {
          id: (prev && prev.length ? prev[0].id + 1 : prev.length + 1),
          timestamp: new Date().toLocaleString(),
          action: "Stock Edited",
          vaccine: id,
          amount: delta,
          user: "Rabvaxx Staff",
        },
        ...prev,
      ]);

      setEditingVaccine(null);
      setEditAmountInput("");
    } catch (err) {
      console.error("Failed to edit stock:", err);
      toast.show("Failed to edit stock: " + err,"error");
    }
  };

  return (
    <div className="invDiv">
      <div className="container">
        <h2>Vaccine Inventory Management {loading ? "(loading...)" : ""}</h2>

        <div className="tabButtons">
          <button className={activeTab === "stock" ? "activeTab" : ""} onClick={() => setActiveTab("stock")}>
            Stock
          </button>
          <button className={activeTab === "logs" ? "activeTab" : ""} onClick={() => setActiveTab("logs")}>
            Logs
          </button>
          <button className="createBtn" onClick={() => setShowCreateForm(true)}>
            Add Stock
          </button>
        </div>

        {activeTab === "stock" && (
          <div className="tabContent">
            <h3>Vaccine Stock</h3>

            <table className="stockTable">
              <thead>
                <tr>
                  <th>Vaccine</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {VACCINES.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.category}</td>
                    <td>{Number((stock[v.id] ?? 0)).toFixed(1)}</td>
                    <td>
                      <button onClick={() => openEdit(v)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {showCreateForm && (
              <div className="popup">
                <div className="popupForm">
                  <h4>Add Stock</h4>

                  <div className="formGroup">
                    <label>Select Vaccine:</label>
                    <select value={selectedVaccine} onChange={(e) => setSelectedVaccine(e.target.value)}>
                      {VACCINES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="formGroup">
                    <label>Amount:</label>
                    <input type="number" placeholder="Enter amount" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
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

            {/* Edit modal */}
            {editingVaccine && (
              <div className="popup">
                <div className="popupForm">
                  <h4>Edit Stock for {VACCINES.find((x) => x.id === editingVaccine)?.name}</h4>
                  <div className="formGroup">
                    <label>Amount (absolute):</label>
                    <input type="number" value={editAmountInput} onChange={(e) => setEditAmountInput(e.target.value)} />
                  </div>
                  <div className="popupActions">
                    <button onClick={applyEdit} className="addBtn">Save</button>
                    <button onClick={() => setEditingVaccine(null)} className="cancelBtn">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
                    {logs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.timestamp}</td>
                        <td>{log.action}</td>
                        <td>{VACCINES.find((x) => x.id === log.vaccine)?.name || log.vaccine}</td>
                        <td>{Number(log.amount).toFixed(1)}</td>
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
  );
}
