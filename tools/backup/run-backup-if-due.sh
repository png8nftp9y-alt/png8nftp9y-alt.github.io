#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKUP_ROOT="${1:-$HOME/CourtWatch-backup}"
readonly LATEST_FILE="$BACKUP_ROOT/latest.txt"
readonly MAX_AGE_SECONDS="${COURTWATCH_BACKUP_MAX_AGE_SECONDS:-518400}"

if test -f "$LATEST_FILE"; then
  if stat -f %m "$LATEST_FILE" >/dev/null 2>&1; then last_success="$(stat -f %m "$LATEST_FILE")"
  else last_success="$(stat -c %Y "$LATEST_FILE")"; fi
  age="$(( $(date +%s) - last_success ))"
  if test "$age" -lt "$MAX_AGE_SECONDS"; then
    echo "CourtWatch backup is current ($age seconds old); catch-up skipped."
    exit 0
  fi
fi

echo "CourtWatch backup is missing or stale; starting catch-up."
exec /bin/bash "$SCRIPT_DIR/backup-courtwatch.sh" "$BACKUP_ROOT"
