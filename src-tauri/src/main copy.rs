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
use tauri_plugin_printer_v2::init as printer_init;

use serde_json::json;
use reqwest::Client;
mod database; 



pub const DB_PATH: &str = r".\data\ravcare.db";

use crate::database::{
    delete_user, toggle_user_status, reactivate_user, get_unverified_users_db,
    approve_user, deny_user, update_user_db,  }; //added code here 

use database::{init_db, init_musers_table, get_all_patients, get_archived_patients, Patient};


// ==================== APP STATE ====================

struct AppState {
    db: Mutex<Connection>,
}
// ==================== Queue ====================
struct QueueState {
    serving: Mutex<u32>,
    next: Mutex<u32>,
}
#[tauri::command]
fn get_queue(state: State<'_, QueueState>) -> (u32, u32) {
    let serving = state.serving.lock().unwrap();
    let next = state.next.lock().unwrap();
    (*serving, *next)
}

#[tauri::command]
fn increment_queue(state: State<'_, QueueState>) -> (u32, u32) {
    let mut serving = state.serving.lock().unwrap();
    let mut next = state.next.lock().unwrap();

    *serving = *next;
    *next += 1;

    (*serving, *next)
}

#[tauri::command]
fn clear_queue(state: State<'_, QueueState>) -> (u32, u32) {
    let mut serving = state.serving.lock().unwrap();
    let mut next = state.next.lock().unwrap();

    *serving = 1;
    *next = 2;

    (*serving, *next)
}

// ==================== USER SYSTEM ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    id: i64,
    username: String,
    password_hash: String,
    is_admin: bool,
    role: String,
}
#[derive(Debug, serde::Deserialize)]
struct RegisterPayload{
    firstname: String,
    middlename: Option<String>,
    lastname: String,
    contact_num: String,
    password: String,
    role: String,
}


#[tauri::command]
async fn register_user(
    state: State<'_, AppState>,
    payload: RegisterPayload,
) -> Result<String, String> {
    println!("🟢 register_user called with {:?}", payload);

    let conn = state.db.lock().unwrap();

    let username = format!(
        "{}{}{}",
        payload.firstname.to_lowercase(),
        payload.lastname.to_lowercase(),
        payload.role.to_lowercase()
    );

    let hash = bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST)
        .map_err(|e| e.to_string())?;

    let role = payload.role.to_lowercase();
    let is_admin = if role == "admin" { 1 } else { 0 };
    let is_active = 1;

    println!("🟣 Inserting user: {}", username);

    if let Err(e) = conn.execute(
        "INSERT INTO users
           (firstname, middlename, lastname, contactnum, password_hash, role, is_active, is_admin, username)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            payload.firstname,
            payload.middlename,
            payload.lastname,
            payload.contact_num,
            hash,
            role,
            is_active,
            is_admin,
            username,
        ],
    ) {
        eprintln!("❌ DB insert failed: {}", e);
        return Err(format!("Database error: {}", e));
    }

    println!("✅ User '{}' registered successfully.", username);
    Ok(username)
}

#[tauri::command]
fn login_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<serde_json::Value, String> {
    use rusqlite::OptionalExtension;

    let conn = state.db.lock().unwrap();

    // Select id, password_hash, role, and is_active
    let mut stmt = conn
        .prepare("SELECT id, password_hash, role, is_active FROM users WHERE username = ?1")
        .map_err(|e| e.to_string())?;

    let user_row: Option<(i64, String, String, i32)> = stmt
        .query_row([&username], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some((id, stored_hash, role, is_active)) = user_row {
        // Check if account is active
        if is_active == 0 {
            return Err("Account is deactivated. Please contact an admin.".into());
        }

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
    id: String,       // vaxirab, pcv13, etc.
    name: String,     // Vaxirab N
    amount: f64,      // allows decimals for ID doses
    last_edited: String,
}

#[tauri::command]
fn get_inventory(state: State<'_, AppState>) -> Result<Vec<InventoryItem>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT id, name, amount, last_edited FROM inventory ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(InventoryItem {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                last_edited: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(items)
}

#[tauri::command]
fn create_item(
    state: State<'_, AppState>,
    id: String,
    name: String,
    amount: f64
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();

    conn.execute(
        "INSERT INTO inventory (id, name, amount, last_edited)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![id, name, amount],
    )
    .map_err(|e| e.to_string())?;

    Ok("Item created".into())
}

#[tauri::command]
fn change_inventory_amount(
    state: State<'_, AppState>,
    id: String,
    delta: f64
) -> Result<InventoryItem, String> {

    let mut conn = state.db.lock().unwrap();   // MUST BE MUT

    // atomic transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE inventory
         SET amount = amount + ?, last_edited = datetime('now')
         WHERE id = ?",
        params![delta, id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    // fetch updated row
    let mut stmt = conn
        .prepare("SELECT id, name, amount, last_edited FROM inventory WHERE id = ?")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(InventoryItem {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                last_edited: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(r) = rows.next() {
        return r.map_err(|e| e.to_string());
    }

    Err("Updated item not found".into())
}

#[tauri::command]
fn delete_item(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let conn = state.db.lock().unwrap();

    conn.execute("DELETE FROM inventory WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok("Item deleted".into())
}

// ==================== INVENTORY LOG ====================
#[derive(Debug, Serialize, Deserialize, Clone)]
struct InventoryLog {
    id: i64,
    timestamp: String,
    action: String,
    vaccine: String,
    amount: f64,
    user: String,
}

#[tauri::command]
fn get_inventory_logs(state: State<'_, AppState>) -> Result<Vec<InventoryLog>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT id, timestamp, action, vaccine, amount, user FROM inventory_logs ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(InventoryLog {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            action: row.get(2)?,
            vaccine: row.get(3)?,
            amount: row.get(4)?,
            user: row.get(5)?,
        })
    })
    .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for row in rows {
        logs.push(row.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

#[tauri::command]
fn add_inventory_log(
    state: State<'_, AppState>,
    action: String,
    vaccine: String,
    amount: f64,
    user: String
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();

    conn.execute(
        "INSERT INTO inventory_logs (timestamp, action, vaccine, amount, user)
         VALUES (datetime('now','localtime'), ?, ?, ?, ?)",
        params![action, vaccine, amount, user],
    )
    .map_err(|e| e.to_string())?;

    Ok("Log added".into())
}




// ==================== PATIENTS ====================
#[tauri::command]
fn create_patient_cmd(patient: Patient) -> Result<serde_json::Value, String> {

    dotenv().ok();
    let secret_key = env::var("SECRET_KEY").map_err(|e| e.to_string())?;
    let conn = Connection::open(DB_PATH)
        .map_err(|e| format!("DB open failed: {}", e))?;
conn.execute(
    "INSERT INTO patients (
        first_name, last_name, middle_name, address, date_of_birth,
        age, gender, weight, contact_number,
        type_of_bite, site_of_bite, biting_animal, category,
        previous_anti_rabies_vaccine, prev_vacc,
        allergies, ill_oper, assessment
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
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
        patient.type_of_bite,
        patient.site_of_bite,
        patient.biting_animal,
        patient.category,
        patient.previous_anti_rabies_vaccine,
        patient.prev_vacc,
        patient.allergies,
        patient.ill_oper,
        patient.assessment,
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

    
let username_clone = username.clone();
tokio::spawn(async move {
    if let Err(e) = insert_user_to_supabase(&username_clone, &password_hash, patient_id).await {
        eprintln!("❌ Failed to sync user to Supabase: {}", e);
    } else {
        println!("✅ User synced to Supabase: {}", username_clone);
    }
});

   Ok(serde_json::json!({
    "patient_id": patient_id,
    "username": username,
    "password": password_plain
}))
}

pub async fn sync_all_musers_to_supabase() -> Result<String, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT username, password_hash, patient_id FROM musers")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut success = 0;
    let mut failed = 0;

    for (username, password_hash, patient_id) in rows {
        if insert_user_to_supabase(&username, &password_hash, patient_id).await.is_ok() {
            success += 1;
        } else {
            failed += 1;
        }
    }

    Ok(format!("✅ Synced {} users, ❌ failed {}", success, failed))
}








// added this code for supabase, shdawhaa
async fn insert_user_to_supabase(
    username: &str,
    password_hash: &str,
    patient_id: i64,
) -> Result<(), String> {
    let client = Client::new();
    let supabase_url = "https://ddfzwwaldprstwgjbuvp.supabase.co";
    let supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZnp3d2FsZHByc3R3Z2pidXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzMwNzAsImV4cCI6MjA3ODgwOTA3MH0.My0LeEJ1LS96YYNA4YlmpoSwIGEyYWjq-tyCtt2IJKI";

    let body = json!({
        "username": username,
        "password_hash": password_hash,
        "patient_id": patient_id
    });

    println!("📤 Sending to Supabase: {}", body);

    let res = client
        .post(format!("{}/rest/v1/muser", supabase_url))
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Supabase request failed: {}", e))?;

    println!("📥 Supabase response status: {}", res.status());

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        eprintln!("❌ Supabase error: {}", text);
        return Err(format!("Supabase error: {}", text));
    }

    println!("✅ Inserted into Supabase: {}", username);
    Ok(())
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
    p.date_of_birth, p.weight,
    p.prev_vacc, p.allergies, p.ill_oper, p.assessment,
    u.username, u.encrypted_password
    FROM patients p
    LEFT JOIN musers u ON p.id = u.patient_id
    WHERE p.id = ?1"
    ).map_err(|e| format!("Prepare failed: {}", e))?;

        let result = stmt.query_row(params![id], |row| {
    let encrypted_pw: Option<String> = row.get(15).ok();

    let decrypted_pw = match &encrypted_pw {
        Some(pw) => decrypt_password(pw, &secret_key).ok(),
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
            "prev_vacc": row.get::<_, Option<String>>(10).ok(),
            "allergies": row.get::<_, Option<String>>(11).ok(),
            "ill_oper": row.get::<_, Option<String>>(12).ok(),
            "assessment": row.get::<_, Option<String>>(13).ok(),
            "username": row.get::<_, Option<String>>(14).ok(),
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
      // Regular vaccines
    pub regular_type: Option<String>,
    pub regular_date: Option<String>,
    pub regular_route: Option<String>,
    pub vaccine_name: Option<String>,
    pub pneumonia_type: Option<String>,
    pub injection_site: Option<String>,

    // Hepa B doses
    pub hepa_b_dose1: Option<String>,
    pub hepa_b_dose2: Option<String>,
    pub hepa_b_dose3: Option<String>,
    pub regular_status: Option<String>,
    
    //Statuses
    pub hepa_b_status1: Option<String>,
    pub hepa_b_status2: Option<String>,
    pub hepa_b_status3: Option<String>,

    pub regular_given_date: Option<String>,

    // Hepa B given dates
    pub hepa_b_given1: Option<String>,
    pub hepa_b_given2: Option<String>,
    pub hepa_b_given3: Option<String>,

    pub schedule: String,
    pub date_of_exposure: Option<String>,
    pub type_of_bite: Option<String>,
    pub site_of_bite: Option<String>,
    pub biting_animal: Option<String>,
    pub category: Option<String>,
    pub previous_vaccine: Option<String>,
    pub prophylaxis_type: Option<String>,
    pub vaccroute: Option<String>,
    pub tetanus_toxoid: Option<bool>,
    pub tetanus_route: Option<String>,
    pub tetanus_date: Option<String>,
    pub rig: Option<bool>,
    pub rig_date: Option<String>,
    pub day_zero_date: Option<String>,
    pub day_three_date: Option<String>,
    pub day_seven_date: Option<String>,
    pub day_fourteen_date: Option<String>,
    pub day_thirty_date: Option<String>,
    pub day_zero_given_date: Option<String>,
    pub day_three_given_date: Option<String>,
    pub day_seven_given_date: Option<String>,
    pub day_fourteen_given_date: Option<String>,
    pub day_thirty_given_date: Option<String>,
    pub status: Option<String>,
    pub schedule_status: Option<String>,
    pub day_zero_status: Option<String>,        // ✅ Added
    pub day_three_status: Option<String>,
    pub day_seven_status: Option<String>,
    pub day_fourteen_status: Option<String>,
    pub day_thirty_status: Option<String>,
}

fn init_appointments_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,

            regular_type TEXT,
            regular_date TEXT,
            regular_route TEXT,
            vaccine_name TEXT,
            pneumonia_type TEXT,
            injection_site TEXT,

            hepa_b_dose1 TEXT,
            hepa_b_dose2 TEXT,
            hepa_b_dose3 TEXT,

            regular_status TEXT,
            hepa_b_status1 TEXT,
            hepa_b_status2 TEXT,
            hepa_b_status3 TEXT,
            
            regular_given_date TEXT,
            hepa_b_given1 TEXT,
            hepa_b_given2 TEXT,
            hepa_b_given3 TEXT,

            schedule TEXT NOT NULL,
            date_of_exposure TEXT,  
            type_of_bite TEXT,
            site_of_bite TEXT,
            biting_animal TEXT,
            category TEXT,
            previous_vaccine TEXT,
            prophylaxis_type TEXT,
            vaccroute TEXT, 
            tetanus_toxoid BOOLEAN,
            tetanus_route TEXT,
            tetanus_date TEXT,
            rig BOOLEAN DEFAULT 0,
            rig_date TEXT,
            day_zero_date TEXT,
            day_three_date TEXT,
            day_seven_date TEXT,
            day_fourteen_date TEXT,
            day_thirty_date TEXT,
            day_zero_given_date TEXT,
            day_three_given_date TEXT,
            day_seven_given_date TEXT,
            day_fourteen_given_date TEXT,
            day_thirty_given_date TEXT,
            schedule_status TEXT DEFAULT 'Pending',
            day_zero_status TEXT DEFAULT 'Pending',        -- ✅ Added
            day_three_status TEXT DEFAULT 'Pending',
            day_seven_status TEXT DEFAULT 'Pending',
            day_fourteen_status TEXT DEFAULT 'Pending',
            day_thirty_status TEXT DEFAULT 'Pending',
            status TEXT DEFAULT 'Pending',
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
        "SELECT 
    id, patient_id,

    regular_type, regular_date, regular_route, vaccine_name, pneumonia_type, injection_site,

    hepa_b_dose1, hepa_b_dose2, hepa_b_dose3,

    regular_status, hepa_b_status1, hepa_b_status2, hepa_b_status3,

    regular_given_date, hepa_b_given1, hepa_b_given2, hepa_b_given3,

    schedule, date_of_exposure, type_of_bite, site_of_bite, biting_animal,
    category, previous_vaccine, prophylaxis_type, vaccroute, tetanus_toxoid,
    tetanus_route, tetanus_date, rig, rig_date,

    day_zero_date, day_three_date, day_seven_date,
    day_fourteen_date, day_thirty_date,

    day_zero_given_date, day_three_given_date, day_seven_given_date,
    day_fourteen_given_date, day_thirty_given_date,
    schedule_status, day_zero_status, day_three_status,
    day_seven_status, day_fourteen_status, day_thirty_status, status
FROM appointments
WHERE patient_id = ?1
ORDER BY schedule ASC"
    ).map_err(|e| e.to_string())?;

    let appointments = stmt
        .query_map([patient_id], |row| {
          Ok(Appointment {
    id: Some(row.get(0)?),
    patient_id: row.get(1)?,

    regular_type: row.get(2).ok(),
    regular_date: row.get(3).ok(),
    regular_route: row.get(4).ok(),
    vaccine_name: row.get(5).ok(),
    pneumonia_type: row.get(6).ok(),
    injection_site: row.get(7).ok(),

    hepa_b_dose1: row.get(8).ok(),
    hepa_b_dose2: row.get(9).ok(),
    hepa_b_dose3: row.get(10).ok(),

    regular_status: row.get(11).ok(),
    hepa_b_status1: row.get(12).ok(),
    hepa_b_status2: row.get(13).ok(),
    hepa_b_status3: row.get(14).ok(),

    regular_given_date: row.get(15).ok(),
    hepa_b_given1: row.get(16).ok(),
    hepa_b_given2: row.get(17).ok(),
    hepa_b_given3: row.get(18).ok(),

    schedule: row.get(19)?,

    date_of_exposure: row.get(20).ok(),
    type_of_bite: row.get(21).ok(),
    site_of_bite: row.get(22).ok(),
    biting_animal: row.get(23).ok(),
    category: row.get(24).ok(),
    previous_vaccine: row.get(25).ok(),
    prophylaxis_type: row.get(26).ok(),
    vaccroute: row.get(27).ok(),

    tetanus_toxoid: row.get(28).ok(),
    tetanus_route: row.get(29).ok(),
    tetanus_date: row.get(30).ok(),

    rig: match row.get::<_, Option<i64>>(31)? {
        Some(1) => Some(true),
        Some(0) => Some(false),
        _ => Some(false),
    },
    rig_date: row.get(32).ok(),

    day_zero_date: row.get(33).ok(),
    day_three_date: row.get(34).ok(),
    day_seven_date: row.get(35).ok(),
    day_fourteen_date: row.get(36).ok(),
    day_thirty_date: row.get(37).ok(),

    day_zero_given_date: row.get(38).ok(),
    day_three_given_date: row.get(39).ok(),
    day_seven_given_date: row.get(40).ok(),
    day_fourteen_given_date: row.get(41).ok(),
    day_thirty_given_date: row.get(42).ok(),

    schedule_status: row.get(43).ok(),
    day_zero_status: row.get(44).ok(),
    day_three_status: row.get(45).ok(),
    day_seven_status: row.get(46).ok(),
    day_fourteen_status: row.get(47).ok(),
    day_thirty_status: row.get(48).ok(),
    status: row.get(49).ok(),
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
            patient_id,
            regular_type, regular_date, regular_route, vaccine_name, pneumonia_type, injection_site, hepa_b_dose1, hepa_b_dose2, hepa_b_dose3,
           regular_status, hepa_b_status1, hepa_b_status2,
            hepa_b_status3, regular_given_date, hepa_b_given1, hepa_b_given2, hepa_b_given3, schedule, date_of_exposure, type_of_bite, site_of_bite, biting_animal,
            category, previous_vaccine, prophylaxis_type, vaccroute,
            tetanus_toxoid, tetanus_route, tetanus_date,
            rig, rig_date, day_zero_date, day_three_date, day_seven_date,
            day_fourteen_date, day_thirty_date,
            day_zero_given_date, day_three_given_date, day_seven_given_date,
            day_fourteen_given_date, day_thirty_given_date,
            status, schedule_status,
            day_zero_status, day_three_status, day_seven_status,
            day_fourteen_status, day_thirty_status
         ) VALUES (
            ?1,  ?2,  ?3,  ?4,  ?5,  ?6, ?7,  ?8,  ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
            ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33,
            ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44, ?45, ?46, ?47, ?48, ?49
         )",
        params![
            appointment.patient_id,
            appointment.regular_type,
            appointment.regular_date,
            appointment.regular_route,
            appointment.vaccine_name,
            appointment.pneumonia_type,
            appointment.injection_site,

            appointment.hepa_b_dose1,
            appointment.hepa_b_dose2,
            appointment.hepa_b_dose3,
            
            appointment.regular_status,     // ⭐ no default
            appointment.hepa_b_status1,     // ⭐ no default
            appointment.hepa_b_status2,     // ⭐ no default
            appointment.hepa_b_status3, 
            
            appointment.regular_given_date,
            appointment.hepa_b_given1,
            appointment.hepa_b_given2,
            appointment.hepa_b_given3,

            appointment.schedule,

            appointment.date_of_exposure,
            appointment.type_of_bite,
            appointment.site_of_bite,
            appointment.biting_animal,

            appointment.category,
            appointment.previous_vaccine,
            appointment.prophylaxis_type,
            appointment.vaccroute,

            appointment.tetanus_toxoid,
            appointment.tetanus_route,
            appointment.tetanus_date,

            appointment.rig.unwrap_or(false),
            appointment.rig_date,

            appointment.day_zero_date,
            appointment.day_three_date,
            appointment.day_seven_date,
            appointment.day_fourteen_date,
            appointment.day_thirty_date,

            appointment.day_zero_given_date,
            appointment.day_three_given_date,
            appointment.day_seven_given_date,
            appointment.day_fourteen_given_date,
            appointment.day_thirty_given_date,

            appointment.status.unwrap_or("Pending".into()),
            appointment.schedule_status.unwrap_or("Pending".into()),

            appointment.day_zero_status.unwrap_or("Pending".into()),
            appointment.day_three_status.unwrap_or("Pending".into()),
            appointment.day_seven_status.unwrap_or("Pending".into()),
            appointment.day_fourteen_status.unwrap_or("Pending".into()),
            appointment.day_thirty_status.unwrap_or("Pending".into()),
           
            
            
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
        "UPDATE appointments SET
            regular_type = ?1,
            regular_date = ?2,
            regular_route = ?3,
            vaccine_name = ?4,
            pneumonia_type = ?5,
            injection_site =?6,

            hepa_b_dose1 = ?7,
            hepa_b_dose2 = ?8,
            hepa_b_dose3 = ?9,

            schedule = ?10,

            date_of_exposure = ?11,
            type_of_bite = ?12,
            site_of_bite = ?13,
            biting_animal = ?14,

            category = ?15,
            previous_vaccine = ?16,
            prophylaxis_type = ?17,
            vaccroute = ?18,

            tetanus_toxoid = ?19,
            tetanus_route = ?20,
            tetanus_date = ?21,

            rig = ?22,
            rig_date = ?23,

            day_zero_date = ?24,
            day_three_date = ?25,
            day_seven_date = ?26,
            day_fourteen_date = ?27,
            day_thirty_date = ?28,

            day_zero_given_date = ?29,
            day_three_given_date = ?30,
            day_seven_given_date = ?31,
            day_fourteen_given_date = ?32,
            day_thirty_given_date = ?33,

            status = ?34,
            schedule_status = ?35,

            day_zero_status = ?36,
            day_three_status = ?37,
            day_seven_status = ?38,
            day_fourteen_status = ?39,
            day_thirty_status = ?40,

            regular_status = ?41,
            hepa_b_status1 = ?42,
            hepa_b_status2 = ?43,
            hepa_b_status3 = ?44,
            regular_given_date = ?45,
            hepa_b_given1 = ?46,
            hepa_b_given2 = ?47,
            hepa_b_given3 = ?48


        WHERE id = ?49",
        params![
            appointment.regular_type,
            appointment.regular_date,
            appointment.regular_route,
            appointment.vaccine_name,
            appointment.pneumonia_type,
            appointment.injection_site,

            appointment.hepa_b_dose1,
            appointment.hepa_b_dose2,
            appointment.hepa_b_dose3,

            appointment.schedule,

            appointment.date_of_exposure,
            appointment.type_of_bite,
            appointment.site_of_bite,
            appointment.biting_animal,

            appointment.category,
            appointment.previous_vaccine,
            appointment.prophylaxis_type,
            appointment.vaccroute,

            appointment.tetanus_toxoid,
            appointment.tetanus_route,
            appointment.tetanus_date,

            appointment.rig.unwrap_or(false),
            appointment.rig_date,

            appointment.day_zero_date,
            appointment.day_three_date,
            appointment.day_seven_date,
            appointment.day_fourteen_date,
            appointment.day_thirty_date,

            appointment.day_zero_given_date,
            appointment.day_three_given_date,
            appointment.day_seven_given_date,
            appointment.day_fourteen_given_date,
            appointment.day_thirty_given_date,

            appointment.status.clone().unwrap_or("Pending".into()),
            appointment.schedule_status.clone().unwrap_or("Pending".into()),

            appointment.day_zero_status.clone().unwrap_or("Pending".into()),
            appointment.day_three_status.clone().unwrap_or("Pending".into()),
            appointment.day_seven_status.clone().unwrap_or("Pending".into()),
            appointment.day_fourteen_status.clone().unwrap_or("Pending".into()),
            appointment.day_thirty_status.clone().unwrap_or("Pending".into()),

            
            appointment.regular_status,     // ⭐ no default
            appointment.hepa_b_status1,     // ⭐ no default
            appointment.hepa_b_status2,     // ⭐ no default
            appointment.hepa_b_status3, 
            
            appointment.regular_given_date,
            appointment.hepa_b_given1,
            appointment.hepa_b_given2,
            appointment.hepa_b_given3,

            id
        ]
    )
    .map_err(|e| e.to_string())?;

    Ok("Appointment updated successfully".into())
}


#[tauri::command]
fn status_apointment_update(id: i64, field: String, value: Option<String>) -> Result<(), String> {
    use rusqlite::params;

    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;

    // Only allow these columns to be updated via this endpoint
    let allowed_fields = [
        "regular_given_date", "regular_status",
        "hepa_b_given1", "hepa_b_status1",
        "hepa_b_given2", "hepa_b_status2",
        "hepa_b_given3", "hepa_b_status3",
        "day_zero_given_date", "day_zero_status",
        "day_three_given_date", "day_three_status",
        "day_seven_given_date", "day_seven_status",
        "day_fourteen_given_date", "day_fourteen_status",
        "day_thirty_given_date", "day_thirty_status",
        "status", "schedule_status"
    ];

    if !allowed_fields.contains(&field.as_str()) {
        return Err(format!("Field '{}' is not updatable", field));
    }

    // Using parametrized query but field name must be injected after validation
    let sql = format!("UPDATE appointments SET {} = ?1 WHERE id = ?2", field);
    conn.execute(&sql, params![value, id]).map_err(|e| e.to_string())?;

    Ok(())
}


#[tauri::command]
fn delete_appointment(state: State<'_, AppState>, id: i32) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM appointments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok("Appointment deleted successfully".into())
}


// ==================== PATIENT MEDICAL UPDATE ====================

#[tauri::command]
fn update_patient_medical(
    state: State<'_, AppState>,
    id: i32,
    prev_vacc: String,
    allergies: String,
    ill_oper: String,
    assessment: String,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    conn.execute(
        "UPDATE patients SET 
            prev_vacc = ?, 
            allergies = ?, 
            ill_oper = ?, 
            assessment = ? 
         WHERE id = ?",
        params![
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

// ---------- for staff component jdajaaj  ----------
#[tauri::command]
async fn get_all_users(_state: State<'_, AppState>) -> Result<Vec<database::User>, String> {
    database::get_all_users_db().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_unverified_users(_state: State<'_, AppState>) -> Result<Vec<database::UnverifiedUser>, String> {
    get_unverified_users_db().map_err(|e| e.to_string())
}

// ------------  request verification (unverified insert)  ------------
#[tauri::command]
async fn request_verification(
    state: State<'_, AppState>,
    payload: RegisterPayload,
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let username = format!(
        "{}{}{}",
        payload.firstname.to_lowercase(),
        payload.lastname.to_lowercase(),
        payload.role.to_lowercase()
    );
    let hash = bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST)
        .map_err(|e| e.to_string())?;
    let role = payload.role.to_lowercase();

    conn.execute(
        "INSERT INTO users (firstname, middlename, lastname, contactnum, password_hash, role, is_active, verified, username)
         VALUES (?1,?2,?3,?4,?5,?6,0,0,?7)",
        rusqlite::params![
            payload.firstname,
            payload.middlename,
            payload.lastname,
            payload.contact_num,
            hash,
            role,
            username,
        ],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    Ok(username)
}

// ==================== MAIN ====================
#[tokio::main]
async fn main() {

        // 1. Kill the native dialog but keep the error in the console
    std::panic::set_hook(Box::new(|info| {
        eprintln!("🚨 Panic: {}", info);
        // Optionally send to front-end or telemetry here
    }));
    
    dotenv().ok(); // load .env
    let secret_key = env::var("SECRET_KEY").expect("SECRET_KEY must be set in .env");
    println!("Loaded key: {}", secret_key);

    init_db().expect("Failed to initialize database");
    
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
        .manage(QueueState {
    serving: Mutex::new(0),
    next: Mutex::new(1),
})

        .invoke_handler(tauri::generate_handler![
            register_user,
            login_user,
            create_patient_cmd,
            get_patients_cmd,
            delete_patient,
            get_inventory,
            create_item,
            delete_item,
            change_inventory_amount,
            get_inventory_logs,
            add_inventory_log,
            get_patient_with_user,
            get_appointments,
            create_appointment,
            update_appointment,
            status_apointment_update,
            update_patient_medical,
            update_muser_password,
            archive_patient,             
            restore_patient,             
            get_archived_patients_cmd,
            delete_appointment,
            get_queue,
            increment_queue,
            clear_queue,
            delete_user,
            toggle_user_status,
            get_all_users,
            reactivate_user,
            get_unverified_users,
            approve_user,   
            update_user_db,                 

        ])
        .plugin(printer_init())
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
        "SELECT 
    id, patient_id,

    regular_type, regular_date, regular_route, vaccine_name, pneumonia_type, injection_site,

    hepa_b_dose1, hepa_b_dose2, hepa_b_dose3,

    regular_status, hepa_b_status1, hepa_b_status2, hepa_b_status3,

    regular_given_date, hepa_b_given1, hepa_b_given2, hepa_b_given3,

    schedule, date_of_exposure, type_of_bite, site_of_bite, biting_animal,
    category, previous_vaccine, prophylaxis_type, vaccroute, tetanus_toxoid,
    tetanus_route, tetanus_date, rig, rig_date,

    day_zero_date, day_three_date, day_seven_date,
    day_fourteen_date, day_thirty_date,

    day_zero_given_date, day_three_given_date, day_seven_given_date,
    day_fourteen_given_date, day_thirty_given_date,

    schedule_status, day_zero_status, day_three_status,
    day_seven_status, day_fourteen_status, day_thirty_status, status
FROM appointments
WHERE patient_id = ?1
ORDER BY schedule ASC
"
    ).map_err(|e| e.to_string())?;

    let appointments = stmt
        .query_map([pid], |row| {
            Ok(Appointment {
    id: Some(row.get(0)?),
    patient_id: row.get(1)?,

    regular_type: row.get(2).ok(),
    regular_date: row.get(3).ok(),
    regular_route: row.get(4).ok(),
    vaccine_name: row.get(5).ok(),
    pneumonia_type: row.get(6).ok(),
    injection_site: row.get(7).ok(),

    hepa_b_dose1: row.get(8).ok(),
    hepa_b_dose2: row.get(9).ok(),
    hepa_b_dose3: row.get(10).ok(),

    regular_status: row.get(11).ok(),
    hepa_b_status1: row.get(12).ok(),
    hepa_b_status2: row.get(13).ok(),
    hepa_b_status3: row.get(14).ok(),

    regular_given_date: row.get(15).ok(),
    hepa_b_given1: row.get(16).ok(),
    hepa_b_given2: row.get(17).ok(),
    hepa_b_given3: row.get(18).ok(),

    schedule: row.get(19)?,

    date_of_exposure: row.get(20).ok(),
    type_of_bite: row.get(21).ok(),
    site_of_bite: row.get(22).ok(),
    biting_animal: row.get(23).ok(),
    category: row.get(24).ok(),
    previous_vaccine: row.get(25).ok(),
    prophylaxis_type: row.get(26).ok(),
    vaccroute: row.get(27).ok(),

    tetanus_toxoid: row.get(28).ok(),
    tetanus_route: row.get(29).ok(),
    tetanus_date: row.get(30).ok(),

    rig: match row.get::<_, Option<i64>>(31)? {
        Some(1) => Some(true),
        Some(0) => Some(false),
        _ => Some(false),
    },
    rig_date: row.get(32).ok(),

    day_zero_date: row.get(33).ok(),
    day_three_date: row.get(34).ok(),
    day_seven_date: row.get(35).ok(),
    day_fourteen_date: row.get(36).ok(),
    day_thirty_date: row.get(37).ok(),

    day_zero_given_date: row.get(38).ok(),
    day_three_given_date: row.get(39).ok(),
    day_seven_given_date: row.get(40).ok(),
    day_fourteen_given_date: row.get(41).ok(),
    day_thirty_given_date: row.get(42).ok(),

    schedule_status: row.get(43).ok(),
    day_zero_status: row.get(44).ok(),
    day_three_status: row.get(45).ok(),
    day_seven_status: row.get(46).ok(),
    day_fourteen_status: row.get(47).ok(),
    day_thirty_status: row.get(48).ok(),
    status: row.get(49).ok(),
})


            })
        
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(appointments)
}
