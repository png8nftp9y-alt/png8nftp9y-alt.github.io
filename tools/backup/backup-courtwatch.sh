#!/usr/bin/env bash
set -euo pipefail

readonly DATABASE_NAME="courtwatch-app"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly DEFAULT_BACKUP_ROOT="$REPO_DIR/.courtwatch-backups"
readonly BACKUP_ROOT="${1:-$DEFAULT_BACKUP_ROOT}"
readonly CONFIG_FILE="${COURTWATCH_BACKUP_CONFIG:-$HOME/.courtwatch-backup.env}"

if test -f "$CONFIG_FILE"; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

case "$BACKUP_ROOT" in
  /|"$HOME"|"$REPO_DIR") echo "Refusing unsafe backup root: $BACKUP_ROOT" >&2; exit 2 ;;
esac

for command in node npm npx aws sqlite3 gzip; do
  command -v "$command" >/dev/null || { echo "Missing dependency: $command" >&2; exit 2; }
done

: "${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID}"
: "${R2_BUCKET:?Set R2_BUCKET}"
if test -z "${AWS_PROFILE:-}"; then
  : "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID or AWS_PROFILE}"
  : "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY or AWS_PROFILE}"
fi
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot_dir="$BACKUP_ROOT/daily/$timestamp"
monthly_dir="$BACKUP_ROOT/monthly/$(date -u +%Y-%m)"
mkdir -p "$snapshot_dir/d1" "$snapshot_dir/r2" "$monthly_dir"

sha256_file() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'
  fi
}

if test "${COURTWATCH_R2_ONLY:-0}" = "1"; then
  echo "R2-only mode: preserving the existing certified D1 backup."
  table_count="existing-certified-copy"
else
  echo "Exporting remote D1 database. Cloudflare may briefly serialize database requests."
  cd "$REPO_DIR/cloudflare/app-api"
  test -d node_modules || npm install
  sql_file="$snapshot_dir/d1/courtwatch-app.sql"
  npx wrangler d1 export "$DATABASE_NAME" --remote --output "$sql_file"

  sqlite_file="$snapshot_dir/d1/courtwatch-app.sqlite"
  sqlite3 "$sqlite_file" < "$sql_file"
  test "$(sqlite3 "$sqlite_file" 'PRAGMA integrity_check;')" = "ok"
  table_count="$(sqlite3 "$sqlite_file" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"
  test "$table_count" -gt 0

  row_counts_file="$snapshot_dir/d1/row-counts.tsv"
  : > "$row_counts_file"
  while IFS= read -r table; do
    escaped_table="${table//\"/\"\"}"
    rows="$(sqlite3 "$sqlite_file" "SELECT COUNT(*) FROM \"$escaped_table\";")"
    printf '%s\t%s\n' "$table" "$rows" >> "$row_counts_file"
  done < <(sqlite3 "$sqlite_file" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
  test "$(wc -l < "$row_counts_file" | tr -d ' ')" = "$table_count"
  sqlite3 "$sqlite_file" '.schema' > "$snapshot_dir/d1/schema.sql"

  d1_itf_tournaments="$(sqlite3 "$sqlite_file" "SELECT COUNT(*) FROM tournaments WHERE circuit='itf';")"
  d1_itf_entries="$(sqlite3 "$sqlite_file" "SELECT COUNT(*) FROM entries WHERE circuit='itf';")"
  d1_itf_observed_players="$(sqlite3 "$sqlite_file" "SELECT COUNT(*) FROM observed_players WHERE circuit='itf';")"
  test "$d1_itf_observed_players" -gt 0

  gzip -n "$sql_file"
  gzip -n "$sqlite_file"
fi

endpoint="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
prefixes=(
  "fitp/cache"
  "itf/database"
  "itf/history-draws"
  "tennis-europe/cache"
  "tennis-europe/oop-history"
  "tennis-europe/oop-live"
)
for prefix in "${prefixes[@]}"; do
  target="$snapshot_dir/r2/$prefix"
  mkdir -p "$target"
  aws --endpoint-url "$endpoint" s3 sync "s3://$R2_BUCKET/$prefix/" "$target/" --only-show-errors
done

itf_history_blocks="$(find "$snapshot_dir/r2/itf/history-draws" -type f -name 'block-*.tar.gz' | wc -l | tr -d ' ')"
test "$itf_history_blocks" -ge 17 || { echo "Incomplete ITF historical archive: expected at least 17 blocks, found $itf_history_blocks" >&2; exit 2; }
for prefix in "${prefixes[@]}"; do
  test -n "$(find "$snapshot_dir/r2/$prefix" -type f -print -quit)" || { echo "Empty R2 backup prefix: $prefix" >&2; exit 2; }
done

itf_pointer="$snapshot_dir/r2/itf/database/pointers/current.json"
itf_generation="$(jq -er .generation "$itf_pointer")"
itf_generation_dir="$snapshot_dir/r2/itf/database/generations/$itf_generation"
itf_state_files=(itf_participant_cache.json.gz itf_players_database.json.gz itf_results_database.json.gz itf_draw_target_db.json itf_player_tournament_db.json itf_database_audit.json)
for file in "${itf_state_files[@]}"; do
  test -s "$itf_generation_dir/$file" || { echo "Incomplete current ITF R2 generation: missing $file" >&2; exit 2; }
done
for file in itf_draw_target_db.json itf_player_tournament_db.json itf_database_audit.json; do jq -e 'type=="object"' "$itf_generation_dir/$file" >/dev/null; done
for file in itf_participant_cache.json.gz itf_players_database.json.gz itf_results_database.json.gz; do gzip -t "$itf_generation_dir/$file"; done

manifest="$snapshot_dir/manifest.txt"
{
  echo "created_at_utc=$timestamp"
  echo "database=$DATABASE_NAME"
  echo "sqlite_tables=$table_count"
  if test "${COURTWATCH_R2_ONLY:-0}" != "1"; then
    echo "d1_row_counts=d1/row-counts.tsv"
    echo "d1_schema=d1/schema.sql"
    echo "d1_itf_tournaments=$d1_itf_tournaments"
    echo "d1_itf_entries=$d1_itf_entries"
    echo "d1_itf_observed_players=$d1_itf_observed_players"
  fi
  echo "r2_bucket=$R2_BUCKET"
  echo "r2_prefixes=${prefixes[*]}"
  echo "itf_history_blocks=$itf_history_blocks"
  echo "itf_database_generation=$itf_generation"
  echo "itf_database_state_files=${itf_state_files[*]}"
  find "$snapshot_dir" -type f ! -name manifest.txt -print0 | sort -z |
    while IFS= read -r -d '' file; do
      printf '%s  %s\n' "$(sha256_file "$file")" "${file#$snapshot_dir/}"
    done
} > "$manifest"

latest="$BACKUP_ROOT/latest.txt"
printf '%s\n' "$snapshot_dir" > "$latest"
cp "$manifest" "$monthly_dir/manifest-$timestamp.txt"

if test "${COURTWATCH_PRUNE:-0}" = "1"; then
  find "$BACKUP_ROOT/daily" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf -- {} +
fi

echo "Backup complete: $snapshot_dir"
if test "${COURTWATCH_R2_ONLY:-0}" = "1"; then echo "D1: existing certified copy preserved; R2 archive verified."
else echo "SQLite integrity: ok; tables: $table_count; row counts and schema recorded."; fi
