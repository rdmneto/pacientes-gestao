/**
 * OftalmoCare — Consultation Form Component
 * Formulário com sub-listas dinâmicas por patologia
 */
import { createConsultation, updateConsultation } from '../api/consultations.service.js';
import { searchPatients } from '../api/patients.service.js';
import {
  PATHOLOGY_LABELS, CONSULTATION_TYPES, EYE_OPTIONS, LIO_LABELS,
  CATARACT_TECHNIQUES, REFRACTIVE_ERRORS, REFRACTIVE_SURGERY_TYPES,
  RETINA_CONDITION_LABELS, DR_TYPES, DR_TECHNIQUES, RETINA_COMPLICATIONS,
} from '../db/db.schema.js';
import { createModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const MODAL_ID = 'modal-consultation-form';
const SNELLEN_VALS = ['20/20','20/25','20/30','20/40','20/50','20/60','20/70','20/80','20/100','20/200','20/400','CD','MM','PL','SPL'];
const TYPE_LABELS = { consulta:'Consulta', cirurgia:'Cirurgia', laser:'Laser', injecao:'Injeção Intravítrea', retorno:'Retorno' };

export async function openConsultationForm(patientId = null, patientName = '', onSave = null) {
  const html = buildHTML(patientId, patientName);
  createModal(MODAL_ID, 'Nova Evolução Clínica', html, { width: '720px' });
  openModal(MODAL_ID);
  bindEvents(patientId, onSave);
}

function bindEvents(presetPatientId, onSave) {
  const form = document.getElementById('consultation-form');
  // Patient search autocomplete
  if (!presetPatientId) {
    const searchInput = document.getElementById('cf-patient-search');
    const results = document.getElementById('cf-patient-results');
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const term = searchInput.value.trim();
        if (term.length < 2) { results.innerHTML = ''; results.style.display = 'none'; return; }
        const patients = await searchPatients(term, 8);
        results.style.display = 'block';
        results.innerHTML = patients.map(p => `<div class="autocomplete-item" data-id="${p.id}" data-name="${p.name}">${p.name} <span style="color:var(--text-muted);font-size:0.75rem">${p.cpf}</span></div>`).join('') || '<div class="autocomplete-item" style="color:var(--text-muted)">Nenhum resultado</div>';
        results.querySelectorAll('[data-id]').forEach(item => {
          item.addEventListener('click', () => {
            document.getElementById('cf-patient-id').value = item.dataset.id;
            searchInput.value = item.dataset.name;
            results.style.display = 'none';
          });
        });
      }, 300);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#cf-patient-search-wrap')) results.style.display = 'none'; });
  }

  // Pathology toggle
  document.getElementById('cf-pathology').addEventListener('change', (e) => {
    document.querySelectorAll('.pathology-section').forEach(s => s.classList.remove('visible'));
    const section = document.getElementById(`section-${e.target.value}`);
    if (section) section.classList.add('visible');
  });

  // Retina sub-condition toggle
  const retinaCondition = document.getElementById('cf-retina-condition');
  if (retinaCondition) {
    retinaCondition.addEventListener('change', (e) => {
      document.querySelectorAll('.retina-sub').forEach(s => s.classList.remove('visible'));
      const sub = document.getElementById(`retina-${e.target.value}`);
      if (sub) sub.classList.add('visible');
    });
  }

  // Snellen quick-fill chips
  document.querySelectorAll('.snellen-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.target;
      document.getElementById(target).value = chip.textContent;
    });
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';

    const data = collectFormData(presetPatientId);
    const result = await createConsultation(data);

    if (result.success) {
      showToast('Evolução registrada com sucesso!', 'success');
      closeModal(MODAL_ID);
      if (onSave) onSave(result.id);
    } else {
      showToast(result.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Salvar Evolução';
    }
  });
}

function collectFormData(presetPatientId) {
  const g = id => document.getElementById(id)?.value || null;
  const gn = id => { const v = document.getElementById(id)?.value; return v !== '' && v !== null ? parseFloat(v) : null; };
  const pathology = g('cf-pathology');

  const data = {
    patientId: presetPatientId || g('cf-patient-id'),
    type: g('cf-type'),
    date: g('cf-date'),
    pathology,
    eye: g('cf-eye'),
    facility: g('cf-facility'),
    notes: g('cf-notes'),
    // AV
    avPreOD_snellen: g('cf-av-pre-od'), avPreOE_snellen: g('cf-av-pre-oe'),
    avPostOD_snellen: g('cf-av-post-od'), avPostOE_snellen: g('cf-av-post-oe'),
    // Refração
    refrPreOD_sphere: gn('cf-refr-pre-od-sph'), refrPreOD_cylinder: gn('cf-refr-pre-od-cyl'), refrPreOD_axis: gn('cf-refr-pre-od-ax'),
    refrPreOE_sphere: gn('cf-refr-pre-oe-sph'), refrPreOE_cylinder: gn('cf-refr-pre-oe-cyl'), refrPreOE_axis: gn('cf-refr-pre-oe-ax'),
    refrPostOD_sphere: gn('cf-refr-post-od-sph'), refrPostOD_cylinder: gn('cf-refr-post-od-cyl'), refrPostOD_axis: gn('cf-refr-post-od-ax'),
    refrPostOE_sphere: gn('cf-refr-post-oe-sph'), refrPostOE_cylinder: gn('cf-refr-post-oe-cyl'), refrPostOE_axis: gn('cf-refr-post-oe-ax'),
    // Tonometria
    tonoPreOD: gn('cf-tono-pre-od'), tonoPreOE: gn('cf-tono-pre-oe'),
    tonoPostOD: gn('cf-tono-post-od'), tonoPostOE: gn('cf-tono-post-oe'),
    // Microscopia
    microsPreOD: gn('cf-micros-pre-od'), microsPreOE: gn('cf-micros-pre-oe'),
    microsPostOD: gn('cf-micros-post-od'), microsPostOE: gn('cf-micros-post-oe'),
    // Ceratoscopia
    keratoPreOD_k1: gn('cf-k-pre-od-k1'), keratoPreOD_k2: gn('cf-k-pre-od-k2'), keratoPreOD_astig: gn('cf-k-pre-od-a'),
    keratoPreOE_k1: gn('cf-k-pre-oe-k1'), keratoPreOE_k2: gn('cf-k-pre-oe-k2'), keratoPreOE_astig: gn('cf-k-pre-oe-a'),
    keratoPostOD_astig: gn('cf-k-post-od-a'), keratoPostOE_astig: gn('cf-k-post-oe-a'),
  };

  // Sub-docs por patologia
  if (pathology === 'catarata') {
    data.cataractData = {
      lioType: g('cf-cat-lio-type'), lioModel: g('cf-cat-lio-model'),
      lioDiopter: gn('cf-cat-lio-diopter'), lioManufacturer: g('cf-cat-lio-manuf'),
      axialLength: gn('cf-cat-axial'), formulaUsed: g('cf-cat-formula'),
      targetRefraction: gn('cf-cat-target'), technique: g('cf-cat-technique'),
      complications: g('cf-cat-complications'),
    };
  } else if (pathology === 'refrativa') {
    data.refrativeData = {
      refrativeError: g('cf-refr-error'), surgeryType: g('cf-refr-surgery-type'),
      pachymetryOD: gn('cf-refr-pachy-od'), pachymetryOE: gn('cf-refr-pachy-oe'),
      complications: g('cf-refr-complications'),
    };
  } else if (pathology === 'retina_vitreo') {
    const cond = g('cf-retina-condition');
    const comps = [];
    document.querySelectorAll('.retina-comp-check:checked').forEach(c => comps.push(c.value));
    data.retinaData = {
      retinaCondition: cond,
      mhClosed: document.getElementById('cf-ret-mh-closed')?.value === 'true' ? true : document.getElementById('cf-ret-mh-closed')?.value === 'false' ? false : null,
      mhSize: gn('cf-ret-mh-size'), mhGas: g('cf-ret-mh-gas'),
      octCMTpre: gn('cf-ret-oct-pre'), octCMTpost: gn('cf-ret-oct-post'),
      injectionDrug: g('cf-ret-inj-drug'), injectionNumber: gn('cf-ret-inj-num'),
      drType: g('cf-ret-dr-type'), drExtension: g('cf-ret-dr-ext'),
      drSuccess: document.getElementById('cf-ret-dr-success')?.value === 'true' ? true : document.getElementById('cf-ret-dr-success')?.value === 'false' ? false : null,
      drSurgeriesCount: gn('cf-ret-dr-count'), drTechnique: g('cf-ret-dr-tech'),
      drOil: document.getElementById('cf-ret-dr-oil')?.value === 'true' ? true : null,
      retinaComplications: comps,
      retinaComplicationsOther: g('cf-ret-comp-other'),
    };
  }
  return data;
}

function snellenField(id, label) {
  return `<div class="form-group">
    <label class="form-label">${label}</label>
    <input type="text" id="${id}" class="form-input" placeholder="20/20" list="snellen-list">
    <div class="snellen-helper">${['20/20','20/40','20/100','20/200','CD','MM'].map(v=>`<span class="snellen-chip" data-target="${id}">${v}</span>`).join('')}</div>
  </div>`;
}

function refrRow(prefix, label) {
  return `<div style="margin-bottom:0.75rem"><label class="form-label" style="margin-bottom:6px">${label}</label>
    <div class="form-row-3">
      <div class="form-group" style="margin:0"><input type="number" step="0.25" id="${prefix}-sph" class="form-input" placeholder="Esf"></div>
      <div class="form-group" style="margin:0"><input type="number" step="0.25" id="${prefix}-cyl" class="form-input" placeholder="Cil"></div>
      <div class="form-group" style="margin:0"><input type="number" step="1" id="${prefix}-ax" class="form-input" placeholder="Eixo°"></div>
    </div></div>`;
}

function opts(obj) { return Object.entries(obj).map(([k,v]) => `<option value="${k}">${v}</option>`).join(''); }

function buildHTML(patientId, patientName) {
  const today = new Date().toISOString().split('T')[0];
  const patientSection = patientId
    ? `<input type="hidden" id="cf-patient-id" value="${patientId}"><div class="alert alert-info" style="margin-bottom:1rem">Paciente: <strong>${patientName}</strong></div>`
    : `<div class="form-group" id="cf-patient-search-wrap" style="position:relative">
        <label class="form-label">Paciente *</label>
        <input type="hidden" id="cf-patient-id">
        <input type="text" id="cf-patient-search" class="form-input" placeholder="Buscar paciente por nome..." autocomplete="off">
        <div id="cf-patient-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;z-index:10"></div>
      </div>`;

  return `<form id="consultation-form" novalidate>
    ${patientSection}
    <datalist id="snellen-list">${SNELLEN_VALS.map(v=>`<option value="${v}">`).join('')}</datalist>

    <div class="form-row-3">
      <div class="form-group"><label class="form-label">Tipo *</label>
        <select id="cf-type" class="form-select" required>${Object.entries(TYPE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Data *</label>
        <input type="date" id="cf-date" class="form-input" value="${today}" required></div>
      <div class="form-group"><label class="form-label">Olho *</label>
        <select id="cf-eye" class="form-select" required>${Object.entries(EYE_OPTIONS).map(([k,v])=>`<option value="${k}">${k} — ${k==='OD'?'Direito':k==='OE'?'Esquerdo':'Ambos'}</option>`).join('')}</select></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Patologia *</label>
        <select id="cf-pathology" class="form-select" required><option value="">— Selecionar —</option>${opts(PATHOLOGY_LABELS)}</select></div>
      <div class="form-group"><label class="form-label">Local</label>
        <input type="text" id="cf-facility" class="form-input" placeholder="Hospital / Clínica"></div>
    </div>

    <!-- ═══ ACUIDADE VISUAL ═══ -->
    <div class="form-section"><h3>👁️ Acuidade Visual (Snellen)</h3></div>
    <div class="form-row">${snellenField('cf-av-pre-od','AV Pré-Op OD')}${snellenField('cf-av-pre-oe','AV Pré-Op OE')}</div>
    <div class="form-row">${snellenField('cf-av-post-od','AV Pós-Op OD')}${snellenField('cf-av-post-oe','AV Pós-Op OE')}</div>

    <!-- ═══ REFRAÇÃO ═══ -->
    <div class="form-section"><h3>🔢 Refração</h3></div>
    ${refrRow('cf-refr-pre-od','Pré-Op OD')}${refrRow('cf-refr-pre-oe','Pré-Op OE')}
    ${refrRow('cf-refr-post-od','Pós-Op OD')}${refrRow('cf-refr-post-oe','Pós-Op OE')}

    <!-- ═══ TONOMETRIA ═══ -->
    <div class="form-section"><h3>💧 Tonometria (mmHg)</h3></div>
    <div class="form-row">
      <div class="form-row"><div class="form-group"><label class="form-label">Pré OD</label><input type="number" id="cf-tono-pre-od" class="form-input" placeholder="mmHg"></div><div class="form-group"><label class="form-label">Pré OE</label><input type="number" id="cf-tono-pre-oe" class="form-input"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Pós OD</label><input type="number" id="cf-tono-post-od" class="form-input"></div><div class="form-group"><label class="form-label">Pós OE</label><input type="number" id="cf-tono-post-oe" class="form-input"></div></div>
    </div>

    <!-- ═══ MICROSCOPIA ESPECULAR ═══ -->
    <div class="form-section"><h3>🔬 Microscopia Especular (cél/mm²)</h3></div>
    <div class="form-row">
      <div class="form-row"><div class="form-group"><label class="form-label">Pré OD</label><input type="number" id="cf-micros-pre-od" class="form-input"></div><div class="form-group"><label class="form-label">Pré OE</label><input type="number" id="cf-micros-pre-oe" class="form-input"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Pós OD</label><input type="number" id="cf-micros-post-od" class="form-input"></div><div class="form-group"><label class="form-label">Pós OE</label><input type="number" id="cf-micros-post-oe" class="form-input"></div></div>
    </div>

    <!-- ═══ CATARATA (condicional) ═══ -->
    <div class="pathology-section" id="section-catarata">
      <div class="pathology-card">
        <div class="pathology-card-title">🔵 Dados de Catarata</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tipo de LIO</label><select id="cf-cat-lio-type" class="form-select"><option value="">—</option>${opts(LIO_LABELS)}</select></div>
          <div class="form-group"><label class="form-label">Modelo</label><input type="text" id="cf-cat-lio-model" class="form-input" placeholder="ex: ZMB00"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Dioptria LIO</label><input type="number" step="0.5" id="cf-cat-lio-diopter" class="form-input"></div>
          <div class="form-group"><label class="form-label">Fabricante</label><input type="text" id="cf-cat-lio-manuf" class="form-input"></div>
          <div class="form-group"><label class="form-label">Comp. Axial (mm)</label><input type="number" step="0.01" id="cf-cat-axial" class="form-input"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Fórmula</label><input type="text" id="cf-cat-formula" class="form-input" placeholder="Barrett II"></div>
          <div class="form-group"><label class="form-label">Refração Alvo</label><input type="number" step="0.25" id="cf-cat-target" class="form-input"></div>
          <div class="form-group"><label class="form-label">Técnica</label><select id="cf-cat-technique" class="form-select"><option value="">—</option><option value="facoemulsificacao">Facoemulsificação</option><option value="femto">Femto</option><option value="extracapsular">Extracapsular</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Complicações</label><input type="text" id="cf-cat-complications" class="form-input" placeholder="Descrever se houver"></div>
      </div>
    </div>

    <!-- ═══ REFRATIVA (condicional) ═══ -->
    <div class="pathology-section" id="section-refrativa">
      <div class="pathology-card">
        <div class="pathology-card-title">🟢 Dados de Cirurgia Refrativa</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Erro Refrativo</label><select id="cf-refr-error" class="form-select"><option value="">—</option>${opts(REFRACTIVE_ERRORS)}</select></div>
          <div class="form-group"><label class="form-label">Tipo Cirurgia</label><select id="cf-refr-surgery-type" class="form-select"><option value="">—</option>${opts(REFRACTIVE_SURGERY_TYPES)}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Paquimetria OD (μm)</label><input type="number" id="cf-refr-pachy-od" class="form-input"></div>
          <div class="form-group"><label class="form-label">Paquimetria OE (μm)</label><input type="number" id="cf-refr-pachy-oe" class="form-input"></div>
        </div>
        <div class="form-group"><label class="form-label">Complicações</label><input type="text" id="cf-refr-complications" class="form-input"></div>
      </div>
    </div>

    <!-- ═══ RETINA E VÍTREO (condicional) ═══ -->
    <div class="pathology-section" id="section-retina_vitreo">
      <div class="pathology-card">
        <div class="pathology-card-title">🟡 Dados de Retina e Vítreo</div>
        <div class="form-group"><label class="form-label">Condição</label><select id="cf-retina-condition" class="form-select"><option value="">—</option>${opts(RETINA_CONDITION_LABELS)}</select></div>

        <!-- Buraco Macular -->
        <div class="retina-sub" id="retina-buraco_macular">
          <div class="form-row-3">
            <div class="form-group"><label class="form-label">Fechou?</label><select id="cf-ret-mh-closed" class="form-select"><option value="">—</option><option value="true">Sim</option><option value="false">Não</option></select></div>
            <div class="form-group"><label class="form-label">Tamanho (μm)</label><input type="number" id="cf-ret-mh-size" class="form-input"></div>
            <div class="form-group"><label class="form-label">Gás</label><input type="text" id="cf-ret-mh-gas" class="form-input" placeholder="C3F8, SF6, ar"></div>
          </div>
        </div>

        <!-- MER / Injeções -->
        <div class="retina-sub" id="retina-mer"><div class="form-row"><div class="form-group"><label class="form-label">OCT CMT Pré (μm)</label><input type="number" id="cf-ret-oct-pre" class="form-input"></div><div class="form-group"><label class="form-label">OCT CMT Pós (μm)</label><input type="number" id="cf-ret-oct-post" class="form-input"></div></div></div>
        <div class="retina-sub" id="retina-injecao_intravitrea"><div class="form-row"><div class="form-group"><label class="form-label">Medicamento</label><input type="text" id="cf-ret-inj-drug" class="form-input" placeholder="Anti-VEGF, Corticoide"></div><div class="form-group"><label class="form-label">Nº Injeções</label><input type="number" id="cf-ret-inj-num" class="form-input"></div></div></div>

        <!-- DR -->
        <div class="retina-sub" id="retina-dr">
          <div class="form-row-3">
            <div class="form-group"><label class="form-label">Tipo DR</label><select id="cf-ret-dr-type" class="form-select"><option value="">—</option>${opts(DR_TYPES)}</select></div>
            <div class="form-group"><label class="form-label">Sucesso?</label><select id="cf-ret-dr-success" class="form-select"><option value="">—</option><option value="true">Sim</option><option value="false">Não</option></select></div>
            <div class="form-group"><label class="form-label">Nº Cirurgias</label><input type="number" id="cf-ret-dr-count" class="form-input" min="1"></div>
          </div>
          <div class="form-row-3">
            <div class="form-group"><label class="form-label">Técnica</label><select id="cf-ret-dr-tech" class="form-select"><option value="">—</option>${opts(DR_TECHNIQUES)}</select></div>
            <div class="form-group"><label class="form-label">Extensão</label><input type="text" id="cf-ret-dr-ext" class="form-input" placeholder="Quadrantes"></div>
            <div class="form-group"><label class="form-label">Óleo Silicone?</label><select id="cf-ret-dr-oil" class="form-select"><option value="">—</option><option value="true">Sim</option><option value="false">Não</option></select></div>
          </div>
        </div>

        <!-- Complicações Retina -->
        <div class="form-group mt-md"><label class="form-label">Complicações</label>
          <div class="checkbox-group">${RETINA_COMPLICATIONS.map(c=>`<label class="checkbox-label"><input type="checkbox" class="retina-comp-check" value="${c.value}">${c.label}</label>`).join('')}</div>
        </div>
        <div class="form-group"><label class="form-label">Outras Complicações</label><input type="text" id="cf-ret-comp-other" class="form-input" placeholder="Descrever"></div>
      </div>
    </div>

    <!-- Notes -->
    <div class="form-section"><h3>📝 Observações</h3></div>
    <div class="form-group"><textarea id="cf-notes" class="form-textarea" rows="3" placeholder="Anotações clínicas livres..."></textarea></div>

    <div class="modal-footer" style="padding:1rem 0 0;border-top:1px solid var(--border-subtle);margin-top:1rem">
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('${MODAL_ID}').classList.remove('open');document.body.style.overflow=''">Cancelar</button>
      <button type="submit" class="btn btn-primary">Salvar Evolução</button>
    </div>
  </form>`;
}

// Autocomplete item styles (injected once)
if (!document.getElementById('autocomplete-styles')) {
  const style = document.createElement('style');
  style.id = 'autocomplete-styles';
  style.textContent = `.autocomplete-item{padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border-subtle);transition:background 0.15s}.autocomplete-item:hover{background:rgba(15,165,165,0.08)}`;
  document.head.appendChild(style);
}
