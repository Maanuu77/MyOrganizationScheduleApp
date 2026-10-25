// Casilla redonda con un check que se dibuja al completar (tareas, pasos de rutina).
import { motion } from 'motion/react';

interface Props {
  hecho: boolean;
  alCambiar: () => void;
  color?: string;
  etiqueta: string;
  tamano?: number;
}

export function CheckAnimado({
  hecho,
  alCambiar,
  color = 'var(--mos-acento)',
  etiqueta,
  tamano = 24,
}: Props) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={hecho}
      aria-label={etiqueta}
      onClick={(e) => {
        e.stopPropagation();
        alCambiar();
      }}
      whileTap={{ scale: 0.85 }}
      className="relative grid shrink-0 place-items-center rounded-full border-2 transition-colors"
      style={{
        width: tamano,
        height: tamano,
        borderColor: color,
        background: hecho ? color : 'transparent',
      }}
    >
      <svg viewBox="0 0 24 24" width={tamano * 0.62} height={tamano * 0.62} aria-hidden>
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: hecho ? 1 : 0, opacity: hecho ? 1 : 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </svg>
      {hecho && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 0 ${color}` }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.6 }}
          aria-hidden
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: color, opacity: 0.35 }}
          />
        </motion.span>
      )}
    </motion.button>
  );
}
