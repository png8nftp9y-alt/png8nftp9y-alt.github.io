#!/usr/bin/env bash
set -euo pipefail
ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
OUT=../../dist/v3
MIN_TOURNAMENTS="${TE_OOP_MIN_TOURNAMENTS:-453}"
MIN_MATCHES="${TE_OOP_MIN_MATCHES:-47048}"
aws_r2(){ aws --endpoint-url "$ENDPOINT" "$@"; }
restore_one(){
  prefix="$1"; pointer="$2"; output="$3"; file_key="$4"
  work="$(mktemp -d)"
  aws_r2 s3 cp "s3://$R2_BUCKET/$prefix/pointers/current.json" "$work/current.json" --only-show-errors
  generation="$(jq -er .generation "$work/current.json")"
  name="$(jq -er ".files.$file_key.name" "$work/current.json")"
  expected="$(jq -er ".files.$file_key.sha256" "$work/current.json")"
  aws_r2 s3 cp "s3://$R2_BUCKET/$prefix/generations/$generation/$name" "$output" --only-show-errors
  test "$(sha256sum "$output"|cut -d' ' -f1)" = "$expected"
  jq -e '.status=="green"' "$output" >/dev/null
  rm -rf "$work"
  echo "Restored $pointer generation $generation."
}
mkdir -p "$OUT"
restore_one tennis-europe/oop-history historical "$OUT/tennis_europe_oop_historical.json" archive
restore_one tennis-europe/oop-live live "$OUT/tennis_europe_oop_live.json" snapshot
jq -e --argjson minTournaments "$MIN_TOURNAMENTS" --argjson minMatches "$MIN_MATCHES" '.counts.tournaments >= $minTournaments and .counts.matches >= $minMatches and .counts.winnerUnresolved==0 and .counts.conflicts==0' "$OUT/tennis_europe_oop_historical.json" >/dev/null
jq -e '.counts.matches>0 and .counts.failures==0 and .counts.winnerUnresolved==0' "$OUT/tennis_europe_oop_live.json" >/dev/null
