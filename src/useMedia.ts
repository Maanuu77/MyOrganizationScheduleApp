// Hooks para saber el tamaño de pantalla y las preferencias del sistema.
import { useCallback, useState, useSyncExternalStore } from 'react';

function useConsultaMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** Móvil: menos de 768 px de ancho. */
export const useEsMovil = () => useConsultaMedia('(max-width: 767px)');
/** Escritorio estrecho (tablet, pantalla dividida): la barra lateral muestra solo iconos. */
export const useEsEscritorioEstrecho = () =>
  useConsultaMedia('(min-width: 768px) and (max-width: 1279px)');
/** Escritorio grande: a partir de 1440 px se muestra el panel fijo de Hoy. */
export const useEsEscritorioGrande = () => useConsultaMedia('(min-width: 1440px)');
/** Dispositivo táctil sin ratón. */
export const useEsTactil = () => useConsultaMedia('(pointer: coarse)');
export const usePrefiereOscuro = () => useConsultaMedia('(prefers-color-scheme: dark)');

/**
 * Ancho real de un elemento en píxeles, que se actualiza cuando cambia de tamaño.
 * Sirve para adaptar una vista al sitio que tiene de verdad y no al ancho de la ventana:
 * con la pantalla dividida o con paneles abiertos, la ventana puede ser ancha y el hueco no.
 * Devuelve la referencia que hay que poner en el elemento y su ancho (0 hasta medirlo).
 */
export function useAnchoElemento<T extends HTMLElement>(): [
  (nodo: T | null) => (() => void) | undefined,
  number,
] {
  const [ancho, setAncho] = useState(0);
  const ref = useCallback((nodo: T | null) => {
    if (!nodo) return undefined;
    const medir = () => setAncho(Math.round(nodo.getBoundingClientRect().width));
    // Se mide ya, antes de pintar, para no enseñar un instante la vista equivocada
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
}
