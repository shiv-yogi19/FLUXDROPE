/**
 * FLUXDROPE - Shared Constants and Protocol Definitions
 * Created By Shiv Yogi
 */

export const APP_INFO = {
  NAME: 'FLUXDROPE',
  BRANDING: 'Created By Shiv Yogi',
  VERSION: '1.0.0',
  TAGLINE: 'Liquid Glass High-Performance Peer-to-Peer File Transfer',
  FILENAME_SUFFIX: '_FLUXDROPE_Created_By_Shiv_Yogi',
};

export const TRANSFER_LIMITS = {
  DEFAULT_CHUNK_SIZE: 64 * 1024, // 64 KB per chunk (optimal for WebRTC DataChannel)
  MIN_CHUNK_SIZE: 16 * 1024,      // 16 KB
  MAX_CHUNK_SIZE: 256 * 1024,     // 256 KB
  HIGH_WATER_MARK: 1024 * 1024,   // 1 MB backpressure pause threshold
  LOW_WATER_MARK: 256 * 1024,     // 256 KB backpressure resume threshold
  DEFAULT_SESSION_EXPIRY_MS: 60 * 60 * 1000, // 1 hour
  MAX_SESSION_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
};

export const SECURITY_POLICY = {
  MAX_PASSWORD_ATTEMPTS: 6,
  LOCKOUT_THRESHOLD: 7, // 7th failed attempt locks
  LOCKOUT_DURATION_MS: 10 * 60 * 1000, // 10 minutes lockout
  PBKDF2_ITERATIONS: 100000,
  AES_KEY_LENGTH: 256,
  GCM_IV_LENGTH: 12, // 96 bits for AES-GCM
  SALT_LENGTH: 16,
};

export const SIGNALING_TYPES = {
  SESSION_CREATE: 'session:create',
  SESSION_CREATED: 'session:created',
  SESSION_JOIN: 'session:join',
  SESSION_JOINED: 'session:joined',
  SESSION_STATUS: 'session:status',
  SESSION_CLOSE: 'session:close',
  PASSWORD_VERIFY: 'password:verify',
  PASSWORD_RESULT: 'password:result',
  OFFER: 'webrtc:offer',
  ANSWER: 'webrtc:answer',
  CANDIDATE: 'webrtc:candidate',
  TRANSFER_META: 'transfer:meta',
  TRANSFER_PROGRESS: 'transfer:progress',
  TRANSFER_ACK: 'transfer:ack',
  TRANSFER_CANCEL: 'transfer:cancel',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
};

export const CONNECTION_STATES = {
  INITIALIZING: 'Initializing',
  WAITING_RECEIVER: 'Waiting for receiver',
  CONNECTING: 'Connecting',
  ESTABLISHING_SESSION: 'Establishing secure session',
  NEGOTIATING_WEBRTC: 'Negotiating WebRTC',
  CONNECTED: 'Connected',
  SENDING: 'Sending',
  RECEIVING: 'Receiving',
  RECONNECTING: 'Reconnecting',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

export const PERFORMANCE_MODES = {
  PERFORMANCE: 'performance',
  BALANCED: 'balanced',
  QUALITY: 'quality',
};

export const LAYOUT_MODES = {
  MOBILE: [
    { id: 'm1-aurora', name: 'Aurora Glass', category: 'mobile', desc: 'Rich blue and violet lighting, large glass cards, circular progress' },
    { id: 'm2-crystal', name: 'Crystal Flow', category: 'mobile', desc: 'Translucent glass panels, fine borders, organized file cards' },
    { id: 'm3-obsidian', name: 'Obsidian Glass', category: 'mobile', desc: 'Deep black surfaces, minimal glow, high-contrast typography' },
    { id: 'm4-waves', name: 'Liquid Waves', category: 'mobile', desc: 'Subtle animated waves, layered glass panels, smooth page transitions' },
    { id: 'm5-holographic', name: 'Holographic Glass', category: 'mobile', desc: 'Holographic highlights, SVG lighting effects, animated QR reveal' },
    { id: 'm6-floating', name: 'Floating Glass', category: 'mobile', desc: 'Floating action controls, separate glass cards, easy one-handed navigation' },
    { id: 'm7-minimal', name: 'Hyper Minimal Glass', category: 'mobile', desc: 'Minimal decoration, large touch targets, reduced blur, fast rendering' },
  ],
  DESKTOP: [
    { id: 'd1-aurora', name: 'Aurora Desktop', category: 'desktop', desc: 'Wide dashboard, prominent transfer cards, large status panels' },
    { id: 'd2-crystal', name: 'Crystal Workspace', category: 'desktop', desc: 'Left navigation, central transfer workspace, right file details' },
    { id: 'd3-obsidian', name: 'Obsidian Pro', category: 'desktop', desc: 'Deep black interface, detailed transfer statistics, pro file management' },
    { id: 'd4-waves', name: 'Liquid Waves Desktop', category: 'desktop', desc: 'Wide glass panels, subtle animated aurora, dynamic progress visualization' },
    { id: 'd5-holographic', name: 'Holographic Command', category: 'desktop', desc: 'Live diagnostics HUD, session telemetry, QR panel' },
    { id: 'd6-floating', name: 'Floating Workspace', category: 'desktop', desc: 'Floating and resizable panels, separate file preview area' },
    { id: 'd7-minimal', name: 'Hyper Minimal Desktop', category: 'desktop', desc: 'Clean navigation, efficient spacing, minimal effects, keyboard friendly' },
  ],
};
