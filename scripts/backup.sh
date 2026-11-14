#!/usr/bin/env bash
# Nightly off-site backup: dump the database and copy it to Cloudflare R2.
# Needs: pg_dump, aws cli, DATABASE_URL, R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY. Keeps the 1st of each month under monthly/.
# NOT yet run against a real bucket. Do a restore drill before trusting it.
set -euo pipefail
day=$(date -u +%F)
file="/tmp/dockside-$day.dump"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$file"
aws s3 cp "$file" "s3://$R2_BUCKET/daily/dockside-$day.dump" --endpoint-url "$R2_ENDPOINT"
if [ "$(date -u +%d)" = "01" ]; then
  aws s3 cp "$file" "s3://$R2_BUCKET/monthly/dockside-$day.dump" --endpoint-url "$R2_ENDPOINT"
fi
rm -f "$file"
echo "backup $day uploaded"
