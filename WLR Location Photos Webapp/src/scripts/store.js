import { locations } from '../data/locations.js';
import { MGMT, ROSTER_CHANGES } from '../data/team.js';
import { pad, nowET, NOW_YEAR } from './util.js';

// ══ DATA ══════════════════════════════════════════════════
// Everything about a location that can differ from the bundled data files:
// sites and edits added on this device through the admin page (localStorage),
// photos uploaded there (IndexedDB), and dated roster changes.

const PHOTO_PREFIX = 'wlr_photo_';
const INFO_PREFIX  = 'wlr_info_';

// Merge in any custom locations added via the admin panel
export function mergeCustomLocations() {
  try {
    const custom = JSON.parse(localStorage.getItem('wlr_custom_locs') || '[]');
    custom.forEach(loc => {
      if (!locations.find(l => l.num === loc.num)) locations.push(loc);
    });
    locations.sort((a,b) => a.num - b.num);
  } catch(e) {}
}

export function applyRosterChanges(onDate) {
  const d = nowET();
  const today = onDate ||
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  ROSTER_CHANGES.forEach(c => {
    if (today < c.from || !MGMT[c.num]) return;
    const list = MGMT[c.num][c.role] = [].concat(MGMT[c.num][c.role] || []);
    if (c.add && !list.includes(c.add)) list.push(c.add);
  });
}

// ── INDEXEDDB PHOTO CACHE ──────────────────────────────────
const DB_NAME = 'wlr_photos', DB_VER = 1, DB_STORE = 'photos';
let photoCache = {};

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}
export function dbGetAll() {
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
// Startup hands the IndexedDB contents over once; everything after reads memory.
export function setPhotoCache(all) { photoCache = all; }

// Reads from in-memory cache (populated at startup)
export function getPhotoSrc(num, slot) {
  return photoCache[`${PHOTO_PREFIX}loc${pad(num)}_${slot}`] || null;
}
export function getLocInfo(num) {
  try {
    const raw = localStorage.getItem(`${INFO_PREFIX}loc${pad(num)}`);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}
// Returns false if location is hidden and not yet published via admin
export function isLocVisible(baseLoc) {
  if (!baseLoc.hidden) return true;
  return getLocInfo(baseLoc.num).published === true;
}

/* A permanently closed site is not listed anywhere in the gallery (see
   isListed) but stays in the data, the admin page and the Growth chart's
   history; hours and Call also check it, for a site an admin edit closes. */
export function isPermClosed(num) {
  const base = locations.find(l => l.num === num);
  return !!base && ({ ...base, ...getLocInfo(num) }).status === 'Permanently Closed';
}

/* Whether the gallery lists a location — grid, map, slideshow, search and
   every count: not a future site still hidden (unless published from the
   admin page), and not permanently closed. */
export function isListed(baseLoc) {
  return isLocVisible(baseLoc) && !isPermClosed(baseLoc.num);
}

/* Full years since an opening date (ts = YYYYMMDD; a 00 day means the 1st).
   Counting from the month, not just the year: a store opened in December
   2016 is 9 until this December, not 10 from New Year's Day. */
export function yearsOpen(ts) {
  if (!ts || ts > 20991200) return null;
  const y = Math.floor(ts / 10000), m = Math.floor(ts / 100) % 100 || 1, d = ts % 100 || 1;
  const now = nowET();
  let n = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) n--;
  return Math.max(0, n);
}
