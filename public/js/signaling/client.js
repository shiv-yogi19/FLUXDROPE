/**
 * FLUXDROPE - WebSocket Signaling Client
 * Created By Shiv Yogi
 *
 * Connects to the Cloudflare Worker / local development signaling server.
 * Handles session exchange, password verification, and WebRTC signal routing.
 */

import { SIGNALING_TYPES } from '../constants.js';

export class SignalingClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || window.location.origin;
    this.ws = null;
    this.sessionId = null;
    this.role = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.peerId = null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try { cb(data); } catch (e) { console.error('Signaling listener error:', e); }
      }
    }
  }

  /**
   * Create a new transfer session via REST API
   * @param {object} sessionPayload
   * @returns {Promise<object>}
   */
  async createSession(sessionPayload) {
    const res = await fetch(`${this.baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create session');
    }

    this.sessionId = data.sessionId;
    return data;
  }

  /**
   * Resolve a 6-digit joining code to a session ID
   * @param {string} code
   * @returns {Promise<string>}
   */
  async resolveJoiningCode(code) {
    const res = await fetch(`${this.baseUrl}/api/session/by-code/${code}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Joining code not found');
    }
    return data.sessionId;
  }

  /**
   * Fetch public info about a session
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async getSessionInfo(sessionId) {
    const res = await fetch(`${this.baseUrl}/api/session/${sessionId}/info`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch session information');
    }
    return data;
  }

  /**
   * Verify password against server
   * @param {string} sessionId
   * @param {string} password
   * @returns {Promise<object>}
   */
  async verifyPassword(sessionId, password) {
    const res = await fetch(`${this.baseUrl}/api/session/${sessionId}/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (res.status === 423) {
      const err = new Error(data.error);
      err.isLocked = true;
      err.retryAfter = data.retryAfter;
      throw err;
    }

    if (!res.ok) {
      const err = new Error(data.error || 'Password verification failed');
      err.remainingAttempts = data.remainingAttempts;
      throw err;
    }

    return data;
  }

  /**
   * Connect WebSocket to signaling channel
   * @param {string} sessionId
   * @param {'sender'|'receiver'} role
   * @returns {Promise<void>}
   */
  async connectWebSocket(sessionId, role) {
    this.sessionId = sessionId;
    this.role = role;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/signaling/${sessionId}?role=${role}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.emit('connected', { sessionId, role });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleSignalingMessage(msg);
          } catch (e) {
            console.error('Failed to parse signaling message:', e);
          }
        };

        this.ws.onerror = (err) => {
          this.emit('error', err);
          if (!this.isConnected) reject(err);
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.emit('disconnected', event);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  handleSignalingMessage(msg) {
    if (msg.type === SIGNALING_TYPES.SESSION_STATUS) {
      this.peerId = msg.peerId;
    }
    this.emit(msg.type, msg);
    this.emit('message', msg);
  }

  /**
   * Send a signaling message
   * @param {string} type
   * @param {object} payload
   */
  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Signaling WebSocket not open. Cannot send:', type);
      return;
    }
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
      this.isConnected = false;
    }
  }
}
