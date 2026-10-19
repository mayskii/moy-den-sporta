// ---------- 1. Default data ----------
// The exercise library. Each exercise has an id (internal name, never changes),
// a display name and a "dose" — how much to do.
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
//   goal: 3,                                    — daily goal
//   startedOn: "2026-10-16",                    — first day of using the app
//   days: { "2026-10-16": ["walk", "plank"] }   — what was checked on which day
// }
// Days are stored by exercise id, so renaming an exercise keeps its history.
// Until there is a screen for editing the library, the list always comes from DEFAULT_EXERCISES.
const STORAGE_KEY = "moy-den-sporta";
let storageWorks = true;

function load() {
  const state = { exercises: DEFAULT_EXERCISES, goal: DEFAULT_GOAL, startedOn: null, days: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.days) {
      state.days = saved.days;
      state.goal = saved.goal || DEFAULT_GOAL;
      state.startedOn = saved.startedOn || null;
    }
  } catch (e) { storageWorks = false; }

  // Older saves have no startedOn: use the earliest day with checkmarks, or today.
  if (!state.startedOn) {
    const keys = Object.keys(state.days).sort();
    state.startedOn = keys[0] || dayKey(new Date());
  }
  return state;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ goal: state.goal, startedOn: state.startedOn, days: state.days }));
    storageWorks = true;
  } catch (e) { storageWorks = false; }
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

let state = load();
save(); // stores startedOn on the very first visit

// ---------- 4. Day results ----------
// How many exercises from the library were checked on a given day.
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
  if (n >= state.goal) return "good";
  if (n > 0) return "partial";
  return key === today ? "pending" : "missed";
}

// ---------- 5. Checking an exercise ----------
// Tapping a card adds the exercise to today's done list,
// or removes it if it was already checked. Only today can be changed.
function toggle(id) {
  const key = dayKey(new Date());
  const done = new Set(state.days[key] || []);
  done.has(id) ? done.delete(id) : done.add(id);
  state.days[key] = [...done];
  save();
  renderToday();
}

// ---------- 6. Today tab ----------
const CHECK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

function renderToday() {
  const now = new Date();
  const done = new Set(state.days[dayKey(now)] || []);
  const count = doneCount(dayKey(now));
  const goal = state.goal;

  // Date
  document.getElementById("weekday").textContent = now.toLocaleDateString("en-US", { weekday: "long" });
  document.getElementById("date").textContent = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Progress: "2 of 3" and a bar with one segment per goal step
  document.getElementById("count").textContent = `${Math.min(count, goal)} of ${goal}` + (count > goal ? ` · ${count} total` : "");
  const status = document.getElementById("status");
  if (count >= goal) { status.textContent = "Goal reached"; status.className = "status done"; }
  else if (count > 0) { status.textContent = `${goal - count} to go`; status.className = "status"; }
  else { status.textContent = "Nothing yet"; status.className = "status"; }

  document.getElementById("steps").innerHTML =
    Array.from({ length: goal }, (_, i) => `<span class="step${i < count ? " on" : ""}"></span>`).join("");

  // Exercise list
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const ex of state.exercises) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ex-" + ex.id;
    btn.className = "item";
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
    ? "Your checkmarks are saved on this phone."
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
  p.textContent = `${STATUS_TEXT[dayStatus(selectedKey)]} · ${done.length} of ${state.goal}`;
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

  // 3) Times each exercise was done in the period, most frequent first
  const counts = state.exercises.map(ex => {
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

// ---------- 9. Tabs ----------
// Only one tab section is visible at a time; the others get the "hidden" attribute.
const VIEWS = ["today", "calendar", "stats"];
let currentView = "today";

function showView(name) {
  currentView = name;
  for (const v of VIEWS) {
    document.getElementById("view-" + v).hidden = v !== name;
    const tab = document.getElementById("tab-" + v);
    if (v === name) tab.setAttribute("aria-current", "page");
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
  window.scrollTo(0, 0);
}
for (const v of VIEWS) {
  document.getElementById("tab-" + v).addEventListener("click", () => showView(v));
}

// When you come back to the app (e.g. the next morning), redraw so "today" is really today.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (currentView === "today") renderToday();
  if (currentView === "calendar") renderCalendar();
  if (currentView === "stats") renderStats();
});

// First draw
showView("today");
