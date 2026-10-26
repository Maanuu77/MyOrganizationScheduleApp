// Hooks de sesión y sincronización en tiempo real.
// useSesion escucha el inicio/cierre de sesión de Firebase Auth.
// useSincronizacion abre un "oyente" (onSnapshot) por colección: cualquier cambio hecho
// en otro dispositivo llega aquí en tiempo real y actualiza el almacén.

import { useEffect } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { cerrarGoogleNativo, esNativo, googleNativo } from './nativo';
import { doc, onSnapshot, where } from 'firebase/firestore';
import { firebaseConfigurado, obtenerAuth, obtenerDb, proveedorGoogle } from './firebase';
import { useDatos } from './almacenDatos';
import { COLECCIONES, escuchar, refAjustes, refDoc, registrarPerfil } from './datos';
import { completarAjustes } from './ajustesPorDefecto';
import { zonaDelDispositivo } from './fechas';
import { normalizarRutina } from './rutinas';
import type { Ajustes, EstadoContador, IntegracionGoogle, PlantillaCiclo } from './tipos';

export function useSesion(): void {
  useEffect(() => {
    if (!firebaseConfigurado) {
      useDatos.getState().poner({ cargandoSesion: false });
      return;
    }
    // Si venimos de un inicio de sesión por redirección, recogemos el resultado (o el error)
    if (!esNativo) {
      getRedirectResult(obtenerAuth()).catch((e) =>
        console.warn('Inicio de sesión por redirección fallido', e),
      );
    }
    return onAuthStateChanged(obtenerAuth(), (u) => {
      const { poner, reiniciar } = useDatos.getState();
      if (!u) {
        reiniciar();
        poner({ usuario: null, cargandoSesion: false });
        return;
      }
      poner({
        usuario: { uid: u.uid, email: u.email, nombre: u.displayName, foto: u.photoURL },
        cargandoSesion: false,
      });
      registrarPerfil(u.uid, u.email, u.displayName).catch((e) =>
        console.warn('No se pudo guardar el perfil', e),
      );
    });
  }, []);
}

/** ¿La app está instalada como PWA? Ahí las ventanas emergentes funcionan peor. */
function enModoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Inicia sesión con Google. Normalmente con ventana emergente; si la app está instalada
 * o el navegador bloquea la ventana, usamos redirección (se vuelve a la app al terminar).
 */
export async function entrarConGoogle(): Promise<void> {
  const auth = obtenerAuth();
  if (esNativo) {
    // En la app Android: selector de cuentas del propio móvil y sesión en el SDK web de Firebase
    const { idToken } = await googleNativo();
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
  if (enModoApp()) {
    await signInWithRedirect(auth, proveedorGoogle());
    return;
  }
  try {
    await signInWithPopup(auth, proveedorGoogle());
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (
      codigo === 'auth/popup-blocked' ||
      codigo === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, proveedorGoogle());
      return;
    }
    throw e;
  }
}

export async function cerrarSesion(): Promise<void> {
  await signOut(obtenerAuth());
  // En el móvil también cerramos la cuenta de Google nativa para poder elegir otra
  if (esNativo) await cerrarGoogleNativo();
}

/** Ordena por fecha de creación (las listas de Firestore llegan ordenadas por id). */
function ordenarPorCreacion<T extends { id: string }>(lista: T[]): T[] {
  const fecha = (x: T) => (x as { creadoEnMs?: number }).creadoEnMs ?? 0;
  return [...lista].sort((a, b) => fecha(a) - fecha(b));
}

/** Registros de sesión que se cargan: los de los dos últimos años (para comparar año con año). */
const DIAS_REGISTROS = 800;

export function useSincronizacion(): void {
  const uid = useDatos((s) => s.usuario?.uid);

  useEffect(() => {
    if (!uid) return;
    const { poner } = useDatos.getState();
    const pendientes = new Set<string>(['ajustes', 'etiquetas', 'eventos', 'tareas']);
    const marcarListo = (nombre: string) => {
      if (!pendientes.delete(nombre)) return;
      if (pendientes.size === 0) poner({ datosListos: true });
    };
    const alFallar = (error: Error) => {
      console.error('Error de sincronización', error);
      poner({ errorSincronizacion: error.message, datosListos: true });
    };
    // Las rutinas antiguas de estudio se convierten con su ciclo: por eso se recalculan
    // cuando llegan las rutinas y también cuando llegan los ciclos.
    let ciclosLeidos: PlantillaCiclo[] = [];
    let rutinasLeidas: { id: string }[] = [];
    const ponerRutinas = () =>
      poner({
        rutinas: rutinasLeidas.map((r) => normalizarRutina(r, ciclosLeidos)),
      });

    const bajas = [
      onSnapshot(
        refAjustes(uid),
        (snap) => {
          poner({
            ajustes: completarAjustes(
              snap.data() as Partial<Ajustes> | undefined,
              zonaDelDispositivo(),
            ),
            ajustesCargados: true,
            ajustesExisten: snap.exists(),
          });
          marcarListo('ajustes');
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.etiquetas,
        (etiquetas) => {
          poner({ etiquetas: etiquetas as never });
          marcarListo('etiquetas');
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.eventos,
        (eventos) => {
          poner({ eventos: eventos as never });
          marcarListo('eventos');
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.tareas,
        (tareas) => {
          poner({ tareas: tareas as never });
          marcarListo('tareas');
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.excepciones,
        (excepciones) => poner({ excepciones: excepciones as never }),
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.ciclos,
        (ciclos) => {
          ciclosLeidos = ordenarPorCreacion(ciclos) as unknown as PlantillaCiclo[];
          poner({ ciclos: ciclosLeidos as never });
          ponerRutinas();
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.rutinas,
        (rutinas) => {
          rutinasLeidas = ordenarPorCreacion(rutinas);
          ponerRutinas();
        },
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.ejecuciones,
        (ejecuciones) => poner({ ejecuciones: ejecuciones as never }),
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.plantillas,
        (plantillas) => poner({ plantillas: ordenarPorCreacion(plantillas) as never }),
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.dispositivos,
        (dispositivos) => poner({ dispositivos: dispositivos as never }),
        alFallar,
      ),
      escuchar(
        uid,
        COLECCIONES.registros,
        (registros) => poner({ registros: registros as never }),
        alFallar,
        where('inicioMs', '>=', Date.now() - DIAS_REGISTROS * 86_400_000),
      ),
      onSnapshot(
        doc(obtenerDb(), 'users', uid, COLECCIONES.integraciones, 'googleCalendar'),
        (snap) =>
          poner({ integracionGoogle: (snap.data() as IntegracionGoogle | undefined) ?? null }),
        alFallar,
      ),
      // El contador: usamos estimaciones locales de serverTimestamp para que el cambio
      // se vea al instante en este dispositivo antes de que confirme el servidor.
      onSnapshot(
        refDoc(COLECCIONES.contador, 'actual', uid),
        (snap) =>
          poner({
            contador:
              (snap.data({ serverTimestamps: 'estimate' }) as EstadoContador | undefined) ?? null,
          }),
        alFallar,
      ),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [uid]);
}
