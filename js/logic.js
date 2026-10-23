// ---------- App logic ----------
// Everything here works only with data: no page, no localStorage, no "now".
// The state and today's date are passed in, so tests can use any data and any day.
import { addDays, mondayOf } from "./dates.js";

// ---------- 1. Default data ----------
// The starting exercise library. Each exercise has an id (internal name, never changes),
// a display name and a "dose" — how much to do. You can edit all of this in Settings.
export const DEFAULT_EXERCISES = [
  { id: "walk",    name: "Walk",         dose: "30 min" },
  { id: "squats",  name: "Squats",       dose: "×10" },
  { id: "pushups", name: "Push-ups",     dose: "×10" },
  { id: "plank",   name: "Plank",        dose: "1 min" },
  { id: "qigong",  name: "Qigong",       dose: "30 min" },
  { id: "face",    name: "Face yoga",    dose: "30 min" },
  { id: "stretch", name: "Stretching",   dose: "5 min" },
];
export const DEFAULT_GOAL = 3; // daily goal: how many exercises to do

// ---------- 2. The saved data ----------
// The whole app is one object:
// {
//   exercises: [{ id, name, dose, removed? }],  — the library; removed ones stay for history
//   goals: [{ from: "2026-10-16", goal: 3 }],   — goal history: each day is judged by the goal of that day
//   startedOn: "2026-10-16",                    — first day of using the app
//   days: { "2026-10-16": ["walk", "plank"] }   — what was checked on which day
// }
// Days are stored by exercise id, so renaming an exercise keeps its history.

// Turns whatever was saved (or loaded from a backup file) into a complete, valid state.
// Older saves had a single "goal" and no exercise list — they are upgraded here.
export function normalize(saved, today) {
  const s = isPlainObject(saved) ? saved : {};

  // Only real days ("2026-10-16") with a list of exercise ids are kept.
  const days = {};
  if (isPlainObject(s.days)) {
    for (const [key, ids] of Object.entries(s.days)) {
      if (isDayKey(key) && Array.isArray(ids)) days[key] = ids.filter(id => typeof id === "string");
    }
  }
  const startedOn = isDayKey(s.startedOn) ? s.startedOn : (Object.keys(days).sort()[0] || today);

  let exercises = Array.isArray(s.exercises)
    ? s.exercises.filter(ex => ex && ex.id && typeof ex.name === "string")
        .map(ex => ({ id: String(ex.id), name: ex.name, dose: String(ex.dose || ""), ...(ex.removed ? { removed: true } : {}) }))
    : [];
  if (!exercises.length) exercises = DEFAULT_EXERCISES.map(ex => ({ ...ex }));

  // Goals are whole numbers from 1, sorted by date: goalFor relies on that order.
  let goals = Array.isArray(s.goals)
    ? s.goals.filter(g => g && isDayKey(g.from) && Math.floor(Number(g.goal)) >= 1)
        .map(g => ({ from: g.from, goal: Math.floor(Number(g.goal)) }))
        .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    : [];
  if (!goals.length) {
    const old = Math.floor(Number(s.goal)); // older saves had a single goal
    goals = [{ from: startedOn, goal: old >= 1 ? old : DEFAULT_GOAL }];
  }

  return { exercises, goals, startedOn, days };
}

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isDayKey(x) {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

// Reads a backup file's text. Returns a valid state, or throws if it isn't a backup.
export function parseBackup(text, today) {
  const data = JSON.parse(text);
  if (!isPlainObject(data) || !isPlainObject(data.days)) throw new Error("not a backup");
  return normalize(data, today);
}

// ---------- 3. Day results ----------
// The goal that was in force on a given day: the last change made on or before it.
export function goalFor(state, key) {
  let goal = state.goals[0].goal;
  for (const g of state.goals) if (g.from <= key) goal = g.goal;
  return goal;
}

// Exercises shown on Today and in Settings (removed ones are hidden but keep their history)
export function activeExercises(state) {
  return state.exercises.filter(ex => !ex.removed);
}

// How many exercises from the library (including removed ones) were checked on a given day.
export function doneCount(state, key) {
  const ids = new Set(state.days[key] || []);
  return state.exercises.filter(ex => ids.has(ex.id)).length;
}

// The color of a day in the calendar:
//   "future"  — hasn't happened yet
//   "before"  — before you started using the app (grey, never red)
//   "good"    — goal reached (green)
//   "partial" — some done (yellow)
//   "missed"  — a past day with nothing done (red)
//   "pending" — today with nothing done yet (no color: the day isn't over)
export function dayStatus(state, key, today) {
  if (key > today) return "future";
  if (key < state.startedOn) return "before";
  const n = doneCount(state, key);
  if (n >= goalFor(state, key)) return "good";
  if (n > 0) return "partial";
  return key === today ? "pending" : "missed";
}

// ---------- 4. Stats ----------
// Counts green / yellow / red days from one day to another (both included).
// Days before the start date and today-with-nothing-yet ("pending") are not counted:
// the first didn't exist for you, the second isn't over.
export function countDays(state, fromKey, toKey, today) {
  const result = { good: 0, partial: 0, missed: 0 };
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) {
    const s = dayStatus(state, k, today);
    if (s in result) result[s]++;
  }
  return result;
}

// First day of a stats period ("week" | "month" | "all"), never before the start date
export function periodStart(state, period, today) {
  let from = state.startedOn;
  if (period === "week") from = mondayOf(today);
  if (period === "month") from = today.slice(0, 8) + "01"; // "2026-10-19" → "2026-10-01"
  return from < state.startedOn ? state.startedOn : from;
}

// Times each current exercise was done in a period, most frequent first
export function exerciseCounts(state, fromKey, toKey) {
  return activeExercises(state).map(ex => {
    let n = 0;
    for (let k = fromKey; k <= toKey; k = addDays(k, 1)) if ((state.days[k] || []).includes(ex.id)) n++;
    return { ex, n };
  }).sort((a, b) => b.n - a.n);
}

// ---------- 5. Streak ----------
// A streak is a run of green days in a row. A yellow or red day breaks it.
// Today doesn't break it while it's still going: until the goal is reached,
// the streak counts up to yesterday.

// Current streak: counts green days backwards, from today (if green) or from yesterday.
export function currentStreak(state, today) {
  let k = dayStatus(state, today, today) === "good" ? today : addDays(today, -1);
  let n = 0;
  while (k >= state.startedOn && dayStatus(state, k, today) === "good") { n++; k = addDays(k, -1); }
  return n;
}

// Best streak ever: the longest run of green days, with its first and last day.
export function bestStreak(state, today) {
  let best = { n: 0, from: null, to: null };
  let n = 0, from = null;
  for (let k = state.startedOn; k <= today; k = addDays(k, 1)) {
    if (dayStatus(state, k, today) === "good") {
      if (n === 0) from = k;
      n++;
      if (n > best.n) best = { n, from, to: k };
    } else n = 0;
  }
  return best;
}

// ---------- 6. Changes ----------
// These change the state in place; the page saves and redraws after them.

// Checks an exercise on a day, or unchecks it if it was already checked.
export function toggleDone(state, key, id) {
  const done = new Set(state.days[key] || []);
  done.has(id) ? done.delete(id) : done.add(id);
  state.days[key] = [...done];
}

// Changes the goal starting today. Past days keep the goal they had.
export function setGoal(state, today, n) {
  const last = state.goals[state.goals.length - 1];
  if (last.from === today) last.goal = n;          // changed again today: just update today's entry
  else state.goals.push({ from: today, goal: n }); // otherwise: a new entry from today on
}

// Moves an exercise up (-1) or down (+1) among the active ones
export function moveExercise(state, id, dir) {
  const active = activeExercises(state);
  const i = active.findIndex(ex => ex.id === id);
  const j = i + dir;
  if (j < 0 || j >= active.length) return;
  // swap the two exercises inside the full list (which also contains removed ones)
  const a = state.exercises.indexOf(active[i]);
  const b = state.exercises.indexOf(active[j]);
  [state.exercises[a], state.exercises[b]] = [state.exercises[b], state.exercises[a]];
}

// Hides an exercise from Today and Settings; its history stays in Calendar and Stats.
export function removeExercise(state, id, today) {
  state.exercises.find(e => e.id === id).removed = true;
  // the goal can't be bigger than the number of exercises left
  const left = activeExercises(state).length;
  if (goalFor(state, today) > left) setGoal(state, today, left);
}

export function restoreExercise(state, id) {
  delete state.exercises.find(e => e.id === id).removed;
}

export function addExercise(state, name, dose) {
  const id = "ex" + Date.now().toString(36); // a new unique id, e.g. "exmgf3k2a1"
  state.exercises.push({ id, name, dose });
}
