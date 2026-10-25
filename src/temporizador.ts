// Operaciones del contador sobre el documento único users/{uid}/timerState/actual.
//
// El estado se guarda con marcas de tiempo (inicio de fase con serverTimestamp, duración y
// pausa acumulada). Cualquier dispositivo calcula el tiempo restante con esas marcas y su
// reloj corregido; por eso no hace falta un setInterval funcionando en segundo plano.
// Los cambios usan transacciones para que dos dispositivos no avancen la fase a la vez.

import {
  Timestamp,
  deleteDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { obtenerDb } from './firebase';
import {
  COLECCIONES,
  ejecuciones,
  enLotes,
  limpiar,
  refColeccion,
  refDoc,
  registros,
  uidActual,
} from './datos';
import { useDatos } from './almacenDatos';
import { claveDia } from './fechas';
import { ahoraServidor, idDispositivo } from './relojServidor';
import {
  calcularAvance,
  mensajeFase,
  resumirTramos,
  transcurridoMs,
  type EstadoPlano,
} from './ciclos';
import { idRecordatorio } from './recordatorios';
import type { EstadoContador, FaseExpandida, Recordatorio, TramoSesion } from './tipos';

const ID = 'actual';
const refContador = () => refDoc(COLECCIONES.contador, ID);

/** Convierte el documento de Firestore (con Timestamps) a números para los cálculos. */
export function aPlano(e: EstadoContador | null): EstadoPlano | null {
  if (!e) return null;
  return {
    estado: e.estado,
    modo: e.modo,
    fases: e.fases ?? [],
    indiceFase: e.indiceFase,
    inicioFaseMs: e.inicioFase ? e.inicioFase.toMillis() : null,
    duracionFaseMs: e.duracionFaseMs,
    pausaAcumuladaMs: e.pausaAcumuladaMs,
    pausadoEnMs: e.pausadoEn ? e.pausadoEn.toMillis() : null,
  };
}

interface OpcionesInicio {
  modo: 'ciclo' | 'cronometro';
  fases: FaseExpandida[];
  etiquetaId: string | null;
  tareaId: string | null;
  eventoId: string | null;
  cicloId: string | null;
  rutinaId?: string | null;
}

export async function iniciarSesion(o: OpcionesInicio): Promise<void> {
  const estado = {
    estado: 'enCurso',
    modo: o.modo,
    fases:
      o.modo === 'ciclo'
        ? o.fases
        : [{ tipo: 'foco', nombre: 'Foco libre', color: '#6D5CF0', duracionMs: 0 }],
    indiceFase: 0,
    inicioFase: serverTimestamp(),
    duracionFaseMs: o.modo === 'ciclo' ? (o.fases[0]?.duracionMs ?? 0) : 0,
    pausaAcumuladaMs: 0,
    pausadoEn: null,
    etiquetaId: o.etiquetaId,
    tareaId: o.tareaId,
    eventoId: o.eventoId,
    cicloId: o.cicloId,
    rutinaId: o.rutinaId ?? null,
    sesionInicioMs: ahoraServidor(),
    interrupciones: 0,
    tramos: [],
    actualizadoPor: idDispositivo(),
    version: Date.now(),
  };
  await setDoc(refContador(), limpiar(estado));
}

/** Ejecuta un cambio dentro de una transacción leyendo el estado más reciente. */
async function cambiar(
  fn: (e: EstadoContador) => Partial<Record<keyof EstadoContador, unknown>> | null,
): Promise<void> {
  await runTransaction(obtenerDb(), async (tx) => {
    const snap = await tx.get(refContador());
    if (!snap.exists()) return;
    const actual = snap.data() as EstadoContador;
    const cambios = fn(actual);
    if (!cambios) return;
    tx.update(refContador(), {
      ...cambios,
      actualizadoPor: idDispositivo(),
      version: (actual.version ?? 0) + 1,
    });
  });
}

export function pausar(): Promise<void> {
  return cambiar((e) =>
    e.estado === 'enCurso'
      ? { estado: 'pausado', pausadoEn: serverTimestamp(), interrupciones: e.interrupciones + 1 }
      : null,
  );
}

export function reanudar(): Promise<void> {
  return cambiar((e) => {
    if (e.estado !== 'pausado' || !e.pausadoEn) return null;
    const pausa = Math.max(0, ahoraServidor() - e.pausadoEn.toMillis());
    return { estado: 'enCurso', pausadoEn: null, pausaAcumuladaMs: e.pausaAcumuladaMs + pausa };
  });
}

/** Cierra la fase actual con lo que se haya hecho y pasa a la siguiente. */
export function saltarFase(): Promise<void> {
  return cambiar((e) => {
    const plano = aPlano(e)!;
    if (e.modo !== 'ciclo' || e.indiceFase >= e.fases.length) return null;
    const ahora = ahoraServidor();
    const hecho = transcurridoMs(plano, ahora);
    const tramo: TramoSesion = {
      tipo: e.fases[e.indiceFase].tipo,
      inicioMs: plano.inicioFaseMs ?? ahora,
      finMs: ahora,
      duracionMs: hecho,
    };
    const siguiente = e.indiceFase + 1;
    const terminado = siguiente >= e.fases.length;
    return {
      tramos: [...e.tramos, tramo],
      indiceFase: siguiente,
      estado: terminado
        ? 'esperando'
        : e.estado === 'pausado'
          ? 'enCurso'
          : e.estado === 'esperando'
            ? 'enCurso'
            : e.estado,
      inicioFase: serverTimestamp(),
      duracionFaseMs: terminado ? 0 : e.fases[siguiente].duracionMs,
      pausaAcumuladaMs: 0,
      pausadoEn: null,
    };
  });
}

/** Desde "esperando": empieza la fase que toca. */
export function seguir(): Promise<void> {
  return cambiar((e) => {
    if (e.estado !== 'esperando' || e.indiceFase >= e.fases.length) return null;
    return {
      estado: 'enCurso',
      inicioFase: serverTimestamp(),
      duracionFaseMs: e.fases[e.indiceFase].duracionMs,
      pausaAcumuladaMs: 0,
      pausadoEn: null,
    };
  });
}

export function añadirMinutos(minutos = 5): Promise<void> {
  return cambiar((e) =>
    e.modo === 'ciclo' && e.estado !== 'inactivo' && e.estado !== 'esperando'
      ? { duracionFaseMs: e.duracionFaseMs + minutos * 60_000 }
      : null,
  );
}

/** Acorta la fase actual para que termine en `hastaMs` (si invade un bloque protegido o un evento). */
export function cortarFaseEn(hastaMs: number): Promise<void> {
  return cambiar((e) => {
    const plano = aPlano(e)!;
    if (plano.inicioFaseMs === null) return null;
    const nuevaDuracion = Math.max(60_000, hastaMs - plano.inicioFaseMs - plano.pausaAcumuladaMs);
    return { duracionFaseMs: nuevaDuracion };
  });
}

/** Avance automático cuando la fase termina (lo hace el primer dispositivo que lo detecta). */
export function avanzarSiToca(autoAvanzar: boolean): Promise<void> {
  return cambiar((e) => {
    const r = calcularAvance(aPlano(e)!, ahoraServidor(), autoAvanzar);
    if (!r) return null;
    return {
      tramos: [...e.tramos, ...r.tramosNuevos],
      indiceFase: r.indiceFase,
      inicioFase: Timestamp.fromMillis(r.inicioFaseMs),
      duracionFaseMs: r.duracionFaseMs,
      pausaAcumuladaMs: 0,
      pausadoEn: null,
      estado: r.esperando ? 'esperando' : 'enCurso',
    };
  });
}

export interface ResumenSesion {
  inicioMs: number;
  finMs: number;
  focoRealMs: number;
  descansosMs: number;
  interrupciones: number;
  fasesCompletadas: number;
  etiquetaId: string | null;
  tareaId: string | null;
  eventoId: string | null;
  modo: 'ciclo' | 'cronometro';
}

/** Resumen de la sesión en curso, incluyendo la parte hecha de la fase actual. */
export function resumenDe(e: EstadoContador): ResumenSesion {
  const plano = aPlano(e)!;
  const ahora = ahoraServidor();
  const tramos = [...(e.tramos ?? [])];
  if (e.estado !== 'esperando' && e.indiceFase < e.fases.length && plano.inicioFaseMs !== null) {
    tramos.push({
      tipo: e.fases[e.indiceFase].tipo,
      inicioMs: plano.inicioFaseMs,
      finMs: ahora,
      duracionMs: transcurridoMs(plano, ahora),
    });
  }
  const { focoMs, descansoMs, fasesFoco } = resumirTramos(tramos);
  return {
    inicioMs: e.sesionInicioMs ?? tramos[0]?.inicioMs ?? ahora,
    finMs: ahora,
    focoRealMs: focoMs,
    descansosMs: descansoMs,
    interrupciones: e.interrupciones,
    fasesCompletadas: fasesFoco,
    etiquetaId: e.etiquetaId,
    tareaId: e.tareaId,
    eventoId: e.eventoId,
    modo: e.modo,
  };
}

/** Guarda el registro de la sesión y deja el contador libre. */
export async function terminarYGuardar(
  resumen: ResumenSesion,
  nota: string,
  valoracion: number | null,
  rutinaId: string | null = null,
): Promise<void> {
  await registros.crear({ ...resumen, nota, valoracion });
  // Si la lanzó una rutina de estudio, la marcamos como hecha hoy
  if (rutinaId) await completarEjecucionDeHoy(rutinaId);
  await detener();
}

async function completarEjecucionDeHoy(rutinaId: string): Promise<void> {
  const { ejecuciones: lista, rutinas } = useDatos.getState();
  const hoy = claveDia(new Date());
  const rutina = rutinas.find((r) => r.id === rutinaId);
  const previa = lista.find((e) => e.rutinaId === rutinaId && e.fecha === hoy);
  const pasos = rutina?.pasos.map((p) => p.id) ?? [];
  if (previa) {
    await ejecuciones.actualizar(previa.id, {
      completada: true,
      finMs: Date.now(),
      pasosHechos: pasos,
      indicePaso: pasos.length,
    });
  } else {
    await ejecuciones.crear({
      rutinaId,
      fecha: hoy,
      inicioMs: Date.now(),
      finMs: Date.now(),
      pasosHechos: pasos,
      pasosTotales: pasos.length,
      completada: true,
      indicePaso: pasos.length,
      inicioPasoMs: null,
    });
  }
}

/** Deja el contador libre sin guardar nada. */
export async function detener(): Promise<void> {
  await deleteDoc(refContador());
  await sincronizarRecordatoriosContador(null, true, true);
}

// ---------------------------------------------------------------------------
// Recordatorios de fin de fase (para recibirlos con la app cerrada)
// ---------------------------------------------------------------------------

/** Aviso de un cambio de fase futuro (lo usan los recordatorios del servidor y la app Android). */
export interface AvisoFase {
  refId: string;
  /** Instante en hora del servidor. */
  fireAt: number;
  titulo: string;
  cuerpo: string;
}

/**
 * Calcula un aviso por cada cambio de fase que queda (suponiendo que no se pausa).
 * Sin avance automático solo se avisa del primer cambio (luego el contador espera al usuario).
 */
export function avisosDeFases(e: EstadoContador | null, autoAvanzar: boolean): AvisoFase[] {
  const avisos: AvisoFase[] = [];
  const plano = aPlano(e);
  if (!e || !plano || e.estado !== 'enCurso' || e.modo !== 'ciclo' || plano.inicioFaseMs === null) {
    return avisos;
  }
  let fin = plano.inicioFaseMs + plano.pausaAcumuladaMs + plano.duracionFaseMs;
  for (let i = e.indiceFase; i < e.fases.length; i++) {
    const siguiente = e.fases[i + 1];
    avisos.push({
      refId: `fase${i}`,
      fireAt: Math.round(fin),
      titulo: siguiente ? mensajeFase(siguiente.tipo, siguiente.nombre) : 'Ciclo completado',
      cuerpo: siguiente
        ? `${siguiente.nombre} · ${Math.round(siguiente.duracionMs / 60000)} min`
        : 'Guarda la sesión para que cuente en tus estadísticas.',
    });
    if (!siguiente || !autoAvanzar) break;
    fin += siguiente.duracionMs;
  }
  return avisos;
}

/**
 * Guarda en el servidor un recordatorio por cada cambio de fase que queda.
 * Solo lo hace el dispositivo que hizo el último cambio, para no pisarse entre ellos.
 */
export async function sincronizarRecordatoriosContador(
  e: EstadoContador | null,
  autoAvanzar: boolean,
  forzar = false,
): Promise<void> {
  if (!forzar && e && e.actualizadoPor !== idDispositivo()) return;
  const uid = uidActual();
  const existentes = await getDocs(
    query(refColeccion(COLECCIONES.recordatorios), where('tipo', '==', 'faseTemporizador')),
  );
  const nuevos: Recordatorio[] = avisosDeFases(e, autoAvanzar).map((a) => ({
    id: idRecordatorio('faseTemporizador', a.refId, a.fireAt),
    uid,
    tipo: 'faseTemporizador',
    refId: a.refId,
    fireAt: a.fireAt,
    titulo: a.titulo,
    cuerpo: a.cuerpo,
    url: '/foco',
    enviado: false,
    creadoEnMs: Date.now(),
  }));
  const idsNuevos = new Set(nuevos.map((n) => n.id));
  await enLotes(
    [
      ...existentes.docs.filter((d) => !idsNuevos.has(d.id)).map((d) => ({ borrar: d.id })),
      ...nuevos.map((n) => ({ crear: n })),
    ],
    (lote, op) => {
      if ('borrar' in op) lote.delete(refDoc(COLECCIONES.recordatorios, op.borrar));
      else {
        const { id, ...datos } = op.crear;
        lote.set(refDoc(COLECCIONES.recordatorios, id), datos);
      }
    },
  );
}
