# Nginx Infrastructure

This directory contains Nginx reverse proxy configuration for the bot-medsos application following hexagonal architecture patterns.

## Directory Structure

```
nginx/
├── config/          # Nginx configuration files
│   ├── nginx.conf           # Main nginx config
│   ├── bot-medsos.conf      # Application-specific config
│   └── *.template           # Template configs (for envsubst)
├── bin/             # Nginx binaries (if custom build)
├── scripts/         # Nginx helper scripts
│   └── start_nginx.sh       # Standalone nginx start script (deprecated)
└── README.md        # This file
```

## Usage

### Development Mode (via Docker Compose)
```bash
# Start with docker-compose (recommended)
podman-compose up -d nginx
```

### Production Mode (BunkerWeb WAF)
```bash
# Use production compose override
podman-compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### Verify Configuration
```bash
# Test nginx config syntax
podman exec bot-medsos-nginx nginx -t

# Reload nginx after config changes
podman exec bot-medsos-nginx nginx -s reload
```

## Configuration Files

### `nginx.conf`
Main nginx configuration with global directives:
- Worker processes
- Event handling
- HTTP settings
- Logging format
- Security defaults

### `bot-medsos.conf`
Application-specific reverse proxy configuration:
- Upstream backend (app:3000)
- Proxy headers
- WebSocket support
- Health check endpoints
- Error pages

## Environment Variables

The following environment variables are used in nginx configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `UPSTREAM_HOST` | Backend service hostname | `app` |
| `UPSTREAM_PORT` | Backend service port | `3000` |
| `SERVER_NAME` | Server domain name | `bot.opinionry.my.id` |

## Hexagonal Architecture Position

```
┌─────────────────────────────────────┐
│     INFRASTRUCTURE LAYER            │
│  (Outer Hexagon - Adapters)         │
│                                     │
│   Cloudflare Tunnel → [NGINX] → App│
│                                     │
└─────────────────────────────────────┘
```

**Role:**
- **Inbound Gateway:** Receives traffic from Cloudflare Tunnel
- **Reverse Proxy:** Routes requests to application
- **Security Layer:** Adds security headers, rate limiting
- **Load Balancer:** (Future) Distribute traffic to multiple app instances

## Notes

- Nginx only exposes port 8080 to localhost for security
- All external traffic must come through Cloudflare Tunnel
- Configuration uses templates for environment variable injection
- Health check endpoint: `http://localhost:8080/nginx/health`
