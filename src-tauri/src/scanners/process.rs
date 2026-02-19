use sysinfo::System;

pub fn is_process_running(name_substr: &str) -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes();

    for (_pid, process) in sys.processes() {
        if process.name().to_lowercase().contains(&name_substr.to_lowercase()) {
            return true;
        }
    }
    false
}
