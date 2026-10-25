// Diálogo para elegir día y hora. Es la alternativa accesible al arrastre ("Mover a…",
// "Crear sesión en…", "Planificar en el calendario…").
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo } from './Campos';
import { claveDia, conHora, formatear } from './fechas';
import { t } from './textos';
import { useUI } from './almacenUI';
import { moverOcurrencia } from './operaciones';

interface Props {
  abierto: boolean;
  titulo: string;
  inicialMs: number;
  alCerrar: () => void;
  alAceptar: (inicioMs: number) => void | Promise<void>;
}

export function DialogoFechaHora({ abierto, titulo, inicialMs, alCerrar, alAceptar }: Props) {
  const [fecha, setFecha] = useState(claveDia(inicialMs));
  const [hora, setHora] = useState(formatear(inicialMs, 'HH:mm'));

  useEffect(() => {
    if (abierto) {
      setFecha(claveDia(inicialMs));
      setHora(formatear(inicialMs, 'HH:mm'));
    }
  }, [abierto, inicialMs]);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      ancho="sm"
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            {t.comun.cancelar}
          </Boton>
          <Boton variante="primario" onClick={() => alAceptar(conHora(fecha, hora).getTime())}>
            {t.comun.aceptar}
          </Boton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={t.comun.fecha}>
          {(id) => (
            <input
              id={id}
              type="date"
              className="campo"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              data-autofoco
            />
          )}
        </Campo>
        <Campo etiqueta={t.comun.hora}>
          {(id) => (
            <input
              id={id}
              type="time"
              step={300}
              className="campo"
              value={hora}
              onChange={(e) => e.target.value && setHora(e.target.value)}
            />
          )}
        </Campo>
      </div>
    </Modal>
  );
}

/** "Mover a…" para un bloque del calendario (se abre desde el editor o el menú del bloque). */
export function DialogoMoverA() {
  const moverA = useUI((s) => s.moverA);
  const poner = useUI((s) => s.poner);
  const oc = moverA?.ocurrencia;
  return (
    <DialogoFechaHora
      abierto={!!oc}
      titulo={t.comun.moverA}
      inicialMs={oc?.inicioMs ?? Date.now()}
      alCerrar={() => poner({ moverA: null })}
      alAceptar={async (inicio) => {
        if (!oc) return;
        const ok = await moverOcurrencia(oc, inicio, inicio + (oc.finMs - oc.inicioMs));
        if (ok) poner({ moverA: null });
      }}
    />
  );
}
