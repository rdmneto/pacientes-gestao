/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Attachments Service
 * Upload, listagem e exclusão de anexos médicos (OCT, Topografia, etc.)
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '../config/firebase.config.js';
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { COLLECTIONS } from '../db/db.schema.js';
import { getTenantId, getCurrentUser } from '../auth/auth.service.js';

const API_SECRET = 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
];

// ─────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────

/**
 * Faz upload de um arquivo e registra no Firestore
 * @param {File} file - Objeto File do input
 * @param {object} metadata
 * @param {string} metadata.patientId
 * @param {string} metadata.consultationId (opcional)
 * @param {string} metadata.category - oct, topografia, pentacam, etc.
 * @param {string} metadata.eye - OD, OE, AO
 * @param {string} metadata.description
 * @param {function} onProgress - Callback (percent: number)
 * @returns {Promise<{success, id?, url?, error?}>}
 */
export async function uploadAttachment(file, metadata, onProgress) {
  try {
    const tenantId = getTenantId();
    const user = getCurrentUser();
    if (!tenantId || !user) return { success: false, error: 'Sessão expirada.' };

    // Validações
    if (!file) return { success: false, error: 'Nenhum arquivo selecionado.' };
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB.` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: 'Tipo de arquivo não permitido. Use PDF, JPEG, PNG, WebP ou TIFF.' };
    }
    if (!metadata.patientId) return { success: false, error: 'Paciente é obrigatório.' };

    // Upload via API Hostinger (PHP)
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload.php', true);
      xhr.setRequestHeader('X-Auth-Token', API_SECRET);
      xhr.setRequestHeader('X-Tenant-ID', tenantId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success) {
              // Salvar metadados no Firestore
              const attachmentDoc = {
                tenantId,
                patientId: metadata.patientId,
                consultationId: metadata.consultationId || null,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                storageUrl: res.url,
                storagePath: res.storedName, // Usado para exclusão
                category: metadata.category || 'outro',
                eye: metadata.eye || null,
                description: metadata.description || null,
                uploadedAt: new Date().toISOString(),
                uploadedBy: user.uid,
              };

              const docRef = await addDoc(
                collection(db, COLLECTIONS.ATTACHMENTS),
                attachmentDoc
              );

              resolve({ success: true, id: docRef.id, url: res.url });
            } else {
              resolve({ success: false, error: res.error || 'Erro no upload.' });
            }
          } catch (err) {
            console.error(err);
            resolve({ success: false, error: 'Erro ao processar resposta do servidor.' });
          }
        } else {
          resolve({ success: false, error: 'Falha no servidor de upload.' });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: 'Erro de conexão com o servidor de upload.' });
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    return { success: false, error: 'Erro ao iniciar upload.' };
  }
}

// ─────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────

/**
 * Lista anexos de um paciente
 */
export async function getPatientAttachments(patientId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const q = query(
      collection(db, COLLECTIONS.ATTACHMENTS),
      where('tenantId', '==', tenantId),
      where('patientId', '==', patientId),
      orderBy('uploadedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Erro ao listar anexos:', error);
    return [];
  }
}

/**
 * Lista anexos de uma consulta específica
 */
export async function getConsultationAttachments(consultationId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    const q = query(
      collection(db, COLLECTIONS.ATTACHMENTS),
      where('tenantId', '==', tenantId),
      where('consultationId', '==', consultationId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

/**
 * Remove um anexo (Storage + Firestore)
 */
export async function deleteAttachment(attachmentId) {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return { success: false, error: 'Sessão expirada.' };

    // Buscar metadados para obter o path do Storage
    const docRef = doc(db, COLLECTIONS.ATTACHMENTS, attachmentId);
    const { default: getDocFn } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    
    // Use inline getDoc
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.ATTACHMENTS),
      where('__name__', '==', attachmentId)
    ));

    if (snap.empty) return { success: false, error: 'Anexo não encontrado.' };

    const data = snap.docs[0].data();

    // Deletar do servidor Hostinger via API
    if (data.storagePath) {
      try {
        await fetch(`/api/upload.php?file=${encodeURIComponent(data.storagePath)}`, {
          method: 'DELETE',
          headers: {
            'X-Auth-Token': API_SECRET,
            'X-Tenant-ID': tenantId
          }
        });
      } catch (e) {
        console.warn('Erro ao deletar arquivo no servidor PHP:', e);
      }
    }

    // Deletar do Firestore
    await deleteDoc(doc(db, COLLECTIONS.ATTACHMENTS, attachmentId));

    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    return { success: false, error: 'Erro ao excluir anexo.' };
  }
}

/**
 * Formata tamanho de arquivo para exibição
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
