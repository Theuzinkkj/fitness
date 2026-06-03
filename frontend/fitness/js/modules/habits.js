/* ===== ATLASFIT HABITS ===== */

const Habits = (() => {
  const KEY = 'atlasfit_habits';
  let _view = 'today';
  let _items = [];

  const DEFAULTS = [
    { id: uid(), name: 'Treinar', icon: 'B', period: 'TARDE', checks: {}, createdAt: now() },
    { id: uid(), name: 'Dieta no plano', icon: 'D', period: 'NOITE', checks: {}, createdAt: now() },
    { id: uid(), name: '3L de agua', icon: 'A', period: 'DIA', checks: {}, createdAt: now() }
  ];

  async function init() {
    _items = localItems();
    if (!_items.length) _items = DEFAULTS;
    render();
    await syncFromCloud();
  }

  async function syncFromCloud() {
    const res = await FitnessAPI.get('/habits');
    if (!res.ok) return;
    const remote = (res.data || []).map(fromApi);
    if (remote.length) {
      const localOnly = _items.filter(local => !remote.some(r => r.id === local.id || r.name.toLowerCase() === local.name.toLowerCase()));
      if (localOnly.length) await Promise.all(localOnly.map(h => FitnessAPI.post('/habits', toApi(h))));
      _items = [...localOnly, ...remote];
      saveLocal(_items);
      render();
      FitnessApp.updateStreak();
      return;
    }
    if (_items.length) await Promise.all(_items.map(h => FitnessAPI.post('/habits', toApi(h))));
  }

  function render() {
    const wrap = document.getElementById('habitsContent');
    if (!wrap) return;
    const today = FitnessApp.today();
    const completed = _items.filter(h => h.checks?.[today]).length;
    const pct = _items.length ? Math.round(completed / _items.length * 100) : 0;
    wrap.innerHTML = `
      <div class="hero-card">
        <div><span class="card-kicker">Dia vencido.</span><h3>${completed}/${_items.length} concluidos</h3><p>"Vai desistir e chamar isso de saude mental?"</p></div>
        <div class="hero-score">${pct}%</div>
      </div>
      <div class="segmented">
        <button class="${_view === 'today' ? 'active' : ''}" onclick="Habits.setView('today')">Hoje</button>
        <button class="${_view === 'week' ? 'active' : ''}" onclick="Habits.setView('week')">Semana</button>
      </div>
      ${_view === 'week' ? renderWeek() : renderToday()}
      <div class="reward-card">
        <strong>Proxima medalha: RELENTLESS</strong>
        <span>Faltam ${Math.max(0, 30 - getBestStreak())} dias</span>
        <div class="progress-line"><i style="width:${Math.min(100, getBestStreak() / 30 * 100)}%"></i></div>
      </div>`;
  }

  function renderToday() {
    const today = FitnessApp.today();
    return `<div class="card-list">${_items.map(h => `
      <label class="check-card ${h.checks?.[today] ? 'done' : ''}">
        <input type="checkbox" ${h.checks?.[today] ? 'checked' : ''} onchange="Habits.toggle('${h.id}')">
        <span class="fake-check">${h.checks?.[today] ? '✓' : ''}</span>
        <span class="habit-icon">${esc(h.icon || 'H')}</span>
        <span><strong>${esc(h.name)}</strong><small>${esc(h.period || 'DIA')} · streak ${streakFor(h)} dias</small></span>
      </label>`).join('')}</div>`;
  }

  function renderWeek() {
    const days = lastDays(7);
    return `<div class="week-grid">${_items.map(h => `
      <div class="week-card">
        <div><strong>${esc(h.name)}</strong><small>${streakFor(h)} dias de sequencia</small></div>
        <div class="week-dots">${days.map(d => `<button class="${h.checks?.[d] ? 'hit' : ''}" onclick="Habits.toggle('${h.id}','${d}')">${new Date(d + 'T00:00:00').getDate()}</button>`).join('')}</div>
      </div>`).join('')}</div>`;
  }

  function openAdd() {
    FitnessApp.openModal('Novo habito', `
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Nome</label><input id="habitName" class="form-input" placeholder="Ex: Cardio 20min"></div>
        <div class="form-group"><label class="form-label">Icone curto</label><input id="habitIcon" class="form-input" maxlength="2" placeholder="C"></div>
      </div>
      <div class="form-group"><label class="form-label">Periodo</label><select id="habitPeriod" class="form-input"><option>DIA</option><option>MANHA</option><option>TARDE</option><option>NOITE</option></select></div>`,
      [{ label: 'Cancelar', action: 'FitnessApp.closeModal()' }, { label: 'Salvar', action: 'Habits.saveHabit()', primary: true }]
    );
  }

  async function saveHabit() {
    const name = document.getElementById('habitName')?.value.trim();
    if (!name) { FitnessApp.toast('Digite o nome do habito.', 'error'); return; }
    const item = { id: uid(), name, icon: document.getElementById('habitIcon')?.value.trim() || name[0], period: document.getElementById('habitPeriod')?.value || 'DIA', checks: {}, createdAt: now() };
    _items.unshift(item);
    saveLocal(_items);
    FitnessApp.closeModal();
    render();
    const res = await FitnessAPI.post('/habits', toApi(item));
    if (!res.ok) FitnessApp.toast('Habito salvo localmente. Sincroniza quando a API estiver pronta.', 'warning');
  }

  async function toggle(id, date = FitnessApp.today()) {
    const h = _items.find(x => x.id === id);
    if (!h) return;
    h.checks = h.checks || {};
    h.checks[date] ? delete h.checks[date] : h.checks[date] = true;
    saveLocal(_items);
    render();
    FitnessApp.updateStreak();
    const res = await FitnessAPI.put(`/habits/${id}`, toApi(h));
    if (!res.ok) FitnessApp.toast('Mudanca salva localmente; a nuvem ainda nao respondeu.', 'warning');
  }

  function setView(view) { _view = view === 'week' ? 'week' : 'today'; render(); }
  function getBestStreak() { return Math.max(0, ..._items.map(streakFor)); }
  function streakFor(h) {
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (h.checks?.[d.toISOString().split('T')[0]]) count++;
      else break;
    }
    return count;
  }

  function fromApi(row) { return { id: row.id, name: row.name, icon: row.icon, period: row.period, checks: row.checks || {}, createdAt: row.created_at }; }
  function toApi(h) { return { id: h.id, name: h.name, icon: h.icon || 'H', period: h.period || 'DIA', checks: h.checks || {} }; }
  function localItems() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function saveLocal(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  function lastDays(n) { return Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().split('T')[0]; }); }
  function uid() { return 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return new Date().toISOString(); }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

  return { init, render, openAdd, saveHabit, toggle, setView, getBestStreak };
})();
