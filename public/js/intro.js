/**
 * FLUXDROPE - Cinematic Introduction Manager
 * Created By Shiv Yogi
 *
 * Sequence:
 * 1. Animated FLUXDROPE logo reveal
 * 2. Website name reveal transition
 * 3. "Created By Shiv Yogi" reveal
 * 4. Refined Liquid Glass shimmering wave
 * 5. Natural transition into main dashboard
 *
 * Requirements:
 * - No skip button or hidden skip
 * - Finishes naturally in ~2.8 seconds
 * - Fail-safe timeout ensures app access is never blocked
 * - Persists intro flag in localStorage so it doesn't replay on every refresh
 * - Can be manually replayed from About menu
 */

export class IntroManager {
  static hasSeenIntro() {
    try {
      return localStorage.getItem('fluxdrope_intro_completed') === 'true';
    } catch (_) {
      return false;
    }
  }

  static setIntroCompleted() {
    try {
      localStorage.setItem('fluxdrope_intro_completed', 'true');
    } catch (_) {}
  }

  /**
   * Run the cinematic intro sequence
   * @param {HTMLElement} introElement
   * @param {function} onComplete
   * @param {boolean} [force] Replay even if seen before
   */
  static runSequence(introElement, onComplete, force = false) {
    if (!introElement) {
      if (onComplete) onComplete();
      return;
    }

    if (!force && this.hasSeenIntro()) {
      introElement.style.display = 'none';
      if (onComplete) onComplete();
      return;
    }

    introElement.style.display = 'flex';
    introElement.classList.add('intro-active');

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 1200 : 2800;

    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(safetyTimeout);

      introElement.classList.add('intro-fade-out');
      setTimeout(() => {
        introElement.style.display = 'none';
        introElement.classList.remove('intro-active', 'intro-fade-out');
        this.setIntroCompleted();
        if (onComplete) onComplete();
      }, 500);
    };

    // Safety timeout ensures access is NEVER blocked by animation error
    const safetyTimeout = setTimeout(finish, duration + 600);

    // Sequence stages
    const logoEl = introElement.querySelector('.intro-logo');
    const titleEl = introElement.querySelector('.intro-title');
    const brandEl = introElement.querySelector('.intro-creator');
    const glassWaveEl = introElement.querySelector('.intro-glass-wave');

    if (prefersReducedMotion) {
      if (logoEl) logoEl.style.opacity = '1';
      if (titleEl) titleEl.style.opacity = '1';
      if (brandEl) brandEl.style.opacity = '1';
      setTimeout(finish, 1000);
      return;
    }

    // Step 1: Logo scale in (0ms)
    setTimeout(() => {
      if (logoEl) logoEl.classList.add('animate-in');
    }, 100);

    // Step 2: Title reveal (600ms)
    setTimeout(() => {
      if (titleEl) titleEl.classList.add('animate-in');
    }, 700);

    // Step 3: "Created By Shiv Yogi" reveal (1200ms)
    setTimeout(() => {
      if (brandEl) brandEl.classList.add('animate-in');
    }, 1300);

    // Step 4: Refined Liquid Glass wave (1800ms)
    setTimeout(() => {
      if (glassWaveEl) glassWaveEl.classList.add('animate-wave');
    }, 1900);

    // Step 5: Transition naturally to dashboard (2600ms)
    setTimeout(finish, 2600);
  }
}
