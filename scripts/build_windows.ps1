# Build Script for Windows (PowerShell)
Write-Host "Starting Alto Build for Windows..." -ForegroundColor Green

# Check for Rust
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust is not installed. Please install Rust from https://rustup.rs/"
    exit 1
}

# Check for Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
}

# Install Dependencies
Write-Host "Installing NPM dependencies..." -ForegroundColor Cyan
npm install

# Build Tauri App
Write-Host "Building Tauri Application..." -ForegroundColor Cyan
npm run tauri build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Successful!" -ForegroundColor Green
    Write-Host "Installer located at: src-tauri\target\release\bundle\msi\"
} else {
    Write-Error "Build Failed."
    exit 1
}
