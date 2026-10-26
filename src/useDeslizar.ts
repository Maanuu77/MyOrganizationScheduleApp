// Gesto de deslizar el dedo hacia un lado (para cambiar de día o de semana en el móvil).
import { useRef, type TouchEvent } from 'react';

/** Distancia mínima en píxeles para que cuente como deslizar. */
const DISTANCIA_MIN = 60;
/** Tiempo máximo del gesto: si tarda más, es que el usuario está haciendo otra cosa. */
const DURACION_MAX_MS = 700;

/**
 * Devuelve los manejadores táctiles para detectar un deslizamiento horizontal.
 * `alDeslizar(1)` = hacia lo siguiente (dedo hacia la izquierda), `-1` = hacia lo anterior.
 * Se ignora si el gesto es más vertical que horizontal (desplazar la lista) o si se está
 * arrastrando un bloque.
 */
export function useDeslizar(alDeslizar: (sentido: -1 | 1) => void) {
  const inicio = useRef<{ x: number; y: number; ms: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent) => {
      const p = e.touches[0];
      inicio.current =
        e.touches.length === 1 ? { x: p.clientX, y: p.clientY, ms: Date.now() } : null;
    },
    onTouchMove: () => {
      // Si empieza un arrastre de dnd-kit, el gesto ya no es un deslizamiento
      if (document.body.classList.contains('arrastrando')) inicio.current = null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const i = inicio.current;
      inicio.current = null;
      const p = e.changedTouches[0];
      if (!i || !p) return;
      const dx = p.clientX - i.x;
      const dy = p.clientY - i.y;
      if (
        Math.abs(dx) >= DISTANCIA_MIN &&
        Math.abs(dx) > Math.abs(dy) * 1.5 &&
        Date.now() - i.ms < DURACION_MAX_MS
      )
        alDeslizar(dx < 0 ? 1 : -1);
    },
  };
}
