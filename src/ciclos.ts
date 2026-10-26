// Motor de ciclos de estudio y cálculos del contador.
// Son funciones puras (sin Firebase ni React) para poder probarlas con Vitest.

import type { Fase, FaseExpandida, PlantillaCiclo, TipoFase, TramoSesion } from './tipos';
import { MS_MINUTO } from './fechas';

export const COLORES_FASE: Record<TipoFase, string> = {
  foco: '#6D5CF0',
  descansoCorto: '#12A37F',
  descansoLargo: '#0EA5E9',
  personalizada: '#E8A317',
};

export const NOMBRES_FASE: Record<TipoFase, string> = {
  foco: 'Foco',
  descansoCorto: 'Descanso corto',
  descansoLargo: 'Descanso largo',
  personalizada: 'Fase personalizada',
};

/** ¿La fase cuenta como tiempo de foco? Las personalizadas cuentan como foco salvo que sean descanso. */
export function esFoco(tipo: TipoFase): boolean {
  return tipo === 'foco' || tipo === 'personalizada';
}

export function nuevaFase(tipo: TipoFase, duracionMin: number, id: string): Fase {
  return { id, tipo, nombre: NOMBRES_FASE[tipo], color: COLORES_FASE[tipo], duracionMin };
}

/** Plantillas de arranque opcionales (el usuario decide si las añade). */
export function plantillasDeArranque(
  crearId: () => string,
): Array<
  Pick<
    PlantillaCiclo,
    'nombre' | 'fases' | 'repeticiones' | 'descansoLargoCada' | 'descansoLargoMin'
  >
> {
  return [
    {
      nombre: 'Pomodoro 25/5',
      fases: [nuevaFase('foco', 25, crearId()), nuevaFase('descansoCorto', 5, crearId())],
      repeticiones: 4,
      descansoLargoCada: 4,
      descansoLargoMin: 15,
    },
    {
      nombre: 'Bloque 50/10',
      fases: [nuevaFase('foco', 50, crearId()), nuevaFase('descansoCorto', 10, crearId())],
      repeticiones: 3,
      descansoLargoCada: null,
      descansoLargoMin: 20,
    },
    {
      nombre: 'Inmersión 90/20',
      fases: [nuevaFase('foco', 90, crearId()), nuevaFase('descansoCorto', 20, crearId())],
      repeticiones: 2,
      descansoLargoCada: null,
      descansoLargoMin: 30,
    },
  ];
}

/**
 * Despliega una plantilla en la lista real de fases que ejecuta el contador.
 * Ejemplo Pomodoro (4 repeticiones, largo cada 4): F C F C F C F L
 */
export function expandirCiclo(
  plantilla: Pick<
    PlantillaCiclo,
    'fases' | 'repeticiones' | 'descansoLargoCada' | 'descansoLargoMin'
  >,
): FaseExpandida[] {
  const resultado: FaseExpandida[] = [];
  const repeticiones = Math.max(1, Math.floor(plantilla.repeticiones || 1));
  const cada =
    plantilla.descansoLargoCada && plantilla.descansoLargoCada > 0
      ? plantilla.descansoLargoCada
      : null;
  let focos = 0;
  for (let r = 0; r < repeticiones; r++) {
    for (const fase of plantilla.fases) {
      if (fase.duracionMin <= 0) continue;
      if (fase.tipo === 'foco') focos++;
      if (fase.tipo === 'descansoCorto' && cada && focos > 0 && focos % cada === 0) {
        resultado.push({
          tipo: 'descansoLargo',
          nombre: NOMBRES_FASE.descansoLargo,
          color: COLORES_FASE.descansoLargo,
          duracionMs: plantilla.descansoLargoMin * MS_MINUTO,
        });
        continue;
      }
      resultado.push({
        tipo: fase.tipo,
        nombre: fase.nombre || NOMBRES_FASE[fase.tipo],
        color: fase.color || COLORES_FASE[fase.tipo],
        duracionMs: fase.duracionMin * MS_MINUTO,
      });
    }
  }
  return resultado;
}

/** Duración total de un ciclo desplegado. */
export function duracionTotal(fases: FaseExpandida[]): number {
  return fases.reduce((suma, f) => suma + f.duracionMs, 0);
}

/** Tiempo de foco total de un ciclo desplegado. */
export function focoTotal(fases: FaseExpandida[]): number {
  return fases.filter((f) => esFoco(f.tipo)).reduce((s, f) => s + f.duracionMs, 0);
}

// ---------------------------------------------------------------------------
// Cálculos del contador. El estado se guarda con marcas de tiempo, nunca con
// "segundos restantes": así cualquier dispositivo calcula lo mismo en cualquier momento.
// ---------------------------------------------------------------------------

export interface EstadoPlano {
  estado: 'inactivo' | 'enCurso' | 'pausado' | 'esperando';
  modo: 'ciclo' | 'cronometro';
  fases: FaseExpandida[];
  indiceFase: number;
  inicioFaseMs: number | null;
  duracionFaseMs: number;
  pausaAcumuladaMs: number;
  pausadoEnMs: number | null;
}

/** Tiempo transcurrido de la fase actual, descontando pausas. */
export function transcurridoMs(e: EstadoPlano, ahoraMs: number): number {
  if (e.inicioFaseMs === null) return 0;
  const referencia = e.estado === 'pausado' && e.pausadoEnMs !== null ? e.pausadoEnMs : ahoraMs;
  return Math.max(0, referencia - e.inicioFaseMs - e.pausaAcumuladaMs);
}

/** Tiempo que le queda a la fase actual (puede ser negativo si ya terminó). */
export function restanteMs(e: EstadoPlano, ahoraMs: number): number {
  return e.duracionFaseMs - transcurridoMs(e, ahoraMs);
}

/** Progreso 0..1 de la fase actual. */
export function progresoFase(e: EstadoPlano, ahoraMs: number): number {
  if (e.modo === 'cronometro' || e.duracionFaseMs <= 0) return 0;
  return Math.min(1, Math.max(0, transcurridoMs(e, ahoraMs) / e.duracionFaseMs));
}

export interface ResultadoAvance {
  indiceFase: number;
  inicioFaseMs: number;
  duracionFaseMs: number;
  tramosNuevos: TramoSesion[];
  fasesTerminadas: number;
  /** Se ha llegado al final del ciclo. */
  cicloTerminado: boolean;
  /** Se ha parado esperando a que el usuario pulse "Seguir". */
  esperando: boolean;
}

/**
 * Si la fase actual (y quizá varias más, si el dispositivo estuvo dormido) ya ha
 * terminado, calcula a qué fase hay que saltar y cuándo empezó realmente.
 * Devuelve null si no hay que cambiar nada.
 */
export function calcularAvance(
  e: EstadoPlano,
  ahoraMs: number,
  autoAvanzar: boolean,
): ResultadoAvance | null {
  if (e.estado !== 'enCurso' || e.modo !== 'ciclo' || e.inicioFaseMs === null) return null;
  if (restanteMs(e, ahoraMs) > 0) return null;

  const tramosNuevos: TramoSesion[] = [];
  let indice = e.indiceFase;
  let inicio = e.inicioFaseMs;
  let pausa = e.pausaAcumuladaMs;
  let duracion = e.duracionFaseMs;
  let terminadas = 0;

  // Mientras la fase actual haya terminado, la cerramos y pasamos a la siguiente.
  while (true) {
    const fin = inicio + pausa + duracion;
    if (fin > ahoraMs) break;
    tramosNuevos.push({
      tipo: e.fases[indice]?.tipo ?? 'foco',
      indiceFase: indice,
      inicioMs: inicio,
      finMs: fin,
      duracionMs: duracion,
    });
    terminadas++;
    indice++;
    inicio = fin;
    pausa = 0;
    if (indice >= e.fases.length) {
      return {
        indiceFase: e.fases.length,
        inicioFaseMs: fin,
        duracionFaseMs: 0,
        tramosNuevos,
        fasesTerminadas: terminadas,
        cicloTerminado: true,
        esperando: true,
      };
    }
    duracion = e.fases[indice].duracionMs;
    if (!autoAvanzar) {
      return {
        indiceFase: indice,
        inicioFaseMs: fin,
        duracionFaseMs: duracion,
        tramosNuevos,
        fasesTerminadas: terminadas,
        cicloTerminado: false,
        esperando: true,
      };
    }
  }
  return {
    indiceFase: indice,
    inicioFaseMs: inicio,
    duracionFaseMs: duracion,
    tramosNuevos,
    fasesTerminadas: terminadas,
    cicloTerminado: false,
    esperando: false,
  };
}

/**
 * Minutos de foco seguidos sin descanso: suma los tramos de foco finales consecutivos
 * más lo que lleva la fase actual si también es de foco.
 */
export function focoContinuoMs(
  tramos: TramoSesion[],
  tipoActual: TipoFase | null,
  transcurridoActual: number,
): number {
  let total = tipoActual && esFoco(tipoActual) ? transcurridoActual : 0;
  if (tipoActual && !esFoco(tipoActual)) return 0;
  for (let i = tramos.length - 1; i >= 0; i--) {
    if (!esFoco(tramos[i].tipo)) break;
    total += tramos[i].duracionMs;
  }
  return total;
}

/** Resumen de los tramos de una sesión: foco real y descansos. */
export function resumirTramos(tramos: TramoSesion[]): {
  focoMs: number;
  descansoMs: number;
  fasesFoco: number;
} {
  let focoMs = 0;
  let descansoMs = 0;
  let fasesFoco = 0;
  for (const t of tramos) {
    if (esFoco(t.tipo)) {
      focoMs += t.duracionMs;
      fasesFoco++;
    } else {
      descansoMs += t.duracionMs;
    }
  }
  return { focoMs, descansoMs, fasesFoco };
}

/** Mensaje claro de qué hacer al empezar una fase. */
export function mensajeFase(tipo: TipoFase, nombre: string): string {
  if (tipo === 'foco') return 'Vuelve al foco';
  if (tipo === 'descansoCorto') return 'Descansa ahora';
  if (tipo === 'descansoLargo') return 'Descanso largo: desconecta un rato';
  return `Empieza: ${nombre}`;
}
