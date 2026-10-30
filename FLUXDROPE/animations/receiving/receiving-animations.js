/**
 * FLUXDROPE - Receiving Animation Suite
 * Author: Shiv Yogi
 * 
 * 7 high-performance, GPU-accelerated transfer animations for file receiving states:
 * 1. DigitalMaterialization - Pixels materializing from entropy noise into FLUXDROPE emblem
 * 2. CrystalFormation - Interlocking crystalline lattice nucleating into a faceted gem shield
 * 3. EnergyReception - Inward converging harmonic shockwaves absorbed into core receiver
 * 4. OrbitalCapture - Inbound hyperbolic particles captured into stable attractor orbits
 * 5. HolographicAssembly - Volumetric wireframe layer-by-layer isometric assembly
 * 6. LiquidGlassReveal - Translucent fluid glass droplets merging to reveal payload icon
 * 7. QuantumArrival - Dispersed probability cloud collapsing to a localized quantum drop
 * 
 * Managed via ReceivingAnimationManager with randomized non-repeating selection.
 */

// ============================================================================
// Canvas Helper
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
// 1. DigitalMaterialization
// ============================================================================
export class DigitalMaterialization {
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
    this.pixels = [];
    this.targetEmblem = [];

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    // Build target emblem pixel coordinates (Hexagonal FLUXDROPE shield)
    this.targetEmblem = [];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const size = Math.min(this.width, this.height) * 0.28;

    for (let r = 0; r < 6; r++) {
      const a1 = (r / 6) * Math.PI * 2;
      const a2 = ((r + 1) / 6) * Math.PI * 2;
      const x1 = cx + Math.cos(a1) * size;
      const y1 = cy + Math.sin(a1) * size;
      const x2 = cx + Math.cos(a2) * size;
      const y2 = cy + Math.sin(a2) * size;

      for (let step = 0; step < 16; step++) {
        const t = step / 16;
        this.targetEmblem.push({
          tx: x1 + (x2 - x1) * t,
          ty: y1 + (y2 - y1) * t,
          color: r % 2 === 0 ? '#00f0ff' : '#8b5cf6'
        });
      }
    }

    // Inner monogram pixels
    for (let y = -size * 0.5; y <= size * 0.5; y += 7) {
      this.targetEmblem.push({ tx: cx - 14, ty: cy + y, color: '#38bdf8' });
      this.targetEmblem.push({ tx: cx + 14, ty: cy + y, color: '#c084fc' });
    }
    this.targetEmblem.push({ tx: cx, ty: cy, color: '#ffffff' });

    // Initialize randomized noisy particles
    this.pixels = [];
    for (let i = 0; i < this.targetEmblem.length; i++) {
      this.pixels.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        target: this.targetEmblem[i],
        noiseSpeed: 1 + Math.random() * 2,
        entropy: 1
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
    ctx.fillStyle = 'rgba(6, 8, 20, 0.3)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Scanline sweeping vertically
    const scanY = (this.time * 90) % this.height;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.fillRect(0, scanY, this.width, 3);

    // Interpolate pixels from noise to target emblem
    const coherence = Math.pow(this.progress, 1.2);

    for (let p of this.pixels) {
      // Noise jitter reduces as coherence increases
      const jitter = (1 - coherence) * 25;
      const jx = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;

      // Ease towards target position
      p.x += (p.target.tx + jx - p.x) * (0.08 + coherence * 0.12);
      p.y += (p.target.ty + jy - p.y) * (0.08 + coherence * 0.12);

      const pixelSize = 2.5 + coherence * 1.5;

      ctx.beginPath();
      ctx.rect(p.x - pixelSize / 2, p.y - pixelSize / 2, pixelSize, pixelSize);
      ctx.fillStyle = coherence > 0.8 ? p.target.color : (Math.random() > 0.5 ? '#00f0ff' : '#d946ef');
      ctx.shadowColor = p.target.color;
      ctx.shadowBlur = coherence > 0.6 ? 8 : 2;
      ctx.fill();
    }

    // Materialized crystal perimeter lines at high coherence
    if (coherence > 0.6) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const size = Math.min(this.width, this.height) * 0.28;

      ctx.beginPath();
      for (let r = 0; r < 6; r++) {
        const a = (r / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * size;
        const y = cy + Math.sin(a) * size;
        if (r === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (coherence - 0.6) * 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }
}

// ============================================================================
// 2. CrystalFormation
// ============================================================================
export class CrystalFormation {
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
    this.nodes = [];
    this.edges = [];

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    // Create crystalline lattice nodes
    this.nodes = [];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxR = Math.min(this.width, this.height) * 0.38;

    this.nodes.push({ x: cx, y: cy, order: 0 }); // Center nucleation point

    // Concentric geometric rings of lattice nodes
    const rings = [
      { count: 6, r: maxR * 0.35, order: 1 },
      { count: 12, r: maxR * 0.7, order: 2 },
      { count: 6, r: maxR * 1.05, order: 3 }
    ];

    for (let ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + (ring.order % 2 === 0 ? Math.PI / 12 : 0);
        this.nodes.push({
          x: cx + Math.cos(angle) * ring.r,
          y: cy + Math.sin(angle) * ring.r,
          order: ring.order
        });
      }
    }

    // Connect nearest nodes to form crystal facets
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].y - this.nodes[j].y);
        if (d < maxR * 0.45) {
          this.edges.push({
            from: this.nodes[i],
            to: this.nodes[j],
            maxOrder: Math.max(this.nodes[i].order, this.nodes[j].order),
            length: d
          });
        }
      }
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
    ctx.fillStyle = 'rgba(6, 8, 20, 0.3)';
    ctx.fillRect(0, 0, this.width, this.height);

    const activeThreshold = this.progress * 3.2; // 0 to 3.2 order threshold

    // Render crystal lattice connecting struts
    for (let e of this.edges) {
      if (e.maxOrder <= activeThreshold + 0.3) {
        const progressForEdge = Math.min(1, (activeThreshold - (e.maxOrder - 1)));
        if (progressForEdge <= 0) continue;

        const curX = e.from.x + (e.to.x - e.from.x) * progressForEdge;
        const curY = e.from.y + (e.to.y - e.from.y) * progressForEdge;

        ctx.beginPath();
        ctx.moveTo(e.from.x, e.from.y);
        ctx.lineTo(curX, curY);

        ctx.strokeStyle = e.maxOrder === 1 ? '#00f0ff' : (e.maxOrder === 2 ? '#8b5cf6' : '#d946ef');
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.stroke();
      }
    }

    // Render lattice seed nodes
    for (let n of this.nodes) {
      if (n.order <= activeThreshold + 0.2) {
        const nodePulse = 3 + Math.sin(this.time * 4 + n.order) * 1.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, nodePulse, 0, Math.PI * 2);
        ctx.fillStyle = n.order === 0 ? '#ffffff' : (n.order === 1 ? '#00f0ff' : '#c084fc');
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fill();
      }
    }

    // Center faceted crystal shield sheen
    if (this.progress > 0.3) {
      const alpha = (this.progress - 0.3) * 0.5;
      const cx = this.width / 2;
      const cy = this.height / 2;
      const r = Math.min(this.width, this.height) * 0.25;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
      grad.addColorStop(0.5, `rgba(0, 240, 255, ${alpha * 0.4})`);
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

// ============================================================================
// 3. EnergyReception
// ============================================================================
export class EnergyReception {
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
    this.waves = [];
    this.numWaves = 10;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.waves = [];
    for (let i = 0; i < this.numWaves; i++) {
      this.waves.push({
        phase: i / this.numWaves,
        speed: 0.007 + Math.random() * 0.004,
        color: i % 2 === 0 ? '#00f0ff' : '#8b5cf6'
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

    this.time += 0.025;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.hypot(cx, cy);

    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    const speedMult = 1 + this.progress * 2.5;

    // Inward Converging Energy Shockwave Rings
    for (let w of this.waves) {
      // Phase travels from 1 (outer boundary) to 0 (center core)
      w.phase -= w.speed * speedMult;
      if (w.phase < 0) w.phase += 1;

      const radius = w.phase * maxRadius;
      const alpha = Math.sin(w.phase * Math.PI) * (0.3 + this.progress * 0.7);

      if (radius > 12) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 1.5 + (1 - w.phase) * 3;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = w.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;

    // Central Resonant Absorption Orb
    const orbRadius = 14 + this.progress * 22 + Math.sin(this.time * 6) * 3;
    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.35, '#00f0ff');
    orbGrad.addColorStop(0.75, '#8b5cf6');
    orbGrad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.fill();

    // Inward radial lightning spokes
    const spokeCount = 8;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2 + this.time;
      const dist = orbRadius + 15 + Math.sin(this.time * 8 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ============================================================================
// 4. OrbitalCapture
// ============================================================================
export class OrbitalCapture {
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
    this.numParticles = 45;

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
    const maxR = Math.hypot(cx, cy) * 1.1;

    return {
      angle: Math.random() * Math.PI * 2,
      r: 40 + Math.random() * maxR,
      angularVelocity: 0.02 + Math.random() * 0.03,
      decayRate: 0.3 + Math.random() * 0.7,
      size: 2 + Math.random() * 2.5,
      color: Math.random() > 0.5 ? '#00f0ff' : '#d946ef',
      captured: false
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

    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Stable attractor target radius
    const stableRadius = 26 + (1 - this.progress) * 20;

    // Attractor gravity rings
    ctx.beginPath();
    ctx.arc(cx, cy, stableRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Attractor Core
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.fill();

    const speedMult = 1 + this.progress * 2;

    // Simulate spiral capture dynamics
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Spiral inward towards stable radius
      if (p.r > stableRadius) {
        p.r -= p.decayRate * speedMult;
      } else {
        // Captured in stable orbit
        p.r += (stableRadius - p.r) * 0.1;
        p.captured = true;
      }

      // Faster rotation as radius decreases (Keplerian angular momentum)
      p.angle += (p.angularVelocity * (150 / Math.max(20, p.r))) * (speedMult * 0.6);

      const px = cx + Math.cos(p.angle) * p.r;
      const py = cy + Math.sin(p.angle) * p.r;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.captured ? '#ffffff' : p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();

      // Tail trailing in orbit
      const prevAngle = p.angle - 0.18;
      const tx = cx + Math.cos(prevAngle) * (p.r + 1);
      const ty = cy + Math.sin(prevAngle) * (p.r + 1);

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.6;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }
}

// ============================================================================
// 5. HolographicAssembly
// ============================================================================
export class HolographicAssembly {
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

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;
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

    this.time += 0.025;
    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.fillStyle = 'rgba(6, 12, 18, 0.3)';
    ctx.fillRect(0, 0, this.width, this.height);

    // 3D Isometric Wireframe Box (Encrypted Payload Capsule)
    const boxW = 80;
    const boxH = 90;
    const angleX = 0.5;
    const angleY = 0.8;

    // Upward volumetric scan plane
    const scanHeight = this.height - 30 - this.progress * (this.height - 60);

    // Base projection grid
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.15)';
    ctx.lineWidth = 1;
    for (let x = -80; x <= 80; x += 20) {
      ctx.beginPath();
      ctx.moveTo(cx + x, cy + 45);
      ctx.lineTo(cx + x * 1.4, cy + 85);
      ctx.stroke();
    }

    // Wireframe isometric vertices
    const isoTop = cy - boxH / 2;
    const isoBottom = cy + boxH / 2;

    // File Capsule Isometric Coordinates
    const v = [
      { x: cx, y: isoTop - 20 },               // 0: Top peak
      { x: cx + 45, y: isoTop },              // 1: Top right
      { x: cx + 45, y: isoBottom },           // 2: Bottom right
      { x: cx, y: isoBottom + 20 },           // 3: Bottom front
      { x: cx - 45, y: isoBottom },           // 4: Bottom left
      { x: cx - 45, y: isoTop },              // 5: Top left
      { x: cx, y: cy }                        // 6: Center interior
    ];

    // Wireframe edges with progress clipping
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // Outer perimeter
      [6, 0], [6, 2], [6, 4]                           // Interior axes
    ];

    for (let [idxA, idxB] of edges) {
      const pA = v[idxA];
      const pB = v[idxB];

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);

      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.stroke();
    }

    // Scan plane sweep line
    ctx.beginPath();
    ctx.moveTo(cx - 70, scanHeight);
    ctx.lineTo(cx + 70, scanHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Floating telemetry holographic points
    for (let pt of v) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

// ============================================================================
// 6. LiquidGlassReveal
// ============================================================================
export class LiquidGlassReveal {
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
    this.blobs = [];
    this.numBlobs = 12;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.blobs = [];
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let i = 0; i < this.numBlobs; i++) {
      const angle = (i / this.numBlobs) * Math.PI * 2;
      const dist = 40 + Math.random() * 50;
      this.blobs.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        targetDist: dist,
        angle: angle,
        radius: 12 + Math.random() * 14,
        speed: 0.02 + Math.random() * 0.02
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

    this.time += 0.025;
    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Merge factor: blobs move towards center as progress approaches 1
    const merge = this.progress;

    for (let b of this.blobs) {
      b.angle += b.speed;
      const currentDist = b.targetDist * (1 - merge * 0.85);
      b.x = cx + Math.cos(b.angle) * currentDist;
      b.y = cy + Math.sin(b.angle) * currentDist;

      // Draw glass blob with refraction gradient
      const grad = ctx.createRadialGradient(
        b.x - b.radius * 0.3, b.y - b.radius * 0.3, 2,
        b.x, b.y, b.radius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.55)');
      grad.addColorStop(0.7, 'rgba(139, 92, 246, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    // Emerging center payload file icon (reveals as liquid merges)
    if (this.progress > 0.35) {
      const alpha = (this.progress - 0.35) * 1.5;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);

      // File document outline
      const fw = 28;
      const fh = 36;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(cx - fw / 2, cy - fh / 2);
      ctx.lineTo(cx + fw / 2 - 8, cy - fh / 2);
      ctx.lineTo(cx + fw / 2, cy - fh / 2 + 8);
      ctx.lineTo(cx + fw / 2, cy + fh / 2);
      ctx.lineTo(cx - fw / 2, cy + fh / 2);
      ctx.closePath();
      ctx.stroke();

      // Fold corner
      ctx.beginPath();
      ctx.moveTo(cx + fw / 2 - 8, cy - fh / 2);
      ctx.lineTo(cx + fw / 2 - 8, cy - fh / 2 + 8);
      ctx.lineTo(cx + fw / 2, cy - fh / 2 + 8);
      ctx.stroke();

      ctx.restore();
    }
  }
}

// ============================================================================
// 7. QuantumArrival
// ============================================================================
export class QuantumArrival {
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
    this.wavelets = [];
    this.numWavelets = 70;

    this.init();
  }

  init() {
    if (!this.container) return;
    const s = setupCanvas(this.container);
    this.canvas = s.canvas;
    this.ctx = s.ctx;
    this.width = s.width;
    this.height = s.height;

    this.wavelets = [];
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let i = 0; i < this.numWavelets; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 85;
      this.wavelets.push({
        baseAngle: angle,
        baseR: r,
        freq: 2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.4 ? '#00f0ff' : '#a855f7'
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
    const cy = this.height / 2;

    ctx.fillStyle = 'rgba(6, 8, 20, 0.3)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Wavefunction collapse factor: cloud contracts to a single point as progress -> 1
    const collapse = Math.pow(1 - this.progress, 1.5);

    // Quantum probability cloud particles
    for (let w of this.wavelets) {
      const oscillatingR = w.baseR * collapse + Math.sin(this.time * w.freq + w.phase) * (8 * collapse);
      const angle = w.baseAngle + this.time * 0.5;

      const px = cx + Math.cos(angle) * oscillatingR;
      const py = cy + Math.sin(angle) * oscillatingR;

      ctx.beginPath();
      ctx.arc(px, py, 1.5 + (1 - collapse) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = w.color;
      ctx.globalAlpha = 0.3 + (1 - collapse) * 0.7;
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Collapsed photon drop at center
    const photonPulse = 4 + this.progress * 12 + Math.sin(this.time * 8) * 3;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, photonPulse * 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#00f0ff');
    grad.addColorStop(0.7, '#8b5cf6');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx, cy, photonPulse * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Sharp localized core
    ctx.beginPath();
    ctx.arc(cx, cy, 4 + this.progress * 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.fill();
  }
}

// ============================================================================
// ReceivingAnimationManager
// ============================================================================
export const RECEIVING_ANIMATIONS = [
  { id: 'digital-materialization', name: 'Digital Materialization', class: DigitalMaterialization },
  { id: 'crystal-formation', name: 'Crystal Formation', class: CrystalFormation },
  { id: 'energy-reception', name: 'Energy Reception', class: EnergyReception },
  { id: 'orbital-capture', name: 'Orbital Capture', class: OrbitalCapture },
  { id: 'holographic-assembly', name: 'Holographic Assembly', class: HolographicAssembly },
  { id: 'liquid-glass-reveal', name: 'Liquid Glass Reveal', class: LiquidGlassReveal },
  { id: 'quantum-arrival', name: 'Quantum Arrival', class: QuantumArrival }
];

export class ReceivingAnimationManager {
  static animations = RECEIVING_ANIMATIONS;

  /**
   * Returns a random receiving animation descriptor, avoiding consecutive repeats
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
  window.DigitalMaterialization = DigitalMaterialization;
  window.CrystalFormation = CrystalFormation;
  window.EnergyReception = EnergyReception;
  window.OrbitalCapture = OrbitalCapture;
  window.HolographicAssembly = HolographicAssembly;
  window.LiquidGlassReveal = LiquidGlassReveal;
  window.QuantumArrival = QuantumArrival;
  window.ReceivingAnimationManager = ReceivingAnimationManager;
}
