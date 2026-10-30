/**
 * FLUXDROPE - Real-time Connection Diagnostics Engine
 * Created By Shiv Yogi
 *
 * Tracks granular network states, ICE candidate states, signaling events,
 * and reports human-readable troubleshooting guidance.
 */

import { CONNECTION_STATES } from '../constants.js';

export class DiagnosticsManager {
  constructor() {
    this.logs = [];
    this.currentState = CONNECTION_STATES.INITIALIZING;
    this.signalingStatus = 'Disconnected';
    this.dataChannelStatus = 'Closed';
    this.iceState = 'new';
    this.listeners = new Set();
  }

  onUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(this.getReport()); } catch (_) {}
    }
  }

  log(event, details = '') {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      event,
      details
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    this.notify();
  }

  setConnectionState(state) {
    this.currentState = state;
    this.log('State Transition', state);
  }

  setSignalingStatus(status) {
    this.signalingStatus = status;
    this.log('Signaling', status);
  }

  setDataChannelStatus(status) {
    this.dataChannelStatus = status;
    this.log('DataChannel', status);
  }

  setIceState(iceState) {
    this.iceState = iceState;
    this.log('ICE Candidate Gathering', iceState);
  }

  getReport() {
    return {
      state: this.currentState,
      signalingStatus: this.signalingStatus,
      dataChannelStatus: this.dataChannelStatus,
      iceState: this.iceState,
      recentLogs: this.logs.slice(0, 10),
      troubleshooting: this.getTroubleshootingTip()
    };
  }

  getTroubleshootingTip() {
    if (this.currentState === CONNECTION_STATES.FAILED) {
      return 'WebRTC direct connection could not be established. Ensure both devices have an active internet connection and are not behind restrictive symmetric NATs.';
    }
    if (this.currentState === CONNECTION_STATES.EXPIRED) {
      return 'The transfer session has expired. Request the sender to create a fresh transfer session.';
    }
    if (this.currentState === CONNECTION_STATES.WAITING_RECEIVER) {
      return 'Share the 6-digit code or QR code with the receiver to start peer-to-peer transmission.';
    }
    return 'All communication routes operating normally.';
  }

  renderToElement(container) {
    if (!container) return;
    const r = this.getReport();

    container.innerHTML = `
      <div class="diagnostics-panel">
        <div class="diag-status-grid">
          <div class="diag-status-item">
            <span class="diag-label">Overall State</span>
            <span class="diag-val diag-state-badge">${r.state}</span>
          </div>
          <div class="diag-status-item">
            <span class="diag-label">Signaling Route</span>
            <span class="diag-val">${r.signalingStatus}</span>
          </div>
          <div class="diag-status-item">
            <span class="diag-label">DataChannel</span>
            <span class="diag-val">${r.dataChannelStatus}</span>
          </div>
          <div class="diag-status-item">
            <span class="diag-label">ICE State</span>
            <span class="diag-val">${r.iceState}</span>
          </div>
        </div>

        <div class="diag-tip-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>${r.troubleshooting}</span>
        </div>

        <div class="diag-event-log">
          <div class="diag-log-header">Recent Telemetry Events</div>
          <div class="diag-log-list">
            ${r.recentLogs.map(l => `
              <div class="diag-log-entry">
                <span class="log-time">${l.timestamp}</span>
                <span class="log-event">${escapeHtml(l.event)}</span>
                <span class="log-details">${escapeHtml(l.details)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
