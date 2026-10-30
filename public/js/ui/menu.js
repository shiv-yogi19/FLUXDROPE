/**
 * FLUXDROPE - Three-Line Navigation Menu & Drawer
 * Created By Shiv Yogi
 *
 * Manages responsive slide-in drawer on mobile and expandable Liquid Glass
 * panel on desktop, routing between application views without resetting transfers.
 */

import { SVG_ICONS } from '../icons.js';

export const MENU_ITEMS = [
  { id: 'view-home', label: 'Home', icon: 'home' },
  { id: 'view-send', label: 'Send Files', icon: 'send' },
  { id: 'view-receive', label: 'Receive Files', icon: 'receive' },
  { id: 'view-transfers', label: 'Active Transfers', icon: 'activeTransfers' },
  { id: 'view-history', label: 'Transfer History', icon: 'history' },
  { id: 'view-appearance', label: 'Appearance', icon: 'appearance' },
  { id: 'view-performance', label: 'Performance', icon: 'performance' },
  { id: 'view-security', label: 'Security', icon: 'security' },
  { id: 'view-expiry', label: 'Session Expiry', icon: 'expiry' },
  { id: 'view-settings', label: 'Settings', icon: 'settings' },
  { id: 'view-help', label: 'Help and Troubleshooting', icon: 'help' },
  { id: 'view-about', label: 'About FLUXDROPE', icon: 'about' }
];

export class NavigationMenu {
  constructor(options = {}) {
    this.isOpen = false;
    this.activeView = 'view-home';
    this.onNavigate = options.onNavigate || (() => {});
    this.drawerEl = null;
    this.backdropEl = null;
    this.init();
  }

  init() {
    this.drawerEl = document.getElementById('navDrawer');
    this.backdropEl = document.getElementById('navBackdrop');

    if (!this.drawerEl) return;

    this.renderMenuItems();
    this.setupListeners();
  }

  renderMenuItems() {
    const listEl = this.drawerEl.querySelector('.nav-items-list');
    if (!listEl) return;

    listEl.innerHTML = MENU_ITEMS.map(item => `
      <li class="nav-menu-item" data-view="${item.id}">
        <button class="nav-menu-link ${item.id === this.activeView ? 'active' : ''}" aria-label="${item.label}">
          <span class="nav-item-icon">${SVG_ICONS[item.icon]?.(20) || ''}</span>
          <span class="nav-item-label">${item.label}</span>
        </button>
      </li>
    `).join('');
  }

  setupListeners() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeBtn = document.getElementById('navCloseBtn');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => this.toggle());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', () => this.close());
    }

    // Menu item clicks
    this.drawerEl.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-menu-link');
      if (!link) return;
      const item = link.closest('.nav-menu-item');
      const viewId = item?.dataset.view;
      if (viewId) {
        this.navigateTo(viewId);
        this.close();
      }
    });

    // Keyboard ESC to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.drawerEl.classList.add('open');
    if (this.backdropEl) this.backdropEl.classList.add('visible');
    document.body.classList.add('nav-open');

    // Accessibility focus management
    const firstBtn = this.drawerEl.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  close() {
    this.isOpen = false;
    this.drawerEl.classList.remove('open');
    if (this.backdropEl) this.backdropEl.classList.remove('visible');
    document.body.classList.remove('nav-open');
  }

  navigateTo(viewId) {
    this.activeView = viewId;

    // Update active highlight in menu
    this.drawerEl.querySelectorAll('.nav-menu-link').forEach(link => {
      const parent = link.closest('.nav-menu-item');
      link.classList.toggle('active', parent?.dataset.view === viewId);
    });

    this.onNavigate(viewId);
  }
}
