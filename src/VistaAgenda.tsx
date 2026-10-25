// Vista Agenda: lista de los próximos 30 días agrupada por día.
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { CalendarSearch, Repeat, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AvisoCarga, Etiqueta, Ocurrencia } from './tipos';
import { capitalizar, claveDia, desdeClaveDia, diaRelativo, formatearHora } from './fechas';
import { useUI } from './almacenUI';
import { useDatos } from './almacenDatos';
import { EstadoVacio } from './EstadoVacio';
import { CheckAnimado } from './CheckAnimado';
import { alternarHecho } from './operaciones';
import { t } from './textos';

interface Props {
  ocurrencias: Ocurrencia[];
  etiquetas: Map<string, Etiqueta>;
  avisos: Map<string, AvisoCarga[]>;
}

export function VistaAgenda({ ocurrencias, etiquetas, avisos }: Props) {
  const poner = useUI((s) => s.poner);
  const formato24h = useDatos((s) => s.ajustes.formato24h);
  const grupos = useMemo(() => {
    const mapa = new Map<string, Ocurrencia[]>();
    for (const o of ocurrencias) {
      const clave = claveDia(o.inicioMs);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(o);
    }
    return [...mapa.entries()];
  }, [ocurrencias]);

  if (!grupos.length) {
    return (
      <EstadoVacio
        icono={<CalendarSearch size={28} />}
        titulo={t.calendario.agendaVacia}
        texto={t.calendario.panelEtiquetasAyuda}
      />
    );
  }

  return (
    <div className="space-y-5">
      {grupos.map(([clave, lista], i) => (
        <motion.section
          key={clave}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.04 }}
        >
          <h2 className="sticky top-0 z-10 mb-2 bg-fondo/90 py-1 text-sm font-extrabold backdrop-blur">
            {capitalizar(diaRelativo(desdeClaveDia(clave)))}
          </h2>
          <ul className="space-y-1.5">
            {lista.map((o) => {
              const e = o.etiquetaId ? etiquetas.get(o.etiquetaId) : undefined;
              const color = o.evento.color ?? e?.color ?? '#6D5CF0';
              return (
                <li
                  key={o.clave}
                  className="flex items-center gap-3 rounded-md border border-borde bg-superficie px-3 py-2.5 hover:shadow-media"
                >
                  {o.evento.tipo === 'protegido' ? (
                    <ShieldCheck size={20} style={{ color }} aria-hidden />
                  ) : (
                    <CheckAnimado
                      hecho={o.completado}
                      alCambiar={() => alternarHecho(o)}
                      color={color}
                      etiqueta={`${t.calendario.marcarHecho}: ${o.titulo}`}
                      tamano={20}
                    />
                  )}
                  <span className="numeros w-24 shrink-0 text-xs font-semibold text-texto-suave">
                    {o.evento.todoElDia
                      ? t.calendario.todoElDia
                      : `${formatearHora(o.inicioMs, formato24h)} – ${formatearHora(o.finMs, formato24h)}`}
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => poner({ editorBloque: { ocurrencia: o, borrador: null } })}
                  >
                    <p
                      className={`truncate text-sm font-semibold ${o.completado ? 'line-through opacity-60' : ''}`}
                    >
                      {o.titulo}
                    </p>
                    <p className="truncate text-xs text-texto-tenue">
                      {t.bloque.tipos[o.evento.tipo]}
                      {e ? ` · ${e.nombre}` : ''}
                    </p>
                  </button>
                  {o.esRecurrente && (
                    <Repeat size={14} className="text-texto-tenue" aria-label="Se repite" />
                  )}
                  {avisos.has(o.clave) && (
                    <TriangleAlert
                      size={15}
                      className="text-aviso"
                      aria-label={avisos
                        .get(o.clave)!
                        .map((a) => a.titulo)
                        .join('. ')}
                    />
                  )}
                  <span
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}
