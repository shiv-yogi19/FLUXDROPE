/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: webrtc.js
 * Author: Shiv Yogi
 * 
 * Production-ready WebRTC Manager for high-speed P2P data transmission.
 * Features:
 * - Dual Data Channels: Reliable control channel & high-throughput chunk channel
 * - Dynamic Backpressure handling (16MB high watermark, 2MB low watermark)
 * - Safe ICE candidate queuing until remote description is established
 * - Connection topology detection (Direct P2P vs TURN Relay)
 * - Clean lifecycle management and error recovery
 */

export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk
export const BACKPRESSURE_HIGH_WATERMARK = 16 * 1024 * 1024; // 16MB threshold
export const BACKPRESSURE_LOW_WATERMARK = 2 * 1024 * 1024;  // 2MB resume threshold

export const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

export class WebRTCManager {
  /**
   * @param {RTCConfiguration} [customConfig] 
   */
  constructor(customConfig = {}) {
    this.config = { ...DEFAULT_RTC_CONFIG, ...customConfig };
    this.peerConnection = null;
    this.controlChannel = null;
    this.chunkChannel = null;

    this.pendingIceCandidates = [];
    this.isInitiator = false;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';

    // Callbacks
    this.onIceCandidate = null;
    this.onDataChannelOpen = null;
    this.onDataChannelMessage = null;
    this.onDataChannelClose = null;
    this.onConnectionStateChange = null;
    this.onError = null;

    // Backpressure state
    this.highWatermark = BACKPRESSURE_HIGH_WATERMARK;
    this.lowWatermark = BACKPRESSURE_LOW_WATERMARK;
    this._drainResolvers = [];

    this._initPeerConnection();
  }

  /**
   * Initializes the RTCPeerConnection instance and binds core event listeners
   * @private
   */
  _initPeerConnection() {
    try {
      this.peerConnection = new RTCPeerConnection(this.config);

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && typeof this.onIceCandidate === 'function') {
          this.onIceCandidate(event.candidate);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        if (!this.peerConnection) return;
        this.connectionState = this.peerConnection.connectionState;
        if (typeof this.onConnectionStateChange === 'function') {
          this.onConnectionStateChange(this.connectionState);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (!this.peerConnection) return;
        this.iceConnectionState = this.peerConnection.iceConnectionState;
      };

      // Receiver-side handler for incoming data channels
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        this._setupDataChannel(channel);
      };
    } catch (err) {
      if (typeof this.onError === 'function') {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Sets up event listeners and properties on an RTCDataChannel
   * @private
   * @param {RTCDataChannel} channel 
   */
  _setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';

    try {
      channel.bufferedAmountLowThreshold = this.lowWatermark;
    } catch (_) {
      // Some browsers require threshold adjustment after opening
    }

    if (channel.label === 'fluxdrope-control') {
      this.controlChannel = channel;
    } else if (channel.label === 'fluxdrope-chunks') {
      this.chunkChannel = channel;
    } else if (!this.controlChannel) {
      this.controlChannel = channel;
    } else {
      this.chunkChannel = channel;
    }

    channel.onopen = () => {
      try {
        channel.bufferedAmountLowThreshold = this.lowWatermark;
      } catch (_) {}

      // If both channels (or the available channel) are ready, notify
      if (typeof this.onDataChannelOpen === 'function') {
        this.onDataChannelOpen(channel.label);
      }
    };

    channel.onclose = () => {
      if (typeof this.onDataChannelClose === 'function') {
        this.onDataChannelClose(channel.label);
      }
    };

    channel.onerror = (err) => {
      if (typeof this.onError === 'function') {
        this.onError(err);
      }
    };

    channel.onmessage = (event) => {
      if (typeof this.onDataChannelMessage === 'function') {
        this.onDataChannelMessage(channel.label, event.data);
      }
    };

    channel.onbufferedamountlow = () => {
      // Resolve any pending backpressure promises
      while (this._drainResolvers.length > 0) {
        const resolve = this._drainResolvers.shift();
        resolve();
      }
    };
  }

  /**
   * Creates the local data channels (called by session initiator / sender)
   * @private
   */
  _initDataChannels() {
    if (!this.peerConnection) return;

    // Reliable ordered channel for metadata, control packets, hashes
    this.controlChannel = this.peerConnection.createDataChannel('fluxdrope-control', {
      ordered: true
    });
    this._setupDataChannel(this.controlChannel);

    // High performance channel for encrypted chunks
    this.chunkChannel = this.peerConnection.createDataChannel('fluxdrope-chunks', {
      ordered: true
    });
    this._setupDataChannel(this.chunkChannel);
  }

  /**
   * Flushes queued ICE candidates after remote description is set
   * @private
   */
  async _drainPendingIceCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (err) {
        // Silently tolerate stale or duplicate ICE candidates
      }
    }
  }

  /**
   * Initiates the connection by creating an SDP offer
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createOffer() {
    if (!this.peerConnection) {
      this._initPeerConnection();
    }
    this.isInitiator = true;
    this._initDataChannels();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return this.peerConnection.localDescription;
  }

  /**
   * Responds to an incoming SDP offer by creating an SDP answer
   * @param {RTCSessionDescriptionInit|string} offer - Incoming SDP offer
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createAnswer(offer) {
    if (!this.peerConnection) {
      this._initPeerConnection();
    }
    this.isInitiator = false;

    const desc = typeof offer === 'string' ? JSON.parse(offer) : offer;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    await this._drainPendingIceCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return this.peerConnection.localDescription;
  }

  /**
   * Sets the remote answer SDP received from the peer
   * @param {RTCSessionDescriptionInit|string} answer 
   */
  async setRemoteAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('WebRTCManager: PeerConnection is not initialized');
    }
    const desc = typeof answer === 'string' ? JSON.parse(answer) : answer;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    await this._drainPendingIceCandidates();
  }

  /**
   * Adds an ICE candidate received from signaling
   * Queues candidates if remote description is not yet applied
   * @param {RTCIceCandidateInit|RTCIceCandidate|null} candidate 
   */
  async addIceCandidate(candidate) {
    if (!candidate) return;

    const iceCandidate = (candidate instanceof RTCIceCandidate)
      ? candidate
      : new RTCIceCandidate(candidate);

    if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (err) {
        // Candidate may already be processed
      }
    } else {
      this.pendingIceCandidates.push(iceCandidate);
    }
  }

  /**
   * Sends a control/metadata JSON message over the control channel
   * @param {Object} message 
   */
  sendControl(message) {
    const channel = this.controlChannel || this.chunkChannel;
    if (!channel || channel.readyState !== 'open') {
      throw new Error('WebRTCManager: Control channel is not open');
    }
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    channel.send(payload);
  }

  /**
   * Sends an encrypted binary chunk over the chunk channel with backpressure control.
   * If the buffer exceeds 16MB, waits until buffer drops below 2MB threshold before proceeding.
   * 
   * @param {ArrayBuffer|Uint8Array} data 
   * @returns {Promise<void>}
   */
  async sendChunk(data) {
    const channel = this.chunkChannel || this.controlChannel;
    if (!channel || channel.readyState !== 'open') {
      throw new Error('WebRTCManager: Chunk data channel is not open');
    }

    // Backpressure flow-control check
    if (channel.bufferedAmount > this.highWatermark) {
      await new Promise((resolve) => {
        this._drainResolvers.push(resolve);
      });
    }

    channel.send(data);
  }

  /**
   * Determines if the current P2P connection is Direct (host/srflx) or Relay (TURN)
   * @returns {Promise<'direct' | 'relay' | 'unknown'>}
   */
  async getConnectionType() {
    if (!this.peerConnection) return 'unknown';

    // 1. Modern RTCIceTransport method
    try {
      const sctp = this.peerConnection.sctp;
      const iceTransport = sctp?.transport?.iceTransport;
      if (iceTransport && typeof iceTransport.getSelectedCandidatePair === 'function') {
        const pair = iceTransport.getSelectedCandidatePair();
        if (pair?.local?.candidateType || pair?.remote?.candidateType) {
          const type = pair.local?.candidateType || pair.remote?.candidateType;
          return (type === 'relay') ? 'relay' : 'direct';
        }
      }
    } catch (_) {}

    // 2. Standard WebRTC getStats() lookup
    try {
      const stats = await this.peerConnection.getStats();
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          const local = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          if (local?.candidateType === 'relay' || remote?.candidateType === 'relay') {
            return 'relay';
          }
          if (local?.candidateType || remote?.candidateType) {
            return 'direct';
          }
        }
      }
    } catch (_) {}

    return 'unknown';
  }

  /**
   * Closes all data channels, tears down RTCPeerConnection, and cleans up resources
   */
  close() {
    // Resolve any remaining backpressure waiters so they don't hang
    while (this._drainResolvers.length > 0) {
      const resolve = this._drainResolvers.shift();
      resolve();
    }

    if (this.controlChannel) {
      try {
        this.controlChannel.close();
      } catch (_) {}
      this.controlChannel = null;
    }

    if (this.chunkChannel) {
      try {
        this.chunkChannel.close();
      } catch (_) {}
      this.chunkChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (_) {}
      this.peerConnection = null;
    }

    this.pendingIceCandidates = [];
    this.connectionState = 'closed';
  }
}
