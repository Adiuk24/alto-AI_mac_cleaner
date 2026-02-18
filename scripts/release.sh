#!/bin/bash

# Release Script for Alto

echo "🚀 Preparing Alto Release..."

# 1. Build the app
echo "📦 Building macOS application..."
npm run tauri build

# 2. Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "   DMG Location: src-tauri/target/release/bundle/dmg/Alto_1.0.0_x64.dmg"
    echo "   App Location: src-tauri/target/release/bundle/macos/Alto.app"
else
    echo "❌ Build failed. Please check the logs."
    exit 1
fi

echo "✨ Release preparation complete!"
