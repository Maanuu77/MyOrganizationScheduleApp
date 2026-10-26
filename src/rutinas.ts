// Lógica pura de rutinas: cuándo tocan, cuánto duran, cómo se convierten en fases del
// contador, cómo se reparte el tiempo entre sus pasos y su seguimiento (racha y cumplimiento).

import { addDays, startOfDay } from 'date-fns';
import type {
  EjecucionRutina,
  Etiqueta,
  FaseExpandida,
  PasoRutina,
  PlantillaCiclo,
  ReglaRecurrencia,
  Rutina,
  TramoSesion,
} from './tipos';
import { COLORES_FASE, esFoco, expandirCiclo } from './ciclos';
import { DIAS_CORTOS, claveDia, ordenDias } from './fechas';

/** Descanso entre pasos que se propone en una rutina nueva. */
export const DESCANSO_POR_DEFECTO_MIN = 10;

/** Para contar un paso como hecho hay que haber dedicado al menos esta parte de su duración. */
const PARTE_PARA_HECHO = 0.5;
/** Un paso saltado casi al empezar no se guarda en las estadísticas. */
const MINIMO_REGISTRO_MS = 60_000;

/** Regla de recurrencia semanal de la rutina (null si no tiene días: solo se empieza a mano). */
export function reglaDeRutina(rutina: Pick<Rutina, 'programacion'>): ReglaRecurrencia | null {
  const dias = rutina.programacion.diasSemana;
  if (!dias.length) return null;
  return { frecuencia: 'semanal', intervalo: 1, diasSemana: dias, fin: { tipo: 'nunca' } };
}

/** ¿Toca hacer la rutina este día? */
export function rutinaTocaEnDia(rutina: Rutina, dia: Date): boolean {
  if (rutina.archivada) return false;
  if (startOfDay(dia).getTime() < startOfDay(rutina.creadoEnMs).getTime()) return false;
  return rutina.programacion.diasSemana.includes(dia.getDay());
}

/** Días en texto: «Todos los días», «De lunes a viernes» o «lun, mié, vie». */
export function describirDias(dias: number[], inicioSemana: 0 | 1): string {
  const unicos = new Set(dias);
  if (unicos.size === 7) return 'Todos los días';
  if (unicos.size === 5 && [1, 2, 3, 4, 5].every((d) => unicos.has(d))) return 'De lunes a viernes';
  if (unicos.size === 2 && unicos.has(0) && unicos.has(6)) return 'Fines de semana';
  return ordenDias(inicioSemana)
    .filter((d) => unicos.has(d))
    .map((d) => DIAS_CORTOS[d])
    .join(', ');
}

/** Descansos que se hacen de verdad: el del último paso no cuenta. */
function descansoTras(pasos: PasoRutina[], i: number): number {
  return i < pasos.length - 1 ? Math.max(0, pasos[i].descansoMin) : 0;
}

/** Duración total en minutos: pasos más los descansos entre ellos. */
export function duracionRutinaMin(rutina: Pick<Rutina, 'pasos'>): number {
  return rutina.pasos.reduce((s, p, i) => s + p.duracionMin + descansoTras(rutina.pasos, i), 0);
}

/**
 * Convierte la rutina en las fases que ejecuta el contador: un paso, su descanso, el
 * siguiente paso… Cada paso lleva el color de su etiqueta (o el de la rutina).
 */
export function fasesDeRutina(
  rutina: Pick<Rutina, 'pasos' | 'color'>,
  etiquetas: Etiqueta[],
): FaseExpandida[] {
  const fases: FaseExpandida[] = [];
  rutina.pasos.forEach((p, i) => {
    const etiqueta = etiquetas.find((e) => e.id === p.etiquetaId);
    fases.push({
      // «personalizada» cuenta como foco y su aviso dice «Empieza: <nombre del paso>»
      tipo: 'personalizada',
      nombre: p.nombre,
      color: etiqueta?.color ?? rutina.color,
      duracionMs: p.duracionMin * 60_000,
      pasoId: p.id,
      etiquetaId: p.etiquetaId,
      tareaId: p.tareaId,
    });
    const descanso = descansoTras(rutina.pasos, i);
    if (descanso > 0)
      fases.push({
        tipo: 'descansoCorto',
        nombre: 'Descanso',
        color: COLORES_FASE.descansoCorto,
        duracionMs: descanso * 60_000,
      });
  });
  return fases;
}

/** Lo que se ha hecho de un paso en una sesión (se guarda como un registro con su etiqueta). */
export interface TiempoDePaso {
  pasoId: string;
  etiquetaId: string | null;
  tareaId: string | null;
  inicioMs: number;
  finMs: number;
  focoRealMs: number;
  descansosMs: number;
}

/**
 * Reparte los tramos de una sesión de rutina entre sus pasos: cada paso se queda con su
 * tiempo y con el del descanso que lo sigue (los de menos de un minuto no se guardan).
 * También dice qué pasos se han hecho (al menos la mitad de su duración).
 */
export function repartirPorPasos(
  fases: FaseExpandida[],
  tramos: TramoSesion[],
): { pasos: TiempoDePaso[]; hechos: string[] } {
  const pasos: TiempoDePaso[] = [];
  const hechos: string[] = [];
  fases.forEach((f, i) => {
    if (!f.pasoId) return;
    const propios = tramos.filter((t) => t.indiceFase === i);
    const siguiente = fases[i + 1];
    const descanso =
      siguiente && !siguiente.pasoId ? tramos.filter((t) => t.indiceFase === i + 1) : [];
    const focoRealMs = propios.reduce((s, t) => s + t.duracionMs, 0);
    if (focoRealMs >= f.duracionMs * PARTE_PARA_HECHO) hechos.push(f.pasoId);
    if (focoRealMs < MINIMO_REGISTRO_MS) return;
    const todos = [...propios, ...descanso];
    pasos.push({
      pasoId: f.pasoId,
      etiquetaId: f.etiquetaId ?? null,
      tareaId: f.tareaId ?? null,
      inicioMs: Math.min(...todos.map((t) => t.inicioMs)),
      finMs: Math.max(...todos.map((t) => t.finMs)),
      focoRealMs,
      descansosMs: descanso.reduce((s, t) => s + t.duracionMs, 0),
    });
  });
  return { pasos, hechos };
}

// ---------------------------------------------------------------------------
// Rutinas antiguas (antes eran listas de pasos por ámbito día/semana/mes o un ciclo
// de estudio). Se convierten al leerlas; al guardarlas ya se escriben con el formato nuevo.
// ---------------------------------------------------------------------------

interface PasoAntiguo {
  id?: string;
  titulo?: string;
  nombre?: string;
  duracionMin?: number | null;
  etiquetaId?: string | null;
  tareaId?: string | null;
  descansoMin?: number;
}

type RutinaGuardada = Partial<Omit<Rutina, 'pasos' | 'programacion'>> & {
  id: string;
  ambito?: 'dia' | 'semana' | 'mes';
  clase?: 'pasos' | 'estudio';
  etiquetaId?: string | null;
  cicloId?: string | null;
  pasos?: PasoAntiguo[];
  programacion?: { diasSemana?: number[]; hora?: string | null };
};

/** Pasa una rutina tal y como está en Firestore (formato nuevo o antiguo) al formato actual. */
export function normalizarRutina(doc: RutinaGuardada, ciclos: PlantillaCiclo[]): Rutina {
  const base = {
    id: doc.id,
    nombre: doc.nombre ?? '',
    color: doc.color ?? '#5b4bdb',
    avisos: doc.avisos ?? { activo: false, minutosAntes: 5 },
    mostrarEnCalendario: doc.mostrarEnCalendario ?? false,
    eventoCalendarioId: doc.eventoCalendarioId ?? null,
    archivada: doc.archivada ?? false,
    creadoEnMs: doc.creadoEnMs ?? 0,
    actualizadoEnMs: doc.actualizadoEnMs ?? 0,
  };
  const hora = doc.programacion?.hora ?? null;
  const etiquetaComun = doc.etiquetaId ?? null;

  // Formato nuevo
  if (doc.descansoPorDefectoMin !== undefined) {
    return {
      ...base,
      descansoPorDefectoMin: doc.descansoPorDefectoMin,
      programacion: { diasSemana: doc.programacion?.diasSemana ?? [], hora },
      pasos: (doc.pasos ?? []).map((p, i) => ({
        id: p.id ?? `${doc.id}-${i}`,
        nombre: p.nombre ?? p.titulo ?? '',
        duracionMin: p.duracionMin ?? 10,
        etiquetaId: p.etiquetaId ?? null,
        tareaId: p.tareaId ?? null,
        descansoMin: p.descansoMin ?? 0,
      })),
    };
  }

  // Formato antiguo: los días dependían del ámbito y las mensuales ya no existen
  const dias = doc.programacion?.diasSemana ?? [];
  const diasSemana =
    doc.ambito === 'mes'
      ? []
      : dias.length
        ? dias
        : doc.ambito === 'dia'
          ? [0, 1, 2, 3, 4, 5, 6]
          : [1];

  let pasos: PasoRutina[];
  const ciclo = doc.clase === 'estudio' ? ciclos.find((c) => c.id === doc.cicloId) : undefined;
  if (ciclo) {
    // Rutina de estudio: cada fase de foco del ciclo es un paso; los descansos, su pausa
    pasos = [];
    for (const f of expandirCiclo(ciclo)) {
      if (esFoco(f.tipo)) {
        pasos.push({
          id: `${doc.id}-${pasos.length}`,
          nombre: f.nombre,
          duracionMin: Math.round(f.duracionMs / 60_000),
          etiquetaId: etiquetaComun,
          tareaId: null,
          descansoMin: 0,
        });
      } else if (pasos.length) {
        pasos[pasos.length - 1].descansoMin += Math.round(f.duracionMs / 60_000);
      }
    }
  } else {
    pasos = (doc.pasos ?? []).map((p, i) => ({
      id: p.id ?? `${doc.id}-${i}`,
      nombre: p.titulo ?? p.nombre ?? '',
      duracionMin: p.duracionMin || 10,
      etiquetaId: p.etiquetaId ?? etiquetaComun,
      tareaId: null,
      descansoMin: 0,
    }));
  }

  return {
    ...base,
    descansoPorDefectoMin: ciclo ? DESCANSO_POR_DEFECTO_MIN : 0,
    programacion: { diasSemana, hora },
    pasos,
  };
}

// ---------------------------------------------------------------------------
// Seguimiento
// ---------------------------------------------------------------------------

/** Días (claves) entre dos fechas en los que tocaba la rutina, sin pasar de hoy. */
export function diasProgramados(
  rutina: Rutina,
  desde: Date,
  hasta: Date,
  hoy: Date = new Date(),
): string[] {
  const resultado: string[] = [];
  const limite = Math.min(hasta.getTime(), addDays(startOfDay(hoy), 1).getTime());
  for (let d = startOfDay(desde); d.getTime() < limite; d = addDays(d, 1)) {
    if (rutinaTocaEnDia(rutina, d)) resultado.push(claveDia(d));
  }
  return resultado;
}

export interface SeguimientoRutina {
  programadas: number;
  completadas: number;
  cumplimiento: number; // 0..1
  racha: number;
  porcentajePasos: number; // 0..1
}

/**
 * Seguimiento de una rutina en un periodo: cuántas veces tocaba, cuántas se completaron,
 * racha actual (veces seguidas completadas hasta hoy) y porcentaje medio de pasos hechos.
 */
export function seguimientoRutina(
  rutina: Rutina,
  ejecuciones: EjecucionRutina[],
  desde: Date,
  hasta: Date,
  hoy: Date = new Date(),
): SeguimientoRutina {
  const propias = ejecuciones.filter((e) => e.rutinaId === rutina.id);
  const porDia = new Map<string, EjecucionRutina>();
  for (const e of propias) {
    const previa = porDia.get(e.fecha);
    // Si hubo varias el mismo día nos quedamos con la más completa
    if (!previa || e.pasosHechos.length > previa.pasosHechos.length || e.completada)
      porDia.set(e.fecha, e);
  }
  const dias = diasProgramados(rutina, desde, hasta, hoy);
  let completadas = 0;
  let sumaPasos = 0;
  for (const d of dias) {
    const e = porDia.get(d);
    if (e?.completada) completadas++;
    if (e)
      sumaPasos += e.pasosTotales ? e.pasosHechos.length / e.pasosTotales : e.completada ? 1 : 0;
  }

  // Racha: retrocedemos desde hoy por los días programados. Si hoy toca y aún no
  // está hecha no rompe la racha (todavía hay tiempo).
  let racha = 0;
  const hoyClave = claveDia(hoy);
  for (let d = startOfDay(hoy), vueltas = 0; vueltas < 400; d = addDays(d, -1), vueltas++) {
    if (d.getTime() < startOfDay(rutina.creadoEnMs).getTime()) break;
    if (!rutinaTocaEnDia(rutina, d)) continue;
    const clave = claveDia(d);
    if (porDia.get(clave)?.completada) racha++;
    else if (clave !== hoyClave) break;
  }

  return {
    programadas: dias.length,
    completadas,
    cumplimiento: dias.length ? completadas / dias.length : 0,
    racha,
    porcentajePasos: dias.length ? sumaPasos / dias.length : 0,
  };
}

/** Rutinas que tocan hoy, ordenadas por hora. */
export function rutinasDelDia(rutinas: Rutina[], dia: Date): Rutina[] {
  return rutinas
    .filter((r) => rutinaTocaEnDia(r, dia))
    .sort((a, b) => (a.programacion.hora ?? '99').localeCompare(b.programacion.hora ?? '99'));
}
