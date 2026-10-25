// Fábricas de datos para los tests (no se usan en la app).

import type { Ajustes, Evento, Ocurrencia, RegistroSesion, Tarea } from './tipos';
import { claveOcurrencia } from './recurrencia';
import { ajustesPorDefecto } from './ajustesPorDefecto';

export function eventoPrueba(parcial: Partial<Evento> = {}): Evento {
  return {
    id: 'e1',
    tipo: 'evento',
    titulo: 'Bloque',
    inicioMs: 0,
    finMs: 3_600_000,
    todoElDia: false,
    zonaHoraria: 'Europe/Madrid',
    etiquetaId: null,
    color: null,
    notas: '',
    recurrencia: null,
    cicloId: null,
    tareaId: null,
    completarTareaAlCompletar: false,
    rutinaId: null,
    completado: false,
    plantillaId: null,
    origenGoogle: null,
    creadoEnMs: 0,
    actualizadoEnMs: 0,
    ...parcial,
  };
}

/** Ocurrencia simple a partir de fecha y horas locales. */
export function ocurrenciaPrueba(
  id: string,
  inicio: Date,
  minutos: number,
  parcial: Partial<Evento> = {},
): Ocurrencia {
  const evento = eventoPrueba({
    id,
    inicioMs: inicio.getTime(),
    finMs: inicio.getTime() + minutos * 60000,
    titulo: id,
    ...parcial,
  });
  return {
    clave: claveOcurrencia(id, evento.inicioMs),
    evento,
    inicioMs: evento.inicioMs,
    finMs: evento.finMs,
    inicioOriginalMs: evento.inicioMs,
    titulo: evento.titulo,
    etiquetaId: evento.etiquetaId,
    notas: '',
    esRecurrente: false,
    completado: evento.completado,
    excepcion: null,
  };
}

export function tareaPrueba(parcial: Partial<Tarea> = {}): Tarea {
  return {
    id: 't1',
    titulo: 'Tarea',
    etiquetaId: null,
    prioridad: 'media',
    fechaLimiteMs: null,
    planificacion: { tipo: 'sinFecha' },
    estimacionMin: null,
    subtareas: [],
    notas: '',
    repeticion: null,
    completada: false,
    completadaEnMs: null,
    orden: 0,
    creadoEnMs: 0,
    actualizadoEnMs: 0,
    ...parcial,
  };
}

export function registroPrueba(
  inicio: Date,
  focoMin: number,
  parcial: Partial<RegistroSesion> = {},
): RegistroSesion {
  return {
    id: `r${inicio.getTime()}`,
    etiquetaId: null,
    tareaId: null,
    eventoId: null,
    inicioMs: inicio.getTime(),
    finMs: inicio.getTime() + focoMin * 60000,
    focoRealMs: focoMin * 60000,
    descansosMs: 0,
    interrupciones: 0,
    fasesCompletadas: 1,
    nota: '',
    valoracion: null,
    modo: 'ciclo',
    creadoEnMs: 0,
    actualizadoEnMs: 0,
    ...parcial,
  };
}

export function ajustesPrueba(parcial: Partial<Ajustes> = {}): Ajustes {
  return { ...ajustesPorDefecto('Europe/Madrid'), ...parcial };
}
