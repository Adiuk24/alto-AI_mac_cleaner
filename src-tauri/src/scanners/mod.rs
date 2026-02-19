use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ScannedItem {
    pub path: String,
    pub size_bytes: u64,
    pub category_name: String,
    pub is_directory: bool,
    pub accessed_date: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub items: Vec<ScannedItem>,
    pub total_size_bytes: u64,
    pub errors: Vec<String>,
}

pub mod junk;
pub mod large_files;
pub mod space_lens;
pub mod malware;
pub mod speed;
pub mod scheduler;
pub mod system_stats;
pub mod watcher;
pub mod uninstaller;
pub mod updater;
pub mod shredder;
pub mod mail;
pub mod extensions;
pub mod maintenance;
pub mod privacy;
pub mod monitor;
pub mod process;
