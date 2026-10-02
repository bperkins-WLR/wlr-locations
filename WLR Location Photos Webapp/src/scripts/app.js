// Entry point for the gallery page. Each feature lives in its own module and
// only defines things on import; this file wires them up, in the same order the
// page always has, so event listeners, fetches and timers start exactly as
// they did when all of this was one script.
import { photoOk, photoErr } from './photos.js';
import { mergeCustomLocations, applyRosterChanges, dbGetAll, setPhotoCache } from './store.js';
import { state } from './state.js';
import { openDirMenu } from './directions.js';
import { shareLoc, focusLocFromUrl } from './links.js';
import { render } from './grid.js';
import { initLightbox, closeLightbox } from './lightbox.js';
import { initSlideshow, stopSlideshow } from './slideshow.js';
import { initFilters, resetFilters } from './filters.js';
import { updateMapMarkers } from './map.js';
import { setView, showCardFromMap, initViewToggle } from './views.js';
import { openTeam, closeTeam, initTeamModal } from './team-modal.js';
import { initHeroCounter, initIntro } from './intro.js';
import { initIncidents, closeIncPlayer, closeIncidents } from './incidents.js';
import { initSales, closeSales } from './sales.js';
import { initBuildStamp, initAutoUpdate } from './update.js';

// ══ DATA ══════════════════════════════════════════════════
mergeCustomLocations();
applyRosterChanges();

initHeroCounter();
initLightbox();
initSlideshow();
initFilters();
initViewToggle();

// ══ SCROLL TOP ════════════════════════════════════════════
const scrollBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => { scrollBtn.classList.toggle('show', window.scrollY > 500); }, { passive:true });
scrollBtn.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

initTeamModal();
initIntro();

// ══ INIT ══════════════════════════════════════════════════
// Load all photos from IndexedDB into memory cache, then render
dbGetAll()
  .then(all => { setPhotoCache(all); render(); })
  .catch(() => render())
  .finally(() => focusLocFromUrl());     // honour ?loc= once the grid exists

// Live Google ratings (refreshed daily by the GitHub Action → ratings.json)
fetch('ratings.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : {})
  .then(data => {
    state.RATINGS = data || {};
    if (state.currentView === 'map') updateMapMarkers(); else render();
  })
  .catch(() => {});

initIncidents();
initSales();
initBuildStamp();
initAutoUpdate();

// ══ HOME BUTTON (header logo) ══════════════════════════════
// Closes whatever is open and returns to the default grid view.
function goHome() {
  closeLightbox();
  stopSlideshow();
  closeIncPlayer();
  closeIncidents();
  closeSales();
  closeTeam();

  resetFilters();
  document.body.style.overflow = '';

  setView('grid');
  render();
  // Next frame: body scroll-lock has just been released, so the scroll sticks
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
document.getElementById('homeBtn').addEventListener('click', goHome);

// Called from inline on*="" attributes in generated markup, which only see
// globals. Every function named in an onclick/onload/onerror string has to be
// listed here — a module's functions are not globals.
Object.assign(window, { photoOk, photoErr, showCardFromMap, openDirMenu, openTeam, shareLoc });
