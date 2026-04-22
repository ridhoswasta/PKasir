use crate::db::AppDb;
use crate::models::{LoginResponse, UserPublic};
use sha2::{Digest, Sha256};
use tauri::State;

pub fn hash_pw(pw: &str) -> String {
    let mut h = Sha256::new();
    h.update(pw.as_bytes());
    hex::encode(h.finalize())
}

#[tauri::command]
pub fn login(
    db: State<'_, AppDb>,
    role: String,
    username: Option<String>,
    password: String,
) -> Result<LoginResponse, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let hashed = hash_pw(&password);

    let user = if role == "admin" {
        conn.query_row(
            "SELECT id, username, role, displayName, avatar FROM users WHERE role='admin' AND password=?1",
            [&hashed],
            |row| {
                Ok(UserPublic {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    role: row.get(2)?,
                    display_name: row.get(3)?,
                    avatar: row.get(4).ok(),
                })
            },
        )
    } else {
        let uname = username.ok_or("Username wajib diisi")?;
        conn.query_row(
            "SELECT id, username, role, displayName, avatar FROM users WHERE username=?1 AND password=?2 AND role=?3",
            rusqlite::params![uname, hashed, role],
            |row| {
                Ok(UserPublic {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    role: row.get(2)?,
                    display_name: row.get(3)?,
                    avatar: row.get(4).ok(),
                })
            },
        )
    };

    match user {
        Ok(u) => Ok(LoginResponse { user: u }),
        Err(_) => Err("Username atau password salah".into()),
    }
}
