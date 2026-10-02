import { locations } from '../data/locations.js';
import { TYPE_FULL, TYPE_LOGO, LOC_LOGO } from '../data/brands.js';
import { MGMT } from '../data/team.js';
import { ic } from '../lib/icons.js';
import { photoUrl, photoSources } from './photos.js';
import { pad, esc } from './util.js';
import { getPhotoSrc, getLocInfo, isLocVisible, yearsOpen } from './store.js';
import { hoursBlockHtml, callBtnHtml } from './opening-hours.js';
import { state, getSorted, matches } from './state.js';
import { dirDest, dirBtn } from './directions.js';
import { applyPendingFocus } from './links.js';
import { openLightboxForLoc } from './lightbox.js';
import { updateMapMarkers } from './map.js';
import { renderTimeline } from './growth-chart.js';

// Live Google rating chip — links to the location's Google Maps page via its
// Place ID (captured in ratings.json). Empty until ratings.json is populated.
// Uses Google's documented Maps URL (api=1 + query_place_id): the old
// /maps/place/?q=place_id:… form only worked on the website — the Google Maps
// iPhone app took it as typed text and handed it to Google search.
export function ratingHtml(num, compact) {
  const R = state.RATINGS[num]; if (!R || typeof R.r !== 'number') return '';
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

export function renderWithTransition() {
  const grid = document.getElementById('grid');
  grid.classList.add('fading');
  setTimeout(() => {
    render();
    requestAnimationFrame(() => grid.classList.remove('fading'));
  }, 130);
}

// ══ CARD BUILDER ══════════════════════════════════════════
// The inline handlers below (photoOk, photoErr, openTeam, shareLoc) only see
// globals, so app.js puts those functions on window.
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
    const src      = localSrc || photoUrl(fileSrc);
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

// ══ RENDER ══════════════════════════════════════════════════
export function render() {
  const { activeFilter, currentView } = state;
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
