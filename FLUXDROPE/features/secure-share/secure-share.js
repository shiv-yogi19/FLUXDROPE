/**
 * FLUXDROPE - SecureShare Cryptographic Module
 * End-to-End Encryption, Password-Based Key Derivation (PBKDF2),
 * ECDH Shared Secret Combination (HKDF), and Auth Verification Tokens.
 *
 * Created By Shiv Yogi
 */

const VERIFICATION_PLAINTEXT = 'FLUXDROPE_AUTH_VERIFIED_BY_SHIV_YOGI_v1';
const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;

export class SecureShare {
  /**
   * Generate a cryptographically secure random salt
   * @param {number} length - Number of bytes (default 16)
   * @returns {Uint8Array}
   */
  static generateSalt(length = 16) {
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return salt;
  }

  /**
   * Generate a cryptographically secure random Initialization Vector (96-bit for AES-GCM)
   * @returns {Uint8Array}
   */
  static generateIv() {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return iv;
  }

  /**
   * Convert Uint8Array or ArrayBuffer to Base64 string
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {string}
   */
  static toBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to Uint8Array
   * @param {string} base64
   * @returns {Uint8Array}
   */
  static fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert ArrayBuffer or Uint8Array to Hex string
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {string}
   */
  static toHex(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert Hex string to Uint8Array
   * @param {string} hex
   * @returns {Uint8Array}
   */
  static fromHex(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Compute SHA-256 hash of an ArrayBuffer or Uint8Array
   * @param {ArrayBuffer|Uint8Array} data
   * @returns {Promise<string>} Hex hash string
   */
  static async computeSha256(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.toHex(hashBuffer);
  }

  /**
   * Derive an AES-GCM-256 CryptoKey.
   * Seamlessly combines password (PBKDF2) + ECDH shared secret via HKDF.
   * If only password is provided, uses PBKDF2 -> AES-GCM.
   * If only ECDH key is provided, uses HKDF -> AES-GCM.
   *
   * @param {string|null} password - Optional user password
   * @param {Uint8Array|string|null} salt - Salt for PBKDF2 / HKDF
   * @param {CryptoKey|ArrayBuffer|Uint8Array|null} ecdhDerivedKey - ECDH shared secret or raw key material
   * @returns {Promise<CryptoKey>} Derived AES-GCM CryptoKey
   */
  static async deriveKey(password = null, salt = null, ecdhDerivedKey = null) {
    const enc = new TextEncoder();
    const actualSalt = salt instanceof Uint8Array
      ? salt
      : typeof salt === 'string'
        ? this.fromBase64(salt)
        : this.generateSalt(16);

    // Case 1: Both Password and ECDH shared secret are present
    if (password && ecdhDerivedKey) {
      // 1. Derive intermediate key from password via PBKDF2
      const pwKeyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const pbkdf2Bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: actualSalt,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        pwKeyMaterial,
        256
      );

      // 2. Extract raw bytes from ECDH key if it is a CryptoKey
      let ecdhRawBits;
      if (ecdhDerivedKey instanceof CryptoKey) {
        try {
          ecdhRawBits = await crypto.subtle.exportKey('raw', ecdhDerivedKey);
        } catch {
          // If not extractable, derive bits
          ecdhRawBits = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt: actualSalt, info: enc.encode('FLUXDROPE-ECDH-BITS') },
            ecdhDerivedKey,
            256
          );
        }
      } else if (ecdhDerivedKey instanceof ArrayBuffer || ecdhDerivedKey instanceof Uint8Array) {
        ecdhRawBits = ecdhDerivedKey instanceof Uint8Array ? ecdhDerivedKey.buffer : ecdhDerivedKey;
      } else {
        throw new Error('Unsupported ecdhDerivedKey type');
      }

      // 3. Combine ECDH bits + PBKDF2 bits using XOR / concatenation into HKDF input
      const combined = new Uint8Array(64);
      combined.set(new Uint8Array(pbkdf2Bits), 0);
      combined.set(new Uint8Array(ecdhRawBits).subarray(0, 32), 32);

      const hkdfKeyMaterial = await crypto.subtle.importKey(
        'raw',
        combined,
        { name: 'HKDF' },
        false,
        ['deriveKey']
      );

      return await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: actualSalt,
          info: enc.encode('FLUXDROPE-SESSION-KEY-COMBINED')
        },
        hkdfKeyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Case 2: Only Password provided
    if (password && !ecdhDerivedKey) {
      const pwKeyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: actualSalt,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        pwKeyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Case 3: Only ECDH secret provided
    if (!password && ecdhDerivedKey) {
      if (ecdhDerivedKey instanceof CryptoKey && ecdhDerivedKey.algorithm.name === 'AES-GCM') {
        return ecdhDerivedKey;
      }

      let ecdhRawBits;
      if (ecdhDerivedKey instanceof CryptoKey) {
        ecdhRawBits = await crypto.subtle.exportKey('raw', ecdhDerivedKey);
      } else {
        ecdhRawBits = ecdhDerivedKey instanceof Uint8Array ? ecdhDerivedKey.buffer : ecdhDerivedKey;
      }

      const hkdfKeyMaterial = await crypto.subtle.importKey(
        'raw',
        ecdhRawBits,
        { name: 'HKDF' },
        false,
        ['deriveKey']
      );

      return await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: actualSalt,
          info: enc.encode('FLUXDROPE-SESSION-KEY-ECDH-ONLY')
        },
        hkdfKeyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Case 4: Neither provided - Generate a fresh random AES-GCM session key
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Create an authentication verification token to verify password match on the receiver side
   * Encrypts the constant verification string using the derived key.
   *
   * @param {CryptoKey} key - The derived AES-GCM key
   * @returns {Promise<{ ciphertext: string, iv: string }>}
   */
  static async createVerificationToken(key) {
    const iv = this.generateIv();
    const enc = new TextEncoder();
    const plaintext = enc.encode(VERIFICATION_PLAINTEXT);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    return {
      ciphertext: this.toBase64(ciphertextBuffer),
      iv: this.toBase64(iv)
    };
  }

  /**
   * Verify password / derived key against an incoming verification token
   *
   * @param {CryptoKey} key - The candidate AES-GCM key
   * @param {{ ciphertext: string, iv: string }} verificationToken
   * @returns {Promise<boolean>} True if decrypted text matches the known plaintext
   */
  static async verifyPassword(key, verificationToken) {
    if (!verificationToken || !verificationToken.ciphertext || !verificationToken.iv) {
      return false;
    }

    try {
      const iv = this.fromBase64(verificationToken.iv);
      const ciphertext = this.fromBase64(verificationToken.ciphertext);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      const plaintext = dec.decode(decryptedBuffer);

      return plaintext === VERIFICATION_PLAINTEXT;
    } catch {
      // Decryption failed (invalid auth tag or mismatch)
      return false;
    }
  }

  /**
   * Encrypt a chunk of data with AES-GCM
   *
   * @param {ArrayBuffer|Uint8Array} chunkBuffer
   * @param {CryptoKey} key
   * @param {Uint8Array|null} customIv - Optional 12-byte IV
   * @returns {Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }>}
   */
  static async encryptChunk(chunkBuffer, key, customIv = null) {
    const iv = customIv || this.generateIv();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      chunkBuffer
    );
    return { ciphertext, iv };
  }

  /**
   * Decrypt a chunk of data with AES-GCM
   *
   * @param {ArrayBuffer|Uint8Array} encryptedBuffer
   * @param {CryptoKey} key
   * @param {Uint8Array} iv
   * @returns {Promise<ArrayBuffer>}
   */
  static async decryptChunk(encryptedBuffer, key, iv) {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBuffer
    );
  }
}

// Make accessible to window object if running in browser
if (typeof window !== 'undefined') {
  window.SecureShare = SecureShare;
}

export default SecureShare;
