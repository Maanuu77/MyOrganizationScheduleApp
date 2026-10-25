// Lógica pura de rutinas: cuándo toca cada rutina, cuánto dura y su seguimiento (racha y cumplimiento).

import { addDays, startOfDay } from 'date-fns';
import type { EjecucionRutina, ReglaRecurrencia, Rutina } from './tipos';
import { caeEnDia } from './recurrencia';
import { claveDia, conHora } from './fechas';

/** Convierte la programación de una rutina en una regla de recurrencia estándar. */
export function reglaDeRutina(rutina: Pick<Rutina, 'ambito' | 'programacion'>): ReglaRecurrencia {
  const { programacion } = rutina;
  if (rutina.ambito === 'mes') {
    return {
      frecuencia: 'mensual',
      intervalo: 1,
      mensual: programacion.mensual ?? { modo: 'diasMes', dias: [1] },
      fin: { tipo: 'nunca' },
    };
  }
  const dias = programacion.diasSemana.length
    ? programacion.diasSemana
    : rutina.ambito === 'dia'
      ? [0, 1, 2, 3, 4, 5, 6]
      : [1];
  return { frecuencia: 'semanal', intervalo: 1, diasSemana: dias, fin: { tipo: 'nunca' } };
}

/** Fecha desde la que cuenta la rutina (el día en que se creó). */
function inicioRutina(rutina: Pick<Rutina, 'creadoEnMs' | 'programacion'>): Date {
  return conHora(startOfDay(rutina.creadoEnMs), rutina.programacion.hora ?? '00:00');
}

/** ¿Toca hacer la rutina este día? */
export function rutinaTocaEnDia(rutina: Rutina, dia: Date): boolean {
  if (rutina.archivada) return false;
  if (startOfDay(dia).getTime() < startOfDay(rutina.creadoEnMs).getTime()) return false;
  return caeEnDia(reglaDeRutina(rutina), inicioRutina(rutina), dia);
}

/** Duración total de los pasos (los pasos sin duración cuentan 0). */
export function duracionRutinaMin(rutina: Pick<Rutina, 'pasos'>): number {
  return rutina.pasos.reduce((s, p) => s + (p.duracionMin ?? 0), 0);
}

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
