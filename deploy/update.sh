#!/usr/bin/env bash
# Pull the latest production code and restart. Run as root on the server:
#   bash /opt/chequemate/deploy/update.sh
set -euo pipefail
APP=/opt/chequemate
git -C "$APP" pull --ff-only origin production
"$APP/.venv/bin/pip" install -r "$APP/requirements.txt"
chown -R chequemate:chequemate "$APP"
cp "$APP"/deploy/chequemate-*.service /etc/systemd/system/
cp "$APP"/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl restart chequemate-api chequemate-web
systemctl reload caddy
sleep 2
curl -s localhost:8000/api/health; echo
