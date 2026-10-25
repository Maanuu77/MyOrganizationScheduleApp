// Inicialización de Firebase a partir de las variables VITE_FIREBASE_* del archivo .env.
// Si faltan, la app muestra una pantalla de configuración en lugar de fallar en blanco.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

/** Se calcula aquí (y no en nativo.ts) para no cargar los plugins al arrancar Firebase. */
const esNativo = Capacitor.isNativePlatform();
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore';

const env = import.meta.env;

const configuracion = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const NOMBRES_VARIABLES: Record<keyof typeof configuracion, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

/** Lista de variables obligatorias que no están definidas. */
export const variablesQueFaltan: string[] = (
  Object.keys(configuracion) as Array<keyof typeof configuracion>
)
  .filter((clave) => !configuracion[clave])
  .map((clave) => NOMBRES_VARIABLES[clave]);

export const firebaseConfigurado = variablesQueFaltan.length === 0;

/** Clave pública VAPID para las notificaciones push (opcional). */
export const claveVapid: string | undefined = env.VITE_FIREBASE_VAPID_KEY || undefined;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigurado) {
  app = initializeApp(configuracion);
  // En la app Android no hay ventanas emergentes ni redirecciones: iniciamos Auth sin ese
  // mecanismo (si no, se queda esperando un iframe que no existe) y guardamos la sesión en IndexedDB
  auth = esNativo ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app);
  // ignoreUndefinedProperties: evita errores si algún campo opcional llega como undefined
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (env.VITE_USAR_EMULADORES === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

/** Instancias de Firebase. Solo se usan cuando `firebaseConfigurado` es true. */
export function obtenerApp(): FirebaseApp {
  if (!app) throw new Error('Firebase no está configurado');
  return app;
}
export function obtenerAuth(): Auth {
  if (!auth) throw new Error('Firebase no está configurado');
  return auth;
}
export function obtenerDb(): Firestore {
  if (!db) throw new Error('Firebase no está configurado');
  return db;
}

/** Proveedor de Google para el inicio de sesión. */
export function proveedorGoogle(): GoogleAuthProvider {
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  return proveedor;
}
