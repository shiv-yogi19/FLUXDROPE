/**
 * FLUXDROPE - Custom Document Viewers (TXT, CSV, JSON, Markdown, Safe Sandbox)
 * Created By Shiv Yogi
 *
 * Provides safe in-browser document previews without exposing main origin to untrusted code.
 */

import { formatBrandedFilename } from '../branding/filename.js';

export class DocumentViewer {
  constructor(container) {
    this.container = container;
  }

  async render(blob, filename, mimeType) {
    this.destroy();
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (ext === 'csv') {
      await this.renderCsv(blob, filename);
    } else if (ext === 'json') {
      await this.renderJson(blob, filename);
    } else if (ext === 'md' || ext === 'markdown') {
      await this.renderMarkdown(blob, filename);
    } else if (ext === 'html' || ext === 'htm' || ext === 'svg') {
      await this.renderSandboxed(blob, filename);
    } else {
      // Default to text viewer
      await this.renderText(blob, filename);
    }
  }

  async renderText(blob, filename) {
    const text = await blob.text();
    const lines = text.split('\n');

    this.container.innerHTML = `
      <div class="glass-doc-viewer text-viewer">
        <div class="doc-header-bar">
          <div class="doc-meta">
            <span class="doc-title">${escapeHtml(filename)}</span>
            <span class="doc-badge">${lines.length} lines</span>
          </div>
          <div class="doc-actions">
            <button class="btn btn-sm btn-secondary" id="copyDocBtn">Copy Text</button>
            <button class="btn btn-sm btn-primary" id="dlDocBtn">Download</button>
          </div>
        </div>
        <div class="doc-body-content">
          <table class="code-line-table">
            <tbody>
              ${lines.slice(0, 2000).map((line, idx) => `
                <tr>
                  <td class="line-number">${idx + 1}</td>
                  <td class="line-code">${escapeHtml(line)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${lines.length > 2000 ? `<div class="doc-truncated-note">Preview truncated at 2,000 lines. Download file to view complete content.</div>` : ''}
        </div>
      </div>
    `;

    this.setupCommonActions(text, blob, filename);
  }

  async renderCsv(blob, filename) {
    const text = await blob.text();
    const rows = parseCsv(text);
    const headers = rows.length > 0 ? rows[0] : [];
    const dataRows = rows.slice(1);

    this.container.innerHTML = `
      <div class="glass-doc-viewer csv-viewer">
        <div class="doc-header-bar">
          <div class="doc-meta">
            <span class="doc-title">${escapeHtml(filename)}</span>
            <span class="doc-badge">${dataRows.length} rows • ${headers.length} columns</span>
          </div>
          <div class="doc-actions">
            <input type="text" class="csv-filter-input" id="csvFilter" placeholder="Filter rows...">
            <button class="btn btn-sm btn-primary" id="dlDocBtn">Download</button>
          </div>
        </div>
        <div class="doc-body-content csv-table-wrap">
          <table class="flux-data-table" id="csvTable">
            <thead>
              <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${dataRows.slice(0, 500).map(row => `
                <tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const filterInput = this.container.querySelector('#csvFilter');
    const tableBody = this.container.querySelector('#csvTable tbody');

    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = dataRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(q)));
      tableBody.innerHTML = filtered.slice(0, 500).map(row => `
        <tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
      `).join('');
    });

    this.setupCommonActions(text, blob, filename);
  }

  async renderJson(blob, filename) {
    const text = await blob.text();
    let formattedText = text;
    try {
      const obj = JSON.parse(text);
      formattedText = JSON.stringify(obj, null, 2);
    } catch (_) {}

    this.container.innerHTML = `
      <div class="glass-doc-viewer json-viewer">
        <div class="doc-header-bar">
          <div class="doc-meta">
            <span class="doc-title">${escapeHtml(filename)}</span>
            <span class="doc-badge">JSON Document</span>
          </div>
          <div class="doc-actions">
            <button class="btn btn-sm btn-secondary" id="copyDocBtn">Copy JSON</button>
            <button class="btn btn-sm btn-primary" id="dlDocBtn">Download</button>
          </div>
        </div>
        <div class="doc-body-content">
          <pre class="json-code-block"><code>${escapeHtml(formattedText)}</code></pre>
        </div>
      </div>
    `;

    this.setupCommonActions(formattedText, blob, filename);
  }

  async renderMarkdown(blob, filename) {
    const text = await blob.text();
    const html = parseMarkdown(text);

    this.container.innerHTML = `
      <div class="glass-doc-viewer md-viewer">
        <div class="doc-header-bar">
          <div class="doc-meta">
            <span class="doc-title">${escapeHtml(filename)}</span>
            <span class="doc-badge">Markdown</span>
          </div>
          <div class="doc-actions">
            <button class="btn btn-sm btn-secondary" id="copyDocBtn">Copy MD</button>
            <button class="btn btn-sm btn-primary" id="dlDocBtn">Download</button>
          </div>
        </div>
        <div class="doc-body-content md-rendered-body">
          ${html}
        </div>
      </div>
    `;

    this.setupCommonActions(text, blob, filename);
  }

  async renderSandboxed(blob, filename) {
    const url = URL.createObjectURL(blob);
    this.sandboxUrl = url;

    this.container.innerHTML = `
      <div class="glass-doc-viewer sandbox-viewer">
        <div class="doc-header-bar">
          <div class="doc-meta">
            <span class="doc-title">${escapeHtml(filename)}</span>
            <span class="doc-badge">Sandboxed Preview (Scripts Disabled)</span>
          </div>
          <div class="doc-actions">
            <button class="btn btn-sm btn-primary" id="dlDocBtn">Download</button>
          </div>
        </div>
        <div class="doc-body-content sandbox-frame-wrap">
          <iframe sandbox="" src="${url}" title="Sandboxed document preview"></iframe>
        </div>
      </div>
    `;

    const dlBtn = this.container.querySelector('#dlDocBtn');
    dlBtn.addEventListener('click', () => {
      const brandedName = formatBrandedFilename(filename);
      triggerDownload(blob, brandedName);
    });
  }

  setupCommonActions(textToCopy, blob, filename) {
    const copyBtn = this.container.querySelector('#copyDocBtn');
    const dlBtn = this.container.querySelector('#dlDocBtn');

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        } catch (_) {}
      });
    }

    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const brandedName = formatBrandedFilename(filename);
        triggerDownload(blob, brandedName);
      });
    }
  }

  destroy() {
    if (this.sandboxUrl) {
      URL.revokeObjectURL(this.sandboxUrl);
      this.sandboxUrl = null;
    }
  }
}

function parseCsv(str) {
  const arr = [];
  let quote = false;
  let row = [''];
  let col = 0;

  for (let c = 0; c < str.length; c++) {
    const cc = str[c];
    const nc = str[c + 1];

    if (cc === '"') {
      if (quote && nc === '"') {
        row[col] += '"';
        c++;
      } else {
        quote = !quote;
      }
    } else if (cc === ',' && !quote) {
      col++;
      row[col] = '';
    } else if ((cc === '\r' || cc === '\n') && !quote) {
      if (cc === '\r' && nc === '\n') c++;
      arr.push(row);
      row = [''];
      col = 0;
    } else {
      row[col] += cc;
    }
  }
  if (row.length > 1 || row[0] !== '') arr.push(row);
  return arr;
}

function parseMarkdown(md) {
  let html = escapeHtml(md);

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Code inline and blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Unordered list
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/gim, '<p></p>');

  return html;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
