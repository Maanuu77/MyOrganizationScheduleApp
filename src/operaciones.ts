// Operaciones de alto nivel del calendario y de las tareas.
// Aquí viven las reglas de producto: pedir confirmación al pisar un bloque protegido,
// preguntar "¿solo este / este y siguientes / todos?" en los eventos que se repiten, etc.

import { addDays, addMonths, startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { avisar, confirmar, useUI, type AlcanceCambio } from './almacenUI';
import {
  eventos as dbEventos,
  excepciones as dbExcepciones,
  tareas as dbTareas,
  type DatosNuevos,
} from './datos';
import { expandirOcurrencias, partirSerie } from './recurrencia';
import { protegidosQueChocan } from './avisosCarga';
import { claveDia, desdeClaveDia, inicioDeSemana, zonaDelDispositivo } from './fechas';
import { t } from './textos';
import type {
  Etiqueta,
  Evento,
  ExcepcionEvento,
  Ocurrencia,
  Planificacion,
  Tarea,
  TipoBloque,
} from './tipos';

// ---------------------------------------------------------------------------
// Bloques protegidos
// ---------------------------------------------------------------------------

/**
 * Comprueba si el intervalo pisa algún bloque protegido. Si es así pide confirmación.
 * Devuelve true si se puede continuar.
 */
export async function comprobarProtegidos(
  inicioMs: number,
  finMs: number,
  opciones: { ignorarEventoId?: string; tipo?: TipoBloque } = {},
): Promise<boolean> {
  if (opciones.tipo === 'protegido') return true; // un protegido puede ir encima de otro sin preguntar
  const { eventos, excepciones } = useDatos.getState();
  const ocurrencias = expandirOcurrencias(
    eventos,
    excepciones,
    inicioMs - 86_400_000,
    finMs + 86_400_000,
  );
  const choques = protegidosQueChocan(ocurrencias, inicioMs, finMs, opciones.ignorarEventoId);
  if (!choques.length) return true;
  const nombres = [...new Set(choques.map((c) => c.titulo))].join(', ');
  return confirmar({
    titulo: t.calendario.protegidoTitulo,
    mensaje: t.calendario.protegidoTexto(nombres),
    textoConfirmar: t.calendario.protegidoConfirmar,
  });
}

// ---------------------------------------------------------------------------
// Crear, mover, editar y borrar bloques
// ---------------------------------------------------------------------------

/** Valores por defecto de un evento nuevo. */
export function eventoVacio(
  parcial: Partial<DatosNuevos<Evento>> & { inicioMs: number; finMs: number },
): DatosNuevos<Evento> {
  const tipo = parcial.tipo ?? 'evento';
  return {
    tipo,
    titulo: parcial.titulo ?? t.bloque.tituloPorDefecto[tipo],
    todoElDia: false,
    zonaHoraria: zonaDelDispositivo(),
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
    ...parcial,
  };
}

/** Crea un bloque comprobando antes los bloques protegidos. */
export async function crearBloque(datos: DatosNuevos<Evento>): Promise<Evento | null> {
  if (
    !datos.todoElDia &&
    !(await comprobarProtegidos(datos.inicioMs, datos.finMs, { tipo: datos.tipo }))
  )
    return null;
  try {
    return await dbEventos.crear(datos);
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
    return null;
  }
}

/**
 * Crea una sesión de estudio a partir de una etiqueta (al soltarla en el calendario).
 * Usa la duración por defecto de la etiqueta y el primer ciclo guardado, si existe.
 */
export async function crearSesionDeEtiqueta(
  etiqueta: Etiqueta,
  inicioMs: number,
  duracionMin = etiqueta.duracionMin,
) {
  const ciclo =
    [...useDatos.getState().ciclos].sort((a, b) => a.creadoEnMs - b.creadoEnMs)[0] ?? null;
  return crearBloque(
    eventoVacio({
      tipo: 'sesion',
      titulo: etiqueta.nombre,
      etiquetaId: etiqueta.id,
      inicioMs,
      finMs: inicioMs + duracionMin * 60_000,
      cicloId: ciclo?.id ?? null,
    }),
  );
}

/** Campos que se pueden cambiar solo en una ocurrencia (van en la excepción). */
type CambiosOcurrencia = ExcepcionEvento['cambios'];
const CAMPOS_EXCEPCION: Array<keyof CambiosOcurrencia> = [
  'inicioMs',
  'finMs',
  'titulo',
  'notas',
  'etiquetaId',
];

/**
 * Aplica cambios a una ocurrencia. Si el evento se repite, pregunta el alcance
 * (salvo que ya venga decidido). Devuelve false si el usuario cancela.
 */
export async function cambiarOcurrencia(
  oc: Ocurrencia,
  cambios: Partial<DatosNuevos<Evento>>,
  alcanceDecidido?: AlcanceCambio,
): Promise<boolean> {
  const nuevoInicio = cambios.inicioMs ?? oc.inicioMs;
  const nuevoFin = cambios.finMs ?? oc.finMs;
  const cambiaHora = nuevoInicio !== oc.inicioMs || nuevoFin !== oc.finMs;
  if (cambiaHora && !(cambios.todoElDia ?? oc.evento.todoElDia)) {
    const ok = await comprobarProtegidos(nuevoInicio, nuevoFin, {
      ignorarEventoId: oc.evento.id,
      tipo: cambios.tipo ?? oc.evento.tipo,
    });
    if (!ok) return false;
  }

  const evento = oc.evento;
  try {
    if (!evento.recurrencia) {
      await dbEventos.actualizar(evento.id, cambios);
      return true;
    }

    // ¿Hay cambios que no caben en una excepción (tipo, regla de repetición…)?
    const soloCamposSimples = Object.keys(cambios).every((k) =>
      CAMPOS_EXCEPCION.includes(k as keyof CambiosOcurrencia),
    );
    const alcance =
      alcanceDecidido ?? (await useUI.getState().pedirAlcance({ permitirSolo: soloCamposSimples }));
    if (!alcance) return false;

    if (alcance === 'solo') {
      const previa = oc.excepcion;
      const nuevos: CambiosOcurrencia = { ...previa?.cambios };
      for (const campo of CAMPOS_EXCEPCION) {
        if (campo in cambios)
          (nuevos as Record<string, unknown>)[campo] = cambios[campo as keyof typeof cambios];
      }
      await dbExcepciones.guardar(
        {
          eventoId: evento.id,
          inicioOriginalMs: oc.inicioOriginalMs,
          cancelada: false,
          completado: previa?.completado ?? false,
          cambios: nuevos,
        },
        previa,
      );
      return true;
    }

    // Para "todos" movemos el maestro lo mismo que se ha movido esta ocurrencia
    const desplazamiento = nuevoInicio - oc.inicioMs;
    const duracion = nuevoFin - nuevoInicio;

    if (alcance === 'todos') {
      const inicioMaestro = evento.inicioMs + desplazamiento;
      await dbEventos.actualizar(evento.id, {
        ...cambios,
        inicioMs: inicioMaestro,
        finMs: inicioMaestro + duracion,
      });
      return true;
    }

    // "Este y los siguientes": cortamos la serie y creamos una nueva desde aquí
    const { antigua, nueva } = partirSerie(
      evento.recurrencia,
      new Date(evento.inicioMs),
      oc.inicioOriginalMs,
    );
    if (!antigua) {
      return cambiarOcurrencia(oc, cambios, 'todos');
    }
    const { id: _id, creadoEnMs: _c, actualizadoEnMs: _a, ...base } = evento;
    await dbEventos.actualizar(evento.id, { recurrencia: antigua });
    await dbEventos.crear({
      ...base,
      ...cambios,
      inicioMs: oc.inicioOriginalMs + desplazamiento,
      finMs: oc.inicioOriginalMs + desplazamiento + duracion,
      recurrencia: cambios.recurrencia !== undefined ? cambios.recurrencia : nueva,
    });
    return true;
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
    return false;
  }
}

/** Mueve o redimensiona una ocurrencia (arrastrar en el calendario). */
export function moverOcurrencia(oc: Ocurrencia, inicioMs: number, finMs: number): Promise<boolean> {
  if (inicioMs === oc.inicioMs && finMs === oc.finMs) return Promise.resolve(true);
  return cambiarOcurrencia(oc, { inicioMs, finMs });
}

/** Borra una ocurrencia preguntando el alcance si se repite. */
export async function borrarOcurrencia(oc: Ocurrencia): Promise<boolean> {
  const evento = oc.evento;
  const { excepciones } = useDatos.getState();
  try {
    if (!evento.recurrencia) {
      const ok = await confirmar({
        titulo: t.calendario.borrarTitulo,
        mensaje: `«${oc.titulo}»`,
        textoConfirmar: t.comun.borrar,
        peligro: true,
      });
      if (!ok) return false;
      await dbEventos.borrar(evento.id, excepciones);
      avisar(t.comun.borrado, 'info');
      return true;
    }
    const alcance = await useUI.getState().pedirAlcance();
    if (!alcance) return false;
    if (alcance === 'solo') {
      await dbExcepciones.guardar(
        {
          eventoId: evento.id,
          inicioOriginalMs: oc.inicioOriginalMs,
          cancelada: true,
          completado: false,
          cambios: oc.excepcion?.cambios ?? {},
        },
        oc.excepcion,
      );
    } else if (alcance === 'siguientes') {
      const { antigua } = partirSerie(
        evento.recurrencia,
        new Date(evento.inicioMs),
        oc.inicioOriginalMs,
      );
      if (antigua) await dbEventos.actualizar(evento.id, { recurrencia: antigua });
      else await dbEventos.borrar(evento.id, excepciones);
    } else {
      await dbEventos.borrar(evento.id, excepciones);
    }
    avisar(t.comun.borrado, 'info');
    return true;
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
    return false;
  }
}

/** Duplica una ocurrencia como bloque suelto justo después de la original. */
export async function duplicarOcurrencia(oc: Ocurrencia): Promise<Evento | null> {
  const { id: _id, creadoEnMs: _c, actualizadoEnMs: _a, ...base } = oc.evento;
  const duracion = oc.finMs - oc.inicioMs;
  return crearBloque({
    ...base,
    titulo: oc.titulo,
    notas: oc.notas,
    etiquetaId: oc.etiquetaId,
    inicioMs: oc.finMs,
    finMs: oc.finMs + duracion,
    recurrencia: null,
    completado: false,
    origenGoogle: null,
    plantillaId: null,
  });
}

/** Marca una ocurrencia como hecha o pendiente. Si tiene tarea vinculada, puede completarla. */
export async function alternarHecho(oc: Ocurrencia): Promise<void> {
  const hecho = !oc.completado;
  try {
    if (oc.evento.recurrencia) {
      await dbExcepciones.guardar(
        {
          eventoId: oc.evento.id,
          inicioOriginalMs: oc.inicioOriginalMs,
          cancelada: false,
          completado: hecho,
          cambios: oc.excepcion?.cambios ?? {},
        },
        oc.excepcion,
      );
    } else {
      await dbEventos.actualizar(oc.evento.id, { completado: hecho });
    }
    if (hecho && oc.evento.tareaId && oc.evento.completarTareaAlCompletar) {
      const tarea = useDatos.getState().tareas.find((x) => x.id === oc.evento.tareaId);
      if (tarea && !tarea.completada) await completarTarea(tarea, true);
    }
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
  }
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export function tareaVacia(parcial: Partial<DatosNuevos<Tarea>> = {}): DatosNuevos<Tarea> {
  return {
    titulo: '',
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
    orden: Date.now(),
    ...parcial,
  };
}

/** Siguiente fecha de una tarea que se repite. */
export function siguienteFecha(tarea: Tarea, desde: Date): string {
  const r = tarea.repeticion!;
  const n = Math.max(1, r.intervalo);
  if (r.frecuencia === 'diaria') return claveDia(addDays(desde, n));
  if (r.frecuencia === 'mensual') return claveDia(addMonths(desde, n));
  // Semanal: buscamos el siguiente día de la lista. Si para llegar a él hay que pasar
  // a la semana siguiente y se repite cada n semanas, saltamos n-1 semanas más.
  const dias = r.diasSemana?.length ? r.diasSemana : [desde.getDay()];
  const posicionLunes = (dia: number) => (dia + 6) % 7;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(desde, i);
    if (!dias.includes(d.getDay())) continue;
    const cambiaDeSemana = posicionLunes(d.getDay()) <= posicionLunes(desde.getDay());
    return claveDia(cambiaDeSemana ? addDays(d, (n - 1) * 7) : d);
  }
  return claveDia(addDays(desde, 7 * n));
}

/** Completa (o reabre) una tarea. Si se repite, crea la siguiente al completarla. */
export async function completarTarea(tarea: Tarea, hecha: boolean): Promise<void> {
  try {
    await dbTareas.actualizar(tarea.id, {
      completada: hecha,
      completadaEnMs: hecha ? Date.now() : null,
    });
    if (hecha) {
      const frases = t.logros.tareaHecha;
      avisar(frases[Math.floor(Math.random() * frases.length)], 'logro', {
        texto: t.comun.deshacer,
        ejecutar: () =>
          void dbTareas.actualizar(tarea.id, { completada: false, completadaEnMs: null }),
      });
    }
    if (hecha && tarea.repeticion) {
      const base =
        tarea.planificacion.tipo === 'dia'
          ? desdeClaveDia(tarea.planificacion.fecha)
          : startOfDay(new Date());
      const fecha = siguienteFecha(tarea, base);
      const { id: _id, creadoEnMs: _c, actualizadoEnMs: _a, ...resto } = tarea;
      const desplazamiento = desdeClaveDia(fecha).getTime() - base.getTime();
      await dbTareas.crear({
        ...resto,
        completada: false,
        completadaEnMs: null,
        planificacion: { tipo: 'dia', fecha },
        fechaLimiteMs: tarea.fechaLimiteMs !== null ? tarea.fechaLimiteMs + desplazamiento : null,
        subtareas: tarea.subtareas.map((s) => ({ ...s, hecha: false })),
      });
    }
  } catch (e) {
    console.error(e);
    avisar(t.comun.error, 'error');
  }
}

/** Planificación "hoy", "esta semana" o "sin fecha" a partir de un texto corto. */
export function planificacionDe(
  tipo: 'hoy' | 'semana' | 'sinFecha',
  inicioSemana: 0 | 1,
): Planificacion {
  if (tipo === 'hoy') return { tipo: 'dia', fecha: claveDia(new Date()) };
  if (tipo === 'semana')
    return { tipo: 'semana', semana: claveDia(inicioDeSemana(new Date(), inicioSemana)) };
  return { tipo: 'sinFecha' };
}

/** Crea un bloque vinculado a una tarea (al arrastrarla al calendario). */
export async function planificarTareaEnCalendario(
  tarea: Tarea,
  inicioMs: number,
): Promise<Evento | null> {
  const duracion = (tarea.estimacionMin ?? 30) * 60_000;
  const evento = await crearBloque(
    eventoVacio({
      tipo: 'sesion',
      titulo: tarea.titulo,
      inicioMs,
      finMs: inicioMs + duracion,
      etiquetaId: tarea.etiquetaId,
      tareaId: tarea.id,
      completarTareaAlCompletar: true,
    }),
  );
  if (evento && tarea.planificacion.tipo !== 'dia') {
    await dbTareas.actualizar(tarea.id, {
      planificacion: { tipo: 'dia', fecha: claveDia(inicioMs) },
    });
  }
  return evento;
}
