#!/usr/bin/env bash
# ChequeMate: first-time setup on a fresh Ubuntu 22.04/24.04 Vultr server. Run as root:
#   bash setup.sh
# Safe to re-run; it also works as an update.
set -euo pipefail

REPO=https://github.com/abhishek8524/ChequeMate.git
BRANCH=production
APP=/opt/chequemate
git config --global --get-all safe.directory | grep -qx "$APP" || git config --global --add safe.directory "$APP"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3-venv python3-pip git ufw curl gpg debian-keyring debian-archive-keyring apt-transport-https

# Caddy (automatic HTTPS)
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# App user + code
id chequemate &>/dev/null || useradd --system --home "$APP" --shell /usr/sbin/nologin chequemate
if [ ! -d "$APP/.git" ]; then
  git clone -b "$BRANCH" "$REPO" "$APP"
else
  git -C "$APP" fetch origin "$BRANCH"
  git -C "$APP" checkout "$BRANCH"
  git -C "$APP" pull --ff-only origin "$BRANCH"
fi

# Python environment
python3 -m venv "$APP/.venv"
"$APP/.venv/bin/pip" install --upgrade pip
"$APP/.venv/bin/pip" install -r "$APP/requirements.txt"

# Secrets file (never committed)
NEW_ENV=0
if [ ! -f "$APP/.env" ]; then
  cp "$APP/.env.example" "$APP/.env"
  NEW_ENV=1
fi
chown -R chequemate:chequemate "$APP"
chmod 600 "$APP/.env"

# Services + web server
cp "$APP"/deploy/chequemate-*.service /etc/systemd/system/
cp "$APP"/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable chequemate-api chequemate-web

# Firewall: SSH + web only (ports 8000/8001 stay private)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [ "$NEW_ENV" = 1 ]; then
  echo
  echo ">>> Fill in secrets:  nano $APP/.env"
  echo ">>> Then start:       systemctl restart chequemate-api chequemate-web caddy"
  echo ">>> Note: the Caddyfile must contain your real domain before HTTPS works."
else
  systemctl restart chequemate-api chequemate-web
  systemctl reload caddy || systemctl restart caddy
  echo "Done. Check: curl -s localhost:8000/api/health"
fi
