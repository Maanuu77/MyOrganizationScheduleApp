// Estado vacío motivador: icono, título, texto y una acción opcional.
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  icono: ReactNode;
  titulo: string;
  texto: string;
  accion?: ReactNode;
  compacto?: boolean;
}

export function EstadoVacio({ icono, titulo, texto, accion, compacto }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center text-center ${compacto ? 'gap-2 py-6' : 'gap-3 py-14'}`}
    >
      <div
        className={`grid place-items-center rounded-xl bg-acento/10 text-acento ${compacto ? 'h-12 w-12' : 'h-16 w-16'}`}
        aria-hidden
      >
        {icono}
      </div>
      <h3 className={`font-bold text-texto ${compacto ? 'text-base' : 'text-lg'}`}>{titulo}</h3>
      <p className="max-w-sm text-sm text-texto-suave">{texto}</p>
      {accion && <div className="mt-2">{accion}</div>}
    </motion.div>
  );
}
