# Configuration Guide

> **Panduan lengkap untuk mengelola konfigurasi aplikasi Bot Medsos**

## 📚 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration Structure](#configuration-structure)
- [Environment Files](#environment-files)
- [Available Configurations](#available-configurations)
- [Using AppConfig](#using-appconfig)
- [Environment-Specific Settings](#environment-specific-settings)
- [Troubleshooting](#troubleshooting)

---

## Overview

Bot Medsos menggunakan **Centralized Configuration Management** dengan `AppConfig` class sebagai single source of truth untuk semua konfigurasi aplikasi.

### ✅ Best Practices

1. **JANGAN** akses `process.env` langsung di code
2. **GUNAKAN** `AppConfig.xxx.yyy` untuk semua config access
3. **VALIDATE** config di startup (fail-fast)
4. **ENVIRONMENT FILES** untuk different deployment environments
5. **NEVER** commit `.env` files ke git

---

## Quick Start

### 1. Setup Environment File

```bash
# Copy example file
cp .env.example .env

# Edit dengan credentials Anda
nano .env
```

### 2. Set Required Variables

Minimal configuration yang **WAJIB** diisi:

```env
# Telegram Bot Token (dari @BotFather)
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Database Connection
DATABASE_URL=postgresql://user:password@localhost:5432/botmedsos

# Payment Gateway (Sakurupiah)
SAKURUPIAH_API_KEY=your_api_key_here
SAKURUPIAH_API_ID=your_merchant_id_here
```

### 3. Start Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

---

## Configuration Structure

Semua konfigurasi di-manage oleh `AppConfig` class di:

```
core/shared/config/AppConfig.js
```

### Architecture Pattern

```
┌─────────────────┐
│  .env files     │  ← Environment Variables
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AppConfig.js   │  ← Centralized Config (Single Source of Truth)
└────────┬────────┘
         │
         ├──► server/app.js
         ├──► Adapters (Payment, Game Provider, etc)
         └──► Services & Repositories
```

---

## Environment Files

### File Hierarchy

```
.env                    # Default/Base config
.env.development        # Development overrides
.env.staging           # Staging overrides
.env.production        # Production overrides
.env.example           # Template (committed to git)
```

### Loading Priority

```
System ENV > .env.{NODE_ENV} > .env
```

**Example:**

```bash
# .env
PORT=3000
DATABASE_URL=postgresql://localhost:5432/botmedsos

# .env.production
PORT=8080
DATABASE_URL=postgresql://prod-server:5432/botmedsos

# Jika NODE_ENV=production:
# PORT akan jadi 8080 (dari .env.production)
# DATABASE_URL dari .env.production
```

---

## Available Configurations

### 🌍 Environment Configuration

```javascript
import { AppConfig } from './core/shared/config/AppConfig.js';

const env = AppConfig.environment;
console.log(env.nodeEnv);        // "development" | "staging" | "production"
console.log(env.isDevelopment);  // true/false
console.log(env.isProduction);   // true/false
console.log(env.isStaging);      // true/false
```

**Environment Variables:**
- `NODE_ENV` - Environment mode (default: `development`)

---

### 📱 Application Configuration

```javascript
const app = AppConfig.app;
console.log(app.baseUrl);         // Public base URL untuk webhooks
console.log(app.port);            // HTTP server port
console.log(app.adminChatId);     // Telegram admin chat ID
console.log(app.enableAutoTunnel);// Auto-start Cloudflare Tunnel
```

**Environment Variables:**
- `APP_BASE_URL` - Public webhook URL (default: `http://localhost:3000` di dev)
- `PORT` - HTTP server port (default: `3000`)
- `ADMIN_CHAT_ID` - Telegram admin chat ID untuk notifications
- `ENABLE_AUTO_TUNNEL` - Auto-start tunnel (`true`/`false`, default: `false`)

---

### 🔐 Telegram Configuration

```javascript
const telegram = AppConfig.telegram;
console.log(telegram.token);         // Bot token
console.log(telegram.webhookUrl);    // Webhook URL
console.log(telegram.webhookSecret); // Webhook secret token
console.log(telegram.description);   // Bot description (optional)
console.log(telegram.about);         // Bot about text (optional)
```

**Environment Variables:**
- `TELEGRAM_TOKEN` - Bot token dari @BotFather (**REQUIRED**)
- `TELEGRAM_WEBHOOK_URL` - Webhook URL (default: sama dengan `APP_BASE_URL`)
- `TELEGRAM_WEBHOOK_SECRET` - Secret token untuk validate webhooks
- `WEBHOOK_SECRET` - Alias untuk `TELEGRAM_WEBHOOK_SECRET`
- `BOT_DESCRIPTION` - Bot description (optional)
- `BOT_ABOUT` - Bot about text (optional)

---

### 🗄️ Database Configuration

```javascript
const db = AppConfig.database;
console.log(db.url);             // PostgreSQL connection URL
console.log(db.connectionLimit); // Max connections
console.log(db.poolTimeout);     // Pool timeout (seconds)
console.log(db.connectTimeout);  // Connect timeout (seconds)
```

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (**REQUIRED**)
- `DB_CONNECTION_LIMIT` - Max connections (default: `20`)
- `DB_POOL_TIMEOUT` - Pool timeout in seconds (default: `10`)
- `DB_CONNECT_TIMEOUT` - Connection timeout (default: `5`)

---

### 💳 Payment Gateway Configuration

```javascript
const payment = AppConfig.payment;
console.log(payment.sakurupiah.apiKey);   // API Key
console.log(payment.sakurupiah.apiId);    // Merchant ID
console.log(payment.sakurupiah.baseUrl);  // API URL
console.log(payment.callbackUrl);         // Payment callback URL
console.log(payment.returnUrl);           // Payment return URL
```

**Environment Variables:**
- `SAKURUPIAH_API_KEY` - Sakurupiah API Key (**REQUIRED**)
- `SAKURUPIAH_API_ID` - Merchant ID (**REQUIRED**)
- `SAKURUPIAH_BASE_URL` - API URL (default: `https://sakurupiah.id/api-sanbox`)
- `PAYMENT_CALLBACK_URL` - Callback URL (default: `{APP_BASE_URL}/callback/payment`)
- `PAYMENT_RETURN_URL` - Return URL (default: `{APP_BASE_URL}/invoice`)

---

### 🎮 Game Provider Configuration

```javascript
const gameProvider = AppConfig.gameProvider;
console.log(gameProvider.vipreseller.apiKey);   // API Key
console.log(gameProvider.vipreseller.apiId);    // API ID
console.log(gameProvider.vipreseller.baseUrl);  // API URL
```

**Environment Variables:**
- `VIPRESELLER_API_KEY` - VIPReseller API Key (optional)
- `VIPRESELLER_API_ID` - VIPReseller API ID (optional)
- `VIPRESELLER_BASE_URL` - API URL (default: `https://vip-reseller.co.id/api/game-feature`)

---

### ☁️ Cloudflare Tunnel Configuration

```javascript
const cloudflare = AppConfig.cloudflare;
console.log(cloudflare.token);  // Tunnel token
console.log(cloudflare.port);   // Tunnel port
```

**Environment Variables:**
- `CLOUDFLARE_TUNNEL_TOKEN` - Cloudflare Tunnel token (optional)

---

### 📝 Logging Configuration

```javascript
const logging = AppConfig.logging;
console.log(logging.level);    // Log level
console.log(logging.enabled);  // Logging enabled/disabled
```

**Environment Variables:**
- `LOG_LEVEL` - Log level (default: `debug` di dev, `info` di production)
- `LOG_ENABLED` - Enable logging (`true`/`false`, default: `true`)

---

### 🔄 Retry Configuration

```javascript
const retry = AppConfig.retry;
console.log(retry.maxRetries);  // Max retry attempts
console.log(retry.retryDelay);  // Delay between retries (ms)
```

**Environment Variables:**
- `MAX_RETRIES` - Max retry attempts (default: `3`)
- `RETRY_DELAY` - Retry delay in milliseconds (default: `1000`)

---

### 💾 Cache Configuration

```javascript
const cache = AppConfig.cache;
console.log(cache.ttl);      // Cache TTL (seconds)
console.log(cache.enabled);  // Cache enabled/disabled
```

**Environment Variables:**
- `CACHE_TTL` - Cache time-to-live in seconds (default: `3600`)
- `CACHE_ENABLED` - Enable cache (`true`/`false`, default: `true`)

---

## Using AppConfig

### ✅ Correct Usage

```javascript
import { AppConfig } from './core/shared/config/AppConfig.js';

// Good - use AppConfig
const port = AppConfig.app.port;
const dbUrl = AppConfig.database.url;
const telegramToken = AppConfig.telegram.token;
```

### ❌ Incorrect Usage

```javascript
// Bad - jangan akses process.env langsung
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
const telegramToken = process.env.TELEGRAM_TOKEN;
```

### Example: Initialize Service

```javascript
import { AppConfig } from './core/shared/config/AppConfig.js';
import { TelegramAdapter } from './adapters/telegram/TelegramAdapter.js';

// Use AppConfig untuk dependency injection
const telegramAdapter = new TelegramAdapter(
  AppConfig.telegram.token
);

// Start server dengan config
const app = express();
app.listen(AppConfig.app.port, () => {
  console.log(`Server running on port ${AppConfig.app.port}`);
});
```

---

## Environment-Specific Settings

### Development Mode

```bash
NODE_ENV=development npm run start:dev
```

**Automatic defaults:**
- `LOG_LEVEL`: `debug` (verbose logging)
- `APP_BASE_URL`: `http://localhost:3000`
- Prisma logs: `query`, `error`, `warn`

### Production Mode

```bash
NODE_ENV=production npm run start:prod
```

**Automatic defaults:**
- `LOG_LEVEL`: `info` (production logging)
- `APP_BASE_URL`: Must be set explicitly (HTTPS required)
- Prisma logs: `error` only

### Staging Mode

```bash
NODE_ENV=staging npm run start:staging
```

Similar to production but isolated environment.

---

## Troubleshooting

### Error: Missing Required Environment Variables

```
❌ Missing required environment variables: TELEGRAM_TOKEN, DATABASE_URL

💡 Fix:
1. Copy .env.example ke .env
2. Set values untuk: TELEGRAM_TOKEN, DATABASE_URL
3. Restart aplikasi
```

**Solution:**

```bash
cp .env.example .env
# Edit .env dan isi values yang required
nano .env
```

---

### Error: DATABASE_URL must start with postgresql://

**Problem:** Database URL format salah

**Solution:**

```env
# ❌ Wrong
DATABASE_URL=mysql://localhost:3306/botmedsos

# ✅ Correct
DATABASE_URL=postgresql://user:password@localhost:5432/botmedsos
```

---

### Warning: TELEGRAM_TOKEN might be invalid

**Problem:** Token format tidak sesuai

**Solution:**

```env
# ❌ Wrong
TELEGRAM_TOKEN=1234567890

# ✅ Correct (format: <bot_id>:<token>)
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

Get token dari [@BotFather](https://t.me/BotFather)

---

### Config Not Updating

**Problem:** Perubahan di `.env` tidak ter-apply

**Solution:**

1. Restart aplikasi (config di-load saat startup)
2. Check NODE_ENV - pastikan load file yang benar
3. Check environment variable priority

```bash
# Debug: print semua config
node -e "import('./core/shared/config/AppConfig.js').then(m => console.log(m.AppConfig.getAll()))"
```

---

## Adding New Configuration

### 1. Add to AppConfig.js

```javascript
// core/shared/config/AppConfig.js

static get myNewFeature() {
  return Object.freeze({
    enabled: process.env.MY_FEATURE_ENABLED === 'true',
    apiKey: process.env.MY_FEATURE_API_KEY,
    timeout: parseInt(process.env.MY_FEATURE_TIMEOUT) || 5000
  });
}
```

### 2. Add to .env.example

```env
# ========================================
# MY NEW FEATURE
# ========================================
MY_FEATURE_ENABLED=false
MY_FEATURE_API_KEY=your_api_key_here
MY_FEATURE_TIMEOUT=5000
```

### 3. Update Validation (if required)

```javascript
static validate() {
  const required = [
    'TELEGRAM_TOKEN',
    'DATABASE_URL',
    // Add new required var
    'MY_FEATURE_API_KEY'
  ];
  // ...
}
```

### 4. Use in Code

```javascript
import { AppConfig } from './core/shared/config/AppConfig.js';

if (AppConfig.myNewFeature.enabled) {
  const apiKey = AppConfig.myNewFeature.apiKey;
  // Use feature...
}
```

---

## Security Best Practices

### ✅ DO

- ✅ Store sensitive data di environment variables
- ✅ Use `.env` files locally
- ✅ Add `.env` ke `.gitignore`
- ✅ Use secrets manager di production (AWS Secrets Manager, Vault, etc)
- ✅ Validate config format di startup
- ✅ Use HTTPS untuk production webhooks

### ❌ DON'T

- ❌ Commit `.env` files ke git
- ❌ Hardcode credentials di code
- ❌ Share `.env` files via email/chat
- ❌ Use HTTP di production
- ❌ Log sensitive config values

---

## References

- [12-Factor App](https://12factor.net/config) - Config best practices
- [Node.js Environment Variables](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [Telegram Bot API](https://core.telegram.org/bots/api) - Webhook setup

---

**Last Updated:** 2026-02-14  
**Maintainer:** Bot Medsos Team
