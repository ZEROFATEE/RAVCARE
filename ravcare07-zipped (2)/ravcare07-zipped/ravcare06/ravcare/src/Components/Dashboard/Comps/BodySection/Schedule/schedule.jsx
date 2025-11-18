import { useState, useEffect, useMemo, useRef } from "react"
import "./Schedule.css"
import { RiPencilFill } from "react-icons/ri"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import { invoke } from "@tauri-apps/api/core"
import { useNavigate, useLocation } from "react-router-dom"

// Fetch appointments for a patient
async function getAppointments(patientId) {
  return await invoke("get_appointments", { patientId })
}

// helper: YYYY-MM-DD from a Date object using local date parts (not ISO/UTC)
const dateObjToDateStr = (d = new Date()) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const Schedule = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedPatient: fromPatient, refresh } = location.state || {}

  const [time, setTime] = useState(new Date().toLocaleTimeString())
  const [date, setDate] = useState(new Date())
  const [patients, setPatients] = useState([])
  const [filteredAppointments, setFilteredAppointments] = useState([])
  const [activeTab, setActiveTab] = useState("appointments")

  const [showEditPopup, setShowEditPopup] = useState(false)
  const [selectedDate, setSelectedDate] = useState(dateObjToDateStr())
  const [selectedPatient, setSelectedPatient] = useState(fromPatient || null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const [appointments, setAppointments] = useState([])
  const [finished, setFinished] = useState([])
  const [missed, setMissed] = useState([])

  const intervalRef = useRef(null)
  const hasTriggeredTodayKey = (d) => `autoMissTriggered_${d}`
  const [missedNotice, setMissedNotice] = useState("");
  const [missedCount, setMissedCount] = useState(0);

  const normalizeToDateStr = (val) => {
  if (!val) return null;
  const match = String(val).match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(val);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const [showReschedPopup, setShowReschedPopup] = useState(false);
const [newDate, setNewDate] = useState("");
const [apptToResched, setApptToResched] = useState(null);

const handleReschedule = (appointment) => {
  if (!appointment) {
    alert("No appointment selected to reschedule!");
    return;
  }
  setApptToResched(appointment);
  setNewDate("");
  setShowReschedPopup(true);
};

const confirmReschedule = async () => {
  if (!apptToResched || !newDate) {
    alert("Please select a new date!");
    return;
  }

  try {
    const updatedAppt = { ...apptToResched };

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    const parseYMD = (s) => {
      if (!s) return null;
      const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // local midnight
    };

    const newDateObj = parseYMD(newDate);
    if (!newDateObj) {
      alert("Invalid new date.");
      return;
    }

    const dateStrNorm = (v) => normalizeToDateStr(v);

    const dayFields = [
      ["day_zero_date", "day_zero_status"],
      ["day_three_date", "day_three_status"],
      ["day_seven_date", "day_seven_status"],
      ["day_fourteen_date", "day_fourteen_status"],
      ["day_thirty_date", "day_thirty_status"],
    ];

    const hepaFields = [
      ["hepa_b_dose1", "hepa_b_status1"],
      ["hepa_b_dose2", "hepa_b_status2"],
      ["hepa_b_dose3", "hepa_b_status3"],
    ];

    const DAY_MS = 24 * 60 * 60 * 1000;
    const diffDays = (to, from) =>
      Math.round((to.getTime() - from.getTime()) / DAY_MS);

    let rescheduledSomething = false;

    // ──────────────────────────────────────────────
    // 1) ANTI-RABIES: detect missed dose *directly*
    // ──────────────────────────────────────────────

    const missedDoseInfo = dayFields.find(
      ([dateField, statusField]) =>
        (apptToResched[statusField] || "").toLowerCase() === "missed"
    );

    if (missedDoseInfo) {
      const [missedField, missedStatusField] = missedDoseInfo;

      for (let i = 0; i < dayFields.length; i++) {
        const [dateField, statusField] = dayFields[i];

        if (dateField !== missedField) continue;

        const oldDateStr = dateStrNorm(apptToResched[dateField]);
        const oldDateObj = parseYMD(oldDateStr);

        if (!oldDateObj) break;

        const shift = diffDays(newDateObj, oldDateObj);

        // Update missed dose
        updatedAppt[dateField] = dateObjToDateStr(newDateObj);
        updatedAppt[statusField] = "🟡 Pending";

        // Shift all later doses
       // Recalculate all later doses based on *original intervals* from D0
// ✅ Only reschedule *non-done* doses *after* the missed one
// ✅ Preserve original intervals between remaining doses

const intervals = [0, 3, 7, 14, 30]; // ARV day offsets
const missedIndex = i; // index of the missed dose (e.g. D3 → i=1)

let firstNonDoneIndex = null;
for (let j = missedIndex; j < dayFields.length; j++) {
  const [, statusField] = dayFields[j];
  const status = (updatedAppt[statusField] || "").toLowerCase();
  if (!["✔️ done", "done"].includes(status)) {
    firstNonDoneIndex = j;
    break;
  }
}

if (firstNonDoneIndex === null) {
  alert("All later doses are already done — nothing to reschedule.");
  return;
}

// ✅ Reschedule *only* from first non-done dose onward
const baseDate = newDateObj; // new date for the missed dose
const baseInterval = intervals[firstNonDoneIndex];

for (let j = firstNonDoneIndex; j < dayFields.length; j++) {
  const [dateField, statusField] = dayFields[j];
  const originalInterval = intervals[j] - baseInterval;
  const newDate = new Date(baseDate);
  newDate.setDate(baseDate.getDate() + originalInterval);

  updatedAppt[dateField] = dateObjToDateStr(newDate);
  updatedAppt[statusField] = "🟡 Pending";
}

        rescheduledSomething = true;
        break;
      }
    }

    // ──────────────────────────────────────────────
    // 2) REGULAR SINGLE-SHOT (not Hepa B)
    // ──────────────────────────────────────────────

    if (!rescheduledSomething) {
      if (
        apptToResched.regular_type &&
        apptToResched.regular_type !== "Hepa B Vaccine"
      ) {
        const status = (apptToResched.regular_status || "").toLowerCase();
        if (status === "missed") {
          updatedAppt.regular_date = dateObjToDateStr(newDateObj);
          updatedAppt.regular_status = "🟡 Pending";
          rescheduledSomething = true;
        }
      }
    }

    // ──────────────────────────────────────────────
    // 3) HEPATITIS B (3 DOSE)
    // ──────────────────────────────────────────────

    if (!rescheduledSomething) {
      const missedHepa = hepaFields.find(
        ([dateField, statusField]) =>
          (apptToResched[statusField] || "").toLowerCase() === "missed"
      );

      if (missedHepa) {
        const [missedField, missedStatus] = missedHepa;

        for (let i = 0; i < hepaFields.length; i++) {
          const [dateField, statusField] = hepaFields[i];

          if (dateField !== missedField) continue;

          const oldDateStr = dateStrNorm(apptToResched[dateField]);
          const oldDateObj = parseYMD(oldDateStr);
          const shift = diffDays(newDateObj, oldDateObj);

          updatedAppt[dateField] = dateObjToDateStr(newDateObj);
          updatedAppt[statusField] = "🟡 Pending";

          // Shift later doses
          // ✅ Hepa B: reschedule only *non-done* doses *after* the missed one
// ✅ Use real-world 1-month / 6-month offsets from Dose 1

const missedIdx = i; // 0, 1, or 2

let firstNonDoneIdx = null;
for (let j = missedIdx; j < hepaFields.length; j++) {
  const [, statusField] = hepaFields[j];
  const status = (updatedAppt[statusField] || "").toLowerCase();
  if (!["✔️ done", "done"].includes(status)) {
    firstNonDoneIdx = j;
    break;
  }
}

if (firstNonDoneIdx === null) {
  alert("All later Hepa B doses are already done — nothing to reschedule.");
  return;
}

// ✅ Anchor: Dose 1 date
const dose1Date = parseYMD(dateStrNorm(updatedAppt.hepa_b_dose1));
if (!dose1Date) {
  alert("Dose 1 date is missing — cannot reschedule.");
  return;
}

// ✅ Real-world month offsets from Dose 1
const monthOffsets = [0, 1, 6]; // months after Dose 1

for (let j = firstNonDoneIdx; j < hepaFields.length; j++) {
  const [dateField, statusField] = hepaFields[j];
  const newDate = new Date(dose1Date);
  newDate.setMonth(dose1Date.getMonth() + monthOffsets[j]);

  updatedAppt[dateField] = dateObjToDateStr(newDate);
  updatedAppt[statusField] = "🟡 Pending";
}

          rescheduledSomething = true;
          break;
        }
      }
    }

    // If nothing matched
    if (!rescheduledSomething) {
      alert("Only missed appointments can be rescheduled!");
      return;
    }

    updatedAppt.last_rescheduled_from = dateObjToDateStr(new Date());

    await invoke("update_appointment", { appointment: updatedAppt });

    setShowReschedPopup(false);
    setShowEditPopup(false);
    localStorage.setItem("refreshScheduleFlag", Date.now().toString());
    window.dispatchEvent(new Event("refreshSchedule"));
    await loadAppointmentsForSelectedDate();

    alert("✅ Appointment rescheduled successfully!");
  } catch (err) {
    console.error("Failed to reschedule:", err);
    alert("❌ Failed to reschedule: " + err);
  }
};



// Unlock next day when current day is done
const unlockNextDayIfReady = (appt) => {
  const dayOrder = [
    ["day_zero_date", "day_zero_status"],
    ["day_three_date", "day_three_status"],
    ["day_seven_date", "day_seven_status"],
    ["day_fourteen_date", "day_fourteen_status"],
    ["day_thirty_date", "day_thirty_status"],
  ];

  const updated = { ...appt };
  for (let i = 0; i < dayOrder.length - 1; i++) {
    const [curDate, curStatus] = dayOrder[i];
    const [nextDate, nextStatus] = dayOrder[i + 1];

    // If this day is done, unlock the next one if it's not done or missed
    if ((updated[curStatus] || "").toLowerCase().includes("done")) {
      if (
        updated[nextDate] &&
        ["pending", "🟡 pending", "", null, undefined].includes(
          (updated[nextStatus] || "").toLowerCase()
        )
      ) {
        updated[nextStatus] = "🟡 Pending";
      }
    }
  }
  return updated;
};



  // Collect all schedule-like date strings for an appointment (normalized)
// ✅ Fixed: includes Pending + Upcoming appointments on the calendar
const getApptScheduledDateStrings = (appt) => {
  if (!appt) return [];

  const dayPairs = [
    ["day_zero_date", "day_zero_status"],
    ["day_three_date", "day_three_status"],
    ["day_seven_date", "day_seven_status"],
    ["day_fourteen_date", "day_fourteen_status"],
    ["day_thirty_date", "day_thirty_status"],
  ];

  const arr = [];

  // 🟦 Anti-rabies full schedule
  for (const [dateField, statusField] of dayPairs) {
    const dateVal = normalizeToDateStr(appt[dateField]);
    const statusVal = (appt[statusField] || "").toLowerCase();
    if (!dateVal) continue;
    if (statusVal !== "rescheduled") arr.push(dateVal);
  }

  // 🟩 Main ARV schedule
  if (appt.schedule) {
    const ds = normalizeToDateStr(appt.schedule);
    if (ds) arr.push(ds);
  }

  // 🟧 REGULAR VACCINES: single dose
  if (appt.regular_date) {
    const ds = normalizeToDateStr(appt.regular_date);
    if (ds) arr.push(ds);
  }

  // 🟨 Hepatitis B multi-dose series
 // 🟨 HEPATITIS B MULTI-DOSE SERIES
const hepaPairs = [
  ["hepa_b_dose1", "hepa_b_status1"],
  ["hepa_b_dose2", "hepa_b_status2"],
  ["hepa_b_dose3", "hepa_b_status3"],
];

for (const [doseField, statusField] of hepaPairs) {
  const ds = normalizeToDateStr(appt[doseField]);
  const s = (appt[statusField] || "").toLowerCase();

  if (!ds) continue;

  // INCLUDE ALL DOSES (pending, missed, done, upcoming)
  // EXCEPT rescheduled/nullified ones.
  if (s !== "rescheduled") {
    arr.push(ds);
  }
}




  return Array.from(new Set(arr)).sort();
};



// Map selected date to the correct day_*_status field
const getStatusFieldForDate = (appt, selectedDate) => {
  const dayMap = {
    day_zero_date: "day_zero_status",
    day_three_date: "day_three_status",
    day_seven_date: "day_seven_status",
    day_fourteen_date: "day_fourteen_status",
    day_thirty_date: "day_thirty_status",
  };

  // 🟢 Try to find an exact match with a day_* field
  for (const [dateField, statusField] of Object.entries(dayMap)) {
    const normalizedDate = normalizeToDateStr(appt[dateField]);
    if (normalizedDate && normalizedDate === selectedDate) {
      return statusField;
    }
  }

   // 🟩 REGULAR ONE-SHOT VACCINES  ← MOVE THIS SECTION UP
  if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
    if (normalizeToDateStr(appt.regular_date) === selectedDate) {
      return "regular_status";
    }
  }

  // 🟨 HEPATITIS B MULTI-DOSE  ← MOVE THIS UP TOO
  if (appt.regular_type === "Hepa B Vaccine") {
    if (normalizeToDateStr(appt.hepa_b_dose1) === selectedDate) return "hepa_b_status1";
    if (normalizeToDateStr(appt.hepa_b_dose2) === selectedDate) return "hepa_b_status2";
    if (normalizeToDateStr(appt.hepa_b_dose3) === selectedDate) return "hepa_b_status3";
  }

  // ❌ REMOVE / MODIFY THIS:
  const hasAnyDayField = Object.keys(dayMap).some((f) => appt[f]);
  if (!hasAnyDayField && normalizeToDateStr(appt.schedule) === selectedDate) {
    return "status"; // ← WRONG FOR REGULAR/HEPA
  }

  return null;
};


  const loadAppointmentsForSelectedDate = async () => {
  try {
    const data = await invoke("get_patients_cmd");
    const patientsWithAppointments = await Promise.all(
      data.map(async (p) => {
        const appts = await getAppointments(p.id);
        const normalized = (appts || []).map((a) => ({
          ...a,
          status: (a.status || a.schedule_status || "🟡 Pending").trim(),
        }));
        return { ...p, appointments: normalized };
      })
    );

    setPatients(patientsWithAppointments);

    const allA = patientsWithAppointments.flatMap((p) => p.appointments || []);
    const normalizeStatus = (s) => (s || "").toLowerCase();

    setFinished(allA.filter((a) => normalizeStatus(a.status) === "finished"));
    setMissed(allA.filter((a) => normalizeStatus(a.status) === "missed"));
    setAppointments(
      allA.filter(
        (a) => !["finished", "missed"].includes(normalizeStatus(a.status))
      )
    );
  } catch (err) {
    console.error("[loadAppointmentsForSelectedDate] Error reloading:", err);
  }
};

  useEffect(() => {
  let lastFlag = localStorage.getItem("refreshScheduleFlag");

  const handleVisibility = async () => {
    const newFlag = localStorage.getItem("refreshScheduleFlag");
    if (newFlag && newFlag !== lastFlag) {
      lastFlag = newFlag;
      await loadAppointmentsForSelectedDate(); // your existing refresh logic
    }
  };

  window.addEventListener("focus", handleVisibility);
  const interval = setInterval(handleVisibility, 2000); // check every 2 seconds

  return () => {
    window.removeEventListener("focus", handleVisibility);
    clearInterval(interval);
  };
}, []);

// 🔄 React to refresh events triggered by Patient.jsx
// 🔄 React to refresh events triggered by Patient.jsx
useEffect(() => {
  const handleRefresh = async () => {
    console.log("🔁 Schedule refresh triggered from Patient.jsx");

    try {
      const data = await invoke("get_patients_cmd");
      const patientsWithAppointments = await Promise.all(
        data.map(async (p) => {
          const appts = await getAppointments(p.id);
          const normalized = (appts || []).map((a) => ({
            ...a,
            status: (a.status || a.schedule_status || "🟡 Pending").trim(),
          }));
          return { ...p, appointments: normalized };
        })
      );

      setPatients(patientsWithAppointments);

      // Recalculate lists
      const allA = patientsWithAppointments.flatMap((p) => p.appointments || []);
      const normalizeStatus = (s) => (s || "").toLowerCase();

      setFinished(allA.filter((a) => normalizeStatus(a.status) === "finished"));
      setMissed(allA.filter((a) => normalizeStatus(a.status) === "missed"));
      setAppointments(
        allA.filter(
          (a) => !["finished", "missed"].includes(normalizeStatus(a.status))
        )
      );
    } catch (err) {
      console.error("[refreshSchedule] reload failed:", err);
    }
  };

  window.addEventListener("refreshSchedule", handleRefresh);
  return () => window.removeEventListener("refreshSchedule", handleRefresh);
}, []);

useEffect(() => {
  if (!patients.length || !selectedDate) {
    setMissedNotice("");
    setMissedCount(0);
    return;
  }

  const missedForDate = patients.flatMap((p) => {
    return (p.appointments || [])
      .filter((a) => {
        const lower = (s) => (s || "").trim().toLowerCase();
        const norm = (v) => normalizeToDateStr(v);

        // 🟥 ANTI-RABIES D0–D30
        const arvMissed = [
          ["day_zero_date", "day_zero_status"],
          ["day_three_date", "day_three_status"],
          ["day_seven_date", "day_seven_status"],
          ["day_fourteen_date", "day_fourteen_status"],
          ["day_thirty_date", "day_thirty_status"],
        ].some(([dField, sField]) =>
          norm(a[dField]) === selectedDate &&
          lower(a[sField]) === "missed"
        );

        // 🟦 REGULAR 1-SHOT
        const regularMissed =
          a.regular_type &&
          a.regular_type !== "Hepa B Vaccine" &&
          norm(a.regular_date) === selectedDate &&
          lower(a.regular_status) === "missed";

        // 🟨 HEPA B MULTI-DOSE (3 doses)
        const hepaMissed = [
          ["hepa_b_dose1", "hepa_b_status1"],
          ["hepa_b_dose2", "hepa_b_status2"],
          ["hepa_b_dose3", "hepa_b_status3"],
        ].some(([dField, sField]) =>
          norm(a[dField]) === selectedDate &&
          lower(a[sField]) === "missed"
        );

        return arvMissed || regularMissed || hepaMissed;
      })
      .map((a) => ({
        patientName: `${p.last_name}, ${p.first_name}`,
        type:
          a.regular_type ||
          a.prophylaxis_type ||
          "General",
      }));
  });

  setMissedCount(missedForDate.length);

  if (missedForDate.length > 0) {
    setMissedNotice(
      missedForDate
        .map((m) => `- ${m.patientName} (${m.type})`)
        .join("\n")
    );
  } else {
    setMissedNotice("");
  }
}, [patients, selectedDate]);

  // Clock updater
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load patients + appointments
useEffect(() => {
  async function loadPatients() {
    try {
      const data = await invoke("get_patients_cmd");
      const patientsWithAppointments = await Promise.all(
        data.map(async (p) => {
          const appts = await getAppointments(p.id);
          // 🟩 Normalize statuses before storing
          const normalized = (appts || []).map((a) => ({
            ...a,
            status: (a.status || a.schedule_status || "🟡 Pending").trim(),
          }));
          return { ...p, appointments: normalized };
        })
      );

      setPatients(patientsWithAppointments);
      setFilteredAppointments(patientsWithAppointments);

      // 🟦 Recalculate global arrays
      const allA = patientsWithAppointments.flatMap((p) => p.appointments || []);
      const normalizeStatus = (s) => (s || "").toLowerCase();
      
      setMissedCount(missedForDate.length);
      setFinished(allA.filter((a) => normalizeStatus(a.status) === "finished"));
      setMissed(allA.filter((a) => normalizeStatus(a.status) === "missed"));
      setAppointments(
        allA.filter(
          (a) =>
            !["finished", "missed"].includes(normalizeStatus(a.status))
        )
      );
    } catch (err) {
      console.error("[Schedule] Error loading patients:", err);
    }
  }

  loadPatients();
}, [refresh]);

 // 🕒 Auto-miss checker (safe, instant + scheduled)
useEffect(() => {
  const TRIGGER_MINUTES = 17 * 60; // Default cutoff: 1:35 AM

const checkMissedAppointments = async () => {
  try {
    const now = new Date();
    const todayStr = dateObjToDateStr(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const allPatients = await invoke("get_patients_cmd");
    let anyChange = false;

    const updatedPatients = await Promise.all(
      allPatients.map(async (p) => {
        const appts = await getAppointments(p.id);
        const updatedAppts = await Promise.all(
          appts.map(async (appt) => {
            const dayFields = [
              ["day_zero_date", "day_zero_status"],
              ["day_three_date", "day_three_status"],
              ["day_seven_date", "day_seven_status"],
              ["day_fourteen_date", "day_fourteen_status"],
              ["day_thirty_date", "day_thirty_status"],
            ];

            let anyDayMissed = false;

           for (const [dateField, statusField] of dayFields) {
  const dateStr = normalizeToDateStr(appt[dateField]);
  if (!dateStr) continue;

  const currentStatus = (appt[statusField] || "").toLowerCase();
  if (["✔️ done", "done", "missed"].includes(currentStatus)) continue;

  // ⏳ Past → Auto missed
  if (dateStr < todayStr) {
    appt[statusField] = "Missed";
    anyDayMissed = true;
    continue;
  }

  // ⏰ Today → Check cutoff time
  if (dateStr === todayStr) {
    const apptTime = new Date(appt[dateField]);
    if (isNaN(apptTime.getTime()) || apptTime.getHours() === 0) {
      apptTime.setHours(17, 0, 0, 0);
    }
    const apptMinutes = apptTime.getHours() * 60 + apptTime.getMinutes();

    if (currentMinutes >= apptMinutes || currentMinutes >= TRIGGER_MINUTES) {
      appt[statusField] = "Missed";
      anyDayMissed = true;
    }
  }
}  // <-- THIS is the correct closing brace of ARV loop



// 🟩 AUTO-MISS: REGULAR 1-SHOT VACCINES
if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
  const rDate = normalizeToDateStr(appt.regular_date);
  const rStatus = (appt.regular_status || "").toLowerCase();

  if (rDate && !rStatus.includes("done")) {
    if (rDate < todayStr) {
      appt.regular_status = "Missed";
      anyDayMissed = true;
    }

    if (rDate === todayStr) {
      const apptTime = new Date(appt.regular_date);
      if (isNaN(apptTime.getTime())) apptTime.setHours(17, 0, 0, 0);

      const apptMinutes =
        apptTime.getHours() * 60 + apptTime.getMinutes();

      if (currentMinutes >= apptMinutes || currentMinutes >= TRIGGER_MINUTES) {
        appt.regular_status = "Missed";
        anyDayMissed = true;
      }
    }
  }
}



// 🟨 AUTO-MISS: HEPATITIS B (3 DOSES)
const hepaDates = [
  ["hepa_b_dose1", "hepa_b_status1"],
  ["hepa_b_dose2", "hepa_b_status2"],
  ["hepa_b_dose3", "hepa_b_status3"],
];

for (const [doseDateField, doseStatusField] of hepaDates) {
  const hDate = normalizeToDateStr(appt[doseDateField]);
  const hStatus = (appt[doseStatusField] || "").toLowerCase();

  if (!hDate) continue;
  if (["done", "✔️ done", "missed"].includes(hStatus)) continue;
  
if (hDate && hStatus !== "🟡 pending" && !hStatus.includes("done")) {
    appt[doseStatusField] = "Missed";
    anyDayMissed = true;
  }

  if (hDate === todayStr) {
    const apptTime = new Date(appt[doseDateField]);
    if (isNaN(apptTime.getTime())) {
      apptTime.setHours(17, 0, 0, 0);
    }

    const apptMinutes =
      apptTime.getHours() * 60 + apptTime.getMinutes();

    if (currentMinutes >= apptMinutes || currentMinutes >= TRIGGER_MINUTES) {
      appt[doseStatusField] = "Missed";
      anyDayMissed = true;
    }
  }
}


            if (anyDayMissed) {
              await invoke("update_appointment", { appointment: appt });
              anyChange = true;
            }

            // 🟦 Check ARV Series
const arvAllDone = dayFields.every(([_, s]) => (appt[s] || "").toLowerCase() === "✔️ done");
const arvAllMissed = dayFields.every(([_, s]) => (appt[s] || "").toLowerCase() === "missed");

// 🟩 Check Regular One-shot
let regularDone = false;
let regularMissed = false;

if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
  const s = (appt.regular_status || "").toLowerCase();
  regularDone = s.includes("done");
  regularMissed = s.includes("missed");
}

// 🟨 Check Hepa B (3 doses)
const hepaStatuses = [
  appt.hepa_b_status1?.toLowerCase() || "",
  appt.hepa_b_status2?.toLowerCase() || "",
  appt.hepa_b_status3?.toLowerCase() || "",
].filter(Boolean);

const hepaAllDone = hepaStatuses.length > 0 && hepaStatuses.every((s) => s.includes("done"));
const hepaAllMissed = hepaStatuses.length > 0 && hepaStatuses.every((s) => s === "missed");

// 🟥 Determine Overall Status
if (arvAllDone || regularDone || hepaAllDone) {
  appt.status = "Finished";
} else if (arvAllMissed || regularMissed || hepaAllMissed) {
  appt.status = "Missed";
}

            return appt;
          })
        );
        return { ...p, appointments: updatedAppts };
      })
    );

    if (anyChange) {
      setPatients(updatedPatients);
      const allAppointments = updatedPatients.flatMap((p) => p.appointments || []);
      setAppointments(allAppointments);
      setFinished(allAppointments.filter((a) => a.status === "Finished"));
      setMissed(allAppointments.filter((a) => a.status === "Missed"));
    }

    // 🎯 Find missed appointments for today
    const missedToday = updatedPatients.flatMap((p) =>
  (p.appointments || [])
    .filter((a) => {
      const today = todayStr;

      // ARV series
      const arvMissed = [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ].some(([dateField, statusField]) =>
        normalizeToDateStr(a[dateField]) === today &&
        (a[statusField] || "").toLowerCase() === "missed"
      );

      // Regular single-dose
      const regularMissed =
        a.regular_type &&
        a.regular_type !== "Hepa B Vaccine" &&
        normalizeToDateStr(a.regular_date) === today &&
        (a.regular_status || "").toLowerCase() === "missed";

      // Hepa B multi-dose
      const hepaMissed = [
        ["hepa_b_dose1", "hepa_b_status1"],
        ["hepa_b_dose2", "hepa_b_status2"],
        ["hepa_b_dose3", "hepa_b_status3"],
      ].some(([dateField, statusField]) =>
        normalizeToDateStr(a[dateField]) === today &&
        (a[statusField] || "").toLowerCase() === "missed"
      );

      return arvMissed || regularMissed || hepaMissed;
    })
    .map(() => `${p.last_name}, ${p.first_name}`)
);


    // 🗝 Track which patients were already alerted
    const dailyKey = hasTriggeredTodayKey(todayStr);
    const perPatientKey = `missedPatients_${todayStr}`;
    const alreadyAlerted = JSON.parse(localStorage.getItem(perPatientKey) || "[]");

    // 🆕 Identify newly missed patients
    const newMissed = missedToday.filter((name) => !alreadyAlerted.includes(name));

    // 🔔 Immediate alert for new missed
    if (newMissed.length > 0) {
      localStorage.setItem(
        perPatientKey,
        JSON.stringify([...new Set([...alreadyAlerted, ...newMissed])])
      );
      window.dispatchEvent(new Event("globalMissedAlert"));
      alert(`⚠️ New missed appointments:\n\n${newMissed.join("\n")}`);
    }

    // 📅 Daily cutoff alert (only once per day)
    if (missedToday.length > 0 && localStorage.getItem(dailyKey) !== "1") {
      localStorage.setItem(dailyKey, "1");
      window.dispatchEvent(new Event("globalMissedAlert"));
      alert(`⚠️ The following patients were marked as "Missed":\n\n${missedToday.join("\n")}`);
    }
  } catch (err) {
    console.error("Auto-miss update failed:", err);
  }
};


  // 🧪 Run immediately when component mounts
  checkMissedAppointments();

  // 🕔 Schedule the next run at 1:35 AM
  const now = new Date();
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);

  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const timeUntilTarget = target - now;

  setTimeout(() => {
    checkMissedAppointments();
    intervalRef.current = setInterval(checkMissedAppointments, 10 * 1000);
  }, timeUntilTarget);

  // 🕛 Midnight reset for safety
  const midnightReset = setInterval(() => {
    const nowInner = new Date();
    if (nowInner.getHours() === 0 && nowInner.getMinutes() === 0) {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("autoMissTriggered_")) {
          localStorage.removeItem(key);
        }
      });
      console.log("🕛 Midnight reset — cleared missed alert keys");
    }
  }, 60 * 1000);

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearInterval(midnightReset);
  };
}, []);



  // Calendar counts (use normalized date strings)
  const appointmentCounts = useMemo(() => {
    const counts = {}
    patients.forEach((p) => {
      ;(p.appointments || []).forEach((a) => {
        const dates = getApptScheduledDateStrings(a)
        dates.forEach((ds) => {
          if (!ds) return
          counts[ds] = (counts[ds] || 0) + 1
        })
      })
    })
    return counts
  }, [patients])

  const getPriorityLevel = (count) => {
    if (count >= 61) return "high"
    if (count >= 21) return "medium"
    if (count >= 1) return "low"
    return null
  }

  // selected date counts and lists
 const selectedDateCounts = useMemo(() => {
  const sel = selectedDate
  const allAppts = patients.flatMap((p) =>
    (p.appointments || [])
      .filter((a) => getApptScheduledDateStrings(a).includes(sel))
      .map((a) => ({ ...a, patient: p }))
  )

  const finished = allAppts.filter((a) => a.status?.toLowerCase() === "finished")
  const missed = allAppts.filter((a) => a.status?.toLowerCase() === "missed")
  const pending = allAppts.filter(
    (a) => !["finished", "missed"].includes((a.status || "").toLowerCase())
  )

  return {
    total: allAppts.length,
    pending: pending.length,
    finished: finished.length,
    missed: missed.length,
    byPatient: allAppts,
  }
}, [patients, selectedDate])


const appointmentsToDisplay = useMemo(() => {
  if (!patients.length || !selectedDate) return [];

  const sel = selectedDate;

  const filtered = patients
    .map((p) => {
      const todaysAppts = (p.appointments || []).map((a) =>
        unlockNextDayIfReady(a)
      );

      const dateFiltered = todaysAppts.filter((a) =>
        getApptScheduledDateStrings(a).includes(sel)
      );

      if (dateFiltered.length === 0) return null;

      let filteredAppts = dateFiltered;

   if (activeTab === "appointments") {
  filteredAppts = dateFiltered.filter((a) => {
    const statusField = getStatusFieldForDate(a, sel);

    // If ARV date matched → use ARV status
    if (statusField) {
      const s = (a[statusField] || "").trim().toLowerCase();
      if (["✔️ done", "done", "finished"].includes(s)) return false;
      if (s === "missed") return false;

      return ["", "pending", "🟡 pending", "🔴 upcoming", "upcoming", "in progress"].includes(s);
    }

    // 🟦 REGULAR 1-SHOT VACCINE (fallback)
    if (a.regular_type && a.regular_type !== "Hepa B Vaccine") {
      const ds = normalizeToDateStr(a.regular_date);
      if (ds === sel) {
        const s = (a.regular_status || "").trim().toLowerCase();
        if (s === "missed" || s.includes("done")) return false;
        return true; // pending regular
      }
    }

    // 🟨 HEPA B 3-DOSE VACCINE (fallback)
    if (a.regular_type === "Hepa B Vaccine") {
      const doses = [
        ["hepa_b_dose1", "hepa_b_status1"],
        ["hepa_b_dose2", "hepa_b_status2"],
        ["hepa_b_dose3", "hepa_b_status3"],
      ];

      for (const [dateField, statusFieldH] of doses) {
        const ds = normalizeToDateStr(a[dateField]);
        if (ds === sel) {
          const s = (a[statusFieldH] || "").trim().toLowerCase();
          if (s === "missed" || s.includes("done")) return false;
          return true; // pending dose
        }
      }
    }

    return false;
  });


  } else if (activeTab === "finished") {
  filteredAppts = dateFiltered.filter((a) => {
    const statusField = getStatusFieldForDate(a, sel);
    if (!statusField) return false;
    const s = (a[statusField] || "").trim().toLowerCase();

    // ANTI-RABIES done
    if (["✔️ done", "done", "finished"].includes(s)) return true;

    // REGULAR one-shot done
    if (a.regular_type && a.regular_type !== "Hepa B Vaccine") {
      return (a.regular_status || "").toLowerCase().includes("done");
    }

    // HEPA B any dose done
    return (
      (a.hepa_b_status1 || "").toLowerCase().includes("done") ||
      (a.hepa_b_status2 || "").toLowerCase().includes("done") ||
      (a.hepa_b_status3 || "").toLowerCase().includes("done")
    );
  });

      } else if (activeTab === "missed") {
  filteredAppts = dateFiltered.filter((a) => {
    const sel = selectedDate;

    // 🟥 ANTI-RABIES MISSED FOR THIS DAY ONLY
    const arvMissed = [
      ["day_zero_date", "day_zero_status"],
      ["day_three_date", "day_three_status"],
      ["day_seven_date", "day_seven_status"],
      ["day_fourteen_date", "day_fourteen_status"],
      ["day_thirty_date", "day_thirty_status"],
    ].some(([dField, sField]) =>
      normalizeToDateStr(a[dField]) === sel &&
      (a[sField] || "").toLowerCase() === "missed"
    );

    if (arvMissed) return true;

    // 🟦 REGULAR 1-SHOT (ONLY IF THE MISSED DOSE IS TODAY)
    if (
      a.regular_type &&
      a.regular_type !== "Hepa B Vaccine" &&
      normalizeToDateStr(a.regular_date) === sel &&
      (a.regular_status || "").toLowerCase() === "missed"
    ) {
      return true;
    }

    // 🟨 HEPATITIS B 3 DOSES — STRICT DATE MATCH
    const hepaMissed = [
      ["hepa_b_dose1", "hepa_b_status1"],
      ["hepa_b_dose2", "hepa_b_status2"],
      ["hepa_b_dose3", "hepa_b_status3"],
    ].some(([dField, sField]) =>
      normalizeToDateStr(a[dField]) === sel &&    // 👈 THIS IS THE KEY
      (a[sField] || "").toLowerCase() === "missed"
    );

    return hepaMissed;
  });
}


      if (filteredAppts.length === 0) return null;
      return { ...p, appointments: filteredAppts };
    })
    .filter(Boolean);

  return filtered;
}, [patients, selectedDate, activeTab]);



const tabCounts = useMemo(() => {
  if (!patients.length || !selectedDate)
    return { pending: 0, finished: 0, missed: 0 };

  const allAppts = patients.flatMap((p) =>
    (p.appointments || []).filter((a) =>
      getApptScheduledDateStrings(a).includes(selectedDate)
    )
  );

  let pending = 0,
    finished = 0,
    missed = 0;
for (const a of allAppts) {

  // Strict matching: only count doses whose DATE matches selectedDate
  const doseMatches = (() => {
    const d = selectedDate;

    // ARV
    const arv = [
      ["day_zero_date", "day_zero_status"],
      ["day_three_date", "day_three_status"],
      ["day_seven_date", "day_seven_status"],
      ["day_fourteen_date", "day_fourteen_status"],
      ["day_thirty_date", "day_thirty_status"],
    ].find(([df, sf]) => normalizeToDateStr(a[df]) === d);

    if (arv) return arv;

    // Regular
    if (
      a.regular_type &&
      a.regular_type !== "Hepa B Vaccine" &&
      normalizeToDateStr(a.regular_date) === d
    ) {
      return ["regular_date", "regular_status"];
    }

    // Hepa B
    const hepa = [
      ["hepa_b_dose1", "hepa_b_status1"],
      ["hepa_b_dose2", "hepa_b_status2"],
      ["hepa_b_dose3", "hepa_b_status3"],
    ].find(([df, sf]) => normalizeToDateStr(a[df]) === d);

    return hepa || null;
  })();

  if (!doseMatches) continue;

  const [dateField, statusField] = doseMatches;
  const s = (a[statusField] || "").trim().toLowerCase();


  const isFinished =
    ["✔️ done", "done", "finished"].includes(s) ||
    (a.regular_type &&
      a.regular_type !== "Hepa B Vaccine" &&
      (a.regular_status || "").toLowerCase().includes("done")) ||
    [
      a.hepa_b_status1,
      a.hepa_b_status2,
      a.hepa_b_status3,
    ].some((x) => (x || "").toLowerCase().includes("done"));

const isMissed = (() => {
  const sel = selectedDate;

  // 🟥 ARV missed only if date matches
  const arvMissed = [
    ["day_zero_date", "day_zero_status"],
    ["day_three_date", "day_three_status"],
    ["day_seven_date", "day_seven_status"],
    ["day_fourteen_date", "day_fourteen_status"],
    ["day_thirty_date", "day_thirty_status"],
  ].some(([dField, sField]) =>
    normalizeToDateStr(a[dField]) === sel &&
    (a[sField] || "").toLowerCase() === "missed"
  );

  if (arvMissed) return true;

  // 🟦 Regular 1-shot
  if (
    a.regular_type &&
    a.regular_type !== "Hepa B Vaccine" &&
    normalizeToDateStr(a.regular_date) === sel &&
    (a.regular_status || "").toLowerCase() === "missed"
  ) {
    return true;
  }

  // 🟨 Hepa B 3-dose
  const hepaMissed = [
    ["hepa_b_dose1", "hepa_b_status1"],
    ["hepa_b_dose2", "hepa_b_status2"],
    ["hepa_b_dose3", "hepa_b_status3"],
  ].some(([dField, sField]) =>
    normalizeToDateStr(a[dField]) === sel &&
    (a[sField] || "").toLowerCase() === "missed"
  );

  return hepaMissed;
})();

  if (isFinished) finished++;
  else if (isMissed) missed++;
  else pending++;
}

  

  return { pending, finished, missed };
}, [patients, selectedDate]);


  const getNextAppointment = (patient) => {
    if (!patient || !patient.appointments || patient.appointments.length === 0) return null
    const sorted = [...patient.appointments].sort((a, b) => {
      const aDates = getApptScheduledDateStrings(a)
      const bDates = getApptScheduledDateStrings(b)
      const aFirst = aDates[0] || "9999-12-31"
      const bFirst = bDates[0] || "9999-12-31"
      return aFirst.localeCompare(bFirst)
    })
    return sorted[0]
  }

  const handleStatusChange = async (appointmentId, newStatus) => {
  try {
    await invoke("status_apointment_update", { id: appointmentId, status: newStatus });
    const refreshedPatients = await Promise.all(
      patients.map(async (p) => {
        const appts = await getAppointments(p.id);
        return { ...p, appointments: appts || [] };
      })
    );
    setPatients(refreshedPatients);

    const allA = refreshedPatients.flatMap((p) => p.appointments || []);
    setFinished(allA.filter((a) => (a.status || "").toLowerCase() === "finished"));
    setMissed(allA.filter((a) => (a.status || "").toLowerCase() === "missed"));
  } catch (error) {
    console.error("Failed to update status:", error);
    alert("Failed to update appointment status: " + error);
  }
};

  // calendar date click
 const handleDateChange = (newDate) => {
  setDate(newDate);
  setSelectedDate(dateObjToDateStr(newDate));
};

const openEditForPatient = async (patient, appointment) => {
  setSelectedPatient(patient);
  setSelectedAppointment(appointment);
  setShowEditPopup(true);
};

  

  return (
    <div className="schedule-layout">
      {/* LEFT PANEL */}
      <div className="schedule-left">
        <div className="left-center">
  <h2 className="today-title">
    {selectedDate === dateObjToDateStr(new Date())
      ? "Today"
      : `Appointments for ${selectedDate}`}
  </h2>
</div>

<div className="appointments">
  <button
    className={`tab-btn ${activeTab === "appointments" ? "active" : ""}`}
    onClick={() => setActiveTab("appointments")}
  >
    Appointments ({tabCounts.pending})
  </button>

  <button
    className={`tab-btn finished ${activeTab === "finished" ? "active" : ""}`}
    onClick={() => setActiveTab("finished")}
  >
    Finished ({tabCounts.finished})
  </button>

  <button
    className={`tab-btn missed ${activeTab === "missed" ? "active" : ""}`}
    onClick={() => setActiveTab("missed")}
  >
    Missed ({tabCounts.missed})
  </button>
</div>




<div className="appointment-list">
  {appointmentsToDisplay.length > 0 ? (
    appointmentsToDisplay.flatMap((p) =>
      (p.appointments || []).map((a) => {

        // 1️⃣ BASE STATUS
        let currentDayStatus = a.status || "🟡 Pending";

// 2️⃣ ANTI-RABIES DAY MAP
const dayMap = {
  day_zero_date: "day_zero_status",
  day_three_date: "day_three_status",
  day_seven_date: "day_seven_status",
  day_fourteen_date: "day_fourteen_status",
  day_thirty_date: "day_thirty_status",
};

// Check anti-rabies schedule
for (const [dateField, statusField] of Object.entries(dayMap)) {
  if (normalizeToDateStr(a[dateField]) === selectedDate) {
    currentDayStatus = a[statusField] || "🟡 Pending";
  }
}

// 3️⃣ REGULAR ONE-SHOT VACCINES
if (a.regular_type && a.regular_type !== "Hepa B Vaccine") {
  if (normalizeToDateStr(a.regular_date) === selectedDate) {
    currentDayStatus = a.regular_status || "🟡 Pending";
  }
}

// 4️⃣ HEPA B MULTI-DOSE
if (a.regular_type === "Hepa B Vaccine") {
  if (normalizeToDateStr(a.hepa_b_dose1) === selectedDate)
    currentDayStatus = a.hepa_b_status1 || "🟡 Pending";

  if (normalizeToDateStr(a.hepa_b_dose2) === selectedDate)
    currentDayStatus = a.hepa_b_status2 || "🟡 Pending";

  if (normalizeToDateStr(a.hepa_b_dose3) === selectedDate)
    currentDayStatus = a.hepa_b_status3 || "🟡 Pending";
}

        return (
          <div className="appointment-card" key={`${p.id}-${a.id}`}>
            <div className="appointment-info">

              {/* Display vaccine type / prophylaxis */}
              <p>
                <b>
                  {p.last_name}, {p.first_name} {p.middle_name || ""}
                </b>{" "}
                <span style={{ fontStyle: "italic" }}>
                  {a.regular_type
                    ? `(${a.regular_type})`
                    : a.prophylaxis_type
                    ? `(${a.prophylaxis_type})`
                    : "(General)"}
                </span>
              </p>

              <p>
                <b>Status:</b> {currentDayStatus}
              </p>

              <div className="appt-icons">
                <button
                  className="edit-icon-button"
                  onClick={() => openEditForPatient(p, a)}
                >
                  <RiPencilFill className="edit-icon" />
                </button>
              </div>

            </div>
          </div>
        );
      })
    )
  ) : (
    <p>
      {activeTab === "appointments"
        ? "No pending appointments for this date."
        : activeTab === "finished"
        ? "No finished appointments for this date."
        : "No missed appointments for this date."}
    </p>
  )}
</div>
</div>

      {/* RIGHT PANEL */}
      <div className="schedule-right">
        <div className="calendar-top-clock">{time}</div>

        <div className="calendar-wrapper">
          <Calendar
            onChange={handleDateChange}
            value={new Date(selectedDate)}
            tileClassName={({ date: calDate, view }) => {
  if (view !== "month") return null;

  const dateStr = dateObjToDateStr(calDate);

  const apptsForDate = patients.flatMap((p) =>
    (p.appointments || []).filter((a) =>
      getApptScheduledDateStrings(a).includes(dateStr)
    )
  );

  if (apptsForDate.length === 0) return null;

  const todayStr = dateObjToDateStr(new Date());
  const isPast = dateStr < todayStr;

  // Get statuses specifically for this date
  const statuses = apptsForDate.map((a) => {
    const statusField = getStatusFieldForDate(a, dateStr);
    return (a[statusField] || "").toLowerCase();
  });

  const anyMissed = statuses.some((s) => s === "missed");
  const anyPending = statuses.some((s) =>
    ["", "pending", "🟡 pending", "upcoming", "in progress"].includes(s)
  );

  // ❗ MISSED → RED
  if (anyMissed) return "calendar-missed";

  // 🕒 PAST (no color)
  if (isPast) return null;

  // 🟢 TODAY/FUTURE → Low/Medium/High densities
  if (anyPending) {
    const level = getPriorityLevel(apptsForDate.length);
    return level ? `calendar-${level}` : "calendar-low";
  }

  return null;
}}
          />
        </div>

        <div className="priority-indicator">
          <span>🟢 Low</span>
          <span>🟡 Medium</span>
          <span>🔴 High</span>
        </div>
       {missedNotice && missedCount > 0 && (
  <div className="missed-alert">
    <h3>⚠️ Missed Appointments Today</h3>
    <p>
      ⚠️ {missedCount} missed appointment
      {missedCount > 1 ? "s" : ""} today
    </p>
  </div>
)}


      </div>

      
      {showEditPopup && (
        <div className="popup">
          <div className="view-modalPatient">
            <div className="Closebtn"><button onClick={() => setShowEditPopup(false)}>Close</button></div>
            <h3>Name: {selectedPatient ? `${selectedPatient.last_name}, ${selectedPatient.first_name} ${selectedPatient.middle_name || ""}` : "No patient selected"}</h3>
            <div className="Edit-Buttons">
              <h3>Appointment Details</h3>
              {selectedAppointment ? (
                <div className="appointment-details">
                  <p><b>Purpose:</b> {selectedAppointment.prophylaxis_type || selectedAppointment.regular_type||"Not specified"}</p>
                  <div>
  <b>Schedule:</b>
<ul style={{ marginTop: "5px", listStyle: "none", paddingLeft: 0 }}>

  {/* ANTI-RABIES SCHEDULE */}
  {[
    ["D0", selectedAppointment.day_zero_date, selectedAppointment.day_zero_status],
    ["D3", selectedAppointment.day_three_date, selectedAppointment.day_three_status],
    ["D7", selectedAppointment.day_seven_date, selectedAppointment.day_seven_status],
    ["D14", selectedAppointment.day_fourteen_date, selectedAppointment.day_fourteen_status],
    ["D30", selectedAppointment.day_thirty_date, selectedAppointment.day_thirty_status],
  ].map(([label, value, status]) =>
    value ? (
      <li key={label}>
        {label}: {normalizeToDateStr(value)}{" "}
        <span style={{ fontStyle: "italic", color: "#555" }}>
          ({status || "🟡 Pending"})
        </span>
      </li>
    ) : null
  )}

  {/* REGULAR SINGLE-SHOT VACCINE */}
  {selectedAppointment.regular_type &&
    selectedAppointment.regular_type !== "Hepa B Vaccine" && (
      <li>
        Date: {normalizeToDateStr(selectedAppointment.regular_date)}{" "}
        <span style={{ fontStyle: "italic", color: "#555" }}>
          ({selectedAppointment.regular_status || "🟡 Pending"})
        </span>
      </li>
  )}

  {/* HEPA B 3-DOSE VACCINE */}
  {selectedAppointment.regular_type === "Hepa B Vaccine" && (
    <>
      {[
        ["Dose 1", selectedAppointment.hepa_b_dose1, selectedAppointment.hepa_b_status1],
        ["Dose 2", selectedAppointment.hepa_b_dose2, selectedAppointment.hepa_b_status2],
        ["Dose 3", selectedAppointment.hepa_b_dose3, selectedAppointment.hepa_b_status3],
      ].map(([label, value, status]) =>
        value ? (
          <li key={label}>
            {label}: {normalizeToDateStr(value)}{" "}
            <span style={{ fontStyle: "italic", color: "#555" }}>
              ({status || "🟡 Pending"})
            </span>
          </li>
        ) : null
      )}
    </>
  )}

</ul>
</div>
                 <p>
  <b>Current Day Status:</b>{" "}
  {selectedAppointment
    ? selectedAppointment[
        getStatusFieldForDate(selectedAppointment, selectedDate)
      ] || "🟡 Pending"
    : "🟡 Pending"}
</p>
<p>
  <b>Overall:</b> {selectedAppointment.status || "🟡 Pending"}
</p>
                </div>
              ) : (
                <p>No appointment details available</p>
              )}
{selectedAppointment && (() => {
  const statusField = getStatusFieldForDate(selectedAppointment, selectedDate);
  const status = (selectedAppointment[statusField] || "").trim().toLowerCase();

  if (status.includes("missed")) {
    return (
      <button
        onClick={() => {
          handleReschedule(selectedAppointment);
        }}
      >
        Reschedule
      </button>
    );
  }

  return null;
})()}

              <button
  onClick={() => {
    navigate(`/dashboard/patient/${selectedPatient.id}`, {
      state: { selectedPatient, openAppointmentId: selectedAppointment.id },
    });
  }}
>
  View Appointment Details
</button>
            </div>
          </div>
        </div>
      )}

      {showReschedPopup && (
  <div className="popup">
    <div className="view-modalPatient">
      <div className="Closebtn">
        <button onClick={() => setShowReschedPopup(false)}>Close</button>
      </div>
      <h3>Reschedule Appointment</h3>
      <p>
        Pick a new date for this appointment:
      </p>
      <input
        type="date"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        min={dateObjToDateStr(new Date())}
      />
      <div style={{ marginTop: "10px" }}>
        <button onClick={confirmReschedule}>Confirm</button>
      </div>
    </div>
  </div>
)}

    
    
    </div>
  )
}

export default Schedule
