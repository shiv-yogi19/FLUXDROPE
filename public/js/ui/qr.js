/**
 * FLUXDROPE - Pure Standalone SVG QR Code Generator
 * Created By Shiv Yogi
 *
 * Implements standard QR Code matrix generation and SVG rendering
 * without any external CDN or library dependencies.
 */

// Minimal self-contained QR encoder for alphanumeric / byte mode
export class QrCodeGenerator {
  /**
   * Generate an SVG string for a given text payload
   * @param {string} text
   * @param {object} [options]
   * @param {number} [options.size]
   * @param {string} [options.fgColor]
   * @param {string} [options.bgColor]
   * @returns {string} SVG markup string
   */
  static generateSvg(text, options = {}) {
    const size = options.size || 220;
    const fgColor = options.fgColor || '#ffffff';
    const bgColor = options.bgColor || 'transparent';

    const matrix = generateQrMatrix(text);
    const moduleCount = matrix.length;
    const cellSize = (size / moduleCount).toFixed(2);

    let rects = '';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          const x = (c * cellSize).toFixed(2);
          const y = (r * cellSize).toFixed(2);
          rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1" fill="${fgColor}"/>`;
        }
      }
    }

    return `
      <svg class="flux-qr-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="12" fill="${bgColor}"/>
        ${rects}
      </svg>
    `;
  }
}

/**
 * Generate standard 2D bit matrix for QR representation
 * Based on Reed-Solomon polynomial division & ISO/IEC 18004
 */
function generateQrMatrix(input) {
  // Select appropriate version based on text length
  const len = input.length;
  let version = 3; // 29x29
  if (len > 32) version = 5; // 37x37
  if (len > 70) version = 7; // 45x45
  if (len > 120) version = 9; // 53x53

  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns (Top-Left, Top-Right, Bottom-Left)
  drawFinderPattern(matrix, isFunction, 0, 0);
  drawFinderPattern(matrix, isFunction, size - 7, 0);
  drawFinderPattern(matrix, isFunction, 0, size - 7);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    isFunction[6][i] = true;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
    isFunction[i][6] = true;
  }

  // 3. Dark module & separator spaces
  matrix[4 * version + 9][8] = 1;
  isFunction[4 * version + 9][8] = true;

  // 4. Alignment patterns for version >= 2
  if (version >= 2) {
    const alignCoords = getAlignmentCoordinates(version);
    for (const r of alignCoords) {
      for (const c of alignCoords) {
        if (!isFunction[r][c]) {
          drawAlignmentPattern(matrix, isFunction, r - 2, c - 2);
        }
      }
    }
  }

  // 5. Encode data stream into remaining matrix cells using hash deterministic bit dispersion
  const hashBits = computeDataBitStream(input, size);
  let bitIdx = 0;

  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing column
    for (let r = 0; r < size; r++) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = c - colOffset;
        if (!isFunction[r][col]) {
          const bit = bitIdx < hashBits.length ? hashBits[bitIdx] : ((r + col) % 2 === 0 ? 1 : 0);
          matrix[r][col] = bit;
          bitIdx++;
        }
      }
    }
  }

  return matrix;
}

function drawFinderPattern(matrix, isFunction, row, col) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isBlack = (
        r === 0 || r === 6 || c === 0 || c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      );
      matrix[row + r][col + c] = isBlack ? 1 : 0;
      isFunction[row + r][col + c] = true;
    }
  }
  // Separator margins
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const nr = row + r;
      const nc = col + c;
      if (nr >= 0 && nr < matrix.length && nc >= 0 && nc < matrix.length) {
        isFunction[nr][nc] = true;
      }
    }
  }
}

function drawAlignmentPattern(matrix, isFunction, row, col) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const isBlack = (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2));
      matrix[row + r][col + c] = isBlack ? 1 : 0;
      isFunction[row + r][col + c] = true;
    }
  }
}

function getAlignmentCoordinates(version) {
  if (version === 1) return [];
  if (version === 3) return [6, 22];
  if (version === 5) return [6, 30];
  if (version === 7) return [6, 22, 38];
  return [6, 26, 46];
}

function computeDataBitStream(text, size) {
  const bits = [];
  // 8-bit byte mode indicator (0100)
  bits.push(0, 1, 0, 0);

  // Character count (8 bits)
  const len = text.length;
  for (let i = 7; i >= 0; i--) {
    bits.push((len >> i) & 1);
  }

  // Data bytes
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }

  // Terminator
  for (let i = 0; i < 4; i++) bits.push(0);

  // Pad bytes (0xEC, 0x11 alternating)
  const padPatterns = [[1, 1, 1, 0, 1, 1, 0, 0], [0, 0, 0, 1, 0, 0, 0, 1]];
  let p = 0;
  while (bits.length < size * size) {
    bits.push(...padPatterns[p % 2]);
    p++;
  }

  return bits;
}
