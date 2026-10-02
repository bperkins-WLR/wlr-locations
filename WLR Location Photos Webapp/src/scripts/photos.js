/* Everything that turns a bundled location photo ('images/loc-05/01.jpg') into
   the URLs the browser loads. The rest of the app only calls these exports, so
   how photos are stored and versioned can change here without touching it. */

/* Content fingerprint per bundled photo, rewritten by tools/build-images.py.
   Appended to every photo URL so a replaced photo gets a new address: without
   it, phones and home-screen installs kept showing the old copy of a photo
   that had been swapped out under the same filename. */
const PHOTO_VER = {"loc-01/01":"b85f6f98","loc-01/02":"5f96837f","loc-02/01":"a49b9250","loc-02/02":"b9a5fc7a","loc-03/01":"a6976324","loc-03/02":"edaaacb5","loc-04/01":"7ff5ba2f","loc-04/02":"5fdb2aa0","loc-05/01":"591e7542","loc-05/02":"8300b9e9","loc-06/01":"187e2931","loc-06/02":"85cffa93","loc-07/01":"6c1fcb34","loc-07/02":"7fae08df","loc-08/01":"83324b7a","loc-08/02":"b0c1a581","loc-09/01":"f9383053","loc-09/02":"73430f57","loc-10/01":"46524613","loc-10/02":"2ae6186d","loc-11/01":"75616254","loc-11/02":"a8a068af","loc-12/01":"aa6bcff4","loc-12/02":"41e4609d","loc-13/01":"bcde85d2","loc-13/02":"e25d7dfc","loc-14/01":"54ea8a9d","loc-14/02":"3c7e104a","loc-15/01":"218fc9ff","loc-15/02":"434834ce","loc-16/01":"0ca2c529","loc-16/02":"145f4c57","loc-17/01":"dd44b01b","loc-17/02":"11f7dbf7","loc-18/01":"997b5022","loc-18/02":"8b45eecd","loc-19/01":"cc1d0041","loc-19/02":"41d2f63d","loc-20/01":"5588855c","loc-20/02":"d2be1464","loc-21/01":"f2104328","loc-21/02":"158bb0b0","loc-22/01":"7bfa4447","loc-22/02":"c1587e31","loc-23/01":"5637e0e9","loc-23/02":"cf76cee2","loc-24/01":"0f519069","loc-24/02":"675352a5","loc-25/01":"a1d8126c","loc-25/02":"0c8b764a","loc-26/01":"1b2c0c3a","loc-26/02":"1de6291b","loc-27/01":"848f23cb","loc-27/02":"12dea048","loc-28/01":"f8fd1243","loc-28/02":"cd69f0a4","loc-29/01":"4907ac3c","loc-29/02":"27e664ef","loc-30/01":"dcdb7448","loc-30/02":"588ad5f0","loc-31/01":"f0c99be6","loc-31/02":"7e2be0ca","loc-32/01":"d9de45e9","loc-32/02":"67141193","loc-33/01":"b2201724","loc-33/02":"2b558feb","loc-34/01":"658a22f2","loc-34/02":"140121e6","loc-35/01":"8426dd5b","loc-35/02":"730744b6","loc-36/01":"793d2169","loc-36/02":"aa142009","loc-37/01":"7a7c8852","loc-37/02":"e460a09f","loc-38/01":"d1fabc6b","loc-38/02":"27e664ef","loc-39/01":"a2910976","loc-39/02":"588ad5f0","loc-40/01":"4907ac3c","loc-40/02":"140121e6","loc-41/01":"dcdb7448","loc-41/02":"aa142009","loc-42/01":"658a22f2","loc-42/02":"e460a09f","loc-43/01":"793d2169","loc-43/02":"27e664ef","loc-44/01":"7a7c8852","loc-44/02":"588ad5f0","loc-45/01":"d1fabc6b","loc-45/02":"140121e6"};
export function photoUrl(path) {
  const m = /images\/loc-(\d+)\/(0[12])/.exec(path);
  const v = m && PHOTO_VER[`loc-${m[1]}/${m[2]}`];
  return v ? `${path}?v=${v}` : path;
}

/* Rendered width of one card photo across the grid's breakpoints — two photos
   per card, one card column under 560px, two under 1100px, then a fixed max. */
const PHOTO_SIZES = '(max-width: 560px) 46vw, (max-width: 1100px) 23vw, 220px';

/* AVIF/WebP tiers for a bundled location photo. The 1920px JPEG stays the
   <img> src, so it remains the floor for anything that supports neither. */
export function photoSources(jpgPath) {
  const base = jpgPath.replace(/\.jpg$/i, '');
  const v = ext => `${photoUrl(`${base}-480.${ext}`)} 480w, ${photoUrl(`${base}-960.${ext}`)} 960w`;
  return `<source type="image/avif" srcset="${v('avif')}" sizes="${PHOTO_SIZES}">` +
         `<source type="image/webp" srcset="${v('webp')}" sizes="${PHOTO_SIZES}">`;
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
    const base = photoUrl(el.src.split('?')[0]);
    setTimeout(() => { el.src = base + (base.includes('?') ? '&' : '?') + 'r=1'; }, 800);
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
  const bundled = /^images\/loc-\d+\/0[12]\.jpg$/i.test(src);
  const base = src.replace(/\.jpg$/i, '');
  [['lbAvif','avif'], ['lbWebp','webp']].forEach(([id, ext]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (bundled) el.srcset = `${photoUrl(`${base}-480.${ext}`)} 480w, ${photoUrl(`${base}-960.${ext}`)} 960w`;
    else el.removeAttribute('srcset');
  });
}
