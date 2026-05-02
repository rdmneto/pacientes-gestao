/**
 * OftalmoCare — Patient Detail Component
 * Visualização do prontuário, timeline de consultas e anexos
 */
import { getPatientById, updatePatient } from '../api/patients.service.js';
import { getPatientConsultations } from '../api/consultations.service.js';
import { getPatientAttachments, uploadAttachment, deleteAttachment, formatFileSize } from '../api/attachments.service.js';
import { PATHOLOGY_LABELS, CONSULTATION_TYPES, LIO_LABELS, RETINA_CONDITION_LABELS, logmarToSnellenApprox } from '../db/db.schema.js';
import { createModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const MODAL_ID = 'modal-patient-detail';
const TYPE_LABELS = { consulta:'Consulta', cirurgia:'Cirurgia', laser:'Laser', injecao:'Injeção', retorno:'Retorno' };
const TYPE_DOTS = { cirurgia:'surgery', laser:'laser', injecao:'injection' };

export async function openPatientDetail(patientId, callbacks = {}) {
  const patient = await getPatientById(patientId);
  if (!patient) { showToast('Paciente não encontrado.', 'error'); return; }

  const [consultations, attachments] = await Promise.all([
    getPatientConsultations(patientId),
    getPatientAttachments(patientId),
  ]);

  const html = buildHTML(patient, consultations, attachments);
  createModal(MODAL_ID, '', html, { width: '780px' });
  openModal(MODAL_ID);

  // Remove default header (we build a custom one)
  const modalHeader = document.querySelector(`#${MODAL_ID} .modal-header`);
  if (modalHeader) modalHeader.style.display = 'none';

  bindDetailEvents(patient, attachments, callbacks);
}

function bindDetailEvents(patient, attachments, callbacks) {
  // Tabs
  document.querySelectorAll(`#${MODAL_ID} .detail-tab`).forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll(`#${MODAL_ID} .detail-tab`).forEach(t => t.classList.remove('active'));
      document.querySelectorAll(`#${MODAL_ID} .detail-pane`).forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.pane).classList.add('active');
    });
  });

  // Close button
  document.getElementById('detail-close-btn')?.addEventListener('click', () => closeModal(MODAL_ID));

  // Edit button
  document.getElementById('detail-edit-btn')?.addEventListener('click', () => {
    closeModal(MODAL_ID);
    if (callbacks.onEdit) callbacks.onEdit(patient.id);
  });

  // New consultation
  document.getElementById('detail-new-consult')?.addEventListener('click', () => {
    closeModal(MODAL_ID);
    if (callbacks.onNewConsultation) callbacks.onNewConsultation(patient.id, patient.name);
  });

  // Upload
  const uploadArea = document.getElementById('detail-upload-area');
  const fileInput = document.getElementById('detail-file-input');
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleUpload(e.dataTransfer.files[0], patient.id); });
    fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleUpload(e.target.files[0], patient.id); });
  }

  // Delete attachment
  document.querySelectorAll('.attachment-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Excluir este anexo?')) return;
      const id = btn.dataset.id;
      const result = await deleteAttachment(id);
      if (result.success) {
        showToast('Anexo excluído.', 'success');
        btn.closest('.attachment-item').remove();
      } else {
        showToast(result.error, 'error');
      }
    });
  });
}

async function handleUpload(file, patientId) {
  if (!file) return;
  const category = document.getElementById('detail-upload-category')?.value || 'outro';
  const progressBar = document.getElementById('detail-upload-progress-bar');
  const progressWrap = document.getElementById('detail-upload-progress');

  if (progressWrap) progressWrap.style.display = 'block';

  const result = await uploadAttachment(file, { patientId, category }, (pct) => {
    if (progressBar) progressBar.style.width = pct + '%';
  });

  if (result.success) {
    showToast('Arquivo enviado com sucesso!', 'success');
    // Add to list
    const list = document.getElementById('detail-attachments-list');
    if (list) {
      const isImg = file.type.startsWith('image');
      list.insertAdjacentHTML('afterbegin', `
        <div class="attachment-item">
          <div class="attachment-icon ${isImg?'img':'pdf'}">${isImg?'IMG':'PDF'}</div>
          <span class="attachment-name">${file.name}</span>
          <span class="attachment-size">${formatFileSize(file.size)}</span>
          <a href="${result.url}" target="_blank" class="btn-icon" title="Abrir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
        </div>
      `);
    }
  } else {
    showToast(result.error, 'error');
  }

  if (progressWrap) { progressWrap.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }
}

function buildHTML(patient, consultations, attachments) {
  const initials = patient.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const pathLabel = patient.primaryPathology ? (PATHOLOGY_LABELS[patient.primaryPathology]||patient.primaryPathology) : '—';
  const addr = patient.address;
  const ins = patient.healthInsurance;

  const timelineHTML = consultations.length > 0
    ? `<div class="timeline">${consultations.map(c => {
        const dotClass = TYPE_DOTS[c.type] || '';
        const date = c.date ? new Date(c.date).toLocaleDateString('pt-BR') : '—';
        const typeLabel = TYPE_LABELS[c.type] || c.type;
        const pathLbl = PATHOLOGY_LABELS[c.pathology] || '';
        let details = [];
        if (c.avPreOD_snellen) details.push(`AV Pré OD: ${c.avPreOD_snellen}`);
        if (c.avPostOD_snellen) details.push(`AV Pós OD: ${c.avPostOD_snellen}`);
        if (c.cataractData?.lioType) details.push(`LIO: ${LIO_LABELS[c.cataractData.lioType]||c.cataractData.lioType}`);
        if (c.retinaData?.retinaCondition) details.push(RETINA_CONDITION_LABELS[c.retinaData.retinaCondition]||'');
        return `<div class="timeline-item"><div class="timeline-dot ${dotClass}"></div><div class="timeline-card">
          <div class="timeline-date">${date}</div>
          <div class="timeline-title">${typeLabel} — ${c.eye || ''}</div>
          <div class="timeline-badges"><span class="badge badge-medico">${pathLbl}</span>${details.map(d=>`<span class="badge badge-pending" style="font-size:0.65rem;text-transform:none">${d}</span>`).join('')}</div>
          ${c.notes ? `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">${c.notes}</p>` : ''}
        </div></div>`;
      }).join('')}</div>`
    : '<div class="empty-state"><h3>Sem registros</h3><p>Nenhuma evolução clínica registrada.</p></div>';

  const attachHTML = `
    <div class="form-row" style="margin-bottom:1rem">
      <select id="detail-upload-category" class="form-select" style="max-width:200px">
        <option value="oct">OCT</option><option value="topografia">Topografia</option><option value="pentacam">Pentacam</option>
        <option value="paquimetria">Paquimetria</option><option value="microscopia">Microscopia</option><option value="laudo">Laudo</option><option value="outro" selected>Outro</option>
      </select>
    </div>
    <div class="upload-area" id="detail-upload-area">
      <input type="file" id="detail-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff" style="display:none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>Clique ou arraste um arquivo aqui</p>
      <p style="font-size:0.72rem">PDF, JPEG, PNG, WebP — até 50MB</p>
    </div>
    <div class="upload-progress" id="detail-upload-progress" style="display:none"><div class="upload-progress-bar" id="detail-upload-progress-bar"></div></div>
    <div id="detail-attachments-list" style="margin-top:1rem">
      ${attachments.map(a => {
        const isImg = a.fileType?.startsWith('image');
        return `<div class="attachment-item">
          <div class="attachment-icon ${isImg?'img':'pdf'}">${isImg?'IMG':'PDF'}</div>
          <span class="attachment-name">${a.fileName}</span>
          <span class="attachment-size">${formatFileSize(a.fileSize)}</span>
          <a href="${a.storageUrl}" target="_blank" class="btn-icon" title="Abrir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
          <button class="btn-icon attachment-delete" data-id="${a.id}" title="Excluir" style="color:var(--danger)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>`;
      }).join('') || '<p class="text-muted" style="font-size:0.83rem;text-align:center;padding:1rem">Nenhum anexo.</p>'}
    </div>`;

  return `
    <div style="padding:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem">
        <div class="detail-header" style="margin-bottom:0">
          <div class="detail-avatar">${initials}</div>
          <div><div class="detail-name">${patient.name}</div><div class="detail-subtitle">${pathLabel} · ${patient.age !== null ? patient.age + ' anos' : '—'}</div></div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" id="detail-edit-btn">Editar</button>
          <button class="btn btn-sm btn-primary" id="detail-new-consult">+ Evolução</button>
          <button class="btn-icon" id="detail-close-btn" title="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>

      <div class="detail-tabs">
        <button class="detail-tab active" data-pane="pane-info">Dados</button>
        <button class="detail-tab" data-pane="pane-history">Evoluções (${consultations.length})</button>
        <button class="detail-tab" data-pane="pane-attachments">Anexos (${attachments.length})</button>
      </div>

      <div class="detail-pane active" id="pane-info">
        <div class="detail-grid">
          <div class="detail-field"><label>CPF</label><span>${patient.cpf||'—'}</span></div>
          <div class="detail-field"><label>Nascimento</label><span>${patient.birthDate ? new Date(patient.birthDate+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
          <div class="detail-field"><label>Sexo</label><span>${patient.gender==='M'?'Masculino':patient.gender==='F'?'Feminino':patient.gender||'—'}</span></div>
          <div class="detail-field"><label>Telefone</label><span>${patient.phone||'—'}</span></div>
          <div class="detail-field"><label>E-mail</label><span>${patient.email||'—'}</span></div>
          <div class="detail-field"><label>Convênio</label><span>${ins?.name||'—'}</span></div>
        </div>
        ${addr?.street ? `<div class="detail-field" style="margin-top:0.5rem"><label>Endereço</label><span>${[addr.street,addr.neighborhood,addr.city,addr.state].filter(Boolean).join(', ')}</span></div>` : ''}
        ${patient.notes ? `<div class="detail-field" style="margin-top:0.5rem"><label>Observações</label><span>${patient.notes}</span></div>` : ''}
      </div>

      <div class="detail-pane" id="pane-history">${timelineHTML}</div>
      <div class="detail-pane" id="pane-attachments">${attachHTML}</div>
    </div>`;
}
