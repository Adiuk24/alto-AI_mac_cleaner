use sysinfo::{CpuRefreshKind, RefreshKind, System, Networks, Disks};
use serde::Serialize;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref SYSTEM: Mutex<System> = Mutex::new(System::new_with_specifics(
        RefreshKind::new().with_cpu(CpuRefreshKind::everything()).with_memory(sysinfo::MemoryRefreshKind::everything())
    ));
    static ref NETWORKS: Mutex<Networks> = Mutex::new(Networks::new_with_refreshed_list());
    static ref DISKS: Mutex<Disks> = Mutex::new(Disks::new_with_refreshed_list());
}

#[derive(Serialize)]
pub struct DeviceInfo {
    pub name: String,
    pub battery_level: Option<f32>,
    pub device_type: String, // "mouse", "keyboard", "trackpad", "headphones", "other"
    pub is_connected: bool,
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_load: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_total: u64,
    pub disk_used: u64,
    pub network_up: u64,
    pub network_down: u64,
    pub battery_level: Option<f32>,
    pub connected_devices: Vec<DeviceInfo>,
}

fn get_connected_devices() -> Vec<DeviceInfo> {
    #[cfg(target_os = "macos")]
    {
        // Run system_profiler SPBluetoothDataType -json
        let output = std::process::Command::new("system_profiler")
            .arg("SPBluetoothDataType")
            .arg("-json")
            .output();
    
        if let Ok(output) = output {
            if let Ok(json_str) = String::from_utf8(output.stdout) {
                let v: serde_json::Value = serde_json::from_str(&json_str).unwrap_or(serde_json::Value::Null);
                
                // Navigate JSON structure: SPBluetoothDataType -> [0] -> device_connected
                if let Some(data) = v.get("SPBluetoothDataType").and_then(|arr| arr.get(0)) {
                     let mut devices = Vec::new();
    
                     // Check "device_connected" array
                     if let Some(connected) = data.get("device_connected").and_then(|d| d.as_array()) {
                         for item in connected {
                             // Items are maps like { "Device Name": { ... details ... } }
                             if let Some(obj) = item.as_object() {
                                 for (name, details) in obj {
                                     let minor_type = details.get("device_minorType").and_then(|s| s.as_str()).unwrap_or("other");
                                     let battery_str = details.get("device_batteryLevel").and_then(|s| s.as_str());
                                     
                                     // Parse battery "56 %" -> 56.0
                                     let battery_level = battery_str.and_then(|s| {
                                         s.replace("%", "").trim().parse::<f32>().ok()
                                     });
    
                                     let device_type = match minor_type.to_lowercase().as_str() {
                                         t if t.contains("mouse") => "mouse",
                                         t if t.contains("keyboard") => "keyboard",
                                         t if t.contains("trackpad") => "trackpad",
                                         t if t.contains("headphones") || t.contains("headset") || t.contains("audio") => "headphones",
                                         t if t.contains("speaker") => "speaker",
                                         _ => "other",
                                     };
    
                                     devices.push(DeviceInfo {
                                         name: name.clone(),
                                         battery_level,
                                         device_type: device_type.to_string(),
                                         is_connected: true,
                                     });
                                 }
                             }
                         }
                     }
                     return devices;
                }
            }
        }
        Vec::new()
    }

    #[cfg(target_os = "windows")]
    {
        // TODO: Implement Bluetooth/Device enumeration on Windows
        Vec::new()
    }
}

pub fn get_stats() -> SystemStats {
    // 1. CPU & Memory
    let mut sys = SYSTEM.lock().unwrap();
    sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    sys.refresh_memory();
    
    let cpu_load = sys.global_cpu_info().cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    // 2. Disks
    let mut disks = DISKS.lock().unwrap();
    disks.refresh_list(); // Refresh list in case of mounts/unmounts
    
    let mut disk_total = 0;
    let mut disk_used = 0;
    
    // Find the main disk
    #[cfg(target_os = "macos")]
    let root_path = std::path::Path::new("/");
    
    #[cfg(target_os = "windows")]
    let root_path = std::path::Path::new("C:\\");

    let mut found_root = false;
    for disk in disks.list() {
        if disk.mount_point() == root_path {
            disk_total = disk.total_space();
            disk_used = disk.total_space() - disk.available_space();
            found_root = true;
            break;
        }
    }
    // Fallback if no specific root found (rare)
    if !found_root {
        if let Some(disk) = disks.list().first() {
             disk_total = disk.total_space();
             disk_used = disk.total_space() - disk.available_space();
        }
    }

    // 3. Networks
    let mut networks = NETWORKS.lock().unwrap();
    networks.refresh();
    
    let mut up = 0;
    let mut down = 0;
    for (_interface_name, data) in networks.iter() {
        up += data.transmitted();
        down += data.received();
    }
    
    // 4. Connected Devices
    let connected_devices = get_connected_devices();

    SystemStats {
        cpu_load,
        memory_used,
        memory_total,
        disk_total,
        disk_used,
        network_up: up,
        network_down: down,
        battery_level: None, 
        connected_devices,
    }
}
