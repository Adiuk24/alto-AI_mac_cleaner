# Alto - AI Powered System Cleaner

![Alto Hero](src/assets/hero.png)

<div align="center">

[![Download for macOS](https://img.shields.io/badge/Download-macOS-blue?style=for-the-badge&logo=apple)](https://github.com/Adiuk24/alto-AI_mac_cleaner/releases/latest)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows)](https://github.com/Adiuk24/alto-AI_mac_cleaner/releases/latest)

</div>

**Alto** is a modern, high-performance system cleaning and optimization tool built with **Tauri**, **React**, and **Rust**. It combines a beautiful, native-feeling UI with powerful system access to keep your **macOS** and **Windows** devices running smoothly.

> **Note**: This is an open-source project. Use at your own risk. Always backup important data before running cleaner tools.

## 🚀 Features

*   **🤖 AI Assistant**: proactive system health monitoring and smart recommendations.
*   **🧹 System Junk**: Deep scan and removal of cache, logs, and temporary files (Supports macOS Caches & Windows `%TEMP%`).
*   **🛡️ Malware Scan**: Fast and efficient scanning for known threats.
*   **📦 Uninstaller**: Cleanly remove applications and their leftover files.
*   **🔍 Large Files**: Find and manage massive files taking up space.
*   **🗑️ Shredder**: Securely delete sensitive files beyond recovery.
*   **🧩 Extensions**: Manage Startup items, Launch Agents, and background processes.
*   **📧 Mail Cleaner**: Remove local mail attachments to free up space.
*   **🔭 Space Lens**: Visual explorer for your disk usage (Coming Soon).

## 🛠️ Technology Stack

*   **Frontend**: React, TypeScript, TailwindCSS, Framer Motion
*   **Backend**: Rust (Tauri v2)
*   **Build Tool**: Vite

## 📥 Installation

### For Users
1.  Go to the [Releases](https://github.com/Adiuk24/alto-AI_mac_cleaner/releases) page (if available).
2.  Download the latest `.dmg` file.
3.  Open the `.dmg` and drag **Alto** to your **Applications** folder.
4.  Launch Alto from Launchpad.

### For Developers

**Prerequisites:**
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust](https://www.rust-lang.org/tools/install) (latest stable)
*   **macOS**: [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/)
*   **Windows**: [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Select "Desktop development with C++")

**Setup:**

1.  Clone the repository:
    ```bash
    git clone https://github.com/Adiuk24/alto-AI_mac_cleaner.git
    cd alto-AI_mac_cleaner
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run in development mode:
    ```bash
    npm run tauri dev
    ```

4.  Build for production:
    ```bash
    npm run tauri build
    ```
    *   **macOS**: Output `.dmg` in `src-tauri/target/release/bundle/macos/`
    *   **Windows**: Output `.msi` or `.exe` in `src-tauri/target/release/bundle/msi/`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 🛠️ Troubleshooting

### macOS: "App is damaged and can't be opened"
If you see this error, it is because the app is not notarized by Apple yet. To fix this:
1. Move **Alto** to your `Applications` folder.
2. Open Terminal and run:
   ```bash
   sudo /usr/bin/xattr -rd com.apple.quarantine /Applications/Alto.app
   ```
3. Enter your password, and then you can open the app!

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👨‍💻 Authors

*   **Arif Adito** - *Lead Developer*
*   **Adioris ltd** - *Copyright Holder*

