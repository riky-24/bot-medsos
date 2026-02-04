# Platform Adapters

This directory contains adapters for **platform/system-level components** that need to be managed via application code (not Docker Compose).

---

## 🎯 What Goes Here?

✅ **Adapters that spawn/manage OS processes**  
✅ **Adapters that manage system-level services**  
✅ **Code that interacts with binaries from `infrastructure/`**  

❌ **NOT database adapters** (those go in `adapters/shared/database/`)  
❌ **NOT API adapters** (those go in `adapters/shared/*/`)  

---

## 📦 Current Adapters

### CloudflareTunnelAdapter.js

**Purpose:** Manages cloudflared process lifecycle for inbound webhook traffic.

**Features:**
- Spawns cloudflared binary as child process
- Monitors process health (stdout/stderr)
- Graceful shutdown handling
- Auto-downloads binary if missing
- Platform detection (Linux, macOS, Windows)

**Usage:**
```javascript
import { CloudflareTunnelAdapter } from './adapters/platform/CloudflareTunnelAdapter.js';

const tunnel = new CloudflareTunnelAdapter({
    token: process.env.CLOUDFLARE_TUNNEL_TOKEN
});

await tunnel.start(); // Spawns process
tunnel.stop();         // Kills process
```

**Binary Location:**
- Uses: `infrastructure/cloudflare-tunnel/bin/cloudflared`
- Auto-downloaded on first run
- Platform-specific (linux-amd64, darwin-arm64, etc)

**Why Adapter Needed?**
- Application code spawns the process (not Docker Compose)
- Needs lifecycle management in code
- Requires process monitoring and error handling

---

## ❓ FAQ: Why No Nginx/BunkerWeb Adapters?

**Q: Where's the NginxAdapter?**  
**A:** Not needed! Nginx is managed by **Docker Compose**, not application code.

**Nginx Management Flow:**
```
docker-compose.yml
    ↓
Defines nginx service
    ↓
Mounts config from infrastructure/nginx/config/
    ↓
Docker starts nginx container
```

**No code involved!** It's all declarative configuration.

**Q: What if I need to reload nginx from code?**  
**A:** You could create an adapter:
```javascript
// adapters/platform/NginxAdapter.js (HYPOTHETICAL)
export class NginxAdapter {
    async reload() {
        await exec('podman exec bot-medsos-nginx nginx -s reload');
    }
}
```

But currently we don't need this - nginx config is static.

---

## 🔄 When to Create Platform Adapter?

Use this decision tree:

```
Does component need management from application code?
│
├─ YES
│  │
│  ├─ Spawns process? → Platform Adapter (here)
│  ├─ Makes API calls? → API Adapter (adapters/shared/*)
│  └─ Database queries? → Database Adapter (adapters/shared/database/)
│
└─ NO (Docker Compose manages it)
   → Config only in infrastructure/
   → No adapter needed
```

**Examples:**

| Component | Managed By | Adapter Needed? | Location |
|-----------|------------|-----------------|----------|
| **Nginx** | Docker Compose | ❌ NO | Config: `infrastructure/nginx/config/` |
| **Database** | Docker Compose | ✅ YES (for queries) | `adapters/shared/database/PrismaAdapter.js` |
| **Cloudflare Tunnel** | Application Code | ✅ YES (spawn process) | `adapters/platform/CloudflareTunnelAdapter.js` |
| **Telegram Bot** | Application Code | ✅ YES (API calls) | `adapters/bot-telegram/telegram/TelegramAdapter.js` |

---

## 🏗️ Hexagonal Architecture Position

```
┌─────────────────────────────────────────────────┐
│         INFRASTRUCTURE LAYER                    │
│   (Config Files & Binaries - Not Code)          │
│                                                 │
│   infrastructure/cloudflare-tunnel/bin/         │
│   infrastructure/nginx/config/                  │
└────────────┬────────────────────────────────────┘
             │ Used by
             ▼
┌─────────────────────────────────────────────────┐
│         ADAPTERS LAYER                          │
│   (Implementation Code - Outer Hexagon)         │
│                                                 │
│   adapters/platform/  ← YOU ARE HERE           │
│   adapters/shared/                              │
│   adapters/bot-telegram/                        │
└────────────┬────────────────────────────────────┘
             │ Implements Ports
             ▼
┌─────────────────────────────────────────────────┐
│         CORE LAYER                              │
│   (Business Logic - Inner Hexagon)              │
│                                                 │
│   core/shared/ports/InfrastructurePort.js      │
│   core/shared/services/                         │
└─────────────────────────────────────────────────┘
```

**Key Principles:**
- Platform adapters implement ports from `core/shared/ports/`
- Core layer never imports from adapters (dependency inversion)
- Adapters can use binaries/configs from `infrastructure/`
- Infrastructure layer has NO executable code

---

## 📚 Related Documentation

- **Infrastructure configs:** `infrastructure/` directory
- **Architecture overview:** `architecture_relationships.md` artifact
- **Cleanup rationale:** `infrastructure_cleanup_plan.md` artifact
- **Entry point:** `server/app.js` (dependency injection)

---

## 🎯 Adding New Platform Adapter

**When to add:**
- Need to spawn/manage external process from code
- Need to interact with system-level services
- Component not managed by Docker Compose

**Template:**
```javascript
// adapters/platform/MyServiceAdapter.js
import { InfrastructurePort } from '../../core/shared/ports/InfrastructurePort.js';

export class MyServiceAdapter extends InfrastructurePort {
    constructor(config) {
        super();
        this.binPath = '/path/to/binary';
    }
    
    async start() {
        // Spawn process or start service
    }
    
    async stop() {
        // Graceful shutdown
    }
}
```

**Don't forget:**
- Add binary to `infrastructure/my-service/bin/`
- Add config to `infrastructure/my-service/config/`
- Create README in `infrastructure/my-service/`
- Wire up in `server/app.js`
