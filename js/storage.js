// ---------- Storage ----------
// The state is kept as one JSON object in the browser's memory (localStorage).
// Both functions return whether the browser let us save (private mode or full storage may not).
import { normalize } from "./logic.js";

const STORAGE_KEY = "moy-den-sporta";

export function load(today) {
  try { return { state: normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)), today), works: true }; }
  catch { return { state: normalize(null, today), works: false }; }
}

export function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
