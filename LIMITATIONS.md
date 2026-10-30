# FLUXDROPE — Feature Limitations & Technical Specifications
**Created By Shiv Yogi**

This document transparently specifies current technical boundaries, browser constraints, and external infrastructure requirements for FLUXDROPE.

---

## 1. WebRTC Peer-to-Peer Direct Transfer

### NAT Traversal & Relay
- **Default STUN Configuration**: FLUXDROPE connects peers directly via public STUN servers (`stun.cloudflare.com:3478` and `stun.l.google.com:19302`).
- **Symmetric NAT Boundary**: In environments where both sender and receiver are located behind strict symmetric NATs or restrictive enterprise firewalls that block all peer-to-peer UDP hole-punching, direct WebRTC connections cannot be completed without a TURN relay.
- **Infrastructure Note**: Cloudflare Workers do not provide unlimited TURN relay bandwidth out-of-the-box. If TURN relay is needed in restricted corporate environments, an external TURN service (such as Cloudflare Calls TURN or Twilio Network Traversal) should be configured in `RTC_CONFIG.iceServers`.

### Browser Lifecycle & Background Execution
- **Browser Closure**: Since FLUXDROPE operates peer-to-peer without central file storage, transfers require both sender and receiver browser tabs to remain open. If the sender closes their tab before a file finishes transmitting, the transfer terminates.
- **Mobile Background Suspending**: On iOS Safari and Android Chrome, backgrounding the browser tab for prolonged periods may throttle or pause WebRTC sockets to save battery. Users are advised to keep the tab visible until transfers finish.

---

## 2. In-Browser Media Viewers

### Video & Audio Codecs
- In-browser playback relies on native HTML5 `<video>` and `<audio>` decoding provided by the operating system.
- Common web formats (`.mp4` with H.264/AAC, `.webm` with VP8/VP9/Opus, `.mp3`, `.wav`) play with zero configuration.
- Proprietary or uncompressed containers (e.g. `.avi`, `.mkv` with HEVC or AC3 audio) may not play in browsers lacking hardware codec licenses. For these files, FLUXDROPE provides the fallback "Download Original" action.

### PDF Rendering
- Rendered via native browser embedded viewing or HTML5 Canvas. Very large, encrypted, or password-protected PDF files may require entering credentials or downloading for viewing in a dedicated desktop PDF application.

### Office Documents (.docx, .xlsx, .pptx)
- To preserve client security and prevent execution of untrusted macros, raw binary Office documents provide clean download and file metadata actions rather than executing untrusted third-party macros.

---

## 3. Filename Branding & Watermarking

### Filename Suffix
- Every downloaded file adopts:
  `OriginalFileName_FLUXDROPE_Created_By_Shiv_Yogi.Extension`
- Compound extensions (e.g. `.tar.gz`) are preserved.
- When browser privacy settings prevent automated renaming via the download attribute (rare on legacy browsers), files may download with default names.

### Visual Watermarking
- Supported non-destructively for standard raster images (`image/png`, `image/jpeg`, `image/webp`) by rendering an elegant frosted glass badge to an HTML5 canvas and exporting a derived copy.
- Arbitrary binary files (e.g. `.zip`, `.apk`, `.tar`) are never destructively modified, preserving bit-for-bit file integrity.

---

## 4. Security & Lockout

### Seven-Attempt Lockout
- Enforced atomically on the Cloudflare Durable Object session.
- Protects against automated brute-force attacks by locking verification for 10 minutes upon 7 consecutive incorrect passwords.
- Clearing client-side LocalStorage cannot bypass the server lockout because the lockout state is anchored to the server-side Durable Object session identifier.
