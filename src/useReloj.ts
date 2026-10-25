// Devuelve la hora actual y vuelve a pintar el componente cada cierto tiempo
// (línea de la hora actual, "ahora / después"...).
import { useEffect, useState } from 'react';

export function useReloj(cadaMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    const id = setInterval(actualizar, cadaMs);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [cadaMs]);
  return ahora;
}
