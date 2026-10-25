// Anillo de progreso animado en SVG (contador de foco, objetivos, resúmenes).
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  progreso: number; // 0..1
  tamano?: number;
  grosor?: number;
  color?: string;
  colorFondo?: string;
  children?: ReactNode;
  etiqueta?: string;
  /** Duración de la animación en segundos (0 para seguir un valor que cambia cada segundo). */
  suavidad?: number;
}

export function AnilloProgreso({
  progreso,
  tamano = 120,
  grosor = 10,
  color = 'var(--mos-acento)',
  colorFondo = 'var(--mos-superficie-3)',
  children,
  etiqueta,
  suavidad = 0.8,
}: Props) {
  const radio = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const valor = Math.min(1, Math.max(0, progreso || 0));
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: tamano, height: tamano }}
      role={etiqueta ? 'progressbar' : undefined}
      aria-label={etiqueta}
      aria-valuemin={etiqueta ? 0 : undefined}
      aria-valuemax={etiqueta ? 100 : undefined}
      aria-valuenow={etiqueta ? Math.round(valor * 100) : undefined}
    >
      <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden>
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke={colorFondo}
          strokeWidth={grosor}
        />
        <motion.circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          initial={{ strokeDashoffset: circunferencia }}
          animate={{ strokeDashoffset: circunferencia * (1 - valor) }}
          transition={{ duration: suavidad, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      )}
    </div>
  );
}
