/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Dashboard / BI Service
 * Agregações e estatísticas para o painel de Business Intelligence
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, getDocs, query, where, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  COLLECTIONS, PATHOLOGIES, calcVisualAcuityOutcome, logmarToSnellenApprox,
} from '../db/db.schema.js';
import { getTenantId } from '../auth/auth.service.js';

// ─────────────────────────────────────────────────────────────────
// VOLUME: Contagens e séries temporais
// ─────────────────────────────────────────────────────────────────

/**
 * Estatísticas gerais do tenant
 * @returns {Promise<object>}
 */
export async function getOverviewStats() {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const [patients, consultations, appointments] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.PATIENTS), where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, COLLECTIONS.CONSULTATIONS), where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, COLLECTIONS.APPOINTMENTS), where('tenantId', '==', tenantId))),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const allConsults = consultations.docs.map(d => d.data());
  const allAppts = appointments.docs.map(d => d.data());

  const surgeries = allConsults.filter(c => c.type === 'cirurgia');
  const surgeriesThisMonth = surgeries.filter(c => c.date >= startOfMonth);
  const apptsThisWeek = allAppts.filter(a => a.dateTime >= startOfWeek);

  return {
    totalPatients: patients.size,
    totalConsultations: consultations.size,
    totalSurgeries: surgeries.length,
    surgeriesThisMonth: surgeriesThisMonth.length,
    appointmentsThisWeek: apptsThisWeek.length,
    appointmentsTotal: appointments.size,
  };
}

/**
 * Cirurgias por tipo/patologia agrupadas por mês
 * @param {number} months - Quantos meses retroativos (default 12)
 * @returns {Promise<object>} { labels: string[], datasets: {pathology, data}[] }
 */
export async function getSurgeriesByMonth(months = 12) {
  const tenantId = getTenantId();
  if (!tenantId) return { labels: [], datasets: [] };

  const q = query(
    collection(db, COLLECTIONS.CONSULTATIONS),
    where('tenantId', '==', tenantId),
    where('type', '==', 'cirurgia'),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  const surgeries = snap.docs.map(d => d.data());

  // Gerar labels dos últimos N meses
  const labels = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
  }

  // Agrupar por patologia e mês
  const pathologies = ['catarata', 'refrativa', 'retina_vitreo', 'outro'];
  const datasets = pathologies.map(path => {
    const data = new Array(months).fill(0);
    surgeries
      .filter(s => s.pathology === path)
      .forEach(s => {
        const sDate = new Date(s.date);
        const monthsDiff = (now.getFullYear() - sDate.getFullYear()) * 12 + (now.getMonth() - sDate.getMonth());
        const idx = months - 1 - monthsDiff;
        if (idx >= 0 && idx < months) data[idx]++;
      });
    return { pathology: path, data };
  });

  return { labels, datasets };
}

// ─────────────────────────────────────────────────────────────────
// DESFECHOS CLÍNICOS: Acuidade Visual
// ─────────────────────────────────────────────────────────────────

/**
 * Dados de AV pré vs. pós-operatória para gráficos
 * @param {string} pathology - Filtro opcional
 * @param {string} eye - OD ou OE (default ambos)
 * @returns {Promise<object>} { preValues, postValues, deltas, avgImprovement }
 */
export async function getVisualAcuityOutcomes(pathology = null, eye = null) {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const constraints = [
    where('tenantId', '==', tenantId),
    where('type', '==', 'cirurgia'),
  ];
  if (pathology) constraints.push(where('pathology', '==', pathology));

  const q = query(collection(db, COLLECTIONS.CONSULTATIONS), ...constraints);
  const snap = await getDocs(q);
  const data = snap.docs.map(d => d.data());

  const results = [];

  for (const consult of data) {
    // Processar OD
    if ((!eye || eye === 'OD') && consult.avPreOD_logmar !== null && consult.avPostOD_logmar !== null) {
      results.push({
        patientId: consult.patientId,
        eye: 'OD',
        pre: consult.avPreOD_logmar,
        post: consult.avPostOD_logmar,
        preSnellen: consult.avPreOD_snellen,
        postSnellen: consult.avPostOD_snellen,
        outcome: calcVisualAcuityOutcome(consult.avPreOD_logmar, consult.avPostOD_logmar),
        date: consult.date,
        pathology: consult.pathology,
      });
    }
    // Processar OE
    if ((!eye || eye === 'OE') && consult.avPreOE_logmar !== null && consult.avPostOE_logmar !== null) {
      results.push({
        patientId: consult.patientId,
        eye: 'OE',
        pre: consult.avPreOE_logmar,
        post: consult.avPostOE_logmar,
        preSnellen: consult.avPreOE_snellen,
        postSnellen: consult.avPostOE_snellen,
        outcome: calcVisualAcuityOutcome(consult.avPreOE_logmar, consult.avPostOE_logmar),
        date: consult.date,
        pathology: consult.pathology,
      });
    }
  }

  // Calcular médias
  const improved = results.filter(r => r.outcome?.improved);
  const avgPreLM = results.length > 0
    ? results.reduce((s, r) => s + r.pre, 0) / results.length : null;
  const avgPostLM = results.length > 0
    ? results.reduce((s, r) => s + r.post, 0) / results.length : null;

  return {
    results,
    totalEyes: results.length,
    improvedCount: improved.length,
    improvementRate: results.length > 0
      ? parseFloat(((improved.length / results.length) * 100).toFixed(1)) : 0,
    avgPreLogMAR: avgPreLM !== null ? parseFloat(avgPreLM.toFixed(2)) : null,
    avgPostLogMAR: avgPostLM !== null ? parseFloat(avgPostLM.toFixed(2)) : null,
    avgPreSnellen: avgPreLM !== null ? logmarToSnellenApprox(avgPreLM) : null,
    avgPostSnellen: avgPostLM !== null ? logmarToSnellenApprox(avgPostLM) : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// DESFECHOS: Retina
// ─────────────────────────────────────────────────────────────────

/**
 * Taxa de sucesso para Descolamento de Retina (primeira cirurgia)
 */
export async function getDRSuccessRate() {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const q = query(
    collection(db, COLLECTIONS.CONSULTATIONS),
    where('tenantId', '==', tenantId),
    where('pathology', '==', PATHOLOGIES.RETINA),
    where('type', '==', 'cirurgia')
  );
  const snap = await getDocs(q);
  const drCases = snap.docs.map(d => d.data()).filter(c => c.retinaData?.retinaCondition === 'dr');

  const total = drCases.length;
  const successFirst = drCases.filter(c => c.retinaData?.drSuccess && (c.retinaData?.drSurgeriesCount || 1) === 1).length;
  const successOverall = drCases.filter(c => c.retinaData?.drSuccess).length;

  return {
    total,
    successFirstSurgery: successFirst,
    successFirstRate: total > 0 ? parseFloat(((successFirst / total) * 100).toFixed(1)) : 0,
    successOverall,
    successOverallRate: total > 0 ? parseFloat(((successOverall / total) * 100).toFixed(1)) : 0,
  };
}

/**
 * Taxa de fechamento para Buraco Macular
 */
export async function getMHClosureRate() {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const q = query(
    collection(db, COLLECTIONS.CONSULTATIONS),
    where('tenantId', '==', tenantId),
    where('pathology', '==', PATHOLOGIES.RETINA),
    where('type', '==', 'cirurgia')
  );
  const snap = await getDocs(q);
  const mhCases = snap.docs.map(d => d.data()).filter(c => c.retinaData?.retinaCondition === 'buraco_macular');

  const total = mhCases.length;
  const closed = mhCases.filter(c => c.retinaData?.mhClosed === true).length;

  return {
    total,
    closed,
    closureRate: total > 0 ? parseFloat(((closed / total) * 100).toFixed(1)) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// DESFECHOS: Catarata
// ─────────────────────────────────────────────────────────────────

/**
 * Distribuição de tipos de LIO implantadas
 */
export async function getLIODistribution() {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  const q = query(
    collection(db, COLLECTIONS.CONSULTATIONS),
    where('tenantId', '==', tenantId),
    where('pathology', '==', PATHOLOGIES.CATARACT),
    where('type', '==', 'cirurgia')
  );
  const snap = await getDocs(q);
  const cases = snap.docs.map(d => d.data()).filter(c => c.cataractData?.lioType);

  const distribution = {};
  cases.forEach(c => {
    const type = c.cataractData.lioType;
    distribution[type] = (distribution[type] || 0) + 1;
  });

  const total = cases.length;
  const premium = (distribution['premium_multifocal'] || 0) + (distribution['premium_edof'] || 0);
  const plano = distribution['plano'] || 0;

  return {
    distribution,
    total,
    premiumCount: premium,
    premiumRate: total > 0 ? parseFloat(((premium / total) * 100).toFixed(1)) : 0,
    planoCount: plano,
    planoRate: total > 0 ? parseFloat(((plano / total) * 100).toFixed(1)) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Agregar todos os dados do dashboard
// ─────────────────────────────────────────────────────────────────

/**
 * Carrega todos os dados necessários para o Dashboard BI de uma vez
 * @returns {Promise<object>}
 */
export async function getFullDashboardData() {
  const [overview, surgeryVolume, avOutcomes, drSuccess, mhClosure, lioDistrib] =
    await Promise.all([
      getOverviewStats(),
      getSurgeriesByMonth(12),
      getVisualAcuityOutcomes(),
      getDRSuccessRate(),
      getMHClosureRate(),
      getLIODistribution(),
    ]);

  return {
    overview,
    surgeryVolume,
    avOutcomes,
    drSuccess,
    mhClosure,
    lioDistrib,
  };
}
