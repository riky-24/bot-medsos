# Cloudflare Tunnel Infrastructure

This directory contains Cloudflare Tunnel (cloudflared) configuration and binaries for the bot-medsos application.

## Directory Structure

```
cloudflare-tunnel/
├── config/          # Tunnel configuration files
│   └── config.yml           # Cloudflared config (if using config file)
├── bin/             # Cloudflared binary
│   └── cloudflared          # Downloaded binary
├── scripts/         # Tunnel helper scripts
└── README.md        # This file
```

## Purpose

Cloudflare Tunnel provides **inbound connectivity** for the application without needing a public IP address.

### Traffic Flow

```
Internet (Telegram API)
    ↓
Cloudflare Edge Network
    ↓
Encrypted Tunnel (Outbound-only connection from server)
    ↓
Cloudflared Container (Local Server)
    ↓
Nginx Reverse Proxy (Port 8080)
    ↓
Application (Port 3000)
```

## Usage

### Via Docker Compose (Recommended)
```bash
# Tunnel starts automatically with compose
podman-compose up -d tunnel

# Check tunnel logs
podman logs -f bot-medsos-tunnel
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel authentication token | Yes |

Get your tunnel token from: [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)

## Binary Management

The CloudflareTunnelAdapter automatically:
1. Detects platform (Linux, macOS, Windows)
2. Detects architecture (amd64, arm64, etc)
3. Downloads appropriate cloudflared binary
4. Makes it executable
5. Stores in `infrastructure/cloudflare-tunnel/bin/`

**Binary is gitignored** - downloaded on first run.

## Hexagonal Architecture Position

```
┌─────────────────────────────────────┐
│     INFRASTRUCTURE LAYER            │
│  (Outer Hexagon - Adapters)         │
│                                     │
│   [Cloudflare Tunnel] → Nginx → App│
│                                     │
└─────────────────────────────────────┘
```

**Role:**
- **Inbound Gateway:** Sole entry point for external traffic
- **No Public IP Required:** Outbound-only connection to Cloudflare
- **Zero Trust:** Cloudflare handles authentication and authorization
- **DDoS Protection:** Traffic filtered by Cloudflare before reaching server

## Important Notes

> **Tunnel is ONLY for Inbound Webhook**
> 
> - ✅ Inbound: Telegram → Cloudflare → Tunnel → Nginx → App
> - ❌ Outbound: App → Direct HTTPS → Telegram API (Bypass Tunnel!)
> - ❌ Background Jobs: App → Direct HTTPS → External APIs (No Tunnel!)

**Why?**
- Cloudflare Tunnel is an **outbound-only connection** from server to Cloudflare
- Server initiates connection to Cloudflare (no inbound firewall rules needed)
- Cloudflare routes traffic back through this tunnel
- For sending responses, app uses normal HTTP client (direct to internet)

## Troubleshooting

### Tunnel not connecting
```bash
# Check logs
podman logs bot-medsos-tunnel

# Verify token is set
echo $CLOUDFLARE_TUNNEL_TOKEN

# Test manual connection
podman exec bot-medsos-tunnel /usr/local/bin/cloudflared tunnel info
```

### Binary download fails
```bash
# Download manually
cd infrastructure/cloudflare-tunnel/bin
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
mv cloudflared-linux-amd64 cloudflared
chmod +x cloudflared
```

## References

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflared GitHub](https://github.com/cloudflare/cloudflared)
