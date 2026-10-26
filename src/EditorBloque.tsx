// Editor de bloques del calendario (evento, sesión, protegido o rutina) en una hoja modal.
// Sirve para crear y para editar. Si el bloque se repite, al guardar pregunta el alcance.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarClock, Check, Copy, Play, Trash2 } from 'lucide-react';
import { useUI } from './almacenUI';
import { buscarEtiqueta, etiquetasActivas, useDatos } from './almacenDatos';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo, Interruptor, Segmentado } from './Campos';
import { EditorRecurrencia } from './EditorRecurrencia';
import { SelectorColor } from './SelectorColor';
import {
  alternarHecho,
  borrarOcurrencia,
  cambiarOcurrencia,
  crearBloque,
  duplicarOcurrencia,
  eventoVacio,
} from './operaciones';
import { expandirCiclo } from './ciclos';
import { iniciarSesion } from './temporizador';
import { empezarRutina } from './operacionesRutinas';
import { claveDia, conHora, desdeClaveDia, formatear } from './fechas';
import { t } from './textos';
import type { Evento, ReglaRecurrencia, TipoBloque } from './tipos';
import type { DatosNuevos } from './datos';

interface Formulario {
  tipo: TipoBloque;
  titulo: string;
  etiquetaId: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  todoElDia: boolean;
  recurrencia: ReglaRecurrencia | null;
  cicloId: string | null;
  tareaId: string | null;
  completarTareaAlCompletar: boolean;
  rutinaId: string | null;
  notas: string;
  color: string | null;
}

const ICONOS_TIPO: Record<TipoBloque, string> = {
  evento: '📅',
  sesion: '🎯',
  protegido: '🛡️',
  rutina: '🔁',
};

export function EditorBloque() {
  const estado = useUI((s) => s.editorBloque);
  const poner = useUI((s) => s.poner);
  const etiquetas = useDatos((s) => s.etiquetas);
  const ciclos = useDatos((s) => s.ciclos);
  const tareas = useDatos((s) => s.tareas);
  const rutinas = useDatos((s) => s.rutinas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const navegar = useNavigate();
  const [f, setF] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);

  const oc = estado?.ocurrencia ?? null;

  // Rellenamos el formulario cada vez que se abre
  useEffect(() => {
    if (!estado) {
      setF(null);
      return;
    }
    const base = oc
      ? {
          ...oc.evento,
          titulo: oc.titulo,
          etiquetaId: oc.etiquetaId,
          notas: oc.notas,
          inicioMs: oc.inicioMs,
          finMs: oc.finMs,
        }
      : eventoVacio({ ...estado.borrador!, titulo: estado.borrador?.titulo });
    setF({
      tipo: base.tipo,
      titulo: base.titulo,
      etiquetaId: base.etiquetaId ?? null,
      fecha: claveDia(base.inicioMs),
      horaInicio: formatear(base.inicioMs, 'HH:mm'),
      horaFin: formatear(base.finMs, 'HH:mm'),
      todoElDia: base.todoElDia,
      recurrencia: base.recurrencia,
      cicloId: base.cicloId ?? null,
      tareaId: base.tareaId ?? null,
      completarTareaAlCompletar: base.completarTareaAlCompletar,
      rutinaId: base.rutinaId ?? null,
      notas: base.notas,
      color: base.color,
    });
  }, [estado, oc]);

  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const tareasPendientes = useMemo(
    () => tareas.filter((x) => !x.completada || x.id === f?.tareaId),
    [tareas, f?.tareaId],
  );
  const cerrar = () => poner({ editorBloque: null });

  if (!estado || !f)
    return (
      <Modal abierto={false} alCerrar={cerrar} titulo="">
        {null}
      </Modal>
    );

  const actualizar = (parcial: Partial<Formulario>) => setF({ ...f, ...parcial });

  /** Calcula inicio y fin en ms a partir de la fecha y las horas (si el fin es menor, es al día siguiente). */
  const calcularHoras = () => {
    if (f.todoElDia) {
      const dia = desdeClaveDia(f.fecha);
      return { inicioMs: dia.getTime(), finMs: dia.getTime() + 86_400_000 };
    }
    const inicioMs = conHora(f.fecha, f.horaInicio).getTime();
    let finMs = conHora(f.fecha, f.horaFin).getTime();
    if (finMs <= inicioMs) finMs += 86_400_000;
    return { inicioMs, finMs };
  };

  const guardar = async () => {
    setGuardando(true);
    const { inicioMs, finMs } = calcularHoras();
    const titulo = f.titulo.trim() || t.bloque.tituloPorDefecto[f.tipo];
    const datos: Partial<DatosNuevos<Evento>> = {
      tipo: f.tipo,
      titulo,
      etiquetaId: f.etiquetaId,
      inicioMs,
      finMs,
      todoElDia: f.todoElDia,
      recurrencia: f.recurrencia,
      cicloId: f.tipo === 'sesion' ? f.cicloId : null,
      tareaId: f.tareaId,
      completarTareaAlCompletar: !!f.tareaId && f.completarTareaAlCompletar,
      rutinaId: f.tipo === 'rutina' ? f.rutinaId : null,
      notas: f.notas,
      color: f.color,
    };
    let ok: boolean;
    if (oc) {
      // Solo mandamos lo que ha cambiado, para que "solo este" sea posible cuando se pueda
      const original: Record<string, unknown> = {
        ...oc.evento,
        titulo: oc.titulo,
        etiquetaId: oc.etiquetaId,
        notas: oc.notas,
        inicioMs: oc.inicioMs,
        finMs: oc.finMs,
      };
      const cambios = Object.fromEntries(
        Object.entries(datos).filter(
          ([k, v]) => JSON.stringify(original[k] ?? null) !== JSON.stringify(v ?? null),
        ),
      ) as Partial<DatosNuevos<Evento>>;
      ok = Object.keys(cambios).length ? await cambiarOcurrencia(oc, cambios) : true;
    } else {
      ok = !!(await crearBloque(eventoVacio({ ...datos, inicioMs, finMs })));
    }
    setGuardando(false);
    if (ok) {
      useUI.getState().avisar(t.comun.guardado, 'exito');
      cerrar();
    }
  };

  const empezarSesion = async () => {
    const ciclo = ciclos.find((c) => c.id === f.cicloId);
    await iniciarSesion({
      modo: ciclo ? 'ciclo' : 'cronometro',
      fases: ciclo ? expandirCiclo(ciclo) : [],
      etiquetaId: f.etiquetaId,
      tareaId: f.tareaId,
      eventoId: oc?.evento.id ?? null,
      cicloId: ciclo?.id ?? null,
    });
    cerrar();
    navegar('/foco');
  };

  const etiqueta = buscarEtiqueta(etiquetas, f.etiquetaId);
  const inicioFecha = desdeClaveDia(f.fecha);
  const rutinaDelBloque = rutinas.find((r) => r.id === f.rutinaId);

  return (
    <Modal
      abierto
      alCerrar={cerrar}
      titulo={oc ? t.bloque.editar : t.bloque.nuevo}
      ancho="lg"
      pie={
        <>
          {oc && (
            <div className="mr-auto flex gap-1">
              <Boton
                variante="fantasma"
                tamano="icono"
                aria-label={t.comun.borrar}
                title={t.comun.borrar}
                onClick={async () => (await borrarOcurrencia(oc)) && cerrar()}
              >
                <Trash2 size={18} className="text-peligro" />
              </Boton>
              <Boton
                variante="fantasma"
                tamano="icono"
                aria-label={t.comun.duplicar}
                title={t.comun.duplicar}
                onClick={async () => (await duplicarOcurrencia(oc)) && cerrar()}
              >
                <Copy size={18} />
              </Boton>
              <Boton
                variante="fantasma"
                tamano="icono"
                aria-label={t.comun.moverA}
                title={t.comun.moverA}
                onClick={() => poner({ editorBloque: null, moverA: { ocurrencia: oc } })}
              >
                <CalendarClock size={18} />
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
        <div>
          <Segmentado
            etiqueta="Tipo de bloque"
            valor={f.tipo}
            alCambiar={(tipo) =>
              actualizar({
                tipo,
                titulo: Object.values(t.bloque.tituloPorDefecto).includes(f.titulo as never)
                  ? tipo === 'sesion' && etiqueta
                    ? etiqueta.nombre
                    : t.bloque.tituloPorDefecto[tipo]
                  : f.titulo,
              })
            }
            opciones={(Object.keys(t.bloque.tipos) as TipoBloque[]).map((tipo) => ({
              valor: tipo,
              texto: `${ICONOS_TIPO[tipo]} ${t.bloque.tipos[tipo]}`,
            }))}
            tamano="sm"
          />
        </div>
        {f.tipo === 'protegido' && (
          <p className="-mt-2 text-xs text-texto-suave">{t.bloque.protegidoAyuda}</p>
        )}

        <Campo etiqueta={t.bloque.titulo}>
          {(id) => (
            <input
              id={id}
              className="campo text-base font-semibold"
              value={f.titulo}
              maxLength={200}
              onChange={(e) => actualizar({ titulo: e.target.value })}
              data-autofoco
            />
          )}
        </Campo>

        <Campo etiqueta={t.comun.etiqueta}>
          {(id) => (
            <select
              id={id}
              className="campo"
              value={f.etiquetaId ?? ''}
              onChange={(e) => {
                const nueva = buscarEtiqueta(etiquetas, e.target.value || null);
                const tituloPorDefecto =
                  Object.values(t.bloque.tituloPorDefecto).includes(f.titulo as never) ||
                  f.titulo === etiqueta?.nombre;
                actualizar({
                  etiquetaId: nueva?.id ?? null,
                  titulo: nueva && tituloPorDefecto ? nueva.nombre : f.titulo,
                });
              }}
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo etiqueta={t.comun.fecha} className="col-span-2 sm:col-span-1">
            {(id) => (
              <input
                id={id}
                type="date"
                className="campo"
                value={f.fecha}
                onChange={(e) => e.target.value && actualizar({ fecha: e.target.value })}
              />
            )}
          </Campo>
          {!f.todoElDia && (
            <>
              <Campo etiqueta={t.comun.inicio}>
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    step={300}
                    className="campo"
                    value={f.horaInicio}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      // Mantenemos la duración al mover la hora de inicio
                      const { inicioMs, finMs } = calcularHoras();
                      const nuevoInicio = conHora(f.fecha, e.target.value).getTime();
                      actualizar({
                        horaInicio: e.target.value,
                        horaFin: formatear(nuevoInicio + (finMs - inicioMs), 'HH:mm'),
                      });
                    }}
                  />
                )}
              </Campo>
              <Campo etiqueta={t.comun.fin}>
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    step={300}
                    className="campo"
                    value={f.horaFin}
                    onChange={(e) => e.target.value && actualizar({ horaFin: e.target.value })}
                  />
                )}
              </Campo>
            </>
          )}
        </div>
        <Interruptor
          etiqueta={t.calendario.todoElDia}
          activo={f.todoElDia}
          alCambiar={(v) => actualizar({ todoElDia: v })}
        />

        <EditorRecurrencia
          valor={f.recurrencia}
          alCambiar={(r) => actualizar({ recurrencia: r })}
          inicio={inicioFecha}
          inicioSemana={inicioSemana}
        />

        {f.tipo === 'sesion' && (
          <Campo etiqueta={t.bloque.ciclo}>
            {(id) => (
              <select
                id={id}
                className="campo"
                value={f.cicloId ?? ''}
                onChange={(e) => actualizar({ cicloId: e.target.value || null })}
              >
                <option value="">{t.bloque.sinCiclo}</option>
                {ciclos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}

        {f.tipo === 'rutina' && (
          <Campo etiqueta={t.bloque.rutina}>
            {(id) => (
              <select
                id={id}
                className="campo"
                value={f.rutinaId ?? ''}
                onChange={(e) => actualizar({ rutinaId: e.target.value || null })}
              >
                <option value="">{t.comun.ninguna}</option>
                {rutinas
                  .filter((r) => !r.archivada)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
              </select>
            )}
          </Campo>
        )}

        {(f.tipo === 'sesion' || f.tipo === 'evento') && (
          <div className="space-y-1">
            <Campo etiqueta={t.bloque.tarea}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={f.tareaId ?? ''}
                  onChange={(e) => actualizar({ tareaId: e.target.value || null })}
                >
                  <option value="">{t.comun.ninguna}</option>
                  {tareasPendientes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.titulo}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            {f.tareaId && (
              <Interruptor
                etiqueta={t.bloque.completarTarea}
                activo={f.completarTareaAlCompletar}
                alCambiar={(v) => actualizar({ completarTareaAlCompletar: v })}
              />
            )}
          </div>
        )}

        <Campo etiqueta={t.comun.notas}>
          {(id) => (
            <textarea
              id={id}
              rows={3}
              maxLength={5000}
              className="campo resize-y"
              value={f.notas}
              onChange={(e) => actualizar({ notas: e.target.value })}
            />
          )}
        </Campo>

        <div>
          <p className="etiqueta-campo">{t.comun.color}</p>
          <div className="flex flex-wrap items-center gap-3">
            <SelectorColor
              etiqueta={t.comun.color}
              valor={f.color ?? etiqueta?.color ?? '#6D5CF0'}
              alCambiar={(c) => actualizar({ color: c })}
            />
            {f.color && (
              <button
                type="button"
                className="text-xs font-semibold text-acento"
                onClick={() => actualizar({ color: null })}
              >
                Usar el de la etiqueta
              </button>
            )}
          </div>
        </div>

        {oc && (
          <div className="flex flex-wrap gap-2 border-t border-borde pt-4">
            <Boton
              variante={oc.completado ? 'suave' : 'secundario'}
              icono={<Check size={16} />}
              onClick={async () => {
                await alternarHecho(oc);
                cerrar();
              }}
            >
              {oc.completado ? t.calendario.desmarcarHecho : t.calendario.marcarHecho}
            </Boton>
            {f.tipo === 'sesion' && (
              <Boton variante="primario" icono={<Play size={16} />} onClick={empezarSesion}>
                {t.calendario.empezarSesion}
              </Boton>
            )}
            {f.tipo === 'rutina' && rutinaDelBloque && (
              <Boton
                variante="primario"
                icono={<Play size={16} />}
                onClick={async () => {
                  if (await empezarRutina(rutinaDelBloque, oc.evento.id)) {
                    cerrar();
                    navegar('/foco');
                  }
                }}
              >
                {t.rutinas.empezarRutina}
              </Boton>
            )}
          </div>
        )}
        {/* Botón oculto para que Intro en un campo envíe el formulario */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
