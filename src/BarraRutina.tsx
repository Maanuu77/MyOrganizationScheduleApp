// Barra horizontal con los pasos de una rutina: cada tramo mide lo que dura el paso y lleva
// el color de su etiqueta; los descansos se ven como huecos rayados.
import type { Etiqueta, Rutina } from './tipos';
import { t } from './textos';

interface Props {
  rutina: Pick<Rutina, 'pasos' | 'color'>;
  etiquetas: Etiqueta[];
  alto?: number;
}

export function BarraRutina({ rutina, etiquetas, alto = 10 }: Props) {
  const tramos = rutina.pasos.flatMap((p, i) => {
    const color = etiquetas.find((e) => e.id === p.etiquetaId)?.color ?? rutina.color;
    const lista = [
      { clave: p.id, min: p.duracionMin, color, texto: `${p.nombre} · ${p.duracionMin} min` },
    ];
    if (i < rutina.pasos.length - 1 && p.descansoMin > 0)
      lista.push({
        clave: `${p.id}-descanso`,
        min: p.descansoMin,
        color: '',
        texto: `${t.rutinas.descanso} · ${p.descansoMin} min`,
      });
    return lista;
  });
  const total = tramos.reduce((s, x) => s + x.min, 0) || 1;

  return (
    <div
      className="flex w-full gap-0.5 overflow-hidden rounded-full"
      style={{ height: alto }}
      aria-hidden
    >
      {tramos.map((x) => (
        <span
          key={x.clave}
          title={x.texto}
          style={{
            flexGrow: x.min / total,
            flexBasis: 0,
            minWidth: 4,
            background: x.color
              ? x.color
              : 'repeating-linear-gradient(135deg, var(--mos-superficie-3) 0 4px, transparent 4px 7px)',
          }}
        />
      ))}
    </div>
  );
}
