/**
 * FLUXDROPE - Custom Liquid Glass Image Viewer & Gallery
 * Created By Shiv Yogi
 *
 * Implements zoom, pan, 90-deg rotation, gallery navigation,
 * dimension inspector, and non-destructive watermark derivation export.
 */

import { formatBytes } from '../transfer/stats.js';
import { formatBrandedFilename } from '../branding/filename.js';
import { createWatermarkedImage, canWatermark } from '../branding/watermark.js';

export class ImageViewer {
  constructor(container) {
    this.container = container;
    this.images = [];
    this.currentIndex = 0;
    this.zoom = 1;
    this.rotation = 0;
    this.currentUrl = null;
  }

  render(images, startIndex = 0) {
    this.destroy();
    this.images = Array.isArray(images) ? images : [images];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.images.length - 1));
    this.zoom = 1;
    this.rotation = 0;

    const current = this.images[this.currentIndex];

    this.container.innerHTML = `
      <div class="glass-image-viewer" id="glassImageViewer">
        <div class="image-toolbar-top">
          <div class="image-meta-info">
            <span class="image-filename" id="imgFilename">${escapeHtml(current.name)}</span>
            <span class="image-dim-badge" id="imgDimensions">Loading dimensions...</span>
          </div>

          <div class="image-toolbar-actions">
            <button class="img-btn" id="zoomOutBtn" title="Zoom Out (-)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <span class="img-zoom-label" id="imgZoomLabel">100%</span>
            <button class="img-btn" id="zoomInBtn" title="Zoom In (+)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
            <button class="img-btn" id="fitScreenBtn" title="Fit to Screen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6v2H6v4H4V4zm16 0v6h-2V6h-4V4h6zM4 20v-6h2v4h4v2H4zm16 0h-6v-2h4v-4h2v6z"/></svg>
            </button>
            <button class="img-btn" id="rotateBtn" title="Rotate 90°">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.6-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c3.37 0 6.09 2.72 6.09 6.09s-2.72 6.09-6.09 6.09v2c4.48 0 8.09-3.61 8.09-8.09S17.48 4.07 13 4.07z"/></svg>
            </button>
          </div>
        </div>

        <div class="image-stage-viewport" id="imageStage">
          <div class="image-stage-content" id="imageStageContent">
            <img id="fluxDisplayImg" alt="${escapeHtml(current.name)}">
          </div>

          ${this.images.length > 1 ? `
            <button class="gallery-nav-btn nav-prev" id="galleryPrevBtn" title="Previous Image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button class="gallery-nav-btn nav-next" id="galleryNextBtn" title="Next Image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          ` : ''}
        </div>

        <div class="image-toolbar-bottom">
          <div class="image-download-group">
            <button class="btn btn-secondary" id="downloadOriginalBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              <span>Download Original</span>
            </button>

            <button class="btn btn-primary" id="downloadWatermarkedBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.84L19.46 19H4.54L12 5.84zM11 10h2v4h-2zm0 6h2v2h-2z"/></svg>
              <span>Download Watermarked Copy</span>
            </button>
          </div>

          ${this.images.length > 1 ? `
            <div class="gallery-thumbnails-strip">
              ${this.images.map((img, idx) => `
                <div class="gallery-thumb-slot ${idx === this.currentIndex ? 'active' : ''}" data-index="${idx}">
                  <span class="gallery-thumb-number">${idx + 1}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.loadImage(this.currentIndex);
    this.setupListeners();
  }

  loadImage(index) {
    if (!this.images[index]) return;
    this.currentIndex = index;
    const imgData = this.images[index];

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
    }
    this.currentUrl = URL.createObjectURL(imgData.blob);

    const imgEl = this.container.querySelector('#fluxDisplayImg');
    const nameEl = this.container.querySelector('#imgFilename');
    const dimEl = this.container.querySelector('#imgDimensions');

    nameEl.textContent = imgData.name;
    this.zoom = 1;
    this.rotation = 0;
    this.updateTransform();

    imgEl.onload = () => {
      dimEl.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight} px • ${formatBytes(imgData.blob.size)}`;
    };
    imgEl.src = this.currentUrl;

    this.container.querySelectorAll('.gallery-thumb-slot').forEach((slot, idx) => {
      slot.classList.toggle('active', idx === index);
    });
  }

  updateTransform() {
    const stageContent = this.container.querySelector('#imageStageContent');
    const zoomLabel = this.container.querySelector('#imgZoomLabel');
    if (stageContent) {
      stageContent.style.transform = `scale(${this.zoom}) rotate(${this.rotation}deg)`;
    }
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  setupListeners() {
    const zoomIn = this.container.querySelector('#zoomInBtn');
    const zoomOut = this.container.querySelector('#zoomOutBtn');
    const fitBtn = this.container.querySelector('#fitScreenBtn');
    const rotateBtn = this.container.querySelector('#rotateBtn');
    const prevBtn = this.container.querySelector('#galleryPrevBtn');
    const nextBtn = this.container.querySelector('#galleryNextBtn');
    const dlOrig = this.container.querySelector('#downloadOriginalBtn');
    const dlWatermark = this.container.querySelector('#downloadWatermarkedBtn');

    zoomIn.addEventListener('click', () => {
      this.zoom = Math.min(4, this.zoom + 0.25);
      this.updateTransform();
    });

    zoomOut.addEventListener('click', () => {
      this.zoom = Math.max(0.25, this.zoom - 0.25);
      this.updateTransform();
    });

    fitBtn.addEventListener('click', () => {
      this.zoom = 1;
      this.rotation = 0;
      this.updateTransform();
    });

    rotateBtn.addEventListener('click', () => {
      this.rotation = (this.rotation + 90) % 360;
      this.updateTransform();
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const next = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.loadImage(next);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const next = (this.currentIndex + 1) % this.images.length;
        this.loadImage(next);
      });
    }

    dlOrig.addEventListener('click', () => {
      const cur = this.images[this.currentIndex];
      const brandedName = formatBrandedFilename(cur.name);
      triggerBlobDownload(cur.blob, brandedName);
    });

    dlWatermark.addEventListener('click', async () => {
      const cur = this.images[this.currentIndex];
      dlWatermark.disabled = true;
      dlWatermark.innerHTML = '<span>Stamping Watermark...</span>';
      try {
        const { blob, filename } = await createWatermarkedImage(cur.blob, cur.name);
        triggerBlobDownload(blob, filename);
      } catch (err) {
        alert('Watermark derivation failed: ' + err.message);
      } finally {
        dlWatermark.disabled = false;
        dlWatermark.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.84L19.46 19H4.54L12 5.84zM11 10h2v4h-2zm0 6h2v2h-2z"/></svg>
          <span>Download Watermarked Copy</span>
        `;
      }
    });

    this.container.querySelectorAll('.gallery-thumb-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const idx = parseInt(slot.dataset.index, 10);
        this.loadImage(idx);
      });
    });
  }

  destroy() {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}

function triggerBlobDownload(blob, filename) {
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
