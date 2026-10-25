// Rejilla de iconos para elegir el de una etiqueta.
import { ICONOS } from './IconoEtiqueta';

interface Props {
  valor: string;
  color: string;
  alCambiar: (icono: string) => void;
  etiqueta: string;
}

export function SelectorIcono({ valor, color, alCambiar, etiqueta }: Props) {
  return (
    <div role="group" aria-label={etiqueta} className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
      {Object.entries(ICONOS).map(([nombre, Icono]) => {
        const activo = nombre === valor;
        return (
          <button
            key={nombre}
            type="button"
            onClick={() => alCambiar(nombre)}
            aria-label={nombre}
            aria-pressed={activo}
            className={`grid aspect-square place-items-center rounded-sm transition-all ${
              activo ? 'text-white shadow-media' : 'text-texto-suave hover:bg-superficie-2'
            }`}
            style={activo ? { background: color } : undefined}
          >
            <Icono size={17} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
