/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: settings.js
 * Author: Shiv Yogi
 * 
 * Persistent application settings and preferences manager.
 * Features:
 * - LocalStorage persistence with defensive key filtering
 * - STRICT POLICY: Passwords, encryption keys, and credentials are NEVER stored
 * - Reactive change notification event bus
 * - DOM theme and layout attribute bindings (data-theme, data-layout)
 * - Safe JSON settings export and import
 * - Reset and data clearing controls
 */

export const SETTINGS_STORAGE_KEY = 'fluxdrope_app_settings_v1';

export const FORBIDDEN_STORAGE_KEYS = [
  'password',
  'key',
  'privateKey',
  'sharedKey',
  'secret',
  'token',
  'ecdhKey',
  'cryptoKey'
];

export const DEFAULT_SETTINGS = Object.freeze({
  displayName: '', // Dynamically generated if empty
  layout: 'aurora-glass',
  theme: 'aurora-glass',
  animationEnabled: true,
  reducedMotion: false,
  soundEnabled: false
});

export class SettingsManager {
  constructor() {
    this.listeners = new Map();
    this.settings = this._loadSettings();

    // Auto-apply initial visual styles to root document
    if (typeof document !== 'undefined') {
      this.applyTheme(this.settings.theme);
      this.applyLayout(this.settings.layout);

      // Detect system reduced motion if unset
      if (this.settings.reducedMotion === undefined || this.settings.reducedMotion === null) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
          this.set('reducedMotion', true);
        }
      }
    }
  }

  /**
   * Generates a default pseudonymous user display name
   * @private
   * @returns {string} e.g. "FluxUser_4821"
   */
  _generateDefaultDisplayName() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `FluxUser_${randomSuffix}`;
  }

  /**
   * Loads and sanitizes settings from localStorage
   * @private
   * @returns {Object}
   */
  _loadSettings() {
    const defaults = {
      ...DEFAULT_SETTINGS,
      displayName: this._generateDefaultDisplayName()
    };

    if (typeof localStorage === 'undefined') {
      return defaults;
    }

    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;

      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return defaults;

      // Filter forbidden security keys
      for (const forbidden of FORBIDDEN_STORAGE_KEYS) {
        delete parsed[forbidden];
      }

      return {
        ...defaults,
        ...parsed,
        displayName: parsed.displayName || defaults.displayName
      };
    } catch (_) {
      return defaults;
    }
  }

  /**
   * Commits the current settings map to localStorage
   * @private
   */
  _saveSettings() {
    if (typeof localStorage === 'undefined') return;

    // Safety scrub: NEVER write passwords or private keys
    const safeData = { ...this.settings };
    for (const forbidden of FORBIDDEN_STORAGE_KEYS) {
      delete safeData[forbidden];
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(safeData));
    } catch (err) {
      console.warn('SettingsManager: Failed to write to localStorage', err);
    }
  }

  /**
   * Gets a setting value by key
   * @param {string} key 
   * @returns {*}
   */
  get(key) {
    if (key === 'displayName' && !this.settings.displayName) {
      this.settings.displayName = this._generateDefaultDisplayName();
      this._saveSettings();
    }
    return this.settings[key];
  }

  /**
   * Sets a setting value and notifies subscribers
   * Enforces strict prohibition against storing passwords or keys.
   * @param {string} key 
   * @param {*} value 
   */
  set(key, value) {
    // Prohibit storing passwords or encryption keys
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_STORAGE_KEYS.some(k => lowerKey.includes(k.toLowerCase()))) {
      throw new Error(`SettingsManager: Security violation - attempting to persist sensitive key '${key}'`);
    }

    const previousValue = this.settings[key];
    this.settings[key] = value;
    this._saveSettings();

    // Trigger visual updates if theme or layout changed
    if (key === 'theme' && typeof value === 'string') {
      this.applyTheme(value);
    } else if (key === 'layout' && typeof value === 'string') {
      this.applyLayout(value);
    }

    this._notify(key, value, previousValue);
  }

  /**
   * Applies the theme attribute to the HTML document element
   * @param {string} theme 
   */
  applyTheme(theme) {
    if (!theme || typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Applies the layout attribute to the HTML document element
   * @param {string} layout 
   */
  applyLayout(layout) {
    if (!layout || typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-layout', layout);
  }

  /**
   * Subscribes to changes for a specific key, or all keys ('*')
   * @param {string} key 
   * @param {Function} callback - (newValue, oldValue, key) => void
   * @returns {Function} Unsubscribe function
   */
  onSettingChange(key, callback) {
    if (typeof callback !== 'function') return () => {};

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Return cleanup function
    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Dispatches change events to registered callbacks
   * @private
   */
  _notify(key, newValue, oldValue) {
    // Specific key listeners
    if (this.listeners.has(key)) {
      for (const cb of this.listeners.get(key)) {
        try {
          cb(newValue, oldValue, key);
        } catch (e) {
          console.error(`SettingsManager listener error for [${key}]:`, e);
        }
      }
    }

    // Global wildcard listeners
    if (this.listeners.has('*')) {
      for (const cb of this.listeners.get('*')) {
        try {
          cb(newValue, oldValue, key);
        } catch (e) {
          console.error('SettingsManager wildcard listener error:', e);
        }
      }
    }
  }

  /**
   * Exports non-sensitive settings to a clean JSON string
   * @returns {string}
   */
  exportSettings() {
    const safe = { ...this.settings };
    for (const forbidden of FORBIDDEN_STORAGE_KEYS) {
      delete safe[forbidden];
    }
    return JSON.stringify(safe, null, 2);
  }

  /**
   * Imports settings from a JSON string, validates, and applies them
   * @param {string} jsonString 
   * @returns {boolean} True if imported successfully
   */
  importSettings(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON structure');
      }

      // Filter sensitive or disallowed keys
      for (const forbidden of FORBIDDEN_STORAGE_KEYS) {
        delete parsed[forbidden];
      }

      for (const [k, v] of Object.entries(parsed)) {
        if (k in DEFAULT_SETTINGS) {
          this.set(k, v);
        }
      }
      return true;
    } catch (err) {
      console.error('SettingsManager: Import error', err);
      return false;
    }
  }

  /**
   * Clears all local storage settings and restores factory defaults
   */
  clearAllData() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      } catch (_) {}
    }

    this.settings = {
      ...DEFAULT_SETTINGS,
      displayName: this._generateDefaultDisplayName()
    };

    if (typeof document !== 'undefined') {
      this.applyTheme(this.settings.theme);
      this.applyLayout(this.settings.layout);
    }

    this._notify('*', this.settings, null);
  }
}
