/**
 * FLUXDROPE - Unit Tests: Filename Branding & Watermarking
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import {
  formatBrandedFilename,
  splitFilename,
  sanitizeFilenamePart,
  isBrandedFilename,
  unbrandFilename
} from '../../public/js/branding/filename.js';

export async function runBrandingTests() {
  console.log('\n--- Running Filename Branding Tests ---');

  // Test 1: Basic file naming format
  const t1 = formatBrandedFilename('Photo.jpg');
  assert.equal(t1, 'Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg', 'Should format standard Photo.jpg correctly');
  console.log('✓ Photo.jpg -> Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg');

  // Test 2: Extension preservation with compound extensions
  const t2 = formatBrandedFilename('backup.tar.gz');
  assert.equal(t2, 'backup_FLUXDROPE_Created_By_Shiv_Yogi.tar.gz', 'Should preserve .tar.gz compound extension');
  console.log('✓ backup.tar.gz -> backup_FLUXDROPE_Created_By_Shiv_Yogi.tar.gz');

  // Test 3: Duplicate branding prevention
  const t3 = formatBrandedFilename('Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg');
  assert.equal(t3, 'Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg', 'Should NOT duplicate branding if already present');
  console.log('✓ Duplicate branding prevention verified (no double suffix)');

  // Test 4: Sanitization of illegal characters across platforms
  const t4 = formatBrandedFilename('invalid/name:*?"<>|.pdf');
  assert.equal(t4, 'invalid_name________FLUXDROPE_Created_By_Shiv_Yogi.pdf', 'Should sanitize illegal characters');
  console.log('✓ Illegal characters (/ \\ : * ? " < > |) sanitized safely');

  // Test 5: Unicode filenames preservation
  const t5 = formatBrandedFilename('日本語ドキュメント.txt');
  assert.equal(t5, '日本語ドキュメント_FLUXDROPE_Created_By_Shiv_Yogi.txt', 'Should support international Unicode characters');
  console.log('✓ Unicode filenames supported (日本語ドキュメント.txt)');

  // Test 6: Duplicate index conflict resolution
  const t6 = formatBrandedFilename('Document.pdf', 2);
  assert.equal(t6, 'Document (2)_FLUXDROPE_Created_By_Shiv_Yogi.pdf', 'Should insert duplicate index before branding suffix');
  console.log('✓ Duplicate resolution index verified: Document (2)_FLUXDROPE_Created_By_Shiv_Yogi.pdf');

  // Test 7: isBrandedFilename helper
  assert.equal(isBrandedFilename('Report_FLUXDROPE_Created_By_Shiv_Yogi.pdf'), true);
  assert.equal(isBrandedFilename('Report.pdf'), false);
  console.log('✓ isBrandedFilename detection accurate');

  // Test 8: unbrandFilename helper
  assert.equal(unbrandFilename('Report_FLUXDROPE_Created_By_Shiv_Yogi.pdf'), 'Report.pdf');
  console.log('✓ unbrandFilename restored original name');

  return true;
}
