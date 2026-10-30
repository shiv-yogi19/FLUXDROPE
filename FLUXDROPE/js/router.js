/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: router.js
 * Author: Shiv Yogi
 * 
 * Hash-based Single Page Application (SPA) Router.
 * Features:
 * - Dynamic route pattern matching with parameters (:sessionId, :joiningCode)
 * - Search query string parsing (?key=value)
 * - Safe 404 fallback redirect to #home
 * - Route history navigation and change listeners
 * - Clean programmatic navigation API
 */

export class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.routeChangeCallbacks = new Set();
    this.historyStack = [];
    this._boundHashListener = this._handleHashChange.bind(this);

    // Register built-in standard routes
    this._registerDefaultRoutes();
  }

  /**
   * Registers default FLUXDROPE route patterns
   * @private
   */
  _registerDefaultRoutes() {
    this.addRoute('#home', 'home');
    this.addRoute('#send', 'send');
    this.addRoute('#receive', 'receive');
    this.addRoute('#receive/:sessionId', 'receive-session');
    this.addRoute('#receive/:joiningCode', 'receive-code');
    this.addRoute('#settings', 'settings');
    this.addRoute('#expired', 'expired');
    this.addRoute('#about', 'about');
  }

  /**
   * Adds a route pattern to the routing table
   * @param {string} pattern - e.g. '#receive/:sessionId'
   * @param {string} name - Internal name for route
   * @param {Function} [handler] - Optional custom handler
   */
  addRoute(pattern, name, handler = null) {
    // Normalize pattern
    let cleanPattern = pattern.startsWith('#') ? pattern : `#${pattern}`;

    // Extract param keys
    const paramNames = [];
    const regexPattern = cleanPattern.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/?#]+)';
    });

    const regex = new RegExp(`^${regexPattern}(?:\\?(.*))?$`);

    this.routes.push({
      pattern: cleanPattern,
      name,
      regex,
      paramNames,
      handler
    });
  }

  /**
   * Starts listening to hash changes in browser window
   */
  start() {
    if (typeof window === 'undefined') return;

    window.addEventListener('hashchange', this._boundHashListener);

    // Initial evaluation on load
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      this.navigate('#home', true);
    } else {
      this._handleHashChange();
    }
  }

  /**
   * Stops listening and cleans up
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', this._boundHashListener);
    }
    this.routeChangeCallbacks.clear();
  }

  /**
   * Handles hashchange event
   * @private
   */
  _handleHashChange() {
    const rawHash = (window.location.hash || '#home').trim();
    const resolved = this._matchRoute(rawHash);

    if (resolved) {
      this.currentRoute = resolved;
      this.historyStack.push(rawHash);

      // Invoke route handler if bound
      if (typeof resolved.route.handler === 'function') {
        resolved.route.handler(resolved);
      }

      // Notify external subscribers
      this._notifyChange(resolved);
    } else {
      // Unrecognized route -> 404 redirect to #home
      console.warn(`Router: 404 route not found for "${rawHash}", redirecting to #home`);
      this.navigate('#home', true);
    }
  }

  /**
   * Matches a given hash string against registered route patterns
   * @private
   * @param {string} hash 
   * @returns {Object|null}
   */
  _matchRoute(hash) {
    const [pathPart, queryPart] = hash.split('?');
    const query = this._parseQuery(queryPart);

    for (const route of this.routes) {
      const match = hash.match(route.regex) || pathPart.match(route.regex);
      if (match) {
        const params = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]] = decodeURIComponent(match[i + 1] || '');
        }

        // Merge query parameters if provided
        if (query.sessionId && !params.sessionId) {
          params.sessionId = query.sessionId;
        }
        if (query.code && !params.joiningCode) {
          params.joiningCode = query.code;
        }
        if (query.joiningCode && !params.joiningCode) {
          params.joiningCode = query.joiningCode;
        }

        return {
          route,
          name: route.name,
          pattern: route.pattern,
          hash: hash,
          path: pathPart,
          params: params,
          query: query
        };
      }
    }

    return null;
  }

  /**
   * Parses URL search query string into an object
   * @private
   * @param {string} queryString 
   * @returns {Object}
   */
  _parseQuery(queryString) {
    const result = {};
    if (!queryString) return result;

    const pairs = queryString.split('&');
    for (const pair of pairs) {
      if (!pair) continue;
      const [k, v] = pair.split('=');
      if (k) {
        result[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return result;
  }

  /**
   * Programmatically navigates to a new route
   * @param {string} targetRoute - e.g. '#send', '#receive/ABC123', '#home'
   * @param {boolean} [replace=false] - Whether to replace current history entry
   */
  navigate(targetRoute, replace = false) {
    if (typeof window === 'undefined') return;

    let dest = targetRoute.startsWith('#') ? targetRoute : `#${targetRoute}`;

    if (replace) {
      const url = `${window.location.pathname}${window.location.search}${dest}`;
      window.history.replaceState(null, '', url);
      this._handleHashChange();
    } else {
      window.location.hash = dest;
    }
  }

  /**
   * Navigates back in browser history
   */
  back() {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }

  /**
   * Returns current active route information
   * @returns {Object|null}
   */
  current() {
    return this.currentRoute;
  }

  /**
   * Subscribes to route change notifications
   * @param {Function} callback - (routeInfo) => void
   * @returns {Function} Unsubscribe function
   */
  onRouteChange(callback) {
    if (typeof callback !== 'function') return () => {};
    this.routeChangeCallbacks.add(callback);

    // Trigger immediately with current route if already loaded
    if (this.currentRoute) {
      callback(this.currentRoute);
    }

    return () => {
      this.routeChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notifies all route change subscribers
   * @private
   */
  _notifyChange(routeInfo) {
    for (const cb of this.routeChangeCallbacks) {
      try {
        cb(routeInfo);
      } catch (err) {
        console.error('Router: Subscriber error on route change', err);
      }
    }
  }
}
