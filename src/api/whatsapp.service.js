/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — WhatsApp Service
 * Integração com Meta Cloud API (WhatsApp Business)
 * Disparo manual/automático de mensagens para pacientes
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { COLLECTIONS, WHATSAPP_TEMPLATES, WHATSAPP_MODE } from '../db/db.schema.js';
import { getTenantId, getCurrentUser } from '../auth/auth.service.js';

// ─────────────────────────────────────────────────────────────────
// TEMPLATES DE MENSAGEM
// ─────────────────────────────────────────────────────────────────

const MESSAGE_TEMPLATES = {
  [WHATSAPP_TEMPLATES.PRE_OP]: {
    title: 'Orientações Pré-Operatórias',
    body: (patientName, date) =>
      `Olá, ${patientName}! 👋\n\n` +
      `Sua cirurgia está agendada para *${date}*.\n\n` +
      `📋 *Orientações pré-operatórias:*\n` +
      `• Compareça em jejum de 8 horas\n` +
      `• Traga um acompanhante maior de 18 anos\n` +
      `• Traga documento com foto e cartão do convênio\n` +
      `• Suspenda uso de lentes de contato conforme orientação médica\n` +
      `• Não use maquiagem no dia da cirurgia\n\n` +
      `Em caso de dúvidas, entre em contato conosco.\n` +
      `Estamos à disposição! 😊`,
  },

  [WHATSAPP_TEMPLATES.POS_OP]: {
    title: 'Orientações Pós-Operatórias',
    body: (patientName) =>
      `Olá, ${patientName}! 👋\n\n` +
      `Esperamos que esteja se recuperando bem! 💚\n\n` +
      `📋 *Orientações pós-operatórias:*\n` +
      `• Utilize os colírios conforme prescrição médica\n` +
      `• Não esfregue os olhos\n` +
      `• Evite esforço físico por 7 dias\n` +
      `• Use o protetor ocular para dormir conforme orientação\n` +
      `• Evite piscina e ambientes com poeira por 15 dias\n` +
      `• Não dirija até liberação médica\n\n` +
      `📅 Lembre-se do retorno agendado.\n` +
      `Qualquer anormalidade, entre em contato imediatamente.`,
  },

  [WHATSAPP_TEMPLATES.AGENDAMENTO]: {
    title: 'Confirmação de Agendamento',
    body: (patientName, date, type) =>
      `Olá, ${patientName}! 👋\n\n` +
      `Confirmamos seu agendamento:\n\n` +
      `📅 *Data:* ${date}\n` +
      `🏥 *Procedimento:* ${type}\n\n` +
      `Por favor, confirme sua presença respondendo esta mensagem.\n` +
      `Obrigado! 😊`,
  },
};

// ─────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO TENANT
// ─────────────────────────────────────────────────────────────────

/**
 * Busca a configuração WhatsApp do tenant
 * @returns {Promise<object|null>}
 */
async function getTenantWhatsAppConfig() {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const snap = await getDoc(doc(db, COLLECTIONS.TENANTS, tenantId));
  if (!snap.exists()) return null;

  const config = snap.data().whatsappConfig;
  if (!config?.phoneNumberId || !config?.accessToken) return null;

  return config;
}

/**
 * Atualiza a configuração WhatsApp do tenant
 * @param {object} config
 * @returns {Promise<{success, error?}>}
 */
export async function updateWhatsAppConfig(config) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return { success: false, error: 'Sessão expirada.' };

    await updateDoc(doc(db, COLLECTIONS.TENANTS, tenantId), {
      'whatsappConfig.phoneNumberId': config.phoneNumberId || null,
      'whatsappConfig.accessToken': config.accessToken || null,
      'whatsappConfig.mode': config.mode || WHATSAPP_MODE.MANUAL,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao salvar configuração.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// ENVIO DE MENSAGENS
// ─────────────────────────────────────────────────────────────────

/**
 * Envia mensagem via WhatsApp Cloud API
 * @param {string} phone - Número do paciente (formato: 5585999990000)
 * @param {string} message - Texto da mensagem
 * @returns {Promise<{success, messageId?, error?}>}
 */
async function sendWhatsAppMessage(phone, message) {
  const config = await getTenantWhatsAppConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp não configurado. Acesse Configurações.' };
  }

  // Limpar número (remover formatação)
  const cleanPhone = phone.replace(/[^\d]/g, '');
  // Adicionar código do país se não tiver
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const result = await response.json();

    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id };
    } else {
      const errMsg = result.error?.message || 'Erro desconhecido na API Meta.';
      return { success: false, error: errMsg };
    }
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return { success: false, error: 'Erro de conexão com a API do WhatsApp.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÕES PÚBLICAS DE DISPARO
// ─────────────────────────────────────────────────────────────────

/**
 * Envia um template pré-definido para um paciente
 * @param {string} patientId
 * @param {string} patientPhone
 * @param {string} patientName
 * @param {string} templateKey - pre_op, pos_op, agendamento
 * @param {object} templateData - Dados adicionais (date, type, etc.)
 * @returns {Promise<{success, error?}>}
 */
export async function sendTemplateMessage(patientId, patientPhone, patientName, templateKey, templateData = {}) {
  if (!patientPhone) return { success: false, error: 'Paciente sem telefone cadastrado.' };

  const template = MESSAGE_TEMPLATES[templateKey];
  if (!template) return { success: false, error: 'Template não encontrado.' };

  const messageBody = template.body(patientName, templateData.date, templateData.type);

  return sendAndLog(patientId, patientPhone, messageBody, templateKey);
}

/**
 * Envia mensagem personalizada (texto livre)
 * @param {string} patientId
 * @param {string} patientPhone
 * @param {string} customMessage
 * @returns {Promise<{success, error?}>}
 */
export async function sendCustomMessage(patientId, patientPhone, customMessage) {
  if (!patientPhone) return { success: false, error: 'Paciente sem telefone cadastrado.' };
  if (!customMessage?.trim()) return { success: false, error: 'Mensagem não pode ser vazia.' };

  return sendAndLog(patientId, patientPhone, customMessage, WHATSAPP_TEMPLATES.CUSTOM);
}

/**
 * Envia mensagem e registra log no Firestore
 */
async function sendAndLog(patientId, phone, messageBody, templateKey) {
  const tenantId = getTenantId();
  const user = getCurrentUser();

  const result = await sendWhatsAppMessage(phone, messageBody);

  // Registrar no log (mesmo se falhou)
  try {
    await addDoc(collection(db, COLLECTIONS.WHATSAPP_LOGS), {
      tenantId,
      patientId,
      patientPhone: phone,
      template: templateKey,
      messageBody,
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.messageId || null,
      sentAt: new Date().toISOString(),
      sentBy: user?.uid || null,
      mode: WHATSAPP_MODE.MANUAL,
    });
  } catch (logError) {
    console.warn('Erro ao salvar log WhatsApp:', logError);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────────

/**
 * Lista logs de mensagens enviadas a um paciente
 */
export async function getPatientWhatsAppLogs(patientId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_LOGS),
      where('tenantId', '==', tenantId),
      where('patientId', '==', patientId),
      orderBy('sentAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    return [];
  }
}

/**
 * Retorna todos os templates disponíveis para seleção na UI
 */
export function getAvailableTemplates() {
  return Object.entries(MESSAGE_TEMPLATES).map(([key, tmpl]) => ({
    key,
    title: tmpl.title,
    preview: tmpl.body('Paciente', '00/00/0000', 'Cirurgia'),
  }));
}
