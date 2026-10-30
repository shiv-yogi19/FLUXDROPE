/**
 * FLUXDROPE - Filename Branding and Sanitization Module
 * Created By Shiv Yogi
 *
 * Policy:
 * Every downloaded file must follow this exact convention:
 * OriginalFileName_FLUXDROPE_Created_By_Shiv_Yogi.Extension
 *
 * Rules:
 * - Preserve original extension
 * - Sanitize invalid filesystem characters
 * - Prevent accidental duplicate branding
 * - Support Unicode filenames
 * - Handle duplicate indices cleanly
 */

const BRANDING_SUFFIX = '_FLUXDROPE_Created_By_Shiv_Yogi';

// Known compound extensions
const COMPOUND_EXTENSIONS = new Set([
  '.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst',
  '.user.js', '.spec.js', '.test.js', '.d.ts'
]);

/**
 * Split a filename into base name and extension, respecting compound extensions.
 * @param {string} filename
 * @returns {{ base: string, ext: string }}
 */
export function splitFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return { base: 'file', ext: '' };
  }

  const trimmed = filename.trim();
  const lower = trimmed.toLowerCase();

  // Check compound extensions first
  for (const compound of COMPOUND_EXTENSIONS) {
    if (lower.endsWith(compound) && trimmed.length > compound.length) {
      return {
        base: trimmed.slice(0, trimmed.length - compound.length),
        ext: trimmed.slice(trimmed.length - compound.length)
      };
    }
  }

  const lastDotIndex = trimmed.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < trimmed.length - 1) {
    return {
      base: trimmed.slice(0, lastDotIndex),
      ext: trimmed.slice(lastDotIndex)
    };
  }

  return { base: trimmed, ext: '' };
}

/**
 * Sanitize invalid filename characters across Linux, Windows, macOS, Android.
 * Invalid characters: / \ : * ? " < > | \0 and ASCII 0-31
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilenamePart(name) {
  if (!name) return 'unnamed';
  // Remove control characters and reserved characters
  return name
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a filename according to the mandatory FLUXDROPE branding policy.
 * Example:
 * 'Photo.jpg' -> 'Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg'
 * 'Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg' -> 'Photo_FLUXDROPE_Created_By_Shiv_Yogi.jpg' (no duplicate!)
 *
 * @param {string} originalFilename
 * @param {number} [duplicateIndex] Optional duplicate number for conflict resolution
 * @returns {string}
 */
export function formatBrandedFilename(originalFilename, duplicateIndex = 0) {
  const { base, ext } = splitFilename(originalFilename || 'download');
  const sanitizedBase = sanitizeFilenamePart(base);

  // Check if base already ends with the branding suffix
  let cleanBase = sanitizedBase;
  if (cleanBase.endsWith(BRANDING_SUFFIX)) {
    // Already branded, keep base without the suffix for proper index insertion
    cleanBase = cleanBase.slice(0, cleanBase.length - BRANDING_SUFFIX.length);
  }

  // Handle duplicate index resolution: "Report (1)" or "Report"
  const indexSuffix = duplicateIndex > 0 ? ` (${duplicateIndex})` : '';

  return `${cleanBase}${indexSuffix}${BRANDING_SUFFIX}${ext}`;
}

/**
 * Check if a filename is already branded.
 * @param {string} filename
 * @returns {boolean}
 */
export function isBrandedFilename(filename) {
  if (!filename) return false;
  const { base } = splitFilename(filename);
  return base.endsWith(BRANDING_SUFFIX);
}

/**
 * Extract original base name by stripping the branding suffix if present.
 * @param {string} filename
 * @returns {string}
 */
export function unbrandFilename(filename) {
  const { base, ext } = splitFilename(filename);
  if (base.endsWith(BRANDING_SUFFIX)) {
    return `${base.slice(0, base.length - BRANDING_SUFFIX.length)}${ext}`;
  }
  return filename;
}
