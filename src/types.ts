export interface ScannedItem {
    path: string;
    size_bytes: number;
    category_name: string;
    is_directory: boolean;
}

export interface ScanResult {
    items: ScannedItem[];
    total_size_bytes: number;
    errors: string[];
}

export interface FileNode {
    name: string;
    path: string;
    size: number;
    children: FileNode[] | null;
}

export interface MalwareResult {
    threats_found: string[];
    status: string;
}

export interface SpeedTaskResult {
    task: string;
    status: string;
}

export interface AIInsight {
    summary: string;
    detail: string;
    action: string;
}

export interface DeviceInfo {
    name: string;
    battery_level: number | null; // null if not available/applicable
    device_type: 'mouse' | 'keyboard' | 'trackpad' | 'headphones' | 'speaker' | 'phone' | 'other';
    is_connected: boolean;
}

export interface SystemStats {
    cpu_load: number;
    memory_used: number;
    memory_total: number;
    disk_total: number;
    disk_used: number;
    network_up: number;
    network_down: number;
    battery_level: number | null;
    connected_devices: DeviceInfo[];
}
