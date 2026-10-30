/**
 * FLUXDROPE - Cryptographic Engine (Web Crypto API)
 * Created By Shiv Yogi
 *
 * Implements:
 * - PBKDF2 key derivation (100,000 iterations, SHA-256)
 * - AES-GCM 256 authenticated encryption per chunk
 * - Nonce management (ensuring zero IV reuse per chunk)
 * - SHA-256 incremental/buffer checksum for integrity
 * - Cryptographically secure session tokens & joining codes
 */

import { SECURITY_POLICY } from '../constants.js';

const webCrypto = typeof crypto !== 'undefined' ? crypto : null;

/**
 * Generate cryptographically secure random bytes.
 * @param {number} length
 * @returns {Uint8Array}
 */
export function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  webCrypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert an ArrayBuffer or Uint8Array to a hex string.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function bufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to Uint8Array.
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure random session ID (UUID v4 format).
 * @returns {string}
 */
export function generateSessionId() {
  if (typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bufferToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate an unpredictable 6-digit numeric joining code (e.g. "849201").
 * Uses rejection sampling to prevent modulo bias.
 * @returns {string}
 */
export function generateJoiningCode() {
  const bytes = new Uint32Array(1);
  const max = 1000000;
  const limit = 0xffffffff - (0xffffffff % max);
  do {
    webCrypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);

  return (bytes[0] % max).toString().padStart(6, '0');
}

/**
 * Compute SHA-256 hash of an ArrayBuffer or Uint8Array.
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<string>} Hex string
 */
export async function computeSha256(data) {
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  const digest = await webCrypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(digest);
}

/**
 * Hash a password with PBKDF2 for server verification or storage.
 * @param {string} password
 * @param {Uint8Array} [salt]
 * @returns {Promise<{ hashHex: string, saltHex: string }>}
 */
export async function hashPasswordForVerification(password, salt = null) {
  const saltBytes = salt || getRandomBytes(SECURITY_POLICY.SALT_LENGTH);
  const enc = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await webCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: SECURITY_POLICY.PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return {
    hashHex: bufferToHex(derivedBits),
    saltHex: bufferToHex(saltBytes)
  };
}

/**
 * Verify a plaintext password against a stored PBKDF2 hash.
 * @param {string} password
 * @param {string} storedHashHex
 * @param {string} saltHex
 * @returns {Promise<boolean>}
 */
export async function verifyPasswordHash(password, storedHashHex, saltHex) {
  const saltBytes = hexToBuffer(saltHex);
  const { hashHex } = await hashPasswordForVerification(password, saltBytes);
  // Constant-time comparison
  if (hashHex.length !== storedHashHex.length) return false;
  let result = 0;
  for (let i = 0; i < hashHex.length; i++) {
    result |= hashHex.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from a user password for E2EE.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveE2EEKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await webCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: SECURITY_POLICY.PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: SECURITY_POLICY.AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Construct a safe 96-bit (12-byte) IV for a specific chunk index.
 * Uses a base random 8-byte prefix + 4-byte big-endian chunk index.
 * This guarantees zero IV collisions for up to 2^32 chunks per session.
 * @param {Uint8Array} baseNonce 8 bytes
 * @param {number} chunkIndex
 * @returns {Uint8Array} 12 bytes
 */
export function buildChunkIv(baseNonce, chunkIndex) {
  const iv = new Uint8Array(12);
  iv.set(baseNonce.subarray(0, 8), 0);
  const view = new DataView(iv.buffer);
  view.setUint32(8, chunkIndex, false); // big endian
  return iv;
}

/**
 * Encrypt a single chunk of file data using AES-GCM.
 * @param {CryptoKey} key
 * @param {ArrayBuffer} chunkData
 * @param {Uint8Array} baseNonce 8 bytes
 * @param {number} chunkIndex
 * @returns {Promise<ArrayBuffer>} Encrypted buffer (includes GCM 128-bit tag)
 */
export async function encryptChunk(key, chunkData, baseNonce, chunkIndex) {
  const iv = buildChunkIv(baseNonce, chunkIndex);
  return await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    key,
    chunkData
  );
}

/**
 * Decrypt a single chunk of file data using AES-GCM.
 * @param {CryptoKey} key
 * @param {ArrayBuffer} encryptedChunk
 * @param {Uint8Array} baseNonce 8 bytes
 * @param {number} chunkIndex
 * @returns {Promise<ArrayBuffer>} Decrypted buffer
 */
export async function decryptChunk(key, encryptedChunk, baseNonce, chunkIndex) {
  const iv = buildChunkIv(baseNonce, chunkIndex);
  return await webCrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    key,
    encryptedChunk
  );
}
