// Pantalla de foco: prepara una sesión (etiqueta, tarea, ciclo o cronómetro libre) y,
// cuando está en marcha, muestra el anillo de progreso, la fase, el tiempo restante,
// la siguiente fase y los controles. Todo sincronizado entre dispositivos.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  CloudCheck,
  Pause,
  Play,
  Plus,
  Scissors,
  SkipForward,
  Square,
  Star,
  Timer,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import { buscarEtiqueta, etiquetasActivas, useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { useEstadoContador } from './useTemporizador';
import {
  añadirMinutos,
  cortarFaseEn,
  detener,
  iniciarSesion,
  pausar,
  reanudar,
  resumenDe,
  saltarFase,
  seguir,
  terminarYGuardar,
  type ResumenSesion,
} from './temporizador';
import { duracionTotal, expandirCiclo, plantillasDeArranque } from './ciclos';
import { ciclos as dbCiclos, nuevoId } from './datos';
import { useOcurrencias } from './useCalendarioDatos';
import { AnilloProgreso } from './AnilloProgreso';
import { Boton } from './Boton';
import { Modal } from './Modal';
import { BarraFases } from './BarraFases';
import { Campo, Segmentado } from './Campos';
import { IconoEtiqueta } from './IconoEtiqueta';
import { duracionTexto, formatearHora, relojTexto } from './fechas';
import { deboIgnorarTecla } from './useAtajos';
import { useEsMovil } from './useMedia';
import { esNativo, mantenerPantallaEncendida } from './nativo';
import { t } from './textos';

export function PantallaFoco() {
  const { activo } = useEstadoContador();
  return activo ? <SesionEnCurso /> : <PrepararSesion />;
}

function PrepararSesion() {
  const etiquetas = useDatos((s) => s.etiquetas);
  const tareas = useDatos((s) => s.tareas);
  const ciclos = useDatos((s) => s.ciclos);
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null);
  const [tareaId, setTareaId] = useState<string>('');
  const [modo, setModo] = useState<'ciclo' | 'cronometro'>('ciclo');
  const [cicloId, setCicloId] = useState<string>('');
  const [empezando, setEmpezando] = useState(false);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const ciclo = ciclos.find((c) => c.id === cicloId) ?? ciclos[0];
  const fases = useMemo(() => (ciclo ? expandirCiclo(ciclo) : []), [ciclo]);
  const pendientes = tareas.filter(
    (x) => !x.completada && (!etiquetaId || x.etiquetaId === etiquetaId || !x.etiquetaId),
  );

  const empezar = async () => {
    setEmpezando(true);
    try {
      await iniciarSesion({
        modo: modo === 'ciclo' && ciclo ? 'ciclo' : 'cronometro',
        fases,
        etiquetaId,
        tareaId: tareaId || null,
        eventoId: null,
        cicloId: modo === 'ciclo' ? (ciclo?.id ?? null) : null,
      });
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
      setEmpezando(false);
    }
  };

  const añadirArranque = async () => {
    await dbCiclos.crearVarios(plantillasDeArranque(nuevoId));
    avisar(t.comun.guardado, 'exito');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-3xl font-extrabold">{t.foco.titulo}</h1>
      <p className="mb-6 text-sm text-texto-suave">{t.foco.sinSesion}</p>

      <div className="tarjeta space-y-5">
        <div>
          <p className="etiqueta-campo">{t.foco.etiqueta}</p>
          <div className="flex flex-wrap gap-2">
            {activas.map((e) => {
              const elegida = etiquetaId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => setEtiquetaId(elegida ? null : e.id)}
                  className="flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all"
                  style={
                    elegida
                      ? { background: e.color, borderColor: e.color, color: '#fff' }
                      : { borderColor: `color-mix(in oklab, ${e.color} 40%, transparent)` }
                  }
                >
                  <IconoEtiqueta nombre={e.icono} tamano={14} />
                  {e.nombre}
                </button>
              );
            })}
            {activas.length === 0 && (
              <Link to="/etiquetas" className="text-sm font-semibold text-acento hover:underline">
                {t.calendario.crearEtiquetas}
              </Link>
            )}
          </div>
        </div>

        <Campo etiqueta={t.foco.tarea}>
          {(id) => (
            <select
              id={id}
              className="campo"
              value={tareaId}
              onChange={(e) => setTareaId(e.target.value)}
            >
              <option value="">{t.comun.ninguna}</option>
              {pendientes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <div>
          <Segmentado
            etiqueta={t.foco.ciclo}
            valor={modo}
            alCambiar={setModo}
            opciones={[
              { valor: 'ciclo', texto: t.foco.ciclo, icono: <Workflow size={14} /> },
              { valor: 'cronometro', texto: t.foco.cronometro, icono: <Timer size={14} /> },
            ]}
          />
        </div>

        {modo === 'ciclo' &&
          (ciclos.length === 0 ? (
            <div className="rounded-md bg-superficie-2 p-4 text-sm text-texto-suave">
              <p>{t.foco.vacioCiclos}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Boton variante="suave" tamano="sm" onClick={añadirArranque}>
                  {t.ciclos.arranque}
                </Boton>
                <Link
                  to="/ciclos"
                  className="inline-flex h-8 items-center rounded-sm px-3 text-sm font-semibold text-acento hover:bg-acento/10"
                >
                  {t.ciclos.nuevo}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <Campo etiqueta={t.foco.ciclo} className="flex-1">
                  {(id) => (
                    <select
                      id={id}
                      className="campo"
                      value={ciclo?.id ?? ''}
                      onChange={(e) => setCicloId(e.target.value)}
                    >
                      {ciclos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Link
                  to="/ciclos"
                  className="inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold text-acento hover:bg-acento/10"
                >
                  {t.foco.editarCiclos}
                </Link>
              </div>
              <BarraFases fases={fases} />
              <p className="text-xs text-texto-suave">
                {t.ciclos.total(duracionTexto(duracionTotal(fases)))}
              </p>
            </div>
          ))}

        <Boton
          variante="primario"
          tamano="lg"
          className="w-full justify-center"
          icono={<Play size={18} />}
          onClick={empezar}
          cargando={empezando}
        >
          {t.foco.empezar}
        </Boton>
      </div>
    </div>
  );
}

function SesionEnCurso() {
  const { contador, fase, siguiente, restanteMs, transcurridoMs, progreso, cicloTerminado, ahora } =
    useEstadoContador();
  const etiquetas = useDatos((s) => s.etiquetas);
  const tareas = useDatos((s) => s.tareas);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const esMovil = useEsMovil();
  const [resumen, setResumen] = useState<ResumenSesion | null>(null);
  const [nota, setNota] = useState('');
  const [valoracion, setValoracion] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ¿La fase actual invade un bloque protegido o el siguiente evento?
  const finFase = ahora + restanteMs;
  const proximos = useOcurrencias(ahora, ahora + 6 * 3_600_000);
  const invadido = useMemo(() => {
    if (!contador || contador.modo !== 'ciclo' || contador.estado !== 'enCurso' || !fase)
      return null;
    return (
      proximos.find(
        (o) =>
          !o.evento.todoElDia &&
          o.evento.id !== contador.eventoId &&
          o.inicioMs > ahora &&
          o.inicioMs < finFase &&
          (o.evento.tipo === 'protegido' || o.evento.tipo === 'evento'),
      ) ?? null
    );
  }, [proximos, contador, fase, ahora, finFase]);

  // App Android: la pantalla no se apaga mientras corre el contador
  const corriendo = contador?.estado === 'enCurso';
  useEffect(() => {
    if (!esNativo) return;
    void mantenerPantallaEncendida(corriendo);
    return () => void mantenerPantallaEncendida(false);
  }, [corriendo]);

  // Espacio = pausar / reanudar
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (deboIgnorarTecla(e) || e.key !== ' ' || !contador) return;
      e.preventDefault();
      if (contador.estado === 'enCurso') void pausar();
      else if (contador.estado === 'pausado') void reanudar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [contador]);

  if (!contador) return null;
  const etiqueta = buscarEtiqueta(etiquetas, contador.etiquetaId);
  const tarea = tareas.find((x) => x.id === contador.tareaId);
  const color = cicloTerminado
    ? 'var(--mos-exito)'
    : (fase?.color ?? etiqueta?.color ?? 'var(--mos-acento)');
  const pausado = contador.estado === 'pausado';
  const esperando = contador.estado === 'esperando';
  const cronometro = contador.modo === 'cronometro';
  const tamano = esMovil ? 250 : 320;

  const abrirGuardar = () => {
    setResumen(resumenDe(contador));
    setNota('');
    setValoracion(null);
  };

  const guardar = async () => {
    if (!resumen) return;
    setGuardando(true);
    try {
      await terminarYGuardar(resumen, nota.trim(), valoracion, contador.rutinaId ?? null);
      avisar(t.foco.sesionGuardada, 'logro');
      setResumen(null);
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      {/* Fondo suave con el color de la fase */}
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10"
        animate={{
          background: `radial-gradient(60% 50% at 50% 30%, color-mix(in oklab, ${color} 16%, transparent), transparent)`,
        }}
        transition={{ duration: 1 }}
        aria-hidden
      />

      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {etiqueta && (
          <span
            className="chip text-sm"
            style={{
              background: `color-mix(in oklab, ${etiqueta.color} 15%, transparent)`,
              color: etiqueta.color,
            }}
          >
            <IconoEtiqueta nombre={etiqueta.icono} tamano={14} /> {etiqueta.nombre}
          </span>
        )}
        {tarea && <span className="chip text-sm">{tarea.titulo}</span>}
        <span className="chip text-xs text-exito" title={t.foco.enOtroDispositivo}>
          <CloudCheck size={13} aria-hidden /> {t.foco.enOtroDispositivo}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={`${contador.indiceFase}-${contador.estado}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="mb-3 text-lg font-extrabold"
          style={{ color }}
          aria-live="assertive"
        >
          {cicloTerminado
            ? t.foco.cicloTerminado
            : esperando
              ? t.foco.esperando
              : cronometro
                ? t.foco.cronometro
                : fase?.nombre}
        </motion.p>
      </AnimatePresence>

      <AnilloProgreso
        progreso={
          cronometro ? (transcurridoMs % 3_600_000) / 3_600_000 : cicloTerminado ? 1 : progreso
        }
        tamano={tamano}
        grosor={esMovil ? 14 : 18}
        color={color}
        suavidad={0.4}
      >
        <div>
          <p
            className={`numeros font-titulos font-extrabold tracking-tight ${esMovil ? 'text-5xl' : 'text-7xl'} ${pausado ? 'animate-pulse opacity-70' : ''}`}
            aria-label="Tiempo"
          >
            {cronometro
              ? relojTexto(transcurridoMs)
              : cicloTerminado
                ? '✓'
                : relojTexto(restanteMs)}
          </p>
          {!cronometro && !cicloTerminado && (
            <p className="mt-1 text-sm text-texto-suave">
              {siguiente
                ? `${t.foco.siguienteFase}: ${siguiente.nombre} · ${Math.round(siguiente.duracionMs / 60000)}′`
                : t.foco.ultimaFase}
            </p>
          )}
          {pausado && (
            <p className="mt-1 text-xs font-bold tracking-wide text-aviso uppercase">
              {t.foco.pausar}
            </p>
          )}
        </div>
      </AnilloProgreso>

      {!cronometro && contador.fases.length > 1 && (
        <div className="mt-6 w-full max-w-md">
          <BarraFases fases={contador.fases} indiceActual={contador.indiceFase} />
        </div>
      )}

      {invadido && (
        <div className="mt-5 flex w-full max-w-md flex-wrap items-center gap-2 rounded-lg border border-aviso/40 bg-aviso/10 px-4 py-3 text-left text-sm">
          <TriangleAlert size={18} className="shrink-0 text-aviso" aria-hidden />
          <span className="flex-1">
            {t.foco.invade(invadido.titulo, formatearHora(invadido.inicioMs, formato24h))}
          </span>
          <Boton
            variante="secundario"
            tamano="sm"
            icono={<Scissors size={14} />}
            onClick={() => cortarFaseEn(invadido.inicioMs)}
          >
            {t.foco.cortar}
          </Boton>
        </div>
      )}

      {(esperando || cicloTerminado) && (
        <p className="mt-5 max-w-sm text-sm text-texto-suave">
          {cicloTerminado ? t.foco.cicloTerminadoTexto : t.foco.esperandoTexto}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {cicloTerminado ? (
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Square size={16} />}
            onClick={abrirGuardar}
          >
            {t.foco.guardarTitulo}
          </Boton>
        ) : esperando ? (
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Play size={18} />}
            onClick={() => seguir()}
          >
            {t.foco.seguir}
          </Boton>
        ) : pausado ? (
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Play size={18} />}
            onClick={() => reanudar()}
          >
            {t.foco.reanudar}
          </Boton>
        ) : (
          <Boton
            variante="primario"
            tamano="lg"
            icono={<Pause size={18} />}
            onClick={() => pausar()}
          >
            {t.foco.pausar}
          </Boton>
        )}
        {!cronometro && !cicloTerminado && (
          <>
            <Boton
              variante="secundario"
              tamano="lg"
              icono={<SkipForward size={16} />}
              onClick={() => saltarFase()}
            >
              {t.foco.saltar}
            </Boton>
            {!esperando && (
              <Boton
                variante="secundario"
                tamano="lg"
                icono={<Plus size={16} />}
                onClick={() => añadirMinutos(5)}
              >
                {t.foco.mas5}
              </Boton>
            )}
          </>
        )}
        {!cicloTerminado && (
          <Boton
            variante="fantasma"
            tamano="lg"
            icono={<Square size={16} />}
            onClick={abrirGuardar}
          >
            {t.foco.terminar}
          </Boton>
        )}
      </div>

      <Modal
        abierto={!!resumen}
        alCerrar={() => setResumen(null)}
        titulo={t.foco.guardarTitulo}
        ancho="sm"
        pie={
          <>
            <Boton
              variante="fantasma"
              onClick={async () => {
                await detener();
                setResumen(null);
              }}
            >
              {t.foco.descartar}
            </Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {t.comun.guardar}
            </Boton>
          </>
        }
      >
        {resumen && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-superficie-2 p-2">
                <p className="text-lg font-extrabold">{duracionTexto(resumen.focoRealMs)}</p>
                <p className="text-[11px] text-texto-suave">{t.estadisticas.focoReal}</p>
              </div>
              <div className="rounded-md bg-superficie-2 p-2">
                <p className="text-lg font-extrabold">{duracionTexto(resumen.descansosMs)}</p>
                <p className="text-[11px] text-texto-suave">Descansos</p>
              </div>
              <div className="rounded-md bg-superficie-2 p-2">
                <p className="text-lg font-extrabold">{resumen.interrupciones}</p>
                <p className="text-[11px] text-texto-suave">{t.foco.interrupciones}</p>
              </div>
            </div>
            <div>
              <p className="etiqueta-campo">{t.foco.valoracion}</p>
              <div role="radiogroup" aria-label={t.foco.valoracion} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={valoracion === n}
                    aria-label={`${n}`}
                    onClick={() => setValoracion(valoracion === n ? null : n)}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={
                        valoracion !== null && n <= valoracion
                          ? 'fill-aviso text-aviso'
                          : 'text-borde-fuerte'
                      }
                    />
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-texto-tenue">{t.foco.valoracionAyuda}</p>
            </div>
            <Campo etiqueta={t.foco.nota}>
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  maxLength={2000}
                  className="campo"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              )}
            </Campo>
          </div>
        )}
      </Modal>
    </div>
  );
}
