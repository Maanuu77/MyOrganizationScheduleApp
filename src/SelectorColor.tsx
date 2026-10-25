// Selector de color: paleta rápida más selector libre.
import { Check } from 'lucide-react';

export const PALETA = [
  '#6D5CF0',
  '#5B4BDB',
  '#2F6FD6',
  '#0EA5E9',
  '#14B8A6',
  '#12A37F',
  '#65A30D',
  '#CA8A04',
  '#E8A317',
  '#F97316',
  '#FF6B4A',
  '#E5484D',
  '#DB2777',
  '#C026D3',
  '#8B5CF6',
  '#64748B',
];

interface Props {
  valor: string;
  alCambiar: (color: string) => void;
  etiqueta: string;
}

export function SelectorColor({ valor, alCambiar, etiqueta }: Props) {
  const actual = valor.toLowerCase();
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap items-center gap-2">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => alCambiar(c)}
          className="grid h-8 w-8 place-items-center rounded-full shadow-suave transition-transform hover:scale-110"
          style={{ background: c }}
          aria-label={`Color ${c}`}
          aria-pressed={actual === c.toLowerCase()}
        >
          {actual === c.toLowerCase() && <Check size={16} className="text-white" aria-hidden />}
        </button>
      ))}
      <label
        className="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-borde-fuerte"
        title="Color libre"
      >
        <span className="sr-only">Color libre</span>
        <input
          type="color"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span className="h-4 w-4 rounded-full" style={{ background: valor }} aria-hidden />
      </label>
    </div>
  );
}
