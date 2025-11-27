use serde::{Serialize, Deserialize};
use rusqlite::{Connection, params, Result};
use std::fs;
use bcrypt::{hash, DEFAULT_COST};
use crate::DB_PATH;
use dotenv::dotenv;
use std::env;


#[derive(Serialize)]
pub struct MUserPayload {
    pub patient_id: i64,
    pub username: String,
    pub password_hash: String,
    pub encrypted_password: String,
}


pub async fn send_muser_to_supabase(muser: MUserPayload) -> Result<(), String> {
    dotenv().ok();
let supabase_url = env::var("SUPABASE_URL").map_err(|e| e.to_string())?;
let supabase_key = env::var("SUPABASE_KEY").map_err(|e| e.to_string())?;


    let client = reqwest::Client::new();
    let res = client
        .post(&format!("{}/rest/v1/musers", supabase_url)) // table name
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Content-Type", "application/json")
        .json(&muser)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to send muser: {:?}", res.text().await.unwrap_or_default()))
    }
}


#[derive(Serialize, Deserialize, Debug)]
pub struct Patient {
    pub id: Option<i64>,
    pub first_name: String,
    pub middle_name: String,
    pub last_name: String,
    pub address: Option<String>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub date_of_birth: Option<String>,
    pub weight: Option<f32>,
    pub date_created: Option<String>,
    pub sex: Option<String>,
    pub contact_number: Option<String>,
    pub type_of_bite: Option<String>,
    pub site_of_bite: Option<String>,
    pub biting_animal: Option<String>,
    pub category: Option<String>,
    pub previous_anti_rabies_vaccine: Option<String>,
    pub prev_vacc: Option<String>,
    pub allergies: Option<String>,
    pub ill_oper: Option<String>,
    pub assessment: Option<String>,
    pub last_appointment: Option<String>,
   
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InventoryItem {
    pub id: i32,
    pub name: String,
    pub amount: i32,
    pub last_edited: Option<String>,
}

// added code
#[derive(Serialize, Deserialize, Debug)]
pub struct User {
    pub id: i64,
    pub first_name: Option<String>,   // <- accept NULL
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub role: Option<String>,
    pub contact_num: Option<String>,
    pub is_active: i32, // 1 = Active, 0 = Inactive
    pub username: Option<String>,
    pub password_hash: Option<String>,
}

// added code
pub fn create_user(
    firstname: &str,
    middlename: Option<&str>,
    lastname: &str,
    password: &str,
    role: &str,
    contactnum: Option<&str>,
) -> rusqlite::Result<()> {
    let conn = Connection::open("./data/ravcare.db")?;
    let password_hash = hash(password, DEFAULT_COST).expect("Failed to hash password");

    conn.execute(
        "INSERT INTO users (firstname, middlename, lastname, contactnum, password_hash, role, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
        params![
            firstname,
            middlename,
            lastname,
            contactnum,
            password_hash,
            role
        ],
    )?;
    Ok(())
}

// 2️⃣ Fetch all users
#[tauri::command]
pub fn get_all_users_db() -> Result<Vec<User>, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, firstname, middlename, lastname, role, contactnum, is_active, username, password_hash
         FROM users
         ORDER BY id DESC",
    ).map_err(|e| e.to_string())?;

    let users = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                first_name: row.get(1)?, 
                middle_name: row.get(2)?,
                last_name: row.get(3)?,
                role: row.get(4)?,
                contact_num: row.get(5)?,
                is_active: row.get(6)?,
                username: row.get(7)?,
                password_hash: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(users)
}

// 3️⃣ Delete a user by ID
#[tauri::command]
pub fn delete_user(id: i64) -> Result<(), String> {
    println!("🔧 delete_user id = {}", id);
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let changed = conn.execute("DELETE FROM users WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    println!("🔧 rows deleted = {}", changed);
    Ok(())
}

// 4️⃣ Toggle active/inactive user
#[tauri::command]
pub fn toggle_user_status(id: i64, new_status: String) -> Result<(), String> {
    println!("🔧 toggle_user_status id = {}  status = {}", id, new_status);
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let is_active = if new_status.to_lowercase() == "active" { 1 } else { 0 };
    let changed = conn.execute(
        "UPDATE users SET is_active = ?1 WHERE id = ?2",
        params![is_active, id],
    ).map_err(|e| e.to_string())?;
    println!("🔧 rows updated = {}", changed);
    Ok(())
}


#[tauri::command]
pub fn reactivate_user(id: i64) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    conn.execute("UPDATE users SET is_active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// for the verification process 
#[derive(Serialize, Deserialize, Debug)]
pub struct UnverifiedUser {
    pub id: i64,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub role: String,
    pub contact_num: Option<String>,
}

//code as of now, doesn't work, will implement once SUPAbase is implemented
#[tauri::command]
pub fn get_unverified_users_db() -> Result<Vec<UnverifiedUser>, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, firstname, middlename, lastname, role, contactnum
         FROM users
         WHERE verified = 0
         ORDER BY id DESC",
    ).map_err(|e| e.to_string())?;

    let list = stmt
        .query_map([], |row| {
            Ok(UnverifiedUser {
                id: row.get(0)?,
                first_name: row.get(1)?,
                middle_name: row.get(2)?,
                last_name: row.get(3)?,
                role: row.get(4)?,
                contact_num: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
pub fn approve_user(id: i64) -> Result<String, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    // 1. flip flag
    conn.execute(
        "UPDATE users SET verified = 1, is_active = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    // 2. return generated username for login prefill
    let username: String = conn
        .query_row(
            "SELECT username FROM users WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(username)
}

#[tauri::command]
pub fn deny_user(id: i64) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// verification process code ends here


#[tauri::command]
pub fn update_user_db(
    id: i64,
    first_name: String,
    middle_name: String,
    last_name: String,
    contact_num: String,
    role: String,
    username: String,
    new_password: Option<String>,  
) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;

    // If new password provided → hash it
    let hashed_password = if let Some(pass) = new_password {
        if pass.trim().is_empty() {
            None
        } else {
            Some(
                bcrypt::hash(pass, bcrypt::DEFAULT_COST)
                    .map_err(|e| e.to_string())?,
            )
        }
    } else {
        None
    };

    if let Some(new_hash) = hashed_password {
        conn.execute(
            "UPDATE users
               SET username    = ?1,
                   firstname   = ?2,
                   middlename  = ?3,
                   lastname    = ?4,
                   contactnum  = ?5,
                   role        = ?6,
                   password_hash = ?7
             WHERE id = ?8",
            params![
                username,
                first_name,
                middle_name,
                last_name,
                contact_num,
                role,
                new_hash,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE users
               SET username    = ?1,
                   firstname   = ?2,
                   middlename  = ?3,
                   lastname    = ?4,
                   contactnum  = ?5,
                   role        = ?6
             WHERE id = ?7",
            params![
                username,
                first_name,
                middle_name,
                last_name,
                contact_num,
                role,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}


/// Initializes the database and creates all required tables if missing.
pub fn init_db() -> Result<()> {
    fs::create_dir_all("./data").expect("Failed to create data directory");
    let conn = Connection::open(r".\data\ravcare.db")?;

    // 🧍 USERS TABLE
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            firstname         TEXT NOT NULL,
            middlename        TEXT,
            lastname          TEXT NOT NULL,
            contactnum        TEXT UNIQUE NOT NULL,
            password_hash     TEXT NOT NULL,
            role              TEXT NOT NULL DEFAULT 'desk',
            is_active         INTEGER DEFAULT 1,
            is_admin          INTEGER DEFAULT 0,
            username          TEXT UNIQUE NOT NULL,
            date_created      TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 🧑‍⚕️ PATIENTS TABLE (updated)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            last_name TEXT NOT NULL,
            address TEXT,
            age INTEGER,
            gender TEXT,
            date_of_birth TEXT,
            weight REAL,
            date_created TEXT DEFAULT CURRENT_TIMESTAMP,
            sex TEXT,
            contact_number TEXT,
            type_of_bite TEXT,
            site_of_bite TEXT,
            biting_animal TEXT,
            category TEXT,
            previous_anti_rabies_vaccine TEXT,
            prev_vacc TEXT,
            allergies TEXT,
            ill_oper TEXT,
            assessment TEXT,
            last_appointment TEXT
        )",
        [],
    )?;

    // 📦 INVENTORY TABLE
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            amount INTEGER NOT NULL,
            last_edited TEXT
        )",
        [],
    )?;

    // ================================
// 📌 INSERT PERMANENT VACCINES
// ================================
 /* 
   I think is the code that's creating more vaccines in the db
 conn.execute(
    "INSERT OR IGNORE INTO inventory (name, amount, last_edited) VALUES
        ('Vaxirab-N', 0, CURRENT_TIMESTAMP),
        ('Pneumonia Vaccine', 0, CURRENT_TIMESTAMP),
        ('Flu Vaccine', 0, CURRENT_TIMESTAMP),
        ('Hepatitis B Vaccine', 0, CURRENT_TIMESTAMP),
        ('Tetanus Toxoid', 0, CURRENT_TIMESTAMP)
    ",
    [],
)?; */

// 🧹 One-time cleanup: remove unwanted vaccines
conn.execute(
    "DELETE FROM inventory
     WHERE name NOT IN (
         'Vaxirab-N',
         'Pneumonia Vaccine',
         'Flu Vaccine',
         'Hepatitis B Vaccine',
         'Tetanus Toxoid'
     )",
    [],
)?;


    Ok(())
}

/// Adds a new patient to the database.
pub fn create_patient(p: &Patient) -> Result<()> {
    let conn = Connection::open(r".\data\ravcare.db")?;
    conn.execute(
        "INSERT INTO patients (
            first_name, last_name, middle_name, address, date_of_birth,
            age, gender, weight, contact_number,
            type_of_bite, site_of_bite, biting_animal, category,
            previous_anti_rabies_vaccine, prev_vacc,
            allergies, ill_oper, assessment
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            p.first_name,
            p.last_name,
            p.middle_name,
            p.address,
            p.date_of_birth,
            p.age,
            p.gender,
            p.weight,
            p.contact_number,
           
            p.type_of_bite,
            p.site_of_bite,
            p.biting_animal,
            p.category,
            p.previous_anti_rabies_vaccine,
            p.prev_vacc,
            p.allergies,
            p.ill_oper,
            p.assessment,
        ],
    )?;
    Ok(())
}

/// Retrieves all patients from the database.
pub fn get_all_patients() -> Result<Vec<Patient>, rusqlite::Error> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare("SELECT * FROM patients WHERE archived = 0 ORDER BY id DESC")?;
    
    let patients = stmt.query_map([], |row| {
        Ok(Patient {
            id: row.get(0)?,
            first_name: row.get(1)?,
            middle_name: row.get(2)?,
            last_name: row.get(3)?,
            address: row.get(4)?,
            age: row.get(5)?,
            gender: row.get(6)?,
            date_of_birth: row.get(7)?,
            weight: row.get(8)?,
            date_created: row.get(9)?,
            sex: row.get(10)?,
            contact_number: row.get(11)?,
            
            type_of_bite: row.get(12)?,
            site_of_bite: row.get(13)?,
            biting_animal: row.get(14)?,
            category: row.get(15)?,
            previous_anti_rabies_vaccine: row.get(16)?,
            prev_vacc: row.get(17)?,
            allergies: row.get(18)?,
            ill_oper: row.get(19)?,
            assessment: row.get(20)?,
            last_appointment: row.get(21)?,

        })
    })?;

    Ok(patients.filter_map(Result::ok).collect())
}

pub fn get_archived_patients() -> Result<Vec<Patient>, rusqlite::Error> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare("SELECT * FROM patients WHERE archived = 1 ORDER BY id DESC")?;
    
    let patients = stmt.query_map([], |row| {
        Ok(Patient {
            id: row.get(0)?,
            first_name: row.get(1)?,
            middle_name: row.get(2)?,
            last_name: row.get(3)?,
            address: row.get(4)?,
            age: row.get(5)?,
            gender: row.get(6)?,
            date_of_birth: row.get(7)?,
            weight: row.get(8)?,
            date_created: row.get(9)?,
            sex: row.get(10)?,
            contact_number: row.get(11)?,
            
            type_of_bite: row.get(12)?,
            site_of_bite: row.get(13)?,
            biting_animal: row.get(14)?,
            category: row.get(15)?,
            previous_anti_rabies_vaccine: row.get(16)?,
            prev_vacc: row.get(17)?,
            allergies: row.get(18)?,
            ill_oper: row.get(19)?,
            assessment: row.get(20)?,
            last_appointment: row.get(21)?,

        })
    })?;

    Ok(patients.filter_map(Result::ok).collect())
}

/// Adds or updates an inventory item.
pub fn add_or_update_inventory_item(name: &str, amount: i32) -> Result<()> {
    let conn = Connection::open(r".\data\ravcare.db")?;
    conn.execute(
        "INSERT INTO inventory (name, amount, last_edited)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET
            amount = excluded.amount,
            last_edited = CURRENT_TIMESTAMP",
        params![name, amount],
    )?;
    Ok(())
}

/// Retrieves all inventory items.
pub fn get_all_inventory() -> Result<Vec<InventoryItem>> {
    let conn = Connection::open(r".\data\ravcare.db")?;
    let mut stmt = conn.prepare("SELECT * FROM inventory ORDER BY name ASC")?;

    let items = stmt
        .query_map([], |row| {
            Ok(InventoryItem {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                last_edited: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<InventoryItem>, _>>()?;

    Ok(items)
}

pub fn init_musers_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS musers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            encrypted_password TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}
