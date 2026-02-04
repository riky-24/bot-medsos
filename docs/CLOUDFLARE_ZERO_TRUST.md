# Cloudflare Zero Trust Access Policies for Webhook

> Configuration untuk restrict webhook access dengan Zero Trust policies

## Overview

Cloudflare Zero Trust Access memungkinkan kita untuk:
- Restrict webhook endpoint ke Telegram IPs only
- Add authentication layer tanpa modify app code
- Audit log semua access attempts
- Block malicious traffic di edge (before hitting server)

## Architecture

```
Telegram Server (149.154.160.0/20, etc)
    ↓
Cloudflare Edge
    ↓ [Zero Trust Policy Check]
    ✅ Allowed IPs → Forward
    ❌ Others → Block 403
    ↓
Cloudflare Tunnel
    ↓
Nginx (ModSecurity)
    ↓
App (Webhook Secret Validation)
```

**Multi-layer validation**:
1. Cloudflare Access: IP whitelist
2. ModSecurity: Payload inspection
3. App: Secret token validation

## Telegram IP Ranges (Official)

Telegram webhooks come from these IP ranges:

```
149.154.160.0/20
91.108.4.0/22
```

Source: https://core.telegram.org/bots/webhooks#the-short-version

## Setup Zero Trust Access Policy

### Step 1: Create Application in Zero Trust Dashboard

1. Login ke Cloudflare Dashboard
2. Navigate: **Zero Trust** → **Access** → **Applications**
3. Click **Add an application**
4. Choose **Self-hosted**

**Application Configuration**:
```yaml
Application name: Bot Medsos Webhook
Session Duration: No duration, expire immediately
Application domain: bot.opinionry.my.id
Path: /webhook/*
```

### Step 2: Create Allow Policy

**Policy Name**: Allow Telegram Servers Only

**Configure Rules**:

```yaml
Action: Allow
Policy name: Telegram IP Whitelist
Assign to: 
  Include:
    - IP ranges:
        - 149.154.160.0/20
        - 91.108.4.0/22
```

**Advanced Settings**:
- Purpose justification: Not required
- Require approver: Disabled
- Session duration: No duration

### Step 3: Create Block Policy (Fallback)

**Policy Name**: Block All Others

**Configure Rules**:

```yaml
Action: Block
Policy name: Block Non-Telegram
Assign to:
  Include:
    - Everyone
```

**Policy Order** (Important!):
1. Allow Telegram IPs (evaluated first)
2. Block All Others (fallback)

### Step 4: Health Check Exception

Create separate policy untuk `/health` endpoint:

**Application Configuration**:
```yaml
Application name: Health Check
Application domain: bot.opinionry.my.id
Path: /health
```

**Policy**:
```yaml
Action: Allow
Include: Everyone
```

Why? Health checks dari monitoring tools tidak pakai Telegram IPs.

## Alternative: Firewall Rules (Cloudflare Free Tier)

Jika Zero Trust Access tidak available di Free tier (need to verify), gunakan **Firewall Rules** sebagai alternatif.

### Create Firewall Rule

Navigate: **Security** → **WAF** → **Firewall rules**

**Rule 1: Allow Telegram Webhook**
```
Expression:
(http.request.uri.path contains "/webhook/telegram") and 
(ip.src in {149.154.160.0/20 91.108.4.0/22})

Action: Allow
```

**Rule 2: Block Other Webhook Access**
```
Expression:
(http.request.uri.path contains "/webhook/telegram") and 
(not ip.src in {149.154.160.0/20 91.108.4.0/22})

Action: Block
```

**Rule 3: Allow Health Check**
```
Expression:
(http.request.uri.path eq "/health")

Action: Allow
```

**Note**: Free tier allows **5 firewall rules** total.

## Cloudflare Free Tier - Enabled Features

Pastikan fitur-fitur ini enabled:

### 1. Bot Fight Mode
- Navigate: **Security** → **Bots**
- Enable: **Bot Fight Mode** (Free)
- Blocks known bad bots automatically

### 2. Security Level
- Navigate: **Security** → **Settings**
- Set to: **Medium** or **High**
- Challenges suspicious visitors

### 3. Challenge Passage
- Set to: **30 minutes**
- Prevents repeated challenges untuk legitimate users

### 4. Browser Integrity Check
- Enable: **On**
- Blocks requests from non-browser sources
- **IMPORTANT**: Might need to disable untuk webhooks! Test first.

### 5. Rate Limiting (if available in Free)
- Path: `/webhook/telegram`
- Limit: 10 requests per second per IP
- Action: Block for 60 seconds

## Testing Access Policies

### Test 1: From Telegram IP (Should Pass)

Use proxy/VPN dengan Telegram IP range:
```bash
curl -X POST "https://bot.opinionry.my.id/webhook/telegram" \
  -H "X-Telegram-Bot-Api-Secret-Token: your_secret" \
  -d '{"test": true}'
```

Expected: 200 OK (or app's response)

### Test 2: From Non-Telegram IP (Should Block)

Dari local machine atau VPS lain:
```bash
curl -X POST "https://bot.opinionry.my.id/webhook/telegram" \
  -H "X-Telegram-Bot-Api-Secret-Token: your_secret" \
  -d '{"test": true}'
```

Expected: 403 Forbidden (Cloudflare block page)

### Test 3: Health Check (Should Always Pass)

```bash
curl "https://bot.opinionry.my.id/health"
```

Expected: 200 OK dengan health status

## Monitoring & Audit Logs

### View Access Attempts

1. **Zero Trust Logs** (if using Access):
   - Dashboard → **Logs** → **Access**
   - Shows all allow/deny decisions

2. **Firewall Events**:
   - Dashboard → **Security** → **Events**
   - Filter by: `Action = Block`
   - Check for false positives

### Metrics to Monitor

- **Blocked requests**: Should be minimal after tuning
- **Allow rate**: Expected legitimate webhook traffic
- **Challenge rate**: Should be 0 for webhook (only for browser endpoints)

## Troubleshooting

### Issue: Telegram webhooks blocked

**Check**:
1. Telegram IPs masih sama? (check official docs)
2. Policy order correct? (Allow before Block)
3. Path matching correct? (`/webhook/telegram` vs `/webhook/*`)

**Fix**: Update IP ranges atau adjust path pattern

### Issue: Health check blocked

**Solution**: Create separate allow rule for `/health` path

### Issue: Payment callbacks blocked

**Solution**: Add Sakurupiah IP ranges ke allow list
- Get IPs dari Sakurupiah docs atau support
- Add to firewall rule atau Access policy

## Recommended Configuration (Cloudflare Free)

```yaml
# Firewall Rules (max 5 in Free tier)
Rule 1: Allow Telegram Webhooks (IPs: 149.154.160.0/20, 91.108.4.0/22)
Rule 2: Block Non-Telegram Webhooks
Rule 3: Allow Health Checks
Rule 4: (Reserve for payment gateway IPs if needed)
Rule 5: (Reserve for additional services)

# Security Settings
Bot Fight Mode: Enabled
Security Level: Medium
Browser Integrity Check: Disabled (for webhooks)

# SSL/TLS
Mode: Full (strict)
Always Use HTTPS: Yes
Automatic HTTPS Rewrites: Yes
```

## Benefits of Zero Trust for Webhooks

1. **Early blocking**: Malicious requests blocked at edge (save bandwidth)
2. **No code changes**: App logic unchanged
3. **Audit trail**: Complete log of access attempts
4. **Compliance**: Easy to prove webhook security for audits
5. **Cost-effective**: Free tier sufficient untuk bot workload

## Next Steps

1. Determine: Zero Trust Access or Firewall Rules (based on Free tier availability)
2. Configure policies in Cloudflare dashboard
3. Test with actual Telegram webhook
4. Monitor logs for any blocks
5. Adjust IP ranges if Telegram updates their infrastructure
6. Document any exceptions needed
