// Panel con las etiquetas y tareas que se arrastran al calendario.
// En escritorio es una barra lateral; en móvil, una hoja inferior plegable.
// Alternativa sin arrastre: el botón de cada elemento abre "Crear sesión en…" / "Planificar en…".

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { CalendarPlus, ChevronUp, GripVertical, Plus, Tag } from 'lucide-react';
import { addHours, startOfHour } from 'date-fns';
import { buscarEtiqueta, etiquetasActivas, useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { IconoEtiqueta } from './IconoEtiqueta';
import { DialogoFechaHora } from './DialogoFechaHora';
import { crearSesionDeEtiqueta, planificarTareaEnCalendario } from './operaciones';
import { COLORES_PRIORIDAD, seccionarTareas } from './tareasLogica';
import { t } from './textos';
import type { Etiqueta, Tarea } from './tipos';

function ChipArrastrable({
  etiqueta,
  alElegirHora,
}: {
  etiqueta: Etiqueta;
  alElegirHora: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `etiqueta-${etiqueta.id}`,
    data: { tipo: 'etiqueta', etiqueta },
  });
  return (
    <div className={`flex items-center gap-1 ${isDragging ? 'opacity-40' : ''}`}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-roledescription="arrastrable"
        aria-label={`${etiqueta.nombre}, ${etiqueta.duracionMin} min`}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-semibold shadow-suave transition-all hover:-translate-y-0.5 hover:shadow-media active:cursor-grabbing"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${etiqueta.color} 20%, var(--mos-superficie)), var(--mos-superficie))`,
          borderColor: `color-mix(in oklab, ${etiqueta.color} 35%, transparent)`,
          touchAction: 'manipulation',
        }}
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-white"
          style={{ background: etiqueta.color }}
        >
          <IconoEtiqueta nombre={etiqueta.icono} tamano={13} />
        </span>
        <span className="truncate">{etiqueta.nombre}</span>
        <span className="ml-auto shrink-0 text-[11px] font-medium text-texto-tenue">
          {etiqueta.duracionMin}′
        </span>
      </div>
      <button
        type="button"
        onClick={alElegirHora}
        className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2 hover:text-acento"
        aria-label={`${t.calendario.crearSesionEn} ${etiqueta.nombre}`}
        title={t.calendario.crearSesionEn}
      >
        <CalendarPlus size={15} />
      </button>
    </div>
  );
}

function TareaArrastrable({
  tarea,
  color,
  alElegirHora,
}: {
  tarea: Tarea;
  color: string;
  alElegirHora: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    data: { tipo: 'tarea', tarea },
  });
  return (
    <div className={`flex items-center gap-1 ${isDragging ? 'opacity-40' : ''}`}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-roledescription="arrastrable"
        aria-label={tarea.titulo}
        title={t.tareas.arrastrarAyuda}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm shadow-suave hover:shadow-media"
        style={{
          borderLeft: `3px solid ${COLORES_PRIORIDAD[tarea.prioridad]}`,
          touchAction: 'manipulation',
        }}
      >
        <GripVertical size={14} className="shrink-0 text-texto-tenue" aria-hidden />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="truncate">{tarea.titulo}</span>
        {tarea.estimacionMin && (
          <span className="ml-auto shrink-0 text-[11px] text-texto-tenue">
            {tarea.estimacionMin}′
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={alElegirHora}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2 hover:text-acento"
        aria-label={`${t.calendario.planificarEn} ${tarea.titulo}`}
        title={t.calendario.planificarEn}
      >
        <CalendarPlus size={14} />
      </button>
    </div>
  );
}

export function PanelArrastrables({ modo }: { modo: 'lateral' | 'hoja' }) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const tareas = useDatos((s) => s.tareas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const [abierta, setAbierta] = useState(false);
  const [eligiendo, setEligiendo] = useState<{ etiqueta?: Etiqueta; tarea?: Tarea } | null>(null);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const pendientes = useMemo(() => {
    const s = seccionarTareas(tareas, new Date(), inicioSemana);
    return [...s.atrasadas, ...s.hoy, ...s.semana, ...s.sinFecha];
  }, [tareas, inicioSemana]);

  const contenido = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs text-texto-tenue">{t.calendario.panelEtiquetasAyuda}</p>
        {activas.length === 0 ? (
          <div className="rounded-md bg-superficie-2 p-3 text-center text-sm text-texto-suave">
            <Tag size={18} className="mx-auto mb-1 text-acento" aria-hidden />
            {t.calendario.sinEtiquetas}{' '}
            <Link to="/etiquetas" className="font-bold text-acento hover:underline">
              {t.calendario.crearEtiquetas}
            </Link>
          </div>
        ) : (
          <div className={modo === 'hoja' ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}>
            {activas.map((e) => (
              <ChipArrastrable
                key={e.id}
                etiqueta={e}
                alElegirHora={() => setEligiendo({ etiqueta: e })}
              />
            ))}
          </div>
        )}
      </div>
      {pendientes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
            {t.calendario.backlog}
          </p>
          <div className="space-y-1.5">
            {pendientes.slice(0, 30).map((x) => (
              <TareaArrastrable
                key={x.id}
                tarea={x}
                color={buscarEtiqueta(etiquetas, x.etiquetaId)?.color ?? 'var(--mos-borde-fuerte)'}
                alElegirHora={() => setEligiendo({ tarea: x })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const dialogo = (
    <DialogoFechaHora
      abierto={!!eligiendo}
      titulo={eligiendo?.tarea ? t.calendario.planificarEn : t.calendario.crearSesionEn}
      inicialMs={addHours(startOfHour(new Date()), 1).getTime()}
      alCerrar={() => setEligiendo(null)}
      alAceptar={async (inicio) => {
        const ok = eligiendo?.tarea
          ? await planificarTareaEnCalendario(eligiendo.tarea, inicio)
          : eligiendo?.etiqueta
            ? await crearSesionDeEtiqueta(eligiendo.etiqueta, inicio)
            : null;
        if (ok) {
          setEligiendo(null);
          avisar(t.comun.guardado, 'exito');
        }
      }}
    />
  );

  if (modo === 'lateral') {
    return (
      <aside
        className="tarjeta-plana desplazable sticky top-6 max-h-[calc(100dvh-160px)] w-60 shrink-0 overflow-y-auto p-3"
        aria-label={t.calendario.panelEtiquetas}
      >
        <h2 className="mb-2 text-sm font-extrabold">{t.calendario.panelEtiquetas}</h2>
        {contenido}
        {dialogo}
      </aside>
    );
  }

  // Hoja inferior en móvil: no es modal para poder arrastrar hacia el calendario que hay detrás
  return (
    <>
      <motion.div
        className="fixed inset-x-0 bottom-[60px] z-30 rounded-t-xl border-t border-borde bg-superficie/95 shadow-elevada backdrop-blur"
        animate={{ height: abierta ? '46dvh' : 56 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold"
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
        >
          <Plus size={16} className="text-acento" aria-hidden />
          {t.calendario.abrirPanel}
          <ChevronUp
            size={18}
            className={`ml-auto transition-transform ${abierta ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {abierta && (
          <div className="desplazable h-[calc(46dvh-52px)] overflow-y-auto px-4 pb-4">
            {contenido}
          </div>
        )}
      </motion.div>
      {dialogo}
    </>
  );
}
