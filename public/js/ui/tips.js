/**
 * FLUXDROPE - Random Transfer Tips Engine
 * Created By Shiv Yogi
 *
 * Rotates helpful tips at non-intrusive intervals without repeating.
 */

export const TRANSFER_TIPS = [
  'Keep both devices connected and active until the transfer completes.',
  'Large files stream in 64KB chunks to protect device memory.',
  'QR codes allow instant camera scanning from mobile devices.',
  'Direct WebRTC DataChannel transfers flow peer-to-peer without server storage.',
  'Verify available disk space on the receiving device before initiating huge transfers.',
  'Avoid closing or sleeping your browser during an active transfer.',
  'Keep your 6-digit joining code private to prevent unauthorized access.',
  'Operating on the same local Wi-Fi network yields maximum gigabit transfer speeds.',
  'Progress and ETA calculations represent actual verified transferred bytes.',
  'Expired sessions automatically clean up connection credentials.',
  'End-to-End Encryption (E2EE) uses 256-bit AES-GCM derived via PBKDF2.',
  'Watermarked copies preserve your original file bytes intact.',
  'The 7-attempt lockout policy locks verification for 10 minutes against brute-force.',
  'Check that your media codec is supported in your browser for direct preview.',
  'Always verify SHA-256 integrity confirmation before removing source files.',
  'Use Performance Mode on low-battery or mobile devices to optimize CPU throughput.'
];

export class TipsManager {
  constructor(targetElement) {
    this.target = targetElement;
    this.currentIndex = -1;
    this.intervalId = null;
    this.seenIndices = new Set();
  }

  start(intervalMs = 12000) {
    this.showNext();
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.showNext(), intervalMs);
  }

  showNext() {
    if (!this.target) return;

    if (this.seenIndices.size >= TRANSFER_TIPS.length) {
      this.seenIndices.clear();
    }

    let nextIdx;
    do {
      nextIdx = Math.floor(Math.random() * TRANSFER_TIPS.length);
    } while (this.seenIndices.has(nextIdx) && this.seenIndices.size < TRANSFER_TIPS.length);

    this.seenIndices.add(nextIdx);
    this.currentIndex = nextIdx;

    // Smooth fade transition
    this.target.style.opacity = '0';
    setTimeout(() => {
      this.target.textContent = TRANSFER_TIPS[this.currentIndex];
      this.target.style.opacity = '1';
    }, 250);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
