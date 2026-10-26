// Tira con los 7 días de la semana (vista Día en el móvil): el día elegido resaltado, hoy
// marcado y un punto de color por cada etiqueta con bloques ese día. Se desliza para
// cambiar de semana.

import { useMemo } from 'react';
import { addDays, isSameDay, isToday, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDeslizar } from './useDeslizar';
import { capitalizar, claveDia, diasDeSemana, formatear } from './fechas';
import { t } from './textos';
import type { Etiqueta, Ocurrencia } from './tipos';

/** Puntos de color que caben bajo cada día; si hay más, se muestra un «+». */
const MAX_PUNTOS = 3;

interface Props {
  fecha: Date;
  inicioSemana: 0 | 1;
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  alElegir: (dia: Date) => void;
}

export function TiraSemanal({ fecha, inicioSemana, ocurrencias, etiquetas, alElegir }: Props) {
  const dias = useMemo(() => diasDeSemana(fecha, inicioSemana), [fecha, inicioSemana]);

  // Colores distintos de los bloques de cada día, en orden de hora
  const coloresPorDia = useMemo(() => {
    const mapa = new Map<string, string[]>();
    const ordenadas = [...ocurrencias].sort((a, b) => a.inicioMs - b.inicioMs);
    for (const d of dias) {
      const inicio = startOfDay(d).getTime();
      const fin = addDays(d, 1).getTime();
      const colores = new Set<string>();
      for (const o of ordenadas) {
        if (o.inicioMs >= fin || o.finMs <= inicio) continue;
        const etiqueta = o.etiquetaId ? etiquetas.get(o.etiquetaId) : undefined;
        colores.add(o.evento.color ?? etiqueta?.color ?? '#6D5CF0');
      }
      mapa.set(claveDia(d), [...colores]);
    }
    return mapa;
  }, [dias, ocurrencias, etiquetas]);

  // Deslizar la tira mueve una semana entera, manteniendo el mismo día de la semana
  const gestos = useDeslizar((sentido) => alElegir(addDays(fecha, sentido * 7)));

  return (
    <div className="mb-3 flex items-center gap-0.5" {...gestos}>
      <button
        type="button"
        onClick={() => alElegir(addDays(fecha, -7))}
        className="grid h-9 w-7 shrink-0 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2"
        aria-label={t.calendario.semanaAnterior}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-0.5">
        {dias.map((d) => {
          const elegido = isSameDay(d, fecha);
          const hoy = isToday(d);
          const colores = coloresPorDia.get(claveDia(d)) ?? [];
          return (
            <button
              key={claveDia(d)}
              type="button"
              onClick={() => alElegir(d)}
              aria-label={capitalizar(formatear(d, "EEEE d 'de' MMMM"))}
              aria-pressed={elegido}
              aria-current={hoy ? 'date' : undefined}
              className={`flex flex-col items-center rounded-md py-1.5 transition-colors ${
                elegido ? 'bg-acento/12' : 'hover:bg-superficie-2'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase ${hoy || elegido ? 'text-acento' : 'text-texto-tenue'}`}
              >
                {formatear(d, 'EEEEEE')}
              </span>
              <span
                className={`numeros grid h-8 w-8 place-items-center rounded-full text-[15px] font-extrabold ${
                  elegido
                    ? 'degradado-marca text-white shadow-media'
                    : hoy
                      ? 'text-acento ring-2 ring-acento/40'
                      : 'text-texto'
                }`}
              >
                {formatear(d, 'd')}
              </span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5" aria-hidden>
                {colores.slice(0, MAX_PUNTOS).map((c) => (
                  <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                ))}
                {colores.length > MAX_PUNTOS && (
                  <span className="text-[9px] leading-none font-bold text-texto-tenue">+</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => alElegir(addDays(fecha, 7))}
        className="grid h-9 w-7 shrink-0 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2"
        aria-label={t.calendario.semanaSiguiente}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
