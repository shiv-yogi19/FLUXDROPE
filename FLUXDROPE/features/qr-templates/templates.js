/**
 * FLUXDROPE - 15 Exquisite QR Code Custom Styling Templates
 * Provides thematic visual configurations, module rendering engines (dots, fluid, square, diamond, rounded),
 * gradients, frame styles, and canvas rendering utilities.
 *
 * Created By Shiv Yogi
 */

export const QR_TEMPLATES = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    label: 'Fluid Translucent',
    description: 'Bioluminescent cyan and electric azure with fluid glass refraction and rounded droplets.',
    darkColor: '#00f2fe',
    lightColor: '#0c1024',
    backgroundColor: 'rgba(12, 16, 36, 0.85)',
    gradient: {
      type: 'linear',
      colors: ['#00f2fe', '#4facfe'],
      angle: 135
    },
    frameStyle: 'glass-rounded',
    moduleStyle: 'fluid-dots', // fluid connected circles
    finderStyle: 'rounded-ring',
    glowColor: 'rgba(0, 242, 254, 0.45)',
    previewStyle: 'background: linear-gradient(135deg, #00f2fe, #4facfe); box-shadow: 0 0 16px rgba(0,242,254,0.5);'
  },
  {
    id: 'neon-emerald',
    name: 'Neon Emerald',
    label: 'Cybernetic Bio-Green',
    description: 'Electric emerald and mint phosphor with deep obsidian background and intense cyberpunk bloom.',
    darkColor: '#00ff88',
    lightColor: '#05140b',
    backgroundColor: '#05140b',
    gradient: {
      type: 'linear',
      colors: ['#00ff88', '#10b981'],
      angle: 90
    },
    frameStyle: 'cyber-bracket',
    moduleStyle: 'rounded-square',
    finderStyle: 'square-double',
    glowColor: 'rgba(0, 255, 136, 0.5)',
    previewStyle: 'background: linear-gradient(90deg, #00ff88, #10b981); box-shadow: 0 0 16px rgba(0,255,136,0.6);'
  },
  {
    id: 'cyber-grid',
    name: 'Cyber Grid',
    label: 'Matrix HUD Circuit',
    description: 'Precision neon cyan grid with sharp technical modules and targeting reticle corner brackets.',
    darkColor: '#00e5ff',
    lightColor: '#060a17',
    backgroundColor: '#060a17',
    gradient: {
      type: 'linear',
      colors: ['#00e5ff', '#7928ca'],
      angle: 45
    },
    frameStyle: 'hud-corners',
    moduleStyle: 'square',
    finderStyle: 'crosshair',
    glowColor: 'rgba(0, 229, 255, 0.4)',
    previewStyle: 'background: linear-gradient(45deg, #00e5ff, #7928ca); box-shadow: 0 0 14px rgba(0,229,255,0.45);'
  },
  {
    id: 'aurora-glow',
    name: 'Aurora Glow',
    label: 'Northern Lights Flare',
    description: 'Flowing boreal spectrum across ultraviolet, vivid teal, and ethereal pink with dreamy bloom.',
    darkColor: '#f43f5e',
    lightColor: '#0b0f1d',
    backgroundColor: '#0b0f1d',
    gradient: {
      type: 'radial',
      colors: ['#38ef7d', '#11998e', '#6a11cb'],
      angle: 0
    },
    frameStyle: 'soft-bloom',
    moduleStyle: 'dots',
    finderStyle: 'concentric-circle',
    glowColor: 'rgba(56, 239, 125, 0.45)',
    previewStyle: 'background: radial-gradient(circle, #38ef7d 0%, #11998e 50%, #6a11cb 100%); box-shadow: 0 0 18px rgba(56,239,125,0.5);'
  },
  {
    id: 'crystal-glass',
    name: 'Crystal Glass',
    label: 'Ice Diamond Refraction',
    description: 'Prismatic ice crystal blue with diamond faceted module corners and frost aura.',
    darkColor: '#a5f3fc',
    lightColor: '#08131e',
    backgroundColor: 'rgba(8, 19, 30, 0.9)',
    gradient: {
      type: 'linear',
      colors: ['#e0f2fe', '#38bdf8', '#0284c7'],
      angle: 120
    },
    frameStyle: 'faceted-bevel',
    moduleStyle: 'diamond',
    finderStyle: 'faceted-square',
    glowColor: 'rgba(165, 243, 252, 0.4)',
    previewStyle: 'background: linear-gradient(120deg, #e0f2fe, #38bdf8, #0284c7); box-shadow: 0 0 16px rgba(56,189,248,0.5);'
  },
  {
    id: 'obsidian-black',
    name: 'Obsidian Black',
    label: 'Stealth Carbon & Gold',
    description: 'Ultra-dark carbon composite matte black with regal amber gold luxury accents.',
    darkColor: '#f59e0b',
    lightColor: '#0a0a0c',
    backgroundColor: '#0a0a0c',
    gradient: {
      type: 'linear',
      colors: ['#fbbf24', '#d97706'],
      angle: 45
    },
    frameStyle: 'metallic-border',
    moduleStyle: 'rounded-square',
    finderStyle: 'square-gold',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    previewStyle: 'background: linear-gradient(45deg, #fbbf24, #d97706); box-shadow: 0 0 14px rgba(217,119,6,0.5);'
  },
  {
    id: 'holographic',
    name: 'Holographic',
    label: 'Prismatic Iridescent',
    description: 'Full-spectrum dynamic shimmer shifting between lavender, turquoise, and coral.',
    darkColor: '#c084fc',
    lightColor: '#0e0b1c',
    backgroundColor: '#0e0b1c',
    gradient: {
      type: 'linear',
      colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff'],
      angle: 135
    },
    frameStyle: 'holo-border',
    moduleStyle: 'dots',
    finderStyle: 'holo-ring',
    glowColor: 'rgba(185, 103, 255, 0.45)',
    previewStyle: 'background: linear-gradient(135deg, #ff71ce, #01cdfe, #05ffa1, #b967ff); box-shadow: 0 0 16px rgba(185,103,255,0.6);'
  },
  {
    id: 'minimal-premium',
    name: 'Minimal Premium',
    label: 'Pure Monochrome Luxury',
    description: 'Ultra-clean Swiss minimalist black-and-white aesthetic with subtle silver slate nuances.',
    darkColor: '#ffffff',
    lightColor: '#0f1015',
    backgroundColor: '#0f1015',
    gradient: {
      type: 'linear',
      colors: ['#ffffff', '#e2e8f0'],
      angle: 180
    },
    frameStyle: 'clean-border',
    moduleStyle: 'rounded-square',
    finderStyle: 'square-double',
    glowColor: 'rgba(255, 255, 255, 0.25)',
    previewStyle: 'background: linear-gradient(180deg, #ffffff, #94a3b8); box-shadow: 0 0 12px rgba(255,255,255,0.3);'
  },
  {
    id: 'circular-frame',
    name: 'Circular Frame',
    label: 'Orbital Ring Dot-Matrix',
    description: 'Concentric orbit boundary with perfectly rounded micro-dots and celestial tracking circles.',
    darkColor: '#38bdf8',
    lightColor: '#07101e',
    backgroundColor: '#07101e',
    gradient: {
      type: 'linear',
      colors: ['#38bdf8', '#818cf8'],
      angle: 90
    },
    frameStyle: 'circular-orbit',
    moduleStyle: 'dots',
    finderStyle: 'concentric-circle',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    previewStyle: 'background: linear-gradient(90deg, #38bdf8, #818cf8); box-shadow: 0 0 16px rgba(56,189,248,0.5);'
  },
  {
    id: 'geometric-frame',
    name: 'Geometric Frame',
    label: 'Architectural Isometric',
    description: 'Diagonal crosshatch motifs, isometric corner targets, and structural angularity.',
    darkColor: '#f97316',
    lightColor: '#120b08',
    backgroundColor: '#120b08',
    gradient: {
      type: 'linear',
      colors: ['#fb923c', '#ea580c'],
      angle: 45
    },
    frameStyle: 'isometric-hex',
    moduleStyle: 'square',
    finderStyle: 'hex-marker',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    previewStyle: 'background: linear-gradient(45deg, #fb923c, #ea580c); box-shadow: 0 0 14px rgba(234,88,12,0.5);'
  },
  {
    id: 'frosted-glass',
    name: 'Frosted Glass',
    label: 'Subtle Glassmorphism',
    description: 'Deep diffused acrylic frost with milky white edge refraction and smooth pill dots.',
    darkColor: '#f1f5f9',
    lightColor: 'rgba(15, 23, 42, 0.8)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    gradient: {
      type: 'linear',
      colors: ['#f8fafc', '#cbd5e1'],
      angle: 135
    },
    frameStyle: 'frosted-card',
    moduleStyle: 'rounded-square',
    finderStyle: 'rounded-ring',
    glowColor: 'rgba(255, 255, 255, 0.3)',
    previewStyle: 'background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(203,213,225,0.7)); box-shadow: 0 0 16px rgba(255,255,255,0.3);'
  },
  {
    id: 'metallic-silver',
    name: 'Metallic Silver',
    label: 'Brushed Titanium Chrome',
    description: 'Industrial precision brushed platinum with chrome specular highlights and dark slate frame.',
    darkColor: '#e2e8f0',
    lightColor: '#0b0f17',
    backgroundColor: '#0b0f17',
    gradient: {
      type: 'linear',
      colors: ['#f8fafc', '#94a3b8', '#e2e8f0', '#64748b'],
      angle: 60
    },
    frameStyle: 'titanium-bezel',
    moduleStyle: 'diamond',
    finderStyle: 'faceted-square',
    glowColor: 'rgba(226, 232, 240, 0.35)',
    previewStyle: 'background: linear-gradient(60deg, #f8fafc, #94a3b8, #e2e8f0, #64748b); box-shadow: 0 0 14px rgba(226,232,240,0.4);'
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    label: 'Cosmic Nebula Stellar',
    description: 'Midnight cosmic indigo with distant violet nebulas, starlight dots, and celestial corona.',
    darkColor: '#c084fc',
    lightColor: '#050510',
    backgroundColor: '#050510',
    gradient: {
      type: 'radial',
      colors: ['#e879f9', '#818cf8', '#2e1065'],
      angle: 0
    },
    frameStyle: 'nebula-halo',
    moduleStyle: 'dots',
    finderStyle: 'concentric-circle',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    previewStyle: 'background: radial-gradient(circle, #e879f9 0%, #818cf8 60%, #2e1065 100%); box-shadow: 0 0 18px rgba(192,132,252,0.5);'
  },
  {
    id: 'aurora-violet',
    name: 'Aurora Violet',
    label: 'Electric Royal Violet',
    description: 'Deep royal ultraviolet shifting into hot neon magenta with radiant phosphorescent halo.',
    darkColor: '#d946ef',
    lightColor: '#0d071a',
    backgroundColor: '#0d071a',
    gradient: {
      type: 'linear',
      colors: ['#8b5cf6', '#d946ef', '#ec4899'],
      angle: 120
    },
    frameStyle: 'neon-border',
    moduleStyle: 'rounded-square',
    finderStyle: 'square-double',
    glowColor: 'rgba(217, 70, 239, 0.5)',
    previewStyle: 'background: linear-gradient(120deg, #8b5cf6, #d946ef, #ec4899); box-shadow: 0 0 18px rgba(217,70,239,0.6);'
  },
  {
    id: 'dynamic-spectrum',
    name: 'Dynamic Spectrum',
    label: 'Vibrant Flowing Rainbow',
    description: 'Rich chromatic flowing spectrum spanning crimson, amber, emerald, cobalt, and magenta.',
    darkColor: '#ec4899',
    lightColor: '#0a0a14',
    backgroundColor: '#0a0a14',
    gradient: {
      type: 'linear',
      colors: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'],
      angle: 135
    },
    frameStyle: 'rainbow-ring',
    moduleStyle: 'fluid-dots',
    finderStyle: 'concentric-circle',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    previewStyle: 'background: linear-gradient(135deg, #ef4444, #f59e0b, #10b981, #06b6d4, #8b5cf6); box-shadow: 0 0 18px rgba(236,72,153,0.5);'
  }
];

export const QR_TEMPLATES_BY_ID = Object.fromEntries(
  QR_TEMPLATES.map(t => [t.id, t])
);

/**
 * Retrieve template by its identifier
 * @param {string} id
 * @returns {object} Template definition
 */
export function getTemplateById(id) {
  return QR_TEMPLATES_BY_ID[id] || QR_TEMPLATES[0];
}

/**
 * Render a customized QR code canvas using template specifications
 *
 * @param {HTMLCanvasElement} canvas - Target HTML5 Canvas
 * @param {boolean[][]} matrix - 2D boolean array representing QR modules (true = dark, false = light)
 * @param {string|object} templateOrId - Template object or ID string
 * @param {object} options - Custom rendering options (size, margin, logo)
 */
export function renderStyledQR(canvas, matrix, templateOrId, options = {}) {
  const template = typeof templateOrId === 'string'
    ? getTemplateById(templateOrId)
    : (templateOrId || QR_TEMPLATES[0]);

  const ctx = canvas.getContext('2d');
  const matrixSize = matrix.length;
  const margin = options.margin !== undefined ? options.margin : 4;
  const fullSize = matrixSize + margin * 2;

  const targetWidth = options.width || canvas.width || 360;
  const targetHeight = options.height || canvas.height || 360;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const cellSize = targetWidth / fullSize;

  // 1. Draw Background
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. Prepare Gradient fill if defined
  let fillStyle = template.darkColor;
  if (template.gradient) {
    if (template.gradient.type === 'linear') {
      const angleRad = (template.gradient.angle || 45) * (Math.PI / 180);
      const x1 = Math.cos(angleRad) > 0 ? 0 : targetWidth;
      const y1 = Math.sin(angleRad) > 0 ? 0 : targetHeight;
      const x2 = Math.cos(angleRad) > 0 ? targetWidth : 0;
      const y2 = Math.sin(angleRad) > 0 ? targetHeight : 0;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      const colors = template.gradient.colors;
      colors.forEach((col, idx) => {
        grad.addColorStop(idx / (colors.length - 1), col);
      });
      fillStyle = grad;
    } else if (template.gradient.type === 'radial') {
      const grad = ctx.createRadialGradient(
        targetWidth / 2, targetHeight / 2, 10,
        targetWidth / 2, targetHeight / 2, targetWidth * 0.7
      );
      const colors = template.gradient.colors;
      colors.forEach((col, idx) => {
        grad.addColorStop(idx / (colors.length - 1), col);
      });
      fillStyle = grad;
    }
  }

  // 3. Render Modules
  ctx.fillStyle = fillStyle;

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (!matrix[r][c]) continue;

      const x = (c + margin) * cellSize;
      const y = (r + margin) * cellSize;

      // Check if inside finder patterns (top-left, top-right, bottom-left 7x7 areas)
      const isFinder = (
        (r < 7 && c < 7) ||
        (r < 7 && c >= matrixSize - 7) ||
        (r >= matrixSize - 7 && c < 7)
      );

      if (isFinder) {
        renderFinderModule(ctx, x, y, cellSize, template.finderStyle);
      } else {
        renderStandardModule(ctx, x, y, cellSize, template.moduleStyle);
      }
    }
  }

  // 4. Render Outer Frame / Corner Accent Brackets
  renderFrameAccents(ctx, targetWidth, targetHeight, cellSize, margin, template);
}

/**
 * Render individual QR modules with stylistic variety
 */
function renderStandardModule(ctx, x, y, size, style) {
  const pad = size * 0.08;
  const innerSize = size - pad * 2;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  switch (style) {
    case 'dots':
    case 'fluid-dots': {
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerSize / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'rounded-square': {
      const radius = innerSize * 0.3;
      drawRoundedRect(ctx, x + pad, y + pad, innerSize, innerSize, radius);
      ctx.fill();
      break;
    }

    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(centerX, y + pad);
      ctx.lineTo(x + size - pad, centerY);
      ctx.lineTo(centerX, y + size - pad);
      ctx.lineTo(x + pad, centerY);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'square':
    default: {
      ctx.fillRect(x + pad, y + pad, innerSize, innerSize);
      break;
    }
  }
}

/**
 * Render finder pattern modules
 */
function renderFinderModule(ctx, x, y, size, style) {
  const pad = size * 0.05;
  const innerSize = size - pad * 2;
  const radius = style === 'concentric-circle' || style === 'rounded-ring'
    ? innerSize * 0.4
    : innerSize * 0.15;

  drawRoundedRect(ctx, x + pad, y + pad, innerSize, innerSize, radius);
  ctx.fill();
}

/**
 * Draw rounded rectangle helper
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Render frame accents based on template frameStyle
 */
function renderFrameAccents(ctx, width, height, cellSize, margin, template) {
  const inset = margin * cellSize * 0.4;
  ctx.lineWidth = 2;
  ctx.strokeStyle = template.glowColor || 'rgba(0, 242, 254, 0.4)';

  if (template.frameStyle === 'hud-corners' || template.frameStyle === 'cyber-bracket') {
    const arm = 20;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(inset, inset + arm);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + arm, inset);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - inset - arm, inset);
    ctx.lineTo(width - inset, inset);
    ctx.lineTo(width - inset, inset + arm);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(inset, height - inset - arm);
    ctx.lineTo(inset, height - inset);
    ctx.lineTo(inset + arm, height - inset);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - inset - arm, height - inset);
    ctx.lineTo(width - inset, height - inset);
    ctx.lineTo(width - inset, height - inset - arm);
    ctx.stroke();
  } else if (template.frameStyle === 'glass-rounded' || template.frameStyle === 'frosted-card') {
    drawRoundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 16);
    ctx.stroke();
  }
}

if (typeof window !== 'undefined') {
  window.QR_TEMPLATES = QR_TEMPLATES;
  window.QR_TEMPLATES_BY_ID = QR_TEMPLATES_BY_ID;
  window.getTemplateById = getTemplateById;
  window.renderStyledQR = renderStyledQR;
}

export default QR_TEMPLATES;
