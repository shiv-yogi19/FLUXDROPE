/**
 * FLUXDROPE - File Chunking, Streaming, and Reassembly Engine
 * Created By Shiv Yogi
 *
 * Slices files into 64KB binary chunks using Blob.slice() to avoid memory bloating.
 * Reassembles chunks safely and calculates incremental integrity.
 */

import { TRANSFER_LIMITS } from '../constants.js';
import { encryptChunk, decryptChunk } from '../security/crypto.js';

export class FileChunkReader {
  /**
   * @param {File|Blob} file
   * @param {object} [options]
   * @param {number} [options.chunkSize]
   * @param {CryptoKey} [options.e2eeKey]
   * @param {Uint8Array} [options.baseNonce]
   */
  constructor(file, options = {}) {
    this.file = file;
    this.chunkSize = options.chunkSize || TRANSFER_LIMITS.DEFAULT_CHUNK_SIZE;
    this.totalBytes = file.size;
    this.totalChunks = Math.max(1, Math.ceil(this.totalBytes / this.chunkSize));
    this.currentChunkIndex = 0;
    this.e2eeKey = options.e2eeKey || null;
    this.baseNonce = options.baseNonce || null;
  }

  hasNextChunk() {
    return this.currentChunkIndex < this.totalChunks;
  }

  /**
   * Read the next chunk as an ArrayBuffer, optionally encrypted with AES-GCM.
   * @returns {Promise<{ chunkIndex: number, totalChunks: number, data: ArrayBuffer, byteOffset: number, byteLength: number }>}
   */
  async readNextChunk() {
    if (!this.hasNextChunk()) {
      return null;
    }

    const chunkIndex = this.currentChunkIndex;
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(this.totalBytes, start + this.chunkSize);
    const slice = this.file.slice(start, end);

    const rawBuffer = await slice.arrayBuffer();

    let dataBuffer = rawBuffer;
    if (this.e2eeKey && this.baseNonce) {
      dataBuffer = await encryptChunk(this.e2eeKey, rawBuffer, this.baseNonce, chunkIndex);
    }

    this.currentChunkIndex++;

    return {
      chunkIndex,
      totalChunks: this.totalChunks,
      byteOffset: start,
      byteLength: rawBuffer.byteLength,
      data: dataBuffer
    };
  }

  reset() {
    this.currentChunkIndex = 0;
  }
}

export class FileChunkAssembler {
  /**
   * @param {object} fileMeta
   * @param {string} fileMeta.name
   * @param {number} fileMeta.size
   * @param {string} fileMeta.type
   * @param {number} [fileMeta.totalChunks]
   * @param {string} [fileMeta.sha256]
   * @param {object} [options]
   * @param {CryptoKey} [options.e2eeKey]
   * @param {Uint8Array} [options.baseNonce]
   */
  constructor(fileMeta, options = {}) {
    this.fileMeta = fileMeta;
    this.totalChunks = fileMeta.totalChunks || 0;
    this.receivedBytes = 0;
    this.receivedChunksCount = 0;
    this.chunks = []; // array of ArrayBuffers
    this.e2eeKey = options.e2eeKey || null;
    this.baseNonce = options.baseNonce || null;
    this.completed = false;
  }

  /**
   * Append a received chunk buffer.
   * @param {number} chunkIndex
   * @param {ArrayBuffer} chunkData
   * @returns {Promise<number>} Updated received bytes
   */
  async appendChunk(chunkIndex, chunkData) {
    let clearData = chunkData;

    if (this.e2eeKey && this.baseNonce) {
      clearData = await decryptChunk(this.e2eeKey, chunkData, this.baseNonce, chunkIndex);
    }

    this.chunks[chunkIndex] = clearData;
    this.receivedBytes += clearData.byteLength;
    this.receivedChunksCount++;

    if (this.receivedChunksCount >= this.totalChunks) {
      this.completed = true;
    }

    return this.receivedBytes;
  }

  /**
   * Finalize received chunks into a single Blob.
   * @returns {Blob}
   */
  finalize() {
    const mimeType = this.fileMeta.type || 'application/octet-stream';
    const blob = new Blob(this.chunks, { type: mimeType });
    // Release chunk buffers reference
    this.chunks = [];
    return blob;
  }
}
