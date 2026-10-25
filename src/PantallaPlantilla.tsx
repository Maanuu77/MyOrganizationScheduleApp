// Plantilla semanal: el horario estimado de una semana tipo, creado por el usuario.
// Se aplica a esta semana o a las próximas N semanas creando bloques normales.
// La app no la genera ni reorganiza nada: solo copia lo que el usuario ha dibujado.

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarRange, Copy, Plus, Trash2, Undo2 } from 'lucide-react';
import { addDays } from 'date-fns';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { avisar, confirmar } from './almacenUI';
import { eventos as dbEventos, nuevoId, plantillas as dbPlantillas } from './datos';
import { eventoVacio } from './operaciones';
import { expandirOcurrencias } from './recurrencia';
import { protegidosQueChocan } from './avisosCarga';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { Campo } from './Campos';
import { EstadoVacio } from './EstadoVacio';
import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  conHora,
  horaAMinutos,
  inicioDeSemana,
  minutosAHora,
  ordenDias,
} from './fechas';
import { t } from './textos';
import type { BloquePlantilla, PlantillaSemanal, TipoBloque } from './tipos';

export function PantallaPlantilla() {
  const plantillas = useDatos((s) => s.plantillas);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const actual = plantillas.find((p) => p.id === seleccion) ?? plantillas[0] ?? null;

  const crear = async () => {
    const p = await dbPlantillas.crear({
      nombre: `${t.plantilla.titulo} ${plantillas.length + 1}`,
      bloques: [],
    });
    setSeleccion(p.id);
  };

  return (
    <div>
      <Cabecera
        titulo={t.plantilla.titulo}
        subtitulo={t.plantilla.subtitulo}
        acciones={
          <Boton variante="primario" icono={<Plus size={16} />} onClick={crear}>
            {t.plantilla.nueva}
          </Boton>
        }
      />
      {!actual ? (
        <EstadoVacio
          icono={<CalendarRange size={28} />}
          titulo={t.plantilla.vacioTitulo}
          texto={t.plantilla.vacioTexto}
          accion={
            <Boton variante="primario" icono={<Plus size={16} />} onClick={crear}>
              {t.plantilla.nueva}
            </Boton>
          }
        />
      ) : (
        <>
          {plantillas.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {plantillas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === actual.id}
                  onClick={() => setSeleccion(p.id)}
                  className={`chip px-3 py-1.5 text-sm ${p.id === actual.id ? 'border-acento bg-acento/10 text-acento' : ''}`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
          <EditorPlantilla key={actual.id} plantilla={actual} />
        </>
      )}
    </div>
  );
}

function EditorPlantilla({ plantilla }: { plantilla: PlantillaSemanal }) {
  const etiquetas = useDatos((s) => s.etiquetas);
  const ciclos = useDatos((s) => s.ciclos);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const eventos = useDatos((s) => s.eventos);
  const excepciones = useDatos((s) => s.excepciones);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [nuevo, setNuevo] = useState<Omit<BloquePlantilla, 'id'>>({
    diaSemana: 1,
    horaInicio: '09:00',
    duracionMin: 60,
    tipo: 'sesion',
    titulo: '',
    etiquetaId: null,
    cicloId: null,
  });
  const [semanas, setSemanas] = useState(4);
  const [aplicando, setAplicando] = useState(false);

  const guardarBloques = (bloques: BloquePlantilla[]) =>
    dbPlantillas.actualizar(plantilla.id, { bloques });

  const añadir = async () => {
    const etiqueta = activas.find((e) => e.id === nuevo.etiquetaId);
    const titulo = nuevo.titulo.trim() || etiqueta?.nombre || t.bloque.tituloPorDefecto[nuevo.tipo];
    await guardarBloques([...plantilla.bloques, { ...nuevo, titulo, id: nuevoId() }]);
    setNuevo({ ...nuevo, titulo: '' });
  };

  /** Crea los bloques de la plantilla para N semanas a partir de la semana actual. */
  const aplicar = async (numero: number) => {
    if (!plantilla.bloques.length) return;
    setAplicando(true);
    const lunes = inicioDeSemana(new Date(), inicioSemana);
    const nuevos = [];
    for (let s = 0; s < numero; s++) {
      for (const b of plantilla.bloques) {
        const desplazamiento = (b.diaSemana - lunes.getDay() + 7) % 7;
        const dia = addDays(lunes, s * 7 + desplazamiento);
        const inicio = conHora(dia, b.horaInicio).getTime();
        nuevos.push(
          eventoVacio({
            tipo: b.tipo,
            titulo: b.titulo,
            etiquetaId: b.etiquetaId,
            cicloId: b.tipo === 'sesion' ? b.cicloId : null,
            inicioMs: inicio,
            finMs: inicio + b.duracionMin * 60_000,
            plantillaId: plantilla.id,
          }),
        );
      }
    }
    // Comprobamos los bloques protegidos una sola vez para todo el lote
    const desde = lunes.getTime();
    const hasta = addDays(lunes, numero * 7).getTime();
    const ocurrencias = expandirOcurrencias(eventos, excepciones, desde, hasta);
    const conflictos = nuevos.filter(
      (n) =>
        n.tipo !== 'protegido' && protegidosQueChocan(ocurrencias, n.inicioMs, n.finMs).length > 0,
    ).length;
    if (
      conflictos > 0 &&
      !(await confirmar({
        titulo: t.calendario.protegidoTitulo,
        mensaje: t.plantilla.conflictos(conflictos),
        textoConfirmar: t.calendario.protegidoConfirmar,
      }))
    ) {
      setAplicando(false);
      return;
    }
    try {
      await dbEventos.crearVarios(nuevos);
      avisar(t.plantilla.aplicada(nuevos.length), 'exito');
    } catch {
      avisar(t.comun.error, 'error');
    } finally {
      setAplicando(false);
    }
  };

  const quitarAplicados = async () => {
    const ids = eventos
      .filter((e) => e.plantillaId === plantilla.id && e.inicioMs >= Date.now())
      .map((e) => e.id);
    if (!ids.length) return;
    if (
      !(await confirmar({
        titulo: t.plantilla.deshacer,
        mensaje: t.plantilla.seQuitaran(ids.length),
        textoConfirmar: t.comun.borrar,
        peligro: true,
      }))
    )
      return;
    await dbEventos.borrarVarios(ids);
    avisar(t.comun.borrado);
  };

  const borrarPlantilla = async () => {
    if (
      !(await confirmar({
        titulo: t.plantilla.borrarTitulo,
        mensaje: `«${plantilla.nombre}»`,
        textoConfirmar: t.comun.borrar,
        peligro: true,
      }))
    )
      return;
    await dbPlantillas.borrar(plantilla.id);
  };

  const aplicados = eventos.filter(
    (e) => e.plantillaId === plantilla.id && e.inicioMs >= Date.now(),
  ).length;
  const dias = ordenDias(inicioSemana);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="tarjeta">
        <div className="mb-4 flex items-center gap-2">
          <input
            className="campo text-lg font-bold"
            aria-label={t.plantilla.nombre}
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() =>
              nombre.trim() &&
              nombre !== plantilla.nombre &&
              dbPlantillas.actualizar(plantilla.id, { nombre: nombre.trim() })
            }
          />
          <Boton
            variante="fantasma"
            tamano="icono"
            onClick={borrarPlantilla}
            aria-label={t.plantilla.borrarTitulo}
          >
            <Trash2 size={18} className="text-peligro" />
          </Boton>
        </div>
        {/* Semana tipo: una columna por día */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {dias.map((d) => {
            const bloques = plantilla.bloques
              .filter((b) => b.diaSemana === d)
              .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
            return (
              <div key={d} className="min-h-24 rounded-md bg-superficie-2/60 p-1.5">
                <p className="mb-1.5 text-center text-xs font-bold text-texto-suave uppercase">
                  {DIAS_CORTOS[d]}
                </p>
                <div className="space-y-1">
                  {bloques.map((b) => {
                    const color = etiquetas.find((e) => e.id === b.etiquetaId)?.color ?? '#6D5CF0';
                    return (
                      <motion.div
                        key={b.id}
                        layout
                        className={`group relative rounded-sm px-1.5 py-1 text-[11px] font-semibold ${b.tipo === 'protegido' ? 'rayado-protegido' : ''}`}
                        style={{
                          background: `color-mix(in oklab, ${color} 20%, var(--mos-superficie))`,
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <p className="truncate">{b.titulo}</p>
                        <p className="numeros opacity-70">
                          {b.horaInicio}–{minutosAHora(horaAMinutos(b.horaInicio) + b.duracionMin)}
                        </p>
                        <div className="absolute top-0.5 right-0.5 hidden gap-0.5 group-focus-within:flex group-hover:flex">
                          <button
                            type="button"
                            className="rounded bg-superficie p-0.5 shadow-suave"
                            aria-label={t.comun.duplicar}
                            onClick={() =>
                              guardarBloques([
                                ...plantilla.bloques,
                                { ...b, id: nuevoId(), diaSemana: (b.diaSemana + 1) % 7 },
                              ])
                            }
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            className="rounded bg-superficie p-0.5 shadow-suave"
                            aria-label={t.comun.borrar}
                            onClick={() =>
                              guardarBloques(plantilla.bloques.filter((x) => x.id !== b.id))
                            }
                          >
                            <Trash2 size={11} className="text-peligro" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="tarjeta space-y-3">
          <h2 className="font-bold">{t.plantilla.añadirBloque}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Día">
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={nuevo.diaSemana}
                  onChange={(e) => setNuevo({ ...nuevo, diaSemana: Number(e.target.value) })}
                >
                  {dias.map((d) => (
                    <option key={d} value={d}>
                      {DIAS_LARGOS[d]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Tipo">
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={nuevo.tipo}
                  onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoBloque })}
                >
                  {(Object.keys(t.bloque.tipos) as TipoBloque[]).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {t.bloque.tipos[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta={t.comun.inicio}>
              {(id) => (
                <input
                  id={id}
                  type="time"
                  step={300}
                  className="campo"
                  value={nuevo.horaInicio}
                  onChange={(e) =>
                    e.target.value && setNuevo({ ...nuevo, horaInicio: e.target.value })
                  }
                />
              )}
            </Campo>
            <Campo etiqueta={`${t.comun.duracion} (min)`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  className="campo"
                  value={nuevo.duracionMin}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, duracionMin: Number(e.target.value) || 60 })
                  }
                />
              )}
            </Campo>
          </div>
          <Campo etiqueta={t.comun.etiqueta}>
            {(id) => (
              <select
                id={id}
                className="campo"
                value={nuevo.etiquetaId ?? ''}
                onChange={(e) => {
                  const etiqueta = activas.find((x) => x.id === e.target.value);
                  setNuevo({
                    ...nuevo,
                    etiquetaId: etiqueta?.id ?? null,
                    duracionMin:
                      etiqueta && nuevo.tipo === 'sesion'
                        ? etiqueta.duracionMin
                        : nuevo.duracionMin,
                  });
                }}
              >
                <option value="">{t.comun.sinEtiqueta}</option>
                {activas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          {nuevo.tipo === 'sesion' && ciclos.length > 0 && (
            <Campo etiqueta={t.bloque.ciclo}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={nuevo.cicloId ?? ''}
                  onChange={(e) => setNuevo({ ...nuevo, cicloId: e.target.value || null })}
                >
                  <option value="">{t.bloque.sinCiclo}</option>
                  {ciclos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          )}
          <Campo etiqueta={`${t.comun.titulo} (${t.comun.opcional})`}>
            {(id) => (
              <input
                id={id}
                className="campo"
                value={nuevo.titulo}
                maxLength={200}
                onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })}
              />
            )}
          </Campo>
          <Boton
            variante="suave"
            className="w-full justify-center"
            icono={<Plus size={16} />}
            onClick={añadir}
          >
            {t.plantilla.añadirBloque}
          </Boton>
        </div>

        <div className="tarjeta space-y-3">
          <h2 className="font-bold">{t.plantilla.aplicar}</h2>
          <Boton
            variante="primario"
            className="w-full justify-center"
            disabled={!plantilla.bloques.length}
            cargando={aplicando}
            onClick={() => aplicar(1)}
          >
            {t.plantilla.aplicarEstaSemana}
          </Boton>
          <div className="flex items-end gap-2">
            <Campo etiqueta={t.plantilla.numeroSemanas} className="w-28">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={52}
                  className="campo"
                  value={semanas}
                  onChange={(e) =>
                    setSemanas(Math.min(52, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              )}
            </Campo>
            <Boton
              variante="secundario"
              className="flex-1 justify-center"
              disabled={!plantilla.bloques.length || aplicando}
              onClick={() => aplicar(semanas)}
            >
              {t.plantilla.aplicarProximas}
            </Boton>
          </div>
          {aplicados > 0 && (
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<Undo2 size={14} />}
              onClick={quitarAplicados}
            >
              {t.plantilla.deshacer} ({aplicados})
            </Boton>
          )}
        </div>
      </div>
    </div>
  );
}
