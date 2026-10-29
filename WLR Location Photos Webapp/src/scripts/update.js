import { ic } from '../lib/icons.js';
import { state } from './state.js';
import { render } from './grid.js';
import { setView } from './views.js';
import { toast } from './links.js';

// ══ BUILD STAMP ════════════════════════════════════════════
// BUILD is declared by an inline script in the page <head>, stamped when Astro
// builds the site, so it sits in the HTML itself where the auto-update check
// reads it.

export function initBuildStamp() {
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
}

// ══ AUTO-UPDATE ════════════════════════════════════════════
// An iPhone home-screen install is never reloaded when it is opened: iOS
// resumes the suspended page, which can be days old. So the app asks the
// server which BUILD is live — whenever it comes back on screen or back
// online, and every few minutes while it sits open — and updates itself:
//  - coming back on screen: at once (the user has only just opened it);
//  - while open: once the screen has gone untouched for a minute and nothing
//    is open (photo, slideshow, panel, menu, typing). Until then a
//    "New version — tap to update" pill offers it.
// Either way the view, filters, search and scroll position are saved first
// and put back after the reload, so an update never loses the user's place.
const CHECK_EVERY = 5 * 60 * 1000;
const IDLE_MS     = 60 * 1000;
const RESUME_KEY  = 'wlr_resume';
const TRIED_KEY   = 'wlr_update_tried';   // the build an automatic reload last went for

async function liveBuild() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) return (await r.json()).build || null;
  } catch {}
  // Older deploy without version.json (or a blip): read the page itself.
  const r = await fetch(`index.html?build-check=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const m = /const BUILD = ['](\d{4}-\d\d-\d\d \d\d:\d\d)['];/.exec(await r.text());
  return m && m[1];
}

// Something the user is in the middle of, which an update must not cut off.
function busy() {
  const open = ['lightbox', 'slideshow', 'teamOverlay', 'incOverlay', 'incPlayer', 'swOverlay']
    .some(id => document.getElementById(id)?.classList.contains('open'));
  const intro = document.getElementById('intro');
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  return open || typing || !!document.querySelector('.dir-menu:not([hidden])') ||
         (intro && !intro.classList.contains('intro-off'));
}

/* Remember where the user is: the view, the filters, and the card at the top
   of the screen with its offset (a raw scrollY would be wrong after the
   reload, because cards change height when the ratings arrive). */
function saveResume() {
  const bar = document.querySelector('.controls');
  const top = bar ? (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 0;
  const card = [...document.querySelectorAll('.card')]
    .find(c => c.getBoundingClientRect().bottom > top + 8);
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({
      t: Date.now(), view: state.currentView,
      filter: state.activeFilter, sort: state.activeSort, st: state.activeState, q: state.searchQuery,
      anchor: card ? +card.dataset.num : null,
      offset: card ? card.getBoundingClientRect().top : 0,
      y: scrollY,
    }));
  } catch {}
}

function reloadForUpdate(target) {
  saveResume();
  try { sessionStorage.setItem(TRIED_KEY, target || ''); } catch {}
  location.reload();
}

/* The pill's reload: adds a throwaway query so it can't come back from a
   stale cached copy (the rare case the automatic reload didn't take). */
function forceFreshReload() {
  saveResume();
  const u = new URL(location.href);
  u.searchParams.set('v', Date.now());
  location.replace(u);
}

/* After an update reload, put the user back where they were. Returns true if
   it did, so startup can skip anything that would move them (a ?loc= jump). */
export function restoreAfterUpdate() {
  let r;
  try { r = JSON.parse(sessionStorage.getItem(RESUME_KEY)); sessionStorage.removeItem(RESUME_KEY); } catch {}
  if (!r || Date.now() - r.t > 2 * 60 * 1000) return false;

  Object.assign(state, { activeFilter: r.filter, activeSort: r.sort, activeState: r.st, searchQuery: r.q });
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === r.filter));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === r.sort));
  const sel = document.getElementById('stateSelect');
  if (sel) { sel.value = r.st || ''; sel.classList.toggle('show', r.sort === 'state'); }
  const q = document.getElementById('search'), clear = document.getElementById('searchClear');
  if (q) q.value = r.q || '';
  if (clear) clear.style.display = r.q ? 'block' : 'none';
  render();
  setView(r.view);

  // Put the remembered card back at its offset, and keep it there while the
  // ratings and fonts land and the page above it changes height.
  const place = () => {
    const card = r.anchor != null && document.querySelector(`.card[data-num="${r.anchor}"]`);
    if (card) window.scrollTo({ top: scrollY + card.getBoundingClientRect().top - r.offset });
    else window.scrollTo({ top: r.y });
  };
  let holding = true;                              // until the user moves or 4 s pass
  const hold = () => { if (holding) place(); };
  hold();
  const ro = new ResizeObserver(hold);
  ro.observe(document.body);
  const INPUTS = ['touchstart', 'wheel', 'keydown', 'mousedown'];
  const stop = () => { holding = false; ro.disconnect(); INPUTS.forEach(e => removeEventListener(e, stop)); };
  INPUTS.forEach(e => addEventListener(e, stop, { passive: true }));
  [150, 600, 1500].forEach(ms => setTimeout(hold, ms));   // in case resize reports come late
  setTimeout(stop, 4000);
  setTimeout(() => toast('Updated to the latest version'), 400);
  return true;
}

export function initAutoUpdate() {
  let lastCheck = 0, pending = '', pill = null;   // pending: the newer build found, if any
  let lastTouch = Date.now();
  ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(e =>
    addEventListener(e, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));

  function offerUpdate() {
    if (pill) return;
    pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'toast update';
    pill.innerHTML = `${ic('refresh')} New version — tap to update`;
    pill.addEventListener('click', forceFreshReload);
    document.body.appendChild(pill);
    setTimeout(() => pill.classList.add('show'), 20);
  }

  // If an automatic reload already went for this build and the page is still
  // older (a stale cached copy), don't keep reloading: offer the pill instead.
  let tried = '';
  try { tried = sessionStorage.getItem(TRIED_KEY) || ''; sessionStorage.removeItem(TRIED_KEY); } catch {}
  let auto = true;

  async function check(resumed) {
    if (pending) { if (resumed && auto) reloadForUpdate(pending); return; }
    if (Date.now() - lastCheck < 30000) return;   // iOS fires visibility changes in bursts
    lastCheck = Date.now();
    let live;
    try { live = await liveBuild(); } catch { return; }   // offline: try again next time
    if (!live || live === BUILD) return;
    pending = live;
    if (live === tried) { auto = false; offerUpdate(); return; }
    if (resumed) reloadForUpdate(live); else offerUpdate();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check(true);
  });
  // Back/forward-cache restores skip visibilitychange on some iOS versions.
  window.addEventListener('pageshow', e => { if (e.persisted) check(true); });
  // Signal back after a dead spot: the update may have gone out meanwhile.
  window.addEventListener('online', () => { lastCheck = 0; check(false); });
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (pending) {
      // Waiting for a quiet moment to apply an update found while open.
      if (auto && Date.now() - lastTouch >= IDLE_MS && !busy()) reloadForUpdate(pending);
    } else if (Date.now() - lastCheck >= CHECK_EVERY) {
      check(false);
    }
  }, 10 * 1000);
}
