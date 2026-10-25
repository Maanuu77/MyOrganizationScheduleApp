// Ventana modal accesible. En escritorio es un diálogo centrado; en móvil, una hoja inferior
// que se puede cerrar deslizando hacia abajo. Atrapa el foco del teclado y se cierra con Escape.

import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from './textos';
import { useEsMovil } from './useMedia';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: 'sm' | 'md' | 'lg' | 'xl';
}

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Pila de modales abiertos: solo el de arriba responde al teclado. */
const pila: string[] = [];

const SELECTOR_ENFOCABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ abierto, alCerrar, titulo, children, pie, ancho = 'md' }: Props) {
  const esMovil = useEsMovil();
  const idTitulo = useId();
  const caja = useRef<HTMLDivElement>(null);
  const controlesArrastre = useDragControls();
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;

  // Gestión del foco: lo movemos dentro al abrir y lo devolvemos al cerrar
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const temporizador = setTimeout(() => {
      const primero =
        caja.current?.querySelector<HTMLElement>('[data-autofoco]') ??
        caja.current?.querySelector<HTMLElement>(SELECTOR_ENFOCABLE);
      primero?.focus();
    }, 30);
    pila.push(idTitulo);
    const alPulsar = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== idTitulo) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        alCerrarRef.current();
      }
      if (e.key === 'Tab' && caja.current) {
        const enfocables = [...caja.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE)];
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', alPulsar, true);
    const desbordamiento = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(temporizador);
      pila.splice(pila.indexOf(idTitulo), 1);
      document.removeEventListener('keydown', alPulsar, true);
      document.body.style.overflow = desbordamiento;
      previo?.focus?.();
    };
  }, [abierto, idTitulo]);

  const alSoltar = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) alCerrar();
  };

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[#0b0a16]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={alCerrar}
            aria-hidden
          />
          <motion.div
            ref={caja}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-superficie shadow-elevada ${
              esMovil ? 'rounded-t-xl pb-seguro' : `rounded-xl border border-borde ${ANCHOS[ancho]}`
            }`}
            initial={esMovil ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={esMovil ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={esMovil ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            drag={esMovil ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controlesArrastre}
            onDragEnd={alSoltar}
          >
            {esMovil && (
              <div
                className="flex cursor-grab touch-none justify-center pt-2.5 pb-1"
                // Solo el asa inicia el arrastre, para no interferir con el desplazamiento del contenido
                onPointerDown={(e) => controlesArrastre.start(e)}
                aria-hidden
              >
                <span className="h-1.5 w-10 rounded-full bg-borde-fuerte" />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-b border-borde px-5 py-3.5">
              <h2 id={idTitulo} className="truncate text-lg font-bold text-texto">
                {titulo}
              </h2>
              <button
                type="button"
                onClick={alCerrar}
                className="grid h-9 w-9 place-items-center rounded-full text-texto-suave hover:bg-superficie-2"
                aria-label={t.comun.cerrar}
              >
                <X size={18} />
              </button>
            </div>
            <div className="desplazable flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {pie && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde px-5 py-3">
                {pie}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
