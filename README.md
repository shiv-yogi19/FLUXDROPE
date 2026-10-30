# FLUXDROPE
### Liquid Glass High-Performance Peer-to-Peer File Transfer
**Created By Shiv Yogi**

---

FLUXDROPE is a production-grade peer-to-peer file sharing platform designed for seamless, high-speed, direct browser-to-browser data transfer using WebRTC DataChannels, Cloudflare Workers & Durable Objects signaling, end-to-end encryption (E2EE), 14 responsive Liquid Glass layouts, universal media viewers, and a server-enforced 7-attempt security lockout.

---

## 🌟 Key Highlights & Architecture

1. **Direct Peer-to-Peer WebRTC DataChannels**
   - Transmits files directly between devices using binary ArrayBuffers without routing through or storing on intermediary servers.
   - Streamed in **64 KB chunks** with active **backpressure flow control** (`bufferedAmount` monitored with a 1 MB high-water mark and 256 KB drain threshold) to prevent memory crashes on large files.
   - Real-time SHA-256 cryptographic checksum calculation and receiver integrity verification.

2. **Cloudflare Workers & Durable Objects Backend**
   - `TransferSessionDO` maintains session state, handles WebSocket signaling (`offer`, `answer`, `ice-candidate`), and enforces rate limiting.
   - **Seven-Attempt Lockout Policy**: Allows up to 6 unsuccessful password attempts. On the 7th failed attempt, verification is locked server-side for **10 minutes** (HTTP 423 Locked).

3. **14 Distinct Liquid Glass Layouts**
   - **7 Mobile Layouts**:
     - `M1. Aurora Glass` — Rich blue & violet lighting, large glass cards, circular progress ring.
     - `M2. Crystal Flow` — Translucent glass panels, faceted borders, smooth card stack.
     - `M3. Obsidian Glass` — Deep obsidian black, stealth charcoal cards, minimal blur, max battery life.
     - `M4. Liquid Waves` — Animated fluid waves, layered glass panels, ripple progress indicators.
     - `M5. Holographic Glass` — Prismatic holographic highlights, cybernetic diagnostics HUD.
     - `M6. Floating Glass` — Floating decoupled action island at bottom, thumb-reachable controls.
     - `M7. Hyper Minimal Glass` — Minimalist high-speed layout with razor-thin borders and fast rendering.
   - **7 Desktop Layouts**:
     - `D1. Aurora Desktop` — Wide cinematic dashboard, dual hero cards, glowing stats HUD.
     - `D2. Crystal Workspace` — 3-column workspace (left quick nav, center transfer stage, right file inspector).
     - `D3. Obsidian Pro` — Deep black interface, detailed transfer statistics telemetry.
     - `D4. Liquid Waves Desktop` — Panoramic glass ribbons with fluid wave progress.
     - `D5. Holographic Command` — Multi-panel command center with live diagnostics radar.
     - `D6. Floating Workspace` — Modular glass dock with detached floating work panes.
     - `D7. Hyper Minimal Desktop` — Clean monospace keyboard-friendly dashboard.

4. **Universal In-Browser Media Viewers**
   - **Video Player**: Custom HTML5 player with seekbar, volume, playback speed (0.5x–2x), Picture-in-Picture, Fullscreen, and keyboard shortcuts.
   - **Music Player**: Custom audio player with playlist queue, next/previous, shuffle, repeat, and a live **Web Audio API Canvas Waveform Visualizer**.
   - **Image Viewer & Gallery**: Lightbox with zoom (+/-), 100% actual size, fit-to-screen, 90° rotation, dimension inspection, and non-destructive **Watermark Derivation**.
   - **PDF Viewer**: Document preview with page zoom, fit-to-width, printing, and download.
   - **Document Viewers**: Monospace viewer with line numbers for TXT, interactive data table with column search for CSV, syntax-highlighted tree for JSON, Markdown renderer, and a strictly isolated sandboxed preview for HTML/SVG.

5. **Mandatory Filename Branding Policy**
   - Every downloaded file adopts:
     ```
     OriginalFileName_FLUXDROPE_Created_By_Shiv_Yogi.Extension
     ```
   - Automatically sanitizes illegal filesystem characters, preserves compound extensions (e.g. `.tar.gz`), supports Unicode filenames, and prevents accidental duplicate branding suffixes.

6. **Three Performance Modes**
   - **Performance Mode**: Low blur (`backdrop-filter: none`), disabled decorative background orbs, maximum CPU throughput for gigabit LAN transfers.
   - **Balanced Mode**: Standard Liquid Glass materials with GPU acceleration.
   - **Quality Mode**: Full specular reflections, glass refraction gradients, and floating ambient orbs.

7. **Zero-Dependency Local Server & Automated Tests**
   - Pure Node.js local server (`server.js`) implementing RFC 6455 WebSockets and REST APIs for zero-config local testing.
   - Complete automated test suite covering all 7 critical domains with 100% pass rate.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js v18+ (tested on Node v26)
- No external package installations needed (zero external npm dependencies!)

### Run the Application Locally
```bash
# Start local development and signaling server
node server.js
```
Open [http://localhost:8787](http://localhost:8787) in your browser.

### Run Automated Tests
```bash
node tests/runAllTests.js
```

---

## 🌐 Deploy to Cloudflare Workers

FLUXDROPE is designed natively for Cloudflare Workers with Durable Objects and Static Assets:

```bash
# Deploy to Cloudflare
npx wrangler deploy
```

Refer to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full Cloudflare configuration instructions.

---

## 🔒 Security Architecture

| Security Mechanism | Implementation |
|---|---|
| **Signaling** | Secure WebSocket (`wss://`) through Cloudflare Workers |
| **P2P Transfer** | DTLS-SRTP encrypted WebRTC DataChannel |
| **End-to-End Encryption** | Client-side AES-256-GCM chunk encryption derived via PBKDF2 (100,000 rounds) |
| **Brute-Force Lockout** | Server-side Durable Object lockout on 7th failed attempt for 10 minutes (HTTP 423) |
| **Integrity Verification** | Pre- and post-transfer SHA-256 cryptographic checksum matching |
| **Untrusted File Sandbox** | HTML/SVG previews rendered in sandboxed `<iframe>` without script execution rights |

---

## 👤 Credits & Identity
- **Project Name**: FLUXDROPE
- **Author & Architect**: Shiv Yogi
- **License**: MIT
