/* ===== ATLASFIT TASKS ===== */

const FitTasks = (() => {
  const KEY = 'atlasfit_tasks';
  let _view = 'today';
  let _items = [];

  async function init() {
    _items = localItems();
    if (!_items.length) _items = [
      { id: uid(), title: 'Organizar mesa', due: FitnessApp.today(), done: false, createdAt: now() },
      { id: uid(), title: 'Revisar anotacoes', due: FitnessApp.today(), done: false, createdAt: now() }
    ];
    render();
    await syncFromCloud();
  }

  async function syncFromCloud() {
    const res = await FitnessAPI.get('/tasks');
    if (!res.ok) return;
    const remote = (res.data || []).map(fromApi);
    if (remote.length) {
      const localOnly = _items.filter(local => !remote.some(r => r.id === local.id || (r.title.toLowerCase() === local.title.toLowerCase() && r.due === local.due)));
      if (localOnly.length) await Promise.all(localOnly.map(t => FitnessAPI.post('/tasks', toApi(t))));
      _items = [...localOnly, ...remote];
      saveLocal(_items);
      render();
      return;
    }
    if (_items.length) await Promise.all(_items.map(t => FitnessAPI.post('/tasks', toApi(t))));
  }

  function render() {
    const wrap = document.getElementById('tasksContent');
    if (!wrap) return;
    const filtered = _view === 'today' ? _items.filter(t => t.due === FitnessApp.today()) : _items;
    const pending = filtered.filter(t => !t.done).length;
    wrap.innerHTML = `
      <div class="hero-card">
        <div><span class="card-kicker">Com prazo. Nao contam no streak.</span><h3>${pending} pendentes</h3><p>Execute o que foi prometido.</p></div>
        <div class="hero-score">${filtered.length - pending}/${filtered.length}</div>
      </div>
      <div class="segmented">
        <button class="${_view === 'today' ? 'active' : ''}" onclick="FitTasks.setView('today')">Hoje</button>
        <button class="${_view === 'week' ? 'active' : ''}" onclick="FitTasks.setView('week')">Semana</button>
      </div>
      <div class="card-list">${filtered.map(t => `
        <label class="check-card ${t.done ? 'done' : ''}">
          <input type="checkbox" ${t.done ? 'checked' : ''} onchange="FitTasks.toggle('${t.id}')">
          <span class="fake-check">${t.done ? '✓' : ''}</span>
          <span><strong>${esc(t.title)}</strong><small>${FitnessApp.fmtDate(t.due)}</small></span>
          <button class="icon-btn" type="button" onclick="FitTasks.remove('${t.id}')">x</button>
        </label>`).join('') || '<div class="empty-state"><h3>Nada por agora</h3><p>Crie uma tarefa para o dia.</p></div>'}</div>`;
  }

  function openAdd() {
    FitnessApp.openModal('Nova tarefa', `
      <div class="form-group"><label class="form-label">Tarefa</label><input id="taskTitle" class="form-input" placeholder="Ex: Comprar creatina"></div>
      <div class="form-group"><label class="form-label">Prazo</label><input type="date" id="taskDue" class="form-input" value="${FitnessApp.today()}"></div>`,
      [{ label: 'Cancelar', action: 'FitnessApp.closeModal()' }, { label: 'Salvar', action: 'FitTasks.saveTask()', primary: true }]
    );
  }

  async function saveTask() {
    const title = document.getElementById('taskTitle')?.value.trim();
    if (!title) { FitnessApp.toast('Digite a tarefa.', 'error'); return; }
    const item = { id: uid(), title, due: document.getElementById('taskDue')?.value || FitnessApp.today(), done: false, createdAt: now() };
    _items.unshift(item);
    saveLocal(_items);
    FitnessApp.closeModal();
    render();
    const res = await FitnessAPI.post('/tasks', toApi(item));
    if (!res.ok) FitnessApp.toast('Tarefa salva localmente. Sincroniza quando a API estiver pronta.', 'warning');
  }

  async function toggle(id) {
    const t = _items.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    saveLocal(_items);
    render();
    const res = await FitnessAPI.put(`/tasks/${id}`, toApi(t));
    if (!res.ok) FitnessApp.toast('Mudanca salva localmente; a nuvem ainda nao respondeu.', 'warning');
  }

  async function remove(id) {
    _items = _items.filter(t => t.id !== id);
    saveLocal(_items);
    render();
    await FitnessAPI.del(`/tasks/${id}`);
  }

  function setView(view) { _view = view === 'week' ? 'week' : 'today'; render(); }
  function fromApi(row) { return { id: row.id, title: row.title, due: row.due, done: !!row.done, createdAt: row.created_at }; }
  function toApi(t) { return { id: t.id, title: t.title, due: t.due || FitnessApp.today(), done: !!t.done }; }
  function localItems() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function saveLocal(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  function uid() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return new Date().toISOString(); }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

  return { init, render, openAdd, saveTask, toggle, remove, setView };
})();
