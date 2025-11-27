import { useState, useEffect, useMemo, useRef } from "react"
import "./Schedule.css"
import { RiPencilFill } from "react-icons/ri"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import { invoke } from "@tauri-apps/api/core"
import { useNavigate, useLocation } from "react-router-dom"
import { useToast } from "../../../../../utils/Toast";

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
  const toast = useToast();
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search);
  const openAppointmentId = new URLSearchParams(location.search).get("open");
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
  
const openAppointmentModal = (appt, patient) => {
  setSelectedAppointment(appt);
  setSelectedPatient(patient);
  setShowEditPopup(true)
};

  const normalizeToDateStr = (val) => {
  if (!val) return null;
  const match = String(val).match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(val);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const norm = (v) => normalizeToDateStr(v);
const lower = (s) => (s || "").trim().toLowerCase();
const [showReschedPopup, setShowReschedPopup] = useState(false);
const [newDate, setNewDate] = useState("");
const [apptToResched, setApptToResched] = useState(null);

const handleReschedule = (appointment) => {
  if (!appointment) {
    toast.show("No appointment selected to reschedule!","warning");
    return;
  }
  setApptToResched(appointment);
  setNewDate("");
  setShowReschedPopup(true);
};

const confirmReschedule = async () => {
  if (!apptToResched || !newDate) {
    toast.show("Please select a new date!","warning");
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
      toast.show("Invalid new date.","error");
      return;
    }

    const dateStrNorm = (v) => normalizeToDateStr(v);

    const pxType = (apptToResched.prophylaxis_type || "").toLowerCase();

const dayFields =
  pxType === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
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
  toast.show("All later doses are already done — nothing to reschedule.","info");
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
  toast.show("All later Hepa B doses are already done — nothing to reschedule.","info");
  return;
}

// ✅ Anchor: Dose 1 date
const dose1Date = parseYMD(dateStrNorm(updatedAppt.hepa_b_dose1));
if (!dose1Date) {
  toast.show("Dose 1 date is missing — cannot reschedule.","error");
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
      toast.show("Only missed appointments can be rescheduled!","warning");
      return;
    }

    updatedAppt.last_rescheduled_from = dateObjToDateStr(new Date());

    await invoke("update_appointment", { appointment: updatedAppt });

    setShowReschedPopup(false);
    setShowEditPopup(false);
    localStorage.setItem("refreshScheduleFlag", Date.now().toString());
    window.dispatchEvent(new Event("refreshSchedule"));
    await loadAppointmentsForSelectedDate();

    toast.show("✅ Appointment rescheduled successfully!","success");
  } catch (err) {
    console.error("Failed to reschedule:", err);
    toast.show("❌ Failed to reschedule: " + err,"error");
  }
};



// Unlock next day when current day is done
const unlockNextDayIfReady = (appt) => {
  const type = (appt.prophylaxis_type || "").toLowerCase();

const dayOrder =
  type === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
       
      ]
    : [
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

  const arr = [];
  const type = (appt.prophylaxis_type || "").toLowerCase();

  // 🟥 POST-EXPOSURE PROPHYLAXIS (5-dose ARV)
  if (type === "post exposure prophylaxis"||"pre exposure prophylaxis") {
    const pepPairs = [
      ["day_zero_date", "day_zero_status"],
      ["day_three_date", "day_three_status"],
      ["day_seven_date", "day_seven_status"],
      ["day_fourteen_date", "day_fourteen_status"],
      ["day_thirty_date", "day_thirty_status"],
    ];

    for (const [df, sf] of pepPairs) {
      const ds = normalizeToDateStr(appt[df]);
      const s = (appt[sf] || "").toLowerCase();
      if (ds && s !== "rescheduled") arr.push(ds);
    }
  }

  // 🟩 BOOSTER (3-dose ARV)
  if (type === "booster") {
    const boosterPairs = [
      ["day_zero_date", "day_zero_status"],
      ["day_three_date", "day_three_status"],
      ["day_seven_date", "day_seven_status"],
      
    ];

    for (const [df, sf] of boosterPairs) {
      const ds = normalizeToDateStr(appt[df]);
      const s = (appt[sf] || "").toLowerCase();
      if (ds && s !== "rescheduled") arr.push(ds);
    }
  }

  // 🟧 REGULAR VACCINES (single dose)
 if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
  const doseFields = ["regular_date", "regular_date2", "regular_date3"];
  for (const f of doseFields) {
    const ds = normalizeToDateStr(appt[f]);
    if (ds) arr.push(ds);
  }
}

  // 🟨 HEPATITIS B (3-dose)
  const hepaPairs = [
    ["hepa_b_dose1", "hepa_b_status1"],
    ["hepa_b_dose2", "hepa_b_status2"],
    ["hepa_b_dose3", "hepa_b_status3"],
  ];

  for (const [df, sf] of hepaPairs) {
    const ds = normalizeToDateStr(appt[df]);
    const s = (appt[sf] || "").toLowerCase();
    if (ds && s !== "rescheduled") arr.push(ds);
  }

  return Array.from(new Set(arr)).sort();
};
const upcomingAppointments = useMemo(() => {
  const today = dateObjToDateStr(new Date());

  // Flatten all patients + all dose dates
  const upcoming = [];

  patients.forEach((p) => {
    (p.appointments || []).forEach((a) => {
      const dates = getApptScheduledDateStrings(a); // you already have this helper

      dates.forEach((ds) => {
        if (ds > today) {
          upcoming.push({
            date: ds,
            patient: p,
            appointment: a,
          });
        }
      });
    });
  });

  // Sort by date
  return upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10); // show top 10 only
}, [patients]);




// Map selected date to the correct day_*_status field
const getStatusFieldForDate = (appt, selectedDate) => {
  if (!appt || !selectedDate) return null;

  const type = (appt.prophylaxis_type || "").toLowerCase();
  const normalizedSelected = selectedDate.trim();

  const matches = (field) =>
    normalizeToDateStr(appt[field]) === normalizedSelected;

  // 🟥 1. POST-EXPOSURE PROPHYLAXIS (5-dose)
  if (type === "post exposure prophylaxis"||"pre exposure prophylaxis") {
    const pepMap = {
      day_zero_date: "day_zero_status",
      day_three_date: "day_three_status",
      day_seven_date: "day_seven_status",
      day_fourteen_date: "day_fourteen_status",
      day_thirty_date: "day_thirty_status",
    };

    for (const [df, sf] of Object.entries(pepMap)) {
      if (matches(df)) return sf;
    }
  }

  // 🟩 2. BOOSTER (3-dose ONLY)
  if (type === "booster") {
    const boosterMap = {
      day_zero_date: "day_zero_status",
      day_seven_date: "day_seven_status",
      day_thirty_date: "day_thirty_status",
    };

    for (const [df, sf] of Object.entries(boosterMap)) {
      if (matches(df)) return sf;
    }
  }

  // 🟧 3. REGULAR VACCINES (single dose)
  if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
    if (matches("regular_date")) return "regular_status";
  }

  // 🟨 4. HEPATITIS B (3-dose)
  const hepaMap = {
    hepa_b_dose1: "hepa_b_status1",
    hepa_b_dose2: "hepa_b_status2",
    hepa_b_dose3: "hepa_b_status3",
  };

  for (const [df, sf] of Object.entries(hepaMap)) {
    if (matches(df)) return sf;
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
        

        // 🟥 ANTI-RABIES D0–D30
        // Determine if this appointment is Booster or PEP
const type = (a.prophylaxis_type || "").toLowerCase();

// Use correct schedule depending on type
const arvPairs =
  type === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ];

const arvMissed = arvPairs.some(([dField, sField]) =>
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

      const missedForDate = allA.filter(
        (a) => normalizeStatus(a.status) === "missed"
      );

      setMissedCount(missedForDate.length);
      setFinished(allA.filter((a) => normalizeStatus(a.status) === "finished"));
      setMissed(missedForDate);

      setAppointments(
        allA.filter(
          (a) => !["finished", "missed"].includes(normalizeStatus(a.status))
        )
      );
    } catch (err) {
      console.error("[Schedule] Error loading patients:", err);
    }
  }

  loadPatients();
}, [refresh]);



// 🔥 Auto-open appointment AFTER all filtering & normalization is done
useEffect(() => {
  if (!openAppointmentId || patients.length === 0) return;

  setTimeout(() => {
    const patient = patients.find(p =>
      p.appointments?.some(a => String(a.id) === String(openAppointmentId))
    );
    if (!patient) return;

    const appt = patient.appointments.find(a =>
      String(a.id) === String(openAppointmentId)
    );
    if (!appt) return;

    setSelectedPatient(patient);
    setSelectedAppointment(appt);
    setShowEditPopup(true);

    // remove from URL so it doesn’t re-open
    navigate("/dashboard/schedule", { replace: true });
  }, 0);
}, [openAppointmentId, patients]);

// 🟦 Keep popup open even after patients refresh
useEffect(() => {
  if (!showEditPopup || !selectedAppointment) return;

  // Try to find updated patient + appointment in refreshed list
  const patient = patients.find(p =>
    p.appointments?.some(a => a.id === selectedAppointment.id)
  );

  if (!patient) return;

  const appt = patient.appointments.find(a => a.id === selectedAppointment.id);
  if (!appt) return;

  // Update to latest data
  setSelectedPatient(patient);
  setSelectedAppointment(appt);
}, [patients]);




 // 🕒 Auto-miss checker (safe, instant + scheduled)
// 🕒 Auto-miss checker (safe, instant + midnight)
useEffect(() => {
  const TRIGGER_MINUTES = 17 * 60; // 5:00 PM

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
             const pxType = (appt.prophylaxis_type || "").toLowerCase();

const dayFields =
  pxType === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ];

              let anyDayMissed = false;


// ANTI-RABIES AUTO-MISS
// ------------------------------
if (
  appt.prophylaxis_type &&
  ["post exposure prophylaxis","pre exposure prophylaxis", "booster"].includes(
    appt.prophylaxis_type.toLowerCase()
  )
) {
  for (const [dateField, statusField] of dayFields) {
    const d = normalizeToDateStr(appt[dateField]);
    if (!d) continue;

    const s = (appt[statusField] || "").toLowerCase();
    if (["✔️ done", "done", "missed"].includes(s)) continue;

    if (d < todayStr) {
      appt[statusField] = "Missed";
      anyDayMissed = true;
      anyChange = true;
      continue;
    }

    if (d === todayStr && currentMinutes >= TRIGGER_MINUTES) {
      appt[statusField] = "Missed";
      anyDayMissed = true;
    }
  }
}

              // ------------------------------
              // REGULAR ONE-SHOT AUTO-MISS
              // ------------------------------
              if (appt.regular_type && appt.regular_type !== "Hepa B Vaccine") {
                const d = normalizeToDateStr(appt.regular_date);
                const s = (appt.regular_status || "").toLowerCase();

                if (d && !s.includes("done") && s !== "missed") {
                  if (d < todayStr) {
                    appt.regular_status = "Missed";
                    anyDayMissed = true;
                    anyChange = true; 
                  }
                  if (d === todayStr && currentMinutes >= TRIGGER_MINUTES) {
                    appt.regular_status = "Missed";
                    anyDayMissed = true;
                  }
                }
              }

              // ------------------------------
              // HEPA B AUTO-MISS
              // ------------------------------
              // ------------------------------
// HEPA B AUTO-MISS
// ------------------------------
const hepaDates = [
  ["hepa_b_dose1", "hepa_b_status1"],
  ["hepa_b_dose2", "hepa_b_status2"],
  ["hepa_b_dose3", "hepa_b_status3"],
];

for (const [doseDateField, doseStatusField] of hepaDates) {
  const d = normalizeToDateStr(appt[doseDateField]);
  const s = (appt[doseStatusField] || "").toLowerCase();

  if (!d) continue;

  // 🟦 Always reset future wrong “Missed” entries
  if (d > todayStr && s === "missed") {
    appt[doseStatusField] = "🟡 Pending";
    anyDayMissed = true;
    anyChange = true;
    continue;
  }

  // 🟩 Past dates → Missed
  if (d < todayStr && !s.includes("done") && s !== "missed") {
    appt[doseStatusField] = "Missed";
    anyDayMissed = true;
    anyChange = true;
  }

  // 🟨 Today after cutoff
  if (d === todayStr && currentMinutes >= TRIGGER_MINUTES) {
    appt[doseStatusField] = "Missed";
    anyDayMissed = true;
    anyChange = true;
  }
}

              // ------------------------------
              // OVERALL STATUS
              // ------------------------------
              const type = (appt.prophylaxis_type || "").toLowerCase();

const boosterFields = [
  ["day_zero_date", "day_zero_status"],
  ["day_three_date", "day_three_status"],
  ["day_seven_date", "day_seven_status"],
  
];

const pepFields = [
  ["day_zero_date", "day_zero_status"],
  ["day_three_date", "day_three_status"],
  ["day_seven_date", "day_seven_status"],
  ["day_fourteen_date", "day_fourteen_status"],
  ["day_thirty_date", "day_thirty_status"],
];

const fieldsToCheck = type === "booster" ? boosterFields : pepFields;

const arvDone = fieldsToCheck.every(([sf]) =>
  (appt[sf] || "").toLowerCase().includes("done")
);
              const arvMiss = fieldsToCheck.every(([sf]) =>
  (appt[sf] || "").toLowerCase() === "missed"
);

              const regDone =
                appt.regular_type &&
                appt.regular_type !== "Hepa B Vaccine" &&
                (appt.regular_status || "").toLowerCase().includes("done");

              const regMiss =
                appt.regular_type &&
                appt.regular_type !== "Hepa B Vaccine" &&
                (appt.regular_status || "").toLowerCase() === "missed";

              const hepaStatuses = [
                appt.hepa_b_status1,
                appt.hepa_b_status2,
                appt.hepa_b_status3,
              ].map((s) => (s || "").toLowerCase());

              const hepaDone = [
              appt.hepa_b_status1,
              appt.hepa_b_status2,
              appt.hepa_b_status3,
            ].every((x) => (x || "").toLowerCase().includes("done"));

              const hepaMiss =
                hepaStatuses.length > 0 &&
                hepaStatuses.every((s) => s === "missed");

              if (arvDone || regDone || hepaDone) appt.status = "Finished";
              else if (arvMiss || regMiss || hepaMiss) appt.status = "Missed";

              if (anyDayMissed)
                await invoke("update_appointment", { appointment: appt });
                anyChange = true;
              return appt;
            })
          );

          return { ...p, appointments: updatedAppts };
        })
      );

      if (anyChange) setPatients(updatedPatients);
    } catch (err) {
      console.error("Auto-miss failed:", err);
    }
  };

  // 🔵 Run immediately on mount
  checkMissedAppointments();

  // 🔵 Run every 10 seconds ALWAYS
  const interval = setInterval(checkMissedAppointments, 10 * 1000);

  // 🔵 Run at midnight instantly
  const midnightChecker = setInterval(() => {
    const n = new Date();
    if (n.getHours() === 0 && n.getMinutes() === 0) {
      checkMissedAppointments();
    }
  }, 60 * 1000);

  return () => {
    clearInterval(interval);
    clearInterval(midnightChecker);
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
  ["hepa_b_status1", "hepa_b_status2", "hepa_b_status3"].every(
    (fld) => (a[fld] || "").toLowerCase().includes("done")
  )
);
  });

      } else if (activeTab === "missed") {
  filteredAppts = dateFiltered.filter((a) => {
    const sel = selectedDate;

    // 🟥 ANTI-RABIES MISSED FOR THIS DAY ONLY
    const type = (a.prophylaxis_type || "").toLowerCase();

const arvPairs =
  type === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ];

const arvMissed = arvPairs.some(([dField, sField]) =>
  norm(a[dField]) === selectedDate &&
  lower(a[sField]) === "missed"
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
    const type = (a.prophylaxis_type || "").toLowerCase();

const arvList =
  type === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ];

const arvMatch = arvList.find(
  ([df]) => normalizeToDateStr(a[df]) === d
);

if (arvMatch) return arvMatch;

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
].every((x) => (x || "").toLowerCase().includes("done"));

const isMissed = (() => {
  const sel = selectedDate;

  // 🟥 ARV missed only if date matches
const type = (a.prophylaxis_type || "").toLowerCase();

const arvPairs =
  type === "booster"
    ? [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        
      ]
    : [
        ["day_zero_date", "day_zero_status"],
        ["day_three_date", "day_three_status"],
        ["day_seven_date", "day_seven_status"],
        ["day_fourteen_date", "day_fourteen_status"],
        ["day_thirty_date", "day_thirty_status"],
      ];

const arvMissed = arvPairs.some(([dField, sField]) =>
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
    toast.show("Failed to update appointment status: " + error,"error");
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
const type = (a.prophylaxis_type || "").toLowerCase();

const dayMap =
  type === "booster"
    ? {
        day_zero_date: "day_zero_status",
        day_three_date: "day_three_status",
        day_seven_date: "day_seven_status",
      }
    : {
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

  const anyMissed = statuses.some((s) => s.trim().toLowerCase() === "missed");
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
       <div className="right-lower-row">
  {missedNotice && missedCount > 0 && (
    <div className="missed-alert">
      <h3>⚠️ Missed Today</h3>
      <p>
        ⚠️ {missedCount} missed appointment
        {missedCount > 1 ? "s" : ""} today
      </p>
    </div>
  )}

  <div className="upcoming-box">
    <h3>Upcoming Appointments</h3>

    <div className="upcoming-scroll">
      {upcomingAppointments.length === 0 ? (
        <p>No upcoming appointments.</p>
      ) : (
        <ul>
          {upcomingAppointments.map((item, idx) => (
           <li
  key={idx}
  className="upcoming-item"
  onClick={() => openEditForPatient(item.patient, item.appointment)}

>
  <b>{item.date}</b> — {item.patient.last_name}, {item.patient.first_name}
  <br />
  <span style={{ fontStyle: "italic" }}>
    {item.appointment.regular_type ||
     item.appointment.prophylaxis_type ||
     "General"}
  </span>
</li>
          ))}
        </ul>
      )}
    </div>
  </div>
</div>
</div>

      
      {showEditPopup && (
        <div className="popup">
          <div className="view-modalPatient">
            <div className="Closebtn"><button onClick={() => setShowEditPopup(false)}>Close</button></div>
            <h3>Name: {selectedPatient ? `${selectedPatient.last_name}, ${selectedPatient.first_name} ${selectedPatient.middle_name || ""}` : "No patient selected"}</h3>
            <div className="Edit-Buttons">
              <h3>Schedule Details</h3>
              {selectedAppointment ? (
                <div className="appointment-details">
                  <p><b>Purpose:</b> {selectedAppointment.prophylaxis_type || selectedAppointment.regular_type||"Not specified"}</p>
                  <div>
  <b>Schedule:</b>
<ul style={{ marginTop: "5px", listStyle: "none", paddingLeft: 0 }}>

  {/* DYNAMIC ANTI-RABIES SCHEDULE BASED ON TYPE */}
{(() => {
  const type = selectedAppointment.prophylaxis_type?.toLowerCase();

  let schedule = [];

  // FULL PEP (5-dose)
  if (type === "post exposure prophylaxis"||"pre exposure prophylaxis") {
    schedule = [
      ["D0", selectedAppointment.day_zero_date, selectedAppointment.day_zero_status],
      ["D3", selectedAppointment.day_three_date, selectedAppointment.day_three_status],
      ["D7", selectedAppointment.day_seven_date, selectedAppointment.day_seven_status],
      ["D14", selectedAppointment.day_fourteen_date, selectedAppointment.day_fourteen_status],
      ["D30", selectedAppointment.day_thirty_date, selectedAppointment.day_thirty_status],
    ];
  }

  // BOOSTER (3-dose)
  if (type === "booster") {
    schedule = [
      ["D0", selectedAppointment.day_zero_date, selectedAppointment.day_zero_status],
      ["D3", selectedAppointment.day_three_date, selectedAppointment.day_three_status],
      ["D7", selectedAppointment.day_seven_date, selectedAppointment.day_seven_status],
     
    ];
  }

  return schedule.map(([label, value, status]) =>
    value ? (
      <li key={label}>
        {label}: {normalizeToDateStr(value)}{" "}
        <span style={{ fontStyle: "italic", color: "#555" }}>
          ({status || "🟡 Pending"})
        </span>
      </li>
    ) : null
  );
})()}

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
