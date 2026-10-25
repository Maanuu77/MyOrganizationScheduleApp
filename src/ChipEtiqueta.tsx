// Pastilla pequeña con el color, icono y nombre de una etiqueta.
import type { Etiqueta } from './tipos';
import { IconoEtiqueta } from './IconoEtiqueta';
import { t } from './textos';

export function ChipEtiqueta({
  etiqueta,
  pequeno,
}: {
  etiqueta: Etiqueta | null;
  pequeno?: boolean;
}) {
  if (!etiqueta) {
    return (
      <span className={`chip ${pequeno ? 'px-2 py-0 text-[11px]' : ''}`}>
        {t.comun.sinEtiqueta}
      </span>
    );
  }
  return (
    <span
      className={`chip max-w-full ${pequeno ? 'px-2 py-0 text-[11px]' : ''}`}
      style={{
        background: `color-mix(in oklab, ${etiqueta.color} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${etiqueta.color} 30%, transparent)`,
        color: `color-mix(in oklab, ${etiqueta.color} 70%, var(--mos-texto))`,
      }}
    >
      <IconoEtiqueta nombre={etiqueta.icono} tamano={pequeno ? 11 : 13} />
      <span className="truncate">{etiqueta.nombre}</span>
    </span>
  );
}

/** Color de una etiqueta (o el acento si no hay). */
export function colorDe(
  etiqueta: Etiqueta | null | undefined,
  porDefecto = 'var(--mos-acento)',
): string {
  return etiqueta?.color ?? porDefecto;
}
