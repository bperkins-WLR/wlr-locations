/* ══ DATA CHECK ═════════════════════════════════════════════
   Looks over every file in this folder for mistakes before a deploy goes out.
   It runs automatically at the start of every build (see astro.config.mjs):

   • ERRORS stop the build, so a broken edit never reaches the live site.
     They are reserved for things that are genuinely wrong — a duplicate store
     number, a brand that does not exist, hours that close before they open,
     a roster change pointing at a store that is not on the list.
   • WARNINGS are printed but the build carries on. They flag things worth a
     look — a missing ZIP code, an http:// link, a roster change whose date
     has already passed.

   Run it on its own with:   npm run check-data

   No dependencies — plain JavaScript, so the build, the ratings job and a bare
   `node` can all load it. */
import { locations, COORDS } from './locations.js';
import { TYPE_FULL, TYPE_LOGO, LOC_LOGO } from './brands.js';
import { HOURS } from './hours.js';
import { MGMT, ROSTER_CHANGES } from './team.js';
import { GROWTH } from './growth.js';

// Placeholder `ts` for sites without an opening date yet (sorts them last).
const NOT_OPEN_TS = 20991231;
// The statuses the gallery knows how to badge.
const STATUSES = ['Coming Soon', 'Temporarily Closed', 'Permanently Closed'];
// Roster roles, as used in team.js.
const ROLES = ['mp', 'dm', 'lm', 'am', 'sup'];
// A generous box around MD / PA / WV / VA / DE. A pin outside it is almost
// always a typo or latitude/longitude swapped.
const REGION = { latMin: 36.5, latMax: 42.3, lngMin: -83.7, lngMax: -74.9 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string';
const isNonEmptyStr = v => isStr(v) && v.trim() !== '';
const isNum = v => typeof v === 'number' && Number.isFinite(v);

function realDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function tsIsValid(ts) {
  if (!Number.isInteger(ts) || ts < 19000101 || ts > NOT_OPEN_TS) return false;
  return ts === NOT_OPEN_TS || realDate(Math.floor(ts / 10000), Math.floor(ts / 100) % 100, ts % 100);
}
function isoIsValid(s) {
  const m = isStr(s) && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return !!m && realDate(+m[1], +m[2], +m[3]);
}
// Today's date in Eastern time as YYYY-MM-DD — the zone roster changes use.
function todayET() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
function urlProblem(v) {
  let u;
  try { u = new URL(v); } catch { return 'is not a valid web address'; }
  if (u.protocol === 'https:') return null;
  if (u.protocol === 'http:') return 'uses http:// — use the https:// address';
  return `has an unexpected "${u.protocol}" address`;
}
const fmtHour = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Check a full set of data. Pure: pass the data in, get the findings back.
 * Each finding is a plain sentence naming the file, the location and the field.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateData({
  locations, COORDS = {}, TYPE_FULL = {}, TYPE_LOGO = {}, LOC_LOGO = {},
  HOURS = {}, MGMT = {}, ROSTER_CHANGES = [], GROWTH = {}, today = todayET(),
}) {
  const errors = [], warnings = [];

  if (!Array.isArray(locations)) {
    errors.push('locations.js: `locations` must be a list [ … ] of locations.');
    return { errors, warnings };
  }

  const byNum = new Map();
  const label = l => {
    const n = isNum(l?.num) ? `#${l.num}` : '(location with no number)';
    return isNonEmptyStr(l?.name) ? `${n} ${l.name}` : n;
  };
  // "#13 Route 355" for a number that exists, plain "#99" otherwise.
  const ref = num => byNum.has(+num) ? label(byNum.get(+num)) : `#${num}`;
  const closed = l => l.status === 'Permanently Closed';

  // ── locations.js ───────────────────────────────────────────
  locations.forEach((l, i) => {
    const where = `locations.js ${isObj(l) ? label(l) : `entry ${i + 1}`}`;
    const err = msg => errors.push(`${where} — ${msg}`);
    const warn = msg => warnings.push(`${where} — ${msg}`);
    if (!isObj(l)) return err('is not a { … } entry.');

    if (!Number.isInteger(l.num) || l.num < 1) err(`num: must be a whole number (found ${JSON.stringify(l.num)}).`);
    else if (byNum.has(l.num)) err(`num: ${l.num} is used twice (also ${label(byNum.get(l.num))}). Every location needs its own number.`);
    else byNum.set(l.num, l);

    for (const f of ['name', 'city']) if (!isNonEmptyStr(l[f])) err(`${f}: is missing or empty.`);
    if (!isStr(l.state) || !/^[A-Z]{2}$/.test(l.state)) err(`state: must be a two-letter code like "MD" (found ${JSON.stringify(l.state)}).`);
    if (!(l.type in TYPE_FULL)) err(`type: "${l.type}" is not a brand in brands.js (expected one of ${Object.keys(TYPE_FULL).join(', ')}).`);
    else if (!(l.type in TYPE_LOGO)) warn(`type: brand "${l.type}" has no logo in brands.js TYPE_LOGO.`);
    if (!isStr(l.opened)) err('opened: must be text, e.g. "October 1987", or "" if not open yet.');
    if (l.addr !== undefined && !isStr(l.addr)) err('addr: must be text.');

    // Opening date: `opened` is what people read, `ts` is what sorting, the
    // "years open" badge and the ratings job use. They must agree.
    if (!tsIsValid(l.ts)) {
      err(`ts: ${JSON.stringify(l.ts)} is not a real date written YYYYMMDD (e.g. 20251117), or ${NOT_OPEN_TS} if not open yet.`);
    } else if (isStr(l.opened)) {
      if (l.opened && l.ts === NOT_OPEN_TS) {
        err(`ts: still ${NOT_OPEN_TS} ("not open yet") but opened is "${l.opened}". Set ts to the opening date (YYYYMMDD) so it sorts, shows its age and gets a Google rating.`);
      } else if (!l.opened && l.ts !== NOT_OPEN_TS) {
        warn(`opened: is empty (shows as Coming Soon) but ts is ${l.ts}. Fill in opened, or set ts back to ${NOT_OPEN_TS}.`);
      } else if (l.opened) {
        const y = String(Math.floor(l.ts / 10000)), m = MONTHS[Math.floor(l.ts / 100) % 100 - 1];
        if (!l.opened.includes(y) || !l.opened.includes(m)) warn(`opened: "${l.opened}" does not match ts ${l.ts} (${m} ${y}).`);
      }
    }
    if (l.opened && l.hidden) warn('hidden: is set although the location has an opening date, so it stays off the grid and gets no Google rating.');
    if (l.opened && l.target) warn(`target: "${l.target}" is left over from before opening — it can be removed.`);

    if (l.status !== undefined && !STATUSES.includes(l.status)) warn(`status: "${l.status}" is not one the gallery shows (${STATUSES.join(', ')}).`);
    if (l.hidden !== undefined && typeof l.hidden !== 'boolean') err('hidden: must be true or false.');
    if (l.approx !== undefined && typeof l.approx !== 'boolean') err('approx: must be true or false.');
    if (l.numOverride !== undefined && (!Number.isInteger(l.numOverride) || l.numOverride < 1)) err('numOverride: must be a whole number.');

    for (const f of ['render3d', 'cam']) {
      if (l[f] === undefined || l[f] === '') continue;
      const p = isStr(l[f]) ? urlProblem(l[f]) : 'must be text';
      if (!p) continue;
      if (p.startsWith('uses http:')) warn(`${f}: ${p}.`); else err(`${f}: ${p}.`);
    }

    // Addresses drive directions and a new store's first Google lookup.
    if (isNonEmptyStr(l.addr) && !l.hidden && !closed(l)) {
      const a = l.addr.trim();
      if (!/,\s*[A-Z]{2}\b/.test(a)) warn(`addr: "${a}" has no state — directions will add "${l.city}, ${l.state}".`);
      else if (!/\b\d{5}(-\d{4})?$/.test(a)) warn(`addr: "${a}" has no ZIP code.`);
    } else if (!l.addr && l.opened && !closed(l)) {
      warn('addr: is empty — directions fall back to the map pin.');
    }
  });

  // numOverride must not collide with another location's real number.
  for (const l of byNum.values()) {
    if (Number.isInteger(l.numOverride) && l.numOverride !== l.num && byNum.has(l.numOverride)) {
      warnings.push(`locations.js ${label(l)} — numOverride: ${l.numOverride} is also the number of ${label(byNum.get(l.numOverride))}; links and photos for the two will clash.`);
    }
  }

  // ── COORDS (map pins) ──────────────────────────────────────
  if (!isObj(COORDS)) errors.push('locations.js: COORDS must be a { num: [lat, lng] } table.');
  else {
    for (const [k, c] of Object.entries(COORDS)) {
      const where = `locations.js COORDS ${ref(k)}`;
      if (!byNum.has(+k)) { errors.push(`${where} — there is no location #${k} in the list. Typo in the number?`); continue; }
      if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1])) {
        errors.push(`${where} — must be [latitude, longitude], two numbers (found ${JSON.stringify(c)}).`);
        continue;
      }
      const [lat, lng] = c;
      if (lat < REGION.latMin || lat > REGION.latMax || lng < REGION.lngMin || lng > REGION.lngMax) {
        const swapped = lng >= REGION.latMin && lng <= REGION.latMax && lat >= REGION.lngMin && lat <= REGION.lngMax;
        errors.push(`${where} — [${lat}, ${lng}] is outside MD/PA/WV/VA/DE${swapped ? ' (latitude and longitude look swapped)' : ''}. The pin would land in the wrong place.`);
      }
    }
    for (const l of byNum.values()) {
      if (COORDS[l.num] || l.approx) continue;
      if (!l.hidden && !closed(l)) errors.push(`locations.js ${label(l)} — COORDS: has no map position, so it would be missing from the map. Add ${l.num}:[lat, lng] to COORDS.`);
      else if (l.hidden) warnings.push(`locations.js ${label(l)} — COORDS: has no map position, so it will not show as a coming-soon pin.`);
    }
  }

  // ── brands.js ──────────────────────────────────────────────
  for (const t of Object.keys(TYPE_FULL)) if (!isNonEmptyStr(TYPE_FULL[t])) errors.push(`brands.js TYPE_FULL ${t} — needs the brand's full name.`);
  for (const t of Object.keys(TYPE_LOGO)) if (!(t in TYPE_FULL)) warnings.push(`brands.js TYPE_LOGO ${t} — there is no brand "${t}" in TYPE_FULL.`);
  for (const k of Object.keys(LOC_LOGO)) if (!byNum.has(+k)) errors.push(`brands.js LOC_LOGO #${k} — there is no location #${k} in the list.`);

  // ── hours.js ───────────────────────────────────────────────
  if (!isObj(HOURS)) errors.push('hours.js: HOURS must be a { num: { p, d } } table.');
  else {
    for (const [k, h] of Object.entries(HOURS)) {
      const where = `hours.js ${ref(k)}`;
      if (!byNum.has(+k)) { errors.push(`${where} — there is no location #${k} in the list. Typo in the number?`); continue; }
      if (!isObj(h)) { errors.push(`${where} — must be { p: 'phone', d: [ …7 days… ] }.`); continue; }
      if (h.p !== undefined && h.p !== null && !(isStr(h.p) && /^\d{3}-\d{3}-\d{4}$/.test(h.p))) {
        warnings.push(`${where} — p: phone "${h.p}" is not written like 301-555-1234.`);
      }
      if (!Array.isArray(h.d) || h.d.length !== 7) {
        errors.push(`${where} — d: needs exactly 7 days, Sunday first (found ${Array.isArray(h.d) ? h.d.length : 'none'}).`);
        continue;
      }
      h.d.forEach((day, i) => {
        if (day === null) return;
        if (!Array.isArray(day) || day.length !== 2 || !isNum(day[0]) || !isNum(day[1])) {
          errors.push(`${where} — d: ${DAYS[i]} must be [open, close] in 24-hour time (e.g. [8, 19]) or null if closed (found ${JSON.stringify(day)}).`);
        } else if (day[0] < 0 || day[1] > 24 || day[0] >= day[1]) {
          errors.push(`${where} — d: ${DAYS[i]} opens at ${fmtHour(day[0])} and closes at ${fmtHour(day[1])}. Opening must be before closing, within 0–24.`);
        }
      });
      if (closed(byNum.get(+k))) warnings.push(`${where} — is permanently closed; these hours are no longer shown and can be removed.`);
    }
    for (const l of byNum.values()) {
      if (l.opened && !l.hidden && !closed(l) && !HOURS[l.num]) warnings.push(`hours.js ${label(l)} — has no hours or phone number yet.`);
    }
  }

  // ── team.js MGMT ───────────────────────────────────────────
  if (!isObj(MGMT)) errors.push('team.js: MGMT must be a { num: { mp, dm, lm, am, sup } } table.');
  else {
    for (const [k, m] of Object.entries(MGMT)) {
      const where = `team.js MGMT ${ref(k)}`;
      if (!byNum.has(+k)) { errors.push(`${where} — there is no location #${k} in the list. Typo in the number?`); continue; }
      if (!isObj(m)) { errors.push(`${where} — must be { mp, dm, lm, am:[…], sup:[…] }.`); continue; }
      for (const [role, v] of Object.entries(m)) {
        if (!ROLES.includes(role)) { warnings.push(`${where} — "${role}" is not a role the Team panel shows (${ROLES.join(', ')}).`); continue; }
        const ok = v === null || isStr(v) || (Array.isArray(v) && v.every(isStr));
        if (!ok) errors.push(`${where} — ${role}: must be a name in quotes, a list of names, or null (found ${JSON.stringify(v)}).`);
      }
      if (closed(byNum.get(+k))) warnings.push(`${where} — is permanently closed but still has a roster.`);
    }
  }

  // ── team.js ROSTER_CHANGES ─────────────────────────────────
  if (!Array.isArray(ROSTER_CHANGES)) errors.push('team.js: ROSTER_CHANGES must be a list [ … ].');
  else {
    ROSTER_CHANGES.forEach((c, i) => {
      const where = `team.js ROSTER_CHANGES entry ${i + 1}${isObj(c) && c.add ? ` (${c.add})` : ''}`;
      if (!isObj(c)) return errors.push(`${where} — must be { from: 'YYYY-MM-DD', num, role, add }.`);
      if (!isoIsValid(c.from)) errors.push(`${where} — from: "${c.from}" is not a real date written YYYY-MM-DD.`);
      if (!byNum.has(c.num)) errors.push(`${where} — num: there is no location #${c.num} in the list.`);
      else if (isObj(MGMT) && !MGMT[c.num]) errors.push(`${where} — num: ${ref(c.num)} has no roster in MGMT, so this change would be silently ignored.`);
      if (!ROLES.includes(c.role)) errors.push(`${where} — role: "${c.role}" must be one of ${ROLES.join(', ')}.`);
      if (!isNonEmptyStr(c.add)) errors.push(`${where} — add: needs the person's name.`);
      if (isoIsValid(c.from) && c.from <= today) {
        warnings.push(`${where} — took effect ${c.from}. Fold it into MGMT for ${ref(c.num)} and delete this entry.`);
      }
    });
  }

  // ── growth.js ──────────────────────────────────────────────
  if (!isObj(GROWTH)) errors.push('growth.js: GROWTH must be a { year: [cars, revenue] } table.');
  else {
    for (const [y, v] of Object.entries(GROWTH)) {
      if (!/^\d{4}$/.test(y)) errors.push(`growth.js ${y} — the year must be four digits.`);
      if (!Array.isArray(v) || v.length !== 2 || !v.every(n => isNum(n) && n >= 0)) {
        errors.push(`growth.js ${y} — must be [cars serviced, annual revenue], two plain numbers (found ${JSON.stringify(v)}).`);
      }
    }
  }

  return { errors, warnings };
}

/** Check the data files in this folder. */
export function validateAll(options = {}) {
  return validateData({ locations, COORDS, TYPE_FULL, TYPE_LOGO, LOC_LOGO, HOURS, MGMT, ROSTER_CHANGES, GROWTH, ...options });
}

/** Plain-text report, for the build log and the command line. */
export function formatReport({ errors, warnings }) {
  const lines = [];
  if (errors.length) lines.push(`${errors.length} data error${errors.length > 1 ? 's' : ''} — fix before deploying:`, ...errors.map(e => `  ✗ ${e}`));
  if (warnings.length) lines.push(`${warnings.length} data warning${warnings.length > 1 ? 's' : ''} (build continues):`, ...warnings.map(w => `  ! ${w}`));
  if (!lines.length) lines.push('Data check: all good.');
  return lines.join('\n');
}

// `node src/data/validate.js` → print the report; exit 1 if there are errors.
if (typeof process !== 'undefined' && /validate\.js$/.test(process.argv?.[1] || '')) {
  const result = validateAll();
  console.log(formatReport(result));
  process.exitCode = result.errors.length ? 1 : 0;
}
