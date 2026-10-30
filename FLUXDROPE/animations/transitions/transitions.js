/**
 * FLUXDROPE - Screen & State Transition Engine
 * Author: Shiv Yogi
 * 
 * Provides smooth 60fps transitions, FLIP morphing, glassmorphic reveals,
 * and page transitions with full accessibility and prefers-reduced-motion compliance.
 */

export class TransitionManager {
  static defaultEasing = 'cubic-bezier(0.16, 1, 0.3, 1)';
  static bounceEasing = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  /**
   * Checks whether the user has requested reduced motion in system preferences
   * @returns {boolean}
   */
  static isReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Resolves target element from element reference or query selector
   * @param {HTMLElement|string} el 
   * @returns {HTMLElement|null}
   */
  static getElement(el) {
    if (!el) return null;
    return typeof el === 'string' ? document.querySelector(el) : el;
  }

  /**
   * Fades out an element to opacity 0
   * @param {HTMLElement|string} el 
   * @param {number} [duration=300] 
   * @returns {Promise<void>}
   */
  static fadeOut(el, duration = 300) {
    return new Promise((resolve) => {
      const element = this.getElement(el);
      if (!element) return resolve();

      if (this.isReducedMotion()) {
        element.style.opacity = '0';
        element.style.display = 'none';
        return resolve();
      }

      element.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 1, 1)`;
      element.style.opacity = '1';

      // Force layout reflow
      void element.offsetHeight;

      requestAnimationFrame(() => {
        element.style.opacity = '0';
      });

      const handleEnd = (e) => {
        if (e && e.target !== element) return;
        element.removeEventListener('transitionend', handleEnd);
        element.style.display = 'none';
        element.style.transition = '';
        resolve();
      };

      element.addEventListener('transitionend', handleEnd);
      // Fallback safety timeout in case transitionend does not fire
      setTimeout(handleEnd, duration + 60);
    });
  }

  /**
   * Fades in an element from opacity 0 to 1
   * @param {HTMLElement|string} el 
   * @param {number} [duration=300] 
   * @param {string} [display='block'] 
   * @returns {Promise<void>}
   */
  static fadeIn(el, duration = 300, display = 'block') {
    return new Promise((resolve) => {
      const element = this.getElement(el);
      if (!element) return resolve();

      if (this.isReducedMotion()) {
        element.style.display = display;
        element.style.opacity = '1';
        return resolve();
      }

      element.style.opacity = '0';
      element.style.display = display;
      element.style.transition = `opacity ${duration}ms cubic-bezier(0, 0, 0.2, 1)`;

      // Force layout reflow
      void element.offsetHeight;

      requestAnimationFrame(() => {
        element.style.opacity = '1';
      });

      const handleEnd = (e) => {
        if (e && e.target !== element) return;
        element.removeEventListener('transitionend', handleEnd);
        element.style.transition = '';
        resolve();
      };

      element.addEventListener('transitionend', handleEnd);
      setTimeout(handleEnd, duration + 60);
    });
  }

  /**
   * Slides in an element from specified direction
   * @param {HTMLElement|string} el 
   * @param {'left'|'right'|'up'|'down'} [direction='left'] 
   * @param {number} [duration=350] 
   * @param {string} [display='block'] 
   * @returns {Promise<void>}
   */
  static slideIn(el, direction = 'left', duration = 350, display = 'block') {
    return new Promise((resolve) => {
      const element = this.getElement(el);
      if (!element) return resolve();

      if (this.isReducedMotion()) {
        element.style.display = display;
        element.style.transform = 'none';
        element.style.opacity = '1';
        return resolve();
      }

      let startTransform = '';
      switch (direction) {
        case 'left': startTransform = 'translateX(-35px)'; break;
        case 'right': startTransform = 'translateX(35px)'; break;
        case 'up': startTransform = 'translateY(35px)'; break;
        case 'down': startTransform = 'translateY(-35px)'; break;
        default: startTransform = 'translateX(-35px)';
      }

      element.style.display = display;
      element.style.transform = startTransform;
      element.style.opacity = '0';
      element.style.transition = `transform ${duration}ms ${this.defaultEasing}, opacity ${duration}ms cubic-bezier(0, 0, 0.2, 1)`;

      // Force layout reflow
      void element.offsetHeight;

      requestAnimationFrame(() => {
        element.style.transform = 'translate3d(0, 0, 0)';
        element.style.opacity = '1';
      });

      const handleEnd = (e) => {
        if (e && e.target !== element) return;
        element.removeEventListener('transitionend', handleEnd);
        element.style.transition = '';
        element.style.transform = '';
        resolve();
      };

      element.addEventListener('transitionend', handleEnd);
      setTimeout(handleEnd, duration + 60);
    });
  }

  /**
   * Slides out an element towards specified direction
   * @param {HTMLElement|string} el 
   * @param {'left'|'right'|'up'|'down'} [direction='left'] 
   * @param {number} [duration=350] 
   * @returns {Promise<void>}
   */
  static slideOut(el, direction = 'left', duration = 350) {
    return new Promise((resolve) => {
      const element = this.getElement(el);
      if (!element) return resolve();

      if (this.isReducedMotion()) {
        element.style.display = 'none';
        element.style.opacity = '0';
        return resolve();
      }

      let endTransform = '';
      switch (direction) {
        case 'left': endTransform = 'translateX(-35px)'; break;
        case 'right': endTransform = 'translateX(35px)'; break;
        case 'up': endTransform = 'translateY(-35px)'; break;
        case 'down': endTransform = 'translateY(35px)'; break;
        default: endTransform = 'translateX(-35px)';
      }

      element.style.transform = 'translate3d(0, 0, 0)';
      element.style.opacity = '1';
      element.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 1, 1), opacity ${duration}ms cubic-bezier(0.4, 0, 1, 1)`;

      // Force reflow
      void element.offsetHeight;

      requestAnimationFrame(() => {
        element.style.transform = endTransform;
        element.style.opacity = '0';
      });

      const handleEnd = (e) => {
        if (e && e.target !== element) return;
        element.removeEventListener('transitionend', handleEnd);
        element.style.display = 'none';
        element.style.transition = '';
        element.style.transform = '';
        resolve();
      };

      element.addEventListener('transitionend', handleEnd);
      setTimeout(handleEnd, duration + 60);
    });
  }

  /**
   * Custom glassmorphic reveal with backdrop-blur, subtle elevation scale, and specular wipe
   * @param {HTMLElement|string} el 
   * @param {number} [duration=500] 
   * @param {string} [display='block'] 
   * @returns {Promise<void>}
   */
  static glassReveal(el, duration = 500, display = 'block') {
    return new Promise((resolve) => {
      const element = this.getElement(el);
      if (!element) return resolve();

      if (this.isReducedMotion()) {
        element.style.display = display;
        element.style.opacity = '1';
        return resolve();
      }

      element.style.display = display;
      element.style.opacity = '0';
      element.style.transform = 'scale(0.96) translateY(14px)';
      element.style.filter = 'blur(10px)';
      element.style.transition = `
        opacity ${duration}ms cubic-bezier(0, 0, 0.2, 1),
        transform ${duration}ms ${this.defaultEasing},
        filter ${duration}ms ${this.defaultEasing}
      `;

      // Force layout reflow
      void element.offsetHeight;

      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'scale(1) translateY(0)';
        element.style.filter = 'blur(0px)';
      });

      const handleEnd = (e) => {
        if (e && e.target !== element) return;
        element.removeEventListener('transitionend', handleEnd);
        element.style.transition = '';
        element.style.transform = '';
        element.style.filter = '';
        resolve();
      };

      element.addEventListener('transitionend', handleEnd);
      setTimeout(handleEnd, duration + 60);
    });
  }

  /**
   * FLIP Morph transition between two elements (smooth geometric re-layout)
   * @param {HTMLElement|string} fromEl 
   * @param {HTMLElement|string} toEl 
   * @param {number} [duration=400] 
   * @returns {Promise<void>}
   */
  static morphTransition(fromEl, toEl, duration = 400) {
    return new Promise((resolve) => {
      const from = this.getElement(fromEl);
      const to = this.getElement(toEl);

      if (!from || !to) return resolve();

      if (this.isReducedMotion()) {
        from.style.display = 'none';
        to.style.display = 'block';
        return resolve();
      }

      // First: Measure initial geometry
      const firstRect = from.getBoundingClientRect();

      // Show 'to' element temporarily to calculate target bounds
      const origToDisplay = to.style.display;
      to.style.display = 'block';
      to.style.visibility = 'hidden';
      const lastRect = to.getBoundingClientRect();
      to.style.visibility = '';
      to.style.display = origToDisplay;

      // Invert: Calculate deltas
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;
      const deltaW = firstRect.width / (lastRect.width || 1);
      const deltaH = firstRect.height / (lastRect.height || 1);

      // Play: apply inverted transform to target
      to.style.display = 'block';
      to.style.opacity = '0';
      to.style.transformOrigin = 'top left';
      to.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
      to.style.transition = `transform ${duration}ms ${this.defaultEasing}, opacity ${duration * 0.75}ms ease-out`;

      from.style.transition = `opacity ${duration * 0.5}ms ease-in`;
      from.style.opacity = '0';

      void to.offsetHeight; // Reflow

      requestAnimationFrame(() => {
        to.style.opacity = '1';
        to.style.transform = 'none';
      });

      setTimeout(() => {
        from.style.display = 'none';
        from.style.transition = '';
        from.style.opacity = '';
        to.style.transition = '';
        to.style.transform = '';
        to.style.transformOrigin = '';
        resolve();
      }, duration + 40);
    });
  }

  /**
   * Orchestrates high-level transition between two application screens/views
   * @param {HTMLElement|string} fromScreen Current screen to exit
   * @param {HTMLElement|string} toScreen Target screen to enter
   * @param {'fade'|'slide'|'glass'|'morph'} [type='fade'] Transition aesthetic type
   * @param {Object} [options={}] Additional transition configuration options
   * @param {'left'|'right'|'up'|'down'} [options.direction='left'] Slide direction
   * @param {number} [options.duration=350] Transition duration in ms
   * @returns {Promise<void>}
   */
  static async transitionTo(fromScreen, toScreen, type = 'fade', options = {}) {
    const from = this.getElement(fromScreen);
    const to = this.getElement(toScreen);

    if (!to) return;

    const duration = options.duration || (type === 'glass' ? 450 : 320);
    const direction = options.direction || 'left';

    // Accessibility check: Fast path for reduced motion
    if (this.isReducedMotion()) {
      if (from) {
        from.style.display = 'none';
        from.classList.remove('active');
        from.setAttribute('aria-hidden', 'true');
      }
      to.style.display = options.display || 'block';
      to.classList.add('active');
      to.removeAttribute('aria-hidden');
      return;
    }

    if (from) {
      from.setAttribute('aria-hidden', 'true');
    }
    to.removeAttribute('aria-hidden');

    switch (type) {
      case 'slide': {
        const oppositeDir = direction === 'left' ? 'right' : (direction === 'right' ? 'left' : (direction === 'up' ? 'down' : 'up'));
        if (from) {
          await Promise.all([
            this.slideOut(from, direction, duration),
            this.slideIn(to, oppositeDir, duration, options.display || 'block')
          ]);
          from.classList.remove('active');
        } else {
          await this.slideIn(to, oppositeDir, duration, options.display || 'block');
        }
        to.classList.add('active');
        break;
      }

      case 'glass': {
        if (from) {
          await this.fadeOut(from, duration * 0.6);
          from.classList.remove('active');
        }
        await this.glassReveal(to, duration, options.display || 'block');
        to.classList.add('active');
        break;
      }

      case 'morph': {
        if (from) {
          await this.morphTransition(from, to, duration);
          from.classList.remove('active');
        } else {
          await this.fadeIn(to, duration, options.display || 'block');
        }
        to.classList.add('active');
        break;
      }

      case 'fade':
      default: {
        if (from) {
          await this.fadeOut(from, duration * 0.75);
          from.classList.remove('active');
        }
        await this.fadeIn(to, duration, options.display || 'block');
        to.classList.add('active');
        break;
      }
    }
  }
}

// Global window fallback
if (typeof window !== 'undefined') {
  window.TransitionManager = TransitionManager;
}
