// Operaciones de rutinas: guardarlas (con su reflejo en el calendario), empezarlas en el
// contador y colocarlas en el calendario un día concreto.
// Si una rutina tiene días, hora y "mostrar en el calendario", se mantiene un evento
// recurrente de tipo "rutina" con la misma programación.

import { startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import {
  COLECCIONES,
  eventos as dbEventos,
  reemplazar,
  rutinas as dbRutinas,
  type DatosNuevos,
} from './datos';
import { crearBloque, eventoVacio } from './operaciones';
import { duracionRutinaMin, fasesDeRutina, reglaDeRutina } from './rutinas';
import { iniciarSesion } from './temporizador';
import { conHora } from './fechas';
import { t } from './textos';
import type { Evento, Rutina } from './tipos';

export async function guardarRutina(
  datos: DatosNuevos<Rutina>,
  previa: Rutina | null,
): Promise<Rutina | null> {
  try {
    const rutina = previa
      ? { ...previa, ...datos }
      : await dbRutinas.crear({ ...datos, eventoCalendarioId: null });
    const regla = reglaDeRutina(datos);
    const quiereEvento =
      datos.mostrarEnCalendario && !!datos.programacion.hora && !!regla && !datos.archivada;
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
        color: datos.color,
        inicioMs: inicio,
        finMs: inicio + (duracionRutinaMin(datos) || 30) * 60_000,
        recurrencia: regla,
      };
      if (eventoId && existe) await dbEventos.actualizar(eventoId, campos);
      else eventoId = (await dbEventos.crear(eventoVacio(campos))).id;
    } else if (eventoId && existe) {
      await dbEventos.borrar(eventoId, useDatos.getState().excepciones);
      eventoId = null;
    } else {
      eventoId = null;
    }

    // Se reemplaza el documento entero: así una rutina con el formato antiguo queda
    // guardada solo con los campos nuevos (las reglas de Firestore no admiten los viejos)
    const final = { ...rutina, ...datos, eventoCalendarioId: eventoId } as Rutina;
    await reemplazar<Rutina>(COLECCIONES.rutinas, final);
    return final;
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

/**
 * Empieza la rutina en el contador: cada paso es una fase con su nombre y su etiqueta, con
 * los descansos entre medias. Devuelve false si el contador ya estaba ocupado.
 */
export async function empezarRutina(
  rutina: Rutina,
  eventoId: string | null = null,
): Promise<boolean> {
  if (!rutina.pasos.length) {
    avisar(t.rutinas.sinPasos, 'error');
    return false;
  }
  const { contador, etiquetas } = useDatos.getState();
  if (contador && contador.estado !== 'inactivo') {
    avisar(t.rutinas.contadorOcupado, 'error');
    return false;
  }
  await iniciarSesion({
    modo: 'ciclo',
    fases: fasesDeRutina(rutina, etiquetas),
    etiquetaId: rutina.pasos[0].etiquetaId,
    tareaId: null,
    eventoId,
    cicloId: null,
    rutinaId: rutina.id,
  });
  return true;
}

/** Coloca la rutina en el calendario a una hora concreta (al soltarla o elegir hora). */
export function colocarRutinaEnCalendario(
  rutina: Rutina,
  inicioMs: number,
): Promise<Evento | null> {
  return crearBloque(
    eventoVacio({
      tipo: 'rutina',
      titulo: rutina.nombre,
      rutinaId: rutina.id,
      color: rutina.color,
      inicioMs,
      finMs: inicioMs + (duracionRutinaMin(rutina) || 30) * 60_000,
    }),
  );
}
