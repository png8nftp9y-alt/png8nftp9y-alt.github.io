#!/usr/bin/env bash
set -euo pipefail

readonly LABEL="com.courtwatch.weekly-backup"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly BACKUP_ROOT="$HOME/CourtWatch-backup"
readonly PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
readonly USER_ID="$(id -u)"

test -f "$HOME/.courtwatch-backup.env" || { echo "Missing ~/.courtwatch-backup.env; run setup-courtwatch-r2.sh first." >&2; exit 2; }
mkdir -p "$HOME/Library/LaunchAgents" "$BACKUP_ROOT/logs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO_DIR/tools/backup/run-backup-if-due.sh</string>
    <string>$BACKUP_ROOT</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>4</integer>
    <key>Minute</key><integer>30</integer>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$BACKUP_ROOT/logs/weekly.log</string>
  <key>StandardErrorPath</key><string>$BACKUP_ROOT/logs/weekly-error.log</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST"
launchctl bootout "gui/$USER_ID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$USER_ID" "$PLIST"
launchctl print "gui/$USER_ID/$LABEL" >/dev/null

echo "Weekly CourtWatch backup installed: Sunday at 04:30 local time, with catch-up at the next login if overdue."
echo "LaunchAgent: $PLIST"
echo "Logs: $BACKUP_ROOT/logs/weekly.log and weekly-error.log"
