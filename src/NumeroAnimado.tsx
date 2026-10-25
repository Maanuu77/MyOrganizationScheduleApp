// Número que "cuenta" hasta su valor cuando aparece o cambia.
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface Props {
  valor: number;
  formatear?: (n: number) => string;
  duracion?: number;
  className?: string;
}

export function NumeroAnimado({
  valor,
  formatear = (n) => Math.round(n).toLocaleString('es-ES'),
  duracion = 0.9,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);
  const reducido = useReducedMotion();
  const formatearRef = useRef(formatear);
  formatearRef.current = formatear;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducido) {
      el.textContent = formatearRef.current(valor);
      anterior.current = valor;
      return;
    }
    const control = animate(anterior.current, valor, {
      duration: duracion,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatearRef.current(v);
      },
    });
    anterior.current = valor;
    return () => control.stop();
  }, [valor, duracion, reducido]);

  return (
    <span ref={ref} className={`numeros ${className ?? ''}`}>
      {formatear(valor)}
    </span>
  );
}
