use serde::{Deserialize, Serialize};
#[cfg(unix)]
use tokio::net::UnixStream;
#[cfg(unix)]
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const CHECK_FILE_PATH: &str = "/var/run/com.alto.helper.sock";

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "action", content = "payload")]
pub enum Command {
    Ping,
    DeletePath { path: String },
    UninstallApp { bundle_path: String },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
    pub success: bool,
    pub message: String,
}

#[cfg(unix)]
pub async fn send_command(cmd: Command) -> Result<Response, String> {
    // 1. Connect to socket
    let mut stream = UnixStream::connect(CHECK_FILE_PATH).await
        .map_err(|e| format!("Failed to connect to helper: {}", e))?;

    // 2. Send Request
    let req_data = serde_json::to_vec(&cmd)
        .map_err(|e| e.to_string())?;
    
    stream.write_all(&req_data).await
        .map_err(|e| e.to_string())?;

    // 3. Read Response
    let mut buf = vec![0; 1024];
    let n = stream.read(&mut buf).await
        .map_err(|e| e.to_string())?;

    if n == 0 {
        return Err("Empty response from helper".to_string());
    }

    let response: Response = serde_json::from_slice(&buf[0..n])
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[cfg(not(unix))]
pub async fn send_command(_cmd: Command) -> Result<Response, String> {
    Err("Helper client is not supported on this platform".to_string())
}

use std::process::Command as SysCommand;
use tauri::utils::platform::current_exe;

pub async fn ensure_helper_installed() -> bool {
    // 1. Try ping
    if let Ok(res) = send_command(Command::Ping).await {
        if res.success {
            return true;
        }
    }

    println!("Helper not running. Attempting installation...");

    // 2. Locate current executable to find the bundled helper or script
    // In dev: We compile it. In prod: It's in the bundle.
    // For this dev environment, let's assume we build `alto_helper` and `install_helper.sh`
    // and they are accessible.

    // Path to the helper binary we just built
    let current_exe = current_exe().unwrap();
    let bin_dir = current_exe.parent().unwrap();
    let helper_src = bin_dir.join("alto_helper");
    
    // Path to install script
    // We need to write the script to a temp file because it's not bundled in the binary yet
    // Or we assume it's in the src-tauri/scripts folder for dev mode.
    let script_path = std::env::current_dir().unwrap()
        .join("src-tauri/scripts/install_helper.sh");

    if !helper_src.exists() {
        println!("Helper binary not found at {:?}", helper_src);
        return false;
    }

    if !script_path.exists() {
        println!("Install script not found at {:?}", script_path);
        return false;
    }

    // 3. Run install script with Admin Privileges
    let script_cmd = format!("'{}' '{}'", script_path.to_string_lossy(), helper_src.to_string_lossy());
    
    let output = SysCommand::new("osascript")
        .arg("-e")
        .arg(format!("do shell script \"{}\" with administrator privileges", script_cmd))
        .output();

    match output {
        Ok(o) => {
            if o.status.success() {
                println!("Installation success. Waiting for helper start...");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                // Verify ping again
                send_command(Command::Ping).await.is_ok()
            } else {
                println!("Installation failed: {}", String::from_utf8_lossy(&o.stderr));
                false
            }
        },
        Err(e) => {
            println!("Failed to execute osascript: {}", e);
            false
        }
    }
}
