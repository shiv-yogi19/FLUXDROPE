/**
 * FLUXDROPE - Cinematic Introduction Animation Engine
 * Author: Shiv Yogi
 * 
 * High-performance 60fps Canvas particle field, SVG 3D glass refraction sphere,
 * 3D isometric logo flip, staggered typographic reveal, and promise-chained timeline.
 */

export class IntroAnimation {
  /**
   * @param {HTMLElement|string} [container] Optional container element or selector.
   * Defaults to creating a full-screen overlay appended to document.body.
   */
  constructor(container) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : (container || null);
    
    this.isOwnContainer = false;
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.numParticles = 200;
    this.particleColors = ['#ffffff', '#a0c4ff', '#c9b8ff'];
    this.animFrameId = null;
    this.lastTimestamp = 0;
    this.particleOpacity = 0;
    this.targetParticleOpacity = 0;
    this.isReducedMotion = false;
    this.isRunning = false;
    this.timeouts = [];
    this.onCompleteCallback = null;
    this.boundResize = this.handleResize.bind(this);

    this.checkReducedMotion();
  }

  /**
   * Evaluates system accessibility preference for reduced motion
   */
  checkReducedMotion() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  /**
   * Injects self-contained styling for all intro stages and 3D effects
   */
  injectStyles() {
    if (document.getElementById('fluxdrope-intro-stylesheet')) return;

    const style = document.createElement('style');
    style.id = 'fluxdrope-intro-stylesheet';
    style.textContent = `
      .flux-intro-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background-color: #000000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        user-select: none;
        perspective: 1200px;
        opacity: 1;
        transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
      }

      .flux-intro-overlay.fade-out {
        opacity: 0 !important;
        pointer-events: none;
      }

      .flux-intro-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        transition: opacity 1s ease-out;
      }

      .flux-intro-stage {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        transform-style: preserve-3d;
        padding: 20px;
      }

      /* 3D Glass Sphere Container */
      .flux-intro-sphere-wrapper {
        position: relative;
        width: 170px;
        height: 170px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform-style: preserve-3d;
        opacity: 0;
        transform: scale(0.3);
        transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.5s ease-out;
      }

      .flux-intro-sphere-wrapper.visible {
        opacity: 1;
        transform: scale(1);
      }

      .flux-intro-sphere-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        animation: fluxSphereSpin 24s linear infinite;
        filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.35));
        transform-origin: center center;
      }

      @keyframes fluxSphereSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* FLUXDROPE Logo with 3D Flip */
      .flux-intro-logo-box {
        position: relative;
        z-index: 4;
        width: 90px;
        height: 90px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transform: rotateY(90deg) scale(0.85);
        transition: transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1.2s ease-out;
        transform-origin: center center;
        backface-visibility: hidden;
      }

      .flux-intro-logo-box.visible {
        opacity: 1;
        transform: rotateY(0deg) scale(1);
      }

      .flux-intro-logo-img {
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 0 16px rgba(0, 240, 255, 0.5));
      }

      /* Brand Typography Container */
      .flux-intro-content {
        margin-top: 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 5;
      }

      .flux-intro-title {
        font-size: clamp(2rem, 5vw, 3.2rem);
        font-weight: 800;
        letter-spacing: 0.25em;
        text-indent: 0.25em;
        color: #ffffff;
        display: flex;
        justify-content: center;
        margin-bottom: 8px;
        text-shadow: 0 0 30px rgba(0, 240, 255, 0.45);
      }

      .flux-intro-letter {
        display: inline-block;
        opacity: 0;
        transform: translateY(18px) scale(0.9);
        transition: opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2);
        background: linear-gradient(135deg, #ffffff 30%, #a5f3fc 70%, #c084fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .flux-intro-letter.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      /* Author Tag */
      .flux-intro-author {
        font-size: clamp(0.75rem, 2vw, 0.95rem);
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #94a3b8;
        opacity: 0;
        transform: translateY(20px);
        transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out;
        margin-top: 6px;
      }

      .flux-intro-author.visible {
        opacity: 1;
        transform: translateY(0);
        color: #38bdf8;
      }

      /* Tagline */
      .flux-intro-tagline {
        font-size: clamp(0.7rem, 1.8vw, 0.85rem);
        font-weight: 400;
        letter-spacing: 0.12em;
        color: #64748b;
        opacity: 0;
        transform: translateY(10px);
        transition: transform 0.5s ease-out, opacity 0.5s ease-out;
        margin-top: 10px;
        max-width: 90vw;
      }

      .flux-intro-tagline.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* Ambient Center Flare */
      .flux-intro-flare {
        position: absolute;
        width: 320px;
        height: 320px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(0, 240, 255, 0.08) 45%, transparent 70%);
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        transform: scale(0.5);
        transition: opacity 1.5s ease-out, transform 1.5s ease-out;
      }

      .flux-intro-flare.visible {
        opacity: 1;
        transform: scale(1.1);
      }

      /* Skip Button */
      .flux-intro-skip-btn {
        position: absolute;
        top: 24px;
        right: 28px;
        z-index: 10;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #94a3b8;
        font-size: 0.8rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 6px 14px;
        border-radius: 9999px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: background 0.2s, color 0.2s, transform 0.2s;
        opacity: 0.85;
      }

      .flux-intro-skip-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
        transform: scale(1.05);
      }

      @media (max-width: 600px) {
        .flux-intro-sphere-wrapper {
          width: 140px;
          height: 140px;
        }
        .flux-intro-logo-box {
          width: 72px;
          height: 72px;
        }
        .flux-intro-skip-btn {
          top: 16px;
          right: 18px;
          padding: 5px 12px;
          font-size: 0.72rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Builds the DOM elements for the intro overlay
   */
  createDOM() {
    this.injectStyles();

    if (!this.container) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'flux-intro-overlay';
      document.body.appendChild(this.overlay);
      this.isOwnContainer = true;
    } else {
      this.overlay = this.container;
      this.overlay.classList.add('flux-intro-overlay');
      this.overlay.innerHTML = '';
    }

    // Skip Button
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'flux-intro-skip-btn';
    skipBtn.innerHTML = 'Skip &rsaquo;';
    skipBtn.setAttribute('aria-label', 'Skip Introduction Animation');
    skipBtn.addEventListener('click', () => this.handleSkip());
    this.overlay.appendChild(skipBtn);

    // Ambient Flare
    this.flare = document.createElement('div');
    this.flare.className = 'flux-intro-flare';
    this.overlay.appendChild(this.flare);

    // Particle Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'flux-intro-canvas';
    this.overlay.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.handleResize();

    // Stage Wrapper
    const stage = document.createElement('div');
    stage.className = 'flux-intro-stage';

    // Glass Sphere SVG & 3D Logo Wrapper
    this.sphereWrapper = document.createElement('div');
    this.sphereWrapper.className = 'flux-intro-sphere-wrapper';

    // SVG Glass Sphere
    this.sphereWrapper.innerHTML = `
      <svg class="flux-intro-sphere-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- 3D Glass Sphere Radial Base Gradient -->
          <radialGradient id="glassSphereBody" cx="35%" cy="32%" r="68%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
            <stop offset="25%" stop-color="#a0c4ff" stop-opacity="0.22" />
            <stop offset="60%" stop-color="#6366f1" stop-opacity="0.12" />
            <stop offset="85%" stop-color="#1e1b4b" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.65" />
          </radialGradient>

          <!-- Specular Glint Highlight -->
          <radialGradient id="glassGlintMain" cx="30%" cy="25%" r="35%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
            <stop offset="40%" stop-color="#a5f3fc" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>

          <!-- Secondary Bottom-Rim Bounce Light -->
          <radialGradient id="glassGlintRim" cx="70%" cy="80%" r="40%">
            <stop offset="0%" stop-color="#d946ef" stop-opacity="0.35" />
            <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.15" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>

          <linearGradient id="glassSphereRimStroke" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75" />
            <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.65" />
          </linearGradient>
        </defs>

        <!-- Outer Glass Sphere Body -->
        <circle cx="100" cy="100" r="92" fill="url(#glassSphereBody)" stroke="url(#glassSphereRimStroke)" stroke-width="1.8" />

        <!-- Concentric Inner Refraction Ripples -->
        <circle cx="100" cy="100" r="76" stroke="#a0c4ff" stroke-opacity="0.16" stroke-width="1" stroke-dasharray="6 3" />
        <circle cx="100" cy="100" r="58" stroke="#c9b8ff" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="8 4" />

        <!-- Specular Highlight Circles -->
        <ellipse cx="68" cy="58" rx="34" ry="22" transform="rotate(-30 68 58)" fill="url(#glassGlintMain)" />
        <ellipse cx="132" cy="142" rx="28" ry="14" transform="rotate(-25 132 142)" fill="url(#glassGlintRim)" />
        
        <!-- Micro Specular Sparkle Points -->
        <circle cx="58" cy="46" r="3" fill="#ffffff" opacity="0.9" />
        <circle cx="72" cy="38" r="1.5" fill="#ffffff" opacity="0.75" />
      </svg>
    `;

    // 3D Flipping Logo Box
    this.logoBox = document.createElement('div');
    this.logoBox.className = 'flux-intro-logo-box';
    this.logoBox.innerHTML = `
      <img src="assets/logos/logo.svg" alt="FLUXDROPE Shield Logo" class="flux-intro-logo-img" />
    `;
    this.sphereWrapper.appendChild(this.logoBox);
    stage.appendChild(this.sphereWrapper);

    // Text Container
    this.contentBox = document.createElement('div');
    this.contentBox.className = 'flux-intro-content';

    // Title with individual staggered spans for 'FLUXDROPE'
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'flux-intro-title';
    this.titleLetters = [];
    const brandName = 'FLUXDROPE';
    for (let i = 0; i < brandName.length; i++) {
      const span = document.createElement('span');
      span.className = 'flux-intro-letter';
      span.textContent = brandName[i];
      this.titleEl.appendChild(span);
      this.titleLetters.push(span);
    }
    this.contentBox.appendChild(this.titleEl);

    // Author
    this.authorEl = document.createElement('div');
    this.authorEl.className = 'flux-intro-author';
    this.authorEl.textContent = 'Created By Shiv Yogi';
    this.contentBox.appendChild(this.authorEl);

    // Tagline
    this.taglineEl = document.createElement('div');
    this.taglineEl.className = 'flux-intro-tagline';
    this.taglineEl.textContent = 'Peer-to-Peer End-to-End Encrypted File Transfer';
    this.contentBox.appendChild(this.taglineEl);

    stage.appendChild(this.contentBox);
    this.overlay.appendChild(stage);

    window.addEventListener('resize', this.boundResize);
  }

  /**
   * Initializes 200 random particles for the canvas background
   */
  initParticles() {
    this.particles = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 1 + Math.random() * 2, // 1px to 3px
        vx: (Math.random() - 0.5) * 0.45, // Slow drift
        vy: (Math.random() - 0.5) * 0.45 - 0.15, // Gentle upward bias
        color: this.particleColors[Math.floor(Math.random() * this.particleColors.length)],
        baseAlpha: 0.2 + Math.random() * 0.7,
        alphaPhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02
      });
    }
  }

  /**
   * Canvas particle system update and render loop
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} timestamp 
   */
  drawParticles(ctx, timestamp) {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.particleOpacity <= 0) return;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Update positions
      p.x += p.vx;
      p.y += p.vy;
      p.alphaPhase += p.pulseSpeed;

      // Wrap around canvas boundaries smoothly
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      // Oscillating alpha fade in/out
      const currentAlpha = Math.max(0, Math.min(1,
        p.baseAlpha * (0.6 + 0.4 * Math.sin(p.alphaPhase)) * this.particleOpacity
      ));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = currentAlpha;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  /**
   * Continuous animation loop driving canvas particle rendering
   * @param {number} timestamp 
   */
  renderLoop(timestamp) {
    if (!this.isRunning) return;

    // Smoothly interpolate particle opacity during fade-in
    if (this.particleOpacity < this.targetParticleOpacity) {
      this.particleOpacity = Math.min(this.targetParticleOpacity, this.particleOpacity + 0.03);
    } else if (this.particleOpacity > this.targetParticleOpacity) {
      this.particleOpacity = Math.max(this.targetParticleOpacity, this.particleOpacity - 0.04);
    }

    this.drawParticles(this.ctx, timestamp);
    this.animFrameId = requestAnimationFrame(this.renderLoop.bind(this));
  }

  /**
   * Adapts canvas dimensions to viewport and pixel ratio
   */
  handleResize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  /**
   * Helper utility for delayed promise resolution in sequence
   * @param {number} ms 
   */
  wait(ms) {
    return new Promise(resolve => {
      const id = setTimeout(resolve, ms);
      this.timeouts.push(id);
    });
  }

  /**
   * Handles user trigger to bypass intro early
   */
  handleSkip() {
    this.complete();
  }

  /**
   * Primary entry point to launch cinematic intro animation sequence
   * @param {Function} [onComplete] Invoked when sequence finishes or is skipped
   */
  play(onComplete) {
    this.onCompleteCallback = onComplete || null;
    this.createDOM();
    this.isRunning = true;

    // Accessibility check: Fast path for reduced motion
    if (this.isReducedMotion) {
      this.playReducedMotionSequence();
      return;
    }

    this.initParticles();
    this.animFrameId = requestAnimationFrame(this.renderLoop.bind(this));

    // Execute timeline sequence via Promise chain
    // Sequence milestones:
    // 1. t=0: show black bg, start particles (opacity 0->1 over 1s)
    // 2. t=1s: fade in glass sphere (scale 0.3->1, opacity 0->1, 1.5s)
    // 3. t=2s: logo reveal (3D flip effect: rotateY 90->0deg, opacity 0->1, 1.2s)
    // 4. t=3s: 'FLUXDROPE' text reveal (letter-by-letter stagger, 0.8s)
    // 5. t=4s: 'Created By Shiv Yogi' slide up (0.6s)
    // 6. t=4.5s: tagline fade in (0.5s)
    // 7. t=5.5s: hold for 1s
    // 8. t=6.5s: whole intro fades out (0.8s), calls onComplete
    Promise.resolve()
      .then(() => {
        // Step 1: t=0s - Canvas particle fade in
        if (this.canvas) this.canvas.style.opacity = '1';
        this.targetParticleOpacity = 1.0;
        return this.wait(1000);
      })
      .then(() => {
        // Step 2: t=1s - Fade in & expand glass sphere & ambient flare
        if (!this.isRunning) return;
        if (this.sphereWrapper) this.sphereWrapper.classList.add('visible');
        if (this.flare) this.flare.classList.add('visible');
        return this.wait(1000); // Reaches t=2s
      })
      .then(() => {
        // Step 3: t=2s - FLUXDROPE Logo 3D flip reveal (rotateY 90->0 deg)
        if (!this.isRunning) return;
        if (this.logoBox) this.logoBox.classList.add('visible');
        return this.wait(1000); // Reaches t=3s
      })
      .then(() => {
        // Step 4: t=3s - 'FLUXDROPE' letter-by-letter stagger reveal (0.8s total)
        if (!this.isRunning) return;
        const totalLetters = this.titleLetters.length;
        const staggerInterval = (800 / totalLetters);

        this.titleLetters.forEach((letterSpan, index) => {
          const timeoutId = setTimeout(() => {
            if (this.isRunning && letterSpan) {
              letterSpan.classList.add('visible');
            }
          }, index * staggerInterval);
          this.timeouts.push(timeoutId);
        });

        return this.wait(1000); // Reaches t=4s
      })
      .then(() => {
        // Step 5: t=4s - 'Created By Shiv Yogi' slide up (0.6s)
        if (!this.isRunning) return;
        if (this.authorEl) this.authorEl.classList.add('visible');
        return this.wait(500); // Reaches t=4.5s
      })
      .then(() => {
        // Step 6: t=4.5s - Tagline fade in (0.5s)
        if (!this.isRunning) return;
        if (this.taglineEl) this.taglineEl.classList.add('visible');
        return this.wait(1000); // Reaches t=5.5s
      })
      .then(() => {
        // Step 7: t=5.5s - Hold majestic showcase for 1.0s
        if (!this.isRunning) return;
        return this.wait(1000); // Reaches t=6.5s
      })
      .then(() => {
        // Step 8: t=6.5s - Whole intro fades out over 0.8s, then calls onComplete
        if (!this.isRunning) return;
        this.targetParticleOpacity = 0;
        if (this.overlay) this.overlay.classList.add('fade-out');
        return this.wait(800); // Reaches ~7.3s-7.5s
      })
      .then(() => {
        this.complete();
      })
      .catch((err) => {
        console.warn('Intro animation interrupted:', err);
        this.complete();
      });
  }

  /**
   * Fast reduced-motion fallback sequence (1s brief display)
   */
  playReducedMotionSequence() {
    if (this.sphereWrapper) this.sphereWrapper.classList.add('visible');
    if (this.logoBox) this.logoBox.classList.add('visible');
    this.titleLetters.forEach(l => l.classList.add('visible'));
    if (this.authorEl) this.authorEl.classList.add('visible');
    if (this.taglineEl) this.taglineEl.classList.add('visible');

    this.wait(1000).then(() => {
      if (this.overlay) this.overlay.classList.add('fade-out');
      return this.wait(400);
    }).then(() => {
      this.complete();
    });
  }

  /**
   * Finalizes intro, cleans DOM, cancels frames and invokes caller callback
   */
  complete() {
    if (!this.isRunning) return;
    this.stop();

    if (typeof this.onCompleteCallback === 'function') {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  /**
   * Halts all animation, stops rendering loop, cleans up listeners & timers
   */
  stop() {
    this.isRunning = false;

    // Clear all pending timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];

    // Cancel animation frame
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Remove window resize listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.boundResize);
    }

    // Remove or empty overlay
    if (this.overlay) {
      if (this.isOwnContainer && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      } else {
        this.overlay.innerHTML = '';
        this.overlay.classList.remove('flux-intro-overlay', 'fade-out');
      }
      this.overlay = null;
    }
  }
}

// Global window attachment for non-module script compatibility
if (typeof window !== 'undefined') {
  window.IntroAnimation = IntroAnimation;
}
