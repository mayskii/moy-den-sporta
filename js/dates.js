// ---------- Dates ----------
// A day's key is the date as YYYY-MM-DD in the phone's local time.
// Keys in this format sort and compare correctly as plain text: "2026-10-09" < "2026-10-16".
export function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Today's key
export function todayKey() {
  return dayKey(new Date());
}

// Turns "2026-10-16" back into a Date (noon, so time zones can't shift the day).
export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

// Adds n days to a day key: addDays("2026-10-31", 1) → "2026-11-01"
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// Monday of the week that contains the given day
export function mondayOf(key) {
  const d = keyToDate(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}
