# Docker Infrastructure

This directory contains Docker/Podman orchestration files for the bot-medsos application.

## Directory Structure

```
docker/
├── docker-compose.yml            # Main compose file (development)
├── docker-compose.production.yml # Production overrides (BunkerWeb)
├── Dockerfile                    # Application container image
├── docker-entrypoint.sh          # Container startup script
└── README.md                     # This file
```

## Purpose

Centralized location for all container orchestration and build files following Infrastructure as Code principles.

## Files

### `docker-compose.yml`
Main orchestration file for development/staging:
- 4 services: app, db, nginx, tunnel
- Custom bridge network
- Health checks
- Resource limits
- Volume management

### `docker-compose.production.yml`
Production-specific overrides:
- Swap nginx → BunkerWeb
- Stricter security settings
- Production environment variables
- ModSecurity enabled

### `Dockerfile`
Application container image:
- Based on Node.js Alpine
- Multi-stage build (if applicable)
- Prisma client generation
- Security best practices

### `docker-entrypoint.sh`
Container startup script:
- Wait for database ready
- Run migrations
- Start application

## Usage

### Development
```bash
cd /home/riky/Documents/bot-medsos

# Build images
podman-compose build --no-cache

# Start all services
podman-compose up -d

# View logs
podman-compose logs -f
```

### Production
```bash
# Use production override
podman-compose -f docker-compose.yml \
               -f docker-compose.production.yml \
               up -d
```

### Individual Services
```bash
# Start only database
podman-compose up -d db

# Restart app
podman-compose restart app

# Stop all
podman-compose down
```

## Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| `app` | bot-medsos-app | 3000 (internal) | Node.js application |
| `db` | bot-medsos-db | 5432 (internal) | PostgreSQL database |
| `nginx` | bot-medsos-nginx | 8080 → 127.0.0.1 | Reverse proxy |
| `tunnel` | bot-medsos-tunnel | - | Cloudflare inbound gateway |

## Network Architecture

```
┌─────────────────────────────────────────────┐
│         Docker Network: bot-network         │
│              (172.20.0.0/16)                │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Tunnel  │→ │  Nginx  │→ │   App   │    │
│  └─────────┘  └─────────┘  └────┬────┘    │
│                                  │          │
│                            ┌─────▼────┐    │
│                            │    DB    │    │
│                            └──────────┘    │
└─────────────────────────────────────────────┘
```

**Key Points:**
- All services in isolated bridge network
- Service discovery via container names (e.g., `app`, `db`)
- No direct host port exposure except nginx (localhost only)
- Internet access for outbound connections (app → external APIs)

## Hexagonal Architecture Position

```
┌──────────────────────────────────────────────┐
│       INFRASTRUCTURE LAYER                   │
│   (Deployment & Orchestration)               │
│                                              │
│   Docker Compose orchestrates:               │
│   • Application containers                   │
│   • Infrastructure containers (nginx, db)    │
│   • Network configuration                    │
│   • Volume management                        │
└──────────────────────────────────────────────┘
```

**Role:**
- **Orchestration:** Manage multi-container application
- **Infrastructure as Code:** Reproducible deployments
- **Environment Isolation:** Development vs Production
- **Dependency Management:** Service startup order

## Environment Variables

Required in `.env` file at project root:

```bash
# Database
DATABASE_URL=postgresql://botuser:roman@db:5432/botmedsos

# APIs
VIPRESELLER_API_KEY=xxx
VIPRESELLER_API_ID=xxx
SAKURUPIAH_API_KEY=xxx
SAKURUPIAH_API_ID=xxx

# Telegram
TELEGRAM_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx
ADMIN_CHAT_ID=xxx

# Application
APP_BASE_URL=https://bot.opinionry.my.id

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=xxx
```

## Best Practices

✅ **Always use compose for development** - Consistent environment  
✅ **Build with `--no-cache` for production** - Avoid stale layers  
✅ **Check health before deployment** - `podman-compose ps`  
✅ **Review logs regularly** - `podman-compose logs -f app`  
✅ **Backup database volumes** - `postgres_data` volume  

## Troubleshooting

### Containers not starting
```bash
# Check status
podman-compose ps

# View logs
podman-compose logs app
podman-compose logs db

# Rebuild
podman-compose down
podman-compose build --no-cache
podman-compose up -d
```

### Network issues
```bash
# Inspect network
podman network inspect bot-medsos-network

# Test connectivity between containers
podman exec bot-medsos-app ping db
podman exec bot-medsos-nginx wget -O- http://app:3000/health
```

### Database not ready
```bash
# Check database health
podman exec bot-medsos-db pg_isready -U botuser

# View database logs
podman logs bot-medsos-db
```

## Migration from Old Setup

If migrating from manual scripts:

1. **Stop old containers:**
   ```bash
   podman stop bot-medsos-nginx bot-medsos-app
   podman rm bot-medsos-nginx bot-medsos-app
   ```

2. **Start with compose:**
   ```bash
   podman-compose up -d
   ```

3. **Verify:**
   ```bash
   curl http://localhost:8080/health
   ```

## References

- [Docker Compose Spec](https://docs.docker.com/compose/compose-file/)
- [Podman Compose](https://github.com/containers/podman-compose)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
