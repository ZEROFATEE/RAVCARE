// don't delete, dis for the supabase 

//mod muser;
//mod Patient;
/*mod commands;     
mod database; 

mod supabase_muser;
 use supabase_muser::{fetch_musers, insert_muser, MUser};
use commands::patient::sync_patient_to_supabase;*/

/* #[tokio::main]
async fn main() {

    
        // 1️⃣ Try to fetch``
    match fetch_musers().await {
        Ok(users) => println!("✅ musers from cloud: {:#?}", users),
        Err(e) => println!("❌ fetch error: {}", e),
    }

    // 2️⃣ Try to insert a dummy user
    let dummy = MUser {
        patient_id: 999,
        username: "testuser".to_string(),
        password_hash: "$2b$10$FakeHashForDemoPurposesOnly".to_string(),
        created_at: Utc::now().to_rfc3339(),
    };

    match insert_muser(dummy).await {
        Ok(_) => println!("✅ inserted test muser"),
        Err(e) => println!("❌ insert error: {}", e),
    }

    dotenv().ok(); // load .env
    let secret_key = env::var("SECRET_KEY").expect("SECRET_KEY must be set in .env");
    println!("Loaded key: {}", secret_key); */