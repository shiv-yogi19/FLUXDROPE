# FLUXDROPE Signaling Backend

> **Ultra-Low Latency WebRTC Signaling Server on Cloudflare Workers & Durable Objects**  
> *Created By Shiv Yogi*

---

## ⚡ Overview

FLUXDROPE uses a high-performance, globally distributed Cloudflare Worker with **Durable Objects** to manage real-time WebRTC signaling (SDP offer/answer and ICE candidate exchange).

### Key Architectural Principles
- **Zero File Data Passthrough**: The signaling server **never** receives, handles, or buffers any file contents. Only ephemeral WebRTC signaling messages (`offer`, `answer`, `ice-candidate`, `peer-info`) pass through.
- **Stateful Rendezvous with Durable Objects**: Each file transfer session is routed to an isolated `TransferSession` Durable Object instance, ensuring in-memory message synchronization and automatic teardown.
- **Short-Lived Joining Codes**: Codes follow the format `FLX-XXXX-XXXX` and are mapped to `sessionId` via Cloudflare KV with an automated 30-minute expiration.
- **Strict Rate Limiting**: Built-in sliding-window limiter enforcing a maximum of **100 messages per minute** per WebSocket connection to mitigate abuse and denial-of-service attempts.
- **Strict Payload Size Limits**: SDP offers and answers are capped at `<4 KB` to reject rogue large payloads.

---

## 🚀 Deployment Guide

### Prerequisites
- Node.js 18+ installed
- A Cloudflare account with the **Workers Paid** plan (required for Durable Objects)

### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
```
This opens your browser to authorize Wrangler with your Cloudflare account.

### Step 3: Create the KV Namespace for Joining Codes
Run the following command to provision the Cloudflare KV namespace for joining codes:
```bash
wrangler kv:namespace create JOINING_CODES
```

Output will display configuration similar to:
```text
[[kv_namespaces]]
binding = "JOINING_CODES"
id = "a1b2c3d4e5f6g7h8i9j0"
```

For local development preview (optional):
```bash
wrangler kv:namespace create JOINING_CODES --preview
```

### Step 4: Update `wrangler.toml`
Open `cloudflare-worker/wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID_HERE` with the ID generated in Step 3:

```toml
[[kv_namespaces]]
binding = "JOINING_CODES"
id = "a1b2c3d4e5f6g7h8i9j0"
preview_id = "your_preview_id_here"
```

### Step 5: Deploy the Worker
From the `cloudflare-worker` directory, run:
```bash
wrangler deploy
```

### Step 6: Note Your Worker URL
Wrangler will output the live URL:
```text
https://fluxdrope-signaling.<your-subdomain>.workers.dev
```

### Step 7: Update Client Configuration
Copy your Worker URL and update `FLUXDROPE_SIGNALING_URL` in `js/app.js` (or your client configuration file):
```javascript
export const FLUXDROPE_SIGNALING_URL = 'https://fluxdrope-signaling.<your-subdomain>.workers.dev';
```

---

## 🔧 Environment Variables (`[vars]`)

Configure these in `wrangler.toml` or through the Cloudflare Dashboard:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SESSION_TTL_SECONDS` | `1800` | Duration (in seconds) before an idle session expires (30 minutes). |
| `MAX_MESSAGES_PER_MINUTE` | `100` | Maximum signaling packets permitted per WebSocket connection per minute. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed HTTP `Origin` headers (e.g. `https://yourdomain.github.io`). |

---

## 🌐 STUN & TURN Server Setup

WebRTC requires STUN servers for NAT traversal and candidate discovery, and optional TURN servers for restrictive symmetric NATs or corporate firewalls.

### Default STUN Servers (Free & High Availability)
FLUXDROPE client comes configured with reliable public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`
- `stun:stun.cloudflare.com:3478`

### Optional TURN Server Setup (Fallback for Symmetric NATs)
For symmetric NAT environments where direct peer-to-peer UDP connections are blocked:
1. **Metered.ca** (Free 50GB/month tier):
   - Sign up at [metered.ca](https://www.metered.ca/tools/openrelay/)
   - Add your API key or credentials into `js/webrtc-manager.js`.
2. **Self-Hosted Coturn**:
   - Install Coturn on an Ubuntu server:
     ```bash
     sudo apt update && sudo apt install coturn -y
     ```
   - Configure `/etc/turnserver.conf` with `listening-port=3478`, `tls-listening-port=5349`, and shared authentication secret.
3. **Twilio Network Traversal Service**:
   - Provide dynamic ephemeral TURN credentials via an API endpoint.

> [!NOTE]
> Even when WebRTC traffic falls back to a TURN relay, FLUXDROPE encrypts all payloads end-to-end with **AES-GCM-256** using ephemeral ECDH keys. The TURN relay cannot inspect or decrypt the file data.

---

## 🛡️ Security & Rate Limiting Details

1. **Strict Message Validation**:
   - Only validated JSON containing recognized `type` fields (`register-sender`, `register-receiver`, `offer`, `answer`, `ice-candidate`, `peer-info`, `cancel`, `ping`) are accepted.
   - Any message with binary buffers or file chunks is immediately rejected with an error.
2. **Rate Limiting Engine**:
   - A sliding 60-second window tracks message count per WebSocket.
   - Excess packets trigger a `RATE_LIMIT_EXCEEDED` error and are discarded without reaching the peer.
3. **Payload Inspection & Limits**:
   - General signaling payload ceiling: `16 KB`.
   - SDP descriptors: strictly capped at `<4 KB`.
4. **Automated Alarm Cleanup**:
   - Cloudflare Durable Objects `alarm()` automatically fires at `expiresAt` (30 minutes), disconnecting clients, clearing state, and removing the KV code mapping.

---

## 🧪 Testing the Signaling Backend

### 1. Health Check
```bash
curl -i https://fluxdrope-signaling.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{
  "status": "online",
  "service": "FLUXDROPE Signaling Server",
  "version": "1.0.0",
  "author": "Shiv Yogi",
  "e2eEncrypted": true
}
```

### 2. Create Session
```bash
curl -i -X POST https://fluxdrope-signaling.<your-subdomain>.workers.dev/session/create
```

Expected response:
```json
{
  "success": true,
  "sessionId": "4f9d146c-7e61-4560-b97c-9b788a101234",
  "joiningCode": "FLX-9K2M-7RT8",
  "expiresAt": 1729864200000,
  "ttlSeconds": 1800,
  "author": "Shiv Yogi"
}
```

### 3. Join by Code
```bash
curl -i -X POST https://fluxdrope-signaling.<your-subdomain>.workers.dev/session/FLX-9K2M-7RT8/join-by-code
```

### 4. WebSocket Testing with `wscat`
```bash
# Connect as sender:
wscat -c "wss://fluxdrope-signaling.<your-subdomain>.workers.dev/session/4f9d146c-7e61-4560-b97c-9b788a101234/join?role=sender&name=Shiv"

# Send registration:
> {"type":"register-sender","name":"Shiv"}
< {"type":"sender-registered","sessionId":"...","senderName":"Shiv"}
```
