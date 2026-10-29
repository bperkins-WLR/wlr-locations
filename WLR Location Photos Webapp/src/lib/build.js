/* The build stamp, in Eastern time (the whole company is on ET). Server-side
   only: the gallery layout writes it into the HTML as `const BUILD = '…';`
   (the auto-update check on phones from before version.json existed reads it
   from the page) and src/pages/version.json.js serves it to current ones.

   It is the time of the last commit that changed the app, ignoring the daily
   ratings.json commit: ratings are fetched live, so a ratings-only deploy must
   not make every open copy update each morning. Falls back to the build time
   when git isn't available. Vercel clones only recent history, so after a long
   run of ratings-only days git answers with the oldest commit it has, and the
   stamp creeps forward once a day until the next real change: harmless (an
   extra reload), so not worth guarding. BUILD_STAMP in the environment
   overrides it, for testing the auto-update locally. */
import { execFileSync } from 'node:child_process';

function lastAppChange() {
  try {
    const iso = execFileSync('git',
      ['log', '-1', '--format=%cI', '--', '.', ':(exclude)public/ratings.json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return iso ? new Date(iso) : new Date();
  } catch { return new Date(); }
}

export const BUILD = process.env.BUILD_STAMP || new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(lastAppChange());
