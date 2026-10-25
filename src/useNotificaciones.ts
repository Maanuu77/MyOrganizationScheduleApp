// Notificaciones: activar el push de Firebase Cloud Messaging en este dispositivo y mostrar
// los avisos cuando la app está abierta (en primer plano el navegador no los muestra solo).

import { useEffect } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { claveVapid, obtenerApp } from './firebase';
import { COLECCIONES, actualizarAjustes, refDoc } from './datos';
import { setDoc } from 'firebase/firestore';
import { idDispositivo, nombreDispositivo } from './relojServidor';
import { obtenerRegistroSW, mostrarNotificacionLocal } from './serviceWorker';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { recordatoriosCalculados } from './useRecordatorios';
import { reproducir } from './sonidos';
import { t } from './textos';
import { esNativo, pedirPermisoNotificaciones } from './nativo';

export type ResultadoActivacion = 'activadas' | 'soloLocales' | 'denegadas' | 'noSoportadas';

/**
 * Pide permiso, obtiene el token FCM de este dispositivo y lo guarda en devices/{id}.
 * Si no hay clave VAPID o el navegador no soporta push, quedan los avisos con la app abierta.
 */
export async function activarNotificaciones(): Promise<ResultadoActivacion> {
  if (esNativo) {
    // En la app Android las notificaciones las programa el propio móvil (no hace falta servidor)
    if (!(await pedirPermisoNotificaciones())) return 'denegadas';
    const { ajustes } = useDatos.getState();
    await actualizarAjustes({ notificaciones: { ...ajustes.notificaciones, activas: true } });
    await registrarDispositivo(null);
    return 'activadas';
  }
  if (!('Notification' in window)) return 'noSoportadas';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'denegadas';

  const { ajustes } = useDatos.getState();
  await actualizarAjustes({ notificaciones: { ...ajustes.notificaciones, activas: true } });

  if (!claveVapid || !(await isSupported())) {
    await registrarDispositivo(null);
    return 'soloLocales';
  }
  try {
    const registro = await obtenerRegistroSW();
    const token = await getToken(getMessaging(obtenerApp()), {
      vapidKey: claveVapid,
      serviceWorkerRegistration: registro,
    });
    await registrarDispositivo(token);
    return 'activadas';
  } catch (e) {
    console.warn('No se pudo obtener el token de notificaciones', e);
    await registrarDispositivo(null);
    return 'soloLocales';
  }
}

async function registrarDispositivo(token: string | null): Promise<void> {
  const ahora = Date.now();
  await setDoc(
    refDoc(COLECCIONES.dispositivos, idDispositivo()),
    {
      token,
      nombre: nombreDispositivo(),
      plataforma: esNativo ? 'android' : navigator.platform || 'web',
      ultimoUsoMs: ahora,
      creadoEnMs: ahora,
    },
    { merge: true },
  );
}

/** Ids ya mostrados en esta sesión (para no repetir el mismo aviso por push y localmente). */
const mostrados = new Set<string>();

function mostrar(id: string, titulo: string, cuerpo: string, url: string, tipo?: string) {
  if (mostrados.has(id)) return;
  mostrados.add(id);
  const { ajustes } = useDatos.getState();
  // Los cambios de fase ya los anuncia el motor del contador
  if (tipo === 'faseTemporizador') return;
  if (document.visibilityState === 'visible') {
    avisar(`${titulo} — ${cuerpo}`, 'info');
    if (ajustes.temporizador.sonido) reproducir('aviso', ajustes.temporizador.volumen);
  } else {
    void mostrarNotificacionLocal(titulo, cuerpo, url, id);
  }
}

export function useAvisosEnPrimerPlano(): void {
  const uid = useDatos((s) => s.usuario?.uid);
  const activas = useDatos((s) => s.ajustes.notificaciones.activas);

  // Mensajes push que llegan con la app abierta (en la app Android no se usa push)
  useEffect(() => {
    if (!uid || !activas || esNativo) return;
    let baja: (() => void) | undefined;
    isSupported()
      .then((ok) => {
        if (!ok) return;
        baja = onMessage(getMessaging(obtenerApp()), (mensaje) => {
          const d = mensaje.data ?? {};
          mostrar(d.id ?? String(Date.now()), d.titulo ?? '', d.cuerpo ?? '', d.url ?? '/', d.tipo);
        });
      })
      .catch(() => undefined);
    return () => baja?.();
  }, [uid, activas]);

  // Avisos locales: funcionan aunque no haya Cloud Functions (plan gratuito).
  // En la app Android ya los muestra el sistema con las notificaciones programadas.
  useEffect(() => {
    if (!uid || !activas || esNativo) return;
    const comprobar = () => {
      const ahora = Date.now();
      for (const r of recordatoriosCalculados()) {
        if (r.fireAt <= ahora && r.fireAt > ahora - 90_000)
          mostrar(r.id, r.titulo, r.cuerpo, r.url, r.tipo);
      }
    };
    const id = setInterval(comprobar, 20_000);
    return () => clearInterval(id);
  }, [uid, activas]);
}

/** Notificación de prueba al activar. */
export function notificacionDePrueba(): void {
  void mostrarNotificacionLocal(
    t.notificaciones.pruebaTitulo,
    t.notificaciones.pruebaTexto,
    '/',
    'mos-prueba',
  );
}
