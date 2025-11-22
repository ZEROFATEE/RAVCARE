use reqwest::Client;
use serde::Serialize;

#[derive(Serialize)]
pub struct SupabasePatient {
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub contact_number: String,
    pub date_of_birth: String,
}

#[tauri::command]
pub async fn sync_patient_to_supabase(patient: SupabasePatient) -> Result<(), String> {
    let url = "https://ddfzwwaldprstwgjbuvp.supabase.co";
    let api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZnp3d2FsZHByc3R3Z2pidXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzMwNzAsImV4cCI6MjA3ODgwOTA3MH0.My0LeEJ1LS96YYNA4YlmpoSwIGEyYWjq-tyCtt2IJKI";

    let client = Client::new();

    let res = client
        .post(url)
        .header("apikey", api_key)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&patient)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(format!("Supabase error: {}", res.text().await.unwrap()))
    }
}
