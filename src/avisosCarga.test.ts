import { describe, expect, it } from 'vitest';
import {
  detectarAvisos,
  detectarFechasLimite,
  detectarFocoExcesivo,
  detectarSesionesSeguidas,
  detectarSolapes,
  detectarSueno,
  protegidosQueChocan,
} from './avisosCarga';
import { ajustesPrueba, ocurrenciaPrueba as oc, tareaPrueba } from './ayudaPruebas';

const dia = (h: number, m = 0) => new Date(2026, 2, 10, h, m);

describe('detectarSolapes', () => {
  it('encuentra dos bloques que coinciden', () => {
    const avisos = detectarSolapes([
      oc('a', dia(9), 60),
      oc('b', dia(9, 30), 60),
      oc('c', dia(11), 30),
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].claves).toHaveLength(2);
    expect(avisos[0].severidad).toBe('aviso');
  });

  it('marca como grave pisar un bloque protegido', () => {
    const avisos = detectarSolapes([
      oc('comida', dia(14), 60, { tipo: 'protegido' }),
      oc('b', dia(14, 30), 30),
    ]);
    expect(avisos[0].severidad).toBe('grave');
  });

  it('bloques que solo se tocan no se solapan', () => {
    expect(detectarSolapes([oc('a', dia(9), 60), oc('b', dia(10), 60)])).toHaveLength(0);
  });

  it('ignora los eventos de todo el día', () => {
    expect(
      detectarSolapes([oc('a', dia(0), 1440, { todoElDia: true }), oc('b', dia(10), 60)]),
    ).toHaveLength(0);
  });
});

describe('sobrecarga de foco', () => {
  const ajustes = ajustesPrueba({
    umbrales: {
      focoDiarioMaxHoras: 3,
      sesionesSeguidasMax: 2,
      descansoMinimoMin: 10,
      diasAvisoFechaLimite: 3,
    },
  });

  it('avisa si se supera el umbral diario', () => {
    const sesiones = [
      oc('a', dia(8), 120, { tipo: 'sesion' }),
      oc('b', dia(12), 90, { tipo: 'sesion' }),
    ];
    expect(detectarFocoExcesivo(sesiones, ajustes)).toHaveLength(1);
    expect(detectarFocoExcesivo(sesiones.slice(0, 1), ajustes)).toHaveLength(0);
  });

  it('avisa de demasiadas sesiones seguidas sin descanso', () => {
    const sesiones = [
      oc('a', dia(8), 50, { tipo: 'sesion' }),
      oc('b', dia(8, 55), 50, { tipo: 'sesion' }), // 5 min de hueco < 10
      oc('c', dia(9, 50), 50, { tipo: 'sesion' }), // 5 min de hueco
    ];
    expect(detectarSesionesSeguidas(sesiones, ajustes)).toHaveLength(1);
    const conDescanso = [sesiones[0], sesiones[1], oc('c', dia(10, 30), 50, { tipo: 'sesion' })];
    expect(detectarSesionesSeguidas(conDescanso, ajustes)).toHaveLength(0);
  });
});

describe('fechas límite', () => {
  const ajustes = ajustesPrueba();
  const ahora = dia(8).getTime();

  it('avisa si no hay tiempo planificado suficiente', () => {
    const tarea = tareaPrueba({ id: 't1', fechaLimiteMs: dia(20).getTime(), estimacionMin: 120 });
    const bloque = oc('b', dia(10), 60, { tareaId: 't1' });
    expect(detectarFechasLimite([tarea], [bloque], ajustes, ahora)).toHaveLength(1);
    const suficiente = oc('b2', dia(12), 60, { tareaId: 't1' });
    expect(detectarFechasLimite([tarea], [bloque, suficiente], ajustes, ahora)).toHaveLength(0);
  });

  it('avisa de tareas vencidas y no de las completadas', () => {
    const vencida = tareaPrueba({ id: 'v', fechaLimiteMs: dia(7).getTime() });
    const hecha = tareaPrueba({ id: 'h', fechaLimiteMs: dia(7).getTime(), completada: true });
    const avisos = detectarFechasLimite([vencida, hecha], [], ajustes, ahora);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].severidad).toBe('grave');
  });

  it('ignora fechas límite lejanas', () => {
    const lejana = tareaPrueba({ fechaLimiteMs: new Date(2026, 5, 1).getTime() });
    expect(detectarFechasLimite([lejana], [], ajustes, ahora)).toHaveLength(0);
  });
});

describe('horario de sueño', () => {
  it('detecta bloques de madrugada y de noche, también cruzando medianoche', () => {
    const ajustes = ajustesPrueba({ sueno: { activo: true, inicio: '23:00', fin: '07:00' } });
    const avisos = detectarSueno(
      [oc('madrugada', dia(6), 60), oc('dia', dia(12), 60), oc('noche', dia(22, 30), 90)],
      ajustes,
    );
    expect(avisos.map((a) => a.claves[0].split('_')[0])).toEqual(['madrugada', 'noche']);
  });

  it('no avisa si el usuario no ha definido sueño', () => {
    expect(detectarSueno([oc('a', dia(3), 60)], ajustesPrueba())).toHaveLength(0);
  });
});

describe('detectarAvisos y protegidos', () => {
  it('ordena por fecha y gravedad', () => {
    const ajustes = ajustesPrueba();
    const avisos = detectarAvisos(
      [oc('a', dia(9), 60), oc('b', dia(9, 30), 60, { tipo: 'protegido' })],
      [],
      ajustes,
      dia(0).getTime(),
    );
    expect(avisos[0].severidad).toBe('grave');
  });

  it('encuentra los protegidos que chocan con un hueco', () => {
    const lista = [oc('sueño', dia(0), 420, { tipo: 'protegido' }), oc('clase', dia(9), 60)];
    expect(protegidosQueChocan(lista, dia(6).getTime(), dia(8).getTime())).toHaveLength(1);
    expect(protegidosQueChocan(lista, dia(8).getTime(), dia(10).getTime())).toHaveLength(0);
  });
});
