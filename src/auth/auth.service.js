/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Auth Service
 * Serviço de autenticação: registro, login, logout, reset de senha
 * Middleware de sessão e controle de aprovação do Super Admin
 * ═══════════════════════════════════════════════════════════════════
 */

import { auth, db } from '../config/firebase.config.js?v=2';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  USER_ROLES,
  USER_STATUS,
  COLLECTIONS,
  createUserDocument,
  createTenantDocument,
} from '../db/db.schema.js';

// ─────────────────────────────────────────────────────────────────
// ESTADO GLOBAL DE SESSÃO
// ─────────────────────────────────────────────────────────────────
let currentUser = null;       // Firebase Auth user
let currentUserData = null;   // Firestore user document
let authReadyResolve = null;

// Promise que resolve quando o estado de auth é determinado
const authReady = new Promise(resolve => {
  authReadyResolve = resolve;
});

// ─────────────────────────────────────────────────────────────────
// OBSERVER: Monitorar estado de autenticação
// ─────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        currentUserData = { id: userDoc.id, ...userDoc.data() };

        // Atualizar último login
        await updateDoc(userDocRef, {
          lastLoginAt: new Date().toISOString(),
        });
      } else {
        // Usuário no Auth mas não no Firestore (edge case)
        currentUserData = null;
      }
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      currentUserData = null;
    }
  } else {
    currentUser = null;
    currentUserData = null;
  }
  authReadyResolve(currentUserData);

  // Disparar evento customizado para o frontend escutar
  window.dispatchEvent(new CustomEvent('auth-state-changed', {
    detail: { user: currentUser, userData: currentUserData }
  }));
});

// ─────────────────────────────────────────────────────────────────
// REGISTRO DE NOVO USUÁRIO
// ─────────────────────────────────────────────────────────────────

/**
 * Registra um novo médico no sistema.
 * O usuário inicia com status "pending" e precisa de aprovação do Super Admin.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.name
 * @param {string} params.crm
 * @param {string} params.phone
 * @param {string} params.clinicName
 * @returns {Promise<{success: boolean, uid?: string, error?: string}>}
 */
export async function registerUser({ email, password, name, crm, phone, clinicName }) {
  try {
    // 1. Criar usuário no Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // 2. Atualizar displayName no Auth
    await updateProfile(user, { displayName: name });

    // 3. Criar documento do usuário no Firestore
    const userData = createUserDocument({
      uid: user.uid,
      email,
      name,
      role: USER_ROLES.MEDICO,
      tenantId: user.uid,  // Self-tenant
      crm,
      phone,
    });

    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);

    // 4. Fazer logout imediato (usuário precisa de aprovação)
    await signOut(auth);

    return { success: true, uid: user.uid };
  } catch (error) {
    console.error('Erro no registro:', error);
    return { success: false, error: translateFirebaseError(error.code) };
  }
}

// ─────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────

/**
 * Realiza login e verifica se o usuário está aprovado.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, userData?: object, error?: string, status?: string}>}
 */
export async function loginUser(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // Buscar dados do Firestore
    const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await signOut(auth);
      return { success: false, error: 'Conta não encontrada no sistema. Contate o suporte.' };
    }

    const userData = userDoc.data();

    // Verificar status de aprovação
    if (userData.status === USER_STATUS.PENDING) {
      await signOut(auth);
      return {
        success: false,
        status: 'pending',
        error: 'Sua conta ainda está aguardando aprovação do administrador. Você receberá um aviso quando for liberada.',
      };
    }

    if (userData.status === USER_STATUS.SUSPENDED) {
      await signOut(auth);
      return {
        success: false,
        status: 'suspended',
        error: 'Sua conta foi suspensa. Entre em contato com o administrador do sistema.',
      };
    }

    // Login OK — atualizar estado local
    currentUser = user;
    currentUserData = { id: userDoc.id, ...userData };

    return { success: true, userData: currentUserData };
  } catch (error) {
    console.error('Erro no login:', error);
    return { success: false, error: translateFirebaseError(error.code) };
  }
}

// ─────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────

export async function logoutUser() {
  try {
    await signOut(auth);
    currentUser = null;
    currentUserData = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// RESET DE SENHA
// ─────────────────────────────────────────────────────────────────

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: translateFirebaseError(error.code) };
  }
}

// ─────────────────────────────────────────────────────────────────
// GETTERS DE SESSÃO
// ─────────────────────────────────────────────────────────────────

/** Aguarda a inicialização do auth e retorna os dados do usuário */
export function waitForAuth() {
  return authReady;
}

/** Retorna o usuário Firebase Auth atual (ou null) */
export function getCurrentUser() {
  return currentUser;
}

/** Retorna os dados Firestore do usuário atual (ou null) */
export function getCurrentUserData() {
  return currentUserData;
}

/** Retorna o tenantId do usuário logado */
export function getTenantId() {
  return currentUserData?.tenantId || null;
}

/** Verifica se o usuário atual é Super Admin */
export function isSuperAdmin() {
  return currentUserData?.role === USER_ROLES.SUPER_ADMIN;
}

/** Verifica se o usuário atual é médico */
export function isMedico() {
  return currentUserData?.role === USER_ROLES.MEDICO;
}

/** Verifica se está autenticado e ativo */
export function isAuthenticated() {
  return currentUser !== null && currentUserData?.status === USER_STATUS.ACTIVE;
}

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE DE PROTEÇÃO DE ROTA
// ─────────────────────────────────────────────────────────────────

/**
 * Protege uma página. Redireciona para login se não autenticado.
 * @param {object} options
 * @param {string[]} options.allowedRoles - Papéis permitidos (vazio = qualquer ativo)
 * @param {string} options.redirectTo - URL de redirecionamento se não autorizado
 * @returns {Promise<object|null>} Dados do usuário ou null
 */
export async function requireAuth({ allowedRoles = [], redirectTo = '/login.html' } = {}) {
  const userData = await waitForAuth();

  // Não autenticado
  if (!currentUser || !userData) {
    window.location.href = redirectTo;
    return null;
  }

  // Conta não ativa
  if (userData.status !== USER_STATUS.ACTIVE) {
    await signOut(auth);
    window.location.href = redirectTo + '?status=' + userData.status;
    return null;
  }

  // Verificar role se especificados
  if (allowedRoles.length > 0 && !allowedRoles.includes(userData.role)) {
    window.location.href = '/index.html?error=unauthorized';
    return null;
  }

  return userData;
}

/**
 * Proteção de rota específica para Super Admin
 * @returns {Promise<object|null>}
 */
export async function requireSuperAdmin() {
  return requireAuth({ allowedRoles: [USER_ROLES.SUPER_ADMIN], redirectTo: '/login.html' });
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÕES DO SUPER ADMIN: Aprovação e Gestão de Usuários
// ─────────────────────────────────────────────────────────────────

/**
 * Lista todos os usuários com status "pending"
 * @returns {Promise<object[]>}
 */
export async function getPendingUsers() {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('status', '==', USER_STATUS.PENDING)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Erro ao buscar pendentes:', error);
    return [];
  }
}

/**
 * Lista todos os usuários do sistema (para o painel admin)
 * @returns {Promise<object[]>}
 */
export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
}

/**
 * Aprova um médico pendente — cria o tenant e ativa a conta
 * @param {string} userId - UID do usuário a ser aprovado
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function approveUser(userId) {
  try {
    if (!isSuperAdmin()) {
      return { success: false, error: 'Apenas o Super Admin pode aprovar usuários.' };
    }

    // 1. Buscar dados do usuário
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const userData = userDoc.data();

    // 2. Criar tenant para o novo médico
    const tenantData = createTenantDocument({
      ownerUid: userId,
      clinicName: userData.name, // Usa o nome como placeholder
    });
    await setDoc(doc(db, COLLECTIONS.TENANTS, userId), tenantData);

    // 3. Ativar a conta do usuário
    await updateDoc(userRef, {
      status: USER_STATUS.ACTIVE,
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.uid,
    });

    // 4. Incrementar total de tenants (criando config se não existir)
    const adminRef = doc(db, COLLECTIONS.ADMIN, 'config');
    const adminDoc = await getDoc(adminRef);
    if (adminDoc.exists()) {
      await updateDoc(adminRef, { totalTenants: increment(1) });
    } else {
      await setDoc(adminRef, { totalTenants: 1, systemVersion: '1.0.0' });
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao aprovar usuário:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Suspende um usuário ativo
 * @param {string} userId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function suspendUser(userId) {
  try {
    if (!isSuperAdmin()) {
      return { success: false, error: 'Apenas o Super Admin pode suspender usuários.' };
    }

    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      status: USER_STATUS.SUSPENDED,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Reativa um usuário suspenso
 * @param {string} userId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function reactivateUser(userId) {
  try {
    if (!isSuperAdmin()) {
      return { success: false, error: 'Apenas o Super Admin pode reativar usuários.' };
    }

    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      status: USER_STATUS.ACTIVE,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Altera o role de um usuário
 * @param {string} userId
 * @param {string} newRole - Um dos valores de USER_ROLES
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function changeUserRole(userId, newRole) {
  try {
    if (!isSuperAdmin()) {
      return { success: false, error: 'Sem permissão.' };
    }

    const validRoles = Object.values(USER_ROLES);
    if (!validRoles.includes(newRole)) {
      return { success: false, error: 'Role inválido.' };
    }

    await updateDoc(doc(db, COLLECTIONS.USERS, userId), { role: newRole });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// TRADUÇÃO DE ERROS FIREBASE → PORTUGUÊS
// ─────────────────────────────────────────────────────────────────

function translateFirebaseError(code) {
  const errors = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado no sistema.',
    'auth/invalid-email': 'E-mail inválido. Verifique o formato.',
    'auth/weak-password': 'A senha deve ter no mínimo 6 caracteres.',
    'auth/user-not-found': 'Nenhuma conta encontrada com este e-mail.',
    'auth/wrong-password': 'Senha incorreta. Tente novamente.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/requires-recent-login': 'Por segurança, faça login novamente.',
    'auth/popup-closed-by-user': 'O popup de login foi fechado.',
  };
  return errors[code] || `Erro inesperado (${code}). Tente novamente.`;
}
