/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — db.schema.js
 * Definições do Schema do Banco de Dados (Firestore)
 * Funções utilitárias de cálculo clínico obrigatórias
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────
// ENUMERAÇÕES (Constantes de domínio)
// ─────────────────────────────────────────────────────────────────

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  MEDICO: 'medico',
  ATENDENTE: 'atendente',
};

export const USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
};

export const TENANT_PLANS = {
  TRIAL: 'trial',
  BASIC: 'basic',
  PREMIUM: 'premium',
};

export const PATIENT_STATUS = {
  ACTIVE: 'active',
  POST_OP: 'post_op',
  FOLLOW_UP: 'follow_up',
  DISCHARGED: 'discharged',
};

export const PATHOLOGIES = {
  CATARACT: 'catarata',
  REFRACTIVE: 'refrativa',
  RETINA: 'retina_vitreo',
  OTHER: 'outro',
};

export const PATHOLOGY_LABELS = {
  catarata: 'Catarata',
  refrativa: 'Transtornos Refrativos',
  retina_vitreo: 'Transtornos Vítreo-Retinianos',
  outro: 'Outro',
};

export const CONSULTATION_TYPES = {
  CONSULTA: 'consulta',
  CIRURGIA: 'cirurgia',
  LASER: 'laser',
  INJECAO: 'injecao',
  RETORNO: 'retorno',
};

export const EYE_OPTIONS = {
  OD: 'OD',   // Olho Direito
  OE: 'OE',   // Olho Esquerdo
  AO: 'AO',   // Ambos os Olhos
};

export const LIO_TYPES = {
  PREMIUM_MULTIFOCAL: 'premium_multifocal',
  PREMIUM_EDOF: 'premium_edof',
  MONOFOCAL: 'monofocal',
  PLANO: 'plano',
  OUTRO: 'outro',
};

export const LIO_LABELS = {
  premium_multifocal: 'Premium Multifocal',
  premium_edof: 'Premium Foco Estendido (EDOF)',
  monofocal: 'Monofocal',
  plano: 'Plano',
  outro: 'Outro',
};

export const CATARACT_TECHNIQUES = {
  FACOEMULSIFICACAO: 'facoemulsificacao',
  FACO_IOL: 'faco_iol',
  EXTRACAPSULAR: 'extracapsular',
  FEMTO: 'femto',
};

export const REFRACTIVE_ERRORS = {
  MIOPIA: 'miopia',
  HIPERMETROPIA: 'hipermetropia',
  ASTIGMATISMO: 'astigmatismo',
  PRESBIOPIA: 'presbiopia',
  COMBINADO: 'combinado',
};

export const REFRACTIVE_SURGERY_TYPES = {
  LASIK: 'lasik',
  PRK: 'prk',
  SMILE: 'smile',
  FEMTOLASIK: 'femtolasik',
  ICL: 'icl',
  OUTRO: 'outro',
};

export const RETINA_CONDITIONS = {
  BURACO_MACULAR: 'buraco_macular',
  MER: 'mer',
  INJECAO_INTRAVITREA: 'injecao_intravitrea',
  DR: 'dr',
  RETINOPATIA_DIABETICA: 'retinopatia_diabetica',
  OUTRO: 'outro',
};

export const RETINA_CONDITION_LABELS = {
  buraco_macular: 'Buraco Macular',
  mer: 'Membrana Epirretiniana (MER)',
  injecao_intravitrea: 'Injeção Intravítrea',
  dr: 'Descolamento de Retina (DR)',
  retinopatia_diabetica: 'Retinopatia Diabética',
  outro: 'Outro',
};

export const DR_TYPES = {
  REGMATOGENOSO: 'regmatogenoso',
  TRACIONAL: 'tracional',
  EXSUDATIVO: 'exsudativo',
};

export const DR_TECHNIQUES = {
  VITRECTOMIA: 'vitrectomia',
  EXPLANTE: 'explante',
  COMBINADA: 'combinada',
};

export const RETINA_COMPLICATIONS = [
  { value: 'proliferacao_vitreorretiniana', label: 'Proliferação Vítreo-Retiniana (PVR)' },
  { value: 'hipertensao_ocular', label: 'Hipertensão Ocular' },
  { value: 'endoftalmite', label: 'Endoftalmite' },
  { value: 'descolamento_coroide', label: 'Descolamento de Coroide' },
  { value: 'novo_dr', label: 'Novo Descolamento de Retina' },
  { value: 'membrana_epirretiniana', label: 'Membrana Epirretiniana Secundária' },
  { value: 'outro', label: 'Outras' },
];

export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
};

export const ATTACHMENT_CATEGORIES = {
  OCT: 'oct',
  TOPOGRAFIA: 'topografia',
  PENTACAM: 'pentacam',
  PAQUIMETRIA: 'paquimetria',
  MICROSCOPIA: 'microscopia',
  LAUDO: 'laudo',
  OUTRO: 'outro',
};

export const ATTACHMENT_CATEGORY_LABELS = {
  oct: 'OCT (Tomografia de Coerência Óptica)',
  topografia: 'Topografia / Ceratoscopia',
  pentacam: 'Pentacam',
  paquimetria: 'Paquimetria',
  microscopia: 'Microscopia Especular',
  laudo: 'Laudo Médico',
  outro: 'Outro',
};

export const WHATSAPP_TEMPLATES = {
  PRE_OP: 'pre_op',
  POS_OP: 'pos_op',
  AGENDAMENTO: 'agendamento',
  CUSTOM: 'custom',
};

export const WHATSAPP_MODE = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
};

// ─────────────────────────────────────────────────────────────────
// FUNÇÕES UTILITÁRIAS DE CÁLCULO CLÍNICO
// ─────────────────────────────────────────────────────────────────

/**
 * Converte Acuidade Visual de Snellen para LogMAR
 *
 * Suporta:
 *  - Frações padrão: "20/20", "20/200", "20/400"
 *  - Valores especiais: "CD" (Conta Dedos), "MM" (Movimento de Mãos),
 *    "PL" (Percepção de Luz), "SPL" (Sem Percepção de Luz)
 *
 * @param {string} snellen - Valor em Snellen (ex: "20/200")
 * @returns {number|null} Valor LogMAR ou null se inválido
 */
export function snellenToLogMAR(snellen) {
  if (!snellen || typeof snellen !== 'string') return null;

  const normalized = snellen.trim().toUpperCase();

  // Valores especiais de baixa visão
  const specialValues = {
    'SPL': 3.0,
    'SEM PERCEPCAO DE LUZ': 3.0,
    'SEM PERCEPÇÃO DE LUZ': 3.0,
    'PL': 2.9,
    'PERCEPCAO DE LUZ': 2.9,
    'PERCEPÇÃO DE LUZ': 2.9,
    'MM': 2.8,
    'MOVIMENTO DE MAOS': 2.8,
    'MOVIMENTO DE MÃOS': 2.8,
    'CD': 2.7,
    'CONTA DEDOS': 2.7,
  };

  if (normalized in specialValues) {
    return specialValues[normalized];
  }

  // Validar e converter fração Snellen
  const parts = normalized.split('/');
  if (parts.length !== 2) return null;

  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);

  if (isNaN(numerator) || isNaN(denominator)) return null;
  if (numerator <= 0 || denominator <= 0) return null;

  const logmar = Math.log10(denominator / numerator);
  return parseFloat(logmar.toFixed(2));
}

/**
 * Converte LogMAR de volta para Snellen aproximado
 * (usado apenas para exibição nos gráficos)
 *
 * @param {number} logmar - Valor LogMAR
 * @returns {string} Aproximação em Snellen
 */
export function logmarToSnellenApprox(logmar) {
  if (logmar === null || logmar === undefined) return '—';

  if (logmar >= 3.0) return 'SPL';
  if (logmar >= 2.9) return 'PL';
  if (logmar >= 2.8) return 'MM';
  if (logmar >= 2.7) return 'CD';

  const denominator = Math.round(20 * Math.pow(10, logmar));
  return `20/${denominator}`;
}

/**
 * Calcula o Equivalente Esférico (SE)
 * Fórmula: SE = Esférico + (Cilindro / 2)
 *
 * @param {number|string} sphere - Componente esférico (dioptrias)
 * @param {number|string} cylinder - Componente cilíndrico (dioptrias)
 * @returns {number|null} Equivalente Esférico ou null se dados inválidos
 */
export function calcSphericalEquivalent(sphere, cylinder) {
  const sph = parseFloat(sphere);
  const cyl = parseFloat(cylinder);

  if (isNaN(sph)) return null;
  if (isNaN(cyl) || cyl === 0) return parseFloat(sph.toFixed(2));

  return parseFloat((sph + cyl / 2).toFixed(2));
}

/**
 * Calcula a perda ou ganho percentual de LogMAR
 * (para análise de desfechos no Dashboard)
 *
 * @param {number} preLM - LogMAR pré-operatório
 * @param {number} postLM - LogMAR pós-operatório
 * @returns {object} { delta, improved, percentChange }
 */
export function calcVisualAcuityOutcome(preLM, postLM) {
  if (preLM === null || postLM === null) return null;

  const delta = parseFloat((preLM - postLM).toFixed(2)); // Positivo = melhora
  const improved = delta > 0;
  const percentChange = preLM !== 0
    ? parseFloat(((delta / preLM) * 100).toFixed(1))
    : null;

  return { delta, improved, percentChange };
}

/**
 * Valida CPF brasileiro
 * @param {string} cpf - CPF com ou sem formatação
 * @returns {boolean}
 */
export function validateCPF(cpf) {
  const cleaned = cpf.replace(/[^\d]/g, '');

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Todos dígitos iguais

  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Formata CPF para exibição: XXX.XXX.XXX-XX
 * @param {string} cpf - CPF sem formatação
 * @returns {string}
 */
export function formatCPF(cpf) {
  const cleaned = cpf.replace(/[^\d]/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Calcula a idade a partir da data de nascimento
 * @param {string} birthDate - Data ISO 8601 (YYYY-MM-DD)
 * @returns {number} Idade em anos
 */
export function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ─────────────────────────────────────────────────────────────────
// TEMPLATES DE DOCUMENTOS (Firestore Document Shapes)
// ─────────────────────────────────────────────────────────────────

/**
 * Template para criação de novo usuário
 * @param {object} data
 * @returns {object} Documento Firestore
 */
export function createUserDocument(data) {
  return {
    uid: data.uid,
    email: data.email,
    name: data.name,
    role: data.role || USER_ROLES.MEDICO,
    tenantId: data.tenantId || data.uid, // Self-tenant por padrão
    status: USER_STATUS.PENDING,
    crm: data.crm || null,
    specialty: data.specialty || 'Oftalmologia',
    phone: data.phone || null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    lastLoginAt: null,
  };
}

/**
 * Template para criação de novo tenant
 * @param {object} data
 * @returns {object} Documento Firestore
 */
export function createTenantDocument(data) {
  return {
    id: data.ownerUid,
    clinicName: data.clinicName,
    ownerUid: data.ownerUid,
    plan: TENANT_PLANS.TRIAL,
    whatsappConfig: {
      phoneNumberId: null,
      accessToken: null,
      mode: WHATSAPP_MODE.MANUAL,
    },
    settings: {
      timezone: 'America/Fortaleza',
      language: 'pt-BR',
    },
    createdAt: new Date().toISOString(),
    activePatients: 0,
  };
}

/**
 * Template para criação de novo paciente
 * Calcula automaticamente os campos derivados
 * @param {object} data
 * @param {string} tenantId
 * @param {string} createdBy
 * @returns {object} Documento Firestore
 */
export function createPatientDocument(data, tenantId, createdBy) {
  return {
    tenantId,
    createdBy,
    name: data.name,
    cpf: formatCPF(data.cpf),
    birthDate: data.birthDate,
    gender: data.gender || null,
    phone: data.phone || null,
    phone2: data.phone2 || null,
    email: data.email || null,
    address: data.address || null,
    healthInsurance: data.healthInsurance || null,
    primaryPathology: data.primaryPathology || null,
    pathologyDetail: data.pathologyDetail || null,
    status: PATIENT_STATUS.ACTIVE,
    notes: data.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Template para criação de nova consulta/cirurgia
 * Realiza automaticamente as conversões clínicas
 * @param {object} data
 * @param {string} tenantId
 * @param {string} createdBy
 * @returns {object} Documento Firestore
 */
export function createConsultationDocument(data, tenantId, createdBy) {
  const doc = {
    tenantId,
    createdBy,
    patientId: data.patientId,
    type: data.type,
    date: data.date,
    pathology: data.pathology,
    eye: data.eye,
    surgeon: data.surgeon || null,
    facility: data.facility || null,
    notes: data.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // ── Acuidade Visual ──────────────────────────────
    avPreOD_snellen: data.avPreOD_snellen || null,
    avPreOD_logmar: data.avPreOD_snellen ? snellenToLogMAR(data.avPreOD_snellen) : null,
    avPreOE_snellen: data.avPreOE_snellen || null,
    avPreOE_logmar: data.avPreOE_snellen ? snellenToLogMAR(data.avPreOE_snellen) : null,
    avPostOD_snellen: data.avPostOD_snellen || null,
    avPostOD_logmar: data.avPostOD_snellen ? snellenToLogMAR(data.avPostOD_snellen) : null,
    avPostOE_snellen: data.avPostOE_snellen || null,
    avPostOE_logmar: data.avPostOE_snellen ? snellenToLogMAR(data.avPostOE_snellen) : null,

    // ── Refração OD pré-op ───────────────────────────
    refrPreOD_sphere: data.refrPreOD_sphere ?? null,
    refrPreOD_cylinder: data.refrPreOD_cylinder ?? null,
    refrPreOD_axis: data.refrPreOD_axis ?? null,
    refrPreOD_se: calcSphericalEquivalent(data.refrPreOD_sphere, data.refrPreOD_cylinder),

    // ── Refração OE pré-op ───────────────────────────
    refrPreOE_sphere: data.refrPreOE_sphere ?? null,
    refrPreOE_cylinder: data.refrPreOE_cylinder ?? null,
    refrPreOE_axis: data.refrPreOE_axis ?? null,
    refrPreOE_se: calcSphericalEquivalent(data.refrPreOE_sphere, data.refrPreOE_cylinder),

    // ── Refração OD pós-op ───────────────────────────
    refrPostOD_sphere: data.refrPostOD_sphere ?? null,
    refrPostOD_cylinder: data.refrPostOD_cylinder ?? null,
    refrPostOD_axis: data.refrPostOD_axis ?? null,
    refrPostOD_se: calcSphericalEquivalent(data.refrPostOD_sphere, data.refrPostOD_cylinder),

    // ── Refração OE pós-op ───────────────────────────
    refrPostOE_sphere: data.refrPostOE_sphere ?? null,
    refrPostOE_cylinder: data.refrPostOE_cylinder ?? null,
    refrPostOE_axis: data.refrPostOE_axis ?? null,
    refrPostOE_se: calcSphericalEquivalent(data.refrPostOE_sphere, data.refrPostOE_cylinder),

    // ── Tonometria ───────────────────────────────────
    tonoPreOD: data.tonoPreOD ?? null,
    tonoPreOE: data.tonoPreOE ?? null,
    tonoPostOD: data.tonoPostOD ?? null,
    tonoPostOE: data.tonoPostOE ?? null,

    // ── Microscopia Especular ────────────────────────
    microsPreOD: data.microsPreOD ?? null,
    microsPreOE: data.microsPreOE ?? null,
    microsPostOD: data.microsPostOD ?? null,
    microsPostOE: data.microsPostOE ?? null,

    // ── Ceratoscopia ─────────────────────────────────
    keratoPreOD_k1: data.keratoPreOD_k1 ?? null,
    keratoPreOD_k2: data.keratoPreOD_k2 ?? null,
    keratoPreOD_astig: data.keratoPreOD_astig ?? null,
    keratoPreOE_k1: data.keratoPreOE_k1 ?? null,
    keratoPreOE_k2: data.keratoPreOE_k2 ?? null,
    keratoPreOE_astig: data.keratoPreOE_astig ?? null,
    keratoPostOD_astig: data.keratoPostOD_astig ?? null,
    keratoPostOE_astig: data.keratoPostOE_astig ?? null,
  };

  // ── Sub-documentos específicos por patologia ──────
  if (data.pathology === PATHOLOGIES.CATARACT && data.cataractData) {
    doc.cataractData = {
      lioType: data.cataractData.lioType || null,
      lioModel: data.cataractData.lioModel || null,
      lioDiopter: data.cataractData.lioDiopter ?? null,
      lioManufacturer: data.cataractData.lioManufacturer || null,
      axialLength: data.cataractData.axialLength ?? null,
      formulaUsed: data.cataractData.formulaUsed || null,
      targetRefraction: data.cataractData.targetRefraction ?? null,
      technique: data.cataractData.technique || null,
      complications: data.cataractData.complications || null,
    };
  }

  if (data.pathology === PATHOLOGIES.REFRACTIVE && data.refrativeData) {
    doc.refrativeData = {
      refrativeError: data.refrativeData.refrativeError || null,
      surgeryType: data.refrativeData.surgeryType || null,
      surgeryProgram: data.refrativeData.surgeryProgram || null,
      pachymetryOD: data.refrativeData.pachymetryOD ?? null,
      pachymetryOE: data.refrativeData.pachymetryOE ?? null,
      complications: data.refrativeData.complications || null,
    };
  }

  if (data.pathology === PATHOLOGIES.RETINA && data.retinaData) {
    doc.retinaData = {
      retinaCondition: data.retinaData.retinaCondition || null,
      // Buraco Macular
      mhClosed: data.retinaData.mhClosed ?? null,
      mhSize: data.retinaData.mhSize ?? null,
      mhPostSize: data.retinaData.mhPostSize ?? null,
      mhGas: data.retinaData.mhGas || null,
      // MER / Injeções
      octCMTpre: data.retinaData.octCMTpre ?? null,
      octCMTpost: data.retinaData.octCMTpost ?? null,
      injectionDrug: data.retinaData.injectionDrug || null,
      injectionNumber: data.retinaData.injectionNumber ?? null,
      // DR
      drType: data.retinaData.drType || null,
      drExtension: data.retinaData.drExtension || null,
      drSuccess: data.retinaData.drSuccess ?? null,
      drSurgeriesCount: data.retinaData.drSurgeriesCount ?? null,
      drTechnique: data.retinaData.drTechnique || null,
      drOil: data.retinaData.drOil ?? null,
      // Complicações
      retinaComplications: data.retinaData.retinaComplications || [],
      retinaComplicationsOther: data.retinaData.retinaComplicationsOther || null,
    };
  }

  return doc;
}

/**
 * Template para criação de agendamento
 * @param {object} data
 * @param {string} tenantId
 * @param {string} createdBy
 * @returns {object} Documento Firestore
 */
export function createAppointmentDocument(data, tenantId, createdBy) {
  return {
    tenantId,
    createdBy,
    patientId: data.patientId,
    patientName: data.patientName,
    type: data.type,
    pathology: data.pathology || null,
    dateTime: data.dateTime,
    duration: data.duration || 60,
    facility: data.facility || null,
    status: APPOINTMENT_STATUS.SCHEDULED,
    consultationId: null,
    notes: data.notes || null,
    whatsappSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// NOMES DAS COLEÇÕES (evitar typos)
// ─────────────────────────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  TENANTS: 'tenants',
  PATIENTS: 'patients',
  CONSULTATIONS: 'consultations',
  APPOINTMENTS: 'appointments',
  ATTACHMENTS: 'attachments',
  WHATSAPP_LOGS: 'whatsapp_logs',
  ADMIN: 'admin',
};
