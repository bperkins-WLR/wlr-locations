import { locations } from '../data/locations.js';
import { MGMT } from '../data/team.js';
import { getLocInfo } from './store.js';

// ══ STATE ══════════════════════════════════════════════════
// What the gallery is currently showing. One shared object rather than
// exported `let`s: an imported binding is read-only, and every module that
// changes the filter, the view or the ratings has to be seen by the others.
export const state = {
  activeFilter: 'ALL', activeSort: 'num', searchQuery: '', activeState: '',
  currentView: 'grid',
  showComingSoon: true, // red "coming soon" pins on the map (map-only, never in grid)
  RATINGS: {},          // num -> { r:rating, n:reviewCount } from ratings.json (refreshed daily)
};

export function getSorted() {
  const { activeSort, RATINGS } = state;
  let list = [...locations];
  if (activeSort === 'num')   list.sort((a,b) => a.num - b.num);
  if (activeSort === 'date')  list.sort((a,b) => a.ts  - b.ts);
  if (activeSort === 'state') list.sort((a,b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
  if (activeSort === 'rating') list.sort((a,b) =>
    ((RATINGS[b.num]?.r ?? -1) - (RATINGS[a.num]?.r ?? -1)) ||
    ((RATINGS[b.num]?.n ?? 0)  - (RATINGS[a.num]?.n ?? 0)));
  return list;
}
/* Every person on a location's roster, flattened for searching. Rosters are
   resynced from the management listing docs, so searching a name is often
   how you find the store rather than the other way round. */
function teamNames(num) {
  const m = MGMT[num];
  if (!m) return '';
  return [m.mp, m.dm, m.lm, ...(m.am || []), ...(m.sup || [])]
    .filter(n => n && n !== 'Open')
    // Rosters carry nicknames as Samantha "Sam" Taylor. Index both the full
    // string and the nickname-free one, so "sam taylor" and "samantha taylor"
    // each find her.
    .flatMap(n => n.includes('"')
      ? [n.replace(/"/g, ''), n.replace(/\s*"[^"]*"\s*/g, ' ')]
      : [n])
    .join(' ');
}

export function matches(baseLoc) {
  const { activeFilter, activeState, searchQuery } = state;
  if (activeFilter !== 'ALL' && baseLoc.type !== activeFilter) return false;
  if (activeState && baseLoc.state !== activeState) return false;
  if (searchQuery) {
    const loc = { ...baseLoc, ...getLocInfo(baseLoc.num) };
    const hay = `${loc.num} ${loc.name} ${loc.city} ${loc.state} ${loc.phone||''} ${loc.notes||''} ${teamNames(baseLoc.num)}`;
    return hay.toLowerCase().includes(searchQuery.toLowerCase());
  }
  return true;
}
