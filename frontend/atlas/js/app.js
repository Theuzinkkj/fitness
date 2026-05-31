/* ===== ATLAS APP SHELL ===== */
const AtlasApp = (() => {
  const MODULES = {};
  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    vault: 'Cofre de Senhas',
    notes: 'Notas',
    todos: 'Tarefas',
    goals: 'Metas',
    calendar: 'Agenda',
    diary: 'Diário',
    study: 'Estudos',
    links: 'Links',
    library: 'Biblioteca',
    files: 'Arquivos',
    tools: 'Ferramentas',
    assistant: 'Atlas Assistant',
  };
  let _focusMode = false;
  let _currentSection = 'dashboard';

  // ── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    const loggedIn = await Auth.checkSession();
    if (!loggedIn) {
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('authScreen').classList.add('visible');
      return;
    }
    await Auth.loadAllData();
    await checkVaultSetup();
  }

  async function checkVaultSetup() {
    document.getElementById('loadingScreen').style.display = 'none';
    if (sessionStorage.getItem('atlas_vault_session')) { launchApp(); return; }
    const masterHash = Storage.get('vault.masterHash');
    const screen = document.getElementById('vaultUnlockScreen');
    screen.classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    if (masterHash) {
      document.getElementById('vaultSetupForm').style.display = 'none';
      document.getElementById('vaultUnlockForm').style.display = 'block';
    } else {
      document.getElementById('vaultSetupForm').style.display = 'block';
      document.getElementById('vaultUnlockForm').style.display = 'none';
    }
  }

  function skipVault() {
    sessionStorage.setItem('atlas_vault_session', '1');
    document.getElementById('vaultUnlockScreen').classList.add('hidden');
    launchApp();
  }

  function launchApp() {
    document.getElementById('vaultUnlockScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    applyTheme();
    setupKeyboard();
    registerModules();
    initModules();
    // Navigate to last section or hash
    const hash = location.hash.replace('#', '') || localStorage.getItem('atlas_last_section') || 'dashboard';
    navigate(hash);
    // Update user name
    const user = Auth.getUser();
    if (user) {
      const name = user.user_metadata?.name || user.email?.split('@')[0] || 'usuário';
      const el = document.getElementById('userDisplayName');
      if (el) el.textContent = name;
    }
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/atlas/sw.js', { scope: '/atlas/' }).catch(() => {});
    }
  }

  function registerModules() {
    MODULES.dashboard = typeof Dashboard !== 'undefined' ? Dashboard : null;
    MODULES.vault = typeof Vault !== 'undefined' ? Vault : null;
    MODULES.notes = typeof Notes !== 'undefined' ? Notes : null;
    MODULES.todos = typeof Todos !== 'undefined' ? Todos : null;
    MODULES.goals = typeof Goals !== 'undefined' ? Goals : null;
    MODULES.calendar = typeof Calendar !== 'undefined' ? Calendar : null;
    MODULES.diary = typeof Diary !== 'undefined' ? Diary : null;
    MODULES.study = typeof Study !== 'undefined' ? Study : null;
    MODULES.links = typeof Links !== 'undefined' ? Links : null;
    MODULES.library = typeof Library !== 'undefined' ? Library : null;
    MODULES.files = typeof Files !== 'undefined' ? Files : null;
    MODULES.tools = typeof Tools !== 'undefined' ? Tools : null;
    MODULES.assistant = typeof Assistant !== 'undefined' ? Assistant : null;
  }

  function initModules() {
    Object.values(MODULES).forEach(m => { if (m && typeof m.init === 'function') { try { m.init(); } catch(e) { console.warn('Module init error:', e); } } });
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function navigate(section) {
    if (!SECTION_TITLES[section]) section = 'dashboard';
    _currentSection = section;
    localStorage.setItem('atlas_last_section', section);
    location.hash = section;

    // Toggle sections
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('sec-' + section);
    if (target) target.classList.remove('hidden');

    // Update nav active
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.section === section);
    });

    // Update topbar title
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = SECTION_TITLES[section] || section;

    // Render module
    const mod = MODULES[section];
    if (mod && typeof mod.render === 'function') {
      try { mod.render(); } catch(e) { console.warn('Module render error:', e); }
    }

    // Close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('open');
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
  }

  function toggleFocusMode() {
    _focusMode = !_focusMode;
    document.body.classList.toggle('focus-mode', _focusMode);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  function applyTheme() {
    const theme = Storage.get('settings.theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const cb = document.getElementById('settingsTheme');
    if (cb) cb.checked = theme === 'dark';
  }

  function setTheme(theme) {
    Storage.set('settings.theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hub_theme', theme);
    const cb = document.getElementById('settingsTheme');
    if (cb) cb.checked = theme === 'dark';
  }

  function toggleTheme() {
    const current = Storage.get('settings.theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ── Modal ─────────────────────────────────────────────────────────────────────
  function openModal(title, body, buttons = []) {
    document.getElementById('modalTitle').textContent = title;
    const bodyEl = document.getElementById('modalBody');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else { bodyEl.innerHTML = ''; bodyEl.appendChild(body); }
    const footer = document.getElementById('modalFooter');
    footer.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.class || 'btn-outline');
      btn.textContent = b.text;
      btn.onclick = b.action;
      footer.appendChild(btn);
    });
    document.getElementById('modalOverlay').classList.remove('hidden');
  }

  function closeModal(event) {
    if (!event || event.target.id === 'modalOverlay' || event.target.classList.contains('modal-close') || event.target.classList.contains('modal-overlay')) {
      document.getElementById('modalOverlay').classList.add('hidden');
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  function toast(message, type = 'info', duration = 3500) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
  }

  // ── Global Search ─────────────────────────────────────────────────────────────
  function performSearch(q) {
    const panel = document.getElementById('searchResults');
    const list = document.getElementById('searchResultsList');
    if (!q || q.length < 2) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    document.getElementById('searchOverlay').classList.remove('hidden');
    const ql = q.toLowerCase();
    const results = [];

    (Storage.get('notes') || []).forEach(n => {
      if (n.title?.toLowerCase().includes(ql) || n.content?.toLowerCase().includes(ql))
        results.push({ section: 'notes', icon: '📝', title: n.title || 'Sem título', subtitle: n.content?.slice(0,60) });
    });
    (Storage.get('todos') || []).forEach(t => {
      if (t.title?.toLowerCase().includes(ql))
        results.push({ section: 'todos', icon: '✅', title: t.title, subtitle: t.done ? 'Concluída' : 'Pendente' });
    });
    (Storage.get('goals') || []).forEach(g => {
      if (g.title?.toLowerCase().includes(ql))
        results.push({ section: 'goals', icon: '🎯', title: g.title, subtitle: g.description?.slice(0,60) });
    });
    (Storage.get('events') || []).forEach(e => {
      if (e.title?.toLowerCase().includes(ql))
        results.push({ section: 'calendar', icon: '📅', title: e.title, subtitle: e.startTime || e.date });
    });
    (Storage.get('links') || []).forEach(l => {
      if (l.title?.toLowerCase().includes(ql) || l.url?.toLowerCase().includes(ql))
        results.push({ section: 'links', icon: '🔗', title: l.title, subtitle: l.url });
    });

    list.innerHTML = results.length
      ? results.map((r,i) => `<div class="search-result-item" onclick="AtlasApp.goToResult('${r.section}')"><span class="search-result-icon">${r.icon}</span><div><div class="search-result-title">${r.title}</div><div class="search-result-sub">${r.subtitle || ''}</div></div></div>`).join('')
      : '<div class="search-empty">Nenhum resultado encontrado</div>';
  }

  function closeSearch() {
    document.getElementById('searchResults').classList.add('hidden');
    document.getElementById('searchOverlay').classList.add('hidden');
    document.getElementById('globalSearch').value = '';
  }

  function goToResult(section) {
    closeSearch();
    navigate(section);
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  function openSettings() {
    const theme = Storage.get('settings.theme') || 'light';
    const notif = Storage.get('settings.notifications') || false;
    document.getElementById('settingsTheme').checked = theme === 'dark';
    document.getElementById('settingsNotifications').checked = notif;
    document.getElementById('settingsModal').classList.remove('hidden');
  }

  function toggleNotifications(enabled) {
    if (enabled && 'Notification' in window) {
      Notification.requestPermission().then(p => {
        Storage.set('settings.notifications', p === 'granted');
        document.getElementById('settingsNotifications').checked = p === 'granted';
      });
    } else {
      Storage.set('settings.notifications', false);
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  function exportData() {
    const json = Storage.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'atlas_backup_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    toast('Backup exportado!', 'success');
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const ok = Storage.importAll(e.target.result);
      if (ok) { toast('Dados importados com sucesso!', 'success'); navigate(_currentSection); }
      else toast('Erro ao importar dados. Verifique o arquivo.', 'error');
    };
    reader.readAsText(file);
  }

  function confirmClearAll() {
    if (!confirm('Tem certeza? Esta ação apagará TODOS os dados locais e não pode ser desfeita.')) return;
    Storage.clearAll();
    document.getElementById('settingsModal').classList.add('hidden');
    toast('Todos os dados foram apagados.', 'info');
    navigate('dashboard');
  }

  // ── Shortcuts ─────────────────────────────────────────────────────────────────
  function showShortcuts() {
    document.getElementById('shortcutsModal').classList.remove('hidden');
  }

  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      // Don't fire if in input
      const tag = document.activeElement.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('globalSearch').focus(); }
      else if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (e.ctrlKey && e.key === 't') { e.preventDefault(); toggleTheme(); }
      else if (e.ctrlKey && e.key === 'f') { e.preventDefault(); toggleFocusMode(); }
      else if (e.ctrlKey && e.key === 'd') { e.preventDefault(); navigate('dashboard'); }
      else if (e.ctrlKey && e.key === 'n') { e.preventDefault(); navigate('notes'); setTimeout(() => Notes && Notes.openAdd(), 100); }
      else if (e.key === 'Escape') {
        closeModal(); closeSearch();
        document.getElementById('shortcutsModal').classList.add('hidden');
        document.getElementById('settingsModal').classList.add('hidden');
      }
      else if (e.key === '?' && !inInput) { showShortcuts(); }
    });
  }

  // ── Notify ────────────────────────────────────────────────────────────────────
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/atlas/icons/icon.svg' });
  }

  // Hash navigation
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (hash && SECTION_TITLES[hash] && hash !== _currentSection) navigate(hash);
  });

  // Init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);

  return {
    init, launchApp, navigate, skipVault, checkVaultSetup,
    toggleTheme, setTheme, toggleSidebar, closeSidebar, toggleFocusMode,
    openModal, closeModal, toast, notify,
    performSearch, closeSearch, goToResult,
    openSettings, toggleNotifications,
    exportData, importData, confirmClearAll,
    showShortcuts,
  };
})();
