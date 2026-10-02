import { state } from './state.js';
import { showMap, stopMapTour } from './map.js';
import { renderTimeline } from './growth-chart.js';

// ══ VIEW SWITCHING ═════════════════════════════════════════
// Grid, Map and Growth share the page; only one is shown at a time.

export function setView(view) {
  if (view === 'map' && typeof L === 'undefined') {
    document.querySelector('#map .map-fallback')?.replaceChildren('Map failed to load — check your connection.');
  }
  state.currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('grid').style.display      = view === 'grid' ? '' : 'none';
  document.getElementById('noResults').style.display = view === 'grid' ? '' : 'none';
  document.getElementById('mapWrap').classList.toggle('show', view === 'map');
  document.getElementById('timelineWrap').classList.toggle('show', view === 'timeline');
  if (view !== 'map') stopMapTour();
  if (view === 'map' && typeof maplibregl !== 'undefined') showMap();
  if (view === 'timeline') renderTimeline();
}

// Reached from the map popup's inline onclick, so app.js puts it on window.
export function showCardFromMap(num) {
  setView('grid');
  requestAnimationFrame(() => {
    const card = document.querySelector(`.card[data-num="${num}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1700);
  });
}

export function initViewToggle() {
  document.getElementById('viewToggle').addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (btn && btn.dataset.view !== state.currentView) setView(btn.dataset.view);
  });
}
