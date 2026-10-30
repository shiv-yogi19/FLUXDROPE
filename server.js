/**
 * FLUXDROPE - Local Development & Signaling Server
 * Created By Shiv Yogi
 *
 * Implements pure Node.js HTTP + WebSocket server matching the Cloudflare Worker API.
 * Zero external npm dependencies required!
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const SRC_DIR = path.join(__dirname, 'src');

const PORT = process.env.PORT || 8787;

// In-memory sessions storage (matching Durable Object state)
const sessions = new Map();
const codeToSessionId = new Map();
const sockets = new Map(); // wsKey -> { socket, sessionId, role, peerId }

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 1. Session Creation API
    if (pathname === '/api/session/create' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || crypto.randomUUID();
      const joiningCode = body.joiningCode;
      const now = Date.now();
      const expiryMs = body.expiryMs || (60 * 60 * 1000);

      const session = {
        sessionId,
        joiningCode,
        createdAt: now,
        expiresAt: now + expiryMs,
        passwordRequired: Boolean(body.passwordRequired),
        passwordHash: body.passwordHash || null,
        salt: body.salt || null,
        e2eeEnabled: Boolean(body.e2eeEnabled),
        e2eeSalt: body.e2eeSalt || null,
        files: body.files || [],
        totalSize: body.totalSize || 0,
        totalCount: body.totalCount || 0,
        senderName: body.senderName || 'FLUXDROPE Sender',
        failedAttempts: 0,
        lockoutUntil: 0,
        status: 'active'
      };

      sessions.set(sessionId, session);
      if (joiningCode) {
        codeToSessionId.set(joiningCode, sessionId);
      }

      sendJson(res, { success: true, sessionId, joiningCode, expiresAt: session.expiresAt }, 201);
      return;
    }

    // 2. Resolve Joining Code to Session ID
    if (pathname.startsWith('/api/session/by-code/') && req.method === 'GET') {
      const code = pathname.split('/api/session/by-code/')[1];
      const sessionId = codeToSessionId.get(code);

      if (!sessionId || !sessions.has(sessionId)) {
        sendJson(res, { error: 'Transfer session not found for this joining code' }, 404);
        return;
      }

      sendJson(res, { sessionId, joiningCode: code });
      return;
    }

    // 3. Session Info
    const infoMatch = pathname.match(/^\/api\/session\/([a-zA-Z0-9_-]+)\/info$/);
    if (infoMatch && req.method === 'GET') {
      const sessionId = infoMatch[1];
      const session = sessions.get(sessionId);

      if (!session) {
        sendJson(res, { error: 'Session not found' }, 404);
        return;
      }

      const now = Date.now();
      if (now > session.expiresAt) {
        sendJson(res, { error: 'Session expired', status: 'expired' }, 410);
        return;
      }

      const isLocked = now < session.lockoutUntil;
      const retryAfter = isLocked ? Math.ceil((session.lockoutUntil - now) / 1000) : 0;
      const safeFiles = session.passwordRequired ? [] : session.files;

      sendJson(res, {
        sessionId: session.sessionId,
        joiningCode: session.joiningCode,
        senderName: session.senderName,
        passwordRequired: session.passwordRequired,
        e2eeEnabled: session.e2eeEnabled,
        e2eeSalt: session.e2eeSalt,
        totalCount: session.totalCount,
        totalSize: session.totalSize,
        expiresAt: session.expiresAt,
        isLocked,
        retryAfter,
        files: safeFiles
      });
      return;
    }

    // 4. Password Verification with 7-attempt lockout policy
    const passMatch = pathname.match(/^\/api\/session\/([a-zA-Z0-9_-]+)\/verify-password$/);
    if (passMatch && req.method === 'POST') {
      const sessionId = passMatch[1];
      const session = sessions.get(sessionId);

      if (!session) {
        sendJson(res, { error: 'Session not found' }, 404);
        return;
      }

      const now = Date.now();
      if (now > session.expiresAt) {
        sendJson(res, { error: 'Session expired', status: 'expired' }, 410);
        return;
      }

      // Check active lockout
      if (now < session.lockoutUntil) {
        const remainingSeconds = Math.ceil((session.lockoutUntil - now) / 1000);
        sendJson(res, {
          error: `Transfer is locked due to 7 unsuccessful password attempts. Please wait ${remainingSeconds} seconds before trying again.`,
          locked: true,
          retryAfter: remainingSeconds
        }, 423);
        return;
      }

      // Reset lockout counter if lockout period expired
      if (session.lockoutUntil > 0 && now >= session.lockoutUntil) {
        session.failedAttempts = 0;
        session.lockoutUntil = 0;
      }

      const body = await parseJsonBody(req);
      const isMatch = await verifyNodePassword(body.password, session.passwordHash, session.salt);

      if (!isMatch) {
        session.failedAttempts = (session.failedAttempts || 0) + 1;

        // 7th attempt triggers 10 minute lockout
        if (session.failedAttempts >= 7) {
          session.lockoutUntil = now + (10 * 60 * 1000);
          sendJson(res, {
            error: 'Maximum failed password attempts reached. Session locked for 10 minutes.',
            locked: true,
            retryAfter: 600,
            failedAttempts: session.failedAttempts
          }, 423);
          return;
        }

        const remaining = 7 - session.failedAttempts;
        sendJson(res, {
          error: 'Incorrect password',
          locked: false,
          failedAttempts: session.failedAttempts,
          remainingAttempts: remaining
        }, 401);
        return;
      }

      // Correct password
      session.failedAttempts = 0;
      session.lockoutUntil = 0;

      sendJson(res, {
        success: true,
        authorized: true,
        files: session.files,
        totalCount: session.totalCount,
        totalSize: session.totalSize,
        e2eeEnabled: session.e2eeEnabled,
        e2eeSalt: session.e2eeSalt
      });
      return;
    }

    // 5. Serve static assets from /public and /src
    let filePath;
    if (pathname.startsWith('/src/')) {
      filePath = path.join(__dirname, pathname);
    } else {
      filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, { error: 'Internal Server Error', message: err.message }, 500);
  }
});

// Pure Node.js WebSocket Upgrade & Framing (RFC 6455)
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/ws\/signaling\/([a-zA-Z0-9_-]+)/);

  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = match[1];
  const role = url.searchParams.get('role') || 'receiver';
  const peerId = crypto.randomUUID();

  // Handshake
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
  );

  const socketInfo = { socket, sessionId, role, peerId };
  sockets.set(socket, socketInfo);

  // Send status
  sendWsMessage(socket, {
    type: 'session:status',
    peerId,
    role,
    activePeers: Array.from(sockets.values()).filter(s => s.sessionId === sessionId).length
  });

  // Notify other peers
  broadcastToSession(sessionId, socket, {
    type: 'session:joined',
    peerId,
    role
  });

  // Frame reading
  socket.on('data', (buffer) => {
    try {
      const messages = decodeWsFrames(buffer);
      for (const text of messages) {
        const msg = JSON.parse(text);
        msg.fromPeerId = peerId;

        if (msg.targetPeerId) {
          // Direct routing
          for (const s of sockets.values()) {
            if (s.sessionId === sessionId && s.peerId === msg.targetPeerId && s.socket !== socket) {
              sendWsMessage(s.socket, msg);
              break;
            }
          }
        } else {
          // Broadcast to session
          broadcastToSession(sessionId, socket, msg);
        }
      }
    } catch (e) {
      // Ignored or frame fragmentation
    }
  });

  const cleanup = () => {
    sockets.delete(socket);
    broadcastToSession(sessionId, socket, {
      type: 'transfer:cancel',
      peerId,
      reason: `${role} disconnected`
    });
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

function broadcastToSession(sessionId, exceptSocket, msg) {
  for (const s of sockets.values()) {
    if (s.sessionId === sessionId && s.socket !== exceptSocket) {
      sendWsMessage(s.socket, msg);
    }
  }
}

function sendWsMessage(socket, obj) {
  try {
    const payload = Buffer.from(JSON.stringify(obj));
    const len = payload.length;
    let header;

    if (len < 126) {
      header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    socket.write(Buffer.concat([header, payload]));
  } catch (_) {}
}

function decodeWsFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 2 > buffer.length) break;
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const isMasked = (byte2 & 0x80) !== 0;
    let payloadLength = byte2 & 0x7f;
    offset += 2;

    if (payloadLength === 126) {
      if (offset + 2 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (offset + 8 > buffer.length) break;
      payloadLength = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask = null;
    if (isMasked) {
      if (offset + 4 > buffer.length) break;
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (offset + payloadLength > buffer.length) break;
    const payload = buffer.slice(offset, offset + payloadLength);
    offset += payloadLength;

    if (isMasked && mask) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    const opcode = byte1 & 0x0f;
    if (opcode === 1) { // Text frame
      messages.push(payload.toString('utf8'));
    }
  }

  return messages;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function verifyNodePassword(password, storedHashHex, saltHex) {
  if (!password || !storedHashHex || !saltHex) return false;
  return new Promise((resolve) => {
    const salt = Buffer.from(saltHex, 'hex');
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) return resolve(false);
      const derivedHex = derivedKey.toString('hex');
      try {
        const a = Buffer.from(derivedHex, 'hex');
        const b = Buffer.from(storedHashHex, 'hex');
        resolve(crypto.timingSafeEqual(a, b));
      } catch (_) {
        resolve(false);
      }
    });
  });
}

// Start server if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  FLUXDROPE - Peer-to-Peer File Transfer Server`);
    console.log(`  Created By Shiv Yogi`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

export { server, sessions, codeToSessionId };
