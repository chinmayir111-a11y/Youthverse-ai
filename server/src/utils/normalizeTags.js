/**
 * Clean a user-supplied list of short strings: trim, drop blanks, de-duplicate,
 * and cap the length.
 *
 * De-duplication is case-insensitive but preserves the first-seen casing, so
 * ["React", "react"] collapses to ["React"] rather than becoming two entries.
 *
 * Returns undefined for a non-array so callers can tell "not supplied" apart
 * from "supplied as empty".
 */
module.exports = function normalizeTags(value, max = 50) {
  if (!Array.isArray(value)) return undefined;

  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
};
