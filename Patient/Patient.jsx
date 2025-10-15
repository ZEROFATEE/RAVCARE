import React, { useEffect, useState } from "react";
import "./Patient.css";
// template for the scheduling card for the Create Patient function chu chu chu
import schedulingcard from '/src/assets/template/schedulingcard.jpg';
import { getPatients, createPatient, searchPatients, filterPatients, deletePatient } from '/src/lib/db.js';


// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (dateString, days) => {
  const date = new Date(dateString + 'T00:00:00');  
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months start at 0
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const Patient = () => {
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showView, setShowView] = useState(null); // Holds the full patient object for viewing

  // NEW PATIENT FIELDS
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newWeight, setNewWeight] = useState("");

  // HISTORY OF EXPOSURE
  const [newDateOfExposure, setNewDateOfExposure] = useState(getTodayDate()); 
  const [newTypeofBite, setNewTypeofBite] = useState("");
  const [newSite, setNewSite] = useState("");
  const [newAnimalBiting, setNewBitingAnimal] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPreviousAntiRabiesVaccine, setNewPreviousAntiRabiesVaccine] = useState("");
  const [prophylaxisType, setProphylaxisType] = useState(""); // NEW: For single checkbox selection

  // ANTI-RABIES VACCINE
  const [newGenericName, setNewGenericName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newSchedule, setNewSchedule] = useState("Standard Schedule"); // Default schedule
  const [tetanusToxoidChecked, setTetanusToxoidChecked] = useState("");

  // SCHEDULE DATES
   // Day Zero automatically set to current day. while Day 3 to 30 will set their corresponding days
  const [newDayZero, setNewDayZero] = useState(getTodayDate());
  const [dayThreeDate, setDayThreeDate] = useState("");  
  const [daySevenDate, setDaySevenDate] = useState("");   
  const [dayFourteenDate, setDayFourteenDate] = useState(""); 
  const [dayThirtyDate, setDayThirtyDate] = useState("");



  useEffect(() => {
    loadPatients();
  }, []);

  // useEffect to automatically calculate the scheduled dates
useEffect(() => {
    if (newDayZero) {
      setDayThreeDate(addDays(newDayZero, 3));
      setDaySevenDate(addDays(newDayZero, 7));
      setDayFourteenDate(addDays(newDayZero, 14));
      setDayThirtyDate(addDays(newDayZero, 30));
    }
  }, [newDayZero]);

  // sets the schedule days when admin selects a day in the calendar



  // Load all patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const data = await getPatients();
    setPatients(data);
  }

  useEffect(() => {
  if (newDateOfExposure) {
    // Day Zero equals Date of Exposure
    setNewDayZero(newDateOfExposure);
    setDayThreeDate(addDays(newDateOfExposure, 3));
    setDaySevenDate(addDays(newDateOfExposure, 7));
    setDayFourteenDate(addDays(newDateOfExposure, 14));
    setDayThirtyDate(addDays(newDateOfExposure, 30));
  }
}, [newDateOfExposure]);


  // Resets all state fields to their initial values
  function resetFormFields() {
    setFirstName("");
    setLastName("");
    setMiddleName("");
    setNewAge("");
    setNewAddress("");
    setNewGender("");
    setNewWeight("");
    setNewDateOfExposure(getTodayDate());
    setNewTypeofBite("");
    setNewSite("");
    setNewBitingAnimal("");
    setNewCategory("");
    setNewPreviousAntiRabiesVaccine("");
    setProphylaxisType("");
    setNewGenericName("");
    setNewBrandName("");
    setNewRoute("");
    setNewSchedule("Standard Schedule");
    setNewDayZero(getTodayDate()); // Reset Day Zero date
    setDayThreeDate("");
    setDaySevenDate("");
    setDayFourteenDate("");
    setDayThirtyDate("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    
    // Validation and Error Handling 
    const ageValue = parseInt(newAge);
    const weightValue = parseFloat(newWeight);

    if (!dayThreeDate || !daySevenDate || !dayFourteenDate || !dayThirtyDate) {
        alert("Scheduled dates were not calculated. Please try again.");
        return;
    }
    
    if (ageValue < 0 || isNaN(ageValue) || weightValue < 0 || isNaN(weightValue)) {
        alert("Age and Weight must be non-negative numbers.");
        return;
    }
    
    const requiredFields = [
        firstName, lastName, middleName, newAddress, newGender,
        newDateOfExposure, newTypeofBite, newSite, newAnimalBiting, newCategory, 
        newPreviousAntiRabiesVaccine, prophylaxisType, newGenericName, newBrandName, newRoute, newSchedule, tetanusToxoidChecked,
        newDayZero, dayThreeDate, daySevenDate, dayFourteenDate, dayThirtyDate
    ];

    if (requiredFields.some(field => !field) || ageValue === null || weightValue === null) {
      alert("Please fill in all required fields.");
      return;
    }
    // End Validation

    try {
        const newPatient = await createPatient(
            firstName, lastName, middleName, newAddress, ageValue, newGender, weightValue,
            newDateOfExposure, newTypeofBite, newSite, newAnimalBiting, newCategory, 
            newPreviousAntiRabiesVaccine, prophylaxisType, 
            newGenericName, newBrandName, newRoute, newSchedule, tetanusToxoidChecked,
            dayThreeDate, daySevenDate, dayFourteenDate, dayThirtyDate 
        );

        
        setShowView(newPatient); 
        
    } catch(error) {
        console.error("Error creating patient:", error);
        alert(`Failed to create patient: ${error}`);
        return;
    }
    
    resetFormFields();
    setShowCreateForm(false);
    loadPatients();
  }

  async function handleSearch(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim() === "") {
      loadPatients();
    } else {
      const results = await searchPatients(q);
      setPatients(results);
    }
  }

  // Handle single checkbox selection
  function handleProphylaxisChange(e) {
    const value = e.target.value;
    // Set the selected the value of the checked box
    setProphylaxisType(prophylaxisType === value ? "" : value);
  }

  async function handleFilter(e) {
    const type = e.target.value;
    setFilterType(type);
    if (type === "") {
      loadPatients();
    } else {
      const results = await filterPatients(type);
      setPatients(results);
    }
  }

  function handleOpenCreateForm() {
    setNewDayZero(getTodayDate()); // Ensure Day Zero is always current date when opening
    setShowCreateForm(true);
  }


  async function  handleDelete(){
    if(!showView) return;

    const confirmation = window.confirm
    (`Are you sure you want to delete ${showView.first_namqe} ${showView.last_name}? This action cannot be undone.`);

    if (confirmation){
      try{
      await deletePatient(showView.id);
      alert("Patient deleted successfully!");
      setShowView(null);
      loadPatients();
    } catch (error) {
      alert(`Failed to delete: ${error}`);
     }
    }
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

          <select
            className="filterDropdown"
            value={filterType}
            onChange={handleFilter}
          >
            <option value="">---</option>
            <option value="dateCreated">Date Created</option>
            <option value="alphabetAsc">Last Name Ascending</option>
            <option value="alphabetDsc">Last Name Descending</option>
          </select>

          <button className="createBtn" onClick={handleOpenCreateForm}>
            Create
          </button>
        </div>

        {/* Create form popup */}
        {showCreateForm && (
          <div className="popup">
            <form className="popupForm" onSubmit={handleCreate}>
              <h3>Add New Patient</h3>
              <div className="input-row1">
                <input
                  type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} require />
                <input
                  type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                <input
                  type="text" placeholder="Middle Name" value={middleName} onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>
            <div className="input-row2">
                <input
                  type="text" placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} required />
            </div>
            <div className="input-row3">
                <input
                  type="number" placeholder="Age" value={newAge} onChange={(e) => setNewAge(e.target.value)}  min="0" // Invalid choice: must be non-negative
                  required />
                <input
                  type="text" placeholder="Gender" value={newGender} onChange={(e) => setNewGender(e.target.value)}
                  required
                />
                <input
                  type="number" placeholder="Weight (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} min="0" // Invalid choice: must be non-negative // 
                  step="0.1" required />
            </div>

              <h3> History of Exposure </h3>

            <div className="input-row4-DateOfExposure_TypeOfBite">
                <h3>Date of Exposure:</h3>
                <input
                  id="dateOfExposure" type="date" // use calendar/date picker 
                  value={newDateOfExposure} onChange={(e) => setNewDateOfExposure(e.target.value)} required max={getTodayDate()}/>
            </div>

            <div className="input-row4-2">
                <h3>Type of Bite:</h3>
                <input
                   type= "text" placeholder="Type of Bite" value={newTypeofBite} onChange={(e) => setNewTypeofBite(e.target.value)} required/>
              </div>
              <div className="input-row5">
                <input
                  type="text" placeholder="Site of Bite" value={newSite} onChange={(e) => setNewSite(e.target.value)} required/>
                <input
                  type="text"
                  placeholder="Biting Animal"
                  value={newAnimalBiting} onChange={(e) => setNewBitingAnimal(e.target.value)} required />
                <input
                  type="text" placeholder="Category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required/>
            </div>
            <div className="input-row6_category">
                <span className="input-text">
                  <h3>Previous Anti-Rabies Vaccine:</h3>
                </span>
                <input
                  type="text" placeholder="Previous Anti-Rabies Vaccine" size="30" value={newPreviousAntiRabiesVaccine} onChange={(e) => setNewPreviousAntiRabiesVaccine(e.target.value)} required />
            </div>

              {/* CHECKBOX - Single selection enforced */}
            <div className="checkbox">
                <input
                  type="checkbox" value="Post-Exposure Prophylaxis" checked={prophylaxisType === "Post-Exposure Prophylaxis"} onChange={handleProphylaxisChange} required={!prophylaxisType} />
                <span className="checkbox-text">Post-Exposure Prophylaxis</span>
                <input
                  type="checkbox" value="Pre-Exposure Prophylaxis" checked={prophylaxisType === "Pre-Exposure Prophylaxis"} onChange={handleProphylaxisChange} required={!prophylaxisType} />
                <span className="checkbox-text">Pre-Exposure Prophylaxis</span>
                <input
                  type="checkbox" value="Booster" checked={prophylaxisType === "Booster"}  onChange={handleProphylaxisChange} required={!prophylaxisType} />
                <span className="checkbox-text">Booster</span>
            </div>

              <h3>Anti-Rabies Vaccine</h3>

              <div className="input-row7">
                <span className="input-text01">Generic Name:</span>
                <input
                  type="text" placeholder="Generic Name" value={newGenericName} onChange={(e) => setNewGenericName(e.target.value)} required/>
              </div>
              <div className="input-row8">
                <span className="input-text2">Brand Name:</span>
                <input
                  type="text"  placeholder="Brand Name"
                  value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} required/>
              </div>

              <div className="input-row9">
                <span className="input-text3">Route:</span>
                <input
                  type="text" placeholder="Route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} required />
              </div>

              <div className="Tetanus_Toxoid-radio-group">
              <span className="checkbox-text">Tetanus Toxoid</span>
              <label>
                <input
                  type = "checkbox" checked={tetanusToxoidChecked} onChange={(e) => setTetanusToxoidChecked}>
                </input>
              </label>
              </div>
  
              
              
              {/* Automatically displays current date */}
              <div className="input-row11">
                <span className="input-text5">Scheduled Day 0 (Today):</span>
                <input
                  type="date"
                  value={newDayZero} 
                  readOnly
                />
              </div>
              
              <div className="input-row12">
                <span className="input-text5">Scheduled Day 3: </span>
                   <input 
                   type="date" value={dayThreeDate} readOnly/>
                 </div>
              <div className="input-row13">
                 <span className="input-text5">Scheduled Day 7: </span>
                    <input 
                    type="date" value={daySevenDate} readOnly /> 
                  </div>
              <div className="input-row14">
                 <span className="input-text5">Scheduled Day 14: </span>
                 <input 
                 type="date" value={dayFourteenDate} readOnly />
                 </div>

                <div className="input-row15">
                  <span className="input-text5">Scheduled Day 30: </span>
                    <input
                      type="date" value={dayThirtyDate} readOnly />
                  </div>

                <div className="input-row16">
                  <span className="input-text5">Dated Given: </span>
                  <input
                  type="date" value={newDayZero} readOnly>
                  </input>



                </div>


              {/* BUTTONS */}

              <div className="popupActions">
                <button className="SubmitBtn" type="submit">
                  Submit
                </button>
                <button
                  className="CancelBtn"
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Patient View Data Modal */}
        {/* NOTE: MIGHT CHANGE THE DESIGN LATER ON */}
        {showView && (
          <div className="popup">
            <div className="view-modalPatient">
            <h3>Patient Full Information</h3>

            <section className="modal-secton">
              <h4 className="section-title"></h4>
              <div className="info-grid">
              <h4>Personal Details</h4>
              <p><b>Name:</b> {showView.first_name} {showView.middle_name} {showView.last_name}</p>
              <p><b>Age:</b> {showView.age}</p>
              <p><b>Gender:</b> {showView.gender}</p>
              <p><b>Weight:</b> {showView.weight}</p>
              <p><b>Address:</b> {showView.address}</p>
              <p><b>Date Created:</b> {showView.date_created}</p>
              </div>
             </section>

              {/* Exposure History */}
            <section className="modal-section">
            <h4 className="section-title"></h4>
            <div className="info-grid">
              <h4>Medical History</h4>
              <p><b>Date of Exposure:</b> {showView.date_of_exposure}</p>
              <p><b>Type of Bite:</b> {showView.type_of_bite}</p>
              <p><b>Site of Bite:</b> {showView.site_of_bite}</p>
              <p><b>Biting Animal:</b> {showView.biting_animal}</p>
              <p><b>Category:</b> {showView.category}</p>
              <p><b>Previous Anti-Rabies Vaccine:</b> {showView.previous_anti_rabies_vaccine}</p>
              <p><b>Prophylaxis Type:</b> **{showView.prophylaxis_type}**</p>
            </div>
            </section>
              {/* Vaccine Info */}
            <section className="modal-section">
              <h4 className="section-title"></h4>
            <div className="info-grid">
            <h4>Anti-Rabies Vaccine</h4>
              <p><b>Generic Name:</b> {showView.generic_name}</p>
              <p><b>Brand Name:</b> {showView.brand_name}</p>
              <p><b>Route:</b> {showView.route}</p>
            </div>
            </section>
              {/* Schedule */}
            <section className="modal-section">
              <h4 className="section-title"></h4>
            <div className="info-grid">
            <h4>Schedule</h4>
              <p><b>Day 0 (Initial Appointment):</b> {showView.day_zero_date}</p>
              <p><b>Day 3 </b>{showView.day_three_date}</p>
              <p><b>Day 7 </b>{showView.day_seven_date}</p>
              <p><b>Day 14 </b>{showView.day_fourteen_date}</p>
              <p><b>Day 30 </b>{showView.day_thirty_date}</p>
              <p><b>Last Appointment:</b> {showView.last_appointment || "N/A"}</p>
            </div>
            </section>

            <div className="Closebtn">
              <button onClick={() => setShowView(null)}>Close</button>
            </div>


            <button type="button" onClick={handleDelete}> Delete </button>       
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
              {/* Note: The rust backend now returns first_name, middle_name, and last_name */}
              <span>{p.first_name} {p.middle_name} {p.last_name}</span> 
              <span>{p.age}</span>
              <span>{p.date_created}</span>
              <span>{p.last_appointment || "N/A"}</span>
              <button onClick={() => setShowView(p)}>View</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Patient;