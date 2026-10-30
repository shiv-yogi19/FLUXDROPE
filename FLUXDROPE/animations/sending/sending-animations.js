/**
 * FLUXDROPE - Sending Animation Suite
 * Author: Shiv Yogi
 * 
 * 7 high-performance, GPU-accelerated transfer animations for file sending states:
 * 1. EnergyTunnel - Concentric vortex warp tunnel in electric blue & purple
 * 2. QuantumParticles - Entangled quantum dots converging from edges to center
 * 3. HolographicBeam - High-intensity vertical scan beam with rising data packets
 * 4. LiquidGlassFlow - Fluid glassmorphism metaball streams from left to right
 * 5. OrbitalTransfer - Planetary/satellite elliptical transfer trajectory arcs
 * 6. CyberStream - Matrix-style vertical cryptographic hexadecimal cascading streams
 * 7. CrystalTransmission - Faceted 3D crystal lattice forming, rotating, and emitting shards
 * 
 * Managed via SendingAnimationManager with randomized non-repeating selection.
 */

// ============================================================================
// Helper Utilities for Canvas & Math
// ============================================================================

function setupCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.borderRadius = 'inherit';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = rect.width || 320;
  const height = rect.height || 240;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  return { canvas, ctx, width, height, dpr };
}

// ============================================================================
// 1. EnergyTunnel
// ============================================================================
export class EnergyTunnel {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.rings = [];
    this.numRings = 14;
    this.colors = ['#00f0ff', '#3b82f6', '#8b5cf6', '#d946ef', '#38bdf8'];

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.rings = [];
    for (let i = 0; i < this.numRings; i++) {
      this.rings.push({
        phase: i / this.numRings,
        speed: 0.008 + Math.random() * 0.004,
        color: this.colors[i % this.colors.length],
        rotation: (Math.random() - 0.5) * 0.02,
        angle: Math.random() * Math.PI * 2
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = (timestamp) => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.02 + this.progress * 0.03;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.hypot(cx, cy);

    // Deep space backdrop with slight motion blur
    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(cx, cy);

    // Radial perspective streaks towards singularity
    const streakCount = 12;
    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2 + this.time * 0.2;
      const x1 = Math.cos(angle) * (15 + (1 - this.progress) * 10);
      const y1 = Math.sin(angle) * (15 + (1 - this.progress) * 10);
      const x2 = Math.cos(angle) * maxRadius;
      const y2 = Math.sin(angle) * maxRadius;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1 + this.progress * 1.5;
      ctx.stroke();
    }

    // Concentric Inward-Moving Warp Rings
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      // Move phase inward (1 -> 0)
      r.phase = (r.phase - (0.007 + this.progress * 0.015)) % 1;
      if (r.phase < 0) r.phase += 1;

      // Exponential perspective scaling
      const radius = Math.pow(r.phase, 1.8) * maxRadius;
      const alpha = Math.sin(r.phase * Math.PI) * (0.35 + this.progress * 0.65);

      if (radius > 1) {
        ctx.save();
        ctx.rotate(this.time * 0.3 * (i % 2 === 0 ? 1 : -1));

        ctx.beginPath();
        // Elliptical warp ring
        ctx.ellipse(0, 0, radius, radius * 0.75, 0, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.2 + (1 - r.phase) * 3;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 12 * (1 - r.phase);
        ctx.stroke();

        // Pulsating quantum data nodules on rings
        const numNodules = 3;
        for (let j = 0; j < numNodules; j++) {
          const noduleAngle = (j / numNodules) * Math.PI * 2 + this.time * 2;
          const nx = Math.cos(noduleAngle) * radius;
          const ny = Math.sin(noduleAngle) * (radius * 0.75);
          ctx.beginPath();
          ctx.arc(nx, ny, 2 + this.progress * 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // Central Energy Singularity Core
    const corePulse = 14 + Math.sin(this.time * 6) * 4 + this.progress * 12;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, corePulse * 2.5);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.35, '#00f0ff');
    coreGrad.addColorStop(0.7, '#8b5cf6');
    coreGrad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(0, 0, corePulse * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.globalAlpha = 0.9;
    ctx.fill();

    // Core central crystal point
    ctx.beginPath();
    ctx.arc(0, 0, 6 + this.progress * 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fill();

    ctx.restore();
  }
}

// ============================================================================
// 2. QuantumParticles
// ============================================================================
export class QuantumParticles {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.particles = [];
    this.numParticles = 90;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxDist = Math.hypot(cx, cy) * 1.1;
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * maxDist;

    return {
      angle: angle,
      dist: dist,
      speed: 0.8 + Math.random() * 1.8,
      size: 1.5 + Math.random() * 2.5,
      color: Math.random() > 0.4 ? '#00f0ff' : (Math.random() > 0.5 ? '#a855f7' : '#ffffff'),
      alpha: 0.2 + Math.random() * 0.8,
      spiral: (Math.random() - 0.5) * 0.03
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.02;
    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.fillStyle = 'rgba(6, 8, 20, 0.25)';
    ctx.fillRect(0, 0, this.width, this.height);

    const speedMultiplier = 1 + this.progress * 3.5;
    const activeRadius = 15 + (1 - this.progress) * 10;

    // Entangled connection lines between neighboring particles
    for (let i = 0; i < this.particles.length; i += 2) {
      const p1 = this.particles[i];
      const p2 = this.particles[(i + 1) % this.particles.length];
      const x1 = cx + Math.cos(p1.angle) * p1.dist;
      const y1 = cy + Math.sin(p1.angle) * p1.dist;
      const x2 = cx + Math.cos(p2.angle) * p2.dist;
      const y2 = cy + Math.sin(p2.angle) * p2.dist;
      const d = Math.hypot(x2 - x1, y2 - y1);

      if (d < 65) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(0, 240, 255, ' + (0.35 * (1 - d / 65) * (0.4 + this.progress * 0.6)) + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Render & update quantum particles converging to center
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Converge distance inward
      p.dist -= p.speed * speedMultiplier;
      p.angle += p.spiral * speedMultiplier;

      // Respawn at outer edge when reached center core
      if (p.dist <= activeRadius) {
        this.particles[i] = this.createParticle();
        continue;
      }

      const x = cx + Math.cos(p.angle) * p.dist;
      const y = cy + Math.sin(p.angle) * p.dist;

      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.8 + this.progress * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();

      // Trailing quantum wave particle streak
      const tailX = cx + Math.cos(p.angle - 0.05) * (p.dist + 8);
      const tailY = cy + Math.sin(p.angle - 0.05) * (p.dist + 8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = p.alpha * 0.4;
      ctx.lineWidth = p.size * 0.6;
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    // Quantum Core Condenser
    const pulse = 10 + Math.sin(this.time * 5) * 3 + this.progress * 8;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#00f0ff');
    grad.addColorStop(0.8, '#8b5cf6');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx, cy, pulse * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

// ============================================================================
// 3. HolographicBeam
// ============================================================================
export class HolographicBeam {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.packets = [];
    this.numPackets = 22;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.packets = [];
    for (let i = 0; i < this.numPackets; i++) {
      this.packets.push({
        y: Math.random() * this.height,
        xOffset: (Math.random() - 0.5) * 34,
        speed: 2 + Math.random() * 3,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.3 ? '#00ffcc' : '#10b981',
        hex: Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.03;
    const cx = this.width / 2;
    const baseY = this.height - 18;

    ctx.fillStyle = 'rgba(6, 12, 16, 0.3)';
    ctx.fillRect(0, 0, this.width, this.height);

    const beamWidth = 40 + this.progress * 30 + Math.sin(this.time * 4) * 6;

    // Vertical Holographic Light Column
    const beamGrad = ctx.createLinearGradient(cx - beamWidth / 2, 0, cx + beamWidth / 2, 0);
    beamGrad.addColorStop(0, 'rgba(0, 255, 204, 0)');
    beamGrad.addColorStop(0.2, 'rgba(16, 185, 129, 0.18)');
    beamGrad.addColorStop(0.5, 'rgba(0, 255, 204, 0.55)');
    beamGrad.addColorStop(0.8, 'rgba(16, 185, 129, 0.18)');
    beamGrad.addColorStop(1, 'rgba(0, 255, 204, 0)');

    ctx.fillStyle = beamGrad;
    ctx.fillRect(cx - beamWidth / 2, 0, beamWidth, baseY);

    // High-Intensity Center Core Laser
    const coreGrad = ctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    coreGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

    ctx.fillStyle = coreGrad;
    ctx.fillRect(cx - 3, 0, 6, baseY);

    // Emitter Base Elliptical Rings
    const emitterRadii = [35, 24, 12];
    for (let r of emitterRadii) {
      ctx.beginPath();
      ctx.ellipse(cx, baseY, r, r * 0.35, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    // Dynamic Vertical Scan Lines sweeping downwards
    const scanLineCount = 8;
    for (let i = 0; i < scanLineCount; i++) {
      const scanY = ((this.time * 70 + i * (baseY / scanLineCount)) % baseY);
      ctx.beginPath();
      ctx.moveTo(cx - beamWidth / 2, scanY);
      ctx.lineTo(cx + beamWidth / 2, scanY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Ascending Holographic Data Packets
    const packetSpeed = 2 + this.progress * 4;
    ctx.font = '10px monospace';
    for (let p of this.packets) {
      p.y -= p.speed * (packetSpeed / 3);
      if (p.y < 0) {
        p.y = baseY;
        p.xOffset = (Math.random() - 0.5) * (beamWidth * 0.7);
        p.hex = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
      }

      const px = cx + p.xOffset;
      const alpha = Math.min(1, Math.sin((p.y / baseY) * Math.PI));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(px - p.size / 2, p.y - p.size / 2, p.size, p.size);

      // Micro hex code indicator
      ctx.fillStyle = p.color;
      ctx.fillText(p.hex, px + p.size, p.y + 3);
      ctx.restore();
    }
  }
}

// ============================================================================
// 4. LiquidGlassFlow
// ============================================================================
export class LiquidGlassFlow {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.bubbles = [];
    this.numBubbles = 20;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.bubbles = [];
    for (let i = 0; i < this.numBubbles; i++) {
      this.bubbles.push({
        x: Math.random() * this.width,
        y: this.height * 0.4 + Math.random() * (this.height * 0.4),
        radius: 3 + Math.random() * 7,
        vx: 1.5 + Math.random() * 3,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.03 + this.progress * 0.04;
    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    const midY = this.height * 0.55;
    const waveSpeed = this.time * 2.5;

    // Three layered fluid sine waves flowing left to right
    const layers = [
      { color: 'rgba(59, 130, 246, 0.35)', amp: 14 + this.progress * 10, freq: 0.02, offset: 0, yShift: 10 },
      { color: 'rgba(139, 92, 246, 0.42)', amp: 18 + this.progress * 12, freq: 0.015, offset: 2, yShift: 0 },
      { color: 'rgba(0, 240, 255, 0.38)', amp: 12 + this.progress * 8, freq: 0.025, offset: 4, yShift: -8 }
    ];

    for (let layer of layers) {
      ctx.beginPath();
      ctx.moveTo(0, this.height);

      for (let x = 0; x <= this.width; x += 6) {
        const y = midY + layer.yShift + Math.sin(x * layer.freq + waveSpeed + layer.offset) * layer.amp;
        if (x === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(this.width, this.height);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    }

    // Specular Glass Top Crest Highlight
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 4) {
      const y = midY - 8 + Math.sin(x * 0.025 + waveSpeed + 4) * (12 + this.progress * 8);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Floating Glass Droplets / Bubbles
    const bubbleSpeed = 1.5 + this.progress * 3.5;
    for (let b of this.bubbles) {
      b.x += b.vx * (bubbleSpeed / 2);
      b.wobble += 0.05;
      const wy = b.y + Math.sin(b.wobble) * 4;

      if (b.x > this.width + b.radius) {
        b.x = -b.radius;
        b.y = this.height * 0.45 + Math.random() * (this.height * 0.4);
      }

      // Glass bubble body
      const bubbleGrad = ctx.createRadialGradient(
        b.x - b.radius * 0.3, wy - b.radius * 0.3, b.radius * 0.1,
        b.x, wy, b.radius
      );
      bubbleGrad.addColorStop(0, '#ffffff');
      bubbleGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.6)');
      bubbleGrad.addColorStop(0.9, 'rgba(139, 92, 246, 0.4)');
      bubbleGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');

      ctx.beginPath();
      ctx.arc(b.x, wy, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = bubbleGrad;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      ctx.fill();

      // Specular pin highlight
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.35, wy - b.radius * 0.35, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

// ============================================================================
// 5. OrbitalTransfer
// ============================================================================
export class OrbitalTransfer {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.packets = [];
    this.numPackets = 16;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.packets = [];
    for (let i = 0; i < this.numPackets; i++) {
      this.packets.push({
        t: i / this.numPackets,
        speed: 0.006 + Math.random() * 0.005,
        size: 3 + Math.random() * 2.5,
        color: i % 2 === 0 ? '#00f0ff' : '#c084fc'
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.02;
    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    const senderX = this.width * 0.22;
    const senderY = this.height * 0.5;
    const receiverX = this.width * 0.78;
    const receiverY = this.height * 0.5;

    // Sender Node Halo & Orbit
    ctx.beginPath();
    ctx.arc(senderX, senderY, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(senderX, senderY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Receiver Node Halo & Orbit
    ctx.beginPath();
    ctx.arc(receiverX, receiverY, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(receiverX, receiverY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#8b5cf6';
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Transfer Orbital Elliptical Guide Arc
    ctx.beginPath();
    ctx.moveTo(senderX, senderY);
    ctx.bezierCurveTo(senderX + 30, senderY - 55, receiverX - 30, receiverY - 55, receiverX, receiverY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(senderX, senderY);
    ctx.bezierCurveTo(senderX + 30, senderY + 55, receiverX - 30, receiverY + 55, receiverX, receiverY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // File-Packet Traveling Trajectories
    const speedMult = 1 + this.progress * 2.5;
    for (let p of this.packets) {
      p.t = (p.t + p.speed * speedMult) % 1;

      // Cubic Bezier evaluation
      const t = p.t;
      const isTopArc = p.size > 4.2;
      const controlY = isTopArc ? -55 : 55;

      const p0x = senderX, p0y = senderY;
      const p1x = senderX + 30, p1y = senderY + controlY;
      const p2x = receiverX - 30, p2y = receiverY + controlY;
      const p3x = receiverX, p3y = receiverY;

      const bx = Math.pow(1 - t, 3) * p0x + 3 * Math.pow(1 - t, 2) * t * p1x + 3 * (1 - t) * Math.pow(t, 2) * p2x + Math.pow(t, 3) * p3x;
      const by = Math.pow(1 - t, 3) * p0y + 3 * Math.pow(1 - t, 2) * t * p1y + 3 * (1 - t) * Math.pow(t, 2) * p2y + Math.pow(t, 3) * p3y;

      // File-packet dot
      ctx.beginPath();
      ctx.arc(bx, by, p.size, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();

      // Photon comet tail
      const prevT = Math.max(0, t - 0.04);
      const tailX = Math.pow(1 - prevT, 3) * p0x + 3 * Math.pow(1 - prevT, 2) * prevT * p1x + 3 * (1 - prevT) * Math.pow(prevT, 2) * p2x + Math.pow(prevT, 3) * p3x;
      const tailY = Math.pow(1 - prevT, 3) * p0y + 3 * Math.pow(1 - prevT, 2) * prevT * p1y + 3 * (1 - prevT) * Math.pow(prevT, 2) * p2y + Math.pow(prevT, 3) * p3y;

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.8;
      ctx.globalAlpha = 0.65;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }
}

// ============================================================================
// 6. CyberStream
// ============================================================================
export class CyberStream {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.columns = [];
    this.fontSize = 13;
    this.chars = '0123456789ABCDEFλφΔΩΨ§⚡';

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    const numCols = Math.floor(this.width / this.fontSize);
    this.columns = [];
    for (let i = 0; i < numCols; i++) {
      this.columns.push({
        x: i * this.fontSize,
        y: Math.random() * -this.height,
        speed: 2 + Math.random() * 4,
        tailLength: 8 + Math.floor(Math.random() * 12)
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = 'rgba(6, 8, 20, 0.32)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `${this.fontSize}px monospace`;
    const speedMult = 1 + this.progress * 2.5;

    for (let col of this.columns) {
      col.y += col.speed * speedMult;

      if (col.y - col.tailLength * this.fontSize > this.height) {
        col.y = Math.random() * -60;
        col.speed = 2 + Math.random() * 4;
      }

      // Render tail characters with phosphorescent fade
      for (let j = 0; j < col.tailLength; j++) {
        const charY = col.y - j * this.fontSize;
        if (charY < 0 || charY > this.height) continue;

        const char = this.chars[Math.floor(Math.random() * this.chars.length)];
        const ratio = 1 - j / col.tailLength;

        if (j === 0) {
          // Leading character: bright white/cyan neon
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = `rgba(0, 240, 255, ${ratio * 0.75})`;
          ctx.shadowBlur = 0;
        }

        ctx.fillText(char, col.x, charY);
      }
    }
  }
}

// ============================================================================
// 7. CrystalTransmission
// ============================================================================
export class CrystalTransmission {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.canvas = null;
    this.ctx = null;
    this.width = 300;
    this.height = 200;
    this.progress = 0;
    this.isRunning = false;
    this.animId = null;
    this.time = 0;
    this.shards = [];
    this.numShards = 25;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.shards = [];
    for (let i = 0; i < this.numShards; i++) {
      this.shards.push(this.createShard());
    }
  }

  createShard() {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: 0,
      y: 0,
      vx: Math.cos(angle) * (1.2 + Math.random() * 2.8),
      vy: Math.sin(angle) * (1.2 + Math.random() * 2.8),
      size: 2 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      alpha: 1,
      life: 0,
      maxLife: 35 + Math.random() * 40,
      color: Math.random() > 0.5 ? '#00f0ff' : '#d946ef'
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.time += 0.025 + this.progress * 0.04;
    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(cx, cy);

    // 3D Rotating Crystal Octahedron Facets
    const rot = this.time * 1.4;
    const crystalSize = 36 + this.progress * 14 + Math.sin(this.time * 3) * 4;

    const vertices = [
      { x: 0, y: -crystalSize * 1.2, z: 0 }, // Top vertex
      { x: Math.cos(rot) * crystalSize, y: 0, z: Math.sin(rot) * crystalSize },
      { x: Math.cos(rot + Math.PI / 2) * crystalSize, y: 0, z: Math.sin(rot + Math.PI / 2) * crystalSize },
      { x: Math.cos(rot + Math.PI) * crystalSize, y: 0, z: Math.sin(rot + Math.PI) * crystalSize },
      { x: Math.cos(rot + Math.PI * 1.5) * crystalSize, y: 0, z: Math.sin(rot + Math.PI * 1.5) * crystalSize },
      { x: 0, y: crystalSize * 1.2, z: 0 } // Bottom vertex
    ];

    // Project and render triangular faces
    const faces = [
      [0, 1, 2, 'rgba(0, 240, 255, 0.45)'],
      [0, 2, 3, 'rgba(139, 92, 246, 0.45)'],
      [0, 3, 4, 'rgba(217, 70, 239, 0.45)'],
      [0, 4, 1, 'rgba(56, 189, 248, 0.45)'],
      [5, 2, 1, 'rgba(59, 130, 246, 0.4)'],
      [5, 3, 2, 'rgba(139, 92, 246, 0.4)'],
      [5, 4, 3, 'rgba(217, 70, 239, 0.4)'],
      [5, 1, 4, 'rgba(0, 240, 255, 0.4)']
    ];

    for (let face of faces) {
      const v0 = vertices[face[0]];
      const v1 = vertices[face[1]];
      const v2 = vertices[face[2]];

      ctx.beginPath();
      ctx.moveTo(v0.x, v0.y);
      ctx.lineTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.closePath();

      ctx.fillStyle = face[3];
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Emitting Shards / Photon Splinters
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      s.life++;
      s.x += s.vx * (1 + this.progress * 2);
      s.y += s.vy * (1 + this.progress * 2);
      s.rotation += s.rotSpeed;
      s.alpha = Math.max(0, 1 - s.life / s.maxLife);

      if (s.life >= s.maxLife) {
        this.shards[i] = this.createShard();
        continue;
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -s.size);
      ctx.lineTo(s.size * 0.6, s.size);
      ctx.lineTo(-s.size * 0.6, s.size);
      ctx.closePath();

      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ============================================================================
// SendingAnimationManager
// ============================================================================
export const SENDING_ANIMATIONS = [
  { id: 'energy-tunnel', name: 'Energy Tunnel', class: EnergyTunnel },
  { id: 'quantum-particles', name: 'Quantum Particles', class: QuantumParticles },
  { id: 'holographic-beam', name: 'Holographic Beam', class: HolographicBeam },
  { id: 'liquid-glass-flow', name: 'Liquid Glass Flow', class: LiquidGlassFlow },
  { id: 'orbital-transfer', name: 'Orbital Transfer', class: OrbitalTransfer },
  { id: 'cyber-stream', name: 'Cyber Stream', class: CyberStream },
  { id: 'crystal-transmission', name: 'Crystal Transmission', class: CrystalTransmission }
];

export class SendingAnimationManager {
  static animations = SENDING_ANIMATIONS;

  /**
   * Returns a random sending animation descriptor, avoiding consecutive repeats
   * @param {string} [previousId] ID of the animation previously played
   * @returns {Object} { id, name, class }
   */
  static getRandomAnimation(previousId) {
    const candidates = this.animations.filter(a => a.id !== previousId);
    const pool = candidates.length > 0 ? candidates : this.animations;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  }

  /**
   * Instantiates an animation by ID (or a random one if ID not matched)
   * @param {string} id 
   * @param {HTMLElement|string} container 
   * @returns {Object} Instantiated animation controller
   */
  static createAnimation(id, container) {
    const target = this.animations.find(a => a.id === id) || this.getRandomAnimation();
    return new target.class(container);
  }
}

// Window global fallback
if (typeof window !== 'undefined') {
  window.EnergyTunnel = EnergyTunnel;
  window.QuantumParticles = QuantumParticles;
  window.HolographicBeam = HolographicBeam;
  window.LiquidGlassFlow = LiquidGlassFlow;
  window.OrbitalTransfer = OrbitalTransfer;
  window.CyberStream = CyberStream;
  window.CrystalTransmission = CrystalTransmission;
  window.SendingAnimationManager = SendingAnimationManager;
}
