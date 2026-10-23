// The page: draws the tabs and reacts to taps.
// The calculations live in js/logic.js, dates in js/dates.js, saving in js/storage.js.
import { dayKey, todayKey, keyToDate, addDays, mondayOf } from "./js/dates.js";
import {
  parseBackup, goalFor, activeExercises, doneCount, dayStatus, countDays,
  periodStart, exerciseCounts, currentStreak, bestStreak,
  toggleDone, setGoal as setGoalIn, moveExercise as moveExerciseIn,
  removeExercise as removeExerciseIn, restoreExercise as restoreExerciseIn, addExercise as addExerciseIn,
} from "./js/logic.js";
import { load, save as saveState } from "./js/storage.js";

let { state, works: storageWorks } = load(todayKey());
save(); // stores the upgraded format on the very first visit

function save() {
  storageWorks = saveState(state);
}

// Shortcuts: the same calculations for the current state and today
const goalOn = key => goalFor(state, key);
const statusOf = key => dayStatus(state, key, todayKey());

// ---------- 5. Checking an exercise ----------
// Tapping a card adds the exercise to today's done list,
// or removes it if it was already checked. Only today can be changed.
// justToggled remembers which card was tapped, so only its checkmark animates.
let justToggled = null;
function toggle(id) {
  toggleDone(state, todayKey(), id);
  save();
  justToggled = id;
  renderToday();
  justToggled = null;
}

// ---------- 6. Today tab ----------
const CHECK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

function renderToday() {
  const now = new Date();
  const key = todayKey();
  const done = new Set(state.days[key] || []);
  const count = doneCount(state, key);
  const goal = goalOn(key);

  // Date
  document.getElementById("weekday").textContent = now.toLocaleDateString("en-US", { weekday: "long" });
  document.getElementById("date").textContent = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Progress: the ring fills by the share of the goal done (100 = full circle), "2/3" inside it
  const shown = Math.min(count, goal);
  document.getElementById("ring-fill").style.strokeDashoffset = 100 - (shown / goal) * 100;
  document.getElementById("ring-count").textContent = shown;
  document.getElementById("ring-goal").textContent = `/${goal}`;

  const status = document.getElementById("status");
  if (count >= goal) status.textContent = "Goal reached 🎉";
  else if (count > 0) status.textContent = `${goal - count} more to go`;
  else status.textContent = "Let's get moving";
  document.getElementById("count").textContent = count > goal
    ? `${count} exercises done · +${count - goal} extra`
    : `${count} of ${goal} exercises done`;
  // goal reached: the whole card turns accent-colored
  document.getElementById("progress").classList.toggle("done", count >= goal);

  // Exercise list
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const ex of activeExercises(state)) {
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
  const today = todayKey();

  document.getElementById("cal-title").textContent =
    first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  // Empty cells before the 1st, so the 1st lands under the right weekday
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement("span"));

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dayKey(new Date(calYear, calMonth, d));
    const status = statusOf(key);
    // Days you can open: from the start date up to today
    const canOpen = status !== "future" && status !== "before";
    const cell = document.createElement(canOpen ? "button" : "span");
    cell.className = `day ${status}` + (key === today ? " today" : "") + (key === selectedKey ? " selected" : "");
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
  p.textContent = `${STATUS_TEXT[statusOf(selectedKey)]} · ${done.length} of ${goalOn(selectedKey)}`;
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

function renderStats() {
  const today = todayKey();

  // 1) Period: from its first day (but never before startedOn) up to today
  const from = periodStart(state, statsPeriod, today);

  for (const p of ["week", "month", "all"]) {
    document.getElementById("period-" + p).setAttribute("aria-pressed", p === statsPeriod);
  }

  // 2) Headline: share of counted days where the goal was reached
  const c = countDays(state, from, today, today);
  const total = c.good + c.partial + c.missed;
  document.getElementById("hero-value").textContent = total ? Math.round(c.good / total * 100) + "%" : "–";
  document.getElementById("hero-sub").textContent = total
    ? `${c.good} of ${total} ${total === 1 ? "day" : "days"} · ${c.partial} some done · ${c.missed} missed`
    : "No finished days yet in this period";

  // 3) Times each current exercise was done in the period, most frequent first
  const counts = exerciseCounts(state, from, today);
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
    const c = countDays(state, mon, sun < today ? sun : today, today);
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

// ---------- 8b. Streak tab ----------
// A streak is a run of green days in a row. A yellow or red day breaks it.
// Today doesn't break it while it's still going: until the goal is reached,
// the streak counts up to yesterday, and the message says how many are left.

function renderStreak() {
  const now = new Date();
  const today = todayKey();
  const streak = currentStreak(state, today);
  const best = bestStreak(state, today);
  const left = goalOn(today) - doneCount(state, today);
  const doneToday = left <= 0;
  const daysWord = n => (n === 1 ? "day" : "days");
  const fmt = k => keyToDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  document.getElementById("streak-weekday").textContent =
    now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Big number
  document.getElementById("streak-count").textContent = streak;
  document.getElementById("streak-label").textContent = `${daysWord(streak)} in a row`;

  // Best streak
  document.getElementById("best-count").textContent = best.n;
  document.getElementById("best-unit").textContent = daysWord(best.n);
  document.getElementById("best-dates").textContent = !best.n ? "No streak yet"
    : best.n === 1 ? fmt(best.from)
    : `${fmt(best.from)} – ${fmt(best.to)}`;

  // Last 7 days, oldest on the left
  const dots = document.getElementById("week-dots");
  dots.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    const status = statusOf(k);
    const li = document.createElement("li");
    if (k === today) li.className = "today";
    const dot = document.createElement("span");
    dot.className = "week-dot " + status;
    const name = keyToDate(k).toLocaleDateString("en-US", { weekday: "long" });
    li.setAttribute("aria-label", `${name}: ${STATUS_TEXT[status] || "Not tracked"}`);
    li.append(dot, name[0]); // first letter: M, T, W…
    dots.appendChild(li);
  }

  // Message
  let title, body;
  if (doneToday) {
    title = streak === 1 ? "Day one done." : `${streak} days strong.`;
    body = "Same time tomorrow — small steps add up.";
  } else if (streak > 0) {
    title = `${left} more and it's ${streak + 1}.`;
    body = "Finish today's exercises to keep the streak going.";
  } else {
    title = "Start a streak today.";
    body = `Do ${left} ${left === 1 ? "exercise" : "exercises"} to make today day one.`;
  }
  document.getElementById("streak-msg-title").textContent = title;
  document.getElementById("streak-msg-body").textContent = body;
}

// ---------- 9. Settings ----------
// Opened with the ⚙ button on Today. Every change is saved immediately.

// Changes the goal starting today. Past days keep the goal they had.
function setGoal(n) {
  setGoalIn(state, todayKey(), n);
  save();
  renderSettings();
}

// Moves an exercise up (-1) or down (+1) among the active ones
function moveExercise(id, dir) {
  moveExerciseIn(state, id, dir);
  save();
  renderSettings();
}

let confirmRemoveId = null; // the exercise whose "Remove" was tapped once and waits for confirmation

function removeExercise(id) {
  removeExerciseIn(state, id, todayKey()); // also lowers the goal if fewer exercises are left
  confirmRemoveId = null;
  save();
  renderSettings();
}

function restoreExercise(id) {
  restoreExerciseIn(state, id);
  save();
  renderSettings();
}

function addExercise(name, dose) {
  addExerciseIn(state, name, dose);
  save();
  renderSettings();
}

function renderSettings() {
  const active = activeExercises(state);
  const goal = goalOn(todayKey());

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

document.getElementById("goal-minus").addEventListener("click", () => setGoal(goalOn(todayKey()) - 1));
document.getElementById("goal-plus").addEventListener("click", () => setGoal(goalOn(todayKey()) + 1));

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
  a.download = `my-workout-day-backup-${todayKey()}.json`;
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
    pendingRestore = parseBackup(await file.text(), todayKey());
    const n = Object.keys(pendingRestore.days).length;
    showBackupMessage(`This file has ${n} ${n === 1 ? "day" : "days"} of data, starting ${pendingRestore.startedOn}. Restoring replaces everything on this device.`);
    document.getElementById("restore-confirm").hidden = false;
  } catch {
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
const VIEWS = ["today", "calendar", "streak", "stats", "settings"];
const TABS = ["today", "calendar", "streak", "stats"];
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
  if (name === "streak") renderStreak();
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
  if (currentView === "streak") renderStreak();
  if (currentView === "stats") renderStats();
});

// First draw
showView("today");

// Save the app's files on the phone so it also opens without internet (see sw.js).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
