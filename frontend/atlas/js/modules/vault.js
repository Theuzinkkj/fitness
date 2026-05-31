/* ============================================================
   ATLAS HUB — vault.js
   Password Vault module
   Uses CryptoManager (crypto.js) for hashing/encryption
   ============================================================ */
const Vault = (() => {
  let unlocked       = false;
  let masterPassword = '';
  let searchQuery    = '';

  const el = (id) => document.getElementById(id);

  /* ---- state ---- */
  function isUnlocked()    { return unlocked; }
  function isConfigured()  { return !!Storage.get('vault.masterHash'); }

  /* ---- render ---- */
  function render() {
    const grid    = el('vaultGrid');
    const locked  = el('vaultLockedNotice');
    if (!grid) return;

    if (!isConfigured()) {
      grid.innerHTML = '';
      if (locked) locked.innerHTML = `
        <div class="vault-locked">
          <div class="vault-locked-icon">🔐</div>
          <h3>Configure o Cofre</h3>
          <p>Defina uma senha mestre para começar a usar o cofre de senhas.</p>
          <button class="btn btn-primary mt-12" onclick="Vault.openSetupModal()">Configurar Cofre</button>
        </div>`;
      return;
    }

    if (!isUnlocked()) {
      grid.innerHTML = '';
      if (locked) locked.innerHTML = `
        <div class="vault-locked">
          <div class="vault-locked-icon">🔒</div>
          <h3>Cofre Bloqueado</h3>
          <p>Digite a senha mestre para acessar suas senhas.</p>
          <button class="btn btn-primary mt-12" onclick="Vault.openUnlock()">Desbloquear</button>
        </div>`;
      return;
    }

    if (locked) locked.innerHTML = '';
    renderEntries();
  }

  function renderEntries() {
    const grid = el('vaultGrid');
    if (!grid) return;
    let entries = Storage.get('vault.entries') || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(e =>
        e.service.toLowerCase().includes(q) ||
        (e.login  || '').toLowerCase().includes(q) ||
        (e.url    || '').toLowerCase().includes(q)
      );
    }
    if (!entries.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🔑</div>
          <h3>${searchQuery ? 'Nenhum resultado' : 'Nenhuma senha salva'}</h3>
          <p>${searchQuery ? 'Tente outra busca.' : 'Adicione sua primeira senha clicando no botão acima.'}</p>
        </div>`;
      return;
    }
    grid.innerHTML = entries.map(e => buildCard(e)).join('');
  }

  function buildCard(entry) {
    return `
      <div class="vault-card" data-id="${entry.id}">
        <div class="vault-card-header">
          <div class="vault-service-icon">🔑</div>
          <div>
            <div class="vault-service-name">${escHtml(entry.service)}</div>
            ${entry.url ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(entry.url)}</div>` : ''}
          </div>
        </div>
        <div class="vault-field">
          <div class="vault-field-label">Login / E-mail</div>
          <div class="vault-field-value">${escHtml(entry.login || '—')}</div>
        </div>
        <div class="vault-field">
          <div class="vault-field-label">Senha</div>
          <div class="vault-field-value masked" id="vpass_${entry.id}">••••••••••</div>
        </div>
        ${entry.notes ? `<div class="vault-field"><div class="vault-field-label">Notas</div><div class="vault-field-value" style="font-size:12px">${escHtml(entry.notes)}</div></div>` : ''}
        <div class="vault-card-actions">
          <button class="btn btn-sm btn-outline" onclick="Vault.toggleShowPass('${entry.id}')">👁 Ver</button>
          <button class="btn btn-sm btn-outline" onclick="Vault.copyPass('${entry.id}')">📋 Copiar</button>
          <button class="btn btn-sm btn-outline" onclick="Vault.openEdit('${entry.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="Vault.deleteEntry('${entry.id}')">🗑</button>
        </div>
      </div>`;
  }

  /* ---- show / hide password ---- */
  async function toggleShowPass(id) {
    const el2 = el(`vpass_${id}`);
    if (!el2) return;
    if (el2.dataset.showing === '1') {
      el2.textContent = '••••••••••';
      el2.dataset.showing = '0';
      el2.classList.add('masked');
      return;
    }
    const entry = (Storage.get('vault.entries') || []).find(e => e.id === id);
    if (!entry) return;
    try {
      const plain = await CryptoManager.decrypt(entry.encPassword, masterPassword);
      el2.textContent = plain;
      el2.dataset.showing = '1';
      el2.classList.remove('masked');
    } catch {
      AtlasApp.toast('Erro ao descriptografar senha', 'error');
    }
  }

  async function copyPass(id) {
    const entry = (Storage.get('vault.entries') || []).find(e => e.id === id);
    if (!entry) return;
    try {
      const plain = await CryptoManager.decrypt(entry.encPassword, masterPassword);
      await navigator.clipboard.writeText(plain);
      AtlasApp.toast('Senha copiada!', 'success');
    } catch {
      AtlasApp.toast('Erro ao copiar senha', 'error');
    }
  }

  /* ---- setup master password ---- */
  function openSetupModal() {
    AtlasApp.openModal('Configurar Senha Mestre', `
      <div class="form-group">
        <label class="form-label">Nova Senha Mestre</label>
        <input type="password" id="newMasterPass" class="form-input" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmar Senha Mestre</label>
        <input type="password" id="confirmMasterPass" class="form-input" placeholder="Repita a senha" autocomplete="new-password">
      </div>
      <p style="font-size:12px;color:var(--text-muted)">⚠️ Esta senha não pode ser recuperada. Guarde-a com cuidado.</p>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Configurar', class: 'btn-primary', action: setupMaster }
    ]);
  }

  async function setupMaster() {
    const pass    = (el('newMasterPass')    || {}).value || '';
    const confirm = (el('confirmMasterPass') || {}).value || '';
    if (pass.length < 8) {
      AtlasApp.toast('A senha mestre deve ter no mínimo 8 caracteres', 'error'); return;
    }
    if (pass !== confirm) {
      AtlasApp.toast('As senhas não coincidem', 'error'); return;
    }
    try {
      const { hash, salt } = await CryptoManager.hashPassword(pass);
      Storage.set('vault.masterHash', hash);
      Storage.set('vault.salt', salt);
      masterPassword = pass;
      unlocked = true;
      AtlasApp.closeModal();
      AtlasApp.toast('Cofre configurado com sucesso!', 'success');
      Storage.logActivity('Cofre', 'Senha mestre configurada');
      render();
    } catch (err) {
      AtlasApp.toast('Erro ao configurar cofre', 'error');
    }
  }

  /* ---- unlock ---- */
  function openUnlock() {
    AtlasApp.openModal('Desbloquear Cofre', `
      <div class="vault-unlock-card" style="box-shadow:none;border:none;padding:0;max-width:100%">
        <div class="vault-unlock-icon">🔐</div>
        <p style="margin-bottom:20px">Digite sua senha mestre para acessar o cofre.</p>
        <div class="form-group">
          <div class="input-group">
            <input type="password" id="masterPassInput" class="form-input" placeholder="Senha mestre" autocomplete="current-password">
            <button class="input-group-btn" type="button" onclick="Vault._toggleMasterVis()">👁</button>
          </div>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:16px">
          Esqueceu a senha?
          <button type="button" onclick="Vault.confirmReset()" style="background:none;border:none;color:var(--danger,#e74c3c);cursor:pointer;font-size:12px;padding:0;text-decoration:underline">Redefinir cofre</button>
          (apaga todas as senhas salvas)
        </p>
      </div>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Desbloquear', class: 'btn-primary', action: unlockApp }
    ]);
    setTimeout(() => { const inp = el('masterPassInput'); if (inp) inp.focus(); }, 100);
  }

  function confirmReset() {
    AtlasApp.openModal('Redefinir Cofre', `
      <p style="color:var(--danger,#e74c3c);font-weight:600">⚠️ Atenção</p>
      <p>Isso irá apagar <strong>todas as senhas salvas</strong> e remover a senha mestre. Esta ação é irreversível.</p>
      <p style="margin-top:12px">Tem certeza que deseja continuar?</p>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Redefinir tudo', class: 'btn-danger', action: resetVault }
    ]);
  }

  function resetVault() {
    Storage.set('vault.masterHash', null);
    Storage.set('vault.salt', null);
    Storage.set('vault.entries', []);
    unlocked = false;
    masterPassword = '';
    AtlasApp.closeModal();
    AtlasApp.toast('Cofre redefinido. Configure uma nova senha mestre.', 'info');
    Storage.logActivity('Cofre', 'Cofre redefinido');
    render();
  }

  function _toggleMasterVis() {
    const inp = el('masterPassInput');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function unlockApp() {
    const pass = (el('masterPassInput') || {}).value || '';
    if (!pass) { AtlasApp.toast('Digite a senha mestre', 'error'); return; }
    try {
      const hash   = Storage.get('vault.masterHash');
      const salt   = Storage.get('vault.salt');
      const valid  = await CryptoManager.verifyPassword(pass, hash, salt);
      if (!valid) { AtlasApp.toast('Senha incorreta', 'error'); return; }
      masterPassword = pass;
      unlocked = true;
      AtlasApp.closeModal();
      AtlasApp.toast('Cofre desbloqueado!', 'success');
      Storage.logActivity('Cofre', 'Desbloqueado');
      render();
    } catch {
      AtlasApp.toast('Erro ao verificar senha', 'error');
    }
  }

  /* ---- add entry ---- */
  function openAddModal() {
    if (!isUnlocked()) { openUnlock(); return; }
    _openEntryModal(null);
  }

  function openEdit(id) {
    const entry = (Storage.get('vault.entries') || []).find(e => e.id === id);
    if (!entry) return;
    _openEntryModal(entry);
  }

  function _openEntryModal(entry) {
    const isEdit = !!entry;
    AtlasApp.openModal(isEdit ? 'Editar Senha' : 'Adicionar Senha', `
      <div class="form-group">
        <label class="form-label">Serviço / Site *</label>
        <input type="text" id="vService" class="form-input" placeholder="Ex: Google, Netflix..." value="${isEdit ? escHtml(entry.service) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Login / E-mail</label>
        <input type="text" id="vLogin" class="form-input" placeholder="usuario@email.com" value="${isEdit ? escHtml(entry.login || '') : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Senha *</label>
        <div class="input-group">
          <input type="password" id="vPassword" class="form-input" placeholder="${isEdit ? 'Deixe em branco para manter' : 'Digite a senha'}" autocomplete="new-password">
          <button class="input-group-btn" type="button" onclick="Vault._togglePassVis('vPassword')">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">URL</label>
        <input type="url" id="vUrl" class="form-input" placeholder="https://..." value="${isEdit ? escHtml(entry.url || '') : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea id="vNotes" class="form-input" rows="2" placeholder="Observações opcionais...">${isEdit ? escHtml(entry.notes || '') : ''}</textarea>
      </div>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: isEdit ? 'Salvar' : 'Adicionar', class: 'btn-primary', action: () => saveEntry(isEdit ? entry.id : null) }
    ]);
  }

  function _togglePassVis(inputId) {
    const inp = el(inputId);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function saveEntry(editId) {
    const service  = (el('vService')  || {}).value?.trim() || '';
    const login    = (el('vLogin')    || {}).value?.trim() || '';
    const password = (el('vPassword') || {}).value || '';
    const url      = (el('vUrl')      || {}).value?.trim() || '';
    const notes    = (el('vNotes')    || {}).value?.trim() || '';

    if (!service) { AtlasApp.toast('Informe o nome do serviço', 'error'); return; }
    if (!editId && !password) { AtlasApp.toast('Informe a senha', 'error'); return; }

    try {
      let encPassword;
      if (password) {
        encPassword = await CryptoManager.encrypt(password, masterPassword);
      } else {
        // keep existing
        const existing = (Storage.get('vault.entries') || []).find(e => e.id === editId);
        encPassword = existing ? existing.encPassword : '';
      }

      if (editId) {
        Storage.update('vault.entries', editId, { service, login, encPassword, url, notes });
        AtlasApp.toast('Senha atualizada!', 'success');
        Storage.logActivity('Cofre', `Senha "${service}" atualizada`);
      } else {
        Storage.push('vault.entries', {
          id: Storage.uid(), service, login, encPassword, url, notes, createdAt: new Date().toISOString()
        });
        AtlasApp.toast('Senha adicionada!', 'success');
        Storage.logActivity('Cofre', `Senha "${service}" adicionada`);
      }
      AtlasApp.closeModal();
      renderEntries();
    } catch {
      AtlasApp.toast('Erro ao criptografar senha', 'error');
    }
  }

  /* ---- delete ---- */
  function deleteEntry(id) {
    const entry = (Storage.get('vault.entries') || []).find(e => e.id === id);
    if (!entry) return;
    AtlasApp.openModal('Excluir Senha', `
      <p>Tem certeza que deseja excluir a senha de <strong>${escHtml(entry.service)}</strong>?</p>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Excluir', class: 'btn-danger', action: () => {
        Storage.remove('vault.entries', id);
        Storage.logActivity('Cofre', `Senha "${entry.service}" excluída`);
        AtlasApp.toast('Senha excluída', 'success');
        AtlasApp.closeModal();
        renderEntries();
      }}
    ]);
  }

  /* ---- search ---- */
  function setupSearch() {
    const inp = el('vaultSearch');
    if (!inp) return;
    inp.addEventListener('input', () => {
      searchQuery = inp.value.trim();
      if (isUnlocked()) renderEntries();
    });
  }

  /* ---- lock ---- */
  function lockVault() {
    unlocked = false;
    masterPassword = '';
    AtlasApp.toast('Cofre bloqueado', 'info');
    render();
  }

  /* ---- utils ---- */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ---- public API ---- */
  function init() {
    setupSearch();
  }

  return {
    init, render,
    openSetupModal, openUnlock, unlockApp,
    openAddModal, openEdit, deleteEntry,
    toggleShowPass, copyPass, lockVault,
    isUnlocked,
    confirmReset, resetVault,
    _toggleMasterVis, _togglePassVis
  };
})();
