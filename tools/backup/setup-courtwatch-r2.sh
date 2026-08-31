#!/usr/bin/env bash
set -euo pipefail

readonly PROFILE="courtwatch-r2"
readonly BUCKET="courtwatch-archive"
readonly CONFIG_FILE="$HOME/.courtwatch-backup.env"

for command in aws; do
  command -v "$command" >/dev/null || { echo "Missing dependency: $command" >&2; exit 2; }
done

account_id="${R2_ACCOUNT_ID:-}"
if ! [[ "$account_id" =~ ^[0-9a-fA-F]{32}$ ]]; then read -r -p "Cloudflare Account ID: " account_id; fi
[[ "$account_id" =~ ^[0-9a-fA-F]{32}$ ]] || { echo "Invalid Cloudflare Account ID" >&2; exit 2; }

read -r -p "New R2 Access Key ID: " access_key
read -r -s -p "New R2 Secret Access Key: " secret_key
echo
test -n "$access_key" && test -n "$secret_key" || { echo "Missing R2 credentials" >&2; exit 2; }

aws configure set aws_access_key_id "$access_key" --profile "$PROFILE"
aws configure set aws_secret_access_key "$secret_key" --profile "$PROFILE"
aws configure set region auto --profile "$PROFILE"
aws configure set output json --profile "$PROFILE"
unset access_key secret_key

endpoint="https://${account_id}.r2.cloudflarestorage.com"
echo "Testing read-only access to $BUCKET..."
aws --profile "$PROFILE" --endpoint-url "$endpoint" s3 ls "s3://$BUCKET/"

umask 077
{
  printf 'export R2_ACCOUNT_ID=%q\n' "$account_id"
  printf 'export R2_BUCKET=%q\n' "$BUCKET"
  printf 'export AWS_PROFILE=%q\n' "$PROFILE"
} > "$CONFIG_FILE"

echo "R2 read-only access configured."
echo "Configuration saved in $CONFIG_FILE (credentials remain in the AWS profile)."
echo "Next command: bash tools/backup/backup-courtwatch.sh /Users/$(id -un)/CourtWatch-backup"
