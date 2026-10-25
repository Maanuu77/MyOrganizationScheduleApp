import { describe, expect, it } from 'vitest';
import {
  calcularAvance,
  expandirCiclo,
  focoContinuoMs,
  plantillasDeArranque,
  progresoFase,
  restanteMs,
  resumirTramos,
  type EstadoPlano,
} from './ciclos';

const MIN = 60_000;
let n = 0;
const id = () => `f${n++}`;

describe('expandirCiclo', () => {
  it('Pomodoro 25/5 con descanso largo cada 4', () => {
    const [pomodoro] = plantillasDeArranque(id);
    const fases = expandirCiclo(pomodoro);
    expect(fases.map((f) => f.tipo)).toEqual([
      'foco',
      'descansoCorto',
      'foco',
      'descansoCorto',
      'foco',
      'descansoCorto',
      'foco',
      'descansoLargo',
    ]);
    expect(fases.at(-1)?.duracionMs).toBe(15 * MIN);
    expect(fases[0].duracionMs).toBe(25 * MIN);
  });

  it('sin descanso largo repite la lista tal cual', () => {
    const [, cincuenta] = plantillasDeArranque(id);
    expect(expandirCiclo(cincuenta).map((f) => f.duracionMs / MIN)).toEqual([
      50, 10, 50, 10, 50, 10,
    ]);
  });

  it('respeta fases personalizadas e ignora duraciones a cero', () => {
    const fases = expandirCiclo({
      fases: [
        { id: 'a', tipo: 'foco', nombre: 'Foco', color: '#000', duracionMin: 30 },
        { id: 'b', tipo: 'personalizada', nombre: 'Repaso', color: '#111', duracionMin: 10 },
        { id: 'c', tipo: 'descansoCorto', nombre: 'Descanso', color: '#222', duracionMin: 0 },
      ],
      repeticiones: 2,
      descansoLargoCada: null,
      descansoLargoMin: 0,
    });
    expect(fases.map((f) => f.nombre)).toEqual(['Foco', 'Repaso', 'Foco', 'Repaso']);
  });
});

function estado(parcial: Partial<EstadoPlano>): EstadoPlano {
  return {
    estado: 'enCurso',
    modo: 'ciclo',
    fases: expandirCiclo(plantillasDeArranque(id)[0]),
    indiceFase: 0,
    inicioFaseMs: 0,
    duracionFaseMs: 25 * MIN,
    pausaAcumuladaMs: 0,
    pausadoEnMs: null,
    ...parcial,
  };
}

describe('cálculos del contador', () => {
  it('calcula el restante descontando pausas', () => {
    const e = estado({ pausaAcumuladaMs: 2 * MIN });
    expect(restanteMs(e, 10 * MIN)).toBe(17 * MIN);
    expect(progresoFase(e, 10 * MIN)).toBeCloseTo(8 / 25);
  });

  it('en pausa el tiempo se congela', () => {
    const e = estado({ estado: 'pausado', pausadoEnMs: 5 * MIN });
    expect(restanteMs(e, 60 * MIN)).toBe(20 * MIN);
  });

  it('no avanza si la fase no ha terminado', () => {
    expect(calcularAvance(estado({}), 24 * MIN, true)).toBeNull();
  });

  it('avanza a la siguiente fase al terminar', () => {
    const r = calcularAvance(estado({}), 26 * MIN, true)!;
    expect(r.indiceFase).toBe(1);
    expect(r.inicioFaseMs).toBe(25 * MIN);
    expect(r.duracionFaseMs).toBe(5 * MIN);
    expect(r.tramosNuevos).toHaveLength(1);
    expect(r.esperando).toBe(false);
  });

  it('se pone al día si el dispositivo estuvo dormido varias fases', () => {
    // 25 + 5 + 25 = 55 min → a los 57 min estamos en el 2º descanso corto
    const r = calcularAvance(estado({}), 57 * MIN, true)!;
    expect(r.indiceFase).toBe(3);
    expect(r.inicioFaseMs).toBe(55 * MIN);
    expect(r.fasesTerminadas).toBe(3);
  });

  it('sin avance automático espera al usuario', () => {
    const r = calcularAvance(estado({}), 40 * MIN, false)!;
    expect(r.indiceFase).toBe(1);
    expect(r.esperando).toBe(true);
    expect(r.fasesTerminadas).toBe(1);
  });

  it('detecta el final del ciclo', () => {
    const e = estado({});
    const total = e.fases.reduce((s, f) => s + f.duracionMs, 0);
    const r = calcularAvance(e, total + MIN, true)!;
    expect(r.cicloTerminado).toBe(true);
    expect(r.tramosNuevos).toHaveLength(8);
    expect(resumirTramos(r.tramosNuevos).focoMs).toBe(100 * MIN);
  });

  it('el modo cronómetro nunca avanza', () => {
    expect(
      calcularAvance(estado({ modo: 'cronometro', duracionFaseMs: 0 }), 999 * MIN, true),
    ).toBeNull();
  });

  it('foco continuo suma tramos de foco seguidos', () => {
    const tramos = [
      { tipo: 'descansoCorto' as const, inicioMs: 0, finMs: 5, duracionMs: 5 * MIN },
      { tipo: 'foco' as const, inicioMs: 5, finMs: 30, duracionMs: 25 * MIN },
    ];
    expect(focoContinuoMs(tramos, 'foco', 10 * MIN)).toBe(35 * MIN);
    expect(focoContinuoMs(tramos, 'descansoCorto', 10 * MIN)).toBe(0);
  });
});
