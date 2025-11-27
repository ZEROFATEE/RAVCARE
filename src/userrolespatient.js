/*

const userRole = localStorage.getItem("userRole");

{(userRole === "desk" || userRole === "admin") && (
  <button className="createBtn" onClick={handleOpenCreateForm}>
    Create
  </button>
)}

<div className="archivebtn2">
  {userRole === "admin" && (
    <>
      {!viewArchived ? (
        <button
          className="Archive"
          onClick={async () => {
            setConfirmPopup({
              show: true,
              message: `Archive ${showView.first_name} ${showView.last_name}?`,
              onConfirm: async () => {
                setConfirmPopup({ show: false });
                await archivePatient(showView.id);
                toast.show("Patient archived successfully!", "success");
                setShowView(null);
                loadPatients();
              },
            });
          }}
        >
          Archive
        </button>
      ) : (
        <button
          className="Restore"
          onClick={async () => {
            setConfirmPopup({
              show: true,
              message: `Restore ${showView.first_name} ${showView.last_name}?`,
              onConfirm: async () => {
                setConfirmPopup({ show: false });
                await restorePatient(showView.id);
                toast.show("Patient restored successfully!", "success");
                setShowView(null);
                loadArchivedPatients();
              },
            });
          }}
        >
          Restore
        </button>
      )}
    </>
  )}
</div>


{userRole !== "admin" && (
  <button className="AddAppointmentBtn" onClick={() => setShowAddChoice(true)}>
    New Schedule
  </button>
)}
 {(userRole === "desk") && (
<div className="medicalButtons">
  {!isEditingMedical ? (
    <>
      {userRole !== "admin" && (
        <button className="EditBtn" onClick={() => setIsEditingMedical(true)}>
          Edit
        </button>
      )}
    </>
  ) : (
    <>
      <button
        className="SaveBtn"
        onClick={async () => {
          try {
            await invoke("update_patient_medical", {
              id: showView.id,
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
              assessment: editedMedical.assessment || "",
            });
            toast.show("Medical details updated successfully!", "success");
            setIsEditingMedical(false);

            const refreshed = await invoke("get_patient_with_user", { id: showView.id });
            setShowView(refreshed);
          } catch (err) {
            console.error("Update failed:", err);
            toast.show("Failed to update medical history: " + err, "error");
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



{userRole !== "admin" && (
  <div className="appointment-buttons">
    <button className="edit" onClick={() => handleEditAppointment(showViewAppointment)}>Edit</button>
    <button className="close" onClick={() => setShowViewAppointment(null)}>Close</button>
    <button className="printBtn" onClick={() => { /* existing print logic */ 
{/*


    }}>Print Schedule Card</button>
    <button onClick={() => handleDeleteAppointment(showViewAppointment)}>Delete</button>
  </div>
)}
{userRole === "admin" && (
  <div className="appointment-buttons">
    <button className="close" onClick={() => setShowViewAppointment(null)}>Close</button>
  </div>
)}

   {userRole !== "admin" && (
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
          toast.show("⚠️ The next dose is still locked (scheduled in the future).","warning");
        } else {
          toast.show("No pending dose available to mark as done.","warning");
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
        toast.show("Appointment ID missing — cannot update.","warning");
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
      toast.show(`✅ ${prefix.replace("day_", "Day ")} marked as Done!`,"success");
    } catch (err) {
      console.error("Failed to save vaccination dates:", err);
      toast.show("❌ Failed to save given dates: " + err,"error");
    }

// Deduct depending on anti-rabies route (IM = 1, ID = 0.1)
try {
  const route = (showViewAppointment?.vaccroute || "IM").trim();
  await inventoryManager.reduceByRoute("vaxirab", route);
} catch (err) {
  console.error("Inventory reduce failed:", err);
  
}


  }}
>
  Mark Done
</button>
)}
</div>



{userRole !== "admin" && (
  <button
    className="SaveBtn"
    disabled={
      viewRegularData.hepa_b_status1 === "Missed" ||
      ...
    }
    onClick={() => markRegularDone(viewRegularData)}
  >
    Mark Done
  </button>
)}


        {userRole !== "admin" && (
            <>
      <button
  className="printBtn"
  onClick={() => {
  const printable = document.getElementById("printableForm");
  if (!printable) {
    toast.show("Printable form not found.","error");
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
  size: 5.5in 4in;       exact card size 
  margin: 0;            /remove printer’s default margins 
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;     prevent spill to a 2nd page 
}

.card-print {
  width: 5.5in;
  height: 4in;
  box-sizing: border-box;
  page-break-after: avoid;   don’t break
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
       </> )}

       } */