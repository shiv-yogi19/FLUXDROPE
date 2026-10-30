/**
 * FLUXDROPE - Expired Session Controller & Animations
 * Displays frosted glass expired session UI, rotating 3D particle sphere,
 * particle dissolution effects, and automated redirection.
 *
 * Created By Shiv Yogi
 */

export class ExpiredSessionController {
  constructor(options = {}) {
    this.options = {
      redirectDelay: 5000,
      homeUrl: '/',
      ...options
    };

    this.sessionId = null;
    this.container = null;
    this.uiElement = null;
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.countdownInterval = null;
    this.particles = [];
    this.spherePoints = [];
    this.rotationAngle = 0;
    this.dissolveProgress = 0;
  }

  /**
   * Initialize expired session view
   * @param {string} sessionId
   * @param {HTMLElement|string|null} container
   */
  async init(sessionId = null, container = null) {
    this.sessionId = sessionId;

    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else if (container instanceof HTMLElement) {
      this.container = container;
    } else if (typeof document !== 'undefined') {
      this.container = document.body;
    }

    this.renderUI();
    this.initParticleSphere();
    this.showExpiredAnimation();
    this.startCountdown();

    return this;
  }

  /**
   * Render expired session overlay with glassmorphism aesthetic
   */
  renderUI() {
    if (!this.container || typeof document === 'undefined') return;

    // Create wrapper overlay
    this.uiElement = document.createElement('div');
    this.uiElement.className = 'fluxdrope-expired-overlay';
    this.uiElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, rgba(16, 17, 34, 0.96) 0%, rgba(6, 7, 12, 0.98) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #ffffff;
      padding: 24px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.4s ease;
    `;

    // Card container
    const card = document.createElement('div');
    card.className = 'fluxdrope-expired-card';
    card.style.cssText = `
      position: relative;
      background: rgba(22, 24, 45, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(244, 63, 94, 0.2);
      border-radius: 28px;
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
    `;

    // Canvas for 3D sphere and particle dissolve
    this.canvas = document.createElement('canvas');
    this.canvas.width = 240;
    this.canvas.height = 240;
    this.canvas.style.cssText = `
      width: 180px;
      height: 180px;
      margin-bottom: 20px;
      filter: drop-shadow(0 0 16px rgba(244, 63, 94, 0.4));
    `;
    this.ctx = this.canvas.getContext('2d');

    // Title
    const title = document.createElement('h2');
    title.innerText = 'Transfer Session Expired';
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 40%, #f43f5e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    `;

    // Subtitle description
    const desc = document.createElement('p');
    desc.innerText = 'This P2P session has ended due to the 30-minute security TTL limit or peer disconnection. Files were never stored on our servers.';
    desc.style.cssText = `
      margin: 0 0 24px 0;
      font-size: 14px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.65);
    `;

    // Countdown / status badge
    const badge = document.createElement('div');
    badge.id = 'fluxdrope-countdown-badge';
    badge.innerText = `Redirecting to home in ${Math.ceil(this.options.redirectDelay / 1000)}s...`;
    badge.style.cssText = `
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 16px;
      border-radius: 999px;
      margin-bottom: 24px;
    `;

    // Action button
    const actionBtn = document.createElement('button');
    actionBtn.innerText = 'Create New Transfer';
    actionBtn.style.cssText = `
      background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
      color: #070913;
      border: none;
      outline: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 14px;
      cursor: pointer;
      box-shadow: 0 8px 24px -4px rgba(0, 242, 254, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    actionBtn.onmouseenter = () => {
      actionBtn.style.transform = 'translateY(-2px) scale(1.02)';
      actionBtn.style.boxShadow = '0 12px 28px -4px rgba(0, 242, 254, 0.6)';
    };
    actionBtn.onmouseleave = () => {
      actionBtn.style.transform = 'none';
      actionBtn.style.boxShadow = '0 8px 24px -4px rgba(0, 242, 254, 0.4)';
    };
    actionBtn.onclick = () => {
      this.redirectHome(0);
    };

    // Signature credit
    const credit = document.createElement('div');
    credit.innerText = 'FLUXDROPE • Created By Shiv Yogi';
    credit.style.cssText = `
      margin-top: 24px;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.3);
    `;

    card.appendChild(this.canvas);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(badge);
    card.appendChild(actionBtn);
    card.appendChild(credit);

    this.uiElement.appendChild(card);
    this.container.appendChild(this.uiElement);

    // Fade in
    requestAnimationFrame(() => {
      this.uiElement.style.opacity = '1';
    });
  }

  /**
   * Initialize 3D points for the rotating wireframe/particle sphere
   */
  initParticleSphere() {
    this.spherePoints = [];
    const radius = 70;
    const count = 220;

    // Fibonacci sphere distribution
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      this.spherePoints.push({
        origX: x * radius,
        origY: y * radius,
        origZ: z * radius,
        x: x * radius,
        y: y * radius,
        z: z * radius,
        // Dissolve velocity
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - Math.random() * 2,
        vz: (Math.random() - 0.5) * 4,
        alpha: 1
      });
    }
  }

  /**
   * Trigger particle dissolve and sphere rotation animation loop
   */
  showExpiredAnimation() {
    if (!this.ctx || !this.canvas) return;

    const render = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;

      this.rotationAngle += 0.02;
      this.dissolveProgress += 0.005;

      const cos = Math.cos(this.rotationAngle);
      const sin = Math.sin(this.rotationAngle);

      for (let i = 0; i < this.spherePoints.length; i++) {
        const p = this.spherePoints[i];

        // 3D Y-axis rotation
        const rotX = p.origX * cos - p.origZ * sin;
        const rotZ = p.origZ * cos + p.origX * sin;
        const rotY = p.origY;

        // Dissolve drift after threshold
        if (this.dissolveProgress > 0.4) {
          const factor = (this.dissolveProgress - 0.4) * 2;
          p.x = rotX + p.vx * factor * 10;
          p.y = rotY + p.vy * factor * 10;
          p.z = rotZ + p.vz * factor * 10;
          p.alpha = Math.max(0, 1 - factor);
        } else {
          p.x = rotX;
          p.y = rotY;
          p.z = rotZ;
        }

        // Perspective projection
        const fov = 200;
        const scale = fov / (fov + p.z + 100);
        const screenX = cx + p.x * scale;
        const screenY = cy + p.y * scale;
        const size = Math.max(1, 2.5 * scale);

        // Color based on depth and dissolve
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        const r = 244;
        const g = Math.floor(63 + scale * 40);
        const b = Math.floor(94 + scale * 80);
        this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha * Math.min(1, scale * 1.2)})`;
        this.ctx.fill();
      }

      // Outer warning ring
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 95, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(244, 63, 94, ${Math.max(0, 0.25 - this.dissolveProgress * 0.2)})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Start countdown timer to redirect
   */
  startCountdown() {
    let remainingMs = this.options.redirectDelay;
    const badge = this.uiElement ? this.uiElement.querySelector('#fluxdrope-countdown-badge') : null;

    this.countdownInterval = setInterval(() => {
      remainingMs -= 1000;
      if (badge && remainingMs >= 0) {
        badge.innerText = `Redirecting to home in ${Math.ceil(remainingMs / 1000)}s...`;
      }

      if (remainingMs <= 0) {
        clearInterval(this.countdownInterval);
        this.redirectHome(0);
      }
    }, 1000);
  }

  /**
   * Redirect back to application home screen
   * @param {number} delayMs
   */
  redirectHome(delayMs = 0) {
    this.cleanup();

    const doRedirect = () => {
      if (typeof window !== 'undefined') {
        if (window.location.hash || window.location.search) {
          window.location.href = window.location.origin + window.location.pathname;
        } else {
          window.location.reload();
        }
      }
    };

    if (delayMs > 0) {
      setTimeout(doRedirect, delayMs);
    } else {
      doRedirect();
    }
  }

  /**
   * Clean up timers, animation frames, and DOM elements
   */
  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.uiElement && this.uiElement.parentNode) {
      this.uiElement.parentNode.removeChild(this.uiElement);
      this.uiElement = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.ExpiredSessionController = ExpiredSessionController;
}

export default ExpiredSessionController;
