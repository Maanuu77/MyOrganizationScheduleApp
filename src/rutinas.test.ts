import { describe, expect, it } from 'vitest';
import type { EjecucionRutina, Etiqueta, Rutina, TramoSesion } from './tipos';
import {
  describirDias,
  duracionRutinaMin,
  fasesDeRutina,
  normalizarRutina,
  repartirPorPasos,
  rutinaTocaEnDia,
  seguimientoRutina,
} from './rutinas';
import { colocarBloques } from './distribucion';
import { ocurrenciaPrueba as oc } from './ayudaPruebas';
import { diferenciaRecordatorios, generarRecordatorios } from './recordatorios';
import { ajustesPrueba } from './ayudaPruebas';

/** Rutina de ejemplo: Teoría 50 min, descanso 10, Psicotécnicos 20 min. */
function rutina(parcial: Partial<Rutina> = {}): Rutina {
  return {
    id: 'r1',
    nombre: 'Tarde de estudio',
    color: '#000000',
    pasos: [
      {
        id: 'p1',
        nombre: 'Teoría',
        duracionMin: 50,
        etiquetaId: 'e1',
        tareaId: 't1',
        descansoMin: 10,
      },
      {
        id: 'p2',
        nombre: 'Psicotécnicos',
        duracionMin: 20,
        etiquetaId: 'e2',
        tareaId: null,
        descansoMin: 10,
      },
    ],
    descansoPorDefectoMin: 10,
    programacion: { diasSemana: [1, 2, 3, 4, 5], hora: '16:00' },
    avisos: { activo: true, minutosAntes: 5 },
    mostrarEnCalendario: false,
    eventoCalendarioId: null,
    archivada: false,
    creadoEnMs: new Date(2026, 2, 2).getTime(), // lunes
    actualizadoEnMs: 0,
    ...parcial,
  };
}

const etiqueta = (id: string, color: string) => ({ id, color }) as Etiqueta;

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

const tramo = (indiceFase: number, inicioMin: number, minutos: number): TramoSesion => ({
  tipo: 'personalizada',
  indiceFase,
  inicioMs: inicioMin * 60_000,
  finMs: (inicioMin + minutos) * 60_000,
  duracionMs: minutos * 60_000,
});

describe('rutinas', () => {
  it('dura lo que sus pasos más los descansos entre ellos (no el del final)', () => {
    expect(duracionRutinaMin(rutina())).toBe(80);
  });

  it('se convierte en fases del contador con descansos y el color de cada etiqueta', () => {
    const fases = fasesDeRutina(rutina(), [etiqueta('e1', '#ff0000')]);
    expect(fases.map((f) => [f.nombre, f.duracionMs / 60_000])).toEqual([
      ['Teoría', 50],
      ['Descanso', 10],
      ['Psicotécnicos', 20],
    ]);
    expect(fases[0]).toMatchObject({
      tipo: 'personalizada',
      color: '#ff0000',
      pasoId: 'p1',
      tareaId: 't1',
    });
    expect(fases[1].tipo).toBe('descansoCorto');
    // Sin etiqueta conocida, el color de la rutina
    expect(fases[2].color).toBe('#000000');
  });

  it('un descanso de 0 minutos no crea fase', () => {
    const r = rutina();
    r.pasos[0].descansoMin = 0;
    expect(fasesDeRutina(r, [])).toHaveLength(2);
  });

  it('reparte el tiempo entre los pasos y marca los hechos', () => {
    const fases = fasesDeRutina(rutina(), []);
    // Teoría completa (con una pausa partida en dos tramos), descanso entero y 5 min de psicotécnicos
    const { pasos, hechos } = repartirPorPasos(fases, [
      tramo(0, 0, 30),
      tramo(0, 35, 20),
      { ...tramo(1, 55, 10), tipo: 'descansoCorto' },
      tramo(2, 65, 5),
    ]);
    expect(hechos).toEqual(['p1']);
    expect(pasos).toHaveLength(2);
    expect(pasos[0]).toMatchObject({
      pasoId: 'p1',
      etiquetaId: 'e1',
      tareaId: 't1',
      focoRealMs: 50 * 60_000,
      descansosMs: 10 * 60_000,
      inicioMs: 0,
      finMs: 65 * 60_000,
    });
    expect(pasos[1]).toMatchObject({ pasoId: 'p2', etiquetaId: 'e2', focoRealMs: 5 * 60_000 });
  });

  it('toca solo los días elegidos y desde su creación; sin días, nunca', () => {
    const r = rutina();
    expect(rutinaTocaEnDia(r, new Date(2026, 2, 4))).toBe(true); // miércoles
    expect(rutinaTocaEnDia(r, new Date(2026, 2, 7))).toBe(false); // sábado
    expect(rutinaTocaEnDia(r, new Date(2026, 1, 25))).toBe(false); // antes de crearla
    const sinDias = rutina({ programacion: { diasSemana: [], hora: null } });
    expect(rutinaTocaEnDia(sinDias, new Date(2026, 2, 4))).toBe(false);
  });

  it('describe los días de forma natural', () => {
    expect(describirDias([1, 2, 3, 4, 5], 1)).toBe('De lunes a viernes');
    expect(describirDias([0, 1, 2, 3, 4, 5, 6], 1)).toBe('Todos los días');
    expect(describirDias([0, 6], 1)).toBe('Fines de semana');
    expect(describirDias([5, 1, 3], 1)).toBe('lun, mié, vie');
  });

  it('seguimiento: cumplimiento, racha y pasos', () => {
    const r = rutina();
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
  });
});

describe('rutinas antiguas', () => {
  it('una lista de pasos conserva sus pasos y sus días', () => {
    const r = normalizarRutina(
      {
        id: 'v1',
        nombre: 'Mañana',
        ambito: 'dia',
        clase: 'pasos',
        etiquetaId: 'e9',
        pasos: [
          { id: 'a', titulo: 'Agua', duracionMin: 5 },
          { id: 'b', titulo: 'Leer', duracionMin: null },
        ],
        programacion: { diasSemana: [], hora: '07:30' },
      },
      [],
    );
    expect(r.programacion).toEqual({ diasSemana: [0, 1, 2, 3, 4, 5, 6], hora: '07:30' });
    expect(r.pasos).toEqual([
      { id: 'a', nombre: 'Agua', duracionMin: 5, etiquetaId: 'e9', tareaId: null, descansoMin: 0 },
      { id: 'b', nombre: 'Leer', duracionMin: 10, etiquetaId: 'e9', tareaId: null, descansoMin: 0 },
    ]);
  });

  it('una rutina de estudio se convierte en pasos con los descansos de su ciclo', () => {
    const r = normalizarRutina(
      {
        id: 'v2',
        nombre: 'Estudio',
        ambito: 'mes',
        clase: 'estudio',
        cicloId: 'c1',
        etiquetaId: 'e1',
      },
      [
        {
          id: 'c1',
          nombre: 'Pomodoro',
          fases: [
            { id: 'f', tipo: 'foco', nombre: 'Foco', color: '#000', duracionMin: 25 },
            { id: 'd', tipo: 'descansoCorto', nombre: 'Descanso', color: '#000', duracionMin: 5 },
          ],
          repeticiones: 2,
          descansoLargoCada: null,
          descansoLargoMin: 15,
          creadoEnMs: 0,
          actualizadoEnMs: 0,
        },
      ],
    );
    // Las mensuales ya no existen: queda para empezarla cuando quieras
    expect(r.programacion.diasSemana).toEqual([]);
    expect(r.pasos.map((p) => [p.nombre, p.duracionMin, p.descansoMin, p.etiquetaId])).toEqual([
      ['Foco', 25, 5, 'e1'],
      ['Foco', 25, 5, 'e1'],
    ]);
  });

  it('una rutina ya nueva no cambia', () => {
    const nueva = rutina();
    expect(normalizarRutina(nueva, [])).toEqual(nueva);
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
