// Gestión de etiquetas: crear, editar, archivar y borrar, con el progreso del objetivo semanal.
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Pencil, Plus, Tag, Target, Timer, Trash2 } from 'lucide-react';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { avisar, confirmar } from './almacenUI';
import { etiquetas as dbEtiquetas } from './datos';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { EstadoVacio } from './EstadoVacio';
import { EditorEtiqueta } from './EditorEtiqueta';
import { IconoEtiqueta } from './IconoEtiqueta';
import { progresoObjetivos } from './estadisticas';
import { horasTexto, inicioDeSemana } from './fechas';
import { t } from './textos';
import type { Etiqueta } from './tipos';

export function PantallaEtiquetas() {
  const etiquetas = useDatos((s) => s.etiquetas);
  const registros = useDatos((s) => s.registros);
  const inicioSemana = useDatos((s) => s.ajustes.inicioSemana);
  const [editando, setEditando] = useState<Etiqueta | null>(null);
  const [abierto, setAbierto] = useState(false);
  const activas = useMemo(() => etiquetasActivas(etiquetas), [etiquetas]);
  const archivadas = etiquetas.filter((e) => e.archivada);
  const progreso = useMemo(
    () =>
      new Map(
        progresoObjetivos(
          etiquetas,
          registros,
          inicioDeSemana(new Date(), inicioSemana).getTime(),
        ).map((p) => [p.etiqueta.id, p]),
      ),
    [etiquetas, registros, inicioSemana],
  );

  const abrir = (e: Etiqueta | null) => {
    setEditando(e);
    setAbierto(true);
  };

  const borrar = async (e: Etiqueta) => {
    const ok = await confirmar({
      titulo: t.etiquetas.borrarTitulo,
      mensaje: t.etiquetas.borrarTexto,
      textoConfirmar: t.comun.borrar,
      peligro: true,
    });
    if (ok) {
      await dbEtiquetas.borrar(e.id);
      avisar(t.comun.borrado);
    }
  };

  const tarjeta = (e: Etiqueta, i: number) => {
    const p = progreso.get(e.id);
    return (
      <motion.li
        key={e.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className={`tarjeta flex flex-col gap-3 ${e.archivada ? 'opacity-60' : ''}`}
        style={{
          backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${e.color} 12%, var(--mos-superficie)) 0%, var(--mos-superficie) 60%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-white shadow-media"
            style={{ background: e.color }}
          >
            <IconoEtiqueta nombre={e.icono} tamano={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold">{e.nombre}</h3>
            <p className="flex items-center gap-3 text-xs text-texto-suave">
              <span className="flex items-center gap-1">
                <Timer size={12} aria-hidden /> {e.duracionMin} min
              </span>
              {e.objetivoSemanalHoras && (
                <span className="flex items-center gap-1">
                  <Target size={12} aria-hidden /> {e.objetivoSemanalHoras} {t.etiquetas.porSemana}
                </span>
              )}
            </p>
          </div>
        </div>
        {p && (
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span className="text-texto-suave">{horasTexto(p.realMs)}</span>
              <span>{Math.round(p.porcentaje * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-superficie-3">
              <motion.div
                className="h-full rounded-full"
                style={{ background: e.color }}
                initial={{ width: 0 }}
                animate={{ width: `${p.porcentaje * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        )}
        <div className="mt-auto flex gap-1">
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={<Pencil size={14} />}
            onClick={() => abrir(e)}
          >
            {t.comun.editar}
          </Boton>
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={e.archivada ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            onClick={() => dbEtiquetas.actualizar(e.id, { archivada: !e.archivada })}
          >
            {e.archivada ? t.comun.desarchivar : t.comun.archivar}
          </Boton>
          <Boton
            variante="fantasma"
            tamano="icono"
            className="ml-auto h-8 w-8"
            aria-label={`${t.comun.borrar} ${e.nombre}`}
            onClick={() => borrar(e)}
          >
            <Trash2 size={15} className="text-peligro" />
          </Boton>
        </div>
      </motion.li>
    );
  };

  return (
    <div>
      <Cabecera
        titulo={t.etiquetas.titulo}
        subtitulo={t.etiquetas.subtitulo}
        acciones={
          <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
            {t.etiquetas.nueva}
          </Boton>
        }
      />
      {activas.length === 0 && archivadas.length === 0 ? (
        <EstadoVacio
          icono={<Tag size={28} />}
          titulo={t.etiquetas.vacioTitulo}
          texto={t.etiquetas.vacioTexto}
          accion={
            <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
              {t.etiquetas.nueva}
            </Boton>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activas.map(tarjeta)}</ul>
          {archivadas.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-sm font-bold tracking-wide text-texto-suave uppercase">
                {t.etiquetas.archivadas}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {archivadas.map(tarjeta)}
              </ul>
            </>
          )}
        </>
      )}
      <EditorEtiqueta
        abierto={abierto}
        etiqueta={editando}
        orden={etiquetas.length}
        alCerrar={() => setAbierto(false)}
      />
    </div>
  );
}
