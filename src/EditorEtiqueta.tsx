// Editor de etiquetas: nombre, color, icono, duración por defecto y objetivo semanal.
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo } from './Campos';
import { SelectorColor, PALETA } from './SelectorColor';
import { SelectorIcono } from './SelectorIcono';
import { IconoEtiqueta } from './IconoEtiqueta';
import { avisar } from './almacenUI';
import { etiquetas as dbEtiquetas } from './datos';
import { t } from './textos';
import type { Etiqueta } from './tipos';

interface Props {
  abierto: boolean;
  etiqueta: Etiqueta | null;
  orden: number;
  alCerrar: () => void;
}

export function EditorEtiqueta({ abierto, etiqueta, orden, alCerrar }: Props) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(PALETA[0]);
  const [icono, setIcono] = useState('libro');
  const [duracion, setDuracion] = useState('50');
  const [objetivo, setObjetivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(etiqueta?.nombre ?? '');
    setColor(etiqueta?.color ?? PALETA[orden % PALETA.length]);
    setIcono(etiqueta?.icono ?? 'libro');
    setDuracion(String(etiqueta?.duracionMin ?? 50));
    setObjetivo(etiqueta?.objetivoSemanalHoras ? String(etiqueta.objetivoSemanalHoras) : '');
  }, [abierto, etiqueta, orden]);

  const guardar = async () => {
    const limpio = nombre.trim();
    if (!limpio) {
      avisar(t.etiquetas.nombreObligatorio, 'error');
      return;
    }
    setGuardando(true);
    const datos = {
      nombre: limpio,
      color,
      icono,
      duracionMin: Math.min(600, Math.max(5, Math.round(Number(duracion) || 50))),
      objetivoSemanalHoras: objetivo ? Math.min(168, Math.max(0.5, Number(objetivo))) : null,
    };
    try {
      if (etiqueta) await dbEtiquetas.actualizar(etiqueta.id, datos);
      else await dbEtiquetas.crear({ ...datos, archivada: false, orden });
      alCerrar();
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={etiqueta ? t.etiquetas.editar : t.etiquetas.nueva}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            {t.comun.cancelar}
          </Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            {t.comun.guardar}
          </Boton>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="flex items-end gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-white shadow-media"
            style={{ background: color }}
            aria-hidden
          >
            <IconoEtiqueta nombre={icono} tamano={22} />
          </div>
          <Campo etiqueta={t.comun.nombre} className="flex-1">
            {(id) => (
              <input
                id={id}
                className="campo"
                value={nombre}
                maxLength={60}
                onChange={(e) => setNombre(e.target.value)}
                data-autofoco
              />
            )}
          </Campo>
        </div>
        <div>
          <p className="etiqueta-campo">{t.comun.color}</p>
          <SelectorColor etiqueta={t.comun.color} valor={color} alCambiar={setColor} />
        </div>
        <div>
          <p className="etiqueta-campo">{t.comun.icono}</p>
          <SelectorIcono
            etiqueta={t.comun.icono}
            valor={icono}
            color={color}
            alCambiar={setIcono}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`${t.etiquetas.duracion} (${t.comun.minutos})`}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={5}
                max={600}
                step={5}
                className="campo"
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
              />
            )}
          </Campo>
          <Campo
            etiqueta={`${t.etiquetas.objetivo} (${t.comun.horas})`}
            ayuda={t.etiquetas.objetivoAyuda}
          >
            {(id) => (
              <input
                id={id}
                type="number"
                min={0.5}
                max={168}
                step={0.5}
                className="campo"
                value={objetivo}
                placeholder={t.comun.opcional}
                onChange={(e) => setObjetivo(e.target.value)}
              />
            )}
          </Campo>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
