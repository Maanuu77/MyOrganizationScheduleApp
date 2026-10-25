import { describe, expect, it } from 'vitest';
import {
  aCsv,
  calcularPeriodo,
  cumplimientoBloques,
  distribucionDiaSemana,
  distribucionFranja,
  duracionMediaSesion,
  focoPorEtiqueta,
  mapaCalor,
  periodoAnterior,
  progresoObjetivos,
  rachas,
  variacion,
} from './estadisticas';
import { ocurrenciaPrueba as oc, registroPrueba as reg } from './ayudaPruebas';
import type { Etiqueta } from './tipos';
import { claveDia } from './fechas';

const H = 3_600_000;

describe('periodos', () => {
  it('semana que empieza en lunes y su anterior', () => {
    const p = calcularPeriodo('semana', new Date(2026, 2, 12), 1); // jueves
    expect(claveDia(p.desde)).toBe('2026-03-09');
    expect(claveDia(p.hasta)).toBe('2026-03-16');
    const ant = periodoAnterior(p);
    expect(claveDia(ant.desde)).toBe('2026-03-02');
    expect(ant.hasta).toBe(p.desde);
  });

  it('mes y rango personalizado', () => {
    const mes = calcularPeriodo('mes', new Date(2026, 1, 10), 1);
    expect(claveDia(mes.desde)).toBe('2026-02-01');
    expect(claveDia(mes.hasta)).toBe('2026-03-01');
    const rango = calcularPeriodo('rango', new Date(), 1, {
      desde: '2026-01-01',
      hasta: '2026-01-10',
    });
    expect(claveDia(periodoAnterior(rango).desde)).toBe('2025-12-22');
  });
});

describe('foco por etiqueta', () => {
  it('compara planificado con real', () => {
    const desde = new Date(2026, 2, 1).getTime();
    const hasta = new Date(2026, 3, 1).getTime();
    const filas = focoPorEtiqueta(
      [
        reg(new Date(2026, 2, 3, 9), 50, { etiquetaId: 'mates' }),
        reg(new Date(2026, 2, 4, 9), 25, { etiquetaId: 'mates' }),
      ],
      [
        oc('s1', new Date(2026, 2, 3, 9), 120, { tipo: 'sesion', etiquetaId: 'mates' }),
        oc('ev', new Date(2026, 2, 3, 12), 60),
      ],
      desde,
      hasta,
    );
    expect(filas).toEqual([{ etiquetaId: 'mates', planificadoMs: 2 * H, realMs: 75 * 60000 }]);
  });

  it('progreso hacia el objetivo semanal', () => {
    const etiqueta = {
      id: 'ing',
      nombre: 'Inglés',
      objetivoSemanalHoras: 2,
      archivada: false,
    } as Etiqueta;
    const semana = new Date(2026, 2, 9).getTime();
    const p = progresoObjetivos(
      [etiqueta],
      [reg(new Date(2026, 2, 10, 18), 60, { etiquetaId: 'ing' })],
      semana,
    );
    expect(p[0].porcentaje).toBeCloseTo(0.5);
  });
});

describe('rachas y distribuciones', () => {
  const hoy = new Date(2026, 2, 10, 20);
  const registros = [
    reg(new Date(2026, 2, 1, 10), 30),
    reg(new Date(2026, 2, 2, 10), 30),
    reg(new Date(2026, 2, 3, 10), 30),
    reg(new Date(2026, 2, 8, 10), 30),
    reg(new Date(2026, 2, 9, 10), 30),
  ];

  it('racha actual (hoy sin foco no la rompe) y mejor racha', () => {
    expect(rachas(registros, hoy)).toEqual({ actual: 2, mejor: 3 });
  });

  it('mapa de calor con un año completo', () => {
    const celdas = mapaCalor(registros, 2026);
    expect(celdas).toHaveLength(365);
    expect(celdas.filter((c) => c.nivel > 0)).toHaveLength(5);
  });

  it('distribución por día y por franja', () => {
    const dias = distribucionDiaSemana(registros);
    expect(dias[0]).toBe(2 * 30 * 60000); // domingos 1 y 8 de marzo
    const franjas = distribucionFranja([reg(new Date(2026, 2, 1, 9, 30), 60)]);
    expect(franjas[9]).toBeCloseTo(30 * 60000);
    expect(franjas[10]).toBeCloseTo(30 * 60000);
    expect(duracionMediaSesion(registros)).toBe(30 * 60000);
  });
});

describe('otros cálculos', () => {
  it('cumplimiento de bloques pasados', () => {
    const lista = [
      oc('a', new Date(2026, 2, 1, 9), 60, { completado: true }),
      oc('b', new Date(2026, 2, 1, 11), 60),
      oc('p', new Date(2026, 2, 1, 13), 60, { tipo: 'protegido' }),
      oc('futuro', new Date(2026, 2, 20, 9), 60),
    ];
    expect(cumplimientoBloques(lista, new Date(2026, 2, 10).getTime())).toEqual({
      hechos: 1,
      total: 2,
      ratio: 0.5,
    });
  });

  it('variación y CSV', () => {
    expect(variacion(15, 10)).toBeCloseTo(0.5);
    expect(variacion(5, 0)).toBeNull();
    const csv = aCsv([{ a: 'x;y', b: 2 }]);
    expect(csv).toContain('a;b');
    expect(csv).toContain('"x;y";2');
  });
});
