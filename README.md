# Alto - AI Powered Mac Cleaner

![Alto Hero](src/assets/hero.png)

**Alto** is a modern, high-performance macOS cleaning and optimization tool built with **Tauri**, **React**, and **Rust**. It combines a beautiful, native-feeling UI with powerful system access to keep your Mac running smoothly.

> **Note**: This is an open-source project. Use at your own risk. Always backup important data before running cleaner tools.

## 🚀 Features

*   **🤖 AI Assistant**: proactive system health monitoring and smart recommendations.
*   **🧹 System Junk**: Deep scan and removal of cache, logs, and temporary files.
*   **🛡️ Malware Scan**: Fast and efficient scanning for known macOS threats.
*   **📦 Uninstaller**: Cleanly remove applications and their leftover files.
*   **🔍 Large Files**: Find and manage massive files taking up space.
*   **🗑️ Shredder**: Securely delete sensitive files beyond recovery.
*   **🧩 Extensions**: Manage Safari extensions, launch agents, and login items.
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
*   [Show Xcode Command Line Tools](https://developer.apple.com/xcode/resources/) (for macOS development)

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
    The output `.dmg` or `.app` will be in `src-tauri/target/release/bundle/macos/`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
