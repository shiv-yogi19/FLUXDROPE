/**
 * FLUXDROPE - Premium P2P End-to-End Encrypted File Sharing
 * Module: file-manager.js
 * Author: Shiv Yogi
 * 
 * High-performance file handling, chunk streaming, and reassembly.
 * Features:
 * - File selection, aggregation, and validation
 * - Safe file chunking (stream reading via ArrayBuffer slices)
 * - Safe filename sanitization (protecting against path traversal and forbidden characters)
 * - Custom download naming: 'name_FLUXDROPE_Created_By_Shiv_Yogi.ext'
 * - StreamReceiver for incoming chunk reassembly and SHA-256 integrity validation
 * - Human-readable size, speed, and time formatters
 */

import { hashFile } from './encryption.js';

export class FileManager {
  constructor() {
    /** @type {File[]} */
    this.files = [];
  }

  /**
   * Replaces the current file list with selected files
   * @param {FileList|File[]} input 
   * @returns {Array<Object>} Metadata of accepted files
   */
  selectFiles(input) {
    this.files = [];
    return this.addFiles(input);
  }

  /**
   * Appends files to the current list
   * @param {FileList|File[]} input 
   * @returns {Array<Object>} Updated metadata array
   */
  addFiles(input) {
    if (!input) return this.getMetadata();

    const newFiles = Array.from(input).filter(f => f instanceof File);
    for (const file of newFiles) {
      // Avoid duplicate file entries with same name, size, and lastModified
      const exists = this.files.some(existing => 
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
      );
      if (!exists) {
        this.files.push(file);
      }
    }

    return this.getMetadata();
  }

  /**
   * Removes a file from the list at the given index
   * @param {number} index 
   * @returns {Array<Object>} Updated metadata array
   */
  removeFile(index) {
    if (index >= 0 && index < this.files.length) {
      this.files.splice(index, 1);
    }
    return this.getMetadata();
  }

  /**
   * Clears all selected files
   */
  clearFiles() {
    this.files = [];
  }

  /**
   * Returns metadata for all current files
   * @returns {Array<{ id: string, name: string, size: number, type: string, lastModified: number, formattedSize: string }>}
   */
  getMetadata() {
    return this.files.map((file, idx) => ({
      id: `file_${idx}_${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
      formattedSize: FileManager.formatSize(file.size)
    }));
  }

  /**
   * Calculates total byte size of all selected files
   * @returns {number} Total bytes
   */
  getTotalSize() {
    return this.files.reduce((acc, f) => acc + (f.size || 0), 0);
  }

  /**
   * Asynchronously reads a specific chunk from a File object
   * @param {File} file 
   * @param {number} offset 
   * @param {number} chunkSize 
   * @returns {Promise<ArrayBuffer>}
   */
  async readChunk(file, offset, chunkSize) {
    if (!file) {
      throw new Error('readChunk: Missing file parameter');
    }
    const end = Math.min(offset + chunkSize, file.size);
    const slice = file.slice(offset, end);
    return await slice.arrayBuffer();
  }

  /**
   * Builds a JSON-safe transfer manifest packet containing metadata for all files
   * Contains strictly NO file contents.
   * @param {File[]} [customFiles]
   * @param {number} [chunkSize=65536]
   * @returns {Object} Manifest packet
   */
  buildFileMetadataPacket(customFiles = null, chunkSize = 64 * 1024) {
    const fileList = customFiles || this.files;
    const items = fileList.map((f, i) => {
      const totalChunks = Math.ceil(f.size / chunkSize) || 1;
      return {
        id: `flux_file_${i}_${f.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        index: i,
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        lastModified: f.lastModified,
        chunkSize: chunkSize,
        totalChunks: totalChunks
      };
    });

    return {
      type: 'fluxdrope-manifest',
      timestamp: Date.now(),
      totalFiles: items.length,
      totalSize: items.reduce((sum, item) => sum + item.size, 0),
      files: items
    };
  }

  /**
   * Sanitizes a filename to protect against directory traversal and invalid characters
   * @param {string} name 
   * @returns {string} Safe filename
   */
  static sanitizeFilename(name) {
    if (!name || typeof name !== 'string') {
      return 'fluxdrope_file.bin';
    }

    // Strip directory traversal patterns: ../ or ..\
    let clean = name.replace(/\.\.[\/\\]/g, '');

    // Strip path prefixes
    clean = clean.split(/[/\\]/).pop() || '';

    // Replace invalid/dangerous filesystem characters: < > : " / \ | ? * and null bytes
    clean = clean.replace(/[\x00-\x1f\x80-\x9f<>:"/\\|?*]/g, '_');

    // Trim whitespace and trailing periods
    clean = clean.trim().replace(/\.+$/, '');

    return clean || 'fluxdrope_file.bin';
  }

  /**
   * Generates standard FLUXDROPE branded download filename:
   * 'name_FLUXDROPE_Created_By_Shiv_Yogi.ext'
   * 
   * @param {string} originalName 
   * @returns {string} Branded filename
   */
  static generateDownloadFilename(originalName) {
    const clean = FileManager.sanitizeFilename(originalName);
    const lastDot = clean.lastIndexOf('.');

    const BRAND_SUFFIX = '_FLUXDROPE_Created_By_Shiv_Yogi';

    if (lastDot > 0) {
      const baseName = clean.substring(0, lastDot);
      const extension = clean.substring(lastDot);
      return `${baseName}${BRAND_SUFFIX}${extension}`;
    }

    return `${clean}${BRAND_SUFFIX}`;
  }

  /**
   * Triggers an automatic client-side browser download for a Blob
   * @param {Blob} blob 
   * @param {string} filename 
   */
  static downloadBlob(blob, filename) {
    if (!blob) {
      throw new Error('downloadBlob: Blob is required');
    }

    const safeName = FileManager.generateDownloadFilename(filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener noreferrer';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 15000);
  }

  /**
   * Formats a byte number to human-readable string (B, KB, MB, GB, TB)
   * @param {number} bytes 
   * @param {number} [decimals=2] 
   * @returns {string}
   */
  static formatSize(bytes, decimals = 2) {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${val} ${sizes[i]}`;
  }

  /**
   * Formats transfer speed in bytes per second
   * @param {number} bytesPerSec 
   * @returns {string} e.g. "14.2 MB/s"
   */
  static formatSpeed(bytesPerSec) {
    if (typeof bytesPerSec !== 'number' || isNaN(bytesPerSec) || bytesPerSec <= 0) {
      return '0 B/s';
    }
    return `${FileManager.formatSize(bytesPerSec, 1)}/s`;
  }

  /**
   * Formats seconds into human-readable estimated time remaining (ETA)
   * @param {number} seconds 
   * @returns {string} e.g. "2m 15s" or "< 1s"
   */
  static formatTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) {
      return '--';
    }

    const totalSeconds = Math.round(seconds);
    if (totalSeconds < 1) return '< 1s';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

/**
 * StreamReceiver
 * Accumulates incoming decrypted chunks for a specific file,
 * tracks progress, finalizes to a Blob, and performs SHA-256 hash validation.
 */
export class StreamReceiver {
  /**
   * @param {Object} fileMetadata - Object from file manifest
   * @param {string} fileMetadata.id
   * @param {string} fileMetadata.name
   * @param {number} fileMetadata.size
   * @param {string} fileMetadata.type
   * @param {number} fileMetadata.totalChunks
   * @param {string} [fileMetadata.expectedHash]
   */
  constructor(fileMetadata) {
    this.metadata = fileMetadata;
    this.name = fileMetadata.name;
    this.size = fileMetadata.size || 0;
    this.type = fileMetadata.type || 'application/octet-stream';
    this.totalChunks = fileMetadata.totalChunks || 1;
    this.expectedHash = fileMetadata.expectedHash || null;

    /** @type {Array<ArrayBuffer|Uint8Array|null>} */
    this.chunks = new Array(this.totalChunks).fill(null);
    this.receivedChunksCount = 0;
    this.receivedBytes = 0;
    this.finalBlob = null;
    this.actualHash = null;
  }

  /**
   * Inserts an incoming decrypted chunk at chunkIndex
   * @param {number} chunkIndex 
   * @param {ArrayBuffer|Uint8Array} data 
   */
  addChunk(chunkIndex, data) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      throw new Error(`StreamReceiver: Chunk index ${chunkIndex} out of bounds (total: ${this.totalChunks})`);
    }

    if (!this.chunks[chunkIndex]) {
      this.chunks[chunkIndex] = data;
      this.receivedChunksCount++;
      this.receivedBytes += data.byteLength;
    }
  }

  /**
   * Gets current transfer progress
   * @returns {{ receivedBytes: number, totalBytes: number, percent: number, receivedChunks: number, totalChunks: number, isComplete: boolean }}
   */
  getProgress() {
    const percent = this.size > 0
      ? Math.min(100, Math.round((this.receivedBytes / this.size) * 100))
      : (this.receivedChunksCount === this.totalChunks ? 100 : 0);

    return {
      receivedBytes: this.receivedBytes,
      totalBytes: this.size,
      percent: percent,
      receivedChunks: this.receivedChunksCount,
      totalChunks: this.totalChunks,
      isComplete: this.receivedChunksCount === this.totalChunks
    };
  }

  /**
   * Assembles all accumulated chunks into a single Blob
   * @returns {Blob}
   */
  finalize() {
    if (this.finalBlob) {
      return this.finalBlob;
    }

    // Check for missing chunks
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.chunks[i]) {
        throw new Error(`StreamReceiver: File assembly failed, missing chunk #${i}`);
      }
    }

    this.finalBlob = new Blob(this.chunks, { type: this.type });
    return this.finalBlob;
  }

  /**
   * Computes SHA-256 integrity hash of received chunks and verifies against expected hash
   * @param {string} [expectedHash] 
   * @returns {Promise<{ valid: boolean, actualHash: string, expectedHash: string }>}
   */
  async verifyIntegrity(expectedHash = null) {
    const targetHash = expectedHash || this.expectedHash;

    // Compute actual hash
    this.actualHash = await hashFile(this.chunks);

    if (!targetHash) {
      // If sender did not supply a precomputed hash, accept computed hash
      return {
        valid: true,
        actualHash: this.actualHash,
        expectedHash: null
      };
    }

    const valid = this.actualHash.toLowerCase() === targetHash.toLowerCase();
    return {
      valid: valid,
      actualHash: this.actualHash,
      expectedHash: targetHash
    };
  }

  /**
   * Cleans up chunks memory
   */
  destroy() {
    this.chunks = [];
    this.finalBlob = null;
  }
}
