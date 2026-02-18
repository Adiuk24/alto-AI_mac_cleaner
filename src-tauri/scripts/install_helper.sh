#!/bin/bash

# Alto Helper Installer
# This script must be run with sudo/root privileges

HELPER_SRC="$1"
INSTALL_DIR="/usr/local/bin"
HELPER_DEST="$INSTALL_DIR/alto_helper"
PLIST_DEST="/Library/LaunchDaemons/com.alto.helper.plist"

echo "Installing Alto Helper..."

# 1. Install Binary
mkdir -p "$INSTALL_DIR"
cp "$HELPER_SRC" "$HELPER_DEST"
chown root:wheel "$HELPER_DEST"
chmod 755 "$HELPER_DEST"

# 2. Create LaunchDaemon Plist
cat <<EOF > "$PLIST_DEST"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.alto.helper</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HELPER_DEST</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/alto_helper.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/alto_helper.err</string>
</dict>
</plist>
EOF

chown root:wheel "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

# 3. Load Daemon
launchctl unload "$PLIST_DEST" 2>/dev/null
launchctl load "$PLIST_DEST"

echo "Alto Helper installed successfully."
