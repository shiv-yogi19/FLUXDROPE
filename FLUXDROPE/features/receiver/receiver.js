/**
 * FLUXDROPE - Receiver Workflow Controller
 * Manages session discovery by URL or short-lived code, WebRTC negotiation,
 * password authentication, chunk decryption, integrity validation (SHA-256),
 * and automatic FLUXDROPE signature file saving.
 *
 * Signature download format: {name}_FLUXDROPE_Created_By_Shiv_Yogi.{ext}
 *
 * Created By Shiv Yogi
 */

import { SecureShare } from '../secure-share/secure-share.js';

export class ReceiverController {
  constructor(options = {}) {
    this.options = {
      signalingUrl: 'https://fluxdrope-signaling.workers.dev',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      receiverName: 'Receiver Peer',
      autoDownload: true,
      ...options
    };

    // Session State
    this.sessionId = null;
    this.joiningCode = null;
    this.senderName = null;
    this.password = null;
    this.salt = null;

    // Files State
    this.incomingMetadata = null; // { totalFiles, totalBytes, files: [...] }
    this.currentFileIndex = -1;
    this.currentFile = null;
    this.currentFileChunks = [];
    this.currentExpectedIv = null;
    this.receivedFiles = []; // { name, originalName, blob, size, type, hash, verified }
    this.totalBytesExpected = 0;
    this.totalBytesReceived = 0;
    this.isTransferring = false;
    this.isCancelled = false;

    // Network & Crypto State
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.ecdhKeyPair = null;
    this.senderPublicKey = null;
    this.decryptionKey = null;

    // Progress metrics
    this.startTime = null;
    this.lastProgressTime = null;
    this.lastBytesReceived = 0;
    this.currentSpeed = 0;

    // Event listeners
    this.eventListeners = {
      onSenderInfo: [],
      onTransferProgress: [],
      onTransferComplete: [],
      onTransferFailed: [],
      onInvalidPassword: [],
      onCancelled: []
    };
  }

  /**
   * Initialize receiver controller
   */
  async init(options = {}) {
    this.options = { ...this.options, ...options };

    // Generate ephemeral ECDH P-256 key pair
    try {
      this.ecdhKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits', 'deriveKey']
      );
    } catch (err) {
      console.warn('[ReceiverController] ECDH key generation warning:', err);
    }

    return this;
  }

  /**
   * Subscribe to lifecycle events
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
    return this;
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error in ${event} callback:`, e); }
      });
    }
  }

  /**
   * Set user password for password-protected transfers
   * @param {string} password
   */
  setPassword(password) {
    this.password = password ? String(password).trim() : null;
  }

  /**
   * Join session via full URL or sessionId parameter
   * @param {string} rawUrl
   */
  async joinByUrl(rawUrl) {
    let sessionId = null;
    let code = null;

    try {
      const url = new URL(rawUrl, window.location.href);
      sessionId = url.searchParams.get('session') || url.searchParams.get('sessionId');
      code = url.searchParams.get('code');

      // Check hash params e.g. #join/sessionId or #FLX-XXXX-XXXX
      if (!sessionId && !code && url.hash) {
        const hash = url.hash.replace(/^#/, '');
        if (hash.startsWith('FLX-')) {
          code = hash;
        } else if (hash.includes('/')) {
          const parts = hash.split('/');
          sessionId = parts[parts.length - 1];
        }
      }
    } catch {
      // If rawUrl is just a sessionId or code directly
      if (rawUrl.startsWith('FLX-')) {
        code = rawUrl;
      } else {
        sessionId = rawUrl;
      }
    }

    if (code) {
      return this.joinByCode(code);
    }

    if (!sessionId) {
      throw new Error('Could not extract a valid session ID or joining code from the provided URL.');
    }

    this.sessionId = sessionId;
    return this.connectSession();
  }

  /**
   * Join session by 8-character joining code (FLX-XXXX-XXXX)
   * @param {string} code
   */
  async joinByCode(code) {
    const formattedCode = String(code).trim().toUpperCase();
    this.joiningCode = formattedCode;

    const signalingUrl = this.options.signalingUrl.replace(/\/+$/, '');
    const res = await fetch(`${signalingUrl}/session/${encodeURIComponent(formattedCode)}/join-by-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Invalid or expired joining code (${res.status})`);
    }

    const data = await res.json();
    this.sessionId = data.sessionId;
    if (data.senderName) this.senderName = data.senderName;

    return this.connectSession();
  }

  /**
   * Establish connection to signaling WebSocket
   */
  async connectSession() {
    return new Promise((resolve, reject) => {
      const signalingUrl = this.options.signalingUrl.replace(/\/+$/, '');
      const wsProtocol = signalingUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = signalingUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${host}/session/${this.sessionId}/join?role=receiver&name=${encodeURIComponent(this.options.receiverName)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        let receiverPublicKey = null;
        if (this.ecdhKeyPair) {
          const rawKey = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
          receiverPublicKey = SecureShare.toBase64(rawKey);
        }

        this.sendSignalingMessage({
          type: 'register-receiver',
          name: this.options.receiverName,
          receiverPublicKey
        });

        resolve({ sessionId: this.sessionId });
      };

      this.ws.onerror = (err) => {
        reject(new Error(`Signaling WebSocket error: ${err.message || 'unknown'}`));
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
        if (msg.role === 'sender') {
          this.senderName = msg.name || 'Sender Peer';
          if (msg.fileMetadata) {
            this.handleMetadataReceived(msg.fileMetadata);
          }
        }
        break;
      }

      case 'offer': {
        await this.handleOfferReceived(msg);
        break;
      }

      case 'ice-candidate': {
        if (this.peerConnection && msg.candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('[ReceiverController] ICE Candidate error:', e);
          }
        }
        break;
      }

      case 'peer-info': {
        if (msg.info?.senderPublicKey) {
          await this.finalizeKeyAgreement(msg.info.senderPublicKey);
        }
        break;
      }

      case 'peer-left': {
        this.cancelTransfer(`Sender disconnected: ${msg.reason || 'Normal closure'}`);
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
   * Handle incoming WebRTC offer from sender
   */
  async handleOfferReceived(msg) {
    this.senderPublicKey = msg.senderPublicKey;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.options.iceServers
    });

    // Listen for sender's DataChannel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this.setupDataChannelListeners();
    };

    // Forward local ICE candidates to sender
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: msg.sdp
    }));

    if (this.senderPublicKey) {
      await this.finalizeKeyAgreement(this.senderPublicKey);
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    let receiverPublicKey = null;
    if (this.ecdhKeyPair) {
      const rawKey = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
      receiverPublicKey = SecureShare.toBase64(rawKey);
    }

    this.sendSignalingMessage({
      type: 'answer',
      sdp: answer.sdp,
      receiverPublicKey
    });
  }

  /**
   * Finalize ECDH key agreement with sender
   */
  async finalizeKeyAgreement(senderPublicKeyBase64) {
    try {
      const senderRaw = SecureShare.fromBase64(senderPublicKeyBase64);
      const senderKey = await crypto.subtle.importKey(
        'raw',
        senderRaw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      const ecdhBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: senderKey },
        this.ecdhKeyPair.privateKey,
        256
      );

      this.decryptionKey = await SecureShare.deriveKey(this.password, this.salt, ecdhBits);
    } catch (err) {
      console.warn('[ReceiverController] Key agreement error, falling back to direct key:', err);
      this.decryptionKey = await SecureShare.deriveKey(this.password, this.salt, null);
    }
  }

  /**
   * Wire up DataChannel event listeners
   */
  setupDataChannelListeners() {
    this.dataChannel.onopen = () => {
      this.startTime = Date.now();
      this.lastProgressTime = this.startTime;
      this.lastBytesReceived = 0;
      this.isTransferring = true;
    };

    this.dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        await this.handleDataChannelControlMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        await this.handleEncryptedBinaryChunk(event.data);
      }
    };

    this.dataChannel.onerror = (err) => {
      this.emit('onTransferFailed', { error: `DataChannel error: ${err.message || 'unknown'}` });
    };

    this.dataChannel.onclose = () => {
      if (this.isTransferring && !this.isCancelled) {
        // Transfer closed prematurely
      }
    };
  }

  /**
   * Handle JSON control messages on DataChannel
   */
  async handleDataChannelControlMessage(jsonString) {
    let msg;
    try {
      msg = JSON.parse(jsonString);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'auth-challenge': {
        this.salt = SecureShare.fromBase64(msg.salt);
        // Re-derive key with salt
        if (this.senderPublicKey && this.ecdhKeyPair) {
          await this.finalizeKeyAgreement(this.senderPublicKey);
        } else {
          this.decryptionKey = await SecureShare.deriveKey(this.password, this.salt, null);
        }

        const isValid = await SecureShare.verifyPassword(this.decryptionKey, msg.verificationToken);
        if (!isValid) {
          this.emit('onInvalidPassword');
          this.dataChannel.send(JSON.stringify({ type: 'auth-failed' }));
          this.cancelTransfer('Authentication failed: Invalid Password');
        }
        break;
      }

      case 'transfer-metadata': {
        this.handleMetadataReceived(msg);
        break;
      }

      case 'file-start': {
        this.currentFileIndex = msg.fileIndex;
        this.currentFile = {
          name: this.sanitizeFilename(msg.fileName),
          originalName: msg.fileName,
          size: msg.fileSize,
          type: msg.fileType || 'application/octet-stream',
          totalChunks: msg.totalChunks,
          expectedHash: msg.hash || null
        };
        this.currentFileChunks = [];
        break;
      }

      case 'chunk-header': {
        this.currentExpectedIv = SecureShare.fromBase64(msg.iv);
        break;
      }

      case 'file-complete': {
        await this.assembleAndSaveCurrentFile(msg.hash);
        break;
      }

      case 'all-complete': {
        const duration = (Date.now() - (this.startTime || Date.now())) / 1000;
        this.isTransferring = false;
        this.emit('onTransferComplete', {
          files: this.receivedFiles,
          totalBytes: this.totalBytesReceived,
          duration
        });
        break;
      }

      case 'cancel': {
        this.cancelTransfer(msg.reason || 'Sender cancelled transfer');
        break;
      }
    }
  }

  /**
   * Handle received encrypted chunk payload
   * @param {ArrayBuffer} cipherBuffer
   */
  async handleEncryptedBinaryChunk(cipherBuffer) {
    if (!this.decryptionKey) {
      this.decryptionKey = await SecureShare.deriveKey(this.password, this.salt, null);
    }

    try {
      const decrypted = await SecureShare.decryptChunk(
        cipherBuffer,
        this.decryptionKey,
        this.currentExpectedIv
      );

      this.currentFileChunks.push(decrypted);
      this.totalBytesReceived += decrypted.byteLength;

      // Calculate progress, speed, ETA
      const now = Date.now();
      const timeDelta = (now - this.lastProgressTime) / 1000;
      if (timeDelta >= 0.25 || this.totalBytesReceived >= this.totalBytesExpected) {
        const bytesDelta = this.totalBytesReceived - this.lastBytesReceived;
        this.currentSpeed = timeDelta > 0 ? (bytesDelta / timeDelta) : this.currentSpeed;
        this.lastBytesReceived = this.totalBytesReceived;
        this.lastProgressTime = now;

        const percent = Math.min(100, Math.round((this.totalBytesReceived / (this.totalBytesExpected || 1)) * 100));
        const remainingBytes = Math.max(0, this.totalBytesExpected - this.totalBytesReceived);
        const eta = this.currentSpeed > 0 ? Math.ceil(remainingBytes / this.currentSpeed) : 0;

        this.emit('onTransferProgress', {
          fileIndex: this.currentFileIndex,
          fileName: this.currentFile?.name || '',
          bytesReceived: this.totalBytesReceived,
          totalBytes: this.totalBytesExpected,
          percent,
          speed: Math.round(this.currentSpeed),
          eta
        });
      }
    } catch (err) {
      this.emit('onTransferFailed', {
        error: `Decryption failed for chunk in file: ${this.currentFile?.name || 'unknown'} (${err.message})`,
        fileIndex: this.currentFileIndex
      });
    }
  }

  /**
   * Process and validate incoming file metadata
   */
  handleMetadataReceived(metadata) {
    const rawFiles = Array.isArray(metadata.files) ? metadata.files : [];
    const sanitizedFiles = rawFiles.map((file, idx) => ({
      id: file.id || `f_${idx}`,
      name: this.sanitizeFilename(file.name),
      originalName: file.name,
      size: Math.max(0, Number(file.size) || 0),
      type: String(file.type || 'application/octet-stream').slice(0, 100),
      hash: file.hash || null
    }));

    this.incomingMetadata = {
      totalFiles: sanitizedFiles.length,
      totalBytes: sanitizedFiles.reduce((acc, f) => acc + f.size, 0),
      files: sanitizedFiles
    };

    this.totalBytesExpected = this.incomingMetadata.totalBytes;

    this.emit('onSenderInfo', {
      name: this.senderName || 'Sender Peer',
      files: this.incomingMetadata.files,
      totalSize: this.incomingMetadata.totalBytes
    });
  }

  /**
   * Sanitize filenames to protect client OS filesystem
   * Removes path traversals (../, ..\), control characters, slashes.
   */
  sanitizeFilename(rawName) {
    if (!rawName || typeof rawName !== 'string') return 'unnamed_file';
    let clean = rawName
      .replace(/[/\\?%*:|"<>]/g, '_')   // Remove illegal OS characters
      .replace(/\.\.+/g, '.')           // Disallow directory traversal (..)
      .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control characters
      .trim();

    if (!clean || clean === '.') clean = 'unnamed_file';
    return clean.slice(0, 200);
  }

  /**
   * Format download filename to signature:
   * {name}_FLUXDROPE_Created_By_Shiv_Yogi.{ext}
   */
  formatSignatureFilename(filename) {
    const sanitized = this.sanitizeFilename(filename);
    const lastDotIndex = sanitized.lastIndexOf('.');

    if (lastDotIndex > 0) {
      const baseName = sanitized.substring(0, lastDotIndex);
      const ext = sanitized.substring(lastDotIndex + 1);
      return `${baseName}_FLUXDROPE_Created_By_Shiv_Yogi.${ext}`;
    }

    return `${sanitized}_FLUXDROPE_Created_By_Shiv_Yogi`;
  }

  /**
   * Assemble decrypted chunks, verify SHA-256 integrity, trigger signature download
   */
  async assembleAndSaveCurrentFile(senderReportedHash = null) {
    if (!this.currentFile || this.currentFileChunks.length === 0) return;

    const fileBlob = new Blob(this.currentFileChunks, { type: this.currentFile.type });
    const arrayBuffer = await fileBlob.arrayBuffer();
    const calculatedHash = await SecureShare.computeSha256(arrayBuffer);

    const expectedHash = senderReportedHash || this.currentFile.expectedHash;
    let verified = true;
    if (expectedHash && expectedHash !== calculatedHash) {
      verified = false;
      console.warn(`[ReceiverController] Hash verification mismatch for ${this.currentFile.name}! Expected ${expectedHash}, computed ${calculatedHash}`);
    }

    const signatureName = this.formatSignatureFilename(this.currentFile.name);
    const fileEntry = {
      name: signatureName,
      originalName: this.currentFile.originalName,
      size: fileBlob.size,
      type: this.currentFile.type,
      blob: fileBlob,
      hash: calculatedHash,
      verified
    };

    this.receivedFiles.push(fileEntry);

    // Automatic download if enabled in browser environment
    if (this.options.autoDownload && typeof document !== 'undefined') {
      this.triggerDownload(fileBlob, signatureName);
    }

    // Reset current file buffer
    this.currentFileChunks = [];
    this.currentFile = null;
  }

  /**
   * Trigger native browser file download via Blob URL
   */
  triggerDownload(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = url;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();

      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 15000);
    } catch (err) {
      console.error('[ReceiverController] Download trigger error:', err);
    }
  }

  /**
   * Explicitly accept incoming transfer
   */
  acceptTransfer() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'transfer-accepted' }));
    }
  }

  /**
   * Explicitly reject incoming transfer
   */
  rejectTransfer(reason = 'Receiver declined transfer') {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'transfer-rejected', reason }));
      } catch {}
    }
    this.cancelTransfer(reason);
  }

  /**
   * Cancel transfer session
   */
  cancelTransfer(reason = 'Cancelled by receiver') {
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
   * Tear down all network connections and free memory
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
  window.ReceiverController = ReceiverController;
}

export default ReceiverController;
