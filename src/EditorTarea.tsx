// Editor de tareas en hoja modal: título, etiqueta, prioridad, fechas, estimación,
// subtareas, notas y repetición.

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Plus, Trash2, X } from 'lucide-react';
import { addHours, format, startOfHour } from 'date-fns';
import { useUI, confirmar, avisar } from './almacenUI';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo, SelectorDias } from './Campos';
import { DialogoFechaHora } from './DialogoFechaHora';
import { nuevoId, tareas as dbTareas } from './datos';
import { planificacionDe, planificarTareaEnCalendario, tareaVacia } from './operaciones';
import { claveDia, inicioDeSemana } from './fechas';
import { t } from './textos';
import { COLORES_PRIORIDAD } from './tareasLogica';
import type { Planificacion, Prioridad, RepeticionTarea, Subtarea, Tarea } from './tipos';

type TipoPlan = 'hoy' | 'dia' | 'semana' | 'sinFecha';

interface Formulario {
  titulo: string;
  etiquetaId: string | null;
  prioridad: Prioridad;
  tipoPlan: TipoPlan;
  fechaPlan: string;
  fechaLimite: string; // 'yyyy-MM-ddTHH:mm' o ''
  estimacionMin: string;
  subtareas: Subtarea[];
  notas: string;
  repeticion: RepeticionTarea | null;
}

function formularioDe(tarea: Partial<Tarea>): Formulario {
  const plan = tarea.planificacion ?? { tipo: 'sinFecha' };
  const hoy = claveDia(new Date());
  return {
    titulo: tarea.titulo ?? '',
    etiquetaId: tarea.etiquetaId ?? null,
    prioridad: tarea.prioridad ?? 'media',
    tipoPlan: plan.tipo === 'dia' ? (plan.fecha === hoy ? 'hoy' : 'dia') : plan.tipo,
    fechaPlan: plan.tipo === 'dia' ? plan.fecha : hoy,
    fechaLimite: tarea.fechaLimiteMs ? format(tarea.fechaLimiteMs, "yyyy-MM-dd'T'HH:mm") : '',
    estimacionMin: tarea.estimacionMin ? String(tarea.estimacionMin) : '',
    subtareas: tarea.subtareas ?? [],
    notas: tarea.notas ?? '',
    repeticion: tarea.repeticion ?? null,
  };
}

export function EditorTarea() {
  const estado = useUI((s) => s.editorTarea);
  const poner = useUI((s) => s.poner);
  const etiquetas = useDatos((s) => s.etiquetas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const [f, setF] = useState<Formulario | null>(null);
  const [nuevaSub, setNuevaSub] = useState('');
  const [planificar, setPlanificar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const tarea = estado?.tarea ?? null;

  useEffect(() => {
    setF(estado ? formularioDe(tarea ?? { ...estado.borrador }) : null);
    setNuevaSub('');
  }, [estado, tarea]);

  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const cerrar = () => poner({ editorTarea: null });

  if (!estado || !f)
    return (
      <Modal abierto={false} alCerrar={cerrar} titulo="">
        {null}
      </Modal>
    );
  const actualizar = (p: Partial<Formulario>) => setF({ ...f, ...p });

  const planificacion = (): Planificacion => {
    if (f.tipoPlan === 'dia') return { tipo: 'dia', fecha: f.fechaPlan };
    if (f.tipoPlan === 'hoy') return planificacionDe('hoy', inicioSemana);
    if (f.tipoPlan === 'semana') {
      // Si ya estaba en una semana concreta la respetamos
      const previa = tarea?.planificacion;
      return previa?.tipo === 'semana'
        ? previa
        : { tipo: 'semana', semana: claveDia(inicioDeSemana(new Date(), inicioSemana)) };
    }
    return { tipo: 'sinFecha' };
  };

  const guardar = async () => {
    const titulo = f.titulo.trim();
    if (!titulo) {
      avisar(t.tareas.tituloObligatorio, 'error');
      return;
    }
    setGuardando(true);
    const datos = {
      titulo,
      etiquetaId: f.etiquetaId,
      prioridad: f.prioridad,
      planificacion: planificacion(),
      fechaLimiteMs: f.fechaLimite ? new Date(f.fechaLimite).getTime() : null,
      estimacionMin: f.estimacionMin ? Math.max(1, Math.round(Number(f.estimacionMin))) : null,
      subtareas: f.subtareas,
      notas: f.notas,
      repeticion: f.repeticion,
    };
    try {
      if (tarea) await dbTareas.actualizar(tarea.id, datos);
      else await dbTareas.crear(tareaVacia(datos));
      cerrar();
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!tarea) return;
    const ok = await confirmar({
      titulo: t.tareas.borrarTitulo,
      mensaje: t.tareas.borrarTexto,
      textoConfirmar: t.comun.borrar,
      peligro: true,
    });
    if (!ok) return;
    await dbTareas.borrar(tarea.id);
    cerrar();
  };

  const añadirSub = () => {
    const titulo = nuevaSub.trim();
    if (!titulo) return;
    actualizar({ subtareas: [...f.subtareas, { id: nuevoId(), titulo, hecha: false }] });
    setNuevaSub('');
  };

  return (
    <>
      <Modal
        abierto
        alCerrar={cerrar}
        titulo={tarea ? t.tareas.editar : t.tareas.nueva}
        ancho="lg"
        pie={
          <>
            {tarea && (
              <div className="mr-auto flex gap-1">
                <Boton
                  variante="fantasma"
                  tamano="icono"
                  onClick={borrar}
                  aria-label={t.comun.borrar}
                  title={t.comun.borrar}
                >
                  <Trash2 size={18} className="text-peligro" />
                </Boton>
                <Boton
                  variante="fantasma"
                  tamano="icono"
                  onClick={() => setPlanificar(true)}
                  aria-label={t.calendario.planificarEn}
                  title={t.calendario.planificarEn}
                >
                  <CalendarPlus size={18} />
                </Boton>
              </div>
            )}
            <Boton variante="fantasma" onClick={cerrar}>
              {t.comun.cancelar}
            </Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {t.comun.guardar}
            </Boton>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <Campo etiqueta={t.comun.titulo}>
            {(id) => (
              <input
                id={id}
                className="campo text-base font-semibold"
                value={f.titulo}
                maxLength={300}
                onChange={(e) => actualizar({ titulo: e.target.value })}
                data-autofoco
              />
            )}
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta={t.comun.etiqueta}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={f.etiquetaId ?? ''}
                  onChange={(e) => actualizar({ etiquetaId: e.target.value || null })}
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
            <div>
              <p className="etiqueta-campo">{t.tareas.prioridad}</p>
              <div role="radiogroup" aria-label={t.tareas.prioridad} className="flex gap-1.5">
                {(Object.keys(t.tareas.prioridades) as Prioridad[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={f.prioridad === p}
                    onClick={() => actualizar({ prioridad: p })}
                    className="flex-1 rounded-sm border px-2 py-2 text-xs font-bold transition-all"
                    style={
                      f.prioridad === p
                        ? {
                            background: COLORES_PRIORIDAD[p],
                            color: '#fff',
                            borderColor: COLORES_PRIORIDAD[p],
                          }
                        : { borderColor: 'var(--mos-borde-fuerte)', color: COLORES_PRIORIDAD[p] }
                    }
                  >
                    {t.tareas.prioridades[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta={t.tareas.planificada}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={f.tipoPlan}
                  onChange={(e) => actualizar({ tipoPlan: e.target.value as TipoPlan })}
                >
                  <option value="hoy">{t.tareas.planHoy}</option>
                  <option value="dia">{t.tareas.planDia}</option>
                  <option value="semana">{t.tareas.planSemana}</option>
                  <option value="sinFecha">{t.tareas.planSinFecha}</option>
                </select>
              )}
            </Campo>
            {f.tipoPlan === 'dia' && (
              <Campo etiqueta={t.comun.fecha}>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    className="campo"
                    value={f.fechaPlan}
                    onChange={(e) => e.target.value && actualizar({ fechaPlan: e.target.value })}
                  />
                )}
              </Campo>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta={`${t.tareas.fechaLimite} (${t.comun.opcional})`}>
              {(id) => (
                <div className="flex gap-1">
                  <input
                    id={id}
                    type="datetime-local"
                    className="campo"
                    value={f.fechaLimite}
                    onChange={(e) => actualizar({ fechaLimite: e.target.value })}
                  />
                  {!f.fechaLimite ? (
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() =>
                        actualizar({
                          fechaLimite: format(
                            addHours(startOfHour(new Date()), 24),
                            "yyyy-MM-dd'T'HH:mm",
                          ),
                        })
                      }
                    >
                      +1 día
                    </Boton>
                  ) : (
                    <Boton
                      variante="fantasma"
                      tamano="icono"
                      aria-label="Quitar fecha límite"
                      onClick={() => actualizar({ fechaLimite: '' })}
                    >
                      <X size={16} />
                    </Boton>
                  )}
                </div>
              )}
            </Campo>
            <Campo etiqueta={`${t.tareas.estimacion} (${t.comun.minutos})`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={6000}
                  className="campo"
                  value={f.estimacionMin}
                  placeholder="30"
                  onChange={(e) => actualizar({ estimacionMin: e.target.value })}
                />
              )}
            </Campo>
          </div>

          <div>
            <p className="etiqueta-campo">{t.tareas.subtareas}</p>
            <ul className="space-y-1.5">
              {f.subtareas.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.hecha}
                    aria-label={s.titulo}
                    className="h-4 w-4 accent-[var(--mos-acento)]"
                    onChange={() =>
                      actualizar({
                        subtareas: f.subtareas.map((x) =>
                          x.id === s.id ? { ...x, hecha: !x.hecha } : x,
                        ),
                      })
                    }
                  />
                  <input
                    className="campo py-1"
                    value={s.titulo}
                    aria-label={t.tareas.subtareas}
                    onChange={(e) =>
                      actualizar({
                        subtareas: f.subtareas.map((x) =>
                          x.id === s.id ? { ...x, titulo: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="text-texto-tenue hover:text-peligro"
                    aria-label={t.comun.borrar}
                    onClick={() =>
                      actualizar({ subtareas: f.subtareas.filter((x) => x.id !== s.id) })
                    }
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                className="campo py-1.5"
                placeholder={t.tareas.nuevaSubtarea}
                value={nuevaSub}
                aria-label={t.tareas.nuevaSubtarea}
                onChange={(e) => setNuevaSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    añadirSub();
                  }
                }}
              />
              <Boton
                variante="suave"
                tamano="icono"
                onClick={añadirSub}
                aria-label={t.tareas.nuevaSubtarea}
              >
                <Plus size={16} />
              </Boton>
            </div>
          </div>

          <div className="space-y-2">
            <Campo etiqueta={t.tareas.repetir}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={f.repeticion?.frecuencia ?? ''}
                  onChange={(e) =>
                    actualizar({
                      repeticion: e.target.value
                        ? {
                            frecuencia: e.target.value as RepeticionTarea['frecuencia'],
                            intervalo: f.repeticion?.intervalo ?? 1,
                            diasSemana: f.repeticion?.diasSemana,
                          }
                        : null,
                    })
                  }
                >
                  <option value="">{t.recurrencia.nunca}</option>
                  <option value="diaria">{t.recurrencia.diaria}</option>
                  <option value="semanal">{t.recurrencia.semanal}</option>
                  <option value="mensual">{t.recurrencia.mensual}</option>
                </select>
              )}
            </Campo>
            {f.repeticion && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-texto-suave">
                  {t.recurrencia.cada}
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="campo w-16 py-1"
                    value={f.repeticion.intervalo}
                    onChange={(e) =>
                      actualizar({
                        repeticion: {
                          ...f.repeticion!,
                          intervalo: Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                  />
                </label>
                {f.repeticion.frecuencia === 'semanal' && (
                  <SelectorDias
                    etiqueta={t.recurrencia.enDias}
                    inicioSemana={inicioSemana}
                    valor={f.repeticion.diasSemana ?? []}
                    alCambiar={(dias) =>
                      actualizar({ repeticion: { ...f.repeticion!, diasSemana: dias } })
                    }
                  />
                )}
              </div>
            )}
          </div>

          <Campo etiqueta={t.comun.notas}>
            {(id) => (
              <textarea
                id={id}
                rows={3}
                maxLength={10000}
                className="campo resize-y"
                value={f.notas}
                onChange={(e) => actualizar({ notas: e.target.value })}
              />
            )}
          </Campo>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      {tarea && (
        <DialogoFechaHora
          abierto={planificar}
          titulo={t.calendario.planificarEn}
          inicialMs={addHours(startOfHour(new Date()), 1).getTime()}
          alCerrar={() => setPlanificar(false)}
          alAceptar={async (inicio) => {
            const ok = await planificarTareaEnCalendario(tarea, inicio);
            if (ok) {
              setPlanificar(false);
              cerrar();
              avisar(t.comun.guardado, 'exito');
            }
          }}
        />
      )}
    </>
  );
}
