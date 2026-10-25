// Hooks para saber el tamaño de pantalla y las preferencias del sistema.
import { useSyncExternalStore } from 'react';

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
/** Escritorio grande: a partir de 1280 px se muestra el panel fijo de Hoy. */
export const useEsEscritorioGrande = () => useConsultaMedia('(min-width: 1280px)');
/** Dispositivo táctil sin ratón. */
export const useEsTactil = () => useConsultaMedia('(pointer: coarse)');
export const usePrefiereOscuro = () => useConsultaMedia('(prefers-color-scheme: dark)');
