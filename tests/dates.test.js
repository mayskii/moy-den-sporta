import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, keyToDate, addDays, mondayOf } from "../js/dates.js";

test("dayKey pads month and day with zeros", () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("keyToDate and dayKey go back and forth", () => {
  assert.equal(dayKey(keyToDate("2026-10-23")), "2026-10-23");
});

test("addDays crosses month, year and leap day", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("addDays steps over daylight saving changes one day at a time", () => {
  // Clocks change in late March and late October in Europe, in March and November in the US
  let k = "2026-03-01";
  for (let i = 0; i < 300; i++) k = addDays(k, 1);
  assert.equal(k, "2026-12-26");
});

test("mondayOf finds the Monday of the same week", () => {
  assert.equal(mondayOf("2026-10-19"), "2026-10-19"); // Monday
  assert.equal(mondayOf("2026-10-23"), "2026-10-19"); // Friday
  assert.equal(mondayOf("2026-10-25"), "2026-10-19"); // Sunday belongs to the week before
  assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // across months
});
