# WLR Location Gallery

The location gallery at https://wlr-locations.vercel.app: photos, hours,
Google ratings, map and management team for every WLR Automotive Group site.
It is built with [Astro](https://astro.build). Each deploy turns the files in
this folder into a plain website.

## The one-list rule

**`src/data/locations.js` is the only list of locations.** The gallery, the
map, the admin page, the share pages and the daily Google-ratings job all read
it. Never keep a second copy of the list anywhere. Change it here and every
part of the site picks the change up on the next deploy.

## Where everything lives

| What | File | Notes |
|---|---|---|
| Stores (name, brand, city, address, opening date, 3D tour, live cam) | `src/data/locations.js` → `locations` | One line per store, keyed by `num`. |
| Map pins | `src/data/locations.js` → `COORDS` | `num: [latitude, longitude]`. |
| Hours and phone numbers | `src/data/hours.js` | `d` runs **Sunday first**. Each day is `[open, close]` in 24-hour time (`[8, 19]` = 8 AM–7 PM, `17.5` = 5:30), or `null` if closed. |
| Management rosters | `src/data/team.js` → `MGMT` | `mp` Managing Partner, `dm` District Manager, `lm` Location Manager, `am` / `sup` lists. |
| Scheduled roster changes | `src/data/team.js` → `ROSTER_CHANGES` | See below. |
| "Our Growth Story" chart | `src/data/growth.js` | `year: [cars serviced, annual revenue]`. |
| Brand names and logos | `src/data/brands.js` | |
| Location photos | `src/assets/locations/loc-NN/` | `01.jpg` exterior, `02.jpg` interior. See `PHOTO-NAMING-GUIDE.txt` there. Just replace the file — the build makes the phone-sized versions and gives them new addresses, so every phone picks up the new photo. |
| Admin page | `src/pages/admin.astro` | |

### Common jobs

- **A store opens.** In `locations.js`, fill in `opened` (e.g. `"September 5, 2026"`)
  and `ts` (the same date as `20260905`). Remove `hidden` and `target`, and
  check `addr`. Make sure it has a `COORDS` entry. Add its hours to
  `hours.js` and its team to `team.js`. Its Google rating appears the next
  morning on its own, with nothing else to update.
- **A store closes.** Add `status:"Permanently Closed"`. It stays on the grid
  for the record but drops out of hours, Call, the store count and the map tour.
- **A future site.** Add it with `opened:""`, `ts:20991231`, `hidden:true`,
  and a `target` such as `"March 2027"`. Use `approx:true` while only the town
  is known.
- **Scheduled roster changes.** An announced transfer can go in
  `ROSTER_CHANGES` ahead of time:
  `{ from: '2026-10-04', num: 2, role: 'am', add: 'Jackson Krasche' }`.
  The person appears on the 2nd location's team from midnight Eastern on that
  date, with no redeploy needed. After the date passes, move the name into
  `MGMT` and delete the entry. The build reminds you about it.
- **Replace a photo.** Overwrite `01.jpg` or `02.jpg` in the store's folder and
  deploy. The build makes the smaller phone-sized versions and the share-card
  images automatically. Photo addresses change whenever the picture changes,
  so phones and home-screen installs show the new photo straight away.
- **Admin page edits** (photos, info, "publish" for hidden sites) are stored
  only in the browser where you make them. To change something for everyone,
  edit the data files.

## The data check

Every build checks the data files first.

- **Errors stop the build.** Examples: a store number used twice, an unknown
  brand, hours that close before they open, map coordinates outside
  MD/PA/WV/VA/DE, or a roster change for a store that doesn't exist. Each
  message names the file, the store and the field. When a build stops, the
  live site keeps the last good version.
- **Warnings** are printed and the build carries on. Examples: a missing ZIP
  code, or a roster change whose date has passed.

Run the check on its own with `npm run check-data`.

## Deploys

- **Vercel builds and publishes automatically** whenever something is pushed to
  `main`. The settings are in `vercel.json`.
- **Every other pushed branch gets its own preview URL**, listed in Vercel and
  on the GitHub commit. Use it to try a change before it goes to `main`.
- You don't run any manual stamping or image tools. The build stamp in the
  footer, the photo versions, the share pages (`l/NN.html`) and their
  preview images (`og/NN.jpg`) are all produced by the build.

## Google ratings

A GitHub Action (`.github/workflows/refresh-ratings.yml`) runs every morning
around 6–7 AM Eastern. It runs `tools/fetch-ratings.mjs`, which:

- rates every store in `locations.js` that has an opening date and isn't hidden
- saves the result to `public/ratings.json`
- commits the file, which triggers a normal Vercel deploy

The job needs the repository secret `GOOGLE_PLACES_API_KEY`. If Google returns
nothing, the job fails (shows red) and keeps the previous ratings. You can run
it by hand from the repository's **Actions** tab ("Run workflow"). To see which
stores it would look up, without a key, run
`node tools/fetch-ratings.mjs --dry-run`.

## Working on it locally

You need Node.js 22.12 or newer. From this folder:

```sh
npm ci              # first time, or after package-lock.json changes
npm run dev         # live preview at http://localhost:4321
npm run check-data  # just the data check
npm run build       # full build into dist/, as Vercel does it
npm run preview     # serve that build locally
```

`tools/scrape-addresses.py` prints the addresses and phone numbers that
washluberepair.com lists, so you can compare them with `locations.js` and
`hours.js`. It doesn't change any files.
