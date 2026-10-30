/**
 * FLUXDROPE - Automated Master Test Runner
 * Created By Shiv Yogi
 *
 * Executes the complete automated test suite across all 8 functional domains.
 */

import { server } from '../server.js';
import { runBrandingTests } from './unit/branding.test.js';
import { runCryptoTests } from './unit/crypto.test.js';
import { runChunkingTests } from './unit/chunking.test.js';
import { runLockoutTests } from './unit/lockout.test.js';
import { runLayoutsTests } from './unit/layouts.test.js';
import { runViewersTests } from './unit/viewers.test.js';
import { runTransferIntegrationTests } from './integration/transfer.test.js';

const TEST_PORT = 8799;

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('  FLUXDROPE - Automated Comprehensive Quality Assurance Suite');
  console.log('  Branding: Created By Shiv Yogi');
  console.log('=============================================================');

  // Start test server
  await new Promise((resolve) => {
    server.listen(TEST_PORT, resolve);
  });
  console.log(`\n[INFO] Test server active on http://localhost:${TEST_PORT}`);

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  const runTest = async (name, fn) => {
    const start = performance.now();
    try {
      await fn();
      const duration = (performance.now() - start).toFixed(1);
      results.push({ name, status: 'PASSED', duration: `${duration}ms` });
      passedCount++;
    } catch (err) {
      const duration = (performance.now() - start).toFixed(1);
      results.push({ name, status: 'FAILED', duration: `${duration}ms`, error: err.message });
      console.error(`\n❌ ERROR in "${name}":`, err);
      failedCount++;
    }
  };

  try {
    // 1. Branding & Filename Formatting
    await runTest('Filename Branding & Watermarking', runBrandingTests);

    // 2. Cryptographic Engine & E2EE
    await runTest('Cryptographic Engine & AES-GCM E2EE', runCryptoTests);

    // 3. Binary Chunking & Streaming
    await runTest('64KB Binary Chunking & Reassembly', runChunkingTests);

    // 4. 7-Attempt Lockout Policy & 10-Min Timer
    await runTest('Seven-Attempt Lockout Policy', () => runLockoutTests(TEST_PORT));

    // 5. 14 Liquid Glass Layouts
    await runTest('14 Liquid Glass Layouts Registry', runLayoutsTests);

    // 6. Media Viewers Category & Actions
    await runTest('Universal Media Viewers Routing', runViewersTests);

    // 7. Full Integration Transfer Flow
    await runTest('End-to-End WebSocket Transfer Flow', () => runTransferIntegrationTests(TEST_PORT));
  } finally {
    // Close test server
    server.close();
  }

  // Summary Table
  console.log('\n=============================================================');
  console.log('                    TEST EXECUTION SUMMARY                   ');
  console.log('=============================================================');
  console.table(results);
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n❌ One or more tests failed.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY! (100% Quality Verified)\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
