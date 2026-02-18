use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::thread;
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Serialize)]
struct AppInstallPayload {
    name: String,
    path: String,
}

pub fn start_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let (tx, rx) = channel();

        // Create a watcher object, delivering debounced events.
        // The notification back-end is selected based on the platform.
        let mut watcher: Box<dyn Watcher> = if let Ok(w) = RecommendedWatcher::new(tx, Config::default()) {
            Box::new(w)
        } else {
            eprintln!("Failed to create watcher");
            return;
        };

        // Watch /Applications
        let path = Path::new("/Applications");
        if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
             eprintln!("Failed to watch /Applications: {}", e);
             return;
        }
        
        println!("Watcher started on /Applications");

        for res in rx {
            match res {
                Ok(event) => {
                    // Check for Create or Modify events
                    match event.kind {
                        notify::EventKind::Create(_) | notify::EventKind::Modify(_) => {
                             for path_buf in event.paths {
                                 // Check if it's a .app
                                 if path_buf.extension().and_then(|s| s.to_str()) == Some("app") {
                                     let path_str = path_buf.to_string_lossy().to_string();
                                     let name = path_buf.file_stem().unwrap_or_default().to_string_lossy().to_string();
                                     
                                     println!("Detected change in App: {}", name);

                                     // debounce or check if it's fully installed?
                                     // For MVP, just emit event
                                     let _ = app_handle.emit("app-installed", AppInstallPayload {
                                         name,
                                         path: path_str
                                     });
                                 }
                             }
                        },
                        _ => {}
                    }
                },
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    });
}
