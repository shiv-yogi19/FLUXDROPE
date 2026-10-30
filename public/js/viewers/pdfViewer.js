/**
 * FLUXDROPE - Custom Liquid Glass PDF Viewer
 * Created By Shiv Yogi
 *
 * Implements PDF preview with custom glass navigation chrome,
 * zoom, print, fullscreen, and branded download.
 */

import { formatBrandedFilename } from '../branding/filename.js';

export class PdfViewer {
  constructor(container) {
    this.container = container;
    this.url = null;
    this.zoom = 100;
  }

  render(blob, filename) {
    this.destroy();
    this.url = URL.createObjectURL(blob);

    this.container.innerHTML = `
      <div class="glass-pdf-viewer" id="glassPdfViewer">
        <div class="pdf-toolbar">
          <div class="pdf-title-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
            <span class="pdf-name">${escapeHtml(filename)}</span>
          </div>

          <div class="pdf-controls-group">
            <button class="pdf-btn" id="pdfZoomOutBtn" title="Zoom Out (-)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <span class="pdf-zoom-badge" id="pdfZoomBadge">100%</span>
            <button class="pdf-btn" id="pdfZoomInBtn" title="Zoom In (+)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>

            <button class="pdf-btn" id="pdfPrintBtn" title="Print Document">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            </button>

            <button class="pdf-btn" id="pdfDownloadBtn" title="Download Original">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
          </div>
        </div>

        <div class="pdf-document-viewport" id="pdfViewport">
          <iframe id="pdfFrame" src="${this.url}#toolbar=0" title="${escapeHtml(filename)}"></iframe>
        </div>
      </div>
    `;

    this.setupListeners(blob, filename);
  }

  setupListeners(blob, filename) {
    const zoomIn = this.container.querySelector('#pdfZoomInBtn');
    const zoomOut = this.container.querySelector('#pdfZoomOutBtn');
    const zoomBadge = this.container.querySelector('#pdfZoomBadge');
    const printBtn = this.container.querySelector('#pdfPrintBtn');
    const dlBtn = this.container.querySelector('#pdfDownloadBtn');
    const frame = this.container.querySelector('#pdfFrame');

    zoomIn.addEventListener('click', () => {
      this.zoom = Math.min(200, this.zoom + 25);
      zoomBadge.textContent = `${this.zoom}%`;
      frame.style.width = `${this.zoom}%`;
      frame.style.height = `${this.zoom}%`;
    });

    zoomOut.addEventListener('click', () => {
      this.zoom = Math.max(50, this.zoom - 25);
      zoomBadge.textContent = `${this.zoom}%`;
      frame.style.width = `${this.zoom}%`;
      frame.style.height = `${this.zoom}%`;
    });

    printBtn.addEventListener('click', () => {
      try {
        frame.contentWindow?.print();
      } catch (_) {
        window.open(this.url)?.print();
      }
    });

    dlBtn.addEventListener('click', () => {
      const brandedName = formatBrandedFilename(filename);
      const a = document.createElement('a');
      a.href = this.url;
      a.download = brandedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  destroy() {
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
