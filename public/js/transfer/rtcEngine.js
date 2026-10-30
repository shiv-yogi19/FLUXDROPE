/**
 * FLUXDROPE - WebRTC DataChannel Transfer Engine
 * Created By Shiv Yogi
 *
 * Implements:
 * - PeerConnection establishment with STUN
 * - Binary DataChannel with backpressure flow control (bufferedAmountLow threshold)
 * - 64KB chunked transmission with 8-byte binary framing: [uint32 fileIndex, uint32 chunkIndex]
 * - Receiver reassembly into Blob with SHA-256 integrity check
 * - Pause, resume, and cancellation mechanics
 */

import { TRANSFER_LIMITS, CONNECTION_STATES, SIGNALING_TYPES } from '../constants.js';
import { FileChunkReader, FileChunkAssembler } from './chunker.js';
import { TransferStatsTracker } from './stats.js';
import { verifyFileIntegrity } from './integrity.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export class RtcTransferEngine {
  constructor(signalingClient, options = {}) {
    this.signaling = signalingClient;
    this.options = options;
    this.pc = null;
    this.dc = null;
    this.role = null; // 'sender' | 'receiver'
    this.state = CONNECTION_STATES.INITIALIZING;

    this.files = []; // File list for sender
    this.currentFileIndex = 0;
    this.assemblers = new Map(); // fileIndex -> FileChunkAssembler
    this.receivedBlobs = new Map(); // fileIndex -> Blob

    this.stats = new TransferStatsTracker();
    this.isPaused = false;
    this.isCancelled = false;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onFileComplete = options.onFileComplete || (() => {});
    this.onError = options.onError || (() => {});

    this.setupSignalingListeners();
  }

  setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  setupSignalingListeners() {
    this.signaling.on(SIGNALING_TYPES.SESSION_JOINED, async (msg) => {
      if (this.role === 'sender' && !this.pc) {
        await this.initiateSenderConnection(msg.peerId);
      }
    });

    this.signaling.on(SIGNALING_TYPES.OFFER, async (msg) => {
      if (this.role === 'receiver') {
        await this.handleOffer(msg.offer, msg.fromPeerId);
      }
    });

    this.signaling.on(SIGNALING_TYPES.ANSWER, async (msg) => {
      if (this.role === 'sender' && this.pc) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    });

    this.signaling.on(SIGNALING_TYPES.CANDIDATE, async (msg) => {
      if (this.pc && msg.candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    this.signaling.on(SIGNALING_TYPES.TRANSFER_CANCEL, () => {
      this.cancel('Remote peer disconnected or cancelled transfer');
    });
  }

  /**
   * Sender initializes PeerConnection and creates DataChannel
   */
  async initiateSenderConnection(targetPeerId) {
    this.setState(CONNECTION_STATES.CONNECTING);
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.setupPeerConnectionEvents();

    this.dc = this.pc.createDataChannel('fluxdrope-transfer', {
      ordered: true
    });
    this.setupDataChannelEvents();

    this.setState(CONNECTION_STATES.NEGOTIATING_WEBRTC);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.signaling.send(SIGNALING_TYPES.OFFER, {
      offer,
      targetPeerId
    });
  }

  /**
   * Receiver handles SDP offer and sends answer
   */
  async handleOffer(offer, fromPeerId) {
    this.setState(CONNECTION_STATES.CONNECTING);
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.setupPeerConnectionEvents();

    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.setupDataChannelEvents();
    };

    this.setState(CONNECTION_STATES.NEGOTIATING_WEBRTC);
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.signaling.send(SIGNALING_TYPES.ANSWER, {
      answer,
      targetPeerId: fromPeerId
    });
  }

  setupPeerConnectionEvents() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send(SIGNALING_TYPES.CANDIDATE, {
          candidate: event.candidate
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const cs = this.pc.connectionState;
      if (cs === 'connected') {
        this.setState(CONNECTION_STATES.CONNECTED);
      } else if (cs === 'disconnected' || cs === 'failed') {
        this.setState(CONNECTION_STATES.FAILED);
      }
    };
  }

  setupDataChannelEvents() {
    this.dc.binaryType = 'arraybuffer';

    this.dc.onopen = () => {
      this.setState(CONNECTION_STATES.CONNECTED);
      if (this.role === 'sender') {
        this.startFileTransmission();
      }
    };

    this.dc.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // Control message (JSON)
        try {
          const msg = JSON.parse(event.data);
          await this.handleControlMessage(msg);
        } catch (e) {
          console.error('Invalid control message:', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary chunk data
        await this.handleBinaryChunk(event.data);
      }
    };

    this.dc.onerror = (err) => {
      console.error('DataChannel error:', err);
      this.onError(err);
    };

    this.dc.onclose = () => {
      if (this.state !== CONNECTION_STATES.COMPLETED) {
        this.setState(CONNECTION_STATES.DISCONNECTED || CONNECTION_STATES.FAILED);
      }
    };
  }

  /**
   * Sender starts transmitting selected files
   */
  async startFileTransmission() {
    if (!this.files || this.files.length === 0) return;

    this.setState(CONNECTION_STATES.SENDING);
    let totalBytesAll = this.files.reduce((sum, f) => sum + f.size, 0);
    this.stats = new TransferStatsTracker(totalBytesAll);
    this.stats.start();

    let cumulativeTransferred = 0;

    for (let i = 0; i < this.files.length; i++) {
      if (this.isCancelled) break;
      const file = this.files[i];

      // Send File Start metadata
      const reader = new FileChunkReader(file, {
        chunkSize: TRANSFER_LIMITS.DEFAULT_CHUNK_SIZE,
        e2eeKey: this.options.e2eeKey,
        baseNonce: this.options.baseNonce
      });

      this.dc.send(JSON.stringify({
        type: 'file-start',
        index: i,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks: reader.totalChunks,
        sha256: file.sha256 || null
      }));

      // Stream chunks with backpressure
      while (reader.hasNextChunk()) {
        if (this.isCancelled) break;

        // Handle Pause
        while (this.isPaused && !this.isCancelled) {
          await new Promise((r) => setTimeout(r, 200));
        }

        // Backpressure management: wait if bufferedAmount exceeds High Water Mark (1 MB)
        if (this.dc.bufferedAmount > TRANSFER_LIMITS.HIGH_WATER_MARK) {
          await this.waitForBufferDrain();
        }

        const chunk = await reader.readNextChunk();
        if (!chunk) break;

        // Frame chunk: 8-byte header [uint32 fileIndex, uint32 chunkIndex] + payload
        const header = new ArrayBuffer(8);
        const view = new DataView(header);
        view.setUint32(0, i, false);
        view.setUint32(4, chunk.chunkIndex, false);

        const packet = new Uint8Array(8 + chunk.data.byteLength);
        packet.set(new Uint8Array(header), 0);
        packet.set(new Uint8Array(chunk.data), 8);

        this.dc.send(packet.buffer);

        cumulativeTransferred += chunk.byteLength;
        this.stats.updateProgress(cumulativeTransferred);
        this.onProgress(this.stats.getSnapshot());
      }

      // Notify end of this file and wait for receiver ack
      this.dc.send(JSON.stringify({
        type: 'file-end',
        index: i,
        sha256: file.sha256 || null
      }));
    }

    if (!this.isCancelled) {
      this.setState(CONNECTION_STATES.COMPLETED);
    }
  }

  /**
   * Wait for DataChannel buffer to drain below low water mark (256 KB)
   */
  async waitForBufferDrain() {
    return new Promise((resolve) => {
      this.dc.bufferedAmountLowThreshold = TRANSFER_LIMITS.LOW_WATER_MARK;
      const onDrain = () => {
        this.dc.onbufferedamountlow = null;
        resolve();
      };
      this.dc.onbufferedamountlow = onDrain;
    });
  }

  /**
   * Receiver handles binary chunk: extracts [fileIndex, chunkIndex] and appends to assembler
   */
  async handleBinaryChunk(buffer) {
    if (buffer.byteLength < 8) return;

    const view = new DataView(buffer);
    const fileIndex = view.getUint32(0, false);
    const chunkIndex = view.getUint32(4, false);
    const chunkData = buffer.slice(8);

    const assembler = this.assemblers.get(fileIndex);
    if (!assembler) {
      console.warn(`No assembler found for fileIndex ${fileIndex}`);
      return;
    }

    await assembler.appendChunk(chunkIndex, chunkData);

    let totalReceivedAll = 0;
    for (const asm of this.assemblers.values()) {
      totalReceivedAll += asm.receivedBytes;
    }

    this.stats.updateProgress(totalReceivedAll);
    this.onProgress(this.stats.getSnapshot());
  }

  /**
   * Handle JSON control messages on DataChannel
   */
  async handleControlMessage(msg) {
    if (msg.type === 'file-start') {
      this.setState(CONNECTION_STATES.RECEIVING);
      const assembler = new FileChunkAssembler(
        {
          name: msg.name,
          size: msg.size,
          type: msg.mimeType,
          totalChunks: msg.totalChunks,
          sha256: msg.sha256
        },
        {
          e2eeKey: this.options.e2eeKey,
          baseNonce: this.options.baseNonce
        }
      );
      this.assemblers.set(msg.index, assembler);
    } else if (msg.type === 'file-end') {
      const assembler = this.assemblers.get(msg.index);
      if (assembler) {
        const blob = assembler.finalize();
        this.receivedBlobs.set(msg.index, blob);

        // Verify SHA-256 integrity
        const { valid, calculatedSha256 } = await verifyFileIntegrity(blob, msg.sha256);

        // Send acknowledgement back to sender
        if (this.dc && this.dc.readyState === 'open') {
          this.dc.send(JSON.stringify({
            type: 'file-ack',
            index: msg.index,
            integrityVerified: valid,
            sha256: calculatedSha256
          }));
        }

        this.onFileComplete({
          index: msg.index,
          blob,
          meta: assembler.fileMeta,
          integrityVerified: valid,
          calculatedSha256
        });

        // Check if all files received
        if (this.assemblers.size === (this.options.totalFilesCount || 1)) {
          let allDone = true;
          for (const asm of this.assemblers.values()) {
            if (!asm.completed) allDone = false;
          }
          if (allDone) {
            this.setState(CONNECTION_STATES.COMPLETED);
          }
        }
      }
    } else if (msg.type === 'file-ack') {
      this.onFileComplete({
        index: msg.index,
        senderAck: true,
        integrityVerified: msg.integrityVerified
      });
    }
  }

  pause() {
    this.isPaused = true;
    this.stats.pause();
  }

  resume() {
    this.isPaused = false;
    this.stats.resume();
  }

  cancel(reason = 'Transfer cancelled by user') {
    this.isCancelled = true;
    this.setState(CONNECTION_STATES.CANCELLED);

    if (this.dc && this.dc.readyState === 'open') {
      try {
        this.dc.send(JSON.stringify({ type: 'transfer-cancel', reason }));
      } catch (_) {}
    }

    this.cleanup();
  }

  cleanup() {
    if (this.dc) {
      try { this.dc.close(); } catch (_) {}
      this.dc = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch (_) {}
      this.pc = null;
    }
  }
}
