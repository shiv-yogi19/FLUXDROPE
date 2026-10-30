# FLUXDROPE — Cloudflare Deployment Guide
**Created By Shiv Yogi**

This guide provides step-by-step instructions for deploying FLUXDROPE to Cloudflare Workers with Durable Objects and Static Assets.

---

## 1. Prerequisites

1. A Cloudflare account with a Workers Paid subscription (required for Durable Objects).
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed:
   ```bash
   pnpm add -g wrangler # or npm install -g wrangler
   ```
3. Authenticate Wrangler with your Cloudflare account:
   ```bash
   wrangler login
   ```

---

## 2. Configuration (`wrangler.jsonc` / `wrangler.toml`)

FLUXDROPE includes pre-configured `wrangler.jsonc` and `wrangler.toml` files:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "fluxdrope",
  "main": "src/worker/index.js",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "TRANSFER_SESSIONS",
        "class_name": "TransferSessionDO"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["TransferSessionDO"]
    }
  ]
}
```

---

## 3. Deployment Steps

### Step 1: Validate Configuration
Check that your Wrangler configuration is valid:
```bash
wrangler types
```

### Step 2: Deploy to Cloudflare
Execute the deployment:
```bash
wrangler deploy
```
Upon success, Wrangler will output your live URL:
```
Published fluxdrope (0.85 sec)
  https://fluxdrope.<your-subdomain>.workers.dev
```

### Step 3: Custom Domain (Optional)
To attach a custom domain (e.g., `fluxdrope.yourdomain.com`):
```bash
wrangler custom-domain add fluxdrope.yourdomain.com
```

---

## 4. Local Development with Wrangler (Cloudflare Emulation)

You can run the Cloudflare Worker and Durable Object locally using Miniflare / Wrangler dev:
```bash
wrangler dev
```

---

## 5. Production Troubleshooting Guide

### Issue: "Durable Object binding not found"
- Ensure your Cloudflare account has Workers Paid enabled (Durable Objects are a feature of the Paid plan).
- Confirm that the migration tag `v1` with class `TransferSessionDO` is present in `wrangler.jsonc`.

### Issue: "WebSocket closed with code 1006"
- Check that your firewall or corporate proxy allows outgoing WSS traffic on standard HTTPS ports (443).

### Issue: "WebRTC negotiation stuck on connecting"
- Symmetric NATs or enterprise firewalls may block direct UDP peer-to-peer packets. A TURN server can be added to `RTC_CONFIG.iceServers` in `public/js/transfer/rtcEngine.js` for restrictive network topologies.
