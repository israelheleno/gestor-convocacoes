// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOpV5NFydHWwUwQKg0MANqMHVcXVDDqpQ",
  authDomain: "gestor-convocacoes-89823.firebaseapp.com",
  projectId: "gestor-convocacoes-89823",
  storageBucket: "gestor-convocacoes-89823.firebasestorage.app",
  messagingSenderId: "212389113483",
  appId: "1:212389113483:web:eb97eefe621df0cba66e8e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn("FCM não disponível neste ambiente:", e);
}

export { app, auth, db, googleProvider, messaging };
