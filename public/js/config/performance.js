/**
 * FLUXDROPE - Performance Profile Manager
 * Created By Shiv Yogi
 *
 * Provides:
 * - Performance Mode (low blur, zero decorative canvas, max throughput)
 * - Balanced Mode (standard liquid glass, smooth transitions)
 * - Quality Mode (rich specular glass, fluid wave backdrop)
 */

import { PERFORMANCE_MODES } from '../constants.js';

export class PerformanceManager {
  constructor() {
    this.currentMode = localStorage.getItem('fluxdrope_perf_mode') || PERFORMANCE_MODES.BALANCED;
    this.applyMode(this.currentMode);
  }

  getMode() {
    return this.currentMode;
  }

  applyMode(mode) {
    if (!Object.values(PERFORMANCE_MODES).includes(mode)) {
      mode = PERFORMANCE_MODES.BALANCED;
    }

    this.currentMode = mode;
    localStorage.setItem('fluxdrope_perf_mode', mode);
    document.documentElement.setAttribute('data-perf-mode', mode);

    // Toggle specific performance classes
    document.body.classList.toggle('perf-mode-high', mode === PERFORMANCE_MODES.PERFORMANCE);
    document.body.classList.toggle('perf-mode-quality', mode === PERFORMANCE_MODES.QUALITY);
  }
}
