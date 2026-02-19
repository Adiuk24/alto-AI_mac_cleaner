use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use crate::scanners::system_stats::get_stats;

pub fn start_monitor_thread(app: AppHandle) {
    thread::spawn(move || {
        let mut last_cpu_alert = std::time::Instant::now() - Duration::from_secs(3600); // 1 hour ago
        let mut last_ram_alert = std::time::Instant::now() - Duration::from_secs(3600);
        let mut high_cpu_counter = 0;

        loop {
            // Check every 10 seconds
            thread::sleep(Duration::from_secs(10));

            let stats = get_stats();
            
            // --- CPU MONITOR ---
            // Alert if CPU > 85% for 3 consecutive checks (30s)
            if stats.cpu_load > 85.0 {
                high_cpu_counter += 1;
            } else {
                high_cpu_counter = 0;
            }

            if high_cpu_counter >= 3 {
                if last_cpu_alert.elapsed().as_secs() > 3600 { // Cooldown 1 hour
                    let _ = app.notification()
                        .builder()
                        .title("High CPU Usage Detected")
                        .body(&format!("Your Mac is working hard (CPU: {:.0}%). Click to optimize.", stats.cpu_load))
                        .show();
                    last_cpu_alert = std::time::Instant::now();
                    high_cpu_counter = 0; // Reset after alert
                }
            }

            // --- RAM MONITOR ---
            // Alert if RAM > 90% full
            let ram_percent = (stats.memory_used as f64 / stats.memory_total as f64) * 100.0;
            if ram_percent > 90.0 {
                 if last_ram_alert.elapsed().as_secs() > 3600 {
                    let _ = app.notification()
                        .builder()
                        .title("Memory is Full")
                        .body(&format!("RAM is {:.0}% full. Free up memory to speed up your Mac.", ram_percent))
                        .show();
                    last_ram_alert = std::time::Instant::now();
                 }
            }

            // --- JUNK MONITOR (Optional, requires lighter scan) ---
            // We usually don't want to run full junk scan every 10s. 
            // Maybe once an hour?
        }
    });
}
