/**
 * FLUXDROPE - Cloudflare Worker Entry Point
 * Created By Shiv Yogi
 *
 * Directs incoming HTTP/WebSocket traffic to Durable Objects and serves static assets.
 */

import { TransferSessionDO } from './TransferSessionDO.js';
import { getSecurityHeaders } from './security.js';

export { TransferSessionDO };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      // 1. Session Creation API
      if (path === '/api/session/create' && request.method === 'POST') {
        const body = await request.clone().json();
        const sessionId = body.sessionId || crypto.randomUUID();
        const doId = env.TRANSFER_SESSIONS.idFromName(sessionId);
        const stub = env.TRANSFER_SESSIONS.get(doId);

        // Also record joining code mapping if KV or DO available
        if (env.CODE_MAPPINGS && body.joiningCode) {
          await env.CODE_MAPPINGS.put(body.joiningCode, sessionId, { expirationTtl: 86400 });
        }

        const doRes = await stub.fetch(new Request('https://do/create', {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({ ...body, sessionId })
        }));

        return addSecurityHeaders(doRes);
      }

      // 2. Resolve Joining Code to Session ID
      if (path.startsWith('/api/session/by-code/') && request.method === 'GET') {
        const code = path.split('/api/session/by-code/')[1];
        let sessionId = null;

        if (env.CODE_MAPPINGS) {
          sessionId = await env.CODE_MAPPINGS.get(code);
        }

        if (!sessionId) {
          // If KV not bound, code can be formatted as numeric ID or directly mapped
          return jsonResponse({ error: 'Transfer session not found for this joining code' }, 404);
        }

        return jsonResponse({ sessionId, joiningCode: code }, 200);
      }

      // 3. Session Info & Password Verification
      const sessionMatch = path.match(/^\/api\/session\/([a-zA-Z0-9_-]+)\/(info|verify-password|close)$/);
      if (sessionMatch) {
        const [, sessionId, action] = sessionMatch;
        const doId = env.TRANSFER_SESSIONS.idFromName(sessionId);
        const stub = env.TRANSFER_SESSIONS.get(doId);

        const doRes = await stub.fetch(new Request(`https://do/${action}`, {
          method: request.method,
          headers: request.headers,
          body: request.method === 'POST' ? request.body : null
        }));

        return addSecurityHeaders(doRes);
      }

      // 4. WebSocket Signaling Endpoint
      const wsMatch = path.match(/^\/ws\/signaling\/([a-zA-Z0-9_-]+)/);
      if (wsMatch) {
        const sessionId = wsMatch[1];
        const doId = env.TRANSFER_SESSIONS.idFromName(sessionId);
        const stub = env.TRANSFER_SESSIONS.get(doId);

        return stub.fetch(request);
      }

      // 5. Static Assets Serving (Cloudflare Pages / Workers Assets)
      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        return addSecurityHeaders(assetResponse);
      }

      return jsonResponse({ error: 'Route not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: 'Internal Server Error', message: err.message }, 500);
    }
  }
};

function jsonResponse(data, status = 200) {
  const res = new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
  return addSecurityHeaders(res);
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const sec = getSecurityHeaders();
  for (const [key, value] of sec.entries()) {
    headers.set(key, value);
  }
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
