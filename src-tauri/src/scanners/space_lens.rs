use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub children: Option<Vec<FileNode>>, // None if file, Some if dir
    pub is_dir: bool,
}

pub fn scan_space_lens(path: &str, depth_limit: u32) -> FileNode {
    let root = Path::new(path);
    scan_node(root, 0, depth_limit)
}

fn scan_node(path: &Path, current_depth: u32, depth_limit: u32) -> FileNode {
    let name = path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    let path_str = path.to_string_lossy().to_string();
    
    // Check if it's a directory
    if !path.is_dir() {
        let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        return FileNode {
            name,
            path: path_str,
            size,
            children: None,
            is_dir: false,
        };
    }

    // It is a directory
    
    // Optimization: If we have reached the depth limit, we stop building the tree structure
    // and just calculate the size of this directory efficiently using WalkDir.
    // This avoids allocating FileNodes for the entire subtree.
    if current_depth >= depth_limit {
        let size = get_dir_size(path);
        return FileNode {
            name,
            path: path_str,
            size,
            children: None, // Logic: we stopped here
            is_dir: true,
        };
    }

    // If within depth limit, we scan children recursively
    let mut total_size = 0;
    let mut children_nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let child_path = entry.path();
            let child_node = scan_node(&child_path, current_depth + 1, depth_limit);
            
            // Only add child size if it's valid (already calculated inside child_node)
            total_size += child_node.size;
            children_nodes.push(child_node);
        }
    }
    
    // Sort children by size desc
    children_nodes.sort_by(|a, b| b.size.cmp(&a.size));

    FileNode {
        name,
        path: path_str,
        size: total_size,
        children: Some(children_nodes),
        is_dir: true,
    }
}

/// efficiently calculates directory size without building a tree
fn get_dir_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.metadata().ok())
        .filter(|metadata| metadata.is_file())
        .map(|m| m.len())
        .sum()
}
