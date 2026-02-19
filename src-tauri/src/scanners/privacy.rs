use serde::Serialize;
use std::path::Path;
use std::fs;

#[derive(Debug, Serialize, Clone)]
pub struct PrivacyItem {
    pub id: String,
    pub browser: String,
    pub data_type: String, // "Cookies", "History", "Cache"
    pub path: String,
    pub size_bytes: u64,
    pub description: String,
}

pub fn scan_privacy() -> Vec<PrivacyItem> {
    let mut items = Vec::new();
    let home = dirs::home_dir().unwrap();
    let library = home.join("Library");

    // 1. Google Chrome
    let chrome_base = library.join("Application Support/Google/Chrome/Default");
    if chrome_base.exists() {
        check_browser_file(&mut items, &chrome_base, "History", "Google Chrome", "Browsing History");
        check_browser_file(&mut items, &chrome_base, "Cookies", "Google Chrome", "Tracking Cookies");
        check_browser_file(&mut items, &chrome_base, "Login Data", "Google Chrome", "Saved Passwords");
    }

    // 2. Safari
    let safari_base = library.join("Safari");
    if safari_base.exists() {
        check_browser_file(&mut items, &safari_base, "History.db", "Safari", "Browsing History");
        check_browser_file(&mut items, &safari_base, "LastSession.plist", "Safari", "Last Session Data");
        // Safari Cookies happen in ~/Library/Cookies/Cookies.binarycookies usually, but let's stick to base
    }

    // 3. Brave Browser
    let brave_base = library.join("Application Support/BraveSoftware/Brave-Browser/Default");
    if brave_base.exists() {
        check_browser_file(&mut items, &brave_base, "History", "Brave", "Browsing History");
        check_browser_file(&mut items, &brave_base, "Cookies", "Brave", "Tracking Cookies");
    }

    items
}

fn check_browser_file(items: &mut Vec<PrivacyItem>, base: &Path, filename: &str, browser: &str, desc: &str) {
    let path = base.join(filename);
    if path.exists() {
        if let Ok(meta) = fs::metadata(&path) {
            items.push(PrivacyItem {
                id: format!("{}_{}", browser, filename),
                browser: browser.to_string(),
                data_type: filename.to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.len(),
                description: desc.to_string(),
            });
        }
    }
}

pub fn clean_privacy_item(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    
    // Safety Check: Is browser running?
    if path_str.contains("Chrome") && crate::scanners::process::is_process_running("Google Chrome") {
        return Err("Please close Google Chrome to clean this item.".to_string());
    }
    if path_str.contains("Safari") && crate::scanners::process::is_process_running("Safari") {
        // Safari might be "Safari" or "Safari Technology Preview"
        return Err("Please close Safari to clean this item.".to_string());
    }
    if path_str.contains("Brave") && crate::scanners::process::is_process_running("Brave Browser") {
        return Err("Please close Brave to clean this item.".to_string());
    }

    if path.exists() {
        // For SQLite DBs (History, Cookies), deleting the file is the nuclear option.
        // It clears everything.
        // Ideally we'd use rusqlite to execute "DELETE FROM ...", but that requires locking.
        // For v2.2 MVP, we delete the file (Chrome/Safari will recreate empty on restart).
        // WARNING: This logs user out of sites (Cookies) or clears all history.
        
        trash::delete(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
