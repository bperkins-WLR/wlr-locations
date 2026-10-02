import { HOURS } from '../data/hours.js';
import { ic } from '../lib/icons.js';
import { esc, nowET } from './util.js';
import { isPermClosed } from './store.js';

// ══ OPENING HOURS ═════════════════════════════════════════
// Live open/closed status, the weekly schedule and the Call button, all read
// from data/hours.js and adjusted for the company holiday schedule below.

const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtHr(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  let hr = Math.floor(h) % 12; if (hr === 0) hr = 12;
  const min = Math.round((h - Math.floor(h)) * 60);
  return min ? `${hr}:${String(min).padStart(2,'0')} ${ap}` : `${hr} ${ap}`;
}

/* ══ HOLIDAY SCHEDULE ═══════════════════════════════════════
   Company-wide, confirmed by Brice in September 2026: closed all day on the
   seven holidays below, and closing at 4pm on the two eves. Dates are derived
   per year rather than listed, so this never needs maintaining — Easter,
   Memorial Day, Labor Day and Thanksgiving all move.

   Before this existed the app read open/closed purely off the weekly
   schedule, so it showed every location Open on Thanksgiving. */
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function nthDow(y, month, dow, n) {          // n-th <dow> of the month
  const first = new Date(y, month, 1);
  return new Date(y, month, 1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7);
}
function lastDow(y, month, dow) {            // last <dow> of the month
  const last = new Date(y, month + 1, 0);
  return new Date(y, month, last.getDate() - ((last.getDay() - dow + 7) % 7));
}
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const HOLIDAY_CACHE = {};
function holidayCalendar(y) {
  if (HOLIDAY_CACHE[y]) return HOLIDAY_CACHE[y];
  const cal = {};
  const put = (d, v) => { cal[dayKey(d)] = v; };
  put(new Date(y, 0, 1),    { name: "New Year's Day",  closed: true });
  put(easterSunday(y),      { name: 'Easter',          closed: true });
  put(lastDow(y, 4, 1),     { name: 'Memorial Day',    closed: true });
  put(new Date(y, 6, 4),    { name: 'July 4th',        closed: true });
  put(nthDow(y, 8, 1, 1),   { name: 'Labor Day',       closed: true });
  put(nthDow(y, 10, 4, 4),  { name: 'Thanksgiving',    closed: true });
  put(new Date(y, 11, 25),  { name: 'Christmas',       closed: true });
  put(new Date(y, 11, 24),  { name: 'Christmas Eve',   closeAt: 16 });
  put(new Date(y, 11, 31),  { name: "New Year's Eve",  closeAt: 16 });
  return (HOLIDAY_CACHE[y] = cal);
}
function holidayOn(d) { return holidayCalendar(d.getFullYear())[dayKey(d)] || null; }

/* Holidays falling in the next `days` days, for the expanded hours panel. */
function upcomingHolidays(days = 14) {
  const out = [], n = nowET();
  for (let i = 0; i <= days; i++) {
    const d = new Date(n); d.setDate(d.getDate() + i);
    const h = holidayOn(d);
    if (h) out.push({ ...h, when: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAY_ABBR[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}` });
  }
  return out;
}

// Live open/closed status for a location number (null if no hours on file)
export function hoursStatus(num) {
  if (isPermClosed(num)) return null;
  const H = HOURS[num]; if (!H) return null;
  const n = nowET(), day = n.getDay(), cur = n.getHours() + n.getMinutes() / 60;

  const hol = holidayOn(n);
  if (hol && hol.closed) return { open: false, detail: `Closed for ${hol.name}`, holiday: hol.name };

  // An eve closes early, so cap today's closing time rather than replacing it.
  let today = H.d[day];
  if (today && hol && hol.closeAt) today = [today[0], Math.min(today[1], hol.closeAt)];

  if (today && cur >= today[0] && cur < today[1]) {
    return { open: true, detail: `Closes ${fmtHr(today[1])}`, holiday: hol ? hol.name : null };
  }
  if (today && cur < today[0]) return { open: false, detail: `Opens ${fmtHr(today[0])}` };

  // Look ahead by real dates, skipping any day the company is closed.
  for (let i = 1; i <= 8; i++) {
    const dt = new Date(n); dt.setDate(dt.getDate() + i);
    const h2 = holidayOn(dt);
    if (h2 && h2.closed) continue;
    const slot = H.d[dt.getDay()];
    if (slot) return { open: false, detail: `Opens ${fmtHr(slot[0])} ${i === 1 ? 'tomorrow' : DAY_ABBR[dt.getDay()]}` };
  }
  return { open: false, detail: 'Closed' };
}

// Group the week (Mon-first) into ranges of identical hours for display
function formatWeek(num) {
  const H = HOURS[num]; if (!H) return [];
  const order = [1,2,3,4,5,6,0]; // Mon..Sun
  const key = s => s ? `${s[0]}-${s[1]}` : 'x';
  const rows = []; let i = 0;
  while (i < order.length) {
    const slot = H.d[order[i]]; let j = i;
    while (j + 1 < order.length && key(H.d[order[j+1]]) === key(slot)) j++;
    const lbl = i === j ? DAY_ABBR[order[i]] : `${DAY_ABBR[order[i]]}–${DAY_ABBR[order[j]]}`;
    rows.push({ label: lbl, time: slot ? `${fmtHr(slot[0])}–${fmtHr(slot[1])}` : 'Closed' });
    i = j + 1;
  }
  return rows;
}

export function hoursBlockHtml(num) {
  const st = hoursStatus(num); if (!st) return '';
  const week = formatWeek(num).map(r =>
    `<div class="hw-row"><span class="hw-day">${r.label}</span><span class="hw-time${r.time==='Closed'?' hw-closed':''}">${r.time}</span></div>`).join('')
    + upcomingHolidays().map(h =>
    `<div class="hw-row hw-hol"><span class="hw-day">${esc(h.name)}</span><span class="hw-time${h.closed?' hw-closed':''}">${h.closed ? 'Closed' : `Closes ${fmtHr(h.closeAt)}`}</span></div>`).join('');
  return `
    <div class="loc-hours">
      <button class="hrs-toggle" onclick="event.stopPropagation(); this.parentElement.classList.toggle('open')">
        <span class="hrs-dot ${st.open ? 'is-open' : 'is-closed'}"></span>
        <span class="hrs-state ${st.open ? 'is-open' : 'is-closed'}">${st.open ? 'Open' : 'Closed'}</span>
        <span class="hrs-detail">${st.detail}</span>
        <span class="hrs-caret">${ic('chevron-down')}</span>
      </button>
      <div class="hrs-week">${week}</div>
    </div>`;
}

export function callBtnHtml(num) {
  if (isPermClosed(num)) return '';
  const H = HOURS[num]; if (!H || !H.p) return '';
  return `<a class="loc-call" href="tel:${H.p.replace(/[^0-9]/g,'')}" onclick="event.stopPropagation()">${ic('phone')}Call</a>`;
}
