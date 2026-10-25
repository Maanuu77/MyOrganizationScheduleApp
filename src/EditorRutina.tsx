// Editor de rutinas: ámbito (día, semana, mes), programación, pasos, avisos y, para las
// rutinas de estudio, el ciclo que se usará (reutiliza el editor de ciclos).

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo, Interruptor, Segmentado, SelectorDias } from './Campos';
import { SelectorColor, PALETA } from './SelectorColor';
import { EditorCiclo } from './EditorCiclo';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { avisar, confirmar } from './almacenUI';
import { nuevoId } from './datos';
import { borrarRutina, guardarRutina } from './operacionesRutinas';
import { DIAS_LARGOS } from './fechas';
import { t } from './textos';
import type { AmbitoRutina, PasoRutina, ReglaMensual, Rutina } from './tipos';

interface Props {
  abierto: boolean;
  rutina: Rutina | null;
  ambitoInicial: AmbitoRutina;
  alCerrar: () => void;
}

const pasoVacio = (): PasoRutina => ({
  id: nuevoId(),
  titulo: '',
  hora: null,
  duracionMin: 10,
  etiquetaId: null,
  descripcion: '',
  aviso: false,
});

export function EditorRutina({ abierto, rutina, ambitoInicial, alCerrar }: Props) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const ciclos = useDatos((s) => s.ciclos);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const [r, setR] = useState<Omit<Rutina, 'id' | 'creadoEnMs' | 'actualizadoEnMs'> | null>(null);
  const [editorCiclo, setEditorCiclo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setR(
      rutina ?? {
        nombre: '',
        ambito: ambitoInicial,
        clase: 'pasos',
        color: PALETA[Math.floor(Math.random() * PALETA.length)],
        etiquetaId: null,
        pasos: [pasoVacio()],
        cicloId: null,
        programacion: {
          diasSemana:
            ambitoInicial === 'dia' ? [1, 2, 3, 4, 5] : ambitoInicial === 'semana' ? [0] : [],
          mensual: ambitoInicial === 'mes' ? { modo: 'diasMes', dias: [1] } : null,
          hora: '08:00',
        },
        avisos: { activo: true, minutosAntes: 5 },
        mostrarEnCalendario: false,
        eventoCalendarioId: null,
        archivada: false,
      },
    );
  }, [abierto, rutina, ambitoInicial]);

  if (!abierto || !r)
    return (
      <Modal abierto={false} alCerrar={alCerrar} titulo="">
        {null}
      </Modal>
    );
  const cambiar = (p: Partial<typeof r>) => setR({ ...r, ...p });
  const cambiarPaso = (id: string, p: Partial<PasoRutina>) =>
    cambiar({ pasos: r.pasos.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const moverPaso = (i: number, d: -1 | 1) => {
    const copia = [...r.pasos];
    const [x] = copia.splice(i, 1);
    copia.splice(i + d, 0, x);
    cambiar({ pasos: copia });
  };

  const guardar = async () => {
    const nombre = r.nombre.trim();
    if (!nombre) {
      avisar(t.rutinas.nombreObligatorio, 'error');
      return;
    }
    setGuardando(true);
    const pasos = r.pasos
      .filter((p) => p.titulo.trim())
      .map((p) => ({ ...p, titulo: p.titulo.trim() }));
    const ok = await guardarRutina({ ...r, nombre, pasos }, rutina);
    setGuardando(false);
    if (ok) alCerrar();
  };

  const borrar = async () => {
    if (!rutina) return;
    if (
      !(await confirmar({
        titulo: t.rutinas.borrarTitulo,
        mensaje: `«${rutina.nombre}»`,
        textoConfirmar: t.comun.borrar,
        peligro: true,
      }))
    )
      return;
    await borrarRutina(rutina);
    alCerrar();
  };

  const mensual: ReglaMensual = r.programacion.mensual ?? { modo: 'diasMes', dias: [1] };

  return (
    <>
      <Modal
        abierto
        alCerrar={alCerrar}
        titulo={rutina ? t.rutinas.editar : t.rutinas.nueva}
        ancho="lg"
        pie={
          <>
            {rutina && (
              <Boton
                variante="fantasma"
                tamano="icono"
                className="mr-auto"
                onClick={borrar}
                aria-label={t.comun.borrar}
              >
                <Trash2 size={18} className="text-peligro" />
              </Boton>
            )}
            <Boton variante="fantasma" onClick={alCerrar}>
              {t.comun.cancelar}
            </Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {t.comun.guardar}
            </Boton>
          </>
        }
      >
        <div className="space-y-5">
          <Campo etiqueta={t.comun.nombre}>
            {(id) => (
              <input
                id={id}
                className="campo text-base font-semibold"
                value={r.nombre}
                maxLength={80}
                onChange={(e) => cambiar({ nombre: e.target.value })}
                data-autofoco
              />
            )}
          </Campo>

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="etiqueta-campo">{t.rutinas.ambito}</p>
              <Segmentado
                etiqueta={t.rutinas.ambito}
                valor={r.ambito}
                alCambiar={(ambito) =>
                  cambiar({
                    ambito,
                    programacion: {
                      ...r.programacion,
                      diasSemana:
                        ambito === 'dia' ? [0, 1, 2, 3, 4, 5, 6] : ambito === 'semana' ? [0] : [],
                      mensual: ambito === 'mes' ? mensual : null,
                    },
                  })
                }
                opciones={(['dia', 'semana', 'mes'] as AmbitoRutina[]).map((a) => ({
                  valor: a,
                  texto: t.rutinas.ambitoUno[a],
                }))}
                tamano="sm"
              />
            </div>
            <div>
              <p className="etiqueta-campo">{t.rutinas.clase}</p>
              <Segmentado
                etiqueta={t.rutinas.clase}
                valor={r.clase}
                alCambiar={(clase) =>
                  cambiar({
                    clase,
                    cicloId: clase === 'estudio' ? (r.cicloId ?? ciclos[0]?.id ?? null) : null,
                  })
                }
                opciones={[
                  { valor: 'pasos', texto: t.rutinas.clasePasos },
                  { valor: 'estudio', texto: t.rutinas.claseEstudio },
                ]}
                tamano="sm"
              />
            </div>
          </div>

          {/* Programación */}
          <div className="space-y-3 rounded-md border border-borde p-3">
            {r.ambito !== 'mes' ? (
              <div>
                <p className="etiqueta-campo">{t.rutinas.dias}</p>
                <SelectorDias
                  etiqueta={t.rutinas.dias}
                  inicioSemana={inicioSemana}
                  valor={r.programacion.diasSemana}
                  alCambiar={(dias) =>
                    cambiar({ programacion: { ...r.programacion, diasSemana: dias } })
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Campo etiqueta={t.rutinas.patron}>
                  {(id) => (
                    <select
                      id={id}
                      className="campo"
                      value={mensual.modo}
                      onChange={(e) =>
                        cambiar({
                          programacion: {
                            ...r.programacion,
                            mensual:
                              e.target.value === 'diasMes'
                                ? { modo: 'diasMes', dias: [1] }
                                : { modo: 'ordinal', ordinal: 1, diaSemana: 1 },
                          },
                        })
                      }
                    >
                      <option value="diasMes">{t.rutinas.diasMes}</option>
                      <option value="ordinal">{t.recurrencia.ordinal}</option>
                    </select>
                  )}
                </Campo>
                {mensual.modo === 'diasMes' ? (
                  <div
                    role="group"
                    aria-label={t.rutinas.diasMes}
                    className="grid grid-cols-7 gap-1"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                      const activo = mensual.dias.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => {
                            const dias = activo
                              ? mensual.dias.filter((x) => x !== d)
                              : [...mensual.dias, d];
                            cambiar({
                              programacion: {
                                ...r.programacion,
                                mensual: { modo: 'diasMes', dias: dias.length ? dias : [d] },
                              },
                            });
                          }}
                          className={`h-8 rounded-sm text-xs font-semibold ${activo ? 'bg-acento text-white' : 'bg-superficie-2 hover:bg-superficie-3'}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      aria-label="Ordinal"
                      className="campo"
                      value={mensual.ordinal}
                      onChange={(e) =>
                        cambiar({
                          programacion: {
                            ...r.programacion,
                            mensual: { ...mensual, ordinal: Number(e.target.value) as 1 },
                          },
                        })
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
                      value={mensual.diaSemana}
                      onChange={(e) =>
                        cambiar({
                          programacion: {
                            ...r.programacion,
                            mensual: { ...mensual, diaSemana: Number(e.target.value) },
                          },
                        })
                      }
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
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta={`${t.rutinas.hora} (${t.comun.opcional})`}>
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    className="campo"
                    value={r.programacion.hora ?? ''}
                    onChange={(e) =>
                      cambiar({ programacion: { ...r.programacion, hora: e.target.value || null } })
                    }
                  />
                )}
              </Campo>
              <Campo etiqueta={t.comun.etiqueta}>
                {(id) => (
                  <select
                    id={id}
                    className="campo"
                    value={r.etiquetaId ?? ''}
                    onChange={(e) => cambiar({ etiquetaId: e.target.value || null })}
                  >
                    <option value="">{t.comun.sinEtiqueta}</option>
                    {activas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
            <Interruptor
              etiqueta={t.rutinas.mostrarCalendario}
              activo={r.mostrarEnCalendario}
              alCambiar={(v) => cambiar({ mostrarEnCalendario: v })}
              deshabilitado={!r.programacion.hora}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Interruptor
                etiqueta={t.rutinas.avisar}
                activo={r.avisos.activo}
                alCambiar={(v) => cambiar({ avisos: { ...r.avisos, activo: v } })}
              />
              {r.avisos.activo && (
                <label className="flex items-center gap-2 text-sm text-texto-suave">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    className="campo w-20 py-1"
                    value={r.avisos.minutosAntes}
                    onChange={(e) =>
                      cambiar({
                        avisos: {
                          ...r.avisos,
                          minutosAntes: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                  />
                  {t.rutinas.minutosAntes}
                </label>
              )}
            </div>
          </div>

          <div>
            <p className="etiqueta-campo">{t.comun.color}</p>
            <SelectorColor
              etiqueta={t.comun.color}
              valor={r.color}
              alCambiar={(color) => cambiar({ color })}
            />
          </div>

          {r.clase === 'estudio' ? (
            <div className="flex items-end gap-2">
              <Campo etiqueta={t.foco.ciclo} className="flex-1">
                {(id) => (
                  <select
                    id={id}
                    className="campo"
                    value={r.cicloId ?? ''}
                    onChange={(e) => cambiar({ cicloId: e.target.value || null })}
                  >
                    <option value="">{t.comun.ninguna}</option>
                    {ciclos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Boton variante="suave" onClick={() => setEditorCiclo(true)}>
                {r.cicloId ? t.ciclos.editar : t.ciclos.nuevo}
              </Boton>
            </div>
          ) : (
            <div>
              <p className="etiqueta-campo">{t.rutinas.pasos}</p>
              <ol className="space-y-2">
                {r.pasos.map((p, i) => (
                  <li
                    key={p.id}
                    className="space-y-2 rounded-md border border-borde bg-superficie-2/50 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-acento/15 text-xs font-bold text-acento">
                        {i + 1}
                      </span>
                      <input
                        className="campo py-1.5"
                        placeholder={t.comun.titulo}
                        aria-label={t.comun.titulo}
                        value={p.titulo}
                        maxLength={120}
                        onChange={(e) => cambiarPaso(p.id, { titulo: e.target.value })}
                      />
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        disabled={i === 0}
                        onClick={() => moverPaso(i, -1)}
                        aria-label="Subir paso"
                      >
                        <ArrowUp size={15} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        disabled={i === r.pasos.length - 1}
                        onClick={() => moverPaso(i, 1)}
                        aria-label="Bajar paso"
                      >
                        <ArrowDown size={15} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        onClick={() => cambiar({ pasos: r.pasos.filter((x) => x.id !== p.id) })}
                        aria-label={t.comun.borrar}
                      >
                        <Trash2 size={15} className="text-peligro" />
                      </Boton>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-8">
                      <input
                        type="time"
                        className="campo w-auto py-1"
                        aria-label={t.comun.hora}
                        value={p.hora ?? ''}
                        onChange={(e) => cambiarPaso(p.id, { hora: e.target.value || null })}
                      />
                      <label className="flex items-center gap-1 text-xs text-texto-suave">
                        <input
                          type="number"
                          min={0}
                          max={600}
                          className="campo w-16 py-1"
                          aria-label={t.comun.duracion}
                          value={p.duracionMin ?? ''}
                          onChange={(e) =>
                            cambiarPaso(p.id, {
                              duracionMin: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                        min
                      </label>
                      <select
                        className="campo w-auto py-1 text-xs"
                        aria-label={t.comun.etiqueta}
                        value={p.etiquetaId ?? ''}
                        onChange={(e) => cambiarPaso(p.id, { etiquetaId: e.target.value || null })}
                      >
                        <option value="">{t.comun.sinEtiqueta}</option>
                        {activas.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nombre}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-texto-suave">
                        <input
                          type="checkbox"
                          checked={p.aviso}
                          className="accent-[var(--mos-acento)]"
                          onChange={(e) => cambiarPaso(p.id, { aviso: e.target.checked })}
                        />
                        {t.rutinas.avisoPaso}
                      </label>
                    </div>
                    <input
                      className="campo ml-8 w-[calc(100%-2rem)] py-1 text-sm"
                      placeholder={`${t.comun.descripcion} (${t.comun.opcional})`}
                      aria-label={t.comun.descripcion}
                      value={p.descripcion}
                      maxLength={500}
                      onChange={(e) => cambiarPaso(p.id, { descripcion: e.target.value })}
                    />
                  </li>
                ))}
              </ol>
              <Boton
                variante="suave"
                tamano="sm"
                className="mt-2"
                icono={<Plus size={14} />}
                onClick={() => cambiar({ pasos: [...r.pasos, pasoVacio()] })}
              >
                {t.rutinas.añadirPaso}
              </Boton>
            </div>
          )}
        </div>
      </Modal>
      <EditorCiclo
        abierto={editorCiclo}
        ciclo={ciclos.find((c) => c.id === r.cicloId) ?? null}
        alCerrar={(creado) => {
          setEditorCiclo(false);
          if (creado) cambiar({ cicloId: creado.id });
        }}
      />
    </>
  );
}
