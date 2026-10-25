// Rutinas por ámbito (día, semana, mes) con su seguimiento: racha, cumplimiento y pasos hechos.
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Clock, Flame, Pencil, Play, Plus, Repeat } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { Segmentado } from './Campos';
import { EstadoVacio } from './EstadoVacio';
import { EditorRutina } from './EditorRutina';
import { AnilloProgreso } from './AnilloProgreso';
import { duracionRutinaMin, rutinaTocaEnDia, seguimientoRutina } from './rutinas';
import { describirRegla } from './recurrencia';
import { reglaDeRutina } from './rutinas';
import { t } from './textos';
import type { AmbitoRutina, Rutina } from './tipos';

export function PantallaRutinas() {
  const rutinas = useDatos((s) => s.rutinas);
  const ejecuciones = useDatos((s) => s.ejecuciones);
  const ciclos = useDatos((s) => s.ciclos);
  const [ambito, setAmbito] = useState<AmbitoRutina>('dia');
  const [editando, setEditando] = useState<Rutina | null>(null);
  const [abierto, setAbierto] = useState(false);
  const lista = useMemo(
    () =>
      rutinas
        .filter((r) => r.ambito === ambito && !r.archivada)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [rutinas, ambito],
  );
  const hoy = startOfDay(new Date());

  const abrir = (r: Rutina | null) => {
    setEditando(r);
    setAbierto(true);
  };

  return (
    <div>
      <Cabecera
        titulo={t.rutinas.titulo}
        subtitulo={t.rutinas.subtitulo}
        acciones={
          <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
            {t.rutinas.nueva}
          </Boton>
        }
      />
      <div className="mb-5">
        <Segmentado
          etiqueta={t.rutinas.ambito}
          valor={ambito}
          alCambiar={setAmbito}
          opciones={(['dia', 'semana', 'mes'] as AmbitoRutina[]).map((a) => ({
            valor: a,
            texto: `${t.rutinas.ambitos[a]} (${rutinas.filter((r) => r.ambito === a && !r.archivada).length})`,
          }))}
        />
      </div>

      {lista.length === 0 ? (
        <EstadoVacio
          icono={<Repeat size={28} />}
          titulo={t.rutinas.vacioTitulo}
          texto={t.rutinas.vacioTexto}
          accion={
            <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
              {t.rutinas.nueva}
            </Boton>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {lista.map((r, i) => {
            const seg = seguimientoRutina(r, ejecuciones, addDays(hoy, -29), addDays(hoy, 1));
            const toca = rutinaTocaEnDia(r, hoy);
            const ciclo = ciclos.find((c) => c.id === r.cicloId);
            const duracion = duracionRutinaMin(r);
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="tarjeta flex flex-col gap-3"
                style={{
                  backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${r.color} 13%, var(--mos-superficie)), var(--mos-superficie) 65%)`,
                }}
              >
                <div className="flex items-start gap-3">
                  <AnilloProgreso
                    progreso={seg.cumplimiento}
                    tamano={54}
                    grosor={6}
                    color={r.color}
                    etiqueta={t.rutinas.cumplimiento}
                  >
                    <span className="text-xs font-extrabold">
                      {Math.round(seg.cumplimiento * 100)}%
                    </span>
                  </AnilloProgreso>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 truncate font-bold">{r.nombre}</h2>
                      {toca && (
                        <span className="chip shrink-0 border-acento/30 bg-acento/10 py-0 text-[11px] text-acento">
                          {t.rutinas.tocaHoy}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-texto-suave">
                      {describirRegla(reglaDeRutina(r), new Date(r.creadoEnMs))}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-texto-suave">
                      {r.programacion.hora && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} aria-hidden /> {r.programacion.hora}
                        </span>
                      )}
                      <span>
                        {r.clase === 'estudio'
                          ? (ciclo?.nombre ?? t.foco.ciclo)
                          : `${r.pasos.length} ${t.rutinas.pasos.toLowerCase()}${duracion ? ` · ${duracion} min` : ''}`}
                      </span>
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-superficie-2/70 py-1.5">
                    <dt className="text-[11px] text-texto-tenue">{t.rutinas.racha}</dt>
                    <dd className="flex items-center justify-center gap-1 font-extrabold">
                      <Flame size={14} className="text-aviso" aria-hidden /> {seg.racha}
                    </dd>
                  </div>
                  <div className="rounded-md bg-superficie-2/70 py-1.5">
                    <dt className="text-[11px] text-texto-tenue">{t.rutinas.cumplimiento}</dt>
                    <dd className="font-extrabold">
                      {seg.completadas}/{seg.programadas}
                    </dd>
                  </div>
                  <div className="rounded-md bg-superficie-2/70 py-1.5">
                    <dt className="text-[11px] text-texto-tenue">{t.rutinas.pasosHechos}</dt>
                    <dd className="font-extrabold">{Math.round(seg.porcentajePasos * 100)}%</dd>
                  </div>
                </dl>
                <div className="mt-auto flex gap-2">
                  <Link
                    to={`/rutinas/${r.id}/empezar`}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md degradado-marca text-sm font-semibold text-white shadow-media"
                  >
                    <Play size={15} aria-hidden /> {t.rutinas.empezar}
                  </Link>
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    className="h-9"
                    icono={<Pencil size={14} />}
                    onClick={() => abrir(r)}
                  >
                    {t.comun.editar}
                  </Boton>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      <EditorRutina
        abierto={abierto}
        rutina={editando}
        ambitoInicial={ambito}
        alCerrar={() => setAbierto(false)}
      />
    </div>
  );
}
