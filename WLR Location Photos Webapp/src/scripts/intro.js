import { locations } from '../data/locations.js';
import { NOW_YEAR, animateNum } from './util.js';
import { isLocVisible, isPermClosed } from './store.js';

// ══ HERO COUNTER ANIMATION ═════════════════════════════════
export function initHeroCounter() {
  window.addEventListener('load', () => {
    const yrs = NOW_YEAR - 1987;
    document.getElementById('statYears').textContent = yrs;
    animateNum(document.getElementById('statLocs'),   locations.filter(l => isLocVisible(l) && !isPermClosed(l.num)).length, 800);
    animateNum(document.getElementById('statYears'),  yrs, 1200);
    animateNum(document.getElementById('statStates'), 3, 600);
  });
}

// ══ INTRO SPLASH ══════════════════════════════════════════
// Plays once per session. CSS fades it out on its own; this only adds the
// counter animation, tap-to-skip, and the session flag. (The inline script in
// IntroSplash.astro hides it before first paint on a repeat visit.)
export function initIntro() {
  const intro = document.getElementById('intro');
  if (!intro || intro.classList.contains('intro-off')) return;
  // Someone following a ?loc= link came for that location, not the splash.
  if (new URLSearchParams(location.search).get('loc')) {
    intro.classList.add('intro-off');
    const bg = intro.querySelector('.intro-bg');
    if (bg) { try { bg.pause(); } catch (e) {} bg.remove(); }
    return;
  }
  try { sessionStorage.setItem('wlr_intro_seen', '1'); } catch (e) {}

  document.body.style.overflow = 'hidden';
  const dismiss = () => {
    if (intro.classList.contains('intro-off')) return;
    intro.classList.add('intro-off');
    document.body.style.overflow = '';
    // Stop decoding the background loop once it's off screen (the intro is
    // done for this session, so drop the element entirely)
    const bg = intro.querySelector('.intro-bg');
    if (bg) { try { bg.pause(); } catch (e) {} bg.remove(); }
  };

  // Count up once the stats have faded in
  setTimeout(() => {
    animateNum(document.getElementById('introLocs'),   locations.filter(l => isLocVisible(l) && !isPermClosed(l.num)).length, 1100);
    animateNum(document.getElementById('introYears'),  NOW_YEAR - 1987, 1100);
    animateNum(document.getElementById('introStates'), 3, 900);
  }, 950);

  intro.addEventListener('click', dismiss);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); }, { once: true });
  setTimeout(dismiss, 5400); // after the CSS fade completes
}
