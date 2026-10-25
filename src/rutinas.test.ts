import { describe, expect, it } from 'vitest';
import type { EjecucionRutina, Rutina } from './tipos';
import { duracionRutinaMin, rutinaTocaEnDia, seguimientoRutina } from './rutinas';
import { colocarBloques } from './distribucion';
import { ocurrenciaPrueba as oc } from './ayudaPruebas';
import { diferenciaRecordatorios, generarRecordatorios } from './recordatorios';
import { ajustesPrueba } from './ayudaPruebas';

function rutina(parcial: Partial<Rutina>): Rutina {
  return {
    id: 'r1',
    nombre: 'Mañana',
    ambito: 'dia',
    clase: 'pasos',
    color: '#000',
    etiquetaId: null,
    pasos: [
      {
        id: 'p1',
        titulo: 'Agua',
        hora: null,
        duracionMin: 5,
        etiquetaId: null,
        descripcion: '',
        aviso: false,
      },
      {
        id: 'p2',
        titulo: 'Leer',
        hora: null,
        duracionMin: 20,
        etiquetaId: null,
        descripcion: '',
        aviso: false,
      },
    ],
    cicloId: null,
    programacion: { diasSemana: [1, 2, 3, 4, 5], mensual: null, hora: '07:30' },
    avisos: { activo: true, minutosAntes: 5 },
    mostrarEnCalendario: false,
    eventoCalendarioId: null,
    archivada: false,
    creadoEnMs: new Date(2026, 2, 2).getTime(), // lunes
    actualizadoEnMs: 0,
    ...parcial,
  };
}

const ejecucion = (
  fecha: string,
  completada: boolean,
  hechos: string[] = completada ? ['p1', 'p2'] : ['p1'],
): EjecucionRutina => ({
  id: fecha,
  rutinaId: 'r1',
  fecha,
  inicioMs: 0,
  finMs: null,
  pasosHechos: hechos,
  pasosTotales: 2,
  completada,
  indicePaso: 0,
  inicioPasoMs: null,
  creadoEnMs: 0,
  actualizadoEnMs: 0,
});

describe('rutinas', () => {
  it('toca solo los días elegidos y desde su creación', () => {
    const r = rutina({});
    expect(rutinaTocaEnDia(r, new Date(2026, 2, 4))).toBe(true); // miércoles
    expect(rutinaTocaEnDia(r, new Date(2026, 2, 7))).toBe(false); // sábado
    expect(rutinaTocaEnDia(r, new Date(2026, 1, 25))).toBe(false); // antes de crearla
  });

  it('rutina mensual el primer lunes', () => {
    const r = rutina({
      ambito: 'mes',
      programacion: {
        diasSemana: [],
        mensual: { modo: 'ordinal', ordinal: 1, diaSemana: 1 },
        hora: null,
      },
    });
    expect(rutinaTocaEnDia(r, new Date(2026, 3, 6))).toBe(true);
    expect(rutinaTocaEnDia(r, new Date(2026, 3, 13))).toBe(false);
  });

  it('seguimiento: cumplimiento, racha y pasos', () => {
    const r = rutina({});
    const hoy = new Date(2026, 2, 6, 12); // viernes
    const s = seguimientoRutina(
      r,
      [
        ejecucion('2026-03-02', true),
        ejecucion('2026-03-03', false),
        ejecucion('2026-03-04', true),
        ejecucion('2026-03-05', true),
      ],
      new Date(2026, 2, 2),
      new Date(2026, 2, 9),
      hoy,
    );
    expect(s.programadas).toBe(5); // lunes a viernes (hoy incluido)
    expect(s.completadas).toBe(3);
    expect(s.racha).toBe(2); // miércoles y jueves; hoy aún no cuenta en contra
    expect(s.porcentajePasos).toBeCloseTo((1 + 0.5 + 1 + 1) / 5);
    expect(duracionRutinaMin(r)).toBe(25);
  });
});

describe('colocarBloques', () => {
  it('reparte en columnas los bloques solapados', () => {
    const base = new Date(2026, 2, 10);
    const bloques = colocarBloques(
      [
        oc('a', new Date(2026, 2, 10, 9), 60),
        oc('b', new Date(2026, 2, 10, 9, 30), 60),
        oc('c', new Date(2026, 2, 10, 12), 30),
      ],
      base.getTime(),
    );
    const porId = Object.fromEntries(bloques.map((b) => [b.ocurrencia.evento.id, b]));
    expect(porId.a.totalColumnas).toBe(2);
    expect(porId.b.columna).toBe(1);
    expect(porId.c.totalColumnas).toBe(1);
    expect(porId.a.inicioMin).toBe(540);
  });
});

describe('recordatorios', () => {
  const ajustes = ajustesPrueba();
  ajustes.notificaciones = {
    ...ajustes.notificaciones,
    activas: true,
    silencio: { activo: true, inicio: '23:00', fin: '07:00' },
  };
  const ahora = new Date(2026, 2, 10, 8).getTime();

  it('genera inicio de bloque con antelación y respeta el silencio nocturno', () => {
    const lista = generarRecordatorios({
      uid: 'u',
      ajustes,
      ocurrencias: [
        oc('clase', new Date(2026, 2, 10, 10), 60),
        oc('noche', new Date(2026, 2, 10, 23, 30), 30),
      ],
      tareas: [],
      rutinas: [],
      avisos: [],
      ahoraMs: ahora,
    });
    const inicios = lista.filter((r) => r.tipo === 'inicioBloque');
    expect(inicios).toHaveLength(1);
    expect(inicios[0].fireAt).toBe(new Date(2026, 2, 10, 9, 50).getTime());
  });

  it('no genera nada si las notificaciones están desactivadas', () => {
    expect(
      generarRecordatorios({
        uid: 'u',
        ajustes: ajustesPrueba(),
        ocurrencias: [oc('a', new Date(2026, 2, 10, 10), 60)],
        tareas: [],
        rutinas: [],
        avisos: [],
        ahoraMs: ahora,
      }),
    ).toHaveLength(0);
  });

  it('calcula la diferencia con los existentes', () => {
    const deseados = [
      {
        id: 'a',
        uid: 'u',
        tipo: 'inicioBloque' as const,
        refId: 'x',
        fireAt: 1,
        titulo: 'A',
        cuerpo: '',
        url: '/',
        enviado: false,
      },
    ];
    const { crear, borrar } = diferenciaRecordatorios(
      [
        { id: 'a', fireAt: 1, titulo: 'A', cuerpo: '', tipo: 'inicioBloque' },
        { id: 'viejo', fireAt: 1, titulo: 'B', cuerpo: '', tipo: 'inicioBloque' },
        { id: 'timer', fireAt: 1, titulo: 'T', cuerpo: '', tipo: 'faseTemporizador' },
      ],
      deseados,
    );
    expect(crear).toHaveLength(0);
    expect(borrar).toEqual(['viejo']);
  });
});
