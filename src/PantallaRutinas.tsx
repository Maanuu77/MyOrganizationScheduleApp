// Rutinas: cada tarjeta muestra los pasos con su barra, lo que dura en total, cuándo toca y
// un botón para empezarla en el contador.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { CalendarPlus, Clock, Coffee, Flame, Pencil, Play, Plus, Repeat } from 'lucide-react';
import { addDays, addHours, startOfDay, startOfHour } from 'date-fns';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { EstadoVacio } from './EstadoVacio';
import { EditorRutina } from './EditorRutina';
import { BarraRutina } from './BarraRutina';
import { DialogoFechaHora } from './DialogoFechaHora';
import { colocarRutinaEnCalendario, empezarRutina } from './operacionesRutinas';
import { describirDias, duracionRutinaMin, rutinaTocaEnDia, seguimientoRutina } from './rutinas';
import { claveDia, duracionTexto } from './fechas';
import { t } from './textos';
import type { Rutina } from './tipos';

export function PantallaRutinas() {
  const rutinas = useDatos((s) => s.rutinas);
  const ejecuciones = useDatos((s) => s.ejecuciones);
  const etiquetas = useDatos((s) => s.etiquetas);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const navegar = useNavigate();
  const [editando, setEditando] = useState<Rutina | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [colocando, setColocando] = useState<Rutina | null>(null);
  const lista = useMemo(
    () => rutinas.filter((r) => !r.archivada).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [rutinas],
  );
  const hoy = startOfDay(new Date());

  const abrir = (r: Rutina | null) => {
    setEditando(r);
    setAbierto(true);
  };

  const empezar = async (r: Rutina) => {
    if (await empezarRutina(r)) navegar('/foco');
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
            const conDias = r.programacion.diasSemana.length > 0;
            const seg = conDias
              ? seguimientoRutina(r, ejecuciones, addDays(hoy, -29), addDays(hoy, 1))
              : null;
            const toca = rutinaTocaEnDia(r, hoy);
            const hechaHoy = ejecuciones.some(
              (e) => e.rutinaId === r.id && e.completada && e.fecha === claveDia(hoy),
            );
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
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 truncate text-lg font-bold">{r.nombre}</h2>
                      {toca && !hechaHoy && (
                        <span className="chip shrink-0 border-acento/30 bg-acento/10 py-0 text-[11px] text-acento">
                          {t.rutinas.tocaHoy}
                        </span>
                      )}
                      {hechaHoy && (
                        <span className="chip shrink-0 border-exito/30 bg-exito/10 py-0 text-[11px] text-exito">
                          {t.rutinas.hechaHoy}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-texto-suave">
                      <span className="flex items-center gap-1 font-semibold text-texto">
                        <Clock size={12} aria-hidden />
                        {duracionTexto(duracionRutinaMin(r) * 60_000)}
                      </span>
                      <span>
                        {conDias
                          ? describirDias(r.programacion.diasSemana, inicioSemana)
                          : t.rutinas.soloAMano}
                        {r.programacion.hora ? ` · ${r.programacion.hora}` : ''}
                      </span>
                      {seg && seg.racha > 0 && (
                        <span className="flex items-center gap-0.5" title={t.rutinas.racha}>
                          <Flame size={12} className="text-aviso" aria-hidden /> {seg.racha}
                        </span>
                      )}
                    </p>
                  </div>
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    className="h-9 w-9 shrink-0"
                    onClick={() => abrir(r)}
                    aria-label={`${t.comun.editar}: ${r.nombre}`}
                  >
                    <Pencil size={16} />
                  </Boton>
                </div>

                <BarraRutina rutina={r} etiquetas={etiquetas} />

                {/* Los pasos en orden, con sus descansos */}
                <ol className="space-y-1 text-sm">
                  {r.pasos.map((p, j) => {
                    const color = etiquetas.find((e) => e.id === p.etiquetaId)?.color ?? r.color;
                    return (
                      <li key={p.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{p.nombre}</span>
                          <span className="numeros shrink-0 text-xs text-texto-suave">
                            {p.duracionMin}′
                          </span>
                        </div>
                        {j < r.pasos.length - 1 && p.descansoMin > 0 && (
                          <div className="flex items-center gap-2 pl-0.5 text-xs text-texto-tenue">
                            <Coffee size={11} aria-hidden />
                            <span className="flex-1">{t.rutinas.descanso}</span>
                            <span className="numeros">{p.descansoMin}′</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-auto flex gap-2 pt-1">
                  <Boton
                    variante="primario"
                    className="flex-1"
                    icono={<Play size={16} />}
                    onClick={() => empezar(r)}
                  >
                    {t.rutinas.empezar}
                  </Boton>
                  <Boton
                    variante="secundario"
                    tamano="icono"
                    onClick={() => setColocando(r)}
                    aria-label={`${t.rutinas.colocarEn} ${r.nombre}`}
                    title={t.rutinas.colocarEn}
                  >
                    <CalendarPlus size={17} />
                  </Boton>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <EditorRutina abierto={abierto} rutina={editando} alCerrar={() => setAbierto(false)} />
      <DialogoFechaHora
        abierto={!!colocando}
        titulo={t.rutinas.colocarEn}
        inicialMs={addHours(startOfHour(new Date()), 1).getTime()}
        alCerrar={() => setColocando(null)}
        alAceptar={async (inicio) => {
          if (colocando && (await colocarRutinaEnCalendario(colocando, inicio))) {
            setColocando(null);
            avisar(t.comun.guardado, 'exito');
          }
        }}
      />
    </div>
  );
}
