use std::fs::{self, OpenOptions};
use std::io::{Write, Seek, SeekFrom};
use std::path::Path;
use rand::Rng;
use walkdir::WalkDir;

fn rename_file_randomly(path: &Path) -> Result<std::path::PathBuf, String> {
    let mut rng = rand::thread_rng();
    let random_name: String = (0..15).map(|_| rng.gen_range(b'a'..=b'z') as char).collect();
    let new_path = path.with_file_name(random_name);
    fs::rename(path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path)
}

fn overwrite_file(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let len = metadata.len();

    let mut file = OpenOptions::new().write(true).open(path).map_err(|e| e.to_string())?;

    // Pass 1: Zeros
    let zeros = vec![0u8; len as usize];
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    file.write_all(&zeros).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;

    // Pass 2: Ones (0xFF)
    let ones = vec![0xFFu8; len as usize];
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    file.write_all(&ones).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;

    // Pass 3: Random
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..len).map(|_| rng.gen()).collect();
    
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    file.write_all(&random_bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;

    Ok(())
}

// Secure delete: Overwrite with 3 passes then rename then delete
pub fn shred_path(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    if path.is_dir() {
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.is_file() {
                overwrite_file(p)?;
                // We don't rename files inside a dir we are about to nuke recursively, 
                // but for max security we could. For now, overwrite is key.
            }
        }
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    } else {
        overwrite_file(path)?;
        let new_path = rename_file_randomly(path)?;
        fs::remove_file(new_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
