import "./Staff.css";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { AiOutlineSwapRight } from "react-icons/ai";

export default function Staff() {


  
  /* -------------------------------------------------------
     REGISTER FORM STATES
  ------------------------------------------------------- */
  const [formData, setFormData] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    password: "",
    contactNum: "",
    role: "desk",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    label: "",
    percent: 0,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [isRegisterError, setIsRegisterError] = useState(false);
  const [generatedUsername, setGeneratedUsername] = useState("");
  const [showUsername, setShowUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /* -------------------------------------------------------
     STAFF MANAGEMENT STATES
  ------------------------------------------------------- */
  const [users, setUsers] = useState([]);
  const [refresh, setRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newPassword, setNewPassword] = useState("");

  const [flash, setFlash] = useState("");
  const [flashOk, setFlashOk] = useState(true);

  const showFlash = (msg, ok = true) => {
    setFlash(msg);
    setFlashOk(ok);
    setTimeout(() => setFlash(""), 2500);
  };

  /* -------------------------------------------------------
     PASSWORD STRENGTH
  ------------------------------------------------------- */
  function checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    let label = "";
    if (strength <= 2) label = "Weak";
    else if (strength <= 4) label = "Medium";
    else label = "Strong";

    setPasswordStrength({
      label,
      percent: (strength / 5) * 100,
    });
  }

  /* -------------------------------------------------------
     REGISTER HANDLERS
  ------------------------------------------------------- */
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "password") {
      checkPasswordStrength(value);
    }
  };

  const handleContactChange = (e) => {
    let input = e.target.value;

    // Always enforce +63
    if (!input.startsWith("+63")) {
      input = "+63" + input.replace(/^\+?63?/, "");
    }

    // Remove non-numbers
    input = "+63" + input.slice(3).replace(/\D/g, "");

    // Limit to +63 + 10 digits
    if (input.length > 13) input = input.slice(0, 13);

    handleInputChange("contactNum", input);
  };

  function generateUsername(first, last, role) {
    return `${first.toLowerCase()}${last.toLowerCase()}${role.toLowerCase()}`;
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterMessage("");
    setIsLoading(true);

    if (!formData.firstname || !formData.lastname || !formData.password) {
      setRegisterMessage("Please fill in all required fields.");
      setIsRegisterError(true);
      setIsLoading(false);
      return;
    }

    const gen = generateUsername(
      formData.firstname,
      formData.lastname,
      formData.role
    );

    setGeneratedUsername(gen);

    try {
      const returnedUsername = await invoke("register_user", {
        payload: {
          firstname: formData.firstname,
          middlename: formData.middlename || null,
          lastname: formData.lastname,
          contact_num: formData.contactNum,
          password: formData.password,
          role: formData.role,
        },
      });

      setRegisterMessage(`Registration successful! Username: ${returnedUsername}`);
      setIsRegisterError(false);
      setShowUsername(true);

      setFormData({
        firstname: "",
        middlename: "",
        lastname: "",
        password: "",
        contactNum: "",
        role: "desk",
      });

      setPasswordStrength({ label: "", percent: 0 });

      setRefresh((p) => !p);

    } catch (err) {
      setRegisterMessage("Registration failed: " + String(err));
      setIsRegisterError(true);
    } finally {
      setIsLoading(false);
    }
  };

  /* -------------------------------------------------------
     FETCH USERS
  ------------------------------------------------------- */
  useEffect(() => {
    fetchUsers();
  }, [refresh]);

  async function fetchUsers() {
  try {
    setLoading(true);
    setError(""); // Clear any previous error

    const fetchedUsers = await invoke("get_all_users");
    console.log("✅ Users fetched:", fetchedUsers);

    if (!fetchedUsers || fetchedUsers.length === 0) {
      setError("No users found.");
      setUsers([]);
      return;
    }

    const normalized = fetchedUsers.map((u) => ({
      id: u.id,
      first_name: u.first_name ?? "",
      middle_name: u.middle_name ?? "",
      last_name: u.last_name ?? "",
      username: u.username ?? "",
      role: u.role ?? "Unknown",
      contact_num: u.contact_num ?? "N/A",
      is_active: u.is_active ?? 0,
      password_hash: u.password_hash ?? "",
    }));

    setUsers(normalized);
  } catch (err) {
    console.error("❌ fetchUsers error:", err);
    setError("Failed to load users: " + String(err));
    setUsers([]);
  } finally {
    setLoading(false); // ✅ Always stop loading
  }
}

  /* -------------------------------------------------------
     EDIT USER
  ------------------------------------------------------- */
  const openEdit = (user) => {
    setEditing(user);
    setEditForm({
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      contact_num: user.contact_num,
      role: user.role,
      username: user.username,
      current_password: user.password_hash,
      new_password: "",
    });
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async () => {
    try {
      await invoke("update_user_db", {
        id: editing.id,
        firstName: editForm.first_name,
        middleName: editForm.middle_name,
        lastName: editForm.last_name,
        contactNum: editForm.contact_num,
        role: editForm.role,
        username: editForm.username,
        newPassword: editForm.new_password,
      });

      showFlash("User updated successfully!");
      setRefresh((p) => !p);
      closeEdit();
    } catch (e) {
      alert("Update failed.");
    }
  };

  /* -------------------------------------------------------
     DELETE / TOGGLE USER
  ------------------------------------------------------- */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this account?")) return;

    try {
      await invoke("delete_user", { id });
      setRefresh((p) => !p);
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  const toggleStatus = async (id, current) => {
    const newStatus = current === 1 ? "inactive" : "active";

    try {
      await invoke("toggle_user_status", { id, newStatus });
      showFlash(
        `Account ${newStatus === "active" ? "reactivated" : "deactivated"}!`
      );
      setRefresh((p) => !p);
    } catch (err) {
      showFlash("Failed to update status.", false);
    }
  };

  /* -------------------------------------------------------
     JSX RETURN
  ------------------------------------------------------- */
  return (
  <div className="staff-container">

    {/* USER LIST PANEL */}
    <div className="right-panel">
      <h2>User List / Manage Accounts</h2>

      {flash && (
        <div
          style={{
            padding: "6px 10px",
            marginBottom: 10,
            borderRadius: 4,
            backgroundColor: flashOk ? "#d4edda" : "#f8d7da",
            color: flashOk ? "#155724" : "#721c24",
          }}
        >
          {flash}
        </div>
      )}

      {loading && <p>Loading users...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && users.length > 0 && (
        <table className="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id}>

                <td>{user.id}</td>

                <td>
                  {[user.first_name, user.middle_name, user.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </td>

                <td>{user.role}</td>

                <td>{user.contact_num}</td>

                <td>{user.is_active === 1 ? "🟢 Active" : "🔴 Inactive"}</td>

                <td>
                  <button
                    className="btn-edit"
                    onClick={() => openEdit(user)}
                    disabled={user.is_active === 1}
                  >
                    Edit
                  </button>

                  <button
                    className={user.is_active === 1 ? "btn-deactivate" : "btn-activate"}
                    onClick={() => toggleStatus(user.id, user.is_active)}
                  >
                    {user.is_active === 1 ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(user.id)}
                    disabled={user.is_active === 1}
                  >
                    Delete
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>


    {/* CREATE NEW STAFF ACCOUNT (BOTTOM AREA) */}
    <div className="create-section">
      <h2>Create New Staff Account</h2>

      {registerMessage && (
        <span className={`showMessage ${isRegisterError ? "error" : "success"}`}>
          {registerMessage}
        </span>
      )}

      {showUsername && generatedUsername && (
        <div className="username-display">
          <h4>Your Generated Username:</h4>
          <div className="username-highlight">{generatedUsername}</div>
        </div>
      )}

      <form className="create-form" onSubmit={handleRegister}>

        {/* NAME ROW */}
        <div className="row">

          <div className="field">
            <label>First Name *</label>
            <input
              value={formData.firstname}
              onChange={(e) => handleInputChange("firstname", e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Middle Name</label>
            <input
              value={formData.middlename}
              onChange={(e) => handleInputChange("middlename", e.target.value)}
            />
          </div>

          <div className="field">
            <label>Last Name *</label>
            <input
              value={formData.lastname}
              onChange={(e) => handleInputChange("lastname", e.target.value)}
              required
            />
          </div>

        </div>


        {/* CONTACT + ROLE ROW */}
        <div className="row">

          <div className="field">
            <label>Contact Number *</label>
            <input
              value={formData.contactNum}
              onChange={handleContactChange}
              onFocus={() => {
                if (formData.contactNum === "") handleInputChange("contactNum", "+63");
              }}
              required
            />
          </div>

          <div className="field">
            <label>Role *</label>
            <select
              value={formData.role}
              onChange={(e) => handleInputChange("role", e.target.value)}
              required
            >
              <option value="doctor">Doctor</option>
              <option value="desk">Desk</option>
            </select>
          </div>

        </div>


        {/* PASSWORD ROW */}
        <div className="row">
          <div className="field full">
            <label>Password *</label>

            <div className="inputWrapper">
              <BsFillShieldLockFill className="icon" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
              />
              <span onClick={() => setShowPassword(!showPassword)} className="toggleEye">
                {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
              </span>
            </div>

            {formData.password && (
              <div className="password-strength">
                <span>{passwordStrength.label}</span>
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${passwordStrength.percent}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>


        <button className="create-btn" type="submit" disabled={isLoading}>
          {isLoading ? "Registering..." : "Register"}
        </button>

      </form>
    </div>


    {/* EDIT POPUP */}
    {editing && (
      <div className="edit-popup-overlay">
        <div className="edit-popup">
          <h3>Edit User</h3>

          <label>First name</label>
          <input
            value={editForm.first_name}
            onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
          />

          <label>Middle name</label>
          <input
            value={editForm.middle_name}
            onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
          />

          <label>Last name</label>
          <input
            value={editForm.last_name}
            onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
          />

          <label>Contact</label>
          <input
            value={editForm.contact_num}
            onChange={(e) => setEditForm({ ...editForm, contact_num: e.target.value })}
          />

          <label>Role</label>
          <select
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
          >
            <option value="Doctor">Doctor</option>
            <option value="Desk">Desk</option>
          </select>

          <label>New Password</label>
          <input
            type="password"
            value={editForm.new_password}
            onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
          />

          <div className="edit-buttons">
            <button onClick={saveEdit}>Save</button>
            <button onClick={closeEdit}>Cancel</button>
          </div>
        </div>
      </div>
    )}

  </div>
);
}
