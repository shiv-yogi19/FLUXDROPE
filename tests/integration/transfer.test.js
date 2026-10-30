/**
 * FLUXDROPE - Integration Tests: End-to-End Transfer Flow
 * Created By Shiv Yogi
 */

import assert from 'node:assert/strict';
import { computeSha256 } from '../../public/js/security/crypto.js';

export async function runTransferIntegrationTests(serverPort = 8787) {
  console.log('\n--- Running End-to-End Transfer Integration Tests ---');

  const baseUrl = `http://localhost:${serverPort}`;
  const wsUrl = `ws://localhost:${serverPort}`;

  // 1. Create a simulated binary file (70 KB)
  const fileBytes = new Uint8Array(70 * 1024);
  for (let i = 0; i < fileBytes.length; i++) {
    fileBytes[i] = (i * 13) % 256;
  }
  const fileSha = await computeSha256(fileBytes);

  const sessionId = 'integration-session-' + Date.now();
  const joiningCode = '554433';

  // 2. Sender registers session
  const createRes = await fetch(`${baseUrl}/api/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      joiningCode,
      passwordRequired: false,
      files: [{
        name: 'data-package.bin',
        size: fileBytes.length,
        type: 'application/octet-stream',
        sha256: fileSha
      }],
      totalSize: fileBytes.length,
      totalCount: 1
    })
  });

  assert.equal(createRes.status, 201, 'Session creation should return 201');
  console.log('✓ Session registered on signaling server');

  // 3. Receiver resolves joining code to session ID
  const resolveRes = await fetch(`${baseUrl}/api/session/by-code/${joiningCode}`);
  assert.equal(resolveRes.status, 200);
  const resolveData = await resolveRes.json();
  assert.equal(resolveData.sessionId, sessionId, 'Resolved session ID must match created session ID');
  console.log('✓ Receiver successfully resolved 6-digit joining code (554433)');

  // 4. Receiver queries session information
  const infoRes = await fetch(`${baseUrl}/api/session/${sessionId}/info`);
  assert.equal(infoRes.status, 200);
  const infoData = await infoRes.json();
  assert.equal(infoData.totalCount, 1);
  assert.equal(infoData.totalSize, fileBytes.length);
  console.log('✓ Public session info retrieved correctly');

  // 5. Connect WebSocket signaling for Sender and Receiver
  const senderWs = new WebSocket(`${wsUrl}/ws/signaling/${sessionId}?role=sender`);
  const receiverWs = new WebSocket(`${wsUrl}/ws/signaling/${sessionId}?role=receiver`);

  await Promise.all([
    new Promise(r => { senderWs.onopen = r; }),
    new Promise(r => { receiverWs.onopen = r; })
  ]);
  console.log('✓ Both Sender and Receiver WebSockets connected to signaling server');

  // 6. Test WebRTC Signaling Relay (Offer & Answer)
  let offerReceived = false;
  let answerReceived = false;

  const signalingExchangePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Signaling timeout')), 5000);

    receiverWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'webrtc:offer') {
        offerReceived = true;
        // Receiver replies with answer
        receiverWs.send(JSON.stringify({
          type: 'webrtc:answer',
          answer: { type: 'answer', sdp: 'dummy-sdp-answer' }
        }));
      }
    };

    senderWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'webrtc:answer') {
        answerReceived = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    // Sender sends offer
    senderWs.send(JSON.stringify({
      type: 'webrtc:offer',
      offer: { type: 'offer', sdp: 'dummy-sdp-offer' }
    }));
  });

  await signalingExchangePromise;
  assert.equal(offerReceived, true, 'Receiver must receive WebRTC offer');
  assert.equal(answerReceived, true, 'Sender must receive WebRTC answer');
  console.log('✓ WebRTC signaling offer/answer bidirectionally routed via WebSocket');

  // Clean up WebSockets
  senderWs.close();
  receiverWs.close();

  return true;
}
