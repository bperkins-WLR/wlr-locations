import { TYPE_FULL } from '../data/brands.js';
import { ic } from '../lib/icons.js';
import { photoUrl } from './photos.js';
import { pad, esc } from './util.js';
import { getPhotoSrc, getLocInfo, isLocVisible, yearsOpen } from './store.js';
import { getSorted, matches } from './state.js';

// ══ SLIDESHOW ══════════════════════════════════════════════
let ssLocs=[], ssLocIdx=0, ssSlotIdx=0, ssTimer=null, ssPaused=false;
const SS_DURATION = 4000; // ms per photo, counted from when it has faded in
const SS_FADE     = 900;  // crossfade; keep in step with .ss-layer in Slideshow.astro
let ssShown   = 0;        // bumps on every slide change, so a late image load can't show a stale photo
let ssLastLoc = null;     // location whose details are on screen (only re-animate on a new one)
let ssKb      = 0;        // alternates the Ken Burns drift direction
let ssLeft    = SS_DURATION, ssTickStart = 0;   // time left on this photo, for a true pause

function buildSSPhotos(loc) {
  const dn = loc.numOverride || loc.num;
  return ['ext','int'].map(s => ({
    src:   getPhotoSrc(loc.num,s) || photoUrl(`images/loc-${pad(dn)}/${s === 'ext' ? '01' : '02'}.jpg`),
    label: s==='ext' ? 'Exterior' : 'Interior',
    local: !!getPhotoSrc(loc.num,s),
  }));
}

function startSlideshow() {
  ssLocs = getSorted().filter(l => isLocVisible(l) && matches(l));
  if (ssLocs.length === 0) return;
  ssLocIdx  = 0; ssSlotIdx = 0; ssPaused = false; ssLastLoc = null;
  document.getElementById('ssStage').innerHTML = '';
  const ss = document.getElementById('slideshow');
  ss.classList.add('open'); ss.classList.remove('paused');
  document.getElementById('ssPause').innerHTML = ic('pause', 'ico--fill');
  document.body.style.overflow = 'hidden';
  showSSSlide();
}

export function stopSlideshow() {
  clearTimeout(ssTimer);
  ssShown++;                       // drop any photo still loading
  document.getElementById('slideshow').classList.remove('open', 'paused');
  document.body.style.overflow = '';
}

/* Resolve once the photo can paint without a blank frame. decode() can stall
   (hidden tab, very slow signal), so give up waiting after a few seconds and
   let the browser paint it whenever it arrives. */
function whenReady(img) {
  const decoded = img.decode ? img.decode() : new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; });
  return Promise.race([decoded.then(() => true, () => false),
                       new Promise(r => setTimeout(() => r(true), 3000))]);
}

// Warm the cache with the next photo so the crossfade starts on time.
function preloadNext() {
  const next = ssSlotIdx === 0 ? { li: ssLocIdx, si: 1 } : { li: ssLocIdx + 1, si: 0 };
  const loc = ssLocs[next.li];
  if (!loc) return;
  const src = buildSSPhotos({ ...loc, ...getLocInfo(loc.num) })[next.si]?.src;
  if (src) { const im = new Image(); im.src = src; }
}

function showSSSlide() {
  const loc    = { ...ssLocs[ssLocIdx], ...getLocInfo(ssLocs[ssLocIdx].num) };
  const photos = buildSSPhotos(loc);
  const photo  = photos[ssSlotIdx] || photos[0];
  const yrs    = yearsOpen(loc.ts);

  // Photo: build a new layer and fade it in over the current one once it has
  // loaded, so there is never a blank frame between photos.
  const shown = ++ssShown;
  clearTimeout(ssTimer);
  const layer = document.createElement('div');
  layer.className = 'ss-layer';
  layer.innerHTML = `<div class="ss-ambient"></div><img class="ss-img" alt="${esc(loc.name)} — ${photo.label}">`;
  const img = layer.querySelector('.ss-img');
  layer.querySelector('.ss-ambient').style.backgroundImage = `url("${photo.src}")`;
  img.style.setProperty('--kb', ssKb++ % 2 ? 'ss-kb-out' : 'ss-kb-in');
  img.style.setProperty('--kb-dur', `${SS_DURATION + SS_FADE}ms`);
  img.src = photo.src;
  whenReady(img).then(ok => {
    if (shown !== ssShown) return;              // moved on while this was loading
    if (!ok) img.classList.add('ss-failed');
    const stage = document.getElementById('ssStage');
    stage.appendChild(layer);
    setTimeout(() => layer.classList.add('show'), 20);
    // Retire older layers once the new one has fully covered them.
    setTimeout(() => {
      [...stage.children].forEach(el => { if (el !== layer && shown === ssShown) el.remove(); });
    }, SS_FADE + 60);
    ssLeft = SS_DURATION;
    runProgress();
    if (!ssPaused) startSSTimer();
    preloadNext();
  });

  // Info overlay — redrawn (and animated in) only when the location changes;
  // exterior → interior of the same store keeps its details still.
  if (ssLastLoc !== loc.num) {
    ssLastLoc = loc.num;
    const tc = { TLC:' background:#FADC00;color:#0d3268', TAS:' background:#0C4D8F;color:#ffffff', TAR:' background:#fca044;color:#0d3268', TASE:' background:#0C4D8F;color:#ffffff' };
    const accent = { TLC:'#FADC00', TAS:'#4a9fe0', TAR:'#fca044', TASE:'#4a9fe0' }[loc.type] || '#FADC00';
    document.getElementById('ssInfo').innerHTML = `
      <div class="ss-type-badge ss-rise" style="--i:0;${tc[loc.type]}">${loc.type==='TASE'?'TASe':loc.type} — ${TYPE_FULL[loc.type]}</div>
      <div class="ss-loc-num ss-rise" style="--i:1">Location #${pad(loc.numOverride || loc.num)}</div>
      <div class="ss-loc-name ss-rise" style="--i:2">${esc(loc.name)}</div>
      <div class="ss-accent" style="background:${accent}"></div>
      <div class="ss-loc-city ss-rise" style="--i:3">${esc(loc.city)}, ${esc(loc.state)}</div>
      <div class="ss-opened ss-rise" style="--i:4">${loc.opened ? `Opened ${esc(loc.opened)}` : ''}${yrs ? ` · ${yrs} years` : ''}</div>
    `;
  }

  // Counter & label
  const totalPhotos = ssLocs.length * 2;
  const curPhoto    = ssLocIdx * 2 + ssSlotIdx + 1;
  document.getElementById('ssCounter').textContent   = `${ssLocIdx+1} of ${ssLocs.length} locations`;
  document.getElementById('ssPhotoLabel').textContent = photo.label;

  // Progress bar: park it at the start of this photo; runProgress() sets it
  // moving once the photo has faded in.
  const fill = document.getElementById('ssProgressFill');
  fill.dataset.from = ((curPhoto-1) / totalPhotos) * 100;
  fill.dataset.to   = (curPhoto / totalPhotos) * 100;
  fill.style.transition = 'none';
  fill.style.width = fill.dataset.from + '%';
}

/* Run the bar from where it is to the end of this photo over the time left.
   On pause it is frozen in place (see togglePause), and this resumes it. */
function runProgress() {
  const fill = document.getElementById('ssProgressFill');
  if (ssPaused) return;
  setTimeout(() => {
    fill.style.transition = `width ${ssLeft}ms linear`;
    fill.style.width = fill.dataset.to + '%';
  }, 20);
}

function togglePause() {
  ssPaused = !ssPaused;
  document.getElementById('slideshow').classList.toggle('paused', ssPaused);
  document.getElementById('ssPause').innerHTML = ic(ssPaused ? 'play' : 'pause', 'ico--fill');
  const fill = document.getElementById('ssProgressFill');
  if (ssPaused) {
    clearTimeout(ssTimer);
    ssLeft = Math.max(0, ssLeft - (Date.now() - ssTickStart));
    // Freeze the bar where it is, rather than letting it snap to the end.
    const w = fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width * 100;
    fill.style.transition = 'none';
    fill.style.width = w + '%';
  } else {
    runProgress();
    startSSTimer();
  }
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
  showSSSlide();                 // starts this photo's timer once it has faded in
}

function ssGoBack() {
  clearTimeout(ssTimer);
  if (ssSlotIdx > 0) { ssSlotIdx--; }
  else if (ssLocIdx > 0) { ssLocIdx--; ssSlotIdx = 1; }
  showSSSlide();
}

function startSSTimer() {
  clearTimeout(ssTimer);
  ssTickStart = Date.now();
  ssTimer = setTimeout(ssAdvance, ssLeft);
}

export function initSlideshow() {
  document.getElementById('ssStartBtn').addEventListener('click', startSlideshow);
  document.getElementById('ssClose').addEventListener('click', stopSlideshow);
  document.getElementById('ssNext').addEventListener('click', () => { clearTimeout(ssTimer); ssAdvance(); });
  document.getElementById('ssPrev').addEventListener('click', ssGoBack);
  document.getElementById('ssPause').addEventListener('click', togglePause);

  // Keyboard: ← → step through photos, Space pauses, Escape closes.
  document.addEventListener('keydown', e => {
    if (!document.getElementById('slideshow').classList.contains('open')) return;
    if (e.key === 'ArrowRight') { clearTimeout(ssTimer); ssAdvance(); }
    else if (e.key === 'ArrowLeft') ssGoBack();
    else if (e.key === ' ' || e.key === 'Spacebar') {
      // A focused button already "clicks" on Space; don't toggle twice.
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault(); togglePause();
    }
    else if (e.key === 'Escape') stopSlideshow();
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
}
