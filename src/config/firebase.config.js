/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — Firebase Configuration
 * 
 * INSTRUÇÕES:
 * 1. Acesse https://console.firebase.google.com
 * 2. Crie um novo projeto ou use um existente
 * 3. Vá em Project Settings > General > Your Apps > Web App
 * 4. Copie as credenciais e substitua os valores abaixo
 * ═══════════════════════════════════════════════════════════════════
 */

// Firebase SDK imports (via CDN — compatível com Hostinger estático)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ─────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO FIREBASE
// Substitua com as credenciais do seu projeto Firebase
// ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAKtmRgoTYJ5v767d9aBBB0esbLfL_U63o",
  authDomain: "pacientes-gestao.firebaseapp.com",
  projectId: "pacientes-gestao",
  storageBucket: "pacientes-gestao.appspot.com",
  messagingSenderId: "364440519444",
  appId: "1:364440519444:web:e49a4f6f3cf7a5fc38b801",
};

// ─────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Configurar idioma para português (afeta mensagens de erro do Auth)
auth.languageCode = 'pt';

// ─────────────────────────────────────────────────────────────────
// MODO DE DESENVOLVIMENTO (emuladores locais)
// Descomente as linhas abaixo para usar os emuladores Firebase
// ─────────────────────────────────────────────────────────────────
// const USE_EMULATORS = window.location.hostname === 'localhost';
// if (USE_EMULATORS) {
//   connectAuthEmulator(auth, 'http://localhost:9099');
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectStorageEmulator(storage, 'localhost', 9199);
//   console.log('🔧 Firebase Emulators conectados');
// }

export { app, auth, db, storage };
