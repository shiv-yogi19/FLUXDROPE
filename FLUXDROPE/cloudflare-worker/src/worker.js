/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Cloudflare Worker Signaling Server & Durable Object Session Manager
 *
 * Created By Shiv Yogi
 *
 * Architecture:
 * - Cloudflare Workers (Edge Routing, CORS, KV code resolution)
 * - Durable Objects (Stateful WebSocket rendezvous, zero file data passthrough)
 * - Strict Rate Limiting (100 messages/min per connection)
 * - E2E Zero-Knowledge: Signaling server NEVER sees or buffers file data.
 */

// Configuration Defaults
const DEFAULT_SESSION_TTL_SECONDS = 1800; // 30 minutes
const MAX_MESSAGES_PER_MINUTE = 100;
const MAX_SDP_SIZE_BYTES = 4096; // SDP size limit < 4KB as per spec
const MAX_GENERAL_MESSAGE_SIZE = 16384; // 16KB ceiling to prevent binary/file transfers via signaling

// Valid WebSocket message types for signaling
const ALLOWED_MESSAGE_TYPES = new Set([
  'register-sender',
  'register-receiver',
  'create-session',
  'join-session',
  'leave-session',
  'custom-message',
  'offer',
  'answer',
  'ice-candidate',
  'peer-info',
  'cancel',
  'ping',
  'pong'
]);

/**
 * Standard CORS and security headers generator
 */
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '*';
  const allowedConfig = env?.ALLOWED_ORIGINS || '*';

  let allowOrigin = '*';
  if (allowedConfig !== '*') {
    const allowedList = allowedConfig.split(',').map(s => s.trim());
    if (allowedList.includes(origin) || origin.endsWith('.github.io')) {
      allowOrigin = origin;
    } else {
      allowOrigin = allowedList[0] || '*';
    }
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Sec-WebSocket-Protocol',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Author': 'Shiv Yogi - FLUXDROPE'
  };
}

/**
 * Generate cryptographically secure joining code in format: FLX-XXXX-XXXX
 * Excluding ambiguous characters: 0, O, 1, I, L
 */
function generateJoiningCode() {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars[bytes[i] % chars.length];
    p2 += chars[bytes[i + 4] % chars.length];
  }
  return `FLX-${p1}-${p2}`;
}

/**
 * Standard JSON response helper
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Cloudflare Worker Fetch Handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // 1. Health check & Service Info
      if (url.pathname === '/' || url.pathname === '/health') {
        const upgradeHeader = request.headers.get('Upgrade');
        // If client connects via root WebSocket upgrade directly (SPA universal client)
        if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
          const ephemeralId = crypto.randomUUID();
          const doId = env.TRANSFER_SESSION.idFromName(ephemeralId);
          const doStub = env.TRANSFER_SESSION.get(doId);
          return doStub.fetch(request);
        }

        return jsonResponse({
          status: 'online',
          service: 'FLUXDROPE Signaling Server',
          version: '1.0.0',
          author: 'Shiv Yogi',
          timestamp: new Date().toISOString(),
          e2eEncrypted: true
        }, 200, cors);
      }

      // 2. POST /session/create
      // Creates new session, generates code, reserves Durable Object
      if (request.method === 'POST' && url.pathname === '/session/create') {
        const ttlSeconds = parseInt(env.SESSION_TTL_SECONDS, 10) || DEFAULT_SESSION_TTL_SECONDS;
        const sessionId = crypto.randomUUID();
        const joiningCode = generateJoiningCode();
        const expiresAt = Date.now() + (ttlSeconds * 1000);

        // Store mapping in KV if bound
        if (env.JOINING_CODES) {
          await env.JOINING_CODES.put(joiningCode, sessionId, {
            expirationTtl: ttlSeconds
          });
          await env.JOINING_CODES.put(`sess:${sessionId}`, joiningCode, {
            expirationTtl: ttlSeconds
          });
        }

        // Initialize session in Durable Object
        const doId = env.TRANSFER_SESSION.idFromName(sessionId);
        const doStub = env.TRANSFER_SESSION.get(doId);
        await doStub.fetch(new Request('http://internal/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, joiningCode, expiresAt, ttlSeconds })
        }));

        return jsonResponse({
          success: true,
          sessionId,
          joiningCode,
          expiresAt,
          ttlSeconds,
          author: 'Shiv Yogi'
        }, 201, cors);
      }

      // 3. POST /session/:joiningCode/join-by-code
      // Validates code and returns sessionId
      const joinByCodeMatch = url.pathname.match(/^\/session\/([^/]+)\/join-by-code$/);
      if (request.method === 'POST' && joinByCodeMatch) {
        const rawCode = decodeURIComponent(joinByCodeMatch[1]).trim().toUpperCase();

        // Support both FLX-XXXX-XXXX and 6-char alpha codes
        let sessionId = null;
        if (env.JOINING_CODES) {
          sessionId = await env.JOINING_CODES.get(rawCode);
        }

        if (!sessionId) {
          return jsonResponse({
            success: false,
            error: 'Session not found or joining code has expired'
          }, 404, cors);
        }

        // Verify session is still active in Durable Object
        const doId = env.TRANSFER_SESSION.idFromName(sessionId);
        const doStub = env.TRANSFER_SESSION.get(doId);
        const statusRes = await doStub.fetch(new Request('http://internal/status'));

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.expired) {
            return jsonResponse({
              success: false,
              error: 'Session has expired'
            }, 410, cors);
          }
          return jsonResponse({
            success: true,
            sessionId,
            phase: statusData.phase,
            senderName: statusData.senderName,
            expiresAt: statusData.expiresAt
          }, 200, cors);
        }

        return jsonResponse({
          success: true,
          sessionId
        }, 200, cors);
      }

      // 4. GET /session/:sessionId/join - WebSocket upgrade
      const joinWsMatch = url.pathname.match(/^\/session\/([^/]+)\/join$/);
      if (request.method === 'GET' && joinWsMatch) {
        const sessionId = joinWsMatch[1];
        const upgradeHeader = request.headers.get('Upgrade');

        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
          return new Response('Expected WebSocket Upgrade Header', {
            status: 426,
            statusText: 'Upgrade Required',
            headers: cors
          });
        }

        // Route directly to the Durable Object for this session
        const doId = env.TRANSFER_SESSION.idFromName(sessionId);
        const doStub = env.TRANSFER_SESSION.get(doId);

        // Forward request into Durable Object fetch handler
        return doStub.fetch(request);
      }

      // 404 for unknown endpoints
      return jsonResponse({
        error: 'Endpoint not found',
        path: url.pathname
      }, 404, cors);

    } catch (err) {
      return jsonResponse({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
      }, 500, cors);
    }
  }
};

/**
 * TransferSession Durable Object
 * Coordinates real-time WebRTC signaling between Sender and Receiver.
 * ZERO file data is stored or forwarded. Only SDP and ICE candidate signaling packets.
 */
export class TransferSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Session State
    this.sessionId = null;
    this.joiningCode = null;
    this.expiresAt = null;
    this.phase = 'created'; // created | waiting | negotiating | transferring | completed | cancelled | expired

    // Peer connections
    this.senderWs = null;
    this.receiverWs = null;
    this.senderName = null;
    this.receiverName = null;
    this.fileMetadata = null; // Metadata ONLY: { files: [...], totalSize, count }

    // Rate Limiting Map: WebSocket -> Array of timestamps (epoch ms)
    this.rateLimiterMap = new WeakMap();

    // Rehydrate persisted state if available
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get([
        'sessionId',
        'joiningCode',
        'expiresAt',
        'phase',
        'senderName',
        'receiverName',
        'fileMetadata'
      ]);

      if (stored.has('sessionId')) this.sessionId = stored.get('sessionId');
      if (stored.has('joiningCode')) this.joiningCode = stored.get('joiningCode');
      if (stored.has('expiresAt')) this.expiresAt = stored.get('expiresAt');
      if (stored.has('phase')) this.phase = stored.get('phase');
      if (stored.has('senderName')) this.senderName = stored.get('senderName');
      if (stored.has('receiverName')) this.receiverName = stored.get('receiverName');
      if (stored.has('fileMetadata')) this.fileMetadata = stored.get('fileMetadata');
    });
  }

  /**
   * HTTP & WebSocket entrypoint for the Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);

    // Internal initialization endpoint
    if (url.pathname === '/init' && request.method === 'POST') {
      const data = await request.json();
      this.sessionId = data.sessionId;
      this.joiningCode = data.joiningCode;
      this.expiresAt = data.expiresAt;
      this.phase = 'waiting';

      await this.state.storage.put({
        sessionId: this.sessionId,
        joiningCode: this.joiningCode,
        expiresAt: this.expiresAt,
        phase: this.phase
      });

      // Schedule DO alarm for session expiration
      if (this.expiresAt) {
        await this.state.storage.setAlarm(this.expiresAt);
      }

      return jsonResponse({ success: true });
    }

    // Internal status check endpoint
    if (url.pathname === '/status') {
      const isExpired = this.expiresAt ? Date.now() > this.expiresAt : false;
      return jsonResponse({
        sessionId: this.sessionId,
        joiningCode: this.joiningCode,
        phase: this.phase,
        senderName: this.senderName,
        receiverName: this.receiverName,
        fileMetadata: this.fileMetadata,
        expiresAt: this.expiresAt,
        expired: isExpired,
        hasSender: !!this.senderWs,
        hasReceiver: !!this.receiverWs
      });
    }

    // WebSocket upgrade handler
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      // Check if session has expired
      if (this.expiresAt && Date.now() > this.expiresAt) {
        return new Response('Session has expired', { status: 410 });
      }

      const roleQuery = url.searchParams.get('role'); // optional 'sender' or 'receiver'
      const nameQuery = url.searchParams.get('name') || '';

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleWebSocketSession(server, roleQuery, nameQuery);

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Check rate limit for a websocket connection (max 100 msg/min)
   */
  checkRateLimit(ws) {
    const now = Date.now();
    let history = this.rateLimiterMap.get(ws);
    if (!history) {
      history = [];
      this.rateLimiterMap.set(ws, history);
    }

    // Keep only timestamps within last 60 seconds
    const windowStart = now - 60000;
    while (history.length > 0 && history[0] < windowStart) {
      history.shift();
    }

    const maxMsgs = parseInt(this.env?.MAX_MESSAGES_PER_MINUTE, 10) || MAX_MESSAGES_PER_MINUTE;
    if (history.length >= maxMsgs) {
      return false;
    }

    history.push(now);
    return true;
  }

  /**
   * Safe send JSON message to a WebSocket
   */
  safeSend(ws, payload) {
    if (!ws) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast message to both peers
   */
  broadcast(payload) {
    this.safeSend(this.senderWs, payload);
    this.safeSend(this.receiverWs, payload);
  }

  /**
   * Close and clean up session
   */
  async closeSession(reason = 'Session closed') {
    this.broadcast({
      type: 'session-closed',
      reason,
      timestamp: Date.now()
    });

    if (this.senderWs) {
      try { this.senderWs.close(1000, reason); } catch {}
      this.senderWs = null;
    }
    if (this.receiverWs) {
      try { this.receiverWs.close(1000, reason); } catch {}
      this.receiverWs = null;
    }

    this.phase = 'completed';
    await this.state.storage.deleteAll();
  }

  /**
   * Alarm handler triggered when 30-minute session TTL expires
   */
  async alarm() {
    this.phase = 'expired';
    this.broadcast({
      type: 'session-expired',
      message: 'This sharing session has reached its 30-minute TTL expiration.',
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    if (this.senderWs) {
      try { this.senderWs.close(1000, 'Session Expired'); } catch {}
      this.senderWs = null;
    }
    if (this.receiverWs) {
      try { this.receiverWs.close(1000, 'Session Expired'); } catch {}
      this.receiverWs = null;
    }

    // Clean up KV entry if bound
    if (this.env.JOINING_CODES && this.joiningCode) {
      try {
        await this.env.JOINING_CODES.delete(this.joiningCode);
        if (this.sessionId) {
          await this.env.JOINING_CODES.delete(`sess:${this.sessionId}`);
        }
      } catch {}
    }

    await this.state.storage.deleteAll();
  }

  /**
   * Setup WebSocket listener and message router
   */
  async handleWebSocketSession(ws, initialRole, initialName) {
    ws.accept();

    let assignedRole = initialRole || null;

    if (initialRole === 'sender') {
      if (this.senderWs && this.senderWs !== ws) {
        try { this.senderWs.close(1008, 'Replaced by new sender'); } catch {}
      }
      this.senderWs = ws;
      if (initialName) this.senderName = initialName.slice(0, 64);
    } else if (initialRole === 'receiver') {
      if (this.receiverWs && this.receiverWs !== ws) {
        try { this.receiverWs.close(1008, 'Replaced by new receiver'); } catch {}
      }
      this.receiverWs = ws;
      if (initialName) this.receiverName = initialName.slice(0, 64);
    }

    // Notify connected client of established connection
    this.safeSend(ws, {
      type: 'connected',
      sessionId: this.sessionId,
      expiresAt: this.expiresAt,
      role: assignedRole
    });

    // Check if both peers are present
    if (this.senderWs && this.receiverWs) {
      this.phase = 'negotiating';
      this.safeSend(this.senderWs, {
        type: 'peer-joined',
        role: 'receiver',
        name: this.receiverName || 'Anonymous Receiver',
        peerName: this.receiverName || 'Anonymous Receiver',
        displayName: this.receiverName || 'Anonymous Receiver',
        timestamp: Date.now()
      });
      this.safeSend(this.receiverWs, {
        type: 'peer-joined',
        role: 'sender',
        name: this.senderName || 'Anonymous Sender',
        peerName: this.senderName || 'Anonymous Sender',
        displayName: this.senderName || 'Anonymous Sender',
        fileMetadata: this.fileMetadata,
        timestamp: Date.now()
      });
    }

    ws.addEventListener('message', async (event) => {
      // 1. Rate Limiting Check
      if (!this.checkRateLimit(ws)) {
        this.safeSend(ws, {
          type: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded: maximum 100 messages per minute allowed.'
        });
        return;
      }

      // 2. Message Size Check
      const rawLength = typeof event.data === 'string' ? event.data.length : event.data.byteLength;
      if (rawLength > MAX_GENERAL_MESSAGE_SIZE) {
        this.safeSend(ws, {
          type: 'error',
          code: 'MESSAGE_TOO_LARGE',
          message: 'Message payload exceeds maximum allowable signaling size limit (16KB).'
        });
        return;
      }

      // 3. Message Parsing & Validation
      let message;
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) : JSON.parse(new TextDecoder().decode(event.data));
      } catch {
        this.safeSend(ws, {
          type: 'error',
          code: 'INVALID_JSON',
          message: 'Malformed JSON payload.'
        });
        return;
      }

      if (!message || typeof message !== 'object' || !message.type) {
        this.safeSend(ws, {
          type: 'error',
          code: 'INVALID_PAYLOAD',
          message: 'Message must include a valid string "type" attribute.'
        });
        return;
      }

      // Check allowed types
      if (!ALLOWED_MESSAGE_TYPES.has(message.type)) {
        this.safeSend(ws, {
          type: 'error',
          code: 'UNKNOWN_TYPE',
          message: `Unsupported message type: ${message.type}`
        });
        return;
      }

      // STRICT ZERO-DATA SECURITY CHECK: Never allow binary chunks or file content via signaling
      if (message.fileData || message.chunkData || message.chunk || message.binary) {
        this.safeSend(ws, {
          type: 'error',
          code: 'PROHIBITED_DATA',
          message: 'File contents must be transmitted exclusively via WebRTC DataChannel, never through signaling.'
        });
        return;
      }

      // 4. Message Type Handling
      switch (message.type) {
        case 'ping': {
          this.safeSend(ws, { type: 'pong', timestamp: Date.now() });
          break;
        }

        case 'pong': {
          // Heartbeat ack
          break;
        }

        case 'create-session': {
          if (!this.sessionId) {
            this.sessionId = crypto.randomUUID();
            this.joiningCode = generateJoiningCode();
            this.expiresAt = Date.now() + (DEFAULT_SESSION_TTL_SECONDS * 1000);
          }
          this.senderWs = ws;
          assignedRole = 'sender';
          this.senderName = (message.displayName || message.name || 'Sender').slice(0, 64);

          this.safeSend(ws, {
            type: 'session-created',
            sessionId: this.sessionId,
            joiningCode: this.joiningCode,
            expiresAt: this.expiresAt
          });
          break;
        }

        case 'join-session': {
          this.receiverWs = ws;
          assignedRole = 'receiver';
          this.receiverName = (message.displayName || message.name || 'Receiver').slice(0, 64);

          this.safeSend(ws, {
            type: 'joined',
            sessionId: this.sessionId,
            peerName: this.senderName || 'Sender'
          });

          if (this.senderWs) {
            this.phase = 'negotiating';
            this.safeSend(this.senderWs, {
              type: 'peer-joined',
              role: 'receiver',
              name: this.receiverName,
              peerName: this.receiverName,
              displayName: this.receiverName,
              timestamp: Date.now()
            });
            this.safeSend(this.receiverWs, {
              type: 'peer-joined',
              role: 'sender',
              name: this.senderName,
              peerName: this.senderName,
              displayName: this.senderName,
              fileMetadata: this.fileMetadata,
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'register-sender': {
          if (this.senderWs && this.senderWs !== ws) {
            try { this.senderWs.close(1008, 'New sender registered'); } catch {}
          }
          this.senderWs = ws;
          assignedRole = 'sender';
          if (message.name && typeof message.name === 'string') {
            this.senderName = message.name.slice(0, 64);
          }
          if (message.fileMetadata && typeof message.fileMetadata === 'object') {
            // Store file metadata only (names, sizes, types - NO DATA)
            this.fileMetadata = {
              totalFiles: message.fileMetadata.totalFiles || 0,
              totalBytes: message.fileMetadata.totalBytes || 0,
              files: Array.isArray(message.fileMetadata.files)
                ? message.fileMetadata.files.map(f => ({
                    name: String(f.name || '').slice(0, 255),
                    size: Number(f.size) || 0,
                    type: String(f.type || '').slice(0, 100),
                    hash: f.hash ? String(f.hash).slice(0, 64) : null
                  }))
                : []
            };
          }

          this.safeSend(ws, {
            type: 'sender-registered',
            sessionId: this.sessionId,
            senderName: this.senderName
          });

          if (this.receiverWs) {
            this.phase = 'negotiating';
            this.safeSend(this.receiverWs, {
              type: 'peer-joined',
              role: 'sender',
              name: this.senderName || 'Anonymous Sender',
              peerName: this.senderName || 'Anonymous Sender',
              displayName: this.senderName || 'Anonymous Sender',
              fileMetadata: this.fileMetadata,
              timestamp: Date.now()
            });
            this.safeSend(this.senderWs, {
              type: 'peer-joined',
              role: 'receiver',
              name: this.receiverName || 'Anonymous Receiver',
              peerName: this.receiverName || 'Anonymous Receiver',
              displayName: this.receiverName || 'Anonymous Receiver',
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'register-receiver': {
          if (this.receiverWs && this.receiverWs !== ws) {
            try { this.receiverWs.close(1008, 'New receiver registered'); } catch {}
          }
          this.receiverWs = ws;
          assignedRole = 'receiver';
          if (message.name && typeof message.name === 'string') {
            this.receiverName = message.name.slice(0, 64);
          }

          this.safeSend(ws, {
            type: 'receiver-registered',
            sessionId: this.sessionId,
            receiverName: this.receiverName
          });

          if (this.senderWs) {
            this.phase = 'negotiating';
            this.safeSend(this.senderWs, {
              type: 'peer-joined',
              role: 'receiver',
              name: this.receiverName || 'Anonymous Receiver',
              peerName: this.receiverName || 'Anonymous Receiver',
              displayName: this.receiverName || 'Anonymous Receiver',
              timestamp: Date.now()
            });
            this.safeSend(this.receiverWs, {
              type: 'peer-joined',
              role: 'sender',
              name: this.senderName || 'Anonymous Sender',
              peerName: this.senderName || 'Anonymous Sender',
              displayName: this.senderName || 'Anonymous Sender',
              fileMetadata: this.fileMetadata,
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'offer': {
          // Validate SDP size (<4KB)
          const sdpString = typeof message.sdp === 'string' ? message.sdp : JSON.stringify(message.sdp || '');
          if (sdpString.length > MAX_SDP_SIZE_BYTES) {
            this.safeSend(ws, {
              type: 'error',
              code: 'INVALID_SDP',
              message: 'SDP offer exceeds size limit (<4KB).'
            });
            return;
          }

          // Forward SDP offer from sender to receiver
          if (this.receiverWs) {
            this.safeSend(this.receiverWs, {
              type: 'offer',
              sdp: message.sdp,
              senderPublicKey: message.senderPublicKey || null,
              peerName: this.senderName,
              timestamp: Date.now()
            });
          } else {
            this.safeSend(ws, {
              type: 'peer-unavailable',
              target: 'receiver',
              message: 'Receiver is not currently connected to this session.'
            });
          }
          break;
        }

        case 'answer': {
          // Validate SDP size (<4KB)
          const sdpString = typeof message.sdp === 'string' ? message.sdp : JSON.stringify(message.sdp || '');
          if (sdpString.length > MAX_SDP_SIZE_BYTES) {
            this.safeSend(ws, {
              type: 'error',
              code: 'INVALID_SDP',
              message: 'SDP answer exceeds size limit (<4KB).'
            });
            return;
          }

          // Forward SDP answer from receiver to sender
          if (this.senderWs) {
            this.safeSend(this.senderWs, {
              type: 'answer',
              sdp: message.sdp,
              receiverPublicKey: message.receiverPublicKey || null,
              peerName: this.receiverName,
              timestamp: Date.now()
            });
          } else {
            this.safeSend(ws, {
              type: 'peer-unavailable',
              target: 'sender',
              message: 'Sender is not currently connected to this session.'
            });
          }
          break;
        }

        case 'ice-candidate': {
          // Forward ICE candidate to peer
          if (!message.candidate) {
            return;
          }

          const targetWs = (ws === this.senderWs) ? this.receiverWs : this.senderWs;
          if (targetWs) {
            this.safeSend(targetWs, {
              type: 'ice-candidate',
              candidate: message.candidate,
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'peer-info': {
          const targetWs = (ws === this.senderWs) ? this.receiverWs : this.senderWs;
          if (targetWs) {
            this.safeSend(targetWs, {
              type: 'peer-info',
              from: assignedRole,
              info: message.info || {},
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'custom-message': {
          const targetWs = (ws === this.senderWs) ? this.receiverWs : this.senderWs;
          if (targetWs) {
            this.safeSend(targetWs, {
              type: 'custom-message',
              subType: message.subType,
              sender: assignedRole === 'sender' ? this.senderName : this.receiverName,
              data: message.data || {},
              timestamp: Date.now()
            });
          }
          break;
        }

        case 'leave-session':
        case 'cancel': {
          this.phase = 'cancelled';
          const reason = message.reason || 'Transfer cancelled by peer';
          this.broadcast({
            type: 'peer-disconnected',
            peerName: assignedRole === 'sender' ? this.senderName : this.receiverName,
            role: assignedRole,
            reason,
            timestamp: Date.now()
          });
          this.broadcast({
            type: 'peer-left',
            role: assignedRole,
            reason,
            timestamp: Date.now()
          });
          await this.closeSession(reason);
          break;
        }
      }
    });

    const cleanupPeer = async (closeReason) => {
      const isSender = (ws === this.senderWs);
      const peerName = isSender ? this.senderName : this.receiverName;

      if (isSender) {
        this.senderWs = null;
        if (this.receiverWs) {
          this.safeSend(this.receiverWs, {
            type: 'peer-disconnected',
            peerName: peerName || 'Sender',
            role: 'sender',
            reason: closeReason || 'Sender disconnected',
            timestamp: Date.now()
          });
          this.safeSend(this.receiverWs, {
            type: 'peer-left',
            role: 'sender',
            reason: closeReason || 'Sender disconnected',
            timestamp: Date.now()
          });
        }
      } else {
        this.receiverWs = null;
        if (this.senderWs) {
          this.safeSend(this.senderWs, {
            type: 'peer-disconnected',
            peerName: peerName || 'Receiver',
            role: 'receiver',
            reason: closeReason || 'Receiver disconnected',
            timestamp: Date.now()
          });
          this.safeSend(this.senderWs, {
            type: 'peer-left',
            role: 'receiver',
            reason: closeReason || 'Receiver disconnected',
            timestamp: Date.now()
          });
        }
      }

      if (!this.senderWs && !this.receiverWs) {
        this.phase = 'completed';
      }
    };

    ws.addEventListener('close', (event) => {
      cleanupPeer(`WebSocket closed (code: ${event.code})`);
    });

    ws.addEventListener('error', (err) => {
      cleanupPeer(`WebSocket error: ${err.message || 'unknown'}`);
    });
  }
}
