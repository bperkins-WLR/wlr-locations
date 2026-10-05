import { ic } from '../lib/icons.js';

// ══ BUILD STAMP ════════════════════════════════════════════
// BUILD is declared by an inline script in the page <head>, stamped when Astro
// builds the site, so it sits in the HTML itself where the auto-update check
// reads it.

export function initBuildStamp() {
  const el = document.getElementById('buildStamp');
  if (!el) return;
  el.textContent = `BUILD ${BUILD}`;
  // Tapping reloads past any cached copy — the fix for a home-screen install
  // that resumed a suspended page instead of fetching a fresh one.
  el.addEventListener('click', () => {
    const u = new URL(location.href);
    u.searchParams.set('v', Date.now());
    location.replace(u);
  });
}

// ══ AUTO-UPDATE ════════════════════════════════════════════
// An iPhone home-screen install is never reloaded when it is opened: iOS
// resumes the suspended page, which can be days old, so deploys never reached
// it short of deleting and re-adding the icon. Whenever the app comes back on
// screen, ask the server which BUILD is live and reload if it has moved on —
// the user has only just opened the app, so nothing is lost. While the app sits
// open, a periodic check offers a tap-to-update pill rather than yanking the
// page out from under whoever is using it.
export function initAutoUpdate() {
  let lastCheck = 0, offered = false;

  async function liveBuild() {
    const r = await fetch(`index.html?build-check=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = /const BUILD = ['](\d{4}-\d\d-\d\d \d\d:\d\d)['];/.exec(await r.text());
    return m && m[1];
  }

  function offerUpdate() {
    if (offered) return;
    offered = true;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast update';
    b.innerHTML = `${ic('refresh')} New version — tap to update`;
    b.addEventListener('click', () => location.reload());
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('show'), 20);
  }

  async function check(resumed) {
    if (Date.now() - lastCheck < 30000) return;   // iOS fires visibility changes in bursts
    lastCheck = Date.now();
    let live;
    try { live = await liveBuild(); } catch { return; }   // offline: try again next time
    if (!live || live === BUILD) return;
    if (resumed) location.reload(); else offerUpdate();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check(true);
  });
  // Back/forward-cache restores skip visibilitychange on some iOS versions.
  window.addEventListener('pageshow', e => { if (e.persisted) check(true); });
  setInterval(() => { if (document.visibilityState === 'visible') check(false); }, 15 * 60 * 1000);
}
