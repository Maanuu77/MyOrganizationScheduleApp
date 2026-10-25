// Centro de avisos: solapes, sobrecarga, sesiones sin descanso, fechas límite y sueño.
// Nunca bloquean nada: solo informan y llevan al calendario o a la tarea.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  AlarmClock,
  ArrowRight,
  BedDouble,
  Coffee,
  Flame,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useAvisosCarga } from './useCalendarioDatos';
import { useDatos } from './almacenDatos';
import { useUI } from './almacenUI';
import { Cabecera } from './Cabecera';
import { EstadoVacio } from './EstadoVacio';
import { capitalizar, desdeClaveDia, diaRelativo } from './fechas';
import { t } from './textos';
import type { TipoAviso } from './tipos';

const ICONOS: Record<TipoAviso, typeof Layers> = {
  solape: Layers,
  focoExcesivo: Flame,
  sesionesSeguidas: Coffee,
  fechaLimiteSinTiempo: AlarmClock,
  sueno: BedDouble,
};

const COLOR_SEVERIDAD = {
  grave: 'var(--mos-peligro)',
  aviso: 'var(--mos-aviso)',
  info: 'var(--mos-info)',
};

export function PantallaAvisos() {
  const avisos = useAvisosCarga();
  const tareas = useDatos((s) => s.tareas);
  const poner = useUI((s) => s.poner);
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<TipoAviso | ''>('');
  const visibles = filtro ? avisos.filter((a) => a.tipo === filtro) : avisos;
  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof visibles>();
    for (const a of visibles) {
      if (!mapa.has(a.fecha)) mapa.set(a.fecha, []);
      mapa.get(a.fecha)!.push(a);
    }
    return [...mapa.entries()];
  }, [visibles]);
  const conteo = (tipo: TipoAviso) => avisos.filter((a) => a.tipo === tipo).length;

  return (
    <div>
      <Cabecera titulo={t.avisos.titulo} subtitulo={t.avisos.subtitulo} />
      {avisos.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t.tareas.filtros}>
          <button
            type="button"
            aria-pressed={!filtro}
            onClick={() => setFiltro('')}
            className={`chip ${!filtro ? 'border-acento bg-acento/10 text-acento' : ''}`}
          >
            {t.comun.todos} · {avisos.length}
          </button>
          {(Object.keys(t.avisos.tipos) as TipoAviso[]).map((tipo) =>
            conteo(tipo) ? (
              <button
                key={tipo}
                type="button"
                aria-pressed={filtro === tipo}
                onClick={() => setFiltro(tipo)}
                className={`chip ${filtro === tipo ? 'border-acento bg-acento/10 text-acento' : ''}`}
              >
                {t.avisos.tipos[tipo]} · {conteo(tipo)}
              </button>
            ) : null,
          )}
        </div>
      )}
      {grupos.length === 0 ? (
        <EstadoVacio
          icono={<ShieldCheck size={28} />}
          titulo={t.avisos.vacioTitulo}
          texto={t.avisos.vacioTexto}
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(([fecha, lista]) => (
            <section key={fecha}>
              <h2 className="mb-2 text-sm font-extrabold">
                {capitalizar(diaRelativo(desdeClaveDia(fecha)))}
              </h2>
              <ul className="space-y-2">
                {lista.map((a, i) => {
                  const Icono = ICONOS[a.tipo];
                  return (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.04 }}
                      className="tarjeta-plana flex items-start gap-3 p-3.5"
                      style={{ borderLeft: `4px solid ${COLOR_SEVERIDAD[a.severidad]}` }}
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                        style={{
                          background: `color-mix(in oklab, ${COLOR_SEVERIDAD[a.severidad]} 14%, transparent)`,
                          color: COLOR_SEVERIDAD[a.severidad],
                        }}
                      >
                        <Icono size={18} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{a.titulo}</p>
                        <p className="text-sm text-texto-suave">{a.detalle}</p>
                      </div>
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-acento hover:underline"
                        onClick={() => {
                          if (a.tareaId) {
                            const tarea = tareas.find((x) => x.id === a.tareaId);
                            if (tarea) poner({ editorTarea: { tarea } });
                            return;
                          }
                          poner({ fechaMs: desdeClaveDia(a.fecha).getTime(), vista: 'dia' });
                          navegar('/calendario');
                        }}
                      >
                        {a.tareaId ? t.comun.editar : t.avisos.ver}{' '}
                        <ArrowRight size={14} aria-hidden />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
