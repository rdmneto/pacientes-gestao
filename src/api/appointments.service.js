/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Appointments Service (CRUD)
 * Operações para a agenda cirúrgica
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { COLLECTIONS, createAppointmentDocument, APPOINTMENT_STATUS } from '../db/db.schema.js';
import { getTenantId, getCurrentUser } from '../auth/auth.service.js';

const col = () => collection(db, COLLECTIONS.APPOINTMENTS);

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

export async function createAppointment(data) {
  try {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId || !user) return { success: false, error: 'Sessão expirada.' };

    if (!data.patientId) return { success: false, error: 'Paciente é obrigatório.' };
    if (!data.dateTime) return { success: false, error: 'Data e hora são obrigatórios.' };
    if (!data.type) return { success: false, error: 'Tipo é obrigatório.' };

    const document = createAppointmentDocument(data, tenantId, user.uid);
    const docRef = await addDoc(col(), document);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    return { success: false, error: 'Erro ao criar agendamento.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────

export async function getAppointmentById(id) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.APPOINTMENTS, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    return null;
  }
}

/**
 * Lista agendamentos por período
 * @param {string} startDate - ISO datetime
 * @param {string} endDate - ISO datetime
 * @param {string} status - Filtro opcional
 * @returns {Promise<object[]>}
 */
export async function listAppointments(startDate, endDate, status = null) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const constraints = [
      where('tenantId', '==', tenantId),
      orderBy('dateTime', 'asc'),
    ];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    const q = query(col(), ...constraints);
    const snap = await getDocs(q);

    let appointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filtrar por período client-side
    if (startDate) appointments = appointments.filter(a => a.dateTime >= startDate);
    if (endDate) appointments = appointments.filter(a => a.dateTime <= endDate);

    return appointments;
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    return [];
  }
}

/**
 * Retorna agendamentos de hoje
 */
export async function getTodayAppointments() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
  return listAppointments(start, end);
}

/**
 * Retorna agendamentos da semana
 */
export async function getWeekAppointments() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return listAppointments(startOfWeek.toISOString(), endOfWeek.toISOString());
}

/**
 * Retorna agendamentos do mês
 */
export async function getMonthAppointments(year, month) {
  const y = year || new Date().getFullYear();
  const m = month !== undefined ? month : new Date().getMonth();
  const start = new Date(y, m, 1).toISOString();
  const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
  return listAppointments(start, end);
}

/**
 * Lista agendamentos de um paciente
 */
export async function getPatientAppointments(patientId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];
    const q = query(col(),
      where('tenantId', '==', tenantId),
      where('patientId', '==', patientId),
      orderBy('dateTime', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export async function updateAppointment(id, data) {
  try {
    const { tenantId, createdAt, createdBy, ...safeData } = data;
    safeData.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, id), safeData);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao atualizar agendamento.' };
  }
}

export async function updateAppointmentStatus(id, newStatus) {
  return updateAppointment(id, { status: newStatus });
}

export async function markWhatsAppSent(id) {
  return updateAppointment(id, { whatsappSent: true });
}

export async function linkConsultation(appointmentId, consultationId) {
  return updateAppointment(appointmentId, {
    consultationId,
    status: APPOINTMENT_STATUS.COMPLETED,
  });
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

export async function deleteAppointment(id) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.APPOINTMENTS, id));
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao excluir agendamento.' };
  }
}
