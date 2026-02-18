use super::{ScanResult, ScannedItem};
use std::fs;
use std::path::Path;

const MIN_SIZE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB
const MAX_SCAN_ENTRIES: usize = 10_000;

fn scan_dir_recursive(p: &Path, results: &mut Vec<ScannedItem>, _errors: &mut Vec<String>, scanned_count: &mut usize) {
    if *scanned_count > MAX_SCAN_ENTRIES {
        return;
    }

    let entries = match fs::read_dir(p) {
        Ok(e) => e,
        Err(_e) => {
            // Ignore permission errors, just log debug if needed
            return;
        }
    };

    for ent in entries.flatten() {
        let path = ent.path();
        if path.is_symlink() {
            continue;
        }
        
        let meta = match ent.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if meta.is_dir() {
            scan_dir_recursive(&path, results, _errors, scanned_count);
        } else {
            *scanned_count += 1;
            if meta.len() >= MIN_SIZE_BYTES {
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("Other");
                let category = match ext.to_lowercase().as_str() {
                    "mp4" | "mov" | "mkv" | "avi" => "Movies",
                    "zip" | "dmg" | "iso" | "tar" | "gz" => "Archives",
                    "mp3" | "wav" | "flac" => "Music",
                    "jpg" | "png" | "heic" | "raw" => "Pictures",
                    "pdf" | "doc" | "docx" => "Documents",
                    _ => "Other",
                };

                results.push(ScannedItem {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: meta.len(),
                    category_name: category.to_string(),
                    is_directory: false,
                });
            }
        }
    }
}

pub fn scan_large_files(home: &str) -> ScanResult {
    let home = Path::new(home);
    // Scan Downloads and Documents by default
    let targets = vec![
        home.join("Downloads"),
        home.join("Documents"),
        home.join("Movies"),
        home.join("Music"),
    ];

    let mut items = Vec::new();
    let mut errors = Vec::new();
    let mut scanned_count = 0;

    for target in targets {
        if target.exists() {
            scan_dir_recursive(&target, &mut items, &mut errors, &mut scanned_count);
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
