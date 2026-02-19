use std::process::Command;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct MaintenanceTask {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub requires_sudo: bool,
}

pub fn get_tasks() -> Vec<MaintenanceTask> {
    vec![
        MaintenanceTask {
            id: "flush_dns".to_string(),
            name: "Flush DNS Cache".to_string(),
            description: "Resets the DNS cache to fix network issues.".to_string(),
            command: "dscacheutil -flushcache; sudo killall -HUP mDNSResponder".to_string(),
            requires_sudo: true,
        },
        MaintenanceTask {
            id: "free_ram".to_string(),
            name: "Free Up RAM".to_string(),
            description: "Purges inactive memory to speed up the system.".to_string(),
            command: "sudo purge".to_string(),
            requires_sudo: true,
        },
        MaintenanceTask {
            id: "reindex_spotlight".to_string(),
            name: "Reindex Spotlight".to_string(),
            description: "Rebuilds the search index to fix Spotlight issues.".to_string(),
            command: "sudo mdutil -E /".to_string(),
            requires_sudo: true,
        },
        MaintenanceTask {
            id: "repair_disk_perms".to_string(),
            name: "Repair Disk Permissions".to_string(),
            description: "Verifies and repairs file permissions on the main volume.".to_string(),
            command: "diskutil resetUserPermissions / `id -u`".to_string(),
            requires_sudo: false, // User mode
        },
        MaintenanceTask {
            id: "clear_font_cache".to_string(),
            name: "Clear Font Cache".to_string(),
            description: "Removes font cache files to fix rendering glitches.".to_string(),
            command: "atsutil databases -remove".to_string(),
            requires_sudo: true,
        },
    ]
}

pub fn run_task(id: &str) -> Result<String, String> {
    let tasks = get_tasks();
    let task = tasks.iter().find(|t| t.id == id).ok_or("Task not found")?;

    // In a real app, 'sudo' commands need a UI prompt or Helper. 
    // For now, we'll try to execute directly, but this will fail if sudo requires a password.
    // Ideally, this should route through our Privileged Helper (com.macpaw.CleanMyMac4.Agent equivalent). 
    
    // Naively executing sh -c for now
    let output = Command::new("sh")
        .arg("-c")
        .arg(&task.command)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
