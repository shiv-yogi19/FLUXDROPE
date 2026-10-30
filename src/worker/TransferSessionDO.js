/**
 * FLUXDROPE - TransferSession Durable Object
 * Created By Shiv Yogi
 *
 * Implements session state persistence, server-side 7-attempt password lockout,
 * and real-time WebRTC WebSocket signaling between sender and receivers.
 */

import { SECURITY_POLICY, TRANSFER_LIMITS, SIGNALING_TYPES } from '../shared/constants.js';
import { verifyServerPassword } from './security.js';

export class TransferSessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;

    // In-memory state for active connections
    this.session = null;
    this.sockets = new Map(); // socket -> { id, role: 'sender' | 'receiver', authorized: boolean }
  }

  async initialize() {
    if (!this.session) {
      this.session = (await this.storage.get('sessionData')) || null;
    }
  }

  async fetch(request) {
    await this.initialize();
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade for real-time signaling
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST endpoints handled by Durable Object
    if (path === '/create' && request.method === 'POST') {
      return this.handleCreate(request);
    }

    if (path === '/info' && request.method === 'GET') {
      return this.handleInfo();
    }

    if (path === '/verify-password' && request.method === 'POST') {
      return this.handleVerifyPassword(request);
    }

    if (path === '/close' && request.method === 'POST') {
      return this.handleClose();
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle Session Creation
   */
  async handleCreate(request) {
    if (this.session && this.session.status === 'active' && Date.now() < this.session.expiresAt) {
      return new Response(JSON.stringify({ error: 'Session already exists and is active' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const now = Date.now();
    const expiryMs = Math.min(
      body.expiryMs || TRANSFER_LIMITS.DEFAULT_SESSION_EXPIRY_MS,
      TRANSFER_LIMITS.MAX_SESSION_EXPIRY_MS
    );

    this.session = {
      sessionId: body.sessionId,
      joiningCode: body.joiningCode,
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

    await this.storage.put('sessionData', this.session);

    return new Response(JSON.stringify({
      success: true,
      sessionId: this.session.sessionId,
      joiningCode: this.session.joiningCode,
      expiresAt: this.session.expiresAt
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle Public Session Info (sanitized, does not leak password hash or private files if password required)
   */
  async handleInfo() {
    if (!this.session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    if (now > this.session.expiresAt) {
      this.session.status = 'expired';
      await this.storage.put('sessionData', this.session);
      return new Response(JSON.stringify({ error: 'Session expired', status: 'expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isLocked = now < this.session.lockoutUntil;
    const retryAfter = isLocked ? Math.ceil((this.session.lockoutUntil - now) / 1000) : 0;

    // Do not reveal individual filenames before password authentication if password required
    const safeFiles = this.session.passwordRequired
      ? []
      : this.session.files.map(f => ({ name: f.name, size: f.size, type: f.type }));

    return new Response(JSON.stringify({
      sessionId: this.session.sessionId,
      joiningCode: this.session.joiningCode,
      senderName: this.session.senderName,
      passwordRequired: this.session.passwordRequired,
      e2eeEnabled: this.session.e2eeEnabled,
      e2eeSalt: this.session.e2eeSalt,
      totalCount: this.session.totalCount,
      totalSize: this.session.totalSize,
      expiresAt: this.session.expiresAt,
      isLocked,
      retryAfter,
      files: safeFiles
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Enforce 7-attempt lockout policy:
   * Up to 6 unsuccessful attempts permitted.
   * On 7th unsuccessful attempt, transfer is locked for 10 minutes (600,000 ms).
   * During lockout, reject all attempts with 423 Locked.
   */
  async handleVerifyPassword(request) {
    if (!this.session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    if (now > this.session.expiresAt) {
      return new Response(JSON.stringify({ error: 'Session expired', status: 'expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if session is currently locked out
    if (now < this.session.lockoutUntil) {
      const remainingSeconds = Math.ceil((this.session.lockoutUntil - now) / 1000);
      return new Response(JSON.stringify({
        error: `Transfer is locked due to 7 unsuccessful password attempts. Please wait ${remainingSeconds} seconds before trying again.`,
        locked: true,
        retryAfter: remainingSeconds
      }), {
        status: 423, // 423 Locked
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(remainingSeconds)
        }
      });
    }

    // If lockout has elapsed, reset failed counter
    if (this.session.lockoutUntil > 0 && now >= this.session.lockoutUntil) {
      this.session.failedAttempts = 0;
      this.session.lockoutUntil = 0;
    }

    const { password } = await request.json();
    const isValid = await verifyServerPassword(password, this.session.passwordHash, this.session.salt);

    if (!isValid) {
      this.session.failedAttempts = (this.session.failedAttempts || 0) + 1;

      // On the 7th unsuccessful attempt: trigger 10-minute lockout
      if (this.session.failedAttempts >= SECURITY_POLICY.LOCKOUT_THRESHOLD) {
        this.session.lockoutUntil = now + SECURITY_POLICY.LOCKOUT_DURATION_MS;
        await this.storage.put('sessionData', this.session);

        return new Response(JSON.stringify({
          error: 'Maximum failed password attempts reached. Session locked for 10 minutes.',
          locked: true,
          retryAfter: 600,
          failedAttempts: this.session.failedAttempts
        }), {
          status: 423,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '600'
          }
        });
      }

      await this.storage.put('sessionData', this.session);
      const remaining = SECURITY_POLICY.LOCKOUT_THRESHOLD - this.session.failedAttempts;

      return new Response(JSON.stringify({
        error: 'Incorrect password',
        locked: false,
        failedAttempts: this.session.failedAttempts,
        remainingAttempts: remaining
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Password is valid - reset failed attempts and return authorized session payload
    this.session.failedAttempts = 0;
    this.session.lockoutUntil = 0;
    await this.storage.put('sessionData', this.session);

    return new Response(JSON.stringify({
      success: true,
      authorized: true,
      files: this.session.files,
      totalCount: this.session.totalCount,
      totalSize: this.session.totalSize,
      e2eeEnabled: this.session.e2eeEnabled,
      e2eeSalt: this.session.e2eeSalt
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Close and terminate session
   */
  async handleClose() {
    if (this.session) {
      this.session.status = 'closed';
      await this.storage.put('sessionData', this.session);

      // Notify and disconnect all connected WebSockets
      for (const [ws] of this.sockets.entries()) {
        try {
          ws.send(JSON.stringify({ type: SIGNALING_TYPES.SESSION_CLOSE }));
          ws.close(1000, 'Session closed by owner');
        } catch (_) {}
      }
      this.sockets.clear();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle WebSocket connection for WebRTC signaling
   */
  async handleWebSocket(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    const peerId = crypto.randomUUID();
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'receiver';

    this.sockets.set(server, { id: peerId, role, authorized: !this.session?.passwordRequired });

    server.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.routeSignalingMessage(server, msg);
      } catch (err) {
        server.send(JSON.stringify({ type: SIGNALING_TYPES.ERROR, message: 'Invalid JSON message' }));
      }
    });

    const cleanup = () => {
      const peer = this.sockets.get(server);
      this.sockets.delete(server);
      if (peer) {
        this.broadcastExcept(server, {
          type: SIGNALING_TYPES.TRANSFER_CANCEL,
          peerId: peer.id,
          reason: `${peer.role} disconnected`
        });
      }
    };

    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    // Initial greeting
    server.send(JSON.stringify({
      type: SIGNALING_TYPES.SESSION_STATUS,
      peerId,
      role,
      activePeers: this.sockets.size
    }));

    // Notify other peers of new joiner
    this.broadcastExcept(server, {
      type: SIGNALING_TYPES.SESSION_JOINED,
      peerId,
      role
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Route signaling messages between sender and receivers
   */
  routeSignalingMessage(senderWs, msg) {
    const senderPeer = this.sockets.get(senderWs);
    if (!senderPeer) return;

    msg.fromPeerId = senderPeer.id;

    // Direct routing if targetPeerId specified
    if (msg.targetPeerId) {
      for (const [ws, peer] of this.sockets.entries()) {
        if (peer.id === msg.targetPeerId && ws !== senderWs) {
          try { ws.send(JSON.stringify(msg)); } catch (_) {}
          return;
        }
      }
    }

    // Default: broadcast to all other peers in session
    this.broadcastExcept(senderWs, msg);
  }

  broadcastExcept(exceptWs, msg) {
    const payload = JSON.stringify(msg);
    for (const [ws] of this.sockets.entries()) {
      if (ws !== exceptWs) {
        try { ws.send(payload); } catch (_) {}
      }
    }
  }
}
