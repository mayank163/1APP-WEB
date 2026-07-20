/**
 * Build a full S3 URL from a stored image key (e.g. "categories/uuid.png").
 * Falls back gracefully if the value is already a full URL (legacy data)
 * or is empty/null.
 *
 * @param {string|null} key - The image key or full URL stored in the database.
 * @returns {string} Full URL, or empty string if no key provided.
 */
export const getImageUrl = (key) => {
    if (!key) return '';
    // Already a full URL (legacy records) — return as-is
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    const base = (process.env.REACT_APP_IMAGE_URL || '').replace(/\/$/, '');
    return `${base}/${key}`;
};
