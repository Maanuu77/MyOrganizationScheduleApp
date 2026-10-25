// Editor de la regla de repetición: diaria, semanal con días, mensual y personalizada.
import { useState } from 'react';
import type { FinRecurrencia, ReglaMensual, ReglaRecurrencia } from './tipos';
import { Campo, SelectorDias } from './Campos';
import { describirRegla } from './recurrencia';
import { DIAS_LARGOS, claveDia } from './fechas';
import { t } from './textos';
import { addMonths } from 'date-fns';

interface Props {
  valor: ReglaRecurrencia | null;
  alCambiar: (regla: ReglaRecurrencia | null) => void;
  inicio: Date;
  inicioSemana: 0 | 1;
}

type Preset = 'nunca' | 'diaria' | 'semanal' | 'mensual' | 'personalizada';

function presetDe(regla: ReglaRecurrencia | null, inicio: Date): Preset {
  if (!regla) return 'nunca';
  const simple = regla.intervalo === 1 && regla.fin.tipo === 'nunca';
  if (simple && regla.frecuencia === 'diaria') return 'diaria';
  if (
    simple &&
    regla.frecuencia === 'semanal' &&
    (regla.diasSemana ?? []).join() === String(inicio.getDay())
  )
    return 'semanal';
  if (simple && regla.frecuencia === 'mensual' && !regla.mensual) return 'mensual';
  return 'personalizada';
}

export function EditorRecurrencia({ valor, alCambiar, inicio, inicioSemana }: Props) {
  const [preset, setPreset] = useState<Preset>(() => presetDe(valor, inicio));

  const elegirPreset = (p: Preset) => {
    setPreset(p);
    const fin: FinRecurrencia = { tipo: 'nunca' };
    if (p === 'nunca') alCambiar(null);
    else if (p === 'diaria') alCambiar({ frecuencia: 'diaria', intervalo: 1, fin });
    else if (p === 'semanal')
      alCambiar({ frecuencia: 'semanal', intervalo: 1, diasSemana: [inicio.getDay()], fin });
    else if (p === 'mensual') alCambiar({ frecuencia: 'mensual', intervalo: 1, fin });
    else
      alCambiar(
        valor ?? { frecuencia: 'semanal', intervalo: 1, diasSemana: [inicio.getDay()], fin },
      );
  };

  const cambiar = (parcial: Partial<ReglaRecurrencia>) =>
    valor && alCambiar({ ...valor, ...parcial });
  const ordinalDelInicio = Math.min(4, Math.ceil(inicio.getDate() / 7)) as 1 | 2 | 3 | 4;

  return (
    <div className="space-y-3">
      <Campo etiqueta={t.bloque.repetir}>
        {(id) => (
          <select
            id={id}
            className="campo"
            value={preset}
            onChange={(e) => elegirPreset(e.target.value as Preset)}
          >
            <option value="nunca">{t.recurrencia.nunca}</option>
            <option value="diaria">{t.recurrencia.diaria}</option>
            <option value="semanal">{t.recurrencia.semanal}</option>
            <option value="mensual">{t.recurrencia.mensual}</option>
            <option value="personalizada">{t.recurrencia.personalizada}</option>
          </select>
        )}
      </Campo>

      {valor && preset === 'personalizada' && (
        <div className="space-y-3 rounded-md border border-borde bg-superficie-2/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <Campo etiqueta={t.recurrencia.cada} className="w-20">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={99}
                  className="campo"
                  value={valor.intervalo}
                  onChange={(e) => cambiar({ intervalo: Math.max(1, Number(e.target.value) || 1) })}
                />
              )}
            </Campo>
            <select
              aria-label="Frecuencia"
              className="campo w-auto"
              value={valor.frecuencia}
              onChange={(e) => {
                const frecuencia = e.target.value as ReglaRecurrencia['frecuencia'];
                cambiar({
                  frecuencia,
                  diasSemana:
                    frecuencia === 'semanal' ? (valor.diasSemana ?? [inicio.getDay()]) : undefined,
                  mensual: frecuencia === 'mensual' ? valor.mensual : undefined,
                });
              }}
            >
              <option value="diaria">{t.recurrencia.dias}</option>
              <option value="semanal">{t.recurrencia.semanas}</option>
              <option value="mensual">{t.recurrencia.meses}</option>
            </select>
          </div>

          {valor.frecuencia === 'semanal' && (
            <div>
              <p className="etiqueta-campo">{t.recurrencia.enDias}</p>
              <SelectorDias
                etiqueta={t.recurrencia.enDias}
                valor={valor.diasSemana ?? []}
                inicioSemana={inicioSemana}
                alCambiar={(dias) =>
                  cambiar({ diasSemana: dias.length ? dias : [inicio.getDay()] })
                }
              />
            </div>
          )}

          {valor.frecuencia === 'mensual' && (
            <EditorMensual
              valor={valor.mensual}
              alCambiar={(mensual) => cambiar({ mensual })}
              inicio={inicio}
              ordinal={ordinalDelInicio}
            />
          )}

          <div className="flex flex-wrap items-end gap-2">
            <Campo etiqueta={t.recurrencia.termina}>
              {(id) => (
                <select
                  id={id}
                  className="campo w-auto"
                  value={valor.fin.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as FinRecurrencia['tipo'];
                    cambiar({
                      fin:
                        tipo === 'nunca'
                          ? { tipo }
                          : tipo === 'fecha'
                            ? { tipo, hasta: claveDia(addMonths(inicio, 3)) }
                            : { tipo, veces: 10 },
                    });
                  }}
                >
                  <option value="nunca">{t.recurrencia.finNunca}</option>
                  <option value="fecha">{t.recurrencia.finFecha}</option>
                  <option value="veces">{t.recurrencia.finVeces}</option>
                </select>
              )}
            </Campo>
            {valor.fin.tipo === 'fecha' && (
              <input
                type="date"
                aria-label={t.recurrencia.finFecha}
                className="campo w-auto"
                value={valor.fin.hasta}
                min={claveDia(inicio)}
                onChange={(e) =>
                  e.target.value && cambiar({ fin: { tipo: 'fecha', hasta: e.target.value } })
                }
              />
            )}
            {valor.fin.tipo === 'veces' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={999}
                  aria-label={t.recurrencia.veces}
                  className="campo w-20"
                  value={valor.fin.veces}
                  onChange={(e) =>
                    cambiar({
                      fin: { tipo: 'veces', veces: Math.max(1, Number(e.target.value) || 1) },
                    })
                  }
                />
                <span className="text-sm text-texto-suave">{t.recurrencia.veces}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {valor && <p className="text-xs font-medium text-acento">{describirRegla(valor, inicio)}</p>}
    </div>
  );
}

function EditorMensual({
  valor,
  alCambiar,
  inicio,
  ordinal,
}: {
  valor: ReglaMensual | undefined;
  alCambiar: (m: ReglaMensual | undefined) => void;
  inicio: Date;
  ordinal: 1 | 2 | 3 | 4;
}) {
  const modo = !valor ? 'mismo' : valor.modo === 'diasMes' ? 'varios' : 'ordinal';
  return (
    <div className="space-y-2">
      <Campo etiqueta={t.recurrencia.modoMensual}>
        {(id) => (
          <select
            id={id}
            className="campo"
            value={modo}
            onChange={(e) => {
              const m = e.target.value;
              if (m === 'mismo') alCambiar(undefined);
              else if (m === 'varios') alCambiar({ modo: 'diasMes', dias: [inicio.getDate()] });
              else alCambiar({ modo: 'ordinal', ordinal, diaSemana: inicio.getDay() });
            }}
          >
            <option value="mismo">{`${t.recurrencia.diaDelMes} (${inicio.getDate()})`}</option>
            <option value="varios">{t.recurrencia.variosDias}</option>
            <option value="ordinal">{t.recurrencia.ordinal}</option>
          </select>
        )}
      </Campo>
      {valor?.modo === 'diasMes' && (
        <div role="group" aria-label={t.recurrencia.variosDias} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const activo = valor.dias.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  const dias = activo ? valor.dias.filter((x) => x !== d) : [...valor.dias, d];
                  alCambiar({ modo: 'diasMes', dias: dias.length ? dias : [d] });
                }}
                className={`h-8 rounded-sm text-xs font-semibold ${activo ? 'bg-acento text-white' : 'bg-superficie hover:bg-superficie-3'}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}
      {valor?.modo === 'ordinal' && (
        <div className="flex gap-2">
          <select
            aria-label="Ordinal"
            className="campo"
            value={valor.ordinal}
            onChange={(e) =>
              alCambiar({ ...valor, ordinal: Number(e.target.value) as 1 | 2 | 3 | 4 | -1 })
            }
          >
            {[1, 2, 3, 4, -1].map((o) => (
              <option key={o} value={o}>
                {t.recurrencia.ordinales[o]}
              </option>
            ))}
          </select>
          <select
            aria-label="Día de la semana"
            className="campo"
            value={valor.diaSemana}
            onChange={(e) => alCambiar({ ...valor, diaSemana: Number(e.target.value) })}
          >
            {DIAS_LARGOS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
