import { COORDS } from '../data/locations.js';
import { TYPE_FULL } from '../data/brands.js';
import { ic } from '../lib/icons.js';
import { esc } from './util.js';

// ══ DIRECTIONS ════════════════════════════════════════════

/* What we hand a navigation app. A street address routes to the right
   driveway far more reliably than a geocoded point, so prefer it; fall back to
   coordinates, then to a name search for sites with neither. */
export function dirDest(loc) {
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

// openDirMenu is reached from the inline onclick, so app.js puts it on window.
export function dirBtn(loc, cls) {
  return `<button class="${cls}" type="button" aria-haspopup="menu" aria-expanded="false"` +
         ` data-dest="${esc(dirDest(loc))}"` +
         ` onclick="event.stopPropagation(); openDirMenu(this)">${ic('pin')}Directions</button>`;
}

// ══ DIRECTIONS APP PICKER ══════════════════════════════════
let dirMenuEl = null, dirMenuBtn = null;

function closeDirMenu() {
  if (!dirMenuEl) return;
  dirMenuEl.hidden = true;
  if (dirMenuBtn) dirMenuBtn.setAttribute('aria-expanded', 'false');
  dirMenuBtn = null;
}

export function openDirMenu(btn) {
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
