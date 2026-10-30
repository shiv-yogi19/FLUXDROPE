/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: app.js
 * Author: Shiv Yogi
 * 
 * Main Application Engine and Master Orchestrator.
 * Wires together:
 * - Encryption Engine (Web Crypto ECDH + HKDF + PBKDF2 + AES-GCM-256)
 * - WebRTC Data Channels (Backpressure, STUN, Direct vs Relay)
 * - Signaling Client (Cloudflare Worker WebSocket)
 * - File Manager & Stream Receiver (Streaming, Sanitization, Branded Download)
 * - QR Manager (15 templates, Canvas 2D, SVG, Share, Fullscreen)
 * - Settings Manager (Local storage, Themes, Layouts)
 * - Router (Hash-based SPA, Dynamic params, 404 handler)
 */

import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  derivePasswordKey,
  combineKeys,
  encryptChunk,
  decryptChunk,
  hashFile,
  clearKey
} from './encryption.js';

import { WebRTCManager, CHUNK_SIZE } from './webrtc.js';
import { SignalingClient } from './signaling.js';
import { FileManager, StreamReceiver } from './file-manager.js';
import { QRManager, QR_TEMPLATES } from './qr-manager.js';
import { SettingsManager } from './settings.js';
import { Router } from './router.js';

// Animation & Transition Modules
import { IntroAnimation } from '../animations/intro/intro.js';
import { SendingAnimationManager } from '../animations/sending/sending-animations.js';
import { ReceivingAnimationManager } from '../animations/receiving/receiving-animations.js';
import { TransitionManager } from '../animations/transitions/transitions.js';

// Feature Controllers
import { SenderController } from '../features/sender/sender.js';
import { ReceiverController } from '../features/receiver/receiver.js';
import { ExpiredSessionController } from '../features/expired-session/expired-session.js';

/**
 * Core Application State Machine
 */
export const APP_STATES = Object.freeze({
  INTRO: 'INTRO',
  WELCOME: 'WELCOME',
  DASHBOARD: 'DASHBOARD',
  SEND_SETUP: 'SEND_SETUP',
  WAITING: 'WAITING',
  TRANSFERRING: 'TRANSFERRING',
  DONE: 'DONE'
});

export class FluxApp {
  constructor() {
    // Subsystem Instantiation
    this.settings = new SettingsManager();
    this.fileManager = new FileManager();
    this.qrManager = new QRManager();
    this.router = new Router();
    this.signaling = new SignalingClient();
    this.webrtc = null;

    // Cryptographic Session State
    this.localKeyPair = null;
    this.localPublicKeyBase64 = null;
    this.remotePublicKey = null;
    this.sharedEncryptionKey = null;
    this.sessionPassword = null;
    this.sessionSalt = null;

    // Transfer Orchestration
    this.currentState = APP_STATES.INTRO;
    this.isSender = false;
    this.activeSessionId = null;
    this.activeJoiningCode = null;
    this.peerDisplayName = null;
    this.incomingManifest = null;
    this.activeReceivers = [];
    this.currentReceivingIndex = 0;
    this.currentReceivingChunk = 0;

    // Metrics & Performance
    this.transferStartTime = 0;
    this.bytesTransferred = 0;
    this.totalTransferBytes = 0;
    this.lastSpeedCheckTime = 0;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeed = 0;

    // Session Expiry Tracker (15 minute default lifetime)
    this.sessionExpiryTimer = null;
    this.sessionExpiryTimestamp = 0;

    // Active UI Toasts
    this.toastContainer = null;

    // Animation & Transition Systems
    this.introAnimation = null; // Lazy-initialized in _runIntroSequence
    this.sendingAnimationManager = new SendingAnimationManager();
    this.receivingAnimationManager = new ReceivingAnimationManager();
    this.transitionManager = new TransitionManager();

    // Feature Controllers (lazy-initialized when needed)
    this.senderController = null;
    this.receiverController = null;
    this.expiredSessionController = null;

    // Current active transfer animation instance
    this.activeTransferAnimation = null;
  }

  /**
   * Initializes the entire application and starts the lifecycle
   */
  async init() {
    this._injectBaseStyles();
    this._setupDOMContainers();
    this._setupRouter();
    this._setupSignalingListeners();
    this._setupUIEventListeners();

    // Start hash router
    this.router.start();

    // Run Intro Sequence
    await this._runIntroSequence();
  }

  /**
   * Configures SPA router mappings and view activations
   * @private
   */
  _setupRouter() {
    this.router.onRouteChange((routeInfo) => {
      this._handleRoute(routeInfo);
    });
  }

  /**
   * Handles route changes and maps to appropriate screen state
   * @private
   * @param {Object} routeInfo 
   */
  _handleRoute(routeInfo) {
    const name = routeInfo.name;
    const params = routeInfo.params;

    switch (name) {
      case 'home':
        if (this.currentState !== APP_STATES.TRANSFERRING) {
          this.transitionTo(APP_STATES.DASHBOARD);
        }
        break;

      case 'send':
        if (this.currentState !== APP_STATES.TRANSFERRING) {
          this.transitionTo(APP_STATES.SEND_SETUP);
        }
        break;

      case 'receive':
      case 'receive-session':
      case 'receive-code': {
        const targetSession = params.sessionId || params.joiningCode;
        if (targetSession) {
          this.startReceiverFlow(targetSession);
        } else {
          this._showManualJoinModal();
        }
        break;
      }

      case 'settings':
        this._showSettingsModal();
        break;

      case 'expired':
        this._showSessionExpiredScreen();
        break;

      case 'about':
        this._showAboutModal();
        break;

      default:
        this.transitionTo(APP_STATES.DASHBOARD);
        break;
    }
  }

  /**
   * Transitions application state machine and updates UI views
   * @param {string} nextState 
   * @param {Object} [payload] 
   */
  transitionTo(nextState, payload = {}) {
    this.currentState = nextState;
    this._renderCurrentStateView(payload);
  }

  /**
   * Orchestrates the futuristic intro animation sequence
   * @private
   */
  async _runIntroSequence() {
    const reducedMotion = this.settings.get('reducedMotion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animEnabled = this.settings.get('animationEnabled');
    const introEl = document.getElementById('intro-screen');

    if (!introEl) {
      this._checkFirstTimeUser();
      return;
    }

    // Select and display a random tagline
    const taglineEl = document.getElementById('intro-tagline');
    if (taglineEl) {
      const taglines = [
        'Your Files. Your Privacy. Your Connection.',
        'Your Files, Your Freedom.',
        'Privacy Without Compromise.',
        'Send Beyond Boundaries.',
        'Direct. Secure. Simple.',
        'No Cloud Storage. Just Connection.',
        'Share Freely, Share Securely.',
        'Your Data Stays Yours.',
        'A Better Way to Transfer.',
        'One Link. One Connection.',
        'Built for Private Sharing.',
        'Connect. Encrypt. Transfer.',
        'Your Files Take the Direct Route.',
        'Privacy in Every Packet.',
        'Secure Connections, Simple Sharing.',
        'From Your Device to Theirs.',
        'No Unnecessary Stops.',
        'Your Connection, Your Control.',
        'Transfer Smarter.',
        'Files Without the Middleman.',
        'A Private Path for Your Files.',
        'Share Without the Storage.',
        'Direct When Possible.',
        'Private by Design.',
        'Secure Sharing, Simplified.'
      ];
      taglineEl.textContent = taglines[Math.floor(Math.random() * taglines.length)];
    }

    // Use IntroAnimation for the full cinematic sequence
    const canvas = document.getElementById('particle-canvas');
    this.introAnimation = new IntroAnimation({
      container: introEl,
      canvas,
      reducedMotion: reducedMotion || !animEnabled
    });

    await new Promise(resolve => {
      this.introAnimation.play(() => resolve());
    });

    // Cleanup intro
    introEl.style.display = 'none';
    this._checkFirstTimeUser();
  }

  /**
   * Checks if this is a first-time user and shows the welcome screen or dashboard
   * @private
   */
  _checkFirstTimeUser() {
    const displayName = this.settings.get('displayName');
    if (!displayName) {
      this.transitionTo(APP_STATES.WELCOME);
    } else {
      this.transitionTo(APP_STATES.DASHBOARD);
    }
  }

  /**
   * Binds WebRTC and Signaling listeners
   * @private
   */
  _setupSignalingListeners() {
    this.signaling.onSessionCreated = ({ sessionId, joiningCode }) => {
      this.activeSessionId = sessionId;
      this.activeJoiningCode = joiningCode;
      this._startSessionExpiryTimer(15 * 60 * 1000); // 15 minutes
      this._updateWaitingScreen();
    };

    this.signaling.onPeerJoined = async (peerName) => {
      this.peerDisplayName = peerName;
      this.showToast(`Peer "${peerName}" joined session`, 'info');

      if (this.isSender) {
        // As initiator, create SDP offer
        try {
          const offer = await this.webrtc.createOffer();
          this.signaling.sendOffer(offer);
        } catch (err) {
          this.showToast('Failed to create WebRTC offer', 'error');
        }
      }
    };

    this.signaling.onOffer = async (sdp, peerInfo) => {
      if (!this.isSender) {
        try {
          if (!this.webrtc) {
            this._initWebRTC();
          }
          const answer = await this.webrtc.createAnswer(sdp);
          this.signaling.sendAnswer(answer);
        } catch (err) {
          this.showToast('Failed to answer WebRTC offer', 'error');
        }
      }
    };

    this.signaling.onAnswer = async (sdp) => {
      if (this.isSender && this.webrtc) {
        try {
          await this.webrtc.setRemoteAnswer(sdp);
        } catch (err) {
          this.showToast('Failed to set remote answer', 'error');
        }
      }
    };

    this.signaling.onIceCandidate = async (candidate) => {
      if (this.webrtc) {
        try {
          await this.webrtc.addIceCandidate(candidate);
        } catch (_) {}
      }
    };

    this.signaling.onPeerDisconnected = () => {
      this.showToast('Peer disconnected from session', 'warning');
      if (this.currentState === APP_STATES.TRANSFERRING) {
        this.showToast('Transfer interrupted by peer disconnection', 'error');
      }
    };

    this.signaling.onSessionExpired = () => {
      this._cleanupSession();
      this.router.navigate('#expired');
    };

    this.signaling.onError = (err) => {
      console.warn('Signaling message error:', err);
    };
  }

  /**
   * Initializes WebRTC connection and sets up channels
   * @private
   */
  _initWebRTC() {
    if (this.webrtc) {
      this.webrtc.close();
    }

    this.webrtc = new WebRTCManager();

    this.webrtc.onIceCandidate = (candidate) => {
      this.signaling.sendIceCandidate(candidate);
    };

    this.webrtc.onConnectionStateChange = (state) => {
      const connBadge = document.getElementById('flux-conn-badge');
      if (connBadge) {
        connBadge.textContent = state.toUpperCase();
        connBadge.className = `flux-badge flux-badge-${state}`;
      }

      if (state === 'connected') {
        this.webrtc.getConnectionType().then(type => {
          const typeBadge = document.getElementById('flux-type-badge');
          if (typeBadge) {
            typeBadge.textContent = type === 'direct' ? 'P2P DIRECT' : 'TURN RELAY';
            typeBadge.className = type === 'direct' ? 'flux-badge flux-badge-direct' : 'flux-badge flux-badge-relay';
          }
        });
      }
    };

    this.webrtc.onDataChannelOpen = async (label) => {
      if (label === 'fluxdrope-control') {
        // Exchange cryptographic public keys over secure WebRTC control channel
        await this._sendCryptoHandshake();
      }
    };

    this.webrtc.onDataChannelMessage = async (label, data) => {
      if (label === 'fluxdrope-control') {
        await this._handleControlMessage(data);
      } else if (label === 'fluxdrope-chunks') {
        await this._handleIncomingChunk(data);
      }
    };
  }

  /**
   * Sends ECDH public key and authentication handshake
   * @private
   */
  async _sendCryptoHandshake() {
    if (!this.localKeyPair) {
      this.localKeyPair = await generateECDHKeyPair();
      this.localPublicKeyBase64 = await exportPublicKey(this.localKeyPair.publicKey);
    }

    this.webrtc.sendControl({
      type: 'CRYPTO_HANDSHAKE',
      publicKey: this.localPublicKeyBase64,
      displayName: this.settings.get('displayName'),
      hasPassword: !!this.sessionPassword
    });
  }

  /**
   * Handles incoming JSON control channel messages
   * @private
   * @param {string} rawMessage 
   */
  async _handleControlMessage(rawMessage) {
    let msg;
    try {
      msg = JSON.parse(rawMessage);
    } catch (_) {
      return;
    }

    switch (msg.type) {
      case 'CRYPTO_HANDSHAKE': {
        // 1. Import remote public key
        this.remotePublicKey = await importPublicKey(msg.publicKey);
        this.peerDisplayName = msg.displayName || 'Peer';

        // 2. Derive base shared AES-GCM-256 key via HKDF
        let derivedKey = await deriveSharedKey(
          this.localKeyPair.privateKey,
          this.remotePublicKey
        );

        // 3. Integrate password strengthening if enabled
        if (msg.hasPassword || this.sessionPassword) {
          if (!this.sessionPassword) {
            this.sessionPassword = await this._promptForPassword();
          }
          const passKey = await derivePasswordKey(this.sessionPassword);
          derivedKey = await combineKeys(derivedKey, passKey);
        }

        this.sharedEncryptionKey = derivedKey;
        this.showToast('E2EE Handshake Established', 'success');

        // If receiver, confirm readiness; if sender, dispatch manifest
        if (this.isSender) {
          this._dispatchFileManifest();
        } else {
          this.webrtc.sendControl({ type: 'HANDSHAKE_CONFIRMED' });
        }
        break;
      }

      case 'HANDSHAKE_CONFIRMED': {
        if (this.isSender) {
          this._dispatchFileManifest();
        }
        break;
      }

      case 'MANIFEST': {
        this.incomingManifest = msg.manifest;
        this._promptReceiverFileAcceptance(msg.manifest);
        break;
      }

      case 'ACCEPT_TRANSFER': {
        if (this.isSender) {
          this._startSenderStreaming();
        }
        break;
      }

      case 'DECLINE_TRANSFER': {
        this.showToast('Transfer was declined by recipient', 'warning');
        this.transitionTo(APP_STATES.DASHBOARD);
        break;
      }

      case 'FILE_HASH_VERIFY': {
        // Verification packet for the current received file
        await this._finalizeAndVerifyReceivedFile(msg.fileIndex, msg.hash);
        break;
      }

      case 'TRANSFER_COMPLETE': {
        this.transitionTo(APP_STATES.DONE);
        break;
      }
    }
  }

  /**
   * ==========================================
   * SENDER WORKFLOW
   * ==========================================
   */

  /**
   * Initiates sender session creation
   * @param {FileList|File[]} files 
   * @param {string} [password] 
   */
  async startSenderFlow(files, password = null) {
    if (!files || files.length === 0) {
      this.showToast('Please select at least one file to share', 'warning');
      return;
    }

    this.isSender = true;
    this.sessionPassword = password || null;
    this.fileManager.selectFiles(files);

    // Generate local ECDH ephemeral keys
    this.localKeyPair = await generateECDHKeyPair();
    this.localPublicKeyBase64 = await exportPublicKey(this.localKeyPair.publicKey);

    // Initialize WebRTC
    this._initWebRTC();

    // Connect to Signaling Worker
    const workerUrl = this._getSignalingWorkerUrl();
    this.transitionTo(APP_STATES.WAITING);

    try {
      await this.signaling.connect(workerUrl);
      const session = await this.signaling.createSession(this.settings.get('displayName'));
      this.activeSessionId = session.sessionId;
      this.activeJoiningCode = session.joiningCode;
      this._updateWaitingScreen();
    } catch (err) {
      console.warn('Signaling server connection failed, using local fallback mode:', err);
      // Generate fallback local mock session for offline/demo operation
      this.activeSessionId = `flux_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.activeJoiningCode = Math.floor(100000 + Math.random() * 900000).toString();
      this._updateWaitingScreen();
    }
  }

  /**
   * Dispatches file manifest packet to recipient
   * @private
   */
  _dispatchFileManifest() {
    const packet = this.fileManager.buildFileMetadataPacket(null, CHUNK_SIZE);
    this.totalTransferBytes = packet.totalSize;
    this.webrtc.sendControl({
      type: 'MANIFEST',
      manifest: packet
    });
  }

  /**
   * Streams all files sequentially to recipient in encrypted 64KB chunks
   * @private
   */
  async _startSenderStreaming() {
    this.transitionTo(APP_STATES.TRANSFERRING);
    this.transferStartTime = Date.now();
    this.lastSpeedCheckTime = this.transferStartTime;
    this.bytesTransferred = 0;
    this.lastSpeedCheckBytes = 0;

    // Launch a randomly-selected sending animation
    const animContainer = document.getElementById('animation-container');
    if (animContainer && this.settings.get('animationEnabled')) {
      const prevId = this.activeTransferAnimation?.id || null;
      const animId = this.sendingAnimationManager.getRandomAnimation(prevId);
      this.activeTransferAnimation = this.sendingAnimationManager.createAnimation(animId, animContainer);
      this.activeTransferAnimation.id = animId;
      this.activeTransferAnimation.start();
    }

    const files = this.fileManager.files;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
      const chunkBuffersForHash = [];

      for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
        const offset = cIdx * CHUNK_SIZE;
        const rawChunk = await this.fileManager.readChunk(file, offset, CHUNK_SIZE);
        chunkBuffersForHash.push(rawChunk);

        // Encrypt with AES-GCM-256 (fresh 12-byte IV prepended)
        const encrypted = await encryptChunk(this.sharedEncryptionKey, null, rawChunk);

        // Send via chunk data channel with automated backpressure handling
        await this.webrtc.sendChunk(encrypted);

        this.bytesTransferred += rawChunk.byteLength;
        this._updateTransferProgress(file.name, fIdx, files.length, cIdx + 1, totalChunks);
      }

      // Compute sender file SHA-256 hash
      const fileHash = await hashFile(chunkBuffersForHash);

      // Notify recipient that file streaming finished with expected hash
      this.webrtc.sendControl({
        type: 'FILE_HASH_VERIFY',
        fileIndex: fIdx,
        hash: fileHash
      });
    }

    // Inform transfer complete
    this.webrtc.sendControl({ type: 'TRANSFER_COMPLETE' });

    // Stop the active sending animation
    if (this.activeTransferAnimation) {
      this.activeTransferAnimation.update(1); // Show complete state
      setTimeout(() => {
        if (this.activeTransferAnimation) {
          this.activeTransferAnimation.stop();
          this.activeTransferAnimation = null;
        }
      }, 500);
    }

    this.transitionTo(APP_STATES.DONE);
  }

  /**
   * ==========================================
   * RECEIVER WORKFLOW
   * ==========================================
   */

  /**
   * Initiates receiver session join
   * @param {string} sessionIdOrCode 
   * @param {string} [password] 
   */
  async startReceiverFlow(sessionIdOrCode, password = null) {
    if (!sessionIdOrCode) {
      this.showToast('Please provide a valid session ID or code', 'warning');
      return;
    }

    this.isSender = false;
    this.activeSessionId = sessionIdOrCode;
    this.sessionPassword = password || null;

    // Generate local ECDH ephemeral keys
    this.localKeyPair = await generateECDHKeyPair();
    this.localPublicKeyBase64 = await exportPublicKey(this.localKeyPair.publicKey);

    // Initialize WebRTC
    this._initWebRTC();

    this.transitionTo(APP_STATES.WAITING, { isReceiver: true });

    const workerUrl = this._getSignalingWorkerUrl();
    try {
      await this.signaling.connect(workerUrl);
      await this.signaling.joinSession(sessionIdOrCode, this.settings.get('displayName'));
    } catch (err) {
      console.warn('Signaling join error:', err);
      this.showToast('Could not join session. Check code or network.', 'error');
    }
  }

  /**
   * Prompts recipient to accept or decline incoming files
   * @private
   * @param {Object} manifest 
   */
  _promptReceiverFileAcceptance(manifest) {
    this.activeReceivers = manifest.files.map(f => new StreamReceiver(f));
    this.totalTransferBytes = manifest.totalSize;

    const modal = document.createElement('div');
    modal.className = 'flux-modal-backdrop';
    modal.innerHTML = `
      <div class="flux-card flux-modal-card">
        <h3 class="flux-title">Incoming E2EE File Transfer</h3>
        <p class="flux-subtitle">Sender: <strong>${this.peerDisplayName || 'Anonymous'}</strong></p>
        <div class="flux-file-preview-list">
          ${manifest.files.map(f => `
            <div class="flux-file-item">
              <span class="flux-file-name">${f.name}</span>
              <span class="flux-file-size">${FileManager.formatSize(f.size)}</span>
            </div>
          `).join('')}
        </div>
        <div class="flux-meta-summary">
          Total: ${manifest.files.length} file(s) &bull; ${FileManager.formatSize(manifest.totalSize)}
        </div>
        <div class="flux-btn-row">
          <button id="flux-accept-btn" class="flux-btn flux-btn-primary">Accept & Decrypt</button>
          <button id="flux-decline-btn" class="flux-btn flux-btn-secondary">Decline</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#flux-accept-btn').onclick = () => {
      modal.remove();
      this.webrtc.sendControl({ type: 'ACCEPT_TRANSFER' });
      this.transitionTo(APP_STATES.TRANSFERRING);
      this.transferStartTime = Date.now();
      this.lastSpeedCheckTime = this.transferStartTime;
      this.bytesTransferred = 0;
      this.lastSpeedCheckBytes = 0;

      // Launch a randomly-selected receiving animation
      const animContainer = document.getElementById('animation-container');
      if (animContainer && this.settings.get('animationEnabled')) {
        const prevId = this.activeTransferAnimation?.id || null;
        const animId = this.receivingAnimationManager.getRandomAnimation(prevId);
        this.activeTransferAnimation = this.receivingAnimationManager.createAnimation(animId, animContainer);
        this.activeTransferAnimation.id = animId;
        this.activeTransferAnimation.start();
      }
    };

    modal.querySelector('#flux-decline-btn').onclick = () => {
      modal.remove();
      this.webrtc.sendControl({ type: 'DECLINE_TRANSFER' });
      this.transitionTo(APP_STATES.DASHBOARD);
    };
  }

  /**
   * Handles incoming encrypted chunk on the chunk data channel
   * @private
   * @param {ArrayBuffer} encryptedChunk 
   */
  async _handleIncomingChunk(encryptedChunk) {
    if (!this.sharedEncryptionKey) {
      console.warn('Received chunk before encryption handshake complete');
      return;
    }

    // Decrypt AES-GCM-256 chunk
    const plainChunk = await decryptChunk(this.sharedEncryptionKey, encryptedChunk);

    const receiver = this.activeReceivers[this.currentReceivingIndex];
    if (receiver) {
      receiver.addChunk(this.currentReceivingChunk, plainChunk);
      this.currentReceivingChunk++;
      this.bytesTransferred += plainChunk.byteLength;

      const progress = receiver.getProgress();
      this._updateTransferProgress(
        receiver.name,
        this.currentReceivingIndex,
        this.activeReceivers.length,
        this.currentReceivingChunk,
        receiver.totalChunks
      );
    }
  }

  /**
   * Assembles, validates SHA-256 integrity, and triggers download for a received file
   * @private
   * @param {number} fileIndex 
   * @param {string} expectedHash 
   */
  async _finalizeAndVerifyReceivedFile(fileIndex, expectedHash) {
    const receiver = this.activeReceivers[fileIndex];
    if (!receiver) return;

    const validation = await receiver.verifyIntegrity(expectedHash);
    if (!validation.valid) {
      this.showToast(`SHA-256 integrity check failed for ${receiver.name}!`, 'error');
      return;
    }

    this.showToast(`File "${receiver.name}" verified (SHA-256 match)`, 'success');

    // Assemble blob and trigger automatic download
    const blob = receiver.finalize();
    FileManager.downloadBlob(blob, receiver.name);

    // Advance to next file in queue
    this.currentReceivingIndex = fileIndex + 1;
    this.currentReceivingChunk = 0;
  }

  /**
   * Computes dynamic transfer metrics (Speed, ETA, Percent) and updates the UI
   * @private
   */
  _updateTransferProgress(fileName, fileIdx, totalFiles, chunkIdx, totalChunks) {
    const now = Date.now();
    const elapsedSinceLastCheck = (now - this.lastSpeedCheckTime) / 1000;

    // Refresh transfer speed every 400ms
    if (elapsedSinceLastCheck >= 0.4) {
      const bytesDelta = this.bytesTransferred - this.lastSpeedCheckBytes;
      this.currentSpeed = bytesDelta / elapsedSinceLastCheck;
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = this.bytesTransferred;
    }

    const remainingBytes = Math.max(0, this.totalTransferBytes - this.bytesTransferred);
    const etaSeconds = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : 0;
    const overallPercent = this.totalTransferBytes > 0
      ? Math.min(100, Math.round((this.bytesTransferred / this.totalTransferBytes) * 100))
      : 0;

    // Update progress view elements
    const progressEl = document.getElementById('flux-progress-fill');
    if (progressEl) progressEl.style.width = `${overallPercent}%`;

    const percentEl = document.getElementById('flux-progress-percent');
    if (percentEl) percentEl.textContent = `${overallPercent}%`;

    const fileEl = document.getElementById('flux-current-file');
    if (fileEl) fileEl.textContent = `${fileName} (${fileIdx + 1}/${totalFiles})`;

    const speedEl = document.getElementById('flux-transfer-speed');
    if (speedEl) speedEl.textContent = FileManager.formatSpeed(this.currentSpeed);

    const etaEl = document.getElementById('flux-transfer-eta');
    if (etaEl) etaEl.textContent = `ETA: ${FileManager.formatTime(etaSeconds)}`;

    const transferredEl = document.getElementById('flux-transfer-bytes');
    if (transferredEl) {
      transferredEl.textContent = `${FileManager.formatSize(this.bytesTransferred)} / ${FileManager.formatSize(this.totalTransferBytes)}`;
    }
  }

  /**
   * Prompts recipient for password if sender enforced dual-layer encryption
   * @private
   * @returns {Promise<string>}
   */
  _promptForPassword() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'flux-modal-backdrop';
      modal.innerHTML = `
        <div class="flux-card flux-modal-card">
          <h3 class="flux-title">Password Protected Transfer</h3>
          <p class="flux-subtitle">The sender protected this transfer with an encryption password.</p>
          <input type="password" id="flux-pass-input" class="flux-input" placeholder="Enter session password" />
          <div class="flux-btn-row">
            <button id="flux-pass-submit" class="flux-btn flux-btn-primary">Unlock & Decrypt</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const input = modal.querySelector('#flux-pass-input');
      input.focus();

      modal.querySelector('#flux-pass-submit').onclick = () => {
        const pass = input.value.trim();
        modal.remove();
        resolve(pass);
      };
    });
  }

  /**
   * Sets up 15-minute session lifetime tracker
   * @private
   * @param {number} durationMs 
   */
  _startSessionExpiryTimer(durationMs) {
    clearTimeout(this.sessionExpiryTimer);
    this.sessionExpiryTimestamp = Date.now() + durationMs;

    this.sessionExpiryTimer = setTimeout(() => {
      this._cleanupSession();
      this.router.navigate('#expired');
    }, durationMs);
  }

  /**
   * Teardown session resources
   * @private
   */
  _cleanupSession() {
    clearTimeout(this.sessionExpiryTimer);

    if (this.webrtc) {
      this.webrtc.close();
      this.webrtc = null;
    }

    this.signaling.disconnect();

    clearKey(this.localKeyPair);
    this.sharedEncryptionKey = null;
    this.localKeyPair = null;
  }

  /**
   * Returns WebSocket URL for signaling server
   * @private
   * @returns {string}
   */
  _getSignalingWorkerUrl() {
    // Check if worker endpoint is configured in settings or window
    if (typeof window !== 'undefined' && window.FLUXDROPE_WORKER_URL) {
      return window.FLUXDROPE_WORKER_URL;
    }

    const host = (typeof window !== 'undefined' && window.location.host) || 'localhost:8787';
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    return `${protocol}//${host}/ws`;
  }

  /**
   * Shows a stylish toast notification
   * @param {string} message 
   * @param {'info'|'success'|'warning'|'error'} [type='info'] 
   */
  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `flux-toast flux-toast-${type}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('flux-toast-fadeout');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  /**
   * Updates waiting screen with generated QR code, URL, and 6-digit code
   * @private
   */
  async _updateWaitingScreen() {
    const codeEl = document.getElementById('flux-joining-code');
    if (codeEl) codeEl.textContent = this.activeJoiningCode || '------';

    const shareUrl = `${window.location.origin}${window.location.pathname}#receive/${this.activeJoiningCode || this.activeSessionId}`;
    const linkInput = document.getElementById('flux-share-link');
    if (linkInput) linkInput.value = shareUrl;

    const qrContainer = document.getElementById('flux-qr-canvas-holder');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      const canvas = await this.qrManager.generateQR(shareUrl);
      canvas.onclick = () => this.qrManager.showFullscreen(canvas);
      qrContainer.appendChild(canvas);
    }
  }

  /**
   * View Render Engine: Renders appropriate views based on state
   * @private
   */
  _renderCurrentStateView(payload = {}) {
    const appRoot = document.getElementById('flux-app-view');
    if (!appRoot) return;

    switch (this.currentState) {
      case APP_STATES.DASHBOARD:
        appRoot.innerHTML = this._templateDashboard();
        this._bindDashboardEvents();
        break;

      case APP_STATES.SEND_SETUP:
        appRoot.innerHTML = this._templateSendSetup();
        this._bindSendSetupEvents();
        break;

      case APP_STATES.WAITING:
        appRoot.innerHTML = this._templateWaiting(payload.isReceiver);
        this._bindWaitingEvents();
        if (this.activeJoiningCode || this.activeSessionId) {
          this._updateWaitingScreen();
        }
        break;

      case APP_STATES.TRANSFERRING:
        appRoot.innerHTML = this._templateTransferring();
        break;

      case APP_STATES.DONE:
        appRoot.innerHTML = this._templateDone();
        this._bindDoneEvents();
        break;
    }
  }

  /**
   * ==========================================
   * HTML TEMPLATES FOR APPLICATION SCREENS
   * ==========================================
   */

  _templateDashboard() {
    return `
      <div class="flux-view-container">
        <header class="flux-header">
          <div class="flux-brand">
            <h1 class="flux-logo-text">FLUXDROPE</h1>
            <span class="flux-badge flux-badge-e2ee">P2P AES-256 E2EE</span>
          </div>
          <div class="flux-header-actions">
            <button id="flux-open-settings" class="flux-icon-btn" title="Settings">&#9881;</button>
          </div>
        </header>

        <main class="flux-dashboard-hero">
          <h2 class="flux-hero-title">Direct P2P Encrypted File Sharing</h2>
          <p class="flux-hero-subtitle">High speed, peer-to-peer browser transmission with WebRTC and Web Crypto API. Zero server storage.</p>

          <div class="flux-action-cards">
            <div id="flux-card-send" class="flux-action-card flux-card-primary">
              <div class="flux-card-icon">&#8679;</div>
              <h3 class="flux-card-title">Send Files</h3>
              <p class="flux-card-desc">Select files, generate a one-time session code and QR link</p>
            </div>

            <div id="flux-card-receive" class="flux-action-card flux-card-secondary">
              <div class="flux-card-icon">&#8681;</div>
              <h3 class="flux-card-title">Receive Files</h3>
              <p class="flux-card-desc">Enter a 6-digit code or scan sender's QR code to connect</p>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  _templateSendSetup() {
    return `
      <div class="flux-view-container">
        <button id="flux-back-home" class="flux-btn-link">&larr; Back to Dashboard</button>
        <div class="flux-card flux-upload-card">
          <h2 class="flux-title">Prepare Transfer</h2>
          <div id="flux-dropzone" class="flux-dropzone">
            <input type="file" id="flux-file-input" multiple style="display: none;" />
            <div class="flux-dropzone-inner">
              <span class="flux-drop-icon">&#128193;</span>
              <p class="flux-drop-text">Drag & drop files here, or <strong class="flux-accent">browse</strong></p>
            </div>
          </div>

          <div id="flux-file-list" class="flux-file-list"></div>

          <div class="flux-password-section">
            <label class="flux-checkbox-label">
              <input type="checkbox" id="flux-enable-password" />
              <span>Protect with password (dual-layer PBKDF2 + ECDH)</span>
            </label>
            <input type="password" id="flux-send-password" class="flux-input" placeholder="Enter session password" style="display: none;" />
          </div>

          <button id="flux-start-session-btn" class="flux-btn flux-btn-primary" disabled>Generate Secure Session</button>
        </div>
      </div>
    `;
  }

  _templateWaiting(isReceiver = false) {
    return `
      <div class="flux-view-container">
        <div class="flux-card flux-waiting-card">
          <h2 class="flux-title">${isReceiver ? 'Connecting to Sender...' : 'Waiting for Recipient...'}</h2>
          <p class="flux-subtitle">Session expires in 15 minutes. Scan QR or share code.</p>

          <div class="flux-code-display">
            <span class="flux-code-label">SESSION JOINING CODE</span>
            <div id="flux-joining-code" class="flux-code-digits">------</div>
          </div>

          <div id="flux-qr-canvas-holder" class="flux-qr-holder"></div>

          <div class="flux-link-share-box">
            <input type="text" id="flux-share-link" class="flux-input flux-input-readonly" readonly />
            <button id="flux-copy-link-btn" class="flux-btn flux-btn-secondary">Copy Link</button>
          </div>

          <div class="flux-connection-status">
            <span>Status: <strong id="flux-conn-badge" class="flux-badge">CONNECTING</strong></span>
            <span>Channel: <strong id="flux-type-badge" class="flux-badge">SEARCHING</strong></span>
          </div>

          <button id="flux-cancel-session-btn" class="flux-btn flux-btn-danger">Cancel Session</button>
        </div>
      </div>
    `;
  }

  _templateTransferring() {
    return `
      <div class="flux-view-container">
        <div class="flux-card flux-transfer-card">
          <h2 class="flux-title">Encrypted Transmission Active</h2>
          <p class="flux-subtitle">Direct WebRTC stream &bull; AES-GCM-256 authenticated</p>

          <div class="flux-progress-container">
            <div class="flux-progress-bar">
              <div id="flux-progress-fill" class="flux-progress-fill" style="width: 0%;"></div>
            </div>
            <div id="flux-progress-percent" class="flux-progress-percent">0%</div>
          </div>

          <div class="flux-transfer-details">
            <div id="flux-current-file" class="flux-detail-line">Preparing file...</div>
            <div class="flux-stats-grid">
              <div><span class="flux-stat-label">Speed:</span> <strong id="flux-transfer-speed">0 B/s</strong></div>
              <div><span class="flux-stat-label">Transferred:</span> <strong id="flux-transfer-bytes">0 B</strong></div>
              <div><span class="flux-stat-label">Remaining:</span> <strong id="flux-transfer-eta">--</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _templateDone() {
    return `
      <div class="flux-view-container">
        <div class="flux-card flux-done-card">
          <div class="flux-done-icon">&#10003;</div>
          <h2 class="flux-title">Transfer Complete!</h2>
          <p class="flux-subtitle">All files encrypted, verified with SHA-256 integrity, and saved.</p>
          <button id="flux-new-transfer-btn" class="flux-btn flux-btn-primary">Start New Transfer</button>
        </div>
      </div>
    `;
  }

  /**
   * Binds event handlers for dashboard screen
   * @private
   */
  _bindDashboardEvents() {
    const sendCard = document.getElementById('flux-card-send');
    if (sendCard) sendCard.onclick = () => this.router.navigate('#send');

    const receiveCard = document.getElementById('flux-card-receive');
    if (receiveCard) receiveCard.onclick = () => this.router.navigate('#receive');

    const settingsBtn = document.getElementById('flux-open-settings');
    if (settingsBtn) settingsBtn.onclick = () => this.router.navigate('#settings');
  }

  /**
   * Binds event handlers for send setup screen
   * @private
   */
  _bindSendSetupEvents() {
    const backBtn = document.getElementById('flux-back-home');
    if (backBtn) backBtn.onclick = () => this.router.navigate('#home');

    const dropzone = document.getElementById('flux-dropzone');
    const fileInput = document.getElementById('flux-file-input');
    const startBtn = document.getElementById('flux-start-session-btn');
    const passCheckbox = document.getElementById('flux-enable-password');
    const passInput = document.getElementById('flux-send-password');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();

      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('flux-dropzone-dragover');
      };

      dropzone.ondragleave = () => {
        dropzone.classList.remove('flux-dropzone-dragover');
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('flux-dropzone-dragover');
        if (e.dataTransfer && e.dataTransfer.files) {
          this.fileManager.addFiles(e.dataTransfer.files);
          this._renderSendFileList();
        }
      };

      fileInput.onchange = () => {
        if (fileInput.files) {
          this.fileManager.addFiles(fileInput.files);
          this._renderSendFileList();
        }
      };
    }

    if (passCheckbox && passInput) {
      passCheckbox.onchange = () => {
        passInput.style.display = passCheckbox.checked ? 'block' : 'none';
      };
    }

    if (startBtn) {
      startBtn.onclick = () => {
        const password = (passCheckbox && passCheckbox.checked) ? passInput.value.trim() : null;
        this.startSenderFlow(this.fileManager.files, password);
      };
    }
  }

  /**
   * Refreshes the selected file list in the send setup screen
   * @private
   */
  _renderSendFileList() {
    const listContainer = document.getElementById('flux-file-list');
    const startBtn = document.getElementById('flux-start-session-btn');
    const metadata = this.fileManager.getMetadata();

    if (!listContainer) return;

    if (metadata.length === 0) {
      listContainer.innerHTML = '';
      if (startBtn) startBtn.disabled = true;
      return;
    }

    if (startBtn) startBtn.disabled = false;

    listContainer.innerHTML = metadata.map((item, idx) => `
      <div class="flux-selected-file">
        <span class="flux-file-name">${item.name}</span>
        <span class="flux-file-size">${item.formattedSize}</span>
        <button class="flux-file-remove" data-index="${idx}">&times;</button>
      </div>
    `).join('');

    listContainer.querySelectorAll('.flux-file-remove').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        this.fileManager.removeFile(idx);
        this._renderSendFileList();
      };
    });
  }

  /**
   * Binds event handlers for waiting screen
   * @private
   */
  _bindWaitingEvents() {
    const copyBtn = document.getElementById('flux-copy-link-btn');
    const linkInput = document.getElementById('flux-share-link');
    const cancelBtn = document.getElementById('flux-cancel-session-btn');

    if (copyBtn && linkInput) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          this.showToast('Transfer link copied to clipboard', 'success');
        } catch (_) {
          linkInput.select();
          document.execCommand('copy');
          this.showToast('Link copied', 'success');
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this._cleanupSession();
        this.router.navigate('#home');
      };
    }
  }

  /**
   * Binds event handlers for done screen
   * @private
   */
  _bindDoneEvents() {
    const newTransferBtn = document.getElementById('flux-new-transfer-btn');
    if (newTransferBtn) {
      newTransferBtn.onclick = () => {
        this._cleanupSession();
        this.fileManager.clearFiles();
        this.router.navigate('#home');
      };
    }
  }

  /**
   * Shows modal for manually entering joining code
   * @private
   */
  _showManualJoinModal() {
    const modal = document.createElement('div');
    modal.className = 'flux-modal-backdrop';
    modal.innerHTML = `
      <div class="flux-card flux-modal-card">
        <h3 class="flux-title">Join Transfer Session</h3>
        <p class="flux-subtitle">Enter the 6-character code or session ID provided by the sender</p>
        <input type="text" id="flux-manual-code" class="flux-input" placeholder="e.g. 583921" maxlength="64" />
        <div class="flux-btn-row">
          <button id="flux-join-confirm-btn" class="flux-btn flux-btn-primary">Connect</button>
          <button id="flux-join-cancel-btn" class="flux-btn flux-btn-secondary">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#flux-manual-code');
    input.focus();

    modal.querySelector('#flux-join-confirm-btn').onclick = () => {
      const code = input.value.trim();
      modal.remove();
      if (code) {
        this.startReceiverFlow(code);
      }
    };

    modal.querySelector('#flux-join-cancel-btn').onclick = () => {
      modal.remove();
      this.router.navigate('#home');
    };
  }

  /**
   * Shows settings modal
   * @private
   */
  _showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'flux-modal-backdrop';
    modal.innerHTML = `
      <div class="flux-card flux-modal-card">
        <h3 class="flux-title">Application Settings</h3>
        <div class="flux-setting-item">
          <label class="flux-setting-label">Display Name</label>
          <input type="text" id="flux-set-name" class="flux-input" value="${this.settings.get('displayName')}" />
        </div>
        <div class="flux-setting-item">
          <label class="flux-setting-label">Theme</label>
          <select id="flux-set-theme" class="flux-input">
            <option value="aurora-glass">Aurora Glass</option>
            <option value="cyber-dark">Cyber Dark</option>
            <option value="obsidian">Obsidian</option>
          </select>
        </div>
        <div class="flux-setting-item">
          <label class="flux-checkbox-label">
            <input type="checkbox" id="flux-set-anim" ${this.settings.get('animationEnabled') ? 'checked' : ''} />
            <span>Enable Fluid Animations</span>
          </label>
        </div>
        <div class="flux-btn-row">
          <button id="flux-save-settings" class="flux-btn flux-btn-primary">Save Preferences</button>
          <button id="flux-close-settings" class="flux-btn flux-btn-secondary">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#flux-save-settings').onclick = () => {
      const name = modal.querySelector('#flux-set-name').value.trim();
      const theme = modal.querySelector('#flux-set-theme').value;
      const anim = modal.querySelector('#flux-set-anim').checked;

      if (name) this.settings.set('displayName', name);
      this.settings.set('theme', theme);
      this.settings.set('animationEnabled', anim);

      this.showToast('Settings saved', 'success');
      modal.remove();
      this.router.navigate('#home');
    };

    modal.querySelector('#flux-close-settings').onclick = () => {
      modal.remove();
      this.router.navigate('#home');
    };
  }

  /**
   * Shows session expired screen
   * @private
   */
  _showSessionExpiredScreen() {
    const appRoot = document.getElementById('flux-app-view');
    if (!appRoot) return;

    appRoot.innerHTML = `
      <div class="flux-view-container">
        <div class="flux-card flux-expired-card">
          <h2 class="flux-title">Session Expired</h2>
          <p class="flux-subtitle">This P2P transfer session has timed out after 15 minutes of inactivity for privacy and security.</p>
          <button id="flux-expired-home-btn" class="flux-btn flux-btn-primary">Back to Safety</button>
        </div>
      </div>
    `;

    const btn = document.getElementById('flux-expired-home-btn');
    if (btn) btn.onclick = () => this.router.navigate('#home');
  }

  /**
   * Shows About / Security specifications modal
   * @private
   */
  _showAboutModal() {
    const modal = document.createElement('div');
    modal.className = 'flux-modal-backdrop';
    modal.innerHTML = `
      <div class="flux-card flux-modal-card">
        <h3 class="flux-title">FLUXDROPE Architecture</h3>
        <p class="flux-subtitle">Created by Shiv Yogi</p>
        <p>FLUXDROPE establishes zero-trust direct peer-to-peer data channels via WebRTC. Chunks are encrypted end-to-end using AES-GCM-256 with dynamic 96-bit random IVs and authenticated against SHA-256 file hashes.</p>
        <div class="flux-btn-row">
          <button id="flux-about-close" class="flux-btn flux-btn-primary">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#flux-about-close').onclick = () => {
      modal.remove();
      this.router.navigate('#home');
    };
  }

  /**
   * Setup UI event listeners
   * @private
   */
  _setupUIEventListeners() {
    // Intercept navigation link clicks with data-route
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.router.navigate(route);
      }
    });
  }

  /**
   * Creates toast container and app root containers if absent
   * @private
   */
  _setupDOMContainers() {
    if (typeof document === 'undefined') return;

    // Toast Container
    if (!document.getElementById('flux-toast-container')) {
      const tc = document.createElement('div');
      tc.id = 'flux-toast-container';
      tc.className = 'flux-toast-container';
      document.body.appendChild(tc);
      this.toastContainer = tc;
    } else {
      this.toastContainer = document.getElementById('flux-toast-container');
    }

    // App View Container
    if (!document.getElementById('flux-app-view')) {
      const appView = document.createElement('div');
      appView.id = 'flux-app-view';
      document.body.appendChild(appView);
    }
  }

  /**
   * Injects core fluid glassmorphic styling system
   * @private
   */
  _injectBaseStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('flux-base-styles')) return;

    const style = document.createElement('style');
    style.id = 'flux-base-styles';
    style.textContent = `
      :root {
        --flux-bg: #060913;
        --flux-surface: rgba(255, 255, 255, 0.04);
        --flux-border: rgba(255, 255, 255, 0.1);
        --flux-cyan: #00F0FF;
        --flux-purple: #8B5CF6;
        --flux-emerald: #10B981;
        --flux-rose: #F43F5E;
        --flux-text: #F8FAFC;
        --flux-text-dim: #94A3B8;
        --flux-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      body {
        margin: 0;
        padding: 0;
        background: var(--flux-bg);
        color: var(--flux-text);
        font-family: var(--flux-font);
        overflow-x: hidden;
      }
      .flux-view-container {
        max-width: 720px;
        margin: 0 auto;
        padding: 32px 20px;
        box-sizing: border-box;
      }
      .flux-card {
        background: var(--flux-surface);
        border: 1px solid var(--flux-border);
        border-radius: 20px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        padding: 28px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      }
      .flux-title {
        font-size: 24px;
        margin: 0 0 8px 0;
        font-weight: 700;
        background: linear-gradient(135deg, #FFF, var(--flux-cyan));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .flux-subtitle {
        color: var(--flux-text-dim);
        font-size: 14px;
        margin: 0 0 20px 0;
      }
      .flux-btn {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .flux-btn:active {
        transform: scale(0.97);
      }
      .flux-btn-primary {
        background: linear-gradient(135deg, var(--flux-cyan), #0070F3);
        color: #000;
      }
      .flux-btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--flux-border);
        color: #FFF;
      }
      .flux-btn-danger {
        background: rgba(244, 63, 94, 0.2);
        border: 1px solid var(--flux-rose);
        color: #FFF;
      }
      .flux-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .flux-input {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--flux-border);
        border-radius: 12px;
        color: #FFF;
        font-size: 14px;
        outline: none;
        margin-bottom: 16px;
      }
      .flux-input:focus {
        border-color: var(--flux-cyan);
      }
      .flux-dropzone {
        border: 2px dashed rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        padding: 40px 20px;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        margin-bottom: 20px;
      }
      .flux-dropzone-dragover {
        border-color: var(--flux-cyan);
        background: rgba(0, 240, 255, 0.05);
      }
      .flux-drop-icon {
        font-size: 40px;
        display: block;
        margin-bottom: 8px;
      }
      .flux-accent {
        color: var(--flux-cyan);
      }
      .flux-file-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
      }
      .flux-selected-file {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.04);
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
      }
      .flux-file-remove {
        background: none;
        border: none;
        color: var(--flux-rose);
        font-size: 20px;
        cursor: pointer;
      }
      .flux-code-display {
        text-align: center;
        margin: 20px 0;
      }
      .flux-code-label {
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--flux-text-dim);
      }
      .flux-code-digits {
        font-size: 36px;
        font-weight: 800;
        letter-spacing: 8px;
        color: var(--flux-cyan);
        margin-top: 4px;
        font-family: monospace;
      }
      .flux-qr-holder {
        display: flex;
        justify-content: center;
        margin: 20px 0;
        cursor: pointer;
      }
      .flux-progress-container {
        margin: 24px 0;
      }
      .flux-progress-bar {
        height: 12px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .flux-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--flux-cyan), var(--flux-purple));
        transition: width 0.15s ease-out;
      }
      .flux-progress-percent {
        text-align: right;
        font-size: 14px;
        font-weight: 600;
        margin-top: 6px;
        color: var(--flux-cyan);
      }
      .flux-stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 16px;
        font-size: 13px;
        background: rgba(0, 0, 0, 0.2);
        padding: 12px;
        border-radius: 12px;
      }
      .flux-stat-label {
        color: var(--flux-text-dim);
        display: block;
      }
      .flux-toast-container {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .flux-toast {
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid var(--flux-border);
        color: #FFF;
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 13px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(12px);
      }
      .flux-toast-success { border-color: var(--flux-emerald); }
      .flux-toast-error { border-color: var(--flux-rose); }
      .flux-toast-warning { border-color: #F59E0B; }
      .flux-toast-fadeout { opacity: 0; transform: translateY(-10px); transition: all 0.4s; }
      .flux-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .flux-modal-card {
        max-width: 440px;
        width: 100%;
      }
      .flux-btn-row {
        display: flex;
        gap: 12px;
        margin-top: 20px;
      }
      .flux-badge {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.1);
      }
      .flux-badge-e2ee { background: rgba(0, 240, 255, 0.15); color: var(--flux-cyan); }
      .flux-badge-connected { background: rgba(16, 185, 129, 0.2); color: var(--flux-emerald); }
      .flux-badge-direct { background: rgba(16, 185, 129, 0.2); color: var(--flux-emerald); }
      .flux-badge-relay { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
      .flux-action-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 32px;
      }
      .flux-action-card {
        background: var(--flux-surface);
        border: 1px solid var(--flux-border);
        border-radius: 18px;
        padding: 24px;
        cursor: pointer;
        transition: transform 0.2s, border-color 0.2s;
      }
      .flux-action-card:hover {
        transform: translateY(-4px);
        border-color: var(--flux-cyan);
      }
      .flux-card-icon {
        font-size: 32px;
        margin-bottom: 12px;
        color: var(--flux-cyan);
      }
      .flux-card-title {
        margin: 0 0 6px 0;
        font-size: 18px;
      }
      .flux-card-desc {
        margin: 0;
        font-size: 13px;
        color: var(--flux-text-dim);
      }
      .flux-link-share-box {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }
    `;
    document.head.appendChild(style);
  }
}

// Global App Singleton & Auto-Init
export const fluxApp = new FluxApp();

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    fluxApp.init().catch(err => console.error('FLUXDROPE initialization error:', err));
  });
}
