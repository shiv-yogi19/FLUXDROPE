/**
 * FLUXDROPE - Unit Tests: 14 Liquid Glass Layouts Registry
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import { LAYOUT_REGISTRY } from '../../public/js/layouts/layoutRegistry.js';

export async function runLayoutsTests() {
  console.log('\n--- Running 14 Liquid Glass Layouts Registry Tests ---');

  // Test 1: Total count must be 14
  assert.equal(LAYOUT_REGISTRY.length, 14, 'Layout registry must contain exactly 14 layouts');
  console.log('✓ Exactly 14 layouts registered');

  // Test 2: Exactly 7 Mobile and 7 Desktop
  const mobileLayouts = LAYOUT_REGISTRY.filter(l => l.category === 'mobile');
  const desktopLayouts = LAYOUT_REGISTRY.filter(l => l.category === 'desktop');

  assert.equal(mobileLayouts.length, 7, 'Must have exactly 7 mobile layouts');
  assert.equal(desktopLayouts.length, 7, 'Must have exactly 7 desktop layouts');
  console.log('✓ 7 Mobile layouts (M1-M7) and 7 Desktop layouts (D1-D7) confirmed');

  // Test 3: Verify all 7 Mobile IDs
  const expectedMobileIds = [
    'm1-aurora', 'm2-crystal', 'm3-obsidian', 'm4-waves',
    'm5-holographic', 'm6-floating', 'm7-minimal'
  ];
  for (const id of expectedMobileIds) {
    const found = mobileLayouts.find(l => l.id === id);
    assert.ok(found, `Mobile layout ${id} must exist in registry`);
  }
  console.log('✓ All 7 mobile layout IDs verified (M1 Aurora through M7 Hyper Minimal)');

  // Test 4: Verify all 7 Desktop IDs
  const expectedDesktopIds = [
    'd1-aurora', 'd2-crystal', 'd3-obsidian', 'd4-waves',
    'd5-holographic', 'd6-floating', 'd7-minimal'
  ];
  for (const id of expectedDesktopIds) {
    const found = desktopLayouts.find(l => l.id === id);
    assert.ok(found, `Desktop layout ${id} must exist in registry`);
  }
  console.log('✓ All 7 desktop layout IDs verified (D1 Aurora through D7 Hyper Minimal)');

  // Test 5: Verify required properties on each layout
  for (const layout of LAYOUT_REGISTRY) {
    assert.ok(layout.id, 'Layout must have id');
    assert.ok(layout.name, 'Layout must have name');
    assert.ok(layout.desc, 'Layout must have description');
    assert.ok(layout.previewSvg, 'Layout must have preview SVG');
    assert.ok(layout.previewSvg.includes('<svg'), 'Preview must be an SVG element');
    assert.ok(layout.cssClass, 'Layout must have cssClass');
    assert.ok(layout.accentColor, 'Layout must have accentColor');
  }
  console.log('✓ All 14 layouts contain required metadata, previews, and CSS classes');

  return true;
}
