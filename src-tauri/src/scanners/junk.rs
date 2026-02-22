use super::{ScanResult, ScannedItem};
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

const MAX_DEPTH: u32 = 8;              // Was 50 — deep enough for app caches, not for crawling the entire FS
const MAX_FILES_PER_DIR: usize = 500; // Cap per template to avoid millions-of-files hangs
const MAX_TOTAL_FILES: usize = 5_000; // Global cap across all templates
const SCAN_TIMEOUT_SECS: u64 = 25;   // Hard deadline: give up after 25s, return what we have

/// Path templates relative to home (no leading ~).
#[cfg(target_os = "macos")]
const JUNK_TEMPLATES: &[&str] = &[
    // User Caches
    "Library/Caches",
    "Library/Logs",
    
    // Browser Caches
    "Library/Application Support/Google/Chrome/Default/Cache",
    "Library/Application Support/Google/Chrome/Default/Code Cache",
    "Library/Application Support/BraveSoftware/Brave-Browser/Default/Cache",
    "Library/Application Support/BraveSoftware/Brave-Browser/Default/Code Cache",
    "Library/Caches/com.apple.Safari",
    "Library/Containers/com.apple.Safari/Data/Library/Caches",
    "Library/Application Support/Firefox/Profiles", 

    // App Caches & Logs
    "Library/Application Support/Slack/Cache",
    "Library/Application Support/Slack/Service Worker/CacheStorage",
    "Library/Application Support/Code/Cache",
    "Library/Application Support/Code/CachedData",
    "Library/Application Support/Code/CachedExtensions",
    "Library/Application Support/Code/Code Cache",
    "Library/Application Support/Spotify/PersistentCache",
    "Library/Application Support/Zoom/logs",
    "Library/Application Support/Discord/Cache",
    "Library/Application Support/Discord/Code Cache",

    // Development Junk
    ".npm/_cacache",
    ".yarn/cache",
    ".pnpm-store",
    "Library/Developer/Xcode/DerivedData",
    "Library/Developer/Xcode/Archives",
    "Library/Developer/Xcode/iOS DeviceSupport",
    
    // System/User Junk
    "Library/Application Support/CrashReporter",
    "Library/Saved Application State",
    ".Trash",
    "Desktop",
    "Desktop/screenshots",
    "Downloads",

    // CMM-level categories
    "Library/Caches/com.apple.SoftwareUpdate", // Old Updates
    "Library/Caches/com.apple.Safari/Localization", // Language Files (Safari localization cache)
];

#[cfg(target_os = "windows")]
const JUNK_TEMPLATES: &[&str] = &[
    // System/User Temp
    "AppData\\Local\\Temp",
    
    // Browsers
    "AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache",
    "AppData\\Local\\Google\\Chrome\\User Data\\Default\\Code Cache",
    "AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache",
    "AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache",
    "AppData\\Local\\Mozilla\\Firefox\\Profiles", // Scan for cache2/entries

    // Apps
    "AppData\\Local\\Slack\\Cache",
    "AppData\\Roaming\\Slack\\Cache",
    "AppData\\Roaming\\Code\\Cache",
    "AppData\\Roaming\\Code\\CachedData",
    "AppData\\Roaming\\Discord\\Cache",
    "AppData\\Roaming\\Discord\\Code Cache",
    "AppData\\Roaming\\Zoom\\bin\\logs",

    // Dev
    ".npm\\_cacache",
    ".pnpm-store",

    // Recycle Bin (Handling actual recycle bin on Windows requires Shell API, likely out of scope for simple file scan, keeping commented)
    // "$Recycle.Bin", 
];

fn category_name(tpl: &str) -> &'static str {
    // Shared Logic
    if tpl.contains("Chrome") { "Chrome Cache" }
    else if tpl.contains("Brave") { "Brave Cache" }
    else if tpl.contains("Firefox") { "Firefox Cache" }
    else if tpl.contains("Slack") { "Slack Cache" }
    else if tpl.contains("Discord") { "Discord Cache" }
    else if tpl.contains("Code") { "VS Code Cache" } // "Code/" or "Code\\"
    else if tpl.contains("Spotify") { "Spotify Cache" }
    else if tpl.contains("Zoom") { "Zoom Logs" }
    else if tpl.contains(".npm") || tpl.contains(".yarn") || tpl.contains("pnpm") { "Dev Package Cache" }
    
    // macOS Specific
    else if tpl.contains("Safari") { "Safari Cache" }
    else if tpl.contains("Xcode") { "Xcode Data" }
    else if tpl.contains("CrashReporter") { "Crash Reports" }
    else if tpl.contains(".Trash") { "Trash Bin" }
    else if tpl.contains("Library/Logs") { "User Logs" }
    else if tpl.contains("Saved Application State") { "App State" }
    else if tpl.contains("Desktop") { "Screenshots" }
    else if tpl.contains("Downloads") { "Old Installers" }
    else if tpl.contains("SoftwareUpdate") { "Old Updates" }
    else if tpl.contains("Localization") { "Language Files" }
    
    // Windows Specific
    else if tpl.contains("Edge") { "Edge Cache" }
    else if tpl.contains("Temp") { "Temporary Files" }
    else if tpl.contains("Recycle") { "Recycle Bin" }
    
    else { "User Caches" }
}

fn is_whitelisted(file_name: &str) -> bool {
    // Files we should NEVER delete automatically, even in cache folders
    let whitelist = [
        ".DS_Store",
        "localized",
        "Icon\r",
        ".lock",
        "settings.json",
        "config.json",
        "User Data", // Protect Chrome User Data root if scanned
        "bookmarks", // Protect bookmarks
        "Login Data", // Protect saved passwords
        "desktop.ini", // Windows system file
        "ntuser.dat", // Windows registry
    ];
    whitelist.contains(&file_name)
}

pub fn scan_junk(home: &str) -> ScanResult {
    let home = Path::new(home);
    let mut items = Vec::new();
    let errors = Vec::new();
    let mut total_size_bytes = 0u64;
    let mut total_files_scanned = 0usize;
    let deadline = Instant::now() + Duration::from_secs(SCAN_TIMEOUT_SECS);

    'outer: for tpl in JUNK_TEMPLATES {
        // Hard deadline: if we've been scanning longer than SCAN_TIMEOUT_SECS, stop
        if Instant::now() >= deadline {
            eprintln!("⚠️ Junk scan timeout reached after {} seconds. Returning partial results.", SCAN_TIMEOUT_SECS);
            break;
        }

        let full = home.join(tpl);
        if !full.exists() {
            continue;
        }

        // Special handling & depth control
        let (depth, is_desktop) = if tpl == &"Desktop" {
             (1, true)
        } else if tpl == &"Desktop/screenshots" {
             (2, false)
        } else {
             (MAX_DEPTH as usize, false)
        };

        let walker = walkdir::WalkDir::new(&full)
            .max_depth(depth)
            .into_iter();

        let mut dir_file_count = 0usize;

        for entry in walker {
            // Deadline and global cap checks inside inner loop
            if Instant::now() >= deadline || total_files_scanned >= MAX_TOTAL_FILES {
                break 'outer;
            }
            // Per-directory cap
            if dir_file_count >= MAX_FILES_PER_DIR {
                break;
            }

            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    eprintln!("Error scanning {}: {}", full.display(), e);
                    continue;
                }
            };
            let path = entry.path();

            if !path.is_file() {
                continue;
            }

            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if is_whitelisted(name) {
                    continue;
                }
                if name.eq_ignore_ascii_case("Cookies") || name.eq_ignore_ascii_case("History") {
                    continue;
                }
                if is_desktop && !name.starts_with("Screenshot") {
                    continue;
                }
                if tpl.contains("Downloads") {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                    if !["dmg", "pkg", "iso", "zip", "tar", "gz", "7z", "rar"].contains(&ext.as_str()) {
                        continue;
                    }
                }
            }

            let meta = match fs::metadata(path) {
                Ok(m) => m,
                Err(_) => continue,
            };

            let size = meta.len();
            if size > 0 {
                let cat = if tpl.contains("Downloads") {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                    if ext == "dmg" || ext == "iso" {
                        "Unused Disk Images"
                    } else {
                        category_name(tpl)
                    }
                } else {
                    category_name(tpl)
                };
                items.push(ScannedItem {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: size,
                    category_name: cat.to_string(),
                    is_directory: false,
                    accessed_date: None,
                });
                total_size_bytes += size;
                dir_file_count += 1;
                total_files_scanned += 1;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if total_files_scanned < MAX_TOTAL_FILES && Instant::now() < deadline {
            let prefs_dir = home.join("Library/Preferences");
            if prefs_dir.exists() {
                if let Ok(entries) = fs::read_dir(&prefs_dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_file()
                            && p.extension().map(|e| e == "plist").unwrap_or(false)
                            && total_files_scanned < MAX_TOTAL_FILES
                        {
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let path_str = p.to_string_lossy().to_string();
                            if is_broken_plist(&p) {
                                items.push(ScannedItem {
                                    path: path_str,
                                    size_bytes: size,
                                    category_name: "Broken Preferences".to_string(),
                                    is_directory: false,
                                    accessed_date: None,
                                });
                                total_size_bytes += size;
                                total_files_scanned += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    ScanResult {
        items,
        total_size_bytes,
        errors,
    }
}

#[cfg(target_os = "macos")]
fn is_broken_plist(path: &Path) -> bool {
    use std::io::Read;
    let mut f = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return true,
    };
    let mut buf = Vec::new();
    if f.read_to_end(&mut buf).is_err() {
        return true;
    }
    if buf.is_empty() {
        return true;
    }
    plist::from_bytes::<plist::Value>(&buf).is_err()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn test_category_name_mapping() {
        assert_eq!(category_name("Library/Caches/com.google.Chrome"), "Chrome Cache");
        assert_eq!(category_name(".Trash"), "Trash Bin");
    }

    #[test]
    fn test_junk_scan_safety() {
        // Setup temp home
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        let cache_dir = home.join("Library/Caches");
        fs::create_dir_all(&cache_dir).unwrap();

        // 1. Junk file
        let junk_file = cache_dir.join("junk.tmp");
        let mut f = fs::File::create(&junk_file).unwrap();
        f.write_all(b"junk").unwrap();

        // 2. Whitelisted file
        let ds_store = cache_dir.join(".DS_Store");
        fs::File::create(&ds_store).unwrap();
        
        // 3. Sensitive file (cookie)
        let cookie_file = cache_dir.join("Cookies");
        fs::File::create(&cookie_file).unwrap();

        // Run scan
        let result = scan_junk(home.to_str().unwrap());
        let paths: Vec<String> = result.items.iter().map(|i| i.path.clone()).collect();
        
        assert!(paths.iter().any(|p| p.contains("junk.tmp")), "Should find junk.tmp");
        assert!(!paths.iter().any(|p| p.contains(".DS_Store")), "Should NOT list .DS_Store");
        assert!(!paths.iter().any(|p| p.contains("Cookies")), "Should NOT list Cookies");
    }
}
