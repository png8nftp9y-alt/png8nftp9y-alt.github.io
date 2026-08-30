#!/usr/bin/env bash
set -euo pipefail
mkdir -p tmp/observed
get_object(){ npx wrangler r2 object get "$R2_BUCKET/$1" --remote --config wrangler.generated.jsonc --file "$2"; }
restore_file(){
  local prefix="$1" name="$2" pointer="tmp/observed/pointer.json" generation
  get_object "$prefix/pointers/current.json" "$pointer"
  generation="$(jq -er .generation "$pointer")"
  get_object "$prefix/generations/$generation/$name" "tmp/observed/$name"
  gzip -t "tmp/observed/$name"
}
restore_file fitp/cache fitp_participant_cache.json.gz
restore_file tennis-europe/cache tennis_europe_participant_index.json.gz
restore_itf(){
  local slot pointer generation candidate count
  for slot in current backup-1 backup-2; do
    pointer="tmp/observed/itf-$slot-pointer.json"
    if ! get_object "itf/database/pointers/$slot.json" "$pointer"; then continue; fi
    generation="$(jq -er .generation "$pointer")"
    candidate="tmp/observed/itf-$slot.json.gz"
    get_object "itf/database/generations/$generation/itf_participant_cache.json.gz" "$candidate"
    gzip -t "$candidate"
    count="$(gzip -cd "$candidate" | jq -r '(.participants // []) | length')"
    if test "$count" -gt 0; then
      cp "$candidate" tmp/observed/itf_participant_cache.json.gz
      printf '%s' "$slot" > tmp/observed/itf-source-slot.txt
      echo "Selected ITF $slot with $count permanent participants."
      return
    fi
    echo "Rejected empty ITF $slot participant cache." >&2
  done
  echo "No non-empty ITF participant cache in current or backups." >&2
  exit 1
}
restore_itf
