use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Debug)]
pub struct OutdatedApp {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
}

#[derive(serde::Deserialize)]
struct BrewOutdated {
    name: String,
    installed_versions: Vec<String>,
    current_version: String,
}

pub fn scan_outdated_apps() -> Vec<OutdatedApp> {
    let mut outdated_apps = Vec::new();

    // Check Homebrew updates
    if let Ok(output) = Command::new("brew")
        .args(&["outdated", "--json"])
        .output() 
    {
        if output.status.success() {
            if let Ok(json_str) = String::from_utf8(output.stdout) {
                 if let Ok(brew_apps) = serde_json::from_str::<Vec<BrewOutdated>>(&json_str) {
                     for app in brew_apps {
                         let current = app.installed_versions.last().cloned().unwrap_or_default();
                         outdated_apps.push(OutdatedApp {
                             name: app.name,
                             current_version: current,
                             latest_version: app.current_version,
                         });
                     }
                 }
            }
        }
    }

    // Future: Add Sparkle framework check for non-brew apps
    
    outdated_apps
}
