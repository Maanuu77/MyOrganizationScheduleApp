// Editor de rutinas: nombre, pasos (qué hacer, cuánto, etiqueta y tarea), los descansos
// entre pasos y, si se quiere, los días y la hora en que toca.

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Coffee, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo, Interruptor, SelectorDias } from './Campos';
import { SelectorColor, PALETA } from './SelectorColor';
import { BarraRutina } from './BarraRutina';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { avisar, confirmar } from './almacenUI';
import { nuevoId } from './datos';
import { borrarRutina, guardarRutina } from './operacionesRutinas';
import { DESCANSO_POR_DEFECTO_MIN, duracionRutinaMin } from './rutinas';
import { conHora, duracionTexto, formatearHora } from './fechas';
import { t } from './textos';
import type { PasoRutina, Rutina } from './tipos';

type Borrador = Omit<Rutina, 'id' | 'creadoEnMs' | 'actualizadoEnMs'>;

interface Props {
  abierto: boolean;
  rutina: Rutina | null;
  alCerrar: () => void;
}

const pasoVacio = (descansoMin: number): PasoRutina => ({
  id: nuevoId(),
  nombre: '',
  duracionMin: 25,
  etiquetaId: null,
  tareaId: null,
  descansoMin,
});

/** Número entero dentro de un rango (los campos numéricos vacíos cuentan como 0). */
const entero = (valor: string, max: number) =>
  Math.min(max, Math.max(0, Math.round(Number(valor) || 0)));

export function EditorRutina({ abierto, rutina, alCerrar }: Props) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const tareas = useDatos((s) => s.tareas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const pendientes = useMemo(() => tareas.filter((x) => !x.completada), [tareas]);
  const [r, setR] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setR(
      rutina ?? {
        nombre: '',
        color: PALETA[Math.floor(Math.random() * PALETA.length)],
        pasos: [pasoVacio(DESCANSO_POR_DEFECTO_MIN)],
        descansoPorDefectoMin: DESCANSO_POR_DEFECTO_MIN,
        programacion: { diasSemana: [], hora: null },
        avisos: { activo: true, minutosAntes: 5 },
        mostrarEnCalendario: false,
        eventoCalendarioId: null,
        archivada: false,
      },
    );
  }, [abierto, rutina]);

  if (!abierto || !r)
    return (
      <Modal abierto={false} alCerrar={alCerrar} titulo="">
        {null}
      </Modal>
    );

  const cambiar = (p: Partial<Borrador>) => setR({ ...r, ...p });
  const cambiarPaso = (id: string, p: Partial<PasoRutina>) =>
    cambiar({ pasos: r.pasos.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const moverPaso = (i: number, d: -1 | 1) => {
    const copia = [...r.pasos];
    const [x] = copia.splice(i, 1);
    copia.splice(i + d, 0, x);
    cambiar({ pasos: copia });
  };
  const quitarPaso = (id: string) => cambiar({ pasos: r.pasos.filter((x) => x.id !== id) });
  const añadirPaso = () => cambiar({ pasos: [...r.pasos, pasoVacio(r.descansoPorDefectoMin)] });

  const totalMin = duracionRutinaMin(r);
  const hora = r.programacion.hora;
  const conDias = r.programacion.diasSemana.length > 0;

  const guardar = async () => {
    const nombre = r.nombre.trim();
    if (!nombre) {
      avisar(t.rutinas.nombreObligatorio, 'error');
      return;
    }
    const pasos = r.pasos.map((p) => ({ ...p, nombre: p.nombre.trim() }));
    if (!pasos.length) {
      avisar(t.rutinas.sinPasos, 'error');
      return;
    }
    if (pasos.some((p) => !p.nombre)) {
      avisar(t.rutinas.pasoSinNombre, 'error');
      return;
    }
    setGuardando(true);
    const ok = await guardarRutina(
      {
        ...r,
        nombre,
        pasos: pasos.map((p) => ({ ...p, duracionMin: Math.max(1, p.duracionMin) })),
        // Sin días o sin hora no hay nada que pintar ni que avisar
        mostrarEnCalendario: r.mostrarEnCalendario && conDias && !!hora,
      },
      rutina,
    );
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

  return (
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
              placeholder="Tarde de estudio"
              onChange={(e) => cambiar({ nombre: e.target.value })}
              data-autofoco
            />
          )}
        </Campo>

        {/* Pasos */}
        <section aria-label={t.rutinas.pasos} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="etiqueta-campo mb-0">{t.rutinas.pasos}</p>
            <p className="text-xs font-semibold text-texto-suave">
              {t.rutinas.total(duracionTexto(totalMin * 60_000))}
              {hora &&
                ` · ${t.rutinas.terminaA(
                  formatearHora(
                    conHora(new Date(), hora).getTime() + totalMin * 60_000,
                    formato24h,
                  ),
                )}`}
            </p>
          </div>
          {r.pasos.length > 0 && <BarraRutina rutina={r} etiquetas={etiquetas} />}

          <ol className="space-y-0">
            {r.pasos.map((p, i) => (
              <li key={p.id}>
                <div className="rounded-md border border-borde bg-superficie-2/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-acento/12 text-xs font-bold text-acento">
                      {i + 1}
                    </span>
                    <input
                      className="campo min-w-0 flex-1 py-1.5"
                      placeholder={t.rutinas.nombrePaso}
                      aria-label={`${t.rutinas.paso} ${i + 1}`}
                      maxLength={60}
                      value={p.nombre}
                      onChange={(e) => cambiarPaso(p.id, { nombre: e.target.value })}
                    />
                    <label className="flex shrink-0 items-center gap-1 text-sm text-texto-suave">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={600}
                        className="campo w-16 px-2 py-1.5 text-right"
                        aria-label={`${t.rutinas.paso} ${i + 1}: ${t.rutinas.minutos}`}
                        value={p.duracionMin || ''}
                        onChange={(e) =>
                          cambiarPaso(p.id, { duracionMin: entero(e.target.value, 600) })
                        }
                      />
                      {t.rutinas.minutos}
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                    <select
                      className="campo min-w-0 flex-1 basis-36 py-1 text-sm"
                      aria-label={t.rutinas.etiquetaPaso}
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
                    <select
                      className="campo min-w-0 flex-1 basis-36 py-1 text-sm"
                      aria-label={t.rutinas.tareaPaso}
                      value={p.tareaId ?? ''}
                      onChange={(e) => cambiarPaso(p.id, { tareaId: e.target.value || null })}
                    >
                      <option value="">{t.rutinas.tareaPaso}</option>
                      {pendientes.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.titulo}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex shrink-0">
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        disabled={i === 0}
                        onClick={() => moverPaso(i, -1)}
                        aria-label={t.rutinas.subir}
                      >
                        <ArrowUp size={15} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        disabled={i === r.pasos.length - 1}
                        onClick={() => moverPaso(i, 1)}
                        aria-label={t.rutinas.bajar}
                      >
                        <ArrowDown size={15} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        className="h-8 w-8"
                        onClick={() => quitarPaso(p.id)}
                        aria-label={t.rutinas.quitarPaso}
                      >
                        <Trash2 size={15} className="text-peligro" />
                      </Boton>
                    </div>
                  </div>
                </div>

                {/* Descanso entre este paso y el siguiente */}
                {i < r.pasos.length - 1 && (
                  <label className="my-1 ml-3 flex items-center gap-2 border-l-2 border-dashed border-borde-fuerte py-1.5 pl-4 text-sm text-texto-suave">
                    <Coffee size={15} aria-hidden />
                    {p.descansoMin > 0 ? t.rutinas.descanso : t.rutinas.sinDescanso}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={240}
                      className="campo w-16 px-2 py-1 text-right"
                      aria-label={`${t.rutinas.descanso} tras el paso ${i + 1} (${t.rutinas.minutos})`}
                      value={p.descansoMin}
                      onChange={(e) =>
                        cambiarPaso(p.id, { descansoMin: entero(e.target.value, 240) })
                      }
                    />
                    {t.rutinas.minutos}
                  </label>
                )}
              </li>
            ))}
          </ol>

          <Boton
            variante="suave"
            icono={<Plus size={16} />}
            onClick={añadirPaso}
            className="w-full"
          >
            {t.rutinas.añadirPaso}
          </Boton>

          <div className="flex flex-wrap items-end gap-2 pt-1">
            <Campo
              etiqueta={t.rutinas.descansoPorDefecto}
              ayuda={t.rutinas.descansoPorDefectoAyuda}
              className="flex-1"
            >
              {(id) => (
                <div className="flex items-center gap-2 text-sm text-texto-suave">
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={240}
                    className="campo w-20"
                    value={r.descansoPorDefectoMin}
                    onChange={(e) =>
                      cambiar({ descansoPorDefectoMin: entero(e.target.value, 240) })
                    }
                  />
                  {t.rutinas.minutos}
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    onClick={() =>
                      cambiar({
                        pasos: r.pasos.map((p) => ({ ...p, descansoMin: r.descansoPorDefectoMin })),
                      })
                    }
                  >
                    {t.rutinas.aplicarATodos}
                  </Boton>
                </div>
              )}
            </Campo>
          </div>
        </section>

        {/* Cuándo toca (opcional) */}
        <section
          className="space-y-3 rounded-md border border-borde p-3"
          aria-label={t.rutinas.cuando}
        >
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
            <p className="mt-1 text-xs text-texto-tenue">{t.rutinas.diasAyuda}</p>
          </div>
          <Campo etiqueta={`${t.rutinas.hora} (${t.comun.opcional})`}>
            {(id) => (
              <input
                id={id}
                type="time"
                className="campo w-36"
                value={hora ?? ''}
                onChange={(e) =>
                  cambiar({ programacion: { ...r.programacion, hora: e.target.value || null } })
                }
              />
            )}
          </Campo>
          {conDias && hora && (
            <>
              <Interruptor
                etiqueta={t.rutinas.mostrarCalendario}
                activo={r.mostrarEnCalendario}
                alCambiar={(v) => cambiar({ mostrarEnCalendario: v })}
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
                      inputMode="numeric"
                      min={0}
                      max={240}
                      className="campo w-20 py-1"
                      value={r.avisos.minutosAntes}
                      onChange={(e) =>
                        cambiar({
                          avisos: { ...r.avisos, minutosAntes: entero(e.target.value, 240) },
                        })
                      }
                    />
                    {t.rutinas.minutosAntes}
                  </label>
                )}
              </div>
            </>
          )}
        </section>

        <div>
          <p className="etiqueta-campo">{t.comun.color}</p>
          <SelectorColor
            etiqueta={t.comun.color}
            valor={r.color}
            alCambiar={(color) => cambiar({ color })}
          />
        </div>
      </div>
    </Modal>
  );
}
