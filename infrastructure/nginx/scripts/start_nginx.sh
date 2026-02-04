#!/bin/bash

# Pastikan script dijalankan dari root directory project
# Usage: ./scripts/start_nginx.sh

CONTAINER_NAME="bot-medsos-nginx"
IMAGE="docker.io/library/nginx:alpine"

echo "🚀 Starting Nginx Container via Podman..."

# Run Podman
# --network host: Biar 'localhost' di nginx nyambung ke 'localhost' laptop (Node.js port 3000)
# -v ...: Mount file config kita ke folder conf.d nginx
podman run -d \
  --name $CONTAINER_NAME \
  --network host \
  --restart always \
  -v $(pwd)/nginx/bot-medsos.conf:/etc/nginx/conf.d/01-bot-medsos.conf:ro,Z \
  -v $(pwd)/nginx/dummy.conf:/etc/nginx/conf.d/default.conf:ro,Z \
  $IMAGE

echo "✅ Nginx Container Started!"
echo "📡 Listening on Port 8080 (Host Network)"
echo "🔗 Proxying to http://localhost:3000"
