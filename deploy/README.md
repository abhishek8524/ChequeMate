# Deploying ChequeMate to Vultr

Two processes behind Caddy (HTTPS):
- `chequemate-web` – `core-app/server.py` on :8000 (static app, Gemini proxy, forwards `/api/*`)
- `chequemate-api` – FastAPI backend on 127.0.0.1:8001 (reads TigerData Postgres)
- `Caddy` – public :80/:443, proxies to :8000

## First time
1. Vultr: Cloud Compute, Ubuntu 24.04, 1 vCPU / 1 GB. Note the IPv4.
2. GoDaddy DNS: A records `@` and `www` -> the IPv4. Remove the parking-page record.
3. Put your domain in `deploy/Caddyfile` (replace `example.com`), commit and push to `production`.
4. On the server: `ssh root@IP`, then
   `bash <(curl -fsSL https://raw.githubusercontent.com/abhishek8524/ChequeMate/production/deploy/setup.sh)`
5. `nano /opt/chequemate/.env` (see `.env.example`; set `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`).
6. `systemctl restart chequemate-api chequemate-web caddy`
7. `curl -s https://yourdomain.com/api/health` -> `{"status":"ok","database":"ok"}`

## Updating
Push to `production`, then on the server: `bash /opt/chequemate/deploy/update.sh`

## Troubleshooting
- `journalctl -u chequemate-api -n 50`, `journalctl -u chequemate-web -n 50`, `journalctl -u caddy -n 50`
- Health 503: allow the server IP in TigerData, check `DATABASE_URL`.
- No certificate: DNS not propagated yet (`dig +short yourdomain.com`).
- The API has no account authentication; do not host real customer data behind it.
