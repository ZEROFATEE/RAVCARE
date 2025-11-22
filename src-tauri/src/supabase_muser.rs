use reqwest::Client;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct MUser {
    pub patient_id: i64,
    pub username: String,
    pub password_hash: String,
    pub created_at: String, // ISO 8601 format
}

/// 🔍 FETCH all musers (simple test)
pub async fn fetch_musers() -> Result<Vec<MUser>, String> {
    let client = Client::new();
    let url = "https://ddfzwwaldprstwgjbuvp.supabase.co";
    let api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZnp3d2FsZHByc3R3Z2pidXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzMwNzAsImV4cCI6MjA3ODgwOTA3MH0.My0LeEJ1LS96YYNA4YlmpoSwIGEyYWjq-tyCtt2IJKI";

    let res = client
        .get(url)
        .header("apikey", api_key)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Supabase error: {}", res.text().await.unwrap()));
    }

    let users: Vec<MUser> = res.json().await.map_err(|e| e.to_string())?;
    Ok(users)
}

/// ➕ INSERT one muser
pub async fn insert_muser(user: MUser) -> Result<(), String> {
    let client = Client::new();
    let url = "https://ddfzwwaldprstwgjbuvp.supabase.co";
    let api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZnp3d2FsZHByc3R3Z2pidXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzMwNzAsImV4cCI6MjA3ODgwOTA3MH0.My0LeEJ1LS96YYNA4YlmpoSwIGEyYWjq-tyCtt2IJKIY";

    let res = client
        .post(url)
        .header("apikey", api_key)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal") // Supabase trick: don't return inserted row
        .json(&user)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(format!("Insert failed: {}", res.text().await.unwrap()))
    }
}