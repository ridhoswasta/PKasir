/// Shows a native save-file dialog and writes the given CSV content to the chosen path.
///
/// Returns:
///   - Ok(Some(path))  → file saved, `path` is the absolute path on disk
///   - Ok(None)        → user cancelled the dialog
///   - Err(msg)        → write failed (permissions, disk full, etc.)
#[tauri::command]
pub fn export_csv(default_name: String, content: String) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("CSV (dapat dibuka di Excel)", &["csv"])
        .set_file_name(&default_name)
        .save_file();

    match picked {
        Some(path) => {
            // Content already includes the UTF-8 BOM from the frontend.
            std::fs::write(&path, content.as_bytes())
                .map_err(|e| format!("Gagal menyimpan file: {}", e))?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}
