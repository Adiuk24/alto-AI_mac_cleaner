# Alto Codebase Audit

**Date:** 2026-02-22  
**Scope:** `mac-cleaner` (Alto) — Tauri 2 + React 19 + Rust  
**Auditor:** Automated codebase review (architecture, safety, tests, consistency).

---

## 1. Executive Summary

Alto is a well-structured AI-powered system cleaner with a clear **MCP (Model Context Protocol) safety layer** for deletions, solid scanner design (timeouts, caps, whitelists), and good documentation. The main gaps are: **Shredder bypassing the safety layer**, **no path canonicalization** on user-supplied paths, **minimal automated tests**, and **naming/identity inconsistencies**. Addressing the Shredder safety gap and adding path validation is high priority.

---

## 2. Architecture & Alignment

| Area | Status | Notes |
|------|--------|--------|
| Docs vs code | ✅ Aligned | `Architecture.md` matches `lib.rs` flow: UI → Tauri → Rust scanners, MCP index → confirm. |
| Roadmap | ✅ Reflected | v2.1 MCP, watcher, agentic chat present; v2.2 Space Lens exists (depth 2). |
| Clean My Mac study | ✅ Used | Junk categories, module flow, and safety concepts are reflected in code. |

**Findings:**
- **MCP flow:** `preview_delete` → user approval → `confirm_delete` is correctly implemented. All delete paths go through `index_files()`; only `is_safe_to_delete` items are passed to `trash::delete_all`.
- **Context store:** `~/.alto/context.json` used for deletion history and system events; no sensitive data stored beyond paths (user-owned).

---

## 3. Safety & Security

### 3.1 MCP File Index (`src-tauri/src/mcp/file_index.rs`)

- **System-critical:** Blocked prefixes include `/system`, `/usr`, `/bin`, `/sbin`, `/private/var/db`, `/library/apple`, `/library/coreservices` (macOS) and Windows equivalents.
- **User data:** Paths containing `documents`, `desktop`, `downloads`, etc. are blocked unless they also contain `cache` or `temp`.
- **Safe:** Cache, Log, Temp (e.g. `/tmp/`, `/var/folders/`) are marked `is_safe_to_delete: true`.
- **App Support:** Marked `is_safe_to_delete: false` to avoid breaking apps.

**Gap:** Path comparison uses `path_lower.starts_with(prefix)`. On macOS, user paths are often like `/Users/name/...`; system prefixes use lowercase. `path.to_lowercase()` is used, so `/Users/...` is not mistaken for `/usr`. ✅ No bug here.

### 3.2 Shredder bypasses MCP (High)

- **Location:** `shred_path_command` in `lib.rs` calls `scanners::shredder::shred_path(&path)` **without** calling `index_file()`.
- **Risk:** User can drop any path (e.g. system or user-data) in the Shredder UI (`tauri://file-drop`). The file is then overwritten and deleted with no safety check.
- **Recommendation:** Before shredding, run path through `mcp::file_index::index_file()`. If `!is_safe_to_delete` or category is `SystemCritical` / `UserData`, return `Err(...)` and do not shred. Optionally allow Shredder only for paths under a “user-selected files” policy (e.g. under `~/Downloads`, `~/Desktop`) if you want to allow shredding of some user files.

### 3.3 Path canonicalization

- **Space Lens:** `scan_space_lens_command(path: Option<String>)` uses the given path as-is. No `std::fs::canonicalize` or resolution of `..` or symlinks.
- **Risk:** Low for Space Lens (read-only). Higher if any other command accepted user paths without canonicalization (e.g. symlink escape).
- **Recommendation:** For any user-supplied path used for read/write/delete, consider `Path::canonicalize()` (or equivalent) and then re-check against allowed roots (e.g. home, or allowlist). Shredder and Space Lens are the main entry points for arbitrary paths.

### 3.4 Permissions (Tauri)

- **Capabilities:** `capabilities/default.json` grants `main` window: core, notification, updater, process, shell. No `fs` scope in the snippet; Tauri 2 uses allowlist for APIs. Invoke handlers are registered in `lib.rs` and are the main backend surface.
- **Menu window:** Only `main` is listed in the single capability. If the “menu” window uses `invoke()`, ensure it has a capability that grants the same invoke permissions or restrict which commands the menu can call.

---

## 4. Backend (Rust)

### 4.1 Scanners

| Module | Safety / limits | Notes |
|--------|------------------|--------|
| `junk.rs` | ✅ Timeout 25s, MAX_TOTAL_FILES 5k, MAX_FILES_PER_DIR 500, whitelist (e.g. Cookies, .DS_Store) | Unit tests present. |
| `large_files.rs` | (not fully audited) | Likely similar caps; confirm timeout/caps. |
| `space_lens.rs` | Depth limit (e.g. 2 in command); no path validation | Read-only; risk is DoS or reading unintended dirs. |
| `malware.rs` | Read-only; known PUP/LaunchAgent list | No delete. |
| `shredder.rs` | ⚠️ No MCP check | See §3.2. |
| `uninstaller.rs` | macOS-only leftovers; uninstall via `trash` or similar | Confirm uninstall path is app bundle only. |
| `mail.rs` / `privacy.rs` | (not fully audited) | Should only touch mail cache / privacy caches, not inbox. |

### 4.2 Deletion and errors

- `confirm_delete`: On `trash::delete_all` failure, the code returns `Ok(serde_json::json!({ "removed": 0, "errors": [e.to_string()] }))`. So the Tauri command returns `Result::Ok` even when nothing was removed. Frontend must check `result.removed` and `result.errors` to show failure. This is a bit fragile; consider returning `Err(...)` when no file was removed due to error.

### 4.3 Deep scan

- `start_deep_scan_command` spawns a background task with no cancellation (noted in comment). `cancel_deep_scan_command` is a no-op. Acceptable for v2.1 if documented; for v2.2 consider a shared cancel token.

---

## 5. Frontend (React / TypeScript)

### 5.1 Structure

- **App routing:** Single `activeTab` state; `App.tsx` renders Dashboard, Assistant, SystemJunk, etc. Clean and consistent.
- **State:** Zustand `scanStore` for scan results, selection, system stats. AI state and steps live in `aiService` and Assistant UI.
- **Tauri:** `invoke()` used from multiple pages (Assistant, Dashboard, Shredder, Uninstaller, MailCleaner, Extensions, MenuApp). No central API layer; each page invokes commands directly. Consider a small `tauriCommands.ts` facade for typing and consistency.

### 5.2 Assistant and MCP

- Assistant uses `preview_delete` → user confirms → `confirm_delete` with `safePaths`. Flow matches backend MCP design.
- `clean_items` is legacy and correctly routed to `confirm_delete`.

### 5.3 Polling and performance

- `App.tsx` polls `fetchSystemStats` every 5s and a “proactive monitor” every 10s. Both run for the app lifetime. Ensure this doesn’t cause unnecessary re-renders or backend load; current design is acceptable if stats are cheap.

---

## 6. Testing

| Layer | Status | Notes |
|------|--------|--------|
| Rust | Partial | `junk.rs` has unit tests (category name, whitelist, Cookies). No tests found for `file_index`, `context_store`, `shredder`, or other scanners. |
| Frontend | None | No Jest/Vitest or React Testing Library tests found. |
| E2E | None | No Playwright or similar. |

**Recommendation:** Add unit tests for `mcp/file_index.rs` (e.g. system path blocked, cache allowed, user-data blocked). Add at least one integration test that calls `preview_delete` and `confirm_delete` with a temp path. Frontend tests for critical flows (e.g. Assistant confirm flow) would improve confidence.

---

## 7. Naming & Identity

| Item | Current | Recommendation |
|------|---------|----------------|
| `package.json` name | `vite-react-typescript-starter` | Change to `alto` or `mac-cleaner` for consistency. |
| Cargo package | `alto` (binary), `mac_cleaner_lib` (lib) | Acceptable; consider aligning app name everywhere (Alto). |
| `tauri.conf.json` | `productName: "Alto"`, `identifier: "com.maccleaner.app"` | Consistent. |

---

## 8. Dependencies

- **Rust:** Tauri 2.2, serde, tokio, walkdir, trash, etc. No obvious outdated or known-vulnerable crates spotted; run `cargo audit` periodically.
- **npm:** React 19, Vite 7, @tauri-apps/*, @mlc-ai/web-llm, etc. Run `npm audit` and fix critical/high where possible.

---

## 9. Summary of Recommendations

| Priority | Action |
|----------|--------|
| High | Run Shredder paths through MCP `index_file`; refuse shred if `!is_safe_to_delete` or SystemCritical/UserData. |
| High | Add unit tests for `file_index` (blocked vs allowed paths). |
| Medium | Consider returning `Err` from `confirm_delete` when `trash::delete_all` fails instead of `Ok` with errors in JSON. |
| Medium | Add path canonicalization (and allowlist) for user-supplied paths (Shredder, Space Lens). |
| Medium | Rename `package.json` from `vite-react-typescript-starter` to `alto` (or project name). |
| Low | Add a small typed Tauri command facade on the frontend. |
| Low | Document or implement deep-scan cancellation; ensure menu window has correct capabilities if it uses `invoke`. |

---

*This audit is based on static code review and documented architecture. Runtime behavior (e.g. actual file system permissions, macOS Gatekeeper, or Windows Defender) should be validated in environment-specific tests.*
