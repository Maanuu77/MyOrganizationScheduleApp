// Detección de sobrecarga y conflictos. Solo avisa: nunca bloquea ni mueve nada.
// Funciones puras para poder probarlas.

import { addDays, startOfDay } from 'date-fns';
import type { Ajustes, AvisoCarga, Ocurrencia, Tarea } from './tipos';
import {
  MS_DIA,
  MS_HORA,
  MS_MINUTO,
  claveDia,
  duracionTexto,
  formatear,
  seSolapan,
  tramosSueno,
} from './fechas';

type AjustesAvisos = Pick<Ajustes, 'umbrales' | 'sueno'>;

/** Bloques que cuentan para los conflictos (los de todo el día no tienen hora concreta). */
function conHora(ocurrencias: Ocurrencia[]): Ocurrencia[] {
  return ocurrencias.filter((o) => !o.evento.todoElDia);
}

export function detectarSolapes(ocurrencias: Ocurrencia[]): AvisoCarga[] {
  const lista = conHora(ocurrencias)
    .slice()
    .sort((a, b) => a.inicioMs - b.inicioMs);
  const avisos: AvisoCarga[] = [];
  const activas: Ocurrencia[] = [];
  for (const o of lista) {
    // Quitamos las que ya terminaron antes de que empiece esta
    for (let i = activas.length - 1; i >= 0; i--) {
      if (activas[i].finMs <= o.inicioMs) activas.splice(i, 1);
    }
    for (const a of activas) {
      if (!seSolapan(a.inicioMs, a.finMs, o.inicioMs, o.finMs)) continue;
      const hayProtegido = a.evento.tipo === 'protegido' || o.evento.tipo === 'protegido';
      // Dos bloques protegidos que se tocan no son un problema real para el usuario
      if (a.evento.tipo === 'protegido' && o.evento.tipo === 'protegido') continue;
      avisos.push({
        id: `solape_${a.clave}_${o.clave}`,
        tipo: 'solape',
        severidad: hayProtegido ? 'grave' : 'aviso',
        titulo: hayProtegido ? 'Bloque encima de un tiempo protegido' : 'Bloques solapados',
        detalle: `«${a.titulo}» y «${o.titulo}» coinciden el ${formatear(o.inicioMs, "EEEE d 'a las' HH:mm")}.`,
        fecha: claveDia(o.inicioMs),
        claves: [a.clave, o.clave],
      });
    }
    activas.push(o);
  }
  return avisos;
}

/** Agrupa las sesiones de estudio por día. */
function sesionesPorDia(ocurrencias: Ocurrencia[]): Map<string, Ocurrencia[]> {
  const mapa = new Map<string, Ocurrencia[]>();
  for (const o of conHora(ocurrencias)) {
    if (o.evento.tipo !== 'sesion') continue;
    const clave = claveDia(o.inicioMs);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave)!.push(o);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.inicioMs - b.inicioMs);
  return mapa;
}

export function detectarFocoExcesivo(
  ocurrencias: Ocurrencia[],
  ajustes: AjustesAvisos,
): AvisoCarga[] {
  const umbral = ajustes.umbrales.focoDiarioMaxHoras * MS_HORA;
  const avisos: AvisoCarga[] = [];
  for (const [dia, sesiones] of sesionesPorDia(ocurrencias)) {
    const total = sesiones.reduce((s, o) => s + (o.finMs - o.inicioMs), 0);
    if (total > umbral) {
      avisos.push({
        id: `foco_${dia}`,
        tipo: 'focoExcesivo',
        severidad: 'aviso',
        titulo: 'Demasiado foco en un día',
        detalle: `Tienes ${duracionTexto(total)} de sesiones planificadas (tu límite es ${ajustes.umbrales.focoDiarioMaxHoras} h).`,
        fecha: dia,
        claves: sesiones.map((o) => o.clave),
      });
    }
  }
  return avisos;
}

export function detectarSesionesSeguidas(
  ocurrencias: Ocurrencia[],
  ajustes: AjustesAvisos,
): AvisoCarga[] {
  const maximo = ajustes.umbrales.sesionesSeguidasMax;
  const hueco = ajustes.umbrales.descansoMinimoMin * MS_MINUTO;
  const avisos: AvisoCarga[] = [];
  for (const [dia, sesiones] of sesionesPorDia(ocurrencias)) {
    let cadena: Ocurrencia[] = [];
    const cerrar = () => {
      if (cadena.length > maximo) {
        avisos.push({
          id: `seguidas_${cadena[0].clave}`,
          tipo: 'sesionesSeguidas',
          severidad: 'aviso',
          titulo: 'Muchas sesiones sin descanso',
          detalle: `${cadena.length} sesiones seguidas desde las ${formatear(cadena[0].inicioMs, 'HH:mm')} sin un descanso de al menos ${ajustes.umbrales.descansoMinimoMin} min.`,
          fecha: dia,
          claves: cadena.map((o) => o.clave),
        });
      }
    };
    for (const o of sesiones) {
      const ultima = cadena.at(-1);
      if (ultima && o.inicioMs - ultima.finMs < hueco) {
        cadena.push(o);
      } else {
        cerrar();
        cadena = [o];
      }
    }
    cerrar();
  }
  return avisos;
}

export function detectarFechasLimite(
  tareas: Tarea[],
  ocurrencias: Ocurrencia[],
  ajustes: AjustesAvisos,
  ahoraMs: number,
): AvisoCarga[] {
  const horizonte = ahoraMs + ajustes.umbrales.diasAvisoFechaLimite * MS_DIA;
  const avisos: AvisoCarga[] = [];
  for (const t of tareas) {
    if (t.completada || t.fechaLimiteMs === null || t.fechaLimiteMs > horizonte) continue;
    const planificado = ocurrencias
      .filter(
        (o) => o.evento.tareaId === t.id && o.finMs > ahoraMs && o.inicioMs < t.fechaLimiteMs!,
      )
      .reduce((s, o) => s + (o.finMs - o.inicioMs), 0);
    const necesario = (t.estimacionMin ?? 0) * MS_MINUTO;
    const vencida = t.fechaLimiteMs < ahoraMs;
    if (vencida) {
      avisos.push({
        id: `limite_${t.id}`,
        tipo: 'fechaLimiteSinTiempo',
        severidad: 'grave',
        titulo: 'Fecha límite superada',
        detalle: `«${t.titulo}» venció el ${formatear(t.fechaLimiteMs, "d 'de' MMMM 'a las' HH:mm")}.`,
        fecha: claveDia(t.fechaLimiteMs),
        claves: [],
        tareaId: t.id,
      });
    } else if (necesario > 0 ? planificado < necesario : planificado === 0) {
      avisos.push({
        id: `limite_${t.id}`,
        tipo: 'fechaLimiteSinTiempo',
        severidad: 'aviso',
        titulo: 'Fecha límite sin tiempo suficiente',
        detalle:
          necesario > 0
            ? `«${t.titulo}» necesita ${duracionTexto(necesario)} y solo hay ${duracionTexto(planificado)} planificados antes del ${formatear(t.fechaLimiteMs, "d 'de' MMMM")}.`
            : `«${t.titulo}» vence el ${formatear(t.fechaLimiteMs, "d 'de' MMMM")} y no tiene tiempo reservado en el calendario.`,
        fecha: claveDia(t.fechaLimiteMs),
        claves: [],
        tareaId: t.id,
      });
    }
  }
  return avisos;
}

export function detectarSueno(ocurrencias: Ocurrencia[], ajustes: AjustesAvisos): AvisoCarga[] {
  if (!ajustes.sueno.activo) return [];
  const avisos: AvisoCarga[] = [];
  for (const o of conHora(ocurrencias)) {
    if (o.evento.tipo === 'protegido') continue;
    // Revisamos el día en que empieza y el siguiente (por si el bloque cruza la medianoche)
    const dias = [startOfDay(o.inicioMs), addDays(startOfDay(o.inicioMs), 1)];
    const choca = dias.some((d) =>
      tramosSueno(d, ajustes.sueno.inicio, ajustes.sueno.fin).some(([a, b]) =>
        seSolapan(a, b, o.inicioMs, o.finMs),
      ),
    );
    if (choca) {
      avisos.push({
        id: `sueno_${o.clave}`,
        tipo: 'sueno',
        severidad: 'aviso',
        titulo: 'Bloque en tu horario de sueño',
        detalle: `«${o.titulo}» (${formatear(o.inicioMs, 'EEEE d, HH:mm')}) invade tu descanso de ${ajustes.sueno.inicio} a ${ajustes.sueno.fin}.`,
        fecha: claveDia(o.inicioMs),
        claves: [o.clave],
      });
    }
  }
  return avisos;
}

/** Ejecuta todas las comprobaciones y devuelve los avisos ordenados por fecha y gravedad. */
export function detectarAvisos(
  ocurrencias: Ocurrencia[],
  tareas: Tarea[],
  ajustes: AjustesAvisos,
  ahoraMs: number,
): AvisoCarga[] {
  const peso = { grave: 0, aviso: 1, info: 2 } as const;
  return [
    ...detectarSolapes(ocurrencias),
    ...detectarFocoExcesivo(ocurrencias, ajustes),
    ...detectarSesionesSeguidas(ocurrencias, ajustes),
    ...detectarFechasLimite(tareas, ocurrencias, ajustes, ahoraMs),
    ...detectarSueno(ocurrencias, ajustes),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || peso[a.severidad] - peso[b.severidad]);
}

/** Ocurrencias protegidas que chocan con un intervalo (para pedir confirmación). */
export function protegidosQueChocan(
  ocurrencias: Ocurrencia[],
  inicioMs: number,
  finMs: number,
  ignorarEventoId?: string,
): Ocurrencia[] {
  return ocurrencias.filter(
    (o) =>
      o.evento.tipo === 'protegido' &&
      o.evento.id !== ignorarEventoId &&
      !o.evento.todoElDia &&
      seSolapan(o.inicioMs, o.finMs, inicioMs, finMs),
  );
}
