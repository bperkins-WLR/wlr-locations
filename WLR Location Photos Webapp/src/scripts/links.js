import { locations } from '../data/locations.js';
import { pad } from './util.js';
import { getLocInfo } from './store.js';
import { state } from './state.js';
import { render } from './grid.js';
import { setPendingMapFocus } from './map.js';
import { setView } from './views.js';

// ══ PER-LOCATION LINKS ═════════════════════════════════════
// Shared links point at l/NN.html — a tiny stub carrying that location's own
// Open Graph tags, so a texted link previews with its photo and name before
// bouncing into the app. src/pages/l/[num].astro generates them.

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

// Reached from the card's inline onclick, so app.js puts it on window.
export async function shareLoc(num) {
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
   discard the reveal and highlight. Cleared once things settle. (The map
   keeps its own equivalent for future sites — see setPendingMapFocus.) */
let pendingFocus = null, pendingFocusScrolled = false;

export function applyPendingFocus() {
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
export function focusLocFromUrl() {
  const raw = new URLSearchParams(location.search).get('loc');
  const num = parseInt(raw, 10);
  if (!num) return;
  const loc = locations.find(l => l.num === num || l.numOverride === num);
  if (!loc) return;

  if (loc.hidden) {
    state.showComingSoon = true;
    setPendingMapFocus(loc.num);
    setView('map');            // updateMapMarkers() applies it, now and on rebuild
    return;
  }

  setView('grid');
  // Clear any filter that would hide the linked card.
  state.activeFilter = 'ALL'; state.searchQuery = ''; state.activeState = '';
  const input = document.querySelector('.search-wrap input'); if (input) input.value = '';
  pendingFocus = loc.num; pendingFocusScrolled = false;
  render();          // render() applies the pending focus, and so will re-renders
}
