#!/usr/bin/env bash
set -euo pipefail
PREFIX=tennis-europe/oop-history
ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
ARCHIVE=dist/v3/tennis_europe_oop_historical.json
aws_r2(){ aws --endpoint-url "$ENDPOINT" "$@"; }
pointer(){ aws_r2 s3 cp "s3://$R2_BUCKET/$PREFIX/pointers/$1.json" "$2" --only-show-errors 2>/dev/null; }
publish(){
  work="$(mktemp -d)"
  jq -e '.status=="green" and .counts.tournaments==453 and .counts.matches==47048 and .counts.winnerUnresolved==0 and .counts.conflicts==0' "$ARCHIVE" >/dev/null
  archive_hash="$(sha256sum "$ARCHIVE"|cut -d' ' -f1)"
  generation="$archive_hash"
  jq -n --arg generation "$generation" --arg archive "$archive_hash" --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{schemaVersion:1,generation:$generation,createdAt:$createdAt,files:{archive:{name:"tennis_europe_oop_historical.json",sha256:$archive}}}' > "$work/new.json"
  if pointer current "$work/current.json"; then current_generation="$(jq -r .generation "$work/current.json")"; if test "$current_generation" = "$generation"; then rm -rf "$work"; echo 'Europe OOP historical archive unchanged; R2 not rewritten.'; return; fi; fi
  aws_r2 s3 cp "$ARCHIVE" "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_historical.json" --only-show-errors
  aws_r2 s3 cp "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_historical.json" "$work/archive.json" --only-show-errors
  test "$(sha256sum "$work/archive.json"|cut -d' ' -f1)" = "$archive_hash"
  pointer backup-1 "$work/backup-1.json" || true
  test ! -s "$work/backup-1.json" || aws_r2 s3 cp "$work/backup-1.json" "s3://$R2_BUCKET/$PREFIX/pointers/backup-2.json" --only-show-errors
  test ! -s "$work/current.json" || aws_r2 s3 cp "$work/current.json" "s3://$R2_BUCKET/$PREFIX/pointers/backup-1.json" --only-show-errors
  aws_r2 s3 cp "$work/new.json" "s3://$R2_BUCKET/$PREFIX/pointers/current.json" --only-show-errors
  rm -rf "$work"
  echo "Published verified Europe OOP historical generation $generation."
}
case "$1" in publish) publish;; *) echo 'Usage: tennis-europe-oop-history-r2.sh publish' >&2; exit 2;; esac
