// Guardado de rutinas y su reflejo en el calendario.
// Si una rutina tiene hora y "mostrar en el calendario", se mantiene un evento recurrente
// de tipo "rutina" con la misma programación.

import { startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { eventos as dbEventos, rutinas as dbRutinas, type DatosNuevos } from './datos';
import { eventoVacio } from './operaciones';
import { reglaDeRutina, duracionRutinaMin } from './rutinas';
import { expandirCiclo, duracionTotal } from './ciclos';
import { conHora } from './fechas';
import { t } from './textos';
import type { Rutina } from './tipos';

/** Duración con la que se pinta la rutina en el calendario. */
function duracionEnCalendario(rutina: DatosNuevos<Rutina>): number {
  if (rutina.clase === 'estudio' && rutina.cicloId) {
    const ciclo = useDatos.getState().ciclos.find((c) => c.id === rutina.cicloId);
    if (ciclo) return Math.round(duracionTotal(expandirCiclo(ciclo)) / 60_000);
  }
  return duracionRutinaMin(rutina) || 30;
}

export async function guardarRutina(
  datos: DatosNuevos<Rutina>,
  previa: Rutina | null,
): Promise<Rutina | null> {
  try {
    const rutina = previa
      ? { ...previa, ...datos }
      : await dbRutinas.crear({ ...datos, eventoCalendarioId: null });
    const quiereEvento = datos.mostrarEnCalendario && !!datos.programacion.hora && !datos.archivada;
    let eventoId = previa?.eventoCalendarioId ?? null;
    const existe = eventoId ? useDatos.getState().eventos.some((e) => e.id === eventoId) : false;

    if (quiereEvento) {
      const inicio = conHora(
        startOfDay(previa?.creadoEnMs ?? Date.now()),
        datos.programacion.hora!,
      ).getTime();
      const campos = {
        tipo: 'rutina' as const,
        titulo: datos.nombre,
        rutinaId: rutina.id,
        etiquetaId: datos.etiquetaId,
        color: datos.color,
        inicioMs: inicio,
        finMs: inicio + duracionEnCalendario(datos) * 60_000,
        recurrencia: reglaDeRutina(datos),
      };
      if (eventoId && existe) await dbEventos.actualizar(eventoId, campos);
      else eventoId = (await dbEventos.crear(eventoVacio(campos))).id;
    } else if (eventoId && existe) {
      await dbEventos.borrar(eventoId, useDatos.getState().excepciones);
      eventoId = null;
    } else {
      eventoId = null;
    }

    await dbRutinas.actualizar(rutina.id, { ...datos, eventoCalendarioId: eventoId });
    return { ...rutina, eventoCalendarioId: eventoId } as Rutina;
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
    return null;
  }
}

export async function borrarRutina(rutina: Rutina): Promise<void> {
  if (
    rutina.eventoCalendarioId &&
    useDatos.getState().eventos.some((e) => e.id === rutina.eventoCalendarioId)
  ) {
    await dbEventos.borrar(rutina.eventoCalendarioId, useDatos.getState().excepciones);
  }
  await dbRutinas.borrar(rutina.id);
}
