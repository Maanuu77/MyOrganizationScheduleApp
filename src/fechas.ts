// Utilidades de fechas usadas en toda la app (sobre date-fns con idioma español).
// Las fechas "de calendario" se manejan como texto 'YYYY-MM-DD' en la zona horaria local.

import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

export const MS_MINUTO = 60_000;
export const MS_HORA = 3_600_000;
export const MS_DIA = 86_400_000;

/** Convierte una fecha a su clave de día 'YYYY-MM-DD' (zona local). */
export function claveDia(fecha: Date | number): string {
  return format(fecha, 'yyyy-MM-dd');
}

/** Convierte una clave 'YYYY-MM-DD' en un Date a las 00:00 locales. */
export function desdeClaveDia(clave: string): Date {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Devuelve el Date de un día con una hora 'HH:mm' concreta (zona local). */
export function conHora(dia: Date | string, hora: string): Date {
  const base = typeof dia === 'string' ? desdeClaveDia(dia) : dia;
  const [h, m] = hora.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
}

/** Minutos desde medianoche de un instante. */
export function minutosDelDia(fecha: Date | number): number {
  const d = typeof fecha === 'number' ? new Date(fecha) : fecha;
  return d.getHours() * 60 + d.getMinutes();
}

/** 'HH:mm' → minutos desde medianoche. */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** minutos → 'HH:mm' */
export function minutosAHora(minutos: number): string {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formatea la hora de un instante en 24 h o 12 h. */
export function formatearHora(ms: number, formato24h: boolean): string {
  return format(ms, formato24h ? 'HH:mm' : 'h:mm a', { locale: es });
}

/** Formato libre con idioma español. */
export function formatear(fecha: Date | number, patron: string): string {
  return format(fecha, patron, { locale: es });
}

/** Primer día de la semana que contiene la fecha (0 = domingo, 1 = lunes). */
export function inicioDeSemana(fecha: Date | number, inicioSemana: 0 | 1): Date {
  return startOfWeek(fecha, { weekStartsOn: inicioSemana });
}

/** Los 7 días de la semana que contiene la fecha. */
export function diasDeSemana(fecha: Date | number, inicioSemana: 0 | 1): Date[] {
  const inicio = inicioDeSemana(fecha, inicioSemana);
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

/** Rango [inicio, fin) en ms de un día. */
export function rangoDia(fecha: Date | number): [number, number] {
  return [startOfDay(fecha).getTime(), endOfDay(fecha).getTime() + 1];
}

/** Duración en ms → texto corto como "1 h 25 min" o "45 min". */
export function duracionTexto(ms: number): string {
  const minutos = Math.round(ms / MS_MINUTO);
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Horas con un decimal: 5400000 → "1,5 h". */
export function horasTexto(ms: number): string {
  const horas = ms / MS_HORA;
  return `${horas.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
}

/** Tiempo restante en formato reloj: "25:00" o "1:05:00". */
export function relojTexto(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Texto relativo de un día: "Hoy", "Mañana", "Ayer" o la fecha. */
export function diaRelativo(fecha: Date | number, hoy: Date = new Date()): string {
  const dif = differenceInCalendarDays(fecha, hoy);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Mañana';
  if (dif === -1) return 'Ayer';
  return formatear(fecha, "EEEE d 'de' MMMM");
}

/** Zona horaria del dispositivo (p. ej. "Europe/Madrid"). */
export function zonaDelDispositivo(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Primera letra en mayúscula (date-fns devuelve "lunes", queremos "Lunes"). */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Nombres cortos de los días empezando en domingo (índice = getDay()). */
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/** Orden de los días de la semana según el día de inicio. */
export function ordenDias(inicioSemana: 0 | 1): number[] {
  return inicioSemana === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

/** ¿Se solapan dos intervalos [a1, a2) y [b1, b2)? */
export function seSolapan(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2;
}

/**
 * Intervalos [inicio, fin) del horario de sueño que tocan un día.
 * Si el sueño cruza la medianoche (23:00 → 07:00) devuelve el tramo de la madrugada
 * y el de la noche de ese día.
 */
export function tramosSueno(dia: Date, inicio: string, fin: string): Array<[number, number]> {
  const ini = horaAMinutos(inicio);
  const fi = horaAMinutos(fin);
  const base = startOfDay(dia).getTime();
  const enMs = (min: number) => conHora(dia, minutosAHora(min)).getTime();
  if (ini === fi) return [];
  if (ini < fi) return [[enMs(ini), enMs(fi)]];
  // Cruza la medianoche
  return [
    [base, enMs(fi)],
    [enMs(ini), addDays(startOfDay(dia), 1).getTime()],
  ];
}

/** ¿Un instante cae dentro de una franja horaria 'HH:mm'–'HH:mm' (que puede cruzar medianoche)? */
export function enFranja(ms: number, inicio: string, fin: string): boolean {
  const min = minutosDelDia(ms);
  const ini = horaAMinutos(inicio);
  const fi = horaAMinutos(fin);
  if (ini === fi) return false;
  return ini < fi ? min >= ini && min < fi : min >= ini || min < fi;
}
