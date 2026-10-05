import { locations } from '../data/locations.js';
import { TYPE_FULL } from '../data/brands.js';
import { MGMT } from '../data/team.js';
import { pad, esc } from './util.js';
import { getLocInfo } from './store.js';

// ══ TEAM MODAL ════════════════════════════════════════════
// Reached from the card's inline onclick, so app.js puts openTeam on window.
export function openTeam(num) {
  const baseLoc = locations.find(l => l.num === num);
  if (!baseLoc) return;
  const info = getLocInfo(num);
  const loc  = { ...baseLoc, ...info };
  const displayNum = loc.numOverride || loc.num;
  const m = MGMT[num] || {};

  function singleRow(role, name) {
    const isEmpty = !name;
    const display = isEmpty ? 'Not Assigned' : esc(name);
    return `<div class="team-row"><div class="team-role">${esc(role)}</div><div class="team-name${isEmpty ? ' open' : ''}">${display}</div></div>`;
  }
  function multiRow(role, names) {
    if (!names || names.length === 0) return '';
    const html = names.map(n => `<div class="team-name${n === 'Open' ? ' open' : ''}">${n === 'Open' ? 'Open Position' : esc(n)}</div>`).join('');
    return `<div class="team-row"><div class="team-role">${esc(role)}</div>${html}</div>`;
  }

  const amLabel  = (m.am  && m.am.length  > 1) ? 'Assistant Managers' : 'Assistant Manager';
  const supLabel = (m.sup && m.sup.length > 1)  ? 'Supervisors' : 'Supervisor';

  document.getElementById('teamPanelTitle').textContent    = `#${pad(displayNum)} ${loc.name}`;
  document.getElementById('teamPanelSubtitle').textContent = `${loc.city}, ${loc.state}  ·  ${TYPE_FULL[loc.type]}`;
  document.getElementById('teamPanelBody').innerHTML =
    singleRow('Managing Partner', m.mp || null) +
    singleRow('District Manager', m.dm || null) +
    (Array.isArray(m.lm) ? multiRow('Location Managers', m.lm) : singleRow('Location Manager', m.lm || null)) +
    (m.am && m.am.length > 0 ? multiRow(amLabel, m.am) : singleRow('Assistant Manager', null)) +
    (m.sup && m.sup.length > 0 ? multiRow(supLabel, m.sup) : '');

  document.getElementById('teamOverlay').classList.add('open');
  document.getElementById('teamPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}
export function closeTeam() {
  document.getElementById('teamOverlay').classList.remove('open');
  document.getElementById('teamPanel').classList.remove('open');
  document.body.style.overflow = '';
}
export function initTeamModal() {
  document.getElementById('teamOverlay').addEventListener('click', closeTeam);
  document.getElementById('teamClose').addEventListener('click', closeTeam);
}
