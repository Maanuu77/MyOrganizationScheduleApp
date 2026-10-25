import { describe, expect, it } from 'vitest';
import type { Evento, ExcepcionEvento, ReglaRecurrencia } from './tipos';
import {
  caeEnDia,
  contarAntes,
  describirRegla,
  diaOrdinal,
  expandirOcurrencias,
  generarInicios,
  partirSerie,
} from './recurrencia';
import { claveDia } from './fechas';

function evento(parcial: Partial<Evento>): Evento {
  const inicio = new Date(2026, 0, 5, 9, 0).getTime(); // lunes 5 enero 2026, 09:00
  return {
    id: 'e1',
    tipo: 'evento',
    titulo: 'Clase',
    inicioMs: inicio,
    finMs: inicio + 60 * 60 * 1000,
    todoElDia: false,
    zonaHoraria: 'Europe/Madrid',
    etiquetaId: null,
    color: null,
    notas: '',
    recurrencia: null,
    cicloId: null,
    tareaId: null,
    completarTareaAlCompletar: false,
    rutinaId: null,
    completado: false,
    plantillaId: null,
    origenGoogle: null,
    creadoEnMs: 0,
    actualizadoEnMs: 0,
    ...parcial,
  };
}

function primeras(regla: ReglaRecurrencia, inicio: Date, n: number): string[] {
  const res: string[] = [];
  for (const f of generarInicios(regla, inicio)) {
    res.push(claveDia(f));
    if (res.length >= n) break;
  }
  return res;
}

const lunes = new Date(2026, 0, 5, 9, 0);

describe('generarInicios', () => {
  it('diaria cada 2 días', () => {
    const r: ReglaRecurrencia = { frecuencia: 'diaria', intervalo: 2, fin: { tipo: 'nunca' } };
    expect(primeras(r, lunes, 3)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09']);
  });

  it('semanal en lunes y miércoles', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'semanal',
      intervalo: 1,
      diasSemana: [3, 1],
      fin: { tipo: 'nunca' },
    };
    expect(primeras(r, lunes, 4)).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14']);
  });

  it('semanal cada 2 semanas', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'semanal',
      intervalo: 2,
      diasSemana: [1],
      fin: { tipo: 'nunca' },
    };
    expect(primeras(r, lunes, 3)).toEqual(['2026-01-05', '2026-01-19', '2026-02-02']);
  });

  it('no incluye días de la primera semana anteriores al inicio', () => {
    const miercoles = new Date(2026, 0, 7, 9, 0);
    const r: ReglaRecurrencia = {
      frecuencia: 'semanal',
      intervalo: 1,
      diasSemana: [1, 5],
      fin: { tipo: 'nunca' },
    };
    expect(primeras(r, miercoles, 2)).toEqual(['2026-01-09', '2026-01-12']);
  });

  it('mensual el día 31 se salta los meses cortos', () => {
    const inicio = new Date(2026, 0, 31, 10, 0);
    const r: ReglaRecurrencia = { frecuencia: 'mensual', intervalo: 1, fin: { tipo: 'nunca' } };
    expect(primeras(r, inicio, 3)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('mensual el primer lunes', () => {
    const inicio = new Date(2026, 0, 1, 10, 0);
    const r: ReglaRecurrencia = {
      frecuencia: 'mensual',
      intervalo: 1,
      mensual: { modo: 'ordinal', ordinal: 1, diaSemana: 1 },
      fin: { tipo: 'nunca' },
    };
    expect(primeras(r, inicio, 3)).toEqual(['2026-01-05', '2026-02-02', '2026-03-02']);
  });

  it('mensual el último viernes', () => {
    expect(diaOrdinal(2026, 0, -1, 5)).toBe(30);
    expect(diaOrdinal(2026, 1, 5, 1)).toBeNull(); // febrero 2026 no tiene 5º lunes
  });

  it('respeta el fin por número de veces', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'diaria',
      intervalo: 1,
      fin: { tipo: 'veces', veces: 3 },
    };
    expect([...generarInicios(r, lunes)].length).toBe(3);
  });

  it('respeta el fin por fecha (incluida)', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'diaria',
      intervalo: 1,
      fin: { tipo: 'fecha', hasta: '2026-01-07' },
    };
    expect([...generarInicios(r, lunes)].map(claveDia)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
    ]);
  });

  it('mantiene la hora local aunque cambie el horario de verano', () => {
    const inicio = new Date(2026, 2, 27, 9, 0); // viernes antes del cambio de hora en Europa
    const r: ReglaRecurrencia = {
      frecuencia: 'diaria',
      intervalo: 1,
      fin: { tipo: 'veces', veces: 4 },
    };
    for (const f of generarInicios(r, inicio)) expect(f.getHours()).toBe(9);
  });

  it('saltar hasta el rango da el mismo resultado que recorrer desde el principio', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'semanal',
      intervalo: 3,
      diasSemana: [2, 4],
      fin: { tipo: 'nunca' },
    };
    const desde = new Date(2027, 5, 1).getTime();
    const completo = [
      ...(function* () {
        for (const f of generarInicios(r, lunes)) {
          if (f.getTime() > desde + 60 * 86400000) return;
          if (f.getTime() >= desde) yield claveDia(f);
        }
      })(),
    ];
    const saltando: string[] = [];
    for (const f of generarInicios(r, lunes, desde)) {
      if (f.getTime() > desde + 60 * 86400000) break;
      if (f.getTime() >= desde) saltando.push(claveDia(f));
    }
    expect(saltando).toEqual(completo);
  });
});

describe('expandirOcurrencias', () => {
  const semanal = evento({
    recurrencia: { frecuencia: 'semanal', intervalo: 1, diasSemana: [1], fin: { tipo: 'nunca' } },
  });
  const desde = new Date(2026, 0, 1).getTime();
  const hasta = new Date(2026, 1, 1).getTime();

  it('expande un evento semanal en enero', () => {
    const oc = expandirOcurrencias([semanal], [], desde, hasta);
    expect(oc.map((o) => claveDia(o.inicioMs))).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ]);
    expect(oc.every((o) => o.esRecurrente)).toBe(true);
  });

  it('aplica cancelaciones, cambios y completados', () => {
    const base = { id: 'x', creadoEnMs: 0, actualizadoEnMs: 0, eventoId: 'e1' };
    const excepciones: ExcepcionEvento[] = [
      {
        ...base,
        inicioOriginalMs: new Date(2026, 0, 12, 9).getTime(),
        cancelada: true,
        completado: false,
        cambios: {},
      },
      {
        ...base,
        inicioOriginalMs: new Date(2026, 0, 19, 9).getTime(),
        cancelada: false,
        completado: true,
        cambios: {
          inicioMs: new Date(2026, 0, 20, 11).getTime(),
          finMs: new Date(2026, 0, 20, 12).getTime(),
          titulo: 'Tutoría',
        },
      },
    ];
    const oc = expandirOcurrencias([semanal], excepciones, desde, hasta);
    expect(oc.map((o) => claveDia(o.inicioMs))).toEqual(['2026-01-05', '2026-01-20', '2026-01-26']);
    const movida = oc[1];
    expect(movida.titulo).toBe('Tutoría');
    expect(movida.completado).toBe(true);
    expect(new Date(movida.inicioMs).getHours()).toBe(11);
  });

  it('incluye eventos sueltos que se solapan con el rango', () => {
    const suelto = evento({ id: 'e2', inicioMs: desde - 30 * 60000, finMs: desde + 30 * 60000 });
    expect(expandirOcurrencias([suelto], [], desde, hasta)).toHaveLength(1);
  });
});

describe('partirSerie', () => {
  it('termina la serie antigua el día anterior', () => {
    const r: ReglaRecurrencia = { frecuencia: 'diaria', intervalo: 1, fin: { tipo: 'nunca' } };
    const { antigua, nueva } = partirSerie(r, lunes, new Date(2026, 0, 8, 9).getTime());
    expect(antigua?.fin).toEqual({ tipo: 'fecha', hasta: '2026-01-07' });
    expect(nueva).toEqual(r);
  });

  it('reparte las veces entre las dos series', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'diaria',
      intervalo: 1,
      fin: { tipo: 'veces', veces: 10 },
    };
    const { antigua, nueva } = partirSerie(r, lunes, new Date(2026, 0, 8, 9).getTime());
    expect(antigua?.fin).toEqual({ tipo: 'veces', veces: 3 });
    expect(nueva.fin).toEqual({ tipo: 'veces', veces: 7 });
    expect(contarAntes(r, lunes, new Date(2026, 0, 8, 9).getTime())).toBe(3);
  });

  it('si es la primera ocurrencia no queda serie antigua', () => {
    const r: ReglaRecurrencia = { frecuencia: 'diaria', intervalo: 1, fin: { tipo: 'nunca' } };
    expect(partirSerie(r, lunes, lunes.getTime()).antigua).toBeNull();
  });
});

describe('describirRegla y caeEnDia', () => {
  it('describe en español', () => {
    expect(
      describirRegla({ frecuencia: 'diaria', intervalo: 1, fin: { tipo: 'nunca' } }, lunes),
    ).toBe('Cada día');
    expect(
      describirRegla(
        {
          frecuencia: 'semanal',
          intervalo: 2,
          diasSemana: [3, 1],
          fin: { tipo: 'veces', veces: 5 },
        },
        lunes,
      ),
    ).toBe('Cada 2 semanas los lunes y miércoles, 5 veces');
    expect(
      describirRegla(
        {
          frecuencia: 'mensual',
          intervalo: 1,
          mensual: { modo: 'ordinal', ordinal: 1, diaSemana: 1 },
          fin: { tipo: 'nunca' },
        },
        lunes,
      ),
    ).toBe('Cada mes el primer lunes');
  });

  it('abrevia semanas completas y días laborables', () => {
    const semanal = (dias: number[]): ReglaRecurrencia => ({
      frecuencia: 'semanal',
      intervalo: 1,
      diasSemana: dias,
      fin: { tipo: 'nunca' },
    });
    expect(describirRegla(semanal([0, 1, 2, 3, 4, 5, 6]), lunes)).toBe('Cada día');
    expect(describirRegla(semanal([5, 4, 3, 2, 1]), lunes)).toBe('De lunes a viernes');
  });

  it('caeEnDia', () => {
    const r: ReglaRecurrencia = {
      frecuencia: 'semanal',
      intervalo: 1,
      diasSemana: [1, 3],
      fin: { tipo: 'nunca' },
    };
    expect(caeEnDia(r, lunes, new Date(2026, 4, 6))).toBe(true); // miércoles
    expect(caeEnDia(r, lunes, new Date(2026, 4, 7))).toBe(false); // jueves
    expect(caeEnDia(r, lunes, new Date(2025, 11, 31))).toBe(false); // antes del inicio
  });
});
