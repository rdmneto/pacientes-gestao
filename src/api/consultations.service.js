/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Consultations Service (CRUD)
 * Operações para consultas, cirurgias e evoluções clínicas
 * Converte automaticamente Snellen→LogMAR e calcula Equiv. Esférico
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  COLLECTIONS, createConsultationDocument, snellenToLogMAR, calcSphericalEquivalent,
} from '../db/db.schema.js';
import { getTenantId, getCurrentUser } from '../auth/auth.service.js';

const col = () => collection(db, COLLECTIONS.CONSULTATIONS);

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

/**
 * Cria uma nova consulta/cirurgia com conversões automáticas
 * @param {object} data - Dados do formulário
 * @returns {Promise<{success, id?, error?}>}
 */
export async function createConsultation(data) {
  try {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId || !user) return { success: false, error: 'Sessão expirada.' };

    if (!data.patientId) return { success: false, error: 'Paciente é obrigatório.' };
    if (!data.type) return { success: false, error: 'Tipo de atendimento é obrigatório.' };
    if (!data.date) return { success: false, error: 'Data é obrigatória.' };
    if (!data.pathology) return { success: false, error: 'Patologia é obrigatória.' };
    if (!data.eye) return { success: false, error: 'Olho operado é obrigatório.' };

    // createConsultationDocument já faz as conversões Snellen→LogMAR e calcula SE
    const document = createConsultationDocument(data, tenantId, user.uid);
    const docRef = await addDoc(col(), document);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao criar consulta:', error);
    return { success: false, error: 'Erro ao registrar consulta.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────

/**
 * Busca uma consulta por ID
 */
export async function getConsultationById(consultationId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('Erro ao buscar consulta:', error);
    return null;
  }
}

/**
 * Lista consultas de um paciente específico (histórico longitudinal)
 * @param {string} patientId
 * @returns {Promise<object[]>}
 */
export async function getPatientConsultations(patientId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const q = query(col(),
      where('tenantId', '==', tenantId),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Erro ao listar consultas:', error);
    return [];
  }
}

/**
 * Lista consultas do tenant com filtros
 * @param {object} options
 * @param {string} options.pathology
 * @param {string} options.type
 * @param {string} options.startDate - ISO string
 * @param {string} options.endDate - ISO string
 * @param {number} options.pageSize
 * @param {object} options.lastDoc
 * @returns {Promise<{consultations: object[], lastDoc: object}>}
 */
export async function listConsultations(options = {}) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return { consultations: [], lastDoc: null };

    const constraints = [where('tenantId', '==', tenantId)];

    if (options.pathology) {
      constraints.push(where('pathology', '==', options.pathology));
    }
    if (options.type) {
      constraints.push(where('type', '==', options.type));
    }

    constraints.push(orderBy('date', 'desc'));
    constraints.push(limit(options.pageSize || 50));

    if (options.lastDoc) {
      constraints.push(startAfter(options.lastDoc));
    }

    const q = query(col(), ...constraints);
    const snap = await getDocs(q);

    let consultations = snap.docs.map(d => ({ id: d.id, ...d.data(), _doc: d }));

    // Filtro por período (client-side para simplificar índices)
    if (options.startDate) {
      consultations = consultations.filter(c => c.date >= options.startDate);
    }
    if (options.endDate) {
      consultations = consultations.filter(c => c.date <= options.endDate);
    }

    return {
      consultations,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  } catch (error) {
    console.error('Erro ao listar consultas:', error);
    return { consultations: [], lastDoc: null };
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

/**
 * Atualiza uma consulta existente. Recalcula LogMAR e SE automaticamente.
 * @param {string} consultationId
 * @param {object} data
 * @returns {Promise<{success, error?}>}
 */
export async function updateConsultation(consultationId, data) {
  try {
    const { tenantId, createdAt, createdBy, ...safeData } = data;

    // Recalcular campos derivados se AV ou Refração foram alterados
    const avFields = ['avPreOD', 'avPreOE', 'avPostOD', 'avPostOE'];
    for (const prefix of avFields) {
      const snellenKey = `${prefix}_snellen`;
      if (snellenKey in safeData) {
        safeData[`${prefix}_logmar`] = snellenToLogMAR(safeData[snellenKey]);
      }
    }

    const refrPairs = [
      ['refrPreOD', 'refrPreOD_se'],
      ['refrPreOE', 'refrPreOE_se'],
      ['refrPostOD', 'refrPostOD_se'],
      ['refrPostOE', 'refrPostOE_se'],
    ];
    for (const [prefix, seKey] of refrPairs) {
      const sphKey = `${prefix}_sphere`;
      const cylKey = `${prefix}_cylinder`;
      if (sphKey in safeData || cylKey in safeData) {
        safeData[seKey] = calcSphericalEquivalent(
          safeData[sphKey] ?? null,
          safeData[cylKey] ?? null
        );
      }
    }

    safeData.updatedAt = new Date().toISOString();

    await updateDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId), safeData);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar consulta:', error);
    return { success: false, error: 'Erro ao atualizar consulta.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

export async function deleteConsultation(consultationId) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId));
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir consulta:', error);
    return { success: false, error: 'Erro ao excluir consulta.' };
  }
}
