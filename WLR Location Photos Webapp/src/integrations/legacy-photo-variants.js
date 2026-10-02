/* Transitional: keeps the pre-Astro AVIF/WebP addresses alive
   (images/loc-NN/01-480.avif, …-960.webp, …) for pages still open on phones
   from the last pre-Astro build. Those pages reference them in <source srcset>,
   and a 404 there is not a clean fallback: the lightbox shows a faded broken
   image and coming-soon cards lose their photo until the app is reloaded.

   After the build, each one is copied from the hashed /_astro/ file the photo
   manifest (rendered into dist/index.html) names for it — no re-encoding, so it
   costs a second or so. Safe to delete, along with its line in
   astro.config.mjs, once every device has picked up an Astro build. */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WIDTHS = [480, 960];

export default function legacyPhotoVariants() {
  return {
    name: 'wlr:legacy-photo-variants',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
        const m = /<script[^>]*id="photo-manifest"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        if (!m) { logger.warn('no photo manifest in index.html; legacy variants skipped'); return; }
        let n = 0;
        for (const [key, entry] of Object.entries(JSON.parse(m[1]))) {
          for (const fmt of ['avif', 'webp']) {
            for (const [i, w] of WIDTHS.entries()) {
              const dest = path.join(out, 'images', `${key}-${w}.${fmt}`);
              await fs.mkdir(path.dirname(dest), { recursive: true });
              await fs.copyFile(path.join(out, entry[fmt][i]), dest);
              n++;
            }
          }
        }
        logger.info(`${n} legacy photo variants copied into images/`);
      },
    },
  };
}
