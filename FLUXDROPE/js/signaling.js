/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: signaling.js
 * Author: Shiv Yogi
 * 
 * WebSocket Signaling Client for Cloudflare Workers.
 * Features:
 * - Robust session management (session ID and 6-character joining codes)
 * - Exponential backoff reconnection with heartbeat keep-alive
 * - Strict payload validation to ensure zero file content leakage over signaling
 * - Full WebRTC SDP and ICE candidate relay
 * - Peer presence and display name exchange
 */

export const MAX_SIGNALING_PAYLOAD_SIZE = 64 * 1024; // 64KB max payload size
export const HEARTBEAT_INTERVAL_MS = 25000;          // 25s keepalive ping
export const INITIAL_RECONNECT_DELAY_MS = 1000;
export const MAX_RECONNECT_DELAY_MS = 30000;
export const MAX_RECONNECT_ATTEMPTS = 6;

export class SignalingClient {
  /**
   * @param {string} [workerUrl] 
   */
  constructor(workerUrl = null) {
    this.workerUrl = workerUrl;
    this.ws = null;
    this.isConnected = false;
    this.isManualClose = false;

    // Session state
    this.sessionId = null;
    this.joiningCode = null;
    this.displayName = null;
    this.peerDisplayName = null;

    // Reconnection & Heartbeat
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;

    // Pending request promises
    this._pendingCreateResolve = null;
    this._pendingCreateReject = null;
    this._pendingJoinResolve = null;
    this._pendingJoinReject = null;

    // Event Callbacks
    this.onSessionCreated = null;
    this.onPeerJoined = null;
    this.onOffer = null;
    this.onAnswer = null;
    this.onIceCandidate = null;
    this.onPeerDisconnected = null;
    this.onError = null;
    this.onSessionExpired = null;
    this.onStatusChange = null;
  }

  /**
   * Connects to the Cloudflare Worker WebSocket endpoint
   * @param {string} [workerUrl] 
   * @returns {Promise<void>}
   */
  connect(workerUrl = null) {
    if (workerUrl) {
      this.workerUrl = workerUrl;
    }
    if (!this.workerUrl) {
      throw new Error('SignalingClient: workerUrl must be provided to connect');
    }

    this.isManualClose = false;

    return new Promise((resolve, reject) => {
      // Normalize WebSocket protocol
      let url = this.workerUrl;
      if (url.startsWith('http://')) {
        url = 'ws://' + url.slice(7);
      } else if (url.startsWith('https://')) {
        url = 'wss://' + url.slice(8);
      } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${protocol}//${url}`;
      }

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        if (typeof this.onError === 'function') {
          this.onError(err);
        }
        return reject(err);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._startHeartbeat();

        if (typeof this.onStatusChange === 'function') {
          this.onStatusChange('connected');
        }

        resolve();
      };

      this.ws.onmessage = (event) => {
        this._handleIncomingMessage(event.data);
      };

      this.ws.onerror = (event) => {
        const err = new Error('Signaling WebSocket encountered an error');
        if (typeof this.onError === 'function') {
          this.onError(err);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this._stopHeartbeat();

        if (typeof this.onStatusChange === 'function') {
          this.onStatusChange('disconnected');
        }

        if (!this.isManualClose) {
          this._scheduleReconnect();
        }
      };
    });
  }

  /**
   * Starts periodic ping keepalives to prevent WebSocket timeout
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (_) {}
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Clears the heartbeat timer
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handles automatic reconnection with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      if (typeof this.onError === 'function') {
        this.onError(new Error('SignalingClient: Maximum reconnection attempts reached'));
      }
      return;
    }

    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      INITIAL_RECONNECT_DELAY_MS * Math.pow(1.6, this.reconnectAttempts)
    );

    this.reconnectAttempts++;
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange(`reconnecting in ${Math.round(delay / 1000)}s`);
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualClose && this.workerUrl) {
        this.connect(this.workerUrl)
          .then(() => {
            // Re-join existing session if one was active
            if (this.sessionId && this.displayName) {
              this.joinSession(this.sessionId, this.displayName).catch(() => {});
            }
          })
          .catch(() => {});
      }
    }, delay);
  }

  /**
   * Validates and processes incoming messages from the signaling server
   * @private
   * @param {string} rawData 
   */
  _handleIncomingMessage(rawData) {
    if (typeof rawData !== 'string') {
      // Discard unexpected binary data
      return;
    }

    if (rawData.length > MAX_SIGNALING_PAYLOAD_SIZE) {
      console.warn('SignalingClient: Received message exceeding size limit, dropped');
      return;
    }

    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (_) {
      console.warn('SignalingClient: Discarded invalid non-JSON payload');
      return;
    }

    if (!msg || typeof msg.type !== 'string') {
      return;
    }

    // Process recognized message types
    switch (msg.type) {
      case 'pong':
        // Heartbeat response acknowledged
        break;

      case 'session-created':
      case 'created': {
        this.sessionId = msg.sessionId || msg.id;
        this.joiningCode = msg.joiningCode || msg.code;

        if (this._pendingCreateResolve) {
          this._pendingCreateResolve({
            sessionId: this.sessionId,
            joiningCode: this.joiningCode
          });
          this._pendingCreateResolve = null;
          this._pendingCreateReject = null;
        }

        if (typeof this.onSessionCreated === 'function') {
          this.onSessionCreated({
            sessionId: this.sessionId,
            joiningCode: this.joiningCode
          });
        }
        break;
      }

      case 'joined': {
        if (msg.sessionId) this.sessionId = msg.sessionId;
        if (msg.peerName) this.peerDisplayName = msg.peerName;

        if (this._pendingJoinResolve) {
          this._pendingJoinResolve(msg);
          this._pendingJoinResolve = null;
          this._pendingJoinReject = null;
        }

        if (msg.peerName && typeof this.onPeerJoined === 'function') {
          this.onPeerJoined(msg.peerName);
        }
        break;
      }

      case 'peer-joined': {
        this.peerDisplayName = msg.peerName || msg.displayName || 'Anonymous Peer';
        if (typeof this.onPeerJoined === 'function') {
          this.onPeerJoined(this.peerDisplayName);
        }
        break;
      }

      case 'offer': {
        if (msg.sdp && typeof this.onOffer === 'function') {
          this.onOffer(msg.sdp, { peerName: msg.peerName || this.peerDisplayName });
        }
        break;
      }

      case 'answer': {
        if (msg.sdp && typeof this.onAnswer === 'function') {
          this.onAnswer(msg.sdp, { peerName: msg.peerName || this.peerDisplayName });
        }
        break;
      }

      case 'ice-candidate': {
        if (msg.candidate && typeof this.onIceCandidate === 'function') {
          this.onIceCandidate(msg.candidate);
        }
        break;
      }

      case 'peer-disconnected': {
        const peerName = msg.peerName || this.peerDisplayName || 'Remote Peer';
        this.peerDisplayName = null;
        if (typeof this.onPeerDisconnected === 'function') {
          this.onPeerDisconnected({ peerName });
        }
        break;
      }

      case 'session-expired':
      case 'expired': {
        if (typeof this.onSessionExpired === 'function') {
          this.onSessionExpired();
        }
        break;
      }

      case 'error': {
        const err = new Error(msg.message || 'Signaling server reported an error');
        if (this._pendingCreateReject) {
          this._pendingCreateReject(err);
          this._pendingCreateResolve = null;
          this._pendingCreateReject = null;
        }
        if (this._pendingJoinReject) {
          this._pendingJoinReject(err);
          this._pendingJoinResolve = null;
          this._pendingJoinReject = null;
        }
        if (typeof this.onError === 'function') {
          this.onError(err);
        }
        break;
      }

      default:
        // Pass arbitrary message to custom listeners if needed
        break;
    }
  }

  /**
   * Internal safe send with size and type checks
   * Ensures file contents are strictly NEVER relayed over signaling
   * @private
   * @param {Object} payload 
   */
  _send(payload) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('SignalingClient: WebSocket is not connected');
    }

    // Safety checks against leaking file chunks through signaling
    if (payload.chunk || payload.data instanceof ArrayBuffer || payload.data instanceof Uint8Array) {
      throw new Error('SignalingClient: File data transmission over signaling is strictly forbidden');
    }

    const json = JSON.stringify(payload);
    if (json.length > MAX_SIGNALING_PAYLOAD_SIZE) {
      throw new Error(`SignalingClient: Payload size exceeds limit (${json.length} bytes)`);
    }

    this.ws.send(json);
  }

  /**
   * Creates a new sharing session on the signaling worker
   * @param {string} displayName 
   * @returns {Promise<{ sessionId: string, joiningCode: string }>}
   */
  createSession(displayName = 'Sender') {
    this.displayName = displayName;

    return new Promise((resolve, reject) => {
      this._pendingCreateResolve = resolve;
      this._pendingCreateReject = reject;

      try {
        this._send({
          type: 'create-session',
          displayName: this.displayName,
          timestamp: Date.now()
        });
      } catch (err) {
        this._pendingCreateResolve = null;
        this._pendingCreateReject = null;
        reject(err);
      }
    });
  }

  /**
   * Joins an existing sharing session using a session ID or 6-character code
   * @param {string} sessionIdOrJoiningCode 
   * @param {string} displayName 
   * @returns {Promise<Object>}
   */
  joinSession(sessionIdOrJoiningCode, displayName = 'Receiver') {
    if (!sessionIdOrJoiningCode) {
      return Promise.reject(new Error('SignalingClient: Missing sessionId or joiningCode'));
    }

    this.displayName = displayName;

    return new Promise((resolve, reject) => {
      this._pendingJoinResolve = resolve;
      this._pendingJoinReject = reject;

      try {
        this._send({
          type: 'join-session',
          sessionId: sessionIdOrJoiningCode,
          displayName: this.displayName,
          timestamp: Date.now()
        });
      } catch (err) {
        this._pendingJoinResolve = null;
        this._pendingJoinReject = null;
        reject(err);
      }
    });
  }

  /**
   * Relays an SDP offer to the connected peer
   * @param {RTCSessionDescriptionInit} sdp 
   */
  sendOffer(sdp) {
    this._send({
      type: 'offer',
      sessionId: this.sessionId,
      peerName: this.displayName,
      sdp: sdp
    });
  }

  /**
   * Relays an SDP answer to the connected peer
   * @param {RTCSessionDescriptionInit} sdp 
   */
  sendAnswer(sdp) {
    this._send({
      type: 'answer',
      sessionId: this.sessionId,
      peerName: this.displayName,
      sdp: sdp
    });
  }

  /**
   * Relays an ICE candidate to the connected peer
   * @param {RTCIceCandidateInit|RTCIceCandidate} candidate 
   */
  sendIceCandidate(candidate) {
    this._send({
      type: 'ice-candidate',
      sessionId: this.sessionId,
      candidate: candidate
    });
  }

  /**
   * Sends an arbitrary lightweight control message over signaling
   * @param {string} type 
   * @param {Object} data 
   */
  sendMessage(type, data = {}) {
    this._send({
      type: 'custom-message',
      subType: type,
      sessionId: this.sessionId,
      sender: this.displayName,
      data: data
    });
  }

  /**
   * Disconnects and cleans up resources
   */
  disconnect() {
    this.isManualClose = true;
    clearTimeout(this.reconnectTimer);
    this._stopHeartbeat();

    if (this.ws) {
      try {
        if (this.sessionId) {
          this._send({ type: 'leave-session', sessionId: this.sessionId });
        }
      } catch (_) {}

      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.joiningCode = null;
    this.peerDisplayName = null;
  }
}
