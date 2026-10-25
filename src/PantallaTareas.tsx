// Pantalla de tareas: secciones Atrasadas, Hoy, Esta semana (flexible), Próximas y Sin fecha,
// con filtros por etiqueta y prioridad, orden y alta rápida.

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ListTodo, Plus } from 'lucide-react';
import { buscarEtiqueta, etiquetasActivas, useDatos } from './almacenDatos';
import { useUI, avisar } from './almacenUI';
import { tareas as dbTareas } from './datos';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { EstadoVacio } from './EstadoVacio';
import { TarjetaTarea } from './TarjetaTarea';
import { Interruptor } from './Campos';
import { planificacionDe, tareaVacia } from './operaciones';
import {
  ordenarTareas,
  seccionarTareas,
  type OrdenTareas,
  type SeccionesTareas,
} from './tareasLogica';
import { t } from './textos';
import type { Prioridad, Tarea } from './tipos';

type Destino = 'hoy' | 'semana' | 'sinFecha';

export function PantallaTareas() {
  const tareas = useDatos((s) => s.tareas);
  const etiquetas = useDatos((s) => s.etiquetas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const poner = useUI((s) => s.poner);
  const [texto, setTexto] = useState('');
  const [destino, setDestino] = useState<Destino>('hoy');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | ''>('');
  const [orden, setOrden] = useState<OrdenTareas>('prioridad');
  const [verHechas, setVerHechas] = useState(false);

  const filtradas = useMemo(
    () =>
      tareas.filter(
        (x) =>
          (!filtroEtiqueta || x.etiquetaId === filtroEtiqueta) &&
          (!filtroPrioridad || x.prioridad === filtroPrioridad),
      ),
    [tareas, filtroEtiqueta, filtroPrioridad],
  );
  const secciones = useMemo(
    () => seccionarTareas(filtradas, new Date(), inicioSemana),
    [filtradas, inicioSemana],
  );
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);

  const crear = async () => {
    const titulo = texto.trim();
    if (!titulo) return;
    setTexto('');
    try {
      await dbTareas.crear(
        tareaVacia({
          titulo,
          planificacion: planificacionDe(destino, inicioSemana),
          etiquetaId: filtroEtiqueta || null,
        }),
      );
    } catch {
      avisar(t.comun.error, 'error');
    }
  };

  const orden_ = (lista: Tarea[]) => ordenarTareas(lista, orden);
  const claves: Array<keyof SeccionesTareas> = [
    'atrasadas',
    'hoy',
    'semana',
    'proximas',
    'sinFecha',
  ];
  const totalPendientes = claves.reduce((s, c) => s + secciones[c].length, 0);

  return (
    <div>
      <Cabecera
        titulo={t.tareas.titulo}
        acciones={
          <Boton
            variante="primario"
            icono={<Plus size={16} />}
            onClick={() => poner({ editorTarea: { tarea: null } })}
          >
            {t.tareas.nueva}
          </Boton>
        }
      />

      <form
        className="tarjeta mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <input
          className="campo flex-1"
          placeholder={t.tareas.rapida}
          aria-label={t.tareas.nueva}
          value={texto}
          maxLength={300}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="campo w-auto"
            aria-label={t.tareas.planificada}
            value={destino}
            onChange={(e) => setDestino(e.target.value as Destino)}
          >
            <option value="hoy">{t.tareas.planHoy}</option>
            <option value="semana">{t.tareas.secciones.semana}</option>
            <option value="sinFecha">{t.tareas.planSinFecha}</option>
          </select>
          <Boton type="submit" variante="primario" icono={<Plus size={16} />}>
            {t.comun.añadir}
          </Boton>
        </div>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          className="campo w-auto py-1.5 text-sm"
          aria-label={t.comun.etiqueta}
          value={filtroEtiqueta}
          onChange={(e) => setFiltroEtiqueta(e.target.value)}
        >
          <option value="">{`${t.comun.etiqueta}: ${t.comun.todas}`}</option>
          {activas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select
          className="campo w-auto py-1.5 text-sm"
          aria-label={t.tareas.prioridad}
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as Prioridad | '')}
        >
          <option value="">{`${t.tareas.prioridad}: ${t.comun.todas}`}</option>
          {(Object.keys(t.tareas.prioridades) as Prioridad[]).map((p) => (
            <option key={p} value={p}>
              {t.tareas.prioridades[p]}
            </option>
          ))}
        </select>
        <select
          className="campo w-auto py-1.5 text-sm"
          aria-label={t.tareas.orden}
          value={orden}
          onChange={(e) => setOrden(e.target.value as OrdenTareas)}
        >
          {(Object.keys(t.tareas.ordenes) as OrdenTareas[]).map((o) => (
            <option key={o} value={o}>
              {`${t.tareas.orden}: ${t.tareas.ordenes[o]}`}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <Interruptor
            etiqueta={t.tareas.verCompletadas}
            activo={verHechas}
            alCambiar={setVerHechas}
          />
        </div>
      </div>

      {totalPendientes === 0 && !verHechas ? (
        <EstadoVacio
          icono={<ListTodo size={28} />}
          titulo={t.tareas.vacioTitulo}
          texto={t.tareas.vacioTexto}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {claves.map((c) => (
            <Seccion
              key={c}
              titulo={t.tareas.secciones[c]}
              lista={orden_(secciones[c])}
              etiquetasDe={(x) => buscarEtiqueta(etiquetas, x.etiquetaId)}
              peligro={c === 'atrasadas'}
              mostrarPlan={c === 'atrasadas' || c === 'proximas'}
            />
          ))}
          {verHechas && (
            <Seccion
              titulo={t.tareas.secciones.completadas}
              lista={secciones.completadas.slice(0, 100)}
              etiquetasDe={(x) => buscarEtiqueta(etiquetas, x.etiquetaId)}
              plegable
            />
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  lista,
  etiquetasDe,
  peligro,
  plegable,
  mostrarPlan,
}: {
  titulo: string;
  lista: Tarea[];
  etiquetasDe: (x: Tarea) => ReturnType<typeof buscarEtiqueta>;
  peligro?: boolean;
  plegable?: boolean;
  mostrarPlan?: boolean;
}) {
  const [abierta, setAbierta] = useState(true);
  if (!lista.length) return null;
  return (
    <motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button
        type="button"
        onClick={() => plegable && setAbierta(!abierta)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <h2
          className={`text-sm font-extrabold tracking-wide uppercase ${peligro ? 'text-peligro' : 'text-texto-suave'}`}
        >
          {titulo}
        </h2>
        <span className="rounded-full bg-superficie-2 px-2 text-xs font-bold text-texto-suave">
          {lista.length}
        </span>
        {plegable && (
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform ${abierta ? '' : '-rotate-90'}`}
            aria-hidden
          />
        )}
      </button>
      {abierta && (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {lista.map((x) => (
              <TarjetaTarea
                key={x.id}
                tarea={x}
                etiqueta={etiquetasDe(x)}
                mostrarPlan={mostrarPlan}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}
