# Alto User Guide

This guide helps you get the most out of **Alto** (AI-powered system cleaner & optimizer) and how to troubleshoot common issues.

---

## Table of Contents

1. [Using the AI Assistant (Ask Alto)](#-using-the-ai-assistant-ask-alto)
2. [MCP Safety Layer](#-the-mcp-safety-layer)
3. [Live Monitoring](#-live-monitoring)
4. [Settings & Customization](#-settings--customization)
5. [Performance Tips](#-performance-tips)
6. [Troubleshooting](#-troubleshooting)
7. [Permissions Reference](#-permissions-reference)

---

## 🤖 Using the AI Assistant (Ask Alto)

The **Ask Alto** chat is your command center. Use natural language to:

- **"Clean my system"** or **"Scan for junk"** — Runs a system junk scan (caches, logs, etc.).
- **"Check for malware"** — Runs the heuristic malware scanner.
- **"Find large files"** or **"What's taking up space?"** — Scans for large & old files (50 MB+).
- **"Optimize my Mac"** — Runs speed/optimization tasks (e.g. DNS flush, RAM).
- **"Uninstall [app name]"** — Opens the Uninstaller or helps remove an app.
- **"What's new?"** — Summarizes recent system events (e.g. new app installs).
- **"Analyze this path: /Users/name/Downloads"** — Uses the MCP layer to categorize files in that folder.

You can also use **@** to reference tools (e.g. `@scan_junk`).

---

## 🛡️ The MCP Safety Layer

Alto uses a **"Think Twice, Delete Once"** policy:

1. **Index** — When the AI suggests files to delete, they appear in a **Confirm Delete** card.
2. **Review** — You see exactly what will be removed and why (e.g. "Application cache").
3. **Approve** — Nothing is deleted until you click **Confirm**.

Destructive actions (clean junk, empty trash, clean mail, clean privacy) always show a preview and require your confirmation.

---

## 🔔 Live Monitoring

Alto can run in the background to:

- **App installs** — Log when you install new apps and offer to clean leftovers on uninstall.
- **Suspicious downloads** — Flag risky file types (e.g. `.sh`, `.bat`) for review.

---

## ⚙️ Settings & Customization

In **Settings** you can:

- **Profile** — Set your name so Alto greets you personally.
- **Live Log** — View real-time system events and deletion history.
- **Protected Paths** — See which directories Alto never touches.
- **AI / LLM** — Choose local (WebLLM) or cloud model for the assistant.

---

## 🛠️ Performance Tips

- Run **Smart Scan** or **Deep Scan** weekly to keep caches and logs under control.
- Use **Uninstaller** instead of dragging apps to Trash so leftovers (preferences, caches) can be removed too.
- Use **Large & Old Files** to find big files (50 MB+) and move or delete them.
- **Space Lens** gives a visual breakdown of disk usage by folder.

---

## 🔧 Troubleshooting

### Smart Scan & System Junk

| Issue | What to do |
|------|------------|
| **Scan seems stuck** | Scans can take 30–60 seconds on large disks. Wait; the app stays responsive. If it never finishes, restart Alto and try again. |
| **No junk found** | Your system may already be clean, or some folders are excluded for safety. Try **Deep Scan** from the Assistant for a broader scan. |
| **"Permission denied" or some items not deleted** | Some files are in use or need admin rights. Close apps that might be using caches (e.g. browsers), then retry. For system-wide clean, Alto may prompt for your password. |
| **I don’t want to delete something** | Use the **Confirm Delete** card to uncheck items before confirming. You can also add paths to **Protected Paths** in Settings (if supported). |

---

### Uninstaller

| Issue | What to do |
|------|------------|
| **"No applications found"** | On macOS, Alto needs **Full Disk Access** to list apps from `/Applications` and your user Applications folder. Click **Open System Settings → Privacy & Security**, then **Full Disk Access**, and add Alto. Restart Alto and open Uninstaller again. |
| **Back button does nothing** | The Back button should return you to the main dashboard. If it doesn’t, use the sidebar to click **Smart Scan** or **Ask Alto**. |
| **Sidebar categories show 0** | **All** shows total app count; **Leftovers** only shows apps that have leftover files (expand an app with the chevron to scan leftovers). Counts update after data is loaded. |
| **Uninstall fails for an app** | Some apps are protected or in use. Quit the app fully, then try again. System apps cannot be uninstalled via Alto. |

---

### Large & Old Files

| Issue | What to do |
|------|------------|
| **Stuck on "Scanning drive..." / "Checking usage dates..."** | The scan runs in the background and can take 30+ seconds (or hit the 50,000-file limit). If it stays stuck for minutes, restart Alto. After the fix, the screen should either show results or an empty list and no longer hang. |
| **No files listed** | Only files **≥ 50 MB** are included. If nothing appears, you may have no files that large, or the scan hit the time/file limit (partial results). Try again; the scan is non-blocking so the app should stay responsive. |
| **I want to delete or move files** | Select items with the checkboxes, then use **Delete** (moves to Trash) or **Move** (you’ll be asked for a destination folder). |
| **Wrong or missing files** | System and some protected folders are skipped for safety. Use **Space Lens** for a different view of disk usage. |

---

### Malware & Privacy

| Issue | What to do |
|------|------------|
| **Malware scan finds nothing** | That usually means no threats were detected. The scanner uses heuristics and known patterns. |
| **I think it’s a false positive** | Review the listed path. You can skip deleting that item. For critical decisions, use macOS’s built-in security tools or a second opinion scanner. |
| **Privacy scan / clean** | Privacy scan looks at sensitive data (e.g. browser, recent items). Cleaning removes the selected items; review the list before confirming. |

---

### Maintenance

| Issue | What to do |
|------|------------|
| **"Task failed" or permission error** | Some tasks (e.g. **Rebuild Launch Services**) need administrator privileges. Enter your macOS password when prompted. |
| **Rebuild Launch Services** | Fixes “Open with” and app association issues. Safe to run; you may be asked for your password. |
| **Other tasks** | Descriptions are shown in the UI. Run only tasks you understand; most are standard system maintenance. |

---

### Space Lens

| Issue | What to do |
|------|------------|
| **Empty or very small tree** | Ensure the path is correct (e.g. home folder or chosen directory). Some system paths may be restricted. |
| **Slow to load** | Large directories take longer. Depth and file count limits keep the scan from hanging. |
| **Want to clean from here** | Use **Review Selected** (if available) or switch to **System Junk** / **Large & Old Files** for deletion. |

---

### Shredder

| Issue | What to do |
|------|------------|
| **What does Shredder do?** | It overwrites file content before deletion so that recovery is much harder. Use for sensitive files only. |
| **Safe to use?** | Yes for files you choose. Never shred system files or active application data. |
| **Where to find it** | Sidebar → **Files** → **Shredder**. Select files and confirm; they cannot be recovered. |

---

### Ask Alto / Assistant

| Issue | What to do |
|------|------------|
| **Alto doesn’t respond or takes long** | The first reply can be slow (model loading or API). Check your **Settings** → AI/LLM: local models need to load; cloud needs a connection. |
| **Wrong action or no action** | Phrase your request clearly (e.g. “Scan for junk”, “Find large files”). You can say “Scan”, “Clean”, “Uninstall”, “Optimize”, etc. |
| **Chat history** | History is stored locally so you can continue later. Clear or reset from Settings if documented. |

---

### General

| Issue | What to do |
|------|------------|
| **App won’t start** | Reinstall from the latest release. On macOS, allow the app in **System Settings → Privacy & Security** if it’s blocked. |
| **Notifications don’t appear** | In **Settings**, ensure notifications are enabled. On macOS, check **System Settings → Notifications** for Alto. |
| **Where is my data stored?** | Scan results and preferences are stored locally. No cloud upload of your file list unless you use a cloud-backed AI option in Settings. |
| **macOS asks for Full Disk Access** | Required for Uninstaller (to list apps) and for some scans. Grant in **System Settings → Privacy & Security → Full Disk Access** and add Alto. |
| **Windows** | Alto supports Windows; some features (e.g. Uninstaller, Malware) use Windows-specific logic. Permissions may prompt for administrator rights where needed. |

---

## 📋 Permissions Reference

### macOS

| Permission | Where to set | Needed for |
|------------|--------------|------------|
| **Full Disk Access** | System Settings → Privacy & Security → Full Disk Access | Uninstaller (list apps), some deep scans |
| **Notifications** | System Settings → Notifications → Alto | Alerts and completion notifications |
| **Administrator password** | Prompted when you run certain tasks | Maintenance (e.g. Launch Services), some cleans |

### Windows

| Permission | Where to set | Needed for |
|------------|--------------|------------|
| **Run as administrator** | Right‑click app → Run as administrator | Some scans and maintenance tasks |
| **Notifications** | Windows Settings → Notifications | Alerts |

---

*Version: 2.1.4. For more, see [Architecture](Architecture.md) and [Roadmap](Roadmap.md).*
