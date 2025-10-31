use serde::{Serialize, Deserialize};
use rusqlite::{Connection, params, Result};
use std::fs;
use crate::DB_PATH;

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
    pub date_of_exposure: Option<String>,
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
    pub status: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InventoryItem {
    pub id: i32,
    pub name: String,
    pub amount: i32,
    pub last_edited: Option<String>,
}

/// Initializes the database and creates all required tables if missing.
pub fn init_db() -> Result<()> {
    fs::create_dir_all("./data").expect("Failed to create data directory");
    let conn = Connection::open(r"C:\RavCare\data\ravcare.db")?;

    // 🧍 USERS TABLE
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            date_created TEXT DEFAULT CURRENT_TIMESTAMP
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
            date_of_exposure TEXT,
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

      conn.execute(
        "ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'pending'",
        [],
           )
    .ok();

    // 📦 INVENTORY TABLE
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount INTEGER NOT NULL,
            last_edited TEXT
        )",
        [],
    )?;

    Ok(())
}

/// Adds a new patient to the database.
pub fn create_patient(p: &Patient) -> Result<()> {
    let conn = Connection::open(r"C:\RavCare\data\ravcare.db")?;
    conn.execute(
        "INSERT INTO patients (
            first_name, last_name, middle_name, address, date_of_birth,
            age, gender, weight, contact_number, date_of_exposure,
            type_of_bite, site_of_bite, biting_animal, category,
            previous_anti_rabies_vaccine, prev_vacc, 
            allergies, ill_oper, assessment, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
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
            p.date_of_exposure,
            p.type_of_bite,
            p.site_of_bite,
            p.biting_animal,
            p.category,
            p.previous_anti_rabies_vaccine,
            p.prev_vacc,
            p.allergies,
            p.ill_oper,
            p.assessment,
            p.status
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
            date_of_exposure: row.get(12)?,
            type_of_bite: row.get(13)?,
            site_of_bite: row.get(14)?,
            biting_animal: row.get(15)?,
            category: row.get(16)?,
            previous_anti_rabies_vaccine: row.get(17)?,
            prev_vacc: row.get(18)?,
            allergies: row.get(19)?,
            ill_oper: row.get(20)?,
            assessment: row.get(21)?,
            last_appointment: row.get(22)?,
            status: row.get(23)?,
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
            date_of_exposure: row.get(12)?,
            type_of_bite: row.get(13)?,
            site_of_bite: row.get(14)?,
            biting_animal: row.get(15)?,
            category: row.get(16)?,
            previous_anti_rabies_vaccine: row.get(17)?,
            prev_vacc: row.get(18)?,
            allergies: row.get(19)?,
            ill_oper: row.get(20)?,
            assessment: row.get(21)?,
            last_appointment: row.get(22)?,
            status: row.get(23)?,
        })
    })?;
    

    Ok(patients.filter_map(Result::ok).collect())
}

/// Adds or updates an inventory item.
pub fn add_or_update_inventory_item(name: &str, amount: i32) -> Result<()> {
    let conn = Connection::open(r"C:\RavCare\data\ravcare.db")?;
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
    let conn = Connection::open(r"C:\RavCare\data\ravcare.db")?;
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
            created_at TEXT NOT NULL,
            FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}
