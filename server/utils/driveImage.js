'use strict';

/**
 * Normalize a Google Drive share link into a direct-render image URL.
 *
 * Admins paste the ordinary "share" link they get from Drive, e.g.:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID
 * ...and we convert it to a URL that renders inline in an <img> tag.
 *
 * The Drive file must be shared as "Anyone with the link".
 *
 * Any non-Drive URL (Imgur, Cloudinary, a CDN, etc.) is returned unchanged.
 *
 * @param {string} url
 * @returns {string}
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const id = extractDriveId(trimmed);
  if (id) {
    // The thumbnail endpoint serves inline reliably and supports a size hint.
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }
  return trimmed;
}

/**
 * Extract the Drive file id from any common Drive URL form.
 * @param {string} url
 * @returns {string|null}
 */
function extractDriveId(url) {
  if (!/drive\.google\.com|docs\.google\.com/.test(url)) return null;

  // /file/d/FILE_ID/...
  let m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];

  // ?id=FILE_ID  or  &id=FILE_ID
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];

  return null;
}

module.exports = { normalizeImageUrl, extractDriveId };
