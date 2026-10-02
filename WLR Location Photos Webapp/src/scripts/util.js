// ══ HELPERS ═══════════════════════════════════════════════
// Small, dependency-free helpers shared by every feature module.

export const NOW_YEAR = new Date().getFullYear();

export function pad(n) { return String(n).padStart(2,'0'); }
export function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Current time in the locations' timezone (Eastern), regardless of viewer TZ
export function nowET() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })); }

// Count a stat up from zero — the hero and the intro splash both use it.
export function animateNum(el, target, dur) {
  let s = 0; const step = target / (dur / 16);
  const t = setInterval(() => {
    s = Math.min(s + step, target);
    el.textContent = Math.floor(s);
    if (s >= target) clearInterval(t);
  }, 16);
}

// ══ NUMBER FORMATTING ═════════════════════════════════════
// Shared by the growth charts and the weekly sales chart.
export function fmtMoney(v){ return v>=1e6 ? '$'+(v/1e6).toFixed(1).replace(/\.0$/,'')+'M' : v>=1e3 ? '$'+Math.round(v/1e3)+'K' : '$'+v; }
export function fmtMoneyTick(v){ if(v>=1e6){ const m=v/1e6; return '$'+(m>=10?Math.round(m):(m%1?m.toFixed(1):m))+'M'; } return v>=1e3 ? '$'+Math.round(v/1e3)+'K' : '$'+v; }
export function fmtCount(v){ return v>=1e6 ? (v/1e6).toFixed(2).replace(/\.?0+$/,'')+'M' : v>=1e3 ? Math.round(v/1e3)+'K' : String(v); }
export function fmtCountTick(v){ return v>=1e6 ? (v/1e6).toFixed(1).replace(/\.0$/,'')+'M' : v>=1e3 ? Math.round(v/1e3)+'K' : String(v); }
export function niceMax(v){ const rough=v/5, mag=Math.pow(10,Math.floor(Math.log10(rough))), norm=rough/mag;
  const step=(norm<=1?1:norm<=2?2:norm<=2.5?2.5:norm<=5?5:10)*mag; return Math.ceil(v/step)*step; }
