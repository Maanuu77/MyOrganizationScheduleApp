// Identificador de este dispositivo y corrección del desfase de reloj con el servidor.
//
// Cada dispositivo puede tener la hora un poco adelantada o atrasada. Para que el contador
// marque lo mismo en todos, medimos la diferencia con la hora de Firestore: escribimos una
// marca serverTimestamp(), la leemos del servidor y comparamos con nuestra hora local.

import { getDocFromServer, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { COLECCIONES, refDoc } from './datos';

let desfaseMs = 0;

/** Hora actual corregida con el desfase respecto al servidor. */
export function ahoraServidor(): number {
  return Date.now() + desfaseMs;
}

export function desfaseActual(): number {
  return desfaseMs;
}

/** Id estable de este navegador (preferencia local: no es un dato del usuario). */
export function idDispositivo(): string {
  const clave = 'mos-dispositivo';
  try {
    let id = localStorage.getItem(clave);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      localStorage.setItem(clave, id);
    }
    return id;
  } catch {
    return 'sin-almacenamiento';
  }
}

/** Nombre legible del dispositivo, deducido del navegador. */
export function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  const so = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Dispositivo';
  const nav = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navegador';
  return `${nav} en ${so}`;
}

/**
 * Mide el desfase con el servidor. Se llama al iniciar sesión y de vez en cuando.
 * También sirve para registrar el dispositivo y su último uso.
 */
export async function sincronizarReloj(): Promise<number> {
  const ref = refDoc(COLECCIONES.dispositivos, idDispositivo());
  const antes = Date.now();
  await setDoc(
    ref,
    {
      nombre: nombreDispositivo(),
      plataforma: navigator.platform || 'web',
      ultimoUsoMs: antes,
      ping: serverTimestamp(),
    },
    { merge: true },
  );
  const snap = await getDocFromServer(ref);
  const despues = Date.now();
  const servidor = (snap.get('ping') as Timestamp | undefined)?.toMillis();
  if (servidor) {
    // Suponemos que el servidor puso la marca a mitad del viaje de ida y vuelta
    desfaseMs = servidor - (antes + despues) / 2;
  }
  return desfaseMs;
}
