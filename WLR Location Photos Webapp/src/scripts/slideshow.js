import { TYPE_FULL } from '../data/brands.js';
import { ic } from '../lib/icons.js';
import { photoUrl } from './photos.js';
import { pad, esc } from './util.js';
import { getPhotoSrc, getLocInfo, isLocVisible, yearsOpen } from './store.js';
import { getSorted, matches } from './state.js';

// ══ SLIDESHOW ══════════════════════════════════════════════
let ssLocs=[], ssLocIdx=0, ssSlotIdx=0, ssTimer=null, ssPaused=false;
const SS_DURATION = 4000; // ms per photo

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
  ssLocIdx  = 0; ssSlotIdx = 0; ssPaused = false;
  document.getElementById('slideshow').classList.add('open');
  document.getElementById('ssPause').innerHTML = ic('pause', 'ico--fill');
  document.body.style.overflow = 'hidden';
  showSSSlide();
  startSSTimer();
}

export function stopSlideshow() {
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

export function initSlideshow() {
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
}
