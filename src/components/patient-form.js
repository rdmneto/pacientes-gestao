/**
 * OftalmoCare — Patient Form Component
 * Formulário de cadastro e edição de pacientes
 */

import { createPatient, updatePatient, getPatientById } from '../api/patients.service.js';
import { PATHOLOGY_LABELS, PATIENT_STATUS } from '../db/db.schema.js';
import { createModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const MODAL_ID = 'modal-patient-form';

/**
 * Abre o formulário de paciente (novo ou edição)
 * @param {string|null} patientId - null para novo
 * @param {function} onSave - Callback após salvar
 */
export async function openPatientForm(patientId = null, onSave = null) {
  const isEdit = !!patientId;
  let patient = null;

  if (isEdit) {
    patient = await getPatientById(patientId);
    if (!patient) { showToast('Paciente não encontrado.', 'error'); return; }
  }

  const html = buildFormHTML(patient);
  createModal(MODAL_ID, isEdit ? 'Editar Paciente' : 'Novo Paciente', html, { width: '580px' });
  openModal(MODAL_ID);

  // Bind events
  const form = document.getElementById('patient-form');

  // CPF mask
  const cpfInput = document.getElementById('pf-cpf');
  cpfInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = v;
  });

  // Phone mask
  ['pf-phone', 'pf-phone2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 11);
      if (v.length > 2) v = `(${v.substring(0,2)}) ${v.substring(2)}`;
      if (v.length > 10) v = v.substring(0,10) + '-' + v.substring(10);
      e.target.value = v;
    });
  });

  // Pathology detail toggle
  document.getElementById('pf-pathology').addEventListener('change', (e) => {
    const detail = document.getElementById('pf-pathology-detail-group');
    detail.style.display = e.target.value === 'outro' ? 'block' : 'none';
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Salvando...';

    const data = getFormData();
    let result;

    if (isEdit) {
      result = await updatePatient(patientId, data);
    } else {
      result = await createPatient(data);
    }

    if (result.success) {
      showToast(isEdit ? 'Paciente atualizado!' : 'Paciente cadastrado!', 'success');
      closeModal(MODAL_ID);
      if (onSave) onSave(result.id || patientId);
    } else {
      showToast(result.error, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente';
    }
  });
}

function getFormData() {
  return {
    name: document.getElementById('pf-name').value.trim(),
    cpf: document.getElementById('pf-cpf').value.trim(),
    birthDate: document.getElementById('pf-birth').value,
    gender: document.getElementById('pf-gender').value || null,
    phone: document.getElementById('pf-phone').value.trim() || null,
    phone2: document.getElementById('pf-phone2').value.trim() || null,
    email: document.getElementById('pf-email').value.trim() || null,
    primaryPathology: document.getElementById('pf-pathology').value || null,
    pathologyDetail: document.getElementById('pf-pathology-detail').value.trim() || null,
    notes: document.getElementById('pf-notes').value.trim() || null,
    healthInsurance: {
      name: document.getElementById('pf-insurance').value.trim() || null,
      number: document.getElementById('pf-insurance-num').value.trim() || null,
    },
    address: {
      street: document.getElementById('pf-street').value.trim() || null,
      neighborhood: document.getElementById('pf-neighborhood').value.trim() || null,
      city: document.getElementById('pf-city').value.trim() || null,
      state: document.getElementById('pf-state').value.trim() || null,
      zipCode: document.getElementById('pf-zip').value.trim() || null,
    },
  };
}

function buildFormHTML(patient) {
  const p = patient || {};
  const addr = p.address || {};
  const ins = p.healthInsurance || {};
  const isEdit = !!patient;

  return `
    <form id="patient-form" novalidate>
      <div class="form-section"><h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Dados Pessoais
      </h3></div>

      <div class="form-group">
        <label class="form-label" for="pf-name">Nome Completo *</label>
        <input type="text" id="pf-name" class="form-input" value="${p.name || ''}" required placeholder="Nome completo do paciente">
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label" for="pf-cpf">CPF *</label>
          <input type="text" id="pf-cpf" class="form-input" value="${p.cpf || ''}" required placeholder="000.000.000-00" maxlength="14">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-birth">Data de Nascimento *</label>
          <input type="date" id="pf-birth" class="form-input" value="${p.birthDate || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-gender">Sexo</label>
          <select id="pf-gender" class="form-select">
            <option value="">—</option>
            <option value="M" ${p.gender==='M'?'selected':''}>Masculino</option>
            <option value="F" ${p.gender==='F'?'selected':''}>Feminino</option>
            <option value="outro" ${p.gender==='outro'?'selected':''}>Outro</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="pf-phone">Telefone / WhatsApp</label>
          <input type="tel" id="pf-phone" class="form-input" value="${p.phone || ''}" placeholder="(00) 00000-0000">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-phone2">Telefone 2</label>
          <input type="tel" id="pf-phone2" class="form-input" value="${p.phone2 || ''}" placeholder="(00) 00000-0000">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="pf-email">E-mail</label>
        <input type="email" id="pf-email" class="form-input" value="${p.email || ''}" placeholder="paciente@email.com">
      </div>

      <div class="form-section"><h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Dados Clínicos
      </h3></div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="pf-pathology">Patologia Principal</label>
          <select id="pf-pathology" class="form-select">
            <option value="">— Selecionar —</option>
            ${Object.entries(PATHOLOGY_LABELS).map(([k,v]) => `<option value="${k}" ${p.primaryPathology===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="pf-pathology-detail-group" style="display:${p.primaryPathology==='outro'?'block':'none'}">
          <label class="form-label" for="pf-pathology-detail">Especificar Patologia</label>
          <input type="text" id="pf-pathology-detail" class="form-input" value="${p.pathologyDetail || ''}" placeholder="Descreva a patologia">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="pf-insurance">Plano de Saúde</label>
          <input type="text" id="pf-insurance" class="form-input" value="${ins.name || ''}" placeholder="Nome do plano">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-insurance-num">Nº Carteirinha</label>
          <input type="text" id="pf-insurance-num" class="form-input" value="${ins.number || ''}" placeholder="Número">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="pf-notes">Observações</label>
        <textarea id="pf-notes" class="form-textarea" rows="3" placeholder="Anotações gerais...">${p.notes || ''}</textarea>
      </div>

      <div class="form-section"><h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Endereço
      </h3></div>

      <div class="form-group">
        <label class="form-label" for="pf-street">Rua / Número</label>
        <input type="text" id="pf-street" class="form-input" value="${addr.street || ''}" placeholder="Rua, número, complemento">
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label" for="pf-neighborhood">Bairro</label>
          <input type="text" id="pf-neighborhood" class="form-input" value="${addr.neighborhood || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-city">Cidade</label>
          <input type="text" id="pf-city" class="form-input" value="${addr.city || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-state">UF</label>
          <input type="text" id="pf-state" class="form-input" value="${addr.state || ''}" maxlength="2" placeholder="CE">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="pf-zip">CEP</label>
        <input type="text" id="pf-zip" class="form-input" value="${addr.zipCode || ''}" placeholder="00000-000" maxlength="9" style="max-width:180px">
      </div>

      <div class="modal-footer" style="padding:1rem 0 0; border-top:1px solid var(--border-subtle); margin-top:1.5rem">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('${MODAL_ID}').classList.remove('open');document.body.style.overflow=''">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente'}</button>
      </div>
    </form>
  `;
}
