/**
 * FLUXDROPE - Transfer History Manager
 * Created By Shiv Yogi
 *
 * Persists transfer metadata locally in localStorage without storing plaintext passwords or binary content.
 */

import { formatBytes, formatDuration } from '../transfer/stats.js';

const STORAGE_KEY = 'fluxdrope_transfer_history';

export class TransferHistoryManager {
  static getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Add a record to history
   * @param {object} item
   * @param {string} item.filename
   * @param {number} item.size
   * @param {'sent'|'received'} item.direction
   * @param {'completed'|'cancelled'|'failed'} item.status
   * @param {string} [item.mode] WebRTC DataChannel
   * @param {number} [item.durationMs]
   * @param {number} [item.averageSpeed]
   * @param {string} [item.sha256]
   */
  static addRecord(item) {
    const list = this.getHistory();
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      filename: item.filename || 'Unknown',
      size: item.size || 0,
      direction: item.direction || 'sent',
      status: item.status || 'completed',
      mode: item.mode || 'WebRTC DataChannel',
      durationMs: item.durationMs || 0,
      averageSpeed: item.averageSpeed || 0,
      sha256: item.sha256 || null
    };

    // Keep last 100 entries
    list.unshift(record);
    if (list.length > 100) list.pop();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}

    return record;
  }

  static clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  static renderToContainer(container) {
    if (!container) return;
    const history = this.getHistory();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No transfer activity recorded yet.</p>
          <span class="empty-state-sub">Transfers you send or receive will appear here.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="history-list-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Speed</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(item => `
              <tr>
                <td class="hist-filename">
                  <div class="hist-file-cell">
                    <span class="hist-name">${escapeHtml(item.filename)}</span>
                    ${item.sha256 ? `<span class="hist-hash" title="${item.sha256}">SHA: ${item.sha256.slice(0, 10)}...</span>` : ''}
                  </div>
                </td>
                <td class="hist-size">${formatBytes(item.size)}</td>
                <td>
                  <span class="direction-badge dir-${item.direction}">
                    ${item.direction === 'sent' ? '↑ Sent' : '↓ Received'}
                  </span>
                </td>
                <td>
                  <span class="status-badge status-${item.status}">${item.status}</span>
                </td>
                <td class="hist-speed">${item.averageSpeed > 0 ? `${formatBytes(item.averageSpeed)}/s` : '--'}</td>
                <td class="hist-date">${new Date(item.timestamp).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
