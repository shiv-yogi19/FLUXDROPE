/**
 * FLUXDROPE - 14 Liquid Glass Layouts Registry
 * Created By Shiv Yogi
 *
 * Manages 7 Mobile Layouts (M1-M7) and 7 Desktop Layouts (D1-D7).
 * Allows dynamic layout switching without resetting active transfer or session states.
 */

export const LAYOUT_REGISTRY = [
  // Mobile Layouts (M1 - M7)
  {
    id: 'm1-aurora',
    name: 'Aurora Glass',
    category: 'mobile',
    desc: 'Rich blue and violet lighting, large glass cards, circular progress ring',
    badge: 'M1',
    cssClass: 'layout-m1-aurora',
    accentColor: '#8b5cf6',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#0b0f19"/>
      <circle cx="60" cy="40" r="50" fill="url(#m1_grad)" opacity="0.45"/>
      <rect x="12" y="24" width="96" height="54" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(168,85,247,0.4)"/>
      <circle cx="60" cy="51" r="16" stroke="#38bdf8" stroke-width="3" stroke-dasharray="70 30"/>
      <rect x="12" y="88" width="96" height="28" rx="6" fill="rgba(56,189,248,0.2)" stroke="#38bdf8"/>
      <rect x="12" y="122" width="96" height="24" rx="6" fill="rgba(255,255,255,0.06)"/>
      <defs><radialGradient id="m1_grad"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#0b0f19" stop-opacity="0"/></radialGradient></defs>
    </svg>`
  },
  {
    id: 'm2-crystal',
    name: 'Crystal Flow',
    category: 'mobile',
    desc: 'Translucent glass panels, faceted borders, stacked file cards, smooth scrolling',
    badge: 'M2',
    cssClass: 'layout-m2-crystal',
    accentColor: '#38bdf8',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#080c14"/>
      <rect x="10" y="16" width="100" height="34" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)"/>
      <rect x="10" y="56" width="100" height="42" rx="6" fill="rgba(56,189,248,0.08)" stroke="#38bdf8" stroke-width="1.2"/>
      <rect x="10" y="104" width="100" height="44" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)"/>
    </svg>`
  },
  {
    id: 'm3-obsidian',
    name: 'Obsidian Glass',
    category: 'mobile',
    desc: 'Deep black surfaces, minimal glow, high-contrast typography, performance-first',
    badge: 'M3',
    cssClass: 'layout-m3-obsidian',
    accentColor: '#10b981',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#000000"/>
      <rect x="12" y="20" width="96" height="50" rx="4" fill="#111115" stroke="#22222a"/>
      <rect x="22" y="32" width="40" height="8" rx="2" fill="#10b981"/>
      <rect x="12" y="78" width="96" height="32" rx="4" fill="#111115" stroke="#10b981"/>
      <rect x="12" y="118" width="96" height="28" rx="4" fill="#111115" stroke="#22222a"/>
    </svg>`
  },
  {
    id: 'm4-waves',
    name: 'Liquid Waves',
    category: 'mobile',
    desc: 'Subtle animated wave backdrop, layered glass panels, undulating fluid progress',
    badge: 'M4',
    cssClass: 'layout-m4-waves',
    accentColor: '#06b6d4',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#07131e"/>
      <path d="M0 60 Q30 45 60 60 T120 60 V160 H0 Z" fill="rgba(6,182,212,0.15)"/>
      <rect x="12" y="26" width="96" height="44" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(6,182,212,0.4)"/>
      <rect x="12" y="80" width="96" height="66" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)"/>
    </svg>`
  },
  {
    id: 'm5-holographic',
    name: 'Holographic Glass',
    category: 'mobile',
    desc: 'Holographic highlights, SVG lighting effects, animated QR reveal, cybernetic HUD',
    badge: 'M5',
    cssClass: 'layout-m5-holographic',
    accentColor: '#ec4899',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#0d0b1a"/>
      <rect x="10" y="16" width="100" height="74" rx="8" fill="rgba(236,72,153,0.06)" stroke="url(#m5_holo)" stroke-width="1.5"/>
      <rect x="40" y="30" width="40" height="40" rx="4" fill="rgba(255,255,255,0.1)" stroke="#ec4899"/>
      <rect x="10" y="100" width="100" height="46" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)"/>
      <defs><linearGradient id="m5_holo"><stop stop-color="#ec4899"/><stop offset="0.5" stop-color="#38bdf8"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>
    </svg>`
  },
  {
    id: 'm6-floating',
    name: 'Floating Glass',
    category: 'mobile',
    desc: 'Floating action island at bottom, thumb-reachable triggers, decoupled glass cards',
    badge: 'M6',
    cssClass: 'layout-m6-floating',
    accentColor: '#f59e0b',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#0f1117"/>
      <rect x="12" y="16" width="96" height="50" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
      <rect x="12" y="74" width="96" height="38" rx="8" fill="rgba(255,255,255,0.04)"/>
      <rect x="18" y="122" width="84" height="26" rx="13" fill="#f59e0b" stroke="#ffffff" stroke-width="0.8"/>
    </svg>`
  },
  {
    id: 'm7-minimal',
    name: 'Hyper Minimal Glass',
    category: 'mobile',
    desc: 'Minimal decoration, large touch targets, reduced blur, fast rendering, clean typography',
    badge: 'M7',
    cssClass: 'layout-m7-minimal',
    accentColor: '#f8fafc',
    previewSvg: `<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" rx="14" fill="#090a0f"/>
      <rect x="12" y="20" width="96" height="36" rx="2" fill="none" stroke="#334155"/>
      <rect x="12" y="64" width="96" height="40" rx="2" fill="none" stroke="#f8fafc"/>
      <rect x="12" y="112" width="96" height="34" rx="2" fill="none" stroke="#334155"/>
    </svg>`
  },

  // Desktop Layouts (D1 - D7)
  {
    id: 'd1-aurora',
    name: 'Aurora Desktop',
    category: 'desktop',
    desc: 'Wide cinematic dashboard, dual hero cards (Send / Receive), glowing stats telemetry',
    badge: 'D1',
    cssClass: 'layout-d1-aurora',
    accentColor: '#8b5cf6',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#0b0f19"/>
      <circle cx="140" cy="30" r="60" fill="url(#d1_grad)" opacity="0.4"/>
      <rect x="12" y="12" width="156" height="16" rx="4" fill="rgba(255,255,255,0.06)"/>
      <rect x="12" y="36" width="74" height="70" rx="8" fill="rgba(139,92,246,0.12)" stroke="#8b5cf6"/>
      <rect x="94" y="36" width="74" height="70" rx="8" fill="rgba(56,189,248,0.12)" stroke="#38bdf8"/>
      <defs><radialGradient id="d1_grad"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#0b0f19" stop-opacity="0"/></radialGradient></defs>
    </svg>`
  },
  {
    id: 'd2-crystal',
    name: 'Crystal Workspace',
    category: 'desktop',
    desc: '3-column workspace: left quick navigation, center transfer stage, right file inspector',
    badge: 'D2',
    cssClass: 'layout-d2-crystal',
    accentColor: '#38bdf8',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#080c14"/>
      <rect x="10" y="10" width="34" height="100" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)"/>
      <rect x="50" y="10" width="76" height="100" rx="6" fill="rgba(56,189,248,0.08)" stroke="#38bdf8"/>
      <rect x="132" y="10" width="38" height="100" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)"/>
    </svg>`
  },
  {
    id: 'd3-obsidian',
    name: 'Obsidian Pro',
    category: 'desktop',
    desc: 'Deep black interface, detailed transfer statistics HUD, minimal animation overhead',
    badge: 'D3',
    cssClass: 'layout-d3-obsidian',
    accentColor: '#10b981',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#000000"/>
      <rect x="12" y="12" width="156" height="20" rx="3" fill="#111116" stroke="#22222a"/>
      <rect x="12" y="38" width="104" height="70" rx="4" fill="#0d0d12" stroke="#10b981"/>
      <rect x="122" y="38" width="46" height="70" rx="4" fill="#111116" stroke="#22222a"/>
    </svg>`
  },
  {
    id: 'd4-waves',
    name: 'Liquid Waves Desktop',
    category: 'desktop',
    desc: 'Wide glass panels, subtle ambient aurora wave, dynamic progress visualization',
    badge: 'D4',
    cssClass: 'layout-d4-waves',
    accentColor: '#06b6d4',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#06121c"/>
      <path d="M0 45 Q45 35 90 45 T180 45 V120 H0 Z" fill="rgba(6,182,212,0.12)"/>
      <rect x="14" y="24" width="152" height="78" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(6,182,212,0.3)"/>
    </svg>`
  },
  {
    id: 'd5-holographic',
    name: 'Holographic Command',
    category: 'desktop',
    desc: 'Command center HUD: live connection diagnostics, session telemetry, QR panel',
    badge: 'D5',
    cssClass: 'layout-d5-holographic',
    accentColor: '#ec4899',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#0b0a17"/>
      <rect x="12" y="12" width="76" height="96" rx="8" fill="rgba(236,72,153,0.06)" stroke="#ec4899"/>
      <rect x="94" y="12" width="74" height="45" rx="8" fill="rgba(56,189,248,0.06)" stroke="#38bdf8"/>
      <rect x="94" y="63" width="74" height="45" rx="8" fill="rgba(168,85,247,0.06)" stroke="#a855f7"/>
    </svg>`
  },
  {
    id: 'd6-floating',
    name: 'Floating Workspace',
    category: 'desktop',
    desc: 'Floating and resizable panels, separate file preview area, independent transfer monitor',
    badge: 'D6',
    cssClass: 'layout-d6-floating',
    accentColor: '#f59e0b',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#0f1118"/>
      <rect x="14" y="18" width="68" height="84" rx="8" fill="rgba(255,255,255,0.06)" stroke="#f59e0b"/>
      <rect x="90" y="18" width="76" height="54" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)"/>
      <rect x="90" y="78" width="76" height="24" rx="6" fill="rgba(245,158,11,0.15)" stroke="#f59e0b"/>
    </svg>`
  },
  {
    id: 'd7-minimal',
    name: 'Hyper Minimal Desktop',
    category: 'desktop',
    desc: 'Clean navigation, efficient spacing, minimal effects, keyboard-friendly operation',
    badge: 'D7',
    cssClass: 'layout-d7-minimal',
    accentColor: '#f8fafc',
    previewSvg: `<svg viewBox="0 0 180 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="120" rx="10" fill="#090a0e"/>
      <rect x="14" y="14" width="152" height="26" rx="2" fill="none" stroke="#334155"/>
      <rect x="14" y="48" width="100" height="58" rx="2" fill="none" stroke="#f8fafc"/>
      <rect x="120" y="48" width="46" height="58" rx="2" fill="none" stroke="#334155"/>
    </svg>`
  }
];

export class LayoutManager {
  constructor() {
    this.currentLayoutId = null;
    this.savedMobileLayout = localStorage.getItem('fluxdrope_layout_mobile') || 'm1-aurora';
    this.savedDesktopLayout = localStorage.getItem('fluxdrope_layout_desktop') || 'd1-aurora';
    this.listeners = new Set();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  isDesktopViewport() {
    return window.matchMedia('(min-width: 900px)').matches;
  }

  getSuggestedLayoutId() {
    return this.isDesktopViewport() ? this.savedDesktopLayout : this.savedMobileLayout;
  }

  getCurrentLayout() {
    return LAYOUT_REGISTRY.find(l => l.id === this.currentLayoutId) || LAYOUT_REGISTRY[0];
  }

  applyLayout(layoutId) {
    const layout = LAYOUT_REGISTRY.find(l => l.id === layoutId);
    if (!layout) return;

    this.currentLayoutId = layoutId;

    if (layout.category === 'mobile') {
      this.savedMobileLayout = layoutId;
      localStorage.setItem('fluxdrope_layout_mobile', layoutId);
    } else {
      this.savedDesktopLayout = layoutId;
      localStorage.setItem('fluxdrope_layout_desktop', layoutId);
    }

    // Set data attribute on documentElement and body without touching active DOM state
    document.documentElement.setAttribute('data-layout', layout.id);
    document.body.className = `theme-dark ${layout.cssClass}`;

    // Apply primary accent CSS variable
    document.documentElement.style.setProperty('--accent-glow', layout.accentColor);

    for (const listener of this.listeners) {
      try { listener(layout); } catch (e) { console.error('Layout change listener error:', e); }
    }
  }

  initAutoResponsive() {
    const targetLayout = this.getSuggestedLayoutId();
    this.applyLayout(targetLayout);

    const mediaQuery = window.matchMedia('(min-width: 900px)');
    mediaQuery.addEventListener('change', (e) => {
      // Auto-switch between user's chosen mobile and desktop layouts on resize
      const nextId = e.matches ? this.savedDesktopLayout : this.savedMobileLayout;
      this.applyLayout(nextId);
    });
  }
}
