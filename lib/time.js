// Single source of truth for clock times, durations and dates.
// Times are stored in the DB as 24h "HH:MM" text (attendance_logs.in_time / out_time).
// Durations are ALWAYS derived from those two values, never stored, so a row can't
// drift out of sync (the old code stored nothing and fell back to a fake "2.0 Hours").

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const parseTimeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?$/);
  if (!match) return null;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const mer = match[3] ? match[3].toUpperCase() : null;
  if (m > 59 || h > 23 || (mer && (h < 1 || h > 12))) return null;

  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

// Whole minutes between two clock times, or null if unknown / out is before in.
// Out-before-in is treated as invalid (a typo) instead of silently becoming ~24h.
export const durationMinutes = (inTime, outTime) => {
  const start = parseTimeToMinutes(inTime);
  const end = parseTimeToMinutes(outTime);
  if (start === null || end === null || end < start) return null;
  return end - start;
};

// 82 -> "1h 22m", 45 -> "45 min", 60 -> "1h", 0 -> "0 min"
export const formatMinutes = (mins) => {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Duration label for a log row / a pair of times.
export const calcHours = (inTime, outTime) => formatMinutes(durationMinutes(inTime, outTime));
export const logDuration = (log) => (log && log.out_time ? calcHours(log.in_time, log.out_time) : 'Ongoing');

// Total minutes across many logs (rows without a valid in/out pair contribute 0).
export const sumMinutes = (logs) =>
  (logs || []).reduce((acc, l) => acc + (durationMinutes(l.in_time, l.out_time) || 0), 0);

// 135 -> "2.25" (for CSV / totals where a number is handy)
export const minutesToDecimalHours = (mins) => (mins / 60).toFixed(2);

// "14:05" -> "2:05 PM"
export const formatClock = (t) => {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return t || '--';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

// Normalise anything parseable into the "HH:MM" an <input type="time"> needs.
export const formatToTimeInput = (t) => {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return '';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export const nowHHMM = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Local (device) calendar date as YYYY-MM-DD — toISOString() would give the UTC date.
export const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Day name for a YYYY-MM-DD string. Parsed as a LOCAL date: new Date('2026-09-29')
// is UTC midnight, which is the previous day for anyone behind UTC.
export const dayNameOf = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
};
