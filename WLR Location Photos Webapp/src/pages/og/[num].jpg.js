/* og/NN.jpg — the 1200×630 link-preview card for a location's share page
   (l/NN.html), cut from its exterior photo. Same crop and encoding as the
   retired tools/build-location-pages.py: scale to cover, centre horizontally,
   and trim 40% of the vertical overflow from the top and 60% from the bottom,
   keeping more roofline than a centred crop. On the 3:2 photos that still
   trims the top ~8%, which takes the "#NN" plate off the card as it always
   has; the preview's title carries the number instead. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { locations } from '../../data/locations.js';
import { photoFor } from '../../lib/location-photos.js';

const OG_W = 1200, OG_H = 630;

export function getStaticPaths() {
  return locations
    .map(loc => loc.numOverride || loc.num)
    .filter(dn => photoFor(dn, '01'))
    .map(dn => ({ params: { num: String(dn).padStart(2, '0') }, props: { dn } }));
}

export async function GET({ props }) {
  const meta = photoFor(props.dn, '01');
  const scale = Math.max(OG_W / meta.width, OG_H / meta.height);
  const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
  const card = await sharp(await fs.readFile(meta.fsPath))
    .resize(w, h, { kernel: 'lanczos3' })
    .extract({
      left: Math.floor((w - OG_W) / 2),
      top: Math.max(0, Math.floor((h - OG_H) * 0.4)),
      width: OG_W, height: OG_H,
    })
    .jpeg({ quality: 62, progressive: true })
    .toBuffer();
  return new Response(card, { headers: { 'Content-Type': 'image/jpeg' } });
}
