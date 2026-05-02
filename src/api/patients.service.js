/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Patients Service (CRUD)
 * Todas as operações de banco de dados para pacientes
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  COLLECTIONS, createPatientDocument, validateCPF, formatCPF, calcAge,
} from '../db/db.schema.js';
import { getTenantId, getCurrentUser } from '../auth/auth.service.js';

const col = () => collection(db, COLLECTIONS.PATIENTS);

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

/**
 * Cadastra um novo paciente
 * @param {object} data - Dados do formulário
 * @returns {Promise<{success, id?, error?}>}
 */
export async function createPatient(data) {
  try {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId || !user) return { success: false, error: 'Sessão expirada.' };

    // Validações obrigatórias
    if (!data.name?.trim()) return { success: false, error: 'Nome é obrigatório.' };
    if (!data.cpf?.trim()) return { success: false, error: 'CPF é obrigatório.' };
    if (!data.birthDate) return { success: false, error: 'Data de nascimento é obrigatória.' };

    const cleanCpf = data.cpf.replace(/[^\d]/g, '');
    if (!validateCPF(cleanCpf)) return { success: false, error: 'CPF inválido.' };

    // Verificar duplicidade de CPF no tenant
    const dupQuery = query(col(), where('tenantId', '==', tenantId), where('cpf', '==', formatCPF(cleanCpf)));
    const dupSnap = await getDocs(dupQuery);
    if (!dupSnap.empty) return { success: false, error: 'Já existe um paciente com este CPF.' };

    const document = createPatientDocument(data, tenantId, user.uid);
    const docRef = await addDoc(col(), document);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao criar paciente:', error);
    return { success: false, error: 'Erro ao cadastrar paciente.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────

/**
 * Busca um paciente por ID
 * @param {string} patientId
 * @returns {Promise<object|null>}
 */
export async function getPatientById(patientId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.PATIENTS, patientId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { id: snap.id, ...data, age: calcAge(data.birthDate) };
  } catch (error) {
    console.error('Erro ao buscar paciente:', error);
    return null;
  }
}

/**
 * Lista pacientes do tenant com filtros e paginação
 * @param {object} options
 * @param {string} options.pathology - Filtrar por patologia
 * @param {string} options.status - Filtrar por status
 * @param {string} options.search - Busca por nome (client-side)
 * @param {number} options.pageSize - Itens por página (default 50)
 * @param {object} options.lastDoc - Último documento para paginação
 * @returns {Promise<{patients: object[], lastDoc: object, total: number}>}
 */
export async function listPatients(options = {}) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return { patients: [], lastDoc: null };

    const constraints = [where('tenantId', '==', tenantId)];

    if (options.pathology) {
      constraints.push(where('primaryPathology', '==', options.pathology));
    }
    if (options.status) {
      constraints.push(where('status', '==', options.status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const pageSize = options.pageSize || 50;
    constraints.push(limit(pageSize));

    if (options.lastDoc) {
      constraints.push(startAfter(options.lastDoc));
    }

    const q = query(col(), ...constraints);
    const snap = await getDocs(q);

    let patients = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      age: calcAge(d.data().birthDate),
      _doc: d, // Para paginação
    }));

    // Filtro por nome (client-side, Firestore não suporta LIKE)
    if (options.search) {
      const term = options.search.toLowerCase();
      patients = patients.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.cpf.includes(term)
      );
    }

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return { patients, lastDoc };
  } catch (error) {
    console.error('Erro ao listar pacientes:', error);
    return { patients: [], lastDoc: null };
  }
}

/**
 * Busca pacientes por nome (para autocomplete/search)
 * @param {string} searchTerm
 * @param {number} maxResults
 * @returns {Promise<object[]>}
 */
export async function searchPatients(searchTerm, maxResults = 10) {
  try {
    const tenantId = getTenantId();
    if (!tenantId || !searchTerm) return [];

    // Buscar todos e filtrar client-side (Firestore não tem full-text search)
    const q = query(col(), where('tenantId', '==', tenantId), orderBy('name'), limit(200));
    const snap = await getDocs(q);
    const term = searchTerm.toLowerCase();

    return snap.docs
      .map(d => ({ id: d.id, ...d.data(), age: calcAge(d.data().birthDate) }))
      .filter(p => p.name.toLowerCase().includes(term) || p.cpf.includes(term))
      .slice(0, maxResults);
  } catch (error) {
    console.error('Erro na busca:', error);
    return [];
  }
}

/**
 * Conta total de pacientes do tenant
 * @returns {Promise<number>}
 */
export async function countPatients() {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return 0;
    const q = query(col(), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

/**
 * Atualiza dados de um paciente
 * @param {string} patientId
 * @param {object} data - Campos a atualizar
 * @returns {Promise<{success, error?}>}
 */
export async function updatePatient(patientId, data) {
  try {
    // Não permitir alteração do tenantId
    const { tenantId, createdAt, createdBy, ...safeData } = data;

    // Se CPF foi alterado, revalidar
    if (safeData.cpf) {
      const clean = safeData.cpf.replace(/[^\d]/g, '');
      if (!validateCPF(clean)) return { success: false, error: 'CPF inválido.' };
      safeData.cpf = formatCPF(clean);
    }

    safeData.updatedAt = new Date().toISOString();

    await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientId), safeData);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar paciente:', error);
    return { success: false, error: 'Erro ao atualizar paciente.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

/**
 * Remove um paciente (soft delete alterando status, ou hard delete)
 * @param {string} patientId
 * @param {boolean} hard - Se true, remove definitivamente
 * @returns {Promise<{success, error?}>}
 */
export async function deletePatient(patientId, hard = false) {
  try {
    if (hard) {
      await deleteDoc(doc(db, COLLECTIONS.PATIENTS, patientId));
    } else {
      await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientId), {
        status: 'discharged',
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Erro ao remover paciente:', error);
    return { success: false, error: 'Erro ao remover paciente.' };
  }
}
