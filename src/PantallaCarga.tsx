// Pantalla de carga con el logotipo latiendo suavemente.
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { t } from './textos';

export function PantallaCarga({ compacta }: { compacta?: boolean }) {
  return (
    <div
      className={`grid place-items-center ${compacta ? 'py-24' : 'min-h-dvh'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.06, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo tamano={compacta ? 40 : 56} />
        </motion.div>
        <p className="text-sm font-medium text-texto-suave">{t.app.cargando}</p>
      </div>
    </div>
  );
}
