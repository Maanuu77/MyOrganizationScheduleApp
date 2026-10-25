// Funciones propias de la app Android (Capacitor).
// En el navegador no se usa nada de este archivo: `esNativo` es false y el resto de la app
// sigue el camino web. Así el mismo código sirve para la web y para la app.

import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

/** ¿Estamos dentro de la app Android? */
export const esNativo = Capacitor.isNativePlatform();

// ---------------------------------------------------------------------------
// Inicio de sesión con Google nativo
// ---------------------------------------------------------------------------

/**
 * Abre el selector de cuentas de Google del propio móvil y devuelve el idToken (para iniciar
 * sesión en Firebase) y, si se piden permisos extra (Google Calendar), el token de acceso.
 */
export async function googleNativo(
  alcances: string[] = [],
): Promise<{ idToken: string; accessToken: string | null }> {
  const resultado = await FirebaseAuthentication.signInWithGoogle({
    scopes: alcances.length ? alcances : undefined,
  });
  const idToken = resultado.credential?.idToken;
  if (!idToken) throw new Error('Google no devolvió un token');
  return { idToken, accessToken: resultado.credential?.accessToken ?? null };
}

export async function cerrarGoogleNativo(): Promise<void> {
  await FirebaseAuthentication.signOut().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Notificaciones locales: las programa el propio móvil, sin servidor ni plan Blaze
// ---------------------------------------------------------------------------

export interface AvisoNativo {
  /** Id de texto estable (el mismo que el del recordatorio). */
  id: string;
  fireAt: number;
  titulo: string;
  cuerpo: string;
  url: string;
}

/** Los avisos de cada grupo van en un rango de ids distinto para poder cancelarlos por separado. */
const BASE_GRUPO = { recordatorios: 1_000_000, contador: 2_000_000 } as const;
export type GrupoAvisos = keyof typeof BASE_GRUPO;

/** Convierte el id de texto en un número (Android exige ids enteros). */
function idNumerico(texto: string, grupo: GrupoAvisos): number {
  let hash = 0;
  for (const c of texto) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return BASE_GRUPO[grupo] + (Math.abs(hash) % 900_000);
}

let canalCreado = false;
async function asegurarCanal(): Promise<void> {
  if (canalCreado) return;
  await LocalNotifications.createChannel({
    id: 'avisos',
    name: 'Avisos',
    description: 'Inicio de bloques, fases del contador, rutinas y fechas límite',
    importance: 5,
    vibration: true,
    visibility: 1,
  });
  canalCreado = true;
}

export async function pedirPermisoNotificaciones(): Promise<boolean> {
  const estado = await LocalNotifications.requestPermissions();
  if (estado.display !== 'granted') return false;
  await asegurarCanal();
  return true;
}

export async function tienePermisoNotificaciones(): Promise<boolean> {
  return (await LocalNotifications.checkPermissions()).display === 'granted';
}

/** En Android 12+ las alarmas exactas necesitan un permiso aparte que da el usuario. */
export async function alarmasExactasPermitidas(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;
  }
}

export async function abrirAjusteAlarmasExactas(): Promise<void> {
  await LocalNotifications.changeExactNotificationSetting().catch(() => undefined);
}

/**
 * Sustituye todas las notificaciones programadas de un grupo por la lista nueva.
 * Android admite unas 500 alarmas por app: limitamos a 300 en total.
 */
export async function programarAvisos(grupo: GrupoAvisos, avisos: AvisoNativo[]): Promise<void> {
  if (!(await tienePermisoNotificaciones())) return;
  await asegurarCanal();
  const base = BASE_GRUPO[grupo];
  const pendientes = await LocalNotifications.getPending();
  const delGrupo = pendientes.notifications.filter((n) => n.id >= base && n.id < base + 1_000_000);
  if (delGrupo.length)
    await LocalNotifications.cancel({ notifications: delGrupo.map((n) => ({ id: n.id })) });

  const ahora = Date.now();
  const limite = grupo === 'contador' ? 60 : 240;
  const lista: LocalNotificationSchema[] = avisos
    .filter((a) => a.fireAt > ahora + 1000)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, limite)
    .map((a) => ({
      id: idNumerico(a.id, grupo),
      title: a.titulo,
      body: a.cuerpo,
      channelId: 'avisos',
      smallIcon: 'ic_stat_mos',
      schedule: { at: new Date(a.fireAt), allowWhileIdle: true },
      extra: { url: a.url },
    }));
  if (lista.length) await LocalNotifications.schedule({ notifications: lista });
}

/** Muestra una notificación al momento (cuando la app está en segundo plano). */
export async function notificarAhora(titulo: string, cuerpo: string, url = '/'): Promise<void> {
  if (!(await tienePermisoNotificaciones())) return;
  await asegurarCanal();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 900_000),
        title: titulo,
        body: cuerpo,
        channelId: 'avisos',
        smallIcon: 'ic_stat_mos',
        extra: { url },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Vibración, pantalla encendida, compartir archivos y barras del sistema
// ---------------------------------------------------------------------------

export function vibrarNativo(milisegundos = 400): void {
  void Haptics.vibrate({ duration: milisegundos }).catch(() => undefined);
}

export async function mantenerPantallaEncendida(activar: boolean): Promise<void> {
  try {
    if (activar) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch {
    // No es imprescindible: si falla, la pantalla se apagará como siempre
  }
}

/** En el móvil no hay "descargas": guardamos el archivo y abrimos el menú de compartir. */
export async function compartirArchivo(nombre: string, contenido: string): Promise<void> {
  const escrito = await Filesystem.writeFile({
    path: nombre,
    data: contenido,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: nombre, files: [escrito.uri] });
}

export function estiloBarras(oscuro: boolean): void {
  void SystemBars.setStyle({ style: oscuro ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Integración con la navegación: botón atrás y toques en notificaciones
// ---------------------------------------------------------------------------

/**
 * Conecta el botón "atrás" de Android y los toques en las notificaciones con la app.
 * `navegar` es la función de React Router.
 */
export function prepararNavegacionNativa(navegar: (ruta: string) => void): () => void {
  const atras = App.addListener('backButton', ({ canGoBack }) => {
    // Si hay un diálogo abierto, el botón atrás lo cierra (como Escape en el ordenador)
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
  const toque = LocalNotifications.addListener('localNotificationActionPerformed', (accion) => {
    const url = (accion.notification.extra as { url?: string } | undefined)?.url;
    if (url) navegar(url);
  });
  return () => {
    void atras.then((l) => l.remove());
    void toque.then((l) => l.remove());
  };
}
