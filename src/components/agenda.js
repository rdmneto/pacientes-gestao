/**
 * OftalmoCare — Agenda (Calendar) Component
 */
import {
  listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment,
} from '../api/appointments.service.js';
import { searchPatients } from '../api/patients.service.js';
import { CONSULTATION_TYPES, PATHOLOGY_LABELS, APPOINTMENT_STATUS } from '../db/db.schema.js';
import { createModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const TYPE_LABELS = { cirurgia:'Cirurgia', laser:'Laser', injecao:'Injeção', consulta:'Consulta', retorno:'Retorno' };
const STATUS_LABELS = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Realizado', cancelled:'Cancelado', rescheduled:'Reagendado' };
const STATUS_CLASSES = { scheduled:'badge-pending', confirmed:'badge-active', completed:'badge-admin', cancelled:'badge-suspended', rescheduled:'badge-medico' };
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let currentYear, currentMonth, appointments = [];

export function initAgenda(container) {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  container.innerHTML = `
    <div class="calendar-header">
      <div class="calendar-nav">
        <button id="cal-prev" aria-label="Mês anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2 id="cal-title"></h2>
        <button id="cal-next" aria-label="Próximo mês"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" id="cal-today">Hoje</button>
        <button class="btn btn-sm btn-primary" id="cal-new-appt">+ Agendar</button>
      </div>
    </div>
    <div class="calendar-grid" id="cal-grid"></div>
    <div id="cal-day-detail"></div>
  `;

  document.getElementById('cal-prev').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } render(); });
  document.getElementById('cal-next').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } render(); });
  document.getElementById('cal-today').addEventListener('click', () => { currentYear = new Date().getFullYear(); currentMonth = new Date().getMonth(); render(); });
  document.getElementById('cal-new-appt').addEventListener('click', () => openAppointmentForm());

  render();
}

async function render() {
  const title = new Date(currentYear, currentMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  document.getElementById('cal-title').textContent = title;

  // Fetch appointments for this month
  const start = new Date(currentYear, currentMonth, 1).toISOString();
  const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
  appointments = await listAppointments(start, end);

  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  let html = WEEKDAYS.map(d => `<div class="calendar-weekday">${d}</div>`).join('');

  // Previous month fill
  const prevDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${prevDays - i}</div></div>`;
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayAppts = appointments.filter(a => a.dateTime && a.dateTime.startsWith(dateStr));

    const eventsHTML = dayAppts.slice(0, 3).map(a => {
      return `<div class="calendar-event type-${a.type}" title="${a.patientName} — ${TYPE_LABELS[a.type]||a.type}">${a.patientName?.split(' ')[0] || '?'}</div>`;
    }).join('') + (dayAppts.length > 3 ? `<div class="calendar-event" style="color:var(--text-muted)">+${dayAppts.length - 3} mais</div>` : '');

    html += `<div class="calendar-day${isToday?' today':''}" data-date="${dateStr}">
      <div class="calendar-day-number">${d}</div>
      ${eventsHTML}
    </div>`;
  }

  // Next month fill
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`;
  }

  grid.innerHTML = html;

  // Day click
  grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
    day.addEventListener('click', () => showDayDetail(day.dataset.date));
  });
}

function showDayDetail(dateStr) {
  const detail = document.getElementById('cal-day-detail');
  const dayAppts = appointments.filter(a => a.dateTime && a.dateTime.startsWith(dateStr));
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (dayAppts.length === 0) {
    detail.innerHTML = `<div class="day-detail">
      <div class="day-detail-title">📅 ${dateLabel}</div>
      <div class="empty-state" style="padding:1rem"><p class="text-muted" style="font-size:0.83rem">Nenhum agendamento neste dia.</p></div>
      <button class="btn btn-sm btn-primary mt-md" onclick="document.getElementById('cal-new-appt').click()">+ Agendar neste dia</button>
    </div>`;
    return;
  }

  detail.innerHTML = `<div class="day-detail">
    <div class="day-detail-title">📅 ${dateLabel} <span class="badge badge-medico">${dayAppts.length} agendamento${dayAppts.length>1?'s':''}</span></div>
    ${dayAppts.map(a => {
      const time = a.dateTime ? new Date(a.dateTime).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—';
      const statusBadge = `<span class="badge ${STATUS_CLASSES[a.status]||''}">${STATUS_LABELS[a.status]||a.status}</span>`;
      const typeLabel = TYPE_LABELS[a.type] || a.type;
      return `<div class="appt-card">
        <div class="appt-time">${time}</div>
        <div class="appt-info">
          <div class="patient-name">${a.patientName || '—'}</div>
          <div class="patient-meta"><span>${typeLabel}</span>${a.pathology ? ` · <span>${PATHOLOGY_LABELS[a.pathology]||''}</span>` : ''}${a.facility ? ` · <span>${a.facility}</span>` : ''}</div>
        </div>
        ${statusBadge}
        <div style="display:flex;gap:4px">
          ${a.status==='scheduled' ? `<button class="btn-icon" data-confirm="${a.id}" title="Confirmar" style="color:var(--success)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
          <button class="btn-icon" data-cancel="${a.id}" title="Cancelar" style="color:var(--danger)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Confirm / Cancel
  detail.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateAppointmentStatus(btn.dataset.confirm, 'confirmed');
      showToast('Agendamento confirmado!', 'success');
      render();
    });
  });
  detail.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancelar este agendamento?')) return;
      await updateAppointmentStatus(btn.dataset.cancel, 'cancelled');
      showToast('Agendamento cancelado.', 'error');
      render();
    });
  });
}

function openAppointmentForm() {
  const html = `<form id="appt-form" novalidate>
    <div class="form-group" id="appt-patient-wrap" style="position:relative">
      <label class="form-label">Paciente *</label>
      <input type="hidden" id="appt-patient-id"><input type="hidden" id="appt-patient-name">
      <input type="text" id="appt-patient-search" class="form-input" placeholder="Buscar paciente..." autocomplete="off">
      <div id="appt-patient-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-md);max-height:180px;overflow-y:auto;z-index:10"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Tipo *</label>
        <select id="appt-type" class="form-select" required>${Object.entries(TYPE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Patologia</label>
        <select id="appt-pathology" class="form-select"><option value="">—</option>${Object.entries(PATHOLOGY_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Data e Hora *</label>
        <input type="datetime-local" id="appt-datetime" class="form-input" required></div>
      <div class="form-group"><label class="form-label">Duração (min)</label>
        <input type="number" id="appt-duration" class="form-input" value="60" min="15" step="15"></div>
    </div>
    <div class="form-group"><label class="form-label">Local</label>
      <input type="text" id="appt-facility" class="form-input" placeholder="Hospital / Clínica"></div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea id="appt-notes" class="form-textarea" rows="2"></textarea></div>
    <div class="modal-footer" style="padding:1rem 0 0;border-top:1px solid var(--border-subtle)">
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-appt-form').classList.remove('open');document.body.style.overflow=''">Cancelar</button>
      <button type="submit" class="btn btn-primary">Agendar</button>
    </div>
  </form>`;

  createModal('modal-appt-form', 'Novo Agendamento', html, { width: '520px' });
  openModal('modal-appt-form');

  // Patient search
  const searchInput = document.getElementById('appt-patient-search');
  const results = document.getElementById('appt-patient-results');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const term = searchInput.value.trim();
      if (term.length < 2) { results.style.display='none'; return; }
      const patients = await searchPatients(term, 8);
      results.style.display = 'block';
      results.innerHTML = patients.map(p => `<div style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border-subtle)" data-id="${p.id}" data-name="${p.name}">${p.name} <span style="color:var(--text-muted);font-size:0.75rem">${p.cpf}</span></div>`).join('') || '<div style="padding:8px 12px;color:var(--text-muted);font-size:0.85rem">Nenhum resultado</div>';
      results.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          document.getElementById('appt-patient-id').value = item.dataset.id;
          document.getElementById('appt-patient-name').value = item.dataset.name;
          searchInput.value = item.dataset.name;
          results.style.display = 'none';
        });
      });
    }, 300);
  });

  // Submit
  document.getElementById('appt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientId = document.getElementById('appt-patient-id').value;
    const patientName = document.getElementById('appt-patient-name').value;
    if (!patientId) { showToast('Selecione um paciente.', 'error'); return; }
    const dateTime = document.getElementById('appt-datetime').value;
    if (!dateTime) { showToast('Informe data e hora.', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const result = await createAppointment({
      patientId, patientName,
      type: document.getElementById('appt-type').value,
      pathology: document.getElementById('appt-pathology').value || null,
      dateTime: new Date(dateTime).toISOString(),
      duration: parseInt(document.getElementById('appt-duration').value) || 60,
      facility: document.getElementById('appt-facility').value.trim() || null,
      notes: document.getElementById('appt-notes').value.trim() || null,
    });

    if (result.success) {
      showToast('Agendamento criado!', 'success');
      closeModal('modal-appt-form');
      render();
    } else {
      showToast(result.error, 'error');
      btn.disabled = false;
    }
  });
}
