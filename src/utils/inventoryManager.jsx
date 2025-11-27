import { invoke } from "@tauri-apps/api/core";

export const inventoryManager = {
  _state: null,

  setInventoryState(state) {
    this._state = state;
  },

  // ------------------------------------
  // 🔵 ANTI-RABIES (IM = 1, ID = 0.1)
  // ------------------------------------
  async reduceByRoute(vaccineId, route = "IM") {
    const amount = route === "ID" ? 0.1 : 1;

    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta: -amount });

      await invoke("add_inventory_log", {
        action: `Dose Administered (${route})`,
        vaccine: vaccineId,
        amount: -amount,
        user: "Doctor",
      });

      if (this._state?.refresh) await this._state.refresh();

    } catch (err) {
      console.error("reduceByRoute fallback:", err);

      const { setStock } = this._state || {};
      if (setStock) {
        setStock(prev => ({
          ...prev,
          [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - amount)
        }));
      }
    }
  },

  // ------------------------------------
  // 🟢 REGULAR VACCINES — ALWAYS 1
  // ------------------------------------

  // TAKE 1 dose
  async takeRegular(vaccineId) {
    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta: -1 });

      await invoke("add_inventory_log", {
        action: "Regular Dose Used",
        vaccine: vaccineId,
        amount: -1,
        user: "Doctor",
      });

      if (this._state?.refresh) await this._state.refresh();

    } catch (err) {
      console.error("takeRegular fallback:", err);

      const { setStock } = this._state || {};
      if (setStock) {
        setStock(prev => ({
          ...prev,
          [vaccineId]: Math.max(0, (prev[vaccineId] || 0) - 1)
        }));
      }
    }
  },

  // RESTORE 1 dose
  async restoreRegular(vaccineId) {
    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta: 1 });

      await invoke("add_inventory_log", {
        action: "Regular Dose Restored",
        vaccine: vaccineId,
        amount: 1,
        user: "Doctor",
      });

      if (this._state?.refresh) await this._state.refresh();

    } catch (err) {
      console.error("restoreRegular fallback:", err);

      const { setStock } = this._state || {};
      if (setStock) {
        setStock(prev => ({
          ...prev,
          [vaccineId]: (prev[vaccineId] || 0) + 1
        }));
      }
    }
  },

  // ------------------------------------
  // GENERAL ADD STOCK
  // ------------------------------------
  async addStock(vaccineId, amount = 1) {
    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta: amount });

      await invoke("add_inventory_log", {
        action: "Stock Dose Restored",
        vaccine: vaccineId,
        amount,
        user: "Doctor",
      });

      if (this._state?.refresh) await this._state.refresh();

    } catch (err) {
      console.error("addStock fallback:", err);

      const { setStock } = this._state || {};
      if (setStock) {
        setStock(prev => ({
          ...prev,
          [vaccineId]: (prev[vaccineId] || 0) + amount
        }));
      }
    }
  },

  // ------------------------------------
  // GENERIC REDUCE (for editing stock)
  // ------------------------------------
  async reduce(vaccineId, amount = 1) {
    const delta = -Math.abs(amount);

    try {
      await invoke("change_inventory_amount", { id: vaccineId, delta });

      await invoke("add_inventory_log", {
        action: "Stock Adjusted",
        vaccine: vaccineId,
        amount: delta,
        user: "Rabvaxx Staff",
      });

      if (this._state?.refresh) await this._state.refresh();

    } catch (err) {
      console.error("reduce fallback:", err);

      const { setStock } = this._state || {};
      if (setStock) {
        setStock(prev => ({
          ...prev,
          [vaccineId]: Math.max(0, (prev[vaccineId] || 0) + delta)
        }));
      }
    }
  },
};
