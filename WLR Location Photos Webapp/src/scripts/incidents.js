import { locations } from '../data/locations.js';
import { ic } from '../lib/icons.js';
import { pad, esc } from './util.js';
import { closeSales } from './sales.js';

// ══ INCIDENT VIDEOS ════════════════════════════════════════
const INCIDENTS_KEY = 'wlr_incidents';
let incidentsPublished = []; // from committed incidents.json (public)

function getLocalIncidents() { try { return JSON.parse(localStorage.getItem(INCIDENTS_KEY) || '[]'); } catch(e) { return []; } }
// Merge published (everyone) + local (this device, not yet published); local wins on id clash
function allIncidents() {
  const publishedIds = new Set(incidentsPublished.map(v => v.id || v.url));
  const byId = {};
  incidentsPublished.forEach(v => { byId[v.id || v.url] = v; });
  // A local video is a "draft" ONLY if it isn't also in the published list
  getLocalIncidents().forEach(v => { const k = v.id || v.url; byId[k] = { ...v, _local: !publishedIds.has(k) }; });
  return Object.values(byId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function parseVideo(url) {
  url = (url || '').trim(); let m;
  if (m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/))
    return { kind: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}`, thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` };
  if (m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/))
    return { kind: 'vimeo', id: m[1], hash: m[2] || null, embed: `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ''}`, thumb: null };
  if (m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/))
    return { kind: 'drive', embed: `https://drive.google.com/file/d/${m[1]}/preview`, thumb: null };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return { kind: 'file', embed: url, thumb: null };
  return { kind: 'link', embed: url, thumb: null };
}

function renderIncidents() {
  const grid = document.getElementById('incGrid');
  const list = allIncidents();
  document.getElementById('incOverlay').classList.toggle('empty', list.length === 0);
  grid.innerHTML = list.map(v => {
    const p = parseVideo(v.url);
    let locTxt = '';
    if (v.loc) { const l = locations.find(x => x.num == v.loc); locTxt = l ? `#${pad(l.num)} ${esc(l.name)}` : `#${esc(String(v.loc))}`; }
    const thumb = p.thumb ? `<img src="${esc(p.thumb)}" alt="" onerror="this.remove()">` : `<div class="inc-poster">${ic('video')}</div>`;
    const vimeoAttr = p.kind === 'vimeo' ? ` data-vimeo="${esc(p.id)}" data-vhash="${esc(p.hash || '')}"` : '';
    return `<button class="inc-card" data-id="${esc(v.id || v.url)}">
      <div class="inc-thumb"${vimeoAttr}>${thumb}<div class="inc-play">${ic('play','ico--fill')}</div>${v._local ? '<div class="inc-draft">Draft</div>' : ''}</div>
      <div class="inc-meta">
        <div class="inc-vtitle">${esc(v.title || 'Untitled')}</div>
        <div class="inc-vsub">${v.date ? esc(v.date) : ''}${locTxt ? `${v.date ? ' · ' : ''}<span class="inc-vloc">${locTxt}</span>` : ''}</div>
      </div></button>`;
  }).join('');
  grid.querySelectorAll('.inc-card').forEach(c => c.addEventListener('click', () => playIncident(c.dataset.id)));
  grid.querySelectorAll('.inc-thumb[data-vimeo]').forEach(loadVimeoThumb);
}

// Vimeo has no thumbnail in the URL — fetch it from Vimeo's public oEmbed endpoint
const vimeoThumbCache = {};
function loadVimeoThumb(thumbEl) {
  const id = thumbEl.dataset.vimeo, hash = thumbEl.dataset.vhash;
  const key = id + (hash ? '/' + hash : ''); // unlisted videos need the privacy hash in the oEmbed URL
  const apply = url => {
    if (thumbEl.querySelector('img')) return;
    thumbEl.querySelector('.inc-poster')?.remove();
    const img = new Image(); img.alt = ''; img.onerror = () => img.remove();
    img.src = url; thumbEl.insertBefore(img, thumbEl.firstChild);
  };
  if (vimeoThumbCache[key]) { apply(vimeoThumbCache[key]); return; }
  fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${key}&width=640`)
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.thumbnail_url) { vimeoThumbCache[key] = d.thumbnail_url; apply(d.thumbnail_url); } })
    .catch(() => {});
}

function playIncident(id) {
  const v = allIncidents().find(x => (x.id || x.url) === id); if (!v) return;
  const p = parseVideo(v.url);
  if (p.kind === 'link') { window.open(p.embed, '_blank', 'noopener'); return; }
  const body = document.getElementById('incPlayerBody');
  body.innerHTML = p.kind === 'file'
    ? `<video src="${esc(p.embed)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(p.embed)}${p.kind === 'youtube' ? '?autoplay=1' : ''}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
  document.getElementById('incPlayerTitle').textContent = (v.title || 'Video') + (v.date ? ` · ${v.date}` : '');
  document.getElementById('incPlayer').classList.add('open');
}
export function closeIncPlayer() { document.getElementById('incPlayer').classList.remove('open'); document.getElementById('incPlayerBody').innerHTML = ''; }
function openIncidents() { renderIncidents(); document.getElementById('incOverlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
export function closeIncidents() { document.getElementById('incOverlay').classList.remove('open'); document.body.style.overflow = ''; }

export function initIncidents() {
  fetch('incidents.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .then(d => { incidentsPublished = Array.isArray(d) ? d : []; if (document.getElementById('incOverlay').classList.contains('open')) renderIncidents(); })
    .catch(() => {});

  document.getElementById('incOpenBtn').addEventListener('click', openIncidents);
  document.getElementById('incClose').addEventListener('click', closeIncidents);
  document.getElementById('incPlayerClose').addEventListener('click', closeIncPlayer);
  // One Escape handler for the full-screen overlays, innermost first.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('incPlayer').classList.contains('open')) closeIncPlayer();
    else if (document.getElementById('incOverlay').classList.contains('open')) closeIncidents();
    else if (document.getElementById('swOverlay').classList.contains('open')) closeSales();
  });
}
