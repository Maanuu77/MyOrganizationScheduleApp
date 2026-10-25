// Lógica pura de tareas: colores de prioridad, secciones (Hoy, Esta semana, Sin fecha…) y orden.
import type { Prioridad, Tarea } from './tipos';
import { claveDia, inicioDeSemana } from './fechas';

export const COLORES_PRIORIDAD: Record<Prioridad, string> = {
  baja: '#64748B',
  media: '#2F6FD6',
  alta: '#E8A317',
  urgente: '#E5484D',
};

const PESO_PRIORIDAD: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };

export type OrdenTareas = 'prioridad' | 'fechaLimite' | 'creacion' | 'manual';

export function ordenarTareas(lista: Tarea[], orden: OrdenTareas): Tarea[] {
  const copia = [...lista];
  switch (orden) {
    case 'prioridad':
      return copia.sort(
        (a, b) =>
          PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad] ||
          (a.fechaLimiteMs ?? Infinity) - (b.fechaLimiteMs ?? Infinity),
      );
    case 'fechaLimite':
      return copia.sort(
        (a, b) =>
          (a.fechaLimiteMs ?? Infinity) - (b.fechaLimiteMs ?? Infinity) ||
          PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad],
      );
    case 'creacion':
      return copia.sort((a, b) => b.creadoEnMs - a.creadoEnMs);
    default:
      return copia.sort((a, b) => a.orden - b.orden);
  }
}

export interface SeccionesTareas {
  atrasadas: Tarea[];
  hoy: Tarea[];
  semana: Tarea[];
  proximas: Tarea[];
  sinFecha: Tarea[];
  completadas: Tarea[];
}

/** Reparte las tareas en secciones según su planificación. */
export function seccionarTareas(tareas: Tarea[], hoy: Date, inicioSemana: 0 | 1): SeccionesTareas {
  const claveHoy = claveDia(hoy);
  const semanaActual = claveDia(inicioDeSemana(hoy, inicioSemana));
  const s: SeccionesTareas = {
    atrasadas: [],
    hoy: [],
    semana: [],
    proximas: [],
    sinFecha: [],
    completadas: [],
  };
  for (const tarea of tareas) {
    if (tarea.completada) {
      s.completadas.push(tarea);
      continue;
    }
    const p = tarea.planificacion;
    if (p.tipo === 'dia') {
      if (p.fecha < claveHoy) s.atrasadas.push(tarea);
      else if (p.fecha === claveHoy) s.hoy.push(tarea);
      else s.proximas.push(tarea);
    } else if (p.tipo === 'semana') {
      // Si era de una semana pasada, sigue en "Esta semana" para no perderla
      if (p.semana <= semanaActual) s.semana.push(tarea);
      else s.proximas.push(tarea);
    } else {
      s.sinFecha.push(tarea);
    }
  }
  s.completadas.sort((a, b) => (b.completadaEnMs ?? 0) - (a.completadaEnMs ?? 0));
  return s;
}
