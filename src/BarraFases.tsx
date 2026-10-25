// Barra horizontal con las fases de un ciclo, cada una proporcional a su duración.
import { motion } from 'motion/react';
import { duracionTotal } from './ciclos';
import { t } from './textos';
import type { FaseExpandida } from './tipos';

export function BarraFases({
  fases,
  indiceActual,
}: {
  fases: FaseExpandida[];
  indiceActual?: number;
}) {
  const total = duracionTotal(fases) || 1;
  return (
    <div
      className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      role="list"
      aria-label={t.ciclos.vistaPrevia}
    >
      {fases.map((f, i) => (
        <motion.div
          key={i}
          role="listitem"
          aria-label={`${f.nombre}, ${Math.round(f.duracionMs / 60000)} min`}
          title={`${f.nombre} · ${Math.round(f.duracionMs / 60000)} min`}
          className="h-full first:rounded-l-full last:rounded-r-full"
          initial={{ scaleY: 0 }}
          animate={{
            scaleY: 1,
            opacity: indiceActual !== undefined && i < indiceActual ? 0.35 : 1,
          }}
          transition={{ delay: i * 0.03 }}
          style={{
            width: `${(f.duracionMs / total) * 100}%`,
            background: f.color,
            outline: indiceActual === i ? '2px solid var(--mos-texto)' : undefined,
            outlineOffset: -2,
          }}
        />
      ))}
    </div>
  );
}
