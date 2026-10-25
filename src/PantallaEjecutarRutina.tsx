// Modo "Empezar rutina": guía paso a paso con la tarjeta del paso actual, el siguiente,
// el progreso y avisos al cambiar de paso. El avance se guarda en routineRuns, así que
// se puede seguir desde otro dispositivo.
// Las rutinas de estudio lanzan el contador con su ciclo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Flag, Play, SkipForward, Trophy } from 'lucide-react';
import { useDatos, buscarEtiqueta } from './almacenDatos';
import { avisar } from './almacenUI';
import { COLECCIONES, ejecuciones as dbEjecuciones, refDoc } from './datos';
import { deleteDoc, setDoc } from 'firebase/firestore';
import { Boton } from './Boton';
import { AnilloProgreso } from './AnilloProgreso';
import { ChipEtiqueta } from './ChipEtiqueta';
import { EstadoVacio } from './EstadoVacio';
import { expandirCiclo } from './ciclos';
import { iniciarSesion } from './temporizador';
import { idRecordatorio } from './recordatorios';
import { reproducir, vibrar } from './sonidos';
import { mostrarNotificacionLocal } from './serviceWorker';
import { claveDia, relojTexto } from './fechas';
import { t } from './textos';
import type { EjecucionRutina } from './tipos';

export function PantallaEjecutarRutina() {
  const { id } = useParams();
  const navegar = useNavigate();
  const rutina = useDatos((s) => s.rutinas.find((r) => r.id === id));
  const ejecuciones = useDatos((s) => s.ejecuciones);
  const ciclos = useDatos((s) => s.ciclos);
  const etiquetas = useDatos((s) => s.etiquetas);
  const uid = useDatos((s) => s.usuario?.uid);
  const ajustes = useDatos((s) => s.ajustes);
  const hoy = claveDia(new Date());
  const ejecucion = ejecuciones.find((e) => e.rutinaId === id && e.fecha === hoy) ?? null;
  const [ahora, setAhora] = useState(Date.now());
  const creando = useRef(false);
  const avisadoPaso = useRef<string | null>(null);

  // Al entrar, creamos (o retomamos) la ejecución de hoy de una rutina de pasos
  useEffect(() => {
    if (!rutina || rutina.clase !== 'pasos' || ejecucion || creando.current || !rutina.pasos.length)
      return;
    creando.current = true;
    void dbEjecuciones.crear({
      rutinaId: rutina.id,
      fecha: hoy,
      inicioMs: Date.now(),
      finMs: null,
      pasosHechos: [],
      pasosTotales: rutina.pasos.length,
      completada: false,
      indicePaso: 0,
      inicioPasoMs: Date.now(),
    });
  }, [rutina, ejecucion, hoy]);

  useEffect(() => {
    const idIntervalo = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(idIntervalo);
  }, []);

  const paso = rutina && ejecucion ? rutina.pasos[ejecucion.indicePaso] : undefined;
  const siguiente = rutina && ejecucion ? rutina.pasos[ejecucion.indicePaso + 1] : undefined;
  const duracionPasoMs = (paso?.duracionMin ?? 0) * 60_000;
  const transcurrido = ejecucion?.inicioPasoMs ? ahora - ejecucion.inicioPasoMs : 0;
  const restante = duracionPasoMs - transcurrido;

  // Recordatorio en el servidor para el fin del paso (llega aunque cierres la app)
  useEffect(() => {
    if (
      !uid ||
      !rutina ||
      !ejecucion ||
      !paso ||
      !duracionPasoMs ||
      !ejecucion.inicioPasoMs ||
      ejecucion.completada
    )
      return;
    if (!ajustes.notificaciones.activas || !ajustes.notificaciones.tipos.pasoRutina) return;
    const fireAt = ejecucion.inicioPasoMs + duracionPasoMs;
    if (fireAt <= Date.now()) return;
    const refId = `ejec-${ejecucion.id}-${paso.id}`;
    const idDoc = idRecordatorio('pasoRutina', refId, fireAt);
    const ref = refDoc(COLECCIONES.recordatorios, idDoc);
    void setDoc(ref, {
      uid,
      tipo: 'pasoRutina',
      refId,
      fireAt,
      titulo: siguiente ? t.rutinas.finPaso(siguiente.titulo) : t.rutinas.terminada,
      cuerpo: rutina.nombre,
      url: `/rutinas/${rutina.id}/empezar`,
      enviado: false,
      creadoEnMs: Date.now(),
    }).catch(() => undefined);
    return () => {
      void deleteDoc(ref).catch(() => undefined);
    };
  }, [uid, rutina, ejecucion, paso, siguiente, duracionPasoMs, ajustes.notificaciones]);

  // Aviso local al acabarse el tiempo del paso
  useEffect(() => {
    if (
      !paso ||
      !duracionPasoMs ||
      restante > 0 ||
      avisadoPaso.current === `${ejecucion?.id}-${paso.id}`
    )
      return;
    avisadoPaso.current = `${ejecucion?.id}-${paso.id}`;
    const texto = siguiente ? t.rutinas.finPaso(siguiente.titulo) : t.rutinas.terminada;
    if (ajustes.temporizador.sonido) reproducir('aviso', ajustes.temporizador.volumen);
    if (ajustes.temporizador.vibracion) vibrar();
    if (document.visibilityState === 'visible') avisar(texto, 'info');
    else
      void mostrarNotificacionLocal(rutina?.nombre ?? '', texto, `/rutinas/${rutina?.id}/empezar`);
  }, [restante, paso, siguiente, duracionPasoMs, ejecucion?.id, rutina, ajustes.temporizador]);

  const progreso = useMemo(
    () => (rutina && ejecucion ? ejecucion.indicePaso / Math.max(1, rutina.pasos.length) : 0),
    [rutina, ejecucion],
  );

  if (!rutina) {
    return (
      <EstadoVacio
        icono={<Flag size={28} />}
        titulo={t.rutinas.vacioTitulo}
        texto=""
        accion={
          <Link to="/rutinas" className="font-semibold text-acento">
            {t.comun.volver}
          </Link>
        }
      />
    );
  }

  const avanzar = async (hecho: boolean) => {
    if (!ejecucion || !paso) return;
    const pasosHechos = hecho
      ? [...new Set([...ejecucion.pasosHechos, paso.id])]
      : ejecucion.pasosHechos;
    const indice = ejecucion.indicePaso + 1;
    const fin = indice >= rutina.pasos.length;
    const cambios: Partial<EjecucionRutina> = {
      pasosHechos,
      indicePaso: indice,
      inicioPasoMs: fin ? null : Date.now(),
      completada: fin && pasosHechos.length > 0,
      finMs: fin ? Date.now() : null,
    };
    await dbEjecuciones.actualizar(ejecucion.id, cambios);
    if (siguiente && ajustes.temporizador.sonido) reproducir('foco', ajustes.temporizador.volumen);
    if (fin) {
      reproducir('fin', ajustes.temporizador.volumen);
      avisar(t.rutinas.terminada, 'logro');
    }
  };

  const terminarYa = async () => {
    if (ejecucion)
      await dbEjecuciones.actualizar(ejecucion.id, {
        finMs: Date.now(),
        indicePaso: rutina.pasos.length,
        inicioPasoMs: null,
        completada: ejecucion.pasosHechos.length === rutina.pasos.length,
      });
    navegar('/rutinas');
  };

  const cabecera = (
    <div className="mb-6 flex items-center gap-3">
      <Link
        to="/rutinas"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-superficie-2"
        aria-label={t.comun.volver}
      >
        <ArrowLeft size={20} />
      </Link>
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-texto-tenue uppercase">
          {t.rutinas.ambitoUno[rutina.ambito]}
        </p>
        <h1 className="truncate text-2xl font-extrabold">{rutina.nombre}</h1>
      </div>
    </div>
  );

  // Rutina de estudio: lanza el contador con el ciclo de la rutina
  if (rutina.clase === 'estudio') {
    const ciclo = ciclos.find((c) => c.id === rutina.cicloId);
    return (
      <div className="mx-auto max-w-xl">
        {cabecera}
        <div className="tarjeta space-y-4 text-center">
          <p className="text-sm text-texto-suave">{ciclo ? ciclo.nombre : t.foco.vacioCiclos}</p>
          {ejecucion?.completada ? (
            <p className="font-bold text-exito">{t.rutinas.hechaHoy}</p>
          ) : (
            <Boton
              variante="primario"
              tamano="lg"
              className="mx-auto"
              icono={<Play size={18} />}
              disabled={!ciclo}
              onClick={async () => {
                if (!ciclo) return;
                await iniciarSesion({
                  modo: 'ciclo',
                  fases: expandirCiclo(ciclo),
                  etiquetaId: rutina.etiquetaId,
                  tareaId: null,
                  eventoId: null,
                  cicloId: ciclo.id,
                  rutinaId: rutina.id,
                });
                navegar('/foco');
              }}
            >
              {t.rutinas.empezarEstudio}
            </Boton>
          )}
        </div>
      </div>
    );
  }

  if (!rutina.pasos.length) {
    return (
      <div className="mx-auto max-w-xl">
        {cabecera}
        <EstadoVacio icono={<Flag size={28} />} titulo={t.rutinas.sinPasos} texto="" />
      </div>
    );
  }

  const terminada = !!ejecucion && ejecucion.indicePaso >= rutina.pasos.length;

  return (
    <div className="mx-auto max-w-xl">
      {cabecera}
      <div className="mb-5">
        <div className="mb-1.5 flex justify-between text-xs font-semibold text-texto-suave">
          <span>
            {t.rutinas.progreso(
              Math.min(ejecucion?.indicePaso ?? 0, rutina.pasos.length),
              rutina.pasos.length,
            )}
          </span>
          <span>{Math.round(progreso * 100)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-superficie-3">
          <motion.div
            className="h-full rounded-full"
            style={{ background: rutina.color }}
            animate={{ width: `${progreso * 100}%` }}
            transition={{ type: 'spring', damping: 26 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {terminada ? (
          <motion.div
            key="fin"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="tarjeta py-10 text-center"
          >
            <motion.div
              initial={{ rotate: -20, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring' }}
              className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full degradado-marca text-white shadow-elevada"
            >
              <Trophy size={36} />
            </motion.div>
            <h2 className="text-2xl font-extrabold">{t.rutinas.terminada}</h2>
            <p className="mt-1 text-sm text-texto-suave">{t.rutinas.terminadaTexto}</p>
            <p className="mt-3 text-sm font-semibold">
              {t.rutinas.progreso(ejecucion?.pasosHechos.length ?? 0, rutina.pasos.length)}
            </p>
            <Link
              to="/rutinas"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-superficie-2 px-4 text-sm font-semibold hover:bg-superficie-3"
            >
              {t.comun.volver}
            </Link>
          </motion.div>
        ) : (
          paso && (
            <motion.div
              key={paso.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="tarjeta text-center shadow-media"
                style={{ borderTop: `4px solid ${rutina.color}` }}
              >
                <p className="text-xs font-bold tracking-wide text-texto-tenue uppercase">
                  {t.rutinas.pasoActual}
                </p>
                <h2 className="mt-1 text-3xl font-extrabold">{paso.titulo}</h2>
                {paso.descripcion && (
                  <p className="mt-2 text-sm text-texto-suave">{paso.descripcion}</p>
                )}
                <div className="mt-2 flex justify-center gap-2">
                  {paso.etiquetaId && (
                    <ChipEtiqueta etiqueta={buscarEtiqueta(etiquetas, paso.etiquetaId)} />
                  )}
                  {paso.hora && <span className="chip">{paso.hora}</span>}
                </div>
                {duracionPasoMs > 0 && (
                  <div className="mt-5 flex justify-center">
                    <AnilloProgreso
                      progreso={Math.min(1, transcurrido / duracionPasoMs)}
                      tamano={170}
                      grosor={12}
                      color={restante > 0 ? rutina.color : 'var(--mos-exito)'}
                      suavidad={0.4}
                    >
                      <span className="numeros text-3xl font-extrabold">
                        {restante > 0 ? relojTexto(restante) : '✓'}
                      </span>
                    </AnilloProgreso>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Boton
                    variante="primario"
                    tamano="lg"
                    icono={<Check size={18} />}
                    onClick={() => avanzar(true)}
                  >
                    {t.rutinas.hecho}
                  </Boton>
                  <Boton
                    variante="secundario"
                    tamano="lg"
                    icono={<SkipForward size={16} />}
                    onClick={() => avanzar(false)}
                  >
                    {t.rutinas.saltarPaso}
                  </Boton>
                </div>
              </div>
              {siguiente && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-borde-fuerte px-4 py-3 text-left">
                  <span className="text-xs font-bold tracking-wide text-texto-tenue uppercase">
                    {t.rutinas.pasoSiguiente}
                  </span>
                  <span className="truncate font-semibold">{siguiente.titulo}</span>
                  {siguiente.duracionMin ? (
                    <span className="ml-auto text-xs text-texto-suave">
                      {siguiente.duracionMin} min
                    </span>
                  ) : null}
                </div>
              )}
              <div className="mt-4 text-center">
                <Boton variante="fantasma" tamano="sm" onClick={terminarYa}>
                  {t.rutinas.terminarYa}
                </Boton>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
