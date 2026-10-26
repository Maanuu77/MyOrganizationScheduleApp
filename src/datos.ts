// Capa de acceso a Firestore. Todas las lecturas y escrituras de la app pasan por aquí.
// Estructura: users/{uid}/{coleccion}/{id}. Solo el propietario puede leer y escribir (firestore.rules).

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore';
import { obtenerAuth, obtenerDb } from './firebase';
import { useDatos } from './almacenDatos';
import { normalizarRutina } from './rutinas';
import type {
  Ajustes,
  DocumentoBase,
  EjecucionRutina,
  Etiqueta,
  Evento,
  ExcepcionEvento,
  IntegracionGoogle,
  PlantillaCiclo,
  PlantillaSemanal,
  RegistroSesion,
  Rutina,
  Tarea,
} from './tipos';

/** Nombres de las colecciones dentro de users/{uid}. */
export const COLECCIONES = {
  ajustes: 'settings',
  etiquetas: 'tags',
  eventos: 'events',
  excepciones: 'eventExceptions',
  rutinas: 'routines',
  ejecuciones: 'routineRuns',
  tareas: 'tasks',
  ciclos: 'cycleTemplates',
  registros: 'sessionLogs',
  contador: 'timerState',
  recordatorios: 'reminders',
  dispositivos: 'devices',
  integraciones: 'integrations',
  plantillas: 'weekTemplates',
} as const;

export type NombreColeccion = (typeof COLECCIONES)[keyof typeof COLECCIONES];

/** Colecciones que se exportan, importan y borran con la cuenta. */
export const COLECCIONES_USUARIO: NombreColeccion[] = Object.values(COLECCIONES);

export function uidActual(): string {
  const uid = obtenerAuth().currentUser?.uid;
  if (!uid) throw new Error('No hay sesión iniciada');
  return uid;
}

export function refColeccion(nombre: NombreColeccion, uid = uidActual()) {
  return collection(obtenerDb(), 'users', uid, nombre);
}

export function refDoc(nombre: NombreColeccion, id: string, uid = uidActual()) {
  return doc(obtenerDb(), 'users', uid, nombre, id);
}

/** Id aleatorio corto, válido como id de documento. */
export function nuevoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

/** Firestore no admite `undefined`: lo quitamos de forma recursiva para guardar datos limpios. */
export function limpiar<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(limpiar) as T;
  if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    const resultado: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) if (v !== undefined) resultado[k] = limpiar(v);
    return resultado as T;
  }
  return valor;
}

/** Quita el campo id (que ya va en la ruta del documento). */
function sinId<T extends { id: string }>(datos: T): Omit<T, 'id'> {
  const { id: _id, ...resto } = datos;
  return resto;
}

// ---------------------------------------------------------------------------
// Operaciones genéricas
// ---------------------------------------------------------------------------

export type DatosNuevos<T extends DocumentoBase> = Omit<
  T,
  'id' | 'creadoEnMs' | 'actualizadoEnMs'
> & { id?: string };

/** Crea un documento con id, creadoEnMs y actualizadoEnMs. Devuelve el documento completo. */
export async function crear<T extends DocumentoBase>(
  coleccion: NombreColeccion,
  datos: DatosNuevos<T>,
): Promise<T> {
  const ahora = Date.now();
  const completo = {
    ...datos,
    id: datos.id ?? nuevoId(),
    creadoEnMs: ahora,
    actualizadoEnMs: ahora,
  } as T;
  await setDoc(refDoc(coleccion, completo.id), limpiar(sinId(completo)) as DocumentData);
  return completo;
}

/** Actualiza algunos campos de un documento. */
export async function actualizar<T extends DocumentoBase>(
  coleccion: NombreColeccion,
  id: string,
  cambios: Partial<Omit<T, 'id' | 'creadoEnMs'>>,
): Promise<void> {
  await updateDoc(
    refDoc(coleccion, id),
    limpiar({ ...cambios, actualizadoEnMs: Date.now() }) as DocumentData,
  );
}

/** Reemplaza un documento completo (manteniendo su id). */
export async function reemplazar<T extends DocumentoBase>(
  coleccion: NombreColeccion,
  datos: T,
): Promise<void> {
  await setDoc(
    refDoc(coleccion, datos.id),
    limpiar({ ...sinId(datos), actualizadoEnMs: Date.now() }) as DocumentData,
  );
}

export async function borrar(coleccion: NombreColeccion, id: string): Promise<void> {
  await deleteDoc(refDoc(coleccion, id));
}

/** Ejecuta muchas escrituras en lotes de 450 (Firestore admite 500 por lote). */
export async function enLotes<T>(
  elementos: T[],
  operacion: (lote: WriteBatch, elemento: T) => void,
): Promise<void> {
  const db = obtenerDb();
  for (let i = 0; i < elementos.length; i += 450) {
    const lote = writeBatch(db);
    for (const e of elementos.slice(i, i + 450)) operacion(lote, e);
    await lote.commit();
  }
}

/** Crea muchos documentos a la vez. */
export async function crearVarios<T extends DocumentoBase>(
  coleccion: NombreColeccion,
  lista: DatosNuevos<T>[],
): Promise<T[]> {
  const ahora = Date.now();
  // Sumamos el índice para conservar el orden de creación al ordenar por creadoEnMs
  const completos = lista.map(
    (d, i) =>
      ({ ...d, id: d.id ?? nuevoId(), creadoEnMs: ahora + i, actualizadoEnMs: ahora + i }) as T,
  );
  await enLotes(completos, (lote, d) =>
    lote.set(refDoc(coleccion, d.id), limpiar(sinId(d)) as DocumentData),
  );
  return completos;
}

export async function borrarVarios(coleccion: NombreColeccion, ids: string[]): Promise<void> {
  await enLotes(ids, (lote, id) => lote.delete(refDoc(coleccion, id)));
}

/** Escucha en tiempo real una colección completa (o filtrada). */
export function escuchar<T extends { id: string }>(
  uid: string,
  coleccion: NombreColeccion,
  alCambiar: (lista: T[]) => void,
  alFallar: (error: Error) => void,
  ...filtros: QueryConstraint[]
): Unsubscribe {
  const q = filtros.length
    ? query(refColeccion(coleccion, uid), ...filtros)
    : refColeccion(coleccion, uid);
  return onSnapshot(
    q,
    (snap) => alCambiar(snap.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T)),
    alFallar,
  );
}

// ---------------------------------------------------------------------------
// Perfil y ajustes
// ---------------------------------------------------------------------------

/** Crea o actualiza el documento raíz del usuario (users/{uid}). */
export async function registrarPerfil(
  uid: string,
  email: string | null,
  nombre: string | null,
): Promise<void> {
  const ref = doc(obtenerDb(), 'users', uid);
  const existe = await getDoc(ref);
  const ahora = Date.now();
  await setDoc(
    ref,
    existe.exists()
      ? { email: email ?? '', nombre: nombre ?? '', ultimoAccesoMs: ahora }
      : { email: email ?? '', nombre: nombre ?? '', creadoEnMs: ahora, ultimoAccesoMs: ahora },
    { merge: true },
  );
}

export function refAjustes(uid = uidActual()) {
  return refDoc(COLECCIONES.ajustes, 'general', uid);
}

export async function guardarAjustes(ajustes: Ajustes): Promise<void> {
  await setDoc(refAjustes(), limpiar({ ...ajustes, actualizadoEnMs: Date.now() }));
}

/**
 * Cambia solo algunos ajustes (fusiona con lo guardado). Así dos cambios seguidos no se
 * pisan entre sí. Si el documento aún no existe, se guarda completo.
 */
export async function actualizarAjustes(parcial: Partial<Ajustes>): Promise<void> {
  const { ajustes, ajustesExisten } = useDatos.getState();
  if (!ajustesExisten) {
    await guardarAjustes({ ...ajustes, ...parcial });
    return;
  }
  await setDoc(refAjustes(), limpiar({ ...parcial, actualizadoEnMs: Date.now() }), { merge: true });
}

// ---------------------------------------------------------------------------
// Atajos tipados por colección
// ---------------------------------------------------------------------------

export const etiquetas = {
  crear: (d: DatosNuevos<Etiqueta>) => crear<Etiqueta>(COLECCIONES.etiquetas, d),
  actualizar: (id: string, c: Partial<Etiqueta>) =>
    actualizar<Etiqueta>(COLECCIONES.etiquetas, id, c),
  borrar: (id: string) => borrar(COLECCIONES.etiquetas, id),
};

export const eventos = {
  crear: (d: DatosNuevos<Evento>) => crear<Evento>(COLECCIONES.eventos, d),
  crearVarios: (l: DatosNuevos<Evento>[]) => crearVarios<Evento>(COLECCIONES.eventos, l),
  actualizar: (id: string, c: Partial<Evento>) => actualizar<Evento>(COLECCIONES.eventos, id, c),
  borrar: async (id: string, excepciones: ExcepcionEvento[]) => {
    // Al borrar un evento borramos también sus excepciones
    await borrarVarios(
      COLECCIONES.excepciones,
      excepciones.filter((e) => e.eventoId === id).map((e) => e.id),
    );
    await borrar(COLECCIONES.eventos, id);
  },
  borrarVarios: (ids: string[]) => borrarVarios(COLECCIONES.eventos, ids),
};

export const excepciones = {
  /** Id determinista: un único documento por ocurrencia. */
  id: (eventoId: string, inicioOriginalMs: number) => `${eventoId}_${inicioOriginalMs}`,
  guardar: async (
    ex: Omit<ExcepcionEvento, 'id' | 'creadoEnMs' | 'actualizadoEnMs'>,
    previa: ExcepcionEvento | null,
  ) => {
    const id = excepciones.id(ex.eventoId, ex.inicioOriginalMs);
    const ahora = Date.now();
    await setDoc(
      refDoc(COLECCIONES.excepciones, id),
      limpiar({ ...ex, creadoEnMs: previa?.creadoEnMs ?? ahora, actualizadoEnMs: ahora }),
    );
  },
};

export const tareas = {
  crear: (d: DatosNuevos<Tarea>) => crear<Tarea>(COLECCIONES.tareas, d),
  actualizar: (id: string, c: Partial<Tarea>) => actualizar<Tarea>(COLECCIONES.tareas, id, c),
  borrar: (id: string) => borrar(COLECCIONES.tareas, id),
};

export const ciclos = {
  crear: (d: DatosNuevos<PlantillaCiclo>) => crear<PlantillaCiclo>(COLECCIONES.ciclos, d),
  crearVarios: (l: DatosNuevos<PlantillaCiclo>[]) =>
    crearVarios<PlantillaCiclo>(COLECCIONES.ciclos, l),
  actualizar: (id: string, c: Partial<PlantillaCiclo>) =>
    actualizar<PlantillaCiclo>(COLECCIONES.ciclos, id, c),
  borrar: (id: string) => borrar(COLECCIONES.ciclos, id),
};

export const registros = {
  crear: (d: DatosNuevos<RegistroSesion>) => crear<RegistroSesion>(COLECCIONES.registros, d),
  actualizar: (id: string, c: Partial<RegistroSesion>) =>
    actualizar<RegistroSesion>(COLECCIONES.registros, id, c),
  borrar: (id: string) => borrar(COLECCIONES.registros, id),
};

export const rutinas = {
  crear: (d: DatosNuevos<Rutina>) => crear<Rutina>(COLECCIONES.rutinas, d),
  actualizar: (id: string, c: Partial<Rutina>) => actualizar<Rutina>(COLECCIONES.rutinas, id, c),
  borrar: (id: string) => borrar(COLECCIONES.rutinas, id),
};

export const ejecuciones = {
  crear: (d: DatosNuevos<EjecucionRutina>) => crear<EjecucionRutina>(COLECCIONES.ejecuciones, d),
  actualizar: (id: string, c: Partial<EjecucionRutina>) =>
    actualizar<EjecucionRutina>(COLECCIONES.ejecuciones, id, c),
};

export const plantillas = {
  crear: (d: DatosNuevos<PlantillaSemanal>) => crear<PlantillaSemanal>(COLECCIONES.plantillas, d),
  actualizar: (id: string, c: Partial<PlantillaSemanal>) =>
    actualizar<PlantillaSemanal>(COLECCIONES.plantillas, id, c),
  borrar: (id: string) => borrar(COLECCIONES.plantillas, id),
};

export async function guardarIntegracionGoogle(datos: IntegracionGoogle): Promise<void> {
  await setDoc(
    refDoc(COLECCIONES.integraciones, 'googleCalendar'),
    limpiar({ ...datos, actualizadoEnMs: Date.now() }),
  );
}

// ---------------------------------------------------------------------------
// Exportar, importar y borrar todo
// ---------------------------------------------------------------------------

export interface CopiaSeguridad {
  app: 'MyOrganizationSchedule';
  version: 1;
  exportadoEnMs: number;
  colecciones: Partial<Record<NombreColeccion, Array<Record<string, unknown>>>>;
}

/** Colecciones que no tiene sentido exportar (dependen del dispositivo o son temporales). */
const NO_EXPORTAR: NombreColeccion[] = [
  COLECCIONES.recordatorios,
  COLECCIONES.dispositivos,
  COLECCIONES.contador,
];

export async function exportarTodo(): Promise<CopiaSeguridad> {
  const copia: CopiaSeguridad = {
    app: 'MyOrganizationSchedule',
    version: 1,
    exportadoEnMs: Date.now(),
    colecciones: {},
  };
  for (const nombre of COLECCIONES_USUARIO) {
    if (NO_EXPORTAR.includes(nombre)) continue;
    const snap = await getDocs(refColeccion(nombre));
    copia.colecciones[nombre] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }
  return copia;
}

export function esCopiaValida(datos: unknown): datos is CopiaSeguridad {
  const c = datos as CopiaSeguridad;
  return (
    !!c &&
    c.app === 'MyOrganizationSchedule' &&
    c.version === 1 &&
    typeof c.colecciones === 'object'
  );
}

export async function importarTodo(copia: CopiaSeguridad): Promise<number> {
  let total = 0;
  for (const nombre of COLECCIONES_USUARIO) {
    if (NO_EXPORTAR.includes(nombre)) continue;
    const lista = copia.colecciones[nombre];
    if (!Array.isArray(lista)) continue;
    let validos = lista.filter(
      (d) => typeof d.id === 'string' && d.id.length > 0 && d.id.length < 200,
    );
    // Una copia de antes del cambio de rutinas trae el formato antiguo, que ya no se admite
    if (nombre === COLECCIONES.rutinas) {
      const ciclos = (copia.colecciones[COLECCIONES.ciclos] ?? []) as unknown as PlantillaCiclo[];
      validos = validos.map(
        (d) => normalizarRutina(d as { id: string }, ciclos) as unknown as typeof d,
      );
    }
    await enLotes(validos, (lote, d) => {
      const { id, ...resto } = d;
      lote.set(refDoc(nombre, id as string), limpiar(resto));
    });
    total += validos.length;
  }
  return total;
}

/** Borra todos los documentos del usuario (antes de borrar la cuenta). */
export async function borrarTodosLosDatos(uid: string): Promise<void> {
  for (const nombre of COLECCIONES_USUARIO) {
    const snap = await getDocs(refColeccion(nombre, uid));
    await enLotes(snap.docs, (lote, d) => lote.delete(d.ref));
  }
  await deleteDoc(doc(obtenerDb(), 'users', uid));
}

/** Recordatorios pendientes (para calcular la diferencia con los deseados). */
export async function recordatoriosPendientes() {
  const snap = await getDocs(
    query(refColeccion(COLECCIONES.recordatorios), where('enviado', '==', false)),
  );
  return snap.docs.map((d) => ({
    ...(d.data() as { fireAt: number; titulo: string; cuerpo: string; tipo: string }),
    id: d.id,
  }));
}
