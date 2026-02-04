# Infrastructure Layer - Hexagonal Architecture

This directory contains all infrastructure components for the bot-medsos application, organized following hexagonal architecture (ports & adapters) pattern.

## 🏗️ Directory Structure

```
infrastructure/
├── nginx/                  # Nginx reverse proxy (development)
│   ├── config/            # Nginx configuration files
│   ├── scripts/           # Helper scripts
│   └── README.md
├── bunkerweb/             # BunkerWeb WAF (production)
│   ├── config/            # ModSecurity and WAF configs
│   └── README.md
├── cloudflare-tunnel/     # Inbound gateway (no public IP)
│   ├── bin/               # Cloudflared binary (auto-downloaded)
│   ├── config/            # Tunnel configuration
│   └── README.md
├── docker/                # Container orchestration
│   ├── docker-compose.yml           # Main compose file
│   ├── docker-compose.production.yml # Production overrides
│   ├── Dockerfile                    # App container image
│   ├── docker-entrypoint.sh          # Startup script
│   └── README.md
└── README.md              # This file
```

## 📊 Architecture Overview

### Hexagonal Architecture Position

```
┌───────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                        │
│         (Outer Hexagon - Infrastructure Adapters)             │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Cloudflare  │  │    Nginx/    │  │  PostgreSQL  │       │
│  │    Tunnel    │→ │  BunkerWeb   │→ │   Database   │       │
│  │  (Inbound)   │  │   (Proxy)    │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Telegram   │  │  VIPReseller │  │  Sakurupiah  │       │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │       │
│  │  (Outbound)  │  │  (Outbound)  │  │  (Outbound)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  HTTP Server      │
                    │  (Express.js)     │
                    │  Port: 3000       │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                   APPLICATION LAYER                           │
│              (BotCore, Handlers, Use Cases)                   │
└───────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                     DOMAIN LAYER                              │
│         (Services, Entities, Repositories)                    │
└───────────────────────────────────────────────────────────────┘
```

### Traffic Flow

#### Inbound (Webhook from Telegram)
```
Internet → Cloudflare Edge → Tunnel → Nginx/BunkerWeb → App
```

#### Outbound (Send Message to Telegram)
```
App → TelegramAdapter → Direct HTTPS → Telegram API (Bypass Tunnel!)
```

#### Background Jobs (Sync, Worker)
```
App → VIPReseller/Sakurupiah Adapter → Direct HTTPS → External APIs (No Tunnel!)
```

## ❓ FAQ: Infrastructure vs Adapters

### Why No NginxAdapter or BunkerWebAdapter in `adapters/`?

**Answer:** Nginx and BunkerWeb are managed by **Docker Compose**, not application code!

**Nginx/BunkerWeb Management:**
```
docker-compose.yml (declarative config)
    ↓
Defines nginx service
    ↓
Mounts config from infrastructure/nginx/config/
    ↓
Docker starts nginx container automatically
```

**NO CODE NEEDED!** It's all declarative configuration in YAML.

**Compare with Cloudflare Tunnel:**
```
server/app.js (imperative code)
    ↓
Imports CloudflareTunnelAdapter from adapters/platform/
    ↓
Spawns cloudflared process manually
    ↓
Manages process lifecycle (start, stop, monitor)
```

**CODE REQUIRED!** Application spawns and manages the process.

### Adapter vs Config-Only: Decision Matrix

| Component | Managed By | Needs Code Adapter? | Adapter Location | Config Location |
|-----------|------------|---------------------|------------------|-----------------|
| **Nginx** | Docker Compose | ❌ NO | - | `infrastructure/nginx/config/` |
| **BunkerWeb** | Docker Compose | ❌ NO | - | `infrastructure/bunkerweb/config/` |
| **Database** | Docker Compose | ✅ YES (for queries) | `adapters/shared/database/` | ENV vars |
| **Cloudflare Tunnel** | Application Code | ✅ YES (spawn process) | `adapters/platform/` | `infrastructure/cloudflare-tunnel/bin/` |
| **Telegram Bot** | Application Code | ✅ YES (API calls) | `adapters/bot-telegram/` | ENV vars |

**Rule of Thumb:**
- 🐳 **Docker Compose manages it** → Config in `infrastructure/` only
- 💻 **Application code manages it** → Adapter in `adapters/` + config in `infrastructure/`

### Where Are the Adapters?

Platform adapters are in: **`adapters/platform/`** (not `adapters/infrastructure/`)

**Why "platform"?**
- Avoids naming confusion with `infrastructure/` directory
- "Platform" clearly indicates system-level code adapters
- `infrastructure/` exclusively for deployment artifacts (config, binaries, docs)

**Current Platform Adapters:**
- ✅ `adapters/platform/CloudflareTunnelAdapter.js` - Manages cloudflared process
- See: `adapters/platform/README.md` for details

## 🔧 Components

### 1. Cloudflare Tunnel (`cloudflare-tunnel/`)
**Purpose:** Inbound gateway without public IP

**Role:**
- Receive webhook traffic from Telegram Bot API
- Encrypted tunnel to Cloudflare Edge
- No firewall rules needed (outbound-only connection)

**Key Files:**
- `bin/cloudflared` - Downloaded binary (platform-specific)
- Managed by: `adapters/infrastructure/CloudflareTunnelAdapter.js`

### 2. Nginx (`nginx/`)
**Purpose:** Reverse proxy for development/staging

**Role:**
- Route traffic from Cloudflare Tunnel to Application
- Add security headers
- Load balancing (future)
- Health check endpoints

**Key Files:**
- `config/nginx.conf` - Main nginx config
- `config/bot-medsos.conf` - Application-specific config

### 3. BunkerWeb (`bunkerweb/`)
**Purpose:** Production-grade WAF and reverse proxy

**Role:**
- ModSecurity WAF (OWASP Core Rule Set)
- Rate limiting
- DDoS protection (Layer 7)
- Security headers
- Block malicious requests before reaching app

**Key Files:**
- `config/modsecurity-custom-rules/` - Custom WAF rules
- Used via: `docker-compose.production.yml`

### 4. Docker (`docker/`)
**Purpose:** Container orchestration

**Role:**
- Define multi-container application
- Manage service dependencies
- Network configuration
- Volume management
- Environment-based deployment (dev/prod)

**Key Files:**
- `docker-compose.yml` - Main orchestration (dev)
- `docker-compose.production.yml` - Production overrides

## 🚀 Quick Start

### Development Mode
```bash
# Start all services (nginx + app + db + tunnel)
podman-compose up -d

# Check status
podman-compose ps

# View logs
podman-compose logs -f app
```

### Production Mode
```bash
# Start with BunkerWeb WAF
podman-compose -f docker-compose.yml \
               -f docker-compose.production.yml \
               up -d
```

### Individual Components
```bash
# Start only nginx
podman-compose up -d nginx

# Restart tunnel
podman-compose restart tunnel

# Stop all
podman-compose down
```

## 📚 Hexagonal Architecture Principles

### ✅ Separation of Concerns
- **Infrastructure** (this directory): Technical implementation details
- **Application** (`core/applications/`): Use cases and orchestration
- **Domain** (`core/shared/`): Business logic

### ✅ Dependency Inversion
- Application **doesn't know** about nginx, cloudflare, or docker
- Communication via **standard HTTP** (Port Interface)
- Infrastructure depends on App, NOT vice versa

### ✅ Interchangeability
- Swap nginx ↔ BunkerWeb without changing app code
- Swap Cloudflare Tunnel ↔ Ngrok (just config change)
- Infrastructure components are **plug-and-play**

## 🔐 Security Best Practices

### Network Isolation
- ✅ Custom bridge network `bot-network`
- ✅ No host port exposure (except localhost:8080)
- ✅ Cloudflare Tunnel only entry point

### Container Security
- ✅ `no-new-privileges:true`
- ✅ Drop all capabilities, add only required
- ✅ Resource limits (CPU, Memory)
- ✅ Health checks for all services

### Application Security
- ✅ ModSecurity WAF (production)
- ✅ Rate limiting
- ✅ Security headers (CSP, HSTS, etc)
- ✅ Cloudflare DDoS protection

## 📝 Configuration Management

### Environment Variables
All infrastructure components use environment variables:

```bash
# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=xxx

# Nginx
UPSTREAM_HOST=app
UPSTREAM_PORT=3000
SERVER_NAME=bot.opinionry.my.id

# Docker
NODE_ENV=production
DATABASE_URL=postgresql://...
```

### Templates
Nginx uses `envsubst` for dynamic configuration:
- Templates: `infrastructure/nginx/config/*.template`
- Output: `/etc/nginx/conf.d/*.conf` (in container)

## 🔍 Monitoring & Debugging

### Health Checks
```bash
# Nginx health
curl http://localhost:8080/nginx/health

# App health
curl http://localhost:8080/health

# Database
podman exec bot-medsos-db pg_isready
```

### Logs
```bash
# All services
podman-compose logs -f

# Specific service
podman logs -f bot-medsos-nginx
podman logs -f bot-medsos-tunnel

# Nginx access logs (host)
tail -f logs/nginx/access.log
```

### Network Debugging
```bash
# Inspect network
podman network inspect bot-medsos-network

# Test connectivity
podman exec bot-medsos-nginx ping app
podman exec bot-medsos-app ping db
```

## 🛠️ Troubleshooting

### Tunnel not connecting
1. Check `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
2. View tunnel logs: `podman logs bot-medsos-tunnel`
3. Verify tunnel in Cloudflare dashboard

### Nginx error 502
1. Check app is running: `podman ps`
2. Verify app health: `curl http://localhost:3000/health`
3. Check nginx logs: `podman logs bot-medsos-nginx`

### Database connection failed
1. Check db is healthy: `podman exec bot-medsos-db pg_isready`
2. Verify `DATABASE_URL` in app environment
3. Ensure db started before app: `depends_on` in compose

## 📖 References

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [BunkerWeb](https://docs.bunkerweb.io/)

## 🎯 Next Steps

1. **Review each component README** - Detailed docs in subdirectories
2. **Configure environment variables** - Copy `.env.example` to `.env`
3. **Test development mode** - `podman-compose up -d`
4. **Deploy production** - Use production compose override
5. **Monitor and optimize** - Check logs, health checks, performance
