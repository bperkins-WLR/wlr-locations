#!/usr/bin/env node
/*
 * Fetches the live Google rating + review count for each WLR location via the
 * Google Places API (New) and writes them to public/ratings.json, which the
 * site reads at load time.
 *
 * The list of locations comes from the app's own data file
 * (WLR Location Photos Webapp/src/data/locations.js) — there is no separate
 * list here to keep in sync. A store is rated once it has an opening date
 * (`opened`) and is not `hidden`; coming-soon sites are skipped until they open.
 * Permanently closed stores stay in, as they always have: their Google listing
 * and rating still exist and the card still shows them.
 *
 * Requires environment variable GOOGLE_PLACES_API_KEY (a key with the
 * "Places API (New)" enabled and billing active on the Google Cloud project).
 *
 * Place IDs are discovered once via Text Search and cached in tools/place-ids.json
 * so subsequent runs use the cheaper, stable Place Details lookup. If a cached
 * Place ID is ever wrong, delete that entry (or fix it) and re-run.
 *
 * Run locally:   GOOGLE_PLACES_API_KEY=xxx node tools/fetch-ratings.mjs
 * Dry run:       node tools/fetch-ratings.mjs --dry-run
 *                (no key, no network, writes nothing — prints which locations
 *                would be rated and the search text a new one would use)
 *
 * Plain `node`, no npm install: the data files it imports have no dependencies.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { locations } from '../WLR Location Photos Webapp/src/data/locations.js';
import { TYPE_FULL } from '../WLR Location Photos Webapp/src/data/brands.js';

// Paths are relative to this file, so it runs from any working directory.
const here = p => fileURLToPath(new URL(p, import.meta.url));
const OUT_RATINGS = here('../WLR Location Photos Webapp/public/ratings.json');
const CACHE_IDS   = here('./place-ids.json');
const SHOWN_OUT   = 'WLR Location Photos Webapp/public/ratings.json';

const DRY_RUN = process.argv.includes('--dry-run');

// "street, city, ST" for the Text Search query (ZIP dropped). Only used the
// first time a location is seen — after that its Place ID comes from the cache.
function searchAddress(loc) {
  const a = (loc.addr || '').trim().replace(/\s+\d{5}(-\d{4})?$/, '').replace(/[,\s]+$/, '');
  if (/,\s*[A-Z]{2}$/.test(a)) return a;                     // already ends in a state
  return [a, loc.city, loc.state].filter(Boolean).join(', ');
}

// [num, type, "street, city, ST"] for every opened, non-hidden location — the
// same test the gallery uses for "Coming Soon" (an empty `opened`).
const LOCS = locations
  .filter(l => l.opened && !l.hidden)
  .sort((a, b) => a.num - b.num)
  .map(l => [l.num, l.type, searchAddress(l)]);

const cache = existsSync(CACHE_IDS) ? JSON.parse(readFileSync(CACHE_IDS, 'utf8')) : {};

if (DRY_RUN) {
  for (const [num, type, addr] of LOCS) {
    const how = cache[num] ? `cached ${cache[num]}` : 'NEW — will search';
    console.log(`#${num}\t${how}\t${TYPE_FULL[type]} ${addr}`);
  }
  const fresh = LOCS.filter(([num]) => !cache[num]).length;
  console.log(`\n${LOCS.length} locations would be rated, ${fresh} needing a first-time search.`);
  console.log('Dry run: no requests made, nothing written.');
  process.exit(0);
}

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY is not set.');
  process.exit(1);
}

async function searchPlace(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}: ${await res.text()}`);
  return (await res.json()).places?.[0] || null;
}

async function placeDetails(id) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount',
    },
  });
  if (!res.ok) throw new Error(`details ${res.status}: ${await res.text()}`);
  return res.json();
}

const ratings = {};
let ok = 0, miss = 0, firstError = null;
for (const [num, type, addr] of LOCS) {
  try {
    let p;
    if (cache[num]) {
      p = await placeDetails(cache[num]);
    } else {
      p = await searchPlace(`${TYPE_FULL[type]} ${addr}`);
      if (p) { cache[num] = p.id; }
    }
    if (p && typeof p.rating === 'number') {
      ratings[num] = { r: p.rating, n: p.userRatingCount || 0, id: p.id, name: p.displayName?.text || '' };
      console.log(`#${num}  ${p.rating}★ (${p.userRatingCount || 0})  ${p.displayName?.text || ''} — ${p.formattedAddress || ''}`);
      ok++;
    } else {
      console.warn(`#${num}  no rating found for "${TYPE_FULL[type]} ${addr}"`);
      miss++;
    }
  } catch (e) {
    if (!firstError) firstError = e.message;
    console.warn(`#${num}  error: ${e.message}`);
    miss++;
  }
}

// Fail the run (red status) if nothing came back, so a misconfigured key is obvious.
if (ok === 0) {
  console.error('\n================ NO RATINGS RETRIEVED ================');
  console.error('First error:\n' + (firstError || 'requests succeeded but returned no places'));
  console.error('\nMost likely causes:');
  console.error('  1. "Places API (New)" is not enabled on the project (enabling legacy "Places API" is NOT enough).');
  console.error('  2. Billing is not active on the Google Cloud project.');
  console.error('  3. The API key has an "Application restriction" of "HTTP referrers" — server-side');
  console.error('     calls from GitHub have no referer and get blocked. Set Application restriction to');
  console.error('     "None" (or "IP addresses"), and keep the API restriction limited to "Places API (New)".');
  console.error('=====================================================');
  process.exit(1);
}

ratings._updated = new Date().toISOString().slice(0, 10);
writeFileSync(OUT_RATINGS, JSON.stringify(ratings) + '\n');
writeFileSync(CACHE_IDS, JSON.stringify(cache, null, 1) + '\n');
console.log(`\nDone: ${ok} ratings written, ${miss} missing → ${SHOWN_OUT}`);
