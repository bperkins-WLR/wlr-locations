// Admin panel UI: password gate, location cards (photos + info overrides),
// new-location and videos modals. Storage lives in admin-store.js.

import { ic } from '../lib/icons.js';
import { checkPassword, isUnlocked, rememberUnlock, forgetUnlock } from './admin-auth.js';
import {
  BASE_LOCS, loadPhotos, clearPhotos, getPhoto, setPhoto, delPhoto,
  getInfo, setInfo, clearInfo, hasInfo, getDisplayLoc,
  getCustomLocs, addCustomLoc, deleteCustomLoc, getAllLocs, getVideos, saveVideos,
} from './admin-store.js';

// ── AUTH ─────────────────────────────────────────────────────
// (An already-unlocked tab is revealed by the inline check in admin.astro.)
async function tryUnlock() {
  if (await checkPassword(document.getElementById('pwInput').value)) {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('adminMain').style.display = 'block';
    rememberUnlock();
    renderAdmin();
  } else {
    document.getElementById('pwError').classList.add('show');
    document.getElementById('pwInput').value = '';
    document.getElementById('pwInput').focus();
  }
}
document.getElementById('pwBtn').addEventListener('click', tryUnlock);
document.getElementById('pwInput').addEventListener('keydown', e => { if(e.key==='Enter') tryUnlock(); });
document.getElementById('logoutBtn').addEventListener('click', () => { forgetUnlock(); location.reload(); });

// ── IMAGE COMPRESSION ────────────────────────────────────────
function compressImage(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 1000;
      if (w > MAX) { h = Math.round(h*MAX/w); w = MAX; }
      if (h > MAX) { w = Math.round(w*MAX/h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── STATE ────────────────────────────────────────────────────
let activeFilter = 'ALL';

// ── RENDER ───────────────────────────────────────────────────
function renderAdmin() {
  if (document.getElementById('adminMain').style.display === 'none') return;

  const allLocs = getAllLocs();
  let totalPhotos = 0, totalMissing = 0, totalEdited = 0;
  allLocs.forEach(b => {
    if (getPhoto(b.num,'ext')) totalPhotos++; else totalMissing++;
    if (getPhoto(b.num,'int')) totalPhotos++; else totalMissing++;
    if (hasInfo(b.num)) totalEdited++;
  });

  const customCount = getCustomLocs().length;
  document.getElementById('statsBar').innerHTML = `
    <div class="stat-item"><div class="stat-dot" style="background:var(--green)"></div>${totalPhotos} photos</div>
    <div class="stat-item"><div class="stat-dot" style="background:rgba(255,255,255,0.2)"></div>${totalMissing} missing</div>
    <div class="stat-item"><div class="stat-dot" style="background:var(--yellow)"></div>${totalEdited} edited</div>
    <div class="stat-item">${ic('pin')}${allLocs.length} locations${customCount ? ` <span style="color:var(--tase-c)">(+${customCount} new)</span>` : ''}</div>
  `;
  document.getElementById('footerCount').textContent = `${totalPhotos}/${allLocs.length*2} photos`;

  const filtered = allLocs.filter(b => {
    if (activeFilter === 'ALL')     return true;
    if (activeFilter === 'MISSING') return !getPhoto(b.num,'ext') || !getPhoto(b.num,'int');
    if (activeFilter === 'EDITED')  return hasInfo(b.num);
    return b.type === activeFilter;
  });

  const customNums = new Set(getCustomLocs().map(l => l.num));
  const grid = document.getElementById('adminGrid');
  grid.innerHTML = filtered.map(base => {
    const loc     = getDisplayLoc(base);
    const extDone = !!getPhoto(base.num,'ext');
    const intDone = !!getPhoto(base.num,'int');
    const allDone = extDone && intDone;
    const edited  = hasInfo(base.num);
    const tLabel  = base.type === 'TASE' ? 'TASe' : base.type;
    const info    = getInfo(base.num);
    const isCustom = customNums.has(base.num);
    const isHidden = base.hidden === true;
    const isPublished = info.published === true;
    const displayNum = info.numOverride || base.num;

    const slotHTML = ['ext','int'].map(s => {
      const photo = getPhoto(base.num, s);
      const label = s==='ext' ? 'Exterior' : 'Interior';
      return `
        <div class="photo-slot ${photo?'has-photo':''}" id="slot-${base.num}-${s}"
             onclick="triggerUpload(${base.num},'${s}')">
          ${photo ? `<img src="${photo}" alt="${label}">` : ''}
          <div class="slot-overlay" ${photo?'style="display:none"':''}>
            <div class="slot-icon">${ic('camera')}</div>
            <div class="slot-label">${label}</div>
            <div class="slot-tap">Tap to add</div>
          </div>
          ${photo?`<div class="photo-check">${ic('check')}</div>`:''}
          <div class="photo-actions">
            <button class="pa-btn pa-change" onclick="event.stopPropagation();triggerUpload(${base.num},'${s}')">Change</button>
            <button class="pa-btn pa-delete" onclick="event.stopPropagation();deletePhoto(${base.num},'${s}')">Delete</button>
          </div>
          <input type="file" class="file-input" id="file-${base.num}-${s}" accept="image/*"
                 onchange="handleFile(this,${base.num},'${s}')">
        </div>`;
    }).join('');

    return `
      <div class="a-card" data-type="${base.type}">
        <div class="a-stripe s-${base.type}"></div>
        <div class="a-head">
          <div class="a-num-box">
            <div class="a-num-label">LOC</div>
            <div class="a-num-val">${displayNum}</div>
          </div>
          <div class="a-info">
            <div class="a-name">${escHtml(loc.name)}${edited ? ` <span style="color:var(--yellow);font-size:10px">${ic('pencil')}</span>` : ''}${isCustom ? '<span class="custom-badge">NEW</span>' : ''}${isHidden && !isPublished ? '<span class="hidden-badge">HIDDEN</span>' : ''}${isHidden && isPublished ? `<span class="custom-badge" style="background:rgba(90,240,240,0.2);color:var(--tase-c)">LIVE ${ic('check')}</span>` : ''}</div>
            <div class="a-city">${escHtml(loc.city)}, ${escHtml(loc.state)}</div>
            ${loc.addr ? `<div class="a-addr">${ic('pin')}${escHtml(loc.addr)}</div>` : ''}
            ${info.phone ? `<div class="a-addr">${ic('phone')}${escHtml(info.phone)}</div>` : ''}
          </div>
          <div style="text-align:center">
            <div class="a-badge b-${base.type}">${tLabel}</div>
            <div class="a-status">${ic(allDone ? 'check-circle' : (extDone||intDone) ? 'clock' : 'square')}</div>
          </div>
        </div>

        <div class="a-photos">${slotHTML}</div>

        ${isCustom ? `<button class="delete-loc-btn" onclick="removeCustomLoc(${base.num})">${ic('trash')}Remove This Location</button>` : ''}
        ${isHidden && !isPublished ? `<button class="golive-btn" onclick="publishLoc(${base.num})">${ic('upload')}Go Live — Publish to Gallery</button>` : ''}
        ${isHidden && isPublished  ? `<button class="unpublish-btn" onclick="unpublishLoc(${base.num})">${ic('eye-off')}Hide from Gallery Again</button>` : ''}

        <button class="edit-toggle ${edited?'has-edits':''}" id="toggleBtn-${base.num}" onclick="toggleEdit(${base.num})">
          ${ic('pencil')}${edited ? 'Edit Info (custom data saved)' : 'Edit Location Info'}
          <span class="edit-arrow">${ic('chevron-down')}</span>
        </button>

        <div class="edit-form" id="editForm-${base.num}">

          ${isHidden ? `
          <div class="field-row">
            <label class="field-label">Location # <span style="font-size:9px;color:var(--tase-c);font-weight:400">(update when confirmed)</span></label>
            <input class="field-input" id="f-numoverride-${base.num}" type="number"
                   value="${info.numOverride || base.num}" min="1" max="999" style="font-size:20px;font-weight:900;color:#fff;">
          </div>` : ''}

          <div class="field-row">
            <label class="field-label">Display Name</label>
            <input class="field-input" id="f-name-${base.num}" type="text"
                   value="${escHtml(info.name || base.name)}" placeholder="e.g. Route 40">
          </div>

          <div class="field-row-2">
            <div>
              <label class="field-label">City</label>
              <input class="field-input" id="f-city-${base.num}" type="text"
                     value="${escHtml(info.city || base.city)}" placeholder="City">
            </div>
            <div>
              <label class="field-label">State</label>
              <input class="field-input" id="f-state-${base.num}" type="text"
                     value="${escHtml(info.state || base.state)}" placeholder="MD" maxlength="3">
            </div>
          </div>

          <div class="field-row">
            <label class="field-label">Street Address</label>
            <input class="field-input" id="f-addr-${base.num}" type="text"
                   value="${escHtml(info.addr || '')}" placeholder="e.g. 5720 Buckeystown Pike">
          </div>

          <div class="field-row">
            <label class="field-label">Phone Number</label>
            <input class="field-input" id="f-phone-${base.num}" type="tel"
                   value="${escHtml(info.phone || '')}" placeholder="e.g. (301) 555-1234">
          </div>

          <div class="field-row">
            <label class="field-label">Opening Date</label>
            <input class="field-input" id="f-opened-${base.num}" type="text"
                   value="${escHtml(info.opened || base.opened)}" placeholder="e.g. October 1987">
          </div>

          <div class="field-row">
            <label class="field-label">Status</label>
            <select class="status-select" id="f-status-${base.num}">
              <option value="Open"         ${(info.status||'Open')==='Open'        ? 'selected':''}>Open</option>
              <option value="Coming Soon"  ${(info.status||'')==='Coming Soon'     ? 'selected':''}>Coming Soon</option>
              <option value="Temporarily Closed" ${(info.status||'')==='Temporarily Closed'?'selected':''}>Temporarily Closed</option>
              <option value="Permanently Closed" ${(info.status||'')==='Permanently Closed'?'selected':''}>Permanently Closed</option>
            </select>
          </div>

          <div class="field-row">
            <label class="field-label">Notes (shown in gallery)</label>
            <textarea class="field-textarea" id="f-notes-${base.num}"
                      placeholder="e.g. Recently renovated, Oldest location in the group…">${escHtml(info.notes||'')}</textarea>
          </div>

          <div class="edit-actions">
            <button class="save-btn" onclick="saveInfo(${base.num})">${ic('save')}Save Changes</button>
            <button class="reset-btn" onclick="resetInfo(${base.num})">Reset</button>
          </div>

        </div>
      </div>`;
  }).join('');
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── EDIT FORM TOGGLE ─────────────────────────────────────────
function toggleEdit(num) {
  const form = document.getElementById(`editForm-${num}`);
  const btn  = document.getElementById(`toggleBtn-${num}`);
  const open = form.classList.toggle('open');
  btn.classList.toggle('open', open);
  if (open) form.querySelector('.field-input').focus();
}

// ── SAVE / RESET INFO ────────────────────────────────────────
function saveInfo(num) {
  const obj = {
    name:   document.getElementById(`f-name-${num}`).value.trim(),
    city:   document.getElementById(`f-city-${num}`).value.trim(),
    state:  document.getElementById(`f-state-${num}`).value.trim().toUpperCase(),
    addr:   document.getElementById(`f-addr-${num}`).value.trim(),
    phone:  document.getElementById(`f-phone-${num}`).value.trim(),
    opened: document.getElementById(`f-opened-${num}`).value.trim(),
    status: document.getElementById(`f-status-${num}`).value,
    notes:  document.getElementById(`f-notes-${num}`).value.trim(),
  };
  // Preserve published flag if already set
  const existing = getInfo(num);
  if (existing.published) obj.published = true;
  // Handle location number override for hidden/coming-soon locations
  const numOverrideEl = document.getElementById(`f-numoverride-${num}`);
  if (numOverrideEl) {
    const val = parseInt(numOverrideEl.value);
    if (val && val !== num) obj.numOverride = val;
  }
  // Only save keys that differ from base or are filled in
  const base = BASE_LOCS.find(b => b.num === num);
  if (obj.name   === base.name)   delete obj.name;
  if (obj.city   === base.city)   delete obj.city;
  if (obj.state  === base.state)  delete obj.state;
  if (obj.opened === base.opened) delete obj.opened;
  if (!obj.addr)   delete obj.addr;
  if (!obj.phone)  delete obj.phone;
  if (!obj.notes)  delete obj.notes;
  if (obj.status === 'Open') delete obj.status;

  if (Object.keys(obj).length === 0) {
    clearInfo(num);
  } else {
    setInfo(num, obj);
  }
  showToast(`Location #${num} info saved`, 'check');
  renderAdmin();
}

function resetInfo(num) {
  if (!confirm(`Reset all custom info for Location #${num} back to defaults?`)) return;
  clearInfo(num);
  showToast(`Location #${num} reset to defaults`);
  renderAdmin();
}

// ── PHOTO UPLOAD ─────────────────────────────────────────────
function triggerUpload(num, slot) {
  document.getElementById(`file-${num}-${slot}`).click();
}

function handleFile(input, num, slot) {
  const file = input.files[0];
  if (!file) return;
  compressImage(file, async data => {
    try {
      await setPhoto(num, slot, data);
      showToast(`${slot==='ext'?'Exterior':'Interior'} photo saved for #${num}`, 'check');
      renderAdmin();
    } catch(e) {
      showToast('Error saving photo — try again', 'alert');
    }
    input.value = '';
  });
}

function deletePhoto(num, slot) {
  if (!confirm(`Delete ${slot==='ext'?'Exterior':'Interior'} photo for Location #${num}?`)) return;
  delPhoto(num, slot).then(() => {
    showToast(`Deleted #${num} ${slot==='ext'?'Exterior':'Interior'}`);
    renderAdmin();
  });
}

// ── CLEAR ALL ────────────────────────────────────────────────
document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!confirm('This will delete ALL uploaded photos AND all saved info edits. Continue?')) return;
  clearPhotos().then(() => {
    BASE_LOCS.forEach(b => clearInfo(b.num));
    showToast('All data cleared');
    renderAdmin();
  });
});

// ── FILTER ───────────────────────────────────────────────────
document.getElementById('filterBar').addEventListener('click', e => {
  const btn = e.target.closest('.f-btn');
  if (!btn) return;
  document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.type;
  renderAdmin();
});

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, icon) {
  const t = document.getElementById('toast');
  t.innerHTML = icon ? ic(icon) : '';
  t.appendChild(document.createTextNode(msg));   // message stays text, not markup
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── VIDEOS MANAGER ───────────────────────────────────────────
function openVideos() {
  // On first use, seed from the published incidents.json so the admin list is complete
  if (getVideos().length === 0) {
    fetch('incidents.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d) && d.length && getVideos().length === 0) { saveVideos(d); renderVidList(); }
    }).catch(() => {});
  }
  renderVidList();
  document.getElementById('videosModal').classList.add('open');
}

function renderVidList() {
  const list = getVideos().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const el = document.getElementById('vidList');
  if (!list.length) { el.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:12px 0">No videos yet — add one above.</div>'; return; }
  el.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${list.length} video${list.length > 1 ? 's' : ''}</div>` +
    list.map(v => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(v.title || 'Untitled')}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.date ? escHtml(v.date) + ' · ' : ''}${v.loc ? '#' + escHtml(String(v.loc)) + ' · ' : ''}${escHtml(v.url || '')}</div>
      </div>
      <button class="vid-del" data-id="${escHtml(v.id || v.url)}" style="flex-shrink:0;background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.3);color:#ff8080;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">Delete</button>
    </div>`).join('');
  el.querySelectorAll('.vid-del').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Delete this video?')) return;
    saveVideos(getVideos().filter(v => (v.id || v.url) !== b.dataset.id));
    renderVidList();
    showToast('Video deleted');
  }));
}

document.getElementById('videosBtn').addEventListener('click', openVideos);
document.getElementById('vidCancelBtn').addEventListener('click', () => document.getElementById('videosModal').classList.remove('open'));
document.getElementById('videosModal').addEventListener('click', e => {
  if (e.target === document.getElementById('videosModal')) document.getElementById('videosModal').classList.remove('open');
});
document.getElementById('vidAddBtn').addEventListener('click', () => {
  const urlEl = document.getElementById('vid-url'), url = urlEl.value.trim();
  if (!url) { urlEl.focus(); return; }
  const arr = getVideos();
  arr.push({
    id: 'v' + Date.now().toString(36), url,
    title: document.getElementById('vid-title').value.trim(),
    date: document.getElementById('vid-date').value,
    loc: document.getElementById('vid-loc').value ? +document.getElementById('vid-loc').value : null,
  });
  saveVideos(arr);
  ['vid-url', 'vid-title', 'vid-date', 'vid-loc'].forEach(i => document.getElementById(i).value = '');
  renderVidList();
  showToast('Video added');
});
document.getElementById('vidPublishBtn').addEventListener('click', () => {
  const data = JSON.stringify(getVideos());
  navigator.clipboard.writeText(data).then(() => showToast('Publish code copied')).catch(() => showToast('Copy failed — long-press to copy'));
});

// ── NEW LOCATION MODAL ───────────────────────────────────────
document.getElementById('addLocBtn').addEventListener('click', () => {
  document.getElementById('newLocModal').classList.add('open');
  document.getElementById('nl-num').focus();
});
document.getElementById('nlCancelBtn').addEventListener('click', () => {
  document.getElementById('newLocModal').classList.remove('open');
  clearNewLocForm();
});
document.getElementById('newLocModal').addEventListener('click', e => {
  if (e.target === document.getElementById('newLocModal')) {
    document.getElementById('newLocModal').classList.remove('open');
    clearNewLocForm();
  }
});

function clearNewLocForm() {
  ['nl-num','nl-name','nl-city','nl-state','nl-opened','nl-addr'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('nl-type').value   = 'TASE';
  document.getElementById('nl-status').value = 'Coming Soon';
}

document.getElementById('nlSaveBtn').addEventListener('click', () => {
  const num    = parseInt(document.getElementById('nl-num').value);
  const name   = document.getElementById('nl-name').value.trim();
  const type   = document.getElementById('nl-type').value;
  const city   = document.getElementById('nl-city').value.trim();
  const state  = document.getElementById('nl-state').value.trim().toUpperCase();
  const opened = document.getElementById('nl-opened').value.trim();
  const addr   = document.getElementById('nl-addr').value.trim();
  const status = document.getElementById('nl-status').value;

  if (!num || !name || !city || !state) {
    showToast('Please fill in Number, Name, City and State', 'alert');
    return;
  }
  const allNums = getAllLocs().map(l => l.num);
  if (allNums.includes(num)) {
    showToast(`Location #${num} already exists`, 'alert');
    return;
  }

  // Build ts from opened date for sorting
  const yr = parseInt((opened || '2025').match(/\d{4}/)?.[0] || '2025');
  const newLoc = { num, name, type, city, state, opened: opened || '', ts: yr * 10000, addr: addr || '' };
  if (status !== 'Open') {
    setInfo(num, { status });
  }
  addCustomLoc(newLoc);
  document.getElementById('newLocModal').classList.remove('open');
  clearNewLocForm();
  showToast(`Location #${num} — ${name} added`, 'check-circle');
  renderAdmin();
});

function publishLoc(num) {
  const info = getInfo(num);
  info.published = true;
  setInfo(num, info);
  showToast(`Location #${num} is now live in the gallery`, 'upload');
  renderAdmin();
}
function unpublishLoc(num) {
  if (!confirm(`Hide Location #${num} from the gallery again?`)) return;
  const info = getInfo(num);
  delete info.published;
  if (Object.keys(info).length === 0) clearInfo(num);
  else setInfo(num, info);
  showToast(`Location #${num} hidden from gallery`);
  renderAdmin();
}

function removeCustomLoc(num) {
  if (!confirm(`Remove Location #${num} from the gallery? Photos will also be deleted.`)) return;
  deleteCustomLoc(num);
  delPhoto(num,'ext'); delPhoto(num,'int');
  clearInfo(num);
  showToast(`Location #${num} removed`);
  renderAdmin();
}

// The card markup is built as strings with inline onclick/onchange handlers,
// which resolve names on window — module functions are not global otherwise.
Object.assign(window, {
  toggleEdit, saveInfo, resetInfo, triggerUpload, handleFile, deletePhoto,
  publishLoc, unpublishLoc, removeCustomLoc,
});

// ── INIT ─────────────────────────────────────────────────────
// Pre-load all photos from IndexedDB into memory, then render
loadPhotos().then(() => {
  if (isUnlocked()) renderAdmin();
});
