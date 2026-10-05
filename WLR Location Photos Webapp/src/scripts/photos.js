/* Everything that turns a bundled location photo ('images/loc-05/01.jpg') into
   the URLs the browser loads. The rest of the app only calls these exports, so
   how photos are stored and versioned can change here without touching it. */

/* Built URLs of every bundled photo, rendered into the page by
   components/PhotoManifest.astro. Astro names each file after its content, so a
   replaced photo gets a new address and phones / home-screen installs fetch it
   rather than keep showing the old copy — no ?v= fingerprint needed. */
const MANIFEST = (() => {
  try { return JSON.parse(document.getElementById('photo-manifest').textContent); }
  catch { return {}; }   // no manifest: every path passes through untouched
})();

/* The manifest entry for a bundled path like 'images/loc-05/01.jpg', or null
   for anything else (admin-uploaded blob:/data: URLs, unknown locations). */
function bundled(path) {
  const m = /^images\/loc-(\d+)\/(0[12])\.jpg$/i.exec(path || '');
  return (m && MANIFEST[`loc-${m[1]}/${m[2]}`]) || null;
}
const srcset = urls => `${urls[0]} 480w, ${urls[1]} 960w`;

/* The full-size (1920px) JPEG for a bundled photo; other srcs are returned as-is. */
export function photoUrl(path) {
  const e = bundled(path);
  return e ? e.jpg : path;
}

/* Rendered width of one card photo across the grid's breakpoints — two photos
   per card, one card column under 560px, two under 1100px, then a fixed max. */
const PHOTO_SIZES = '(max-width: 560px) 46vw, (max-width: 1100px) 23vw, 220px';

/* AVIF/WebP tiers for a bundled location photo. The 1920px JPEG stays the
   <img> src, so it remains the floor for anything that supports neither. */
export function photoSources(jpgPath) {
  const e = bundled(jpgPath);
  if (!e) return '';
  return `<source type="image/avif" srcset="${srcset(e.avif)}" sizes="${PHOTO_SIZES}">` +
         `<source type="image/webp" srcset="${srcset(e.webp)}" sizes="${PHOTO_SIZES}">`;
}

export function photoOk(el) {
  el.style.display = '';
  // .ph is a sibling of <picture>, not of the <img>, so walk to the slot.
  const slot = el.closest('.photo-slot');
  const ph = slot && slot.querySelector('.ph');
  if (ph) ph.style.display = 'none';
}
// A stalled image (weak signal) used to leave a permanent "no photo" tile until
// reload. Retry once before giving up.
export function photoErr(el) {
  if (!el.dataset.retried) {
    el.dataset.retried = '1';
    // Drop the modern <source> tiers so the retry lands on the JPEG floor —
    // setting .src alone would not dislodge an already-chosen AVIF/WebP.
    const pic = el.closest('picture');
    if (pic) pic.querySelectorAll('source').forEach(n => n.remove());
    // A fresh query string so the retry is a new request, not the stalled one.
    const base = el.src.split('?')[0];
    setTimeout(() => { el.src = base + '?r=1'; }, 800);
    return;
  }
  el.style.display = 'none';
  const slot = el.closest('.photo-slot');
  const ph = slot && slot.querySelector('.ph');
  if (ph) ph.style.display = 'flex';
}

/* Point the lightbox's modern-format sources at a bundled photo, or clear
   them for admin-supplied images that have no generated variants. */
export function setLbSources(src) {
  const e = bundled(src);
  [['lbAvif','avif'], ['lbWebp','webp']].forEach(([id, fmt]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (e) el.srcset = srcset(e[fmt]);
    else el.removeAttribute('srcset');
  });
}
