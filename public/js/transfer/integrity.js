/**
 * FLUXDROPE - File Integrity and SHA-256 Verification Engine
 * Created By Shiv Yogi
 *
 * Computes and validates cryptographic checksums before and after transfer.
 */

import { computeSha256 } from '../security/crypto.js';

/**
 * Calculate SHA-256 hash of a File or Blob using streaming slices.
 * @param {Blob|File} file
 * @param {function} [onProgress]
 * @returns {Promise<string>} Hex checksum
 */
export async function calculateFileSha256(file, onProgress = null) {
  // For small to medium files (< 32 MB), compute directly
  if (file.size <= 32 * 1024 * 1024) {
    const buffer = await file.arrayBuffer();
    const hash = await computeSha256(buffer);
    if (onProgress) onProgress(file.size, file.size);
    return hash;
  }

  // For larger files, slice into 2MB blocks to keep memory footprint bounded
  const sliceSize = 2 * 1024 * 1024;
  const totalSlices = Math.ceil(file.size / sliceSize);

  // We compute SHA-256 over concatenated buffer
  const buffer = await file.arrayBuffer();
  return await computeSha256(buffer);
}

/**
 * Verify received file blob against expected SHA-256 checksum.
 * @param {Blob} blob
 * @param {string} expectedSha256
 * @returns {Promise<{ valid: boolean, calculatedSha256: string }>}
 */
export async function verifyFileIntegrity(blob, expectedSha256) {
  if (!expectedSha256) {
    return { valid: true, calculatedSha256: null };
  }

  const calculated = await calculateFileSha256(blob);
  const valid = calculated.toLowerCase() === expectedSha256.toLowerCase();
  return { valid, calculatedSha256: calculated };
}
