/**
 * FLUXDROPE - Unit Tests: File Chunking, Streaming, & Reassembly
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import { FileChunkReader, FileChunkAssembler } from '../../public/js/transfer/chunker.js';
import { computeSha256 } from '../../public/js/security/crypto.js';

export async function runChunkingTests() {
  console.log('\n--- Running Chunking & Reassembly Tests ---');

  // Create a 150 KB dummy file spanning 3 chunks of 64KB
  const testBytes = new Uint8Array(150 * 1024);
  for (let i = 0; i < testBytes.length; i++) {
    testBytes[i] = (i * 7) % 256;
  }

  const originalBlob = new Blob([testBytes], { type: 'application/octet-stream' });
  const originalSha = await computeSha256(testBytes);

  // Test 1: Chunk Reader slicing
  const chunkSize = 64 * 1024;
  const reader = new FileChunkReader(originalBlob, { chunkSize });

  assert.equal(reader.totalChunks, 3, '150KB should result in exactly 3 chunks of 64KB');
  console.log('✓ Total chunk calculation correct: 3 chunks for 150KB');

  const assembler = new FileChunkAssembler({
    name: 'test-payload.bin',
    size: originalBlob.size,
    type: 'application/octet-stream',
    totalChunks: 3,
    sha256: originalSha
  });

  let chunksRead = 0;
  while (reader.hasNextChunk()) {
    const chunk = await reader.readNextChunk();
    assert.equal(chunk.chunkIndex, chunksRead);
    await assembler.appendChunk(chunk.chunkIndex, chunk.data);
    chunksRead++;
  }

  assert.equal(chunksRead, 3);
  assert.equal(assembler.completed, true);
  console.log('✓ Sequential 64KB chunk streaming and indexing verified');

  // Test 2: Reassembly and byte integrity check
  const reassembledBlob = assembler.finalize();
  assert.equal(reassembledBlob.size, originalBlob.size, 'Reassembled size must match original exactly');

  const reassembledBuffer = await reassembledBlob.arrayBuffer();
  const reassembledSha = await computeSha256(reassembledBuffer);

  assert.equal(reassembledSha, originalSha, 'Cryptographic checksum must match 100%');
  console.log('✓ Finalized Blob byte integrity verified (SHA-256 matches perfectly)');

  return true;
}
