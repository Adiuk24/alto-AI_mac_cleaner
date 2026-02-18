use serde::Serialize;
use std::fs;
use std::path::Path;

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
    scan_recursive(root, 0, depth_limit)
}

fn scan_recursive(path: &Path, current_depth: u32, depth_limit: u32) -> FileNode {
    let name = path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    let path_str = path.to_string_lossy().to_string();

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
    let mut total_size = 0;
    let mut children_nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let child_path = entry.path();
            let child_node = scan_recursive(&child_path, current_depth + 1, depth_limit);
            total_size += child_node.size;
            
            // Only collect children if within depth limit
            if current_depth < depth_limit {
                children_nodes.push(child_node);
            }
        }
    }
    
    // Sort children by size desc
    if current_depth < depth_limit {
        children_nodes.sort_by(|a, b| b.size.cmp(&a.size));
    }

    FileNode {
        name,
        path: path_str,
        size: total_size,
        children: if current_depth < depth_limit { Some(children_nodes) } else { None },
        is_dir: true,
    }
}
