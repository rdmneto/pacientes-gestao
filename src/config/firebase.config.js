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
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
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
