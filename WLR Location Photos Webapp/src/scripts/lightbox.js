import { locations } from '../data/locations.js';
import { photoUrl, setLbSources } from './photos.js';
import { pad } from './util.js';
import { getPhotoSrc, getLocInfo } from './store.js';
import { state } from './state.js';
import { fitMapToPins } from './map.js';

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

export function openLightboxForLoc(num, startSlot, sourceImg) {
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

function showLightboxSlide(animate = true) {
  const p   = lbPhotos[lbIdx];
  const img = document.getElementById('lightboxImg');
  img.classList.remove('slide-in');
  void img.offsetWidth; // restart animation
  // Phones take the 960px AVIF/WebP (~64KB) instead of the 1920px JPEG
  // (~470KB); above 900px the media query drops out and the JPEG — still the
  // highest-resolution asset we ship — is used unchanged.
  setLbSources(p.src);
  img.src = photoUrl(p.src);
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

export function closeLightbox() {
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

export function initLightbox() {
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
    if (!lbOpen && !typing && state.currentView === 'map' && (e.key === '0' || e.key === 'Escape')) {
      e.preventDefault();
      fitMapToPins();
      return;
    }

    if (!lbOpen) return;
    if (e.key==='Escape')      closeLightbox();
    if (e.key==='ArrowRight' && lbIdx < lbPhotos.length-1) { lbIdx++; showLightboxSlide(); }
    if (e.key==='ArrowLeft'  && lbIdx > 0)                  { lbIdx--; showLightboxSlide(); }
  });
}
