# ModSecurity WAF Configuration untuk Nginx

> Setup Web Application Firewall dengan ModSecurity + OWASP Core Rule Set

## Overview

ModSecurity adalah Web Application Firewall (WAF) open-source yang akan protect bot-medsos dari common web attacks seperti SQL injection, XSS, dan malicious payloads.

## Architecture Integration

```
Internet → Cloudflare (Layer 1 WAF) → Tunnel → ModSecurity/Nginx (Layer 2 WAF) → App
```

**Defense in Depth**:
- Cloudflare Free: Basic DDoS + Bot Fight Mode
- ModSecurity: OWASP CRS rules untuk application-level attacks
- App: Webhook secret validation

## Installation Options

### Option 1: Bunkerized Nginx (Recommended - Easiest)

Pre-built Docker image dengan ModSecurity + OWASP CRS sudah configured.

**docker-compose.yml**:
```yaml
services:
  nginx:
    image: bunkerity/bunkerweb:latest
    container_name: bot-medsos-nginx-waf
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      # Basic settings
      - SERVER_NAME=bot.opinionry.my.id
      - USE_MODSECURITY=yes
      - USE_MODSECURITY_CRS=yes
      
      # ModSecurity tuning
      - MODSECURITY_SEC_AUDIT_ENGINE=RelevantOnly
      - MODSECURITY_SEC_RULE_ENGINE=On
      
      # Rate limiting
      - USE_LIMIT_REQ=yes
      - LIMIT_REQ_RATE=10r/s
      - LIMIT_REQ_BURST=20
      
      # Reverse proxy config
      - USE_REVERSE_PROXY=yes
      - REVERSE_PROXY_URL=/
      - REVERSE_PROXY_HOST=http://app:3000
      
      # Cloudflare integration
      - USE_REAL_IP=yes
      - USE_REAL_IP_FROM=173.245.48.0/20 103.21.244.0/22 103.22.200.0/22
      - REAL_IP_HEADER=CF-Connecting-IP
      
      # Security headers
      - X_FRAME_OPTIONS=SAMEORIGIN
      - X_CONTENT_TYPE_OPTIONS=nosniff
      - X_XSS_PROTECTION=1; mode=block
      
    volumes:
      - ./nginx/custom-rules:/modsec-crs-confs:ro
    networks:
      - bot-network
    depends_on:
      - app
```

### Option 2: Manual ModSecurity Build (Advanced)

Build custom Nginx image dengan ModSecurity.

**Dockerfile.nginx**:
```dockerfile
FROM nginx:alpine

# Install dependencies
RUN apk add --no-cache \
    pcre-dev \
    libxml2-dev \
    git \
    libtool \
    automake \
    autoconf \
    g++ \
    flex \
    bison \
    yajl-dev \
    curl-dev

# Install ModSecurity
WORKDIR /opt
RUN git clone --depth 1 -b v3/master --single-branch https://github.com/SpiderLabs/ModSecurity && \
    cd ModSecurity && \
    git submodule init && \
    git submodule update && \
    ./build.sh && \
    ./configure && \
    make && \
    make install

# Install ModSecurity-nginx connector
RUN git clone --depth 1 https://github.com/SpiderLabs/ModSecurity-nginx.git && \
    cd /opt && \
    nginx_version=$(nginx -v 2>&1 | grep -oP '(?<=nginx/)[0-9.]+') && \
    wget http://nginx.org/download/nginx-${nginx_version}.tar.gz && \
    tar zxvf nginx-${nginx_version}.tar.gz && \
    cd nginx-${nginx_version} && \
    ./configure --with-compat --add-dynamic-module=/opt/ModSecurity-nginx && \
    make modules && \
    cp objs/ngx_http_modsecurity_module.so /etc/nginx/modules/

# Download OWASP CRS
WORKDIR /etc/nginx
RUN git clone https://github.com/coreruleset/coreruleset.git modsecurity-crs && \
    cd modsecurity-crs && \
    cp crs-setup.conf.example crs-setup.conf

# Copy ModSecurity config
COPY nginx/modsecurity.conf /etc/nginx/modsecurity/modsecurity.conf
COPY nginx/main.conf /etc/nginx/modsecurity/main.conf

# Copy Nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Configuration Files

### modsecurity.conf

```nginx
# Enable ModSecurity
SecRuleEngine On

# Request body handling
SecRequestBodyAccess On
SecRequestBodyLimit 13107200
SecRequestBodyNoFilesLimit 131072
SecRequestBodyLimitAction Reject

# Response body handling (disable untuk performance)
SecResponseBodyAccess Off

# Temporary directory
SecTmpDir /tmp/
SecDataDir /tmp/

# Audit logging (hanya log attacks)
SecAuditEngine RelevantOnly
SecAuditLogType Serial
SecAuditLog /var/log/nginx/modsec_audit.log
SecAuditLogParts ABIJDEFHZ

# Debug log level (change to 0 for production)
SecDebugLog /var/log/nginx/modsec_debug.log
SecDebugLogLevel 0

# Upload file handling
SecUploadDir /tmp/
SecUploadKeepFiles Off

# Paranoia Level (1-4, higher = more strict)
# Level 1 = Basic protection, minimal false positives
SecAction "id:900000,phase:1,nolog,pass,t:none,setvar:tx.paranoia_level=1"

# Anomaly scoring threshold
SecAction "id:900110,phase:1,nolog,pass,t:none,setvar:tx.inbound_anomaly_score_threshold=5"
SecAction "id:900111,phase:1,nolog,pass,t:none,setvar:tx.outbound_anomaly_score_threshold=4"

# Include OWASP CRS
Include /etc/nginx/modsecurity-crs/crs-setup.conf
Include /etc/nginx/modsecurity-crs/rules/*.conf
```

### nginx.conf (with ModSecurity)

```nginx
load_module modules/ngx_http_modsecurity_module.so;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;
    
    # Real IP from Cloudflare
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    real_ip_header CF-Connecting-IP;
    
    server {
        listen 80;
        server_name _;
        
        # Enable ModSecurity
        modsecurity on;
        modsecurity_rules_file /etc/nginx/modsecurity/main.conf;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        
        # Health check (bypass rate limit & ModSec)
        location = /health {
            modsecurity off;
            proxy_pass http://app:3000/health;
            access_log off;
        }
        
        # Telegram webhook
        location /webhook/telegram {
            limit_req zone=webhook_limit burst=20 nodelay;
            
            proxy_pass http://app:3000/webhook/telegram;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Preserve Telegram header
            proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
        }
        
        # Payment callback
        location /callback/payment {
            limit_req zone=webhook_limit burst=10 nodelay;
            
            proxy_pass http://app:3000/callback/payment;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # Deny all other paths
        location / {
            return 404;
        }
    }
}
```

### main.conf (ModSecurity include)

```nginx
Include /etc/nginx/modsecurity/modsecurity.conf
```

## Custom Rules for Telegram Bot

Create custom rules untuk whitelist legitimate bot traffic:

**custom-rules/bot-whitelist.conf**:
```nginx
# Whitelist Telegram User-Agent
SecRule REQUEST_HEADERS:User-Agent "@contains TelegramBot" \
    "id:1000,phase:1,pass,nolog,ctl:ruleEngine=Off"

# Allow larger JSON payloads for webhook
SecRule REQUEST_URI "@beginsWith /webhook" \
    "id:1001,phase:1,pass,nolog,ctl:requestBodyLimit=524288"

# Disable body inspection for health check
SecRule REQUEST_URI "@streq /health" \
    "id:1002,phase:1,pass,nolog,ctl:ruleEngine=Off"
```

## Testing ModSecurity

### Test 1: SQL Injection Detection

```bash
# Should be blocked
curl -X POST "http://localhost:8080/webhook/telegram?id=1' OR '1'='1"
# Expected: 403 Forbidden
```

### Test 2: XSS Detection

```bash
# Should be blocked
curl -X POST "http://localhost:8080/webhook/telegram" \
  -H "Content-Type: application/json" \
  -d '{"message": "<script>alert(1)</script>"}'
# Expected: 403 Forbidden
```

### Test 3: Legitimate Request

```bash
# Should pass
curl -X POST "http://localhost:8080/webhook/telegram" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: your_secret" \
  -d '{"update_id": 123, "message": {"text": "Hello"}}'
# Expected: 200 OK
```

## Monitoring & Tuning

### View ModSecurity Logs

```bash
# Audit log (blocked requests)
podman exec bot-medsos-nginx-waf tail -f /var/log/nginx/modsec_audit.log

# Debug log
podman exec bot-medsos-nginx-waf tail -f /var/log/nginx/modsec_debug.log

# Nginx error log
podman exec bot-medsos-nginx-waf tail -f /var/log/nginx/error.log
```

### Tune False Positives

Jika ada legitimate requests yang di-block:

1. Check audit log untuk rule ID
2. Create exception rule:

```nginx
# Disable specific rule for specific path
SecRuleRemoveById 942100 /webhook/telegram
```

## Performance Considerations

ModSecurity adds overhead (~5-10ms per request). Optimizations:

1. **Disable response body inspection**: Already set `SecResponseBodyAccess Off`
2. **Set appropriate paranoia level**: Level 1 untuk balance security/performance
3. **Use RelevantOnly audit logging**: Only log blocked requests
4. **Limit request body size**: Already set to 128KB

## Recommended: Cloudflare Free Tier + ModSecurity

**Cloudflare Free provides**:
- Basic DDoS protection
- Bot Fight Mode
- Automatic HTTPS
- Basic firewall rules (5 rules max)

**ModSecurity adds**:
- OWASP Top 10 protection
- Custom rules for bot-specific attacks
- Detailed audit logging
- Granular request/response inspection

**Together**: Defense in depth dengan minimal cost! 🛡️

## Next Steps

1. Choose: Bunkerized Nginx (easy) or Manual Build (custom)
2. Test with sample payloads
3. Monitor logs for false positives
4. Tune rules based on traffic patterns
5. Document exceptions in custom rules
