// Vistas Día y Semana: rejilla de 24 horas con una columna por día.
// - Arrastrar sobre un hueco (ratón) crea un bloque; en táctil basta con tocar el hueco.
// - Cada columna es una zona donde soltar etiquetas, tareas y bloques.
// - Línea de la hora actual y sombreado del horario de sueño.

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { isToday, startOfDay } from 'date-fns';
import type { AvisoCarga, Etiqueta, Ocurrencia } from './tipos';
import { colocarBloques } from './distribucion';
import { BloqueCalendario } from './BloqueCalendario';
import {
  capitalizar,
  claveDia,
  formatear,
  minutosAHora,
  minutosDelDia,
  tramosSueno,
} from './fechas';
import { useReloj } from './useReloj';
import { useDatos } from './almacenDatos';
import { useUI } from './almacenUI';
import { useEsMovil } from './useMedia';
import { t } from './textos';

const PASO_MIN = 15;

/** Alto de una hora en píxeles (sale de la variable CSS --mos-hora, que cambia con la densidad). */
export function useAltoHora(): number {
  const densidad = useDatos((s) => s.ajustes.densidad);
  const [alto, setAlto] = useState(56);
  useLayoutEffect(() => {
    const valor = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--mos-hora'),
    );
    if (valor) setAlto(valor);
  }, [densidad]);
  return alto;
}

export interface Previsualizacion {
  fecha: string;
  inicioMin: number;
  duracionMin: number;
  color: string;
}

interface Props {
  dias: Date[];
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  avisos: Map<string, AvisoCarga[]>;
  previsualizacion: Previsualizacion | null;
  alCrear: (inicioMs: number, finMs: number) => void;
  alElegirDia: (dia: Date) => void;
  /**
   * Día con la tira semanal encima (móvil o escritorio estrecho): la fecha ya se ve en la tira,
   * así que la cabecera solo aparece si hay bloques de todo el día, y la rejilla deja sitio a la tira.
   */
  compacta?: boolean;
}

export function VistaTiempo({
  dias,
  ocurrencias,
  etiquetas,
  avisos,
  previsualizacion,
  alCrear,
  alElegirDia,
  compacta = false,
}: Props) {
  const altoHora = useAltoHora();
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const sueno = useDatos((s) => s.ajustes.sueno);
  const esMovil = useEsMovil();
  const contenedor = useRef<HTMLDivElement>(null);

  // Al abrir, desplazamos hasta una hora antes de la actual (o a las 7:00)
  useEffect(() => {
    const hora = dias.some((d) => isToday(d)) ? Math.max(0, new Date().getHours() - 1) : 7;
    contenedor.current?.scrollTo({ top: hora * altoHora });
    // Solo al montar o cambiar de densidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altoHora]);

  // Repartimos las ocurrencias por día
  const porDia = useMemo(() => {
    const mapa = new Map<string, Ocurrencia[]>();
    for (const d of dias) mapa.set(claveDia(d), []);
    for (const o of ocurrencias) {
      for (const d of dias) {
        const inicio = startOfDay(d).getTime();
        if (o.inicioMs < inicio + 86_400_000 && o.finMs > inicio) mapa.get(claveDia(d))!.push(o);
      }
    }
    return mapa;
  }, [dias, ocurrencias]);

  const todoElDia = ocurrencias.filter(
    (o) => o.evento.todoElDia && dias.some((d) => claveDia(o.inicioMs) === claveDia(d)),
  );
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div
      className={`tarjeta-plana flex flex-col overflow-hidden ${
        compacta
          ? esMovil
            ? // Termina justo encima del panel «Etiquetas y tareas» y la barra inferior
              'h-[calc(100dvh-375px)] min-h-[320px]'
            : // Escritorio estrecho: deja sitio a la tira semanal
              'h-[calc(100dvh-225px)] min-h-[380px]'
          : 'h-[calc(100dvh-210px)] min-h-[420px] md:h-[calc(100dvh-160px)]'
      }`}
    >
      {/* Cabecera con los días */}
      {/* scrollbar-gutter reserva el hueco de la barra de desplazamiento para que la cabecera
          quede alineada con las columnas de abajo */}
      {(!compacta || todoElDia.length > 0) && (
        <div className="flex overflow-hidden border-b border-borde bg-superficie [scrollbar-gutter:stable]">
          <div className="w-10 shrink-0 sm:w-14" />
          {dias.map((d) => {
            const hoy = isToday(d);
            const delDia = todoElDia.filter((o) => claveDia(o.inicioMs) === claveDia(d));
            return (
              <div
                key={claveDia(d)}
                className="min-w-0 flex-1 border-l border-borde px-0.5 py-1.5 text-center sm:px-1"
              >
                {!compacta && (
                  <button
                    type="button"
                    onClick={() => alElegirDia(d)}
                    aria-label={capitalizar(formatear(d, "EEEE d 'de' MMMM"))}
                    aria-current={hoy ? 'date' : undefined}
                    className="mx-auto flex flex-col items-center rounded-md px-0.5 hover:bg-superficie-2 sm:px-2"
                  >
                    <span
                      className={`text-[10px] font-bold uppercase sm:text-[11px] ${hoy ? 'text-acento' : 'text-texto-tenue'}`}
                    >
                      {formatear(d, 'EEE')}
                    </span>
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-sm font-extrabold sm:h-8 sm:w-8 sm:text-base ${hoy ? 'degradado-marca text-white shadow-media' : ''}`}
                    >
                      {formatear(d, 'd')}
                    </span>
                  </button>
                )}
                {delDia.map((o) => {
                  const e = o.etiquetaId ? etiquetas.get(o.etiquetaId) : undefined;
                  return (
                    <ChipTodoElDia
                      key={o.clave}
                      oc={o}
                      color={o.evento.color ?? e?.color ?? '#6D5CF0'}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Rejilla desplazable */}
      <div
        ref={contenedor}
        className="desplazable relative flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div className="flex" style={{ height: 24 * altoHora }}>
          <div className="relative w-10 shrink-0 sm:w-14" aria-hidden>
            {horas.map((h) => (
              <span
                key={h}
                className="numeros absolute right-1 -translate-y-1/2 text-[10px] font-medium text-texto-tenue sm:right-2 sm:text-[11px]"
                style={{ top: h * altoHora }}
              >
                {h === 0
                  ? ''
                  : formato24h
                    ? minutosAHora(h * 60)
                    : `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`}
              </span>
            ))}
          </div>
          {dias.map((d) => (
            <ColumnaDia
              key={claveDia(d)}
              dia={d}
              ocurrencias={porDia.get(claveDia(d)) ?? []}
              etiquetas={etiquetas}
              avisos={avisos}
              altoHora={altoHora}
              formato24h={formato24h}
              sueno={sueno.activo ? sueno : null}
              previsualizacion={previsualizacion?.fecha === claveDia(d) ? previsualizacion : null}
              alCrear={alCrear}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChipTodoElDia({ oc, color }: { oc: Ocurrencia; color: string }) {
  return (
    <button
      type="button"
      onClick={() => useUI.getState().poner({ editorBloque: { ocurrencia: oc, borrador: null } })}
      className="mt-1 block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-bold text-white"
      style={{ background: color }}
    >
      {oc.titulo}
    </button>
  );
}

interface PropsColumna {
  dia: Date;
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  avisos: Map<string, AvisoCarga[]>;
  altoHora: number;
  formato24h: boolean;
  sueno: { inicio: string; fin: string } | null;
  previsualizacion: Previsualizacion | null;
  alCrear: (inicioMs: number, finMs: number) => void;
}

const ColumnaDia = memo(function ColumnaDia({
  dia,
  ocurrencias,
  etiquetas,
  avisos,
  altoHora,
  formato24h,
  sueno,
  previsualizacion,
  alCrear,
}: PropsColumna) {
  const clave = claveDia(dia);
  const { setNodeRef, isOver } = useDroppable({
    id: `dia-${clave}`,
    data: { tipo: 'dia', fecha: clave, conHoras: true },
  });
  const pxPorMinuto = altoHora / 60;
  const inicioDia = startOfDay(dia).getTime();
  const colocados = useMemo(() => colocarBloques(ocurrencias, inicioDia), [ocurrencias, inicioDia]);
  const ahora = useReloj(60_000);
  const esHoy = isToday(dia);
  const [seleccion, setSeleccion] = useState<{ desde: number; hasta: number } | null>(null);
  const origen = useRef<number | null>(null);
  const tipoPuntero = useRef<string>('mouse');

  const minutoEn = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = (e.clientY - rect.top) / pxPorMinuto;
    return Math.min(1440, Math.max(0, Math.floor(min / PASO_MIN) * PASO_MIN));
  };

  const alPulsar = (e: React.PointerEvent) => {
    tipoPuntero.current = e.pointerType;
    if (e.button !== 0) return;
    if (e.pointerType !== 'mouse') return; // en táctil usamos el toque simple (onClick)
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const m = minutoEn(e);
    origen.current = m;
    setSeleccion({ desde: m, hasta: m + PASO_MIN });
  };
  const alMover = (e: React.PointerEvent) => {
    if (origen.current === null) return;
    const m = minutoEn(e);
    const a = Math.min(origen.current, m);
    const b = Math.max(origen.current + PASO_MIN, m + PASO_MIN);
    setSeleccion({ desde: a, hasta: Math.min(1440, b) });
  };
  const alSoltar = () => {
    if (origen.current === null || !seleccion) return;
    const arrastrado = seleccion.hasta - seleccion.desde > PASO_MIN;
    origen.current = null;
    setSeleccion(null);
    const inicio = inicioDia + seleccion.desde * 60_000;
    // Si solo ha hecho clic, usamos la duración por defecto (la pone el editor)
    alCrear(inicio, arrastrado ? inicioDia + seleccion.hasta * 60_000 : 0);
  };

  const tramos = sueno ? tramosSueno(dia, sueno.inicio, sueno.fin) : [];

  return (
    <div
      ref={setNodeRef}
      data-columna={clave}
      className={`relative min-w-0 flex-1 cursor-cell border-l border-borde transition-colors ${isOver ? 'bg-acento/5' : ''} ${esHoy ? 'bg-acento/[0.025]' : ''}`}
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, var(--mos-borde) 0 1px, transparent 1px ${altoHora / 2}px, color-mix(in oklab, var(--mos-borde) 45%, transparent) ${altoHora / 2}px ${altoHora / 2 + 1}px, transparent ${altoHora / 2 + 1}px ${altoHora}px)`,
      }}
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={() => {
        origen.current = null;
        setSeleccion(null);
      }}
      onLostPointerCapture={alSoltar}
      onClick={(e) => {
        // Toque en pantallas táctiles: crea un bloque en ese hueco
        if (tipoPuntero.current === 'mouse') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const min = Math.floor((e.clientY - rect.top) / pxPorMinuto / 30) * 30;
        alCrear(inicioDia + min * 60_000, 0);
      }}
      aria-label={capitalizar(formatear(dia, "EEEE d 'de' MMMM"))}
    >
      {tramos.map(([a, b]) => (
        <div
          key={a}
          className="pointer-events-none absolute inset-x-0 bg-superficie-3/40"
          style={{
            top: ((a - inicioDia) / 60_000) * pxPorMinuto,
            height: ((b - a) / 60_000) * pxPorMinuto,
          }}
          aria-hidden
        />
      ))}

      {colocados.map((c) => (
        <BloqueCalendario
          key={c.ocurrencia.clave}
          idDrag={`bloque-${c.ocurrencia.clave}-${clave}`}
          colocado={c}
          etiqueta={
            c.ocurrencia.etiquetaId ? (etiquetas.get(c.ocurrencia.etiquetaId) ?? null) : null
          }
          avisos={avisos.get(c.ocurrencia.clave)}
          pxPorMinuto={pxPorMinuto}
          formato24h={formato24h}
        />
      ))}

      {seleccion && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-sm border-2 border-dashed border-acento bg-acento/15"
          style={{
            top: seleccion.desde * pxPorMinuto,
            height: (seleccion.hasta - seleccion.desde) * pxPorMinuto,
          }}
        >
          <span className="numeros px-1.5 text-[11px] font-bold text-acento">
            {minutosAHora(seleccion.desde)} – {minutosAHora(seleccion.hasta)}
          </span>
        </div>
      )}

      {/* Imán visual: dónde caerá lo que se está arrastrando */}
      {previsualizacion && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-sm border-2 border-dashed transition-[top] duration-75"
          style={{
            top: previsualizacion.inicioMin * pxPorMinuto,
            height: Math.max(16, previsualizacion.duracionMin * pxPorMinuto),
            borderColor: previsualizacion.color,
            background: `color-mix(in oklab, ${previsualizacion.color} 14%, transparent)`,
          }}
        >
          <span
            className="numeros px-1.5 text-[11px] font-bold"
            style={{ color: previsualizacion.color }}
          >
            {minutosAHora(previsualizacion.inicioMin)}
          </span>
        </div>
      )}

      {esHoy && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: minutosDelDia(ahora) * pxPorMinuto }}
          role="presentation"
          aria-label={t.calendario.lineaAhora}
        >
          <span className="-ml-1.5 h-3 w-3 rounded-full bg-acento-2 shadow-media" />
          <span className="h-0.5 flex-1 bg-acento-2" />
        </div>
      )}
    </div>
  );
});
