/**
 * FLUXDROPE - Watermark Derivation Module
 * Created By Shiv Yogi
 *
 * Implements non-destructive watermark derivation for supported media.
 * Does not overwrite or alter original files - generates derived watermarked copies.
 */

import { formatBrandedFilename } from './filename.js';

/**
 * Determine if a file type supports visual watermark derivation in the browser.
 * @param {string} mimeType
 * @returns {boolean}
 */
export function canWatermark(mimeType) {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('image/png') ||
    mimeType.startsWith('image/jpeg') ||
    mimeType.startsWith('image/webp')
  );
}

/**
 * Render an elegant Liquid Glass watermark badge onto an image canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawLiquidGlassBadge(ctx, width, height) {
  const scale = Math.max(0.7, Math.min(width, height) / 1000);
  const badgeWidth = 320 * scale;
  const badgeHeight = 52 * scale;
  const padding = 24 * scale;
  const radius = 12 * scale;

  const x = width - badgeWidth - padding;
  const y = height - badgeHeight - padding;

  ctx.save();

  // Glass backdrop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6 * scale;

  // Glass container fill
  ctx.beginPath();
  ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
  ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
  ctx.fill();

  // Frosted border highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Reset shadow for text and icons
  ctx.shadowColor = 'transparent';

  // Gradient highlight on top edge
  const grad = ctx.createLinearGradient(x, y, x + badgeWidth, y);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
  grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.6)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.6)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + badgeWidth - radius, y);
  ctx.stroke();

  // Draw logo icon (stylized geometric flux diamond)
  const iconX = x + 18 * scale;
  const iconY = y + badgeHeight / 2;
  const iconSize = 12 * scale;

  ctx.beginPath();
  ctx.moveTo(iconX, iconY - iconSize);
  ctx.lineTo(iconX + iconSize * 0.9, iconY);
  ctx.lineTo(iconX, iconY + iconSize);
  ctx.lineTo(iconX - iconSize * 0.9, iconY);
  ctx.closePath();
  ctx.fillStyle = '#38bdf8';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(iconX, iconY, 4 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Draw Brand Text: FLUXDROPE
  ctx.font = `bold ${Math.round(15 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText('FLUXDROPE', iconX + 18 * scale, y + badgeHeight * 0.36);

  // Draw Creator Text: Created By Shiv Yogi
  ctx.font = `500 ${Math.round(11 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Created By Shiv Yogi', iconX + 18 * scale, y + badgeHeight * 0.70);

  ctx.restore();
}

/**
 * Generate a derived watermarked image blob.
 * @param {Blob|File} imageBlob
 * @param {string} originalFilename
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function createWatermarkedImage(imageBlob, originalFilename) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context unavailable'));
        }

        // Draw original image unaltered
        ctx.drawImage(img, 0, 0);

        // Stamp Liquid Glass badge
        drawLiquidGlassBadge(ctx, canvas.width, canvas.height);

        // Export as same mime type (or image/png fallback)
        const mimeType = imageBlob.type || 'image/png';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Failed to encode watermarked canvas'));
            }
            const brandedName = formatBrandedFilename(originalFilename);
            resolve({ blob, filename: brandedName });
          },
          mimeType,
          0.94
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for watermarking'));
    };

    img.src = url;
  });
}
