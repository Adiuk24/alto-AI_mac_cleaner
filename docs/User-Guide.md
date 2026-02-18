# User Guide 📖

This guide will help you master **Alto v2.1.0** and keep your system in peak condition.

---

## 🤖 Using the AI Assistant
The chat interface is your command center. You can use natural language to control Alto:
- **"Clean my system"**: Triggers a global scan for junk, cache, and logs.
- **"Check for malware"**: Runs the native heuristic scanner for threats.
- **"What's new?"**: Alto will summarize recent system events (like new app installs).
- **"Analyze this path: /Users/name/Downloads"**: Alto will use the MCP layer to categorize files in that folder.

## 🛡️ The MCP Safety Layer
Alto uses a "Think Twice, Delete Once" policy.
1.  **Index**: When the AI finds files to delete, it presents them in a structured **Confirm Delete** card.
2.  **Review**: You can see exactly why a file was flagged (e.g., "Safe application cache").
3.  **Approve**: No files are removed until you click the **Confirm** button.

## 🔔 Live Monitoring
Alto works in the background to keep you informed.
-   **App Installs**: When you drag a new `.app` to `/Applications` or run an `.exe`, Alto will log it and offer to clean up leftovers if you ever uninstall it later.
-   **Suspicious Downloads**: If you download a potentially risky file (like a `.sh` or `.bat` script), Alto will highlight it in the chat for your review.

## ⚙️ Settings & Customization
Visit the **Settings** page to:
-   **Profile**: Personalize your experience by setting your name.
-   **Live Log**: View the real-time record of all system events and deletion history.
-   **Protected Paths**: See which directories Alto is hard-coded to never touch (for your safety).

## 🛠️ Performance Tips
-   **Deep Scan**: Run a scan once a week to keep logs and caches from ballooning.
-   **Uninstaller**: Always use Alto's Uninstaller instead of just dragging apps to the trash to ensure all hidden "ghost" files are removed.

---
*Need help? Open the chat and ask Alto "How do I use this?"*
