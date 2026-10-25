// Ayuda de atajos de teclado (se abre con "?").
import { useUI } from './almacenUI';
import { Modal } from './Modal';
import { t } from './textos';

const ATAJOS: Array<[string[], string]> = [
  [['N'], t.atajos.nuevo],
  [['T'], t.atajos.hoy],
  [['←', '→'], t.atajos.flechas],
  [['D', 'S', 'M', 'A'], t.atajos.vistas],
  [['?'], t.atajos.ayuda],
];

export function DialogoAtajos() {
  const abierto = useUI((s) => s.mostrarAtajos);
  const poner = useUI((s) => s.poner);
  return (
    <Modal
      abierto={abierto}
      alCerrar={() => poner({ mostrarAtajos: false })}
      titulo={t.atajos.titulo}
      ancho="sm"
    >
      <dl className="space-y-2.5">
        {ATAJOS.map(([teclas, texto]) => (
          <div key={texto} className="flex items-center justify-between gap-4">
            <dt className="text-sm text-texto-suave">{texto}</dt>
            <dd className="flex gap-1">
              {teclas.map((k) => (
                <kbd
                  key={k}
                  className="min-w-7 rounded-sm border border-borde-fuerte bg-superficie-2 px-2 py-0.5 text-center text-xs font-bold shadow-suave"
                >
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
