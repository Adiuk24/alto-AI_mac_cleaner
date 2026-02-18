use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use dirs::home_dir;

#[derive(Serialize, Debug)]
pub struct MailAttachment {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
}

pub fn scan_mail_attachments() -> Vec<MailAttachment> {
    let mut attachments = Vec::new();
    let home = home_dir().unwrap_or_else(|| PathBuf::from("/"));

    // Common locations for Apple Mail downloads/attachments
    let paths_to_search = vec![
        home.join("Library/Containers/com.apple.mail/Data/Library/Mail Downloads"),
        home.join("Library/Mail"), 
    ];

    for root in paths_to_search {
        if !root.exists() { continue; }

        for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            
            // Heuristic: If we are in 'Mail Downloads', everything is fair game.
            // If in 'Library/Mail', strictly look for folders named "Attachments"
            let is_download = path.to_string_lossy().contains("Mail Downloads");
            let is_attachment_folder = path.to_string_lossy().contains("/Attachments/");
            
            if path.is_file() && (is_download || is_attachment_folder) {
                if let Ok(metadata) = path.metadata() {
                    attachments.push(MailAttachment {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        size_bytes: metadata.len(),
                    });
                }
            }
        }
    }

    attachments
}

pub fn clean_mail_attachments(paths: Vec<String>) -> Result<(), String> {
    for path_str in paths {
        let path = Path::new(&path_str);
        if path.exists() {
             std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
