// Elementos globales que pueden aparecer encima de cualquier pantalla:
// avisos emergentes (toasts), diálogo de confirmación y diálogo de "¿a qué ocurrencias?".

import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Info, Repeat, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useUI } from './almacenUI';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { t } from './textos';

const ICONOS_TOAST = {
  info: <Info size={18} className="text-info" />,
  exito: <CircleCheck size={18} className="text-exito" />,
  error: <TriangleAlert size={18} className="text-peligro" />,
  logro: <Sparkles size={18} className="text-acento" />,
};

export function CapaGlobal() {
  const toasts = useUI((s) => s.toasts);
  const quitar = useUI((s) => s.quitarToast);
  const confirmacion = useUI((s) => s.confirmacion);
  const alcance = useUI((s) => s.peticionAlcance);

  return (
    <>
      {/* Región viva: los lectores de pantalla anuncian los avisos */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-borde bg-superficie px-4 py-3 shadow-elevada ${
                toast.tipo === 'logro' ? 'ring-2 ring-acento/30' : ''
              }`}
            >
              {ICONOS_TOAST[toast.tipo]}
              <p className="flex-1 text-sm font-medium text-texto">{toast.texto}</p>
              {toast.accion && (
                <button
                  type="button"
                  className="text-sm font-bold text-acento hover:underline"
                  onClick={() => {
                    toast.accion?.ejecutar();
                    quitar(toast.id);
                  }}
                >
                  {toast.accion.texto}
                </button>
              )}
              <button
                type="button"
                onClick={() => quitar(toast.id)}
                className="text-texto-tenue hover:text-texto"
                aria-label={t.comun.cerrar}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Modal
        abierto={!!confirmacion}
        alCerrar={() => confirmacion?.resolver(false)}
        titulo={confirmacion?.titulo ?? ''}
        ancho="sm"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => confirmacion?.resolver(false)}>
              {t.comun.cancelar}
            </Boton>
            <Boton
              variante={confirmacion?.peligro ? 'peligro' : 'primario'}
              onClick={() => confirmacion?.resolver(true)}
              data-autofoco
            >
              {confirmacion?.textoConfirmar ?? t.comun.confirmar}
            </Boton>
          </>
        }
      >
        <p className="text-sm text-texto-suave">{confirmacion?.mensaje}</p>
      </Modal>

      <Modal
        abierto={!!alcance}
        alCerrar={() => alcance?.resolver(null)}
        titulo={t.calendario.alcanceTitulo}
        ancho="sm"
      >
        <div className="flex items-start gap-3">
          <Repeat className="mt-0.5 shrink-0 text-acento" size={20} aria-hidden />
          <p className="text-sm text-texto-suave">{t.calendario.alcanceTexto}</p>
        </div>
        <div className="mt-4 grid gap-2">
          {alcance?.permitirSolo && (
            <Boton variante="secundario" onClick={() => alcance?.resolver('solo')} data-autofoco>
              {t.calendario.alcanceSolo}
            </Boton>
          )}
          {alcance?.permitirSiguientes && (
            <Boton variante="secundario" onClick={() => alcance?.resolver('siguientes')}>
              {t.calendario.alcanceSiguientes}
            </Boton>
          )}
          <Boton variante="secundario" onClick={() => alcance?.resolver('todos')}>
            {t.calendario.alcanceTodos}
          </Boton>
        </div>
      </Modal>
    </>
  );
}
