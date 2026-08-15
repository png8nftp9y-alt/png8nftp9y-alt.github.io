#!/usr/bin/env bash
set -euo pipefail

readonly CACHE_DIR="history"
readonly CACHE_FILE="fitp_participant_cache.json.gz"
readonly INDEX_FILE="fitp_membership_index.json.gz"
readonly R2_PREFIX="fitp/cache"
readonly ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

aws_r2() { aws --endpoint-url "$ENDPOINT" "$@"; }

validate_local() {
  gzip -t "$CACHE_DIR/$CACHE_FILE"
  gzip -t "$CACHE_DIR/$INDEX_FILE"
}

read_pointer() {
  aws_r2 s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/pointers/$1.json" "$2" --only-show-errors 2>/dev/null
}

restore_current() {
  local work pointer generation
  work="$(mktemp -d)"
  trap 'rm -rf "${work:-}"' EXIT
  pointer="$work/current.json"
  if ! read_pointer current "$pointer"; then
    echo "R2 has no current FITP cache yet; using the repository bootstrap copy."
    validate_local
    return
  fi
  generation="$(jq -er '.generation' "$pointer")"
  aws_r2 s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${CACHE_FILE}" "$CACHE_DIR/$CACHE_FILE" --only-show-errors
  aws_r2 s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${INDEX_FILE}" "$CACHE_DIR/$INDEX_FILE" --only-show-errors
  validate_local
  test "$(sha256sum "$CACHE_DIR/$CACHE_FILE" | cut -d' ' -f1)" = "$(jq -r '.files.participantCache.sha256' "$pointer")"
  test "$(sha256sum "$CACHE_DIR/$INDEX_FILE" | cut -d' ' -f1)" = "$(jq -r '.files.membershipIndex.sha256' "$pointer")"
  echo "Restored verified FITP cache generation ${generation} from R2."
}

publish_generation() {
  local work cache_sha index_sha generation current_generation pointer
  work="$(mktemp -d)"
  trap 'rm -rf "${work:-}"' EXIT
  validate_local
  cache_sha="$(sha256sum "$CACHE_DIR/$CACHE_FILE" | cut -d' ' -f1)"
  index_sha="$(sha256sum "$CACHE_DIR/$INDEX_FILE" | cut -d' ' -f1)"
  generation="$(printf '%s\n%s\n' "$cache_sha" "$index_sha" | sha256sum | cut -d' ' -f1)"
  pointer="$work/new.json"
  jq -n --arg generation "$generation" --arg cache_sha "$cache_sha" --arg index_sha "$index_sha" \
    --arg created_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{schemaVersion:1,generation:$generation,createdAt:$created_at,files:{participantCache:{name:"fitp_participant_cache.json.gz",sha256:$cache_sha},membershipIndex:{name:"fitp_membership_index.json.gz",sha256:$index_sha}}}' > "$pointer"
  if read_pointer current "$work/current.json"; then
    current_generation="$(jq -r '.generation' "$work/current.json")"
    if test "$current_generation" = "$generation"; then
      echo "FITP cache content is unchanged; R2 was not rewritten."
      return
    fi
  fi
  aws_r2 s3 cp "$CACHE_DIR/$CACHE_FILE" "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${CACHE_FILE}" --only-show-errors
  aws_r2 s3 cp "$CACHE_DIR/$INDEX_FILE" "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${INDEX_FILE}" --only-show-errors
  aws_r2 s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${CACHE_FILE}" "$work/verify-cache.gz" --only-show-errors
  aws_r2 s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${generation}/${INDEX_FILE}" "$work/verify-index.gz" --only-show-errors
  test "$(sha256sum "$work/verify-cache.gz" | cut -d' ' -f1)" = "$cache_sha"
  test "$(sha256sum "$work/verify-index.gz" | cut -d' ' -f1)" = "$index_sha"
  read_pointer backup-1 "$work/backup-1.json" || true
  if test -s "$work/backup-1.json"; then
    aws_r2 s3 cp "$work/backup-1.json" "s3://${R2_BUCKET}/${R2_PREFIX}/pointers/backup-2.json" --only-show-errors
  fi
  if test -s "$work/current.json"; then
    aws_r2 s3 cp "$work/current.json" "s3://${R2_BUCKET}/${R2_PREFIX}/pointers/backup-1.json" --only-show-errors
  fi
  aws_r2 s3 cp "$pointer" "s3://${R2_BUCKET}/${R2_PREFIX}/pointers/current.json" --only-show-errors
  for slot in current backup-1 backup-2; do read_pointer "$slot" "$work/final-${slot}.json" || true; done
  aws_r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "${R2_PREFIX}/generations/" --output json \
    | jq -r '.Contents[]?.Key' | cut -d/ -f4 | sort -u > "$work/all-generations.txt"
  jq -r '.generation' "$work"/final-*.json 2>/dev/null | sort -u > "$work/kept-generations.txt"
  comm -23 "$work/all-generations.txt" "$work/kept-generations.txt" | while read -r old_generation; do
    test -n "$old_generation" || continue
    aws_r2 s3 rm "s3://${R2_BUCKET}/${R2_PREFIX}/generations/${old_generation}/" --recursive --only-show-errors
  done
  echo "Published and verified FITP cache generation ${generation}; retained current plus two backups."
}

case "${1:-}" in
  restore) restore_current ;;
  publish) publish_generation ;;
  *) echo "Usage: $0 restore|publish" >&2; exit 2 ;;
esac
