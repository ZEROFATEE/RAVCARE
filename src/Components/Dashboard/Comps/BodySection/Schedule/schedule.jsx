"use client"

// i think just use schedule code mo, it'll be much easier than figuring each part or component that isn't working

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

const Schedule = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { selectedPatient: fromPatient, appointments: fromAppointments } = location.state || {}

  const [time, setTime] = useState(new Date().toLocaleTimeString())
  const [date, setDate] = useState(new Date())
  const [patients, setPatients] = useState([])
  const [filteredAppointments, setFilteredAppointments] = useState([])
  const [activeTab, setActiveTab] = useState("appointments")

  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [showEditPopup, setShowEditPopup] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(fromPatient || null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const checkedAppointmentsRef = useRef(new Set())

  // 🕒 Clock updater
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 📋 Load patient data and their appointments
  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await invoke("get_patients_cmd")
        console.log("[v0] Patients loaded:", data)

        // Fetch appointments for each patient
        const patientsWithAppointments = await Promise.all(
          data.map(async (p) => {
            try {
              const appts = await getAppointments(p.id)
              console.log(`[v0] Appointments for patient ${p.id}:`, appts)
              return { ...p, appointments: appts || [] }
            } catch (err) {
              console.error(`[v0] Error fetching appointments for patient ${p.id}:`, err)
              return { ...p, appointments: [] }
            }
          }),
        )

        console.log("[v0] Patients with appointments:", patientsWithAppointments)
        setPatients(patientsWithAppointments)
        setFilteredAppointments(patientsWithAppointments)
      } catch (err) {
        console.error("[v0] Error loading patients:", err)
      }
    }
    loadPatients()
  }, [])

  useEffect(() => {
    const checkMissedAppointments = async () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentTimeInMinutes = currentHour * 60 + currentMinute

      // 5pm = 17:00 = 1020 minutes
      const fivePmInMinutes = 17 * 60

      setPatients((prevPatients) => {
        const updatedPatients = prevPatients.map((p) => {
          if (!p.appointments || p.appointments.length === 0) return p

          const updatedAppointments = p.appointments.map((appt) => {
            // Skip if already completed or missed
            if (appt.status === "Finished" || appt.status === "Missed") {
              return appt
            }

            // Check if appointment is today and past 5pm
            const apptDate = new Date(appt.schedule)
            const today = new Date()
            const isToday =
              apptDate.getFullYear() === today.getFullYear() &&
              apptDate.getMonth() === today.getMonth() &&
              apptDate.getDate() === today.getDate()

            if (isToday && currentTimeInMinutes >= fivePmInMinutes && !checkedAppointmentsRef.current.has(appt.id)) {
              checkedAppointmentsRef.current.add(appt.id)
              // Call backend to update status
              invoke("update_appointment_status", { id: appt.id, status: "Missed" }).catch((err) => {
                console.error(`[v0] Failed to auto-mark appointment as Missed:`, err)
              })
              return { ...appt, status: "Missed" }
            }

            return appt
          })

          return { ...p, appointments: updatedAppointments }
        })

        setFilteredAppointments(updatedPatients)
        return updatedPatients
      })
    }

    // Check every minute
    const interval = setInterval(checkMissedAppointments, 60000)
    checkMissedAppointments() // Check immediately on load

    return () => clearInterval(interval)
  }, []) // Empty dependency array - no infinite loop

  // 📊 Appointment counts for calendar
  const getAppointmentCountByDate = () => {
    const counts = {}
    patients.forEach((p) => {
      if (p.appointments && Array.isArray(p.appointments)) {
        p.appointments.forEach((a) => {
          const d = new Date(a.schedule)
          if (!isNaN(d)) {
            const dateStr = d.toISOString().split("T")[0]
            counts[dateStr] = (counts[dateStr] || 0) + 1
          }
        })
      }
    })
    return counts
  }

  const getPriorityLevel = (count) => {
    if (count >= 61) return "high"
    if (count >= 21) return "medium"
    if (count >= 1) return "low"
    return null
  }

  const appointmentCounts = useMemo(() => getAppointmentCountByDate(), [patients])

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await invoke("update_appointment_status", { id: appointmentId, status: newStatus })

      // Update local state
      const updatedPatients = patients.map((p) => {
        if (p.appointments) {
          return {
            ...p,
            appointments: p.appointments.map((appt) =>
              appt.id === appointmentId ? { ...appt, status: newStatus } : appt,
            ),
          }
        }
        return p
      })
      setPatients(updatedPatients)
      setFilteredAppointments(updatedPatients)
    } catch (error) {
      console.error("[v0] Failed to update status:", error)
      alert("Failed to update appointment status: " + error)
    }
  }

  const handleDateChange = (newDate) => setDate(newDate)

  const handleSaveSchedule = () => {
    const updatedPatients = patients.map((p) =>
      p.id === selectedPatientId ? { ...p, next_appointment: `${selectedDate}` } : p,
    )
    setPatients(updatedPatients)
    setShowConfirmPopup(false)
    setShowEditPopup(false)
  }

  // ✅ Get next appointment for a patient (sorted by schedule date)
  const getNextAppointment = (patient) => {
    if (!patient || !patient.appointments || patient.appointments.length === 0) return null

    const pendingAppointments = patient.appointments.filter((a) => a.status !== "Finished" && a.status !== "Missed")

    if (pendingAppointments.length === 0) return null

    // Sort by schedule date and return the earliest
    return pendingAppointments.sort((a, b) => new Date(a.schedule) - new Date(b.schedule))[0]
  }

  const getAppointmentToDisplay = (patient) => {
    if (!patient || !patient.appointments || patient.appointments.length === 0) return null

    if (activeTab === "missed") {
      return patient.appointments.find((a) => a.status === "Missed") || null
    } else if (activeTab === "finished") {
      return patient.appointments.find((a) => a.status === "Finished") || null
    } else {
      return getNextAppointment(patient)
    }
  }

  const appointmentsToDisplay = filteredAppointments.filter((p) => {
    if (!p.appointments || p.appointments.length === 0) return false
    if (activeTab === "finished") return p.appointments.some((a) => a.status === "Finished")
    if (activeTab === "missed") return p.appointments.some((a) => a.status === "Missed")
    return p.appointments.some((a) => a.status !== "Finished" && a.status !== "Missed")
  })

  console.log("[v0] Appointments to display:", appointmentsToDisplay, "Active tab:", activeTab)

  return (
    <div className="schedule-layout">
      {/* LEFT PANEL */}
      <div className="schedule-left">
        <div className="left-center">
          <h2 className="today-title">Today</h2>
        </div>

        <div className="appointments">
          <button
            className={`tab-btn ${activeTab === "appointments" ? "active" : ""}`}
            onClick={() => setActiveTab("appointments")}
          >
            Appointments
          </button>
          <button
            className={`tab-btn finished ${activeTab === "finished" ? "active" : ""}`}
            onClick={() => setActiveTab("finished")}
          >
            Finished
          </button>
          <button
            className={`tab-btn missed ${activeTab === "missed" ? "active" : ""}`}
            onClick={() => setActiveTab("missed")}
          >
            Missed
          </button>
        </div>

        <div className="appointment-list">
          {appointmentsToDisplay.length > 0 ? (
            appointmentsToDisplay.map((p) => {
              const nextAppt = getNextAppointment(p)
              return (
                <div className={`appointment-card`} key={p.id}>
                  <div className="appointment-info">
                    <p>
                      <b>
                        {p.last_name}, {p.first_name} {p.middle_name || ""}
                      </b>
                    </p>

                    {activeTab !== "missed" && (
                      <div className="next-appointment">
                        <h4>Next Appointment</h4>
                        {nextAppt ? <p>{nextAppt.schedule}</p> : <p>appointment completed!</p>}
                      </div>
                    )}

                    <div className="appt-icons">
                      <button
                        className="edit-icon-button"
                        onClick={async () => {
                          setSelectedPatient(p)
                          setSelectedPatientId(p.id)
                          const appts = await getAppointments(p.id)
                          setSelectedPatient((prev) => ({
                            ...prev,
                            appointments: appts,
                          }))
                          const apptToDisplay =
                            activeTab === "missed"
                              ? appts.find((a) => a.status === "Missed")
                              : activeTab === "finished"
                                ? appts.find((a) => a.status === "Finished")
                                : appts.find((a) => a.status !== "Finished" && a.status !== "Missed")
                          setSelectedAppointment(apptToDisplay || null)
                          setShowEditPopup(true)
                        }}
                      >
                        <RiPencilFill className="edit-icon" />
                      </button>

                      {activeTab === "appointments" &&
  p.appointments &&
  p.appointments.map((appt) => (
    <label key={appt.id} className="toggle-finished-wrapper">
      <input
        type="checkbox"
        className="toggle-finished"
        checked={appt.status === "Finished"}
        onChange={() =>
          handleStatusChange(appt.id, appt.status === "Finished" ? "" : "Finished")
        }
      />
      <span className="checkbox-custom"></span>Finished
    </label>
  ))}

                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <p>
              {activeTab === "missed"
                ? "Patient Missed a Appointment!"
                : "No appointments found. " + (filteredAppointments.length > 0 ? "Try a different tab." : "")}
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
            value={date}
            tileClassName={({ date, view }) => {
              if (view === "month") {
                const dateStr = date.toISOString().split("T")[0]
                const count = appointmentCounts[dateStr] || 0
                const level = getPriorityLevel(count)
                return level ? `calendar-${level}` : null
              }
            }}
            tileContent={({ date, view }) => {
              if (view === "month") {
                const dateStr = date.toISOString().split("T")[0]
                const count = appointmentCounts[dateStr] || 0
                return count > 0 ? <div className="appt-count">{count}</div> : null
              }
            }}
          />
        </div>

        <div className="priority-indicator">
          <span>🟢 Low</span>
          <span>🟡 Medium</span>
          <span>🔴 High</span>
        </div>
      </div>

      {/* === EDIT SCHEDULE POPUP === */}
      {showEditPopup && (
        <div className="popup">
          <div className="view-modalPatient">
            <div className="Closebtn">
              <button onClick={() => setShowEditPopup(false)}>Close</button>
            </div>

            <>
              <h3>
                Name:{" "}
                {selectedPatient
                  ? `${selectedPatient.last_name}, ${selectedPatient.first_name} ${selectedPatient.middle_name || ""}`
                  : "No patient selected"}
              </h3>

              <div className="Edit-Buttons">
                {activeTab === "missed" && (
                  <button
                    className="open-nested-btn"
                    onClick={() => {
                      if (!selectedPatient) return alert("No patient selected")
                      // Get the first missed appointment to pass to Patient component
                      const missedAppt = selectedPatient.appointments?.find((a) => a.status === "Missed")
                      if (!missedAppt) return alert("No missed appointment found")

                      navigate(`/dashboard/patient/${selectedPatient.id}`, {
                        state: {
                          editAppointmentId: missedAppt.id,
                          editAppointment: missedAppt,
                        },
                      })
                      setShowEditPopup(false)
                    }}
                  >
                    Re-schedule
                  </button>
                )}

                <h3>Appointment Details</h3>
                {selectedAppointment ? (
                  <div className="appointment-details">
                    <p>
                      <b>Purpose of Appointment:</b> {selectedAppointment.type_of_bite || "Not specified"}
                    </p>
                    <p>
                      <b>Site of Bite:</b> {selectedAppointment.site_of_bite || "Not specified"}
                    </p>
                    <p>
                      <b>Biting Animal:</b> {selectedAppointment.biting_animal || "Not specified"}
                    </p>
                    <p>
                      <b>Category:</b> {selectedAppointment.category || "Not specified"}
                    </p>
                    <p>
                      <b>Previous Vaccine:</b> {selectedAppointment.previous_vaccine || "None"}
                    </p>
                    <p>
                      <b>Prophylaxis Type:</b> {selectedAppointment.prophylaxis_type || "Not selected"}
                    </p>
                    <p>
                      <b>Route:</b> {selectedAppointment.route || "Not specified"}
                    </p>
                    <p>
                      <b>Tetanus Toxoid:</b> {selectedAppointment.tetanus_toxoid ? "✅ Yes" : "❌ No"}
                    </p>

                    {/* Display scheduled dates if available */}
                    {(selectedAppointment.day_zero ||
                      selectedAppointment.day_three ||
                      selectedAppointment.day_seven ||
                      selectedAppointment.day_fourteen ||
                      selectedAppointment.day_thirty) && (
                      <div className="scheduled-dates">
                        <h4>Scheduled Dates:</h4>
                        {selectedAppointment.day_zero && (
                          <p>
                            <b>Day 0:</b> {selectedAppointment.day_zero}
                          </p>
                        )}
                        {selectedAppointment.day_three && (
                          <p>
                            <b>Day 3:</b> {selectedAppointment.day_three}
                          </p>
                        )}
                        {selectedAppointment.day_seven && (
                          <p>
                            <b>Day 7:</b> {selectedAppointment.day_seven}
                          </p>
                        )}
                        {selectedAppointment.day_fourteen && (
                          <p>
                            <b>Day 14:</b> {selectedAppointment.day_fourteen}
                          </p>
                        )}
                        {selectedAppointment.day_thirty && (
                          <p>
                            <b>Day 30:</b> {selectedAppointment.day_thirty}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>No appointment details available</p>
                )}

                <button
                  onClick={() => {
                    if (!selectedPatient) return alert("No patient selected")
                    navigate(`/dashboard/patient/${selectedPatient.id}`)
                  }}
                >
                  Go to Patient
                </button>
              </div>
            </>

            {/* === (NESTED) RE-SCHEDULE POPUP === */}
            {showConfirmPopup && activeTab === "missed" && (
              <div className="nested-popup">
                <div className="nested-content">
                  <div className="datetime-controls">
                    <label>
                      Date:
                      <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                    </label>
                  </div>

                  <div className="nested-actions">
                    <button className="back-btn" onClick={() => setShowConfirmPopup(false)}>
                      ⬅ Back
                    </button>
                    <button className="save-btn" onClick={handleSaveSchedule}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Schedule
