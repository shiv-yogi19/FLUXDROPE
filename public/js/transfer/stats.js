/**
 * FLUXDROPE - Real-time Transfer Statistics & Performance Tracker
 * Created By Shiv Yogi
 *
 * Calculates:
 * - Current smoothed speed (moving average)
 * - Average speed
 * - Peak speed
 * - Bytes sent / received
 * - Percentage
 * - Elapsed time & Estimated Remaining Time (ETA)
 * - Format utilities (B, KB, MB, GB, MB/s)
 */

export class TransferStatsTracker {
  constructor(totalBytes = 0) {
    this.totalBytes = totalBytes;
    this.bytesTransferred = 0;
    this.startTime = null;
    this.lastUpdateTime = null;
    this.lastBytes = 0;

    this.currentSpeed = 0; // Bytes/sec
    this.averageSpeed = 0; // Bytes/sec
    this.peakSpeed = 0;    // Bytes/sec

    // Moving window of speed samples for smoothing
    this.speedSamples = [];
    this.maxSamples = 5;

    this.isPaused = false;
    this.pausedAt = null;
    this.totalPausedDuration = 0;
  }

  start() {
    this.startTime = performance.now();
    this.lastUpdateTime = this.startTime;
    this.lastBytes = 0;
    this.bytesTransferred = 0;
    this.speedSamples = [];
    this.peakSpeed = 0;
  }

  updateProgress(bytes) {
    this.bytesTransferred = bytes;
    const now = performance.now();

    if (!this.startTime) {
      this.startTime = now;
      this.lastUpdateTime = now;
      this.lastBytes = bytes;
      return;
    }

    const elapsedTotalSec = Math.max(0.001, (now - this.startTime - this.totalPausedDuration) / 1000);
    this.averageSpeed = this.bytesTransferred / elapsedTotalSec;

    const deltaSec = (now - this.lastUpdateTime) / 1000;
    if (deltaSec >= 0.25) { // update instant speed sample every 250ms
      const deltaBytes = this.bytesTransferred - this.lastBytes;
      const instantSpeed = deltaBytes / deltaSec;

      this.speedSamples.push(instantSpeed);
      if (this.speedSamples.length > this.maxSamples) {
        this.speedSamples.shift();
      }

      // Smoothed speed = average of recent samples
      const sum = this.speedSamples.reduce((a, b) => a + b, 0);
      this.currentSpeed = sum / this.speedSamples.length;

      if (this.currentSpeed > this.peakSpeed) {
        this.peakSpeed = this.currentSpeed;
      }

      this.lastUpdateTime = now;
      this.lastBytes = this.bytesTransferred;
    }
  }

  pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.pausedAt = performance.now();
      this.currentSpeed = 0;
    }
  }

  resume() {
    if (this.isPaused && this.pausedAt) {
      this.totalPausedDuration += performance.now() - this.pausedAt;
      this.isPaused = false;
      this.pausedAt = null;
      this.lastUpdateTime = performance.now();
    }
  }

  getSnapshot() {
    const now = performance.now();
    const elapsedMs = this.startTime
      ? (now - this.startTime - this.totalPausedDuration)
      : 0;

    const progressRatio = this.totalBytes > 0
      ? Math.min(1, this.bytesTransferred / this.totalBytes)
      : 0;

    const percent = (progressRatio * 100).toFixed(1);
    const remainingBytes = Math.max(0, this.totalBytes - this.bytesTransferred);

    let etaSeconds = null;
    let etaFormatted = '--:--';

    if (this.isPaused) {
      etaFormatted = 'Paused';
    } else if (this.bytesTransferred >= this.totalBytes && this.totalBytes > 0) {
      etaFormatted = 'Complete';
    } else if (this.currentSpeed > 1024) {
      etaSeconds = Math.ceil(remainingBytes / this.currentSpeed);
      etaFormatted = formatDuration(etaSeconds);
    } else if (this.bytesTransferred > 0) {
      etaFormatted = 'Calculating...';
    }

    return {
      bytesTransferred: this.bytesTransferred,
      totalBytes: this.totalBytes,
      percent: parseFloat(percent),
      percentFormatted: `${percent}%`,
      currentSpeed: this.currentSpeed,
      currentSpeedFormatted: `${formatBytes(this.currentSpeed)}/s`,
      averageSpeed: this.averageSpeed,
      averageSpeedFormatted: `${formatBytes(this.averageSpeed)}/s`,
      peakSpeed: this.peakSpeed,
      peakSpeedFormatted: `${formatBytes(this.peakSpeed)}/s`,
      elapsedMs,
      elapsedFormatted: formatDuration(Math.floor(elapsedMs / 1000)),
      etaSeconds,
      etaFormatted,
      isPaused: this.isPaused
    };
  }
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB)
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
