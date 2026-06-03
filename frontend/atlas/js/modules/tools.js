/* ===== TOOLS MODULE ===== */

const Tools = (() => {
  let _currentTool = 'passgen';
  let _pomTimer = null;
  let _pomSeconds = 0;
  let _pomRunning = false;
  let _pomPhase = 'work'; // work | shortBreak | longBreak
  let _pomCycle = 0;

  function init() {}

  function render() { setTool(_currentTool); }

  function normalizeTool(tool) {
    const aliases = {
      password: 'passgen',
      passgen: 'passgen',
      pomodoro: 'pomodoro',
      converters: 'converter',
      converter: 'converter',
      qrcode: 'qrcode',
      qr: 'qrcode'
    };
    return aliases[tool] || 'passgen';
  }

  function setTool(tool) {
    tool = normalizeTool(tool);
    _currentTool = tool;
    document.querySelectorAll('.tool-tab').forEach(t => t.classList.toggle('active', normalizeTool(t.dataset.tool) === tool));
    const el = document.getElementById('toolContent');
    if (!el) return;
    if (tool === 'passgen') el.innerHTML = renderPassGen();
    else if (tool === 'pomodoro') { el.innerHTML = renderPomodoro(); startPomodoroUI(); }
    else if (tool === 'converter') el.innerHTML = renderConverter();
    else if (tool === 'qrcode') el.innerHTML = renderQRCode();
  }

  function setTab(btn, tool) {
    document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
    btn?.classList.add('active');
    setTool(tool);
  }

  // ===== GERADOR DE SENHAS =====
  function renderPassGen() {
    return `
      <div class="tool-card">
        <h3 class="tool-title">Gerador de Senhas</h3>
        <div class="tool-section">
          <label class="form-label">Comprimento: <span id="passLenVal">16</span></label>
          <input type="range" id="passLen" min="8" max="64" value="16" oninput="document.getElementById('passLenVal').textContent=this.value;Tools.genPass()" class="range-input" />
        </div>
        <div class="tool-checkboxes">
          <label><input type="checkbox" id="passUpper" checked onchange="Tools.genPass()"> Maiúsculas (A-Z)</label>
          <label><input type="checkbox" id="passLower" checked onchange="Tools.genPass()"> Minúsculas (a-z)</label>
          <label><input type="checkbox" id="passNums" checked onchange="Tools.genPass()"> Números (0-9)</label>
          <label><input type="checkbox" id="passSyms" onchange="Tools.genPass()"> Símbolos (!@#$…)</label>
        </div>
        <div class="pass-output-wrap">
          <input type="text" id="passOutput" class="form-input pass-output" readonly />
          <button class="btn btn-primary btn-sm" onclick="Tools.copyPass()">Copiar</button>
        </div>
        <div id="passStrength" class="pass-strength"></div>
        <button class="btn btn-outline" onclick="Tools.genPass()" style="margin-top:.75rem">🔄 Gerar nova senha</button>
      </div>`;
  }

  function genPass() {
    const len = parseInt(document.getElementById('passLen')?.value || 16);
    let chars = '';
    if (document.getElementById('passUpper')?.checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (document.getElementById('passLower')?.checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (document.getElementById('passNums')?.checked)  chars += '0123456789';
    if (document.getElementById('passSyms')?.checked)  chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
    let pass = '';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) pass += chars[arr[i] % chars.length];
    const el = document.getElementById('passOutput');
    if (el) el.value = pass;
    updateStrength(pass);
  }

  function updateStrength(pass) {
    const el = document.getElementById('passStrength');
    if (!el) return;
    let score = 0;
    if (pass.length >= 12) score++;
    if (pass.length >= 16) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    const levels = ['', 'Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte'];
    const colors = ['', '#ef4444','#f97316','#eab308','#22c55e','#10b981','#6366f1'];
    el.innerHTML = `<span style="color:${colors[score]};font-weight:600">${levels[score] || ''}</span>`;
  }

  function copyPass() {
    const val = document.getElementById('passOutput')?.value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => AtlasApp.toast('Senha copiada!', 'success')).catch(() => AtlasApp.toast('Erro ao copiar', 'error'));
  }

  // ===== POMODORO =====
  function renderPomodoro() {
    const s = Storage.get('pomodoroSettings') || { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
    return `
      <div class="tool-card pomodoro-tool">
        <h3 class="tool-title">Pomodoro Timer</h3>
        <div class="pom-phase-tabs">
          <button class="pom-tab active" id="pomTabWork" onclick="Tools.pomSetPhase('work')">Foco</button>
          <button class="pom-tab" id="pomTabShort" onclick="Tools.pomSetPhase('shortBreak')">Pausa curta</button>
          <button class="pom-tab" id="pomTabLong" onclick="Tools.pomSetPhase('longBreak')">Pausa longa</button>
        </div>
        <div class="pom-circle-wrap">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="80" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
            <circle id="pomArc" cx="90" cy="90" r="80" fill="none" stroke="var(--primary)" stroke-width="10" stroke-linecap="round" stroke-dasharray="502" stroke-dashoffset="0" transform="rotate(-90 90 90)" style="transition:stroke-dashoffset .9s linear"/>
          </svg>
          <div class="pom-time" id="pomDisplay">25:00</div>
        </div>
        <div class="pom-cycle" id="pomCycleInfo">Ciclo 1 de ${s.cycles}</div>
        <div class="pom-controls">
          <button class="btn btn-primary" id="pomBtn" onclick="Tools.pomToggle()">▶ Iniciar</button>
          <button class="btn btn-ghost" onclick="Tools.pomReset()">↺ Resetar</button>
        </div>
        <div class="pom-settings">
          <h4 style="font-size:.875rem;font-weight:600;margin-bottom:.5rem">Configurações</h4>
          <div class="form-grid-2">
            <div class="form-group"><label class="form-label">Foco (min)</label><input type="number" id="pomWork" class="form-input" value="${s.work}" min="1" max="99" onchange="Tools.pomSaveSettings()"/></div>
            <div class="form-group"><label class="form-label">Pausa curta</label><input type="number" id="pomShort" class="form-input" value="${s.shortBreak}" min="1" max="30" onchange="Tools.pomSaveSettings()"/></div>
            <div class="form-group"><label class="form-label">Pausa longa</label><input type="number" id="pomLong" class="form-input" value="${s.longBreak}" min="1" max="60" onchange="Tools.pomSaveSettings()"/></div>
            <div class="form-group"><label class="form-label">Ciclos</label><input type="number" id="pomCycles" class="form-input" value="${s.cycles}" min="1" max="10" onchange="Tools.pomSaveSettings()"/></div>
          </div>
        </div>
      </div>`;
  }

  function startPomodoroUI() {
    const s = Storage.get('pomodoroSettings') || { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
    _pomPhase = 'work'; _pomCycle = 0; _pomRunning = false;
    _pomSeconds = s.work * 60;
    updatePomDisplay();
  }

  function pomSetPhase(phase) {
    if (_pomRunning) pomStop();
    _pomPhase = phase;
    const s = Storage.get('pomodoroSettings') || { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
    _pomSeconds = phase === 'work' ? s.work * 60 : phase === 'shortBreak' ? s.shortBreak * 60 : s.longBreak * 60;
    document.querySelectorAll('.pom-tab').forEach(t => t.classList.remove('active'));
    const tabMap = { work: 'pomTabWork', shortBreak: 'pomTabShort', longBreak: 'pomTabLong' };
    document.getElementById(tabMap[phase])?.classList.add('active');
    updatePomDisplay();
  }

  function pomToggle() { _pomRunning ? pomStop() : pomStart(); }

  function pomStart() {
    _pomRunning = true;
    const btn = document.getElementById('pomBtn');
    if (btn) btn.textContent = '⏸ Pausar';
    _pomTimer = setInterval(() => {
      _pomSeconds--;
      updatePomDisplay();
      if (_pomSeconds <= 0) pomFinish();
    }, 1000);
  }

  function pomStop() {
    _pomRunning = false;
    clearInterval(_pomTimer);
    const btn = document.getElementById('pomBtn');
    if (btn) btn.textContent = '▶ Continuar';
  }

  function pomReset() {
    pomStop();
    const btn = document.getElementById('pomBtn');
    if (btn) btn.textContent = '▶ Iniciar';
    pomSetPhase(_pomPhase);
  }

  function pomFinish() {
    pomStop();
    const s = Storage.get('pomodoroSettings') || { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
    AtlasApp.notify('Pomodoro', _pomPhase === 'work' ? 'Tempo de pausa!' : 'Hora de focar!');
    if (_pomPhase === 'work') {
      _pomCycle++;
      pomSetPhase(_pomCycle % s.cycles === 0 ? 'longBreak' : 'shortBreak');
    } else {
      pomSetPhase('work');
    }
    const info = document.getElementById('pomCycleInfo');
    if (info) info.textContent = `Ciclo ${_pomCycle + 1} de ${s.cycles}`;
  }

  function pomSaveSettings() {
    const s = {
      work: parseInt(document.getElementById('pomWork')?.value || 25),
      shortBreak: parseInt(document.getElementById('pomShort')?.value || 5),
      longBreak: parseInt(document.getElementById('pomLong')?.value || 15),
      cycles: parseInt(document.getElementById('pomCycles')?.value || 4)
    };
    Storage.set('pomodoroSettings', s);
    if (!_pomRunning) pomSetPhase(_pomPhase);
  }

  function updatePomDisplay() {
    const m = Math.floor(_pomSeconds / 60);
    const s = _pomSeconds % 60;
    const display = document.getElementById('pomDisplay');
    if (display) display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const settings = Storage.get('pomodoroSettings') || { work: 25 };
    const total = (_pomPhase === 'work' ? settings.work : _pomPhase === 'shortBreak' ? (settings.shortBreak||5) : (settings.longBreak||15)) * 60;
    const pct = total > 0 ? _pomSeconds / total : 0;
    const arc = document.getElementById('pomArc');
    if (arc) arc.style.strokeDashoffset = (502 * (1 - pct)).toString();
  }

  // ===== CONVERSORES =====
  function renderConverter() {
    return `
      <div class="tool-card">
        <h3 class="tool-title">Conversores</h3>
        <div class="conv-tabs">
          <button class="conv-tab active" onclick="Tools.showConv('temp',this)">🌡️ Temperatura</button>
          <button class="conv-tab" onclick="Tools.showConv('weight',this)">⚖️ Peso</button>
          <button class="conv-tab" onclick="Tools.showConv('length',this)">📏 Comprimento</button>
        </div>
        <div id="convContent" class="conv-content">${convTemp()}</div>
      </div>`;
  }

  function showConv(type, btn) {
    document.querySelectorAll('.conv-tab').forEach(t => t.classList.remove('active'));
    btn?.classList.add('active');
    const el = document.getElementById('convContent');
    if (!el) return;
    if (type === 'temp') el.innerHTML = convTemp();
    else if (type === 'weight') el.innerHTML = convWeight();
    else if (type === 'length') el.innerHTML = convLength();
  }

  function convTemp() {
    return `<div class="conv-grid">
      <div class="form-group"><label class="form-label">Celsius (°C)</label><input type="number" id="convC" class="form-input" placeholder="0" oninput="Tools.calcTemp('c')"/></div>
      <div class="form-group"><label class="form-label">Fahrenheit (°F)</label><input type="number" id="convF" class="form-input" placeholder="32" oninput="Tools.calcTemp('f')"/></div>
      <div class="form-group"><label class="form-label">Kelvin (K)</label><input type="number" id="convK" class="form-input" placeholder="273.15" oninput="Tools.calcTemp('k')"/></div>
    </div>`;
  }

  function calcTemp(from) {
    const c = v => parseFloat(v) || 0;
    let cel;
    if (from === 'c') { cel = c(document.getElementById('convC')?.value); setVal('convF', (cel*9/5+32).toFixed(2)); setVal('convK', (cel+273.15).toFixed(2)); }
    else if (from === 'f') { const f = c(document.getElementById('convF')?.value); cel=(f-32)*5/9; setVal('convC',cel.toFixed(2)); setVal('convK',(cel+273.15).toFixed(2)); }
    else { const k = c(document.getElementById('convK')?.value); cel=k-273.15; setVal('convC',cel.toFixed(2)); setVal('convF',(cel*9/5+32).toFixed(2)); }
  }

  function convWeight() {
    return `<div class="conv-grid">
      <div class="form-group"><label class="form-label">Quilogramas (kg)</label><input type="number" id="convKg" class="form-input" oninput="Tools.calcWeight('kg')"/></div>
      <div class="form-group"><label class="form-label">Libras (lb)</label><input type="number" id="convLb" class="form-input" oninput="Tools.calcWeight('lb')"/></div>
      <div class="form-group"><label class="form-label">Gramas (g)</label><input type="number" id="convGr" class="form-input" oninput="Tools.calcWeight('g')"/></div>
    </div>`;
  }

  function calcWeight(from) {
    const c = v => parseFloat(v) || 0;
    let kg;
    if (from === 'kg') { kg=c(document.getElementById('convKg')?.value); setVal('convLb',(kg*2.20462).toFixed(3)); setVal('convGr',(kg*1000).toFixed(0)); }
    else if (from === 'lb') { const lb=c(document.getElementById('convLb')?.value); kg=lb/2.20462; setVal('convKg',kg.toFixed(3)); setVal('convGr',(kg*1000).toFixed(0)); }
    else { const g=c(document.getElementById('convGr')?.value); kg=g/1000; setVal('convKg',kg.toFixed(3)); setVal('convLb',(kg*2.20462).toFixed(3)); }
  }

  function convLength() {
    return `<div class="conv-grid">
      <div class="form-group"><label class="form-label">Metros (m)</label><input type="number" id="convM" class="form-input" oninput="Tools.calcLength('m')"/></div>
      <div class="form-group"><label class="form-label">Centímetros (cm)</label><input type="number" id="convCm" class="form-input" oninput="Tools.calcLength('cm')"/></div>
      <div class="form-group"><label class="form-label">Pés (ft)</label><input type="number" id="convFt" class="form-input" oninput="Tools.calcLength('ft')"/></div>
      <div class="form-group"><label class="form-label">Polegadas (in)</label><input type="number" id="convIn" class="form-input" oninput="Tools.calcLength('in')"/></div>
    </div>`;
  }

  function calcLength(from) {
    const c = v => parseFloat(v) || 0;
    let m;
    if (from === 'm') m=c(document.getElementById('convM')?.value);
    else if (from === 'cm') m=c(document.getElementById('convCm')?.value)/100;
    else if (from === 'ft') m=c(document.getElementById('convFt')?.value)*0.3048;
    else m=c(document.getElementById('convIn')?.value)*0.0254;
    if (from!=='m') setVal('convM',m.toFixed(4));
    if (from!=='cm') setVal('convCm',(m*100).toFixed(2));
    if (from!=='ft') setVal('convFt',(m/0.3048).toFixed(4));
    if (from!=='in') setVal('convIn',(m/0.0254).toFixed(3));
  }

  function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

  // ===== QR CODE =====
  function renderQRCode() {
    return `
      <div class="tool-card">
        <h3 class="tool-title">Gerador de QR Code</h3>
        <div class="form-group"><label class="form-label">Texto ou URL</label><input type="text" id="qrInput" class="form-input" placeholder="https://..." /></div>
        <button class="btn btn-primary" onclick="Tools.genQR()">Gerar QR Code</button>
        <div id="qrOutput" style="margin-top:1.5rem;display:flex;flex-direction:column;align-items:center;gap:.75rem"></div>
      </div>`;
  }

  function genQR() {
    const text = document.getElementById('qrInput')?.value.trim();
    if (!text) { AtlasApp.toast('Digite um texto ou URL.', 'error'); return; }
    const out = document.getElementById('qrOutput');
    if (!out) return;
    out.innerHTML = '<div id="qrCanvas"></div>';
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCanvas'), { text, width: 200, height: 200, colorDark: '#111827', colorLight: '#ffffff' });
        setTimeout(() => {
          const img = out.querySelector('img') || out.querySelector('canvas');
          if (img) {
            const a = document.createElement('a');
            a.href = img.tagName === 'CANVAS' ? img.toDataURL() : img.src;
            a.download = 'qrcode.png';
            a.className = 'btn btn-ghost btn-sm';
            a.textContent = '⬇ Baixar';
            out.appendChild(a);
          }
        }, 200);
      } else {
        out.innerHTML = '<p style="color:var(--text-muted)">Biblioteca QR Code não carregada. Verifique sua conexão.</p>';
      }
    } catch (e) {
      out.innerHTML = `<p style="color:var(--danger)">Erro ao gerar QR: ${e.message}</p>`;
    }
  }

  return { init, render, setTool, setTab, genPass, copyPass, pomToggle, pomReset, pomSetPhase, pomSaveSettings, showConv, calcTemp, calcWeight, calcLength, genQR };
})();
