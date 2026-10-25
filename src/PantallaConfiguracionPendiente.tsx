// Se muestra cuando faltan las variables VITE_FIREBASE_* en el .env (en vez de una pantalla en blanco).
import { Settings } from 'lucide-react';
import { Logo } from './Logo';
import { t } from './textos';
import { variablesQueFaltan } from './firebase';

export function PantallaConfiguracionPendiente() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <Logo tamano={44} />
          <div>
            <p className="text-xs font-semibold tracking-wide text-texto-tenue uppercase">
              {t.app.nombre}
            </p>
            <h1 className="flex items-center gap-2 text-xl font-extrabold">
              <Settings size={20} className="text-acento" aria-hidden />
              {t.configuracion.titulo}
            </h1>
          </div>
        </div>
        <p className="text-sm text-texto-suave">{t.configuracion.texto}</p>
        <p className="mt-4 text-sm font-semibold">{t.configuracion.faltan}</p>
        <ul className="mt-2 space-y-1">
          {variablesQueFaltan.map((v) => (
            <li key={v}>
              <code className="rounded bg-superficie-2 px-2 py-0.5 text-sm">{v}</code>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-texto-suave">{t.configuracion.guia}</p>
      </div>
    </main>
  );
}
