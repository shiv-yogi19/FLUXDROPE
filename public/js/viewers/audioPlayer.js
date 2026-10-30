/**
 * FLUXDROPE - Custom Liquid Glass Music Player & Audio Visualizer
 * Created By Shiv Yogi
 *
 * Implements audio playback, playlist management, shuffle, repeat,
 * and a real-time Canvas frequency/waveform visualizer via Web Audio API.
 */

import { formatDuration } from '../transfer/stats.js';

export class AudioPlayer {
  constructor(container) {
    this.container = container;
    this.audio = null;
    this.playlist = [];
    this.currentIndex = 0;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.animId = null;
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'off' | 'all' | 'one'
  }

  render(tracks, startIndex = 0) {
    this.destroy();
    this.playlist = Array.isArray(tracks) ? tracks : [tracks];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.playlist.length - 1));

    const currentTrack = this.playlist[this.currentIndex];

    this.container.innerHTML = `
      <div class="glass-audio-player" id="glassAudioPlayer">
        <div class="audio-art-visualizer-container">
          <canvas id="audioVisualizerCanvas" width="480" height="140"></canvas>
          <div class="audio-badge-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            <span>FLUXDROPE Hi-Fi Audio</span>
          </div>
        </div>

        <div class="audio-track-info">
          <h3 class="audio-title" id="audioTitle">${escapeHtml(currentTrack.name || 'Audio Track')}</h3>
          <p class="audio-subtitle" id="audioSubtitle">${currentTrack.sizeFormatted || 'Received File'}</p>
        </div>

        <div class="audio-progress-bar-wrap" id="audioProgressWrap">
          <div class="audio-progress-track">
            <div class="audio-progress-fill" id="audioProgressFill"></div>
          </div>
          <div class="audio-time-row">
            <span id="audioCurrentTime">00:00</span>
            <span id="audioDuration">00:00</span>
          </div>
        </div>

        <div class="audio-controls-row">
          <button class="audio-btn" id="audioShuffleBtn" title="Shuffle" aria-label="Shuffle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
          </button>

          <button class="audio-btn" id="audioPrevBtn" title="Previous Track" aria-label="Previous">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>

          <button class="audio-btn audio-btn-play" id="audioPlayBtn" title="Play/Pause" aria-label="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="audioPlayIcon"><path d="M8 5v14l11-7z"/></svg>
          </button>

          <button class="audio-btn" id="audioNextBtn" title="Next Track" aria-label="Next">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>

          <button class="audio-btn active-repeat" id="audioRepeatBtn" title="Repeat" aria-label="Repeat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          </button>
        </div>

        <div class="audio-volume-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
          <input type="range" class="audio-volume-slider" id="audioVolume" min="0" max="1" step="0.05" value="1">
        </div>

        ${this.playlist.length > 1 ? `
          <div class="audio-playlist-queue">
            <h4 class="playlist-header">Queue (${this.playlist.length} tracks)</h4>
            <div class="playlist-items-scroll">
              ${this.playlist.map((t, idx) => `
                <div class="playlist-item ${idx === this.currentIndex ? 'active' : ''}" data-index="${idx}">
                  <span class="playlist-track-idx">${idx + 1}</span>
                  <span class="playlist-track-name">${escapeHtml(t.name)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.audio = new Audio();
    this.loadTrack(this.currentIndex);
    this.setupListeners();
  }

  loadTrack(index) {
    if (!this.playlist[index]) return;
    this.currentIndex = index;
    const track = this.playlist[index];

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
    }
    this.currentUrl = URL.createObjectURL(track.blob);
    this.audio.src = this.currentUrl;

    const titleEl = this.container.querySelector('#audioTitle');
    const subtitleEl = this.container.querySelector('#audioSubtitle');
    if (titleEl) titleEl.textContent = track.name || 'Audio Track';
    if (subtitleEl) subtitleEl.textContent = track.sizeFormatted || '';

    // Highlight active in queue
    this.container.querySelectorAll('.playlist-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });
  }

  setupListeners() {
    const playBtn = this.container.querySelector('#audioPlayBtn');
    const playIcon = this.container.querySelector('#audioPlayIcon');
    const prevBtn = this.container.querySelector('#audioPrevBtn');
    const nextBtn = this.container.querySelector('#audioNextBtn');
    const shuffleBtn = this.container.querySelector('#audioShuffleBtn');
    const repeatBtn = this.container.querySelector('#audioRepeatBtn');
    const progressWrap = this.container.querySelector('#audioProgressWrap');
    const progressFill = this.container.querySelector('#audioProgressFill');
    const currentTimeEl = this.container.querySelector('#audioCurrentTime');
    const durationEl = this.container.querySelector('#audioDuration');
    const volumeSlider = this.container.querySelector('#audioVolume');

    const togglePlay = () => {
      if (!this.audioContext) {
        this.initAudioContext();
      }
      if (this.audio.paused) {
        this.audio.play().then(() => {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
          }
        }).catch(console.warn);
      } else {
        this.audio.pause();
      }
    };

    playBtn.addEventListener('click', togglePlay);

    this.audio.addEventListener('play', () => {
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      this.startVisualizer();
    });

    this.audio.addEventListener('pause', () => {
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio.duration) return;
      const cur = this.audio.currentTime;
      const dur = this.audio.duration;
      progressFill.style.width = `${(cur / dur) * 100}%`;
      currentTimeEl.textContent = formatDuration(cur);
      durationEl.textContent = formatDuration(dur);
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        this.nextTrack();
      }
    });

    progressWrap.addEventListener('click', (e) => {
      const rect = progressWrap.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      if (this.audio.duration) {
        this.audio.currentTime = pos * this.audio.duration;
      }
    });

    prevBtn.addEventListener('click', () => this.prevTrack());
    nextBtn.addEventListener('click', () => this.nextTrack());

    shuffleBtn.addEventListener('click', () => {
      this.isShuffle = !this.isShuffle;
      shuffleBtn.classList.toggle('active', this.isShuffle);
    });

    repeatBtn.addEventListener('click', () => {
      if (this.repeatMode === 'all') {
        this.repeatMode = 'one';
        repeatBtn.title = 'Repeat One';
        repeatBtn.style.color = '#38bdf8';
      } else if (this.repeatMode === 'one') {
        this.repeatMode = 'off';
        repeatBtn.title = 'Repeat Off';
        repeatBtn.style.color = 'inherit';
      } else {
        this.repeatMode = 'all';
        repeatBtn.title = 'Repeat All';
        repeatBtn.style.color = '#a855f7';
      }
    });

    volumeSlider.addEventListener('input', (e) => {
      this.audio.volume = parseFloat(e.target.value);
    });

    // Queue selection click
    this.container.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index, 10);
        this.loadTrack(idx);
        this.audio.play();
      });
    });
  }

  nextTrack() {
    if (this.playlist.length <= 1) return;
    let nextIndex;
    if (this.isShuffle) {
      nextIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      nextIndex = (this.currentIndex + 1) % this.playlist.length;
    }
    this.loadTrack(nextIndex);
    this.audio.play().catch(console.warn);
  }

  prevTrack() {
    if (this.playlist.length <= 1) return;
    const prevIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.loadTrack(prevIndex);
    this.audio.play().catch(console.warn);
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('Web Audio API not allowed or already initialized:', e);
    }
  }

  startVisualizer() {
    const canvas = this.container.querySelector('#audioVisualizerCanvas');
    if (!canvas || !this.analyser) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#ec4899');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth + 2;
      }
    };

    if (this.animId) cancelAnimationFrame(this.animId);
    draw();
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
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
