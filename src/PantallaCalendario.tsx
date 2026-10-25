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
import { CalendarRange, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useUI, avisar, type VistaCalendario } from './almacenUI';
import { useDatos } from './almacenDatos';
import { useClavesConAviso, useOcurrencias } from './useCalendarioDatos';
import { useEsMovil } from './useMedia';
import { VistaTiempo, useAltoHora, type Previsualizacion } from './VistaTiempo';
import { VistaMes, diasDelMes } from './VistaMes';
import { VistaAgenda } from './VistaAgenda';
import { PanelArrastrables } from './PanelArrastrables';
import { marcarFinArrastre } from './BloqueCalendario';
import { Boton } from './Boton';
import { Segmentado } from './Campos';
import { IconoEtiqueta } from './IconoEtiqueta';
import { crearSesionDeEtiqueta, moverOcurrencia, planificarTareaEnCalendario } from './operaciones';
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
import type { Etiqueta, Ocurrencia, Tarea } from './tipos';

type DatosArrastre =
  | { tipo: 'bloque'; ocurrencia: Ocurrencia }
  | { tipo: 'etiqueta'; etiqueta: Etiqueta }
  | { tipo: 'tarea'; tarea: Tarea };

const PASO_MIN = 15;

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

function tituloVista(vista: VistaCalendario, fecha: Date, dias: Date[]): string {
  if (vista === 'dia') return capitalizar(formatear(fecha, "EEEE d 'de' MMMM"));
  if (vista === 'semana') {
    const [a, b] = [dias[0], dias[6]];
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
  const vista = useUI((s) => s.vista);
  const fechaMs = useUI((s) => s.fechaMs);
  const poner = useUI((s) => s.poner);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const duracionDefecto = useDatos((s) => s.ajustes.duracionPorDefectoMin);
  const etiquetasLista = useDatos((s) => s.etiquetas);
  const esMovil = useEsMovil();
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
  const ocurrencias = useOcurrencias(desde, hasta);
  const avisos = useClavesConAviso();
  const etiquetas = useMemo(() => new Map(etiquetasLista.map((e) => [e.id, e])), [etiquetasLista]);

  const mover = useCallback(
    (sentido: -1 | 1) => {
      const f = new Date(useUI.getState().fechaMs);
      const v = useUI.getState().vista;
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
    [poner],
  );

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
        : (d.tarea.estimacionMin ?? 30);

  const colorDe = (d: DatosArrastre): string =>
    d.tipo === 'bloque'
      ? (d.ocurrencia.evento.color ??
        etiquetas.get(d.ocurrencia.etiquetaId ?? '')?.color ??
        '#6D5CF0')
      : d.tipo === 'etiqueta'
        ? d.etiqueta.color
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
    } else {
      await planificarTareaEnCalendario(datos.tarea, inicio);
    }
  };

  const titulo = tituloVista(vista, fecha, dias);

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={alEmpezar}
      onDragMove={alMover}
      onDragEnd={alSoltar}
      onDragCancel={limpiar}
    >
      <div className={esMovil ? 'pb-16' : ''}>
        {/* Barra de herramientas */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1
            className="mr-auto min-w-0 truncate text-xl font-extrabold sm:text-2xl"
            aria-live="polite"
          >
            {titulo}
          </h1>
          <div className="flex items-center gap-1">
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
            <input
              type="date"
              className="campo h-10 w-[150px]"
              aria-label={t.calendario.irFecha}
              value={claveDia(fecha)}
              onChange={(e) =>
                e.target.value && poner({ fechaMs: desdeClaveDia(e.target.value).getTime() })
              }
            />
          </div>
          <Segmentado
            etiqueta="Vista"
            valor={vista}
            alCambiar={(v) => poner({ vista: v })}
            opciones={[
              { valor: 'dia', texto: t.calendario.dia },
              { valor: 'semana', texto: t.calendario.semana },
              { valor: 'mes', texto: t.calendario.mes },
              { valor: 'agenda', texto: t.calendario.agenda },
            ]}
            tamano="sm"
          />
          {!esMovil && (
            <Link
              to="/plantilla"
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-texto-suave hover:bg-superficie-2"
            >
              <CalendarRange size={16} aria-hidden /> {t.calendario.plantilla}
            </Link>
          )}
          <Boton
            variante="primario"
            icono={<Plus size={16} />}
            onClick={() => {
              const base =
                vista === 'agenda' || vista === 'mes' ? startOfDay(Date.now()) : startOfDay(fecha);
              const ahora = new Date();
              const hora = claveDia(base) === claveDia(ahora) ? ahora.getHours() + 1 : 9;
              abrirNuevo(base.getTime() + hora * 3_600_000, 0);
            }}
          >
            {!esMovil && t.calendario.nuevoBloque}
          </Boton>
        </div>

        <div className="flex gap-4">
          {!esMovil && <PanelArrastrables modo="lateral" />}
          <div className="min-w-0 flex-1">
            {(vista === 'dia' || vista === 'semana') && (
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
              <VistaMes
                fecha={fecha}
                ocurrencias={ocurrencias}
                etiquetas={etiquetas}
                avisos={avisos}
                alElegirDia={elegirDia}
                alCrear={abrirNuevo}
              />
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
