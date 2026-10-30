/**
 * FLUXDROPE - Application Settings Manager
 * Created By Shiv Yogi
 */

import { TRANSFER_LIMITS, SECURITY_POLICY } from '../constants.js';

const SETTINGS_KEY = 'fluxdrope_user_settings';

const DEFAULT_SETTINGS = {
  // Transfer
  chunkSize: TRANSFER_LIMITS.DEFAULT_CHUNK_SIZE,
  sessionExpiryMs: TRANSFER_LIMITS.DEFAULT_SESSION_EXPIRY_MS,
  autoAcceptDownloads: true,

  // Security
  enableDefaultPassword: false,
  defaultPassword: '',
  maxFailedAttempts: SECURITY_POLICY.LOCKOUT_THRESHOLD,
  lockoutDurationMinutes: 10,
  enableE2EE: true,

  // Appearance
  glassIntensity: 85, // %
  enableBlur: true,
  reduceMotion: false,

  // Media
  defaultVolume: 0.8,
  defaultPlaybackSpeed: 1.0,
  rememberPlaybackPosition: true
};

export class SettingsManager {
  static getSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (_) {
      return newSettings;
    }
  }

  static resetSettings() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }
}
