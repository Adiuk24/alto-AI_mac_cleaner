use std::path::Path;
use tokio::net::{UnixListener, UnixStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Deserialize, Serialize};
use std::fs;

const CHECK_FILE_PATH: &str = "/var/run/com.alto.helper.sock";

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "action", content = "payload")]
enum Command {
    Ping,
    DeletePath { path: String },
    UninstallApp { bundle_path: String },
}

#[derive(Serialize, Deserialize, Debug)]
struct Response {
    success: bool,
    message: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Cleanup old socket
    if Path::new(CHECK_FILE_PATH).exists() {
        fs::remove_file(CHECK_FILE_PATH)?;
    }

    // 2. Bind new socket
    let listener = UnixListener::bind(CHECK_FILE_PATH)?;
    
    // 3. Set permissions to 777 so user (non-root) can connect
    // In production we would use specific user/group ownership
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(CHECK_FILE_PATH, fs::Permissions::from_mode(0o777))?;

    println!("Alto Helper running at {}", CHECK_FILE_PATH);

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream).await {
                        eprintln!("Error handling connection: {}", e);
                    }
                });
            }
            Err(e) => eprintln!("Accept failed: {}", e),
        }
    }
}

async fn handle_connection(mut stream: UnixStream) -> Result<(), Box<dyn std::error::Error>> {
    let mut buf = vec![0; 1024];
    let n = stream.read(&mut buf).await?;

    if n == 0 { return Ok(()); }

    let request: Command = serde_json::from_slice(&buf[0..n])?;
    println!("Received command: {:?}", request);

    let response = match request {
        Command::Ping => Response { success: true, message: "Pong".into() },
        Command::DeletePath { path } => {
            // DANGEROUS: For prototype we allow deleting anything
            // In prod: Validate path is safe (not /, not /System)
            match fs::remove_dir_all(&path).or_else(|_| fs::remove_file(&path)) {
                Ok(_) => Response { success: true, message: format!("Deleted {}", path) },
                Err(e) => Response { success: false, message: e.to_string() },
            }
        },
        Command::UninstallApp { bundle_path } => {
             match fs::remove_dir_all(&bundle_path) {
                Ok(_) => Response { success: true, message: format!("Uninstalled {}", bundle_path) },
                Err(e) => Response { success: false, message: e.to_string() },
            }
        }
    };

    let response_data = serde_json::to_vec(&response)?;
    stream.write_all(&response_data).await?;

    Ok(())
}
