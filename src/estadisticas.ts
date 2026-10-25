// Cálculos de estadísticas (funciones puras). La pantalla de estadísticas solo pinta lo que sale de aquí.

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import type { EjecucionRutina, Etiqueta, Ocurrencia, RegistroSesion, Rutina, Tarea } from './tipos';
import { MS_HORA, claveDia, desdeClaveDia, formatear, inicioDeSemana } from './fechas';
import { seguimientoRutina, type SeguimientoRutina } from './rutinas';

export type TipoPeriodo = 'dia' | 'semana' | 'mes' | 'año' | 'rango';

export interface Periodo {
  tipo: TipoPeriodo;
  desde: number; // incluido
  hasta: number; // excluido
  nombre: string;
}

/** Calcula el periodo que contiene la fecha de referencia. */
export function calcularPeriodo(
  tipo: TipoPeriodo,
  referencia: Date,
  inicioSemana: 0 | 1,
  rango?: { desde: string; hasta: string },
): Periodo {
  switch (tipo) {
    case 'dia': {
      const d = startOfDay(referencia);
      return {
        tipo,
        desde: d.getTime(),
        hasta: addDays(d, 1).getTime(),
        nombre: formatear(d, "EEEE d 'de' MMMM"),
      };
    }
    case 'semana': {
      const d = inicioDeSemana(referencia, inicioSemana);
      const fin = addDays(d, 7);
      return {
        tipo,
        desde: d.getTime(),
        hasta: fin.getTime(),
        nombre: `${formatear(d, 'd MMM')} – ${formatear(addDays(fin, -1), 'd MMM yyyy')}`,
      };
    }
    case 'mes': {
      const d = startOfMonth(referencia);
      return {
        tipo,
        desde: d.getTime(),
        hasta: endOfMonth(d).getTime() + 1,
        nombre: formatear(d, 'MMMM yyyy'),
      };
    }
    case 'año': {
      const d = startOfYear(referencia);
      return {
        tipo,
        desde: d.getTime(),
        hasta: endOfYear(d).getTime() + 1,
        nombre: formatear(d, 'yyyy'),
      };
    }
    case 'rango': {
      const desde = desdeClaveDia(rango?.desde ?? claveDia(referencia));
      const hasta = addDays(desdeClaveDia(rango?.hasta ?? claveDia(referencia)), 1);
      return {
        tipo,
        desde: desde.getTime(),
        hasta: hasta.getTime(),
        nombre: `${formatear(desde, 'd MMM yyyy')} – ${formatear(addDays(hasta, -1), 'd MMM yyyy')}`,
      };
    }
  }
}

/** El periodo inmediatamente anterior de la misma longitud (para comparar). */
export function periodoAnterior(p: Periodo): Periodo {
  const desde = new Date(p.desde);
  let nuevoDesde: Date;
  switch (p.tipo) {
    case 'dia':
      nuevoDesde = addDays(desde, -1);
      break;
    case 'semana':
      nuevoDesde = addWeeks(desde, -1);
      break;
    case 'mes':
      nuevoDesde = addMonths(desde, -1);
      break;
    case 'año':
      nuevoDesde = addYears(desde, -1);
      break;
    default: {
      const dias = differenceInCalendarDays(p.hasta, p.desde);
      nuevoDesde = addDays(desde, -dias);
    }
  }
  return { tipo: p.tipo, desde: nuevoDesde.getTime(), hasta: p.desde, nombre: 'Periodo anterior' };
}

/** Registros cuyo inicio cae dentro del periodo. */
export function registrosEn(
  registros: RegistroSesion[],
  desde: number,
  hasta: number,
): RegistroSesion[] {
  return registros.filter((r) => r.inicioMs >= desde && r.inicioMs < hasta);
}

/** Parte del intervalo [a, b) que cae dentro de [desde, hasta). */
function recortar(a: number, b: number, desde: number, hasta: number): number {
  return Math.max(0, Math.min(b, hasta) - Math.max(a, desde));
}

export interface FilaEtiqueta {
  etiquetaId: string | null;
  planificadoMs: number;
  realMs: number;
}

/** Horas de foco por etiqueta: planificado (sesiones del calendario) frente a real (registros). */
export function focoPorEtiqueta(
  registros: RegistroSesion[],
  ocurrencias: Ocurrencia[],
  desde: number,
  hasta: number,
): FilaEtiqueta[] {
  const mapa = new Map<string | null, FilaEtiqueta>();
  const fila = (id: string | null) => {
    if (!mapa.has(id)) mapa.set(id, { etiquetaId: id, planificadoMs: 0, realMs: 0 });
    return mapa.get(id)!;
  };
  for (const o of ocurrencias) {
    if (o.evento.tipo !== 'sesion' || o.evento.todoElDia) continue;
    fila(o.etiquetaId).planificadoMs += recortar(o.inicioMs, o.finMs, desde, hasta);
  }
  for (const r of registrosEn(registros, desde, hasta)) fila(r.etiquetaId).realMs += r.focoRealMs;
  return [...mapa.values()]
    .filter((f) => f.planificadoMs > 0 || f.realMs > 0)
    .sort((a, b) => b.realMs + b.planificadoMs - (a.realMs + a.planificadoMs));
}

export interface ProgresoObjetivo {
  etiqueta: Etiqueta;
  objetivoMs: number;
  realMs: number;
  porcentaje: number;
}

/** Progreso de la semana actual hacia el objetivo semanal de cada etiqueta que lo tenga. */
export function progresoObjetivos(
  etiquetas: Etiqueta[],
  registros: RegistroSesion[],
  semanaDesde: number,
): ProgresoObjetivo[] {
  const hasta = addDays(semanaDesde, 7).getTime();
  const enSemana = registrosEn(registros, semanaDesde, hasta);
  return etiquetas
    .filter((e) => !e.archivada && e.objetivoSemanalHoras && e.objetivoSemanalHoras > 0)
    .map((e) => {
      const objetivoMs = e.objetivoSemanalHoras! * MS_HORA;
      const realMs = enSemana
        .filter((r) => r.etiquetaId === e.id)
        .reduce((s, r) => s + r.focoRealMs, 0);
      return { etiqueta: e, objetivoMs, realMs, porcentaje: Math.min(1, realMs / objetivoMs) };
    });
}

/** Cumplimiento de bloques: de los bloques ya pasados (no protegidos), cuántos se marcaron como hechos. */
export function cumplimientoBloques(
  ocurrencias: Ocurrencia[],
  ahoraMs: number,
): { hechos: number; total: number; ratio: number } {
  const pasados = ocurrencias.filter(
    (o) => o.finMs <= ahoraMs && o.evento.tipo !== 'protegido' && !o.evento.todoElDia,
  );
  const hechos = pasados.filter((o) => o.completado).length;
  return { hechos, total: pasados.length, ratio: pasados.length ? hechos / pasados.length : 0 };
}

export function tareasCompletadasEn(tareas: Tarea[], desde: number, hasta: number): Tarea[] {
  return tareas.filter(
    (t) =>
      t.completada &&
      t.completadaEnMs !== null &&
      t.completadaEnMs >= desde &&
      t.completadaEnMs < hasta,
  );
}

/** Minutos de foco por día (clave 'YYYY-MM-DD'). */
export function focoPorDia(registros: RegistroSesion[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of registros) {
    const clave = claveDia(r.inicioMs);
    mapa.set(clave, (mapa.get(clave) ?? 0) + r.focoRealMs);
  }
  return mapa;
}

/** Racha actual y mejor racha de días seguidos con algo de foco. Hoy sin foco no rompe la racha. */
export function rachas(
  registros: RegistroSesion[],
  hoy: Date = new Date(),
): { actual: number; mejor: number } {
  const dias = focoPorDia(registros);
  let actual = 0;
  let d = startOfDay(hoy);
  if (!dias.get(claveDia(d))) d = addDays(d, -1);
  while (dias.get(claveDia(d))) {
    actual++;
    d = addDays(d, -1);
  }
  const ordenadas = [...dias.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([k]) => k)
    .sort();
  let mejor = 0;
  let cadena = 0;
  let previa: Date | null = null;
  for (const clave of ordenadas) {
    const fecha = desdeClaveDia(clave);
    cadena = previa && differenceInCalendarDays(fecha, previa) === 1 ? cadena + 1 : 1;
    mejor = Math.max(mejor, cadena);
    previa = fecha;
  }
  return { actual, mejor: Math.max(mejor, actual) };
}

export interface CeldaCalor {
  clave: string;
  fecha: Date;
  ms: number;
  nivel: 0 | 1 | 2 | 3 | 4;
}

/** Mapa de calor anual: una celda por día del año con un nivel de intensidad 0..4. */
export function mapaCalor(registros: RegistroSesion[], año: number): CeldaCalor[] {
  const dias = focoPorDia(registros);
  const inicio = new Date(año, 0, 1);
  const total = differenceInCalendarDays(new Date(año + 1, 0, 1), inicio);
  const valores: number[] = [];
  const celdas: CeldaCalor[] = [];
  for (let i = 0; i < total; i++) {
    const fecha = addDays(inicio, i);
    const clave = claveDia(fecha);
    const ms = dias.get(clave) ?? 0;
    if (ms > 0) valores.push(ms);
    celdas.push({ clave, fecha, ms, nivel: 0 });
  }
  // Niveles por cuartiles de los días con actividad, para que el mapa se adapte a cada persona
  const ordenados = valores.sort((a, b) => a - b);
  const q = (p: number) =>
    ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))] ?? 0;
  const cortes = [q(0.25), q(0.5), q(0.75)];
  for (const c of celdas) {
    if (c.ms <= 0) continue;
    c.nivel = c.ms <= cortes[0] ? 1 : c.ms <= cortes[1] ? 2 : c.ms <= cortes[2] ? 3 : 4;
  }
  return celdas;
}

/** Foco por día de la semana (índice 0 = domingo). */
export function distribucionDiaSemana(registros: RegistroSesion[]): number[] {
  const resultado = Array(7).fill(0) as number[];
  for (const r of registros) resultado[new Date(r.inicioMs).getDay()] += r.focoRealMs;
  return resultado;
}

/** Foco por franja horaria (24 franjas). Reparte cada sesión entre las horas que abarca. */
export function distribucionFranja(registros: RegistroSesion[]): number[] {
  const resultado = Array(24).fill(0) as number[];
  for (const r of registros) {
    const duracion = Math.max(1, r.finMs - r.inicioMs);
    let t = r.inicioMs;
    while (t < r.finMs) {
      const d = new Date(t);
      const finHora = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours() + 1,
      ).getTime();
      const tramo = Math.min(finHora, r.finMs) - t;
      resultado[d.getHours()] += (tramo / duracion) * r.focoRealMs;
      t = finHora;
    }
  }
  return resultado;
}

export function duracionMediaSesion(registros: RegistroSesion[]): number {
  if (!registros.length) return 0;
  return registros.reduce((s, r) => s + r.focoRealMs, 0) / registros.length;
}

export function valoracionMedia(registros: RegistroSesion[]): number | null {
  const con = registros.filter((r) => r.valoracion !== null);
  if (!con.length) return null;
  return con.reduce((s, r) => s + (r.valoracion ?? 0), 0) / con.length;
}

/** Variación relativa entre dos valores (null si no hay base para comparar). */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return (actual - anterior) / anterior;
}

export interface ResumenRutina extends SeguimientoRutina {
  rutina: Rutina;
}

export function resumenRutinas(
  rutinas: Rutina[],
  ejecuciones: EjecucionRutina[],
  desde: number,
  hasta: number,
  hoy: Date = new Date(),
): ResumenRutina[] {
  return rutinas
    .filter((r) => !r.archivada)
    .map((rutina) => ({
      rutina,
      ...seguimientoRutina(rutina, ejecuciones, new Date(desde), new Date(hasta), hoy),
    }));
}

/** Serie diaria de foco real en el periodo (para el gráfico de evolución). */
export function serieDiaria(
  registros: RegistroSesion[],
  desde: number,
  hasta: number,
): Array<{ clave: string; horas: number }> {
  const dias = focoPorDia(registrosEn(registros, desde, hasta));
  const serie: Array<{ clave: string; horas: number }> = [];
  for (let t = desde; t < hasta; t = addDays(t, 1).getTime()) {
    const clave = claveDia(t);
    serie.push({ clave, horas: (dias.get(clave) ?? 0) / MS_HORA });
    if (serie.length > 400) break;
  }
  return serie;
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

/** Escapa un valor para CSV (comillas dobles y separador punto y coma, como usa Excel en España). */
function celdaCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(filas: Array<Record<string, unknown>>): string {
  if (!filas.length) return '';
  const columnas = Object.keys(filas[0]);
  const lineas = [
    columnas.join(';'),
    ...filas.map((f) => columnas.map((c) => celdaCsv(f[c])).join(';')),
  ];
  return '﻿' + lineas.join('\n'); // BOM para que Excel lea bien los acentos
}

/** Filas de los registros de sesión listas para exportar. */
export function filasRegistros(
  registros: RegistroSesion[],
  etiquetas: Etiqueta[],
): Array<Record<string, unknown>> {
  const nombre = new Map(etiquetas.map((e) => [e.id, e.nombre]));
  return registros.map((r) => ({
    fecha: claveDia(r.inicioMs),
    inicio: formatear(r.inicioMs, 'HH:mm'),
    fin: formatear(r.finMs, 'HH:mm'),
    etiqueta: r.etiquetaId ? (nombre.get(r.etiquetaId) ?? '') : '',
    foco_min: Math.round(r.focoRealMs / 60000),
    descansos_min: Math.round(r.descansosMs / 60000),
    interrupciones: r.interrupciones,
    valoracion: r.valoracion ?? '',
    nota: r.nota,
  }));
}
