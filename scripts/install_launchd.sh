#!/bin/zsh
set -euo pipefail

ROOT="/Users/aryanayyar/Library/CloudStorage/GoogleDrive-aryan.ayyar.learner@gmail.com/My Drive/Data/NSEI/NSEI_Snapshot"
SOURCE_PLIST="$ROOT/launchd/com.aryan.nsei_snapshot.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/com.aryan.nsei_snapshot.plist"
LABEL="com.aryan.nsei-snapshot"

mkdir -p "$TARGET_DIR"
mkdir -p "$ROOT/logs"

cp "$SOURCE_PLIST" "$TARGET_PLIST"

launchctl bootout "gui/$UID/$LABEL" "$TARGET_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$TARGET_PLIST"
launchctl enable "gui/$UID/$LABEL"
launchctl kickstart -k "gui/$UID/$LABEL" || true

echo "Installed and loaded $LABEL"
echo "Plist: $TARGET_PLIST"
