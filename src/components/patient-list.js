/**
 * OftalmoCare — Patient List Component
 * Renderiza lista de pacientes com busca, filtro e ações
 */

import { listPatients, deletePatient } from '../api/patients.service.js';
import { PATHOLOGY_LABELS, PATIENT_STATUS } from '../db/db.schema.js';
import { showToast } from './toast.js';

const STATUS_LABELS = { active:'Ativo', post_op:'Pós-Op', follow_up:'Acompanhamento', discharged:'Alta' };

let patients = [];
let currentFilter = null;
let searchTerm = '';
let onSelectPatient = null;
let onNewPatient = null;
let onNewConsultation = null;

export function initPatientList(container, callbacks = {}) {
  onSelectPatient = callbacks.onSelect;
  onNewPatient = callbacks.onNew;
  onNewConsultation = callbacks.onNewConsultation;
  renderLayout(container);
  loadPatients(container);
}

function renderLayout(container) {
  container.innerHTML = `
    <div class="patient-list-header">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="patient-search" placeholder="Buscar por nome ou CPF..." autocomplete="off">
      </div>
      <button class="btn btn-primary btn-sm" id="btn-new-patient">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo Paciente
      </button>
    </div>
    <div class="filter-group mb-md" id="pathology-filters">
      <button class="filter-chip active" data-filter="">Todos</button>
      <button class="filter-chip" data-filter="catarata">Catarata</button>
      <button class="filter-chip" data-filter="refrativa">Refrativa</button>
      <button class="filter-chip" data-filter="retina_vitreo">Retina/Vítreo</button>
      <button class="filter-chip" data-filter="outro">Outro</button>
    </div>
    <div id="patient-list-body"></div>
  `;

  // Search
  container.querySelector('#patient-search').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderList(container.querySelector('#patient-list-body'));
  });

  // Filters
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter || null;
      loadPatients(container);
    });
  });

  // New patient button
  container.querySelector('#btn-new-patient').addEventListener('click', () => {
    if (onNewPatient) onNewPatient();
  });
}

async function loadPatients(container) {
  const body = container.querySelector('#patient-list-body');
  body.innerHTML = '<div class="text-center text-muted mt-lg"><div class="spinner spinner-lg spinner-primary" style="margin:0 auto"></div></div>';

  const result = await listPatients({ pathology: currentFilter, pageSize: 200 });
  patients = result.patients;
  renderList(body);
}

function renderList(body) {
  let filtered = patients;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = patients.filter(p =>
      p.name.toLowerCase().includes(term) || (p.cpf && p.cpf.includes(term))
    );
  }

  if (filtered.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <h3>${searchTerm ? 'Nenhum resultado' : 'Nenhum paciente cadastrado'}</h3>
        <p>${searchTerm ? 'Tente outro termo de busca.' : 'Clique em "Novo Paciente" para começar.'}</p>
      </div>
    `;
    return;
  }

  body.innerHTML = filtered.map(p => {
    const initials = p.name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
    const pathLabel = p.primaryPathology ? (PATHOLOGY_LABELS[p.primaryPathology] || p.primaryPathology) : '';
    const statusLabel = STATUS_LABELS[p.status] || p.status;
    const statusClass = p.status === 'active' ? 'badge-active' : p.status === 'discharged' ? 'badge-suspended' : 'badge-pending';

    return `
      <div class="patient-card" data-id="${p.id}">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <div class="patient-name">${p.name}</div>
            <div class="patient-meta">
              <span>${p.cpf || '—'}</span>
              <span>${p.age !== null ? p.age + ' anos' : '—'}</span>
              ${pathLabel ? `<span>${pathLabel}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${statusClass}">${statusLabel}</span>
          <button class="btn-icon btn-consult" data-id="${p.id}" title="Nova Evolução" style="color:var(--primary-400)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Click to view detail
  body.querySelectorAll('.patient-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-consult')) return;
      const id = card.dataset.id;
      if (onSelectPatient) onSelectPatient(id);
    });
  });

  // New consultation button
  body.querySelectorAll('.btn-consult').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (onNewConsultation) onNewConsultation(id);
    });
  });
}

export function refreshPatientList(container) {
  loadPatients(container);
}
