import React, { useEffect, useState } from "react";
import "./Patient.css";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeCanvas } from "qrcode.react";
import { useParams } from "react-router-dom";
import { PiEyeLight } from "react-icons/pi";
import { PiEyeClosedLight } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { inventoryManager } from "../../../../../utils/inventoryManager";

async function reduceInventoryForDose(vaccineId, route) {
  // Anti-rabies (rabies category)
  if (route === "ID") {
    await inventoryManager.reduceByRoute(vaccineId, "ID");   // deduct 0.1
  } else if (route === "IM") {
    await inventoryManager.reduceByRoute(vaccineId, "IM");   // deduct 1
  }
}
async function reduceRegularVaccine(vaccineId) {
  await inventoryManager.addStock(vaccineId, -1); // deduct 1
}

//Patient Handlers//
async function getPatients() {
  return await invoke("get_patients_cmd");
}

async function createPatient(patient) {
  return await invoke("create_patient_cmd", { patient });
}

async function deletePatient(id) {
  return await invoke("delete_patient", { id });
}

// --- APPOINTMENTS HANDLERS ---
async function getAppointments(patientId) {
  return await invoke("get_appointments", { patientId });
}

async function createAppointment(appointment) {
  return await invoke("create_appointment", { appointment });
}

async function updateAppointment(appointment) {
  return await invoke("update_appointment", { appointment });
}

async function archivePatient(id) {
  return await invoke("archive_patient", { id });
}

async function restorePatient(id) {
  return await invoke("restore_patient", { id });
}

async function getArchivedPatients() {
  return await invoke("get_archived_patients_cmd");
}

async function handleUpdatePassword(patientId, newPassword) {
  try {
    await invoke('update_muser_password', {
      patientId: patientId, // Tauri converts camelCase to snake_case for you
      newPassword: newPassword,
    });
    console.log('Password updated successfully');
  } catch (e) {
    console.error('Failed to update password:', e);
  }
}
const isDateAvailable = (scheduledDate) => {
  if (!scheduledDate) return false;
  const today = new Date().setHours(0, 0, 0, 0);
  const sched = new Date(scheduledDate).setHours(0, 0, 0, 0);
  return today >= sched;
};

function getRegularVaccineId(appt) {
  if (!appt) return null;

  const type = appt.regular_type;

  switch (type) {
    case "Flu Vaccine":
      return "flu";

    case "Anti-Tetanus":
      return "tetanus";

    case "ATS":
      return "ats";

    case "HTIG":
      return "htig";

    case "Hepa B Vaccine":
      return "hepab";

    case "Pneumonia Vaccine":
      if (appt.pneumonia_type === "PCV13") return "pcv13";
      if (appt.pneumonia_type === "PPSV23") return "ppsv23";
      return null;

    default:
      return null;
  }
}


// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayPH = () => {
  const now = new Date();

  // Convert manually to PH Time (UTC+8)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ph = new Date(utc + 8 * 3600000);

  const yyyy = ph.getFullYear();
  const mm = String(ph.getMonth() + 1).padStart(2, "0");
  const dd = String(ph.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);

  // Fix for month overflow (like Feb 31 → Apr 2)
  if (d.getDate() !== date.getDate()) {
    d.setDate(0);
  }

  return d.toISOString().split("T")[0];
};


const Patient = () => {
  // ✅ Added allPatients for unfiltered list
  const [allPatients, setAllPatients] = useState([]);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showView, setShowView] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [editAppointment, setEditAppointment] = useState(null);
  const [dayZero, setDayZero] = useState("");
  const [dayThree, setDayThree] = useState("");
  const [daySeven, setDaySeven] = useState("");
  const [dayFourteen, setDayFourteen] = useState("");
  const [dayThirty, setDayThirty] = useState("");
  const [selectedProphylaxisType, setSelectedProphylaxisType] = useState("");
  const [newTetanusToxoid, setNewTetanusToxoid] = useState(false);
   const [isSavedGivenDates, setIsSavedGivenDates] = useState(false);
  const [newSchedule, setNewSchedule] = useState(() => {
  // Automatically default to today's date in YYYY-MM-DD format
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
});
const [showViewRegular, setShowViewRegular] = useState(false);
const [viewRegularData, setViewRegularData] = useState(null);
const [newVaccRoute, setNewVaccRoute] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [isEditingMedical, setIsEditingMedical] = useState(false);
const [viewArchived, setViewArchived] = useState(false)
const [archivedPatients, setArchivedPatients] = useState([]);
const [showingArchived, setShowingArchived] = useState(false);
const [showViewAppointment, setShowViewAppointment] = useState(null);
const [newRIG, setNewRIG] = useState(false);
const [newRIGDate, setNewRIGDate] = useState(() => getTodayDate());
const [newTetanusDate, setNewTetanusDate] = useState(() => getTodayDate());
const [newTetanusRoute, setNewTetanusRoute] = useState("");
const [newRegularGivenDate, setNewRegularGivenDate] = useState("");
const [apptSortOrder, setApptSortOrder] = useState("newest");
const [apptFilterType, setApptFilterType] = useState("");

const isBooster = selectedProphylaxisType === "Booster";
// REGULAR VACCINES
const [newInjectionSite, setNewInjectionSite] = useState("");
// ANTI-RABIES: Tetanus Toxoid
const [tetanusInjectionSite, setTetanusInjectionSite] = useState("");

const navigate = useNavigate();
const [newRegularRoute, setNewRegularRoute] = useState("IM");
  const [newTypeofBite, setNewTypeofBite] = useState("");
  const [newSite, setNewSite] = useState("");
  const [newBitingAnimal, setNewBitingAnimal] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPreviousAntiRabiesVaccine, setNewPreviousAntiRabiesVaccine] = useState("");
  const [editingMedical, setEditingMedical] = useState(false);
 const [editedMedical, setEditedMedical] = useState({
  dateOfExposure: "",
  prevVaccs: [""],      // 👈 changed
  allergies: [""],      // 👈 changed
  illOper: [""],        // 👈 changed
  assessment: "",
});


useEffect(() => {
  if (showViewAppointment) {
    const anyDone = [
      showViewAppointment.day_zero_status,
      showViewAppointment.day_three_status,
      showViewAppointment.day_seven_status,
      showViewAppointment.day_fourteen_status,
      showViewAppointment.day_thirty_status,
    ].some((s) => s === "✔️ Done");
    setShowViewAppointment((prev) => ({
      ...prev,
      buttonState: anyDone ? "revert" : "marked",
    }));
  }
}, [showViewAppointment?.id]);

useEffect(() => {
  if (showView) {
    setEditedMedical({
      prevVaccs: showView.prev_vacc
        ? showView.prev_vacc.split(", ").map(v => ({ option: v, custom: "" }))
        : [{ option: "", custom: "" }],
      allergies: showView.allergies
        ? showView.allergies.split(", ").map(a => ({ option: a, custom: "" }))
        : [{ option: "", custom: "" }],
      illOper: showView.ill_oper
        ? showView.ill_oper.split(", ").map(i => ({ option: i, custom: "" }))
        : [{ option: "", custom: "" }],
    });
  }
}, [showView]);


// near other useState calls
     const addDays = (dateString, days) => {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};           
const splitValues = (str) =>
  typeof str === "string" && str.trim() !== ""
    ? str.split(",").map((s) => s.trim())
    : [""];
    const flattenField = (arr) =>
  arr
    .map((item) => (item.option === "Other" ? item.custom : item.option))
    .filter((v) => v && v.trim() !== "")
    .join(", ");


  // PATIENT DETAILS
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [newDateofBirth, setDateofBirth] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newContactNum, setNewContactNum] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newWeight, setNewWeight] = useState("");

  // HISTORY OF EXPOSURE
  const [newDateOfExposure, setNewDateOfExposure] = useState("");


// auto-generated dates
  // MEDICAL HISTORY
  const [prevVacc, setPrevVacc] = useState("");
 
  const [allergies, setAllergies] = useState("");

  const [illOper, setIllOper] = useState("");

  const [assessment, setAssessment] = useState("");


 useEffect(() => {
  if (viewArchived) {
    loadArchivedPatients();
  } else {
    loadPatients();
  }
}, [viewArchived]);
const { id } = useParams();


const location = useLocation();
const openAppointmentId = location.state?.openAppointmentId;

useEffect(() => {
  if (!openAppointmentId || appointments.length === 0) return;

  const target = appointments.find(a => a.id === openAppointmentId);
  if (!target) return;

  if (target.regular_type) {
    setViewRegularData(target);
    setShowViewRegular(true);
  } else {
    setShowViewAppointment(target);
  }

  // Clear state so refresh doesn't reopen
  window.history.replaceState({}, document.title);
}, [openAppointmentId, appointments]);




// 👇 Automatically open patient view if coming from a QR redirect
useEffect(() => {
  async function loadPatientFromQR() {
    if (id) {
      try {
        const fullPatient = await invoke("get_patient_with_user", { id: Number(id) });
        setShowView(fullPatient);
        const appts = await getAppointments(Number(id));
        setAppointments(appts);
      } catch (err) {
        console.error("Failed to load patient from QR:", err);
        alert("Could not load patient details.");
      }
    }
  }
  loadPatientFromQR();
}, [id]);


  // 🟢 Auto-calc only when user picks a Day 0 date manually


 async function loadPatients() {
    const data = await getPatients();
    setAllPatients(data); // full copy
    setPatients(data); // displayed list
  }
  function resetFormFields() {
    setFirstName("");
  setLastName("");
  setMiddleName("");
  setNewAge("");
  setDateofBirth("");
  setNewAddress("");
  setNewContactNum("");
  setNewGender("");
  setNewWeight("");
  setNewDateOfExposure("");
  setPrevVacc("");
  setAllergies("");
  setIllOper("");
  setAssessment("");
  setNewTypeofBite("");
  setNewSite("");
  setNewBitingAnimal("");
  setNewCategory("");
  setNewPreviousAntiRabiesVaccine("");
  }

  async function loadArchivedPatients() {
  const data = await invoke("get_archived_patients_cmd");
  setArchivedPatients(data);
  setPatients(data); // 👈 add this line
}

async function handleCreate(e) {
  e.preventDefault();

  const ageValue = parseInt(newAge);
  const weightValue = parseFloat(newWeight);

  if (ageValue < 0 || isNaN(ageValue) || weightValue < 0 || isNaN(weightValue)) {
    alert("Age and Weight must be non-negative numbers.");
    return;
  }

  const payload = {
    id: null,
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    address: newAddress,
    date_of_birth: newDateofBirth,
    age: ageValue,
    gender: newGender,
    weight: weightValue,
    contact_number: newContactNum,
    prev_vacc: prevVacc,
    allergies: allergies,
    ill_oper: illOper,
    assessment: assessment,

  };

  try {
    // 🧩 Create patient and get ID directly
    const result = await createPatient(payload);
    const newPatientId = Number(result.patient_id);

    // ✅ Fetch full info using that ID
    const fullPatient = await invoke("get_patient_with_user", { id: newPatientId });
    setShowView(fullPatient);

    // Refresh list
    const refreshed = await getPatients();
    setAllPatients(refreshed);
    setPatients(refreshed);

    // Close form + reset inputs
    resetFormFields();
    setShowCreateForm(false);

    alert(`Patient created successfully!\nUsername: ${result.username}\nPassword: ${result.password}`);
  } catch (err) {
    console.error("Create failed:", err);
    alert("Create failed: " + (err?.message || err));
  }
}

  // ✅ Apply search + filter correctly
const applySearchAndFilter = (query = searchQuery, type = filterType) => {
  // Choose correct source
  const sourceList = viewArchived ? archivedPatients : allPatients;
  let results = [...sourceList];

  // --- Search logic ---
  if (query.trim() !== "") {
    const lowerQuery = query.toLowerCase();
    results = results.filter(
      (p) =>
        p.first_name.toLowerCase().includes(lowerQuery) ||
        p.last_name.toLowerCase().includes(lowerQuery) ||
        (p.middle_name && p.middle_name.toLowerCase().includes(lowerQuery))
    );
  }

  // --- Sort logic ---
  switch (type) {
    case "dataAsc":
      results.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
      break;
    case "dataDsc":
      results.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
      break;
    case "alphabetical":
      results.sort((a, b) => a.last_name.localeCompare(b.last_name));
      break;
    default:
      break;
  }

  // --- Apply to correct state ---
  if (viewArchived) setPatients(results);
  else setPatients(results);
};

  // ✅ Handlers
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    applySearchAndFilter(q, filterType);
  };

  const handleFilter = (e) => {
    const type = e.target.value;
    setFilterType(type);
    applySearchAndFilter(searchQuery, type);
  };


  function handleOpenCreateForm() {
   
    setShowCreateForm(true);
  }

  async function handleSaveAppointment(e) {
  e.preventDefault();
  if (!newSchedule) return alert("Please select a schedule.");

  // 🚫 Prevent same patient + same vaccine type + same schedule duplicates
  const duplicateConflict = appointments.some((a) => {
    if (editAppointment && a.id === editAppointment.id) return false; // skip itself
    const sameDate = a.schedule === newSchedule;
    const sameType =
      (a.prophylaxis_type || "").toLowerCase() ===
      (selectedProphylaxisType || "").toLowerCase();
    return sameDate && sameType;
  });

  if (duplicateConflict) {
    alert(
      `⚠️ This patient already has a ${selectedProphylaxisType || "similar"} appointment scheduled on ${newSchedule}.`
    );
    return;
  }

   let injectionSiteToSave = null;

  if (selectedProphylaxisType === "Regular Vaccine") {
    injectionSiteToSave = newInjectionSite || null;
  }

  if (newTetanusToxoid) {
    injectionSiteToSave = tetanusInjectionSite || null;
  }

  if (newTetanusToxoid) {
  inventoryManager.reduceByRoute("tetanus", "IM");
}



  const payload = {
    id: editAppointment ? editAppointment.id : null,
    patient_id: showView.id,
    schedule: newSchedule,
    date_of_exposure: newDateOfExposure,
    type_of_bite: newTypeofBite,
    site_of_bite: newSite,
    biting_animal: newBitingAnimal,
    category: newCategory,
    previous_vaccine: newPreviousAntiRabiesVaccine,
    prophylaxis_type: selectedProphylaxisType,
    vaccroute: newVaccRoute || null,
    tetanus_toxoid: newTetanusToxoid,
    tetanus_route: newTetanusRoute || null,
    tetanus_date: newTetanusDate || null,
    
    rig: !!newRIG,
    rig_date: newRIGDate || null,
    day_zero_date: dayZero || null,
  day_three_date: isBooster ? null : (dayThree || null),
  day_seven_date: daySeven || null,
  day_fourteen_date: isBooster ? null : (dayFourteen || null),
  day_thirty_date: dayThirty || null,
    injection_site: injectionSiteToSave,
  };

  try {
    if (editAppointment) {
      await updateAppointment(payload);
      alert("Appointment updated successfully!");
    } else {
      await createAppointment(payload);
      alert("Appointment added successfully!");
    }

    // ✅ Refresh the appointment list
    const updatedList = await getAppointments(showView.id);
    setAppointments(updatedList);

    // ✅ If editing, refresh the open appointment
    if (showViewAppointment && editAppointment && showViewAppointment.id === editAppointment.id) {
      const refreshed = updatedList.find((a) => a.id === editAppointment.id);
      if (refreshed) setShowViewAppointment(refreshed);
    }

    // ✅ Auto-open the latest appointment after creation
    if (!editAppointment) {
      const latestAntiRabies = updatedList
  .filter(a => a.prophylaxis_type && a.day_zero_date)
  .sort((a, b) => new Date(a.schedule) - new Date(b.schedule))
  .pop();

if (latestAntiRabies) {
  setShowViewAppointment(latestAntiRabies);
}

      // Reset fields
      setNewSchedule("");
      setNewDateOfExposure("");
      setNewTypeofBite("");
      setNewSite("");
      setNewBitingAnimal("");
      setNewCategory("");
      setNewPreviousAntiRabiesVaccine("");
      setSelectedProphylaxisType("");
      setNewTetanusToxoid(false);
      setNewRIG(false);
      setNewRIGDate("");
      setNewTetanusRoute("IM");
      setNewTetanusDate("");
      setNewInjectionSite("");
      setNewVaccRoute("");
    } else {
      setEditAppointment(null);
    }

    setShowAddAppointment(false); // Close modal
  } catch (err) {
    console.error("Error saving appointment:", err);
    alert("Error saving appointment: " + err);
  }
}


const calculateAge = (dob) => {
  if (!dob) return "";
  const [month, day, year] = dob.split("/").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

 const handleDateofBirthInput = (e) => {
  let input = e.target.value.replace(/\D/g, "");
  if (input.length >= 5)
    input = input.replace(/(\d{2})(\d{2})(\d{0,4}).*/, "$1/$2/$3");
  else if (input.length >= 3)
    input = input.replace(/(\d{2})(\d{0,2})/, "$1/$2");
  setDateofBirth(input);

  // Automatically calculate age
  const age = calculateAge(input);
  setNewAge(age);
};
const [showAddChoice, setShowAddChoice] = useState(false);
const [showAntiRabiesForm, setShowAntiRabiesForm] = useState(false);
const [showRegularVaccinationForm, setShowRegularVaccinationForm] = useState(false);
const [appointmentType, setAppointmentType] = useState("");
const [showAddRegular, setShowAddRegular] = useState(false);
const [editRegular, setEditRegular] = useState(null);

// 💉 Regular vaccine-specific fields
const [newRegularType, setNewRegularType] = useState("");
const [newRegularName, setNewRegularName] = useState(""); // for Flu
const [newPneumoniaType, setNewPneumoniaType] = useState(""); // for Pneumonia
const [newHepaDose, setNewHepaDose] = useState(""); // for Hepa B
const [newRegularDate, setNewRegularDate] = useState("");
const [doseDates, setDoseDates] = useState([]); 

useEffect(() => {
  // Only run auto-date logic when ADDING a new Hepa B vaccine
  if (!editRegular && newRegularType === "Hepa B Vaccine") {
    const today = getTodayPH();
    setNewRegularDate(today);

    const d = new Date(today);
    setDoseDates([
      { label: "1st Dose", date: today },
      { label: "2nd Dose (1 month later)", date: addMonths(d, 1) },
      { label: "3rd Dose (6 months later)", date: addMonths(d, 6) },
    ]);
  }
}, [newRegularType, editRegular]);

  // Handle opening the edit form
function handleEditAppointment(appointment) {
  setEditAppointment(appointment);

  setNewSchedule(appointment.schedule || getTodayDate());
  setNewDateOfExposure(appointment.date_of_exposure);
  setNewTypeofBite(appointment.type_of_bite || "");
  setNewSite(appointment.site_of_bite || "");
  setNewBitingAnimal(appointment.biting_animal || "");
  setNewCategory(appointment.category || "");
  setNewPreviousAntiRabiesVaccine(appointment.previous_vaccine || "");
  setSelectedProphylaxisType(appointment.prophylaxis_type || "");
  setNewVaccRoute(appointment.vaccroute || "");
  setNewTetanusToxoid(
    appointment.tetanus_toxoid === true ||
    appointment.tetanus_toxoid === 1 ||
    appointment.tetanus_toxoid === "1"
  );

  // 🩸 Add new fields
  setNewRIG(
  appointment.rig === true ||
  appointment.rig === 1 ||
  appointment.rig === "1"
);
  setNewRIGDate(appointment.rig_date || "");
  setNewTetanusRoute(appointment.tetanus_route || "IM");
  setNewTetanusDate(appointment.tetanus_date || "");

  // 💉 Vaccination schedule
  setDayZero(appointment.day_zero_date || "");
  setDayThree(appointment.day_three_date || "");
  setDaySeven(appointment.day_seven_date || "");
  setDayFourteen(appointment.day_fourteen_date || "");
  setDayThirty(appointment.day_thirty_date || "");

  setShowAddAppointment(true);
}

async function handleDeleteAppointment() {

  const appt = showViewAppointment || viewRegularData;

  if (!appt || !appt.id) {
    alert("Error: No appointment selected.");
    return;
  }

  if (!confirm("Are you sure you want to delete this appointment?")) return;

  try {
    const today = new Date().toISOString().split("T")[0];

    // ============================================
    // 🔵 ANTI-RABIES RESTORE (only if done today)
    // ============================================
    if (showViewAppointment) {

      const route = (showViewAppointment.vaccroute || "IM").trim();
      const amount = route === "ID" ? 0.1 : 1;

      const doneKeys = [
        "day_zero_given_date",
        "day_three_given_date",
        "day_seven_given_date",
        "day_fourteen_given_date",
        "day_thirty_given_date",
      ];

      const doneToday = doneKeys.some(
        (k) => showViewAppointment[k] === today
      );

      if (doneToday) {
        await inventoryManager.addStock("vaxirab", amount);
      }
    }

    // ============================================
    // 🟢 REGULAR VACCINE RESTORE (only if given today)
    // ============================================
   if (viewRegularData) {

  const t = viewRegularData.regular_type;
  const v = viewRegularData.vaccine_name;       // ⭐ THIS IS THE REAL TYPE
  let vaccineId = null;

  if (t === "Flu Vaccine") vaccineId = "flu";

  else if (t === "Pneumonia Vaccine") {
    if (viewRegularData.pneumonia_type === "PCV13") vaccineId = "pcv13";
    else if (viewRegularData.pneumonia_type === "PPSV23") vaccineId = "ppsv23";
  }

  else if (t === "Anti-Tetanus") {
    if (v === "Tetanus Toxoid") vaccineId = "tetanus";
    else if (v === "ATS") vaccineId = "ats";
    else if (v === "HTIG") vaccineId = "htig";
  }

  else if (t === "Hepa B Vaccine") vaccineId = "hepab";

  const today = new Date().toISOString().split("T")[0];
  const givenToday = viewRegularData.regular_given_date === today;

  if (vaccineId && givenToday) {
    await inventoryManager.restoreRegular(vaccineId);
  }
}


    // ============================================
    // ❌ DELETE APPOINTMENT
    // ============================================
    await invoke("delete_appointment", { id: appt.id });

    alert("Appointment deleted successfully!");

    // Refresh
    const updated = await getAppointments(showView.id);
    setAppointments(updated);

    // Close modals
    setShowViewAppointment(null);
    setShowViewRegular(false);
    setViewRegularData(null);

  } catch (err) {
    console.error("Failed to delete appointment:", err);
    alert("Failed to delete appointment: " + err);
  }
}



async function handleSaveRegularAppointment(e) {
  e.preventDefault();

  // -------------------------------------
  // 1️⃣ Prevent Duplicate Schedule
  // -------------------------------------
  const duplicateConflict = appointments.some((a) => {
    if (editRegular && a.id === editRegular.id) return false;

    const sameType =
      (a.regular_type || "").toLowerCase() ===
      (newRegularType || "").toLowerCase();

    const sameDate = (a.regular_date || "") === (newRegularDate || "");

    return sameType && sameDate;
  });

  if (duplicateConflict) {
    alert(`⚠️ This patient already has a ${newRegularType} scheduled on ${newRegularDate}.`);
    return;
  }

  const routeToSave = newRegularRoute || "IM";

  // -------------------------------------
  // 2️⃣ Build Base Payload
  // -------------------------------------
  let payload = {
    id: editRegular ? editRegular.id : null,
    patient_id: showView.id,
    schedule:
      newRegularType === "Hepa B Vaccine"
        ? newRegularDate
        : newRegularGivenDate,
    regular_type: newRegularType,
    regular_route: routeToSave,
    injection_site: newInjectionSite || null,
    status: "Pending",
  };

  // -------------------------------------
  // 3️⃣ Hepa B (3-Dose)
  // -------------------------------------
  if (newRegularType === "Hepa B Vaccine") {
    payload.regular_date = doseDates[0].date;
    payload.regular_given_date = newRegularGivenDate || null;

    payload.hepa_b_dose1 = doseDates[0].date;
    payload.hepa_b_dose2 = doseDates[1].date;
    payload.hepa_b_dose3 = doseDates[2].date;

    payload.hepa_b_status1 = "🔴 Upcoming";
    payload.hepa_b_status2 = "🔴 Upcoming";
    payload.hepa_b_status3 = "🔴 Upcoming";
  }

  // -------------------------------------
  // 4️⃣ AUTO-DONE Vaccines
  // -------------------------------------
  else {
    payload.regular_date = newRegularDate;
    payload.regular_given_date = newRegularGivenDate || null;
    payload.regular_status = "✔️ Done";

    payload.hepa_b_dose1 = null;
    payload.hepa_b_dose2 = null;
    payload.hepa_b_dose3 = null;
    payload.hepa_b_status1 = null;
    payload.hepa_b_status2 = null;
    payload.hepa_b_status3 = null;

    // Vaccine-specific fields
    if (newRegularType === "Anti-Tetanus") payload.vaccine_name = newRegularName;
    if (newRegularType === "Flu Vaccine") payload.vaccine_name = newRegularName;
    if (newRegularType === "Pneumonia Vaccine") payload.pneumonia_type = newPneumoniaType;
  }

  // -------------------------------------
  // 5️⃣ UNIVERSAL DEDUCTION LOGIC
  // -------------------------------------
  const today = new Date().toISOString().split("T")[0];
  const isTodayGiven = newRegularGivenDate === today;

  let vaccineId = null;



if (newRegularType === "Flu Vaccine") vaccineId = "flu";

else if (newRegularType === "Pneumonia Vaccine") {
  if (newPneumoniaType === "PCV13") vaccineId = "pcv13";
  else if (newPneumoniaType === "PPSV23") vaccineId = "ppsv23";
}

else if (newRegularType === "Anti-Tetanus") {
  if (newRegularName === "Tetanus Toxoid") vaccineId = "tetanus";
  else if (newRegularName === "ATS") vaccineId = "ats";
  else if (newRegularName === "HTIG") vaccineId = "htig";
}

else if (newRegularType === "Hepa B Vaccine") vaccineId = null;

  // Deduct only if:
  // ✔ Not Hepa B
  // ✔ Auto-done
  // ✔ Given TODAY
  if (vaccineId && newRegularType !== "Hepa B Vaccine" && isTodayGiven) {
    await inventoryManager.takeRegular(vaccineId);
  }

  // -------------------------------------
  // 6️⃣ SAVE to DB
  // -------------------------------------
  try {
    if (editRegular) {
      await invoke("update_appointment", { appointment: payload });
      alert("Regular vaccine updated!");
    } else {
      await invoke("create_appointment", { appointment: payload });
      alert("Regular vaccine added!");
    }

    // Refresh List
    const updatedList = await getAppointments(showView.id);
    setAppointments(updatedList);

    // If editing, refresh that record
    if (editRegular) {
      const refreshed = updatedList.find((v) => v.id === editRegular.id);
      if (refreshed) {
        setViewRegularData(refreshed);
        setShowViewRegular(true);
      }
      setEditRegular(null);
      setShowAddRegular(false);
      return;
    }

    // After creation → open newest entry
    const latestRegular = updatedList
      .filter((v) => v.regular_type)
      .sort((a, b) => new Date(a.regular_date) - new Date(b.regular_date))
      .pop();

    if (latestRegular) {
      setViewRegularData(latestRegular);
      setShowViewRegular(true);
    }

    resetRegularFields();
    setShowAddRegular(false);
  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save.");
  }
}



// helper: mark regular vaccine dose done (place inside Patient.jsx component)
const markRegularDone = async (appt) => {
  try {
    if (!appt || !appt.id) return alert("No appointment selected");

    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

    const isDue = (sched) => {
      if (!sched) return false;
      const sd = new Date(sched).setHours(0, 0, 0, 0);
      const td = new Date().setHours(0, 0, 0, 0);
      return td >= sd;
    };

    // Hepa B dose sequence
    const doses = [
      { sched: appt.hepa_b_dose1, given: "hepa_b_given1", status: "hepa_b_status1" },
      { sched: appt.hepa_b_dose2, given: "hepa_b_given2", status: "hepa_b_status2" },
      { sched: appt.hepa_b_dose3, given: "hepa_b_given3", status: "hepa_b_status3" },
    ];

    let nextIndex = doses.findIndex((d, i) => {
      const prevDone = i === 0 ? true : appt[`hepa_b_status${i}`] === "✔️ Done";
      const s = appt[d.status] || "";
      const pending = !s.toLowerCase().includes("done");
      return pending && prevDone && isDue(d.sched);
    });

    if (nextIndex === -1) {
      const upcoming = doses.find((d) => new Date(d.sched) > new Date());
      if (upcoming) return alert("Next dose is locked (future date).");
      return alert("No pending Hepa B dose to mark.");
    }

    // --- Identify correct vaccine ID ---
    let vaccineId = null;

if (appt.regular_type === "Hepa B Vaccine") {
  vaccineId = "hepab";

} else if (appt.regular_type === "Flu Vaccine") {
  vaccineId = "flu";

} else if (appt.regular_type === "Pneumonia Vaccine") {
  // detect which pneumonia vaccine was selected
  if (appt.pneumonia_type === "PCV13") vaccineId = "pcv13";
  else if (appt.pneumonia_type === "PPSV23") vaccineId = "ppsv23";

} else if (appt.regular_type === "Anti-Tetanus") {
  vaccineId = "tetanus";

} else if (appt.regular_type === "ATS") {
  vaccineId = "ats";

} else if (appt.regular_type === "HTIG") {
  vaccineId = "htig";
}


    // --- Deduct EXACTLY 1 dose for ALL regular vaccines ---
    if (vaccineId) {
  await inventoryManager.takeRegular(vaccineId);   // deduct 1 dose properly

    }

    // --- Apply DB updates ---
    const dose = doses[nextIndex];

    await invoke("status_apointment_update", {
      id: appt.id,
      field: dose.given,
      value: localToday,
    });

    await invoke("status_apointment_update", {
      id: appt.id,
      field: dose.status,
      value: "✔️ Done",
    });

    // Refresh UI
    await new Promise((r) => setTimeout(r, 150));
    const updated = await getAppointments(showView.id);
    setAppointments(updated);

    const refreshed = updated.find((a) => a.id === appt.id);
    setViewRegularData(refreshed);

    alert("✔ Regular vaccine dose marked as done");

  } catch (err) {
    alert("Error: " + err);
  }
};



async function handleEditRegular(appt) {
  setEditRegular(appt);     // store appointment being edited
  setShowAddRegular(true);  // open the popup
  setAppointmentType("Regular");

  // Prefill fields
  setNewRegularType(appt.regular_type);
  setNewRegularGivenDate(editRegular.regular_given_date || "");
setNewRegularDate(editRegular.regular_date || "");

  setNewRegularRoute(appt.regular_route || "IM");
  setNewInjectionSite(appt.injection_site || "");

  setNewRegularName(appt.vaccine_name || "");
  setNewPneumoniaType(appt.pneumonia_type || "");

  // Hepa B doses (if needed)
  if (appt.regular_type === "Hepa B Vaccine") {
    setDoseDates([
      { label: "1st Dose", date: appt.hepa_b_dose1 },
      { label: "2nd Dose (1 month later)", date: appt.hepa_b_dose2 },
      { label: "3rd Dose (6 months later)", date: appt.hepa_b_dose3 },
    ]);
  }
}

useEffect(() => {
  if (editRegular) {
    setNewRegularType(editRegular.regular_type || "");
    setNewRegularDate(editRegular.regular_date || "");
    setNewRegularName(editRegular.vaccine_name || "");
    setNewPneumoniaType(editRegular.pneumonia_type || "");
    setNewRegularRoute(editRegular.regular_route || "IM");
    setNewInjectionSite(editRegular.injection_site || "");

    // FIXED LINE
    setNewRegularGivenDate(
      editRegular.regular_given_date || editRegular.regular_date || ""
    );
  }
}, [editRegular]);

function resetRegularFields() {
  setNewRegularType("");
  setNewRegularName("");
  setNewPneumoniaType("");
  setNewRegularRoute("IM");
  setNewInjectionSite("");
  
  setNewRegularDate("");
  setNewRegularGivenDate("");
  setDoseDates([]);
  

  setEditRegular(null); // Important: ensure no leftover edit data
}

// Filter + Sort appointment history
const filteredAppointments = appointments
  .filter((appt) => {
    if (!apptFilterType) return true;

    // Works for both anti-rabies & regular vaccines
    return (
      appt.prophylaxis_type === apptFilterType ||
      appt.regular_type === apptFilterType
    );
  })
  .sort((a, b) => {
    const da = new Date(a.schedule || a.regular_date);
    const db = new Date(b.schedule || b.regular_date);
    return apptSortOrder === "newest" ? db - da : da - db;
  });

const getRegularStatusDisplay = (appt) => {
  if (!appt.regular_type) return "—";

  // 1) Single-dose regular vaccines
  if (appt.regular_type !== "Hepa B Vaccine") {
    return appt.regular_status || "🟡 Pending";
  }

  // 2) Hepa B — combine statuses
  const doses = [
    { label: "Dose 1", status: appt.hepa_b_status1 },
    { label: "Dose 2", status: appt.hepa_b_status2 },
    { label: "Dose 3", status: appt.hepa_b_status3 },
  ];

  // Show summary, e.g. "Dose 2 Missed", "All Done", etc.
  if (doses.every(d => (d.status || "").toLowerCase().includes("done"))) {
    return "✔️ All Doses Done";
  }

  const missed = doses.find(d => (d.status || "").toLowerCase() === "missed");
  if (missed) return `${missed.label}: Missed`;

  const pending = doses.find(d => (d.status || "").toLowerCase().includes("pending"));
  if (pending) return `${pending.label}: 🟡 Pending`;

  const upcoming = doses.find(d => (d.status || "").toLowerCase().includes("upcoming"));
  if (upcoming) return `${upcoming.label}: 🔴 Upcoming`;

  return "—";
};

  // ------------------ JSX RETURN ------------------
  return (
    <div className="patientDiv">
      <div className="container">
        <div className="searchBar flex">
          <input
            type="text"
            placeholder="Search by Name"
            className="searchInput"
            value={searchQuery}
            onChange={handleSearch}
          />
          <select
            className="filterDropdown"
            value={filterType}
            onChange={handleFilter}
          >
            <option value="">---</option>
            <option value="dataAsc">Date Created</option>
            <option value="alphabetical">Last Name Ascending</option>
            <option value="dataDsc">Last Name Descending</option>
          </select>


        </div>

        
        {showCreateForm && (
          <div className="popup">
            <form className="createpatientpopupForm" onSubmit={handleCreate}>
              <h3>Add New Patient</h3>
              <section className="PatientInfo1">
              <div className="input-row">
              <b>Full Name: </b>{" "}
                <input
                  type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <input
                  type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                <input
                  type="text" placeholder="Middle Name" value={middleName} onChange={(e) => setMiddleName(e.target.value)}/>
                <input type="number" placeholder="Age" value={newAge} readOnly/>     
              </div>
            </section>

            <section className="PatientInfo2">
            <div className="input-row">
             <b>Date of Birth:</b>{" "}
                <input
                type="text" placeholder="MM/DD/YYYY" pattern="\d{2}/\d{2}/\d{4}" value={newDateofBirth} onChange={handleDateofBirthInput} maxLength={10} required />
        

                <select
  value={newAddress}
  onChange={(e) => setNewAddress(e.target.value)}
  required
>
  <option value="">Select Address</option>
  <optgroup label="Cities">
    <option value="Legazpi City">Legazpi City</option>
    <option value="Ligao City">Ligao City</option>
    <option value="Tabaco City">Tabaco City</option>
  </optgroup>
  <optgroup label="Municipalities">
    <option value="Bacacay">Bacacay</option>
    <option value="Camalig">Camalig</option>
    <option value="Daraga">Daraga</option>
    <option value="Guinobatan">Guinobatan</option>
    <option value="Jovellar">Jovellar</option>
    <option value="Libon">Libon</option>
    <option value="Malilipot">Malilipot</option>
    <option value="Malinao">Malinao</option>
    <option value="Manito">Manito</option>
    <option value="Oas">Oas</option>
    <option value="Pio Duran">Pio Duran</option>
    <option value="Polangui">Polangui</option>
    <option value="Rapu-Rapu">Rapu-Rapu</option>
    <option value="Santo Domingo">Santo Domingo</option>
    <option value="Tiwi">Tiwi</option>
  </optgroup>
</select>

                <select
                  className="Gender" value={newGender} onChange={(e) => setNewGender(e.target.value)} required>
                   <option value=""> Select Gender </option>
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                   <option value="Other">Other</option>
                  </select>
                <input
                  type="number" placeholder="Weight (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} min="0" // Invalid choice: must be non-negative // 
                  step="0.1" required />
            </div>
          </section>

          <section className="PatientInfo2_1">
            <div className="input-row">
           <input
            type="text"
            placeholder="+63"
              value={newContactNum}
              onChange={(e) => {
             let input = e.target.value;

              // Always ensure +63 prefix
              if (!input.startsWith("+63")) {
                // If user tries to delete +63, keep it intact
                if (input.startsWith("+6") || input.startsWith("+") || input === "") {
                  input = "+63";
                } else {
                  input = "+63" + input.replace(/^\+?63?/, "");
                }
              }

              // Allow only digits after +63
              input = "+63" + input.slice(3).replace(/\D/g, "");

              // Limit to +63 followed by 10 digits (total 13 chars)
              if (input.length > 13) input = input.slice(0, 13);

              setNewContactNum(input);
            }}
            onFocus={() => {
              // Auto-fill +63 if the field is empty
              if (newContactNum === "") setNewContactNum("+63");
            }}
            required
          />

            </div>
          </section>
              {/* BUTTONS */}

              <div className="popupActions">
                <button className="SubmitBtn" type="submit">
                  Submit
                </button>
                <button className="CancelBtn" type="button" onClick={() => {
                resetFormFields();
                setShowCreateForm(false);}}>Cancel</button>

              </div>
            </form>
          </div>
        )}

        {/* Patient View Data Modal */}
        {/* NOTE: MIGHT CHANGE THE DESIGN LATER ON */}
        {showView && (
          <div className="popupView">
            <div className="view-modalPatient">
              <div className="loginandtext">
            <h3>Patient Record</h3>
<div className="loginInfo"> 
  <div className="logcred">
  <p><b>Username:</b> {showView.username || "Not generated"}</p>
<p><b>Password:</b> 
  {showView.password 
    ? <span>{showPassword ? showView.password : "••••••"}</span> 
    : "Not available"}

<button onClick={() => setShowPassword(prev => !prev)}>
  {showPassword ? (
    <PiEyeClosedLight className="icon" /> // show closed eye when visible
  ) : (
    <PiEyeLight className="icon" /> // show open eye when hidden
  )}
</button>
</p>

  <div className="updatePasswordSection">
    <input
      type="password"
      placeholder="Enter new password"
      value={showView.newPassword || ""}
      onChange={(e) =>
        setShowView((prev) => ({ ...prev, newPassword: e.target.value }))
      }
    />
    <button
  className="UpdatePasswordBtn"
  onClick={async () => {
    if (!showView.newPassword || showView.newPassword.trim() === "") {
      alert("Please enter a new password!");
      return;
    }

    try {
      // update on backend
      await invoke("update_muser_password", {
        patientId: showView.id,
        newPassword: showView.newPassword,
      });

      // re-fetch updated patient (so plain password returned by get_patient_with_user)
      const updated = await invoke("get_patient_with_user", { id: showView.id });

      // update local state to reflect server data, clear input
      setShowView(prev => ({ ...prev, ...updated, newPassword: "" }));

      alert("Password updated successfully!");
    } catch (err) {
      console.error("Failed to update password:", err);
      alert("Failed to update password: " + err);
    }
  }}
>
  Update Password
</button>
</div>
    </div>
    </div>
    </div>
            <section className="modal-secton">
             
              <h4 className="section-title"></h4>
              
              <div className="title">
              <h4>Personal Details</h4>
              </div>
              <div className="info-grid">
              
              <p><b>Name:</b> {showView.last_name} {showView.first_name} {showView.middle_name}</p>
              <p><b>Age:</b> {showView.age}</p>
              <p><b>Date of Birth</b> {showView.date_of_birth}</p>
              <p><b>Gender:</b> {showView.gender}</p>
              <p><b>Weight:</b> {showView.weight}</p>
              <p><b>Contact Number</b> {showView.contact_number}</p>
              <p><b>Address:</b> {showView.address}</p>
           <div className="modal-buttons"> <button className="Closebtn" onClick={() => setShowView(null)}>X</button>
           </div>
              </div>
              <h4 className="section-title"></h4>
             <div className="title2">
    <h4>Medical History</h4>
  </div>

  {!isEditingMedical ? (
    <>
        <div className="medical-display"> 
        <div className="medical-display2"> 
        
          <p><b>Previous Vaccines:</b> {showView.prev_vacc || "—"}</p> 
          <p><b>Allergies:</b> {showView.allergies || "—"}</p> 
          <p><b>Illness / Operation:</b> {showView.ill_oper || "—"}</p> 
          </div> 
          <div className="assessment-display"> <p><b>Assessment:</b></p> 
          <div className="assessment-box"> {showView.assessment || "—"} 
        </div> 
        </div>
        </div>
    </>
  ) : (
    <div className="field-container">
      {/* Date of Exposure */}
       <div className="info-grid2">
      

      {/* ================= PREVIOUS VACCINE ================= */}
      <label>Previous Vaccine</label>
      <div className="dynamic-field">
        {editedMedical.prevVaccs.map((v, i) => (
          <div key={i} className="field-row">
            <select
              value={v.option}
              onChange={(e) => {
                const selected = e.target.value;
                setEditedMedical((prev) => {
                  const newList = [...prev.prevVaccs];
                  newList[i] = {
                    option: selected,
                    custom: selected === "Other" ? prev.prevVaccs[i].custom || "" : "",
                  };
                  return { ...prev, prevVaccs: newList };
                });
              }}
            >
              <option value="" disabled hidden>Previous Vaccine</option>
              <option value="None">None</option>
              <option value="Anti-Rabies">Anti-Rabies</option>
              <option value="Tetanus">Tetanus</option>
              <option value="Hepatitis B">Hepatitis B</option>
              <option value="COVID-19">COVID-19</option>
              <option value="Pre-Exposure Prophylaxis">Pre-Exposure Prophylaxis</option>
              <option value="Post-Exposure Prophylaxis">Post-Exposure Prophylaxis</option>
              <option value="Flu">Flu</option>
              <option value="Other">Other</option>
            </select>

            {v.option === "Other" && (
              <input
                type="text"
                placeholder="Enter vaccine name"
                value={v.custom}
                onChange={(e) => {
                  const custom = e.target.value;
                  setEditedMedical((prev) => {
                    const newList = [...prev.prevVaccs];
                    newList[i] = { ...newList[i], custom };
                    return { ...prev, prevVaccs: newList };
                  });
                }}
              />
            )}

            {i === editedMedical.prevVaccs.length - 1 && (
              <button
                type="button"
                className="add-btn"
                onClick={() =>
                  setEditedMedical((prev) => ({
                    ...prev,
                    prevVaccs: [...prev.prevVaccs, { option: "", custom: "" }],
                  }))
                }
              >
                +
              </button>
            )}
            {editedMedical.prevVaccs.length > 1 && (
              <button
                type="button"
                className="remove-btn"
                onClick={() =>
                  setEditedMedical((prev) => {
                    const newList = prev.prevVaccs.filter((_, idx) => idx !== i);
                    return { ...prev, prevVaccs: newList };
                  })
                }
              >
                −
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ================= ALLERGIES ================= */}
      <label>Allergies</label>
      <div className="dynamic-field">
        {editedMedical.allergies.map((a, i) => (
          <div key={i} className="field-row">
            <select
              value={a.option}
              onChange={(e) => {
                const selected = e.target.value;
                setEditedMedical((prev) => {
                  const newList = [...prev.allergies];
                  newList[i] = {
                    option: selected,
                    custom: selected === "Other" ? prev.allergies[i].custom || "" : "",
                  };
                  return { ...prev, allergies: newList };
                });
              }}
            >
              <option value="" disabled hidden>Select Allergy</option>
              <option value="None">None</option>
              <option value="Peanuts">Peanuts</option>
              <option value="Penicillin">Penicillin</option>
              <option value="Seafood">Seafood</option>
              <option value="Latex">Latex</option>
              <option value="Other">Other</option>
            </select>

            {a.option === "Other" && (
              <input
                type="text"
                placeholder="Enter allergy"
                value={a.custom}
                onChange={(e) => {
                  const custom = e.target.value;
                  setEditedMedical((prev) => {
                    const newList = [...prev.allergies];
                    newList[i] = { ...newList[i], custom };
                    return { ...prev, allergies: newList };
                  });
                }}
              />
            )}

            {i === editedMedical.allergies.length - 1 && (
              <button
                type="button"
                className="add-btn"
                onClick={() =>
                  setEditedMedical((prev) => ({
                    ...prev,
                    allergies: [...prev.allergies, { option: "", custom: "" }],
                  }))
                }
              >
                +
              </button>
            )}
            {editedMedical.allergies.length > 1 && (
              <button
                type="button"
                className="remove-btn"
                onClick={() =>
                  setEditedMedical((prev) => {
                    const newList = prev.allergies.filter((_, idx) => idx !== i);
                    return { ...prev, allergies: newList };
                  })
                }
              >
                −
              </button>
            )}
          </div>
        ))}
      </div>

    {/* ================= ILLNESS / OPERATION ================= */}
    <label>Illness / Operation</label>
    <div className="dynamic-field">
      {editedMedical.illOper.map((ill, i) => (
        <div key={i} className="field-row">
          <select
            value={ill.option}
            onChange={(e) => {
              const selected = e.target.value;
              setEditedMedical((prev) => {
                const newList = [...prev.illOper];
                newList[i] = {
                  option: selected,
                  custom: selected === "Other" ? prev.illOper[i].custom || "" : "",
                };
                return { ...prev, illOper: newList };
              });
            }}
          >
            <option value="" disabled hidden>Select Illness / Operation</option>
            <option value="None">None</option>
            <option value="Appendectomy">Appendectomy</option>
            <option value="Diabetes">Diabetes</option>
            <option value="Hypertension">Hypertension</option>
            <option value="Asthma">Asthma</option>
            <option value="Other">Other</option>
          </select>

          {ill.option === "Other" && (
            <input
              type="text"
              placeholder="Enter illness / operation"
              value={ill.custom}
              onChange={(e) => {
                const custom = e.target.value;
                setEditedMedical((prev) => {
                  const newList = [...prev.illOper];
                  newList[i] = { ...newList[i], custom };
                  return { ...prev, illOper: newList };
                });
              }}
            />
          )}

          {i === editedMedical.illOper.length - 1 && (
            <button
              type="button"
              className="add-btn"
              onClick={() =>
                setEditedMedical((prev) => ({
                  ...prev,
                  illOper: [...prev.illOper, { option: "", custom: "" }],
                }))
              }
            >
              +
            </button>
          )}
          {editedMedical.illOper.length > 1 && (
            <button
              type="button"
              className="remove-btn"
              onClick={() =>
                setEditedMedical((prev) => {
                  const newList = prev.illOper.filter((_, idx) => idx !== i);
                  return { ...prev, illOper: newList };
                })
              }
            >
              −
            </button>
          )}
        </div>
      ))}
    </div>
    </div>

   {/* Assessment */}
  <label>Assessment</label>
    <div className="assesinp">
    
    <textarea
  value={showView.assessment || ""}
  onChange={(e) =>
    setShowView((prev) => ({ ...prev, assessment: e.target.value }))
  }
   style={{
    resize: "none",
    width: "1120px",
    height: "120px",
  }}
/> 
</div>

</div>
  )}
 
  


<div className="medicalButtons">
  {!isEditingMedical ? (
    <button
      className="EditBtn"
      onClick={() => setIsEditingMedical(true)}
    >
      Edit
    </button>
  ) : (
    <>
     <button
  className="SaveBtn"
  onClick={async () => {
    try {
      await invoke("update_patient_medical", {
        id: showView.id,
      prevVacc: editedMedical.prevVaccs
          .map(v => (v.option === "Other" ? v.custom : v.option))
          .filter(Boolean)
          .join(", "), // Changed from prev_vacc
      allergies: editedMedical.allergies
          .map(a => (a.option === "Other" ? a.custom : a.option))
          .filter(Boolean)
          .join(", "),
      illOper: editedMedical.illOper
          .map(i => (i.option === "Other" ? i.custom : i.option))
          .filter(Boolean)
          .join(", "),// Changed from ill_oper
      assessment: showView.assessment || "",
      });
       alert("Medical details updated successfully!");
      setIsEditingMedical(false);

      // Refresh patient info after save
      const refreshed = await invoke("get_patient_with_user", { id: showView.id });
      setShowView(refreshed);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update medical history: " + err);
    }
  }}
>
  Save
</button>
      <button
        className="CancelBtn"
        onClick={async () => {
          const refreshed = await invoke("get_patient_with_user", { id: showView.id });
          setShowView(refreshed);
          setIsEditingMedical(false);
        }}
      >
        Cancel
      </button>
    </>
  )}
</div>
              
      </section>
      <h4 className="section-title"></h4>
  



              {/* Appointment History */}

         <div className="appointmentHistory">

          <div className="containerappt2">
            <div className="textbtncont">
              <h3>Appointment History</h3>

  {/* SORT + FILTER CONTROLS */}
  <div className="apptHeaderBar">
  <div className="apptFilterControls">
    
    {/* Sort */}
    <div className="sortOptions1">
      <label>
        <input
          type="radio"
          name="apptSort"
          value="newest"
          checked={apptSortOrder === "newest"}
          onChange={(e) => setApptSortOrder(e.target.value)}
        />
        Newest 
      </label>

      <label>
        <input
          type="radio"
          name="apptSort"
          value="oldest"
          checked={apptSortOrder === "oldest"}
          onChange={(e) => setApptSortOrder(e.target.value)}
        />
        Oldest 
      </label>
    </div>

    {/* Filter */}
    <select
      className="apptFilterDropdown1"
      value={apptFilterType}
      onChange={(e) => setApptFilterType(e.target.value)}
    >
      <option value="">All</option>
      <option value="Booster">Booster</option>
      <option value="Post Prophylaxis">Post Prophylaxis</option>
      <option value="Pre Prophylaxis">Pre Prophylaxis</option>
      <option value="Hepa B Vaccine">Hepa B</option>
      <option value="Flu Vaccine">Flu</option>
      <option value="Pneumonia Vaccine">Pneumonia</option>
      <option value="Anti-Tetanus">Anti-Tetanus</option>
    </select>

  </div>



  
  <div className="btnapptadd">
           <button
  className="AddAppointmentBtn"
  onClick={() => {
    setShowAddChoice(true);
  }}
>
  Add Appointment
</button>
</div>
</div>
</div>


{showViewAppointment && (
  <div className="appointment-view-overlay" onClick={() => setShowViewAppointment(null)}>
    <div
      className="appointment-view-modal"
      onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
    >
      
      <h2>Appointment Details</h2>

      <h3 className="appointment-section-title">History of Exposure</h3>
      
      <div className="infolbl1">
        <span className="info-label">Date of Exposure: {showViewAppointment.date_of_exposure || "—"}</span>
      <span className="info-label">Type of Bite: {showViewAppointment.type_of_bite || "—"}</span>
      <span className="info-label">Site of Bite: {showViewAppointment.site_of_bite || "—"}</span>
      <span className="info-label">Biting Animal: {showViewAppointment.biting_animal || "—"}</span> 
      
      </div>

      <div className="infolbl2">
        <span className="info-label">Category: {showViewAppointment.category || "—"}</span>
      <span className="info-label">Previous Anti-Rabies Vaccine: {showViewAppointment.previous_vaccine || "—"}</span>
      </div>

      <h3 className="appointment-section-title">Vaccine Information</h3>

      <div className="infolbl3">
      <span className="info-label">Generic Name:PCECV</span>
      <span className="info-label">Brand Name:Vaxirab N</span>
      <span className="info-label">Route: {showViewAppointment.vaccroute || "—"}</span>

     
    </div>

 <span className="info-label">Prophylaxis Type:{showViewAppointment.prophylaxis_type || "—"}</span>
     
<div className="infolbl4">
  <div className="date-grid-container">
    <div className="date-header-row">
      <div className="date-header">Scheduled Dates</div>
      <div className="date-header">Date Given</div>
      <div className="date-header">Status</div>
    </div>

    {(() => {
      const isDateAvailable = (scheduledDate) => {
        if (!scheduledDate) return false;
        const today = new Date().setHours(0, 0, 0, 0);
        const sched = new Date(scheduledDate).setHours(0, 0, 0, 0);
        return today >= sched;
      };

      const todayStr = new Date().toISOString().split("T")[0];

      // ✅ Auto-fill helper (only fills once, doesn't overwrite)
      const handleAutoFill = (fieldName, scheduledDate, prevGiven) => {
        if (
          isDateAvailable(scheduledDate) &&
          !showViewAppointment[fieldName] &&
          (prevGiven === undefined || prevGiven)
        ) {
          setShowViewAppointment((prev) => ({
            ...prev,
            [fieldName]: todayStr,
          }));
        }
      };

      const getStatus = (givenDate, scheduledDate, storedStatus) => {
        if (storedStatus) return storedStatus; // use DB if exists
        if (givenDate) return "✔️ Done";
        if (isDateAvailable(scheduledDate)) return "🟡 Pending";
        return "🔴 Upcoming";
      };

      // ✅ renderRow now only uses the true "given" date (not scheduled)
    const renderRow = (label, schedKey, givenKey, statusKey, prevGivenKey) => {
  const scheduled = showViewAppointment[schedKey];
  const given = showViewAppointment[givenKey];
  const status = showViewAppointment[statusKey];

  return (
    <div className="prophylaxis-item-grid" key={label}>
      <span>
        {label}: {scheduled || "—"}
      </span>

      <input
        type="date"
        value={given || ""}
        readOnly
        disabled
        style={{ background: "#f5f5f5", cursor: "not-allowed" }}
      />

      <span>
        {status
          ? status
          : given
          ? "✔️ Done"
          : isDateAvailable(scheduled)
          ? "🟡 Pending"
          : "🔴 Upcoming"}
      </span>
    </div>
  );
};

      // ✅ Render per prophylaxis type
      if (showViewAppointment.prophylaxis_type === "Booster") {
        return (
          <>
            {renderRow("D0", "day_zero_date", "day_zero_given_date", "day_zero_status")}
            {renderRow("D7", "day_seven_date", "day_seven_given_date", "day_seven_status", "day_zero_given_date")}
            {renderRow("D30", "day_thirty_date", "day_thirty_given_date", "day_thirty_status", "day_seven_given_date")}
          </>
        );
      } else {
        return (
          <>
            {renderRow("D0", "day_zero_date", "day_zero_given_date", "day_zero_status")}
            {renderRow("D3", "day_three_date", "day_three_given_date", "day_three_status", "day_zero_given_date")}
            {renderRow("D7", "day_seven_date", "day_seven_given_date", "day_seven_status", "day_three_given_date")}
            {renderRow("D14", "day_fourteen_date", "day_fourteen_given_date", "day_fourteen_status", "day_seven_given_date")}
            {renderRow("D30", "day_thirty_date", "day_thirty_given_date", "day_thirty_status", "day_fourteen_given_date")}
          </>
        );
      }
    })()}
  </div>

  {/* 🟩 Overall Schedule Status */}
  <div className="status-summary">
    <b>Overall Status:</b>{" "}
    {(() => {
      const totalDays =
        showViewAppointment.prophylaxis_type === "Booster" ? 3 : 5;
      const completedDays = [
        showViewAppointment.day_zero_given_date,
        showViewAppointment.day_three_given_date,
        showViewAppointment.day_seven_given_date,
        showViewAppointment.day_fourteen_given_date,
        showViewAppointment.day_thirty_given_date,
      ].filter(Boolean).length;

      if (completedDays === 0) return "🔴 Not Started";
      if (completedDays < totalDays) return "🟡 In Progress";
      return "✔️ Finished";
    })()}
  </div>

<button
  className="SaveBtn"
  disabled={
    showViewAppointment.day_zero_status === "Missed" ||
    showViewAppointment.day_three_status === "Missed" ||
    showViewAppointment.day_seven_status === "Missed" ||
    showViewAppointment.day_fourteen_status === "Missed" ||
    showViewAppointment.day_thirty_status === "Missed"
  }
  onClick={async () => {
    try {
      const today = new Date();
      const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];

      // helper: only mark dates that are due or today
      const isDateAvailable = (scheduledDate) => {
        if (!scheduledDate) return false;
        const todayDate = new Date().setHours(0, 0, 0, 0);
        const schedDate = new Date(scheduledDate).setHours(0, 0, 0, 0);
        return todayDate >= schedDate;
      };

      const appointment = { ...showViewAppointment };

      const sequence =
        appointment.prophylaxis_type === "Booster"
          ? [
              ["day_zero", "day_zero_date"],
              ["day_seven", "day_seven_date"],
              ["day_thirty", "day_thirty_date"],
            ]
          : [
              ["day_zero", "day_zero_date"],
              ["day_three", "day_three_date"],
              ["day_seven", "day_seven_date"],
              ["day_fourteen", "day_fourteen_date"],
              ["day_thirty", "day_thirty_date"],
            ];

      // 🔍 Find the first truly pending, unlocked, due dose
      const nextDue = sequence.find(([prefix, schedKey], idx) => {
        const givenKey = `${prefix}_given_date`;
        const statusKey = `${prefix}_status`;
        const schedDate = appointment[schedKey];

        const prevPrefix = idx === 0 ? null : sequence[idx - 1][0];
        const prevStatusKey = prevPrefix ? `${prevPrefix}_status` : null;
        const prevGivenDone = prevStatusKey
          ? appointment[prevStatusKey] === "✔️ Done"
          : true;

        const isPending =
          !appointment[givenKey] ||
          appointment[statusKey]?.toLowerCase() === "pending" ||
          appointment[statusKey] === "🟡 Pending";

        // ✅ must be pending, previous dose done, and date due (not locked)
        return isPending && prevGivenDone && isDateAvailable(schedDate);
      });

      if (!nextDue) {
        // If all pending doses are still in the future (locked)
        const upcoming = sequence.find(([prefix, schedKey]) => {
          const schedDate = appointment[schedKey];
          const schedTime = new Date(schedDate).setHours(0, 0, 0, 0);
          const todayTime = new Date().setHours(0, 0, 0, 0);
          return schedTime > todayTime;
        });

        if (upcoming) {
          alert("⚠️ The next dose is still locked (scheduled in the future).");
        } else {
          alert("No pending dose available to mark as done.");
        }
        return;
      }

      // ✅ Mark only that single dose as done today
      const [prefix] = nextDue;
      const givenKey = `${prefix}_given_date`;
      const statusKey = `${prefix}_status`;

      appointment[givenKey] = localToday;
      appointment[statusKey] = "✔️ Done";

      // 🧠 Update overall status
      const allStatuses = sequence.map(([p]) => appointment[`${p}_status`]);
      const allDone = allStatuses.every((s) => s === "✔️ Done");
      const anyDone = allStatuses.some((s) => s === "✔️ Done");

      appointment.status = allDone ? "Finished" : anyDone ? "In Progress" : "Not Started";
      appointment.schedule_status = appointment.status;

      if (!appointment.id) {
        alert("Appointment ID missing — cannot update.");
        return;
      }

      await invoke("update_appointment", { appointment });
      await invoke("increment_queue");

      if (allDone) {
        await invoke("status_apointment_update", {
          id: appointment.id,
          status: "Finished",
        });
      }

      await new Promise((r) => setTimeout(r, 300));

      localStorage.setItem("refreshScheduleFlag", Date.now().toString());
      window.dispatchEvent(new Event("refreshSchedule"));

      const updatedList = await getAppointments(showView.id);
      setAppointments(updatedList);

      const refreshed = updatedList.find((a) => a.id === appointment.id);
      if (refreshed) setShowViewAppointment(refreshed);

      setIsSavedGivenDates(true);
      alert(`✅ ${prefix.replace("day_", "Day ")} marked as Done!`);
    } catch (err) {
      console.error("Failed to save vaccination dates:", err);
      alert("❌ Failed to save given dates: " + err);
    }

// Deduct depending on anti-rabies route (IM = 1, ID = 0.1)
try {
  const route = (showViewAppointment?.vaccroute || "IM").trim();
  await inventoryManager.reduceByRoute("vaxirab", route);
} catch (err) {
  console.error("Inventory reduce failed:", err);
  // optionally alert user:
  // alert("Failed to update inventory: " + err);
}


  }}
>
  Mark Done
</button>

</div>



      <h3 className="appointment-section-title">Additional Details</h3>
      <div className="infolbl5">
        <span className="info-label">RIG: {showViewAppointment.rig ? "Given" : "Not Given"}</span>
        <span className="info-label">RIG Date Given: {showViewAppointment.rig_date || "—"}</span>
      </div>
      
      <div className="infolbl6">
      <span className="info-label">Tetanus Toxoid 0.5ml: {showViewAppointment.tetanus_toxoid ? "Given" : "Not Given"}</span>
      <span className="info-label">Tetanus Route: {showViewAppointment.tetanus_route || "—"}</span>
      <span className="info-label">Injection Site: {showViewAppointment.injection_site || "—"}</span>
      <span className="info-label">Date Given: {showViewAppointment.tetanus_date || "—"}</span>
      </div>

      <div className="appointment-buttons">
        <button className="edit" onClick={() => handleEditAppointment(showViewAppointment)}>Edit</button>
        <button className="close" onClick={() => setShowViewAppointment(null)}>Close</button>
      <button
  className="printBtn"
  onClick={() => {
  const printable = document.getElementById("printableForm");
  if (!printable) {
    alert("Printable form not found.");
    return;
  }

  // ✅ Convert QR canvas to base64 image
  const qrCanvas = printable.querySelector("canvas");
  let qrImage = "";
  if (qrCanvas) {
    qrImage = `<img src="${qrCanvas.toDataURL("image/png")}" width="64" height="64" />`;
  }

  // Replace the QR canvas with the image in the print contents
  let printContents = printable.innerHTML;
  if (qrImage) {
    printContents = printContents.replace(/<canvas[^>]*><\/canvas>/, qrImage);
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
  <html>
  <head>
    <style>
      .card-print {
        font-family: Arial, sans-serif;
        width: 5.5in;
        height: 4in;
        font-size: 10px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        text-align: center;
      }
        @page {
  size: 5.5in 4in;      /* exact card size */
  margin: 0;            /* remove printer’s default margins */
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;     /* prevent spill to a 2nd page */
}

.card-print {
  width: 5.5in;
  height: 4in;
  box-sizing: border-box;
  page-break-after: avoid;  /* don’t break */
  page-break-inside: avoid;
}
      .p-info, .p-detail, .section-title, .card-title {
        text-align: center;
      }
      .vaccine-table {
        width: 90%;
        border-collapse: collapse;
        margin: 4px auto;
      }
      .vaccine-table th, .vaccine-table td {
        border: 1px solid #000;
        text-align: center;
        padding: 2px;
      }
      .qr-section { text-align: center; margin-top: 4px; }
    </style>
  </head>
  <body>${printContents}</body>
  </html>
`);

  doc.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}}

>
 Print Schedule Card
</button>
<button onClick={() => handleDeleteAppointment(showViewAppointment)}>
  Delete
</button>
      </div>
    </div>

    
  </div>
)}

{/* 🔹 Printable Vaccination Card */}
<div id="printableForm" style={{ display: "none" }}>
  <div className="card-print">
    <h2 className="card-title">ANTI-RABIES VACCINATION CARD</h2>

    <div className="p-info"><b>Name:</b> {showView.last_name}, {showView.first_name} {showView.middle_name}
    <b>Address:</b> {showView.address}
    <div className="info-nutha">
    <b> Age:</b> {showView.age} 
    <b> Sex:</b> {showView.gender}
    <b> Weight:</b> {showView.weight} kg</div>
    </div>
    <div className="section-title">HISTORY OF EXPOSURE</div>

    <div className="p-detail"><b>Date of Exposure:</b> {showView.date_of_exposure || "—"}
    <b> Type of Bite:</b>{showViewAppointment?.type_of_bite || "—"}
    <b> Site of Bite:</b> {showViewAppointment?.site_of_bite || "—"}
    </div>
    <div className="info-one">
    <b> Biting Animal:</b> {showViewAppointment?.biting_animal || "—"}
    <b> Category:</b> {showViewAppointment?.category || "—"}</div>

    <div className="section-title">ANTI-RABIES VACCINE SCHEDULE</div>
    <table className="vaccine-table">
      <thead>
        <tr>
          <th>Scheduled Dates</th>
          <th>Date Given</th>
          <th>Signature</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>{showViewAppointment?.day_zero_date}</td><td>{showViewAppointment?.day_zero_given_date || ""}</td><td></td></tr>
        <tr><td>{showViewAppointment?.day_three_date}</td><td>{showViewAppointment?.day_three_given_date || ""}</td><td></td></tr>
        <tr><td>{showViewAppointment?.day_seven_date}</td><td>{showViewAppointment?.day_seven_given_date || ""}</td><td></td></tr>
        <tr><td>{showViewAppointment?.day_fourteen_date}</td><td>{showViewAppointment?.day_fourteen_given_date || ""}</td><td></td></tr>
        <tr><td>{showViewAppointment?.day_thirty_date}</td><td>{showViewAppointment?.day_thirty_given_date || ""}</td><td></td></tr>
      </tbody>


     
    </table>

    <div className="section-title">ADDITIONAL DETAILS</div>
    <div className="linefield0">
    <b>RIG:</b> {showViewAppointment?.rig ? "Given" : "Not Given"} &nbsp;&nbsp;
      <b> Given Date:</b> {showViewAppointment?.rig_date || "—"} 
      </div>
    <div className="line-field">
      
      <b> Tetanus Toxoid:</b> {showViewAppointment?.tetanus_toxoid ? "Given" : "Not Given"}
        <b> Tetanus Route:</b> {showViewAppointment?.tetanus_route ?? "—"}

  <b> Injection Site:</b> {showViewAppointment?.injection_site ?? "—"}

  <b> Given Date:</b> {showViewAppointment?.tetanus_date ?? "—"}
    </div>
    
    <div className="qr-section">
      <QRCodeCanvas
        value={JSON.stringify({ id: showView.id, name: `${showView.first_name} ${showView.last_name}` })}
        size={70}
        bgColor="#ffffff"
        fgColor="#000000"
        level="H"
      />
      <div><small>Present to Scan</small></div>
    </div>
  </div>
</div>



{showViewRegular && viewRegularData && (
  <div className="popup">
    <div className="appointmentForm">
      <div className="regvac">
        <h3>Regular Vaccination Details</h3>

<p><b>Vaccine Type:</b> {viewRegularData.regular_type}</p>
<p><b>Injection Site:</b> {viewRegularData.injection_site}</p>

{/* ------------------------------ */}
{/* FLU VACCINE                   */}
{/* ------------------------------ */}
{viewRegularData.regular_type === "Flu Vaccine" && (
  <>
    <p><b>Vaccine Name / Strain:</b> {viewRegularData.vaccine_name}</p>
    <p>
      <b>Date Given:</b>{" "}
{viewRegularData.regular_given_date && viewRegularData.regular_given_date.trim() !== ""
  ? viewRegularData.regular_given_date
  : "—"}
    </p>
    <p><b>Route:</b> {viewRegularData.regular_route || "IM"}</p>
  </>
)}

{/* ------------------------------ */}
{/* PNEUMONIA VACCINE             */}
{/* ------------------------------ */}
{viewRegularData.regular_type === "Pneumonia Vaccine" && (
  <>
    <p><b>Pneumonia Type:</b> {viewRegularData.pneumonia_type}</p>
    <p>
      <b>Date Given:</b>{" "}
{viewRegularData.regular_given_date && viewRegularData.regular_given_date.trim() !== ""
  ? viewRegularData.regular_given_date
  : "—"}
    </p>
    <p><b>Route:</b> {viewRegularData.regular_route || "IM"}</p>
  </>
)}

{/* ------------------------------ */}
{/* TETANUS TOXOID                */}
{/* ------------------------------ */}
{viewRegularData.regular_type === "Anti-Tetanus" && (
  <>
  <p>
      <b>Route:</b> {viewRegularData.regular_route?.trim() || "IM "}

      <b> Anti-Tetanus Type:</b> {viewRegularData.vaccine_name || "—"}
    </p>
    <p>
 
      <b> Date Given:</b>{" "}
      {viewRegularData.regular_given_date?.trim()
        ? viewRegularData.regular_given_date
        : "—"}
    </p>

  </>
)}


{/* ------------------------------ */}
{/* SINGLE-DOSE DEFAULT HANDLING  */}
{/* (covers any vaccine except Hep B) */}
{/* ------------------------------ */}
{viewRegularData.regular_type !== "Hepa B Vaccine" &&
 !["Flu Vaccine", "Pneumonia Vaccine", "Anti-Tetanus"].includes(viewRegularData.regular_type) && (
  <>
    <p>
      <b>Date Given:</b>{" "}
{viewRegularData.regular_given_date && viewRegularData.regular_given_date.trim() !== ""
  ? viewRegularData.regular_given_date
  : "—"}
    </p>
    <p><b>Route:</b> {viewRegularData.regular_route || "IM"}</p>
  </>
)}



{/* ------------------------------ */}
{/* HEPATITIS B (3 DOSES)         */}
{/* ------------------------------ */}
<div className="hepvaccont">
{viewRegularData.regular_type === "Hepa B Vaccine" && (
  <>
    <h3 className="appointment-section-title">Hepa B Schedule</h3>

    <div className="date-grid-container">
      <div className="date-header-row">
        <div className="date-header">Scheduled Dates</div>
        <div className="date-header">Date Given</div>
        <div className="date-header">Status</div>
      </div>

      {(() => {
        const appt = viewRegularData;

        const isDue = (sched) => {
          if (!sched) return false;
          const sd = new Date(sched).setHours(0, 0, 0, 0);
          const td = new Date().setHours(0, 0, 0, 0);
          return td >= sd;
        };

        const statusText = (given, sched, stored) => {
          if (stored) return stored;
          if (given) return "✔️ Done";
          if (isDue(sched)) return "🟡 Pending";
          return "🔴 Upcoming";
        };

        const renderDose = (label, schedKey, givenKey, statusKey, prevGivenKey) => (
          <div className="prophylaxis-item-grid" key={label}>
            <span>{label}: {appt[schedKey] || "—"}</span>

            <input
              type="date"
              value={appt[givenKey] || ""}
              readOnly
              disabled={
                !isDue(appt[schedKey]) ||
                (prevGivenKey && !appt[prevGivenKey])
              }
            />

            <span>
              {statusText(
                appt[givenKey],
                appt[schedKey],
                appt[statusKey]
              )}
            </span>
          </div>
        );

        return (
          <>
            {renderDose("1st Dose", "hepa_b_dose1", "hepa_b_given1", "hepa_b_status1")}
            {renderDose("2nd Dose", "hepa_b_dose2", "hepa_b_given2", "hepa_b_status2", "hepa_b_given1")}
            {renderDose("3rd Dose", "hepa_b_dose3", "hepa_b_given3", "hepa_b_status3", "hepa_b_given2")}
          </>
        );
      })()}
    </div>
    
    <button
  className="SaveBtn"
  disabled={
    viewRegularData.hepa_b_status1 === "Missed" ||
    viewRegularData.hepa_b_status2 === "Missed" ||
    viewRegularData.hepa_b_status3 === "Missed"
  }
  onClick={() => markRegularDone(viewRegularData)}
>
  Mark Done
</button>

  
</>
)}


        </div>
{/* BUTTONS ALWAYS SHOWN */}
<div className="regbtns">
  <button 
    className="edit"
    onClick={() => handleEditRegular(viewRegularData)}
  >
    Edit
  </button>

  <button 
    className="CancelBtn"
    onClick={() => {
      setShowViewRegular(false);
      setViewRegularData(null);
    }}
  >
    Close
  </button>

  <button
  className="printBtn"
  onClick={() => {
    const printable = document.getElementById("printableFormRegular");
    if (!printable) {
      alert("Printable form not found.");
      return;
    }

    // Convert QR to image
    const qrCanvas = printable.querySelector("canvas");
    let qrImage = "";
    if (qrCanvas) {
      qrImage = `<img src="${qrCanvas.toDataURL("image/png")}" width="64" height="64" />`;
    }

    // Replace canvas with img in print HTML
    let printContents = printable.innerHTML;
    if (qrImage) {
      printContents = printContents.replace(/<canvas[^>]*><\/canvas>/, qrImage);
    }

    // Create print iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
      <head>
        <style>
          @page {
            size: 5.5in 4in;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            font-family: Arial, sans-serif;
          }

          .card-print {
            width: 5.5in;
            height: 4in;
            padding: 8px;
            font-size: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-sizing: border-box;
            text-align: center;
          }

          .card-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 4px;
            text-align: center;
          }

          .p-info {
            text-align: center;
            font-size: 10px;
            margin-bottom: 4px;
          }

          table {
            width: 90%;
            border-collapse: collapse;
            margin: 4px auto;
            font-size: 10px;
          }

          th, td {
            border: 1px solid #000;
            padding: 3px;
            text-align: center;
          }

          th {
            background: #f2f2f2;
            font-weight: bold;
          }

          .qr-section {
            margin-top: 4px;
            text-align: center;
          }
        </style>
      </head>
      <body>${printContents}</body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 800);
    };
  }}
>
  Print Schedule Card
</button>

  <button onClick={handleDeleteAppointment}>Delete</button>

 

</div>


    </div>
    </div>
  </div>
)}

<div id="printableFormRegular" style={{ display: "none" }}>
  {viewRegularData && (
    <div className="card-print" style={{ width: "5.5in", height: "4in" }}>

      <div className="card-title">REGULAR VACCINATION CARD</div>

      <div className="p-info">
        <b>{showView?.last_name}, {showView?.first_name} {showView?.middle_name}</b><br/>
        Age: {showView?.age} | Sex: {showView?.gender} | Weight: {showView?.weight}kg
      </div>

      <table>
        <thead>
          <tr>
            <th>Scheduled Date</th>
            <th>Date Given</th>
            <th>Signature</th>
          </tr>
        </thead>

       <tbody>

  {/* 🔹 SINGLE-DOSE REGULAR VACCINES */}
  {viewRegularData.regular_type !== "Hepa B Vaccine" && (
    <tr>
      <td><b>Scheduled:</b> {viewRegularData.regular_date}</td>
      <td><b>Given:</b> {viewRegularData.regular_given_date || "—"}</td>
      <td></td>
    </tr>
  )}

  {/* 🔹 HEPATITIS B – 3-DOSE TABLE */}
  {viewRegularData.regular_type === "Hepa B Vaccine" && (
    <>
      <tr>
        <td><b>1st Dose:</b> {viewRegularData.hepa_b_dose1}</td>
        <td>{viewRegularData.hepa_b_given1 || "—"}</td>
        <td></td>
      </tr>

      <tr>
        <td><b>2nd Dose:</b> {viewRegularData.hepa_b_dose2}</td>
        <td>{viewRegularData.hepa_b_given2 || "—"}</td>
        <td></td>
      </tr>

      <tr>
        <td><b>3rd Dose:</b> {viewRegularData.hepa_b_dose3}</td>
        <td>{viewRegularData.hepa_b_given3 || "—"}</td>
        <td></td>
      </tr>
    </>
  )}

</tbody>
      </table>

      <div className="qr-section">
        <QRCodeCanvas
          value={JSON.stringify({
            id: showView.id,
            name: `${showView.first_name} ${showView.last_name}`,
          })}
          size={64}
          bgColor="#ffffff"
          fgColor="#000000"
        />
        <div><small>Present to Scan</small></div>
      </div>

    </div>
  )}
</div>




  <div className="appointmentHistoryContainer">
    <table>
      <thead>
  <tr className="top">
    <th>Date</th>
    <th>Purpose</th>
    <th>Actions</th>
  </tr>
</thead>

<tbody>
  {filteredAppointments.map((appt) => (
    <tr key={appt.id} className="row">
      <td>{appt.schedule}</td>
      <td>{appt.regular_type || appt.prophylaxis_type}</td>
      <td>
        {appt.regular_type ? (
          <button
            onClick={() => {
              setViewRegularData(appt);
              setShowViewRegular(true);
            }}
          >
            View
          </button>
        ) : (
          <button onClick={() => setShowViewAppointment(appt)}>
            View
          </button>
        )}
       
      </td>
    </tr>
  ))}

      </tbody>
    </table>
  </div>
  </div>
  </div>
  </div>
  </div>
        )}

        <div className="patientList">
          <div className="patientRow header">
            <span>Name</span>
            <span>Age</span>
            <span>Date Created</span>
            <span>QR Code Reference</span>
            <span>Action</span>
          </div>

    {patients.map((p) => (
  <div className="patientRow" key={p.id}>
    <span>{p.first_name} {p.middle_name} {p.last_name}</span> 
    <span>{p.age}</span>
    <span>{p.date_created}</span>
   
    <div style={{ textAlign: "center" }}>
  <QRCodeCanvas
  value={JSON.stringify({ id: p.id, name: `${p.first_name} ${p.last_name}` })}
  size={64}
  bgColor="#ffffff"
  fgColor="#000000"
  level="H"
/>
  <p style={{ fontSize: "0.8em" }}>Scan QR</p>
</div>
    <div style={{ display: "flex", gap: "5px" }}>
      <button onClick={() => setShowView(p)}></button>
      <button
  onClick={async () => {
    try {
      const fullPatient = await invoke("get_patient_with_user", { id: p.id });
      setShowView((prev) => ({
        ...prev,
        ...fullPatient, // merge new data into existing state
      }));
      const appts = await getAppointments(p.id);
      setAppointments(appts);
    } catch (err) {
      console.error("Failed to load patient:", err);
      alert("Failed to load patient details.");
    }
  }}
>
  View
</button>

 {!viewArchived ? (
    <button
  onClick={async () => {
    if (window.confirm(`Archive ${p.first_name} ${p.last_name}?`)) {
      await archivePatient(p.id);
      alert("Archived successfully!");
      if (viewArchived) loadArchivedPatients();
      else loadPatients();
        }
      }}
    >
      Archive
    </button>
  ) : (
   <button
  onClick={async () => {
    if (window.confirm(`Restore ${p.first_name} ${p.last_name}?`)) {
      await restorePatient(p.id);
      alert("Restored successfully!");
      loadArchivedPatients(); // reload the archive view
        }
      }}
    >
      Restore
    </button>
  )}
      
     
    </div>
  </div>
))}

{/* --- CHOICE POPUP --- */}
{showAddChoice && (
  <div className="popup">
    <div className="choice-box">
      <div className="choicecontainer">
        <h3>Select Appointment Type</h3>
        <div className="choice-buttons">
          <button
            onClick={() => {
              // Open Anti-Rabies Vaccination form
              setShowAddChoice(false);
              setShowAddAppointment(true);
              setShowRegularVaccinationForm(false);

              // Reset Anti-Rabies fields
              setNewDateOfExposure("");
              setNewSchedule(getTodayDate());
              setNewTypeofBite("");
              setNewSite("");
              setNewBitingAnimal("");
              setNewCategory("");
              setNewPreviousAntiRabiesVaccine("");
              setSelectedProphylaxisType("");
              setNewTetanusToxoid(false);
              setNewRIG(false);
              setNewRIGDate(getTodayDate());
              setNewTetanusDate(getTodayDate());
            }}
          >
            🧬 Anti-Rabies Vaccination
          </button>

          <button
onClick={() => {
  resetRegularFields();
  setShowAddRegular(true);
  setAppointmentType("Regular");

  const today = getTodayPH();
  setNewRegularDate(today);
  setNewRegularGivenDate(today);

  setShowAddChoice(false);    // ← 🔥 THIS FIXES IT
}}


>
  💉 Regular Vaccination
</button>
        </div>

        <button className="CancelBtn" onClick={() => setShowAddChoice(false)}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}


{/* --- REGULAR VACCINATION FORM --- */}
{showAddRegular && appointmentType === "Regular" && (
  
  <div className="popup">
    <form className="appointmentForm" onSubmit={handleSaveRegularAppointment}>
      <div className="regvac">
        <h3>Add Regular Vaccination</h3>

        {/* Vaccine Type */}
        <div className="input-row">
          <label>Vaccine Type</label>
          <select
            value={newRegularType}
            onChange={(e) => setNewRegularType(e.target.value)}
            required
          >
            <option value="" disabled hidden>Select Vaccine</option>
            <option value="Anti-Tetanus">Anti-Tetanus</option>
            <option value="Flu Vaccine">Flu Vaccine</option>
            <option value="Pneumonia Vaccine">Pneumonia Vaccine</option>
            <option value="Hepa B Vaccine">Hepa B Vaccine</option>
          </select>
        </div>

        {/* Tetanus Route Input */}
{newRegularType === "Anti-Tetanus" && (
  <div className="input-row">
    <label>Anti-Tetanus Type:</label>
    <select value={newRegularName} onChange={(e) => setNewRegularName(e.target.value)} required>
  <option value="" disabled hidden>Select Anti-Tetanus Type</option>
  <option value="Tetanus Toxoid">Tetanus Toxoid</option>
  <option value="HTIG">HTIG</option>
  <option value="ATS">ATS</option>
</select>
    <p><b>Route:</b> IM</p>
     <label>Injection Site:</label>

  <select
    value={newInjectionSite}
    onChange={(e) => setNewInjectionSite(e.target.value)}required
  >
    <option value="" disabled hidden>Select site</option>
    <option value="Left Arm">Left Arm</option>
    <option value="Right Arm">Right Arm</option>
    <option value="Left Thigh">Left Thigh</option>
    <option value="Right Thigh">Right Thigh</option>
    <option value="Deltoid">Deltoid</option>
    <option value="Gluteal">Gluteal</option>
  </select>
  </div>
)}

        {/* Flu Vaccine */}
        {newRegularType === "Flu Vaccine" && (
          <div className="input-row">
            <label>Vaccine Name/Strain</label>
            <input
              type="text"
              placeholder="e.g., Fluzone Quadrivalent"
              value={newRegularName}
              onChange={(e) => setNewRegularName(e.target.value)}
           required />
           <p><b>Route:</b> IM</p>
           <label>Injection Site:</label>
  <select
    value={newInjectionSite}
    onChange={(e) => setNewInjectionSite(e.target.value)}required
  >
    <option value="" disabled hidden>Select site</option>
    <option value="Left Arm">Left Arm</option>
    <option value="Right Arm">Right Arm</option>
    <option value="Left Thigh">Left Thigh</option>
    <option value="Right Thigh">Right Thigh</option>
    <option value="Deltoid">Deltoid</option>
    <option value="Gluteal">Gluteal</option>
  </select>
          </div>
        )}

        {/* Pneumonia Vaccine */}
        {newRegularType === "Pneumonia Vaccine" && (
          <div className="input-row">
            <label>Vaccine Type</label>
            <select
              value={newPneumoniaType}
              onChange={(e) => setNewPneumoniaType(e.target.value)}
              required
            >
              <option value="" disabled hidden>Select Type</option>
              <option value="PCV13">PCV13</option>
              <option value="PPSV23">PPSV23</option>
            </select>
           
           <p><b>Route:</b> IM</p>
           <label>Injection Site:</label>
  <select
    value={newInjectionSite}
    onChange={(e) => setNewInjectionSite(e.target.value)}required
  >
    <option value="" disabled hidden>Select site</option>
    <option value="Left Arm">Left Arm</option>
    <option value="Right Arm">Right Arm</option>
    <option value="Left Thigh">Left Thigh</option>
    <option value="Right Thigh">Right Thigh</option>
    <option value="Deltoid">Deltoid</option>
    <option value="Gluteal">Gluteal</option>
  </select>
          </div>
        )}

        {/* Hepa B Vaccine — Auto-Dose Generator */}
        {newRegularType === "Hepa B Vaccine" && (
  <div className="input-row">
    <label>Date of First Dose</label>

    <input
      type="date"
      value={newRegularDate}
      onChange={(e) => {
        const selected = e.target.value;
        setNewRegularDate(selected);

        const d = new Date(selected);
        setDoseDates([
          { label: "1st Dose", date: selected },
          { label: "2nd Dose (1 month later)", date: addMonths(d, 1) },
          { label: "3rd Dose (6 months later)", date: addMonths(d, 6) },
        ]);
      }}
      required
    />

    {doseDates.length > 0 && (
      <div className="auto-schedule" style={{ marginTop: "10px" }}>
        <h4><b>Auto-Generated Hepa B Schedule</b></h4>

        <p><b>1st Dose:</b> {doseDates[0].date}</p>
        <p><b>2nd Dose (1 month later):</b> {doseDates[1].date}</p>
        <p><b>3rd Dose (6 months later):</b> {doseDates[2].date}</p>
      </div>
    )}
    
    <p><b>Route:</b> IM</p>
    <label>Injection Site:</label>
  <select
    value={newInjectionSite}
    onChange={(e) => setNewInjectionSite(e.target.value)}required
  >
    <option value="" disabled hidden>Select site</option>
    <option value="Left Arm">Left Arm</option>
    <option value="Right Arm">Right Arm</option>
    <option value="Left Thigh">Left Thigh</option>
    <option value="Right Thigh">Right Thigh</option>
    <option value="Deltoid">Deltoid</option>
    <option value="Gluteal">Gluteal</option>
  </select>
  </div>
)}


        {/* Date Given — applies to all EXCEPT Hepa B */}
       {newRegularType !== "Hepa B Vaccine" && (
  <div className="input-row">
    <label>Date Given</label>
    <input
      type="date"
      value={newRegularGivenDate}
      onChange={(e) => setNewRegularGivenDate(e.target.value)}
      required
    />
  </div>
)}
 {/* Buttons */}
        <div className="regbtns">
          <button type="submit" className="SubmitBtn">Save</button>
          <button
            type="button"
            className="CancelBtn"
            onClick={() => {
              setShowAddRegular(false);
              setAppointmentType("");
            }}
          >
            Cancel
          </button>
        </div>

       
      </div>
    </form>
  </div>
)}



{showAddAppointment && (
  <div className="popup">
    <form className="appointmentForm" onSubmit={handleSaveAppointment}>
      <div className="containerapptNew">
      <h3>{editAppointment ? "Edit Appointment" : "Add Appointment"}</h3>

        {/* Exposure info */}
        <div className="input-row">
          <h4>History of Exposure</h4>

          
          <label>Date of Exposure</label>
<input
  type="date"
  value={newDateOfExposure}
  onChange={(e) => setNewDateOfExposure(e.target.value)}
  max={getTodayDate()}   // 🔥 limit to today or earlier
  required
/>


          <select value={newTypeofBite} onChange={(e) => setNewTypeofBite(e.target.value)} required>
            <option value="" disabled hidden>Type of Bite</option>
            <option value="None">None</option>
            <option value="Laceration">Laceration</option>
            <option value="Abrasion">Abrasion</option>
            <option value="Puncture">Puncture</option>
            <option value="Minor Scratches">Minor Scratches</option>
            <option value="Crush Injuries">Crush Injuries</option>
            
          </select>

          <select value={newSite} onChange={(e) => setNewSite(e.target.value)} required>
            <option value="" disabled hidden>Site of Bite</option>
            <option value="None">None</option>
            <option value="Leg">Leg</option>
            <option value="Hand">Hand</option>
            <option value="Neck">Neck</option>
            <option value="Foot">Foot</option>
            <option value="Head">Head</option>
            <option value="Torso">Torso</option>
            <option value="Arm">Arm</option>
          </select>

          <select value={newBitingAnimal} onChange={(e) => setNewBitingAnimal(e.target.value)} required>
            <option value="" disabled hidden>Biting Animal</option>
            <option value="None">None</option>
            <option value="Cat">Cat</option>
            <option value="Dog">Dog</option>
            <option value="Bat">Bat</option>
            <option value="Raccoon">Raccoon</option>
            <option value="Fox">Fox</option>
            <option value="Skunk">Skunk</option>
            <option value="Rodent">Rodent</option>
            <option value="Monkey">Monkey</option>
            <option value="Cattle">Cattle</option>
          </select>

          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required>
            <option value="" disabled hidden>Category</option>
            <option value="None">None</option>
            <option value="I">I</option>
            <option value="II">II</option>
            <option value="III">III</option>
          </select>

          <select
            value={newPreviousAntiRabiesVaccine}
            onChange={(e) => setNewPreviousAntiRabiesVaccine(e.target.value)}
            required
          >
            <option value="" disabled hidden>Previous Anti-Rabies Vaccine</option>
            <option value="None">None</option>
            <option value="Pre-Exposure Prophylaxis">Pre-Exposure Prophylaxis</option>
            <option value="Post-Exposure Prophylaxis">Post-Exposure Prophylaxis</option>
            <option value="Booster">Booster</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="apptbtns">
          <button type="submit" className="SubmitBtn">Save</button>
          <button
            type="button"
            className="CancelBtn"
           onClick={() => {
  setShowAddAppointment(false);
  if (!editAppointment) {
    // Only reset if we were creating a new appointment
    setNewDateOfExposure("");
    setNewSchedule("");
    setNewTypeofBite("");
    setNewSite("");
    setNewBitingAnimal("");
    setNewCategory("");
    setNewPreviousAntiRabiesVaccine("");
    setSelectedProphylaxisType("");
    setNewTetanusToxoid(false);
    setNewInjectionSite("");
      setNewVaccRoute("");
  }
  setEditAppointment(null);
}}

          >
            Cancel
          </button>
        </div>
                <div className="form-group">
  <label><b>Prophylaxis Type:</b></label>
  <div className="radio-group">
    <label>
      <input
        type="radio"
        name="prophylaxis"
        value="Post Exposure Prophylaxis"
        checked={selectedProphylaxisType === "Post Exposure Prophylaxis"}
        onChange={(e) => {
          setSelectedProphylaxisType(e.target.value);
          // Clear generated dates if switching away
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, "0");
          const dd = String(today.getDate()).padStart(2, "0");
          const todayStr = `${yyyy}-${mm}-${dd}`;
          setDayZero(todayStr);
          setDayThree(addDays(todayStr, 3));
          setDaySeven(addDays(todayStr, 7));
          setDayFourteen(addDays(todayStr, 14));
          setDayThirty(addDays(todayStr, 30));
        }}
      />
      Post Exposure Prophylaxis
    </label>

   <label>
  <input
    type="radio"
    name="prophylaxis"
    value="Pre Exposure Prophylaxis"
    checked={selectedProphylaxisType === "Pre Exposure Prophylaxis"}
    onChange={(e) => {
      setSelectedProphylaxisType(e.target.value);
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setDayZero(todayStr);
      setDayThree(addDays(todayStr, 3));
      setDaySeven(addDays(todayStr, 7));
      setDayFourteen(addDays(todayStr, 14));
      setDayThirty(addDays(todayStr, 30));
    }}
  />
  Pre Exposure Prophylaxis
</label>

<label>
  <input
    type="radio"
    name="prophylaxis"
    value="Booster"
    checked={selectedProphylaxisType === "Booster"}
   // When user picks Booster
onChange={(e) => {
  setSelectedProphylaxisType(e.target.value);
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // ONLY set D0, D7, D30 for Booster
  setDayZero(todayStr);
  setDaySeven(addDays(todayStr, 7));
  setDayThirty(addDays(todayStr, 30));

  // Explicitly clear D3 / D14 to avoid leftover values
  setDayThree("");
  setDayFourteen("");
}}

  />
  Booster
</label>
  </div>
</div>
{selectedProphylaxisType === "Pre Exposure Prophylaxis" && (
  <div className="auto-schedule">
    <h4>Auto-Generated Schedule</h4>
    <p><b>Day 0:</b> {dayZero}</p>
    <p><b>Day 3:</b> {dayThree}</p>
    <p><b>Day 7:</b> {daySeven}</p>
    <p><b>Day 14:</b> {dayFourteen}</p>
    <p><b>Day 30:</b> {dayThirty}</p>
  </div>
)}
{selectedProphylaxisType === "Post Exposure Prophylaxis" && (
  <div className="auto-schedule">
    <h4>Auto-Generated Schedule</h4>
    <p><b>Day 0:</b> {dayZero}</p>
    <p><b>Day 3:</b> {dayThree}</p>
    <p><b>Day 7:</b> {daySeven}</p>
    <p><b>Day 14:</b> {dayFourteen}</p>
    <p><b>Day 30:</b> {dayThirty}</p>
  </div>
)}
{selectedProphylaxisType === "Booster" && (
  <div className="auto-schedule">
    <h4>Auto-Generated Schedule</h4>
    <p><b>Day 0:</b> {dayZero}</p>
    <p><b>Day 7:</b> {daySeven}</p>
    <p><b>Day 30:</b> {dayThirty}</p>
  </div>
)}
<div className="tetanusSection">
  <h4>Tetanus Immunization</h4>

  <div className="checkbox-row">
    <label>
      <input
        type="checkbox"
        checked={newTetanusToxoid}
       onChange={(e) => {
  setNewTetanusToxoid(e.target.checked);
  if (e.target.checked) {
    setNewTetanusRoute("IM");   // <-- 🔥 Auto-set on enable
  } else {
    setNewTetanusRoute("");     // reset if disabled
  }
}}

      />
      Tetanus Toxoid 0.5ML
    </label>
  </div>

  {newTetanusToxoid && (
    <>
       <div className="input-row">
    <p><b>Tetanus Route:</b> IM</p>

    {/* Hidden input to preserve state/value */}
    <input type="hidden" value="IM" />
  
        <label>Tetanus Injection Site:</label>
    <select
      value={tetanusInjectionSite}
      onChange={(e) => setTetanusInjectionSite(e.target.value)} required>
      <option value="" disabled hidden>Select site</option>
      <option value="Left Arm">Left Arm</option>
      <option value="Right Arm">Right Arm</option>
      <option value="Left Thigh">Left Thigh</option>
      <option value="Right Thigh">Right Thigh</option>
      <option value="Deltoid">Deltoid</option>
      <option value="Gluteal">Gluteal</option>
    </select>
      </div>

      <div className="input-row">
        <label>Date Given:</label>
        <input
          type="date"
          value={newTetanusDate}
          onChange={(e) => setNewTetanusDate(e.target.value)}
        />
      </div>
    </>
  )}
</div>

{/* --- RIG --- */}
<div className="rigSection">
  <h4>RIG (Rabies Immunoglobulin)</h4>

  <div className="checkbox-row">
    <label>
      <input
        type="checkbox"
        checked={newRIG || false}
        onChange={(e) => setNewRIG(e.target.checked)}
      />
      RIG Given
    </label>
  </div>

  {newRIG && (
    <div className="input-row">
      <label>Date Given:</label>
      <input
        type="date"
        value={newRIGDate}
        onChange={(e) => setNewRIGDate(e.target.value)}
      />
    </div>
  )}
</div>

<div className="vaccRouteSection">
  <h4>Vaccine Route</h4>
  <div className="input-row">
    <label>Route:</label>
    <select
      value={newVaccRoute}
      onChange={(e) => setNewVaccRoute(e.target.value)}
    >
      <option value="" disabled hidden>Select Route</option>
      <option value="IM">IM (Intramuscular)</option>
      <option value="ID">ID (Intradermal)</option>
    </select>
  </div>
</div>
      </div>
    </form>
  </div>
)}


</div></div></div>
)}
export default Patient;