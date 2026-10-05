/* The photos' pre-Astro addresses, images/loc-NN/01.jpg and 02.jpg, served
   byte-for-byte from src/assets/locations. Pages still open on phones from an
   older build, saved links and anything else outside this repo keep working;
   the app itself now loads the content-hashed /_astro/ copies instead. */
import fs from 'node:fs/promises';
import { PHOTOS } from '../../../lib/location-photos.js';

export function getStaticPaths() {
  return Object.entries(PHOTOS).map(([key, meta]) => {
    const [, n, file] = /^loc-(\d+)\/(0[12])$/.exec(key);
    return { params: { n, file }, props: { fsPath: meta.fsPath } };
  });
}

export async function GET({ props }) {
  return new Response(await fs.readFile(props.fsPath), {
    headers: { 'Content-Type': 'image/jpeg' },
  });
}
