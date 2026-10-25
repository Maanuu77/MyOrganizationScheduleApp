// Estadísticas completas: periodos (día, semana, mes, año, rango) con comparación con el
// periodo anterior, foco planificado frente a real por etiqueta, objetivos semanales,
// mapa de calor anual, distribuciones, rutinas y exportación a CSV y JSON.

import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { useDatos } from './almacenDatos';
import { expandirOcurrencias } from './recurrencia';
import {
  aCsv,
  calcularPeriodo,
  cumplimientoBloques,
  distribucionDiaSemana,
  distribucionFranja,
  duracionMediaSesion,
  filasRegistros,
  focoPorEtiqueta,
  mapaCalor,
  periodoAnterior,
  progresoObjetivos,
  rachas,
  registrosEn,
  resumenRutinas,
  serieDiaria,
  tareasCompletadasEn,
  valoracionMedia,
  variacion,
  type TipoPeriodo,
} from './estadisticas';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { Segmentado } from './Campos';
import { EstadoVacio } from './EstadoVacio';
import { NumeroAnimado } from './NumeroAnimado';
import { MapaCalor } from './MapaCalor';
import { descargar } from './descargas';
import {
  DIAS_CORTOS,
  MS_HORA,
  capitalizar,
  claveDia,
  desdeClaveDia,
  duracionTexto,
  formatear,
  inicioDeSemana,
  ordenDias,
} from './fechas';
import { t } from './textos';

const horas = (ms: number) => Math.round((ms / MS_HORA) * 10) / 10;

function Tarjeta({
  titulo,
  children,
  className = '',
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className={`tarjeta ${className}`}
    >
      <h2 className="mb-3 text-sm font-extrabold tracking-wide text-texto-suave uppercase">
        {titulo}
      </h2>
      {children}
    </motion.section>
  );
}

function Variacion({ valor }: { valor: number | null }) {
  if (valor === null || !isFinite(valor))
    return <span className="text-[11px] text-texto-tenue">—</span>;
  const sube = valor >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${sube ? 'text-exito' : 'text-peligro'}`}
      title={t.estadisticas.vsAnterior}
    >
      {sube ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
      {sube ? '+' : ''}
      {Math.round(valor * 100)}%
    </span>
  );
}

/** Estilo común de los tooltips de Recharts con los colores del tema. */
const estiloTooltip = {
  contentStyle: {
    background: 'var(--mos-superficie)',
    border: '1px solid var(--mos-borde)',
    borderRadius: 12,
    color: 'var(--mos-texto)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--mos-texto)', fontWeight: 700 },
  cursor: { fill: 'color-mix(in oklab, var(--mos-acento) 8%, transparent)' },
};
const ejes = { stroke: 'var(--mos-texto-tenue)', fontSize: 11, tickLine: false, axisLine: false };

export function PantallaEstadisticas() {
  const registros = useDatos((s) => s.registros);
  const eventos = useDatos((s) => s.eventos);
  const excepciones = useDatos((s) => s.excepciones);
  const etiquetas = useDatos((s) => s.etiquetas);
  const tareas = useDatos((s) => s.tareas);
  const rutinas = useDatos((s) => s.rutinas);
  const ejecuciones = useDatos((s) => s.ejecuciones);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const [tipo, setTipo] = useState<TipoPeriodo>('semana');
  const [referencia, setReferencia] = useState(() => new Date());
  const [rango, setRango] = useState({
    desde: claveDia(addDays(new Date(), -29)),
    hasta: claveDia(new Date()),
  });

  const periodo = useMemo(
    () => calcularPeriodo(tipo, referencia, inicioSemana, rango),
    [tipo, referencia, inicioSemana, rango],
  );
  const anterior = useMemo(() => periodoAnterior(periodo), [periodo]);
  const nombreEtiqueta = useMemo(() => new Map(etiquetas.map((e) => [e.id, e])), [etiquetas]);

  const datos = useMemo(() => {
    const ahora = Date.now();
    const oc = expandirOcurrencias(eventos, excepciones, periodo.desde, periodo.hasta);
    const ocAnt = expandirOcurrencias(eventos, excepciones, anterior.desde, anterior.hasta);
    const reg = registrosEn(registros, periodo.desde, periodo.hasta);
    const regAnt = registrosEn(registros, anterior.desde, anterior.hasta);
    const foco = reg.reduce((s, r) => s + r.focoRealMs, 0);
    const focoAnt = regAnt.reduce((s, r) => s + r.focoRealMs, 0);
    const tareasHechas = tareasCompletadasEn(tareas, periodo.desde, periodo.hasta).length;
    const tareasAnt = tareasCompletadasEn(tareas, anterior.desde, anterior.hasta).length;
    const cumpl = cumplimientoBloques(oc, ahora);
    const cumplAnt = cumplimientoBloques(ocAnt, ahora);
    const diaSemana = distribucionDiaSemana(reg);
    return {
      reg,
      foco,
      focoAnt,
      sesiones: reg.length,
      sesionesAnt: regAnt.length,
      media: duracionMediaSesion(reg),
      mediaAnt: duracionMediaSesion(regAnt),
      tareasHechas,
      tareasAnt,
      cumpl,
      cumplAnt,
      valoracion: valoracionMedia(reg),
      porEtiqueta: focoPorEtiqueta(registros, oc, periodo.desde, periodo.hasta).map((f) => ({
        nombre: f.etiquetaId
          ? (nombreEtiqueta.get(f.etiquetaId)?.nombre ?? '—')
          : t.comun.sinEtiqueta,
        color: f.etiquetaId ? (nombreEtiqueta.get(f.etiquetaId)?.color ?? '#94a3b8') : '#94a3b8',
        planificado: horas(f.planificadoMs),
        real: horas(f.realMs),
      })),
      diaSemana: ordenDias(inicioSemana).map((d) => ({
        dia: DIAS_CORTOS[d],
        horas: horas(diaSemana[d]),
      })),
      franja: distribucionFranja(reg).map((ms, h) => ({ hora: `${h}h`, horas: horas(ms) })),
      serie: serieDiaria(registros, periodo.desde, periodo.hasta).map((p) => ({
        ...p,
        dia: formatear(desdeClaveDia(p.clave), tipo === 'año' ? 'MMM' : 'd MMM'),
      })),
      rutinas: resumenRutinas(rutinas, ejecuciones, periodo.desde, periodo.hasta),
    };
  }, [
    eventos,
    excepciones,
    registros,
    tareas,
    rutinas,
    ejecuciones,
    periodo,
    anterior,
    nombreEtiqueta,
    inicioSemana,
    tipo,
  ]);

  const racha = useMemo(() => rachas(registros), [registros]);
  const objetivos = useMemo(
    () =>
      progresoObjetivos(etiquetas, registros, inicioDeSemana(new Date(), inicioSemana).getTime()),
    [etiquetas, registros, inicioSemana],
  );
  const año = new Date(periodo.desde).getFullYear();
  const calor = useMemo(() => mapaCalor(registros, año), [registros, año]);

  const mover = (sentido: -1 | 1) => {
    const f = { dia: addDays, semana: addWeeks, mes: addMonths, año: addYears, rango: addDays }[
      tipo
    ];
    setReferencia(f(referencia, sentido));
  };

  const exportarCsv = () =>
    descargar(
      `sesiones-${claveDia(periodo.desde)}.csv`,
      aCsv(filasRegistros(datos.reg, etiquetas)),
      'text/csv;charset=utf-8',
    );
  const exportarJson = () =>
    descargar(
      `estadisticas-${claveDia(periodo.desde)}.json`,
      JSON.stringify(
        {
          periodo: { desde: claveDia(periodo.desde), hasta: claveDia(periodo.hasta - 1), tipo },
          resumen: {
            focoMs: datos.foco,
            sesiones: datos.sesiones,
            duracionMediaMs: datos.media,
            tareasCompletadas: datos.tareasHechas,
            cumplimientoBloques: datos.cumpl,
          },
          porEtiqueta: datos.porEtiqueta,
          rutinas: datos.rutinas.map((r) => ({
            rutina: r.rutina.nombre,
            programadas: r.programadas,
            completadas: r.completadas,
            racha: r.racha,
          })),
          sesiones: datos.reg,
        },
        null,
        2,
      ),
      'application/json',
    );

  const sinNada =
    registros.length === 0 && eventos.length === 0 && tareas.every((x) => !x.completada);

  const resumen = [
    {
      titulo: t.estadisticas.focoReal,
      valor: datos.foco / MS_HORA,
      formato: (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`,
      var: variacion(datos.foco, datos.focoAnt),
    },
    {
      titulo: t.estadisticas.sesiones,
      valor: datos.sesiones,
      formato: undefined,
      var: variacion(datos.sesiones, datos.sesionesAnt),
    },
    {
      titulo: t.estadisticas.duracionMedia,
      valor: datos.media / 60_000,
      formato: (n: number) => `${Math.round(n)} min`,
      var: variacion(datos.media, datos.mediaAnt),
    },
    {
      titulo: t.estadisticas.tareasHechas,
      valor: datos.tareasHechas,
      formato: undefined,
      var: variacion(datos.tareasHechas, datos.tareasAnt),
    },
    {
      titulo: t.estadisticas.cumplimiento,
      valor: datos.cumpl.ratio * 100,
      formato: (n: number) => `${Math.round(n)}%`,
      var: variacion(datos.cumpl.ratio, datos.cumplAnt.ratio),
    },
    {
      titulo: t.estadisticas.valoracion,
      valor: datos.valoracion ?? 0,
      formato: (n: number) => (datos.valoracion === null ? '—' : `${n.toFixed(1)} / 5`),
      var: null,
    },
  ];

  return (
    <div>
      <Cabecera
        titulo={t.estadisticas.titulo}
        acciones={
          <>
            <Boton
              variante="secundario"
              tamano="sm"
              icono={<Download size={14} />}
              onClick={exportarCsv}
            >
              {t.estadisticas.exportarCsv}
            </Boton>
            <Boton
              variante="secundario"
              tamano="sm"
              icono={<Download size={14} />}
              onClick={exportarJson}
            >
              {t.estadisticas.exportarJson}
            </Boton>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmentado
          etiqueta="Periodo"
          valor={tipo}
          alCambiar={setTipo}
          opciones={(Object.keys(t.estadisticas.periodos) as TipoPeriodo[]).map((p) => ({
            valor: p,
            texto: t.estadisticas.periodos[p],
          }))}
          tamano="sm"
        />
        {tipo === 'rango' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="campo w-auto py-1.5"
              aria-label={t.estadisticas.desde}
              value={rango.desde}
              max={rango.hasta}
              onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })}
            />
            <span className="text-texto-tenue">–</span>
            <input
              type="date"
              className="campo w-auto py-1.5"
              aria-label={t.estadisticas.hasta}
              value={rango.hasta}
              min={rango.desde}
              onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Boton
              variante="fantasma"
              tamano="icono"
              onClick={() => mover(-1)}
              aria-label={t.comun.anterior}
            >
              <ChevronLeft size={18} />
            </Boton>
            <span className="min-w-36 text-center text-sm font-bold">
              {capitalizar(periodo.nombre)}
            </span>
            <Boton
              variante="fantasma"
              tamano="icono"
              onClick={() => mover(1)}
              aria-label={t.comun.siguiente}
            >
              <ChevronRight size={18} />
            </Boton>
          </div>
        )}
      </div>

      {sinNada ? (
        <EstadoVacio
          icono={<ChartColumn size={28} />}
          titulo={t.estadisticas.vacioTitulo}
          texto={t.estadisticas.vacioTexto}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {resumen.map((r, i) => (
              <motion.div
                key={r.titulo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="tarjeta"
              >
                <p className="text-[11px] font-bold tracking-wide text-texto-tenue uppercase">
                  {r.titulo}
                </p>
                <p className="mt-1 text-2xl font-extrabold">
                  <NumeroAnimado valor={r.valor} formatear={r.formato} />
                </p>
                <Variacion valor={r.var} />
              </motion.div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta titulo={t.estadisticas.porEtiqueta} className="lg:col-span-2">
              {datos.porEtiqueta.length === 0 ? (
                <p className="text-sm text-texto-suave">{t.estadisticas.vacioTexto}</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, datos.porEtiqueta.length * 46)}
                >
                  <BarChart
                    data={datos.porEtiqueta}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--mos-borde)" />
                    <XAxis type="number" {...ejes} unit=" h" />
                    <YAxis type="category" dataKey="nombre" width={110} {...ejes} />
                    <Tooltip {...estiloTooltip} formatter={(v) => `${v} h`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="planificado"
                      name={t.estadisticas.planificado}
                      fill="var(--mos-superficie-3)"
                      radius={[0, 6, 6, 0]}
                      animationDuration={900}
                    />
                    <Bar
                      dataKey="real"
                      name={t.estadisticas.real}
                      fill="var(--mos-acento)"
                      radius={[0, 6, 6, 0]}
                      animationDuration={1100}
                    >
                      {datos.porEtiqueta.map((f) => (
                        <Cell key={f.nombre} fill={f.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Tarjeta>

            <Tarjeta titulo={t.estadisticas.objetivos}>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="text-aviso" size={22} aria-hidden />
                  <div>
                    <p className="text-xl font-extrabold">{racha.actual}</p>
                    <p className="text-[11px] text-texto-tenue">{t.estadisticas.racha}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold">{racha.mejor}</p>
                  <p className="text-[11px] text-texto-tenue">{t.estadisticas.mejorRacha}</p>
                </div>
              </div>
              {objetivos.length === 0 ? (
                <p className="text-sm text-texto-suave">{t.estadisticas.sinObjetivos}</p>
              ) : (
                <ul className="space-y-3">
                  {objetivos.map((o) => (
                    <li key={o.etiqueta.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold">{o.etiqueta.nombre}</span>
                        <span className="text-texto-suave">
                          {horas(o.realMs)} / {horas(o.objetivoMs)} h
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-superficie-3">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: o.etiqueta.color }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${o.porcentaje * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          {tipo !== 'dia' && (
            <Tarjeta titulo={t.estadisticas.evolucion}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={datos.serie} margin={{ left: -16, right: 8 }}>
                  <defs>
                    <linearGradient id="degradado-serie" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--mos-acento)" stopOpacity={0.45} />
                      <stop offset="1" stopColor="var(--mos-acento)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--mos-borde)" />
                  <XAxis dataKey="dia" {...ejes} minTickGap={20} />
                  <YAxis {...ejes} unit=" h" />
                  <Tooltip {...estiloTooltip} formatter={(v) => `${Number(v).toFixed(1)} h`} />
                  <Area
                    type="monotone"
                    dataKey="horas"
                    name={t.estadisticas.focoReal}
                    stroke="var(--mos-acento)"
                    strokeWidth={2.5}
                    fill="url(#degradado-serie)"
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Tarjeta>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo={t.estadisticas.diaSemana}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={datos.diaSemana} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--mos-borde)" />
                  <XAxis dataKey="dia" {...ejes} />
                  <YAxis {...ejes} unit=" h" />
                  <Tooltip {...estiloTooltip} formatter={(v) => `${v} h`} />
                  <Bar
                    dataKey="horas"
                    name={t.estadisticas.focoReal}
                    fill="var(--mos-acento)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Tarjeta>
            <Tarjeta titulo={t.estadisticas.franja}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={datos.franja} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--mos-borde)" />
                  <XAxis dataKey="hora" {...ejes} interval={2} />
                  <YAxis {...ejes} unit=" h" />
                  <Tooltip {...estiloTooltip} formatter={(v) => `${v} h`} />
                  <Bar
                    dataKey="horas"
                    name={t.estadisticas.focoReal}
                    fill="var(--mos-acento-2)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Tarjeta>
          </div>

          <Tarjeta titulo={`${t.estadisticas.mapaCalor} · ${año}`}>
            <MapaCalor celdas={calor} inicioSemana={inicioSemana} />
          </Tarjeta>

          {datos.rutinas.length > 0 && (
            <Tarjeta titulo={t.estadisticas.rutinas}>
              <ul className="divide-y divide-borde">
                {datos.rutinas.map((r) => (
                  <li key={r.rutina.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: r.rutina.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.rutina.nombre}</span>
                    <span className="text-sm text-texto-suave">
                      {t.rutinas.cumplimiento}:{' '}
                      <strong className="text-texto">
                        {r.completadas}/{r.programadas}
                      </strong>
                    </span>
                    <span className="text-sm text-texto-suave">
                      {t.rutinas.pasosHechos}:{' '}
                      <strong className="text-texto">{Math.round(r.porcentajePasos * 100)}%</strong>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-bold">
                      <Flame size={14} className="text-aviso" aria-hidden /> {r.racha}
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
          <p className="text-center text-xs text-texto-tenue">
            {t.estadisticas.vsAnterior}: {capitalizar(formatear(anterior.desde, 'd MMM yyyy'))} –{' '}
            {formatear(anterior.hasta - 1, 'd MMM yyyy')} · {duracionTexto(datos.focoAnt)}
          </p>
        </div>
      )}
    </div>
  );
}
