// Un bloque del calendario en las vistas Día y Semana. Se puede arrastrar (mover a otra
// hora o día), redimensionar desde el borde inferior y abrir con clic o Intro.

import { memo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, Repeat, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AvisoCarga, Etiqueta, Ocurrencia } from './tipos';
import type { BloqueColocado } from './distribucion';
import { IconoEtiqueta } from './IconoEtiqueta';
import { formatearHora } from './fechas';
import { moverOcurrencia } from './operaciones';
import { useUI } from './almacenUI';

interface Props {
  colocado: BloqueColocado;
  etiqueta: Etiqueta | null;
  avisos: AvisoCarga[] | undefined;
  pxPorMinuto: number;
  formato24h: boolean;
  idDrag: string;
}

/** Datos que viajan con el arrastre de un bloque. */
export interface DatosArrastreBloque {
  tipo: 'bloque';
  ocurrencia: Ocurrencia;
}

const PASO_MIN = 15;

/** Al soltar un arrastre el navegador lanza un clic: lo ignoramos para no abrir el editor. */
let finUltimoArrastre = 0;
export function marcarFinArrastre(): void {
  finUltimoArrastre = Date.now();
}
export function acabaDeArrastrar(): boolean {
  return Date.now() - finUltimoArrastre < 300;
}

export const BloqueCalendario = memo(function BloqueCalendario({
  colocado,
  etiqueta,
  avisos,
  pxPorMinuto,
  formato24h,
  idDrag,
}: Props) {
  const { ocurrencia: oc, inicioMin, finMin, columna, totalColumnas } = colocado;
  const poner = useUI((s) => s.poner);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idDrag,
    data: { tipo: 'bloque', ocurrencia: oc } satisfies DatosArrastreBloque,
  });

  // Redimensionado: guardamos el nuevo fin mientras se arrastra el asa inferior
  const [finProvisional, setFinProvisional] = useState<number | null>(null);
  const inicioArrastre = useRef<{ y: number; fin: number } | null>(null);

  const color = oc.evento.color ?? etiqueta?.color ?? '#6D5CF0';
  const protegido = oc.evento.tipo === 'protegido';
  const finVisible = finProvisional ?? finMin;
  const alto = Math.max(18, (finVisible - inicioMin) * pxPorMinuto - 2);
  const corto = alto < 40;
  const ancho = 100 / totalColumnas;
  const finMsVisible =
    finProvisional !== null ? oc.inicioMs + (finProvisional - inicioMin) * 60_000 : oc.finMs;

  const alPulsarAsa = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    inicioArrastre.current = { y: e.clientY, fin: finMin };
  };
  const alMoverAsa = (e: React.PointerEvent) => {
    if (!inicioArrastre.current) return;
    const delta = (e.clientY - inicioArrastre.current.y) / pxPorMinuto;
    const nuevo = Math.round((inicioArrastre.current.fin + delta) / PASO_MIN) * PASO_MIN;
    setFinProvisional(Math.min(1440, Math.max(inicioMin + PASO_MIN, nuevo)));
  };
  const alSoltarAsa = async () => {
    const fin = finProvisional;
    inicioArrastre.current = null;
    if (fin === null || fin === finMin) {
      setFinProvisional(null);
      return;
    }
    const nuevoFinMs = oc.inicioMs + (fin - inicioMin) * 60_000;
    marcarFinArrastre();
    await moverOcurrencia(oc, oc.inicioMs, nuevoFinMs);
    setFinProvisional(null);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${oc.titulo}, ${formatearHora(oc.inicioMs, formato24h)} a ${formatearHora(oc.finMs, formato24h)}`}
      onClick={(e) => {
        e.stopPropagation();
        if (acabaDeArrastrar() || finProvisional !== null) return;
        poner({ editorBloque: { ocurrencia: oc, borrador: null } });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          poner({ editorBloque: { ocurrencia: oc, borrador: null } });
        }
      }}
      // Que pulsar un bloque no empiece a crear otro nuevo en la columna de debajo
      onPointerDown={(e) => e.stopPropagation()}
      className={`group absolute overflow-hidden rounded-sm border text-left transition-shadow select-none hover:z-20 hover:shadow-media focus-visible:z-20 ${
        isDragging ? 'opacity-35' : ''
      } ${protegido ? 'rayado-protegido' : ''}`}
      style={{
        top: inicioMin * pxPorMinuto + 1,
        height: alto,
        left: `calc(${columna * ancho}% + 2px)`,
        width: `calc(${ancho}% - 4px)`,
        background: protegido
          ? `color-mix(in oklab, ${color} 12%, var(--mos-superficie))`
          : `linear-gradient(160deg, color-mix(in oklab, ${color} 26%, var(--mos-superficie)), color-mix(in oklab, ${color} 16%, var(--mos-superficie)))`,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        borderLeft: `3px solid ${color}`,
        color: `color-mix(in oklab, ${color} 30%, var(--mos-texto))`,
        opacity: oc.completado ? 0.65 : undefined,
        touchAction: 'manipulation',
        zIndex: finProvisional !== null ? 30 : undefined,
      }}
    >
      <div className={`flex h-full flex-col px-1.5 ${corto ? 'py-0' : 'py-1'}`}>
        <div className="flex min-w-0 items-center gap-1">
          {protegido ? (
            <ShieldCheck size={11} className="shrink-0" aria-hidden />
          ) : (
            etiqueta && <IconoEtiqueta nombre={etiqueta.icono} tamano={11} className="shrink-0" />
          )}
          <p
            className={`truncate text-[12px] leading-tight font-bold ${oc.completado ? 'line-through' : ''}`}
          >
            {oc.titulo}
          </p>
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {oc.completado && <Check size={11} aria-label="Hecho" />}
            {oc.esRecurrente && <Repeat size={10} aria-label="Se repite" />}
            {avisos && avisos.length > 0 && (
              <TriangleAlert
                size={11}
                className="text-aviso"
                aria-label={avisos.map((a) => a.titulo).join('. ')}
              />
            )}
          </span>
        </div>
        {!corto && (
          <p className="numeros truncate text-[11px] font-medium opacity-80">
            {formatearHora(oc.inicioMs, formato24h)} – {formatearHora(finMsVisible, formato24h)}
          </p>
        )}
      </div>
      {/* Asa para cambiar la duración */}
      <div
        className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
        style={{ touchAction: 'none' }}
        onPointerDown={alPulsarAsa}
        onPointerMove={alMoverAsa}
        onPointerUp={alSoltarAsa}
        onPointerCancel={() => {
          inicioArrastre.current = null;
          setFinProvisional(null);
        }}
        // El asa no debe activar el arrastre del bloque entero
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        aria-hidden
      >
        <div className="mx-auto mt-1 h-1 w-6 rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
});
