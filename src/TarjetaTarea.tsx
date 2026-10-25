// Fila/tarjeta de una tarea: casilla con check animado, título, etiqueta, prioridad y fechas.
import { memo } from 'react';
import { motion } from 'motion/react';
import { AlarmClock, CalendarDays, ListChecks, Repeat, Timer } from 'lucide-react';
import { differenceInHours, isPast } from 'date-fns';
import type { Etiqueta, Tarea } from './tipos';
import { CheckAnimado } from './CheckAnimado';
import { ChipEtiqueta } from './ChipEtiqueta';
import { COLORES_PRIORIDAD } from './tareasLogica';
import { completarTarea } from './operaciones';
import { useUI } from './almacenUI';
import { desdeClaveDia, diaRelativo, formatear } from './fechas';
import { t } from './textos';

interface Props {
  tarea: Tarea;
  etiqueta: Etiqueta | null;
  compacta?: boolean;
  mostrarPlan?: boolean;
}

export const TarjetaTarea = memo(function TarjetaTarea({
  tarea,
  etiqueta,
  compacta,
  mostrarPlan,
}: Props) {
  const poner = useUI((s) => s.poner);
  const hechas = tarea.subtareas.filter((s) => s.hecha).length;
  const vencida = tarea.fechaLimiteMs !== null && !tarea.completada && isPast(tarea.fechaLimiteMs);
  const pronto =
    tarea.fechaLimiteMs !== null &&
    !vencida &&
    differenceInHours(tarea.fechaLimiteMs, Date.now()) < 24;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: tarea.completada ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
      className={`group flex items-start gap-3 rounded-md border border-borde bg-superficie transition-shadow hover:shadow-media ${
        compacta ? 'px-3 py-2' : 'px-3.5 py-3'
      }`}
      style={{ borderLeft: `3px solid ${COLORES_PRIORIDAD[tarea.prioridad]}` }}
    >
      <div className="pt-0.5">
        <CheckAnimado
          hecho={tarea.completada}
          alCambiar={() => completarTarea(tarea, !tarea.completada)}
          color={etiqueta?.color ?? 'var(--mos-acento)'}
          etiqueta={`${tarea.completada ? 'Reabrir' : 'Completar'}: ${tarea.titulo}`}
          tamano={compacta ? 20 : 22}
        />
      </div>
      <button
        type="button"
        onClick={() => poner({ editorTarea: { tarea } })}
        className="min-w-0 flex-1 text-left"
        aria-label={`${t.comun.editar}: ${tarea.titulo}`}
      >
        <p
          className={`text-sm font-semibold text-texto ${tarea.completada ? 'line-through decoration-2' : ''}`}
        >
          {tarea.titulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-texto-suave">
          {etiqueta && <ChipEtiqueta etiqueta={etiqueta} pequeno />}
          {(tarea.prioridad === 'alta' || tarea.prioridad === 'urgente') && (
            <span className="font-bold" style={{ color: COLORES_PRIORIDAD[tarea.prioridad] }}>
              {t.tareas.prioridades[tarea.prioridad]}
            </span>
          )}
          {tarea.fechaLimiteMs !== null && (
            <span
              className={`flex items-center gap-1 font-semibold ${vencida ? 'text-peligro' : pronto ? 'text-aviso' : ''}`}
            >
              <AlarmClock size={12} aria-hidden />
              {vencida
                ? t.tareas.vencida
                : t.tareas.vence(
                    `${diaRelativo(tarea.fechaLimiteMs).toLowerCase()} ${formatear(tarea.fechaLimiteMs, 'HH:mm')}`,
                  )}
            </span>
          )}
          {mostrarPlan && tarea.planificacion.tipo === 'dia' && (
            <span className="flex items-center gap-1">
              <CalendarDays size={12} aria-hidden />
              {diaRelativo(desdeClaveDia(tarea.planificacion.fecha))}
            </span>
          )}
          {tarea.estimacionMin && (
            <span className="flex items-center gap-1">
              <Timer size={12} aria-hidden />
              {tarea.estimacionMin} min
            </span>
          )}
          {tarea.subtareas.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} aria-hidden />
              {hechas}/{tarea.subtareas.length}
            </span>
          )}
          {tarea.repeticion && <Repeat size={12} aria-label={t.tareas.repetir} />}
        </div>
      </button>
    </motion.div>
  );
});
