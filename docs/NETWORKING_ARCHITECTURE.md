# Infrastruktur Networking untuk Hexagonal Architecture

> Research Notes untuk implementasi Nginx + Cloudflare Tunnel pada bot-medsos project

## Executive Summary

Untuk besok kita akan tuning infrastruktur networking layer yang proper untuk hexagonal architecture dengan focus pada:
1. **Nginx** sebagai reverse proxy dan API gateway
2. **Cloudflare Tunnel** untuk secure external access
3. **Network segmentation** untuk isolasi services
4. **Security hardening** untuk production readiness

## Arsitektur Overview

```
Internet
    ↓
Cloudflare Edge (DDoS, WAF, SSL Termination)
    ↓
Cloudflare Tunnel (Encrypted, Zero Trust)
    ↓
Nginx (Reverse Proxy, Rate Limiting, Internal Routing)
    ↓
Docker Network (bot-network - isolated)
    ↓
App Container (Port 3000 - NOT exposed to host)
```

### Layer Responsibilities (Hexagonal Pattern)

| Layer | Component | Responsibility | Location |
|-------|-----------|----------------|----------|
| **External Edge** | Cloudflare | SSL, DDoS, WAF, CDN | Cloud |
| **Tunnel Adapter** | cloudflared | Secure tunnel, Zero Trust | Container |
| **Proxy Adapter** | Nginx | Routing, Rate limit, Headers | Container |
| **Network Adapter** | Docker Network | Service isolation | Infrastructure |
| **Application Core** | Bot App | Business logic | Container |

## Key Principles untuk Hexagonal Architecture

### 1. **Nginx sebagai Inbound Adapter**

Nginx adalah **infrastructure adapter** yang:
- Handle HTTP requests dari external (via Cloudflare Tunnel)
- Translate HTTP ke internal service calls
- **Tidak tahu** tentang business logic
- Bisa di-swap dengan load balancer lain tanpa touch core

### 2. **Cloudflare Tunnel sebagai External Port**

Cloudflare Tunnel adalah **external port** yang:
- Define interface untuk external access
- Abstract away public IP dan firewall rules
- Core application **tidak perlu tahu** tentang Cloudflare
- Traffic tetap masuk via Nginx adapter

### 3. **Decoupling by Design**

```
[External World] 
    → [Cloudflare Tunnel Port] 
        → [Nginx Adapter] 
            → [Express HTTP Adapter] 
                → [Bot Core]
```

Setiap layer bisa di-replace independent:
- Cloudflare Tunnel → Ngrok/Localtunnel
- Nginx → Traefik/Caddy
- Express → Fastify/Koa
- Core logic tetap sama

## Best Practices dari Research

### Nginx Configuration

#### 1. **Security Hardening**

```nginx
# Hide version
server_tokens off;

# Rate limiting (per hexagonal pattern: infrastructure concern)
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/s;
limit_req zone=webhook_limit burst=20 nodelay;

# Restrict methods
if ($request_method !~ ^(GET|POST|HEAD)$ ) {
    return 405;
}

# Security headers (adapter responsibility)
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

#### 2. **Health Check Routing**

```nginx
# Health check bypass (tidak perlu auth)
location /health {
    proxy_pass http://app:3000/health;
    access_log off;
}

# Webhook dengan rate limit
location /webhook/telegram {
    limit_req zone=webhook_limit;
    proxy_pass http://app:3000/webhook/telegram;
    
    # Preserve headers untuk signature validation
    proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

#### 3. **Cloudflare-Specific Headers**

```nginx
# Trust Cloudflare IPs untuk real client IP
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
# ... (full Cloudflare IP ranges)
real_ip_header CF-Connecting-IP;
```

### Cloudflare Tunnel Configuration

#### Config.yml Best Practices

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/credentials.json

# Ingress rules (infrastructure routing)
ingress:
  # Route specific webhook paths
  - hostname: bot.opinionry.my.id
    path: /webhook/*
    service: http://nginx:80
    originRequest:
      noTLSVerify: false  # IMPORTANT: verify internal TLS
      connectTimeout: 30s
      
  # Health check
  - hostname: bot.opinionry.my.id
    path: /health
    service: http://nginx:80
    
  # Catch-all
  - service: http_status:404
```

#### Zero Trust Access Policies

Untuk production:
1. **Application Policy**: Restrict webhook endpoints to Telegram IPs
2. **Service Tokens**: Authenticate tunnel connections
3. **Audit Logs**: Track all access attempts

### Docker Compose Updates

```yaml
services:
  app:
    image: bot-medsos-app:latest
    container_name: bot-medsos-app
    restart: unless-stopped
    # TIDAK expose port ke host - hanya internal network
    expose:
      - "3000"
    networks:
      - bot-network
    environment:
      - DATABASE_URL=postgresql://botuser:roman@db:5432/botmedsos
    depends_on:
      - db
    # Security options
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
      
  nginx:
    image: nginx:alpine
    container_name: bot-medsos-nginx
    restart: unless-stopped
    # Expose ke host untuk local testing saja
    ports:
      - "127.0.0.1:8080:80"  # Bind ke localhost only
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    networks:
      - bot-network
    depends_on:
      - app
    security_opt:
      - no-new-privileges:true
      
  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: bot-medsos-tunnel
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - bot-network
    depends_on:
      - nginx
    security_opt:
      - no-new-privileges:true

networks:
  bot-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Security Checklist untuk Production

### Container Security
- [x] Use specific image versions (not `latest`)
- [x] Run containers as non-root
- [x] Drop all capabilities, add only needed
- [x] Enable `no-new-privileges`
- [ ] Scan images for vulnerabilities
- [ ] Implement resource limits (CPU, memory)

### Network Security
- [x] Internal Docker network only (no host exposure)
- [x] Nginx binds to localhost for local access
- [x] Cloudflare Tunnel for external access (no port forwarding)
- [ ] Implement service mesh (optional, for advanced)
- [ ] Network policies for pod-to-pod traffic

### Nginx Security
- [ ] Rate limiting per endpoint
- [ ] Request size limits
- [ ] Timeout configurations
- [ ] Client body buffer limits
- [ ] ModSecurity WAF (optional)

### Cloudflare Security
- [ ] WAF rules enabled
- [ ] Rate limiting at edge
- [ ] Bot fight mode
- [ ] DDoS protection
- [ ] Access policies for sensitive endpoints

### Application Security
- [x] Webhook secret validation
- [x] Database connection pooling
- [ ] Request logging with correlation IDs
- [ ] Error handling yang tidak leak info
- [ ] Input validation di adapter layer

## Monitoring & Observability

### Metrics to Collect
1. **Nginx**: Request rate, response time, status codes
2. **Tunnel**: Connection status, throughput
3. **App**: Health check status, database pool usage
4. **Docker**: Container resource usage

### Logging Strategy
```
Cloudflare → Edge Logs (DDoS, WAF hits)
    ↓
Nginx → Access + Error logs (routing, rate limits)
    ↓
App → Application logs (business logic, errors)
    ↓
Centralized (Prometheus + Grafana / ELK stack)
```

## Implementation Plan untuk Besok

### Phase 1: Nginx Configuration
1. Create optimized `nginx.conf`
2. Setup rate limiting zones
3. Configure upstream health checks
4. Add security headers
5. Test with local requests

### Phase 2: Cloudflare Tunnel Configuration
**Status**: ✅ Tunnel sudah exist, token ada di `.env`
1. ~~Create tunnel~~ (SKIP - sudah ada)
2. ~~Generate credentials~~ (SKIP - token sudah tersedia)
3. Review & optimize config.yml untuk ingress rules (jika ada)
4. Verify tunnel connectivity dengan existing token
5. (Optional) Setup Zero Trust policies untuk extra security

### Phase 3: Docker Compose Integration
1. Update compose file dengan network isolation
2. Remove external port exposure from app
3. Add security options
4. Configure health checks
5. Test end-to-end flow

### Phase 4: Testing & Validation
1. Test webhook delivery via Cloudflare
2. Verify rate limiting works
3. Check security headers
4. Load testing
5. Failover testing

### Phase 5: Documentation
1. Update README dengan networking architecture
2. Document troubleshooting steps
3. Create runbook for common issues

## References

- [Nginx Microservices Best Practices](https://www.f5.com/resources/white-papers/microservices-reference-architecture)
- [Cloudflare Tunnel Security](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Hexagonal Architecture Infrastructure Layer](https://medium.com/@matiasvarela/hexagonal-architecture-in-go-cfd4e436faa3)

## Confirmed Requirements

1. ✅ **ModSecurity WAF di Nginx**: YES - untuk extra layer protection
2. ✅ **Centralized logging**: NO - skip ELK/Grafana untuk sekarang
3. ⏳ **Rate limiting**: TBD - akan configure based on webhook load
4. ✅ **Cloudflare plan**: FREE tier
5. ✅ **Zero Trust Access**: YES - untuk webhook endpoint security

---

**Note**: Semua ini tetap mengikuti hexagonal architecture dimana:
- Nginx = Infrastructure adapter (HTTP inbound)
- Cloudflare Tunnel = Infrastructure port (external access)
- Core business logic = Tetap isolated di `core/`
- Perubahan networking **tidak** mempengaruhi domain logic
