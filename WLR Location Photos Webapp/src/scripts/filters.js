import { state } from './state.js';
import { render, renderWithTransition } from './grid.js';

// ══ FILTER / SORT / SEARCH ════════════════════════════════
const stateSelect = document.getElementById('stateSelect');
const searchInput = document.getElementById('search');
const searchClear = document.getElementById('searchClear');

export function initFilters() {
  document.getElementById('filterRow').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'pop'));
    btn.classList.add('active');
    // Pop animation restart trick
    void btn.offsetWidth;
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
    state.activeFilter = btn.dataset.type;
    renderWithTransition();
  });
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSort = btn.dataset.sort;
      const isByState = state.activeSort === 'state';
      stateSelect.classList.toggle('show', isByState);
      if (!isByState) { state.activeState = ''; stateSelect.value = ''; }
      renderWithTransition();
    });
  });
  stateSelect.addEventListener('change', () => {
    state.activeState = stateSelect.value;
    renderWithTransition();
  });
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value.trim();
    searchClear.style.display = state.searchQuery ? 'block' : 'none';
    render(); // search: no fade (instant feedback feels better)
  });
  searchClear.addEventListener('click', () => {
    searchInput.value=''; state.searchQuery=''; searchClear.style.display='none'; renderWithTransition();
  });
}

/* Back to All / By # / no state / no search — the controls and the state
   together. Used by the header home button. */
export function resetFilters() {
  state.activeFilter = 'ALL'; state.activeSort = 'num'; state.activeState = ''; state.searchQuery = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'ALL'));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'num'));
  stateSelect.value = ''; stateSelect.classList.remove('show');
  searchInput.value = ''; searchClear.style.display = 'none';
}
