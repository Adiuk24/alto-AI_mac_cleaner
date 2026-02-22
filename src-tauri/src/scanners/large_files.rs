use super::{ScanResult, ScannedItem};
use walkdir::{WalkDir, DirEntry};
use sysinfo::Disks;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const MIN_SIZE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB
const MAX_FILES_TO_SCAN: usize = 50_000;      // Cap to avoid hanging on massive disks
const SCAN_TIMEOUT_SECS: u64 = 30;           // Hard deadline

// Lazy static for system info to reuse
lazy_static::lazy_static! {
    static ref DISKS_REFRESH: Mutex<Disks> = Mutex::new(Disks::new_with_refreshed_list());
}

fn is_ignored(entry: &DirEntry) -> bool {
    let file_name = entry.file_name().to_string_lossy();
    if file_name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        // System directories to skip on macOS root scan
        // We only want user-serviceable content
        let path_str = entry.path().to_string_lossy();
        if path_str == "/System" || 
           path_str == "/bin" || 
           path_str == "/sbin" || 
           path_str == "/usr" || 
           path_str == "/var" || 
           path_str == "/private" || 
           path_str == "/dev" || 
           path_str == "/proc" || 
           path_str == "/net" ||
           path_str.starts_with("/Library/Apple") || // Protect Core OS
           path_str.starts_with("/Library/System") {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if file_name == "Windows" || file_name == "Program Files" || file_name == "Program Files (x86)" || file_name == "$Recycle.Bin" || file_name == "System Volume Information" {
            // Optional: User might want to inspect Program Files, but usually it's system managed.
            // Let's allow Program Files but maybe skip Windows folder strictly.
            if file_name == "Windows" { return true; }
        }
    }
    
    false
}

pub fn scan_large_files(_home: &str) -> ScanResult {
    let mut items = Vec::new();
    let errors = Vec::new();
    let mut total_files_checked = 0usize;
    let deadline = Instant::now() + Duration::from_secs(SCAN_TIMEOUT_SECS);
    
    // Refresh disks
    let mut disks_lock = DISKS_REFRESH.lock().unwrap();
    disks_lock.refresh_list();

    let disks: Vec<_> = disks_lock.list().iter().map(|d| d.mount_point().to_owned()).collect();

    'outer: for mount_point in disks {
        // Prepare walker
        let walker = WalkDir::new(&mount_point)
            .follow_links(false)
            .same_file_system(true)
            .into_iter()
            .filter_entry(|e| !is_ignored(e));

        for entry in walker {
            // Global safety checks
            if Instant::now() >= deadline || total_files_checked >= MAX_FILES_TO_SCAN {
                eprintln!("⚠️ Large files scan hit limit (time or file count). Returning partial results.");
                break 'outer;
            }
            total_files_checked += 1;

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if entry.file_type().is_dir() {
                continue;
            }

            let len = match entry.metadata() {
                Ok(m) => m.len(),
                Err(_) => 0,
            };

            if len >= MIN_SIZE_BYTES {
                let path = entry.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("Other");
                let category = match ext.to_lowercase().as_str() {
                    "mp4" | "mov" | "mkv" | "avi" | "wmv" | "flv" | "webm" | "m4v" => "Movies",
                    "zip" | "dmg" | "iso" | "tar" | "gz" | "pkg" | "rar" | "7z" => "Archives",
                    "mp3" | "wav" | "flac" | "aac" | "alac" | "m4a" => "Music",
                    "jpg" | "png" | "heic" | "raw" | "tiff" | "jpeg" | "webp" => "Pictures",
                    "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx" | "txt" | "md" => "Documents",
                    _ => "Other",
                };

                let accessed_date = entry.metadata().ok()
                    .and_then(|m| m.accessed().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64);

                items.push(ScannedItem {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: len,
                    category_name: category.to_string(),
                    is_directory: false,
                    accessed_date,
                });
            }
        }
    }

    // Sort by size descending
    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    let total_size = items.iter().map(|i| i.size_bytes).sum();

    ScanResult {
        items,
        total_size_bytes: total_size,
        errors,
    }
}
