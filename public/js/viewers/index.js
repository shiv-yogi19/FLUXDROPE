/**
 * FLUXDROPE - Universal Media Viewer Router & Modal Manager
 * Created By Shiv Yogi
 */

import { VideoPlayer } from './videoPlayer.js';
import { AudioPlayer } from './audioPlayer.js';
import { ImageViewer } from './imageViewer.js';
import { PdfViewer } from './pdfViewer.js';
import { DocumentViewer } from './documentViewer.js';
import { formatBrandedFilename } from '../branding/filename.js';

export function detectFileCategory(filename, mimeType = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
    return 'audio';
  }
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (['txt', 'csv', 'json', 'md', 'markdown', 'html', 'htm', 'xml', 'log'].includes(ext)) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return 'archive';
  }
  return 'binary';
}

export function getRecommendedAction(filename, mimeType = '') {
  const category = detectFileCategory(filename, mimeType);
  switch (category) {
    case 'video':
      return { label: 'Play Video', action: 'preview', icon: 'video' };
    case 'audio':
      return { label: 'Play Audio', action: 'preview', icon: 'audio' };
    case 'image':
      return { label: 'View Image', action: 'preview', icon: 'image' };
    case 'pdf':
      return { label: 'Open PDF', action: 'preview', icon: 'pdf' };
    case 'document':
      return { label: 'View Document', action: 'preview', icon: 'doc' };
    case 'archive':
      return { label: 'Download Archive', action: 'download', icon: 'download' };
    default:
      return { label: 'Download File', action: 'download', icon: 'download' };
  }
}

export class UniversalMediaModal {
  constructor() {
    this.modalEl = null;
    this.bodyEl = null;
    this.currentViewer = null;
    this.initModalDom();
  }

  initModalDom() {
    let existing = document.getElementById('fluxMediaModal');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'fluxMediaModal';
      existing.className = 'flux-modal-backdrop';
      existing.style.display = 'none';
      existing.innerHTML = `
        <div class="flux-modal-window media-viewer-window">
          <div class="modal-header-glass">
            <div class="modal-brand-tag">
              <span class="brand-name">FLUXDROPE</span>
              <span class="brand-sep">•</span>
              <span class="creator-name">Created By Shiv Yogi</span>
            </div>
            <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close Viewer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div class="modal-content-stage" id="mediaViewerStage"></div>
        </div>
      `;
      document.body.appendChild(existing);
    }
    this.modalEl = existing;
    this.bodyEl = existing.querySelector('#mediaViewerStage');

    existing.querySelector('#modalCloseBtn').addEventListener('click', () => this.close());
    existing.addEventListener('click', (e) => {
      if (e.target === existing) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.style.display !== 'none') {
        this.close();
      }
    });
  }

  async open(blob, meta, allFiles = [], currentIndex = 0) {
    if (this.currentViewer) {
      this.currentViewer.destroy?.();
      this.currentViewer = null;
    }
    this.bodyEl.innerHTML = '';
    const category = detectFileCategory(meta.name, meta.type);

    this.modalEl.style.display = 'flex';
    document.body.classList.add('modal-open');

    if (category === 'video') {
      this.currentViewer = new VideoPlayer(this.bodyEl);
      this.currentViewer.render(blob, meta.name);
    } else if (category === 'audio') {
      this.currentViewer = new AudioPlayer(this.bodyEl);
      // Collect all audio files in session for playlist queue
      const audioTracks = allFiles
        .filter(f => detectFileCategory(f.name, f.type) === 'audio' && f.blob)
        .map(f => ({ name: f.name, blob: f.blob, sizeFormatted: `${(f.size / (1024 * 1024)).toFixed(2)} MB` }));
      const tracksToPlay = audioTracks.length > 0 ? audioTracks : [{ name: meta.name, blob, sizeFormatted: '' }];
      const idx = Math.max(0, tracksToPlay.findIndex(t => t.name === meta.name));
      this.currentViewer.render(tracksToPlay, idx >= 0 ? idx : 0);
    } else if (category === 'image') {
      this.currentViewer = new ImageViewer(this.bodyEl);
      const imageFiles = allFiles
        .filter(f => detectFileCategory(f.name, f.type) === 'image' && f.blob)
        .map(f => ({ name: f.name, blob: f.blob }));
      const imagesToView = imageFiles.length > 0 ? imageFiles : [{ name: meta.name, blob }];
      const idx = Math.max(0, imagesToView.findIndex(img => img.name === meta.name));
      this.currentViewer.render(imagesToView, idx >= 0 ? idx : 0);
    } else if (category === 'pdf') {
      this.currentViewer = new PdfViewer(this.bodyEl);
      this.currentViewer.render(blob, meta.name);
    } else if (category === 'document') {
      this.currentViewer = new DocumentViewer(this.bodyEl);
      await this.currentViewer.render(blob, meta.name, meta.type);
    } else {
      // Binary or archive: fallback direct branded download
      const brandedName = formatBrandedFilename(meta.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = brandedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.close();
    }
  }

  close() {
    if (this.currentViewer) {
      this.currentViewer.destroy?.();
      this.currentViewer = null;
    }
    this.modalEl.style.display = 'none';
    document.body.classList.remove('modal-open');
    this.bodyEl.innerHTML = '';
  }
}
