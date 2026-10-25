// Botón reutilizable con variantes de color y tamaño.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'suave';
type Tamano = 'sm' | 'md' | 'lg' | 'icono';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  icono?: ReactNode;
  cargando?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primario:
    'degradado-marca text-sobre-acento shadow-media hover:brightness-110 active:brightness-95 disabled:opacity-50',
  secundario:
    'bg-superficie text-texto border border-borde-fuerte hover:bg-superficie-2 shadow-suave disabled:opacity-50',
  fantasma:
    'bg-transparent text-texto-suave hover:bg-superficie-2 hover:text-texto disabled:opacity-40',
  peligro: 'bg-peligro text-white hover:brightness-110 shadow-suave disabled:opacity-50',
  suave: 'bg-acento/10 text-acento hover:bg-acento/18 disabled:opacity-50',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2 rounded-md',
  icono: 'h-10 w-10 justify-center rounded-md',
};

export const Boton = forwardRef<HTMLButtonElement, Props>(function Boton(
  {
    variante = 'secundario',
    tamano = 'md',
    icono,
    cargando,
    className = '',
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      className={`inline-flex shrink-0 items-center font-semibold transition-all duration-150 select-none active:scale-[0.97] disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icono
      )}
      {children}
    </button>
  );
});
