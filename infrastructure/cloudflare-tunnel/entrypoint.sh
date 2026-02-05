#!/bin/sh
set -e

# Configuration
NGINX_HOST="${NGINX_HOST:-nginx}"
NGINX_PORT="${NGINX_PORT:-80}"
MAX_RETRIES=30
SLEEP_SECONDS=2

echo "[Tunnel-Entrypoint] 🚀 Starting Custom Cloudflare Tunnel..."
echo "[Tunnel-Entrypoint] Target Nginx: http://$NGINX_HOST:$NGINX_PORT/nginx/health"

# Wait Loop
i=1
while [ $i -le $MAX_RETRIES ]; do
    if curl -s -f "http://$NGINX_HOST:$NGINX_PORT/nginx/health" > /dev/null; then
        echo "[Tunnel-Entrypoint] ✅ Nginx is Healthy!"
        break
    fi

    echo "[Tunnel-Entrypoint] ⏳ Waiting for Nginx ($i/$MAX_RETRIES)..."
    sleep $SLEEP_SECONDS
    i=$((i + 1))
done

if [ $i -gt $MAX_RETRIES ]; then
    echo "[Tunnel-Entrypoint] ❌ Nginx failed to respond after $((MAX_RETRIES * SLEEP_SECONDS)) seconds. Exiting."
    exit 1
fi

# Execute Main Command (tunnel run)
echo "[Tunnel-Entrypoint] ⚡ Starting Cloudflared..."
exec cloudflared "$@"
