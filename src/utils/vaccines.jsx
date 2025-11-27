// src/utils/vaccines.js

export const VACCINE_MAP = {
  vaxirab: {
    name: "Vaxirab N",
    category: "Anti-Rabies",
    routes: ["ID", "IM"],
    groups: ["Pre-Prophylaxis", "Post-Prophylaxis", "Booster"],
  },

  pcv13: {
    name: "PCV13",
    category: "Pneumonia Vaccine",
    routes: ["IM"],
  },

  ppsv23: {
    name: "PPSV23",
    category: "Pneumonia Vaccine",
    routes: ["IM"],
  },

  tetanus: {
    name: "Tetanus Toxoid",
    category: "Anti-Tetanus",
    routes: ["IM"],
  },

  htig: {
    name: "HTIG",
    category: "Anti-Tetanus",
    routes: ["IM"],
  },

  ats: {
    name: "ATS",
    category: "Anti-Tetanus",
    routes: ["IM"],
  },

  hepab: {
    name: "Hepa B Vaccine",
    category: "Hepatitis B",
    routes: ["IM"],
  },

  flu: {
    name: "Flu Vaccine",
    category: "Influenza",
    routes: ["IM"], 
  },
};

// Convert to a simple array if needed
export const VACCINES = Object.entries(VACCINE_MAP).map(([id, data]) => ({
  id,
  ...data,
}));