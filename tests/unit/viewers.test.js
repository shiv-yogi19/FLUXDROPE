/**
 * FLUXDROPE - Unit Tests: Media Category Detection & Viewers Routing
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import { detectFileCategory, getRecommendedAction } from '../../public/js/viewers/index.js';

export async function runViewersTests() {
  console.log('\n--- Running Media Viewers Routing Tests ---');

  // Test 1: Category detection
  assert.equal(detectFileCategory('movie.mp4', 'video/mp4'), 'video');
  assert.equal(detectFileCategory('song.mp3', 'audio/mpeg'), 'audio');
  assert.equal(detectFileCategory('photo.jpg', 'image/jpeg'), 'image');
  assert.equal(detectFileCategory('document.pdf', 'application/pdf'), 'pdf');
  assert.equal(detectFileCategory('sheet.csv', 'text/csv'), 'document');
  assert.equal(detectFileCategory('config.json', 'application/json'), 'document');
  assert.equal(detectFileCategory('readme.md', 'text/markdown'), 'document');
  assert.equal(detectFileCategory('package.zip', 'application/zip'), 'archive');
  assert.equal(detectFileCategory('binary.exe', 'application/octet-stream'), 'binary');
  console.log('✓ All 9 media file categories correctly classified');

  // Test 2: Recommended actions
  const actVideo = getRecommendedAction('clip.mp4');
  assert.equal(actVideo.label, 'Play Video');
  assert.equal(actVideo.action, 'preview');

  const actAudio = getRecommendedAction('tune.mp3');
  assert.equal(actAudio.label, 'Play Audio');
  assert.equal(actAudio.action, 'preview');

  const actImage = getRecommendedAction('art.png');
  assert.equal(actImage.label, 'View Image');
  assert.equal(actImage.action, 'preview');

  const actPdf = getRecommendedAction('contract.pdf');
  assert.equal(actPdf.label, 'Open PDF');
  assert.equal(actPdf.action, 'preview');

  const actDoc = getRecommendedAction('data.csv');
  assert.equal(actDoc.label, 'View Document');
  assert.equal(actDoc.action, 'preview');

  const actZip = getRecommendedAction('files.zip');
  assert.equal(actZip.label, 'Download Archive');
  assert.equal(actZip.action, 'download');

  console.log('✓ Recommended contextual action buttons mapped correctly');

  return true;
}
