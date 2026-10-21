// ---------- 1. Default data ----------
// The starting exercise library. Each exercise has an id (internal name, never changes),
// a display name and a "dose" — how much to do. You can edit all of this in Settings.
const DEFAULT_EXERCISES = [
  { id: "walk",    name: "Walk",         dose: "30 min" },
  { id: "squats",  name: "Squats",       dose: "×10" },
  { id: "pushups", name: "Push-ups",     dose: "×10" },
  { id: "plank",   name: "Plank",        dose: "1 min" },
  { id: "qigong",  name: "Qigong",       dose: "30 min" },
  { id: "face",    name: "Face yoga",    dose: "30 min" },
  { id: "stretch", name: "Stretching",   dose: "5 min" },
];
const DEFAULT_GOAL = 3; // daily goal: how many exercises to do

// ---------- 2. Storage ----------
// The whole app is stored as one object in the browser's memory (localStorage):
// {
//   exercises: [{ id, name, dose, removed? }],  — the library; removed ones stay for history
//   goals: [{ from: "2026-10-16", goal: 3 }],   — goal history: each day is judged by the goal of that day
//   startedOn: "2026-10-16",                    — first day of using the app
//   days: { "2026-10-16": ["walk", "plank"] }   — what was checked on which day
// }
// Days are stored by exercise id, so renaming an exercise keeps its history.
const STORAGE_KEY = "moy-den-sporta";
let storageWorks = true;

// Turns whatever was saved (or loaded from a backup file) into a complete, valid state.
// Older saves had a single "goal" and no exercise list — they are upgraded here.
function normalize(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const days = s.days && typeof s.days === "object" ? s.days : {};
  const startedOn = typeof s.startedOn === "string" ? s.startedOn
    : (Object.keys(days).sort()[0] || dayKey(new Date()));

  const exercises = Array.isArray(s.exercises) && s.exercises.length
    ? s.exercises.filter(ex => ex && ex.id && typeof ex.name === "string")
        .map(ex => ({ id: String(ex.id), name: ex.name, dose: String(ex.dose || ""), ...(ex.removed ? { removed: true } : {}) }))
    : DEFAULT_EXERCISES.map(ex => ({ ...ex }));

  const goals = Array.isArray(s.goals) && s.goals.length
    ? s.goals.filter(g => g && typeof g.from === "string" && g.goal >= 1)
    : [{ from: startedOn, goal: s.goal || DEFAULT_GOAL }];

  return { exercises, goals, startedOn, days };
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (e) { storageWorks = false; return normalize(null); }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageWorks = true; }
  catch (e) { storageWorks = false; }
}

// ---------- 3. Dates ----------
// A day's key is the date as YYYY-MM-DD in the phone's local time.
// Keys in this format sort and compare correctly as plain text: "2026-10-09" < "2026-10-16".
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Turns "2026-10-16" back into a Date (noon, so time zones can't shift the day).
function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

// Adds n days to a day key: addDays("2026-10-31", 1) → "2026-11-01"
function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// Monday of the week that contains the given day
function mondayOf(key) {
  const d = keyToDate(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}

let state = load();
save(); // stores the upgraded format on the very first visit

// ---------- 4. Day results ----------
// The goal that was in force on a given day: the last change made on or before it.
function goalFor(key) {
  let goal = state.goals[0].goal;
  for (const g of state.goals) if (g.from <= key) goal = g.goal;
  return goal;
}

// Exercises shown on Today and in Settings (removed ones are hidden but keep their history)
function activeExercises() {
  return state.exercises.filter(ex => !ex.removed);
}

// How many exercises from the library (including removed ones) were checked on a given day.
function doneCount(key) {
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
function dayStatus(key) {
  const today = dayKey(new Date());
  if (key > today) return "future";
  if (key < state.startedOn) return "before";
  const n = doneCount(key);
  if (n >= goalFor(key)) return "good";
  if (n > 0) return "partial";
  return key === today ? "pending" : "missed";
}

// ---------- 5. Checking an exercise ----------
// Tapping a card adds the exercise to today's done list,
// or removes it if it was already checked. Only today can be changed.
// justToggled remembers which card was tapped, so only its checkmark animates.
let justToggled = null;
function toggle(id) {
  const key = dayKey(new Date());
  const done = new Set(state.days[key] || []);
  done.has(id) ? done.delete(id) : done.add(id);
  state.days[key] = [...done];
  save();
  justToggled = id;
  renderToday();
  justToggled = null;
}

// ---------- 6. Today tab ----------
const CHECK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

function renderToday() {
  const now = new Date();
  const key = dayKey(now);
  const done = new Set(state.days[key] || []);
  const count = doneCount(key);
  const goal = goalFor(key);

  // Date
  document.getElementById("weekday").textContent = now.toLocaleDateString("en-US", { weekday: "long" });
  document.getElementById("date").textContent = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Progress: the ring fills by the share of the goal done (100 = full circle), "2/3" inside it
  const shown = Math.min(count, goal);
  document.getElementById("ring-fill").style.strokeDashoffset = 100 - (shown / goal) * 100;
  document.getElementById("ring-count").textContent = shown;
  document.getElementById("ring-goal").textContent = `/${goal}`;

  const status = document.getElementById("status");
  if (count >= goal) status.textContent = "Goal reached";
  else if (count > 0) status.textContent = `${goal - count} more to go`;
  else status.textContent = "Let's get moving";
  document.getElementById("count").textContent = `${count} of ${goal} exercises done`;

  // Exercise list
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const ex of activeExercises()) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ex-" + ex.id;
    btn.className = "item" + (ex.id === justToggled ? " pop" : "");
    btn.setAttribute("aria-pressed", done.has(ex.id));
    btn.innerHTML = `<span class="check">${CHECK_ICON}</span><span class="name"></span><span class="dose"></span>`;
    btn.querySelector(".name").textContent = ex.name;
    btn.querySelector(".dose").textContent = ex.dose;
    btn.addEventListener("click", () => toggle(ex.id));
    li.appendChild(btn);
    list.appendChild(li);
  }

  // Warning if the browser won't let us save
  document.getElementById("note").textContent = storageWorks
    ? "Your checkmarks are saved on this device."
    : "This browser won't save data: checkmarks will be lost when you close the page.";
}

// ---------- 7. Calendar tab ----------
// Which month is shown, and which day is selected (its details appear under the calendar).
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0 = January
let selectedKey = null;

const STATUS_TEXT = {
  good: "Goal reached",
  partial: "Some done",
  missed: "Missed",
  pending: "Nothing yet today",
};

function renderCalendar() {
  const first = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate(); // day 0 of next month = last day of this one
  const offset = (first.getDay() + 6) % 7; // getDay(): 0 = Sunday; we start weeks on Monday
  const todayKey = dayKey(new Date());

  document.getElementById("cal-title").textContent =
    first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  // Empty cells before the 1st, so the 1st lands under the right weekday
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement("span"));

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dayKey(new Date(calYear, calMonth, d));
    const status = dayStatus(key);
    // Days you can open: from the start date up to today
    const canOpen = status !== "future" && status !== "before";
    const cell = document.createElement(canOpen ? "button" : "span");
    cell.className = `day ${status}` + (key === todayKey ? " today" : "") + (key === selectedKey ? " selected" : "");
    cell.textContent = d;
    if (canOpen) {
      cell.type = "button";
      cell.setAttribute("aria-label", `${keyToDate(key).toLocaleDateString("en-US", { month: "long", day: "numeric" })}: ${STATUS_TEXT[status]}`);
      cell.addEventListener("click", () => { selectedKey = key; renderCalendar(); });
    }
    grid.appendChild(cell);
  }

  // Can't go before the month you started or after the current month
  const start = keyToDate(state.startedOn);
  const now = new Date();
  document.getElementById("cal-prev").disabled =
    calYear < start.getFullYear() || (calYear === start.getFullYear() && calMonth <= start.getMonth());
  document.getElementById("cal-next").disabled =
    calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth >= now.getMonth());

  renderDayDetail();
}

// The card under the calendar: what was done on the selected day (read-only)
function renderDayDetail() {
  const box = document.getElementById("day-detail");
  box.innerHTML = "";
  if (!selectedKey) return;

  const ids = new Set(state.days[selectedKey] || []);
  const done = state.exercises.filter(ex => ids.has(ex.id));

  const h = document.createElement("h2");
  h.textContent = keyToDate(selectedKey).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const p = document.createElement("p");
  p.textContent = `${STATUS_TEXT[dayStatus(selectedKey)]} · ${done.length} of ${goalFor(selectedKey)}`;
  box.append(h, p);

  if (done.length) {
    const ul = document.createElement("ul");
    for (const ex of done) {
      const li = document.createElement("li");
      li.textContent = ex.dose ? `${ex.name} · ${ex.dose}` : ex.name;
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }
}

function shiftMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  selectedKey = null;
  renderCalendar();
}
document.getElementById("cal-prev").addEventListener("click", () => shiftMonth(-1));
document.getElementById("cal-next").addEventListener("click", () => shiftMonth(1));

// ---------- 8. Stats tab ----------
let statsPeriod = "week"; // "week" | "month" | "all"

// Counts green / yellow / red days from one day to another (both included).
// Days before the start date and today-with-nothing-yet ("pending") are not counted:
// the first didn't exist for you, the second isn't over.
function countDays(fromKey, toKey) {
  const result = { good: 0, partial: 0, missed: 0 };
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) {
    const s = dayStatus(k);
    if (s in result) result[s]++;
  }
  return result;
}

function renderStats() {
  const today = dayKey(new Date());

  // 1) Period: from its first day (but never before startedOn) up to today
  let from = state.startedOn;
  if (statsPeriod === "week") from = mondayOf(today);
  if (statsPeriod === "month") from = today.slice(0, 8) + "01"; // "2026-10-19" → "2026-10-01"
  if (from < state.startedOn) from = state.startedOn;

  for (const p of ["week", "month", "all"]) {
    document.getElementById("period-" + p).setAttribute("aria-pressed", p === statsPeriod);
  }

  // 2) Headline: share of counted days where the goal was reached
  const c = countDays(from, today);
  const total = c.good + c.partial + c.missed;
  document.getElementById("hero-value").textContent = total ? Math.round(c.good / total * 100) + "%" : "–";
  document.getElementById("hero-sub").textContent = total
    ? `${c.good} of ${total} ${total === 1 ? "day" : "days"} · ${c.partial} some done · ${c.missed} missed`
    : "No finished days yet in this period";

  // 3) Times each current exercise was done in the period, most frequent first
  const counts = activeExercises().map(ex => {
    let n = 0;
    for (let k = from; k <= today; k = addDays(k, 1)) if ((state.days[k] || []).includes(ex.id)) n++;
    return { ex, n };
  }).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...counts.map(x => x.n));

  const bars = document.getElementById("ex-bars");
  bars.innerHTML = "";
  for (const { ex, n } of counts) {
    const li = document.createElement("li");
    li.className = "bar-row";
    li.innerHTML = `<span class="bar-name"></span><span class="bar-track"><span class="bar-fill"></span><span class="bar-value"></span></span>`;
    li.querySelector(".bar-name").textContent = ex.name;
    const fill = li.querySelector(".bar-fill");
    fill.style.width = `calc((100% - 2.5em) * ${n / max})`; // leave room for the number at the tip
    if (n === 0) fill.classList.add("zero");
    li.querySelector(".bar-value").textContent = n;
    bars.appendChild(li);
  }

  renderWeeks(today);
}

// 4) Last 8 weeks: one column per week, stacked green / yellow / red days
let selectedWeek = null;
const DAY_PX = 14, GAP_PX = 2; // one day = 14px of column height, 2px gap between segments

function renderWeeks(today) {
  const box = document.getElementById("weeks");
  box.innerHTML = "";
  const thisMonday = mondayOf(today);

  for (let i = 7; i >= 0; i--) {
    const mon = addDays(thisMonday, -7 * i);
    const sun = addDays(mon, 6);
    const c = countDays(mon, sun < today ? sun : today);
    const label = keyToDate(mon).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "week";
    btn.setAttribute("aria-pressed", mon === selectedWeek);
    btn.setAttribute("aria-label", weekText(mon, sun, c));

    const col = document.createElement("span");
    col.className = "week-col";
    for (const s of ["good", "partial", "missed"]) { // drawn from the bottom up
      if (!c[s]) continue;
      const seg = document.createElement("span");
      seg.className = "seg " + s;
      seg.style.height = (c[s] * DAY_PX + (c[s] - 1) * GAP_PX) + "px";
      col.appendChild(seg);
    }
    const lab = document.createElement("span");
    lab.textContent = label;
    btn.append(col, lab);
    btn.addEventListener("click", () => {
      selectedWeek = mon === selectedWeek ? null : mon;
      renderWeeks(today);
    });
    box.appendChild(btn);

    if (mon === selectedWeek) document.getElementById("week-detail").textContent = weekText(mon, sun, c);
  }
  if (!selectedWeek) document.getElementById("week-detail").textContent = "";
}

function weekText(mon, sun, c) {
  const fmt = k => keyToDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const n = c.good + c.partial + c.missed;
  if (!n) return `${fmt(mon)} – ${fmt(sun)}: no tracked days`;
  return `${fmt(mon)} – ${fmt(sun)}: ${c.good} goal reached, ${c.partial} some done, ${c.missed} missed`;
}

for (const p of ["week", "month", "all"]) {
  document.getElementById("period-" + p).addEventListener("click", () => { statsPeriod = p; renderStats(); });
}

// ---------- 9. Settings ----------
// Opened with the ⚙ button on Today. Every change is saved immediately.

// Changes the goal starting today. Past days keep the goal they had.
function setGoal(n) {
  const today = dayKey(new Date());
  const last = state.goals[state.goals.length - 1];
  if (last.from === today) last.goal = n;          // changed again today: just update today's entry
  else state.goals.push({ from: today, goal: n }); // otherwise: a new entry from today on
  save();
  renderSettings();
}

// Moves an exercise up (-1) or down (+1) among the active ones
function moveExercise(id, dir) {
  const active = activeExercises();
  const i = active.findIndex(ex => ex.id === id);
  const j = i + dir;
  if (j < 0 || j >= active.length) return;
  // swap the two exercises inside the full list (which also contains removed ones)
  const a = state.exercises.indexOf(active[i]);
  const b = state.exercises.indexOf(active[j]);
  [state.exercises[a], state.exercises[b]] = [state.exercises[b], state.exercises[a]];
  save();
  renderSettings();
}

let confirmRemoveId = null; // the exercise whose "Remove" was tapped once and waits for confirmation

function removeExercise(id) {
  const ex = state.exercises.find(e => e.id === id);
  ex.removed = true; // hidden from Today and Settings, history stays in Calendar and Stats
  confirmRemoveId = null;
  // the goal can't be bigger than the number of exercises left
  const left = activeExercises().length;
  if (goalFor(dayKey(new Date())) > left) return setGoal(left); // setGoal saves and redraws
  save();
  renderSettings();
}

function restoreExercise(id) {
  delete state.exercises.find(e => e.id === id).removed;
  save();
  renderSettings();
}

function addExercise(name, dose) {
  const id = "ex" + Date.now().toString(36); // a new unique id, e.g. "exmgf3k2a1"
  state.exercises.push({ id, name, dose });
  save();
  renderSettings();
}

function renderSettings() {
  const today = dayKey(new Date());
  const active = activeExercises();
  const goal = goalFor(today);

  // Daily goal stepper: from 1 up to the number of exercises you have
  document.getElementById("goal-value").textContent = goal;
  document.getElementById("goal-minus").disabled = goal <= 1;
  document.getElementById("goal-plus").disabled = goal >= active.length;

  // Exercise rows: name and dose fields, move up / down, remove
  const list = document.getElementById("ex-edit");
  list.innerHTML = "";
  active.forEach((ex, i) => {
    const li = document.createElement("li");
    li.className = "edit-row";
    li.innerHTML = `
      <div class="edit-fields">
        <input class="field" type="text" aria-label="Exercise name" maxlength="40">
        <input class="field dose-field" type="text" aria-label="Amount" maxlength="20" placeholder="Amount">
      </div>
      <div class="edit-actions">
        <button type="button" class="small-btn" data-act="up" aria-label="Move up">↑</button>
        <button type="button" class="small-btn" data-act="down" aria-label="Move down">↓</button>
        <button type="button" class="small-btn danger" data-act="remove"></button>
      </div>`;
    const [nameInput, doseInput] = li.querySelectorAll("input");
    nameInput.id = "name-" + ex.id; nameInput.value = ex.name;
    doseInput.id = "dose-" + ex.id; doseInput.value = ex.dose;
    // "change" fires when you leave the field, so the list isn't redrawn while you type
    nameInput.addEventListener("change", () => {
      const v = nameInput.value.trim();
      if (v) { ex.name = v; save(); } else nameInput.value = ex.name; // an empty name is not allowed
    });
    doseInput.addEventListener("change", () => { ex.dose = doseInput.value.trim(); save(); });

    const [up, down, rm] = li.querySelectorAll("button");
    up.disabled = i === 0;
    down.disabled = i === active.length - 1;
    up.addEventListener("click", () => moveExercise(ex.id, -1));
    down.addEventListener("click", () => moveExercise(ex.id, 1));
    // Remove needs two taps: "Remove" → "Sure?" (the page can't use pop-up dialogs reliably)
    rm.textContent = confirmRemoveId === ex.id ? "Sure?" : "Remove";
    rm.disabled = active.length <= 1; // keep at least one exercise
    rm.addEventListener("click", () => {
      if (confirmRemoveId === ex.id) removeExercise(ex.id);
      else { confirmRemoveId = ex.id; renderSettings(); }
    });
    list.appendChild(li);
  });

  // Removed exercises: can be brought back
  const removed = state.exercises.filter(ex => ex.removed);
  const rmBox = document.getElementById("removed-box");
  rmBox.hidden = removed.length === 0;
  const rmList = document.getElementById("removed-list");
  rmList.innerHTML = "";
  for (const ex of removed) {
    const li = document.createElement("li");
    li.className = "removed-row";
    const span = document.createElement("span");
    span.textContent = ex.dose ? `${ex.name} · ${ex.dose}` : ex.name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "small-btn";
    btn.textContent = "Restore";
    btn.addEventListener("click", () => restoreExercise(ex.id));
    li.append(span, btn);
    rmList.appendChild(li);
  }
}

document.getElementById("goal-minus").addEventListener("click", () => setGoal(goalFor(dayKey(new Date())) - 1));
document.getElementById("goal-plus").addEventListener("click", () => setGoal(goalFor(dayKey(new Date())) + 1));

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault(); // stay on the page instead of "sending" the form
  const name = document.getElementById("add-name").value.trim();
  const dose = document.getElementById("add-dose").value.trim();
  if (!name) { document.getElementById("add-name").focus(); return; }
  addExercise(name, dose);
  e.target.reset();
});

// ---------- 10. Backup ----------
// Download: all data as a .json file. Restore: read such a file and replace the current data.
function showBackupMessage(text) {
  document.getElementById("backup-msg").textContent = text;
}

document.getElementById("backup-download").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `my-workout-day-backup-${dayKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showBackupMessage("Backup file saved. Keep it somewhere safe, e.g. iCloud Drive or email it to yourself.");
});

let pendingRestore = null; // data read from a file, waiting for "Replace my data"

document.getElementById("backup-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = ""; // so choosing the same file again still works
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.days !== "object") throw new Error("not a backup");
    pendingRestore = normalize(data);
    const n = Object.keys(pendingRestore.days).length;
    showBackupMessage(`This file has ${n} ${n === 1 ? "day" : "days"} of data, starting ${pendingRestore.startedOn}. Restoring replaces everything on this device.`);
    document.getElementById("restore-confirm").hidden = false;
  } catch (err) {
    pendingRestore = null;
    document.getElementById("restore-confirm").hidden = true;
    showBackupMessage("This file isn't a My Workout Day backup. Choose a file named my-workout-day-backup-….json.");
  }
});

document.getElementById("restore-yes").addEventListener("click", () => {
  state = pendingRestore;
  pendingRestore = null;
  save();
  document.getElementById("restore-confirm").hidden = true;
  showBackupMessage("Data restored.");
  renderSettings();
});
document.getElementById("restore-no").addEventListener("click", () => {
  pendingRestore = null;
  document.getElementById("restore-confirm").hidden = true;
  showBackupMessage("");
});

// ---------- 11. Tabs ----------
// Only one section is visible at a time; the others get the "hidden" attribute.
// Settings isn't a tab: it opens from Today, and "Back" returns there.
const VIEWS = ["today", "calendar", "stats", "settings"];
const TABS = ["today", "calendar", "stats"];
let currentView = "today";

function showView(name) {
  currentView = name;
  for (const v of VIEWS) document.getElementById("view-" + v).hidden = v !== name;
  for (const t of TABS) {
    const tab = document.getElementById("tab-" + t);
    if (t === name) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  if (name === "today") renderToday();
  if (name === "calendar") {
    // always open on the current month
    calYear = new Date().getFullYear();
    calMonth = new Date().getMonth();
    selectedKey = null;
    renderCalendar();
  }
  if (name === "stats") { selectedWeek = null; renderStats(); }
  if (name === "settings") { confirmRemoveId = null; showBackupMessage(""); renderSettings(); }
  window.scrollTo(0, 0);
}
for (const t of TABS) {
  document.getElementById("tab-" + t).addEventListener("click", () => showView(t));
}
document.getElementById("open-settings").addEventListener("click", () => showView("settings"));
document.getElementById("close-settings").addEventListener("click", () => showView("today"));

// When you come back to the app (e.g. the next morning), redraw so "today" is really today.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (currentView === "today") renderToday();
  if (currentView === "calendar") renderCalendar();
  if (currentView === "stats") renderStats();
});

// First draw
showView("today");
