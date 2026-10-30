/**
 * FLUXDROPE - Custom Liquid Glass Video Player
 * Created By Shiv Yogi
 *
 * Implements HTML5 video playback with custom glass controls, seekbar,
 * volume, speeds, fullscreen, PiP, and keyboard shortcuts.
 */

import { formatDuration } from '../transfer/stats.js';

export class VideoPlayer {
  constructor(container) {
    this.container = container;
    this.video = null;
    this.url = null;
  }

  render(blob, filename) {
    this.destroy();
    this.url = URL.createObjectURL(blob);

    this.container.innerHTML = `
      <div class="glass-video-player" id="glassVideoPlayer">
        <div class="video-media-wrapper">
          <video id="fluxVideo" src="${this.url}" playsinline preload="metadata"></video>
          <div class="video-overlay-play" id="videoOverlayPlay">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="video-buffering-spinner" id="videoSpinner" style="display: none;"></div>
        </div>

        <div class="video-controls-bar">
          <div class="video-progress-wrapper" id="videoProgressWrapper">
            <div class="video-progress-track">
              <div class="video-progress-buffered" id="videoBuffered"></div>
              <div class="video-progress-fill" id="videoProgressFill"></div>
              <div class="video-progress-handle" id="videoHandle"></div>
            </div>
            <div class="video-time-tooltip" id="videoTimeTooltip" style="display: none;">00:00</div>
          </div>

          <div class="video-controls-row">
            <div class="video-controls-left">
              <button class="video-btn" id="videoPlayBtn" title="Play/Pause (Space)" aria-label="Play">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="playIcon"><path d="M8 5v14l11-7z"/></svg>
              </button>

              <div class="video-volume-group">
                <button class="video-btn" id="videoMuteBtn" title="Mute (M)" aria-label="Mute">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="volIcon"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                </button>
                <input type="range" class="video-volume-slider" id="videoVolume" min="0" max="1" step="0.05" value="1" title="Volume">
              </div>

              <span class="video-time-display" id="videoTimeDisplay">00:00 / 00:00</span>
            </div>

            <div class="video-controls-right">
              <select class="video-speed-select" id="videoSpeed" title="Playback Speed">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>

              <button class="video-btn" id="videoPipBtn" title="Picture in Picture" aria-label="Picture in Picture">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>
              </button>

              <button class="video-btn" id="videoFullscreenBtn" title="Fullscreen (F)" aria-label="Fullscreen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.video = this.container.querySelector('#fluxVideo');
    this.setupListeners();
  }

  setupListeners() {
    const playBtn = this.container.querySelector('#videoPlayBtn');
    const overlayPlay = this.container.querySelector('#videoOverlayPlay');
    const playIcon = this.container.querySelector('#playIcon');
    const muteBtn = this.container.querySelector('#videoMuteBtn');
    const volIcon = this.container.querySelector('#volIcon');
    const volumeSlider = this.container.querySelector('#videoVolume');
    const timeDisplay = this.container.querySelector('#videoTimeDisplay');
    const progressFill = this.container.querySelector('#videoProgressFill');
    const progressWrapper = this.container.querySelector('#videoProgressWrapper');
    const speedSelect = this.container.querySelector('#videoSpeed');
    const pipBtn = this.container.querySelector('#videoPipBtn');
    const fsBtn = this.container.querySelector('#videoFullscreenBtn');

    const togglePlay = () => {
      if (this.video.paused) {
        this.video.play().catch(e => console.warn('Play prevented:', e));
      } else {
        this.video.pause();
      }
    };

    playBtn.addEventListener('click', togglePlay);
    overlayPlay.addEventListener('click', togglePlay);
    this.video.addEventListener('click', togglePlay);

    this.video.addEventListener('play', () => {
      overlayPlay.style.display = 'none';
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    });

    this.video.addEventListener('pause', () => {
      overlayPlay.style.display = 'flex';
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    });

    this.video.addEventListener('timeupdate', () => {
      if (!this.video.duration) return;
      const current = this.video.currentTime;
      const duration = this.video.duration;
      const pct = (current / duration) * 100;
      progressFill.style.width = `${pct}%`;
      timeDisplay.textContent = `${formatDuration(current)} / ${formatDuration(duration)}`;
    });

    // Seek on progress bar click
    progressWrapper.addEventListener('click', (e) => {
      const rect = progressWrapper.getBoundingClientRect();
      const clickPos = (e.clientX - rect.left) / rect.width;
      if (this.video.duration) {
        this.video.currentTime = clickPos * this.video.duration;
      }
    });

    // Volume
    volumeSlider.addEventListener('input', (e) => {
      this.video.volume = parseFloat(e.target.value);
      this.video.muted = false;
    });

    muteBtn.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      if (this.video.muted) {
        volIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
      } else {
        volIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
      }
    });

    speedSelect.addEventListener('change', (e) => {
      this.video.playbackRate = parseFloat(e.target.value);
    });

    if ('pictureInPictureEnabled' in document) {
      pipBtn.addEventListener('click', () => {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          this.video.requestPictureInPicture().catch(console.warn);
        }
      });
    } else {
      pipBtn.style.display = 'none';
    }

    fsBtn.addEventListener('click', () => {
      const player = this.container.querySelector('#glassVideoPlayer');
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        player.requestFullscreen().catch(console.warn);
      }
    });

    // Keyboard Shortcuts
    this.keyHandler = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        this.video.currentTime = Math.max(0, this.video.currentTime - 5);
      } else if (e.code === 'ArrowRight') {
        this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5);
      } else if (e.code === 'KeyM') {
        this.video.muted = !this.video.muted;
      } else if (e.code === 'KeyF') {
        fsBtn.click();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video = null;
    }
  }
}
