# BunkerWeb Infrastructure

This directory contains BunkerWeb (Nginx with ModSecurity WAF) configuration for production deployment.

## Directory Structure

```
bunkerweb/
├── config/          # BunkerWeb configuration files
│   ├── modsecurity-custom-rules/  # Custom ModSecurity rules
│   └── env.d/                      # Environment-based configs
├── bin/             # (Not used - BunkerWeb uses Docker image)
├── scripts/         # Helper scripts
└── README.md        # This file
```

## Purpose

BunkerWeb provides **production-grade security** with integrated Web Application Firewall (WAF).

### Features

✅ **ModSecurity WAF** - OWASP Core Rule Set (CRS)  
✅ **Rate Limiting** - Protect against brute force  
✅ **Security Headers** - CSP, HSTS, X-Frame-Options  
✅ **Cloudflare Real IP** - Preserve original client IP  
✅ **DDoS Protection** - Layer 7 protection  
✅ **Auto SSL/TLS** - Let's Encrypt integration (optional)  

## Usage

### Production Deployment
```bash
# Use production compose override
podman-compose -f docker-compose.yml -f docker-compose.production.yml up -d

# This swaps nginx:alpine → bunkerity/bunkerweb
```

### Configuration

BunkerWeb is configured via environment variables in `docker-compose.production.yml`:

```yaml
environment:
  - SERVER_NAME=bot.opinionry.my.id
  - AUTO_LETS_ENCRYPT=no  # Cloudflare handles SSL
  - USE_MODSECURITY=yes
  - USE_MODSECURITY_CRS=yes
  - USE_LIMIT_REQ=yes
  - LIMIT_REQ_RATE=10r/s
  - LIMIT_REQ_BURST=20
```

### Custom ModSecurity Rules

Add custom rules in `infrastructure/bunkerweb/config/modsecurity-custom-rules/`:

```bash
# Example: Block specific user agents
SecRule REQUEST_HEADERS:User-Agent "@contains badbot" \
    "id:1000,\
    phase:1,\
    block,\
    msg:'Bad bot blocked'"
```

## Hexagonal Architecture Position

```
┌─────────────────────────────────────┐
│     INFRASTRUCTURE LAYER            │
│  (Outer Hexagon - Adapters)         │
│                                     │
│   Tunnel → [BunkerWeb WAF] → App   │
│                                     │
└─────────────────────────────────────┘
```

**Role:**
- **Security Gateway:** Filter malicious requests before reaching app
- **WAF:** OWASP Top 10 protection
- **Reverse Proxy:** Same as nginx, with added security
- **Compliance:** Help meet security compliance requirements

## Development vs Production

| Feature | Development (Nginx Alpine) | Production (BunkerWeb) |
|---------|----------------------------|------------------------|
| Image Size | ~25MB | ~200MB |
| ModSecurity | ❌ No | ✅ Yes |
| Rate Limiting | ⚠️ Basic | ✅ Advanced |
| Security Headers | ⚠️ Manual | ✅ Auto |
| Performance | ⚡ Fast | 🐢 Slower (WAF overhead) |
| Use Case | Local dev, staging | Production |

## Important Notes

> **Only Use BunkerWeb in Production**
> 
> - Development: Simple nginx (faster, lighter)
> - Production: BunkerWeb (secure, heavier)

## Configuration Files

### Custom Rules Location
```
infrastructure/bunkerweb/config/modsecurity-custom-rules/
└── custom-rules.conf
```

### Logs Location
```
logs/nginx/
├── access.log
├── error.log
└── modsec_audit.log  # ModSecurity audit log
```

## Monitoring

```bash
# View BunkerWeb logs
podman logs -f bot-medsos-nginx-waf

# Check ModSecurity audit log
tail -f logs/nginx/modsec_audit.log

# Test WAF (should be blocked)
curl -X POST http://localhost:8080/test \
  -d "malicious=<script>alert(1)</script>"
```

## Troubleshooting

### False Positives

If legitimate requests are blocked:

1. Check ModSecurity audit log
2. Identify rule ID causing block
3. Add exception in custom rules:

```bash
# Disable specific rule
SecRuleRemoveById 942100
```

### Performance Issues

If BunkerWeb is too slow:

1. Reduce ModSecurity anomaly threshold
2. Disable specific rule sets
3. Use nginx alpine for staging (not production)

## References

- [BunkerWeb Docs](https://docs.bunkerweb.io/)
- [ModSecurity Core Rule Set](https://coreruleset.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
