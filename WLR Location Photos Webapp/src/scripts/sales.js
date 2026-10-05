import { ic } from '../lib/icons.js';
import { fmtMoney, fmtMoneyTick, niceMax } from './util.js';

// ══ WEEKLY SALES & WEATHER (live from the WLR Bonus Tracker) ═
// Weekly Sales & Weather visibility. Set to false to hide the 📊 button and the
// dashboard entirely (no sales data is even fetched) — used for external demos.
const SHOW_SALES = true;

const SW = { state: null, weather: null, fetchedAt: 0, metric: 'total', weeks: 52 };
const SW_CAT = {
  hot:      { icon: 'sun',   color: '#f5a623', label: 'Hot' },
  rain:     { icon: 'rain',  color: '#4a9fe0', label: 'Rain' },
  snow:     { icon: 'snow',  color: '#9fd3ff', label: 'Snow' },
  moderate: { icon: 'cloud', color: '#6bbf6b', label: 'Mild' },
};
function swCat(c) { return SW_CAT[c] || { icon: '·', color: '#5a6472', label: '—' }; }
const SW_MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SW_SEG = [['Lube','lube','#FADC00'],['Repair','repair','#8a9099'],['Spa','spa','#1d5fa8'],['Express','express','#4a9fe0']];

async function swLoad(force) {
  if (SW.state && SW.weather && (Date.now() - SW.fetchedAt < 300000) && !force) return true;
  try {
    const [s, w] = await Promise.all([
      fetch('https://wlr-bonus-tracker.vercel.app/state.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('https://wlr-bonus-tracker.vercel.app/weather.json', { cache: 'no-store' }).then(r => r.json()),
    ]);
    SW.state = s; SW.weather = w; SW.fetchedAt = Date.now();
    return true;
  } catch (e) { return false; }
}
function swRows() {
  const wk = (SW.state && SW.state.weekly) || [];
  const wm = (SW.weather && SW.weather.weeks) || {};
  return wk.filter(w => typeof w.total === 'number').map(w => ({ ...w, weather: wm[w.date] || null }));
}
// Pageout date D → the sales week it covers (Mon D-7 through Sun D-1)
function swWeekLabel(dateStr, withYear) {
  const d = new Date(dateStr + 'T00:00:00');
  const s = new Date(d); s.setDate(d.getDate() - 7);
  const e = new Date(d); e.setDate(d.getDate() - 1);
  const base = s.getMonth() === e.getMonth()
    ? `${SW_MO[s.getMonth()]} ${s.getDate()}–${e.getDate()}`
    : `${SW_MO[s.getMonth()]} ${s.getDate()} – ${SW_MO[e.getMonth()]} ${e.getDate()}`;
  return withYear ? `${base}, ${e.getFullYear()}` : base;
}
function swMetricVal(r, m) { return m === 'wash' ? (r.spa || 0) + (r.express || 0) : (r.total || 0); }
// Nearest weekly entry to ~1 year before the given pageout date (null if none within ~2 weeks — e.g. the 2025 gap)
function swYearAgo(all, dateStr) {
  const t = new Date(dateStr + 'T00:00:00'); t.setFullYear(t.getFullYear() - 1);
  const tt = t.getTime();
  let best = null, bestDiff = Infinity;
  for (const e of all) { const d = Math.abs(new Date(e.date + 'T00:00:00').getTime() - tt); if (d < bestDiff) { bestDiff = d; best = e; } }
  return best && bestDiff <= 14 * 86400000 ? best : null;
}

async function openSales() {
  if (!SHOW_SALES) return; // hidden — never opens, and no sales data is fetched
  document.getElementById('swOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!(SW.state && SW.weather)) {
    document.getElementById('swBody').innerHTML = '<div class="sw-loading">Loading sales &amp; weather…</div>';
    if (!await swLoad()) { document.getElementById('swBody').innerHTML = '<div class="sw-loading">Couldn’t load the data — check your connection and try again.</div>'; return; }
  } else { swLoad(); } // refresh in background if stale
  renderSales();
}
export function closeSales() { document.getElementById('swOverlay').classList.remove('open'); document.body.style.overflow = ''; }

function renderSales() {
  const body = document.getElementById('swBody');
  const all = swRows();
  if (!all.length) { body.innerHTML = '<div class="sw-loading">No sales data available.</div>'; return; }
  const rows = SW.weeks >= 999 ? all : all.slice(-SW.weeks);
  const latest = all[all.length - 1];
  // Selected week drives the hero card (defaults to latest; click a bar to change)
  const selDate = (SW.selectedDate && all.some(r => r.date === SW.selectedDate)) ? SW.selectedDate : latest.date;
  const selIdx = all.findIndex(r => r.date === selDate);
  const sel = all[selIdx], prev = selIdx > 0 ? all[selIdx - 1] : null, isLatest = selDate === latest.date;

  const lw = sel.weather, cat = swCat(lw && lw.category);
  // Hero headline follows the charted metric so it matches the highlighted bar
  const mv = r => SW.metric === 'wash' ? ((r.spa || 0) + (r.express || 0)) : (r.total || 0);
  const bigVal = mv(sel);
  const metricLbl = SW.metric === 'wash' ? 'Car wash · Spa + Express' : (SW.metric === 'seg' ? 'Total · all segments' : 'Total sales');
  const wow = prev ? ((bigVal - mv(prev)) / mv(prev) * 100) : null;
  const wowHtml = wow === null ? '' : `<span class="sw-wow ${wow >= 0 ? 'up' : 'down'}">${ic(wow >= 0 ? 'caret-up' : 'caret-down', 'ico--fill')}${Math.abs(wow).toFixed(1)}% vs prior wk</span>`;
  const yoyEntry = swYearAgo(all, sel.date);
  const yoy = yoyEntry ? ((bigVal - mv(yoyEntry)) / mv(yoyEntry) * 100) : null;
  const yoyHtml = yoy === null ? '' : `<span class="sw-wow ${yoy >= 0 ? 'up' : 'down'}">${ic(yoy >= 0 ? 'caret-up' : 'caret-down', 'ico--fill')}${Math.abs(yoy).toFixed(1)}% vs last yr</span>`;
  const hero = `
    <div class="sw-hero">
      <div class="sw-hero-main">
        <div class="sw-hero-wk">${isLatest ? 'Latest pageout' : 'Pageout'} · week of ${swWeekLabel(sel.date, true)}${isLatest ? '' : ` <button class="sw-reset" id="swReset">${ic('undo')}Latest</button>`}</div>
        <div class="sw-hero-metric">${metricLbl}</div>
        <div class="sw-hero-total">$${Math.round(bigVal).toLocaleString()}</div>
        <div class="sw-deltas">${wowHtml}${yoyHtml}</div>
        <div class="sw-segs">${SW_SEG.map(([lbl, k, c]) => `<div class="sw-seg${SW.metric === 'wash' ? ((k === 'spa' || k === 'express') ? '' : ' off') : ''}"><span class="sw-seg-dot" style="background:${c}"></span><span class="sw-seg-lbl">${lbl}</span><span class="sw-seg-val">${fmtMoney(sel[k] || 0)}</span></div>`).join('')}</div>
      </div>
      <div class="sw-hero-wx" style="border-color:${cat.color}66">
        <div class="sw-wx-icon">${ic(cat.icon)}</div>
        <div class="sw-wx-cat" style="color:${cat.color}">${lw ? cat.label : 'Weather pending'}</div>
        ${lw ? `<div class="sw-wx-det">${Math.round(lw.avgHigh)}° / ${Math.round(lw.avgLow)}°<br>${lw.precipIn}" precip${lw.snowIn > 0 ? ` · ${lw.snowIn}" snow` : ''}</div>` : ''}
      </div>
    </div>`;

  const metricBtns = [['total','Total'],['wash','Car Wash'],['seg','By Segment']]
    .map(([m, l]) => `<button class="sw-tab ${SW.metric === m ? 'active' : ''}" data-metric="${m}">${l}</button>`).join('');
  const rangeBtns = [[26,'26w'],[52,'1yr'],[999,'All']]
    .map(([nw, l]) => `<button class="sw-tab ${SW.weeks === nw ? 'active' : ''}" data-weeks="${nw}">${l}</button>`).join('');
  const toggles = `<div class="sw-toggles"><div class="sw-tabs">${metricBtns}</div><div class="sw-tabs">${rangeBtns}</div></div>`;

  const legend = SW.metric === 'seg'
    ? `<div class="sw-legend">${SW_SEG.map(([l, , c]) => `<span class="sw-leg"><span class="sw-leg-sw" style="background:${c}"></span>${l}</span>`).join('')}</div>`
    : `<div class="sw-legend">${Object.values(SW_CAT).map(v => `<span class="sw-leg"><span class="sw-leg-sw" style="background:${v.color}"></span>${ic(v.icon)}${v.label}</span>`).join('')}</div>`;

  const upd = SW.weather && SW.weather.updated;
  const sc = body.scrollTop;
  body.innerHTML = hero + toggles + swChart(rows, SW.metric, selDate) + legend +
    `<div class="sw-foot">Weekly gross sales joined to that week’s weather${upd ? ` · data through ${upd}` : ''}. ${SW.metric === 'seg' ? 'Bars stacked by segment.' : 'Bars colored by weather category — car-wash revenue (Spa + Express) tracks the weather.'} Tap a week to load it above.</div>`;
  body.scrollTop = sc;

  body.querySelectorAll('.sw-tab[data-metric]').forEach(b => b.addEventListener('click', () => { SW.metric = b.dataset.metric; renderSales(); }));
  body.querySelectorAll('.sw-tab[data-weeks]').forEach(b => b.addEventListener('click', () => { SW.weeks = +b.dataset.weeks; renderSales(); }));
  body.querySelectorAll('.sw-chart .tl-hit').forEach(h => h.addEventListener('click', () => { SW.selectedDate = h.dataset.date; renderSales(); }));
  const rb = document.getElementById('swReset'); if (rb) rb.addEventListener('click', e => { e.stopPropagation(); SW.selectedDate = null; renderSales(); });
}

function swChart(rows, metric, selDate) {
  const W = 1000, H = 380, padL = 52, padR = 14, padT = 16, padB = 32;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB, plotW = px1 - px0, plotH = py1 - py0;
  const n = rows.length, colW = plotW / n;
  const maxV = Math.max(...rows.map(r => metric === 'seg' ? (r.total || 0) : swMetricVal(r, metric)), 1);
  const yMax = niceMax(maxV);
  const yOf = v => py1 - (v / yMax) * plotH, xOf = i => px0 + i * colW;
  const selI = rows.findIndex(r => r.date === selDate);
  const hl = selI < 0 ? '' : `<rect x="${xOf(selI).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}" fill="rgba(255,255,255,0.1)"/><rect x="${xOf(selI).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="2.5" fill="#FADC00"/>`;
  let grid = '';
  for (let g = 0; g <= 5; g++) { const v = yMax / 5 * g, yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/><text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${fmtMoneyTick(Math.round(v))}</text>`; }
  let bars = '';
  rows.forEach((r, i) => {
    const x = xOf(i) + colW * 0.14, bw = colW * 0.72;
    if (metric === 'seg') {
      let base = 0;
      SW_SEG.forEach(([, k, c]) => { const v = r[k] || 0; if (!v) return; const yT = yOf(base + v), yB = yOf(base); bars += `<rect x="${x.toFixed(1)}" y="${yT.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, yB - yT).toFixed(1)}" fill="${c}"/>`; base += v; });
    } else {
      const v = swMetricVal(r, metric), col = swCat(r.weather && r.weather.category).color, yT = yOf(v), yB = yOf(0);
      bars += `<rect x="${x.toFixed(1)}" y="${yT.toFixed(1)}" width="${bw.toFixed(1)}" height="${(yB - yT).toFixed(1)}" fill="${col}" rx="0.5"/>`;
    }
    const wx = r.weather, c = swCat(wx && wx.category);
    const tip = `${swWeekLabel(r.date, true)}  ·  ${metric === 'wash' ? 'Wash ' + fmtMoney(swMetricVal(r, 'wash')) : fmtMoney(r.total)}${wx ? `  ·  ${c.label} ${Math.round(wx.avgHigh)}°/${Math.round(wx.avgLow)}°` : ''}`;
    bars += `<rect class="tl-hit" data-date="${r.date}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"><title>${tip}</title></rect>`;
  });
  let xlab = '', lastMo = null;
  const step = n > 60 ? 3 : n > 34 ? 2 : 1;
  rows.forEach((r, i) => {
    const e = new Date(r.date + 'T00:00:00'); e.setDate(e.getDate() - 1);
    const mo = e.getMonth();
    if (mo !== lastMo) { lastMo = mo; if (mo % step === 0) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 15).toFixed(1)}">${SW_MO[mo]}${mo === 0 ? ` ’${String(e.getFullYear()).slice(2)}` : ''}</text>`; }
  });
  return `<svg class="tl-chart sw-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly WLR sales by weather">${grid}${hl}${bars}${xlab}</svg>`;
}

export function initSales() {
  if (SHOW_SALES) {
    document.getElementById('swOpenBtn').addEventListener('click', openSales);
  } else {
    // Remove the only entry point. The (empty) overlay markup stays in place so
    // closeSales()/goHome()/Esc keep working, but openSales() refuses to open it
    // and no sales or weather data is ever fetched.
    document.getElementById('swOpenBtn').remove();
  }
  document.getElementById('swClose').addEventListener('click', closeSales);
}
