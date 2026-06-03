/* ===== ATLASFIT GOALS ===== */

const FitGoals = (() => {
  const KEY = 'atlasfit_goals';
  let _tab = 'active';
  let _items = [];

  async function init() {
    _items = localItems();
    if (!_items.length) _items = [{ id: uid(), title: 'Secar o Shape', category: 'PESSOAL', photo: '', start: FitnessApp.today(), deadline: plusDays(90), archived: false, createdAt: now() }];
    render();
    await syncFromCloud();
  }

  async function syncFromCloud() {
    const res = await FitnessAPI.get('/goals-fit');
    if (!res.ok) return;
    const remote = (res.data || []).map(fromApi);
    if (remote.length) {
      const localOnly = _items.filter(local => !remote.some(r => r.id === local.id || r.title.toLowerCase() === local.title.toLowerCase()));
      if (localOnly.length) await Promise.all(localOnly.map(g => FitnessAPI.post('/goals-fit', toApi(g))));
      _items = [...localOnly, ...remote];
      saveLocal(_items);
      render();
      return;
    }
    if (_items.length) await Promise.all(_items.map(g => FitnessAPI.post('/goals-fit', toApi(g))));
  }

  function render() {
    const wrap = document.getElementById('goalsContent');
    if (!wrap) return;
    const goals = _items.filter(g => _tab === 'archived' ? g.archived : !g.archived);
    wrap.innerHTML = `
      <div class="segmented">
        <button class="${_tab === 'active' ? 'active' : ''}" onclick="FitGoals.setTab('active')">Ativas</button>
        <button class="${_tab === 'archived' ? 'active' : ''}" onclick="FitGoals.setTab('archived')">Arquivadas</button>
      </div>
      <div class="goals-grid">${goals.map(goalCard).join('') || '<div class="empty-state"><h3>Nenhuma meta aqui</h3><p>Crie ou arquive suas metas concluidas.</p></div>'}</div>`;
  }

  function goalCard(g) {
    const total = diffDays(g.start, g.deadline);
    const elapsed = Math.max(0, diffDays(g.start, FitnessApp.today()));
    const left = Math.max(0, diffDays(FitnessApp.today(), g.deadline));
    const pct = total > 0 ? Math.min(100, Math.round(elapsed / total * 100)) : 0;
    const bg = g.photo || 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=700&q=70';
    return `<article class="goal-card" style="--goal-img:url('${esc(bg)}')">
      <div class="goal-photo"></div>
      <div class="goal-body">
        <span>${esc(g.category || 'PESSOAL')}</span>
        <h3>${esc(g.title)}</h3>
        <div class="goal-days"><strong>${elapsed}/${total}</strong><small>Faltam ${left} dias</small></div>
        <div class="progress-line"><i style="width:${pct}%"></i></div>
        <button class="btn btn-ghost btn-full" onclick="FitGoals.toggleArchive('${g.id}')">${g.archived ? 'Reativar' : 'Arquivar meta'}</button>
      </div>
    </article>`;
  }

  function openAdd() {
    FitnessApp.openModal('Nova meta', `
      <div class="form-group"><label class="form-label">Titulo</label><input id="goalTitle" class="form-input" placeholder="Ex: 12% de gordura"></div>
      <div class="form-group"><label class="form-label">Categoria</label><input id="goalCategory" class="form-input" placeholder="PESSOAL" value="PESSOAL"></div>
      <div class="form-group"><label class="form-label">Foto URL</label><input id="goalPhoto" class="form-input" placeholder="https://..."></div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Inicio</label><input type="date" id="goalStart" class="form-input" value="${FitnessApp.today()}"></div>
        <div class="form-group"><label class="form-label">Prazo</label><input type="date" id="goalDeadline" class="form-input" value="${plusDays(90)}"></div>
      </div>`,
      [{ label: 'Cancelar', action: 'FitnessApp.closeModal()' }, { label: 'Salvar', action: 'FitGoals.saveGoal()', primary: true }]
    );
  }

  async function saveGoal() {
    const title = document.getElementById('goalTitle')?.value.trim();
    if (!title) { FitnessApp.toast('Digite a meta.', 'error'); return; }
    const item = { id: uid(), title, category: document.getElementById('goalCategory')?.value.trim() || 'PESSOAL', photo: document.getElementById('goalPhoto')?.value.trim(), start: document.getElementById('goalStart')?.value || FitnessApp.today(), deadline: document.getElementById('goalDeadline')?.value || plusDays(90), archived: false, createdAt: now() };
    _items.unshift(item);
    saveLocal(_items);
    FitnessApp.closeModal();
    render();
    const res = await FitnessAPI.post('/goals-fit', toApi(item));
    if (!res.ok) FitnessApp.toast('Meta salva localmente. Sincroniza quando a API estiver pronta.', 'warning');
  }

  async function toggleArchive(id) {
    const g = _items.find(x => x.id === id);
    if (!g) return;
    g.archived = !g.archived;
    saveLocal(_items);
    render();
    const res = await FitnessAPI.put(`/goals-fit/${id}`, toApi(g));
    if (!res.ok) FitnessApp.toast('Mudanca salva localmente; a nuvem ainda nao respondeu.', 'warning');
  }

  function setTab(tab) { _tab = tab === 'archived' ? 'archived' : 'active'; render(); }
  function fromApi(row) { return { id: row.id, title: row.title, category: row.category, photo: row.photo || '', start: row.start, deadline: row.deadline, archived: !!row.archived, createdAt: row.created_at }; }
  function toApi(g) { return { id: g.id, title: g.title, category: g.category || 'PESSOAL', photo: g.photo || '', start: g.start || FitnessApp.today(), deadline: g.deadline || plusDays(90), archived: !!g.archived }; }
  function localItems() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function saveLocal(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  function diffDays(a, b) { return Math.max(0, Math.ceil((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)); }
  function plusDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
  function uid() { return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return new Date().toISOString(); }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;') : ''; }

  return { init, render, openAdd, saveGoal, toggleArchive, setTab };
})();
