// Pantalla del calendario: vistas Día, Semana, Mes y Agenda, navegación rápida y
// arrastrar y soltar (etiquetas → sesiones, tareas → bloques vinculados, mover bloques).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { addDays, addMonths, addWeeks, startOfDay, startOfMonth } from 'date-fns';
import { useAnimate } from 'motion/react';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useUI, avisar, type VistaCalendario } from './almacenUI';
import { useDatos } from './almacenDatos';
import { useClavesConAviso, useOcurrencias } from './useCalendarioDatos';
import { useAnchoElemento, useEsMovil } from './useMedia';
import { VistaTiempo, useAltoHora, type Previsualizacion } from './VistaTiempo';
import { VistaMes, diasDelMes } from './VistaMes';
import { VistaAgenda } from './VistaAgenda';
import { TiraSemanal } from './TiraSemanal';
import { useDeslizar } from './useDeslizar';
import { PanelArrastrables } from './PanelArrastrables';
import { marcarFinArrastre } from './BloqueCalendario';
import { Boton } from './Boton';
import { Segmentado } from './Campos';
import { IconoEtiqueta } from './IconoEtiqueta';
import { crearSesionDeEtiqueta, moverOcurrencia, planificarTareaEnCalendario } from './operaciones';
import { colocarRutinaEnCalendario } from './operacionesRutinas';
import { duracionRutinaMin } from './rutinas';
import { expandirOcurrencias } from './recurrencia';
import { deboIgnorarTecla } from './useAtajos';
import {
  capitalizar,
  claveDia,
  desdeClaveDia,
  diasDeSemana,
  formatear,
  minutosDelDia,
} from './fechas';
import { t } from './textos';
import type { Etiqueta, Ocurrencia, Rutina, Tarea } from './tipos';

type DatosArrastre =
  | { tipo: 'bloque'; ocurrencia: Ocurrencia }
  | { tipo: 'etiqueta'; etiqueta: Etiqueta }
  | { tipo: 'rutina'; rutina: Rutina }
  | { tipo: 'tarea'; tarea: Tarea };

const PASO_MIN = 15;

/**
 * Ancho mínimo para que la semana se lea bien: la columna de horas más 7 días de 84 px.
 * Con menos sitio (pantalla dividida, paneles abiertos…) la semana se muestra como el día
 * con la tira semanal encima, igual que en el móvil.
 */
const ANCHO_MIN_SEMANA = 56 + 7 * 84;
/** Por debajo de este ancho la barra de herramientas se compacta y el panel lateral se pliega. */
const ANCHO_BARRA_COMPLETA = 1000;

/** Rango de fechas visible en cada vista. */
function rangoVista(
  vista: VistaCalendario,
  fecha: Date,
  inicioSemana: 0 | 1,
): { desde: number; hasta: number; dias: Date[] } {
  if (vista === 'dia') {
    const d = startOfDay(fecha);
    return { desde: d.getTime(), hasta: addDays(d, 1).getTime(), dias: [d] };
  }
  if (vista === 'semana') {
    const dias = diasDeSemana(fecha, inicioSemana);
    return { desde: dias[0].getTime(), hasta: addDays(dias[6], 1).getTime(), dias };
  }
  if (vista === 'mes') {
    const dias = diasDelMes(fecha, inicioSemana);
    return { desde: dias[0].getTime(), hasta: addDays(dias[41], 1).getTime(), dias };
  }
  const d = startOfDay(fecha);
  return { desde: d.getTime(), hasta: addDays(d, 30).getTime(), dias: [] };
}

/** En el móvil la semana no cabe: se muestra el día con la tira semanal encima. */
function vistaEfectiva(vista: VistaCalendario, esMovil: boolean): VistaCalendario {
  return esMovil && vista === 'semana' ? 'dia' : vista;
}

function tituloVista(vista: VistaCalendario, fecha: Date, dias: Date[], corto = false): string {
  if (vista === 'dia')
    return capitalizar(formatear(fecha, corto ? 'EEEE d MMM' : "EEEE d 'de' MMMM"));
  if (vista === 'semana') {
    const [a, b] = [dias[0], dias[6]];
    // Sin el año cuando hay poco sitio (el mes ya se sobreentiende)
    if (corto) return `${formatear(a, 'd MMM')} – ${formatear(b, 'd MMM')}`;
    return a.getMonth() === b.getMonth()
      ? `${formatear(a, 'd')} – ${formatear(b, "d 'de' MMMM yyyy")}`
      : `${formatear(a, 'd MMM')} – ${formatear(b, 'd MMM yyyy')}`;
  }
  if (vista === 'mes') return capitalizar(formatear(startOfMonth(fecha), 'MMMM yyyy'));
  return `${t.calendario.agenda} · ${formatear(fecha, 'd MMM')}`;
}

/** Coordenada Y del puntero a partir del evento que inició el arrastre. */
function yDelEvento(evento: Event | null): number {
  if (!evento) return 0;
  if ('touches' in evento) {
    const te = evento as TouchEvent;
    return (te.touches[0] ?? te.changedTouches[0])?.clientY ?? 0;
  }
  return (evento as MouseEvent).clientY;
}

export function PantallaSemana() {
  return <PantallaCalendario vistaInicial="semana" />;
}

export function PantallaCalendario({ vistaInicial }: { vistaInicial?: VistaCalendario }) {
  const vistaGuardada = useUI((s) => s.vista);
  const fechaMs = useUI((s) => s.fechaMs);
  const poner = useUI((s) => s.poner);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const duracionDefecto = useDatos((s) => s.ajustes.duracionPorDefectoMin);
  const etiquetasLista = useDatos((s) => s.etiquetas);
  const esMovil = useEsMovil();
  const vista = vistaEfectiva(vistaGuardada, esMovil);
  const diaMovil = esMovil && vista === 'dia';
  // En escritorio el diseño depende del sitio real que tiene el calendario, no de la ventana
  const [refPantalla, anchoPantalla] = useAnchoElemento<HTMLDivElement>();
  const [refVistas, anchoVistas] = useAnchoElemento<HTMLDivElement>();
  const barraCompacta = !esMovil && anchoPantalla > 0 && anchoPantalla < ANCHO_BARRA_COMPLETA;
  // null = automático (abierto si hay sitio); al pulsar el botón manda lo que elija el usuario
  const [panelElegido, setPanelElegido] = useState<boolean | null>(null);
  const panelAbierto = panelElegido ?? !barraCompacta;
  const semanaEstrecha =
    !esMovil && vista === 'semana' && anchoVistas > 0 && anchoVistas < ANCHO_MIN_SEMANA;
  // Día con la tira semanal encima: el día del móvil y la semana cuando no caben 7 columnas
  const conTira = diaMovil || semanaEstrecha;
  const altoHora = useAltoHora();
  const [parametros, setParametros] = useSearchParams();
  const [activo, setActivo] = useState<DatosArrastre | null>(null);
  const [previa, setPrevia] = useState<Previsualizacion | null>(null);
  const desplazamientoMin = useRef(0);
  // Posición vertical real del puntero durante el arrastre (más fiable que el "delta" de dnd-kit,
  // que no tiene en cuenta el desplazamiento interno de la rejilla)
  const punteroY = useRef(0);

  // Vista inicial (pantalla "Semana") y fecha que llega por la URL (desde una notificación)
  useEffect(() => {
    if (vistaInicial) poner({ vista: vistaInicial });
    const fecha = parametros.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      poner({ fechaMs: desdeClaveDia(fecha).getTime() });
      parametros.delete('fecha');
      setParametros(parametros, { replace: true });
    }
    // Solo al entrar en la pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fecha = useMemo(() => new Date(fechaMs), [fechaMs]);
  const { desde, hasta, dias } = useMemo(
    () => rangoVista(vista, fecha, inicioSemana),
    [vista, fecha, inicioSemana],
  );
  // En el día del móvil cargamos la semana entera para pintar los puntos de la tira
  const rangoCarga = useMemo(
    () => (diaMovil ? rangoVista('semana', fecha, inicioSemana) : { desde, hasta }),
    [diaMovil, fecha, inicioSemana, desde, hasta],
  );
  const ocurrencias = useOcurrencias(rangoCarga.desde, rangoCarga.hasta);
  // Con la tira semanal la rejilla muestra solo el día elegido
  const diaElegido = useMemo(() => [startOfDay(fecha)], [fecha]);
  const avisos = useClavesConAviso();
  const etiquetas = useMemo(() => new Map(etiquetasLista.map((e) => [e.id, e])), [etiquetasLista]);

  const mover = useCallback(
    (sentido: -1 | 1) => {
      const f = new Date(useUI.getState().fechaMs);
      const v = vistaEfectiva(useUI.getState().vista, esMovil);
      const nueva =
        v === 'dia'
          ? addDays(f, sentido)
          : v === 'semana'
            ? addWeeks(f, sentido)
            : v === 'mes'
              ? addMonths(f, sentido)
              : addDays(f, sentido * 30);
      poner({ fechaMs: nueva.getTime() });
    },
    [poner, esMovil],
  );

  // Móvil: deslizar sobre el día cambia de día, con un pequeño desplazamiento animado
  const [rejilla, animar] = useAnimate<HTMLDivElement>();
  const irADia = useCallback(
    (d: Date) => {
      const actual = startOfDay(useUI.getState().fechaMs).getTime();
      const nuevo = startOfDay(d).getTime();
      if (nuevo === actual) return;
      poner({ fechaMs: d.getTime() });
      if (rejilla.current)
        void animar(
          rejilla.current,
          { x: [nuevo > actual ? 40 : -40, 0], opacity: [0.4, 1] },
          { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        );
    },
    [poner, animar, rejilla],
  );
  const gestosDia = useDeslizar((sentido) => irADia(addDays(useUI.getState().fechaMs, sentido)));
  // En Mes y Agenda, deslizar avanza o retrocede un periodo
  const gestosPeriodo = useDeslizar(mover);

  // Atajos propios del calendario: flechas y D/S/M/A
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (deboIgnorarTecla(e)) return;
      if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === 'ArrowRight') mover(1);
      else {
        const mapa: Record<string, VistaCalendario> = {
          d: 'dia',
          s: 'semana',
          m: 'mes',
          a: 'agenda',
        };
        const v = mapa[e.key.toLowerCase()];
        if (v) poner({ vista: v });
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [mover, poner]);

  const abrirNuevo = useCallback(
    (inicioMs: number, finMs: number) => {
      const fin = finMs > inicioMs ? finMs : inicioMs + duracionDefecto * 60_000;
      poner({ editorBloque: { ocurrencia: null, borrador: { inicioMs, finMs: fin } } });
    },
    [duracionDefecto, poner],
  );

  const elegirDia = useCallback(
    (d: Date) => poner({ fechaMs: d.getTime(), vista: 'dia' }),
    [poner],
  );

  // ---------------------------------------------------------------------------
  // Arrastrar y soltar
  // ---------------------------------------------------------------------------
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // En táctil hay que mantener pulsado para arrastrar (así se puede seguir desplazando)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const pxPorMinuto = altoHora / 60;

  const duracionDe = (d: DatosArrastre): number =>
    d.tipo === 'bloque'
      ? Math.round((d.ocurrencia.finMs - d.ocurrencia.inicioMs) / 60_000)
      : d.tipo === 'etiqueta'
        ? d.etiqueta.duracionMin
        : d.tipo === 'rutina'
          ? duracionRutinaMin(d.rutina) || 30
          : (d.tarea.estimacionMin ?? 30);

  const colorDe = (d: DatosArrastre): string =>
    d.tipo === 'bloque'
      ? (d.ocurrencia.evento.color ??
        etiquetas.get(d.ocurrencia.etiquetaId ?? '')?.color ??
        '#6D5CF0')
      : d.tipo === 'etiqueta'
        ? d.etiqueta.color
        : d.tipo === 'rutina'
          ? d.rutina.color
          : (etiquetas.get(d.tarea.etiquetaId ?? '')?.color ?? '#6D5CF0');

  /** Minuto del día en que caería el elemento, según la posición del puntero en la columna. */
  const minutoDestino = (fechaColumna: string, y: number): number | null => {
    const columna = document.querySelector<HTMLElement>(`[data-columna="${fechaColumna}"]`);
    if (!columna) return null;
    const top = columna.getBoundingClientRect().top;
    const min = (y - top) / pxPorMinuto - desplazamientoMin.current;
    return Math.min(1440 - PASO_MIN, Math.max(0, Math.round(min / PASO_MIN) * PASO_MIN));
  };

  // Seguimos el puntero con ratón o dedo (solo guarda un número: es muy barato)
  useEffect(() => {
    const conRaton = (e: MouseEvent) => (punteroY.current = e.clientY);
    const conDedo = (e: TouchEvent) => {
      if (e.touches[0]) punteroY.current = e.touches[0].clientY;
    };
    // En fase de captura, para tener la posición antes de que dnd-kit procese el movimiento
    window.addEventListener('mousemove', conRaton, { passive: true, capture: true });
    window.addEventListener('touchmove', conDedo, { passive: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', conRaton, { capture: true });
      window.removeEventListener('touchmove', conDedo, { capture: true });
    };
  }, []);

  const alEmpezar = (e: DragStartEvent) => {
    const datos = e.active.data.current as DatosArrastre;
    setActivo(datos);
    document.body.classList.add('arrastrando');
    punteroY.current = yDelEvento(e.activatorEvent);
    desplazamientoMin.current = 0;
    if (datos.tipo === 'bloque') {
      // Guardamos a qué altura del bloque se ha agarrado para que no "salte"
      const inicial = e.active.rect.current.initial;
      if (inicial)
        desplazamientoMin.current = Math.max(
          0,
          (yDelEvento(e.activatorEvent) - inicial.top) / pxPorMinuto,
        );
    }
  };

  const alMover = (e: DragMoveEvent) => {
    const destino = e.over?.data.current as { fecha: string; conHoras: boolean } | undefined;
    const datos = e.active.data.current as DatosArrastre;
    if (!destino?.conHoras) {
      setPrevia(null);
      return;
    }
    const minuto = minutoDestino(destino.fecha, punteroY.current);
    if (minuto === null) return;
    setPrevia((p) =>
      p && p.fecha === destino.fecha && p.inicioMin === minuto
        ? p
        : {
            fecha: destino.fecha,
            inicioMin: minuto,
            duracionMin: duracionDe(datos),
            color: colorDe(datos),
          },
    );
  };

  const limpiar = () => {
    setActivo(null);
    setPrevia(null);
    document.body.classList.remove('arrastrando');
    marcarFinArrastre();
  };

  const alSoltar = async (e: DragEndEvent) => {
    const datos = e.active.data.current as DatosArrastre;
    const destino = e.over?.data.current as { fecha: string; conHoras: boolean } | undefined;
    const minutoPrevio = previa?.inicioMin;
    limpiar();
    if (!destino) return;
    const dia = desdeClaveDia(destino.fecha).getTime();
    let inicio: number;
    if (destino.conHoras) {
      const minuto = minutoDestino(destino.fecha, punteroY.current) ?? minutoPrevio ?? 540;
      inicio = dia + minuto * 60_000;
    } else {
      // En la vista mes se conserva la hora del bloque; lo nuevo va a las 9:00
      const minutos = datos.tipo === 'bloque' ? minutosDelDia(datos.ocurrencia.inicioMs) : 540;
      inicio = dia + minutos * 60_000;
    }
    const duracion = duracionDe(datos) * 60_000;

    if (datos.tipo === 'bloque') {
      await moverOcurrencia(datos.ocurrencia, inicio, inicio + duracion);
    } else if (datos.tipo === 'etiqueta') {
      const evento = await crearSesionDeEtiqueta(datos.etiqueta, inicio);
      if (evento) {
        // "Ajustable al soltar": ofrecemos abrir el editor de la sesión recién creada
        avisar(`${t.bloque.tipos.sesion}: ${evento.titulo}`, 'exito', {
          texto: t.comun.editar,
          ejecutar: () => {
            const [oc] = expandirOcurrencias([evento], [], evento.inicioMs, evento.finMs);
            if (oc) poner({ editorBloque: { ocurrencia: oc, borrador: null } });
          },
        });
      }
    } else if (datos.tipo === 'rutina') {
      await colocarRutinaEnCalendario(datos.rutina, inicio);
    } else {
      await planificarTareaEnCalendario(datos.tarea, inicio);
    }
  };

  const titulo = tituloVista(vista, fecha, dias, esMovil || barraCompacta);

  const nuevoBloque = () => {
    const base = vista === 'agenda' || vista === 'mes' ? startOfDay(Date.now()) : startOfDay(fecha);
    const ahora = new Date();
    const hora = claveDia(base) === claveDia(ahora) ? ahora.getHours() + 1 : 9;
    abrirNuevo(base.getTime() + hora * 3_600_000, 0);
  };

  const selectorVista = (
    <Segmentado
      etiqueta="Vista"
      valor={vista}
      alCambiar={(v) => poner({ vista: v })}
      opciones={[
        { valor: 'dia', texto: t.calendario.dia },
        // En el móvil la semana se sustituye por el día con la tira semanal
        ...(esMovil ? [] : [{ valor: 'semana' as const, texto: t.calendario.semana }]),
        { valor: 'mes', texto: t.calendario.mes },
        { valor: 'agenda', texto: t.calendario.agenda },
      ]}
      tamano="sm"
    />
  );

  // Título que abre el selector de fecha nativo (un campo de fecha invisible encima). Se usa
  // en el móvil y en la barra compacta, donde no hay sitio para el campo de fecha visible.
  const tituloConSelector = (
    <label className="relative mr-auto flex min-w-0 items-center gap-1 rounded-md">
      <h1 className="truncate text-xl font-extrabold" aria-live="polite">
        {titulo}
      </h1>
      <ChevronDown size={18} className="shrink-0 text-texto-tenue" aria-hidden />
      <input
        type="date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={t.calendario.irFecha}
        value={claveDia(fecha)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Algunos navegadores no lo permiten: se abre al tocar el campo igualmente
          }
        }}
        onChange={(e) => e.target.value && irADia(desdeClaveDia(e.target.value))}
      />
    </label>
  );

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={alEmpezar}
      onDragMove={alMover}
      onDragEnd={alSoltar}
      onDragCancel={limpiar}
    >
      <div ref={refPantalla} className={esMovil ? 'pb-16' : ''}>
        {/* Barra de herramientas del móvil: título que abre el selector de fecha, «Hoy» y «+»
            en una fila, y las vistas debajo */}
        {esMovil && (
          <div className="mb-3 space-y-2.5">
            <div className="flex items-center gap-2">
              {tituloConSelector}
              <Boton variante="secundario" tamano="sm" onClick={() => irADia(new Date())}>
                {t.calendario.irHoy}
              </Boton>
              <Boton
                variante="primario"
                tamano="icono"
                onClick={nuevoBloque}
                aria-label={t.calendario.nuevoBloque}
              >
                <Plus size={18} />
              </Boton>
            </div>
            {selectorVista}
          </div>
        )}

        {/* Barra de herramientas. Si el calendario tiene poco sitio se compacta en una fila:
            el título abre el selector de fecha y «Plantilla» y «Nuevo bloque» quedan en iconos */}
        {!esMovil && (
          <div
            className={`mb-4 flex items-center gap-2 ${barraCompacta ? 'flex-nowrap' : 'flex-wrap'}`}
          >
            {barraCompacta ? (
              tituloConSelector
            ) : (
              <h1
                className="mr-auto min-w-0 truncate text-xl font-extrabold sm:text-2xl"
                aria-live="polite"
              >
                {titulo}
              </h1>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <Boton
                variante="secundario"
                tamano="icono"
                onClick={() => mover(-1)}
                aria-label={t.comun.anterior}
              >
                <ChevronLeft size={18} />
              </Boton>
              <Boton variante="secundario" onClick={() => poner({ fechaMs: Date.now() })}>
                {t.calendario.irHoy}
              </Boton>
              <Boton
                variante="secundario"
                tamano="icono"
                onClick={() => mover(1)}
                aria-label={t.comun.siguiente}
              >
                <ChevronRight size={18} />
              </Boton>
              {!barraCompacta && (
                <input
                  type="date"
                  className="campo h-10 w-[150px]"
                  aria-label={t.calendario.irFecha}
                  value={claveDia(fecha)}
                  onChange={(e) =>
                    e.target.value && poner({ fechaMs: desdeClaveDia(e.target.value).getTime() })
                  }
                />
              )}
            </div>
            <div className="shrink-0">{selectorVista}</div>
            <Link
              to="/plantilla"
              className={`inline-flex h-10 items-center gap-2 rounded-md text-sm font-semibold text-texto-suave hover:bg-superficie-2 ${barraCompacta ? 'w-10 justify-center' : 'px-3'}`}
              aria-label={barraCompacta ? t.calendario.plantilla : undefined}
              title={barraCompacta ? t.calendario.plantilla : undefined}
            >
              <CalendarRange size={16} aria-hidden /> {!barraCompacta && t.calendario.plantilla}
            </Link>
            {barraCompacta ? (
              <Boton
                variante="primario"
                tamano="icono"
                onClick={nuevoBloque}
                aria-label={t.calendario.nuevoBloque}
                title={t.calendario.nuevoBloque}
              >
                <Plus size={18} />
              </Boton>
            ) : (
              <Boton variante="primario" icono={<Plus size={16} />} onClick={nuevoBloque}>
                {t.calendario.nuevoBloque}
              </Boton>
            )}
          </div>
        )}

        <div className="flex gap-4">
          {!esMovil && (
            <PanelArrastrables
              modo="lateral"
              plegado={!panelAbierto}
              alAlternar={() => setPanelElegido(!panelAbierto)}
            />
          )}
          <div ref={refVistas} className="min-w-0 flex-1">
            {conTira && (
              <>
                <TiraSemanal
                  fecha={fecha}
                  inicioSemana={inicioSemana}
                  ocurrencias={ocurrencias}
                  etiquetas={etiquetas}
                  alElegir={irADia}
                />
                <div ref={rejilla} {...gestosDia}>
                  <VistaTiempo
                    dias={diaElegido}
                    ocurrencias={ocurrencias}
                    etiquetas={etiquetas}
                    avisos={avisos}
                    previsualizacion={previa}
                    alCrear={abrirNuevo}
                    alElegirDia={elegirDia}
                    compacta
                  />
                </div>
              </>
            )}
            {!conTira && (vista === 'dia' || vista === 'semana') && (
              <VistaTiempo
                dias={dias}
                ocurrencias={ocurrencias}
                etiquetas={etiquetas}
                avisos={avisos}
                previsualizacion={previa}
                alCrear={abrirNuevo}
                alElegirDia={elegirDia}
              />
            )}
            {vista === 'mes' && (
              <div {...(esMovil ? gestosPeriodo : {})}>
                <VistaMes
                  fecha={fecha}
                  ocurrencias={ocurrencias}
                  etiquetas={etiquetas}
                  avisos={avisos}
                  alElegirDia={elegirDia}
                  alCrear={abrirNuevo}
                  compacta={esMovil}
                />
              </div>
            )}
            {vista === 'agenda' && (
              <VistaAgenda ocurrencias={ocurrencias} etiquetas={etiquetas} avisos={avisos} />
            )}
          </div>
        </div>
        {esMovil && <PanelArrastrables modo="hoja" />}
      </div>

      {/* Lo que se ve bajo el dedo/ratón mientras se arrastra (elevado, con sombra) */}
      <DragOverlay dropAnimation={null}>
        {activo && (
          <div
            className="flex max-w-56 rotate-2 items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold shadow-elevada"
            style={{
              background: `color-mix(in oklab, ${colorDe(activo)} 22%, var(--mos-superficie))`,
              borderColor: colorDe(activo),
              color: 'var(--mos-texto)',
              cursor: 'grabbing',
            }}
          >
            {activo.tipo === 'etiqueta' && (
              <IconoEtiqueta nombre={activo.etiqueta.icono} tamano={14} />
            )}
            <span className="truncate">
              {activo.tipo === 'bloque'
                ? activo.ocurrencia.titulo
                : activo.tipo === 'etiqueta'
                  ? activo.etiqueta.nombre
                  : activo.tipo === 'rutina'
                    ? activo.rutina.nombre
                    : activo.tarea.titulo}
            </span>
            <span className="ml-auto shrink-0 text-xs font-semibold opacity-70">
              {duracionDe(activo)}′
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
