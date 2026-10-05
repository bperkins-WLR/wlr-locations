import { locations } from '../data/locations.js';
import { GROWTH } from '../data/growth.js';
import { ic } from '../lib/icons.js';
import { NOW_YEAR, fmtMoney, fmtMoneyTick, fmtCount, fmtCountTick, niceMax } from './util.js';
import { isLocVisible } from './store.js';
import { state } from './state.js';

// ══ GROWTH TIMELINE ════════════════════════════════════════
const TL_COLOR = { TLC:'#FADC00', TAR:'#8a9099', TAS:'#1d5fa8', TASE:'#4a9fe0' };
const TL_LABEL = { TLC:'Lube Centers', TAR:'Auto Repair', TAS:'Auto Spas', TASE:'Auto Spa Express' };
const TL_ORDER = ['TLC','TAR','TAS','TASE']; // stack order, bottom → top (oldest brand first)


let growthMetric = 'rev'; // 'rev' | 'cars' | 'loc'

const GROWTH_META = {
  rev:  { idx:1, label:'Annual Revenue', color:'#FADC00', fmt:fmtMoney, tick:fmtMoneyTick, note:'Annual revenue by year — 2020 dip reflects COVID; 2026 is projected.' },
  cars: { idx:0, label:'Cars Serviced',  color:'#4a9fe0', fmt:fmtCount, tick:fmtCountTick, note:'Cars serviced per year — 2026 is projected.' },
};

function timelineData() {
  const { activeFilter, activeState } = state;
  const qualifies = l => isLocVisible(l) && l.ts < 20991231 &&
    (activeFilter === 'ALL' || l.type === activeFilter) &&
    (!activeState || l.state === activeState);
  const items = locations.filter(qualifies)
    .map(l => ({ year: Math.floor(l.ts / 10000), type: l.type, state: l.state }))
    .filter(l => l.year >= 1980 && l.year <= NOW_YEAR);
  const firstYear = items.length ? Math.min(...items.map(i => i.year)) : 1987;
  const minY = 1987, maxY = NOW_YEAR, years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  const brands = TL_ORDER.filter(b => items.some(i => i.type === b));
  const cum = {};
  brands.forEach(b => { let c = 0; cum[b] = years.map(y => { c += items.filter(i => i.type === b && i.year === y).length; return c; }); });
  const perYear = years.map(y => items.filter(i => i.year === y).length);
  const bMax = Math.max(0, ...perYear), bIdx = perYear.indexOf(bMax);
  return {
    years, brands, cum, perYear, total: items.length, firstYear,
    busiestYear: years[bIdx], busiestCount: bMax,
    statesCount: new Set(items.map(i => i.state)).size,
  };
}

export function renderTimeline() {
  const wrap = document.getElementById('timelineWrap');
  const toggle = `<div class="tl-metric">
    <button class="tlm-btn ${growthMetric==='rev'?'active':''}" data-metric="rev">${ic('dollar')}Revenue</button>
    <button class="tlm-btn ${growthMetric==='cars'?'active':''}" data-metric="cars">${ic('car')}Cars Serviced</button>
    <button class="tlm-btn ${growthMetric==='loc'?'active':''}" data-metric="loc">${ic('pin')}Locations</button>
  </div>`;
  wrap.innerHTML = toggle + (growthMetric === 'loc' ? renderLocationsChart() : renderSeriesChart(growthMetric));
  wrap.querySelectorAll('.tlm-btn').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.metric !== growthMetric) { growthMetric = b.dataset.metric; renderTimeline(); }
  }));
  wireChartTips(wrap);
}

/* Show a year's value on hover (pointer) or tap (touch). Scoped to the growth
   charts; the sales chart has its own click-to-select behaviour. */
function wireChartTips(root) {
  root.querySelectorAll('.tl-chart-wrap').forEach(box => {
    const tip = box.querySelector('.tl-tip');
    if (!tip) return;
    let active = null;
    const hide = () => {
      tip.hidden = true;
      if (active) active.classList.remove('on');
      active = null;
    };
    const show = hit => {
      const hb = hit.getBoundingClientRect(), bb = box.getBoundingClientRect();
      if (active) active.classList.remove('on');
      active = hit; hit.classList.add('on');
      tip.textContent = hit.dataset.tip || '';
      tip.hidden = false;
      // clamp so the tip never hangs off either edge of the chart
      const half = tip.offsetWidth / 2;
      const x = Math.min(Math.max(hb.left - bb.left + hb.width / 2, half + 2), bb.width - half - 2);
      tip.style.left = x + 'px';
      tip.style.top  = Math.max(tip.offsetHeight + 4, hb.top - bb.top + 34) + 'px';
    };
    box.querySelectorAll('.tl-hit').forEach(hit => {
      hit.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(hit); });
      hit.addEventListener('pointerdown',  () => show(hit));   // tap and click-drag
    });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  });
  // a tap anywhere else dismisses it
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest || !e.target.closest('.tl-chart-wrap')) {
      root.querySelectorAll('.tl-tip').forEach(t => {
        t.hidden = true;
        t.parentElement.querySelectorAll('.tl-hit.on').forEach(h => h.classList.remove('on'));
      });
    }
  });
}

// Single-series bar chart for Revenue / Cars Serviced (company-wide; ignores brand/state filters)
function renderSeriesChart(metric) {
  const meta = GROWTH_META[metric];
  const years = Object.keys(GROWTH).map(Number).sort((a, b) => a - b);
  const vals = years.map(y => GROWTH[y][meta.idx]);
  const W = 1000, H = 460, padL = 54, padR = 16, padT = 24, padB = 40;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB;
  const plotW = px1 - px0, plotH = py1 - py0, n = years.length, colW = plotW / n;
  const yMax = niceMax(Math.max(...vals));
  const yOf = v => py1 - (v / yMax) * plotH, xOf = i => px0 + i * colW;
  let grid = '';
  for (let g = 0; g <= 5; g++) {
    const v = yMax / 5 * g, yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/><text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${meta.tick(Math.round(v))}</text>`;
  }
  let cols = '';
  years.forEach((yr, i) => {
    const v = vals[i], yT = yOf(v), yB = yOf(0), proj = yr === 2026, covid = yr === 2020 && metric === 'rev';
    cols += `<rect x="${(xOf(i) + colW * 0.12).toFixed(1)}" y="${yT.toFixed(1)}" width="${(colW * 0.76).toFixed(1)}" height="${(yB - yT).toFixed(1)}" fill="${meta.color}" rx="0.5"${proj ? ' opacity="0.5"' : ''}/>`;
    const tip = `${yr}${proj ? ' (projected)' : ''}${covid ? ' (COVID)' : ''}: ${meta.fmt(v)}`;
    cols += `<rect class="tl-hit" data-tip="${tip}" aria-label="${tip}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"></rect>`;
  });
  let xlab = '';
  years.forEach((yr, i) => {
    const show = yr % 5 === 0 || i === 0 || (i === n - 1 && yr % 5 >= 2);
    if (show) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 17).toFixed(1)}">${yr}</text>`;
  });
  const last = vals[n - 1], endX = Math.min(xOf(n - 1) + colW / 2, px1 - 4);
  const endLabel = `<text class="tl-end" x="${endX.toFixed(1)}" y="${(yOf(last) - 7).toFixed(1)}">${meta.fmt(last)}</text>`;
  const first = vals[0], span = years[n - 1] - years[0];
  const mult = Math.round(last / first), cagr = (Math.pow(last / first, 1 / span) - 1) * 100;
  return `
    <div class="tl-head">
      <h2>Our Growth <span>Since ${years[0]}</span></h2>
      <div class="tl-stats">
        <div class="tl-stat"><span class="tl-num">${meta.fmt(last)}</span><span class="tl-lab">${years[n-1]}${years[n-1]===2026?' proj.':''}</span></div>
        <div class="tl-stat"><span class="tl-num">${mult.toLocaleString()}×</span><span class="tl-lab">Since ${years[0]}</span></div>
        <div class="tl-stat"><span class="tl-num">${cagr.toFixed(0)}%</span><span class="tl-lab">Avg / Yr</span></div>
        <div class="tl-stat"><span class="tl-num">${span + 1}</span><span class="tl-lab">Years</span></div>
      </div>
    </div>
    <div class="tl-chart-wrap">
      <svg class="tl-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="WLR ${meta.label} by year">
        ${grid}${cols}${xlab}${endLabel}
      </svg>
      <div class="tl-tip" hidden></div>
    </div>
    <div class="tl-foot">${meta.note} Tap or hover a year for the value.</div>`;
}

function renderLocationsChart() {
  const d = timelineData();
  if (!d.total) return '<div class="tl-empty">No locations match this filter.</div>';

  const W = 1000, H = 460, padL = 40, padR = 16, padT = 24, padB = 40;
  const px0 = padL, px1 = W - padR, py0 = padT, py1 = H - padB;
  const plotW = px1 - px0, plotH = py1 - py0, n = d.years.length, colW = plotW / n;
  const yMax = Math.max(5, Math.ceil(d.total / 5) * 5);
  const yOf = v => py1 - (v / yMax) * plotH;
  const xOf = i => px0 + i * colW;

  let grid = '';
  for (let g = 0; g <= 5; g++) {
    const v = Math.round((yMax / 5) * g), yy = yOf(v);
    grid += `<line class="tl-grid" x1="${px0}" y1="${yy.toFixed(1)}" x2="${px1}" y2="${yy.toFixed(1)}"/>`;
    grid += `<text class="tl-ylabel" x="${px0 - 7}" y="${(yy + 3.5).toFixed(1)}">${v}</text>`;
  }

  let cols = '';
  d.years.forEach((yr, i) => {
    let base = 0;
    d.brands.forEach(b => {
      const v = d.cum[b][i]; if (!v) return;
      const yT = yOf(base + v), yB = yOf(base);
      cols += `<rect x="${(xOf(i) + colW * 0.10).toFixed(1)}" y="${yT.toFixed(1)}" width="${(colW * 0.80).toFixed(1)}" height="${Math.max(0, yB - yT).toFixed(1)}" fill="${TL_COLOR[b]}" rx="0.5"/>`;
      base += v;
    });
    const tot = d.brands.reduce((s, b) => s + d.cum[b][i], 0);
    const tip = `${yr}: ${tot} location${tot === 1 ? '' : 's'} open`;
    cols += `<rect class="tl-hit" data-tip="${tip}" aria-label="${tip}" x="${xOf(i).toFixed(1)}" y="${py0}" width="${colW.toFixed(1)}" height="${plotH}"></rect>`;
  });

  let xlab = '';
  d.years.forEach((yr, i) => {
    // every 5th year, plus the first and last — but skip the last if it would
    // collide with a nearby multiple-of-5 label (e.g. 2026 next to 2025)
    const show = yr % 5 === 0 || i === 0 || (i === n - 1 && yr % 5 >= 2);
    if (show) xlab += `<text class="tl-xlabel" x="${(xOf(i) + colW / 2).toFixed(1)}" y="${(py1 + 17).toFixed(1)}">${yr}</text>`;
  });

  const endX = Math.min(xOf(n - 1) + colW / 2, px1 - 4), endY = yOf(d.total);
  const endLabel = `<text class="tl-end" x="${endX.toFixed(1)}" y="${(endY - 7).toFixed(1)}">${d.total}</text>`;

  const legend = d.brands.map(b => `<span class="tl-leg"><span class="tl-sw" style="background:${TL_COLOR[b]}"></span>${TL_LABEL[b]}</span>`).join('');

  return `
    <div class="tl-head">
      <h2>Our Growth <span>Since ${d.firstYear}</span></h2>
      <div class="tl-stats">
        <div class="tl-stat"><span class="tl-num">${d.total}</span><span class="tl-lab">Locations</span></div>
        <div class="tl-stat"><span class="tl-num">${NOW_YEAR - d.firstYear}</span><span class="tl-lab">Years</span></div>
        <div class="tl-stat"><span class="tl-num">${d.statesCount}</span><span class="tl-lab">States</span></div>
        <div class="tl-stat"><span class="tl-num">${d.brands.length}</span><span class="tl-lab">Brands</span></div>
      </div>
    </div>
    <div class="tl-legend">${legend}</div>
    <div class="tl-chart-wrap">
      <svg class="tl-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Cumulative WLR locations open by year, ${d.firstYear} to ${NOW_YEAR}">
        ${grid}${cols}${xlab}${endLabel}
      </svg>
      <div class="tl-tip" hidden></div>
    </div>
    <div class="tl-foot">Cumulative locations open each year${d.busiestCount > 1 ? ` · busiest year ${d.busiestYear} (${d.busiestCount} opened)` : ''}. Tap or hover a year for the count.</div>`;
}
