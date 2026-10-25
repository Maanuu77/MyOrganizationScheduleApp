// Cabecera de pantalla: título, subtítulo y acciones a la derecha.
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}

export function Cabecera({ titulo, subtitulo, acciones }: Props) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-texto sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-2xl text-sm text-texto-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
