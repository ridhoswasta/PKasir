use crate::commands::auth::hash_pw;
use crate::db::AppDb;
use crate::models::{CreateUserInput, UpdateUserInput, UserPublic};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_users(db: State<'_, AppDb>) -> Result<Vec<UserPublic>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, username, role, displayName, avatar FROM users ORDER BY role, displayName")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(UserPublic {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                display_name: row.get(3)?,
                avatar: row.get(4).ok(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn create_user(db: State<'_, AppDb>, input: CreateUserInput) -> Result<UserPublic, String> {
    if !["manager", "cashier"].contains(&input.role.as_str()) {
        return Err("Role tidak valid".into());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Check uniqueness
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE username=?1",
            [&input.username],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);
    if exists {
        return Err("Username sudah digunakan".into());
    }
    let id = now_id();
    conn.execute(
        "INSERT INTO users (id, username, password, role, displayName) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![id, input.username, hash_pw(&input.password), input.role, input.display_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(UserPublic {
        id,
        username: input.username,
        role: input.role,
        display_name: input.display_name,
        avatar: None,
    })
}

#[tauri::command]
pub fn update_user(
    db: State<'_, AppDb>,
    id: String,
    input: UpdateUserInput,
) -> Result<UserPublic, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Fetch existing
    let (old_username, old_role, old_display, old_pw, old_avatar): (
        String,
        String,
        String,
        String,
        Option<String>,
    ) = conn
        .query_row(
            "SELECT username, role, displayName, password, avatar FROM users WHERE id=?1",
            [&id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4).ok())),
        )
        .map_err(|_| "User tidak ditemukan".to_string())?;

    // If a current_password is supplied (profile self-edit), verify it before
    // allowing a password change. Admin flows on the Pengguna page omit this
    // field and are trusted to set passwords directly.
    if input.password.is_some() {
        if let Some(current) = input.current_password.as_deref() {
            if hash_pw(current) != old_pw {
                return Err("Password saat ini salah".into());
            }
        }
    }

    let new_role = if old_role == "admin" {
        "admin".to_string()
    } else {
        input.role.unwrap_or(old_role.clone())
    };
    if new_role == "admin" && old_role != "admin" {
        return Err("Tidak bisa membuat admin baru".into());
    }

    let new_username = input.username.unwrap_or(old_username.clone());
    if new_username != old_username {
        let dup: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM users WHERE username=?1 AND id!=?2",
                rusqlite::params![new_username, id],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false);
        if dup {
            return Err("Username sudah digunakan".into());
        }
    }

    let new_pw = input.password.map(|p| hash_pw(&p)).unwrap_or(old_pw);
    let new_display = input.display_name.unwrap_or(old_display);
    // avatar: None in the input means "keep existing"; Some("") means "clear"
    let new_avatar = input.avatar.or(old_avatar);

    conn.execute(
        "UPDATE users SET username=?1, password=?2, role=?3, displayName=?4, avatar=?5 WHERE id=?6",
        rusqlite::params![new_username, new_pw, new_role, new_display, new_avatar, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserPublic {
        id,
        username: new_username,
        role: new_role,
        display_name: new_display,
        avatar: new_avatar,
    })
}

#[tauri::command]
pub fn delete_user(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let role: String = conn
        .query_row("SELECT role FROM users WHERE id=?1", [&id], |r| r.get(0))
        .map_err(|_| "User tidak ditemukan".to_string())?;
    if role == "admin" {
        return Err("Tidak bisa menghapus akun admin".into());
    }
    conn.execute("DELETE FROM users WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
