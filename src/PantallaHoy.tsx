// Pantalla Hoy: saludo, resumen del día con anillos, avisos, inicio rápido de foco,
// tareas, rutinas y agenda.

import { useMemo } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Flame, Play, TriangleAlert } from 'lucide-react';
import { useDatos } from './almacenDatos';
import { useAvisosCarga } from './useCalendarioDatos';
import { useReloj } from './useReloj';
import { AnilloProgreso } from './AnilloProgreso';
import { NumeroAnimado } from './NumeroAnimado';
import { AgendaDelDia, AhoraYDespues, RutinasDelDia, TareasDelDia, useHoy } from './SeccionesHoy';
import { rachas, registrosEn } from './estadisticas';
import { claveDia, capitalizar, duracionTexto, formatear, MS_HORA } from './fechas';
import { useEstadoContador } from './useTemporizador';
import { useEsMovil } from './useMedia';
import { t } from './textos';

function saludo(hora: number): string {
  if (hora < 13) return t.hoy.saludoManana;
  if (hora < 21) return t.hoy.saludoTarde;
  return t.hoy.saludoNoche;
}

export function PantallaHoy() {
  const ahora = useReloj();
  const usuario = useDatos((s) => s.usuario);
  const registros = useDatos((s) => s.registros);
  const tareas = useDatos((s) => s.tareas);
  const { hoy, desde, hasta, ocurrencias } = useHoy();
  const avisos = useAvisosCarga();
  const { activo } = useEstadoContador();
  const esMovil = useEsMovil();
  const avisosHoy = avisos.filter((a) => a.fecha === claveDia(hoy));

  const resumen = useMemo(() => {
    const sesiones = ocurrencias.filter((o) => o.evento.tipo === 'sesion' && !o.evento.todoElDia);
    const planificado = sesiones.reduce((s, o) => s + (o.finMs - o.inicioMs), 0);
    const real = registrosEn(registros, desde, hasta).reduce((s, r) => s + r.focoRealMs, 0);
    const claveHoy = claveDia(hoy);
    const deHoy = tareas.filter(
      (x) => x.planificacion.tipo === 'dia' && x.planificacion.fecha === claveHoy,
    );
    const hechas = deHoy.filter((x) => x.completada).length;
    const bloques = ocurrencias.filter((o) => o.evento.tipo !== 'protegido' && !o.evento.todoElDia);
    const cumplidos = bloques.filter((o) => o.completado).length;
    return {
      planificado,
      real,
      hechas,
      totalTareas: deHoy.length,
      cumplidos,
      totalBloques: bloques.length,
      racha: rachas(registros, hoy).actual,
    };
  }, [ocurrencias, registros, tareas, desde, hasta, hoy]);

  const nombre = usuario?.nombre?.split(' ')[0] ?? '';
  const tarjetas = [
    {
      texto: t.hoy.focoHoy,
      progreso: resumen.planificado ? resumen.real / resumen.planificado : resumen.real ? 1 : 0,
      valor: (
        <NumeroAnimado
          valor={resumen.real / MS_HORA}
          formatear={(n) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`}
        />
      ),
      detalle: `${duracionTexto(resumen.planificado)} ${t.hoy.planificado}`,
      color: 'var(--mos-acento)',
    },
    {
      texto: t.hoy.tareasHoy,
      progreso: resumen.totalTareas ? resumen.hechas / resumen.totalTareas : 0,
      valor: (
        <NumeroAnimado
          valor={resumen.hechas}
          formatear={(n) => `${Math.round(n)}/${resumen.totalTareas}`}
        />
      ),
      detalle: t.hoy.hecho,
      color: 'var(--mos-exito)',
    },
    {
      texto: t.estadisticas.cumplimiento,
      progreso: resumen.totalBloques ? resumen.cumplidos / resumen.totalBloques : 0,
      valor: (
        <NumeroAnimado
          valor={resumen.cumplidos}
          formatear={(n) => `${Math.round(n)}/${resumen.totalBloques}`}
        />
      ),
      detalle: t.hoy.hecho,
      color: 'var(--mos-acento-2)',
    },
  ];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-texto-suave">
            {capitalizar(formatear(hoy, "EEEE d 'de' MMMM"))}
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            {saludo(new Date(ahora).getHours())}
            {nombre && <span className="texto-degradado">, {nombre}</span>}
          </h1>
        </div>
        {resumen.racha > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="chip border-aviso/30 bg-aviso/10 px-3 py-1.5 text-sm text-aviso"
          >
            <Flame size={16} aria-hidden /> {resumen.racha} {t.estadisticas.dias}
          </motion.div>
        )}
      </header>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {tarjetas.map((c, i) => (
          <motion.div
            key={c.texto}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="tarjeta flex flex-col items-center gap-2 p-3 text-center sm:flex-row sm:gap-4 sm:p-[var(--mos-relleno-tarjeta)] sm:text-left"
          >
            <AnilloProgreso
              progreso={c.progreso}
              tamano={esMovil ? 48 : 68}
              grosor={esMovil ? 6 : 8}
              color={c.color}
              etiqueta={c.texto}
            />
            <div className="min-w-0">
              <p className="text-[10px] leading-tight font-bold tracking-wide text-texto-tenue uppercase sm:text-xs">
                {c.texto}
              </p>
              <p className="text-lg font-extrabold sm:text-2xl">{c.valor}</p>
              <p className="hidden truncate text-xs text-texto-suave sm:block">{c.detalle}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {avisosHoy.length > 0 && (
        <Link
          to="/avisos"
          className="mb-5 flex items-center gap-3 rounded-lg border border-aviso/40 bg-aviso/10 px-4 py-3 text-sm font-semibold text-texto hover:bg-aviso/15"
        >
          <TriangleAlert size={18} className="shrink-0 text-aviso" aria-hidden />
          <span className="flex-1">
            {t.hoy.avisosHoy(avisosHoy.length)} ·{' '}
            <span className="font-normal text-texto-suave">{avisosHoy[0].titulo}</span>
          </span>
          <ArrowRight size={16} aria-hidden />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <AhoraYDespues ocurrencias={ocurrencias} />
          {!activo && (
            <Link
              to="/foco"
              className="tarjeta degradado-marca flex items-center gap-4 border-0 text-white shadow-media transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20">
                <Play size={22} aria-hidden />
              </span>
              <div>
                <p className="text-lg font-extrabold">{t.hoy.empezarFoco}</p>
                <p className="text-sm text-white/85">{t.foco.sinSesion}</p>
              </div>
              <ArrowRight className="ml-auto" size={20} aria-hidden />
            </Link>
          )}
          <div className="tarjeta">
            <TareasDelDia />
          </div>
          <RutinasDelDia />
        </div>
        <div className="tarjeta">
          <AgendaDelDia ocurrencias={ocurrencias} />
        </div>
      </div>
    </div>
  );
}
