# Development Guide

## Quick Start untuk Development

### 1. Setup Local Environment

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Setup database (pastikan PostgreSQL running)
npm run db:migrate
```

### 2. Running Locally (Without Docker)

```bash
# Start application
npm run start:telegram

# Or dengan PM2
npm run start:prod
```

### 3. Database Management

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Push schema tanpa migration (development only)
npm run db:push

# View database dengan GUI
npm run db:studio  # Opens at http://localhost:5555
```

## Project Structure Deep Dive

### Core Layer

**`core/applications/bot-telegram/`**
- `BotCore.js` - Main orchestrator, handles webhook setup
- `handlers/` - Message & callback query handlers
- `security/` - AuthN & AuthZ services

**`core/shared/`**
- `entities/` - Domain models (tidak ada database logic)
- `repositories/` - Repository interfaces (ports)
- `services/` - Business logic services

### Adapters Layer

**`adapters/bot-telegram/telegram/`**
- `TelegramAdapter.js` - Wrapper untuk Telegram Bot API

**`adapters/shared/database/`**
- `PrismaAdapter.js` - Database connection manager
- Repository implementations

**`adapters/shared/game-providers/`**
- `VIPResellerAdapter.js` - Game provider integration

**`adapters/shared/payment/`**
- `SakurupiahAdapter.js` - Payment gateway
- `SakurupiahCallbackHandler.js` - Payment webhook handler

## Dependency Injection

All dependencies di-wire di `server/app.js` (Composition Root):

```javascript
// 1. Adapters (Infrastructure)
const prismaAdapter = new PrismaAdapter();
const telegramAdapter = new TelegramAdapter(token);

// 2. Repositories (Data Access)
const userRepository = new UserRepository(prismaAdapter);

// 3. Services (Business Logic)
const sessionService = new SessionService(sessionRepository);

// 4. Application (Use Cases)
const bot = new BotCore(telegramAdapter, services, config);
```

## Testing

### Manual Testing

```bash
# Test database connection
node scripts/test-validation.js

# Verify data sync
node scripts/verify-sync.js

# Sync game catalog
node scripts/sync-brands.js
```

### Debugging

Set environment:
```bash
export NODE_ENV=development
export DEBUG=bot:*
```

PM2 logs:
```bash
npm run pm2:logs
```

## Common Development Tasks

### Add New Game

1. Sync dari VIPReseller:
   ```bash
   node scripts/sync-brands.js
   ```

2. Verify:
   ```bash
   node scripts/verify-sync.js
   ```

### Update Payment Channels

Payment channels di-sync otomatis saat bot start. Untuk manual sync, edit `PaymentService.syncPaymentChannels()`.

### Database Schema Changes

1. Edit `prisma/schema.prisma`
2. Create migration:
   ```bash
   npx prisma migrate dev --name descriptive_name
   ```
3. Migration file akan dibuat di `prisma/migrations/`

## Code Style

- **ES Modules**: Gunakan `import/export`, bukan `require`
- **Async/Await**: Prefer async/await over `.then()`
- **Error Handling**: Semua async functions harus wrapped try-catch
- **Logging**: Gunakan `logger` dari `core/shared/services/Logger.js`

## Architecture Decisions

### Mengapa Hexagonal Architecture?

1. **Testability**: Business logic independent dari infrastructure
2. **Flexibility**: Ganti database/API tanpa touch core logic
3. **Maintainability**: Separation of concerns yang jelas

### Mengapa Repository Pattern?

1. Abstract database operations dari business logic
2. Mudah mock untuk testing
3. Consistent data access interface

### Mengapa Manual DI (bukan framework)?

1. **Simplicity**: Tidak perlu belajar DI framework
2. **Explicitness**: Dependency graph jelas terlihat
3. **Control**: Full control atas object lifecycle

## Useful Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Sync brands | `node scripts/sync-brands.js` | Update game catalog |
| Verify sync | `node scripts/verify-sync.js` | Check sync status |
| Test validation | `node scripts/test-validation.js` | Test player ID validation |
| Analyze data | `node scripts/analyze-vipreseller-structure.js` | Analyze VIP API response |
| Debug VIP API | `node scripts/debug-vipreseller.js` | Debug VIPReseller calls |

## Environment Setup

### Development

```env
DATABASE_URL="postgresql://botuser:password@localhost:5432/botmedsos"
NODE_ENV=development
APP_BASE_URL=http://localhost:3000  # Bisa pakai ngrok untuk testing webhook
```

### Staging

```env
DATABASE_URL="postgresql://user:pass@staging-db:5432/botmedsos"
NODE_ENV=production
APP_BASE_URL=https://staging.yourdomain.com
```

### Production

```env
DATABASE_URL="postgresql://user:pass@prod-db:5432/botmedsos"
NODE_ENV=production
APP_BASE_URL=https://bot.yourdomain.com
```

## Git Ignore

Pastikan `.gitignore` include:
```
node_modules/
.env
*.log
logs/
build.log
```

**NEVER** commit `.env` ke git!
