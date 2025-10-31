use rusqlite::{params, Connection};
use tauri::State;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use chrono::Utc;
use bcrypt::{hash, verify, DEFAULT_COST};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use base64::{engine::general_purpose, Engine as _};
use dotenv::dotenv;
use std::env;
use axum::{Router, routing::{get, post}, Json, extract::Path};
use serde_json::json;

const DB_PATH: &str = "./data/ravcare.db";


mod database;
use database::{init_db, init_musers_table, get_all_patients, get_archived_patients, Patient};

// ==================== APP STATE ====================

struct AppState {
    db: Mutex<Connection>,
}

// ==================== USER SYSTEM ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    id: i64,
    username: String,
    email: String,
    password_hash: String,
    is_admin: bool,
    role: String,
}

#[tauri::command]
fn register_user(
    state: State<'_, AppState>,
    username: String,
    email: String,
    password: String,
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let hashed_password = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;

    // Assign role automatically based on username pattern
    let role = if username.to_lowercase().contains("admin") {
        "admin"
    } else if username.to_lowercase().contains("doctor") {
        "doctor"
    } else if username.to_lowercase().contains("desk") {
        "desk"
    } else {
        "staff"
    };

    conn.execute(
        "INSERT INTO users (username, email, password_hash, is_admin, role)
         VALUES (?1, ?2, ?3, 0, ?4)",
        params![username, email, hashed_password, role],
    )
    .map_err(|e| e.to_string())?;

    Ok(format!("User registered successfully as {}!", role))
}

#[tauri::command]
fn login_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<serde_json::Value, String> {
    use rusqlite::OptionalExtension;

    let conn = state.db.lock().unwrap();

    // Select id, password_hash, and role
    let mut stmt = conn
        .prepare("SELECT id, password_hash, role FROM users WHERE username = ?1")
        .map_err(|e| e.to_string())?;

    let user_row: Option<(i64, String, String)> = stmt
        .query_row([&username], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some((id, stored_hash, role)) = user_row {
        // Verify password hash
        if verify(&password, &stored_hash).unwrap_or(false) {
            Ok(serde_json::json!({
                "success": true,
                "message": "Login successful",
                "id": id,
                "username": username,
                "role": role
            }))
        } else {
            Err("Invalid username or password".into())
        }
    } else {
        Err("Invalid username or password".into())
    }
}


// ==================== INVENTORY ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
struct InventoryItem {
    id: i64,
    name: String,
    amount: i64,
    last_edited: String,
}

#[tauri::command]
fn get_inventory(state: State<'_, AppState>) -> Result<Vec<InventoryItem>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, amount, last_edited FROM inventory")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(InventoryItem {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                last_edited: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(items)
}

#[tauri::command]
fn create_item(state: State<'_, AppState>, name: String, amount: i64) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let now = Utc::now().date_naive().to_string();

    conn.execute(
        "INSERT INTO inventory (name, amount, last_edited) VALUES (?1, ?2, ?3)",
        params![name, amount, now],
    )
    .map_err(|e| e.to_string())?;

    Ok("Item created successfully".into())
}

#[tauri::command]
fn edit_item(state: State<'_, AppState>, id: i64, name: String, amount: i64) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let now = Utc::now().date_naive().to_string();

    conn.execute(
        "UPDATE inventory SET name = ?1, amount = ?2, last_edited = ?3 WHERE id = ?4",
        params![name, amount, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok("Item updated successfully".into())
}

#[tauri::command]
fn delete_item(state: State<'_, AppState>, id: i64) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM inventory WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok("Item deleted successfully".into())
}

// ==================== PATIENTS ====================

#[tauri::command]
fn create_patient_cmd(patient: Patient) -> Result<serde_json::Value, String> {

    dotenv().ok();
    let secret_key = env::var("SECRET_KEY").map_err(|e| e.to_string())?;
    let conn = Connection::open(DB_PATH)
        .map_err(|e| format!("DB open failed: {}", e))?;

    // Insert patient record
    conn.execute(
        "INSERT INTO patients (
            first_name, last_name, middle_name, address, date_of_birth,
            age, gender, weight, contact_number, date_of_exposure,
            type_of_bite, site_of_bite, biting_animal, category,
            previous_anti_rabies_vaccine, prev_vacc,
            allergies, ill_oper, assessment, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
        params![
            patient.first_name,
            patient.last_name,
            patient.middle_name,
            patient.address,
            patient.date_of_birth,
            patient.age,
            patient.gender,
            patient.weight,
            patient.contact_number,
            patient.date_of_exposure,
            patient.type_of_bite,
            patient.site_of_bite,
            patient.biting_animal,
            patient.category,
            patient.previous_anti_rabies_vaccine,
            patient.prev_vacc,
            patient.allergies,
            patient.ill_oper,
            patient.assessment,
            patient.status.unwrap_or_else(|| "pending".to_string()),
        ],
    )
    .map_err(|e| format!("Create patient failed: {}", e))?;

    let patient_id = conn.last_insert_rowid();

    // ✅ Create username (first+last name)
    let username = format!(
        "{}{}",
        patient.first_name.to_lowercase(),
        patient.last_name.to_lowercase()
    );

    // ✅ Extract birth year safely
    let dob_str = patient.date_of_birth.as_deref().unwrap_or("0000-01-01");
    let birth_year = extract_birth_year(dob_str).unwrap_or("0000".to_string());

    // ✅ Auto-generate password (e.g., 1994@Doe)
    let password_plain = format!("{}@{}", birth_year, patient.last_name);

    // ✅ Encrypt and hash password
    let encrypted_password = encrypt_password(&password_plain, &secret_key)?;
    let password_hash = hash(&password_plain, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Hash failed: {}", e))?;

    // ✅ Insert into musers
    conn.execute(
        "INSERT INTO musers (patient_id, username, password_hash, encrypted_password, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            patient_id,
            username,
            password_hash,
            encrypted_password,
            Utc::now().naive_utc().to_string()
        ],
    )
    .map_err(|e| format!("Create mobile user failed: {}", e))?;

   Ok(serde_json::json!({
    "patient_id": patient_id,
    "username": username,
    "password": password_plain
}))
}



#[tauri::command]
fn get_patients_cmd() -> Result<Vec<Patient>, String> {
    get_all_patients().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_patient(state: State<'_, AppState>, id: i64) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let rows = conn.execute("DELETE FROM patients WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        Err("Patient not found".into())
    } else {
        Ok("Patient deleted successfully".into())
    }
}

#[tauri::command]
fn get_patient_with_user(id: i64) -> Result<serde_json::Value, String> {
    dotenv().ok();
    let secret_key = env::var("SECRET_KEY").map_err(|e| e.to_string())?;
    let conn = Connection::open(DB_PATH).map_err(|e| format!("DB open error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT 
            p.id, p.first_name, p.last_name, p.middle_name,
            p.age, p.gender, p.contact_number, p.address, 
            p.date_of_birth, p.weight, p.date_of_exposure,
            p.prev_vacc, p.allergies, p.ill_oper, p.assessment,
            u.username, u.encrypted_password
        FROM patients p
        LEFT JOIN musers u ON p.id = u.patient_id
        WHERE p.id = ?1"
    ).map_err(|e| format!("Prepare failed: {}", e))?;
     
    

    let result = stmt.query_row(params![id], |row| {
        let encrypted_pw: Option<String> = row.get(16).ok();
        let decrypted_pw = match encrypted_pw {
            Some(ref pw) => decrypt_password(pw, &secret_key).ok(),
            None => None,
        };

        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "first_name": row.get::<_, String>(1)?,
            "last_name": row.get::<_, String>(2)?,
            "middle_name": row.get::<_, Option<String>>(3).ok(),
            "age": row.get::<_, Option<i32>>(4).ok(),
            "gender": row.get::<_, Option<String>>(5).ok(),
            "contact_number": row.get::<_, Option<String>>(6).ok(),
            "address": row.get::<_, Option<String>>(7).ok(),
            "date_of_birth": row.get::<_, Option<String>>(8).ok(),
            "weight": row.get::<_, Option<f32>>(9).ok(),
            "date_of_exposure": row.get::<_, Option<String>>(10).ok(),
            "prev_vacc": row.get::<_, Option<String>>(11).ok(),
            "allergies": row.get::<_, Option<String>>(12).ok(),
            "ill_oper": row.get::<_, Option<String>>(13).ok(),
            "assessment": row.get::<_, Option<String>>(14).ok(),
            "username": row.get::<_, Option<String>>(15).ok(),
            "password": decrypted_pw
        }))
    });

    match result {
        Ok(patient) => Ok(patient),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err("Patient not found".into()),
        Err(e) => Err(format!("Query failed: {}", e)),
    }
}

// ==================== PATIENT ARCHIVE ====================
#[tauri::command]
fn archive_patient(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute("UPDATE patients SET archived = 1 WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn restore_patient(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute("UPDATE patients SET archived = 0 WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_archived_patients_cmd() -> Result<Vec<Patient>, String> {
    database::get_archived_patients().map_err(|e| e.to_string())
}


// ==================== APPOINTMENTS ====================


#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct Appointment {
    pub id: Option<i32>,
    pub patient_id: i32,
    pub schedule: String,
    pub type_of_bite: Option<String>,
    pub site_of_bite: Option<String>,
    pub biting_animal: Option<String>,
    pub category: Option<String>,
    pub previous_vaccine: Option<String>,
    pub prophylaxis_type: Option<String>,
    pub tetanus_toxoid: Option<bool>,
    pub day_zero_date: Option<String>,
    pub day_three_date: Option<String>,
    pub day_seven_date: Option<String>,
    pub day_fourteen_date: Option<String>,
    pub day_thirty_date: Option<String>,
    pub status: Option<String>,
}

fn init_appointments_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            schedule TEXT NOT NULL,
            type_of_bite TEXT,
            site_of_bite TEXT,
            biting_animal TEXT,
            category TEXT,
            previous_vaccine TEXT,
            prophylaxis_type TEXT,
            tetanus_toxoid BOOLEAN,
            day_zero_date TEXT,
            day_three_date TEXT,
            day_seven_date TEXT,
            day_fourteen_date TEXT,
            day_thirty_date TEXT,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

#[tauri::command]
fn get_appointments(state: State<'_, AppState>, patient_id: i32) -> Result<Vec<Appointment>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, patient_id, schedule, type_of_bite, site_of_bite, biting_animal,
                category, previous_vaccine, day_zero_date, day_three_date,
                day_seven_date, day_fourteen_date, day_thirty_date,
                prophylaxis_type, tetanus_toxoid, status
         FROM appointments
         WHERE patient_id = ?1
         ORDER BY schedule ASC"
    ).map_err(|e| e.to_string())?;

    let appointments = stmt
        .query_map([patient_id], |row| {
            Ok(Appointment {
                id: Some(row.get(0)?),
                patient_id: row.get(1)?,
                schedule: row.get(2)?,
                type_of_bite: row.get(3).ok(),
                site_of_bite: row.get(4).ok(),
                biting_animal: row.get(5).ok(),
                category: row.get(6).ok(),
                previous_vaccine: row.get(7).ok(),
                day_zero_date: row.get(8).ok(),
                day_three_date: row.get(9).ok(),
                day_seven_date: row.get(10).ok(),
                day_fourteen_date: row.get(11).ok(),
                day_thirty_date: row.get(12).ok(),
                prophylaxis_type: row.get(13).ok(),
                tetanus_toxoid: row.get(14).ok(),
                status: row.get(15).ok(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(appointments)
}

#[tauri::command]
fn create_appointment(state: State<'_, AppState>, appointment: Appointment) -> Result<String, String> {
    let conn = state.db.lock().unwrap();

  conn.execute(
    "INSERT INTO appointments (
        patient_id, schedule, type_of_bite, site_of_bite, biting_animal,
        category, previous_vaccine, prophylaxis_type, tetanus_toxoid,
        day_zero_date, day_three_date, day_seven_date, day_fourteen_date, day_thirty_date,  status
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
    params![
        appointment.patient_id,
        appointment.schedule,
        appointment.type_of_bite,
        appointment.site_of_bite,
        appointment.biting_animal,
        appointment.category,
        appointment.previous_vaccine,
        appointment.prophylaxis_type,
        appointment.tetanus_toxoid,
        appointment.day_zero_date,       // ✅ correct field names
        appointment.day_three_date,      // ✅ correct field names
        appointment.day_seven_date,      // ✅ correct field names
        appointment.day_fourteen_date,   // ✅ correct field names
        appointment.day_thirty_date,  
        appointment.status.unwrap_or_else(|| "pending".to_string()),
    
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok("Appointment created successfully".into())
}

#[tauri::command]
fn update_appointment(state: State<'_, AppState>, appointment: Appointment) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let id = appointment.id.ok_or("Appointment ID required")?;

    conn.execute(
        "UPDATE appointments
         SET schedule = ?1,
             type_of_bite = ?2,
             site_of_bite = ?3,
             biting_animal = ?4,
             category = ?5,
             previous_vaccine = ?6,
             prophylaxis_type = ?7,
             tetanus_toxoid = ?8,
             day_zero_date = ?9,
             day_three_date = ?10,
             day_seven_date = ?11,
             day_fourteen_date = ?12,
             day_thirty_date = ?13,
             status = ?14
         WHERE id = ",
        params![
            appointment.schedule,
            appointment.type_of_bite,
            appointment.site_of_bite,
            appointment.biting_animal,
            appointment.category,
            appointment.previous_vaccine,
            appointment.prophylaxis_type,
            appointment.tetanus_toxoid,
            appointment.day_zero_date,       // ✅ correct field names
        appointment.day_three_date,      // ✅ correct field names
        appointment.day_seven_date,      // ✅ correct field names
        appointment.day_fourteen_date,   // ✅ correct field names
        appointment.day_thirty_date,  
        appointment.status.unwrap_or_else(|| "pending".to_string()),
            id // ✅ use `id`, not `appointment.id`
        ],
    )
    .map_err(|e| e.to_string())?; // ✅ properly chained, no trailing comma

    Ok("Appointment updated successfully".into())
}

#[tauri::command]
fn update_appointment_status(
    state: State<'_, AppState>,
    id: i32,
    status: String,
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();

    conn.execute(
        "UPDATE appointments SET status = ?1 WHERE id = ?2",
        params![status, id],
    )
    .map_err(|e| e.to_string())?;

    Ok("Appointment status updated successfully".into())
}

// ==================== PATIENT MEDICAL UPDATE ====================

#[tauri::command]
fn update_patient_medical(
    state: State<'_, AppState>,
    id: i32,
    date_of_exposure: String,
    prev_vacc: String,
    allergies: String,
    ill_oper: String,
    assessment: String,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    conn.execute(
        "UPDATE patients SET 
            date_of_exposure = ?, 
            prev_vacc = ?, 
            allergies = ?, 
            ill_oper = ?, 
            assessment = ? 
         WHERE id = ?",
        params![
            date_of_exposure,
            prev_vacc,
            allergies,
            ill_oper,
            assessment,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== MOBILE USER PASSWORD ====================
#[tauri::command]
fn update_muser_password(
    state: State<'_, AppState>,
    patient_id: i64,
    new_password: String,
) -> Result<String, String> {
    dotenv().ok();
    let secret_key = env::var("SECRET_KEY").map_err(|e| e.to_string())?;

    // Encrypt plaintext password for admin viewing
    let encrypted_password = encrypt_password(&new_password, &secret_key)?;

    // Hash for authentication security
    let hashed = hash(&new_password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

    let conn = state.db.lock().unwrap();
    let rows = conn.execute(
        "UPDATE musers SET password_hash = ?1, encrypted_password = ?2 WHERE patient_id = ?3",
        params![hashed, encrypted_password, patient_id],
    ).map_err(|e| e.to_string())?;

    if rows == 0 {
        Err("No mobile user found for this patient".into())
    } else {
        Ok("Password updated successfully".into())
    }
}
// ==================== ENCRYPTION HELPERS ====================

fn encrypt_password(plain: &str, key: &str) -> Result<String, String> {
    let key = Key::<Aes256Gcm>::from_slice(key.as_bytes());
    let cipher = Aes256Gcm::new(key);

    // 96-bit nonce (12 bytes) — use a constant or random per record
    let nonce = Nonce::from_slice(b"unique_nonce"); // 12 bytes ✅
 

    let ciphertext = cipher.encrypt(nonce, plain.as_bytes())
        .map_err(|e| e.to_string())?;

    // Store base64(nonce + ciphertext)
     Ok(general_purpose::STANDARD.encode(ciphertext))
}

fn decrypt_password(encrypted_b64: &str, key: &str) -> Result<String, String> {
    let key = Key::<Aes256Gcm>::from_slice(key.as_bytes());
    let cipher = Aes256Gcm::new(key);
   let nonce = aes_gcm::Nonce::from_slice(b"unique_nonce"); // same 12 bytes used for encryption

    let encrypted_bytes = general_purpose::STANDARD
        .decode(encrypted_b64)
        .map_err(|e| e.to_string())?;

    let decrypted = cipher
        .decrypt(nonce, encrypted_bytes.as_ref())
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8(decrypted).map_err(|e| e.to_string())?)
}

    
fn extract_birth_year(dob: &str) -> Option<String> {
    if dob.contains('-') {
        // Format: YYYY-MM-DD
        dob.split('-').next().map(|y| y.to_string())
    } else if dob.contains('/') {
        // Format: MM/DD/YYYY
        dob.split('/').last().map(|y| y.to_string())
    } else {
        None
    }
}

#[tauri::command]
fn create_window(app: tauri::AppHandle) {
  let webview_window = tauri::WebviewWindowBuilder::new(&app, "queueWindow", tauri::WebviewUrl::App("queue.html".into()))
    .build()
    .unwrap();
}

// ==================== MAIN ====================
#[tokio::main]
async fn main() {
    dotenv().ok(); // load .env
    let secret_key = env::var("SECRET_KEY").expect("SECRET_KEY must be set in .env");
    println!("Loaded key: {}", secret_key);

    init_db().expect("Failed to initialize database");

    let conn = Connection::open(DB_PATH).expect("Failed to connect to database");
    conn.execute("PRAGMA foreign_keys = ON;", []).expect("Failed to enable foreign keys");
    init_appointments_table(&conn).expect("Failed to initialize appointments table");
    init_musers_table(&conn).expect("Failed to initialize mobile users table");

    let app_state = AppState {
        db: Mutex::new(conn),
    };

    // 🧠 spawn the API server *before* Tauri runs
    tokio::spawn(async {
        use axum::{Router, routing::{get, post}, extract::{Path, Json}};
        use serde_json::json;
        use tokio::net::TcpListener;
        use axum::serve;

        let app = Router::new()
            .route("/api/login", post(api_login))
            .route("/api/patient/:id", get(api_get_patient))
            .route("/api/appointments/:patient_id", get(api_get_appointments));

        let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();
        println!("✅ API server running at http://0.0.0.0:8080");

        serve(listener, app).await.unwrap();
    });


    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            register_user,
            login_user,
            create_patient_cmd,
            get_patients_cmd,
            delete_patient,
            get_inventory,
            create_item,
            edit_item,
            delete_item,
            get_patient_with_user,
            get_appointments,
            create_appointment,
            update_appointment,
            update_appointment_status,
            update_patient_medical,
            update_muser_password,
            archive_patient,             
            restore_patient,             
            get_archived_patients_cmd,
            create_window 
        ])
        .run(tauri::generate_context!())
        .expect("Error running Tauri app");

        }
// ---------- endpoints -----------


async fn api_login(Json(body): Json<serde_json::Value>) -> Json<serde_json::Value> {
    let username = body["username"].as_str().unwrap_or("");
    let password = body["password"].as_str().unwrap_or("");

    let conn = Connection::open(DB_PATH).unwrap();
    let mut stmt = conn.prepare("SELECT password_hash, patient_id FROM musers WHERE username = ?1").unwrap();
    let mut rows = stmt.query(params![username]).unwrap();

    if let Some(row) = rows.next().unwrap() {
        let hash: String = row.get(0).unwrap();
        let pid: i64 = row.get(1).unwrap();
        if bcrypt::verify(password, &hash).unwrap_or(false) {
            return Json(json!({ "success": true, "patient_id": pid }));
        }
    }
    Json(json!({ "success": false, "error": "Invalid credentials" }))
}

async fn api_get_patient(Path(id): Path<i64>) -> Json<serde_json::Value> {
    match get_patient_with_user(id) {
        Ok(p) => Json(p),
        Err(e) => Json(json!({ "error": e })),
    }
}

async fn api_get_appointments(Path(pid): Path<i64>) -> Json<serde_json::Value> {
    match get_appointments_impl(pid) {
        Ok(list) => Json(json!({ "appointments": list })),
        Err(e) => Json(json!({ "error": e })),
    }
}

// helper to reuse your existing get_appointments logic
fn get_appointments_impl(pid: i64) -> Result<Vec<Appointment>, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, patient_id, schedule, type_of_bite, site_of_bite, biting_animal,
                category, previous_vaccine, day_zero_date, day_three_date,
                day_seven_date, day_fourteen_date, day_thirty_date,
                prophylaxis_type, tetanus_toxoid, status
         FROM appointments
         WHERE patient_id = ?1
         ORDER BY schedule ASC"
    ).map_err(|e| e.to_string())?;

    let appointments = stmt
        .query_map(params![pid], |row| {
            Ok(Appointment {
                id: Some(row.get(0)?),
                patient_id: row.get(1)?,
                schedule: row.get(2)?,
                type_of_bite: row.get(3).ok(),
                site_of_bite: row.get(4).ok(),
                biting_animal: row.get(5).ok(),
                category: row.get(6).ok(),
                previous_vaccine: row.get(7).ok(),
                day_zero_date: row.get(8).ok(),
                day_three_date: row.get(9).ok(),
                day_seven_date: row.get(10).ok(),
                day_fourteen_date: row.get(11).ok(),
                day_thirty_date: row.get(12).ok(),
                prophylaxis_type: row.get(13).ok(),
                tetanus_toxoid: row.get(14).ok(),
                status: row.get(15).ok(), 
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        Ok(appointments)
    }



    

