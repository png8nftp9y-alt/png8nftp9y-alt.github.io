#!/usr/bin/env bash
set -euo pipefail

readonly ITF_MIN_PERMANENT_PARTICIPANTS=10000
mkdir -p tmp/opponent-entries

get_object(){ npx wrangler r2 object get "$R2_BUCKET/$1" --remote --config wrangler.generated.jsonc --file "$2"; }

restore_fitp(){
  local pointer="tmp/opponent-entries/fitp-pointer.json" generation
  get_object "fitp/cache/pointers/current.json" "$pointer"
  generation="$(jq -er .generation "$pointer")"
  get_object "fitp/cache/generations/$generation/fitp_participant_cache.json.gz" "tmp/opponent-entries/fitp_participant_cache.json.gz"
  gzip -t tmp/opponent-entries/fitp_participant_cache.json.gz
}

restore_itf(){
  local slot pointer generation candidate count
  for slot in current backup-1 backup-2; do
    pointer="tmp/opponent-entries/itf-$slot-pointer.json"
    if ! get_object "itf/database/pointers/$slot.json" "$pointer"; then continue; fi
    generation="$(jq -er .generation "$pointer")"
    candidate="tmp/opponent-entries/itf-$slot.json.gz"
    if ! get_object "itf/database/generations/$generation/itf_participant_cache.json.gz" "$candidate"; then continue; fi
    gzip -t "$candidate"
    count="$(gzip -cd "$candidate" | jq -r '(.participants // []) | length')"
    if test "$count" -ge "$ITF_MIN_PERMANENT_PARTICIPANTS"; then
      cp "$candidate" tmp/opponent-entries/itf_participant_cache.json.gz
      printf '%s' "$slot" > tmp/opponent-entries/itf-source-slot.txt
      return
    fi
  done
  echo "No complete ITF participant cache for opponent entries." >&2
  exit 1
}

restore_fitp
restore_itf
