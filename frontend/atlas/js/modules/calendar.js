/* ============================================================
   ATLAS HUB — calendar.js
   Agenda module — month / week / day views
   ============================================================ */
const Calendar = (() => {
  let currentView  = 'month';
  let currentDate  = new Date();

  const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6'];

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toDateStr(d) {
    return d.toISOString().split('T')[0];
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  /* ---- title ---- */
  function updateTitle() {
    const titleEl = document.getElementById('calendarTitle');
    if (!titleEl) return;
    if (currentView === 'month') {
      titleEl.textContent = `${MONTHS_PT[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (currentView === 'week') {
      const monday = getWeekStart(currentDate);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      titleEl.textContent = `${monday.getDate()} ${MONTHS_PT[monday.getMonth()].substring(0,3)} — ${sunday.getDate()} ${MONTHS_PT[sunday.getMonth()].substring(0,3)} ${sunday.getFullYear()}`;
    } else {
      titleEl.textContent = currentDate.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }
  }

  function getWeekStart(d) {
    const day = new Date(d);
    const diff = day.getDay();
    day.setDate(day.getDate() - diff);
    return day;
  }

  /* ---- main render ---- */
  function render() {
    updateTitle();
    const container = document.getElementById('calendarView');
    if (!container) return;
    if (currentView === 'month') renderMonth(container);
    else if (currentView === 'week') renderWeek(container);
    else renderDay(container);
  }

  /* ---- MONTH VIEW ---- */
  function renderMonth(container) {
    const events = Storage.get('events') || [];
    const year   = currentDate.getFullYear();
    const month  = currentDate.getMonth();
    const today  = todayStr();

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const cells    = [];

    // pad from prev month
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: toDateStr(d), otherMonth: true, day: d.getDate() });
    }
    // current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: toDateStr(dt), otherMonth: false, day: d });
    }
    // pad to next month
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: toDateStr(d), otherMonth: true, day: i });
    }

    container.innerHTML = `
      <div class="calendar-container">
        <div class="calendar-weekdays">
          ${DAYS_PT.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">
          ${cells.map(c => {
            const dayEvents = events.filter(e => e.date === c.date);
            return `
              <div class="calendar-day ${c.date === today ? 'today' : ''} ${c.otherMonth ? 'other-month' : ''}"
                   onclick="Calendar.clickDay('${c.date}')">
                <div class="calendar-day-num">${c.day}</div>
                ${dayEvents.slice(0, 3).map(e => `
                  <div class="calendar-event-dot">
                    <span class="event-color-dot" style="background:${e.color||'var(--primary)'}"></span>
                    <span>${escHtml(e.title)}</span>
                  </div>`).join('')}
                ${dayEvents.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding-left:4px">+${dayEvents.length-3} mais</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  /* ---- WEEK VIEW ---- */
  function renderWeek(container) {
    const events  = Storage.get('events') || [];
    const today   = todayStr();
    const weekStart = getWeekStart(currentDate);

    const cols = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      cols.push(d);
    }

    container.innerHTML = `
      <div class="calendar-container">
        <div class="calendar-week-grid">
          ${cols.map(d => {
            const ds = toDateStr(d);
            const dayEvs = events.filter(e => e.date === ds);
            return `
              <div class="week-day-col ${ds === today ? 'today' : ''}">
                <div class="week-day-label">
                  ${DAYS_PT[d.getDay()]} ${d.getDate()}
                </div>
                ${dayEvs.length
                  ? dayEvs.map(e => `
                      <div class="day-event-item" style="border-color:${e.color||'var(--primary)'};background:${e.color||'var(--primary)'}22">
                        <div class="day-event-title">${escHtml(e.title)}</div>
                        ${e.time ? `<div class="day-event-time">${e.time}</div>` : ''}
                      </div>`).join('')
                  : `<div style="font-size:12px;color:var(--text-light);text-align:center;margin-top:8px">—</div>`}
                <button class="btn btn-ghost btn-sm btn-full" style="margin-top:6px" onclick="Calendar.openAddEvent('${ds}')">+ Evento</button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  /* ---- DAY VIEW ---- */
  function renderDay(container) {
    const ds     = toDateStr(currentDate);
    const events = (Storage.get('events') || []).filter(e => e.date === ds);
    const label  = currentDate.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    container.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="font-size:16px;font-weight:600;color:var(--text)">${label}</h3>
          <button class="btn btn-primary btn-sm" onclick="Calendar.openAddEvent('${ds}')">+ Evento</button>
        </div>
        ${events.length
          ? events.sort((a,b) => (a.time||'').localeCompare(b.time||'')).map(e => `
              <div class="day-event-item" style="border-color:${e.color||'var(--primary)'};background:${e.color||'var(--primary)'}22;margin-bottom:10px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between">
                  <div>
                    <div class="day-event-title">${escHtml(e.title)}</div>
                    ${e.time        ? `<div class="day-event-time">⏰ ${e.time}</div>` : ''}
                    ${e.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escHtml(e.description)}</div>` : ''}
                  </div>
                  <button class="btn-icon" onclick="Calendar.deleteEvent('${e.id}')">🗑️</button>
                </div>
              </div>`).join('')
          : `<div class="empty-state" style="padding:40px 0">
               <div class="empty-state-icon">📅</div>
               <h3>Nenhum evento</h3>
               <p>Nenhum evento para este dia.</p>
             </div>`}
      </div>`;
  }

  /* ---- navigation ---- */
  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    render();
  }

  function prev() {
    if (currentView === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    } else if (currentView === 'week') {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() - 1);
    }
    render();
  }

  function next() {
    if (currentView === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    } else if (currentView === 'week') {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    render();
  }

  function goToday() {
    currentDate = new Date();
    render();
  }

  function clickDay(dateStr) {
    currentDate = new Date(dateStr + 'T12:00:00');
    setView('day');
  }

  /* ---- add event ---- */
  function openAddEvent(prefillDate) {
    const defaultDate = prefillDate || toDateStr(currentDate);
    AtlasApp.openModal('Novo Evento', `
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input type="text" id="evtTitle" class="form-input" placeholder="Nome do evento">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data *</label>
          <input type="date" id="evtDate" class="form-input" value="${defaultDate}">
        </div>
        <div class="form-group">
          <label class="form-label">Hora</label>
          <input type="time" id="evtTime" class="form-input">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea id="evtDesc" class="form-input" rows="2" placeholder="Detalhes..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <div class="color-swatches" id="evtColorPicker">
          ${COLORS.map((c, i) => `
            <div class="color-swatch ${i===0?'selected':''}" style="background:${c}" data-color="${c}"
                 onclick="Calendar._pickColor(this, '${c}')"></div>`).join('')}
        </div>
        <input type="hidden" id="evtColor" value="${COLORS[0]}">
      </div>
    `, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Adicionar', class: 'btn-primary', action: saveEvent }
    ]);
    setTimeout(() => { const inp = document.getElementById('evtTitle'); if (inp) inp.focus(); }, 100);
  }

  function _pickColor(el, color) {
    document.querySelectorAll('#evtColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    const hidden = document.getElementById('evtColor');
    if (hidden) hidden.value = color;
  }

  function saveEvent() {
    const title = (document.getElementById('evtTitle') ||{}).value?.trim() || '';
    const date  = (document.getElementById('evtDate')  ||{}).value || '';
    const time  = (document.getElementById('evtTime')  ||{}).value || '';
    const desc  = (document.getElementById('evtDesc')  ||{}).value?.trim() || '';
    const color = (document.getElementById('evtColor') ||{}).value || COLORS[0];

    if (!title) { AtlasApp.toast('Informe o título do evento', 'error'); return; }
    if (!date)  { AtlasApp.toast('Informe a data do evento', 'error'); return; }

    Storage.push('events', {
      id: Storage.uid(), title, date, time, description: desc, color,
      createdAt: new Date().toISOString()
    });
    AtlasApp.toast('Evento adicionado!', 'success');
    Storage.logActivity('Agenda', `"${title}" em ${date}`);
    AtlasApp.closeModal();
    render();
  }

  function deleteEvent(id) {
    const events = Storage.get('events') || [];
    const ev     = events.find(e => e.id === id);
    if (!ev) return;
    AtlasApp.openModal('Excluir Evento', `<p>Excluir <strong>${escHtml(ev.title)}</strong>?</p>`, [
      { label: 'Cancelar', class: 'btn-outline', action: () => AtlasApp.closeModal() },
      { label: 'Excluir',  class: 'btn-danger',  action: () => {
        Storage.remove('events', id);
        Storage.logActivity('Agenda', `"${ev.title}" excluído`);
        AtlasApp.toast('Evento excluído', 'success');
        AtlasApp.closeModal();
        render();
      }}
    ]);
  }

  /* ---- public API ---- */
  function init() {
    document.querySelectorAll('.view-btn').forEach(b => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });
  }

  return {
    init, render,
    setView, prev, next, goToday, clickDay,
    openAdd: openAddEvent, openAddEvent, deleteEvent,
    _pickColor
  };
})();
