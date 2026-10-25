// Bloques reutilizables de la vista "Hoy": ahora/después, agenda del día, tareas y rutinas.
// Se usan tanto en la pantalla Hoy como en el panel fijo y en la hoja móvil.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { CalendarPlus, CheckCheck, ListTodo, Play, Plus, Repeat, Sun } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';
import { buscarEtiqueta, useDatos } from './almacenDatos';
import { useUI, avisar } from './almacenUI';
import { useOcurrencias } from './useCalendarioDatos';
import { EstadoVacio } from './EstadoVacio';
import { CheckAnimado } from './CheckAnimado';
import { TarjetaTarea } from './TarjetaTarea';
import { Boton } from './Boton';
import { alternarHecho, planificacionDe, tareaVacia } from './operaciones';
import { tareas as dbTareas } from './datos';
import { seccionarTareas, ordenarTareas } from './tareasLogica';
import { rutinasDelDia, seguimientoRutina } from './rutinas';
import { claveDia, formatearHora } from './fechas';
import { t } from './textos';
import type { Ocurrencia } from './tipos';

export function useHoy() {
  const hoy = startOfDay(new Date());
  const desde = hoy.getTime();
  const hasta = addDays(hoy, 1).getTime();
  const ocurrencias = useOcurrencias(desde, hasta);
  return { hoy, desde, hasta, ocurrencias };
}

function TituloSeccion({
  icono,
  texto,
  extra,
}: {
  icono: React.ReactNode;
  texto: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="text-acento" aria-hidden>
        {icono}
      </span>
      <h2 className="text-sm font-bold tracking-wide text-texto uppercase">{texto}</h2>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

/** Tarjeta con lo que toca ahora y lo siguiente. */
export function AhoraYDespues({ ocurrencias }: { ocurrencias: Ocurrencia[] }) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const ahora = Date.now();
  const conHora = ocurrencias.filter((o) => !o.evento.todoElDia);
  const actual =
    conHora.find((o) => o.inicioMs <= ahora && o.finMs > ahora && o.evento.tipo !== 'protegido') ??
    conHora.find((o) => o.inicioMs <= ahora && o.finMs > ahora);
  const siguiente = conHora.find((o) => o.inicioMs > ahora);
  const fila = (o: Ocurrencia | undefined, rotulo: string) => {
    const e = buscarEtiqueta(etiquetas, o?.etiquetaId);
    const color = o?.evento.color ?? e?.color ?? 'var(--mos-acento)';
    return (
      <div className="flex items-center gap-3">
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: o ? color : 'var(--mos-borde)' }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide text-texto-tenue uppercase">{rotulo}</p>
          <p className="truncate font-semibold">{o ? o.titulo : t.hoy.nadaAhora}</p>
          {o && (
            <p className="text-xs text-texto-suave">
              {formatearHora(o.inicioMs, formato24h)} – {formatearHora(o.finMs, formato24h)}
            </p>
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="tarjeta grid gap-3 sm:grid-cols-2">
      {fila(actual, t.hoy.ahora)}
      {fila(siguiente, t.hoy.siguiente)}
    </div>
  );
}

/** Agenda del día con casillas para marcar los bloques como hechos. */
export function AgendaDelDia({
  ocurrencias,
  compacta,
}: {
  ocurrencias: Ocurrencia[];
  compacta?: boolean;
}) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const navegar = useNavigate();
  const poner = useUI((s) => s.poner);
  const ahora = Date.now();
  return (
    <section>
      <TituloSeccion icono={<Sun size={16} />} texto={t.hoy.agenda} />
      {ocurrencias.length === 0 ? (
        <EstadoVacio
          compacto
          icono={<CalendarPlus size={22} />}
          titulo={t.hoy.agendaVacia}
          texto=""
          accion={
            <Boton variante="suave" tamano="sm" onClick={() => navegar('/calendario')}>
              {t.hoy.agendaVaciaAccion}
            </Boton>
          }
        />
      ) : (
        <ol className="relative space-y-1.5 border-l-2 border-borde pl-4">
          {ocurrencias.map((o) => {
            const e = buscarEtiqueta(etiquetas, o.etiquetaId);
            const color = o.evento.color ?? e?.color ?? 'var(--mos-acento)';
            const enCurso = o.inicioMs <= ahora && o.finMs > ahora;
            return (
              <li key={o.clave} className="relative">
                <span
                  className={`absolute top-3 -left-[23px] h-3 w-3 rounded-full border-2 border-superficie ${enCurso ? 'ring-4 ring-acento/20' : ''}`}
                  style={{ background: color }}
                  aria-hidden
                />
                <div
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-superficie-2 ${o.completado ? 'opacity-60' : ''}`}
                >
                  {o.evento.tipo !== 'protegido' && (
                    <CheckAnimado
                      hecho={o.completado}
                      alCambiar={() => alternarHecho(o)}
                      color={color}
                      etiqueta={`${t.calendario.marcarHecho}: ${o.titulo}`}
                      tamano={20}
                    />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => poner({ editorBloque: { ocurrencia: o, borrador: null } })}
                  >
                    <p
                      className={`truncate text-sm font-semibold ${o.completado ? 'line-through' : ''}`}
                    >
                      {o.titulo}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {o.evento.todoElDia
                        ? t.calendario.todoElDia
                        : `${formatearHora(o.inicioMs, formato24h)} – ${formatearHora(o.finMs, formato24h)}`}
                      {!compacta && e ? ` · ${e.nombre}` : ''}
                    </p>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Tareas para hoy (más las atrasadas) con alta rápida. */
export function TareasDelDia({ compacta }: { compacta?: boolean }) {
  const tareas = useDatos((s) => s.tareas);
  const etiquetas = useDatos((s) => s.etiquetas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const [texto, setTexto] = useState('');
  const secciones = useMemo(
    () => seccionarTareas(tareas, new Date(), inicioSemana),
    [tareas, inicioSemana],
  );
  const hoyClave = claveDia(new Date());
  const hechasHoy = secciones.completadas.filter(
    (x) => x.planificacion.tipo === 'dia' && x.planificacion.fecha === hoyClave,
  );
  const lista = [
    ...ordenarTareas(secciones.atrasadas, 'prioridad'),
    ...ordenarTareas(secciones.hoy, 'prioridad'),
  ];

  const crear = async () => {
    const titulo = texto.trim();
    if (!titulo) return;
    setTexto('');
    try {
      await dbTareas.crear(
        tareaVacia({ titulo, planificacion: planificacionDe('hoy', inicioSemana) }),
      );
    } catch {
      avisar(t.comun.error, 'error');
    }
  };

  return (
    <section>
      <TituloSeccion
        icono={<ListTodo size={16} />}
        texto={t.hoy.tareasHoy}
        extra={
          (lista.length > 0 || hechasHoy.length > 0) && (
            <span className="text-xs font-bold text-texto-suave">
              {hechasHoy.length}/{hechasHoy.length + secciones.hoy.length}
            </span>
          )
        }
      />
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <input
          className="campo py-2 text-sm"
          placeholder={t.tareas.rapida}
          aria-label={t.tareas.nueva}
          value={texto}
          maxLength={300}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Boton type="submit" variante="suave" tamano="icono" aria-label={t.comun.añadir}>
          <Plus size={18} />
        </Boton>
      </form>
      {lista.length === 0 && hechasHoy.length === 0 ? (
        <p className="rounded-md bg-superficie-2 px-3 py-3 text-sm text-texto-suave">
          {t.hoy.tareasVacias}
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {lista.map((x) => (
              <TarjetaTarea
                key={x.id}
                tarea={x}
                etiqueta={buscarEtiqueta(etiquetas, x.etiquetaId)}
                compacta={compacta}
                mostrarPlan={secciones.atrasadas.includes(x)}
              />
            ))}
            {hechasHoy.map((x) => (
              <TarjetaTarea
                key={x.id}
                tarea={x}
                etiqueta={buscarEtiqueta(etiquetas, x.etiquetaId)}
                compacta
              />
            ))}
          </AnimatePresence>
          {lista.length === 0 && hechasHoy.length > 0 && (
            <p className="flex items-center gap-2 px-1 pt-1 text-sm font-semibold text-exito">
              <CheckCheck size={16} aria-hidden /> {t.logros.tareaHecha[3]}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Rutinas que tocan hoy, con su progreso y botón para empezar. */
export function RutinasDelDia() {
  const rutinas = useDatos((s) => s.rutinas);
  const ejecuciones = useDatos((s) => s.ejecuciones);
  const hoy = new Date();
  const lista = useMemo(() => rutinasDelDia(rutinas, hoy), [rutinas, hoy.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lista.length) return null;
  const claveHoy = claveDia(hoy);
  return (
    <section>
      <TituloSeccion icono={<Repeat size={16} />} texto={t.hoy.rutinasHoy} />
      <div className="space-y-1.5">
        {lista.map((r) => {
          const ejecucion = ejecuciones.find((e) => e.rutinaId === r.id && e.fecha === claveHoy);
          const hecha = !!ejecucion?.completada;
          const { racha } = seguimientoRutina(r, ejecuciones, hoy, addDays(hoy, 1), hoy);
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-md border border-borde bg-superficie px-3 py-2.5"
            >
              <span
                className="h-8 w-1.5 rounded-full"
                style={{ background: r.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${hecha ? 'line-through opacity-60' : ''}`}
                >
                  {r.nombre}
                </p>
                <p className="text-xs text-texto-suave">
                  {r.programacion.hora ?? '—'} ·{' '}
                  {t.rutinas.progreso(ejecucion?.pasosHechos.length ?? 0, r.pasos.length)}
                  {racha > 0 ? ` · 🔥 ${racha}` : ''}
                </p>
              </div>
              {!hecha && (
                <Link
                  to={`/rutinas/${r.id}/empezar`}
                  className="grid h-9 w-9 place-items-center rounded-full degradado-marca text-white shadow-media"
                  aria-label={`${t.rutinas.empezar}: ${r.nombre}`}
                >
                  <Play size={15} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
