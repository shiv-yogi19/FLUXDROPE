/**
 * FLUXDROPE - Unit Tests: Cryptographic Engine & E2EE
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import {
  computeSha256,
  generateSessionId,
  generateJoiningCode,
  hashPasswordForVerification,
  verifyPasswordHash,
  deriveE2EEKey,
  encryptChunk,
  decryptChunk,
  getRandomBytes
} from '../../public/js/security/crypto.js';

export async function runCryptoTests() {
  console.log('\n--- Running Cryptographic & E2EE Tests ---');

  // Test 1: SHA-256 Hash computation
  const testData = new TextEncoder().encode('FLUXDROPE Created By Shiv Yogi');
  const hash = await computeSha256(testData);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64, 'SHA-256 hex string should be 64 characters');
  console.log('✓ SHA-256 hash computation valid:', hash.slice(0, 16) + '...');

  // Test 2: Secure Session ID generation
  const sessionId = generateSessionId();
  assert.match(sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  console.log('✓ Cryptographically secure UUIDv4 session ID generated:', sessionId);

  // Test 3: 6-Digit Joining Code generation
  const code = generateJoiningCode();
  assert.match(code, /^\d{6}$/, 'Joining code must be exactly 6 decimal digits');
  console.log('✓ 6-Digit random joining code generated:', code);

  // Test 4: PBKDF2 Password Hashing & Constant-time Verification
  const password = 'SecretPassword123!';
  const { hashHex, saltHex } = await hashPasswordForVerification(password);
  assert.equal(typeof hashHex, 'string');
  assert.equal(typeof saltHex, 'string');

  const isValid = await verifyPasswordHash(password, hashHex, saltHex);
  assert.equal(isValid, true, 'Valid password must verify');

  const isInvalid = await verifyPasswordHash('WrongPassword', hashHex, saltHex);
  assert.equal(isInvalid, false, 'Invalid password must be rejected');
  console.log('✓ PBKDF2 password hashing & verification verified');

  // Test 5: End-to-End Encryption (E2EE) with AES-256-GCM
  const salt = getRandomBytes(16);
  const baseNonce = getRandomBytes(8);
  const e2eeKey = await deriveE2EEKey('E2EE-Passphrase-2026', salt);

  const clearChunk = new TextEncoder().encode('High-Performance Peer-to-Peer Binary Chunk Data').buffer;
  const chunkIndex = 42;

  // Encrypt chunk
  const encryptedChunk = await encryptChunk(e2eeKey, clearChunk, baseNonce, chunkIndex);
  assert.notEqual(encryptedChunk.byteLength, clearChunk.byteLength, 'Encrypted chunk includes 16-byte GCM tag');

  // Decrypt chunk
  const decryptedChunk = await decryptChunk(e2eeKey, encryptedChunk, baseNonce, chunkIndex);
  const decryptedText = new TextDecoder().decode(decryptedChunk);
  assert.equal(decryptedText, 'High-Performance Peer-to-Peer Binary Chunk Data');
  console.log('✓ AES-256-GCM chunk encryption and authenticated decryption passed');

  // Test 6: Corrupted ciphertext rejection (GCM Authentication failure)
  const corrupted = new Uint8Array(encryptedChunk);
  corrupted[10] ^= 0xff; // flip bit
  await assert.rejects(
    async () => {
      await decryptChunk(e2eeKey, corrupted.buffer, baseNonce, chunkIndex);
    },
    'Tampered ciphertext must fail GCM authentication'
  );
  console.log('✓ GCM authentication tag integrity confirmed (tampering rejected)');

  return true;
}
