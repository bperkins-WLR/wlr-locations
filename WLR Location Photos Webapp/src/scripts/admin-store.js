// Everything the admin panel saves, and where. The gallery (app.js) reads these
// same keys on the same origin, so names and value formats are a contract:
// changing one here silently disconnects admin edits from the gallery.
//
//   IndexedDB wlr_photos/photos   wlr_photo_locNN_ext|int → JPEG data URL
//   localStorage wlr_info_locNN   per-location info overrides (JSON)
//   localStorage wlr_custom_locs  locations added from the admin (JSON array)
//   localStorage wlr_incidents    videos list (JSON array)

import { locations } from '../data/locations.js';

// The built-in locations are the shared list the gallery renders, so the admin
// can never offer a different name, city or address than the gallery shows.
// Read-only here: overrides go to localStorage, never into this array.
export const BASE_LOCS = locations;

const PHOTO_PFX       = 'wlr_photo_';
const INFO_PFX        = 'wlr_info_';
const CUSTOM_LOCS_KEY = 'wlr_custom_locs';
const VIDEOS_KEY      = 'wlr_incidents';

export function pad(n) { return String(n).padStart(2,'0'); }

// ── KEY HELPERS ───────────────────────────────────────────────
function photoKey(num, slot) { return `${PHOTO_PFX}loc${pad(num)}_${slot}`; }
function infoKey(num)        { return `${INFO_PFX}loc${pad(num)}`; }

// ── INDEXEDDB FOR PHOTOS (no size limit) ──────────────────────
const DB_NAME = 'wlr_photos', DB_VER = 1, DB_STORE = 'photos';
let photoCache = {};   // in-memory mirror populated on init

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}
function dbSet(key, val) {
  return openDB().then(db => new Promise((res, rej) => {
    const r = db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE).put(val, key);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  }));
}
function dbDel(key) {
  return openDB().then(db => new Promise((res, rej) => {
    const r = db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE).delete(key);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  }));
}
function dbClear() {
  return openDB().then(db => new Promise((res, rej) => {
    const r = db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE).clear();
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  }));
}
function dbGetAll() {
  return openDB().then(db => new Promise((res, rej) => {
    const result = {};
    const req = db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (c) { result[c.key] = c.value; c.continue(); } else res(result);
    };
    req.onerror = () => rej(req.error);
  }));
}

// Pre-load every photo so rendering can read them synchronously
export function loadPhotos() {
  return dbGetAll().then(all => { photoCache = all; });
}
export function clearPhotos() {
  return dbClear().then(() => { photoCache = {}; });
}

// Sync read from in-memory cache
export function getPhoto(num, slot) { return photoCache[photoKey(num, slot)] || null; }

// Async write — updates cache + IndexedDB
export async function setPhoto(num, slot, data) {
  photoCache[photoKey(num, slot)] = data;
  await dbSet(photoKey(num, slot), data);
}
export async function delPhoto(num, slot) {
  delete photoCache[photoKey(num, slot)];
  await dbDel(photoKey(num, slot));
}

// ── LOCALSTORAGE FOR INFO EDITS (text only, tiny size) ────────
export function getInfo(num) {
  const raw = localStorage.getItem(infoKey(num));
  return raw ? JSON.parse(raw) : {};
}
export function setInfo(num, obj) { localStorage.setItem(infoKey(num), JSON.stringify(obj)); }
export function clearInfo(num)    { localStorage.removeItem(infoKey(num)); }
export function hasInfo(num)      { return !!localStorage.getItem(infoKey(num)); }

// Merge base data with any saved edits
export function getDisplayLoc(base) {
  const edits = getInfo(base.num);
  return { ...base, ...edits };
}

// ── CUSTOM LOCATIONS ─────────────────────────────────────────
export function getCustomLocs() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_LOCS_KEY) || '[]'); } catch(e) { return []; }
}
function saveCustomLocs(arr) { localStorage.setItem(CUSTOM_LOCS_KEY, JSON.stringify(arr)); }
export function addCustomLoc(loc) {
  const all = getCustomLocs();
  if (all.find(l => l.num === loc.num) || BASE_LOCS.find(l => l.num === loc.num)) return false;
  all.push(loc);
  saveCustomLocs(all);
  return true;
}
export function deleteCustomLoc(num) {
  saveCustomLocs(getCustomLocs().filter(l => l.num !== num));
}
export function getAllLocs() {
  return [...BASE_LOCS, ...getCustomLocs()].sort((a,b) => a.num - b.num);
}

// ── VIDEOS ───────────────────────────────────────────────────
// "Publish code" exports this list to paste into incidents.json (shared with
// everyone); until then the videos show only on this device.
export function getVideos() { try { return JSON.parse(localStorage.getItem(VIDEOS_KEY) || '[]'); } catch(e) { return []; } }
export function saveVideos(a) { localStorage.setItem(VIDEOS_KEY, JSON.stringify(a)); }
