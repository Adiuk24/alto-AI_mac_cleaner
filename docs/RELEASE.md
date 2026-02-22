# Release guide (Alto)

How to prepare the app for **macOS (Intel + Apple Silicon)** and **Windows**, then tag and publish a new release on GitHub.

---

## 1. Pre-release checklist

- [ ] Version is bumped in:
  - `package.json` → `"version": "2.1.5"` (or next)
  - `src-tauri/tauri.conf.json` → `"version": "2.1.5"`
  - `src-tauri/Cargo.toml` → `version = "2.1.5"`
- [ ] `latest.json` has the new version and correct `pub_date`; `platforms` URLs point to the release you’re about to create (e.g. `v2.1.5`).
- [ ] Run locally (optional but recommended):
  - `npm run build` then `npm run tauri build` on your OS to confirm the app builds.
- [ ] Repo **Settings → Actions → General → Workflow permissions**: set to **Read and write** so the release workflow can create releases and upload assets.

---

## 2. Commit and push

From the project root (e.g. `mac-cleaner` or repo root):

```bash
git add -A
git status   # review
git commit -m "Release v2.1.5: cross-platform packaging, help & troubleshooting"
git push origin main
```

Use your default branch name if it’s not `main` (e.g. `master`).

---

## 3. Tag and push tag (triggers the release workflow)

Replace `v2.1.5` with your version:

```bash
git tag v2.1.5
git push origin v2.1.5
```

- Pushing a tag matching `v*` triggers the **Release** workflow.
- The workflow runs on **macOS** and **Windows** and builds:
  - **macOS**: `aarch64` (Apple Silicon) and `x86_64` (Intel)
  - **Windows**: x64 installer (e.g. `.msi`)

---

## 4. After the workflow runs

1. Open **GitHub → Actions** and confirm the **Release** workflow completed for all matrix jobs.
2. Go to **Releases**. A **draft** release will be created (e.g. **Alto v2.1.5**).
3. Check that assets are attached:
   - macOS: e.g. `Alto_aarch64.app.tar.gz`, `Alto_x86_64.app.tar.gz` (or `.dmg` if configured)
   - Windows: e.g. `Alto_2.1.5_x64_en-US.msi` or similar
4. If you use the in-app updater, ensure **latest.json** in the repo (or uploaded to the release) matches the new version and has correct `url` values for each platform. The workflow does not always overwrite `latest.json`; you may need to copy it from the build or update it manually and re-upload.
5. Edit the draft release: add release notes, then **Publish release**.

---

## 5. If the app is not at repo root

If your Tauri app lives in a subfolder (e.g. `mac-cleaner`), set `projectPath` in `.github/workflows/release.yml`:

```yaml
- name: Build and release (Tauri)
  uses: tauri-apps/tauri-action@v0
  with:
    projectPath: mac-cleaner   # path to folder containing package.json and src-tauri
    # ... rest unchanged
```

---

## 6. Local packaging only (no GitHub)

- **Current OS only:**
  ```bash
  npm run build
  npm run tauri build
  ```
  Outputs are under `src-tauri/target/release/bundle/` (e.g. `dmg/`, `msi/`, `nsis/`).

- **macOS + Windows** from one machine: use the GitHub Actions workflow (push a tag); building Windows installers on macOS (or vice versa) is not supported by Tauri’s default toolchain.

---

## Version history (reference)

| Version | Notes |
|--------|--------|
| 2.1.5  | Cross-platform packaging; Help & troubleshooting; Uninstaller/Large Files fixes; in-app Help. |
| 2.1.4  | Chat UI overhaul; sidebar; Uninstaller/Assistant polish. |
