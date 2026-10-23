import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EXERCISES, normalize, parseBackup, goalFor, doneCount, dayStatus, countDays,
  periodStart, exerciseCounts, currentStreak, bestStreak,
  toggleDone, setGoal, moveExercise, removeExercise, restoreExercise,
} from "../js/logic.js";

// All tests use the same "today": Friday, October 23, 2026.
const TODAY = "2026-10-23";

// A small state: three exercises, goal 2, started on Monday October 19.
function makeState(days = {}, extra = {}) {
  return normalize({
    exercises: [
      { id: "walk", name: "Walk", dose: "30 min" },
      { id: "squats", name: "Squats", dose: "×10" },
      { id: "plank", name: "Plank", dose: "1 min" },
    ],
    goals: [{ from: "2026-10-19", goal: 2 }],
    startedOn: "2026-10-19",
    days,
    ...extra,
  }, TODAY);
}

describe("normalize: turning saved data into a valid state", () => {
  test("nothing saved: default exercises, goal 3, starts today", () => {
    const s = normalize(null, TODAY);
    assert.deepEqual(s.exercises, DEFAULT_EXERCISES);
    assert.deepEqual(s.goals, [{ from: TODAY, goal: 3 }]);
    assert.equal(s.startedOn, TODAY);
    assert.deepEqual(s.days, {});
  });

  test("the default exercises are copied, not shared", () => {
    normalize(null, TODAY).exercises[0].name = "Changed";
    assert.equal(DEFAULT_EXERCISES[0].name, "Walk");
  });

  test("an old save with one goal and no start date is upgraded", () => {
    const s = normalize({ goal: 4, days: { "2026-10-10": ["walk"], "2026-10-05": ["walk"] } }, TODAY);
    assert.equal(s.startedOn, "2026-10-05"); // the first day with data
    assert.deepEqual(s.goals, [{ from: "2026-10-05", goal: 4 }]);
  });

  test("a removed exercise stays removed", () => {
    const s = makeState({}, { exercises: [{ id: "a", name: "A", removed: true }, { id: "b", name: "B" }] });
    assert.deepEqual(s.exercises, [{ id: "a", name: "A", dose: "", removed: true }, { id: "b", name: "B", dose: "" }]);
  });
});

describe("goalFor: each day is judged by the goal of that day", () => {
  const s = makeState({}, { goals: [{ from: "2026-10-19", goal: 2 }, { from: "2026-10-22", goal: 3 }] });

  test("before the change: the old goal", () => assert.equal(goalFor(s, "2026-10-21"), 2));
  test("on and after the change: the new goal", () => {
    assert.equal(goalFor(s, "2026-10-22"), 3);
    assert.equal(goalFor(s, "2026-10-23"), 3);
  });
  test("before the first entry: the first goal", () => assert.equal(goalFor(s, "2026-01-01"), 2));
});

describe("dayStatus: the color of a day", () => {
  const s = makeState({
    "2026-10-19": ["walk", "squats"],
    "2026-10-20": ["walk"],
    "2026-10-22": ["walk", "squats", "plank"],
  });

  test("goal reached: good", () => assert.equal(dayStatus(s, "2026-10-19", TODAY), "good"));
  test("more than the goal: still good", () => assert.equal(dayStatus(s, "2026-10-22", TODAY), "good"));
  test("some done: partial", () => assert.equal(dayStatus(s, "2026-10-20", TODAY), "partial"));
  test("a past day with nothing: missed", () => assert.equal(dayStatus(s, "2026-10-21", TODAY), "missed"));
  test("today with nothing yet: pending, not missed", () => assert.equal(dayStatus(s, TODAY, TODAY), "pending"));
  test("after today: future", () => assert.equal(dayStatus(s, "2026-10-24", TODAY), "future"));
  test("before the start date: before, never missed", () => assert.equal(dayStatus(s, "2026-10-18", TODAY), "before"));

  test("a removed exercise still counts for its days", () => {
    const r = makeState({ "2026-10-19": ["walk", "squats"] });
    removeExercise(r, "squats", TODAY);
    assert.equal(dayStatus(r, "2026-10-19", TODAY), "good");
  });

  test("an id that isn't in the library doesn't count", () => {
    const r = makeState({ "2026-10-19": ["walk", "deleted-long-ago"] });
    assert.equal(doneCount(r, "2026-10-19"), 1);
    assert.equal(dayStatus(r, "2026-10-19", TODAY), "partial");
  });
});

describe("countDays and stats", () => {
  const s = makeState({
    "2026-10-19": ["walk", "squats"],
    "2026-10-20": ["walk"],
    "2026-10-22": ["walk", "plank"],
  });

  test("counts good, partial and missed; skips today-pending and days before the start", () => {
    assert.deepEqual(countDays(s, "2026-10-15", TODAY, TODAY), { good: 2, partial: 1, missed: 1 });
  });

  test("periodStart: week starts on Monday, month on the 1st, never before the start date", () => {
    const late = makeState({}, { startedOn: "2026-10-21" });
    assert.equal(periodStart(s, "week", TODAY), "2026-10-19");
    assert.equal(periodStart(s, "month", TODAY), "2026-10-19"); // Oct 1 is before the start
    assert.equal(periodStart(late, "week", TODAY), "2026-10-21");
    assert.equal(periodStart(makeState({}, { startedOn: "2026-09-01" }), "month", TODAY), "2026-10-01");
  });

  test("exerciseCounts: most frequent first", () => {
    const counts = exerciseCounts(s, "2026-10-19", TODAY).map(({ ex, n }) => [ex.id, n]);
    assert.deepEqual(counts, [["walk", 3], ["squats", 1], ["plank", 1]]);
  });
});

describe("streaks", () => {
  // Mon good, Tue partial, Wed good, Thu good, Fri (today) not finished yet
  const days = {
    "2026-10-19": ["walk", "squats"],
    "2026-10-20": ["walk"],
    "2026-10-21": ["walk", "plank"],
    "2026-10-22": ["squats", "plank"],
  };

  test("an unfinished today doesn't break the streak: counts up to yesterday", () => {
    assert.equal(currentStreak(makeState(days), TODAY), 2);
  });

  test("a finished today adds to the streak", () => {
    assert.equal(currentStreak(makeState({ ...days, [TODAY]: ["walk", "squats"] }), TODAY), 3);
  });

  test("a missed yesterday means no streak", () => {
    const s = makeState({ "2026-10-19": ["walk", "squats"] });
    assert.equal(currentStreak(s, TODAY), 0);
  });

  test("the streak stops at the start date", () => {
    const s = makeState({ "2026-10-19": ["walk", "squats"], "2026-10-20": ["walk", "squats"] });
    assert.equal(currentStreak(s, "2026-10-20"), 2);
  });

  test("a goal change counts each day by its own goal", () => {
    // goal 3 from Thursday: Thursday with 2 done is now only partial
    const s = makeState(days, { goals: [{ from: "2026-10-19", goal: 2 }, { from: "2026-10-22", goal: 3 }] });
    assert.equal(currentStreak(s, TODAY), 0);
  });

  test("best streak: the longest run with its dates; the earlier one wins a tie", () => {
    assert.deepEqual(bestStreak(makeState(days), TODAY), { n: 2, from: "2026-10-21", to: "2026-10-22" });
    const tie = makeState({ "2026-10-19": ["walk", "squats"], "2026-10-21": ["walk", "squats"] });
    assert.deepEqual(bestStreak(tie, TODAY), { n: 1, from: "2026-10-19", to: "2026-10-19" });
  });

  test("best streak with no good days", () => {
    assert.deepEqual(bestStreak(makeState(), TODAY), { n: 0, from: null, to: null });
  });
});

describe("changes", () => {
  test("toggleDone checks and unchecks", () => {
    const s = makeState();
    toggleDone(s, TODAY, "walk");
    assert.deepEqual(s.days[TODAY], ["walk"]);
    toggleDone(s, TODAY, "walk");
    assert.deepEqual(s.days[TODAY], []);
  });

  test("setGoal adds an entry from today, and past days keep their goal", () => {
    const s = makeState();
    setGoal(s, TODAY, 3);
    assert.deepEqual(s.goals, [{ from: "2026-10-19", goal: 2 }, { from: TODAY, goal: 3 }]);
    assert.equal(goalFor(s, "2026-10-22"), 2);
  });

  test("setGoal twice on the same day updates that day's entry", () => {
    const s = makeState();
    setGoal(s, TODAY, 3);
    setGoal(s, TODAY, 1);
    assert.deepEqual(s.goals, [{ from: "2026-10-19", goal: 2 }, { from: TODAY, goal: 1 }]);
  });

  test("removing an exercise lowers the goal if fewer exercises are left", () => {
    const s = makeState();
    setGoal(s, TODAY, 3);
    removeExercise(s, "plank", TODAY);
    assert.equal(goalFor(s, TODAY), 2);
    restoreExercise(s, "plank");
    assert.equal(s.exercises.find(ex => ex.id === "plank").removed, undefined);
  });

  test("moveExercise skips removed exercises and stops at the ends", () => {
    const s = makeState();
    removeExercise(s, "squats", TODAY);
    moveExercise(s, "walk", 1); // walk moves below plank, past the hidden squats
    assert.deepEqual(s.exercises.map(ex => ex.id), ["plank", "squats", "walk"]);
    moveExercise(s, "walk", 1); // already last: nothing happens
    assert.deepEqual(s.exercises.map(ex => ex.id), ["plank", "squats", "walk"]);
  });
});

describe("parseBackup: reading a backup file", () => {
  test("a real backup is read back exactly", () => {
    const s = makeState({ "2026-10-19": ["walk", "squats"] });
    assert.deepEqual(parseBackup(JSON.stringify(s), TODAY), s);
  });

  test("not JSON: rejected", () => {
    assert.throws(() => parseBackup("hello", TODAY));
  });

  test("JSON without days: rejected", () => {
    assert.throws(() => parseBackup('{"name": "something else"}', TODAY));
    assert.throws(() => parseBackup("[]", TODAY));
    assert.throws(() => parseBackup("null", TODAY));
  });

  test("days that are not a list of days: rejected", () => {
    assert.throws(() => parseBackup('{"days": null}', TODAY));
    assert.throws(() => parseBackup('{"days": [1, 2]}', TODAY));
  });

  test("broken entries inside days are dropped, good ones kept", () => {
    const s = parseBackup(JSON.stringify({
      days: { "2026-10-19": ["walk"], "2026-10-20": "walk", "not a date": ["walk"], "2026-10-21": ["walk", 5] },
    }), TODAY);
    assert.deepEqual(s.days, { "2026-10-19": ["walk"], "2026-10-21": ["walk"] });
  });

  test("a goal written as text is read as a number", () => {
    const s = parseBackup('{"days": {}, "goals": [{"from": "2026-10-19", "goal": "3"}]}', TODAY);
    assert.equal(goalFor(s, TODAY), 3);
    setGoal(s, TODAY, goalFor(s, TODAY) + 1); // the + button
    assert.equal(goalFor(s, TODAY), 4);
  });

  test("an old single goal that makes no sense falls back to the default goal", () => {
    assert.equal(goalFor(parseBackup('{"days": {}, "goal": -1}', TODAY), TODAY), 3);
  });

  test("goals that are all broken fall back to the default goal", () => {
    const s = parseBackup('{"days": {}, "startedOn": "2026-10-19", "goals": [{"goal": 0}]}', TODAY);
    assert.equal(goalFor(s, TODAY), 3);
  });

  test("goals out of order are sorted by date", () => {
    const s = parseBackup('{"days": {}, "goals": [{"from": "2026-10-22", "goal": 4}, {"from": "2026-10-19", "goal": 2}]}', TODAY);
    assert.equal(goalFor(s, "2026-10-20"), 2);
    assert.equal(goalFor(s, TODAY), 4);
  });

  test("exercises that are all broken fall back to the default list", () => {
    const s = parseBackup('{"days": {}, "exercises": [{"name": 5}]}', TODAY);
    assert.deepEqual(s.exercises, DEFAULT_EXERCISES);
  });
});
