import { locations, COORDS } from '../data/locations.js';
import { ic } from '../lib/icons.js';
import { photoUrl } from './photos.js';
import { pad, esc } from './util.js';
import { getPhotoSrc, getLocInfo, isLocVisible, isPermClosed } from './store.js';
import { hoursStatus } from './opening-hours.js';
import { state, getSorted, matches } from './state.js';
import { dirBtn } from './directions.js';
import { ratingHtml } from './grid.js';

// ══ MAP VIEW ══════════════════════════════════════════════
// MapLibre is a global from the deferred <script> in the page head.
let mapInstance = null, markerLayer = [], lastPinKey = '';
const mapMarkers = new Map();                       // loc number -> marker
let mapShown = [];                                  // locations currently pinned
let mapTour = { running: false, i: 0, stops: [], timer: null };

/* Same idea as the grid's pending focus, for a ?loc= pointing at a future
   site: markers are rebuilt when the basemap finishes loading, which would
   drop a popup opened before that. */
let pendingMapFocus = null;

export function setPendingMapFocus(num) { pendingMapFocus = num; }

function applyPendingMapFocus() {
  if (pendingMapFocus == null || !mapInstance) return;
  const m = mapMarkers.get(pendingMapFocus);
  if (!m) return;
  if (!m.getPopup().isOpen()) m.togglePopup();
  mapInstance.flyTo({ center: ll(pendingMapFocus), zoom: 15, pitch: 55, duration: 1200 });
  setTimeout(() => { pendingMapFocus = null; }, 4000);
}

// COORDS were geocoded from official washluberepair.com location pages (Census
// + OSM geocoders). #4 shares the #1 campus (1395 W Patrick St) — nudged east
// so both pins stay clickable.
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
  cs.innerHTML = `<label><input type="checkbox" ${state.showComingSoon ? 'checked' : ''}><span><i class="soon-dot"></i>Coming Soon (${soonCount})</span></label>`;
  cs.addEventListener('click', e => e.stopPropagation());
  cs.querySelector('input').addEventListener('change', e => {
    state.showComingSoon = e.target.checked;
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

/* Switching to the map view: build the map the first time, otherwise resize
   it for its now-visible container and refresh the pins. */
export function showMap() {
  if (!mapInstance) initMap();          // updateMapMarkers runs on 'load'
  else requestAnimationFrame(() => { mapInstance.resize(); updateMapMarkers(); });
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

// showCardFromMap is reached from the inline onclick, so app.js puts it on window.
function pinPopupHtml(loc) {
  const dn = loc.numOverride || loc.num;
  const comingSoon = !loc.opened;
  const src = getPhotoSrc(loc.num, 'ext')
    || (comingSoon ? 'images/tase-Coming soon.JPG' : photoUrl(`images/loc-${pad(dn)}/01.jpg`));
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
  const { activeState, searchQuery } = state;
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
    <div class="mp-img"><img src="${photoUrl(`images/loc-${pad(dn)}/01.jpg`)}" alt="${esc(loc.name)} — Coming Soon"
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
export function fitMapToPins(duration = 900) {
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

export function updateMapMarkers() {
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
  const soon = state.showComingSoon
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

export function stopMapTour() {
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
