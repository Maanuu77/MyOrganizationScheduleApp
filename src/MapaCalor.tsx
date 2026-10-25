// Mapa de calor anual (una celda por día, columnas por semana) en SVG.
import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { CeldaCalor } from './estadisticas';
import { duracionTexto, formatear } from './fechas';
import { t } from './textos';

const TAM = 12;
const HUECO = 3;

export function MapaCalor({ celdas, inicioSemana }: { celdas: CeldaCalor[]; inicioSemana: 0 | 1 }) {
  const { columnas, meses } = useMemo(() => {
    const cols: Array<Array<CeldaCalor | null>> = [];
    let actual: Array<CeldaCalor | null> = [];
    const fila = (d: Date) => (inicioSemana === 1 ? (d.getDay() + 6) % 7 : d.getDay());
    if (celdas.length) actual = Array(fila(celdas[0].fecha)).fill(null);
    const etiquetasMes: Array<{ col: number; texto: string }> = [];
    for (const c of celdas) {
      if (c.fecha.getDate() === 1)
        etiquetasMes.push({ col: cols.length, texto: formatear(c.fecha, 'MMM') });
      actual.push(c);
      if (actual.length === 7) {
        cols.push(actual);
        actual = [];
      }
    }
    if (actual.length) cols.push(actual);
    return { columnas: cols, meses: etiquetasMes };
  }, [celdas, inicioSemana]);

  const ancho = columnas.length * (TAM + HUECO);
  const alto = 7 * (TAM + HUECO) + 16;
  const opacidad = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="desplazable overflow-x-auto">
      <svg width={ancho} height={alto} role="img" aria-label={t.estadisticas.mapaCalor}>
        {meses.map((m) => (
          <text
            key={`${m.col}-${m.texto}`}
            x={m.col * (TAM + HUECO)}
            y={10}
            className="fill-[var(--mos-texto-tenue)] text-[10px]"
          >
            {m.texto}
          </text>
        ))}
        {columnas.map((col, x) =>
          col.map((c, y) =>
            c ? (
              <motion.rect
                key={c.clave}
                x={x * (TAM + HUECO)}
                y={16 + y * (TAM + HUECO)}
                width={TAM}
                height={TAM}
                rx={3}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(x * 0.008, 0.5) }}
                fill={
                  c.nivel
                    ? `color-mix(in oklab, var(--mos-acento) ${opacidad[c.nivel] * 100}%, var(--mos-superficie-3))`
                    : 'var(--mos-superficie-3)'
                }
              >
                <title>{`${formatear(c.fecha, "d 'de' MMMM")}: ${c.ms ? duracionTexto(c.ms) : '—'}`}</title>
              </motion.rect>
            ) : null,
          ),
        )}
      </svg>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-texto-tenue">
        {t.estadisticas.menos}
        {opacidad.map((o, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-[3px]"
            style={{
              background: i
                ? `color-mix(in oklab, var(--mos-acento) ${o * 100}%, var(--mos-superficie-3))`
                : 'var(--mos-superficie-3)',
            }}
          />
        ))}
        {t.estadisticas.masTexto}
      </div>
    </div>
  );
}
