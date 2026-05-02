/**
 * OftalmoCare — WhatsApp Module Component
 * Configuração, envio de mensagens e histórico de logs
 */
import {
  sendTemplateMessage, sendCustomMessage, getAvailableTemplates,
  getPatientWhatsAppLogs, updateWhatsAppConfig,
} from '../api/whatsapp.service.js';
import { searchPatients, getPatientById } from '../api/patients.service.js';
import { WHATSAPP_TEMPLATES, WHATSAPP_MODE } from '../db/db.schema.js';
import { createModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const templates = getAvailableTemplates();

export function initWhatsApp(container) {
  container.innerHTML = `
    <div class="welcome-section"><h1>WhatsApp</h1><p>Envie mensagens automáticas ou personalizadas para seus pacientes.</p></div>

    <div class="tabs" style="max-width:500px;margin-bottom:1.5rem">
      <button class="tab-btn active" data-wtab="send" id="wtab-send">Enviar Mensagem</button>
      <button class="tab-btn" data-wtab="logs" id="wtab-logs">Histórico</button>
      <button class="tab-btn" data-wtab="config" id="wtab-config">Configuração</button>
    </div>

    <div id="wpane-send" class="detail-pane active">${buildSendPane()}</div>
    <div id="wpane-logs" class="detail-pane">${buildLogsPane()}</div>
    <div id="wpane-config" class="detail-pane">${buildConfigPane()}</div>
  `;

  // Tab switching
  container.querySelectorAll('[data-wtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-wtab]').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`wpane-${btn.dataset.wtab}`).classList.add('active');
    });
  });

  bindSendEvents(container);
  bindConfigEvents(container);
  bindLogsEvents(container);
}

// ── SEND PANE ──────────────────────────────────────────────────
function buildSendPane() {
  return `
    <div class="bi-grid" style="grid-template-columns:1fr 1fr;max-width:900px">
      <!-- Left: Form -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>📨 Enviar Mensagem</h3></div>

        <div class="form-group" style="position:relative" id="wa-patient-wrap">
          <label class="form-label">Paciente *</label>
          <input type="hidden" id="wa-patient-id">
          <input type="hidden" id="wa-patient-name">
          <input type="hidden" id="wa-patient-phone">
          <input type="text" id="wa-patient-search" class="form-input" placeholder="Buscar paciente por nome..." autocomplete="off">
          <div id="wa-patient-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-md);max-height:180px;overflow-y:auto;z-index:10"></div>
        </div>

        <div id="wa-patient-info" style="display:none" class="alert alert-info mb-md">
          <strong id="wa-info-name"></strong><br>
          <span id="wa-info-phone" style="font-size:0.83rem"></span>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de Mensagem</label>
          <select id="wa-msg-type" class="form-select">
            <option value="template">Template Pré-definido</option>
            <option value="custom">Mensagem Personalizada</option>
          </select>
        </div>

        <div id="wa-template-section">
          <div class="form-group">
            <label class="form-label">Template</label>
            <select id="wa-template" class="form-select">
              ${templates.map(t => `<option value="${t.key}">${t.title}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data (para agendamento/cirurgia)</label>
            <input type="date" id="wa-template-date" class="form-input">
          </div>
        </div>

        <div id="wa-custom-section" style="display:none">
          <div class="form-group">
            <label class="form-label">Mensagem *</label>
            <textarea id="wa-custom-msg" class="form-textarea" rows="5" placeholder="Digite a mensagem para o paciente..."></textarea>
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="wa-send-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          Enviar via WhatsApp
        </button>
      </div>

      <!-- Right: Preview -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>👁️ Pré-visualização</h3></div>
        <div id="wa-preview" style="background:rgba(0,0,0,0.2);border-radius:var(--radius-lg);padding:1rem;min-height:200px;white-space:pre-wrap;font-size:0.83rem;line-height:1.6;color:var(--text-secondary)">
          Selecione um template para visualizar a mensagem.
        </div>
      </div>
    </div>
  `;
}

function bindSendEvents(container) {
  // Patient search
  const searchInput = document.getElementById('wa-patient-search');
  const results = document.getElementById('wa-patient-results');
  let debounce;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const term = searchInput.value.trim();
      if (term.length < 2) { results.style.display = 'none'; return; }
      const patients = await searchPatients(term, 8);
      results.style.display = 'block';
      results.innerHTML = patients.map(p =>
        `<div style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border-subtle)" data-id="${p.id}" data-name="${p.name}" data-phone="${p.phone||''}">${p.name} <span style="color:var(--text-muted);font-size:0.75rem">${p.phone||'sem telefone'}</span></div>`
      ).join('') || '<div style="padding:8px 12px;color:var(--text-muted);font-size:0.85rem">Nenhum resultado</div>';

      results.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          document.getElementById('wa-patient-id').value = item.dataset.id;
          document.getElementById('wa-patient-name').value = item.dataset.name;
          document.getElementById('wa-patient-phone').value = item.dataset.phone;
          searchInput.value = item.dataset.name;
          results.style.display = 'none';
          // Show info
          document.getElementById('wa-patient-info').style.display = 'block';
          document.getElementById('wa-info-name').textContent = item.dataset.name;
          document.getElementById('wa-info-phone').textContent = item.dataset.phone || '⚠️ Sem telefone cadastrado';
          updatePreview();
        });
      });
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#wa-patient-wrap')) results.style.display = 'none';
  });

  // Message type toggle
  document.getElementById('wa-msg-type').addEventListener('change', (e) => {
    const isTemplate = e.target.value === 'template';
    document.getElementById('wa-template-section').style.display = isTemplate ? '' : 'none';
    document.getElementById('wa-custom-section').style.display = isTemplate ? 'none' : '';
    updatePreview();
  });

  // Template / date change → preview
  document.getElementById('wa-template').addEventListener('change', updatePreview);
  document.getElementById('wa-template-date').addEventListener('change', updatePreview);
  document.getElementById('wa-custom-msg')?.addEventListener('input', updatePreview);

  // Send
  document.getElementById('wa-send-btn').addEventListener('click', handleSend);
}

function updatePreview() {
  const preview = document.getElementById('wa-preview');
  const msgType = document.getElementById('wa-msg-type').value;
  const patientName = document.getElementById('wa-patient-name').value || 'Paciente';

  if (msgType === 'custom') {
    const msg = document.getElementById('wa-custom-msg').value.trim();
    preview.textContent = msg || 'Digite a mensagem para visualizar...';
    return;
  }

  const templateKey = document.getElementById('wa-template').value;
  const dateVal = document.getElementById('wa-template-date').value;
  const dateStr = dateVal ? new Date(dateVal + 'T12:00:00').toLocaleDateString('pt-BR') : 'DD/MM/AAAA';

  const tmpl = templates.find(t => t.key === templateKey);
  if (tmpl) {
    // Re-generate preview with patient name
    const tplMap = {
      [WHATSAPP_TEMPLATES.PRE_OP]: `Olá, ${patientName}! 👋\n\nSua cirurgia está agendada para *${dateStr}*.\n\n📋 *Orientações pré-operatórias:*\n• Compareça em jejum de 8 horas\n• Traga um acompanhante maior de 18 anos\n• Traga documento com foto e cartão do convênio\n• Suspenda uso de lentes de contato\n• Não use maquiagem no dia\n\nEm caso de dúvidas, entre em contato. 😊`,
      [WHATSAPP_TEMPLATES.POS_OP]: `Olá, ${patientName}! 👋\n\nEsperamos que esteja se recuperando bem! 💚\n\n📋 *Orientações pós-operatórias:*\n• Utilize os colírios conforme prescrição\n• Não esfregue os olhos\n• Evite esforço físico por 7 dias\n• Use o protetor ocular para dormir\n• Evite piscina e poeira por 15 dias\n\nQualquer anormalidade, entre em contato.`,
      [WHATSAPP_TEMPLATES.AGENDAMENTO]: `Olá, ${patientName}! 👋\n\n📅 *Data:* ${dateStr}\n🏥 *Procedimento:* Consulta\n\nPor favor, confirme sua presença. Obrigado! 😊`,
    };
    preview.textContent = tplMap[templateKey] || tmpl.preview;
  }
}

async function handleSend() {
  const btn = document.getElementById('wa-send-btn');
  const patientId = document.getElementById('wa-patient-id').value;
  const patientPhone = document.getElementById('wa-patient-phone').value;
  const patientName = document.getElementById('wa-patient-name').value;
  const msgType = document.getElementById('wa-msg-type').value;

  if (!patientId) { showToast('Selecione um paciente.', 'error'); return; }
  if (!patientPhone) { showToast('Paciente sem telefone cadastrado.', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Enviando...';

  let result;
  if (msgType === 'template') {
    const templateKey = document.getElementById('wa-template').value;
    const dateVal = document.getElementById('wa-template-date').value;
    const dateStr = dateVal ? new Date(dateVal + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    result = await sendTemplateMessage(patientId, patientPhone, patientName, templateKey, { date: dateStr });
  } else {
    const customMsg = document.getElementById('wa-custom-msg').value.trim();
    if (!customMsg) { showToast('Digite a mensagem.', 'error'); btn.disabled = false; btn.innerHTML = 'Enviar via WhatsApp'; return; }
    result = await sendCustomMessage(patientId, patientPhone, customMsg);
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Enviar via WhatsApp';

  if (result.success) {
    showToast('Mensagem enviada com sucesso!', 'success');
  } else {
    showToast(result.error || 'Erro ao enviar mensagem.', 'error');
  }
}

// ── LOGS PANE ──────────────────────────────────────────────────
function buildLogsPane() {
  return `
    <div class="bi-card" style="max-width:700px">
      <div class="bi-card-header"><h3>📋 Histórico de Mensagens</h3></div>
      <div class="form-group" style="position:relative" id="wa-logs-search-wrap">
        <input type="text" id="wa-logs-patient-search" class="form-input" placeholder="Buscar paciente para ver histórico..." autocomplete="off">
        <input type="hidden" id="wa-logs-patient-id">
        <div id="wa-logs-patient-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-md);max-height:180px;overflow-y:auto;z-index:10"></div>
      </div>
      <div id="wa-logs-list">
        <div class="empty-state" style="padding:1rem"><p class="text-muted">Selecione um paciente para ver o histórico de mensagens.</p></div>
      </div>
    </div>
  `;
}

function bindLogsEvents(container) {
  const searchInput = document.getElementById('wa-logs-patient-search');
  const results = document.getElementById('wa-logs-patient-results');
  let debounce;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const term = searchInput.value.trim();
      if (term.length < 2) { results.style.display = 'none'; return; }
      const patients = await searchPatients(term, 8);
      results.style.display = 'block';
      results.innerHTML = patients.map(p =>
        `<div style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border-subtle)" data-id="${p.id}" data-name="${p.name}">${p.name}</div>`
      ).join('');
      results.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', async () => {
          searchInput.value = item.dataset.name;
          results.style.display = 'none';
          await loadLogs(item.dataset.id);
        });
      });
    }, 300);
  });
}

async function loadLogs(patientId) {
  const list = document.getElementById('wa-logs-list');
  list.innerHTML = '<div class="text-center mt-md"><div class="spinner spinner-primary" style="margin:0 auto"></div></div>';

  const logs = await getPatientWhatsAppLogs(patientId);

  if (logs.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:1rem"><p class="text-muted">Nenhuma mensagem enviada para este paciente.</p></div>';
    return;
  }

  const TEMPLATE_NAMES = { pre_op:'Pré-Op', pos_op:'Pós-Op', agendamento:'Agendamento', custom:'Personalizada' };

  list.innerHTML = logs.map(log => {
    const date = log.sentAt ? new Date(log.sentAt).toLocaleString('pt-BR') : '—';
    const statusIcon = log.status === 'sent' ? '✅' : '❌';
    const tmplName = TEMPLATE_NAMES[log.template] || log.template;
    return `
      <div class="appt-card" style="margin-bottom:0.5rem">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.83rem;font-weight:600">${statusIcon} ${tmplName}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${date}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;white-space:pre-wrap;max-height:60px;overflow:hidden;text-overflow:ellipsis">${log.messageBody?.substring(0, 120) || ''}...</div>
        </div>
        <span class="badge ${log.status==='sent'?'badge-active':'badge-suspended'}">${log.status==='sent'?'Enviada':'Falhou'}</span>
      </div>
    `;
  }).join('');
}

// ── CONFIG PANE ──────────────────────────────────────────────────
function buildConfigPane() {
  return `
    <div class="bi-card" style="max-width:560px">
      <div class="bi-card-header"><h3>⚙️ Configuração da API WhatsApp</h3></div>
      <div class="alert alert-info mb-md" style="font-size:0.8rem;line-height:1.6">
        Para enviar mensagens, configure sua conta do <strong>WhatsApp Business API</strong> no 
        <a href="https://developers.facebook.com" target="_blank" style="color:var(--primary-400)">Meta for Developers</a>.
        Você precisará do <em>Phone Number ID</em> e do <em>Access Token</em>.
      </div>

      <form id="wa-config-form" novalidate>
        <div class="form-group">
          <label class="form-label">Phone Number ID</label>
          <input type="text" id="wa-cfg-phone-id" class="form-input" placeholder="Ex: 123456789012345">
        </div>
        <div class="form-group">
          <label class="form-label">Access Token</label>
          <input type="password" id="wa-cfg-token" class="form-input" placeholder="Token permanente do Meta">
          <span class="form-hint">Nunca compartilhe este token. Ele é armazenado criptografado no Firestore.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Modo de Envio</label>
          <select id="wa-cfg-mode" class="form-select">
            <option value="manual">Manual (clique para enviar)</option>
            <option value="automatico">Automático (ao agendar)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Salvar Configuração</button>
      </form>
    </div>
  `;
}

function bindConfigEvents(container) {
  document.getElementById('wa-config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const result = await updateWhatsAppConfig({
      phoneNumberId: document.getElementById('wa-cfg-phone-id').value.trim(),
      accessToken: document.getElementById('wa-cfg-token').value.trim(),
      mode: document.getElementById('wa-cfg-mode').value,
    });

    btn.disabled = false;
    btn.textContent = 'Salvar Configuração';

    if (result.success) {
      showToast('Configuração salva com sucesso!', 'success');
    } else {
      showToast(result.error, 'error');
    }
  });
}
