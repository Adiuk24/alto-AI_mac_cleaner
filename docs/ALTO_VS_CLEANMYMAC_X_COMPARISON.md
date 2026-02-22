# Alto vs Clean My Mac X — Brutal Comparison Report

**Reference:** Clean My Mac X (v4.14.2, MacPaw) from [CLEAN_MY_MAC_STUDY.md](/Users/adi/clean my mac bd/CLEAN_MY_MAC_STUDY.md).  
**Alto:** mac-cleaner codebase and [CODEBASE_AUDIT.md](CODEBASE_AUDIT.md).

This is a direct, critical comparison. Where Alto loses, it’s stated clearly.

---

## 1. Architecture & Platform

| Aspect | Clean My Mac X | Alto | Verdict |
|--------|-----------------|------|--------|
| **UI stack** | Native Cocoa/AppKit, Main.storyboard, NIBs | Tauri + React + WebView | **CMM wins.** Native feels correct on macOS; Alto is a web app in a shell. |
| **Privileged operations** | SMPrivilegedExecutables Agent (elevated helper) | None. Maintenance runs `sh -c` with `sudo` in the command string | **CMM wins.** Alto’s maintenance will either prompt in terminal or fail in GUI; no proper privilege escalation. |
| **Heavy work isolation** | XPC (e.g. ApplicationsUpdatesXPCService) | All in main process / spawn_blocking | **CMM wins.** CMM isolates update checks and heavy work; Alto can block or stall. |
| **Background presence** | HealthMonitor (LSUIElement) + Menu app, both Login Items | Tray + optional menu window; no separate HealthMonitor | **Tie.** Alto has tray and menu; CMM has dedicated background reporter. |
| **Updates** | Sparkle (native) | Tauri updater (GitHub releases) | **CMM wins** for typical Mac update UX; Alto is fine for indie/GitHub. |

**Summary:** Alto is a cross-platform (macOS + Windows) web stack with no privileged helper and no XPC. For “feels like a Mac app” and doing system-level work reliably, CMM is ahead.

---

## 2. Feature Coverage — Where Alto Is Missing or Weaker

### 2.1 System Junk — Categories

**Clean My Mac X** exposes **14 scan groups**: System Cache, User Cache, Broken Preferences, Language Files, Broken Login Items, Xcode Junk, Document Versions, Old Updates, Unused Disk Images, User Logs, System Logs, Downloads, Deleted Users, Universal Binaries, iOS Device Backups.

**Alto** effectively has **template-based groups** (e.g. Chrome Cache, Brave Cache, Safari Cache, Xcode Data, Crash Reports, Trash Bin, User Logs, App State, Screenshots, Old Installers, Dev Package Cache, etc.) and does **not** separately surface:

- **Broken Preferences** — not a dedicated category.
- **Broken Login Items** — not scanned.
- **Language Files / localizations** — not in junk templates.
- **Document Versions** — not in junk templates.
- **Old Updates** (macOS/Apple update caches) — not in junk templates.
- **Unused Disk Images** — not in junk templates.
- **Deleted Users** — not scanned.
- **Universal Binaries** (thinning) — not in junk templates.

**Verdict:** **CMM wins.** Alto covers “cache and logs” well but misses several categories that power users expect from a “system junk” tool. Your study doc explicitly listed these; the codebase didn’t implement them.

---

### 2.2 Smart Scan (One-Click)

**CMM:** Single entry point: one scan that runs Cleanup + Protection + Speed + LAOF and shows one combined result with categories, then one “Clean” action.

**Alto:** Dashboard can run “Smart Scan” that triggers deep scan + junk + malware, but the flow is **not** a single unified “Scan → one result set → Clean” like CMM. Deep scan is a separate background flow with its own events; junk and malware are separate commands. There is no single “Here’s what I found” summary that aggregates all categories and then one “Clean” for the safe subset.

**Verdict:** **CMM wins.** Alto has the pieces but not the one-click, one-result, one-clean UX that CMM delivers.

---

### 2.3 Uninstaller

| Feature | Clean My Mac X | Alto |
|---------|----------------|------|
| Filters | All, Unused (6+ months), 32-Bit, Frequently Crashed, Leftovers, Suspicious, **Stores** (App Store, Setapp, Steam, Blizzard, Other), **Vendors** (by developer) | All, Unused, Leftovers, Suspicious; Stores: App Store / Other; Vendors: hardcoded list (Apple, Microsoft, etc.) |
| Per-app resource groups | Logs, Binaries, Preferences, Crashes, Plugins, etc. | Leftovers scanned on expand (by bundle id); no structured “Logs / Prefs / Caches” groups per app. |
| System integration | “Uninstall” service for selected app bundle | None. |
| Move app to another volume | Yes (Move Application module) | No. |

**Verdict:** **CMM wins.** Alto has leftovers and basic filters but no 32-bit/crashed filters, no real “by store” (Setapp, Steam, Blizzard), no system Uninstall service, and no “move app.” Uninstaller UI even falls back to **mock data** (CleanMyMac X, Antigravity, Alto, Discord, etc.) when backend returns empty — which is embarrassing for a production claim.

---

### 2.4 Large & Old Files (LAOF)

**CMM:** “Locate and remove large files and folders you did not open for months.” Filter by **kind** (Archives, Pictures, Movies, Music, Documents, Other); actions: Remove, **Move**, Clean.

**Alto:** Large-files scanner exists (e.g. 50 MB minimum, disk walk with timeout). No evidence of **“old” (last opened)** filtering or **filter by kind** (archives vs pictures vs movies). No **Move** action — only delete/clean.

**Verdict:** **CMM wins.** Alto finds large files; it does not offer “old + by type” or move, which is a core LAOF value.

---

### 2.5 Space Lens

**CMM:** Storage map, **purgeable space**, size distribution (Free / Used / Selected / **Purgeable**), “Review Selected.” Optional **Full Disk Access** for entire storage map. Multiple locations (Applications, Developer Tools by Apple, Library, Network, System, Users, Volumes).

**Alto:** Tree of `FileNode` by path with depth limit (e.g. 2 in the command). **No purgeable space.** No “Review Selected” flow. No Full Disk Access concept. Single root (home or user-supplied path). Depth 2 is very shallow for a “space lens” that should help users explore disk.

**Verdict:** **CMM wins.** Alto’s Space Lens is a shallow tree view. No purgeable, no “review selected,” no full-disk option. Roadmap calls it “Advanced Visual Space Lens” — currently it’s minimal.

---

### 2.6 Shredder

**CMM:** Secure erase; **remove locked items without Finder errors** (via privileged helper).

**Alto:** Multi-pass overwrite + rename + delete. **No MCP/safety check** — user can drop any path and Alto will shred it (audit finding). No privileged helper, so **locked/in-use files** will likely fail or behave badly.

**Verdict:** **CMM wins.** Alto’s Shredder is both **unsafe** (bypasses MCP) and **weaker** (no helper for locked files).

---

### 2.7 Maintenance

**CMM:** Flush DNS, free RAM, rebuild **Launch Services**, reindex Spotlight, repair disk permissions. Task list → log with Done/Failed/Skipped/Stopped.

**Alto:** Flush DNS, free RAM, reindex Spotlight, repair disk permissions, **clear font cache**. **No “Rebuild Launch Services.”** Commands are run via `sh -c` with `sudo` in the string — **no GUI privilege escalation**, so in a normal Tauri app the user never gets a proper sudo prompt; tasks that need root will fail or rely on external tricks.

**Verdict:** **CMM wins.** Alto has similar tasks but is missing Launch Services rebuild and, more importantly, has **no proper privileged execution path**.

---

### 2.8 Malware / Protection

**CMM:** Smart Scan includes “Protection”; dedicated module with “Deep Scan”; update info.

**Alto:** Malware scanner with a fixed list of known PUP/LaunchAgent filenames (and similar on Windows). No “deep scan” distinction in the product sense; no dedicated update flow for malware definitions. It’s a small heuristic list, not a full protection suite.

**Verdict:** **Tie.** Both are heuristic/signature-style. CMM has more polish and a “Deep Scan” narrative; Alto is simpler and transparent. Neither is an AV replacement.

---

### 2.9 Privacy

**CMM:** Dedicated Privacy module (browser data, traces, etc.).

**Alto:** Has `privacy` scanner and Privacy page. So the **category exists**. Without auditing every path in `privacy.rs`, we call this a **tie** — Alto at least has the module.

---

### 2.10 Extensions, Mail, Trash, iTunes/Photos

**CMM:** Extensions, Mail, Photos, iTunes, Trash (TrashBinsModule), plus “Move Application,” “Applications Updates” (XPC), Updater, System Reporting.

**Alto:** Extensions (scan/remove), Mail (attachments scan/clean), Trash (scan + empty). No iTunes/Photos-specific modules. No “Move Application.” No “Applications Updates” (check for updates for *installed* apps). No System Reporting. Updater is app self-update only.

**Verdict:** **CMM wins** on breadth (iTunes/Photos, Move App, Applications Updates, System Reporting). Alto covers Extensions, Mail, Trash solidly.

---

## 3. Where Alto Is Better or Different

| Area | Alto advantage |
|------|-----------------|
| **AI / conversational** | CMM has no built-in chat. Alto has an agentic assistant (WebLLM/Ollama/OpenAI), natural language commands, and proactive alerts. This is Alto’s main differentiator. |
| **MCP safety** | Deletions (except Shredder) go through a safety index; system-critical and user-data paths are blocked. CMM doesn’t document an equivalent “safety layer” in the study. |
| **Privacy / local-first** | Context in `~/.alto/context.json`; optional fully local AI. No account/paywall in the flow. CMM has MacPaw Account, activation, paywall. |
| **Cross-platform** | Alto targets macOS and Windows; CMM is Mac-only. |
| **Open stack** | Tauri + React + Rust; easier to audit and extend than a closed Cocoa app. |
| **Cost** | Alto is free/open; CMM is commercial. |

So: **Alto wins on AI, safety narrative, local-first, and cross-platform.** It loses on depth of cleaning categories, one-click Smart Scan UX, uninstaller breadth, LAOF (old + kind + move), Space Lens depth, shredder safety and locked-file handling, maintenance privilege model, and system integration (services, helpers, XPC).

---

## 4. Polish & Production Readiness

| Aspect | Clean My Mac X | Alto |
|--------|----------------|------|
| **Localization** | 12+ locales (de, en, es, fr, it, ja, ko, nl, pl, pt-BR, uk, zh-Hans), per-module .strings | No i18n. English-only. |
| **Help** | Dedicated help book (HTML, localized) | Docs in repo (Architecture, Roadmap, User Guide); no in-app help. |
| **Ignore list** | Yes (preferences) | `UserPrefs.always_skip_patterns` exists in context store; not clear if UI exposes it fully. |
| **Preferences** | General, Menu, Notifications, Scanning, Smart Scan, Update, Ignore list, Languages, Disk Access, Analytics, Debug, Protection | Settings page exists; not as many panels. |
| **Sounds / feedback** | ButtonClick, ScanDidFinish, etc. | Has `sounds.ts` and completion sound. |
| **Testing** | Unknown (closed source) | Only junk scanner has Rust tests; no frontend/e2e tests; Shredder and MCP index untested. |
| **Mock data in production UI** | N/A | Uninstaller uses mock app list when backend returns empty — unacceptable for a shipped product. |

**Verdict:** **CMM wins** on localization, in-app help, and breadth of preferences. **Alto** has a testing and “no mock in production” problem.

---

## 5. Summary Table (Brutal One-Liners)

| Dimension | Winner | One-liner |
|-----------|--------|-----------|
| Native feel | CMM | Alto is a web app in a frame; CMM is a real Mac app. |
| Privileged / system tasks | CMM | Alto has no helper; maintenance sudo is broken in GUI. |
| System Junk categories | CMM | Alto misses broken prefs, login items, language files, old updates, disk images, deleted users, universal binaries. |
| Smart Scan UX | CMM | Alto has no single one-click scan → one result → one clean. |
| Uninstaller | CMM | Alto has mock fallback and fewer filters; no Uninstall service, no Move app. |
| Large & Old Files | CMM | Alto has no “old” or “by kind” or Move. |
| Space Lens | CMM | Alto is shallow, no purgeable, no “review selected.” |
| Shredder | CMM | Alto bypasses MCP (unsafe) and can’t handle locked files. |
| Maintenance | CMM | Alto missing Launch Services; no proper privilege escalation. |
| AI / conversational | Alto | CMM has no chat; Alto has agentic assistant and local AI. |
| Safety layer | Alto | MCP index blocks system/user-data on delete (Shredder excepted). |
| Local / privacy | Alto | No account/paywall; context local; optional full local AI. |
| Cross-platform | Alto | macOS + Windows vs Mac-only. |
| Localization | CMM | 12+ locales vs none. |
| Production rigor | CMM | Alto has mocks in UI and almost no tests. |

---

## 6. What Alto Must Improve to Compete (Prioritized)

1. **Remove mock data from Uninstaller** and handle empty scan with a proper empty state.
2. **Add MCP check to Shredder** so it never shreds system or user-data paths.
3. **Implement privileged execution** (helper or equivalent) for maintenance and shredding locked files — or drop “requires_sudo” tasks from the UI until you have it.
4. **Expand System Junk** with at least: broken preferences, language files, old updates, unused disk images. Match your own study.
5. **Unify Smart Scan** into one flow: one scan run → one combined result (cleanup + protection + speed + large) → one “Clean” with safe items only.
6. **Space Lens:** Increase default depth, add purgeable concept if possible, add “review selected” and optional full-disk.
7. **LAOF:** Add “last opened” (or similar) and filter by kind; add Move action.
8. **Uninstaller:** Real store/vendor data, no mocks; consider 32-bit/crashed filters and Uninstall service if you want parity.
9. **i18n** and **in-app help** if you care about non-English and first-run experience.
10. **Tests:** At least MCP file_index and Shredder safety; then integration tests for critical flows.

Until then, Alto is strongest as an **AI-first, local, cross-platform cleaner** with a good safety story for normal deletions — and weakest when measured feature-for-feature against Clean My Mac X on classic cleaning breadth, system integration, and production polish.
