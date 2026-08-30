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
restore_file itf/database itf_players_database.json.gz
