// Hooks que derivan información de los datos: ocurrencias de un rango y avisos de carga.
// Usan useMemo para no recalcular la recurrencia en cada render.

import { useMemo } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { expandirOcurrencias } from './recurrencia';
import { detectarAvisos } from './avisosCarga';
import type { AvisoCarga, Ocurrencia } from './tipos';

/** Ocurrencias visibles en [desdeMs, hastaMs). */
export function useOcurrencias(desdeMs: number, hastaMs: number): Ocurrencia[] {
  const eventos = useDatos((s) => s.eventos);
  const excepciones = useDatos((s) => s.excepciones);
  return useMemo(
    () => expandirOcurrencias(eventos, excepciones, desdeMs, hastaMs),
    [eventos, excepciones, desdeMs, hastaMs],
  );
}

/** Días hacia delante que vigila el centro de avisos. */
export const DIAS_AVISOS = 14;

/** Rango estable de los avisos: de hoy a 14 días (cambia solo al cambiar de día). */
export function rangoAvisos(): [number, number] {
  const hoy = startOfDay(new Date());
  return [hoy.getTime(), addDays(hoy, DIAS_AVISOS).getTime()];
}

/** Avisos de sobrecarga y conflictos de los próximos 14 días. */
export function useAvisosCarga(): AvisoCarga[] {
  const [desde, hasta] = rangoAvisos();
  const ocurrencias = useOcurrencias(desde, hasta);
  const tareas = useDatos((s) => s.tareas);
  const umbrales = useDatos((s) => s.ajustes.umbrales);
  const sueno = useDatos((s) => s.ajustes.sueno);
  return useMemo(
    () => detectarAvisos(ocurrencias, tareas, { umbrales, sueno }, Date.now()),
    [ocurrencias, tareas, umbrales, sueno],
  );
}

/** Conjunto de claves de ocurrencias con algún aviso (para marcarlas en el calendario). */
export function useClavesConAviso(): Map<string, AvisoCarga[]> {
  const avisos = useAvisosCarga();
  return useMemo(() => {
    const mapa = new Map<string, AvisoCarga[]>();
    for (const a of avisos) {
      for (const c of a.claves) {
        if (!mapa.has(c)) mapa.set(c, []);
        mapa.get(c)!.push(a);
      }
    }
    return mapa;
  }, [avisos]);
}
