#!/usr/bin/env bash
set -euo pipefail
PREFIX=tennis-europe/oop-live
ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
CURRENT=dist/v3/tennis_europe_oop_live.json
TRANSITIONS=dist/v3/tennis_europe_oop_live_transitions.json
aws_r2(){ aws --endpoint-url "$ENDPOINT" "$@"; }
pointer(){ aws_r2 s3 cp "s3://$R2_BUCKET/$PREFIX/pointers/$1.json" "$2" --only-show-errors 2>/dev/null; }
restore(){
  work="$(mktemp -d)"
  if ! pointer current "$work/current.json"; then echo 'R2 has no Europe OOP live snapshot yet.'; return; fi
  generation="$(jq -er .generation "$work/current.json")"
  mkdir -p dist/v3/previous-tennis-europe-oop
  aws_r2 s3 cp "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_live.json" dist/v3/previous-tennis-europe-oop/tennis_europe_oop_live.json --only-show-errors
  test "$(sha256sum dist/v3/previous-tennis-europe-oop/tennis_europe_oop_live.json|cut -d' ' -f1)" = "$(jq -r .files.snapshot.sha256 "$work/current.json")"
  jq -e '.status=="green"' dist/v3/previous-tennis-europe-oop/tennis_europe_oop_live.json >/dev/null
  rm -rf "$work"
  echo "Restored verified Europe OOP live generation $generation."
}
publish(){
  work="$(mktemp -d)"
  jq -e '.status=="green"' "$CURRENT" >/dev/null
  jq -e '.status=="green"' "$TRANSITIONS" >/dev/null
  snapshot_hash="$(sha256sum "$CURRENT"|cut -d' ' -f1)"
  transitions_hash="$(sha256sum "$TRANSITIONS"|cut -d' ' -f1)"
  generation="$(printf '%s\n%s\n' "$snapshot_hash" "$transitions_hash"|sha256sum|cut -d' ' -f1)"
  jq -n --arg generation "$generation" --arg snapshot "$snapshot_hash" --arg transitions "$transitions_hash" --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{schemaVersion:1,generation:$generation,createdAt:$createdAt,files:{snapshot:{name:"tennis_europe_oop_live.json",sha256:$snapshot},transitions:{name:"tennis_europe_oop_live_transitions.json",sha256:$transitions}}}' > "$work/new.json"
  if pointer current "$work/current.json"; then current_generation="$(jq -r .generation "$work/current.json")"; if test "$current_generation" = "$generation"; then rm -rf "$work"; echo 'Europe OOP live snapshot unchanged; R2 not rewritten.'; return; fi; fi
  aws_r2 s3 cp "$CURRENT" "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_live.json" --only-show-errors
  aws_r2 s3 cp "$TRANSITIONS" "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_live_transitions.json" --only-show-errors
  aws_r2 s3 cp "s3://$R2_BUCKET/$PREFIX/generations/$generation/tennis_europe_oop_live.json" "$work/snapshot.json" --only-show-errors
  test "$(sha256sum "$work/snapshot.json"|cut -d' ' -f1)" = "$snapshot_hash"
  pointer backup-1 "$work/backup-1.json" || true
  test ! -s "$work/backup-1.json" || aws_r2 s3 cp "$work/backup-1.json" "s3://$R2_BUCKET/$PREFIX/pointers/backup-2.json" --only-show-errors
  test ! -s "$work/current.json" || aws_r2 s3 cp "$work/current.json" "s3://$R2_BUCKET/$PREFIX/pointers/backup-1.json" --only-show-errors
  aws_r2 s3 cp "$work/new.json" "s3://$R2_BUCKET/$PREFIX/pointers/current.json" --only-show-errors
  rm -rf "$work"
  echo "Published verified Europe OOP live generation $generation."
}
case "$1" in restore) restore;; publish) publish;; *) echo 'Usage: tennis-europe-oop-r2.sh restore|publish' >&2; exit 2;; esac
