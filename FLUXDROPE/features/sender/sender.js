/**
 * FLUXDROPE - Sender Workflow Controller
 * Manages session creation, file selection, WebRTC DataChannel negotiation,
 * authenticated AES-GCM chunk streaming, and transfer lifecycle events.
 *
 * Created By Shiv Yogi
 */

import { SecureShare } from '../secure-share/secure-share.js';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const BUFFER_HIGH_WATERMARK = 4 * 1024 * 1024; // 4 MB backpressure threshold
const BUFFER_LOW_WATERMARK = 1 * 1024 * 1024;  // 1 MB resume threshold

export class SenderController {
  constructor(options = {}) {
    this.options = {
      signalingUrl: 'https://fluxdrope-signaling.workers.dev',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      senderName: 'Sender Peer',
      ...options
    };

    // Session State
    this.sessionId = null;
    this.joiningCode = null;
    this.expiresAt = null;
    this.password = null;
    this.salt = null;

    // Files state
    this.selectedFiles = []; // Array of File objects
    this.fileMetadata = []; // Array of metadata objects
    this.totalBytes = 0;
    this.isTransferring = false;
    this.isCancelled = false;

    // Network & Crypto State
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.ecdhKeyPair = null;
    this.peerPublicKey = null;
    this.encryptionKey = null;

    // Event handlers map
    this.eventListeners = {
      onSessionCreated: [],
      onReceiverJoined: [],
      onTransferProgress: [],
      onTransferComplete: [],
      onTransferFailed: [],
      onCancelled: []
    };

    // Receiver state
    this.receiverName = null;
    this.receiverJoined = false;
  }

  /**
   * Initialize sender controller with options
   */
  async init(options = {}) {
    this.options = { ...this.options, ...options };
    this.salt = SecureShare.generateSalt(16);

    // Generate ECDH P-256 keypair for this session
    try {
      this.ecdhKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits', 'deriveKey']
      );
    } catch (err) {
      console.warn('[SenderController] ECDH generation fallback:', err);
    }

    return this;
  }

  /**
   * Subscribe to lifecycle events
   * @param {string} event - Event name
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
    return this;
  }

  /**
   * Emit lifecycle event
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error in ${event} callback:`, e); }
      });
    }
  }

  /**
   * Select files for transfer, calculate total size and hashes
   * @param {FileList|File[]} fileList
   */
  async selectFiles(fileList) {
    this.selectedFiles = Array.from(fileList || []);
    this.totalBytes = 0;
    this.fileMetadata = [];

    for (let i = 0; i < this.selectedFiles.length; i++) {
      const file = this.selectedFiles[i];
      this.totalBytes += file.size;

      // Calculate initial metadata
      this.fileMetadata.push({
        id: `file_${i}_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        hash: null // Pre-computed or calculated during streaming
      });
    }

    return {
      count: this.selectedFiles.length,
      totalBytes: this.totalBytes,
      files: this.fileMetadata
    };
  }

  /**
   * Set transfer password for recipient validation
   * @param {string} password
   */
  setPassword(password) {
    this.password = password ? String(password).trim() : null;
  }

  /**
   * Create transfer session via Cloudflare Worker
   */
  async createSession(options = {}) {
    if (options) this.options = { ...this.options, ...options };

    const signalingUrl = this.options.signalingUrl.replace(/\/+$/, '');
    const res = await fetch(`${signalingUrl}/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName: this.options.senderName
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to create session on signaling server: ${res.statusText}`);
    }

    const data = await res.json();
    this.sessionId = data.sessionId;
    this.joiningCode = data.joiningCode;
    this.expiresAt = data.expiresAt;

    // Connect to signaling WebSocket
    await this.connectSignaling();

    // Prepare QR code sharing payload
    const qrData = JSON.stringify({
      app: 'FLUXDROPE',
      v: '1.0',
      sessionId: this.sessionId,
      code: this.joiningCode,
      salt: SecureShare.toBase64(this.salt),
      hasPassword: !!this.password
    });

    this.emit('onSessionCreated', {
      sessionId: this.sessionId,
      joiningCode: this.joiningCode,
      qrData,
      expiresAt: this.expiresAt,
      ttlSeconds: data.ttlSeconds
    });

    return {
      sessionId: this.sessionId,
      joiningCode: this.joiningCode,
      qrData,
      expiresAt: this.expiresAt
    };
  }

  /**
   * Connect to signaling WebSocket endpoint
   */
  async connectSignaling() {
    return new Promise((resolve, reject) => {
      const signalingUrl = this.options.signalingUrl.replace(/\/+$/, '');
      const wsProtocol = signalingUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = signalingUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${host}/session/${this.sessionId}/join?role=sender&name=${encodeURIComponent(this.options.senderName)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        // Export public ECDH key for key exchange
        let senderPublicKey = null;
        if (this.ecdhKeyPair) {
          const rawKey = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
          senderPublicKey = SecureShare.toBase64(rawKey);
        }

        // Send registration message with file metadata summary (NO FILE DATA)
        this.sendSignalingMessage({
          type: 'register-sender',
          name: this.options.senderName,
          senderPublicKey,
          fileMetadata: {
            totalFiles: this.selectedFiles.length,
            totalBytes: this.totalBytes,
            files: this.fileMetadata
          }
        });

        resolve();
      };

      this.ws.onerror = (err) => {
        reject(new Error(`Signaling WebSocket connection failed: ${err.message || 'unknown'}`));
      };

      this.ws.onmessage = (event) => {
        this.handleSignalingMessage(event.data);
      };

      this.ws.onclose = () => {
        // Disconnected from signaling
      };
    });
  }

  /**
   * Send message to signaling server
   */
  sendSignalingMessage(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Handle incoming messages from signaling server
   */
  async handleSignalingMessage(rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'peer-joined': {
        if (msg.role === 'receiver') {
          this.receiverName = msg.name || 'Receiver Peer';
          this.receiverJoined = true;
          this.emit('onReceiverJoined', {
            name: this.receiverName
          });
        }
        break;
      }

      case 'answer': {
        if (this.peerConnection && msg.sdp) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: msg.sdp
          }));

          if (msg.receiverPublicKey) {
            await this.finalizeKeyAgreement(msg.receiverPublicKey);
          }
        }
        break;
      }

      case 'ice-candidate': {
        if (this.peerConnection && msg.candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('[SenderController] ICE candidate add error:', e);
          }
        }
        break;
      }

      case 'peer-info': {
        if (msg.info?.receiverPublicKey) {
          await this.finalizeKeyAgreement(msg.info.receiverPublicKey);
        }
        break;
      }

      case 'peer-left': {
        this.cancelTransfer(`Receiver disconnected: ${msg.reason || 'Normal closure'}`);
        break;
      }

      case 'session-expired': {
        this.emit('onCancelled', { reason: 'Session expired after 30 minutes.' });
        this.teardown();
        break;
      }
    }
  }

  /**
   * Wait for receiver to join session
   */
  async waitForReceiver() {
    if (this.receiverJoined) {
      return { name: this.receiverName };
    }

    return new Promise((resolve) => {
      const handler = (data) => {
        resolve(data);
      };
      this.on('onReceiverJoined', handler);
    });
  }

  /**
   * Approve transfer and initiate WebRTC PeerConnection & DataChannel
   * @param {string} receiverName
   */
  async approveTransfer(receiverName = null) {
    if (receiverName) this.receiverName = receiverName;

    // Create RTCPeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.options.iceServers
    });

    // Create reliable, ordered DataChannel for transfer
    this.dataChannel = this.peerConnection.createDataChannel('fluxdrope-data', {
      ordered: true
    });
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = async () => {
      // Send auth verification token if password is set
      if (this.password && this.encryptionKey) {
        const token = await SecureShare.createVerificationToken(this.encryptionKey);
        this.dataChannel.send(JSON.stringify({
          type: 'auth-challenge',
          salt: SecureShare.toBase64(this.salt),
          verificationToken: token
        }));
      }

      // Automatically start transfer once channel is open
      this.startTransfer();
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onerror = (err) => {
      this.emit('onTransferFailed', { error: `DataChannel error: ${err.message || 'unknown'}` });
    };

    this.dataChannel.onclose = () => {
      if (!this.isTransferring && !this.isCancelled) {
        // Closed cleanly after completion
      }
    };

    // Forward local ICE candidates to receiver
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Create WebRTC Offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    let senderPublicKey = null;
    if (this.ecdhKeyPair) {
      const rawKey = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
      senderPublicKey = SecureShare.toBase64(rawKey);
    }

    // Send offer through signaling server
    this.sendSignalingMessage({
      type: 'offer',
      sdp: offer.sdp,
      senderPublicKey
    });
  }

  /**
   * Handle incoming messages on the WebRTC DataChannel
   */
  handleDataChannelMessage(data) {
    if (typeof data !== 'string') return;
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'auth-failed') {
        this.emit('onTransferFailed', { error: 'Receiver failed password verification' });
        this.cancelTransfer('Authentication failed');
      } else if (msg.type === 'cancel') {
        this.cancelTransfer(msg.reason || 'Receiver cancelled transfer');
      }
    } catch {}
  }

  /**
   * Finalize ECDH agreement + Password derivation
   */
  async finalizeKeyAgreement(receiverPublicKeyBase64) {
    try {
      const receiverRaw = SecureShare.fromBase64(receiverPublicKeyBase64);
      const receiverKey = await crypto.subtle.importKey(
        'raw',
        receiverRaw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      // Derive ECDH shared bits
      const ecdhBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: receiverKey },
        this.ecdhKeyPair.privateKey,
        256
      );

      // Derive final session AES-GCM key combining ECDH and optional Password
      this.encryptionKey = await SecureShare.deriveKey(this.password, this.salt, ecdhBits);
    } catch (err) {
      console.warn('[SenderController] Key agreement error, falling back to direct key:', err);
      this.encryptionKey = await SecureShare.deriveKey(this.password, this.salt, null);
    }
  }

  /**
   * Start streaming encrypted files to receiver
   */
  async startTransfer() {
    if (this.isTransferring || this.selectedFiles.length === 0) return;
    this.isTransferring = true;
    this.isCancelled = false;

    const startTime = Date.now();
    let totalBytesSent = 0;
    let lastProgressTime = startTime;
    let lastBytesSent = 0;
    let currentSpeed = 0; // bytes/second

    try {
      // If encryption key hasn't been set yet (no ECDH exchange), derive from password/salt
      if (!this.encryptionKey) {
        this.encryptionKey = await SecureShare.deriveKey(this.password, this.salt, null);
      }

      // Step 1: Send File Metadata Packet First
      this.dataChannel.send(JSON.stringify({
        type: 'transfer-metadata',
        salt: SecureShare.toBase64(this.salt),
        hasPassword: !!this.password,
        totalFiles: this.selectedFiles.length,
        totalBytes: this.totalBytes,
        files: this.fileMetadata
      }));

      // Step 2: Iterate through each file and stream encrypted chunks
      for (let fileIdx = 0; fileIdx < this.selectedFiles.length; fileIdx++) {
        if (this.isCancelled) break;

        const file = this.selectedFiles[fileIdx];
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

        // Hash accumulator for end-to-end integrity
        const hashSubtle = crypto.subtle.digest ? true : false;
        let fileFullBuffer = null;
        if (file.size < 100 * 1024 * 1024) { // Buffer small-to-medium files for full SHA-256
          fileFullBuffer = await file.arrayBuffer();
          const fileHashHex = await SecureShare.computeSha256(fileFullBuffer);
          this.fileMetadata[fileIdx].hash = fileHashHex;
        }

        // Notify file transfer starting
        this.dataChannel.send(JSON.stringify({
          type: 'file-start',
          fileIndex: fileIdx,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          totalChunks,
          hash: this.fileMetadata[fileIdx].hash
        }));

        let offset = 0;
        let chunkIndex = 0;

        while (offset < file.size) {
          if (this.isCancelled) break;

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const rawChunkBuffer = await slice.arrayBuffer();

          // Encrypt chunk using AES-GCM-256
          const { ciphertext, iv } = await SecureShare.encryptChunk(rawChunkBuffer, this.encryptionKey);

          // Flow control: wait for DataChannel buffer to drain if high watermark reached
          await this.waitForBufferDrain();

          // Send chunk header packet
          this.dataChannel.send(JSON.stringify({
            type: 'chunk-header',
            fileIndex: fileIdx,
            chunkIndex,
            totalChunks,
            iv: SecureShare.toBase64(iv),
            cipherSize: ciphertext.byteLength
          }));

          // Send raw binary encrypted chunk
          await this.waitForBufferDrain();
          this.dataChannel.send(ciphertext);

          offset += rawChunkBuffer.byteLength;
          totalBytesSent += rawChunkBuffer.byteLength;
          chunkIndex++;

          // Speed & ETA calculation
          const now = Date.now();
          const timeDelta = (now - lastProgressTime) / 1000;
          if (timeDelta >= 0.25 || offset >= file.size) {
            const bytesDelta = totalBytesSent - lastBytesSent;
            currentSpeed = timeDelta > 0 ? (bytesDelta / timeDelta) : currentSpeed;
            lastBytesSent = totalBytesSent;
            lastProgressTime = now;

            const percent = Math.min(100, Math.round((totalBytesSent / (this.totalBytes || 1)) * 100));
            const remainingBytes = Math.max(0, this.totalBytes - totalBytesSent);
            const eta = currentSpeed > 0 ? Math.ceil(remainingBytes / currentSpeed) : 0;

            this.emit('onTransferProgress', {
              fileIndex: fileIdx,
              fileName: file.name,
              bytesSent: totalBytesSent,
              totalBytes: this.totalBytes,
              percent,
              speed: Math.round(currentSpeed),
              eta
            });
          }
        }

        // Send file complete notice
        this.dataChannel.send(JSON.stringify({
          type: 'file-complete',
          fileIndex: fileIdx,
          hash: this.fileMetadata[fileIdx].hash
        }));
      }

      if (!this.isCancelled) {
        // Send all complete notification
        this.dataChannel.send(JSON.stringify({
          type: 'all-complete',
          totalFiles: this.selectedFiles.length,
          totalBytes: this.totalBytes
        }));

        const totalDuration = (Date.now() - startTime) / 1000;
        this.emit('onTransferComplete', {
          totalFiles: this.selectedFiles.length,
          totalBytes: this.totalBytes,
          duration: totalDuration
        });
      }

    } catch (err) {
      this.emit('onTransferFailed', { error: err.message || 'Transfer failed' });
    } finally {
      this.isTransferring = false;
    }
  }

  /**
   * Backpressure helper: pause sending if WebRTC DataChannel buffer is full
   */
  async waitForBufferDrain() {
    if (!this.dataChannel) return;
    if (this.dataChannel.bufferedAmount > BUFFER_HIGH_WATERMARK) {
      return new Promise((resolve) => {
        this.dataChannel.bufferedAmountLowThreshold = BUFFER_LOW_WATERMARK;
        const onLow = () => {
          this.dataChannel.removeEventListener('bufferedamountlow', onLow);
          resolve();
        };
        this.dataChannel.addEventListener('bufferedamountlow', onLow);
      });
    }
  }

  /**
   * Cancel transfer session
   * @param {string} reason
   */
  cancelTransfer(reason = 'Cancelled by sender') {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.isTransferring = false;

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'cancel', reason }));
      } catch {}
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'cancel', reason }));
      } catch {}
    }

    this.emit('onCancelled', { reason });
    this.teardown();
  }

  /**
   * Clean up connections and memory
   */
  teardown() {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.SenderController = SenderController;
}

export default SenderController;
