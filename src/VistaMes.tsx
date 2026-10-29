// Vista Mes: 6 semanas con hasta 3 bloques por día. Los días aceptan bloques, etiquetas y tareas soltados.
// El detalle depende del ancho real de cada celda (no de la ventana): con sitio se ve la hora y
// el título; más estrecho, solo el título; y si ni el título cabe (móvil, pantalla dividida),
// cada día muestra puntos de color y al tocarlo se abre ese día.
import { memo, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { addDays, isSameMonth, isToday, startOfDay, startOfMonth } from 'date-fns';
import { TriangleAlert } from 'lucide-react';
import type { AvisoCarga, Etiqueta, Ocurrencia } from './tipos';
import {
  claveDia,
  formatear,
  formatearHora,
  inicioDeSemana,
  ordenDias,
  DIAS_CORTOS,
} from './fechas';
import { useUI } from './almacenUI';
import { useDatos } from './almacenDatos';
import { acabaDeArrastrar } from './BloqueCalendario';
import { useAnchoElemento } from './useMedia';
import { t } from './textos';

/** Los 42 días que se ven en la cuadrícula del mes. */
export function diasDelMes(fecha: Date, inicioSemana: 0 | 1): Date[] {
  const inicio = inicioDeSemana(startOfMonth(fecha), inicioSemana);
  return Array.from({ length: 42 }, (_, i) => addDays(inicio, i));
}

interface Props {
  fecha: Date;
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  avisos: Map<string, AvisoCarga[]>;
  alElegirDia: (dia: Date) => void;
  alCrear: (inicioMs: number, finMs: number) => void;
  /** Móvil: puntos de color en lugar de los títulos de los bloques, quepan o no. */
  compacta?: boolean;
}

/** Puntos que caben en una celda del mes en el móvil. */
const MAX_PUNTOS = 4;

/** Cuánto se enseña de cada bloque según el ancho de la celda. */
type Detalle = 'completo' | 'titulos' | 'puntos';
/** Ancho de celda (px) a partir del cual cabe la hora junto al título. */
const CELDA_CON_HORA = 120;
/** Ancho de celda (px) por debajo del cual ni el título se lee: se pasan a puntos. */
const CELDA_CON_TITULO = 76;

function detalleSegunAncho(anchoMes: number, compacta: boolean): Detalle {
  if (compacta) return 'puntos';
  // Aún sin medir: se pinta completo, que es lo normal en escritorio
  if (anchoMes === 0) return 'completo';
  const celda = anchoMes / 7;
  if (celda < CELDA_CON_TITULO) return 'puntos';
  return celda < CELDA_CON_HORA ? 'titulos' : 'completo';
}

export function VistaMes({
  fecha,
  ocurrencias,
  etiquetas,
  avisos,
  alElegirDia,
  alCrear,
  compacta = false,
}: Props) {
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const dias = useMemo(() => diasDelMes(fecha, inicioSemana), [fecha, inicioSemana]);
  const porDia = useMemo(() => {
    const mapa = new Map<string, Ocurrencia[]>();
    for (const o of ocurrencias) {
      const clave = claveDia(o.inicioMs);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(o);
    }
    return mapa;
  }, [ocurrencias]);
  const [refMes, anchoMes] = useAnchoElemento<HTMLDivElement>();
  const detalle = detalleSegunAncho(anchoMes, compacta);

  return (
    <div ref={refMes} className="tarjeta-plana overflow-hidden">
      <div className="grid grid-cols-7 border-b border-borde bg-superficie-2/60">
        {ordenDias(inicioSemana).map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-bold text-texto-tenue uppercase"
          >
            {DIAS_CORTOS[d]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => (
          <CeldaDia
            key={claveDia(d)}
            dia={d}
            delMes={isSameMonth(d, fecha)}
            ocurrencias={porDia.get(claveDia(d)) ?? []}
            etiquetas={etiquetas}
            avisos={avisos}
            alElegirDia={alElegirDia}
            alCrear={alCrear}
            detalle={detalle}
          />
        ))}
      </div>
    </div>
  );
}

const CeldaDia = memo(function CeldaDia({
  dia,
  delMes,
  ocurrencias,
  etiquetas,
  avisos,
  alElegirDia,
  alCrear,
  detalle,
}: {
  dia: Date;
  delMes: boolean;
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  avisos: Map<string, AvisoCarga[]>;
  alElegirDia: (d: Date) => void;
  alCrear: (inicioMs: number, finMs: number) => void;
  detalle: Detalle;
}) {
  const clave = claveDia(dia);
  const { setNodeRef, isOver } = useDroppable({
    id: `mes-${clave}`,
    data: { tipo: 'dia', fecha: clave, conHoras: false },
  });
  const visibles = ocurrencias.slice(0, 3);
  const resto = ocurrencias.length - visibles.length;
  const conAviso = ocurrencias.some((o) => avisos.has(o.clave));
  const hoy = isToday(dia);

  if (detalle === 'puntos') {
    const colorDe = (o: Ocurrencia) =>
      o.evento.color ?? etiquetas.get(o.etiquetaId ?? '')?.color ?? '#6D5CF0';
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => alElegirDia(dia)}
        aria-label={`${formatear(dia, "EEEE d 'de' MMMM")}, ${ocurrencias.length} bloques`}
        className={`flex min-h-[64px] flex-col items-center gap-1 border-r border-b border-borde pt-1.5 transition-colors ${
          delMes ? '' : 'bg-superficie-2/50 opacity-60'
        } ${isOver ? 'bg-acento/10' : ''}`}
      >
        <span
          className={`numeros grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
            hoy ? 'degradado-marca text-white' : ''
          }`}
        >
          {formatear(dia, 'd')}
        </span>
        <span className="flex flex-wrap justify-center gap-0.5 px-0.5" aria-hidden>
          {ocurrencias.slice(0, MAX_PUNTOS).map((o) => (
            <span
              key={o.clave}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: colorDe(o) }}
            />
          ))}
          {ocurrencias.length > MAX_PUNTOS && (
            <span className="text-[9px] leading-[6px] font-bold text-texto-tenue">+</span>
          )}
        </span>
        {conAviso && <TriangleAlert size={10} className="text-aviso" aria-hidden />}
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`group min-h-[92px] border-r border-b border-borde p-1 transition-colors sm:min-h-[112px] ${delMes ? '' : 'bg-superficie-2/50 opacity-60'} ${
        isOver ? 'bg-acento/10' : ''
      }`}
      onDoubleClick={() => {
        const inicio = startOfDay(dia).getTime() + 9 * 3_600_000;
        alCrear(inicio, 0);
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => alElegirDia(dia)}
          className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold ${hoy ? 'degradado-marca text-white' : 'hover:bg-superficie-2'}`}
          aria-label={formatear(dia, "EEEE d 'de' MMMM")}
        >
          {formatear(dia, 'd')}
        </button>
        {conAviso && (
          <TriangleAlert size={12} className="text-aviso" aria-label="Hay avisos este día" />
        )}
      </div>
      <div className="space-y-0.5">
        {visibles.map((o) => (
          <ChipMes
            key={o.clave}
            oc={o}
            etiqueta={o.etiquetaId ? (etiquetas.get(o.etiquetaId) ?? null) : null}
            conHora={detalle === 'completo'}
          />
        ))}
        {resto > 0 && (
          <button
            type="button"
            onClick={() => alElegirDia(dia)}
            className="px-1 text-[11px] font-bold text-texto-suave hover:text-acento"
          >
            {t.calendario.masEventos(resto)}
          </button>
        )}
      </div>
    </div>
  );
});

function ChipMes({
  oc,
  etiqueta,
  conHora,
}: {
  oc: Ocurrencia;
  etiqueta: Etiqueta | null;
  /** Si la celda es estrecha se quita la hora para que se lea el título. */
  conHora: boolean;
}) {
  const poner = useUI((s) => s.poner);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mes-bloque-${oc.clave}`,
    data: { tipo: 'bloque', ocurrencia: oc },
  });
  const color = oc.evento.color ?? etiqueta?.color ?? '#6D5CF0';
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() =>
        !acabaDeArrastrar() && poner({ editorBloque: { ocurrencia: oc, borrador: null } })
      }
      onKeyDown={(e) =>
        e.key === 'Enter' && poner({ editorBloque: { ocurrencia: oc, borrador: null } })
      }
      className={`flex items-center gap-1 truncate rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold ${isDragging ? 'opacity-30' : ''} ${oc.completado ? 'line-through opacity-60' : ''}`}
      style={{
        background: `color-mix(in oklab, ${color} 18%, transparent)`,
        color: `color-mix(in oklab, ${color} 35%, var(--mos-texto))`,
        touchAction: 'manipulation',
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {conHora && !oc.evento.todoElDia && (
        <span className="numeros shrink-0 opacity-75">
          {formatearHora(oc.inicioMs, formato24h)}
        </span>
      )}
      <span className="truncate">{oc.titulo}</span>
    </div>
  );
}
