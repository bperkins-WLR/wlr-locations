#!/usr/bin/env node
/*
 * Fetches the live Google rating + review count for each WLR location via the
 * Google Places API (New) and writes them to ratings.json, which the static
 * site reads at load time.
 *
 * Requires environment variable GOOGLE_PLACES_API_KEY (a key with the
 * "Places API (New)" enabled and billing active on the Google Cloud project).
 *
 * Place IDs are discovered once via Text Search and cached in tools/place-ids.json
 * so subsequent runs use the cheaper, stable Place Details lookup. If a cached
 * Place ID is ever wrong, delete that entry (or fix it) and re-run.
 *
 * Run locally:   GOOGLE_PLACES_API_KEY=xxx node tools/fetch-ratings.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY is not set.');
  process.exit(1);
}

const OUT_RATINGS = 'WLR Location Photos Webapp/ratings.json';
const CACHE_IDS   = 'tools/place-ids.json';

const BRAND = {
  TLC: 'The Lube Center', TAS: 'The Auto Spa',
  TASE: 'The Auto Spa Express', TAR: 'The Auto Repair',
};

// [num, type, "street, city, ST"] — the open/active locations that have a
// Google Business listing. Coming-soon sites are intentionally excluded.
const LOCS = [
  [1,  'TLC',  '1395 West Patrick Street, Frederick, MD'],
  [2,  'TLC',  '5715 Buckeystown Pike, Frederick, MD'],
  [3,  'TLC',  '9225 Berger Road, Columbia, MD'],
  [4,  'TAR',  '1395 West Patrick Street, Frederick, MD'],
  [5,  'TLC',  '10007 Fields Road, Gaithersburg, MD'],
  [6,  'TAS',  '1509 Garrett Dr, Frederick, MD'],
  [7,  'TLC',  '7691 Arundel Mills Blvd, Hanover, MD'],
  [8,  'TAS',  '20440 Germantown Road, Germantown, MD'],
  [9,  'TLC',  '11612 Middlebrook Road, Germantown, MD'],
  [10, 'TAR',  '672 State Route 3 North, Gambrills, MD'],
  [11, 'TLC',  '676 State Route 3 North, Gambrills, MD'],
  [12, 'TLC',  '421 South Jefferson Street, Frederick, MD'],
  [13, 'TLC',  '19550 Frederick Road, Germantown, MD'],
  [14, 'TAS',  '680 State Route 3 North, Gambrills, MD'],
  [15, 'TLC',  '13559 Baltimore Avenue, Laurel, MD'],
  [16, 'TLC',  '16327 Caprice Court, New Freedom, PA'],
  [17, 'TLC',  '1195 Loucks Road, York, PA'],
  [18, 'TAS',  '2266 Solomons Island Road, Huntingtown, MD'],
  [19, 'TASE', '1615 East Churchville Road, Bel Air, MD'],
  [21, 'TASE', '5718 Buckeystown Pike, Frederick, MD'],
  [22, 'TLC',  '7740 Annapolis Road, Lanham, MD'],
  [23, 'TASE', '2415 Monocacy Blvd, Frederick, MD'],
  [24, 'TASE', '2140 York Crossing Drive, York, PA'],
  [25, 'TASE', '1610 Ritchie Station Court, Capitol Heights, MD'],
  [26, 'TASE', '3504 Washington Blvd, Halethorpe, MD'],
  [27, 'TASE', '1524 Annapolis Road, Odenton, MD'],
  [28, 'TASE', '960 Foxcroft Avenue, Martinsburg, WV'],
  [31, 'TASE', '7682 Arundel Mills Blvd, Hanover, MD'],
  [32, 'TASE', '1620 Wesel Boulevard, Hagerstown, MD'],
  [35, 'TASE', '1412 Merritt Blvd, Dundalk, MD'],
];

const cache = existsSync(CACHE_IDS) ? JSON.parse(readFileSync(CACHE_IDS, 'utf8')) : {};

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
      p = await searchPlace(`${BRAND[type]} ${addr}`);
      if (p) { cache[num] = p.id; }
    }
    if (p && typeof p.rating === 'number') {
      ratings[num] = { r: p.rating, n: p.userRatingCount || 0, id: p.id, name: p.displayName?.text || '' };
      console.log(`#${num}  ${p.rating}★ (${p.userRatingCount || 0})  ${p.displayName?.text || ''} — ${p.formattedAddress || ''}`);
      ok++;
    } else {
      console.warn(`#${num}  no rating found for "${BRAND[type]} ${addr}"`);
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
console.log(`\nDone: ${ok} ratings written, ${miss} missing → ${OUT_RATINGS}`);
