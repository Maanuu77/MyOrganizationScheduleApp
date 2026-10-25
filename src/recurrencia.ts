// Motor de recurrencia: convierte un evento "maestro" con regla de repetición en las
// ocurrencias concretas que se ven en el calendario, aplicando las excepciones
// (ocurrencias canceladas, movidas o marcadas como completadas).
//
// Todo se calcula en hora local: un evento a las 09:00 sigue a las 09:00 aunque cambie
// el horario de verano, porque construimos cada fecha con new Date(año, mes, día, hora, min).

import { getDaysInMonth } from 'date-fns';
import type { Evento, ExcepcionEvento, Ocurrencia, ReglaMensual, ReglaRecurrencia } from './tipos';
import { DIAS_LARGOS, MS_DIA, claveDia, desdeClaveDia, formatear } from './fechas';

/** Límite de seguridad para no entrar nunca en un bucle infinito. */
const MAX_ITERACIONES = 20_000;

/** Crea una fecha local manteniendo la hora y los minutos de `plantilla`. */
function fechaConHoraDe(año: number, mes: number, dia: number, plantilla: Date): Date {
  return new Date(año, mes, dia, plantilla.getHours(), plantilla.getMinutes(), 0, 0);
}

/** Posición del día dentro de una semana que empieza en lunes (lunes = 0 … domingo = 6). */
function posicionLunes(diaSemana: number): number {
  return (diaSemana + 6) % 7;
}

/** Día del mes que corresponde a "el primer lunes", "el último viernes", etc. Devuelve null si no existe. */
export function diaOrdinal(
  año: number,
  mes: number,
  ordinal: number,
  diaSemana: number,
): number | null {
  const diasMes = getDaysInMonth(new Date(año, mes, 1));
  if (ordinal === -1) {
    for (let d = diasMes; d >= 1; d--) {
      if (new Date(año, mes, d).getDay() === diaSemana) return d;
    }
    return null;
  }
  let contador = 0;
  for (let d = 1; d <= diasMes; d++) {
    if (new Date(año, mes, d).getDay() === diaSemana) {
      contador++;
      if (contador === ordinal) return d;
    }
  }
  return null;
}

/** Días del mes (ordenados) en los que cae la regla mensual para un mes concreto. */
function diasDelMes(año: number, mes: number, regla: ReglaMensual): number[] {
  if (regla.modo === 'diasMes') {
    const max = getDaysInMonth(new Date(año, mes, 1));
    return [...new Set(regla.dias)].filter((d) => d >= 1 && d <= max).sort((a, b) => a - b);
  }
  const d = diaOrdinal(año, mes, regla.ordinal, regla.diaSemana);
  return d ? [d] : [];
}

/**
 * Genera, en orden, los inicios de todas las ocurrencias de una regla.
 * `desdeMs` permite saltar directamente cerca del rango pedido cuando la regla no
 * tiene límite de "veces" (si lo tiene hay que contar desde el principio).
 */
export function* generarInicios(
  regla: ReglaRecurrencia,
  inicio: Date,
  desdeMs?: number,
): Generator<Date> {
  const intervalo = Math.max(1, Math.floor(regla.intervalo || 1));
  const limiteVeces = regla.fin.tipo === 'veces' ? regla.fin.veces : Infinity;
  const hasta =
    regla.fin.tipo === 'fecha'
      ? desdeClaveDia(regla.fin.hasta).getTime() + MS_DIA // el día "hasta" está incluido
      : Infinity;
  const puedeSaltar =
    regla.fin.tipo !== 'veces' && desdeMs !== undefined && desdeMs > inicio.getTime();
  const diaInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
  let emitidas = 0;
  let iteraciones = 0;

  const emitir = function* (fecha: Date): Generator<Date, boolean> {
    // Devuelve false cuando hay que parar.
    if (fecha.getTime() >= hasta || emitidas >= limiteVeces) return false;
    emitidas++;
    yield fecha;
    return true;
  };

  if (regla.frecuencia === 'diaria') {
    let k = 0;
    if (puedeSaltar) {
      k = Math.max(0, Math.floor((desdeMs! - inicio.getTime()) / (intervalo * MS_DIA)) - 2);
    }
    while (iteraciones++ < MAX_ITERACIONES) {
      const fecha = fechaConHoraDe(
        inicio.getFullYear(),
        inicio.getMonth(),
        inicio.getDate() + k * intervalo,
        inicio,
      );
      if (!(yield* emitir(fecha))) return;
      k++;
    }
    return;
  }

  if (regla.frecuencia === 'semanal') {
    const dias = (
      regla.diasSemana?.length ? [...new Set(regla.diasSemana)] : [inicio.getDay()]
    ).sort((a, b) => posicionLunes(a) - posicionLunes(b));
    // Lunes de la semana del inicio
    const lunes = new Date(
      inicio.getFullYear(),
      inicio.getMonth(),
      inicio.getDate() - posicionLunes(inicio.getDay()),
    );
    let semana = 0;
    if (puedeSaltar) {
      semana = Math.max(0, Math.floor((desdeMs! - lunes.getTime()) / (intervalo * 7 * MS_DIA)) - 1);
    }
    while (iteraciones++ < MAX_ITERACIONES) {
      for (const dia of dias) {
        const fecha = fechaConHoraDe(
          lunes.getFullYear(),
          lunes.getMonth(),
          lunes.getDate() + semana * intervalo * 7 + posicionLunes(dia),
          inicio,
        );
        if (fecha.getTime() < diaInicio) continue; // días de la primera semana anteriores al inicio
        if (!(yield* emitir(fecha))) return;
      }
      semana++;
    }
    return;
  }

  // Mensual
  const reglaMes: ReglaMensual = regla.mensual ?? { modo: 'diasMes', dias: [inicio.getDate()] };
  let mes = 0;
  if (puedeSaltar) {
    const d = new Date(desdeMs!);
    const meses =
      (d.getFullYear() - inicio.getFullYear()) * 12 + (d.getMonth() - inicio.getMonth());
    mes = Math.max(0, Math.floor(meses / intervalo) - 1);
  }
  while (iteraciones++ < MAX_ITERACIONES) {
    const base = new Date(inicio.getFullYear(), inicio.getMonth() + mes * intervalo, 1);
    for (const dia of diasDelMes(base.getFullYear(), base.getMonth(), reglaMes)) {
      const fecha = fechaConHoraDe(base.getFullYear(), base.getMonth(), dia, inicio);
      if (fecha.getTime() < diaInicio) continue;
      if (!(yield* emitir(fecha))) return;
    }
    mes++;
  }
}

/** Clave única de una ocurrencia: id del evento + inicio original. */
export function claveOcurrencia(eventoId: string, inicioOriginalMs: number): string {
  return `${eventoId}_${inicioOriginalMs}`;
}

/** Inicios (ms) de las ocurrencias de un evento que empiezan dentro de [desde, hasta). */
export function iniciosEnRango(evento: Evento, desdeMs: number, hastaMs: number): number[] {
  if (!evento.recurrencia) {
    return evento.inicioMs < hastaMs && evento.finMs > desdeMs ? [evento.inicioMs] : [];
  }
  const duracion = evento.finMs - evento.inicioMs;
  const resultado: number[] = [];
  for (const fecha of generarInicios(
    evento.recurrencia,
    new Date(evento.inicioMs),
    desdeMs - duracion,
  )) {
    const ms = fecha.getTime();
    if (ms >= hastaMs) break;
    if (ms + duracion > desdeMs) resultado.push(ms);
  }
  return resultado;
}

/** Margen extra al expandir para encontrar ocurrencias que se movieron dentro del rango. */
const MARGEN_MOVIDAS = 31 * MS_DIA;

/**
 * Expande todos los eventos en las ocurrencias que se ven en el rango [desdeMs, hastaMs),
 * aplicando las excepciones. Devuelve la lista ordenada por inicio.
 */
export function expandirOcurrencias(
  eventos: Evento[],
  excepciones: ExcepcionEvento[],
  desdeMs: number,
  hastaMs: number,
): Ocurrencia[] {
  const porClave = new Map<string, ExcepcionEvento>();
  for (const ex of excepciones) porClave.set(claveOcurrencia(ex.eventoId, ex.inicioOriginalMs), ex);

  const resultado: Ocurrencia[] = [];
  for (const evento of eventos) {
    const duracion = evento.finMs - evento.inicioMs;
    const inicios = evento.recurrencia
      ? iniciosEnRango(evento, desdeMs - MARGEN_MOVIDAS, hastaMs + MARGEN_MOVIDAS)
      : iniciosEnRango(evento, desdeMs, hastaMs);

    for (const original of inicios) {
      const clave = claveOcurrencia(evento.id, original);
      const ex = evento.recurrencia ? (porClave.get(clave) ?? null) : null;
      if (ex?.cancelada) continue;
      const inicioMs = ex?.cambios.inicioMs ?? original;
      const finMs = ex?.cambios.finMs ?? inicioMs + duracion;
      if (!(inicioMs < hastaMs && finMs > desdeMs)) continue;
      resultado.push({
        clave,
        evento,
        inicioMs,
        finMs,
        inicioOriginalMs: original,
        titulo: ex?.cambios.titulo ?? evento.titulo,
        etiquetaId:
          ex?.cambios.etiquetaId !== undefined ? ex.cambios.etiquetaId : evento.etiquetaId,
        notas: ex?.cambios.notas ?? evento.notas,
        esRecurrente: !!evento.recurrencia,
        completado: evento.recurrencia ? !!ex?.completado : evento.completado,
        excepcion: ex,
      });
    }
  }
  return resultado.sort((a, b) => a.inicioMs - b.inicioMs || a.finMs - b.finMs);
}

/** Cuántas ocurrencias hay antes de un inicio dado (para cortar series con límite de veces). */
export function contarAntes(
  regla: ReglaRecurrencia,
  inicioMaestro: Date,
  antesDeMs: number,
): number {
  let n = 0;
  for (const f of generarInicios(regla, inicioMaestro)) {
    if (f.getTime() >= antesDeMs) break;
    n++;
  }
  return n;
}

/**
 * Para "editar este y los siguientes": devuelve la regla que debe quedar en la serie antigua
 * (terminando justo antes de la ocurrencia) y la regla de la serie nueva.
 * Si la ocurrencia es la primera, `antigua` es null (la serie entera pasa a la nueva).
 */
export function partirSerie(
  regla: ReglaRecurrencia,
  inicioMaestro: Date,
  inicioOcurrenciaMs: number,
): { antigua: ReglaRecurrencia | null; nueva: ReglaRecurrencia } {
  const antes = contarAntes(regla, inicioMaestro, inicioOcurrenciaMs);
  if (antes === 0) return { antigua: null, nueva: regla };
  const diaAnterior = claveDia(inicioOcurrenciaMs - MS_DIA);
  if (regla.fin.tipo === 'veces') {
    return {
      antigua: { ...regla, fin: { tipo: 'veces', veces: antes } },
      nueva: { ...regla, fin: { tipo: 'veces', veces: Math.max(1, regla.fin.veces - antes) } },
    };
  }
  return { antigua: { ...regla, fin: { tipo: 'fecha', hasta: diaAnterior } }, nueva: regla };
}

const ORDINALES: Record<number, string> = {
  1: 'primer',
  2: 'segundo',
  3: 'tercer',
  4: 'cuarto',
  [-1]: 'último',
};

/** Texto legible de una regla: "Cada 2 semanas los lunes y miércoles, 10 veces". */
export function describirRegla(regla: ReglaRecurrencia, inicio: Date): string {
  const n = Math.max(1, regla.intervalo);
  let texto: string;
  if (regla.frecuencia === 'diaria') {
    texto = n === 1 ? 'Cada día' : `Cada ${n} días`;
  } else if (regla.frecuencia === 'semanal' && n === 1 && new Set(regla.diasSemana).size === 7) {
    texto = 'Cada día';
  } else if (
    regla.frecuencia === 'semanal' &&
    n === 1 &&
    [...new Set(regla.diasSemana)].sort().join() === '1,2,3,4,5'
  ) {
    texto = 'De lunes a viernes';
  } else if (regla.frecuencia === 'semanal') {
    const dias = (regla.diasSemana?.length ? regla.diasSemana : [inicio.getDay()])
      .slice()
      .sort((a, b) => posicionLunes(a) - posicionLunes(b))
      .map((d) => DIAS_LARGOS[d]);
    const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}` : dias[0];
    texto = `${n === 1 ? 'Cada semana' : `Cada ${n} semanas`} los ${lista}`;
  } else {
    const base = n === 1 ? 'Cada mes' : `Cada ${n} meses`;
    const m = regla.mensual ?? { modo: 'diasMes' as const, dias: [inicio.getDate()] };
    if (m.modo === 'diasMes') {
      const dias = [...m.dias].sort((a, b) => a - b);
      texto = `${base} el día ${dias.length > 1 ? `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}` : dias[0]}`;
    } else {
      texto = `${base} el ${ORDINALES[m.ordinal]} ${DIAS_LARGOS[m.diaSemana]}`;
    }
  }
  if (regla.fin.tipo === 'fecha')
    texto += `, hasta el ${formatear(desdeClaveDia(regla.fin.hasta), "d 'de' MMMM 'de' yyyy")}`;
  if (regla.fin.tipo === 'veces')
    texto += `, ${regla.fin.veces} ${regla.fin.veces === 1 ? 'vez' : 'veces'}`;
  return texto;
}

/** ¿Cae una fecha concreta dentro de la regla? (útil para rutinas y tareas repetidas) */
export function caeEnDia(regla: ReglaRecurrencia, inicio: Date, dia: Date): boolean {
  const desde = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate()).getTime();
  for (const f of generarInicios(regla, inicio, desde)) {
    const ms = f.getTime();
    if (ms >= desde + MS_DIA) return false;
    if (ms >= desde) return true;
  }
  return false;
}
