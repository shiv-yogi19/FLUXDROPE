/**
 * FLUXDROPE - Core Application Controller
 * Created By Shiv Yogi
 *
 * Coordinates file transfers, layouts, media viewers, signaling, and user views.
 */

import { APP_INFO, CONNECTION_STATES, TRANSFER_LIMITS } from './constants.js';
import { LayoutManager } from './layouts/layoutRegistry.js';
import { PerformanceManager } from './config/performance.js';
import { SettingsManager } from './config/settings.js';
import { NavigationMenu } from './ui/menu.js';
import { UniversalMediaModal, getRecommendedAction } from './viewers/index.js';
import { TipsManager } from './ui/tips.js';
import { DiagnosticsManager } from './ui/diagnostics.js';
import { TransferHistoryManager } from './ui/history.js';
import { QrCodeGenerator } from './ui/qr.js';
import { SignalingClient } from './signaling/client.js';
import { RtcTransferEngine } from './transfer/rtcEngine.js';
import { calculateFileSha256 } from './transfer/integrity.js';
import { formatBytes, formatDuration } from './transfer/stats.js';
import { formatBrandedFilename } from './branding/filename.js';
import { hashPasswordForVerification, generateSessionId, generateJoiningCode, deriveE2EEKey, getRandomBytes } from './security/crypto.js';
import { IntroManager } from './intro.js';
import { SVG_ICONS } from './icons.js';

class FluxdropeApp {
  constructor() {
    this.layoutManager = new LayoutManager();
    this.perfManager = new PerformanceManager();
    this.mediaModal = new UniversalMediaModal();
    this.diagnostics = new DiagnosticsManager();
    this.signaling = new SignalingClient();
    this.transferEngine = null;

    this.selectedFiles = []; // Array of File objects
    this.receivedFiles = []; // Array of { name, size, type, blob, verified }
    this.activeSession = null;
    this.userSettings = SettingsManager.getSettings();

    this.currentViewId = 'view-home';
    this.tips = null;
  }

  async init() {
    // 1. Initialize Layout and Performance
    this.layoutManager.initAutoResponsive();
    this.perfManager.applyMode(this.userSettings.performanceMode || 'balanced');

    // 2. Setup Three-Line Navigation Menu
    this.menu = new NavigationMenu({
      onNavigate: (viewId) => this.switchView(viewId)
    });

    // 3. Setup Tips Manager
    const tipEl = document.getElementById('transferTipText');
    if (tipEl) {
      this.tips = new TipsManager(tipEl);
      this.tips.start(14000);
    }

    // 4. Setup Diagnostics update listener
    this.diagnostics.onUpdate((report) => {
      this.updateDiagnosticsUI(report);
    });

    // 5. Setup Action Listeners across views
    this.setupHomeActions();
    this.setupSendView();
    this.setupReceiveView();
    this.setupActiveTransfersView();
    this.setupAppearanceView();
    this.setupPerformanceView();
    this.setupSecurityView();
    this.setupSettingsView();
    this.setupHistoryView();
    this.setupAboutView();

    // 6. Check URL for incoming session join hash: #join=SESSION_ID or ?join=SESSION_ID
    this.checkAutoJoinUrl();

    // 7. Run Cinematic Intro
    const introEl = document.getElementById('cinematicIntro');
    IntroManager.runSequence(introEl, () => {
      // Intro complete callback
    });
  }

  switchView(viewId) {
    this.currentViewId = viewId;
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(viewId);
    if (targetSec) {
      targetSec.classList.add('active');
    }

    if (viewId === 'view-history') {
      TransferHistoryManager.renderToContainer(document.getElementById('historyContainer'));
    }
  }

  setupHomeActions() {
    document.getElementById('heroSendBtn')?.addEventListener('click', () => {
      this.menu.navigateTo('view-send');
    });

    document.getElementById('heroReceiveBtn')?.addEventListener('click', () => {
      this.menu.navigateTo('view-receive');
    });
  }

  /* ================= SENDING FLOW ================= */
  setupSendView() {
    const dropZone = document.getElementById('sendDropZone');
    const fileInput = document.getElementById('sendFileInput');
    const fileListEl = document.getElementById('selectedFilesList');
    const totalCountEl = document.getElementById('sendTotalCount');
    const totalSizeEl = document.getElementById('sendTotalSize');
    const startBtn = document.getElementById('startSendBtn');
    const clearBtn = document.getElementById('clearSelectedBtn');
    const genPassBtn = document.getElementById('genRandomPassBtn');
    const passInput = document.getElementById('sendPasswordInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files) {
        this.addSelectedFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files) {
        this.addSelectedFiles(Array.from(e.target.files));
      }
    });

    clearBtn?.addEventListener('click', () => {
      this.selectedFiles = [];
      this.renderSelectedFiles();
    });

    genPassBtn?.addEventListener('click', () => {
      const randomPass = Math.random().toString(36).slice(-8).toUpperCase();
      if (passInput) passInput.value = randomPass;
    });

    startBtn?.addEventListener('click', async () => {
      if (this.selectedFiles.length === 0) {
        alert('Please select at least one file to send.');
        return;
      }
      await this.startSenderSession();
    });
  }

  addSelectedFiles(newFiles) {
    for (const f of newFiles) {
      // Avoid duplicate file entries
      if (!this.selectedFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        this.selectedFiles.push(f);
      }
    }
    this.renderSelectedFiles();
  }

  renderSelectedFiles() {
    const listEl = document.getElementById('selectedFilesList');
    const totalCountEl = document.getElementById('sendTotalCount');
    const totalSizeEl = document.getElementById('sendTotalSize');
    const startBtn = document.getElementById('startSendBtn');
    const clearBtn = document.getElementById('clearSelectedBtn');

    if (!listEl) return;

    if (this.selectedFiles.length === 0) {
      listEl.innerHTML = `<div class="empty-list-placeholder">No files selected yet. Drag & drop files or click browse above.</div>`;
      if (totalCountEl) totalCountEl.textContent = '0 files';
      if (totalSizeEl) totalSizeEl.textContent = '0 B';
      if (startBtn) startBtn.disabled = true;
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    const totalBytes = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalCountEl) totalCountEl.textContent = `${this.selectedFiles.length} file${this.selectedFiles.length > 1 ? 's' : ''}`;
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(totalBytes);
    if (startBtn) startBtn.disabled = false;
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    listEl.innerHTML = this.selectedFiles.map((file, idx) => `
      <div class="selected-file-card" data-idx="${idx}">
        <div class="file-card-info">
          <span class="file-card-name">${escapeHtml(file.name)}</span>
          <span class="file-card-meta">${formatBytes(file.size)} • ${file.type || 'binary'}</span>
        </div>
        <button class="remove-file-btn" data-idx="${idx}" title="Remove file" aria-label="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `).join('');

    listEl.querySelectorAll('.remove-file-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.selectedFiles.splice(idx, 1);
        this.renderSelectedFiles();
      });
    });
  }

  async startSenderSession() {
    const startBtn = document.getElementById('startSendBtn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<span>Preparing Files & Checksums...</span>';

    try {
      this.diagnostics.setConnectionState(CONNECTION_STATES.INITIALIZING);

      // Compute SHA-256 for all selected files
      const filesMeta = [];
      for (const file of this.selectedFiles) {
        const sha256 = await calculateFileSha256(file);
        file.sha256 = sha256;
        filesMeta.push({
          name: file.name,
          size: file.size,
          type: file.type,
          sha256
        });
      }

      const passInput = document.getElementById('sendPasswordInput');
      const password = passInput?.value?.trim() || '';
      let passwordHash = null;
      let salt = null;

      if (password) {
        const hashResult = await hashPasswordForVerification(password);
        passwordHash = hashResult.hashHex;
        salt = hashResult.saltHex;
      }

      // E2EE Setup
      let e2eeKey = null;
      let e2eeSalt = null;
      let baseNonce = null;

      if (this.userSettings.enableE2EE && password) {
        e2eeSalt = getRandomBytes(16);
        e2eeKey = await deriveE2EEKey(password, e2eeSalt);
        baseNonce = getRandomBytes(8);
      }

      const sessionId = generateSessionId();
      const joiningCode = generateJoiningCode();
      const expiryMs = parseInt(document.getElementById('sendExpirySelect')?.value, 10) || TRANSFER_LIMITS.DEFAULT_SESSION_EXPIRY_MS;

      // Register session with signaling server
      const sessionResult = await this.signaling.createSession({
        sessionId,
        joiningCode,
        passwordRequired: Boolean(password),
        passwordHash,
        salt,
        e2eeEnabled: Boolean(e2eeKey),
        e2eeSalt: e2eeSalt ? Array.from(e2eeSalt).map(b => b.toString(16).padStart(2, '0')).join('') : null,
        files: filesMeta,
        totalSize: this.selectedFiles.reduce((s, f) => s + f.size, 0),
        totalCount: this.selectedFiles.length,
        expiryMs
      });

      this.activeSession = {
        sessionId,
        joiningCode,
        role: 'sender',
        files: this.selectedFiles,
        password
      };

      // Connect Signaling WebSocket
      await this.signaling.connectWebSocket(sessionId, 'sender');
      this.diagnostics.setSignalingStatus('Connected');
      this.diagnostics.setConnectionState(CONNECTION_STATES.WAITING_RECEIVER);

      // Initialize WebRTC Engine
      this.transferEngine = new RtcTransferEngine(this.signaling, {
        e2eeKey,
        baseNonce,
        onStateChange: (state) => {
          this.diagnostics.setConnectionState(state);
          this.updateActiveTransferUIState(state);
        },
        onProgress: (statsSnapshot) => {
          this.updateTransferProgressUI(statsSnapshot);
        },
        onFileComplete: (info) => {
          if (info.senderAck) {
            TransferHistoryManager.addRecord({
              filename: this.selectedFiles[info.index]?.name || 'Sent File',
              size: this.selectedFiles[info.index]?.size || 0,
              direction: 'sent',
              status: 'completed',
              sha256: this.selectedFiles[info.index]?.sha256
            });
          }
        },
        onError: (err) => {
          this.diagnostics.log('Transfer Engine Error', err.message);
        }
      });

      this.transferEngine.role = 'sender';
      this.transferEngine.files = this.selectedFiles;

      // Show Session Sharing Modal / Panels
      this.renderSessionSharePanel(sessionId, joiningCode);
      this.menu.navigateTo('view-transfers');
    } catch (err) {
      alert('Failed to initiate transfer session: ' + err.message);
      this.diagnostics.setConnectionState(CONNECTION_STATES.FAILED);
    } finally {
      startBtn.disabled = false;
      startBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        <span>Initialize Peer Transfer</span>
      `;
    }
  }

  renderSessionSharePanel(sessionId, joiningCode) {
    const shareContainer = document.getElementById('sessionShareArea');
    if (!shareContainer) return;

    const joinUrl = `${window.location.origin}/#join=${sessionId}`;
    const qrSvg = QrCodeGenerator.generateSvg(joinUrl, { size: 180 });

    shareContainer.innerHTML = `
      <div class="session-share-card">
        <div class="share-header">
          <span class="share-badge">Active Transfer Session</span>
          <h3 class="share-title">Ready for Receiver</h3>
        </div>

        <div class="share-code-display">
          <span class="code-label">6-Digit Joining Code</span>
          <div class="code-number-row">
            <span class="code-digits" id="activeJoiningCode">${joiningCode}</span>
            <button class="copy-code-btn" id="copyCodeBtn" title="Copy Code">
              ${SVG_ICONS.copy(18)}
            </button>
          </div>
        </div>

        <div class="share-qr-section">
          <div class="qr-box">${qrSvg}</div>
          <span class="qr-hint">Scan with mobile camera to join instantly</span>
        </div>

        <div class="share-link-row">
          <input type="text" class="share-link-input" id="shareLinkInput" readonly value="${joinUrl}">
          <button class="btn btn-secondary" id="copyLinkBtn">Copy Link</button>
          ${navigator.share ? `<button class="btn btn-secondary" id="nativeShareBtn">Share</button>` : ''}
        </div>
      </div>
    `;

    document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(joiningCode);
      alert('Joining code copied to clipboard: ' + joiningCode);
    });

    document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(joinUrl);
      alert('Session link copied to clipboard!');
    });

    document.getElementById('nativeShareBtn')?.addEventListener('click', () => {
      navigator.share({
        title: 'FLUXDROPE File Transfer',
        text: `Receive files securely via FLUXDROPE. Joining Code: ${joiningCode}`,
        url: joinUrl
      }).catch(console.warn);
    });
  }

  /* ================= RECEIVING FLOW ================= */
  setupReceiveView() {
    const joinCodeInput = document.getElementById('receiveCodeInput');
    const joinBtn = document.getElementById('joinSessionBtn');

    joinBtn?.addEventListener('click', async () => {
      const codeOrUrl = joinCodeInput.value.trim();
      if (!codeOrUrl) {
        alert('Please enter a 6-digit joining code or session link.');
        return;
      }
      await this.initiateReceive(codeOrUrl);
    });
  }

  async checkAutoJoinUrl() {
    const hash = window.location.hash;
    const search = window.location.search;
    let targetSessionId = null;

    if (hash.startsWith('#join=')) {
      targetSessionId = hash.slice('#join='.length);
    } else if (search.includes('join=')) {
      const params = new URLSearchParams(search);
      targetSessionId = params.get('join');
    }

    if (targetSessionId) {
      this.menu.navigateTo('view-receive');
      await this.initiateReceive(targetSessionId);
    }
  }

  async initiateReceive(codeOrSessionId) {
    const joinBtn = document.getElementById('joinSessionBtn');
    if (joinBtn) {
      joinBtn.disabled = true;
      joinBtn.innerHTML = '<span>Connecting to Session...</span>';
    }

    try {
      let sessionId = codeOrSessionId;

      // If user provided 6-digit numerical code, resolve via server
      if (/^\d{6}$/.test(codeOrSessionId)) {
        sessionId = await this.signaling.resolveJoiningCode(codeOrSessionId);
      } else if (codeOrSessionId.includes('#join=')) {
        sessionId = codeOrSessionId.split('#join=')[1];
      }

      this.diagnostics.setConnectionState(CONNECTION_STATES.ESTABLISHING_SESSION);

      // Fetch public session info
      const info = await this.signaling.getSessionInfo(sessionId);

      // If locked out
      if (info.isLocked) {
        alert(`This session is currently locked due to 7 unsuccessful password attempts. Please wait ${info.retryAfter} seconds.`);
        return;
      }

      let authorizedFiles = info.files || [];
      let e2eeKey = null;

      // If password required, prompt user with 7-attempt lockout guard
      if (info.passwordRequired) {
        const authData = await this.promptPasswordModal(sessionId);
        authorizedFiles = authData.files;

        if (authData.e2eeEnabled && authData.e2eeSalt && authData.password) {
          const saltBytes = new Uint8Array(authData.e2eeSalt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          e2eeKey = await deriveE2EEKey(authData.password, saltBytes);
        }
      }

      this.activeSession = {
        sessionId,
        role: 'receiver',
        files: authorizedFiles
      };

      // Connect signaling WebSocket
      await this.signaling.connectWebSocket(sessionId, 'receiver');
      this.diagnostics.setSignalingStatus('Connected');
      this.diagnostics.setConnectionState(CONNECTION_STATES.CONNECTING);

      // Initialize WebRTC receiver engine
      this.transferEngine = new RtcTransferEngine(this.signaling, {
        e2eeKey,
        totalFilesCount: authorizedFiles.length,
        onStateChange: (state) => {
          this.diagnostics.setConnectionState(state);
          this.updateActiveTransferUIState(state);
        },
        onProgress: (statsSnapshot) => {
          this.updateTransferProgressUI(statsSnapshot);
        },
        onFileComplete: (info) => {
          this.handleReceivedFile(info);
        },
        onError: (err) => {
          this.diagnostics.log('Receiver Transfer Error', err.message);
        }
      });

      this.transferEngine.role = 'receiver';

      // Switch to Active Transfers view
      this.menu.navigateTo('view-transfers');
    } catch (err) {
      alert(err.message);
      this.diagnostics.setConnectionState(CONNECTION_STATES.FAILED);
    } finally {
      if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          <span>Connect & Receive</span>
        `;
      }
    }
  }

  /**
   * Password Modal with 7-attempt lockout policy
   */
  async promptPasswordModal(sessionId) {
    return new Promise((resolve, reject) => {
      let modal = document.getElementById('passwordPromptModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'passwordPromptModal';
        modal.className = 'flux-modal-backdrop';
        modal.innerHTML = `
          <div class="flux-modal-window password-modal-window">
            <div class="modal-header-glass">
              <span class="modal-brand-tag">Password Protected Transfer</span>
            </div>
            <div class="password-modal-content">
              <p class="pass-subtext">This file transfer is protected with a security password. Enter password to authorize transfer:</p>
              <div class="pass-input-row">
                <input type="password" id="modalPassInput" class="flux-input" placeholder="Enter password...">
              </div>
              <div class="lockout-status-badge" id="modalLockoutBadge"></div>
              <div class="modal-actions-row">
                <button class="btn btn-secondary" id="modalCancelPassBtn">Cancel</button>
                <button class="btn btn-primary" id="modalSubmitPassBtn">Verify & Unlock</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.style.display = 'flex';
      const input = modal.querySelector('#modalPassInput');
      const badge = modal.querySelector('#modalLockoutBadge');
      const submitBtn = modal.querySelector('#modalSubmitPassBtn');
      const cancelBtn = modal.querySelector('#modalCancelPassBtn');

      input.value = '';
      badge.textContent = '';
      input.focus();

      const cleanup = () => {
        modal.style.display = 'none';
        submitBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      cancelBtn.onclick = () => {
        cleanup();
        reject(new Error('Password authorization cancelled'));
      };

      submitBtn.onclick = async () => {
        const pass = input.value.trim();
        if (!pass) return;

        submitBtn.disabled = true;
        badge.textContent = 'Verifying with server...';

        try {
          const result = await this.signaling.verifyPassword(sessionId, pass);
          cleanup();
          resolve({ ...result, password: pass });
        } catch (err) {
          submitBtn.disabled = false;
          if (err.isLocked) {
            badge.className = 'lockout-status-badge locked';
            badge.textContent = `TRANSFER LOCKED: 7 unsuccessful attempts. Please wait ${err.retryAfter} seconds.`;
          } else {
            badge.className = 'lockout-status-badge warning';
            badge.textContent = `Incorrect password. Remaining attempts: ${err.remainingAttempts}`;
          }
        }
      };
    });
  }

  handleReceivedFile(fileInfo) {
    const { blob, meta, integrityVerified } = fileInfo;
    const receivedItem = {
      name: meta.name,
      size: meta.size,
      type: meta.type,
      blob,
      integrityVerified
    };

    this.receivedFiles.push(receivedItem);

    // Save to transfer history
    TransferHistoryManager.addRecord({
      filename: meta.name,
      size: meta.size,
      direction: 'received',
      status: integrityVerified ? 'completed' : 'failed',
      sha256: fileInfo.calculatedSha256
    });

    this.renderReceivedFilesList();
  }

  renderReceivedFilesList() {
    const container = document.getElementById('receivedFilesList');
    if (!container) return;

    if (this.receivedFiles.length === 0) {
      container.innerHTML = `<div class="empty-list-placeholder">Files received will appear here.</div>`;
      return;
    }

    container.innerHTML = this.receivedFiles.map((file, idx) => {
      const recAction = getRecommendedAction(file.name, file.type);
      return `
        <div class="received-file-card" data-idx="${idx}">
          <div class="rec-file-info">
            <span class="rec-file-name">${escapeHtml(file.name)}</span>
            <span class="rec-file-meta">
              ${formatBytes(file.size)} • ${file.type || 'file'}
              ${file.integrityVerified ? '<span class="integrity-badge verified">✓ SHA-256 Verified</span>' : '<span class="integrity-badge unverified">⚠ Integrity Unverified</span>'}
            </span>
          </div>

          <div class="rec-file-actions">
            ${recAction.action === 'preview' ? `
              <button class="btn btn-sm btn-primary action-preview-btn" data-idx="${idx}">
                <span>${recAction.label}</span>
              </button>
            ` : ''}

            <button class="btn btn-sm btn-secondary action-download-btn" data-idx="${idx}">
              <span>Download</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire action buttons
    container.querySelectorAll('.action-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = this.receivedFiles[idx];
        this.mediaModal.open(item.blob, item, this.receivedFiles, idx);
      });
    });

    container.querySelectorAll('.action-download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = this.receivedFiles[idx];
        const brandedName = formatBrandedFilename(item.name);
        const url = URL.createObjectURL(item.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = brandedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    });
  }

  /* ================= ACTIVE TRANSFERS UI ================= */
  setupActiveTransfersView() {
    const pauseBtn = document.getElementById('transferPauseBtn');
    const cancelBtn = document.getElementById('transferCancelBtn');

    pauseBtn?.addEventListener('click', () => {
      if (!this.transferEngine) return;
      if (this.transferEngine.isPaused) {
        this.transferEngine.resume();
        pauseBtn.innerHTML = '<span>Pause Transfer</span>';
      } else {
        this.transferEngine.pause();
        pauseBtn.innerHTML = '<span>Resume Transfer</span>';
      }
    });

    cancelBtn?.addEventListener('click', () => {
      if (this.transferEngine && confirm('Are you sure you want to cancel the active transfer?')) {
        this.transferEngine.cancel('Cancelled by user');
      }
    });
  }

  updateActiveTransferUIState(state) {
    const stateBadge = document.getElementById('activeTransferStateBadge');
    if (stateBadge) {
      stateBadge.textContent = state;
    }
  }

  updateTransferProgressUI(stats) {
    const pctBar = document.getElementById('transferProgressBar');
    const pctText = document.getElementById('transferProgressPct');
    const speedEl = document.getElementById('transferCurrentSpeed');
    const avgSpeedEl = document.getElementById('transferAvgSpeed');
    const peakSpeedEl = document.getElementById('transferPeakSpeed');
    const transferredEl = document.getElementById('transferBytesTransferred');
    const elapsedEl = document.getElementById('transferElapsedTime');
    const etaEl = document.getElementById('transferEta');

    if (pctBar) pctBar.style.width = `${stats.percent}%`;
    if (pctText) pctText.textContent = stats.percentFormatted;
    if (speedEl) speedEl.textContent = stats.currentSpeedFormatted;
    if (avgSpeedEl) avgSpeedEl.textContent = stats.averageSpeedFormatted;
    if (peakSpeedEl) peakSpeedEl.textContent = stats.peakSpeedFormatted;
    if (transferredEl) transferredEl.textContent = `${formatBytes(stats.bytesTransferred)} / ${formatBytes(stats.totalBytes)}`;
    if (elapsedEl) elapsedEl.textContent = stats.elapsedFormatted;
    if (etaEl) etaEl.textContent = stats.etaFormatted;
  }

  updateDiagnosticsUI(report) {
    const container = document.getElementById('diagnosticsDisplayArea');
    if (container) {
      this.diagnostics.renderToElement(container);
    }
  }

  /* ================= APPEARANCE VIEW (14 LAYOUTS) ================= */
  setupAppearanceView() {
    const mobileGrid = document.getElementById('mobileLayoutsGrid');
    const desktopGrid = document.getElementById('desktopLayoutsGrid');

    const renderCard = (layout) => `
      <div class="layout-card ${layout.id === this.layoutManager.currentLayoutId ? 'active' : ''}" data-id="${layout.id}">
        <div class="layout-preview-svg">${layout.previewSvg}</div>
        <div class="layout-card-meta">
          <span class="layout-badge">${layout.badge}</span>
          <h4 class="layout-card-name">${escapeHtml(layout.name)}</h4>
          <p class="layout-card-desc">${escapeHtml(layout.desc)}</p>
        </div>
      </div>
    `;

    import('./layouts/layoutRegistry.js').then(({ LAYOUT_REGISTRY }) => {
      const mobileLayouts = LAYOUT_REGISTRY.filter(l => l.category === 'mobile');
      const desktopLayouts = LAYOUT_REGISTRY.filter(l => l.category === 'desktop');

      if (mobileGrid) {
        mobileGrid.innerHTML = mobileLayouts.map(renderCard).join('');
      }
      if (desktopGrid) {
        desktopGrid.innerHTML = desktopLayouts.map(renderCard).join('');
      }

      const bindClicks = (grid) => {
        grid?.addEventListener('click', (e) => {
          const card = e.target.closest('.layout-card');
          if (!card) return;
          const layoutId = card.dataset.id;
          this.layoutManager.applyLayout(layoutId);

          document.querySelectorAll('.layout-card').forEach(c => {
            c.classList.toggle('active', c.dataset.id === layoutId);
          });
        });
      };

      bindClicks(mobileGrid);
      bindClicks(desktopGrid);
    });
  }

  /* ================= PERFORMANCE VIEW ================= */
  setupPerformanceView() {
    const perfBtns = document.querySelectorAll('.perf-mode-btn');
    perfBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.perfManager.applyMode(mode);
        perfBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      });
    });
  }

  /* ================= SECURITY VIEW ================= */
  setupSecurityView() {
    const e2eeToggle = document.getElementById('e2eeSettingToggle');
    if (e2eeToggle) {
      e2eeToggle.checked = this.userSettings.enableE2EE;
      e2eeToggle.addEventListener('change', (e) => {
        this.userSettings.enableE2EE = e.target.checked;
        SettingsManager.saveSettings(this.userSettings);
      });
    }
  }

  /* ================= SETTINGS VIEW ================= */
  setupSettingsView() {
    const clearCacheBtn = document.getElementById('clearLocalCacheBtn');
    clearCacheBtn?.addEventListener('click', () => {
      if (confirm('Clear all local settings, transfer history, and cache?')) {
        localStorage.clear();
        alert('Local cache and settings cleared successfully.');
        window.location.reload();
      }
    });
  }

  /* ================= HISTORY VIEW ================= */
  setupHistoryView() {
    const clearHistBtn = document.getElementById('clearHistoryBtn');
    clearHistBtn?.addEventListener('click', () => {
      if (confirm('Clear local transfer history? (This will not interrupt active transfers).')) {
        TransferHistoryManager.clearHistory();
        TransferHistoryManager.renderToContainer(document.getElementById('historyContainer'));
      }
    });
  }

  /* ================= ABOUT VIEW ================= */
  setupAboutView() {
    const replayIntroBtn = document.getElementById('replayIntroBtn');
    replayIntroBtn?.addEventListener('click', () => {
      const introEl = document.getElementById('cinematicIntro');
      IntroManager.runSequence(introEl, null, true);
    });
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.fluxApp = new FluxdropeApp();
  window.fluxApp.init().catch(err => {
    console.error('Failed to initialize FLUXDROPE application:', err);
  });
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
