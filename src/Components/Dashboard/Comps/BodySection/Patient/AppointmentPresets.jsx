import React, { useState } from "react";

const PRESETS = {
  // POST EXPOSURE
  site_id: { label: "Site Intradermal (D0, D3, D7, D30)", route: "ID", days: [0,3,7,30], type: "PEP" },
  ipc_id: { label: "IPC ID (D0, D3, D7)", route: "ID", days: [0,3,7], type: "PEP" },
  zagreb_im: { label: "Zagreb IM (D0, D7, D30)", route: "IM", days: [0,7,30], type: "PEP" },
  short_im: { label: "Shortened IM (D0, D3, D7, D14)", route: "IM", days: [0,3,7,14], type: "PEP" },
  trc_id: { label: "TRC ID (D0, D3, D7, D30)", route: "ID", days: [0,3,7,30], type: "PEP" },
  esen_im: { label: "ESEN Regimen IM (D0, D3, D7, D14, D30)", route: "IM", days: [0,3,7,14,30], type: "PEP" },

  // PRE EXPOSURE
  pre_id: { label: "Pre-Exposure ID (D0, 7, 30)", route: "ID", days: [0,7,30], type: "PrEP" },
  pre_im: { label: "Pre-Exposure IM (D0, 7, 30)", route: "IM", days: [0,7,30], type: "PrEP" },

  // CLINIC CUSTOM
  clinic_custom: { label: "Clinic custom", type: "ALL" }
};

function dayLabel(day) {
  return day === 0 ? "D0" : `D${day}`;
}

export default function AppointmentPresets({ applyPreset, prophylaxisType }) {
  const [selected, setSelected] = useState("");
  const [showDefault, setShowDefault] = useState(false);
  const [customDays, setCustomDays] = useState({
    0: true,
    3: false,
    7: false,
    14: false,
    30: false
  });

  // Booster auto-selects Clinic Custom
  React.useEffect(() => {
  // Reset when switching types
  setSelected("");
  setShowDefault(false);
}, [prophylaxisType]);

  // Filter presets based on prophylaxis type
  const visiblePresets = Object.entries(PRESETS).filter(([key, def]) => {
    if (prophylaxisType === "Post Exposure Prophylaxis") return def.type === "PEP" || def.type === "ALL";
    if (prophylaxisType === "Pre Exposure Prophylaxis") return def.type === "PrEP" || def.type === "ALL";
    if (prophylaxisType === "Booster") return def.type === "ALL"; // only Clinic Custom
    return false;
  });

  const handleSelect = (key) => {
    // Once any preset is chosen, show default
    if (!key.startsWith("default")) setShowDefault(true);

    setSelected(key);

    // Handle defaults
    if (key === "default_pep") {
      applyPreset("clinic_custom", [0, 3, 7, 14, 30]);
      return;
    }
    if (key === "default_prep") {
      applyPreset("clinic_custom", [0, 7, 30]);
      return;
    }
    if (key === "default_booster") {
      applyPreset("clinic_custom", [0, 3, 7]);
      return;
    }

    // Normal presets
    if (key !== "clinic_custom") {
      const preset = PRESETS[key];
      if (preset) applyPreset(key, preset.days);
      return;
    }

    // Clinic custom
    const selectedDays = Object.keys(customDays)
      .filter((d) => customDays[d])
      .map(Number);

    applyPreset("clinic_custom", selectedDays);
  };

  const toggleCustomDay = (d) => {
    setCustomDays((prev) => ({ ...prev, [d]: !prev[d] }));
  };

  const handleApplyCustom = () => {
    const selectedDays = Object.keys(customDays)
      .filter((k) => customDays[k])
      .map(Number);

    setSelected("clinic_custom");
    setShowDefault(true);
    applyPreset("clinic_custom", selectedDays);
  };

  return (
    <div className="preset-wrapper" style={{ marginBottom: "12px" }}>
      <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
        Apply schedule preset
      </label>

      {/* Dropdown */}
      <select
        value={selected}
        onChange={(e) => handleSelect(e.target.value)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          marginBottom: "10px"
        }}
      >
        <option value="" disabled>Select preset</option>

        {/* Default schedules appear ONLY after a preset is chosen */}
        {showDefault && prophylaxisType === "Post Exposure Prophylaxis" && (
          <option value="default_pep">Restore Default (D0, D3, D7, D14, D30)</option>
        )}

        {showDefault && prophylaxisType === "Pre Exposure Prophylaxis" && (
          <option value="default_prep">Restore Default (D0, D7, D30)</option>
        )}

        {showDefault && prophylaxisType === "Booster" && (
          <option value="default_booster">Restore Default (D0, D3, D7)</option>
        )}

        {/* Show presets */}
        {visiblePresets.map(([key, preset]) => (
          <option key={key} value={key}>{preset.label}</option>
        ))}
      </select>

      {/* Clinic custom section */}
      {selected === "clinic_custom" && (
        <div style={{ marginTop: 10, padding: 8, border: "1px dashed #ddd", borderRadius: 6 }}>
          <div style={{ marginBottom: 6 }}>Choose days to include (D0 - D30)</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {[0, 3, 7, 14, 30].map((d) => (
              <label key={d} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={!!customDays[d]} onChange={() => toggleCustomDay(d)} />
                <span>{dayLabel(d)}</span>
              </label>
            ))}

            <button type="button" onClick={handleApplyCustom} style={{ padding: "6px 10px", marginLeft: 8 }}>
              Apply custom
            </button>
          </div>

          <div style={{ fontSize: 13, marginTop: 8, color: "#444" }}>
            Tip: D0 is always included by default.
          </div>
        </div>
      )}
    </div>
  );
}
