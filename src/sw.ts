/// <reference lib="webworker" />
// Service worker ÚNICO de la app. Hace dos cosas:
//  1. Caché de la app (precarga de los archivos generados por Vite) para que abra al instante.
//  2. Notificaciones push de Firebase Cloud Messaging con la app cerrada o en segundo plano.

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// --- 1. Caché de la app -------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Cualquier ruta de la SPA devuelve index.html, salvo las rutas internas de Firebase (/__/auth...)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }),
);
self.skipWaiting();
clientsClaim();

// --- 2. Notificaciones push ---------------------------------------------------
const configuracion = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (configuracion.apiKey && configuracion.messagingSenderId) {
  const app = initializeApp(configuracion);
  const messaging = getMessaging(app);
  // La Cloud Function envía mensajes "solo datos": aquí decidimos cómo se muestran
  onBackgroundMessage(messaging, (mensaje) => {
    const d = mensaje.data ?? {};
    const opciones: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body: d.cuerpo ?? '',
      icon: '/iconos/icono-192.png',
      badge: '/iconos/icono-192.png',
      tag: d.etiqueta || d.id,
      renotify: true,
      data: { url: d.url || '/' },
      vibrate: [200, 100, 200],
    };
    void self.registration.showNotification(d.titulo ?? 'MyOrganizationSchedule', opciones);
  });
}

// Al tocar la notificación: enfocamos la app si ya está abierta o la abrimos en la URL indicada
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = (evento.notification.data as { url?: string } | undefined)?.url ?? '/';
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin) {
          await v.focus();
          if ('navigate' in v) await (v as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
