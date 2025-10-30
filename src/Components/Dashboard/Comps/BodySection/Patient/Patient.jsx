"use client"

import { useEffect, useState } from "react"
import "./Patient.css"
import { invoke } from "@tauri-apps/api/core"
import { QRCodeCanvas } from "qrcode.react"
import { useParams } from "react-router-dom"
import { PiEyeLight } from "react-icons/pi"
import { PiEyeClosedLight } from "react-icons/pi"

//Patient Handlers//
async function getPatients() {
  return await invoke("get_patients_cmd")
}

async function createPatient(patient) {
  return await invoke("create_patient_cmd", { patient })
}

async function deletePatient(id) {
  return await invoke("delete_patient", { id })
}

// --- APPOINTMENTS HANDLERS ---
async function getAppointments(patientId) {
  return await invoke("get_appointments", { patientId })
}

async function createAppointment(appointment) {
  return await invoke("create_appointment", { appointment })
}

async function updateAppointment(appointment) {
  return await invoke("update_appointment", { appointment })
}

async function archivePatient(id) {
  return await invoke("archive_patient", { id })
}

async function restorePatient(id) {
  return await invoke("restore_patient", { id })
}

async function getArchivedPatients() {
  return await invoke("get_archived_patients_cmd")
}

async function handleUpdatePassword(patientId, newPassword) {
  try {
    await invoke("update_muser_password", {
      patientId: patientId,
      newPassword: newPassword,
    })
    console.log("Password updated successfully")
  } catch (e) {
    console.error("Failed to update password:", e)
  }
}

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, "0")
  const dd = String(today.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const Patient = () => {
  const [allPatients, setAllPatients] = useState([])
  const [patients, setPatients] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showView, setShowView] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [editAppointment, setEditAppointment] = useState(null)
  const [dayZero, setDayZero] = useState("")
  const [dayThree, setDayThree] = useState("")
  const [daySeven, setDaySeven] = useState("")
  const [dayFourteen, setDayFourteen] = useState("")
  const [dayThirty, setDayThirty] = useState("")
  const [selectedProphylaxisType, setSelectedProphylaxisType] = useState("")
  const [newTetanusToxoid, setNewTetanusToxoid] = useState(false)
  const [newSchedule, setNewSchedule] = useState(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isEditingMedical, setIsEditingMedical] = useState(false)
  const [viewArchived, setViewArchived] = useState(false)
  const [archivedPatients, setArchivedPatients] = useState([])
  const [showingArchived, setShowingArchived] = useState(false)

  const [newTypeofBite, setNewTypeofBite] = useState("")
  const [newSite, setNewSite] = useState("")
  const [newBitingAnimal, setNewBitingAnimal] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newPreviousAntiRabiesVaccine, setNewPreviousAntiRabiesVaccine] = useState("")
  const [editingMedical, setEditingMedical] = useState(false)
  const [editedMedical, setEditedMedical] = useState({
    dateOfExposure: "",
    prevVaccs: [""],
    allergies: [""],
    illOper: [""],
    assessment: "",
  })
  const [route, setRoute] = useState("")
  const [option, setOption] = useState("")
  const [inventoryReduceFunction, setInventoryReduceFunction] = useState(null)

  const { id } = useParams()

  const handleRouteChange = (e) => {
    setRoute(e.target.value)
  }

  const handleOptionChange = (e) => {
    setOption(e.target.value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert(`Route: ${route}, Option: ${option}`)
  }

  useEffect(() => {
    async function loadPatientFromQR() {
      if (id) {
        try {
          const fullPatient = await invoke("get_patient_with_user", { id: Number(id) })
          setShowView(fullPatient)
          const appts = await getAppointments(Number(id))
          setAppointments(appts)
        } catch (err) {
          console.error("Failed to load patient from QR:", err)
          alert("Could not load patient details.")
        }
      }
    }
    loadPatientFromQR()
  }, [id])

  useEffect(() => {
    if (viewArchived) {
      loadArchivedPatients()
    } else {
      loadPatients()
    }
  }, [viewArchived])

  const addDays = (dateString, days) => {
    const date = new Date(dateString + "T00:00:00")
    date.setDate(date.getDate() + days)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const splitValues = (str) =>
    typeof str === "string" && str.trim() !== "" ? str.split(",").map((s) => s.trim()) : [""]

  const flattenField = (arr) =>
    arr
      .map((item) => (item.option === "Other" ? item.custom : item.option))
      .filter((v) => v && v.trim() !== "")
      .join(", ")

  const Schedule = ({ appointments, onStatusChange }) => {
    const handleStatusChange = async (id, newStatus) => {
      try {
        await invoke("update_appointment_status", { id, status: newStatus })
        onStatusChange(id, newStatus)
      } catch (error) {
        console.error("Failed to update status:", error)
      }
    }

    return (
      <div>
        {appointments.map((appt) => (
          <div key={appt.id} className="scheduleItem">
            <p>{appt.schedule}</p>
            <select value={appt.status || "Pending"} onChange={(e) => handleStatusChange(appt.id, e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Missed">Missed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        ))}
      </div>
    )
  }

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [middleName, setMiddleName] = useState("")
  const [newDateofBirth, setDateofBirth] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newContactNum, setNewContactNum] = useState("")
  const [newAge, setNewAge] = useState("")
  const [newGender, setNewGender] = useState("")
  const [newWeight, setNewWeight] = useState("")
  const [newDateOfExposure, setNewDateOfExposure] = useState("")
  const [prevVacc, setPrevVacc] = useState("")
  const [allergies, setAllergies] = useState("")
  const [illOper, setIllOper] = useState("")
  const [assessment, setAssessment] = useState("")

  async function loadPatients() {
    const data = await getPatients()
    setAllPatients(data)
    setPatients(data)
  }

  function resetFormFields() {
    setFirstName("")
    setLastName("")
    setMiddleName("")
    setNewAge("")
    setDateofBirth("")
    setNewAddress("")
    setNewContactNum("")
    setNewGender("")
    setNewWeight("")
    setNewDateOfExposure("")
    setPrevVacc("")
    setAllergies("")
    setIllOper("")
    setAssessment("")
    setNewTypeofBite("")
    setNewSite("")
    setNewBitingAnimal("")
    setNewCategory("")
    setNewPreviousAntiRabiesVaccine("")
  }

  async function loadArchivedPatients() {
    const data = await invoke("get_archived_patients_cmd")
    setArchivedPatients(data)
    setPatients(data)
  }

  async function handleCreate(e) {
    e.preventDefault()

    const ageValue = Number.parseInt(newAge)
    const weightValue = Number.parseFloat(newWeight)

    if (ageValue < 0 || isNaN(ageValue) || weightValue < 0 || isNaN(weightValue)) {
      alert("Age and Weight must be non-negative numbers.")
      return
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
      date_of_exposure: newDateOfExposure,
      prev_vacc: prevVacc,
      allergies: allergies,
      ill_oper: illOper,
      assessment: assessment,
    }

    try {
      const result = await createPatient(payload)
      const newPatientId = Number(result.patient_id)

      const fullPatient = await invoke("get_patient_with_user", { id: newPatientId })
      setShowView(fullPatient)

      const refreshed = await getPatients()
      setAllPatients(refreshed)
      setPatients(refreshed)

      resetFormFields()
      setShowCreateForm(false)

      alert(`Patient created successfully!\nUsername: ${result.username}\nPassword: ${result.password}`)
    } catch (err) {
      console.error("Create failed:", err)
      alert("Create failed: " + (err?.message || err))
    }
  }

  const applySearchAndFilter = (query = searchQuery, type = filterType) => {
    const sourceList = viewArchived ? archivedPatients : allPatients
    let results = [...sourceList]

    if (query.trim() !== "") {
      const lowerQuery = query.toLowerCase()
      results = results.filter(
        (p) =>
          p.first_name.toLowerCase().includes(lowerQuery) ||
          p.last_name.toLowerCase().includes(lowerQuery) ||
          (p.middle_name && p.middle_name.toLowerCase().includes(lowerQuery)),
      )
    }

    switch (type) {
      case "dataAsc":
        results.sort((a, b) => new Date(a.date_created) - new Date(b.date_created))
        break
      case "dataDsc":
        results.sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
        break
      case "alphabetical":
        results.sort((a, b) => a.last_name.localeCompare(b.last_name))
        break
      default:
        break
    }

    if (viewArchived) setPatients(results)
    else setPatients(results)
  }

  const handleSearch = (e) => {
    const q = e.target.value
    setSearchQuery(q)
    applySearchAndFilter(q, filterType)
  }

  const handleFilter = (e) => {
    const type = e.target.value
    setFilterType(type)
    applySearchAndFilter(searchQuery, type)
  }

  function handleOpenCreateForm() {
    setShowCreateForm(true)
  }

  async function handleDelete() {
    if (!showView) return
    const confirmation = window.confirm(`Archive ${showView.first_name} ${showView.last_name}?`)
    if (confirmation) {
      try {
        await archivePatient(showView.id)
        alert("Patient archived successfully!")
        setShowView(null)
        loadPatients()
      } catch (error) {
        alert(`Failed to delete: ${error}`)
      }
    }
  }

  async function handleSaveAppointment(e) {
    e.preventDefault()
    if (!newSchedule) return alert("Please select a schedule.")

    const payload = {
      id: editAppointment ? editAppointment.id : null,
      patient_id: showView.id,
      schedule: newSchedule,
      type_of_bite: newTypeofBite,
      site_of_bite: newSite,
      biting_animal: newBitingAnimal,
      category: newCategory,
      previous_vaccine: newPreviousAntiRabiesVaccine,
      prophylaxis_type: selectedProphylaxisType,
      tetanus_toxoid: newTetanusToxoid,
      day_zero: dayZero || null,
      day_three: dayThree || null,
      day_seven: daySeven || null,
      day_fourteen: dayFourteen || null,
      day_thirty: dayThirty || null,
    }

    try {
      if (editAppointment) {
        await updateAppointment(payload)
        alert("Appointment updated successfully!")
      } else {
        await createAppointment(payload)
        alert("Appointment added successfully!")
      }

      if (selectedProphylaxisType && route) {
        if (inventoryReduceFunction) {
          inventoryReduceFunction("vaxirab", route)
        }
      }

      if (newTetanusToxoid) {
        if (inventoryReduceFunction) {
          inventoryReduceFunction("tetanus", "IM")
        }
      }

      const updatedList = await getAppointments(showView.id)
      setAppointments(updatedList)

      setShowAddAppointment(false)

      if (!editAppointment) {
        setNewSchedule("")
        setNewTypeofBite("")
        setNewSite("")
        setNewBitingAnimal("")
        setNewCategory("")
        setNewPreviousAntiRabiesVaccine("")
        setSelectedProphylaxisType("")
        setNewTetanusToxoid(false)
        setRoute("")
      } else {
        setEditAppointment(null)
      }
    } catch (err) {
      console.error("Error saving appointment:", err)
      alert("Error saving appointment: " + err)
    }
  }
  function handleEditAppointment(appointment) {
  setEditAppointment(appointment);

  setNewSchedule(appointment.schedule || getTodayDate());
  setNewTypeofBite(appointment.type_of_bite || "");
  setNewSite(appointment.site_of_bite || "");
  setNewBitingAnimal(appointment.biting_animal || "");
  setNewCategory(appointment.category || "");
  setNewPreviousAntiRabiesVaccine(appointment.previous_vaccine || "");
  setSelectedProphylaxisType(appointment.prophylaxis_type || "");
  setNewTetanusToxoid(
    appointment.tetanus_toxoid === true ||
    appointment.tetanus_toxoid === 1 ||
    appointment.tetanus_toxoid === "1"
  );

  // ✅ fixed: use appointment, not appt
  setDayZero(appointment.day_zero_date || "");
  setDayThree(appointment.day_three_date || "");
  setDaySeven(appointment.day_seven_date || "");
  setDayFourteen(appointment.day_fourteen_date || "");
  setDayThirty(appointment.day_thirty_date || "");

  setShowAddAppointment(true);
}


  const calculateAge = (dob) => {
    if (!dob) return ""
    const [month, day, year] = dob.split("/").map(Number)
    const birthDate = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const handleDateofBirthInput = (e) => {
    let input = e.target.value.replace(/\D/g, "")
    if (input.length >= 5) input = input.replace(/(\d{2})(\d{2})(\d{0,4}).*/, "$1/$2/$3")
    else if (input.length >= 3) input = input.replace(/(\d{2})(\d{0,2})/, "$1/$2")
    setDateofBirth(input)

    const age = calculateAge(input)
    setNewAge(age)
  }

  function handleEditAppointment(appointment) {
    setEditAppointment(appointment)

    setNewSchedule(appointment.schedule || getTodayDate())
    setNewTypeofBite(appointment.type_of_bite || "")
    setNewSite(appointment.site_of_bite || "")
    setNewBitingAnimal(appointment.biting_animal || "")
    setNewCategory(appointment.category || "")
    setNewPreviousAntiRabiesVaccine(appointment.previous_vaccine || "")
    setSelectedProphylaxisType(appointment.prophylaxis_type || "")
    setNewTetanusToxoid(
      appointment.tetanus_toxoid === true || appointment.tetanus_toxoid === 1 || appointment.tetanus_toxoid === "1",
    )

    setShowAddAppointment(true)
  }

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
          <select className="filterDropdown" value={filterType} onChange={handleFilter}>
            <option value="">---</option>
            <option value="dataAsc">Date Created</option>
            <option value="alphabetical">Last Name Ascending</option>
            <option value="dataDsc">Last Name Descending</option>
          </select>
          <button className="createBtn" onClick={handleOpenCreateForm}>
            Create
          </button>
          <button className="archiveToggleBtn" onClick={() => setViewArchived((prev) => !prev)}>
            {viewArchived ? "View Active Patients" : "View Archived Patients"}
          </button>
        </div>

        {showCreateForm && (
          <div className="popup">
            <form className="createpatientpopupForm" onSubmit={handleCreate}>
              <h3>Add New Patient</h3>
              <section className="PatientInfo1">
                <div className="input-row">
                  <b>Full Name: </b>{" "}
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Middle Name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                  />
                  <input type="number" placeholder="Age" value={newAge} readOnly />
                </div>
              </section>

              <section className="PatientInfo2">
                <div className="input-row">
                  <b>Date of Birth:</b>{" "}
                  <input
                    type="text"
                    placeholder="MM/DD/YYYY"
                    pattern="\d{2}/\d{2}/\d{4}"
                    value={newDateofBirth}
                    onChange={handleDateofBirthInput}
                    maxLength={10}
                    required
                  />
                  <select value={newAddress} onChange={(e) => setNewAddress(e.target.value)} required>
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
                  <select className="Gender" value={newGender} onChange={(e) => setNewGender(e.target.value)} required>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
              </section>

              <section className="PatientInfo2_1">
                <div className="input-row">
                  <input
                    type="text"
                    placeholder="+63"
                    value={newContactNum}
                    onChange={(e) => {
                      let input = e.target.value

                      if (!input.startsWith("+63")) {
                        if (input.startsWith("+6") || input.startsWith("+") || input === "") {
                          input = "+63"
                        } else {
                          input = "+63" + input.replace(/^\+?63?/, "")
                        }
                      }

                      input = "+63" + input.slice(3).replace(/\D/g, "")

                      if (input.length > 13) input = input.slice(0, 13)

                      setNewContactNum(input)
                    }}
                    onFocus={() => {
                      if (newContactNum === "") setNewContactNum("+63")
                    }}
                    required
                  />
                </div>
              </section>

              <div className="popupActions">
                <button className="SubmitBtn" type="submit">
                  Submit
                </button>
                <button
                  className="CancelBtn"
                  type="button"
                  onClick={() => {
                    resetFormFields()
                    setShowCreateForm(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showView && (
          <div className="popupView">
            <div className="view-modalPatient">
              <div className="loginandtext">
                <h3>Patient Record</h3>
                <div className="loginInfo">
                  <div className="logcred">
                    <p>
                      <b>Username:</b> {showView.username || "Not generated"}
                    </p>
                    <p>
                      <b>Password:</b>
                      {showView.password ? <span>{showPassword ? showView.password : "••••••"}</span> : "Not available"}

                      <button onClick={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? <PiEyeClosedLight className="icon" /> : <PiEyeLight className="icon" />}
                      </button>
                    </p>

                    <div className="updatePasswordSection">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={showView.newPassword || ""}
                        onChange={(e) => setShowView((prev) => ({ ...prev, newPassword: e.target.value }))}
                      />
                      <button
                        className="UpdatePasswordBtn"
                        onClick={async () => {
                          if (!showView.newPassword || showView.newPassword.trim() === "") {
                            alert("Please enter a new password!")
                            return
                          }

                          try {
                            await invoke("update_muser_password", {
                              patientId: showView.id,
                              newPassword: showView.newPassword,
                            })

                            const updated = await invoke("get_patient_with_user", {
                              id: showView.id,
                            })

                            setShowView((prev) => ({
                              ...prev,
                              ...updated,
                              newPassword: "",
                            }))

                            alert("Password updated successfully!")
                          } catch (err) {
                            console.error("Failed to update password:", err)
                            alert("Failed to update password: " + err)
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
                  <p>
                    <b>Name:</b> {showView.last_name} {showView.first_name} {showView.middle_name}
                  </p>
                  <p>
                    <b>Age:</b> {showView.age}
                  </p>
                  <p>
                    <b>Date of Birth</b> {showView.date_of_birth}
                  </p>
                  <p>
                    <b>Gender:</b> {showView.gender}
                  </p>
                  <p>
                    <b>Weight:</b> {showView.weight}
                  </p>
                  <p>
                    <b>Contact Number</b> {showView.contact_number}
                  </p>
                  <p>
                    <b>Address:</b> {showView.address}
                  </p>
                  <div className="modal-buttons">
                    {" "}
                    <button className="Closebtn" onClick={() => setShowView(null)}>
                      X
                    </button>
                  </div>
                  <div className="archivebtn2">
                    {!viewArchived ? (
                      <button
                        className="Archive"
                        onClick={async () => {
                          if (window.confirm(`Archive ${showView.first_name} ${showView.last_name}?`)) {
                            await archivePatient(showView.id)
                            alert("Patient archived successfully!")
                            setShowView(null)
                            loadPatients()
                          }
                        }}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="Restore"
                        onClick={async () => {
                          if (window.confirm(`Restore ${showView.first_name} ${showView.last_name}?`)) {
                            await restorePatient(showView.id)
                            alert("Patient restored successfully!")
                            setShowView(null)
                            loadArchivedPatients()
                          }
                        }}
                      >
                        Restore
                      </button>
                    )}
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
                        <p>
                          <b>Date of Exposure:</b> {showView.date_of_exposure || "—"}
                        </p>
                        <p>
                          <b>Previous Vaccines:</b> {showView.prev_vacc || "—"}
                        </p>
                        <p>
                          <b>Allergies:</b> {showView.allergies || "—"}
                        </p>
                        <p>
                          <b>Illness / Operation:</b> {showView.ill_oper || "—"}
                        </p>
                      </div>
                      <div className="assessment-display">
                        {" "}
                        <p>
                          <b>Assessment:</b>
                        </p>
                        <div className="assessment-box"> {showView.assessment || "—"}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="field-container">
                    <div className="info-grid2">
                      <label>Date of Exposure</label>

                      <input
                        type="date"
                        value={showView.date_of_exposure || ""}
                        onChange={(e) =>
                          setShowView((prev) => ({
                            ...prev,
                            date_of_exposure: e.target.value,
                          }))
                        }
                      />

                      <label>Previous Vaccine</label>
                      <div className="dynamic-field">
                        {editedMedical.prevVaccs.map((v, i) => (
                          <div key={i} className="field-row">
                            <select
                              value={v.option}
                              onChange={(e) => {
                                const selected = e.target.value
                                setEditedMedical((prev) => {
                                  const newList = [...prev.prevVaccs]
                                  newList[i] = {
                                    option: selected,
                                    custom: selected === "Other" ? prev.prevVaccs[i].custom || "" : "",
                                  }
                                  return { ...prev, prevVaccs: newList }
                                })
                              }}
                            >
                              <option value="" disabled hidden>
                                Previous Vaccine
                              </option>
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
                                  const custom = e.target.value
                                  setEditedMedical((prev) => {
                                    const newList = [...prev.prevVaccs]
                                    newList[i] = { ...newList[i], custom }
                                    return { ...prev, prevVaccs: newList }
                                  })
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
                                    const newList = prev.prevVaccs.filter((_, idx) => idx !== i)
                                    return { ...prev, prevVaccs: newList }
                                  })
                                }
                              >
                                −
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <label>Allergies</label>
                      <div className="dynamic-field">
                        {editedMedical.allergies.map((a, i) => (
                          <div key={i} className="field-row">
                            <select
                              value={a.option}
                              onChange={(e) => {
                                const selected = e.target.value
                                setEditedMedical((prev) => {
                                  const newList = [...prev.allergies]
                                  newList[i] = {
                                    option: selected,
                                    custom: selected === "Other" ? prev.allergies[i].custom || "" : "",
                                  }
                                  return { ...prev, allergies: newList }
                                })
                              }}
                            >
                              <option value="" disabled hidden>
                                Select Allergy
                              </option>
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
                                  const custom = e.target.value
                                  setEditedMedical((prev) => {
                                    const newList = [...prev.allergies]
                                    newList[i] = { ...newList[i], custom }
                                    return { ...prev, allergies: newList }
                                  })
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
                                    const newList = prev.allergies.filter((_, idx) => idx !== i)
                                    return { ...prev, allergies: newList }
                                  })
                                }
                              >
                                −
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <label>Illness / Operation</label>
                      <div className="dynamic-field">
                        {editedMedical.illOper.map((ill, i) => (
                          <div key={i} className="field-row">
                            <select
                              value={ill.option}
                              onChange={(e) => {
                                const selected = e.target.value
                                setEditedMedical((prev) => {
                                  const newList = [...prev.illOper]
                                  newList[i] = {
                                    option: selected,
                                    custom: selected === "Other" ? prev.illOper[i].custom || "" : "",
                                  }
                                  return { ...prev, illOper: newList }
                                })
                              }}
                            >
                              <option value="" disabled hidden>
                                Select Illness / Operation
                              </option>
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
                                  const custom = e.target.value
                                  setEditedMedical((prev) => {
                                    const newList = [...prev.illOper]
                                    newList[i] = { ...newList[i], custom }
                                    return { ...prev, illOper: newList }
                                  })
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
                                    const newList = prev.illOper.filter((_, idx) => idx !== i)
                                    return { ...prev, illOper: newList }
                                  })
                                }
                              >
                                −
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <label>Assessment</label>
                      <div className="assesinp">
                        <textarea
                          value={showView.assessment || ""}
                          onChange={(e) =>
                            setShowView((prev) => ({
                              ...prev,
                              assessment: e.target.value,
                            }))
                          }
                          style={{
                            resize: "none",
                            width: "1120px",
                            height: "120px",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="medicalButtons">
                  {!isEditingMedical ? (
                    <button className="EditBtn" onClick={() => setIsEditingMedical(true)}>
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
                              dateOfExposure: showView.date_of_exposure || "",
                              prevVacc: editedMedical.prevVaccs
                                .map((v) => (v.option === "Other" ? v.custom : v.option))
                                .filter(Boolean)
                                .join(", "),
                              allergies: editedMedical.allergies
                                .map((a) => (a.option === "Other" ? a.custom : a.option))
                                .filter(Boolean)
                                .join(", "),
                              illOper: editedMedical.illOper
                                .map((i) => (i.option === "Other" ? i.custom : i.option))
                                .filter(Boolean)
                                .join(", "),
                              assessment: showView.assessment || "",
                            })
                            alert("Medical details updated successfully!")
                            setIsEditingMedical(false)

                            const refreshed = await invoke("get_patient_with_user", {
                              id: showView.id,
                            })
                            setShowView(refreshed)
                          } catch (err) {
                            console.error("Update failed:", err)
                            alert("Failed to update medical history: " + err)
                          }
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="CancelBtn"
                        onClick={async () => {
                          const refreshed = await invoke("get_patient_with_user", {
                            id: showView.id,
                          })
                          setShowView(refreshed)
                          setIsEditingMedical(false)
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </section>
              <h4 className="section-title"></h4>

              <div className="appointmentHistory">
                <div className="containerappt2">
                  <div className="textbtncont">
                    <h3>Appointment History</h3>
                    <div className="btnapptadd">
                      <button
                        className="AddAppointmentBtn"
                        onClick={() => {
                          setShowAddAppointment(true)
                          setEditAppointment(null)
                          setNewSchedule(getTodayDate())
                          setNewTypeofBite("")
                          setNewSite("")
                          setNewBitingAnimal("")
                          setNewCategory("")
                          setNewPreviousAntiRabiesVaccine("")
                          setSelectedProphylaxisType("")
                          setNewTetanusToxoid(false)
                          setRoute("")
                        }}
                      >
                        Add Appointment
                      </button>
                    </div>
                  </div>

                  <div className="appointmentHistoryContainer">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Purpose</th>
                          <th>Status</th>
                          <th>Given</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appt) => (
                          <tr key={appt.id}>
                            <td>{appt.schedule}</td>
                            <p>Prophylaxis: {appt.prophylaxis_type || "Not selected"}</p>
                            <td>{appt.status || "Pending"}</td>
                            <td>{appt.tetanus_toxoid ? "✅" : "❌"}</td>
                            <td>
                              <button onClick={() => handleEditAppointment(appt)}>Edit</button>
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
            <span>Last Appointment</span>
            <span>Action</span>
          </div>

          {patients.map((p) => (
            <div className="patientRow" key={p.id}>
              <span>
                {p.first_name} {p.middle_name} {p.last_name}
              </span>
              <span>{p.age}</span>
              <span>{p.date_created}</span>
              <span>{p.last_appointment || "N/A"}</span>
              <div style={{ textAlign: "center" }}>
                <QRCodeCanvas
                  value={JSON.stringify({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                  })}
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
                      const fullPatient = await invoke("get_patient_with_user", {
                        id: p.id,
                      })
                      setShowView((prev) => ({
                        ...prev,
                        ...fullPatient,
                      }))
                      const appts = await getAppointments(p.id)
                      setAppointments(appts)
                    } catch (err) {
                      console.error("Failed to load patient:", err)
                      alert("Failed to load patient details.")
                    }
                  }}
                >
                  View
                </button>
                {!viewArchived ? (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Archive ${p.first_name} ${p.last_name}?`)) {
                        await archivePatient(p.id)
                        alert("Archived successfully!")
                        if (viewArchived) loadArchivedPatients()
                        else loadPatients()
                      }
                    }}
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Restore ${p.first_name} ${p.last_name}?`)) {
                        await restorePatient(p.id)
                        alert("Restored successfully!")
                        loadArchivedPatients()
                      }
                    }}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {showAddAppointment && (
          <div className="popup">
            <form className="appointmentForm" onSubmit={handleSaveAppointment}>
              <div className="containerapptNew">
                <h3>{editAppointment ? "Edit Appointment" : "Add Appointment"}</h3>

                <div className="section">
                  <h4>History of Exposure</h4>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Date of Exposure</label>
                      <input
                        type="date"
                        value={showView.date_of_exposure || ""}
                        onChange={(e) =>
                          setShowView((prev) => ({
                            ...prev,
                            date_of_exposure: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Type of Bite</label>
                      <select value={newTypeofBite} onChange={(e) => setNewTypeofBite(e.target.value)} required>
                        <option value="" disabled hidden>
                          Select
                        </option>
                        <option value="Laceration">Laceration</option>
                        <option value="Abrasion">Abrasion</option>
                        <option value="Puncture">Puncture</option>
                        <option value="Minor Scratches">Minor Scratches</option>
                        <option value="Crush Injuries">Crush Injuries</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Site of Bite</label>
                      <select value={newSite} onChange={(e) => setNewSite(e.target.value)} required>
                        <option value="" disabled hidden>
                          Select
                        </option>
                        <option value="Leg">Leg</option>
                        <option value="Hand">Hand</option>
                        <option value="Neck">Neck</option>
                        <option value="Foot">Foot</option>
                        <option value="Head">Head</option>
                        <option value="Torso">Torso</option>
                        <option value="Arm">Arm</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Biting Animal</label>
                      <select value={newBitingAnimal} onChange={(e) => setNewBitingAnimal(e.target.value)} required>
                        <option value="" disabled hidden>
                          Select
                        </option>
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
                    </div>

                    <div className="form-group">
                      <label>Category</label>
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required>
                        <option value="" disabled hidden>
                          Select
                        </option>
                        <option value="I">I</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Previous Anti-Rabies Vaccine</label>
                      <select
                        value={newPreviousAntiRabiesVaccine}
                        onChange={(e) => setNewPreviousAntiRabiesVaccine(e.target.value)}
                        required
                      >
                        <option value="" disabled hidden>
                          Select
                        </option>
                        <option value="None">None</option>
                        <option value="Pre-Exposure Prophylaxis">Pre-Exposure Prophylaxis</option>
                        <option value="Post-Exposure Prophylaxis">Post-Exposure Prophylaxis</option>
                        <option value="Booster">Booster</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="section">
                  <h4>Vaccine Information</h4>
                  <p>
                    <strong>Generic Name:</strong> PCECV
                  </p>
                  <p>
                    <strong>Brand Name:</strong> Vaxirab N
                  </p>

                  <div className="form-group">
                    <label>Route</label>
                    <select value={route} onChange={handleRouteChange} required>
                      <option value="">Select Route</option>
                      <option value="ID">ID</option>
                      <option value="IM">IM</option>
                    </select>
                  </div>
                </div>

                <div className="section">
                  <label>
                    <b>Prophylaxis Type:</b>
                  </label>
                  <div className="radio-group">
                    {["Post Exposure Prophylaxis", "Pre Exposure Prophylaxis", "Booster"].map((type) => (
                      <label key={type}>
                        <input
                          type="radio"
                          name="prophylaxis"
                          value={type}
                          checked={selectedProphylaxisType === type}
                          onChange={(e) => {
                            setSelectedProphylaxisType(e.target.value)
                            const today = new Date()
                            const yyyy = today.getFullYear()
                            const mm = String(today.getMonth() + 1).padStart(2, "0")
                            const dd = String(today.getDate()).padStart(2, "0")
                            const todayStr = `${yyyy}-${mm}-${dd}`
                            setDayZero(todayStr)
                            setDayThree(addDays(todayStr, 3))
                            setDaySeven(addDays(todayStr, 7))
                            setDayFourteen(addDays(todayStr, 14))
                            setDayThirty(addDays(todayStr, 30))
                          }}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>

                {selectedProphylaxisType && (
                  <div className="auto-schedule">
                    <h4>Auto-Generated Schedule</h4>
                    {selectedProphylaxisType === "Booster" ? (
                      <>
                        <p>
                          <b>Day 0:</b> {dayZero}
                        </p>
                        <p>
                          <b>Day 7:</b> {daySeven}
                        </p>
                        <p>
                          <b>Day 30:</b> {dayThirty}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <b>Day 0:</b> {dayZero}
                        </p>
                        <p>
                          <b>Day 3:</b> {dayThree}
                        </p>
                        <p>
                          <b>Day 7:</b> {daySeven}
                        </p>
                        <p>
                          <b>Day 14:</b> {dayFourteen}
                        </p>
                        <p>
                          <b>Day 30:</b> {dayThirty}
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div className="tetanusCheckbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={newTetanusToxoid}
                      onChange={(e) => setNewTetanusToxoid(e.target.checked)}
                    />
                    Tetanus Toxoid 0.5ML
                  </label>
                </div>

                <div className="apptbtns">
                  <button type="submit" className="SubmitBtn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="CancelBtn"
                    onClick={() => {
                      setShowAddAppointment(false)
                      if (!editAppointment) {
                        setNewSchedule("")
                        setNewTypeofBite("")
                        setNewSite("")
                        setNewBitingAnimal("")
                        setNewCategory("")
                        setNewPreviousAntiRabiesVaccine("")
                        setSelectedProphylaxisType("")
                        setNewTetanusToxoid(false)
                        setRoute("")
                      }
                      setEditAppointment(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default Patient
