import { locations, COORDS } from '../data/locations.js';
import { TYPE_FULL, TYPE_LOGO, LOC_LOGO } from '../data/brands.js';
import { MGMT, ROSTER_CHANGES } from '../data/team.js';
import { HOURS } from '../data/hours.js';
import { GROWTH } from '../data/growth.js';
import { ic } from '../lib/icons.js';

// ══ DATA ══════════════════════════════════════════════════


// Merge in any custom locations added via the admin panel
(function() {
  try {
    const custom = JSON.parse(localStorage.getItem('wlr_custom_locs') || '[]');
    custom.forEach(loc => {
      if (!locations.find(l => l.num === loc.num)) locations.push(loc);
    });
    locations.sort((a,b) => a.num - b.num);
  } catch(e) {}
})();

// Geocoded from official washluberepair.com location pages (Census + OSM geocoders).
// #4 shares the #1 campus (1395 W Patrick St) — nudged east so both pins stay clickable.








function applyRosterChanges(onDate) {
  const d = nowET();
  const today = onDate ||
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  ROSTER_CHANGES.forEach(c => {
    if (today < c.from || !MGMT[c.num]) return;
    const list = MGMT[c.num][c.role] = [].concat(MGMT[c.num][c.role] || []);
    if (c.add && !list.includes(c.add)) list.push(c.add);
  });
}
applyRosterChanges();

const PHOTO_PREFIX = 'wlr_photo_';
const INFO_PREFIX  = 'wlr_info_';
const NOW_YEAR = new Date().getFullYear();

function pad(n) { return String(n).padStart(2,'0'); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }


const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Current time in the locations' timezone (Eastern), regardless of viewer TZ
function nowET() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })); }

function fmtHr(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  let hr = Math.floor(h) % 12; if (hr === 0) hr = 12;
  const min = Math.round((h - Math.floor(h)) * 60);
  return min ? `${hr}:${String(min).padStart(2,'0')} ${ap}` : `${hr} ${ap}`;
}

/* ══ HOLIDAY SCHEDULE ═══════════════════════════════════════
   Company-wide, confirmed by Brice in September 2026: closed all day on the
   seven holidays below, and closing at 4pm on the two eves. Dates are derived
   per year rather than listed, so this never needs maintaining — Easter,
   Memorial Day, Labor Day and Thanksgiving all move.

   Before this existed the app read open/closed purely off the weekly
   schedule, so it showed every location Open on Thanksgiving. */
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function nthDow(y, month, dow, n) {          // n-th <dow> of the month
  const first = new Date(y, month, 1);
  return new Date(y, month, 1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7);
}
function lastDow(y, month, dow) {            // last <dow> of the month
  const last = new Date(y, month + 1, 0);
  return new Date(y, month, last.getDate() - ((last.getDay() - dow + 7) % 7));
}
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const HOLIDAY_CACHE = {};
function holidayCalendar(y) {
  if (HOLIDAY_CACHE[y]) return HOLIDAY_CACHE[y];
  const cal = {};
  const put = (d, v) => { cal[dayKey(d)] = v; };
  put(new Date(y, 0, 1),    { name: "New Year's Day",  closed: true });
  put(easterSunday(y),      { name: 'Easter',          closed: true });
  put(lastDow(y, 4, 1),     { name: 'Memorial Day',    closed: true });
  put(new Date(y, 6, 4),    { name: 'July 4th',        closed: true });
  put(nthDow(y, 8, 1, 1),   { name: 'Labor Day',       closed: true });
  put(nthDow(y, 10, 4, 4),  { name: 'Thanksgiving',    closed: true });
  put(new Date(y, 11, 25),  { name: 'Christmas',       closed: true });
  put(new Date(y, 11, 24),  { name: 'Christmas Eve',   closeAt: 16 });
  put(new Date(y, 11, 31),  { name: "New Year's Eve",  closeAt: 16 });
  return (HOLIDAY_CACHE[y] = cal);
}
function holidayOn(d) { return holidayCalendar(d.getFullYear())[dayKey(d)] || null; }

/* Holidays falling in the next `days` days, for the expanded hours panel. */
function upcomingHolidays(days = 14) {
  const out = [], n = nowET();
  for (let i = 0; i <= days; i++) {
    const d = new Date(n); d.setDate(d.getDate() + i);
    const h = holidayOn(d);
    if (h) out.push({ ...h, when: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAY_ABBR[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}` });
  }
  return out;
}

// Live open/closed status for a location number (null if no hours on file)
function hoursStatus(num) {
  if (isPermClosed(num)) return null;
  const H = HOURS[num]; if (!H) return null;
  const n = nowET(), day = n.getDay(), cur = n.getHours() + n.getMinutes() / 60;

  const hol = holidayOn(n);
  if (hol && hol.closed) return { open: false, detail: `Closed for ${hol.name}`, holiday: hol.name };

  // An eve closes early, so cap today's closing time rather than replacing it.
  let today = H.d[day];
  if (today && hol && hol.closeAt) today = [today[0], Math.min(today[1], hol.closeAt)];

  if (today && cur >= today[0] && cur < today[1]) {
    return { open: true, detail: `Closes ${fmtHr(today[1])}`, holiday: hol ? hol.name : null };
  }
  if (today && cur < today[0]) return { open: false, detail: `Opens ${fmtHr(today[0])}` };

  // Look ahead by real dates, skipping any day the company is closed.
  for (let i = 1; i <= 8; i++) {
    const dt = new Date(n); dt.setDate(dt.getDate() + i);
    const h2 = holidayOn(dt);
    if (h2 && h2.closed) continue;
    const slot = H.d[dt.getDay()];
    if (slot) return { open: false, detail: `Opens ${fmtHr(slot[0])} ${i === 1 ? 'tomorrow' : DAY_ABBR[dt.getDay()]}` };
  }
  return { open: false, detail: 'Closed' };
}

// Group the week (Mon-first) into ranges of identical hours for display
function formatWeek(num) {
  const H = HOURS[num]; if (!H) return [];
  const order = [1,2,3,4,5,6,0]; // Mon..Sun
  const key = s => s ? `${s[0]}-${s[1]}` : 'x';
  const rows = []; let i = 0;
  while (i < order.length) {
    const slot = H.d[order[i]]; let j = i;
    while (j + 1 < order.length && key(H.d[order[j+1]]) === key(slot)) j++;
    const lbl = i === j ? DAY_ABBR[order[i]] : `${DAY_ABBR[order[i]]}–${DAY_ABBR[order[j]]}`;
    rows.push({ label: lbl, time: slot ? `${fmtHr(slot[0])}–${fmtHr(slot[1])}` : 'Closed' });
    i = j + 1;
  }
  return rows;
}

function hoursBlockHtml(num) {
  const st = hoursStatus(num); if (!st) return '';
  const week = formatWeek(num).map(r =>
    `<div class="hw-row"><span class="hw-day">${r.label}</span><span class="hw-time${r.time==='Closed'?' hw-closed':''}">${r.time}</span></div>`).join('')
    + upcomingHolidays().map(h =>
    `<div class="hw-row hw-hol"><span class="hw-day">${esc(h.name)}</span><span class="hw-time${h.closed?' hw-closed':''}">${h.closed ? 'Closed' : `Closes ${fmtHr(h.closeAt)}`}</span></div>`).join('');
  return `
    <div class="loc-hours">
      <button class="hrs-toggle" onclick="event.stopPropagation(); this.parentElement.classList.toggle('open')">
        <span class="hrs-dot ${st.open ? 'is-open' : 'is-closed'}"></span>
        <span class="hrs-state ${st.open ? 'is-open' : 'is-closed'}">${st.open ? 'Open' : 'Closed'}</span>
        <span class="hrs-detail">${st.detail}</span>
        <span class="hrs-caret">${ic('chevron-down')}</span>
      </button>
      <div class="hrs-week">${week}</div>
    </div>`;
}

// A stalled image (weak signal) used to leave a permanent "no photo" tile until
// reload. Retry once before giving up.
/* Content fingerprint per bundled photo, rewritten by tools/build-images.py.
   Appended to every photo URL so a replaced photo gets a new address: without
   it, phones and home-screen installs kept showing the old copy of a photo
   that had been swapped out under the same filename. */
const PHOTO_VER = {"loc-01/01":"b85f6f98","loc-01/02":"5f96837f","loc-02/01":"a49b9250","loc-02/02":"b9a5fc7a","loc-03/01":"a6976324","loc-03/02":"edaaacb5","loc-04/01":"7ff5ba2f","loc-04/02":"5fdb2aa0","loc-05/01":"591e7542","loc-05/02":"8300b9e9","loc-06/01":"187e2931","loc-06/02":"85cffa93","loc-07/01":"6c1fcb34","loc-07/02":"7fae08df","loc-08/01":"83324b7a","loc-08/02":"b0c1a581","loc-09/01":"f9383053","loc-09/02":"73430f57","loc-10/01":"46524613","loc-10/02":"2ae6186d","loc-11/01":"75616254","loc-11/02":"a8a068af","loc-12/01":"aa6bcff4","loc-12/02":"41e4609d","loc-13/01":"bcde85d2","loc-13/02":"e25d7dfc","loc-14/01":"54ea8a9d","loc-14/02":"3c7e104a","loc-15/01":"218fc9ff","loc-15/02":"434834ce","loc-16/01":"0ca2c529","loc-16/02":"145f4c57","loc-17/01":"dd44b01b","loc-17/02":"11f7dbf7","loc-18/01":"997b5022","loc-18/02":"8b45eecd","loc-19/01":"cc1d0041","loc-19/02":"41d2f63d","loc-20/01":"5588855c","loc-20/02":"d2be1464","loc-21/01":"f2104328","loc-21/02":"158bb0b0","loc-22/01":"7bfa4447","loc-22/02":"c1587e31","loc-23/01":"5637e0e9","loc-23/02":"cf76cee2","loc-24/01":"0f519069","loc-24/02":"675352a5","loc-25/01":"a1d8126c","loc-25/02":"0c8b764a","loc-26/01":"1b2c0c3a","loc-26/02":"1de6291b","loc-27/01":"848f23cb","loc-27/02":"12dea048","loc-28/01":"f8fd1243","loc-28/02":"cd69f0a4","loc-29/01":"4907ac3c","loc-29/02":"27e664ef","loc-30/01":"dcdb7448","loc-30/02":"588ad5f0","loc-31/01":"f0c99be6","loc-31/02":"7e2be0ca","loc-32/01":"d9de45e9","loc-32/02":"67141193","loc-33/01":"b2201724","loc-33/02":"2b558feb","loc-34/01":"658a22f2","loc-34/02":"140121e6","loc-35/01":"8426dd5b","loc-35/02":"730744b6","loc-36/01":"793d2169","loc-36/02":"aa142009","loc-37/01":"7a7c8852","loc-37/02":"e460a09f","loc-38/01":"d1fabc6b","loc-38/02":"27e664ef","loc-39/01":"a2910976","loc-39/02":"588ad5f0","loc-40/01":"4907ac3c","loc-40/02":"140121e6","loc-41/01":"dcdb7448","loc-41/02":"aa142009","loc-42/01":"658a22f2","loc-42/02":"e460a09f","loc-43/01":"793d2169","loc-43/02":"27e664ef","loc-44/01":"7a7c8852","loc-44/02":"588ad5f0","loc-45/01":"d1fabc6b","loc-45/02":"140121e6"};
function verQ(path) {
  const m = /images\/loc-(\d+)\/(0[12])/.exec(path);
  const v = m && PHOTO_VER[`loc-${m[1]}/${m[2]}`];
  return v ? `${path}?v=${v}` : path;
}

/* Rendered width of one card photo across the grid's breakpoints — two photos
   per card, one card column under 560px, two under 1100px, then a fixed max. */
const PHOTO_SIZES = '(max-width: 560px) 46vw, (max-width: 1100px) 23vw, 220px';

/* AVIF/WebP tiers for a bundled location photo. The 1920px JPEG stays the
   <img> src, so it remains the floor for anything that supports neither. */
function photoSources(jpgPath) {
  const base = jpgPath.replace(/\.jpg$/i, '');
  const v = ext => `${verQ(`${base}-480.${ext}`)} 480w, ${verQ(`${base}-960.${ext}`)} 960w`;
  return `<source type="image/avif" srcset="${v('avif')}" sizes="${PHOTO_SIZES}">` +
         `<source type="image/webp" srcset="${v('webp')}" sizes="${PHOTO_SIZES}">`;
}

function photoOk(el) {
  el.style.display = '';
  // .ph is a sibling of <picture>, not of the <img>, so walk to the slot.
  const slot = el.closest('.photo-slot');
  const ph = slot && slot.querySelector('.ph');
  if (ph) ph.style.display = 'none';
}
function photoErr(el) {
  if (!el.dataset.retried) {
    el.dataset.retried = '1';
    // Drop the modern <source> tiers so the retry lands on the JPEG floor —
    // setting .src alone would not dislodge an already-chosen AVIF/WebP.
    const pic = el.closest('picture');
    if (pic) pic.querySelectorAll('source').forEach(n => n.remove());
    const base = verQ(el.src.split('?')[0]);
    setTimeout(() => { el.src = base + (base.includes('?') ? '&' : '?') + 'r=1'; }, 800);
    return;
  }
  el.style.display = 'none';
  const slot = el.closest('.photo-slot');
  const ph = slot && slot.querySelector('.ph');
  if (ph) ph.style.display = 'flex';
}

function callBtnHtml(num) {
  if (isPermClosed(num)) return '';
  const H = HOURS[num]; if (!H || !H.p) return '';
  return `<a class="loc-call" href="tel:${H.p.replace(/[^0-9]/g,'')}" onclick="event.stopPropagation()">${ic('phone')}Call</a>`;
}

// Live Google rating chip — links to the location's Google Maps page via its
// Place ID (captured in ratings.json). Empty until ratings.json is populated.
// Uses Google's documented Maps URL (api=1 + query_place_id): the old
// /maps/place/?q=place_id:… form only worked on the website — the Google Maps
// iPhone app took it as typed text and handed it to Google search.
function ratingHtml(num, compact) {
  const R = RATINGS[num]; if (!R || typeof R.r !== 'number') return '';
  const count = R.n ? `<span class="rate-count">(${R.n.toLocaleString()})</span>` : '';
  const loc = locations.find(l => l.num === num);
  const query = [R.name || 'WLR Automotive Group', loc && dirDest(loc)].filter(Boolean).join(', ');
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` +
              (R.id ? `&query_place_id=${encodeURIComponent(R.id)}` : '');
  const go = compact ? '' : `<span class="rate-go">${ic('arrow-ur')}</span>`;
  return `<a class="loc-rating${compact ? ' compact' : ''}" href="${url}" target="_blank" rel="noopener"
    onclick="event.stopPropagation()" title="${R.r}★ from ${(R.n||0).toLocaleString()} Google reviews — open in Google Maps">
    <span class="rate-star">${ic('star','ico--fill')}</span><span class="rate-num">${R.r.toFixed(1)}</span>${count}${go}</a>`;
}

// ── ANIMATION HELPERS ──────────────────────────────────────
function setupCardAnimations() {
  const cards = [...document.querySelectorAll('.card')];
  if (!cards.length) return;
  cards.forEach(c => c.classList.add('card-anim'));
  if (!('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('card-in'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('card-in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -10px 0px' });
  cards.forEach((card, i) => {
    card.style.setProperty('--card-delay', `${Math.min(i % 7, 5) * 58}ms`);
    obs.observe(card);
  });
}

function renderWithTransition() {
  const grid = document.getElementById('grid');
  grid.classList.add('fading');
  setTimeout(() => {
    render();
    requestAnimationFrame(() => grid.classList.remove('fading'));
  }, 130);
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

// Reads from in-memory cache (populated at startup)
function getPhotoSrc(num, slot) {
  return photoCache[`${PHOTO_PREFIX}loc${pad(num)}_${slot}`] || null;
}
function getLocInfo(num) {
  try {
    const raw = localStorage.getItem(`${INFO_PREFIX}loc${pad(num)}`);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}
// Returns false if location is hidden and not yet published via admin
function isLocVisible(baseLoc) {
  if (!baseLoc.hidden) return true;
  return getLocInfo(baseLoc.num).published === true;
}

/* Closed sites stay on the grid for the record, but drop out of anything that
   implies they're operating: live hours, Call, the location count and the tour. */
function isPermClosed(num) {
  const base = locations.find(l => l.num === num);
  return !!base && ({ ...base, ...getLocInfo(num) }).status === 'Permanently Closed';
}

function yearsOpen(ts) {
  if (!ts || ts > 20991200) return null;
  const yr = Math.floor(ts / 10000);
  return NOW_YEAR - yr;
}

/* What we hand a navigation app. A street address routes to the right
   driveway far more reliably than a geocoded point, so prefer it; fall back to
   coordinates, then to a name search for sites with neither. */
function dirDest(loc) {
  if (loc.addr) {
    const a = loc.addr.trim().replace(/[,\s]+$/, '');
    // A stored address that already carries a state is a complete postal
    // address — use it verbatim. Appending the branch's city broke sites whose
    // postal town differs from their name (#16 Shrewsbury sits in New Freedom,
    // #24 West York in York).
    if (/,\s*[A-Z]{2}\b/.test(a)) return a;
    return `${a}, ${loc.city}, ${loc.state}`;
  }
  const c = COORDS[loc.num];
  if (c && !loc.approx) return `${c[0]},${c[1]}`;
  return `${TYPE_FULL[loc.type]} ${loc.name} ${loc.city} ${loc.state}`;
}

/* Universal links, so each one hands off to the installed app where there is
   one and falls back to that provider's website where there isn't. */
function dirUrls(dest) {
  const q = encodeURIComponent(dest);
  // Most sites route by geocoded point rather than street address, and Waze
  // wants those as ll= — passing coordinates through q= makes it search for
  // them as text instead of navigating there.
  const isLatLng = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(dest);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple:  `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    waze:   isLatLng
      ? `https://waze.com/ul?ll=${q}&navigate=yes`
      : `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

function dirBtn(loc, cls) {
  return `<button class="${cls}" type="button" aria-haspopup="menu" aria-expanded="false"` +
         ` data-dest="${esc(dirDest(loc))}"` +
         ` onclick="event.stopPropagation(); openDirMenu(this)">${ic('pin')}Directions</button>`;
}

// ══ PER-LOCATION LINKS ═════════════════════════════════════
// Shared links point at l/NN.html — a tiny stub carrying that location's own
// Open Graph tags, so a texted link previews with its photo and name before
// bouncing into the app. tools/build-location-pages.py generates them.

function locShareUrl(num) {
  return new URL(`l/${pad(num)}.html`, document.baseURI).href;
}

let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  // setTimeout rather than rAF: frames do not run in a backgrounded tab, and a
  // toast that never un-hides is worse than one that appears a frame late.
  setTimeout(() => t.classList.add('show'), 20);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function shareLoc(num) {
  const base = locations.find(l => l.num === num);
  if (!base) return;
  const loc = { ...base, ...getLocInfo(num) };
  const url = locShareUrl(loc.numOverride || num);
  const title = `#${pad(loc.numOverride || num)} ${loc.name} — WLR Automotive Group`;
  // The native sheet is the point on a phone: it puts Messages one tap away.
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user dismissed
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch { window.prompt('Copy this link', url); }
}

/* The card a ?loc= link is pointing at. Held across re-renders because the
   ratings fetch rebuilds the grid a moment after boot, which would otherwise
   discard the reveal and highlight. Cleared once things settle. */
let pendingFocus = null, pendingFocusScrolled = false;
/* Same idea for a ?loc= pointing at a future site: markers are rebuilt when
   the basemap finishes loading, which would drop a popup opened before that. */
let pendingMapFocus = null;

function applyPendingMapFocus() {
  if (pendingMapFocus == null || !mapInstance) return;
  const m = mapMarkers.get(pendingMapFocus);
  if (!m) return;
  if (!m.getPopup().isOpen()) m.togglePopup();
  mapInstance.flyTo({ center: ll(pendingMapFocus), zoom: 15, pitch: 55, duration: 1200 });
  setTimeout(() => { pendingMapFocus = null; }, 4000);
}

function applyPendingFocus() {
  if (pendingFocus == null) return;
  const card = document.querySelector(`.card[data-num="${pendingFocus}"]`);
  if (!card) return;
  card.classList.remove('card-anim');           // never leave a linked card invisible
  card.classList.add('card-focus');
  if (pendingFocusScrolled) return;             // only steal the scroll once
  pendingFocusScrolled = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    pendingFocus = null;
    card.classList.remove('card-focus');
  }, 5000);
}

/* Land on a specific location from ?loc=NN. Open sites live in the grid;
   future sites only exist on the map, so those open their pin instead. */
function focusLocFromUrl() {
  const raw = new URLSearchParams(location.search).get('loc');
  const num = parseInt(raw, 10);
  if (!num) return;
  const loc = locations.find(l => l.num === num || l.numOverride === num);
  if (!loc) return;

  if (loc.hidden) {
    showComingSoon = true;
    pendingMapFocus = loc.num;
    setView('map');            // updateMapMarkers() applies it, now and on rebuild
    return;
  }

  setView('grid');
  // Clear any filter that would hide the linked card.
  activeFilter = 'ALL'; searchQuery = ''; activeState = '';
  const input = document.querySelector('.search-wrap input'); if (input) input.value = '';
  pendingFocus = loc.num; pendingFocusScrolled = false;
  render();          // render() applies the pending focus, and so will re-renders
}

// ══ DIRECTIONS APP PICKER ══════════════════════════════════
let dirMenuEl = null, dirMenuBtn = null;

function closeDirMenu() {
  if (!dirMenuEl) return;
  dirMenuEl.hidden = true;
  if (dirMenuBtn) dirMenuBtn.setAttribute('aria-expanded', 'false');
  dirMenuBtn = null;
}

function openDirMenu(btn) {
  if (!dirMenuEl) {
    dirMenuEl = document.createElement('div');
    dirMenuEl.className = 'dir-menu';
    dirMenuEl.setAttribute('role', 'menu');
    dirMenuEl.hidden = true;
    document.body.appendChild(dirMenuEl);
    // Any of these should dismiss it rather than leave it floating.
    document.addEventListener('pointerdown', e => {
      if (dirMenuEl && !dirMenuEl.hidden && !e.target.closest('.dir-menu') && e.target !== dirMenuBtn) closeDirMenu();
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDirMenu(); });
    addEventListener('scroll', closeDirMenu, true);
    addEventListener('resize', closeDirMenu);
  }
  if (dirMenuBtn === btn && !dirMenuEl.hidden) return closeDirMenu();   // tapping again closes

  const u = dirUrls(btn.dataset.dest || '');
  dirMenuEl.innerHTML =
    `<div class="dir-menu-head">Open directions in</div>` +
    `<a role="menuitem" href="${u.google}" target="_blank" rel="noopener">${ic('pin')}Google Maps</a>` +
    `<a role="menuitem" href="${u.apple}"  target="_blank" rel="noopener">${ic('map')}Apple Maps</a>` +
    `<a role="menuitem" href="${u.waze}"   target="_blank" rel="noopener">${ic('car')}Waze</a>`;
  dirMenuEl.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDirMenu));

  dirMenuEl.hidden = false;
  dirMenuBtn = btn;
  btn.setAttribute('aria-expanded', 'true');

  // Anchor under the button, flipping up and clamping so it always stays on screen.
  const b = btn.getBoundingClientRect(), m = dirMenuEl.getBoundingClientRect();
  const gap = 6;
  let top = b.bottom + gap;
  if (top + m.height > innerHeight - 8) top = Math.max(8, b.top - m.height - gap);
  let left = Math.min(Math.max(8, b.left), innerWidth - m.width - 8);
  dirMenuEl.style.top = top + 'px';
  dirMenuEl.style.left = left + 'px';
}

// ══ HERO COUNTER ANIMATION ═════════════════════════════════
function animateNum(el, target, dur) {
  let s = 0; const step = target / (dur / 16);
  const t = setInterval(() => {
    s = Math.min(s + step, target);
    el.textContent = Math.floor(s);
    if (s >= target) clearInterval(t);
  }, 16);
}
window.addEventListener('load', () => {
  const yrs = NOW_YEAR - 1987;
  document.getElementById('statYears').textContent = yrs;
  animateNum(document.getElementById('statLocs'),   locations.filter(l => isLocVisible(l) && !isPermClosed(l.num)).length, 800);
  animateNum(document.getElementById('statYears'),  yrs, 1200);
  animateNum(document.getElementById('statStates'), 3, 600);
});

// ══ CARD BUILDER ══════════════════════════════════════════
function buildCard(baseLoc) {
  const overrides = getLocInfo(baseLoc.num);
  const loc = { ...baseLoc, ...overrides };
  const displayNum = loc.numOverride || loc.num;
  const yrs    = yearsOpen(loc.ts);
  const yrsBadge = yrs === null
    ? ''
    : yrs <= 2
      ? `<span class="years-badge yb-new">New!</span>`
      : `<span class="years-badge yb-old">${yrs} yrs</span>`;

  const statusMap = {
    'Coming Soon':         { icon:'clock', color:'var(--tase-c)' },
    'Temporarily Closed':  { icon:'alert', color:'#fca044' },
    'Permanently Closed':  { icon:'ban',   color:'rgba(255,80,80,0.85)' },
  };
  const statusInfo = statusMap[loc.status] || null;
  const statusBadge = statusInfo
    ? `<span class="loc-status" style="color:${statusInfo.color}">${ic(statusInfo.icon)}${loc.status}</span>`
    : '';

  const opened = loc.opened
    ? `<span class="loc-opened">Est. ${loc.opened}</span>`
    : `<span class="loc-opened" style="color:var(--tase-c)">Coming Soon${loc.target ? ` · Target ${esc(loc.target)}` : ''}</span>`;

  const mapsBtn  = dirBtn(loc, 'loc-maps');
  const callBtn  = callBtnHtml(loc.num);
  const tourBtn  = loc.render3d ? `<a class="loc-3d" href="${loc.render3d}" target="_blank" onclick="event.stopPropagation()">${ic('cube')}3D Tour</a>` : '';
  const camBtn   = loc.cam ? `<a class="loc-cam" href="${loc.cam}" target="_blank" onclick="event.stopPropagation()">${ic('camera')}Live Cam</a>` : '';
  const teamBtn  = MGMT[loc.num] ? `<button class="loc-team" onclick="event.stopPropagation(); openTeam(${loc.num})">${ic('user')}Team</button>` : '';
  const hoursHtml = hoursBlockHtml(loc.num);

  const slots = [
    { key:'ext', label:'Exterior' },
    { key:'int', label:'Interior' },
  ];

  const comingSoon = !loc.opened;
  const photoHtml = slots.map(s => {
    const fileNum  = s.key === 'ext' ? '01' : '02';
    const fileSrc  = `images/loc-${pad(displayNum)}/${fileNum}.jpg`;
    const localSrc = getPhotoSrc(loc.num, s.key);
    // Always try the location's own photos first. Coming-soon sites fall back to the
    // generic prototype render if they don't have their own yet.
    const src      = localSrc || verQ(fileSrc);
    const isLocal  = !!localSrc;
    const onErr = isLocal ? ''
      : comingSoon
        ? `onerror="this.onerror=null; this.src='images/tase-Coming soon.JPG';"`
        : `onerror="photoErr(this)"`;
    // Admin-supplied photos are arbitrary blobs with no generated variants,
    // so only the bundled files get the responsive treatment.
    const sources = isLocal ? '' : photoSources(fileSrc);
    return `
      <div class="photo-slot has-photo" data-num="${loc.num}" data-slot="${s.key}">
        <picture>${sources}
        <img src="${src}" alt="${loc.name} ${s.label}"
             loading="lazy" decoding="async"
             ${onErr}
             onload="photoOk(this)"></picture>
        <div class="ph" style="display:none">
          <div class="ph-icon">${ic('camera')}</div>
          <div class="ph-text">${s.label}</div>
        </div>
        <div class="photo-label">${s.label}</div>
        ${comingSoon && !loc.realPhotos ? `<div class="photo-render-tag">Rendering</div>` : ''}
      </div>`;
  }).join('');

  const addrLine  = loc.addr  ? `<div class="loc-addr">${ic('pin')}${esc(loc.addr)}</div>` : '';
  const phoneLine = loc.phone ? `<div class="loc-phone">${ic('phone')}${esc(loc.phone)}</div>` : '';
  const notesLine = loc.notes ? `<div class="loc-notes">${esc(loc.notes)}</div>` : '';

  return `
    <div class="card" data-type="${loc.type}" data-num="${loc.num}" data-ts="${loc.ts}" data-state="${loc.state}">
      <div class="card-header">
        <div class="logo-col num-bar-${loc.type}">
          <img class="brand-logo" src="${LOC_LOGO[loc.num] || TYPE_LOGO[loc.type]}" alt="${TYPE_FULL[loc.type]}"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="type-badge type-${loc.type}" style="display:none">${loc.type==='TASE'?'TASe':loc.type}</div>
          ${yrsBadge}
        </div>
        <div class="loc-info">
          <div class="loc-title-row">
            <div class="loc-name"><span class="loc-name-text"><span class="loc-num-prefix">#${pad(displayNum)}</span><span class="loc-pipe">|</span>${esc(loc.name)}</span></div>
            <button class="loc-share" type="button" title="Share a link to this location"
                    aria-label="Share a link to ${esc(loc.name)}"
                    onclick="event.stopPropagation(); shareLoc(${loc.num})">${ic('share')}</button>
          </div>
          <div class="loc-city">${esc(loc.city)}, ${esc(loc.state)}</div>
          ${ratingHtml(loc.num)}
          ${addrLine}
          ${phoneLine}
          ${statusBadge ? `<div class="loc-meta" style="margin-top:3px">${statusBadge}</div>` : ''}
          ${opened}
          ${hoursHtml}
          <div class="loc-meta">${mapsBtn}${callBtn}${tourBtn}${camBtn}${teamBtn}</div>
          ${notesLine}
        </div>
      </div>
      <div class="photos">${photoHtml}</div>
    </div>`;
}

// ══ STATE ══════════════════════════════════════════════════
let activeFilter = 'ALL', activeSort = 'num', searchQuery = '', activeState = '';
let currentView = 'grid', mapInstance = null, markerLayer = [], lastPinKey = '';
const mapMarkers = new Map();                       // loc number -> marker
let mapShown = [];                                  // locations currently pinned
let mapTour = { running: false, i: 0, stops: [], timer: null };
let showComingSoon = true; // red "coming soon" pins on the map (map-only, never in grid)
let RATINGS = {};          // num -> { r:rating, n:reviewCount } from ratings.json (refreshed daily)

function getSorted() {
  let list = [...locations];
  if (activeSort === 'num')   list.sort((a,b) => a.num - b.num);
  if (activeSort === 'date')  list.sort((a,b) => a.ts  - b.ts);
  if (activeSort === 'state') list.sort((a,b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
  if (activeSort === 'rating') list.sort((a,b) =>
    ((RATINGS[b.num]?.r ?? -1) - (RATINGS[a.num]?.r ?? -1)) ||
    ((RATINGS[b.num]?.n ?? 0)  - (RATINGS[a.num]?.n ?? 0)));
  return list;
}
/* Every person on a location's roster, flattened for searching. Rosters are
   resynced from the management listing docs, so searching a name is often
   how you find the store rather than the other way round. */
function teamNames(num) {
  const m = MGMT[num];
  if (!m) return '';
  return [m.mp, m.dm, m.lm, ...(m.am || []), ...(m.sup || [])]
    .filter(n => n && n !== 'Open')
    // Rosters carry nicknames as Samantha "Sam" Taylor. Index both the full
    // string and the nickname-free one, so "sam taylor" and "samantha taylor"
    // each find her.
    .flatMap(n => n.includes('"')
      ? [n.replace(/"/g, ''), n.replace(/\s*"[^"]*"\s*/g, ' ')]
      : [n])
    .join(' ');
}

function matches(baseLoc) {
  if (activeFilter !== 'ALL' && baseLoc.type !== activeFilter) return false;
  if (activeState && baseLoc.state !== activeState) return false;
  if (searchQuery) {
    const loc = { ...baseLoc, ...getLocInfo(baseLoc.num) };
    const hay = `${loc.num} ${loc.name} ${loc.city} ${loc.state} ${loc.phone||''} ${loc.notes||''} ${teamNames(baseLoc.num)}`;
    return hay.toLowerCase().includes(searchQuery.toLowerCase());
  }
  return true;
}

// ══ RENDER ══════════════════════════════════════════════════
function render() {
  const grid    = document.getElementById('grid');
  const noR     = document.getElementById('noResults');
  const statBar = document.getElementById('statsBar');
  const visible = getSorted().filter(l => isLocVisible(l) && matches(l));

  grid.innerHTML = visible.map(buildCard).join('');

  // Photo shimmer while images load
  grid.querySelectorAll('.photo-slot').forEach(slot => {
    const img = slot.querySelector('img');
    if (img && !img.complete) {
      slot.classList.add('photo-shimmer');
      const done = () => slot.classList.remove('photo-shimmer');
      img.addEventListener('load',  done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });

  // Staggered card entrance animations
  setupCardAnimations();

  // Attach photo-slot click → lightbox
  grid.querySelectorAll('.photo-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const img = slot.querySelector('img');
      const ph  = slot.querySelector('.ph');
      if (!img || img.style.display === 'none') return;
      if (ph && ph.style.display !== 'none') return;
      const num  = parseInt(slot.dataset.num);
      const slot2 = slot.dataset.slot;
      openLightboxForLoc(num, slot2, img);
    });
  });

  noR.classList.toggle('show', visible.length === 0);

  const counts = {};
  locations.forEach(l => { counts[l.type] = (counts[l.type]||0)+1; });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const t = btn.dataset.type, s = { TLC:'Lube Centers', TAS:'Auto Spas', TAR:'Auto Repair', TASE:'Expresses' };
    btn.textContent = t === 'ALL' ? `All (${locations.length})` : `${t==='TASE'?'TASe':t} — ${s[t]} (${counts[t]||0})`;
  });

  statBar.textContent = activeFilter === 'ALL'
    ? `Showing all ${locations.length} locations`
    : `Showing ${visible.length} of ${locations.length} — ${activeFilter==='TASE'?'TASe Expresses':TYPE_FULL[activeFilter]+'s'}`;

  if (currentView === 'map') updateMapMarkers();
  else if (currentView === 'timeline') renderTimeline();

  // Detect overflowing names — measure inner text span vs container for accuracy
  const measureOverflow = () => {
    grid.querySelectorAll('.loc-name').forEach(el => {
      const inner = el.querySelector('.loc-name-text');
      const textWidth = inner ? inner.offsetWidth : el.scrollWidth;
      const ov = textWidth - el.clientWidth;
      if (ov > 0) {
        el.style.setProperty('--name-overflow', `-${ov}px`);
        el.classList.add('has-overflow');
      } else {
        el.classList.remove('has-overflow');
        el.style.removeProperty('--name-overflow');
      }
    });
  };
  requestAnimationFrame(measureOverflow);
  // Re-run after fonts load in case Work Sans renders wider than the fallback
  document.fonts.ready.then(measureOverflow);

  applyPendingFocus();
}

// ══ LIGHTBOX ══════════════════════════════════════════════
let lbPhotos = [], lbIdx = 0, lbNum = null;
const LB_SLOTS = ['ext','int'];

const vtSupported = () =>
  typeof document.startViewTransition === 'function' &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Find the grid thumbnail that corresponds to a lightbox slide, so the photo
   can morph back to the exact tile it came from. Returns null when the grid
   isn't showing that tile (different view, filtered out, re-rendered). */
function lbThumbFor(num, slotKey) {
  const slot = document.querySelector(
    `.photo-slot[data-num="${num}"][data-slot="${slotKey}"]`);
  const img  = slot && slot.querySelector('img');
  return (img && img.offsetParent !== null) ? img : null;
}

/* Morph OUT of a thumbnail: the tile carries the shared name for the "before"
   snapshot, then hands it to #lightboxImg for the "after" snapshot. Exactly
   one element may hold the name in each state, hence the handover inside the
   callback. */
function lbMorphFrom(thumb, update) {
  if (!vtSupported() || !thumb) { update(); return; }
  thumb.style.viewTransitionName = 'lb-photo';
  const clear = () => { thumb.style.viewTransitionName = ''; };
  let t;
  try {
    t = document.startViewTransition(() => { clear(); update(); });
  } catch (e) { clear(); update(); return; }
  t.finished.catch(() => {}).finally(clear);
}

/* Morph BACK into a thumbnail: #lightboxImg owns the "before" snapshot, the
   tile takes the name for the "after" one. */
function lbMorphTo(thumb, update) {
  if (!vtSupported() || !thumb) { update(); return; }
  const clear = () => { thumb.style.viewTransitionName = ''; };
  let t;
  try {
    t = document.startViewTransition(() => { update(); thumb.style.viewTransitionName = 'lb-photo'; });
  } catch (e) { clear(); update(); return; }
  t.finished.catch(() => {}).finally(clear);
}

function openLightboxForLoc(num, startSlot, sourceImg) {
  const baseLoc = locations.find(l => l.num === num);
  if (!baseLoc) return;
  const loc = { ...baseLoc, ...getLocInfo(num) };
  const dn     = loc.numOverride || num;
  const slots  = ['ext','int'];
  const photos = [];
  slots.forEach(s => {
    const local = getPhotoSrc(num, s);
    const file  = `images/loc-${pad(dn)}/${s === 'ext' ? '01' : '02'}.jpg`;
    const src   = local || file;
    photos.push({ src, label: s === 'ext' ? 'Exterior' : 'Interior', caption: `#${pad(dn)} ${loc.name} — ${s==='ext'?'Exterior':'Interior'}` });
  });

  // Filter to only photos that are actually loaded (either local or file that might exist)
  // We open with whatever slot was clicked
  lbPhotos = photos;
  lbNum    = num;
  lbIdx    = slots.indexOf(startSlot);
  if (lbIdx < 0) lbIdx = 0;

  const thumb = sourceImg || lbThumbFor(num, LB_SLOTS[lbIdx]);
  lbMorphFrom(thumb, () => {
    // No slide-in on open — the morph is the entrance.
    showLightboxSlide(false);
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  });
}

/* Point the lightbox's modern-format sources at a bundled photo, or clear
   them for admin-supplied images that have no generated variants. */
function setLbSources(src) {
  const bundled = /^images\/loc-\d+\/0[12]\.jpg$/i.test(src);
  const base = src.replace(/\.jpg$/i, '');
  [['lbAvif','avif'], ['lbWebp','webp']].forEach(([id, ext]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (bundled) el.srcset = `${verQ(`${base}-480.${ext}`)} 480w, ${verQ(`${base}-960.${ext}`)} 960w`;
    else el.removeAttribute('srcset');
  });
}

function showLightboxSlide(animate = true) {
  const p   = lbPhotos[lbIdx];
  const img = document.getElementById('lightboxImg');
  img.classList.remove('slide-in');
  void img.offsetWidth; // restart animation
  // Phones take the 960px AVIF/WebP (~64KB) instead of the 1920px JPEG
  // (~470KB); above 900px the media query drops out and the JPEG — still the
  // highest-resolution asset we ship — is used unchanged.
  setLbSources(p.src);
  img.src = verQ(p.src);
  if (animate) img.classList.add('slide-in');
  img.onload  = () => { img.style.opacity = '1'; };
  img.onerror = () => { img.style.opacity = '0.3'; };
  document.getElementById('lightboxCaption').textContent = p.caption;

  // Dots
  const dots = document.getElementById('lbDots');
  dots.innerHTML = lbPhotos.map((_, i) =>
    `<div class="lb-dot ${i===lbIdx?'active':''}"></div>`
  ).join('');

  // Arrow visibility
  document.getElementById('lbPrev').classList.toggle('hidden', lbIdx === 0);
  document.getElementById('lbNext').classList.toggle('hidden', lbIdx === lbPhotos.length - 1);
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;   // nothing to morph back to
  const thumb = lbNum === null ? null : lbThumbFor(lbNum, LB_SLOTS[lbIdx]);
  lbMorphTo(thumb, () => {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  });
  // src is cleared after the snapshot has been taken, not during it
  const img = document.getElementById('lightboxImg');
  const drop = () => { if (!lb.classList.contains('open')) img.src = ''; };
  vtSupported() ? setTimeout(drop, 400) : drop();
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => { if(lbIdx>0){ lbIdx--; showLightboxSlide(); } });
document.getElementById('lbNext').addEventListener('click', () => { if(lbIdx<lbPhotos.length-1){ lbIdx++; showLightboxSlide(); } });

// Touch swipe for lightbox
(function() {
  let sx=0, sy=0;
  const lb = document.getElementById('lightbox');
  lb.addEventListener('touchstart', e => { sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, { passive:true });
  lb.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0 && lbIdx < lbPhotos.length-1) { lbIdx++; showLightboxSlide(); }
      if (dx > 0 && lbIdx > 0)                  { lbIdx--; showLightboxSlide(); }
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      closeLightbox();
    }
  }, { passive:true });
  lb.addEventListener('click', e => { if(e.target === lb) closeLightbox(); });
})();
document.addEventListener('keydown', e => {
  // Map shortcuts, only while the map is the visible view and nothing is
  // typed into a field. Escape also backs out of a zoomed-in location.
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const lbOpen = document.getElementById('lightbox').classList.contains('open');
  if (!lbOpen && !typing && currentView === 'map' && (e.key === '0' || e.key === 'Escape')) {
    e.preventDefault();
    fitMapToPins();
    return;
  }

  if (!lbOpen) return;
  if (e.key==='Escape')      closeLightbox();
  if (e.key==='ArrowRight' && lbIdx < lbPhotos.length-1) { lbIdx++; showLightboxSlide(); }
  if (e.key==='ArrowLeft'  && lbIdx > 0)                  { lbIdx--; showLightboxSlide(); }
});

// ══ SLIDESHOW ══════════════════════════════════════════════
let ssLocs=[], ssLocIdx=0, ssSlotIdx=0, ssTimer=null, ssPaused=false;
const SS_DURATION = 4000; // ms per photo

function buildSSPhotos(loc) {
  const dn = loc.numOverride || loc.num;
  return ['ext','int'].map(s => ({
    src:   getPhotoSrc(loc.num,s) || verQ(`images/loc-${pad(dn)}/${s === 'ext' ? '01' : '02'}.jpg`),
    label: s==='ext' ? 'Exterior' : 'Interior',
    local: !!getPhotoSrc(loc.num,s),
  }));
}

function startSlideshow() {
  ssLocs = getSorted().filter(l => isLocVisible(l) && matches(l));
  if (ssLocs.length === 0) return;
  ssLocIdx  = 0; ssSlotIdx = 0; ssPaused = false;
  document.getElementById('slideshow').classList.add('open');
  document.getElementById('ssPause').innerHTML = ic('pause', 'ico--fill');
  document.body.style.overflow = 'hidden';
  showSSSlide();
  startSSTimer();
}

function stopSlideshow() {
  clearTimeout(ssTimer);
  document.getElementById('slideshow').classList.remove('open');
  document.body.style.overflow = '';
}

function showSSSlide() {
  const loc    = { ...ssLocs[ssLocIdx], ...getLocInfo(ssLocs[ssLocIdx].num) };
  const photos = buildSSPhotos(loc);
  const photo  = photos[ssSlotIdx] || photos[0];
  const yrs    = yearsOpen(loc.ts);

  // Photo
  const ssImg  = document.getElementById('ssPhoto');
  ssImg.src    = photo.src;
  ssImg.onerror = function() { this.style.opacity='0.1'; };
  ssImg.onload  = function() { this.style.opacity='1'; };

  // Info overlay
  const tc = { TLC:' background:#FADC00;color:#0d3268', TAS:' background:#0C4D8F;color:#ffffff', TAR:' background:#fca044;color:#0d3268', TASE:' background:#0C4D8F;color:#ffffff' };
  document.getElementById('ssInfo').innerHTML = `
    <div class="ss-type-badge" style="${tc[loc.type]}">${loc.type==='TASE'?'TASe':loc.type} — ${TYPE_FULL[loc.type]}</div>
    <div class="ss-loc-num">Location #${pad(loc.numOverride || loc.num)}</div>
    <div class="ss-loc-name">${esc(loc.name)}</div>
    <div class="ss-loc-city">${esc(loc.city)}, ${esc(loc.state)}</div>
    <div class="ss-opened">${loc.opened ? `Opened ${esc(loc.opened)}` : ''}${yrs ? ` · ${yrs} years` : ''}</div>
  `;

  // Counter & label
  const totalPhotos = ssLocs.length * 2;
  const curPhoto    = ssLocIdx * 2 + ssSlotIdx + 1;
  document.getElementById('ssCounter').textContent   = `${ssLocIdx+1} of ${ssLocs.length} locations`;
  document.getElementById('ssPhotoLabel').textContent = photo.label;

  // Progress bar
  const pct = ((curPhoto-1) / totalPhotos) * 100;
  const fill = document.getElementById('ssProgressFill');
  fill.style.transition = 'none';
  fill.style.width = pct + '%';
  requestAnimationFrame(() => {
    fill.style.transition = `width ${SS_DURATION}ms linear`;
    fill.style.width = ((pct + (100/totalPhotos))) + '%';
  });
}

function ssAdvance() {
  const photos = buildSSPhotos(ssLocs[ssLocIdx]);
  if (ssSlotIdx < photos.length - 1) {
    ssSlotIdx++;
  } else if (ssLocIdx < ssLocs.length - 1) {
    ssLocIdx++; ssSlotIdx = 0;
  } else {
    stopSlideshow(); return;
  }
  showSSSlide();
  if (!ssPaused) startSSTimer();
}

function ssGoBack() {
  clearTimeout(ssTimer);
  if (ssSlotIdx > 0) { ssSlotIdx--; }
  else if (ssLocIdx > 0) { ssLocIdx--; ssSlotIdx = 1; }
  showSSSlide();
  if (!ssPaused) startSSTimer();
}

function startSSTimer() {
  clearTimeout(ssTimer);
  ssTimer = setTimeout(ssAdvance, SS_DURATION);
}

document.getElementById('ssStartBtn').addEventListener('click', startSlideshow);
document.getElementById('ssClose').addEventListener('click', stopSlideshow);
document.getElementById('ssNext').addEventListener('click', () => { clearTimeout(ssTimer); ssAdvance(); });
document.getElementById('ssPrev').addEventListener('click', ssGoBack);
document.getElementById('ssPause').addEventListener('click', () => {
  ssPaused = !ssPaused;
  document.getElementById('ssPause').innerHTML = ic(ssPaused ? 'play' : 'pause', 'ico--fill');
  if (ssPaused) {
    clearTimeout(ssTimer);
    document.getElementById('ssProgressFill').style.transition = 'none';
  } else {
    startSSTimer();
  }
});

// Swipe in slideshow
(function() {
  let sx=0;
  const ss = document.getElementById('slideshow');
  ss.addEventListener('touchstart', e => { sx=e.touches[0].clientX; }, { passive:true });
  ss.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) {
      if (dx < 0) { clearTimeout(ssTimer); ssAdvance(); }
      else        { ssGoBack(); }
    }
  }, { passive:true });
})();

// ══ FILTER / SORT / SEARCH ════════════════════════════════
document.getElementById('filterRow').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'pop'));
  btn.classList.add('active');
  // Pop animation restart trick
  void btn.offsetWidth;
  btn.classList.add('pop');
  btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  activeFilter = btn.dataset.type;
  renderWithTransition();
});
const stateSelect = document.getElementById('stateSelect');
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSort = btn.dataset.sort;
    const isByState = activeSort === 'state';
    stateSelect.classList.toggle('show', isByState);
    if (!isByState) { activeState = ''; stateSelect.value = ''; }
    renderWithTransition();
  });
});
stateSelect.addEventListener('change', () => {
  activeState = stateSelect.value;
  renderWithTransition();
});
const searchInput = document.getElementById('search');
const searchClear = document.getElementById('searchClear');
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  searchClear.style.display = searchQuery ? 'block' : 'none';
  render(); // search: no fade (instant feedback feels better)
});
searchClear.addEventListener('click', () => {
  searchInput.value=''; searchQuery=''; searchClear.style.display='none'; renderWithTransition();
});

// ══ MAP VIEW ══════════════════════════════════════════════
/* COORDS is stored [lat, lng] (the order Leaflet used); MapLibre wants
   [lng, lat], so every read goes through here rather than being swapped
   at each call site. */
function ll(num) { const c = COORDS[num]; return [c[1], c[0]]; }

/* Minimal control shim: MapLibre only requires onAdd/onRemove. */
function htmlControl(el) {
  return { onAdd() { return el; }, onRemove() { el.remove(); } };
}

function initMap() {
  mapInstance = new maplibregl.Map({
    container: 'map',
    // CARTO's vector basemap — same cartography as the old raster tiles, but
    // with real geometry, so buildings can be extruded and the camera tilted.
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [-77.0, 39.3], zoom: 7.2, pitch: 50, bearing: -14,
    antialias: true, attributionControl: { compact: true },
  });
  mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
  mapInstance.dragRotate.enable();
  mapInstance.touchZoomRotate.enableRotation();

  mapInstance.on('load', () => {
    add3dBuildings();               // needs the style; the rest does not
    mapInstance.resize();
    updateMapMarkers();
  });
  // Pins are DOM overlays, so draw them immediately rather than waiting on the
  // basemap. A slow or failed tile fetch should not leave the map looking empty.
  updateMapMarkers();

  // Coming-soon toggle (top-right). Count = future sites that have coordinates.
  const soonCount = locations.filter(l => l.hidden && COORDS[l.num]).length;
  const cs = document.createElement('div');
  cs.className = 'cs-toggle maplibregl-ctrl';
  cs.innerHTML = `<label><input type="checkbox" ${showComingSoon ? 'checked' : ''}><span><i class="soon-dot"></i>Coming Soon (${soonCount})</span></label>`;
  cs.addEventListener('click', e => e.stopPropagation());
  cs.querySelector('input').addEventListener('change', e => {
    showComingSoon = e.target.checked;
    updateMapMarkers();
  });
  mapInstance.addControl(htmlControl(cs), 'top-right');

  const tools = document.createElement('div');
  tools.className = 'maplibregl-ctrl map-tools';
  tools.innerHTML =
    `<button class="tour-btn" id="tourBtn" title="Fly through the locations currently shown">${ic('play','ico--fill')}<span>Tour locations</span></button>` +
    `<button class="tour-btn" id="fitBtn" title="Show all locations (press 0)">${ic('fit')}<span>Show all</span></button>`;
  tools.addEventListener('click', e => e.stopPropagation());
  tools.querySelector('#tourBtn').addEventListener('click', toggleMapTour);
  tools.querySelector('#fitBtn').addEventListener('click', () => fitMapToPins());
  mapInstance.addControl(htmlControl(tools), 'top-left');   // bottom-left collides with attribution
}

/* Extrude the basemap's building footprints. CARTO's tiles carry
   render_height/render_min_height; the coalesce keeps flat-but-present
   buildings visible if a tile omits them. */
function add3dBuildings() {
  if (mapInstance.getLayer('wlr-3d-buildings')) return;
  const labelLayer = mapInstance.getStyle().layers.find(l => l.type === 'symbol');
  mapInstance.addLayer({
    id: 'wlr-3d-buildings',
    source: 'carto', 'source-layer': 'building',
    type: 'fill-extrusion', minzoom: 13,
    paint: {
      'fill-extrusion-color': [
        'interpolate', ['linear'], ['zoom'],
        13, '#1b2b45',
        17, '#2c4066'
      ],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
      'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    }
  }, labelLayer && labelLayer.id);   // keep place labels on top
}

function pinPopupHtml(loc) {
  const dn = loc.numOverride || loc.num;
  const comingSoon = !loc.opened;
  const src = getPhotoSrc(loc.num, 'ext')
    || (comingSoon ? 'images/tase-Coming soon.JPG' : verQ(`images/loc-${pad(dn)}/01.jpg`));
  const est = loc.opened ? `Est. ${esc(loc.opened)}` : 'Coming Soon';
  const st = hoursStatus(loc.num);
  const statusLine = isPermClosed(loc.num)
    ? `<div class="mp-hours" style="color:rgba(255,80,80,0.9);font-weight:700">Permanently closed</div>`
    : st
    ? `<div class="mp-hours"><span class="hrs-dot ${st.open ? 'is-open' : 'is-closed'}"></span><span class="hrs-word ${st.open ? 'is-open' : 'is-closed'}">${st.open ? 'Open' : 'Closed'}</span> · ${st.detail}</div>`
    : '';
  return `
    <div class="mp-img"><img src="${src}" alt="${esc(loc.name)}" onerror="this.parentElement.style.display='none'"></div>
    <div class="mp-body">
      <div class="mp-name">#${pad(dn)} | ${esc(loc.name)} ${ratingHtml(loc.num, true)}</div>
      <div class="mp-city">${esc(loc.city)}, ${esc(loc.state)} · ${est}</div>
      ${statusLine}
      <div class="mp-actions">
        ${dirBtn(loc, 'mp-dir')}
        <button class="mp-view" onclick="showCardFromMap(${loc.num})">Photos ${ic('arrow-right')}</button>
      </div>
    </div>`;
}

// Coming-soon pins respect search + state, but NOT the brand filter (separate overlay)
function matchesComingSoon(baseLoc) {
  if (activeState && baseLoc.state !== activeState) return false;
  if (searchQuery) {
    const loc = { ...baseLoc, ...getLocInfo(baseLoc.num) };
    return `${loc.num} ${loc.name} ${loc.city} ${loc.state}`.toLowerCase().includes(searchQuery.toLowerCase());
  }
  return true;
}

function comingSoonPopupHtml(loc) {
  const dn  = loc.numOverride || loc.num;
  const dir = loc.addr
    ? `<div class="mp-actions">${dirBtn(loc, 'mp-dir')}</div>`
    : '';
  const approxNote = loc.approx
    ? `<div class="mp-approx">${ic('diamond')}Approximate — exact address pending</div>`
    : '';
  return `
    <div class="mp-img"><img src="${verQ(`images/loc-${pad(dn)}/01.jpg`)}" alt="${esc(loc.name)} — Coming Soon"
         onerror="this.onerror=null; this.src='images/tase-Coming soon.JPG';"></div>
    <div class="mp-body">
      <div class="mp-name">#${pad(dn)} | ${esc(loc.name)}</div>
      <div class="mp-city">${esc(loc.city)}, ${esc(loc.state)} · <span class="mp-soon">Coming Soon</span></div>
      ${loc.target ? `<div class="mp-target">${ic('target')}Target ${esc(loc.target)}</div>` : ''}
      ${approxNote}
      ${dir}
    </div>`;
}

/* Frame every pin currently on the map — the "show me everything" view.
   Also the reset after flying into a single location or running the tour. */
function fitMapToPins(duration = 900) {
  if (!mapInstance || !mapShown.length) return;
  stopMapTour();
  mapInstance.getContainer().querySelectorAll('.maplibregl-popup').forEach(p => p.remove());
  const b = new maplibregl.LngLatBounds();
  mapShown.forEach(l => b.extend(ll(l.num)));
  mapInstance.fitBounds(b, {
    padding: 48, maxZoom: 12,
    pitch: 45, bearing: -14,          // back to the default framing, not wherever the tour left it
    // Camera animations do not advance while the map is not rendering, so
    // snap instead of easing if the style has not resolved yet.
    duration: mapInstance.isStyleLoaded() ? duration : 0,
  });
}

function makePin(loc, cls, popupHtml) {
  const dn = loc.numOverride || loc.num;
  // MapLibre positions the element it is handed; .map-pin sets position:
  // relative, which would override that, so give it a plain wrapper to drive
  // and leave the pin's own styling untouched.
  const el = document.createElement('div');
  el.innerHTML = `<div class="map-pin ${cls}"><span>${pad(dn)}</span></div>`;
  return new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat(ll(loc.num))
    .setPopup(new maplibregl.Popup({ closeButton: false, offset: 34, maxWidth: '250px' })
      .setHTML(popupHtml));
}

function updateMapMarkers() {
  // Markers are DOM overlays and need no style; only add3dBuildings does, and
  // that is gated on the map's own 'load' event.
  if (!mapInstance) return;
  markerLayer.forEach(m => m.remove());
  markerLayer = [];
  mapMarkers.clear();

  const live = getSorted().filter(l => isLocVisible(l) && matches(l) && COORDS[l.num]);
  live.forEach(baseLoc => {
    const loc = { ...baseLoc, ...getLocInfo(baseLoc.num) };
    const m = makePin(loc, `pin-${loc.type}`, pinPopupHtml(loc)).addTo(mapInstance);
    markerLayer.push(m); mapMarkers.set(loc.num, m);
  });

  // Coming-soon overlay: map-only future sites, never added to the grid
  const soon = showComingSoon
    ? locations.filter(l => l.hidden && COORDS[l.num] && matchesComingSoon(l))
    : [];
  soon.forEach(baseLoc => {
    const loc = { ...baseLoc, ...getLocInfo(baseLoc.num) };
    const m = makePin(loc, loc.approx ? 'pin-SOON pin-approx' : 'pin-SOON', comingSoonPopupHtml(loc)).addTo(mapInstance);
    markerLayer.push(m); mapMarkers.set(loc.num, m);
  });

  // Refit only when the shown set changes, so panning isn't hijacked
  const shown = [...live, ...soon];
  const key = shown.map(l => (l.hidden ? 's' : '') + l.num).join(',');
  mapShown = shown;
  applyPendingMapFocus();
  if (shown.length && key !== lastPinKey && !mapTour.running && pendingMapFocus == null) fitMapToPins(700);
  lastPinKey = key;
}

// ══ GROWTH TIMELINE ════════════════════════════════════════
const TL_COLOR = { TLC:'#FADC00', TAR:'#8a9099', TAS:'#1d5fa8', TASE:'#4a9fe0' };
const TL_LABEL = { TLC:'Lube Centers', TAR:'Auto Repair', TAS:'Auto Spas', TASE:'Auto Spa Express' };
const TL_ORDER = ['TLC','TAR','TAS','TASE']; // stack order, bottom → top (oldest brand first)


let growthMetric = 'rev'; // 'rev' | 'cars' | 'loc'

function fmtMoney(v){ return v>=1e6 ? '$'+(v/1e6).toFixed(1).replace(/\.0$/,'')+'M' : v>=1e3 ? '$'+Math.round(v/1e3)+'K' : '$'+v; }
function fmtMoneyTick(v){ if(v>=1e6){ const m=v/1e6; return '$'+(m>=10?Math.round(m):(m%1?m.toFixed(1):m))+'M'; } return v>=1e3 ? '$'+Math.round(v/1e3)+'K' : '$'+v; }
function fmtCount(v){ return v>=1e6 ? (v/1e6).toFixed(2).replace(/\.?0+$/,'')+'M' : v>=1e3 ? Math.round(v/1e3)+'K' : String(v); }
function fmtCountTick(v){ return v>=1e6 ? (v/1e6).toFixed(1).replace(/\.0$/,'')+'M' : v>=1e3 ? Math.round(v/1e3)+'K' : String(v); }
const GROWTH_META = {
  rev:  { idx:1, label:'Annual Revenue', color:'#FADC00', fmt:fmtMoney, tick:fmtMoneyTick, note:'Annual revenue by year — 2020 dip reflects COVID; 2026 is projected.' },
  cars: { idx:0, label:'Cars Serviced',  color:'#4a9fe0', fmt:fmtCount, tick:fmtCountTick, note:'Cars serviced per year — 2026 is projected.' },
};
function niceMax(v){ const rough=v/5, mag=Math.pow(10,Math.floor(Math.log10(rough))), norm=rough/mag;
  const step=(norm<=1?1:norm<=2?2:norm<=2.5?2.5:norm<=5?5:10)*mag; return Math.ceil(v/step)*step; }

function timelineData() {
  const qualifies = l => isLocVisible(l) && l.ts < 20991231 &&
    (activeFilter === 'ALL' || l.type === activeFilter) &&
    (!activeState || l.state === activeState);
  const items = locations.filter(qualifies)
    .map(l => ({ year: Math.floor(l.ts / 10000), type: l.type, state: l.state }))
    .filter(l => l.year >= 1980 && l.year <= NOW_YEAR);
  const firstYear = items.length ? Math.min(...items.map(i => i.year)) : 1987;
  const minY = 1987, maxY = NOW_YEAR, years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  const brands = TL_ORDER.filter(b => items.some(i => i.type === b));
  const cum = {};
  brands.forEach(b => { let c = 0; cum[b] = years.map(y => { c += items.filter(i => i.type === b && i.year === y).length; return c; }); });
  const perYear = years.map(y => items.filter(i => i.year === y).length);
  const bMax = Math.max(0, ...perYear), bIdx = perYear.indexOf(bMax);
  return {
    years, brands, cum, perYear, total: items.length, firstYear,
    busiestYear: years[bIdx], busiestCount: bMax,
    statesCount: new Set(items.map(i => i.state)).size,
  };
}

function renderTimeline() {
  const wrap = document.getElementById('timelineWrap');
  const toggle = `<div class="tl-metric">
    <button class="tlm-btn ${growthMetric==='rev'?'active':''}" data-metric="rev">${ic('dollar')}Revenue</button>
    <button class="tlm-btn ${growthMetric==='cars'?'active':''}" data-metric="cars">${ic('car')}Cars Serviced</button>
    <button class="tlm-btn ${growthMetric==='loc'?'active':''}" data-metric="loc">${ic('pin')}Locations</button>
  </div>`;
  wrap.innerHTML = toggle + (growthMetric === 'loc' ? renderLocationsChart() : renderSeriesChart(growthMetric));
  wrap.querySelectorAll('.tlm-btn').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.metric !== growthMetric) { growthMetric = b.dataset.metric; renderTimeline(); }
  }));
  wireChartTips(wrap);
}

/* Show a year's value on hover (pointer) or tap (touch). Scoped to the growth
   charts; the sales chart has its own click-to-select behaviour. */
function wireChartTips(root) {
  root.querySelectorAll('.tl-chart-wrap').forEach(box => {
    const tip = box.querySelector('.tl-tip');
    if (!tip) return;
    let active = null;
    const hide = () => {
      tip.hidden = true;
      if (active) active.classList.remove('on');
      active = null;
    };
    const show = hit => {
      const hb = hit.getBoundingClientRect(), bb = box.getBoundingClientRect();
      if (active) active.classList.remove('on');
      active = hit; hit.classList.add('on');
      tip.textContent = hit.dataset.tip || '';
      tip.hidden = false;
      // clamp so the tip never hangs off either edge of the chart
      const half = tip.offsetWidth / 2;
      const x = Math.min(Math.max(hb.left - bb.left + hb.width / 2, half + 2), bb.width - half - 2);
      tip.style.left = x + 'px';
      tip.style.top  = Math.max(tip.offsetHeight + 4, hb.top - bb.top + 34) + 'px';
    };
    box.querySelectorAll('.tl-hit').forEach(hit => {
      hit.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(hit); });
      hit.addEventListener('pointerdown',  () => show(hit));   // tap and click-drag
    });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  });
  // a tap anywhere else dismisses it
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest || !e.target.closest('.tl-chart-wrap')) {
      root.querySelectorAll('.tl-tip').forEach(t => {
        t.hidden = true;
        t.parentElement.querySelectorAll('.tl-hit.on').forEach(h => h.classList.remove('on'));
      });
    }
  });
}

// Single-series bar chart for Revenue / Cars Serviced (company-wide; ignores brand/state filters)
function renderSeriesChart(metric) {
  const meta = GROWTH_META[metric];
  const years = Object.keys(GROWTH).map(Number).sort((a, b) => a - b);
  const vals = years.map(y => GROWTH[y][meta.idx]);
  const W = 1000, H = 460, padL = 54, padR = 16, padT = 24, padB = 40;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB;
  const plotW = px1 - px0, plotH = py1 - py0, n = years.length, colW = plotW / n;
  const yMax = niceMax(Math.max(...vals));
  const yOf = v => py1 - (v / yMax) * plotH, xOf = i => px0 + i * colW;
  let grid = '';
  for (let g = 0; g <= 5; g++) {
    const v = yMax / 5 * g, yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/><text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${meta.tick(Math.round(v))}</text>`;
  }
  let cols = '';
  years.forEach((yr, i) => {
    const v = vals[i], yT = yOf(v), yB = yOf(0), proj = yr === 2026, covid = yr === 2020 && metric === 'rev';
    cols += `<rect x="${(xOf(i) + colW * 0.12).toFixed(1)}" y="${yT.toFixed(1)}" width="${(colW * 0.76).toFixed(1)}" height="${(yB - yT).toFixed(1)}" fill="${meta.color}" rx="0.5"${proj ? ' opacity="0.5"' : ''}/>`;
    const tip = `${yr}${proj ? ' (projected)' : ''}${covid ? ' (COVID)' : ''}: ${meta.fmt(v)}`;
    cols += `<rect class="tl-hit" data-tip="${tip}" aria-label="${tip}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"></rect>`;
  });
  let xlab = '';
  years.forEach((yr, i) => {
    const show = yr % 5 === 0 || i === 0 || (i === n - 1 && yr % 5 >= 2);
    if (show) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 17).toFixed(1)}">${yr}</text>`;
  });
  const last = vals[n - 1], endX = Math.min(xOf(n - 1) + colW / 2, px1 - 4);
  const endLabel = `<text class="tl-end" x="${endX.toFixed(1)}" y="${(yOf(last) - 7).toFixed(1)}">${meta.fmt(last)}</text>`;
  const first = vals[0], span = years[n - 1] - years[0];
  const mult = Math.round(last / first), cagr = (Math.pow(last / first, 1 / span) - 1) * 100;
  return `
    <div class="tl-head">
      <h2>Our Growth <span>Since ${years[0]}</span></h2>
      <div class="tl-stats">
        <div class="tl-stat"><span class="tl-num">${meta.fmt(last)}</span><span class="tl-lab">${years[n-1]}${years[n-1]===2026?' proj.':''}</span></div>
        <div class="tl-stat"><span class="tl-num">${mult.toLocaleString()}×</span><span class="tl-lab">Since ${years[0]}</span></div>
        <div class="tl-stat"><span class="tl-num">${cagr.toFixed(0)}%</span><span class="tl-lab">Avg / Yr</span></div>
        <div class="tl-stat"><span class="tl-num">${span + 1}</span><span class="tl-lab">Years</span></div>
      </div>
    </div>
    <div class="tl-chart-wrap">
      <svg class="tl-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="WLR ${meta.label} by year">
        ${grid}${cols}${xlab}${endLabel}
      </svg>
      <div class="tl-tip" hidden></div>
    </div>
    <div class="tl-foot">${meta.note} Tap or hover a year for the value.</div>`;
}

function renderLocationsChart() {
  const d = timelineData();
  if (!d.total) return '<div class="tl-empty">No locations match this filter.</div>';

  const W = 1000, H = 460, padL = 40, padR = 16, padT = 24, padB = 40;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB;
  const plotW = px1 - px0, plotH = py1 - py0, n = d.years.length, colW = plotW / n;
  const yMax = Math.max(5, Math.ceil(d.total / 5) * 5);
  const yOf = v => py1 - (v / yMax) * plotH;
  const xOf = i => px0 + i * colW;

  let grid = '';
  for (let g = 0; g <= 5; g++) {
    const v = Math.round((yMax / 5) * g), yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/>`;
    grid += `<text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${v}</text>`;
  }

  let cols = '';
  d.years.forEach((yr, i) => {
    let base = 0;
    d.brands.forEach(b => {
      const v = d.cum[b][i]; if (!v) return;
      const yT = yOf(base + v), yB = yOf(base);
      cols += `<rect x="${(xOf(i) + colW * 0.10).toFixed(1)}" y="${yT.toFixed(1)}" width="${(colW * 0.80).toFixed(1)}" height="${Math.max(0, yB - yT).toFixed(1)}" fill="${TL_COLOR[b]}" rx="0.5"/>`;
      base += v;
    });
    const tot = d.brands.reduce((s, b) => s + d.cum[b][i], 0);
    const tip = `${yr}: ${tot} location${tot === 1 ? '' : 's'} open`;
    cols += `<rect class="tl-hit" data-tip="${tip}" aria-label="${tip}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"></rect>`;
  });

  let xlab = '';
  d.years.forEach((yr, i) => {
    // every 5th year, plus the first and last — but skip the last if it would
    // collide with a nearby multiple-of-5 label (e.g. 2026 next to 2025)
    const show = yr % 5 === 0 || i === 0 || (i === n - 1 && yr % 5 >= 2);
    if (show) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 17).toFixed(1)}">${yr}</text>`;
  });

  const endX = Math.min(xOf(n - 1) + colW / 2, px1 - 4), endY = yOf(d.total);
  const endLabel = `<text class="tl-end" x="${endX.toFixed(1)}" y="${(endY - 7).toFixed(1)}">${d.total}</text>`;

  const legend = d.brands.map(b => `<span class="tl-leg"><span class="tl-sw" style="background:${TL_COLOR[b]}"></span>${TL_LABEL[b]}</span>`).join('');

  return `
    <div class="tl-head">
      <h2>Our Growth <span>Since ${d.firstYear}</span></h2>
      <div class="tl-stats">
        <div class="tl-stat"><span class="tl-num">${d.total}</span><span class="tl-lab">Locations</span></div>
        <div class="tl-stat"><span class="tl-num">${NOW_YEAR - d.firstYear}</span><span class="tl-lab">Years</span></div>
        <div class="tl-stat"><span class="tl-num">${d.statesCount}</span><span class="tl-lab">States</span></div>
        <div class="tl-stat"><span class="tl-num">${d.brands.length}</span><span class="tl-lab">Brands</span></div>
      </div>
    </div>
    <div class="tl-legend">${legend}</div>
    <div class="tl-chart-wrap">
      <svg class="tl-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Cumulative WLR locations open by year, ${d.firstYear} to ${NOW_YEAR}">
        ${grid}${cols}${xlab}${endLabel}
      </svg>
      <div class="tl-tip" hidden></div>
    </div>
    <div class="tl-foot">Cumulative locations open each year${d.busiestCount > 1 ? ` · busiest year ${d.busiestYear} (${d.busiestCount} opened)` : ''}. Tap or hover a year for the count.</div>`;
}

function setView(view) {
  if (view === 'map' && typeof L === 'undefined') {
    document.querySelector('#map .map-fallback')?.replaceChildren('Map failed to load — check your connection.');
  }
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('grid').style.display      = view === 'grid' ? '' : 'none';
  document.getElementById('noResults').style.display = view === 'grid' ? '' : 'none';
  document.getElementById('mapWrap').classList.toggle('show', view === 'map');
  document.getElementById('timelineWrap').classList.toggle('show', view === 'timeline');
  if (view !== 'map') stopMapTour();
  if (view === 'map' && typeof maplibregl !== 'undefined') {
    if (!mapInstance) initMap();          // updateMapMarkers runs on 'load'
    else requestAnimationFrame(() => { mapInstance.resize(); updateMapMarkers(); });
  }
  if (view === 'timeline') renderTimeline();
}

/* ══ MAP FLY-THROUGH ═══════════════════════════════════════
   Chains flyTo across the pins currently on the map, banking the camera a
   little on each hop and opening that location's popup on arrival. Any
   manual interaction cancels it, so it never fights the user for control. */
const TOUR_HOLD_MS = 2200;

function toggleMapTour() { mapTour.running ? stopMapTour() : startMapTour(); }

function startMapTour() {
  if (!mapInstance || !markerLayer.length) return;
  // Tour only open locations — whatever the current filter is showing — in
  // location-number order. Coming-soon sites are renderings rather than real
  // storefronts, and including all 45 made the loop run four minutes.
  const soon = new Set(locations.filter(l => l.hidden).map(l => l.num));
  const stops = [...mapMarkers.keys()].filter(n => !soon.has(n) && !isPermClosed(n)).sort((a, b) => a - b);
  if (!stops.length) return;
  mapTour = { running: true, i: 0, timer: null, stops };
  setTourBtn(true);
  ['dragstart', 'wheel', 'touchstart'].forEach(ev =>
    mapInstance.once(ev, stopMapTour));
  tourHop();
}

function stopMapTour() {
  if (!mapTour.running) return;
  clearTimeout(mapTour.timer);
  mapTour.running = false;
  setTourBtn(false);
}

function setTourBtn(on) {
  const b = document.getElementById('tourBtn');
  if (!b) return;
  b.classList.toggle('running', on);
  b.innerHTML = ic(on ? 'pause' : 'play', 'ico--fill') +
                `<span>${on ? 'Stop tour' : 'Tour locations'}</span>`;
}

function tourHop() {
  if (!mapTour.running) return;
  const num = mapTour.stops[mapTour.i % mapTour.stops.length];
  mapInstance.flyTo({
    center: ll(num), zoom: 16.4, pitch: 62,
    bearing: (mapTour.i * 41) % 360,      // a new angle each stop
    // maxDuration keeps cross-state hops from dragging; without it the
    // default easing made a Frederick -> York leg take ~10s.
    speed: 1.4, curve: 1.35, maxDuration: 3800, essential: true,
  });
  mapInstance.once('moveend', () => {
    if (!mapTour.running) return;
    const m = mapMarkers.get(num);
    if (m && !m.getPopup().isOpen()) m.togglePopup();
    mapTour.timer = setTimeout(() => {
      if (!mapTour.running) return;
      if (m && m.getPopup().isOpen()) m.togglePopup();
      mapTour.i++;
      tourHop();
    }, TOUR_HOLD_MS);
  });
}

function showCardFromMap(num) {
  setView('grid');
  requestAnimationFrame(() => {
    const card = document.querySelector(`.card[data-num="${num}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1700);
  });
}

document.getElementById('viewToggle').addEventListener('click', e => {
  const btn = e.target.closest('.view-btn');
  if (btn && btn.dataset.view !== currentView) setView(btn.dataset.view);
});

// ══ SCROLL TOP ════════════════════════════════════════════
const scrollBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => { scrollBtn.classList.toggle('show', window.scrollY > 500); }, { passive:true });
scrollBtn.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

// ══ TEAM MODAL ════════════════════════════════════════════
function openTeam(num) {
  const baseLoc = locations.find(l => l.num === num);
  if (!baseLoc) return;
  const info = getLocInfo(num);
  const loc  = { ...baseLoc, ...info };
  const displayNum = loc.numOverride || loc.num;
  const m = MGMT[num] || {};

  function singleRow(role, name) {
    const isEmpty = !name;
    const display = isEmpty ? 'Not Assigned' : esc(name);
    return `<div class="team-row"><div class="team-role">${esc(role)}</div><div class="team-name${isEmpty ? ' open' : ''}">${display}</div></div>`;
  }
  function multiRow(role, names) {
    if (!names || names.length === 0) return '';
    const html = names.map(n => `<div class="team-name${n === 'Open' ? ' open' : ''}">${n === 'Open' ? 'Open Position' : esc(n)}</div>`).join('');
    return `<div class="team-row"><div class="team-role">${esc(role)}</div>${html}</div>`;
  }

  const amLabel  = (m.am  && m.am.length  > 1) ? 'Assistant Managers' : 'Assistant Manager';
  const supLabel = (m.sup && m.sup.length > 1)  ? 'Supervisors' : 'Supervisor';

  document.getElementById('teamPanelTitle').textContent    = `#${pad(displayNum)} ${loc.name}`;
  document.getElementById('teamPanelSubtitle').textContent = `${loc.city}, ${loc.state}  ·  ${TYPE_FULL[loc.type]}`;
  document.getElementById('teamPanelBody').innerHTML =
    singleRow('Managing Partner', m.mp || null) +
    singleRow('District Manager', m.dm || null) +
    (Array.isArray(m.lm) ? multiRow('Location Managers', m.lm) : singleRow('Location Manager', m.lm || null)) +
    (m.am && m.am.length > 0 ? multiRow(amLabel, m.am) : singleRow('Assistant Manager', null)) +
    (m.sup && m.sup.length > 0 ? multiRow(supLabel, m.sup) : '');

  document.getElementById('teamOverlay').classList.add('open');
  document.getElementById('teamPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeTeam() {
  document.getElementById('teamOverlay').classList.remove('open');
  document.getElementById('teamPanel').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('teamOverlay').addEventListener('click', closeTeam);
document.getElementById('teamClose').addEventListener('click', closeTeam);

// ══ INTRO SPLASH ══════════════════════════════════════════
// Plays once per session. CSS fades it out on its own; this only adds the
// counter animation, tap-to-skip, and the session flag.
(function () {
  const intro = document.getElementById('intro');
  if (!intro || intro.classList.contains('intro-off')) return;
  // Someone following a ?loc= link came for that location, not the splash.
  if (new URLSearchParams(location.search).get('loc')) {
    intro.classList.add('intro-off');
    const bg = intro.querySelector('.intro-bg');
    if (bg) { try { bg.pause(); } catch (e) {} bg.remove(); }
    return;
  }
  try { sessionStorage.setItem('wlr_intro_seen', '1'); } catch (e) {}

  document.body.style.overflow = 'hidden';
  const dismiss = () => {
    if (intro.classList.contains('intro-off')) return;
    intro.classList.add('intro-off');
    document.body.style.overflow = '';
    // Stop decoding the background loop once it's off screen (the intro is
    // done for this session, so drop the element entirely)
    const bg = intro.querySelector('.intro-bg');
    if (bg) { try { bg.pause(); } catch (e) {} bg.remove(); }
  };

  // Count up once the stats have faded in
  setTimeout(() => {
    animateNum(document.getElementById('introLocs'),   locations.filter(l => isLocVisible(l) && !isPermClosed(l.num)).length, 1100);
    animateNum(document.getElementById('introYears'),  NOW_YEAR - 1987, 1100);
    animateNum(document.getElementById('introStates'), 3, 900);
  }, 950);

  intro.addEventListener('click', dismiss);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); }, { once: true });
  setTimeout(dismiss, 5400); // after the CSS fade completes
})();

// ══ INIT ══════════════════════════════════════════════════
// Load all photos from IndexedDB into memory cache, then render
dbGetAll()
  .then(all => { photoCache = all; render(); })
  .catch(() => render())
  .finally(() => focusLocFromUrl());     // honour ?loc= once the grid exists

// Live Google ratings (refreshed daily by the GitHub Action → ratings.json)
fetch('ratings.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : {})
  .then(data => {
    RATINGS = data || {};
    if (currentView === 'map') updateMapMarkers(); else render();
  })
  .catch(() => {});

// ══ INCIDENT VIDEOS ════════════════════════════════════════
const INCIDENTS_KEY = 'wlr_incidents';
let incidentsPublished = []; // from committed incidents.json (public)

fetch('incidents.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : [])
  .then(d => { incidentsPublished = Array.isArray(d) ? d : []; if (document.getElementById('incOverlay').classList.contains('open')) renderIncidents(); })
  .catch(() => {});

function getLocalIncidents() { try { return JSON.parse(localStorage.getItem(INCIDENTS_KEY) || '[]'); } catch(e) { return []; } }
function saveLocalIncidents(a) { localStorage.setItem(INCIDENTS_KEY, JSON.stringify(a)); }
// Merge published (everyone) + local (this device, not yet published); local wins on id clash
function allIncidents() {
  const publishedIds = new Set(incidentsPublished.map(v => v.id || v.url));
  const byId = {};
  incidentsPublished.forEach(v => { byId[v.id || v.url] = v; });
  // A local video is a "draft" ONLY if it isn't also in the published list
  getLocalIncidents().forEach(v => { const k = v.id || v.url; byId[k] = { ...v, _local: !publishedIds.has(k) }; });
  return Object.values(byId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function parseVideo(url) {
  url = (url || '').trim(); let m;
  if (m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/))
    return { kind: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}`, thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` };
  if (m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/))
    return { kind: 'vimeo', id: m[1], hash: m[2] || null, embed: `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ''}`, thumb: null };
  if (m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/))
    return { kind: 'drive', embed: `https://drive.google.com/file/d/${m[1]}/preview`, thumb: null };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return { kind: 'file', embed: url, thumb: null };
  return { kind: 'link', embed: url, thumb: null };
}

function renderIncidents() {
  const grid = document.getElementById('incGrid');
  const list = allIncidents();
  document.getElementById('incOverlay').classList.toggle('empty', list.length === 0);
  grid.innerHTML = list.map(v => {
    const p = parseVideo(v.url);
    let locTxt = '';
    if (v.loc) { const l = locations.find(x => x.num == v.loc); locTxt = l ? `#${pad(l.num)} ${esc(l.name)}` : `#${esc(String(v.loc))}`; }
    const thumb = p.thumb ? `<img src="${esc(p.thumb)}" alt="" onerror="this.remove()">` : `<div class="inc-poster">${ic('video')}</div>`;
    const vimeoAttr = p.kind === 'vimeo' ? ` data-vimeo="${esc(p.id)}" data-vhash="${esc(p.hash || '')}"` : '';
    return `<button class="inc-card" data-id="${esc(v.id || v.url)}">
      <div class="inc-thumb"${vimeoAttr}>${thumb}<div class="inc-play">${ic('play','ico--fill')}</div>${v._local ? '<div class="inc-draft">Draft</div>' : ''}</div>
      <div class="inc-meta">
        <div class="inc-vtitle">${esc(v.title || 'Untitled')}</div>
        <div class="inc-vsub">${v.date ? esc(v.date) : ''}${locTxt ? `${v.date ? ' · ' : ''}<span class="inc-vloc">${locTxt}</span>` : ''}</div>
      </div></button>`;
  }).join('');
  grid.querySelectorAll('.inc-card').forEach(c => c.addEventListener('click', () => playIncident(c.dataset.id)));
  grid.querySelectorAll('.inc-thumb[data-vimeo]').forEach(loadVimeoThumb);
}

// Vimeo has no thumbnail in the URL — fetch it from Vimeo's public oEmbed endpoint
const vimeoThumbCache = {};
function loadVimeoThumb(thumbEl) {
  const id = thumbEl.dataset.vimeo, hash = thumbEl.dataset.vhash;
  const key = id + (hash ? '/' + hash : ''); // unlisted videos need the privacy hash in the oEmbed URL
  const apply = url => {
    if (thumbEl.querySelector('img')) return;
    thumbEl.querySelector('.inc-poster')?.remove();
    const img = new Image(); img.alt = ''; img.onerror = () => img.remove();
    img.src = url; thumbEl.insertBefore(img, thumbEl.firstChild);
  };
  if (vimeoThumbCache[key]) { apply(vimeoThumbCache[key]); return; }
  fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${key}&width=640`)
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.thumbnail_url) { vimeoThumbCache[key] = d.thumbnail_url; apply(d.thumbnail_url); } })
    .catch(() => {});
}

function playIncident(id) {
  const v = allIncidents().find(x => (x.id || x.url) === id); if (!v) return;
  const p = parseVideo(v.url);
  if (p.kind === 'link') { window.open(p.embed, '_blank', 'noopener'); return; }
  const body = document.getElementById('incPlayerBody');
  body.innerHTML = p.kind === 'file'
    ? `<video src="${esc(p.embed)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(p.embed)}${p.kind === 'youtube' ? '?autoplay=1' : ''}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
  document.getElementById('incPlayerTitle').textContent = (v.title || 'Video') + (v.date ? ` · ${v.date}` : '');
  document.getElementById('incPlayer').classList.add('open');
}
function closeIncPlayer() { document.getElementById('incPlayer').classList.remove('open'); document.getElementById('incPlayerBody').innerHTML = ''; }
function openIncidents() { renderIncidents(); document.getElementById('incOverlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeIncidents() { document.getElementById('incOverlay').classList.remove('open'); document.body.style.overflow = ''; }

document.getElementById('incOpenBtn').addEventListener('click', openIncidents);
document.getElementById('incClose').addEventListener('click', closeIncidents);
document.getElementById('incPlayerClose').addEventListener('click', closeIncPlayer);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('incPlayer').classList.contains('open')) closeIncPlayer();
  else if (document.getElementById('incOverlay').classList.contains('open')) closeIncidents();
  else if (document.getElementById('swOverlay').classList.contains('open')) closeSales();
});

// ══ WEEKLY SALES & WEATHER (live from the WLR Bonus Tracker) ═
// Weekly Sales & Weather visibility. Set to false to hide the 📊 button and the
// dashboard entirely (no sales data is even fetched) — used for external demos.
const SHOW_SALES = true;

const SW = { state: null, weather: null, fetchedAt: 0, metric: 'total', weeks: 52 };
const SW_CAT = {
  hot:      { icon: 'sun',   color: '#f5a623', label: 'Hot' },
  rain:     { icon: 'rain',  color: '#4a9fe0', label: 'Rain' },
  snow:     { icon: 'snow',  color: '#9fd3ff', label: 'Snow' },
  moderate: { icon: 'cloud', color: '#6bbf6b', label: 'Mild' },
};
function swCat(c) { return SW_CAT[c] || { icon: '·', color: '#5a6472', label: '—' }; }
const SW_MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SW_SEG = [['Lube','lube','#FADC00'],['Repair','repair','#8a9099'],['Spa','spa','#1d5fa8'],['Express','express','#4a9fe0']];

async function swLoad(force) {
  if (SW.state && SW.weather && (Date.now() - SW.fetchedAt < 300000) && !force) return true;
  try {
    const [s, w] = await Promise.all([
      fetch('https://wlr-bonus-tracker.vercel.app/state.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('https://wlr-bonus-tracker.vercel.app/weather.json', { cache: 'no-store' }).then(r => r.json()),
    ]);
    SW.state = s; SW.weather = w; SW.fetchedAt = Date.now();
    return true;
  } catch (e) { return false; }
}
function swRows() {
  const wk = (SW.state && SW.state.weekly) || [];
  const wm = (SW.weather && SW.weather.weeks) || {};
  return wk.filter(w => typeof w.total === 'number').map(w => ({ ...w, weather: wm[w.date] || null }));
}
// Pageout date D → the sales week it covers (Mon D-7 through Sun D-1)
function swWeekLabel(dateStr, withYear) {
  const d = new Date(dateStr + 'T00:00:00');
  const s = new Date(d); s.setDate(d.getDate() - 7);
  const e = new Date(d); e.setDate(d.getDate() - 1);
  const base = s.getMonth() === e.getMonth()
    ? `${SW_MO[s.getMonth()]} ${s.getDate()}–${e.getDate()}`
    : `${SW_MO[s.getMonth()]} ${s.getDate()} – ${SW_MO[e.getMonth()]} ${e.getDate()}`;
  return withYear ? `${base}, ${e.getFullYear()}` : base;
}
function swMetricVal(r, m) { return m === 'wash' ? (r.spa || 0) + (r.express || 0) : (r.total || 0); }
// Nearest weekly entry to ~1 year before the given pageout date (null if none within ~2 weeks — e.g. the 2025 gap)
function swYearAgo(all, dateStr) {
  const t = new Date(dateStr + 'T00:00:00'); t.setFullYear(t.getFullYear() - 1);
  const tt = t.getTime();
  let best = null, bestDiff = Infinity;
  for (const e of all) { const d = Math.abs(new Date(e.date + 'T00:00:00').getTime() - tt); if (d < bestDiff) { bestDiff = d; best = e; } }
  return best && bestDiff <= 14 * 86400000 ? best : null;
}

async function openSales() {
  if (!SHOW_SALES) return; // hidden — never opens, and no sales data is fetched
  document.getElementById('swOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!(SW.state && SW.weather)) {
    document.getElementById('swBody').innerHTML = '<div class="sw-loading">Loading sales &amp; weather…</div>';
    if (!await swLoad()) { document.getElementById('swBody').innerHTML = '<div class="sw-loading">Couldn’t load the data — check your connection and try again.</div>'; return; }
  } else { swLoad(); } // refresh in background if stale
  renderSales();
}
function closeSales() { document.getElementById('swOverlay').classList.remove('open'); document.body.style.overflow = ''; }

function renderSales() {
  const body = document.getElementById('swBody');
  const all = swRows();
  if (!all.length) { body.innerHTML = '<div class="sw-loading">No sales data available.</div>'; return; }
  const rows = SW.weeks >= 999 ? all : all.slice(-SW.weeks);
  const latest = all[all.length - 1];
  // Selected week drives the hero card (defaults to latest; click a bar to change)
  const selDate = (SW.selectedDate && all.some(r => r.date === SW.selectedDate)) ? SW.selectedDate : latest.date;
  const selIdx = all.findIndex(r => r.date === selDate);
  const sel = all[selIdx], prev = selIdx > 0 ? all[selIdx - 1] : null, isLatest = selDate === latest.date;

  const lw = sel.weather, cat = swCat(lw && lw.category);
  // Hero headline follows the charted metric so it matches the highlighted bar
  const mv = r => SW.metric === 'wash' ? ((r.spa || 0) + (r.express || 0)) : (r.total || 0);
  const bigVal = mv(sel);
  const metricLbl = SW.metric === 'wash' ? 'Car wash · Spa + Express' : (SW.metric === 'seg' ? 'Total · all segments' : 'Total sales');
  const wow = prev ? ((bigVal - mv(prev)) / mv(prev) * 100) : null;
  const wowHtml = wow === null ? '' : `<span class="sw-wow ${wow >= 0 ? 'up' : 'down'}">${ic(wow >= 0 ? 'caret-up' : 'caret-down', 'ico--fill')}${Math.abs(wow).toFixed(1)}% vs prior wk</span>`;
  const yoyEntry = swYearAgo(all, sel.date);
  const yoy = yoyEntry ? ((bigVal - mv(yoyEntry)) / mv(yoyEntry) * 100) : null;
  const yoyHtml = yoy === null ? '' : `<span class="sw-wow ${yoy >= 0 ? 'up' : 'down'}">${ic(yoy >= 0 ? 'caret-up' : 'caret-down', 'ico--fill')}${Math.abs(yoy).toFixed(1)}% vs last yr</span>`;
  const hero = `
    <div class="sw-hero">
      <div class="sw-hero-main">
        <div class="sw-hero-wk">${isLatest ? 'Latest pageout' : 'Pageout'} · week of ${swWeekLabel(sel.date, true)}${isLatest ? '' : ` <button class="sw-reset" id="swReset">${ic('undo')}Latest</button>`}</div>
        <div class="sw-hero-metric">${metricLbl}</div>
        <div class="sw-hero-total">$${Math.round(bigVal).toLocaleString()}</div>
        <div class="sw-deltas">${wowHtml}${yoyHtml}</div>
        <div class="sw-segs">${SW_SEG.map(([lbl, k, c]) => `<div class="sw-seg${SW.metric === 'wash' ? ((k === 'spa' || k === 'express') ? '' : ' off') : ''}"><span class="sw-seg-dot" style="background:${c}"></span><span class="sw-seg-lbl">${lbl}</span><span class="sw-seg-val">${fmtMoney(sel[k] || 0)}</span></div>`).join('')}</div>
      </div>
      <div class="sw-hero-wx" style="border-color:${cat.color}66">
        <div class="sw-wx-icon">${ic(cat.icon)}</div>
        <div class="sw-wx-cat" style="color:${cat.color}">${lw ? cat.label : 'Weather pending'}</div>
        ${lw ? `<div class="sw-wx-det">${Math.round(lw.avgHigh)}° / ${Math.round(lw.avgLow)}°<br>${lw.precipIn}" precip${lw.snowIn > 0 ? ` · ${lw.snowIn}" snow` : ''}</div>` : ''}
      </div>
    </div>`;

  const metricBtns = [['total','Total'],['wash','Car Wash'],['seg','By Segment']]
    .map(([m, l]) => `<button class="sw-tab ${SW.metric === m ? 'active' : ''}" data-metric="${m}">${l}</button>`).join('');
  const rangeBtns = [[26,'26w'],[52,'1yr'],[999,'All']]
    .map(([nw, l]) => `<button class="sw-tab ${SW.weeks === nw ? 'active' : ''}" data-weeks="${nw}">${l}</button>`).join('');
  const toggles = `<div class="sw-toggles"><div class="sw-tabs">${metricBtns}</div><div class="sw-tabs">${rangeBtns}</div></div>`;

  const legend = SW.metric === 'seg'
    ? `<div class="sw-legend">${SW_SEG.map(([l, , c]) => `<span class="sw-leg"><span class="sw-leg-sw" style="background:${c}"></span>${l}</span>`).join('')}</div>`
    : `<div class="sw-legend">${Object.values(SW_CAT).map(v => `<span class="sw-leg"><span class="sw-leg-sw" style="background:${v.color}"></span>${ic(v.icon)}${v.label}</span>`).join('')}</div>`;

  const upd = SW.weather && SW.weather.updated;
  const sc = body.scrollTop;
  body.innerHTML = hero + toggles + swChart(rows, SW.metric, selDate) + legend +
    `<div class="sw-foot">Weekly gross sales joined to that week’s weather${upd ? ` · data through ${upd}` : ''}. ${SW.metric === 'seg' ? 'Bars stacked by segment.' : 'Bars colored by weather category — car-wash revenue (Spa + Express) tracks the weather.'} Tap a week to load it above.</div>`;
  body.scrollTop = sc;

  body.querySelectorAll('.sw-tab[data-metric]').forEach(b => b.addEventListener('click', () => { SW.metric = b.dataset.metric; renderSales(); }));
  body.querySelectorAll('.sw-tab[data-weeks]').forEach(b => b.addEventListener('click', () => { SW.weeks = +b.dataset.weeks; renderSales(); }));
  body.querySelectorAll('.sw-chart .tl-hit').forEach(h => h.addEventListener('click', () => { SW.selectedDate = h.dataset.date; renderSales(); }));
  const rb = document.getElementById('swReset'); if (rb) rb.addEventListener('click', e => { e.stopPropagation(); SW.selectedDate = null; renderSales(); });
}

function swChart(rows, metric, selDate) {
  const W = 1000, H = 380, padL = 52, padR = 14, padT = 16, padB = 32;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB, plotW = px1 - px0, plotH = py1 - py0;
  const n = rows.length, colW = plotW / n;
  const maxV = Math.max(...rows.map(r => metric === 'seg' ? (r.total || 0) : swMetricVal(r, metric)), 1);
  const yMax = niceMax(maxV);
  const yOf = v => py1 - (v / yMax) * plotH, xOf = i => px0 + i * colW;
  const selI = rows.findIndex(r => r.date === selDate);
  const hl = selI < 0 ? '' : `<rect x="${xOf(selI).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}" fill="rgba(255,255,255,0.1)"/><rect x="${xOf(selI).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="2.5" fill="#FADC00"/>`;
  let grid = '';
  for (let g = 0; g <= 5; g++) { const v = yMax / 5 * g, yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/><text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${fmtMoneyTick(Math.round(v))}</text>`; }
  let bars = '';
  rows.forEach((r, i) => {
    const x = xOf(i) + colW * 0.14, bw = colW * 0.72;
    if (metric === 'seg') {
      let base = 0;
      SW_SEG.forEach(([, k, c]) => { const v = r[k] || 0; if (!v) return; const yT = yOf(base + v), yB = yOf(base); bars += `<rect x="${x.toFixed(1)}" y="${yT.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, yB - yT).toFixed(1)}" fill="${c}"/>`; base += v; });
    } else {
      const v = swMetricVal(r, metric), col = swCat(r.weather && r.weather.category).color, yT = yOf(v), yB = yOf(0);
      bars += `<rect x="${x.toFixed(1)}" y="${yT.toFixed(1)}" width="${bw.toFixed(1)}" height="${(yB - yT).toFixed(1)}" fill="${col}" rx="0.5"/>`;
    }
    const wx = r.weather, c = swCat(wx && wx.category);
    const tip = `${swWeekLabel(r.date, true)}  ·  ${metric === 'wash' ? 'Wash ' + fmtMoney(swMetricVal(r, 'wash')) : fmtMoney(r.total)}${wx ? `  ·  ${c.label} ${Math.round(wx.avgHigh)}°/${Math.round(wx.avgLow)}°` : ''}`;
    bars += `<rect class="tl-hit" data-date="${r.date}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"><title>${tip}</title></rect>`;
  });
  let xlab = '', lastMo = null;
  const step = n > 60 ? 3 : n > 34 ? 2 : 1;
  rows.forEach((r, i) => {
    const e = new Date(r.date + 'T00:00:00'); e.setDate(e.getDate() - 1);
    const mo = e.getMonth();
    if (mo !== lastMo) { lastMo = mo; if (mo % step === 0) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 15).toFixed(1)}">${SW_MO[mo]}${mo === 0 ? ` ’${String(e.getFullYear()).slice(2)}` : ''}</text>`; }
  });
  return `<svg class="tl-chart sw-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly WLR sales by weather">${grid}${hl}${bars}${xlab}</svg>`;
}

if (SHOW_SALES) {
  document.getElementById('swOpenBtn').addEventListener('click', openSales);
} else {
  // Remove the only entry point. The (empty) overlay markup stays in place so
  // closeSales()/goHome()/Esc keep working, but openSales() refuses to open it
  // and no sales or weather data is ever fetched.
  document.getElementById('swOpenBtn').remove();
}
document.getElementById('swClose').addEventListener('click', closeSales);

// ══ BUILD STAMP ════════════════════════════════════════════
// BUILD is declared by an inline script in index.astro, stamped when Astro builds
// the site, so it sits in the HTML itself where the auto-update check reads it.

(() => {
  const el = document.getElementById('buildStamp');
  if (!el) return;
  el.textContent = `BUILD ${BUILD}`;
  // Tapping reloads past any cached copy — the fix for a home-screen install
  // that resumed a suspended page instead of fetching a fresh one.
  el.addEventListener('click', () => {
    const u = new URL(location.href);
    u.searchParams.set('v', Date.now());
    location.replace(u);
  });
})();

// ══ AUTO-UPDATE ════════════════════════════════════════════
// An iPhone home-screen install is never reloaded when it is opened: iOS
// resumes the suspended page, which can be days old, so deploys never reached
// it short of deleting and re-adding the icon. Whenever the app comes back on
// screen, ask the server which BUILD is live and reload if it has moved on —
// the user has only just opened the app, so nothing is lost. While the app sits
// open, a periodic check offers a tap-to-update pill rather than yanking the
// page out from under whoever is using it.
(() => {
  let lastCheck = 0, offered = false;

  async function liveBuild() {
    const r = await fetch(`index.html?build-check=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = /const BUILD = ['](\d{4}-\d\d-\d\d \d\d:\d\d)['];/.exec(await r.text());
    return m && m[1];
  }

  function offerUpdate() {
    if (offered) return;
    offered = true;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast update';
    b.innerHTML = `${ic('refresh')} New version — tap to update`;
    b.addEventListener('click', () => location.reload());
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('show'), 20);
  }

  async function check(resumed) {
    if (Date.now() - lastCheck < 30000) return;   // iOS fires visibility changes in bursts
    lastCheck = Date.now();
    let live;
    try { live = await liveBuild(); } catch { return; }   // offline: try again next time
    if (!live || live === BUILD) return;
    if (resumed) location.reload(); else offerUpdate();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check(true);
  });
  // Back/forward-cache restores skip visibilitychange on some iOS versions.
  window.addEventListener('pageshow', e => { if (e.persisted) check(true); });
  setInterval(() => { if (document.visibilityState === 'visible') check(false); }, 15 * 60 * 1000);
})();

// ══ HOME BUTTON (header logo) ══════════════════════════════
// Closes whatever is open and returns to the default grid view.
function goHome() {
  closeLightbox();
  stopSlideshow();
  closeIncPlayer();
  closeIncidents();
  closeSales();
  closeTeam();

  activeFilter = 'ALL'; activeSort = 'num'; activeState = ''; searchQuery = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'ALL'));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'num'));
  stateSelect.value = ''; stateSelect.classList.remove('show');
  searchInput.value = ''; searchClear.style.display = 'none';
  document.body.style.overflow = '';

  setView('grid');
  render();
  // Next frame: body scroll-lock has just been released, so the scroll sticks
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
document.getElementById('homeBtn').addEventListener('click', goHome);

// Called from inline on*="" attributes in generated markup, which only see globals.
Object.assign(window, { photoOk, photoErr, showCardFromMap });
