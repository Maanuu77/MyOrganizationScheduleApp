// Controles de formulario reutilizables: interruptor, control segmentado y campo con etiqueta.
import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';

interface PropsInterruptor {
  activo: boolean;
  alCambiar: (valor: boolean) => void;
  etiqueta: string;
  descripcion?: string;
  deshabilitado?: boolean;
}

/** Interruptor tipo "switch" accesible (role=switch). */
export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
  descripcion,
  deshabilitado,
}: PropsInterruptor) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-texto">
          {etiqueta}
        </label>
        {descripcion && <p className="text-xs text-texto-suave">{descripcion}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={deshabilitado}
        onClick={() => alCambiar(!activo)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${activo ? 'bg-acento' : 'bg-superficie-3'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-suave ${activo ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

interface Opcion<T extends string> {
  valor: T;
  texto: string;
  icono?: ReactNode;
}

interface PropsSegmentado<T extends string> {
  opciones: Opcion<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiqueta: string;
  tamano?: 'sm' | 'md';
}

/** Grupo de botones donde solo uno está activo (como pestañas). */
export function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  tamano = 'md',
}: PropsSegmentado<T>) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex max-w-full flex-wrap rounded-md border border-borde bg-superficie-2 p-1"
    >
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={o.texto}
            onClick={() => alCambiar(o.valor)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-sm font-semibold transition-colors ${
              tamano === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${activo ? 'text-texto' : 'text-texto-suave hover:text-texto'}`}
          >
            {activo && (
              <motion.span
                layoutId={`segmentado-${id}`}
                className="absolute inset-0 rounded-sm bg-superficie shadow-suave"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icono}
              {o.texto}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface PropsCampo {
  etiqueta: string;
  children: (id: string) => ReactNode;
  ayuda?: string;
  className?: string;
}

/** Envoltorio de un campo con su etiqueta asociada por id. */
export function Campo({ etiqueta, children, ayuda, className = '' }: PropsCampo) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="etiqueta-campo">
        {etiqueta}
      </label>
      {children(id)}
      {ayuda && <p className="mt-1 text-xs text-texto-tenue">{ayuda}</p>}
    </div>
  );
}

/** Sección con título dentro de formularios largos (ajustes, editores). */
export function Seccion({
  titulo,
  children,
  icono,
}: {
  titulo: string;
  children: ReactNode;
  icono?: ReactNode;
}) {
  return (
    <section className="tarjeta">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-texto">
        {icono && <span className="text-acento">{icono}</span>}
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Selector de días de la semana (botones redondos L M X J V S D). */
export function SelectorDias({
  valor,
  alCambiar,
  inicioSemana,
  etiqueta,
}: {
  valor: number[];
  alCambiar: (dias: number[]) => void;
  inicioSemana: 0 | 1;
  etiqueta: string;
}) {
  const letras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const orden = inicioSemana === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {orden.map((d) => {
        const activo = valor.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={activo}
            aria-label={nombres[d]}
            onClick={() => alCambiar(activo ? valor.filter((x) => x !== d) : [...valor, d])}
            className={`h-9 w-9 rounded-full text-sm font-bold transition-all ${
              activo
                ? 'degradado-marca text-white shadow-media'
                : 'bg-superficie-2 text-texto-suave hover:bg-superficie-3'
            }`}
          >
            {letras[d]}
          </button>
        );
      })}
    </div>
  );
}
