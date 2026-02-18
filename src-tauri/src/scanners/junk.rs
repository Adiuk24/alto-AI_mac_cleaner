use super::{ScanResult, ScannedItem};
use std::fs;
use std::path::Path;

const MAX_DEPTH: u32 = 50;
// const MAX_ENTRIES: usize = 2000; // Removed limit to ensure full scan

/// Path templates relative to home (no leading ~).
/// Expanded list based on clean-my-mac-study and standard macOS cleaner targets.
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
    "Library/Application Support/Firefox/Profiles", // Logic needs to find Cache in profiles, but this is a start

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
    ".Trash", // User Trash
    "Downloads", // Optional: Some cleaners alert on old downloads, we scan but maybe should label differently? 
                 // For now, let's NOT auto-scan Downloads as "Junk" to avoid accidents, unless detailed. 
                 // Sticking to "Safe" junk.
    "Desktop", // Scan for loose screenshots
    "Desktop/screenshots", // Common custom folder
];

fn category_name(tpl: &str) -> &'static str {
    if tpl.contains("Chrome") { "Chrome Cache" }
    else if tpl.contains("Brave") { "Brave Cache" }
    else if tpl.contains("Firefox") { "Firefox Cache" }
    else if tpl.contains("Safari") { "Safari Cache" }
    else if tpl.contains("Slack") { "Slack Cache" }
    else if tpl.contains("Discord") { "Discord Cache" }
    else if tpl.contains("Code/") { "VS Code Cache" }
    else if tpl.contains("Spotify") { "Spotify Cache" }
    else if tpl.contains("Zoom") { "Zoom Logs" }
    else if tpl.contains(".npm") || tpl.contains(".yarn") || tpl.contains("pnpm") { "Dev Package Cache" }
    else if tpl.contains("Xcode") { "Xcode Data" }
    else if tpl.contains("CrashReporter") { "Crash Reports" }
    else if tpl.contains(".Trash") { "Trash Bin" }
    else if tpl.contains("Logs") { "User Logs" }
    else if tpl.contains("Desktop") { "Screenshots" }
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
    ];
    whitelist.contains(&file_name)
}

pub fn scan_junk(home: &str) -> ScanResult {
    let home = Path::new(home);
    let mut items = Vec::new();
    let errors = Vec::new();
    let mut total_size_bytes = 0u64;

    for tpl in JUNK_TEMPLATES {
        let full = home.join(tpl);
        if !full.exists() {
            continue;
        }

        // Special handling & depth control
        let (depth, is_desktop) = if tpl == &"Desktop" {
             (1, true)
        } else if tpl == &"Desktop/screenshots" {
             (2, false) // deeper in screenshots folder is fine
        } else {
             (MAX_DEPTH as usize, false)
        };

        // iterate efficiently using WalkDir
        let walker = walkdir::WalkDir::new(&full)
            .max_depth(depth)
            .into_iter();

        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();
            
            // We only want to delete FILES, not directories (unless empty, but simpler to just do files)
            if !path.is_file() {
                continue;
            }

            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                // Skip if whitelisted
                if is_whitelisted(name) {
                    continue;
                }
                
                // Logic to avoid deleting ENTIRE profile data if we accidentally pointed to parent
                // e.g. don't delete "Cookies", "History"
                if name.eq_ignore_ascii_case("Cookies") || name.eq_ignore_ascii_case("History") {
                    continue;
                }

                // Desktop specific logic: Only pick up screenshots
                if is_desktop {
                     if !name.starts_with("Screenshot") {
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
                items.push(ScannedItem {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: size,
                    category_name: category_name(tpl).to_string(),
                    is_directory: false, // It's a file now
                });
                total_size_bytes += size;
            }
        }
    }

    ScanResult {
        items,
        total_size_bytes,
        errors,
    }
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
