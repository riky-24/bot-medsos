# Bot Medsos - Telegram Game Top-Up Bot

> **Bot Telegram untuk automasi top-up game** dengan arsitektur hexagonal (ports & adapters)

## 📋 Daftar Isi

- [Overview](#overview)
- [Arsitektur](#arsitektur)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Scripts](#scripts)

---

## Overview

Bot Medsos adalah Telegram bot yang memungkinkan user untuk membeli top-up game (Mobile Legends, Free Fire, dll) melalui chat Telegram. Bot ini terintegrasi dengan:

- **VIPReseller** - Game provider untuk digital products
- **Sakurupiah** - Payment gateway
- **PostgreSQL** - Database untuk user, transactions, sessions
- **Cloudflare Tunnel** - Secure tunnel untuk webhook callbacks

### Fitur Utama

✅ Browse dan pilih game dari catalog  
✅ Input player ID dengan validasi nickname  
✅ Multiple payment channels (QRIS, E-Wallet, Bank Transfer)  
✅ Automatic order processing  
✅ Session management untuk shopping cart  
✅ Admin notifications  
✅ Transaction history  

---

## Arsitektur

Project ini menggunakan **Hexagonal Architecture** (Ports & Adapters Pattern):

```
bot-medsos/
├── core/                    # ⬢ Domain Layer (Business Logic)
│   ├── applications/        # Use Cases & Application Services
│   │   └── bot-telegram/    # Telegram Bot Application
│   └── shared/              # Shared Domain Services
│       ├── services/        # Domain Services
│       ├── repositories/    # Repository Interfaces (Ports)
│       └── entities/        # Domain Models
├── adapters/                # 🔌 Infrastructure Layer (Adapters)
│   ├── bot-telegram/        # Telegram API Adapter
│   ├── shared/
│   │   ├── database/        # Prisma Database Adapter
│   │   ├── game-providers/  # VIPReseller Adapter
│   │   └── payment/         #Sakurupiah Payment Adapter
│   └── infrastructure/      # Config & Utilities
├── server/                  # 🌐 HTTP Server Entry Point
│   └── app.js               # Express server + DI composition root
├── scripts/                 # 🛠️ Utility & Migration Scripts
├── prisma/                  # 💾 Database Schema & Migrations
└── docker/                  # 🐳 Containerization
```

### Layer Responsibilities

| Layer | Direktori | Tanggung Jawab |
|-------|-----------|----------------|
| **Domain** | `core/` | Business logic, entities, use cases |
| **Application** | `core/applications/` | Orchestration, bot handlers |
| **Infrastructure** | `adapters/` | External integrations (DB, APIs, Telegram) |
| **Entry Point** | `server/app.js` | Dependency injection, HTTP server |

---

## Tech Stack

### Runtime & Framework
- **Node.js v20** (ES Modules)
- **Express v5** - HTTP server untuk webhooks
- **Telegraf** - Telegram Bot framework (via custom adapter)

### Database & ORM
- **PostgreSQL 16** - Relational database
- **Prisma 5.22** - Type-safe ORM

### External APIs
- **Telegram Bot API** - Bot interface
- **VIPReseller API** - Game provider
- **Sakurupiah API** - Payment gateway
- **Cloudflare Tunnel** - Webhook tunneling

### DevOps
- **Podman/Docker** - Containerization
- **Podman Compose** - Multi-container orchestration
- **PM2** - Process manager (optional, for non-Docker deployment)
- **Nginx** - Reverse proxy

---

## Prerequisites

### System Requirements
- **OS**: Linux (Fedora/RHEL/Ubuntu) or macOS
- **Container Runtime**: Podman (recommended) or Docker
- **Node.js**: v20+ (jika run tanpa Docker)
- **Database**: PostgreSQL 16+ (auto-deployed via compose)

### Akun & API Keys
- [x] Telegram Bot Token (dari [@BotFather](https://t.me/BotFather))
- [x] VIPReseller API Key & ID
- [x] Sakurupiah API Key & ID
- [x] Cloudflare Tunnel Token (**PENTING** untuk production dengan webhook)
- [x] Domain/subdomain (untuk webhook URL)

---

## Installation

### 1. Clone Repository

```bash
cd ~/Documents
# Asumsi sudah ada folder bot-medsos
cd bot-medsos
```

### 2. Install Dependencies (Jika Run Lokal Tanpa Docker)

```bash
npm install
```

### 3. Setup Environment Variables

Copy file `.env.example` (jika ada) atau create `.env` baru:

```bash
cp .env.example .env
# Atau create manual
nano .env
```

Isi semua variabel (lihat section [Environment Variables](#environment-variables))

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Database Migration (Lokal Development)

**Option A: Using Docker Compose** (Recommended)

```bash
# Database otomatis di-setup saat container start
podman-compose up -d db
```

**Option B: Manual Migration**

```bash
# Pastikan PostgreSQL running di localhost:5432
npm run db:migrate
```

---

## Deployment

### Option 1: Docker/Podman Compose (Recommended untuk Production)

#### Build & Start Services

```bash
# Build images
podman-compose build --no-cache

# Start all services (app + db + nginx + tunnel)
podman-compose up -d

# Check logs
podman logs -f bot-medsos-app
```

#### Services yang Di-deploy

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| `app` | bot-medsos-app | 3000 | Node.js application |
| `db` | bot-medsos-db | 5432 | PostgreSQL database |
| `nginx` | bot-medsos-nginx | 8080→80 | Reverse proxy |
| `tunnel` | bot-medsos-tunnel | - | Cloudflare tunnel |

#### Health Check

```bash
# Via nginx (from outside)
curl http://localhost:8080/health

# Direct to app (internal)
curl http://localhost:3000/health

# Expected response
{
  "status": "ok",
  "uptime": 123.45,
  "database": true
}
```

#### Stop Services

```bash
podman-compose down
```

#### Cleanup Images

```bash
# Remove dangling images
podman image prune -f

# Remove all unused images
podman image prune -a -f
```

### Option 2: PM2 (Untuk Development atau Non-Docker Deployment)

```bash
# Start dengan PM2
npm run start:prod

# Check logs
npm run pm2:logs

# Stop
pm2 stop bot-medsos

# Restart
pm2 restart bot-medsos
```

---

## Environment Variables

Create file `.env` di root project dengan isi berikut:

```bash
# ========================================
# DATABASE
# ========================================
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# Docker: use 'db' as host
# Local: use 'localhost' as host
DATABASE_URL="postgresql://botuser:roman@db:5432/botmedsos?connection_limit=20&pool_timeout=10"

# ========================================
# GAME PROVIDER - VIPReseller
# ========================================
VIPRESELLER_API_KEY=your_vipreseller_api_key_here
VIPRESELLER_API_ID=your_vipreseller_api_id_here

# ========================================
# PAYMENT GATEWAY - Sakurupiah
# ========================================
SAKURUPIAH_API_ID=your_sakurupiah_merchant_id
SAKURUPIAH_API_KEY=your_sakurupiah_api_key

# ========================================
# TELEGRAM BOT
# ========================================
# Get from @BotFather
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Webhook secret untuk validate request dari Telegram
# Generate random string (min 32 char)
TELEGRAM_WEBHOOK_SECRET=random_secure_string_min_32_characters_long

# ========================================
# APPLICATION
# ========================================
# Public URL untuk webhook (HARUS HTTPS)
# Gunakan Cloudflare Tunnel atau Ngrok untuk development
APP_BASE_URL=https://yourdomain.com

# Admin Telegram Chat ID untuk notifikasi error
# Cara dapat ID: chat ke @userinfobot
ADMIN_CHAT_ID=123456789

# ========================================
# CLOUDFLARE TUNNEL
# ========================================
# Get from Cloudflare Zero Trust Dashboard
CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
```

### Cara Mendapatkan Environment Variables

| Variable | Cara Mendapatkan |
|----------|-----------------|
| `TELEGRAM_TOKEN` | Chat [@BotFather](https://t.me/BotFather) → /newbot |
| `ADMIN_CHAT_ID` | Chat [@userinfobot](https://t.me/userinfobot) |
| `VIPRESELLER_API_*` | Daftar di VIPReseller untuk merchant account |
| `SAKURUPIAH_API_*` | Daftar di Sakurupiah merchant panel |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Zero Trust → Access → Tunnels |

---

## Troubleshooting

### Container tidak start / Database error

**Problem**: Error `The table public.payment_channels does not exist`

**Solution**: Database migrations belum jalan. Check logs:

```bash
podman logs bot-medsos-app

# Seharusnya ada log:
# 🔧 Docker Entrypoint: Starting initialization...
# ✅ Database is ready!
# 🔄 Running database migrations...
# ✅ Migrations completed!
```

Jika tidak ada, rebuild container:

```bash
podman-compose down
podman-compose build --no-cache app
podman-compose up -d
```

### Webhook tidak terima callback

**Problem**: Telegram tidak bisa hit webhook

**Checklist**:
1. ✅ `APP_BASE_URL` harus **HTTPS** (wajib untuk Telegram)
2. ✅ Cloudflare Tunnel running: `podman logs bot-medsos-tunnel`
3. ✅ Check webhook status:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```
4. ✅ Pastikan `TELEGRAM_WEBHOOK_SECRET` sama dengan yang di set webhook

### Dangling Docker Images

**Problem**: Banyak images dengan tag `<none>`

**Solution**:

```bash
# Cleanup stopped containers
podman container prune -f

# Remove dangling images
podman image prune -f

# Nuclear option (remove all unused)
podman system prune -a -f
```

### PM2 process crash loop

**Problem**: App terus restart

**Check logs**:

```bash
pm2 logs bot-medsos --lines 100
```

Common causes:
- Database connection failed (check `DATABASE_URL`)
- Missing ENV variables
- Port 3000 already in use

---

## Scripts

### Database Scripts

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations (development)
npm run db:migrate

# Push schema tanpa migration (use with caution)
npm run db:push

# Open Prisma Studio (DB GUI)
npm run db:studio
```

### Utility Scripts

Located in `scripts/` directory:

| Script | Purpose |
|--------|---------|
| `sync-brands.js` | Sync game catalog dari VIPReseller |
| `verify-sync.js` | Verify data sync status |
| `test-validation.js` | Test player ID validation |
| `setup-tunnel-service.sh` | Setup Cloudflare Tunnel sebagai systemd service |
| `setup-vps.sh` | Initial VPS setup script |

Run scripts:

```bash
node scripts/sync-brands.js
```

---

## Project Structure Detail

```
.
├── adapters/
│   ├── bot-telegram/telegram/     # Telegram Bot API wrapper
│   ├── shared/
│   │   ├── database/              # Prisma adapter
│   │   ├── game-providers/        # VIPReseller integration
│   │   └── payment/               # Sakurupiah payment + callback handler
│   └── infrastructure/            # Config loaders
├── core/
│   ├── applications/bot-telegram/ # Bot use cases & handlers
│   │   ├── security/              # Authentication & authorization
│   │   ├── handlers/              # Message & callback handlers
│   │   └── BotCore.js             # Main bot orchestrator
│   └── shared/
│       ├── entities/              # Domain models (User, Transaction, etc)
│       ├── repositories/          # Repository interfaces
│       └── services/              # Domain services
├── server/
│   └── app.js                     # Express server + DI container
├── prisma/
│   └── schema.prisma              # Database schema
├── scripts/                       # Utility scripts
├── docker-compose.yml             # Multi-container setup
├── Dockerfile                     # Application container
├── docker-entrypoint.sh           # Container startup script
└── package.json                   # Dependencies
```

---

## License

Proprietary - Internal use only

---

## Support

Untuk issues atau pertanyaan:
- Check [Troubleshooting](#troubleshooting) section
- Review logs: `podman logs bot-medsos-app`
- Contact: Admin Telegram ID dalam `ADMIN_CHAT_ID`
