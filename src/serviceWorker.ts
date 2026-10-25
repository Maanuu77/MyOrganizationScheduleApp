// Registro del único service worker de la app (caché + notificaciones push).
import { registerSW } from 'virtual:pwa-register';
import { esNativo, notificarAhora } from './nativo';

let registro: ServiceWorkerRegistration | undefined;

export function registrarServiceWorker(): void {
  // En la app Android los archivos ya van dentro del APK: no hace falta service worker
  if (esNativo || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registro = r;
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker', error);
    },
  });
}

/** Devuelve el registro del service worker cuando está listo. */
export async function obtenerRegistroSW(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  if (registro) return registro;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

/** Muestra una notificación del sistema desde el service worker (funciona también en Android). */
export async function mostrarNotificacionLocal(
  titulo: string,
  cuerpo: string,
  url = '/',
  etiqueta?: string,
): Promise<void> {
  if (esNativo) {
    await notificarAhora(titulo, cuerpo, url);
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const r = await obtenerRegistroSW();
  const opciones: NotificationOptions & { vibrate?: number[] } = {
    body: cuerpo,
    icon: '/iconos/icono-192.png',
    badge: '/iconos/icono-192.png',
    tag: etiqueta,
    data: { url },
    vibrate: [200, 100, 200],
  };
  if (r) await r.showNotification(titulo, opciones);
  else new Notification(titulo, opciones);
}
