/**
 * A calendar day as "YYYY-MM-DD" in the server's own timezone.
 *
 * "Today" is a calendar question, not an instant: a Date would roll the day
 * over at UTC midnight, which is the middle of the evening for the campus this
 * is built for. Same trade-off, and the same caveat, as the mentorship
 * availability windows — fine for one campus, and the thing to revisit before
 * this crosses time zones.
 */
const dayKey = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** The day `n` days before `from`, as a key. */
const dayKeyBefore = (n, from = new Date()) => {
  const date = new Date(from);
  date.setDate(date.getDate() - n);
  return dayKey(date);
};

/** Day-of-week (0 = Sunday) for a "YYYY-MM-DD" key, read as a local date. */
const weekdayOf = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

/** True for a well-formed "YYYY-MM-DD" that names a real date. */
const isDayKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
};

module.exports = { dayKey, dayKeyBefore, weekdayOf, isDayKey };
