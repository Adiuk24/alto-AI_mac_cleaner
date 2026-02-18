use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub children: Option<Vec<FileNode>>, // None if file, Some if dir
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
        };
    }

    // It is a directory
    let mut children = Vec::new();
    let mut total_size = 0;

    // If we haven't reached depth limit, scan children
    // If over limit, we still want the size, but maybe not detailed children?
    // For Space Lens, we typically need the size of everything.
    // Calculating size of a directory requires traversing it.
    // To generate the Tree for visualization, we only need detail up to a certain depth,
    // but correct size requires full traversal.
    // Optimization: returning children only up to depth_limit, but calculating full size.
    
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let child_path = entry.path();
                
                // If we are below depth limit, get full node with children
                // If we are at or above, we just want the size (so we call a simpler size function or just recurse with 'don't collect children' flag?)
                // For simplicity, let's recurse. If depth > limit, we set children to None or empty but keep size correct.
                // Actually, if we want to drill down later, we might need a separate "get details for dir" command.
                // For this MVP, let's limit return depth to avoid huge JSON payload, but calculate full size.
                
                let child_node = scan_recursive(&child_path, current_depth + 1, depth_limit);
                total_size += child_node.size;
                
                if current_depth < depth_limit {
                   children.push(child_node);
                }
            }
        }
    }
    
    children.sort_by(|a, b| b.size.cmp(&a.size)); // Sort by size desc

    FileNode {
        name,
        path: path_str,
        size: total_size,
        children: if current_depth < depth_limit { Some(children) } else { None },
    }
}
