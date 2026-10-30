/**
 * FLUXDROPE - Unit Tests: 7-Attempt Password Lockout Policy
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import { hashPasswordForVerification } from '../../public/js/security/crypto.js';

export async function runLockoutTests(serverPort = 8787) {
  console.log('\n--- Running 7-Attempt Password Lockout Policy Tests ---');

  const baseUrl = `http://localhost:${serverPort}`;
  const correctPass = 'SuperSecure2026';
  const { hashHex, saltHex } = await hashPasswordForVerification(correctPass);

  // 1. Create a password-protected session
  const sessionId = 'test-lockout-session-' + Date.now();
  const createRes = await fetch(`${baseUrl}/api/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      joiningCode: '998877',
      passwordRequired: true,
      passwordHash: hashHex,
      salt: saltHex,
      files: [{ name: 'classified.pdf', size: 1024, type: 'application/pdf' }]
    })
  });
  assert.equal(createRes.status, 201, 'Session should be created');

  // 2. Perform 6 failed attempts (should return 401 with decreasing remainingAttempts)
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${baseUrl}/api/session/${sessionId}/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: `wrong-pass-${attempt}` })
    });

    assert.equal(res.status, 401, `Attempt ${attempt} should return 401 Unauthorized`);
    const data = await res.json();
    assert.equal(data.locked, false);
    assert.equal(data.failedAttempts, attempt);
    assert.equal(data.remainingAttempts, 7 - attempt);
  }
  console.log('✓ Attempts 1 through 6 correctly rejected with decreasing attempt counter (6 down to 1)');

  // 3. Attempt 7 (7th consecutive failure triggers 10-minute lockout)
  const attempt7Res = await fetch(`${baseUrl}/api/session/${sessionId}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-pass-7' })
  });

  assert.equal(attempt7Res.status, 423, '7th failed attempt must trigger HTTP 423 Locked');
  const attempt7Data = await attempt7Res.json();
  assert.equal(attempt7Data.locked, true);
  assert.ok(attempt7Data.retryAfter >= 590 && attempt7Data.retryAfter <= 600, 'Lockout duration must be ~600 seconds (10 minutes)');
  console.log('✓ 7th unsuccessful attempt triggered 10-minute lockout (HTTP 423 Locked)');

  // 4. Attempt 8 during lockout (even with correct password, rejected due to active lockout)
  const attempt8Res = await fetch(`${baseUrl}/api/session/${sessionId}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: correctPass })
  });

  assert.equal(attempt8Res.status, 423, 'Attempts during lockout must be immediately rejected with 423 Locked');
  console.log('✓ Locked state strictly maintained during lockout period');

  // 5. Test another session with valid password on attempt 1 (should succeed immediately)
  const freshSessionId = 'test-valid-session-' + Date.now();
  await fetch(`${baseUrl}/api/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: freshSessionId,
      joiningCode: '112233',
      passwordRequired: true,
      passwordHash: hashHex,
      salt: saltHex,
      files: [{ name: 'safe.png', size: 2048, type: 'image/png' }]
    })
  });

  const validRes = await fetch(`${baseUrl}/api/session/${freshSessionId}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: correctPass })
  });

  assert.equal(validRes.status, 200, 'Correct password must authorize session');
  const validData = await validRes.json();
  assert.equal(validData.authorized, true);
  assert.equal(validData.files.length, 1);
  console.log('✓ Valid password successfully authorized session on fresh attempt');

  return true;
}
