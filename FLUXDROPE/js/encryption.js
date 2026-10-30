/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: encryption.js
 * Author: Shiv Yogi
 * 
 * Cryptography Engine built strictly using the Web Crypto API.
 * Features:
 * - ECDH P-256 Session Key Exchange (Forward Secrecy)
 * - HKDF-SHA-256 Key Derivation
 * - Optional PBKDF2 Password Strengthening (Dual-Layer Encryption)
 * - AES-GCM-256 authenticated chunk encryption
 * - Unique 96-bit (12-byte) cryptographically secure IV per chunk
 * - SHA-256 File Integrity Verification
 */

// Constants
export const AES_KEY_LENGTH = 256;
export const IV_LENGTH_BYTES = 12; // 96-bit IV for AES-GCM
export const PBKDF2_ITERATIONS = 100000;
export const DEFAULT_HKDF_INFO = 'FLUXDROPE_E2EE_V1';
export const DEFAULT_SALT = 'FLUXDROPE_SECURE_SALT_2026';

/**
 * Utility: Convert ArrayBuffer / Uint8Array to Base64 string
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string}
 */
export function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert Base64 string to Uint8Array
 * @param {string} base64 
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Utility: Convert ArrayBuffer / Uint8Array to Hexadecimal string
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string}
 */
export function bufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Utility: Convert Hexadecimal string to Uint8Array
 * @param {string} hex 
 * @returns {Uint8Array}
 */
export function hexToBuffer(hex) {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Generates a random salt buffer
 * @param {number} lengthBytes 
 * @returns {Uint8Array}
 */
export function generateSalt(lengthBytes = 16) {
  const salt = new Uint8Array(lengthBytes);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Generates an ephemeral ECDH P-256 key pair for the transfer session
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateECDHKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // Extractable to allow exporting public key
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Exports an ECDH public key to a Base64-encoded raw uncompressed point string
 * @param {CryptoKey} publicKey 
 * @returns {Promise<string>} Base64 representation of public key raw bytes
 */
export async function exportPublicKey(publicKey) {
  if (!publicKey) {
    throw new Error('exportPublicKey: Missing publicKey parameter');
  }
  const rawKey = await crypto.subtle.exportKey('raw', publicKey);
  return bufferToBase64(rawKey);
}

/**
 * Imports an ECDH public key from a Base64 string or Uint8Array/ArrayBuffer
 * @param {string|ArrayBuffer|Uint8Array} data 
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(data) {
  if (!data) {
    throw new Error('importPublicKey: Missing data parameter');
  }
  const buffer = typeof data === 'string' ? base64ToBuffer(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
  return await crypto.subtle.importKey(
    'raw',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  );
}

/**
 * Derives a shared AES-GCM-256 key using ECDH shared bits and HKDF-SHA-256 expansion
 * @param {CryptoKey} localPrivKey - Local ephemeral ECDH private key
 * @param {CryptoKey} remotePubKey - Remote peer ECDH public key
 * @param {Uint8Array|string|null} salt - Optional salt
 * @param {Uint8Array|string|null} info - Optional context info string
 * @returns {Promise<CryptoKey>} Derived AES-GCM-256 key
 */
export async function deriveSharedKey(localPrivKey, remotePubKey, salt = null, info = null) {
  if (!localPrivKey || !remotePubKey) {
    throw new Error('deriveSharedKey: Missing localPrivKey or remotePubKey');
  }

  // 1. Compute ECDH shared bits (256 bits = 32 bytes)
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: remotePubKey
    },
    localPrivKey,
    256
  );

  // 2. Import raw bits as HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // 3. Prepare salt and context info
  const enc = new TextEncoder();
  const saltBuffer = salt
    ? (typeof salt === 'string' ? enc.encode(salt) : salt)
    : enc.encode(DEFAULT_SALT);

  const infoBuffer = info
    ? (typeof info === 'string' ? enc.encode(info) : info)
    : enc.encode(DEFAULT_HKDF_INFO);

  // 4. Derive final AES-GCM-256 key
  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: infoBuffer
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true, // Extractable so keys can be combined with optional password
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives an AES-GCM-256 key from a user password using PBKDF2 with 100,000 iterations
 * @param {string} password 
 * @param {Uint8Array|string|null} salt 
 * @returns {Promise<CryptoKey>}
 */
export async function derivePasswordKey(password, salt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('derivePasswordKey: Invalid or missing password string');
  }

  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const saltBuffer = salt
    ? (typeof salt === 'string' ? enc.encode(salt) : salt)
    : enc.encode(DEFAULT_SALT);

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true, // Extractable for key combination
    ['encrypt', 'decrypt']
  );
}

/**
 * Combines an ECDH shared key and a PBKDF2 password key into a unified AES-GCM-256 key
 * Ensures both ECDH key exchange AND password verification are required to decrypt.
 * @param {CryptoKey} ecdhKey 
 * @param {CryptoKey} passwordKey 
 * @returns {Promise<CryptoKey>}
 */
export async function combineKeys(ecdhKey, passwordKey) {
  if (!ecdhKey || !passwordKey) {
    throw new Error('combineKeys: Both ecdhKey and passwordKey are required');
  }

  // Export raw bytes of both keys
  const [ecdhRaw, passRaw] = await Promise.all([
    crypto.subtle.exportKey('raw', ecdhKey),
    crypto.subtle.exportKey('raw', passwordKey)
  ]);

  // Concatenate keys: 32 + 32 = 64 bytes
  const combined = new Uint8Array(ecdhRaw.byteLength + passRaw.byteLength);
  combined.set(new Uint8Array(ecdhRaw), 0);
  combined.set(new Uint8Array(passRaw), ecdhRaw.byteLength);

  // Hash combined material via SHA-256 to create final 256-bit symmetric key
  const finalDigest = await crypto.subtle.digest('SHA-256', combined);

  // Import as AES-GCM key
  return await crypto.subtle.importKey(
    'raw',
    finalDigest,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a chunk of data with AES-GCM-256.
 * Generates a fresh unique 12-byte IV for every chunk, and prepends IV to ciphertext.
 * Result format: [ 12-byte IV | Ciphertext + 16-byte Auth Tag ]
 * 
 * @param {CryptoKey} key - AES-GCM CryptoKey
 * @param {Uint8Array|null} iv - Optional explicit IV (if null, a cryptographically random IV is generated)
 * @param {ArrayBuffer|Uint8Array} data - Plaintext chunk data
 * @returns {Promise<ArrayBuffer>} Encrypted buffer with 12-byte IV prepended
 */
export async function encryptChunk(key, iv = null, data) {
  if (!key) {
    throw new Error('encryptChunk: Missing encryption key');
  }
  if (!data) {
    throw new Error('encryptChunk: Missing data buffer');
  }

  // Ensure unique 96-bit (12-byte) IV
  const chunkIV = (iv && iv instanceof Uint8Array && iv.byteLength === IV_LENGTH_BYTES)
    ? iv
    : crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const plaintextBuffer = data instanceof Uint8Array ? data.buffer : data;

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: chunkIV,
      tagLength: 128
    },
    key,
    plaintextBuffer
  );

  // Prepend IV (12 bytes) to ciphertext
  const result = new Uint8Array(IV_LENGTH_BYTES + ciphertext.byteLength);
  result.set(chunkIV, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH_BYTES);

  return result.buffer;
}

/**
 * Decrypts a chunk of data with AES-GCM-256.
 * Extracts the 12-byte IV from the beginning of the buffer and decrypts the remainder.
 * 
 * @param {CryptoKey} key - AES-GCM CryptoKey
 * @param {ArrayBuffer|Uint8Array} encryptedData - Buffer with IV prepended
 * @returns {Promise<ArrayBuffer>} Plaintext buffer
 */
export async function decryptChunk(key, encryptedData) {
  if (!key) {
    throw new Error('decryptChunk: Missing decryption key');
  }
  if (!encryptedData) {
    throw new Error('decryptChunk: Missing encryptedData buffer');
  }

  const bytes = encryptedData instanceof Uint8Array
    ? encryptedData
    : new Uint8Array(encryptedData);

  if (bytes.byteLength < IV_LENGTH_BYTES + 16) {
    throw new Error('decryptChunk: Encrypted payload is shorter than IV + GCM tag length');
  }

  // Extract 12-byte IV and ciphertext
  const iv = bytes.subarray(0, IV_LENGTH_BYTES);
  const ciphertext = bytes.subarray(IV_LENGTH_BYTES);

  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    key,
    ciphertext
  );
}

/**
 * Calculates SHA-256 file integrity hash across an array of chunks or a single buffer.
 * If multiple chunks are provided, computes a deterministic Merkle-tree hash of chunk digests
 * or flat concatenated SHA-256 digest to support arbitrarily large files without RAM exhaustion.
 * 
 * @param {ArrayBuffer[]|Uint8Array[]|ArrayBuffer|Uint8Array} chunks 
 * @returns {Promise<string>} Hexadecimal SHA-256 digest
 */
export async function hashFile(chunks) {
  if (!chunks) {
    throw new Error('hashFile: Missing chunks parameter');
  }

  // Single buffer case
  if (chunks instanceof ArrayBuffer || chunks instanceof Uint8Array) {
    const buf = chunks instanceof Uint8Array ? chunks.buffer : chunks;
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return bufferToHex(digest);
  }

  // Array of chunks case
  if (!Array.isArray(chunks) || chunks.length === 0) {
    // Empty array gives hash of empty string
    const emptyDigest = await crypto.subtle.digest('SHA-256', new Uint8Array(0));
    return bufferToHex(emptyDigest);
  }

  // Calculate total byte size
  let totalBytes = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalBytes += chunks[i].byteLength || 0;
  }

  // If under 64MB, concatenate and hash in one pass for exact binary match
  if (totalBytes <= 64 * 1024 * 1024) {
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      const item = chunks[i];
      const view = item instanceof Uint8Array ? item : new Uint8Array(item);
      combined.set(view, offset);
      offset += view.byteLength;
    }
    const digest = await crypto.subtle.digest('SHA-256', combined);
    return bufferToHex(digest);
  }

  // For very large files, hash each chunk and hash concatenated hashes
  const intermediateDigests = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkBuf = chunks[i] instanceof Uint8Array ? chunks[i].buffer : chunks[i];
    const chunkDigest = await crypto.subtle.digest('SHA-256', chunkBuf);
    intermediateDigests.push(new Uint8Array(chunkDigest));
  }

  const combinedDigests = new Uint8Array(intermediateDigests.length * 32);
  for (let i = 0; i < intermediateDigests.length; i++) {
    combinedDigests.set(intermediateDigests[i], i * 32);
  }

  const masterDigest = await crypto.subtle.digest('SHA-256', combinedDigests);
  return bufferToHex(masterDigest);
}

/**
 * Sanitizes and clears key references to prevent memory leaks or key retention
 * @param {Object|CryptoKey} keyHolder 
 */
export function clearKey(keyHolder) {
  if (!keyHolder) return;
  if (typeof keyHolder === 'object') {
    for (const key of Object.keys(keyHolder)) {
      try {
        keyHolder[key] = null;
      } catch (_) {
        // Ignore read-only properties
      }
    }
  }
}
