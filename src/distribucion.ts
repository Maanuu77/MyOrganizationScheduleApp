// Coloca los bloques de un día en columnas cuando se solapan (como hacen los calendarios),
// para que ninguno tape a otro. Función pura.

import type { Ocurrencia } from './tipos';

export interface BloqueColocado {
  ocurrencia: Ocurrencia;
  /** Minuto de inicio dentro del día (0..1440). */
  inicioMin: number;
  /** Minuto de fin dentro del día (0..1440). */
  finMin: number;
  columna: number;
  totalColumnas: number;
}

export function colocarBloques(ocurrencias: Ocurrencia[], inicioDiaMs: number): BloqueColocado[] {
  const finDiaMs = inicioDiaMs + 24 * 60 * 60 * 1000;
  const bloques = ocurrencias
    .filter((o) => !o.evento.todoElDia && o.inicioMs < finDiaMs && o.finMs > inicioDiaMs)
    .map((o) => ({
      ocurrencia: o,
      inicioMin: Math.max(0, (o.inicioMs - inicioDiaMs) / 60000),
      // Mínimo 15 minutos de alto para que siempre se pueda pulsar
      finMin: Math.min(
        1440,
        Math.max((o.finMs - inicioDiaMs) / 60000, (o.inicioMs - inicioDiaMs) / 60000 + 15),
      ),
      columna: 0,
      totalColumnas: 1,
    }))
    .sort((a, b) => a.inicioMin - b.inicioMin || b.finMin - a.finMin);

  // Agrupamos en "racimos" de bloques que se solapan en cadena
  let racimo: typeof bloques = [];
  let finRacimo = -1;
  const cerrar = () => {
    const columnas: number[] = []; // minuto en que queda libre cada columna
    for (const b of racimo) {
      let col = columnas.findIndex((libre) => libre <= b.inicioMin);
      if (col === -1) {
        col = columnas.length;
        columnas.push(0);
      }
      columnas[col] = b.finMin;
      b.columna = col;
    }
    for (const b of racimo) b.totalColumnas = columnas.length;
  };
  for (const b of bloques) {
    if (b.inicioMin >= finRacimo && racimo.length) {
      cerrar();
      racimo = [];
    }
    racimo.push(b);
    finRacimo = Math.max(finRacimo, b.finMin);
  }
  if (racimo.length) cerrar();
  return bloques;
}
